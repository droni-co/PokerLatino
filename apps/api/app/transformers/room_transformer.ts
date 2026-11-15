import type Room from '#models/room'
import type RoomSeat from '#models/room_seat'
import { BaseTransformer } from '@adonisjs/core/transformers'

export default class RoomTransformer extends BaseTransformer<Room> {
  toObject() {
    const room = this.resource
    const seats = room.$preloaded.seats ? room.seats : undefined
    return {
      id: room.id,
      slug: room.slug,
      name: room.name,
      currency: room.currency,
      gameType: room.gameType,
      bettingStructure: room.bettingStructure,
      maxSeats: room.maxSeats,
      smallBlind: room.smallBlind,
      bigBlind: room.bigBlind,
      minBuyIn: room.minBuyIn,
      maxBuyIn: room.maxBuyIn,
      actionTimeoutSeconds: room.actionTimeoutSeconds,
      seatedCount: seats ? seats.length : Number(room.$extras.seatedCount ?? 0),
      seats: seats?.map((seat) => RoomTransformer.seat(seat)),
    }
  }

  /**
   * Asiento público: nunca incluye el email del jugador
   */
  static seat(seat: RoomSeat) {
    return {
      seatNumber: seat.seatNumber,
      stack: seat.stack,
      status: seat.status,
      player: { id: seat.userId, displayName: seat.user?.displayName ?? `Jugador #${seat.userId}` },
    }
  }
}
