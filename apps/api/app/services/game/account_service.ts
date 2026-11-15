import type { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import User from '#models/user'
import walletService from '#services/game/wallet_service'
import referralService from '#services/game/referral_service'

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
    return db.transaction(async (trx) => {
      const user = await User.create(input, { client: trx })
      await walletService.provisionUser(trx, user.id)
      if (referral?.code) await referralService.apply(trx, user, referral.code, referral.ip)
      return user
    })
  }
}

export default new AccountService()
