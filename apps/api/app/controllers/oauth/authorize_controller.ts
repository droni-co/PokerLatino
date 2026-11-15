import type { HttpContext } from '@adonisjs/core/http'
import oauthConfig from '#config/oauth'
import oauthServer, { AuthorizeError, type AuthorizeRequest } from '#services/oauth/oauth_server'
import { generateToken, safeEqual } from '#services/oauth/crypto'

/**
 * Clave de sesión donde guardamos la petición /oauth/authorize mientras
 * el usuario inicia sesión o se registra.
 */
export const PENDING_AUTHORIZE_KEY = 'oauth.pending_authorize'
const CONSENT_KEY = 'oauth.consent'

export default class AuthorizeController {
  /**
   * GET /oauth/authorize
   */
  async show(ctx: HttpContext) {
    const { request, response, session, auth, view } = ctx
    const query = request.qs()

    let authRequest: AuthorizeRequest
    try {
      authRequest = await oauthServer.validateAuthorizeRequest(query)
    } catch (error) {
      return this.handleError(ctx, error)
    }

    const web = auth.use('web')
    const loggedIn = await web.check()

    // prompt=login obliga a volver a pedir credenciales
    if (query.prompt === 'login') {
      if (loggedIn) await web.logout()
      const rest = { ...query }
      delete rest.prompt
      session.put(PENDING_AUTHORIZE_KEY, rest)
      return response.redirect().toRoute('oauth.login')
    }

    if (!loggedIn) {
      session.put(PENDING_AUTHORIZE_KEY, query)
      return response.redirect().toRoute('oauth.login')
    }

    session.forget(PENDING_AUTHORIZE_KEY)
    const user = web.getUserOrFail()

    // Las apps propias (ej. el cliente Flutter) no necesitan pantalla de consentimiento
    if (authRequest.client.isFirstParty) {
      return response.redirect(await oauthServer.approve(authRequest, user))
    }

    const nonce = generateToken()
    session.put(CONSENT_KEY, { nonce, query })
    return view.render('oauth/consent', {
      client: authRequest.client,
      user,
      nonce,
      scopes: authRequest.scopes.map((s) => ({ name: s, description: oauthConfig.scopes[s] })),
    })
  }

  /**
   * POST /oauth/authorize (respuesta de la pantalla de consentimiento)
   */
  async decide(ctx: HttpContext) {
    const { request, response, session, auth } = ctx
    const consent = session.pull(CONSENT_KEY) as {
      nonce: string
      query: Record<string, unknown>
    } | null
    const nonce = request.input('nonce')

    if (!consent || typeof nonce !== 'string' || !safeEqual(consent.nonce, nonce)) {
      return this.handleError(
        ctx,
        new AuthorizeError(
          'invalid_request',
          'La solicitud expiró. Vuelve a intentarlo desde la aplicación.'
        )
      )
    }

    const user = await auth.use('web').authenticate()

    let authRequest: AuthorizeRequest
    try {
      authRequest = await oauthServer.validateAuthorizeRequest(consent.query)
    } catch (error) {
      return this.handleError(ctx, error)
    }

    if (request.input('decision') !== 'approve') {
      return response.redirect(
        oauthServer.buildRedirect(authRequest.redirectUri, {
          error: 'access_denied',
          error_description: 'El usuario rechazó el acceso',
          state: authRequest.state,
        })
      )
    }

    return response.redirect(await oauthServer.approve(authRequest, user))
  }

  private handleError({ response, view }: HttpContext, error: unknown) {
    if (!(error instanceof AuthorizeError)) throw error

    if (error.redirect) {
      return response.redirect(
        oauthServer.buildRedirect(error.redirect.uri, {
          error: error.code,
          error_description: error.description,
          state: error.redirect.state,
        })
      )
    }

    response.status(400)
    return view.render('oauth/error', { error: error.code, description: error.description })
  }
}
