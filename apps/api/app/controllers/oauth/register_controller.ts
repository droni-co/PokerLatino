import type { HttpContext } from '@adonisjs/core/http'
import accountService from '#services/game/account_service'
import { registerValidator } from '#validators/user'
import { continueFlow } from '#services/oauth/continue_flow'
import { REFERRAL_COOKIE } from '#controllers/invite_controller'

export default class RegisterController {
  /**
   * GET /oauth/register
   */
  async create(ctx: HttpContext) {
    if (await ctx.auth.use('web').check()) return continueFlow(ctx)
    // Llegó por un enlace de invitación (/r/CODIGO): el código ya viene puesto
    return ctx.view.render('oauth/register', {
      referralCode: ctx.request.cookie(REFERRAL_COOKIE, '') as string,
    })
  }

  /**
   * POST /oauth/register
   */
  async store(ctx: HttpContext) {
    const {
      username,
      email,
      password,
      birth_date: birthDate,
      referral_code: referralCode,
    } = await ctx.request.validateUsing(registerValidator)
    const user = await accountService.register(
      { username, email, password, birthDate },
      referralCode ? { code: referralCode, ip: ctx.request.ip() } : undefined
    )
    ctx.response.clearCookie(REFERRAL_COOKIE)

    await ctx.auth.use('web').login(user)
    return continueFlow(ctx)
  }
}
