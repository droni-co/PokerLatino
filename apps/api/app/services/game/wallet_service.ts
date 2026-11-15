import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import gameConfig, { CURRENCIES, type Currency } from '#config/game'
import Wallet from '#models/wallet'
import WalletTransaction, { type WalletTransactionType } from '#models/wallet_transaction'
import PlayerStat from '#models/player_stat'
import { GameError } from '#exceptions/game_error'

type Movement = {
  userId: number
  currency: Currency
  amount: number
  type: WalletTransactionType
  reference?: { type: string; id: string | number }
  description?: string
}

/**
 * Único punto donde cambian los saldos. Todas las operaciones:
 *  - corren dentro de una transacción de base de datos (la recibe como `trx`)
 *  - bloquean la fila de la billetera (SELECT ... FOR UPDATE) para evitar dobles gastos
 *  - dejan un registro inmutable en wallet_transactions con el saldo resultante
 */
export class WalletService {
  /**
   * Crea las billeteras y estadísticas de un jugador nuevo y acredita el bono de bienvenida.
   */
  async provisionUser(trx: TransactionClientContract, userId: number) {
    for (const currency of CURRENCIES) {
      await Wallet.create({ userId, currency, balance: 0 }, { client: trx })
      await PlayerStat.create({ userId, currency }, { client: trx })

      const bonus = gameConfig.signupBonus[currency]
      if (bonus > 0) {
        await this.credit(trx, {
          userId,
          currency,
          amount: bonus,
          type: 'signup_bonus',
          description: 'Bono de bienvenida',
        })
      }
    }
  }

  async credit(trx: TransactionClientContract, movement: Movement) {
    this.assertPositiveInteger(movement.amount)
    const wallet = await this.lock(trx, movement.userId, movement.currency)
    wallet.balance += movement.amount
    await wallet.useTransaction(trx).save()
    return this.record(trx, wallet, movement.amount, movement)
  }

  async debit(trx: TransactionClientContract, movement: Movement) {
    this.assertPositiveInteger(movement.amount)
    const wallet = await this.lock(trx, movement.userId, movement.currency)
    if (wallet.balance < movement.amount) {
      throw new GameError('insufficient_funds', 'Saldo insuficiente')
    }
    wallet.balance -= movement.amount
    await wallet.useTransaction(trx).save()
    return this.record(trx, wallet, -movement.amount, movement)
  }

  async getWallets(userId: number) {
    const wallets = await Wallet.query().where('user_id', userId)
    return CURRENCIES.map((c) => wallets.find((w) => w.currency === c)).filter(
      (w): w is Wallet => w !== undefined
    )
  }

  private lock(trx: TransactionClientContract, userId: number, currency: Currency) {
    return Wallet.query({ client: trx })
      .where('user_id', userId)
      .where('currency', currency)
      .forUpdate()
      .firstOrFail()
  }

  private record(
    trx: TransactionClientContract,
    wallet: Wallet,
    signedAmount: number,
    movement: Movement
  ) {
    return WalletTransaction.create(
      {
        walletId: wallet.id,
        type: movement.type,
        amount: signedAmount,
        balanceAfter: wallet.balance,
        referenceType: movement.reference?.type ?? null,
        referenceId: movement.reference ? String(movement.reference.id) : null,
        description: movement.description ?? null,
      },
      { client: trx }
    )
  }

  private assertPositiveInteger(amount: number) {
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      throw new GameError('invalid_amount', 'El monto debe ser un entero positivo')
    }
  }
}

export default new WalletService()
