import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import { loginValidator } from '#validators/user'
import { continueFlow } from '#services/oauth/continue_flow'
import { PENDING_AUTHORIZE_KEY } from '#controllers/oauth/authorize_controller'

export default class SessionController {
  /**
   * GET /oauth/login
   */
  async create(ctx: HttpContext) {
    if (await ctx.auth.use('web').check()) return continueFlow(ctx)
    return ctx.view.render('oauth/login', {
      hasPendingRequest: ctx.session.has(PENDING_AUTHORIZE_KEY),
    })
  }

  /**
   * POST /oauth/login
   */
  async store(ctx: HttpContext) {
    const { request, response, session, auth } = ctx
    const { email, password } = await request.validateUsing(loginValidator)

    let user: User
    try {
      user = await User.verifyCredentials(email, password)
    } catch {
      session.flash('error', 'Email o contraseña incorrectos')
      session.flashExcept(['password', '_csrf'])
      return response.redirect().toRoute('oauth.login')
    }

    await auth.use('web').login(user)
    return continueFlow(ctx)
  }

  /**
   * POST /oauth/logout: cierra la sesión del navegador.
   * (Para cerrar sesión en la app, el cliente debe llamar a /oauth/revoke con su refresh token.)
   */
  async destroy({ auth, response }: HttpContext) {
    await auth.use('web').logout()
    return response.redirect().toRoute('oauth.login')
  }
}
