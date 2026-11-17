import { randomBytes } from 'node:crypto'
import { DateTime } from 'luxon'
import app from '@adonisjs/core/services/app'
import logger from '@adonisjs/core/services/logger'
import db from '@adonisjs/lucid/services/db'
import gameConfig, { AVATARS } from '#config/game'
import User from '#models/user'
import Room from '#models/room'
import type RoomSeat from '#models/room_seat'
import Wallet from '#models/wallet'
import walletService from '#services/game/wallet_service'
import progressService from '#services/game/progress_service'
import roomService from '#services/game/room_service'
import tableManager from '#game/table_manager'
import { GameError } from '#exceptions/game_error'

/**
 * Jugadores de la casa (bots). Ver `gameConfig.bots`.
 *
 * `sync()` repasa las mesas normales abiertas y decide en cada una:
 *  - 1 jugador real, sin bot → se sienta un bot;
 *  - 0 jugadores reales → solo queda un bot en la primera mesa del nivel (escaparate);
 *    en las demás se levanta para que la mesa extra pueda cerrarse;
 *  - `leaveWhenHumans` o más jugadores reales → el bot se levanta (si está en una mano,
 *    la termina y se levanta al cerrarla).
 *
 * Las decisiones de juego y la recarga de fichas están en el TableManager.
 */
export class BotService {
  private running: Promise<void> | null = null
  private again = false

  constructor(private enabled = gameConfig.bots.enabled && !app.inTest) {}

  /**
   * Revisa las mesas en segundo plano (p. ej. justo después de que alguien se siente).
   * Si ya hay una revisión en marcha, se repite al terminar.
   */
  nudge() {
    if (!this.enabled) return
    if (this.running) {
      this.again = true
      return
    }
    this.running = this.sync()
      .catch((error) => logger.error({ err: error }, 'No se pudieron revisar los bots'))
      .finally(() => {
        this.running = null
        if (this.again) {
          this.again = false
          this.nudge()
        }
      })
  }

  async sync() {
    const rooms = await Room.query()
      .where('status', 'active')
      .whereNotNull('level_id')
      .preload('seats', (q) => q.preload('user'))
      .orderBy([{ column: 'level_id' }, { column: 'table_number' }])

    // Primera mesa abierta de cada nivel: ahí espera un bot aunque no haya nadie
    const showcase = new Set<number>()
    const seenLevels = new Set<number>()
    for (const room of rooms) {
      if (seenLevels.has(room.levelId!)) continue
      seenLevels.add(room.levelId!)
      showcase.add(room.id)
    }

    for (const room of rooms) {
      const humans = room.seats.filter((s) => !s.user.isBot && !s.leaveAfterHand).length
      const bots = room.seats.filter((s) => s.user.isBot && !s.leaveAfterHand)
      const wanted =
        humans >= gameConfig.bots.leaveWhenHumans ? 0 : humans >= 1 || showcase.has(room.id) ? 1 : 0

      try {
        for (const seat of bots.slice(wanted)) await this.standUp(seat)
        if (bots.length < wanted && room.seats.length < room.maxSeats) await this.seat(room)
      } catch (error) {
        // Alguien se sentó o se levantó a la vez: se reintenta en la próxima revisión
        if (error instanceof GameError) {
          logger.debug({ roomId: room.id, code: error.errorCode }, 'Bot: revisión aplazada')
          continue
        }
        throw error
      }
    }
  }

  /**
   * Sienta un bot libre en la mesa con el buy-in máximo (la casa le da las fichas)
   */
  async seat(room: Room) {
    const bot = await this.freeBot()
    await this.fund(bot.id, room.maxBuyIn, `Fichas de la casa para ${room.name}`)
    const seat = await roomService.sit(bot, room.id, { buyIn: room.maxBuyIn })
    logger.info({ roomId: room.id, botId: bot.id }, 'Bot sentado en la mesa')
    tableManager.scheduleStart(room.id, gameConfig.table.firstHandDelayMs)
    return seat
  }

  async standUp(seat: RoomSeat) {
    const result = await roomService.leave({ id: seat.userId }, seat.roomId)
    logger.info({ roomId: seat.roomId, botId: seat.userId, ...result }, 'Bot se levanta')
    return result
  }

  /**
   * Un bot que no esté sentado en ninguna mesa (lo crea si hacen falta más)
   */
  async freeBot() {
    const free = await User.query()
      .where('is_bot', true)
      .whereNotExists((q) => q.from('room_seats').whereColumn('room_seats.user_id', 'users.id'))
      .orderBy('id')
      .first()
    return free ?? this.createBot()
  }

  async createBot() {
    const count = await User.query().where('is_bot', true).count('* as total')
    const index = Number(count[0].$extras.total)
    const { names } = gameConfig.bots
    const base = names[index % names.length]
    const round = Math.floor(index / names.length)

    for (let attempt = 0; attempt < 20; attempt++) {
      const suffix = round + attempt === 0 ? '' : String(round + attempt + 1)
      const username = `${base}${suffix}`.slice(0, gameConfig.username.maxLength)
      const taken = await User.query().whereRaw('lower(username) = ?', [username.toLowerCase()])
      if (taken.length) continue

      return db.transaction(async (trx) => {
        const user = await User.create(
          {
            username,
            email: `bot-${username.toLowerCase()}-${randomBytes(4).toString('hex')}@bots.invalid`,
            // Nadie conoce esta contraseña: la cuenta no puede iniciar sesión
            password: randomBytes(32).toString('hex'),
            birthDate: DateTime.fromISO('1990-01-01'),
            avatar: AVATARS[index % AVATARS.length],
            isBot: true,
          },
          { client: trx }
        )
        await walletService.provisionUser(trx, user.id)
        await progressService.create(trx, user.id)
        return user
      })
    }
    throw new Error('No se encontró un nombre libre para el bot')
  }

  /**
   * La casa recarga la billetera del bot hasta `amount` fichas
   */
  async fund(userId: number, amount: number, description: string) {
    await db.transaction(async (trx) => {
      const wallet = await Wallet.query({ client: trx })
        .where('user_id', userId)
        .forUpdate()
        .firstOrFail()
      const missing = amount - wallet.balance
      if (missing > 0) {
        await walletService.credit(trx, {
          userId,
          amount: missing,
          type: 'bot_refill',
          description,
        })
      }
    })
  }
}

export default new BotService()
