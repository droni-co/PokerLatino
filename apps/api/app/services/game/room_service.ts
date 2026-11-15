import db from '@adonisjs/lucid/services/db'
import type { Currency } from '#config/game'
import Room from '#models/room'
import RoomSeat from '#models/room_seat'
import Hand from '#models/hand'
import type User from '#models/user'
import walletService from '#services/game/wallet_service'
import { GameError } from '#exceptions/game_error'

export class RoomService {
  list(filters: { currency?: Currency } = {}) {
    return Room.query()
      .where('status', 'active')
      .if(filters.currency, (q) => q.where('currency', filters.currency!))
      .withCount('seats', (q) => q.as('seatedCount'))
      .orderBy([{ column: 'currency' }, { column: 'big_blind' }, { column: 'id' }])
  }

  async find(roomId: number) {
    const room = await Room.query()
      .where('id', roomId)
      .preload('seats', (q) => q.preload('user').orderBy('seat_number'))
      .first()
    if (!room) throw new GameError('room_not_found', 'La sala no existe')
    return room
  }

  /**
   * Sentarse en una sala: descuenta el buy-in de la billetera de la moneda de la sala
   * y lo convierte en fichas (stack) en la mesa.
   */
  async sit(user: User, roomId: number, input: { buyIn: number; seatNumber?: number }) {
    return db.transaction(async (trx) => {
      // Bloquear la sala serializa a quienes intentan sentarse al mismo tiempo
      const room = await Room.query({ client: trx }).where('id', roomId).forUpdate().first()
      if (!room) throw new GameError('room_not_found', 'La sala no existe')
      if (room.status !== 'active') throw new GameError('room_not_active', 'La sala no está activa')

      if (
        !Number.isSafeInteger(input.buyIn) ||
        input.buyIn < room.minBuyIn ||
        input.buyIn > room.maxBuyIn
      ) {
        throw new GameError(
          'invalid_buy_in',
          `El buy-in debe estar entre ${room.minBuyIn} y ${room.maxBuyIn}`
        )
      }

      const seats = await RoomSeat.query({ client: trx }).where('room_id', room.id)
      if (seats.some((s) => s.userId === user.id)) {
        throw new GameError('already_seated', 'Ya estás sentado en esta sala')
      }

      const taken = new Set(seats.map((s) => s.seatNumber))
      let seatNumber = input.seatNumber
      if (seatNumber !== undefined) {
        if (!Number.isInteger(seatNumber) || seatNumber < 1 || seatNumber > room.maxSeats) {
          throw new GameError('invalid_seat', `El asiento debe estar entre 1 y ${room.maxSeats}`)
        }
        if (taken.has(seatNumber)) throw new GameError('seat_taken', 'Ese asiento está ocupado')
      } else {
        seatNumber = Array.from({ length: room.maxSeats }, (_, i) => i + 1).find(
          (n) => !taken.has(n)
        )
        if (seatNumber === undefined) throw new GameError('room_full', 'La sala está llena')
      }

      await walletService.debit(trx, {
        userId: user.id,
        currency: room.currency,
        amount: input.buyIn,
        type: 'buy_in',
        reference: { type: 'room', id: room.id },
        description: `Buy-in en ${room.name}`,
      })

      return RoomSeat.create(
        { roomId: room.id, userId: user.id, seatNumber, stack: input.buyIn, status: 'active' },
        { client: trx }
      )
    })
  }

  /**
   * Levantarse: las fichas que queden en la mesa vuelven a la billetera.
   */
  async leave(user: User, roomId: number) {
    return db.transaction(async (trx) => {
      // Mismo bloqueo que sit() y el inicio de mano: nadie se levanta mientras se reparte
      await Room.query({ client: trx }).where('id', roomId).forUpdate().first()

      const seat = await RoomSeat.query({ client: trx })
        .where('room_id', roomId)
        .where('user_id', user.id)
        .forUpdate()
        .first()
      if (!seat) throw new GameError('not_seated', 'No estás sentado en esta sala')

      const inHand = await Hand.query({ client: trx })
        .where('room_id', roomId)
        .where('status', 'in_progress')
        .whereHas('players', (q) => q.where('user_id', user.id))
        .first()
      if (inHand) {
        throw new GameError('hand_in_progress', 'Espera a que termine la mano para levantarte')
      }

      const room = await Room.findOrFail(roomId, { client: trx })
      if (seat.stack > 0) {
        await walletService.credit(trx, {
          userId: user.id,
          currency: room.currency,
          amount: seat.stack,
          type: 'cash_out',
          reference: { type: 'room', id: room.id },
          description: `Salida de ${room.name}`,
        })
      }

      const cashedOut = seat.stack
      await seat.useTransaction(trx).delete()
      return { currency: room.currency, cashedOut }
    })
  }
}

export default new RoomService()
