import type { HttpContext } from '@adonisjs/core/http'
import referralService from '#services/game/referral_service'

export default class ReferralsController {
  /**
   * GET /api/v1/referrals: tu enlace de invitación, las reglas y a quiénes invitaste
   */
  async show({ auth }: HttpContext) {
    return { data: await referralService.summary(auth.getUserOrFail()) }
  }
}
