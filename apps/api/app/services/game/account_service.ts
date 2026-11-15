import type { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import User from '#models/user'
import walletService from '#services/game/wallet_service'

export class AccountService {
  /**
   * Crea la cuenta y, en la misma transacción, sus billeteras con el bono inicial.
   * Si algo falla, no queda un usuario sin billeteras.
   */
  async register(input: {
    username: string
    email: string
    password: string
    birthDate: DateTime
  }) {
    return db.transaction(async (trx) => {
      const user = await User.create(input, { client: trx })
      await walletService.provisionUser(trx, user.id)
      return user
    })
  }
}

export default new AccountService()
