import type { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import User from '#models/user'
import walletService from '#services/game/wallet_service'
import referralService from '#services/game/referral_service'
import progressService from '#services/game/progress_service'

export class AccountService {
  /**
   * Crea la cuenta y, en la misma transacción, sus billeteras con el bono inicial.
   * Si algo falla, no queda un usuario sin billeteras.
   */
  async register(
    input: {
      username: string
      email: string
      password: string
      birthDate: DateTime
    },
    /** Invitación: código de quien invita e IP del registro (antiabuso) */
    referral?: { code: string; ip: string | null }
  ) {
    const { user, invitation } = await db.transaction(async (trx) => {
      const created = await User.create(input, { client: trx })
      await walletService.provisionUser(trx, created.id)
      await progressService.create(trx, created.id)
      const applied = referral?.code
        ? await referralService.apply(trx, created, referral.code, referral.ip)
        : null
      return { user: created, invitation: applied }
    })
    // Logros de invitar ("Embajador"…) para quien invitó
    if (invitation && invitation.status !== 'blocked') {
      await progressService.evaluateQuietly(invitation.referrerId)
    }
    return user
  }
}

export default new AccountService()
