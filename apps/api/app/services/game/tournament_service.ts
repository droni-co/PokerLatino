import { randomInt } from 'node:crypto'
import { DateTime } from 'luxon'
import logger from '@adonisjs/core/services/logger'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import gameConfig from '#config/game'
import Tournament from '#models/tournament'
import TournamentEntry from '#models/tournament_entry'
import Room from '#models/room'
import RoomSeat from '#models/room_seat'
import Hand from '#models/hand'
import HandPlayer from '#models/hand_player'
import type User from '#models/user'
import walletService from '#services/game/wallet_service'
import tableManager from '#game/table_manager'
import { payoutAmounts, planBalance } from '#game/tournament_rules'
import { GameError } from '#exceptions/game_error'

/**
 * Ciclo de vida de los torneos:
 *
 * 1. **Inscripción** (`registering`): se paga la inscripción en fichas; se puede salir con
 *    reembolso completo mientras no empiece.
 * 2. **Inicio**: cuando llega `startsAt` con el cupo lleno (o se llena después), se abren
 *    las mesas, se sortean los asientos y cada jugador recibe el stack inicial.
 * 3. **Juego** (`running`): tras cada mano (y en cada tick) `maintain()` elimina a quien
 *    se quedó sin fichas (con su puesto y premio), rompe y equilibra mesas y, cuando queda
 *    uno solo, lo declara ganador y cierra el torneo (`finished`).
 *
 * Las fichas del torneo no son las de la billetera: solo la inscripción y los premios
 * mueven la billetera.
 */
export class TournamentService {
  private queues = new Map<number, Promise<unknown>>()

  /*
  |--------------------------------------------------------------------------
  | Consultas
  |--------------------------------------------------------------------------
  */

  /**
   * Torneos para el lobby: los abiertos y en juego, y los terminados recientemente
   */
  list(now = DateTime.now()) {
    const since = now.minus({ hours: gameConfig.tournaments.listFinishedForHours }).toSQL()
    return Tournament.query()
      .where((q) =>
        q
          .whereIn('status', ['registering', 'running'])
          .orWhere((f) =>
            f.whereIn('status', ['finished', 'cancelled']).where('updated_at', '>=', since)
          )
      )
      .withCount('entries', (q) => q.as('entriesCount'))
      .withCount('entries', (q) => q.where('status', 'playing').as('playersLeft'))
      .orderBy([{ column: 'starts_at' }, { column: 'id' }])
  }

  async find(tournamentId: number) {
    const tournament = await Tournament.query()
      .where('id', tournamentId)
      .withCount('entries', (q) => q.as('entriesCount'))
      .withCount('entries', (q) => q.where('status', 'playing').as('playersLeft'))
      .first()
    if (!tournament) throw new GameError('tournament_not_found', 'El torneo no existe')
    return tournament
  }

  /**
   * Inscripciones de un jugador en los torneos dados, con la mesa en la que juega (si juega)
   */
  async viewerInfo(userId: number, tournamentIds: number[]) {
    const info = new Map<number, { entry: TournamentEntry; roomId: number | null }>()
    if (tournamentIds.length === 0) return info
    const entries = await TournamentEntry.query()
      .where('user_id', userId)
      .whereIn('tournament_id', tournamentIds)
    const seats = await RoomSeat.query()
      .where('user_id', userId)
      .preload('room')
      .whereHas('room', (q) => q.whereIn('tournament_id', tournamentIds))
    for (const entry of entries) {
      const seat = seats.find((s) => s.room.tournamentId === entry.tournamentId)
      info.set(entry.tournamentId, { entry, roomId: seat?.roomId ?? null })
    }
    return info
  }

  /**
   * Clasificación: quienes siguen jugando (por fichas) y después los eliminados (por puesto)
   */
  async standings(tournament: Tournament) {
    const entries = await TournamentEntry.query()
      .where('tournament_id', tournament.id)
      .preload('user')
      .orderBy('created_at')
    const seats = await RoomSeat.query()
      .preload('room')
      .whereHas('room', (q) => q.where('tournament_id', tournament.id))
    const seatOf = new Map(seats.map((s) => [s.userId, s]))

    const alive = entries
      .filter((e) => e.status === 'playing')
      .sort((a, b) => (seatOf.get(b.userId)?.stack ?? 0) - (seatOf.get(a.userId)?.stack ?? 0))
    const done = entries
      .filter((e) => e.status === 'eliminated' || e.status === 'winner')
      .sort((a, b) => (a.finishPosition ?? 0) - (b.finishPosition ?? 0))
    const waiting = entries.filter((e) => e.status === 'registered')

    // La clasificación en vivo de los que juegan ocupa los primeros puestos
    return [
      ...done.filter((e) => e.status === 'winner'),
      ...alive,
      ...done.filter((e) => e.status !== 'winner'),
      ...waiting,
    ].map((entry) => {
      const seat = seatOf.get(entry.userId)
      const livePosition = alive.indexOf(entry)
      return {
        position: entry.finishPosition ?? (livePosition >= 0 ? livePosition + 1 : null),
        status: entry.status,
        player: {
          id: entry.userId,
          displayName: entry.user.displayName,
          avatar: entry.user.avatar,
        },
        chips: seat?.stack ?? null,
        tableNumber: seat?.room.tableNumber ?? null,
        roomId: seat?.roomId ?? null,
        prize: entry.prize,
      }
    })
  }

  /**
   * Premios por puesto: con el bote real si ya empezó; si no, el previsto con el cupo lleno
   */
  payouts(tournament: Tournament) {
    const entrants =
      tournament.status === 'registering'
        ? tournament.capacity
        : Number(tournament.$extras.entriesCount ?? tournament.capacity)
    const pool =
      tournament.status === 'registering' ? entrants * tournament.buyIn : tournament.prizePool
    return payoutAmounts(pool, entrants).map((amount, i) => ({ position: i + 1, amount }))
  }

  /*
  |--------------------------------------------------------------------------
  | Inscripción
  |--------------------------------------------------------------------------
  */

  async register(user: Pick<User, 'id'>, tournamentId: number, now = DateTime.now()) {
    const entry = await db.transaction(async (trx) => {
      const tournament = await this.lock(trx, tournamentId)
      if (tournament.status !== 'registering') {
        throw new GameError('tournament_closed', 'La inscripción a este torneo está cerrada')
      }
      const entries = await TournamentEntry.query({ client: trx }).where(
        'tournament_id',
        tournament.id
      )
      if (entries.some((e) => e.userId === user.id)) {
        throw new GameError('already_registered', 'Ya estás inscrito en este torneo')
      }
      if (entries.length >= tournament.capacity) {
        throw new GameError('tournament_full', 'El torneo ya está completo')
      }

      await walletService.debit(trx, {
        userId: user.id,
        amount: tournament.buyIn,
        type: 'tournament_entry',
        reference: { type: 'tournament', id: tournament.id },
        description: `Inscripción a ${tournament.name}`,
      })
      return TournamentEntry.create(
        { tournamentId: tournament.id, userId: user.id, status: 'registered', prize: 0 },
        { client: trx }
      )
    })

    // Si con esta inscripción se completó el cupo y ya es la hora, empieza ahora
    await this.start(tournamentId, now)
    return entry
  }

  async unregister(user: Pick<User, 'id'>, tournamentId: number) {
    return db.transaction(async (trx) => {
      const tournament = await this.lock(trx, tournamentId)
      const entry = await TournamentEntry.query({ client: trx })
        .where('tournament_id', tournament.id)
        .where('user_id', user.id)
        .first()
      if (!entry) throw new GameError('not_registered', 'No estás inscrito en este torneo')
      if (tournament.status !== 'registering') {
        throw new GameError('tournament_closed', 'El torneo ya empezó: no puedes salirte')
      }
      await this.refund(trx, tournament, entry)
      return { refunded: tournament.buyIn }
    })
  }

  /**
   * Cancela un torneo que aún no empezó y devuelve todas las inscripciones
   * (para el futuro backoffice)
   */
  async cancel(tournamentId: number) {
    return db.transaction(async (trx) => {
      const tournament = await this.lock(trx, tournamentId)
      if (tournament.status !== 'registering') {
        throw new GameError('tournament_closed', 'Solo se puede cancelar un torneo que no empezó')
      }
      const entries = await TournamentEntry.query({ client: trx }).where(
        'tournament_id',
        tournament.id
      )
      for (const entry of entries) await this.refund(trx, tournament, entry)
      tournament.status = 'cancelled'
      tournament.finishedAt = DateTime.now()
      await tournament.useTransaction(trx).save()
      return { refunded: entries.length }
    })
  }

  private async refund(
    trx: TransactionClientContract,
    tournament: Tournament,
    entry: TournamentEntry
  ) {
    await walletService.credit(trx, {
      userId: entry.userId,
      amount: tournament.buyIn,
      type: 'tournament_refund',
      reference: { type: 'tournament', id: tournament.id },
      description: `Reembolso de ${tournament.name}`,
    })
    await entry.useTransaction(trx).delete()
  }

  /*
  |--------------------------------------------------------------------------
  | Inicio
  |--------------------------------------------------------------------------
  */

  /**
   * Revisión periódica (start/game.ts): arranca los torneos que toca y mantiene los que
   * están en juego (por si algo quedó pendiente, p. ej. tras reiniciar el servidor)
   */
  async tick(now = DateTime.now()) {
    const due = await Tournament.query()
      .where('status', 'registering')
      .where('starts_at', '<=', now.toSQL()!)
      .select('id')
    for (const { id } of due) await this.start(id, now)

    const running = await Tournament.query().where('status', 'running').select('id')
    for (const { id } of running) await this.maintain(id)
  }

  /**
   * Arranca el torneo si ya es la hora y el cupo está lleno. Devuelve las mesas abiertas
   * (o null si todavía no puede empezar).
   */
  async start(tournamentId: number, now = DateTime.now()) {
    const rooms = await db.transaction(async (trx) => {
      const tournament = await this.lock(trx, tournamentId)
      if (tournament.status !== 'registering' || tournament.startsAt > now) return null

      const entries = await TournamentEntry.query({ client: trx })
        .where('tournament_id', tournament.id)
        .where('status', 'registered')
      if (entries.length < tournament.capacity) return null

      // Asientos sorteados: se baraja y se reparte en orden entre las mesas
      for (let i = entries.length - 1; i > 0; i--) {
        const j = randomInt(i + 1)
        ;[entries[i], entries[j]] = [entries[j], entries[i]]
      }

      const opened: Room[] = []
      for (let n = 1; n <= tournament.tableCount; n++) {
        opened.push(
          await Room.create(
            {
              tournamentId: tournament.id,
              levelId: null,
              tableNumber: n,
              slug: `torneo-${tournament.slug}-${n}`,
              name: `${tournament.name} · Mesa ${n}`,
              gameType: 'texas_holdem',
              bettingStructure: 'no_limit',
              maxSeats: tournament.maxSeats,
              smallBlind: tournament.smallBlind,
              bigBlind: tournament.bigBlind,
              minBuyIn: tournament.startingStack,
              maxBuyIn: tournament.startingStack,
              actionTimeoutSeconds: tournament.actionTimeoutSeconds,
              status: 'active',
              emptySince: null,
            },
            { client: trx }
          )
        )
      }

      for (const [i, entry] of entries.entries()) {
        const room = opened[i % opened.length]
        await RoomSeat.create(
          {
            roomId: room.id,
            userId: entry.userId,
            seatNumber: Math.floor(i / opened.length) + 1,
            stack: tournament.startingStack,
            status: 'active',
          },
          { client: trx }
        )
        entry.status = 'playing'
        await entry.useTransaction(trx).save()
      }

      tournament.status = 'running'
      tournament.startedAt = now
      tournament.prizePool = entries.length * tournament.buyIn
      await tournament.useTransaction(trx).save()
      return opened
    })

    if (rooms) {
      logger.info({ tournamentId, tables: rooms.length }, 'Torneo iniciado')
      for (const room of rooms) {
        tableManager.scheduleStart(room.id, gameConfig.tournaments.firstHandDelayMs)
      }
    }
    return rooms
  }

  /*
  |--------------------------------------------------------------------------
  | Juego: eliminaciones, balanceo y final
  |--------------------------------------------------------------------------
  */

  /**
   * Tras cada mano de una mesa del torneo (y en cada tick). En serie por torneo.
   */
  maintain(tournamentId: number) {
    return this.exclusive(tournamentId, async () => {
      const result = await db.transaction((trx) => this.maintainIn(trx, tournamentId))
      if (!result) return
      for (const roomId of result.startRooms) {
        tableManager.scheduleStart(roomId, gameConfig.table.firstHandDelayMs)
      }
      if (result.finished) logger.info({ tournamentId }, 'Torneo terminado')
    })
  }

  private async maintainIn(trx: TransactionClientContract, tournamentId: number) {
    // Orden de bloqueo: torneo → mesas (por id). El resto del juego solo bloquea una mesa.
    const tournament = await this.lock(trx, tournamentId)
    if (tournament.status !== 'running') return null

    const rooms = await Room.query({ client: trx })
      .where('tournament_id', tournament.id)
      .where('status', 'active')
      .orderBy('id')
      .forUpdate()
    const roomIds = rooms.map((r) => r.id)
    const inProgress = await Hand.query({ client: trx })
      .whereIn('room_id', roomIds)
      .where('status', 'in_progress')
      .select('room_id')
    const busy = new Set(inProgress.map((h) => h.roomId))
    let seats = await RoomSeat.query({ client: trx }).whereIn('room_id', roomIds)
    const entries = await TournamentEntry.query({ client: trx }).where(
      'tournament_id',
      tournament.id
    )
    const prizes = payoutAmounts(tournament.prizePool, entries.length)
    const entryOf = (userId: number) => entries.find((e) => e.userId === userId)!
    let remaining = entries.filter((e) => e.status === 'playing').length

    const finish = async (seat: RoomSeat, status: 'eliminated' | 'winner', position: number) => {
      const entry = entryOf(seat.userId)
      const prize = prizes[position - 1] ?? 0
      entry.merge({ status, finishPosition: position, prize, eliminatedAt: DateTime.now() })
      await entry.useTransaction(trx).save()
      if (prize > 0) {
        await walletService.credit(trx, {
          userId: seat.userId,
          amount: prize,
          type: 'tournament_prize',
          reference: { type: 'tournament', id: tournament.id },
          description: `Premio en ${tournament.name} (puesto ${position})`,
        })
      }
      await seat.useTransaction(trx).delete()
    }

    // 1. Eliminados: sin fichas en una mesa sin mano en curso. Si caen varios a la vez,
    //    queda mejor quien empezó la mano con más fichas.
    const busted = seats.filter((s) => s.stack === 0 && !busy.has(s.roomId))
    if (busted.length > 0) {
      const startStack = new Map<number, number>()
      for (const seat of busted) {
        const last = await HandPlayer.query({ client: trx })
          .where('user_id', seat.userId)
          .whereIn(
            'hand_id',
            Hand.query({ client: trx }).select('id').where('room_id', seat.roomId)
          )
          .orderBy('hand_id', 'desc')
          .first()
        startStack.set(seat.userId, last?.startingStack ?? 0)
      }
      busted.sort((a, b) => startStack.get(a.userId)! - startStack.get(b.userId)!)
      for (const seat of busted) {
        await finish(seat, 'eliminated', remaining)
        remaining--
      }
      seats = seats.filter((s) => !busted.includes(s))
    }

    // 2. Queda uno: campeón
    if (remaining <= 1) {
      const [last] = seats
      if (last) await finish(last, 'winner', 1)
      for (const room of rooms) {
        room.status = 'closed'
        await room.useTransaction(trx).save()
      }
      tournament.status = 'finished'
      tournament.finishedAt = DateTime.now()
      await tournament.useTransaction(trx).save()
      return { startRooms: [], finished: true }
    }

    // 3. Romper y equilibrar mesas
    const plan = planBalance(
      rooms.map((r) => ({
        id: r.id,
        players: seats
          .filter((s) => s.roomId === r.id)
          .sort((a, b) => a.seatNumber - b.seatNumber)
          .map((s) => s.userId),
        busy: busy.has(r.id),
      })),
      tournament.maxSeats
    )
    for (const { userId, from, to } of plan.moves) {
      const seat = seats.find((s) => s.userId === userId && s.roomId === from)!
      const taken = new Set(seats.filter((s) => s.roomId === to).map((s) => s.seatNumber))
      const seatNumber = Array.from({ length: tournament.maxSeats }, (_, i) => i + 1).find(
        (n) => !taken.has(n)
      )!
      await seat.useTransaction(trx).delete()
      const moved = await RoomSeat.create(
        { roomId: to, userId, seatNumber, stack: seat.stack, status: 'active' },
        { client: trx }
      )
      seats = [...seats.filter((s) => s !== seat), moved]
    }
    for (const room of rooms.filter((r) => plan.close.includes(r.id))) {
      room.status = 'closed'
      await room.useTransaction(trx).save()
    }

    const startRooms = rooms
      .filter((r) => !plan.close.includes(r.id) && !busy.has(r.id))
      .map((r) => r.id)
    return { startRooms, finished: false }
  }

  /*
  |--------------------------------------------------------------------------
  | Internos
  |--------------------------------------------------------------------------
  */

  private async lock(trx: TransactionClientContract, tournamentId: number) {
    const tournament = await Tournament.query({ client: trx })
      .where('id', tournamentId)
      .forUpdate()
      .first()
    if (!tournament) throw new GameError('tournament_not_found', 'El torneo no existe')
    return tournament
  }

  private exclusive<T>(tournamentId: number, fn: () => Promise<T>): Promise<T> {
    const previous = this.queues.get(tournamentId) ?? Promise.resolve()
    const next = previous.then(fn, fn)
    this.queues.set(
      tournamentId,
      next.catch(() => {})
    )
    return next
  }
}

export default new TournamentService()
