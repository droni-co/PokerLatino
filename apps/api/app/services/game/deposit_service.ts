import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import gameConfig from '#config/game'
import Deposit from '#models/deposit'
import PlayerStat from '#models/player_stat'
import walletService from '#services/game/wallet_service'
import { GameError } from '#exceptions/game_error'

/**
 * Recargas de saldo en USD. Flujo previsto con un proveedor de pagos:
 *   1. createPending()  → se crea el depósito y se manda al usuario al checkout
 *   2. el proveedor confirma (webhook) → complete()  → se acredita la billetera
 */
export class DepositService {
  async createPending(userId: number, amount: number, provider = 'manual') {
    const { minAmount, maxAmount } = gameConfig.deposits
    if (!Number.isSafeInteger(amount) || amount < minAmount || amount > maxAmount) {
      throw new GameError(
        'invalid_amount',
        `La recarga debe estar entre ${minAmount} y ${maxAmount} centavos`
      )
    }
    return Deposit.create({ userId, amount, provider, status: 'pending' })
  }

  /**
   * Idempotente: si el proveedor reenvía la confirmación, no se acredita dos veces.
   */
  async complete(depositId: string, providerReference?: string) {
    return db.transaction(async (trx) => {
      const deposit = await Deposit.query({ client: trx })
        .where('id', depositId)
        .forUpdate()
        .first()
      if (!deposit) throw new GameError('deposit_not_found', 'Recarga no encontrada')
      if (deposit.status === 'completed') return deposit
      if (deposit.status !== 'pending') {
        throw new GameError('deposit_not_pending', `La recarga está ${deposit.status}`)
      }

      await walletService.credit(trx, {
        userId: deposit.userId,
        currency: 'usd',
        amount: deposit.amount,
        type: 'deposit',
        reference: { type: 'deposit', id: deposit.id },
        description: `Recarga (${deposit.provider})`,
      })

      await PlayerStat.query({ client: trx })
        .where('user_id', deposit.userId)
        .where('currency', 'usd')
        .increment('total_deposited', deposit.amount)

      deposit.merge({
        status: 'completed',
        completedAt: DateTime.now(),
        providerReference: providerReference ?? deposit.providerReference,
      })
      await deposit.useTransaction(trx).save()
      return deposit
    })
  }
}

export default new DepositService()
