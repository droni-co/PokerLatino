import { DateTime } from 'luxon'
import app from '@adonisjs/core/services/app'
import logger from '@adonisjs/core/services/logger'
import db from '@adonisjs/lucid/services/db'
import gameConfig from '#config/game'
import Room from '#models/room'
import RoomSeat from '#models/room_seat'
import Hand from '#models/hand'
import HandPlayer from '#models/hand_player'
import HandAction from '#models/hand_action'
import { GameError } from '#exceptions/game_error'
import { cashOutSeat } from '#services/game/seat_cash_out'
import chatService, { publicMessage } from '#services/game/chat_service'
import {
  HoldemHand,
  InvalidActionError,
  type ActionType,
  type HandResult,
} from '#game/holdem/engine'
import { evaluateBest } from '#game/holdem/evaluator'

type Runtime = {
  roomId: number
  hand: HoldemHand | null
  handId: number | null
  handNumber: number
  actionTimeoutSeconds: number
  turnDeadline: DateTime | null
  actionTimer?: NodeJS.Timeout
  startTimer?: NodeJS.Timeout
  lastResult: {
    handId: number
    handNumber: number
    result: HandResult
    /** Quienes enseñaron sus cartas voluntariamente al terminar la mano */
    shown: Set<number>
  } | null
  /** Cuándo está previsto que empiece la siguiente mano (pausa entre manos) */
  nextHandAt: DateTime | null
  /** Jugadores (userId) que actuaron por su cuenta en la mano actual */
  acted: Set<number>
  /** Jugadores a los que se les agotó el tiempo en la mano actual */
  timedOut: Set<number>
  /** Jugadores que pidieron levantarse: se retiran en cuanto les toca */
  leaving: Set<number>
}

/**
 * Orquesta las mesas en vivo: conecta el motor (HoldemHand) con las salas y la base de datos.
 *
 * - Una mano por sala a la vez; las acciones de una sala se procesan en serie.
 * - El estado de la mano en curso vive en memoria. Las fichas de `room_seats` se
 *   actualizan solo al terminar la mano: si el proceso se reinicia a mitad de una mano,
 *   `recoverInterruptedHands()` la cancela y cada jugador conserva su stack previo.
 * - Supone UN solo proceso de servidor. Para escalar horizontalmente habrá que mover
 *   el estado y los bloqueos a Redis (ver README).
 */
export class TableManager {
  private runtimes = new Map<number, Runtime>()
  private queues = new Map<number, Promise<unknown>>()

  private options: {
    timersEnabled: boolean
    nextHandDelayMs: number
    maxInactiveHands: number
  }

  constructor(options: Partial<TableManager['options']> = {}) {
    this.options = {
      timersEnabled: !app.inTest,
      nextHandDelayMs: gameConfig.table.nextHandDelayMs,
      maxInactiveHands: gameConfig.table.maxInactiveHands,
      ...options,
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Ciclo de vida de la mano
  |--------------------------------------------------------------------------
  */

  /**
   * Programa el inicio de la siguiente mano (si hay al menos 2 jugadores con fichas).
   */
  scheduleStart(roomId: number, delayMs = this.options.nextHandDelayMs) {
    if (!this.options.timersEnabled) return
    const rt = this.runtime(roomId)
    // Un arranque rápido (alguien se sentó) no acorta ni alarga un inicio ya programado,
    // p. ej. la pausa para ver el resultado de la mano anterior
    if (
      delayMs < this.options.nextHandDelayMs &&
      rt.nextHandAt &&
      rt.nextHandAt.diffNow().toMillis() > 0
    ) {
      return
    }
    this.startIn(rt, delayMs)
  }

  private startIn(rt: Runtime, delayMs: number) {
    const roomId = rt.roomId
    clearTimeout(rt.startTimer)
    rt.nextHandAt = DateTime.now().plus({ milliseconds: delayMs })
    rt.startTimer = setTimeout(() => {
      this.startHandIfReady(roomId).catch((error) =>
        logger.error({ err: error, roomId }, 'No se pudo iniciar la mano')
      )
    }, delayMs)
  }

  startHandIfReady(roomId: number): Promise<HoldemHand | null> {
    return this.exclusive(roomId, async () => {
      const rt = this.runtime(roomId)
      if (rt.hand && !rt.hand.isComplete) return null
      rt.nextHandAt = null

      const started = await db.transaction(async (trx) => {
        const room = await Room.query({ client: trx }).where('id', roomId).forUpdate().first()
        if (!room || room.status !== 'active') return null

        // Quien pidió levantarse justo cuando terminaba la mano anterior no recibe cartas
        const pending = await RoomSeat.query({ client: trx })
          .where('room_id', roomId)
          .where('leave_after_hand', true)
        for (const seat of pending) await cashOutSeat(trx, room, seat)

        const seats = await RoomSeat.query({ client: trx })
          .where('room_id', roomId)
          .where('status', 'active')
          .where('stack', '>', 0)
          .orderBy('seat_number')
        if (seats.length < 2) return null

        const last = await Hand.query({ client: trx })
          .where('room_id', roomId)
          .orderBy('hand_number', 'desc')
          .first()

        // El botón avanza al siguiente asiento ocupado
        const seatNumbers = seats.map((s) => s.seatNumber)
        const dealerSeat = last
          ? (seatNumbers.find((n) => n > last.dealerSeat) ?? seatNumbers[0])
          : seatNumbers[0]

        const hand = new HoldemHand({
          players: seats.map((s) => ({ seat: s.seatNumber, userId: s.userId, stack: s.stack })),
          dealerSeat,
          smallBlind: room.smallBlind,
          bigBlind: room.bigBlind,
        })

        const handRow = await Hand.create(
          {
            roomId,
            handNumber: (last?.handNumber ?? 0) + 1,
            smallBlind: room.smallBlind,
            bigBlind: room.bigBlind,
            dealerSeat,
            board: [],
            pot: 0,
            status: 'in_progress',
            startedAt: DateTime.now(),
          },
          { client: trx }
        )
        await HandPlayer.createMany(
          hand.players.map((p) => ({
            handId: handRow.id,
            userId: p.userId,
            seatNumber: p.seat,
            startingStack: p.startingStack,
            holeCards: p.holeCards,
          })),
          { client: trx }
        )

        return { hand, handRow, room }
      })

      if (!started) return null

      rt.hand = started.hand
      rt.handId = started.handRow.id
      rt.handNumber = started.handRow.handNumber
      rt.actionTimeoutSeconds = started.room.actionTimeoutSeconds
      rt.acted = new Set()
      rt.timedOut = new Set()
      rt.leaving = new Set()
      await this.afterAction(rt)
      return started.hand
    })
  }

  /**
   * Acción de un jugador. `amount` en bet/raise es el total a apostar en la calle.
   */
  act(roomId: number, userId: number, action: { type: ActionType; amount?: number }) {
    return this.exclusive(roomId, async () => {
      const rt = this.runtimes.get(roomId)
      if (!rt?.hand || rt.hand.isComplete) {
        throw new GameError('no_hand_in_progress', 'No hay una mano en curso')
      }
      const player = rt.hand.playerByUser(userId)
      if (!player) throw new GameError('not_in_hand', 'No participas en esta mano')

      try {
        rt.hand.applyAction(player.seat, action)
      } catch (error) {
        if (error instanceof InvalidActionError) {
          throw new GameError(
            error.code === 'not_your_turn' ? 'not_your_turn' : 'invalid_action',
            error.message
          )
        }
        throw error
      }
      rt.acted.add(userId)
      await this.afterAction(rt)
    })
  }

  /**
   * El jugador pidió levantarse con la mano en curso (ya marcado `leave_after_hand`):
   * se retira de la mano en cuanto le toque y al terminarla recupera sus fichas.
   */
  requestLeave(roomId: number, userId: number) {
    return this.exclusive(roomId, async () => {
      const rt = this.runtimes.get(roomId)
      if (!rt?.hand || rt.hand.isComplete || !rt.hand.playerByUser(userId)) return
      rt.leaving.add(userId)
      if (rt.hand.toActSeat !== null && rt.hand.player(rt.hand.toActSeat).userId === userId) {
        await this.afterAction(rt)
      }
    })
  }

  /**
   * Entre manos: el jugador enseña sus cartas aunque no estuviera obligado
   * (ganó sin showdown o se retiró). Dura hasta que empieza la siguiente mano.
   */
  show(roomId: number, userId: number) {
    return this.exclusive(roomId, async () => {
      const rt = this.runtimes.get(roomId)
      const last = rt?.lastResult
      if (!rt || !last || (rt.hand && !rt.hand.isComplete)) {
        throw new GameError('cannot_show', 'Solo puedes enseñar tus cartas al terminar la mano')
      }
      const player = last.result.players.find((p) => p.userId === userId)
      if (!player) throw new GameError('not_in_hand', 'No participaste en la última mano')
      if (player.wentToShowdown) {
        throw new GameError('cannot_show', 'Tus cartas ya están a la vista')
      }
      last.shown.add(userId)
    })
  }

  /**
   * Se agotó el tiempo del jugador en turno: pasa si puede, si no se retira.
   */
  handleTimeout(roomId: number) {
    return this.exclusive(roomId, async () => {
      const rt = this.runtimes.get(roomId)
      if (!rt?.hand || rt.hand.isComplete || rt.hand.toActSeat === null) return
      const seat = rt.hand.toActSeat
      rt.timedOut.add(rt.hand.player(seat).userId)
      rt.hand.applyAction(seat, rt.hand.timeoutAction())
      await this.afterAction(rt)
    })
  }

  /**
   * Al arrancar el servidor: cancela las manos que quedaron a medias.
   * Los stacks de room_seats son los previos a la mano, así que nadie pierde fichas.
   */
  async recoverInterruptedHands() {
    const cancelled = await Hand.query()
      .where('status', 'in_progress')
      .update({ status: 'cancelled', ended_at: DateTime.now().toSQL() })
    const count = Array.isArray(cancelled) ? Number(cancelled[0] ?? 0) : Number(cancelled)

    // Quien pidió levantarse en una mano cancelada recupera sus fichas ahora
    const pending = await RoomSeat.query().where('leave_after_hand', true)
    for (const seat of pending) {
      await db.transaction(async (trx) => {
        const room = await Room.query({ client: trx })
          .where('id', seat.roomId)
          .forUpdate()
          .firstOrFail()
        await cashOutSeat(trx, room, seat)
      })
    }

    const rooms = await RoomSeat.query()
      .select('room_id')
      .where('stack', '>', 0)
      .groupBy('room_id')
      .havingRaw('count(*) >= 2')
    for (const row of rooms) this.scheduleStart(row.roomId, 1000)

    return count
  }

  /**
   * Solo tests: limpia el estado en memoria.
   */
  reset() {
    for (const rt of this.runtimes.values()) {
      clearTimeout(rt.actionTimer)
      clearTimeout(rt.startTimer)
    }
    this.runtimes.clear()
    this.queues.clear()
  }

  /*
  |--------------------------------------------------------------------------
  | Vista de la mesa para un jugador
  |--------------------------------------------------------------------------
  */

  /**
   * `chatAfter`: id del último mensaje que ya tiene el cliente; sin él, devuelve los últimos
   */
  async getState(roomId: number, viewerId: number, options: { chatAfter?: number } = {}) {
    const room = await Room.find(roomId)
    if (!room) throw new GameError('room_not_found', 'La sala no existe')

    const seats = await RoomSeat.query()
      .where('room_id', roomId)
      .preload('user')
      .orderBy('seat_number')
    const rt = this.runtimes.get(roomId)
    const hand = rt?.hand && !rt.hand.isComplete ? rt.hand : null

    const viewer = hand?.playerByUser(viewerId)
    const legal = viewer ? hand!.legalActions(viewer.seat) : null
    const chat = await chatService.list(roomId, options.chatAfter)

    return {
      room: {
        id: room.id,
        name: room.name,
        smallBlind: room.smallBlind,
        bigBlind: room.bigBlind,
        maxSeats: room.maxSeats,
        actionTimeoutSeconds: room.actionTimeoutSeconds,
      },
      hand: hand
        ? {
            id: rt!.handId,
            number: rt!.handNumber,
            street: hand.street,
            board: hand.board,
            pot: hand.pot,
            currentBet: hand.currentBet,
            dealerSeat: hand.dealerSeat,
            smallBlindSeat: hand.smallBlindSeat,
            bigBlindSeat: hand.bigBlindSeat,
            toActSeat: hand.toActSeat,
            turnDeadline: rt!.turnDeadline?.toISO() ?? null,
          }
        : null,
      seats: seats.map((seat) => {
        const p = hand?.playerByUser(seat.userId)
        return {
          seatNumber: seat.seatNumber,
          player: {
            id: seat.userId,
            displayName: seat.user.displayName,
            avatar: seat.user.avatar,
          },
          stack: p ? p.stack : seat.stack,
          inHand: !!p,
          committed: p?.committed ?? 0,
          folded: p?.folded ?? false,
          allIn: p?.allIn ?? false,
          isTurn: !!p && hand!.toActSeat === p.seat,
          leaving: seat.leaveAfterHand,
          missedHands: seat.missedHands,
          // Cartas privadas: solo las del propio jugador
          holeCards: p && seat.userId === viewerId ? p.holeCards : null,
        }
      }),
      you: viewer
        ? { seatNumber: viewer.seat, holeCards: viewer.holeCards, legalActions: legal }
        : null,
      lastHand: rt?.lastResult ? this.lastHandView(rt, viewerId) : null,
      nextHandAt: !hand ? (rt?.nextHandAt?.toISO() ?? null) : null,
      chat: chat.map(publicMessage),
    }
  }

  /**
   * Resultado de la última mano para un jugador: el público más sus propias cartas
   * y si todavía puede enseñarlas.
   */
  private lastHandView(rt: Runtime, viewerId: number) {
    const last = rt.lastResult!
    const mine = last.result.players.find((p) => p.userId === viewerId)
    const between = !rt.hand || rt.hand.isComplete
    return {
      ...this.publicResult(last),
      yourCards: mine ? mine.holeCards : null,
      canShow: !!mine && between && !mine.wentToShowdown && !last.shown.has(viewerId),
    }
  }

  /**
   * Resultado público: se ven las cartas de quienes llegaron al showdown
   * y de quienes decidieron enseñarlas
   */
  private publicResult({ handId, handNumber, result, shown }: NonNullable<Runtime['lastResult']>) {
    return {
      handId,
      handNumber,
      board: result.board,
      showdown: result.showdown,
      totalPot: result.totalPot,
      pots: result.pots.map((pot) => ({
        amount: pot.amount,
        winners: pot.winners.map((w) => ({
          seatNumber: w.seat,
          playerId: w.userId,
          amount: w.amount,
        })),
      })),
      players: result.players.map((p) => {
        const voluntary = !p.wentToShowdown && shown.has(p.userId)
        return {
          seatNumber: p.seat,
          playerId: p.userId,
          amountWon: p.amountWon,
          net: p.endingStack - p.startingStack,
          folded: p.folded,
          holeCards: p.wentToShowdown || voluntary ? p.holeCards : null,
          shown: voluntary,
          handName: p.wentToShowdown
            ? (p.hand?.name ?? null)
            : voluntary && result.board.length >= 3
              ? evaluateBest([...p.holeCards, ...result.board]).name
              : null,
          // Las 5 cartas de su mejor mano (para resaltarlas en la mesa)
          bestCards: p.wentToShowdown ? (p.hand?.cards ?? null) : null,
        }
      }),
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Internos
  |--------------------------------------------------------------------------
  */

  private async afterAction(rt: Runtime) {
    clearTimeout(rt.actionTimer)
    rt.turnDeadline = null

    // Quien pidió levantarse se retira en cuanto le toca (no se espera su tiempo)
    const hand = rt.hand!
    while (
      !hand.isComplete &&
      hand.toActSeat !== null &&
      rt.leaving.has(hand.player(hand.toActSeat).userId)
    ) {
      hand.applyAction(hand.toActSeat, { type: 'fold' })
    }

    if (rt.hand!.isComplete) {
      await this.completeHand(rt)
      return
    }

    rt.turnDeadline = DateTime.now().plus({ seconds: rt.actionTimeoutSeconds })
    if (this.options.timersEnabled) {
      rt.actionTimer = setTimeout(() => {
        this.handleTimeout(rt.roomId).catch((error) =>
          logger.error({ err: error, roomId: rt.roomId }, 'Error en timeout de acción')
        )
      }, rt.actionTimeoutSeconds * 1000)
    }
  }

  private async completeHand(rt: Runtime) {
    const hand = rt.hand!
    const result = hand.result!
    const handId = rt.handId!

    const stoodUp: { userId: number; reason: 'requested' | 'inactive'; cashedOut: number }[] = []

    await db.transaction(async (trx) => {
      // Mismo bloqueo que leave(): o se levanta antes del cierre, o lo procesa este cierre
      const room = await Room.query({ client: trx })
        .where('id', rt.roomId)
        .forUpdate()
        .firstOrFail()

      await Hand.query({ client: trx })
        .where('id', handId)
        .update({
          board: JSON.stringify(result.board),
          pot: result.totalPot,
          status: 'completed',
          ended_at: DateTime.now().toSQL(),
        })

      for (const p of result.players) {
        await HandPlayer.query({ client: trx })
          .where('hand_id', handId)
          .where('user_id', p.userId)
          .update({
            ending_stack: p.endingStack,
            amount_wagered: p.totalCommitted,
            amount_won: p.amountWon,
            folded: p.folded,
            went_to_showdown: p.wentToShowdown,
          })

        // Inactividad: cuenta manos seguidas en que se le agotó el tiempo sin actuar.
        // Actuar (aunque sea una vez) reinicia el contador; si no tuvo que actuar, no cambia.
        const missed = rt.acted.has(p.userId)
          ? 0
          : rt.timedOut.has(p.userId)
            ? db.raw('missed_hands + 1')
            : db.raw('missed_hands')
        await RoomSeat.query({ client: trx })
          .where('room_id', rt.roomId)
          .where('user_id', p.userId)
          .update({
            stack: p.endingStack,
            missed_hands: missed,
            updated_at: DateTime.now().toSQL(),
          })

        await trx.rawQuery(
          `UPDATE player_stats SET
             hands_played = hands_played + 1,
             hands_won = hands_won + ?,
             showdowns_reached = showdowns_reached + ?,
             total_wagered = total_wagered + ?,
             total_won = total_won + ?,
             biggest_pot_won = GREATEST(biggest_pot_won, ?),
             updated_at = NOW()
           WHERE user_id = ?`,
          [
            p.isWinner ? 1 : 0,
            p.wentToShowdown ? 1 : 0,
            p.totalCommitted,
            p.amountWon,
            p.isWinner ? p.amountWon : 0,
            p.userId,
          ]
        )
      }

      await HandAction.createMany(
        hand.actions.map((a) => ({
          handId,
          userId: a.userId,
          sequence: a.sequence,
          street: a.street,
          action: a.action,
          amount: a.amount,
        })),
        { client: trx }
      )

      // Levantar a quien lo pidió y a los inactivos: sus fichas vuelven a la billetera
      const seats = await RoomSeat.query({ client: trx })
        .where('room_id', rt.roomId)
        .where((q) =>
          q
            .where('leave_after_hand', true)
            .orWhere('missed_hands', '>=', this.options.maxInactiveHands)
        )
      for (const seat of seats) {
        const reason = seat.leaveAfterHand ? 'requested' : 'inactive'
        const { cashedOut } = await cashOutSeat(trx, room, seat, reason)
        stoodUp.push({ userId: seat.userId, reason, cashedOut })
      }
    })

    for (const s of stoodUp) {
      logger.info({ roomId: rt.roomId, ...s }, 'Jugador levantado de la mesa')
    }

    rt.lastResult = { handId, handNumber: rt.handNumber, result, shown: new Set() }
    this.scheduleStart(rt.roomId)
  }

  private runtime(roomId: number) {
    let rt = this.runtimes.get(roomId)
    if (!rt) {
      rt = {
        roomId,
        hand: null,
        handId: null,
        handNumber: 0,
        actionTimeoutSeconds: gameConfig.rooms.actionTimeoutSeconds,
        turnDeadline: null,
        lastResult: null,
        nextHandAt: null,
        acted: new Set(),
        timedOut: new Set(),
        leaving: new Set(),
      }
      this.runtimes.set(roomId, rt)
    }
    return rt
  }

  /**
   * Ejecuta `fn` después de cualquier operación pendiente de la misma sala
   */
  private exclusive<T>(roomId: number, fn: () => Promise<T>): Promise<T> {
    const previous = this.queues.get(roomId) ?? Promise.resolve()
    const next = previous.then(fn, fn)
    this.queues.set(
      roomId,
      next.catch(() => {})
    )
    return next
  }
}

const tableManager = new TableManager()
export default tableManager
