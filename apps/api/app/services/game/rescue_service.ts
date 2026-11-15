import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import type { QueryClientContract } from '@adonisjs/lucid/types/database'
import gameConfig from '#config/game'
import Wallet from '#models/wallet'
import WalletTransaction from '#models/wallet_transaction'
import RoomLevel from '#models/room_level'
import RoomSeat from '#models/room_seat'
import walletService from '#services/game/wallet_service'
import { GameError } from '#exceptions/game_error'

/**
 * Rescate diario: quien no tiene fichas para la mesa más barata puede reclamar
 * `rescue.amount` fichas gratis una vez cada `rescue.cooldownHours` horas.
 *
 * Cuentan las fichas de la billetera y las que tenga sentado en mesas normales (así no se
 * puede sentar con todo y reclamar). Las de torneo no cuentan: no son de la billetera.
 */
export class RescueService {
  async status(userId: number, now = DateTime.now(), client?: QueryClientContract) {
    const { amount, cooldownHours } = gameConfig.rescue
    const wallet = await Wallet.query({ client }).where('user_id', userId).firstOrFail()

    const seated = await RoomSeat.query({ client })
      .where('user_id', userId)
      .whereHas('room', (q) => q.whereNull('tournament_id'))
      .sum('stack as total')
    const atTables = Number(seated[0]?.$extras.total ?? 0)

    const cheapest = await RoomLevel.query({ client })
      .where('status', 'active')
      .min('min_buy_in as min')
    const threshold = Number(cheapest[0]?.$extras.min ?? 0)

    const last = await WalletTransaction.query({ client })
      .where('wallet_id', wallet.id)
      .where('type', 'rescue')
      .orderBy('created_at', 'desc')
      .first()
    const nextAt = last ? last.createdAt.plus({ hours: cooldownHours }) : null
    const eligible = threshold > 0 && wallet.balance + atTables < threshold
    const cooledDown = !nextAt || nextAt <= now

    return {
      amount,
      /** Fichas para la mesa más barata: por debajo se puede reclamar */
      threshold,
      eligible,
      available: eligible && cooledDown,
      /** Cuándo se podrá volver a reclamar (null si nunca se reclamó o ya se puede) */
      nextAt: nextAt && !cooledDown ? nextAt.toISO() : null,
    }
  }

  async claim(userId: number, now = DateTime.now()) {
    return db.transaction(async (trx) => {
      // Bloquear la billetera serializa dos reclamos simultáneos
      await Wallet.query({ client: trx }).where('user_id', userId).forUpdate().firstOrFail()
      const status = await this.status(userId, now, trx)
      if (!status.eligible) {
        throw new GameError(
          'rescue_unavailable',
          'El rescate es solo para quien no tiene fichas para la mesa más barata'
        )
      }
      if (!status.available) {
        throw new GameError('rescue_unavailable', 'Ya reclamaste tu rescate: vuelve mañana')
      }
      await walletService.credit(trx, {
        userId,
        amount: status.amount,
        type: 'rescue',
        description: 'Rescate diario',
      })
      return this.status(userId, now, trx)
    })
  }
}

export default new RescueService()
