import { type Card, shuffledDeck } from '#game/holdem/cards'
import { evaluateBest, type EvaluatedHand } from '#game/holdem/evaluator'

/*
|--------------------------------------------------------------------------
| Motor de Texas Hold'em No-Limit
|--------------------------------------------------------------------------
| Módulo puro: no toca base de datos ni red. Recibe jugadores con sus fichas,
| aplica acciones validadas y al terminar produce el resultado (botes y ganadores).
|
| Reglas implementadas:
|  - Ciegas; en heads-up el botón paga la ciega chica y habla primero preflop.
|  - Apuestas sin límite: apuesta mínima = ciega grande; subida mínima = última subida completa.
|  - Un all-in que no completa una subida NO reabre la acción a quien ya actuó.
|  - Botes paralelos (side pots); las fichas no igualadas vuelven a su dueño.
|  - Empates: el bote se divide; las fichas impares van al primer ganador a la
|    izquierda del botón.
|  - Sin comisión (rake = 0): todo lo apostado se reparte entre los jugadores.
|
| Montos: enteros en unidades mínimas. En bet/raise, `amount` es el TOTAL
| apostado en la calle ("subir a"), no el incremento.
*/

export type Street = 'preflop' | 'flop' | 'turn' | 'river' | 'showdown'
export type ActionType = 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'all_in'
export type LoggedAction = ActionType | 'small_blind' | 'big_blind'

export type SeatInput = { seat: number; userId: number; stack: number }

export type PlayerState = {
  seat: number
  userId: number
  startingStack: number
  stack: number
  holeCards: Card[]
  /** Apostado en la calle actual */
  committed: number
  /** Apostado en toda la mano */
  totalCommitted: number
  folded: boolean
  allIn: boolean
  hasActed: boolean
  /** Nivel de la última subida completa que este jugador ya vio al actuar */
  raiseLevelSeen: number
}

export type ActionLog = {
  sequence: number
  seat: number
  userId: number
  street: Street
  action: LoggedAction
  /** Fichas que puso en esta acción */
  amount: number
  /** Total apostado en la calle tras la acción */
  totalBet: number
}

export type LegalActions = {
  fold: boolean
  check: boolean
  /** Fichas necesarias para igualar (null si no hay nada que igualar) */
  call: number | null
  /** Rango "apostar hasta" cuando nadie apostó en la calle */
  bet: { min: number; max: number } | null
  /** Rango "subir hasta" cuando ya hay apuesta */
  raise: { min: number; max: number } | null
}

export type PotResult = {
  amount: number
  eligibleSeats: number[]
  winners: { seat: number; userId: number; amount: number }[]
  /** Jugadores que pusieron fichas en este bote (1 = devolución de apuesta no igualada) */
  contributors: number
}

export type PlayerResult = {
  seat: number
  userId: number
  startingStack: number
  endingStack: number
  totalCommitted: number
  amountWon: number
  folded: boolean
  wentToShowdown: boolean
  /** Ganó al menos un bote disputado (no cuenta la devolución de una apuesta no igualada) */
  isWinner: boolean
  holeCards: Card[]
  hand: Pick<EvaluatedHand, 'name' | 'category' | 'cards'> | null
}

export type HandResult = {
  board: Card[]
  showdown: boolean
  totalPot: number
  pots: PotResult[]
  players: PlayerResult[]
}

export class InvalidActionError extends Error {
  constructor(
    public code: 'not_your_turn' | 'hand_complete' | 'invalid_action',
    message: string
  ) {
    super(message)
  }
}

export class HoldemHand {
  readonly smallBlind: number
  readonly bigBlind: number
  readonly dealerSeat: number
  readonly smallBlindSeat: number
  readonly bigBlindSeat: number
  readonly players: PlayerState[]

  board: Card[] = []
  street: Street = 'preflop'
  isComplete = false
  toActSeat: number | null = null
  currentBet = 0
  minRaise: number
  actions: ActionLog[] = []
  result: HandResult | null = null

  private lastFullRaiseLevel = 0
  private deck: Card[]

  constructor(options: {
    players: SeatInput[]
    dealerSeat: number
    smallBlind: number
    bigBlind: number
    /** Mazo ya barajado (para tests). Por defecto se baraja con crypto.randomInt */
    deck?: Card[]
  }) {
    const { smallBlind, bigBlind } = options
    if (!Number.isSafeInteger(smallBlind) || smallBlind <= 0 || bigBlind < smallBlind) {
      throw new Error('Ciegas inválidas')
    }

    this.players = options.players
      .filter((p) => p.stack > 0)
      .sort((a, b) => a.seat - b.seat)
      .map((p) => ({
        seat: p.seat,
        userId: p.userId,
        startingStack: p.stack,
        stack: p.stack,
        holeCards: [],
        committed: 0,
        totalCommitted: 0,
        folded: false,
        allIn: false,
        hasActed: false,
        raiseLevelSeen: 0,
      }))

    if (this.players.length < 2) throw new Error('Se necesitan al menos 2 jugadores con fichas')
    if (new Set(this.players.map((p) => p.seat)).size !== this.players.length) {
      throw new Error('Asientos duplicados')
    }
    if (!this.players.some((p) => p.seat === options.dealerSeat)) {
      throw new Error('El botón debe estar en un jugador de la mano')
    }

    this.smallBlind = smallBlind
    this.bigBlind = bigBlind
    this.minRaise = bigBlind
    this.dealerSeat = options.dealerSeat
    this.deck = options.deck ? [...options.deck] : shuffledDeck()

    // Repartir: una carta a cada jugador empezando a la izquierda del botón, dos vueltas
    const dealOrder = this.seatsFrom(this.dealerSeat)
    for (let round = 0; round < 2; round++) {
      for (const p of dealOrder) p.holeCards.push(this.draw())
    }

    // Ciegas (heads-up: el botón pone la chica)
    const headsUp = this.players.length === 2
    this.smallBlindSeat = headsUp ? this.dealerSeat : this.nextSeat(this.dealerSeat)!.seat
    this.bigBlindSeat = this.nextSeat(this.smallBlindSeat)!.seat
    this.postBlind(this.player(this.smallBlindSeat), smallBlind, 'small_blind')
    this.postBlind(this.player(this.bigBlindSeat), bigBlind, 'big_blind')

    // Aunque la ciega grande sea un all-in corto, el resto debe igualar la ciega completa
    this.currentBet = bigBlind
    this.lastFullRaiseLevel = bigBlind

    if (this.bettingClosed()) {
      this.closeStreet()
    } else {
      this.toActSeat = this.nextSeat(this.bigBlindSeat, (p) => this.needsToAct(p))!.seat
    }
  }

  /*
  |--------------------------------------------------------------------------
  | API pública
  |--------------------------------------------------------------------------
  */

  player(seat: number) {
    const p = this.players.find((x) => x.seat === seat)
    if (!p) throw new Error(`No hay jugador en el asiento ${seat}`)
    return p
  }

  playerByUser(userId: number) {
    return this.players.find((p) => p.userId === userId)
  }

  /**
   * Total en el centro de la mesa (incluye lo apostado en la calle actual)
   */
  get pot() {
    return this.players.reduce((sum, p) => sum + p.totalCommitted, 0)
  }

  legalActions(seat: number): LegalActions | null {
    if (this.isComplete || this.toActSeat !== seat) return null
    const p = this.player(seat)

    const toCall = this.currentBet - p.committed
    const maxTo = p.committed + p.stack
    const othersCanRespond = this.players.some((o) => o !== p && this.canAct(o))
    const reopened = !p.hasActed || p.raiseLevelSeen < this.lastFullRaiseLevel
    const canRaise = maxTo > this.currentBet && reopened && othersCanRespond

    let bet: LegalActions['bet'] = null
    let raise: LegalActions['raise'] = null
    if (canRaise && this.currentBet === 0) {
      bet = { min: Math.min(this.bigBlind, maxTo), max: maxTo }
    } else if (canRaise) {
      raise = { min: Math.min(this.currentBet + this.minRaise, maxTo), max: maxTo }
    }

    return {
      fold: true,
      check: toCall === 0,
      call: toCall > 0 ? Math.min(toCall, p.stack) : null,
      bet,
      raise,
    }
  }

  applyAction(seat: number, action: { type: ActionType; amount?: number }) {
    if (this.isComplete) throw new InvalidActionError('hand_complete', 'La mano ya terminó')
    const legal = this.legalActions(seat)
    if (!legal) throw new InvalidActionError('not_your_turn', 'No es tu turno')

    const p = this.player(seat)
    const before = p.stack
    const invalid = (message: string) => new InvalidActionError('invalid_action', message)

    switch (action.type) {
      case 'fold':
        p.folded = true
        break

      case 'check':
        if (!legal.check) throw invalid('No puedes pasar: hay una apuesta que igualar')
        break

      case 'call':
        if (legal.call === null) throw invalid('No hay apuesta que igualar')
        this.commit(p, legal.call)
        break

      case 'bet':
      case 'raise': {
        const range = action.type === 'bet' ? legal.bet : legal.raise
        if (!range) {
          throw invalid(action.type === 'bet' ? 'No puedes apostar ahora' : 'No puedes subir ahora')
        }
        const amount = action.amount
        if (amount === undefined || !Number.isSafeInteger(amount)) {
          throw invalid('Debes indicar el monto (total a apostar en la calle)')
        }
        if (amount < range.min || amount > range.max) {
          throw invalid(`El monto debe estar entre ${range.min} y ${range.max}`)
        }
        this.raiseTo(p, amount)
        break
      }

      case 'all_in': {
        const maxTo = p.committed + p.stack
        if (maxTo <= this.currentBet) {
          this.commit(p, p.stack) // all-in para igualar (o igualar parcialmente)
        } else {
          const range = this.currentBet === 0 ? legal.bet : legal.raise
          if (!range) throw invalid('No puedes subir ahora: solo igualar o retirarte')
          this.raiseTo(p, maxTo)
        }
        break
      }

      default:
        throw invalid(`Acción desconocida: ${String(action.type)}`)
    }

    p.hasActed = true
    p.raiseLevelSeen = this.lastFullRaiseLevel

    const put = before - p.stack
    const logged: LoggedAction =
      p.allIn && put > 0 ? 'all_in' : action.type === 'all_in' ? 'call' : action.type
    this.log(p, logged, put)
    this.advance(p.seat)
  }

  /**
   * Acción automática cuando se agota el tiempo: pasar si se puede, si no retirarse.
   */
  timeoutAction(): { type: ActionType } {
    if (this.toActSeat === null)
      throw new InvalidActionError('hand_complete', 'Nadie tiene el turno')
    return this.legalActions(this.toActSeat)!.check ? { type: 'check' } : { type: 'fold' }
  }

  /*
  |--------------------------------------------------------------------------
  | Flujo de la mano
  |--------------------------------------------------------------------------
  */

  private advance(fromSeat: number) {
    if (this.players.filter((p) => !p.folded).length === 1) {
      this.finish()
      return
    }
    if (this.bettingClosed()) {
      this.closeStreet()
      return
    }
    this.toActSeat = this.nextSeat(fromSeat, (p) => this.needsToAct(p))!.seat
  }

  /**
   * Cierra la calle y reparte la siguiente. Si nadie más puede apostar
   * (todos all-in), reparte el resto del tablero directamente.
   */
  private closeStreet() {
    this.toActSeat = null
    while (true) {
      for (const p of this.players) {
        p.committed = 0
        p.hasActed = false
        p.raiseLevelSeen = 0
      }
      this.currentBet = 0
      this.minRaise = this.bigBlind
      this.lastFullRaiseLevel = 0

      if (this.street === 'preflop') {
        this.burn()
        this.board.push(this.draw(), this.draw(), this.draw())
        this.street = 'flop'
      } else if (this.street === 'flop') {
        this.burn()
        this.board.push(this.draw())
        this.street = 'turn'
      } else if (this.street === 'turn') {
        this.burn()
        this.board.push(this.draw())
        this.street = 'river'
      } else {
        this.street = 'showdown'
        this.finish()
        return
      }

      if (!this.bettingClosed()) {
        // Postflop habla primero el primer jugador activo a la izquierda del botón
        this.toActSeat = this.nextSeat(this.dealerSeat, (p) => this.needsToAct(p))!.seat
        return
      }
    }
  }

  private bettingClosed() {
    const active = this.players.filter((p) => this.canAct(p))
    if (active.length === 0) return true

    const maxCommitted = Math.max(...this.players.filter((p) => !p.folded).map((p) => p.committed))
    if (active.length === 1 && active[0].committed >= maxCommitted) return true

    return active.every((p) => p.hasActed && p.committed === this.currentBet)
  }

  private finish() {
    this.toActSeat = null
    this.isComplete = true

    const contenders = this.players.filter((p) => !p.folded)
    const showdown = contenders.length > 1
    const evaluations = new Map<number, EvaluatedHand>()
    if (showdown) {
      for (const p of contenders)
        evaluations.set(p.seat, evaluateBest([...p.holeCards, ...this.board]))
    }

    const won = new Map<number, number>()
    const realWinners = new Set<number>()
    const payoutOrder = this.seatsFrom(this.dealerSeat).map((p) => p.seat)

    const pots: PotResult[] = this.buildPots().map((pot) => {
      let winners = pot.eligible
      if (winners.length > 1) {
        const best = Math.max(...winners.map((p) => evaluations.get(p.seat)!.score))
        winners = winners.filter((p) => evaluations.get(p.seat)!.score === best)
      }
      winners.sort((a, b) => payoutOrder.indexOf(a.seat) - payoutOrder.indexOf(b.seat))

      const share = Math.floor(pot.amount / winners.length)
      let remainder = pot.amount - share * winners.length
      const payouts = winners.map((w) => {
        const amount = share + (remainder-- > 0 ? 1 : 0)
        w.stack += amount
        won.set(w.seat, (won.get(w.seat) ?? 0) + amount)
        if (pot.contributors > 1) realWinners.add(w.seat)
        return { seat: w.seat, userId: w.userId, amount }
      })

      return {
        amount: pot.amount,
        eligibleSeats: pot.eligible.map((p) => p.seat),
        winners: payouts,
        contributors: pot.contributors,
      }
    })

    const totalPot = this.pot
    const before = this.players.reduce((s, p) => s + p.startingStack, 0)
    const after = this.players.reduce((s, p) => s + p.stack, 0)
    if (before !== after) {
      throw new Error(`Error de conservación de fichas: ${before} → ${after}`)
    }

    this.result = {
      board: [...this.board],
      showdown,
      totalPot,
      pots,
      players: this.players.map((p) => {
        const evaluation = evaluations.get(p.seat)
        return {
          seat: p.seat,
          userId: p.userId,
          startingStack: p.startingStack,
          endingStack: p.stack,
          totalCommitted: p.totalCommitted,
          amountWon: won.get(p.seat) ?? 0,
          folded: p.folded,
          wentToShowdown: showdown && !p.folded,
          isWinner: realWinners.has(p.seat),
          holeCards: [...p.holeCards],
          hand: evaluation
            ? { name: evaluation.name, category: evaluation.category, cards: evaluation.cards }
            : null,
        }
      }),
    }
  }

  /**
   * Divide lo apostado en bote principal y botes paralelos según cuánto
   * aportó cada jugador. Solo pueden ganar un bote quienes no se retiraron
   * y aportaron al menos ese nivel.
   */
  private buildPots() {
    const levels = [
      ...new Set(this.players.map((p) => p.totalCommitted).filter((v) => v > 0)),
    ].sort((a, b) => a - b)

    const pots: { amount: number; eligible: PlayerState[]; contributors: number }[] = []
    let previous = 0
    for (const level of levels) {
      const amount = this.players.reduce(
        (sum, p) => sum + Math.min(p.totalCommitted, level) - Math.min(p.totalCommitted, previous),
        0
      )
      const contributors = this.players.filter((p) => p.totalCommitted > previous).length
      const eligible = this.players.filter((p) => !p.folded && p.totalCommitted >= level)
      previous = level
      if (amount === 0) continue

      const last = pots.at(-1)
      const sameEligible =
        last &&
        last.eligible.length === eligible.length &&
        last.eligible.every((p) => eligible.includes(p))

      if (eligible.length === 0 && last) {
        // Fichas de jugadores retirados por encima de todos los demás: van al último bote
        last.amount += amount
      } else if (sameEligible) {
        last.amount += amount
        last.contributors = Math.max(last.contributors, contributors)
      } else {
        pots.push({ amount, eligible, contributors })
      }
    }
    return pots
  }

  /*
  |--------------------------------------------------------------------------
  | Helpers
  |--------------------------------------------------------------------------
  */

  private canAct(p: PlayerState) {
    return !p.folded && !p.allIn
  }

  private needsToAct(p: PlayerState) {
    return this.canAct(p) && (!p.hasActed || p.committed < this.currentBet)
  }

  private commit(p: PlayerState, amount: number) {
    const chips = Math.min(amount, p.stack)
    p.stack -= chips
    p.committed += chips
    p.totalCommitted += chips
    if (p.stack === 0) p.allIn = true
  }

  private raiseTo(p: PlayerState, to: number) {
    const raiseSize = to - this.currentBet
    this.commit(p, to - p.committed)
    if (raiseSize >= this.minRaise) {
      this.minRaise = raiseSize
      this.lastFullRaiseLevel = to
    }
    this.currentBet = to
  }

  private postBlind(p: PlayerState, amount: number, action: 'small_blind' | 'big_blind') {
    const before = p.stack
    this.commit(p, amount)
    this.log(p, action, before - p.stack)
  }

  private log(p: PlayerState, action: LoggedAction, amount: number) {
    this.actions.push({
      sequence: this.actions.length + 1,
      seat: p.seat,
      userId: p.userId,
      street: this.street,
      action,
      amount,
      totalBet: p.committed,
    })
  }

  /**
   * Siguiente jugador (en sentido horario) después de `fromSeat` que cumpla el predicado
   */
  private nextSeat(fromSeat: number, predicate: (p: PlayerState) => boolean = () => true) {
    return this.seatsFrom(fromSeat).find(predicate)
  }

  /**
   * Jugadores en orden horario empezando por el siguiente a `fromSeat`
   */
  private seatsFrom(fromSeat: number) {
    const index = this.players.findIndex((p) => p.seat === fromSeat)
    return this.players.map((_, i) => this.players[(index + 1 + i) % this.players.length])
  }

  private draw() {
    const card = this.deck.shift()
    if (!card) throw new Error('Se acabó el mazo')
    return card
  }

  private burn() {
    this.draw()
  }
}
