import type { HttpContext } from '@adonisjs/core/http'
import gameConfig from '#config/game'
import referralService, { normalizeCode } from '#services/game/referral_service'

/** Cookie con el código de invitación hasta que el invitado crea su cuenta */
export const REFERRAL_COOKIE = 'ref'

export default class InviteController {
  /**
   * GET /r/:code: página de invitación. Recuerda el código y lleva a la app; al crear la
   * cuenta, el formulario de registro ya trae el código.
   */
  async show({ params, response, view }: HttpContext) {
    const referrer = await referralService.findReferrer(String(params.code))
    if (!referrer) return response.redirect('/')

    const { referredReward, cookieDays } = gameConfig.referrals
    response.cookie(REFERRAL_COOKIE, normalizeCode(String(params.code)), {
      maxAge: `${cookieDays}d`,
      httpOnly: true,
      sameSite: 'lax',
    })
    return view.render('invite', {
      name: referrer.displayName,
      code: referrer.referralCode,
      total: new Intl.NumberFormat('en-US').format(gameConfig.signupBonus + referredReward),
    })
  }
}
