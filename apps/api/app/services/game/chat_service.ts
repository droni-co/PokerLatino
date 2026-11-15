import { DateTime } from 'luxon'
import gameConfig from '#config/game'
import ChatMessage from '#models/chat_message'
import Room from '#models/room'
import type User from '#models/user'
import { GameError } from '#exceptions/game_error'

/** Mensaje público: nunca incluye el email */
export function publicMessage(message: ChatMessage) {
  return {
    id: Number(message.id),
    playerId: message.userId,
    displayName: message.user?.displayName ?? `Jugador #${message.userId}`,
    avatar: message.user?.avatar ?? null,
    body: message.body,
    createdAt: message.createdAt.toISO(),
  }
}

/**
 * Texto de chat limpio: sin caracteres de control ni saltos de línea, espacios colapsados
 */
export function cleanBody(body: string) {
  // Cc: caracteres de control; Cf: de formato (ancho cero, cambios de dirección del texto)
  return body
    .replace(/[\p{Cc}\p{Cf}]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export class ChatService {
  /**
   * Publica un mensaje en el chat de una mesa (jugadores sentados y espectadores)
   */
  async send(user: User, roomId: number, rawBody: string) {
    const { maxLength, burstLimit, burstSeconds } = gameConfig.chat
    const body = cleanBody(rawBody).slice(0, maxLength)
    if (!body) throw new GameError('invalid_message', 'El mensaje está vacío')

    const room = await Room.find(roomId)
    if (!room) throw new GameError('room_not_found', 'La sala no existe')
    if (room.status !== 'active') throw new GameError('room_not_active', 'La sala está cerrada')

    // Antispam: como máximo N mensajes en la ventana de tiempo
    const since = DateTime.now().minus({ seconds: burstSeconds })
    const recent = await ChatMessage.query()
      .where('user_id', user.id)
      .where('created_at', '>', since.toJSDate())
      .count('* as total')
    if (Number(recent[0].$extras.total) >= burstLimit) {
      throw new GameError('chat_rate_limited', 'Vas muy rápido: espera unos segundos')
    }

    const message = await ChatMessage.create({ roomId, userId: user.id, body })
    message.$setRelated('user', user)
    return message
  }

  /**
   * Mensajes de la mesa: los posteriores a `after` (en orden) o, sin `after`, los últimos
   */
  async list(roomId: number, after?: number) {
    const { historySize } = gameConfig.chat
    if (after !== undefined) {
      return ChatMessage.query()
        .where('room_id', roomId)
        .where('id', '>', after)
        .preload('user')
        .orderBy('id', 'asc')
        .limit(historySize)
    }
    const latest = await ChatMessage.query()
      .where('room_id', roomId)
      .preload('user')
      .orderBy('id', 'desc')
      .limit(historySize)
    return latest.reverse()
  }

  /** Borra los mensajes más viejos que `chat.retentionDays` */
  async prune(now = DateTime.now()) {
    const limit = now.minus({ days: gameConfig.chat.retentionDays })
    const deleted = await ChatMessage.query().where('created_at', '<', limit.toJSDate()).delete()
    return Number(deleted[0] ?? 0)
  }
}

export default new ChatService()
