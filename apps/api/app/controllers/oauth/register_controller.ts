import type { HttpContext } from '@adonisjs/core/http'
import accountService from '#services/game/account_service'
import { registerValidator } from '#validators/user'
import { continueFlow } from '#services/oauth/continue_flow'

export default class RegisterController {
  /**
   * GET /oauth/register
   */
  async create(ctx: HttpContext) {
    if (await ctx.auth.use('web').check()) return continueFlow(ctx)
    return ctx.view.render('oauth/register')
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
    } = await ctx.request.validateUsing(registerValidator)
    const user = await accountService.register({ username, email, password, birthDate })

    await ctx.auth.use('web').login(user)
    return continueFlow(ctx)
  }
}
