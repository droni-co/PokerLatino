import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type Room from '#models/room'
import RoomSeat from '#models/room_seat'
import { DateTime } from 'luxon'
import walletService from '#services/game/wallet_service'

export type StandUpReason = 'requested' | 'inactive' | 'disconnected' | 'busted'

/**
 * Levanta a un jugador de la mesa: sus fichas vuelven a la billetera y se libera el asiento.
 * Debe llamarse dentro de una transacción que tenga bloqueada la sala.
 */
export async function cashOutSeat(
  trx: TransactionClientContract,
  room: Room,
  seat: RoomSeat,
  reason: StandUpReason = 'requested'
) {
  const cashedOut = seat.stack
  if (cashedOut > 0) {
    await walletService.credit(trx, {
      userId: seat.userId,
      amount: cashedOut,
      type: 'cash_out',
      reference: { type: 'room', id: room.id },
      description:
        reason === 'inactive'
          ? `Salida de ${room.name} por inactividad`
          : reason === 'disconnected'
            ? `Salida de ${room.name} por desconexión`
            : `Salida de ${room.name}`,
    })
  }
  await seat.useTransaction(trx).delete()

  // Mesa vacía: el cierre automático de mesas extra cuenta desde ahora
  const someoneLeft = await RoomSeat.query({ client: trx }).where('room_id', room.id).first()
  if (!someoneLeft && !room.emptySince) {
    room.emptySince = DateTime.now()
    await room.useTransaction(trx).save()
  }
  return { cashedOut }
}
