import logger from '@adonisjs/core/services/logger'
import gameConfig from '#config/game'
import RoomSeat from '#models/room_seat'
import roomService from '#services/game/room_service'
import tableManager from '#game/table_manager'
import { GameError } from '#exceptions/game_error'

const key = (roomId: number, userId: number) => `${roomId}:${userId}`

/**
 * Presencia en las mesas: quién sigue mirando la mesa en la que está sentado.
 *
 * Hasta tener tiempo real (WebSockets), la app consulta el estado de la mesa cada segundo;
 * cada consulta cuenta como "sigo aquí". Si un jugador sentado deja de consultar durante
 * `disconnectTimeoutSeconds` (cerró la app o la pestaña, se quedó sin conexión, la dejó en
 * segundo plano), se le levanta de la mesa igual que si hubiera pulsado "Levantarse".
 *
 * Vive en memoria: supone un solo proceso de servidor, como el TableManager. Tras un
 * reinicio no hay registros; el primer barrido da a cada asiento el margen completo.
 */
export class PresenceService {
  private seen = new Map<string, number>()

  constructor(private timeoutMs = gameConfig.table.disconnectTimeoutSeconds * 1000) {}

  /** El jugador consultó la mesa */
  touch(roomId: number, userId: number, now = Date.now()) {
    this.seen.set(key(roomId, userId), now)
  }

  /**
   * Levanta a un jugador de la mesa. Si está jugando una mano se retira de ella y se
   * levanta al terminarla (`pending: true`).
   */
  async standUp(userId: number, roomId: number, reason: 'requested' | 'disconnected') {
    const result = await roomService.leave({ id: userId }, roomId, reason)
    if (result.pending) await tableManager.requestLeave(roomId, userId)
    this.seen.delete(key(roomId, userId))
    return result
  }

  /**
   * Levanta a los jugadores sentados que llevan demasiado tiempo sin consultar su mesa.
   * Devuelve los asientos afectados.
   */
  async sweep(now = Date.now()) {
    const seats = await RoomSeat.query()
      .select('room_id', 'user_id')
      .where('leave_after_hand', false)
      // En torneo quien se desconecta sigue en juego (pasa o se retira solo en su turno)
      .whereHas('room', (q) => q.whereNull('tournament_id'))

    const absent: { roomId: number; userId: number }[] = []
    const seated = new Set<string>()
    for (const seat of seats) {
      const k = key(seat.roomId, seat.userId)
      seated.add(k)
      const last = this.seen.get(k)
      if (last === undefined) {
        // Sin registro (p. ej. tras reiniciar el servidor): empieza a contar ahora
        this.seen.set(k, now)
      } else if (now - last >= this.timeoutMs) {
        absent.push({ roomId: seat.roomId, userId: seat.userId })
      }
    }

    // Olvida a quien ya no está sentado (espectadores, asientos liberados)
    for (const k of this.seen.keys()) {
      if (!seated.has(k)) this.seen.delete(k)
    }

    for (const { roomId, userId } of absent) {
      try {
        const result = await this.standUp(userId, roomId, 'disconnected')
        logger.info({ roomId, userId, ...result }, 'Jugador desconectado: levantado de la mesa')
      } catch (error) {
        // Se levantó por su cuenta mientras tanto
        if (error instanceof GameError && error.errorCode === 'not_seated') continue
        logger.error({ err: error, roomId, userId }, 'No se pudo levantar al jugador desconectado')
      }
    }
    return absent
  }

  /** Solo tests */
  reset() {
    this.seen.clear()
  }
}

export default new PresenceService()
