import type { HttpContext } from '@adonisjs/core/http'
import oauthConfig from '#config/oauth'
import oauthServer from '#services/oauth/oauth_server'
import { OAuthError } from '#services/oauth/oauth_error'

const noStore = ({ response }: HttpContext) => {
  response.header('Cache-Control', 'no-store')
  response.header('Pragma', 'no-cache')
}

export default class TokenController {
  /**
   * POST /oauth/token (RFC 6749 §3.2)
   */
  async token(ctx: HttpContext) {
    noStore(ctx)
    const body = ctx.request.body()
    const client = await oauthServer.authenticateClient(ctx)

    switch (body.grant_type) {
      case 'authorization_code': {
        if (!client.allowsGrant('authorization_code')) {
          throw new OAuthError('unauthorized_client', 'Grant no permitido para este cliente')
        }
        const tokens = await oauthServer.exchangeAuthorizationCode(client, {
          code: body.code,
          redirectUri: body.redirect_uri,
          codeVerifier: body.code_verifier,
        })
        return oauthServer.toResponse(tokens)
      }

      case 'refresh_token': {
        if (!client.allowsGrant('refresh_token')) {
          throw new OAuthError('unauthorized_client', 'Grant no permitido para este cliente')
        }
        const tokens = await oauthServer.refresh(client, {
          refreshToken: body.refresh_token,
          scope: body.scope,
        })
        return oauthServer.toResponse(tokens)
      }

      case undefined:
        throw new OAuthError('invalid_request', 'Falta grant_type')

      default:
        throw new OAuthError(
          'unsupported_grant_type',
          `grant_type no soportado: ${body.grant_type}`
        )
    }
  }

  /**
   * POST /oauth/revoke (RFC 7009). Siempre responde 200, exista o no el token.
   */
  async revoke(ctx: HttpContext) {
    const client = await oauthServer.authenticateClient(ctx)
    const { token, token_type_hint: hint } = ctx.request.body()
    if (!token || typeof token !== 'string') {
      throw new OAuthError('invalid_request', 'Falta token')
    }

    await oauthServer.revoke(client, token, hint)
    return ctx.response.status(200).send('')
  }

  /**
   * POST /oauth/introspect (RFC 7662). Solo para clientes confidenciales (otros backends).
   */
  async introspect(ctx: HttpContext) {
    noStore(ctx)
    const client = await oauthServer.authenticateClient(ctx)
    if (client.isPublic) {
      throw new OAuthError('invalid_client', 'La introspección requiere un cliente confidencial')
    }

    const { token } = ctx.request.body()
    if (!token || typeof token !== 'string') {
      throw new OAuthError('invalid_request', 'Falta token')
    }
    return oauthServer.introspect(token)
  }

  /**
   * GET /.well-known/oauth-authorization-server (RFC 8414)
   */
  async metadata() {
    const base = oauthConfig.issuer
    return {
      issuer: base,
      authorization_endpoint: `${base}/oauth/authorize`,
      token_endpoint: `${base}/oauth/token`,
      revocation_endpoint: `${base}/oauth/revoke`,
      introspection_endpoint: `${base}/oauth/introspect`,
      registration_page: `${base}/oauth/register`,
      scopes_supported: Object.keys(oauthConfig.scopes),
      response_types_supported: ['code'],
      response_modes_supported: ['query'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['none', 'client_secret_basic', 'client_secret_post'],
      revocation_endpoint_auth_methods_supported: [
        'none',
        'client_secret_basic',
        'client_secret_post',
      ],
      introspection_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post'],
      authorization_response_iss_parameter_supported: true,
    }
  }
}
