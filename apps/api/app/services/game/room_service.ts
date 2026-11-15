import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import gameConfig from '#config/game'
import Room from '#models/room'
import RoomLevel from '#models/room_level'
import RoomSeat from '#models/room_seat'
import Hand from '#models/hand'
import type User from '#models/user'
import walletService from '#services/game/wallet_service'
import { cashOutSeat, type StandUpReason } from '#services/game/seat_cash_out'
import { GameError } from '#exceptions/game_error'

const seatedCount = (room: Room) => Number(room.$extras.seatedCount ?? 0)
const freeSeats = (room: Room) => Math.max(0, room.maxSeats - seatedCount(room))

/**
 * Mesa para quien pulsa "Jugar" en un nivel:
 * 1. una mesa con un solo jugador esperando (así empieza una partida),
 * 2. si no, la mesa con más jugadores que aún tenga lugar,
 * 3. a igualdad, la de número más bajo.
 * Devuelve undefined si todas están llenas.
 */
export function pickTable(tables: Room[]) {
  return tables
    .filter((t) => freeSeats(t) > 0)
    .sort(
      (a, b) =>
        Number(seatedCount(b) === 1) - Number(seatedCount(a) === 1) ||
        seatedCount(b) - seatedCount(a) ||
        a.tableNumber - b.tableNumber
    )[0]
}

export class RoomService {
  list() {
    return Room.query()
      .where('status', 'active')
      .whereNull('tournament_id')
      .withCount('seats', (q) => q.as('seatedCount'))
      .orderBy([{ column: 'big_blind' }, { column: 'table_number' }, { column: 'id' }])
  }

  /**
   * Niveles con sus mesas abiertas (para el lobby)
   */
  levels() {
    return RoomLevel.query()
      .where('status', 'active')
      .preload('rooms', (q) =>
        q
          .where('status', 'active')
          .withCount('seats', (s) => s.as('seatedCount'))
          .orderBy('table_number')
      )
      .orderBy([{ column: 'big_blind' }, { column: 'id' }])
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
   * Sentarse en una mesa elegida: descuenta el buy-in de la billetera y lo convierte en
   * fichas (stack) en la mesa. Si el nivel se está llenando, abre otra mesa.
   */
  async sit(user: User, roomId: number, input: { buyIn: number; seatNumber?: number }) {
    return db.transaction(async (trx) => {
      const target = await Room.query({ client: trx }).where('id', roomId).first()
      if (!target) throw new GameError('room_not_found', 'La sala no existe')
      if (target.levelId === null) {
        throw new GameError(
          'tournament_table',
          'En las mesas de torneo los asientos se asignan solos'
        )
      }

      // Orden de bloqueo: nivel → mesa (igual que quickSeat y el cierre de mesas vacías)
      const level = await this.lockLevel(trx, target.levelId)
      const room = await Room.query({ client: trx }).where('id', roomId).forUpdate().firstOrFail()
      const seat = await this.seatAt(trx, user, room, input)
      await this.ensureCapacity(trx, level)
      return seat
    })
  }

  /**
   * "Jugar" en un nivel: el servidor elige la mesa. Si el jugador ya está sentado en una
   * mesa del nivel, devuelve ese asiento sin cobrar otra vez (`alreadySeated: true`).
   */
  async quickSeat(user: User, levelId: number, input: { buyIn: number }) {
    return db.transaction(async (trx) => {
      const level = await this.lockLevel(trx, levelId)
      if (level.status !== 'active') {
        throw new GameError('room_not_active', 'Este nivel no está disponible')
      }

      const existing = await RoomSeat.query({ client: trx })
        .where('user_id', user.id)
        .whereHas('room', (q) => q.where('level_id', level.id))
        .first()
      if (existing) return { seat: existing, alreadySeated: true }

      const tables = await this.activeTables(trx, level.id)
      const choice = pickTable(tables) ?? (await this.openTable(trx, level))
      const room = await Room.query({ client: trx })
        .where('id', choice.id)
        .forUpdate()
        .firstOrFail()
      const seat = await this.seatAt(trx, user, room, input)
      await this.ensureCapacity(trx, level)
      return { seat, alreadySeated: false }
    })
  }

  /**
   * Abre mesas hasta que el nivel tenga el mínimo de mesas y de asientos libres.
   * Debe llamarse con el nivel bloqueado.
   */
  async ensureCapacity(trx: TransactionClientContract, level: RoomLevel) {
    const { minTablesPerLevel, maxTablesPerLevel, minFreeSeats } = gameConfig.rooms.autoTables
    const tables = await this.activeTables(trx, level.id)
    let count = tables.length
    let free = tables.reduce((sum, t) => sum + freeSeats(t), 0)
    const opened: Room[] = []
    while ((count < minTablesPerLevel || free < minFreeSeats) && count < maxTablesPerLevel) {
      const room = await this.openTable(trx, level)
      opened.push(room)
      count++
      free += room.maxSeats
    }
    return opened
  }

  /**
   * Cierra las mesas extra que llevan un rato vacías, siempre que el nivel conserve el
   * mínimo de mesas y de asientos libres. Lo ejecuta periódicamente `start/game.ts`.
   */
  async closeIdleTables(now = DateTime.now()) {
    const { minTablesPerLevel, minFreeSeats, closeEmptyAfterMinutes } = gameConfig.rooms.autoTables
    const limit = now.minus({ minutes: closeEmptyAfterMinutes })
    const closed: number[] = []

    const levels = await RoomLevel.query().select('id')
    for (const { id } of levels) {
      await db.transaction(async (trx) => {
        const level = await this.lockLevel(trx, id)
        const tables = await this.activeTables(trx, level.id)
        let count = tables.length
        let free = tables.reduce((sum, t) => sum + freeSeats(t), 0)

        // Primero las de número más alto: las mesas que quedan son siempre las primeras
        const idle = tables
          .filter((t) => seatedCount(t) === 0 && t.emptySince !== null && t.emptySince <= limit)
          .sort((a, b) => b.tableNumber - a.tableNumber)
        for (const table of idle) {
          if (count - 1 < minTablesPerLevel || free - table.maxSeats < minFreeSeats) break
          const room = await Room.query({ client: trx })
            .where('id', table.id)
            .forUpdate()
            .firstOrFail()
          const seats = await RoomSeat.query({ client: trx }).where('room_id', room.id).first()
          if (seats) continue
          room.status = 'closed'
          await room.useTransaction(trx).save()
          closed.push(room.id)
          count--
          free -= room.maxSeats
        }

        if (level.status === 'active') await this.ensureCapacity(trx, level)
      })
    }
    return closed
  }

  private async lockLevel(trx: TransactionClientContract, levelId: number) {
    const level = await RoomLevel.query({ client: trx }).where('id', levelId).forUpdate().first()
    if (!level) throw new GameError('level_not_found', 'El nivel no existe')
    return level
  }

  private activeTables(trx: TransactionClientContract, levelId: number) {
    return Room.query({ client: trx })
      .where('level_id', levelId)
      .where('status', 'active')
      .withCount('seats', (q) => q.as('seatedCount'))
      .orderBy('table_number')
  }

  /**
   * Abre una mesa del nivel: reutiliza la mesa cerrada de número más bajo o crea la siguiente
   */
  private async openTable(trx: TransactionClientContract, level: RoomLevel) {
    const { maxTablesPerLevel } = gameConfig.rooms.autoTables
    const all = await Room.query({ client: trx })
      .where('level_id', level.id)
      .orderBy('table_number')
    if (all.filter((r) => r.status === 'active').length >= maxTablesPerLevel) {
      throw new GameError('room_full', 'Todas las mesas de este nivel están llenas')
    }

    const reusable = all.find((r) => r.status === 'closed')
    const tableNumber = reusable?.tableNumber ?? (all.at(-1)?.tableNumber ?? 0) + 1
    const attributes = {
      levelId: level.id,
      tableNumber,
      slug: `${level.slug}-${tableNumber}`,
      name: `${level.name} · Mesa ${tableNumber}`,
      gameType: level.gameType,
      bettingStructure: level.bettingStructure,
      maxSeats: level.maxSeats,
      smallBlind: level.smallBlind,
      bigBlind: level.bigBlind,
      minBuyIn: level.minBuyIn,
      maxBuyIn: level.maxBuyIn,
      actionTimeoutSeconds: level.actionTimeoutSeconds,
      status: 'active' as const,
      emptySince: DateTime.now(),
    }
    const room = reusable
      ? await reusable.useTransaction(trx).merge(attributes).save()
      : await Room.create(attributes, { client: trx })
    room.$extras.seatedCount = 0
    return room
  }

  /**
   * Sienta al jugador en una mesa ya bloqueada
   */
  private async seatAt(
    trx: TransactionClientContract,
    user: User,
    room: Room,
    input: { buyIn: number; seatNumber?: number }
  ) {
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
      seatNumber = Array.from({ length: room.maxSeats }, (_, i) => i + 1).find((n) => !taken.has(n))
      if (seatNumber === undefined) throw new GameError('room_full', 'La sala está llena')
    }

    await walletService.debit(trx, {
      userId: user.id,
      amount: input.buyIn,
      type: 'buy_in',
      reference: { type: 'room', id: room.id },
      description: `Buy-in en ${room.name}`,
    })

    if (room.emptySince) {
      room.emptySince = null
      await room.useTransaction(trx).save()
    }

    return RoomSeat.create(
      { roomId: room.id, userId: user.id, seatNumber, stack: input.buyIn, status: 'active' },
      { client: trx }
    )
  }

  /**
   * Levantarse: las fichas que queden en la mesa vuelven a la billetera.
   *
   * Si el jugador está en una mano en curso no se le puede devolver su stack todavía:
   * se marca `leave_after_hand` y el TableManager lo retira (se retira de la mano en su
   * turno) y le devuelve las fichas al terminarla. En ese caso responde `pending: true`.
   */
  async leave(user: Pick<User, 'id'>, roomId: number, reason: StandUpReason = 'requested') {
    return db.transaction(async (trx) => {
      // Mismo bloqueo que sit(), el inicio y el cierre de mano: decisiones serializadas
      const room = await Room.query({ client: trx }).where('id', roomId).forUpdate().first()
      if (!room) throw new GameError('room_not_found', 'La sala no existe')
      if (room.tournamentId) {
        throw new GameError(
          'tournament_table',
          'En un torneo no puedes levantarte: si te vas, tus ciegas siguen corriendo'
        )
      }

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
        seat.leaveAfterHand = true
        await seat.useTransaction(trx).save()
        return { cashedOut: 0, pending: true }
      }

      const result = await cashOutSeat(trx, room, seat, reason)
      return { ...result, pending: false }
    })
  }
}

export default new RoomService()
