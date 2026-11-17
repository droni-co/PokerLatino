import { type Card, createDeck, rankValue, suitOf } from '#game/holdem/cards'
import type { ActionType, HoldemHand, LegalActions, Street } from '#game/holdem/engine'

/*
|--------------------------------------------------------------------------
| Estrategia del bot
|--------------------------------------------------------------------------
| Módulo puro: recibe lo que vería un jugador sentado en ese asiento (sus cartas, la mesa
| y las acciones públicas) y devuelve una acción legal. Nunca ve las cartas de los rivales:
| `botView()` copia solo la información pública.
|
| Cómo decide:
|  1. Estima el rango de cada rival con lo que hizo en la mano (subir preflop = manos
|     fuertes, apostar después del flop = conectó con la mesa o tiene proyecto).
|  2. Calcula su equity (probabilidad de ganar el bote) con una simulación Monte Carlo
|     contra esos rangos.
|  3. Compara la equity con las pot odds y con umbrales que dependen del número de rivales
|     y de su posición: apuesta por valor, paga si le sale a cuenta, farolea a veces y se
|     retira cuando no le compensa.
*/

export type BotOpponent = {
  stack: number
  committed: number
  allIn: boolean
  /** Subidas antes del flop (apuestas, resubidas, all-in) */
  preflopRaises: number
  /** Apuestas y subidas después del flop */
  postflopAggression: number
}

export type BotView = {
  holeCards: Card[]
  board: Card[]
  street: Street
  pot: number
  currentBet: number
  bigBlind: number
  stack: number
  committed: number
  legal: LegalActions
  /** Rivales que siguen en la mano */
  opponents: BotOpponent[]
  /** Actúa último después del flop (está en el botón o detrás de todos) */
  inPosition: boolean
  /** Nadie ha subido antes del flop (solo ciegas y limps) */
  unopenedPreflop: boolean
  /** Ya apostó o subió en esta calle */
  aggressorThisStreet: boolean
}

export type BotAction = { type: ActionType; amount?: number }

type Random = () => number

/**
 * Lo que ve el jugador del asiento `seat`: sus cartas y la información pública
 */
export function botView(hand: HoldemHand, seat: number): BotView {
  const me = hand.player(seat)
  const legal = hand.legalActions(seat)
  if (!legal) throw new Error('No es el turno del bot')

  const raises = new Map<number, { pre: number; post: number }>()
  for (const a of hand.actions) {
    if (a.action !== 'bet' && a.action !== 'raise' && a.action !== 'all_in') continue
    const r = raises.get(a.seat) ?? { pre: 0, post: 0 }
    if (a.street === 'preflop') r.pre++
    else r.post++
    raises.set(a.seat, r)
  }

  const live = hand.players.filter((p) => !p.folded)
  const opponents = live
    .filter((p) => p.seat !== seat)
    .map((p) => ({
      stack: p.stack,
      committed: p.committed,
      allIn: p.allIn,
      preflopRaises: raises.get(p.seat)?.pre ?? 0,
      postflopAggression: raises.get(p.seat)?.post ?? 0,
    }))

  // Después del flop habla primero el primero a la izquierda del botón: el último es
  // el jugador vivo más cercano al botón por la derecha
  const order = [...live].sort(
    (a, b) => distanceFromButton(hand, a.seat) - distanceFromButton(hand, b.seat)
  )
  const inPosition = order.at(-1)?.seat === seat

  const preflopRaised = hand.actions.some(
    (a) =>
      a.street === 'preflop' &&
      (a.action === 'raise' || a.action === 'bet' || a.action === 'all_in')
  )

  return {
    holeCards: [...me.holeCards],
    board: [...hand.board],
    street: hand.street,
    pot: hand.pot,
    currentBet: hand.currentBet,
    bigBlind: hand.bigBlind,
    stack: me.stack,
    committed: me.committed,
    legal,
    opponents,
    inPosition,
    unopenedPreflop: !preflopRaised,
    aggressorThisStreet: hand.actions.some(
      (a) =>
        a.seat === seat &&
        a.street === hand.street &&
        (a.action === 'bet' || a.action === 'raise' || a.action === 'all_in')
    ),
  }
}

function distanceFromButton(hand: HoldemHand, seat: number) {
  const seats = hand.players.map((p) => p.seat)
  const button = seats.indexOf(hand.dealerSeat)
  const index = seats.indexOf(seat)
  // 1 = primero a la izquierda del botón … n = el botón
  return ((index - button + seats.length - 1) % seats.length) + 1
}

/*
|--------------------------------------------------------------------------
| Decisión
|--------------------------------------------------------------------------
*/

/** Umbrales de equity según cuántos rivales quedan: [valor, subir, monstruo] */
function thresholds(opponents: number) {
  if (opponents <= 1) return { value: 0.6, raise: 0.7, monster: 0.85 }
  if (opponents === 2) return { value: 0.47, raise: 0.57, monster: 0.75 }
  return { value: 0.4, raise: 0.5, monster: 0.68 }
}

export function decide(
  view: BotView,
  options: { iterations?: number; random?: Random } = {}
): BotAction {
  const random = options.random ?? Math.random
  const { legal } = view
  const toCall = legal.call ?? 0
  const equity = estimateEquity(view, options.iterations ?? 600, random)
  const n = Math.max(1, view.opponents.length)
  const t = thresholds(n)
  const potOdds = toCall > 0 ? toCall / (view.pot + toCall) : 0
  const preflop = view.street === 'preflop'

  // Más agresivo con pocos rivales y en posición; un poco de ruido para no ser predecible
  const looseness = (view.inPosition ? 0.03 : 0) + (random() - 0.5) * 0.04
  const e = equity + looseness

  const passive = (): BotAction => (legal.check ? { type: 'check' } : { type: 'fold' })

  if (toCall === 0) {
    // Nadie apostó en esta calle
    if (e >= t.monster) {
      // Mano muy fuerte: a veces la esconde en el flop para cobrar más después
      if (!preflop && view.street === 'flop' && random() < 0.2) return passive()
      return betOrRaise(view, potFraction(view, 0.75 + random() * 0.35))
    }
    if (e >= t.value) return betOrRaise(view, potFraction(view, 0.5 + random() * 0.25))
    if (preflop) {
      // Ciega grande con limps: subir manos jugables en heads-up, si no pasar gratis
      if (n === 1 && e >= 0.55 && random() < 0.5) return betOrRaise(view, raiseTo(view, 3))
      return passive()
    }
    // Farol / semifarol: más con pocos rivales, en posición y si ya llevaba la iniciativa
    const bluffChance =
      (n === 1 ? 0.22 : n === 2 ? 0.1 : 0.04) +
      (view.inPosition ? 0.08 : 0) +
      (view.street !== 'river' && equity >= 0.3 ? 0.12 : 0)
    if (random() < bluffChance) return betOrRaise(view, potFraction(view, 0.45 + random() * 0.25))
    return passive()
  }

  // Hay una apuesta que pagar
  const allInCall = legal.call !== null && legal.call >= view.stack
  if (preflop) {
    if (view.unopenedPreflop) {
      // Nadie subió: abrir con manos jugables (más en heads-up y en el botón)
      const open = n === 1 ? 0.5 : n === 2 ? 0.4 : 0.32
      if (e >= t.raise || (e >= open && random() < 0.75)) {
        return betOrRaise(view, raiseTo(view, 2.5 + random()))
      }
      if (e >= open - 0.06 && potOdds < 0.35) return call(view)
      return passive()
    }
    // Ya hubo subida: resubir con lo mejor, pagar si las pot odds lo justifican
    if (e >= t.monster || (e >= t.raise && random() < 0.5)) {
      return betOrRaise(view, view.currentBet * (2.8 + random() * 0.6))
    }
    if (e >= potOdds + (allInCall ? 0.08 : 0.04)) return call(view)
    return passive()
  }

  if (e >= t.monster) {
    return random() < 0.7 ? betOrRaise(view, view.currentBet * 2.5 + view.pot * 0.3) : call(view)
  }
  if (e >= t.raise && !view.aggressorThisStreet && random() < 0.4) {
    return betOrRaise(view, view.currentBet * 2.5 + view.pot * 0.2)
  }
  // Pagar si la equity cubre el precio. En flop y turn se acepta algo menos
  // por lo que se puede ganar en las siguientes calles (implied odds)
  const implied = view.street !== 'river' && toCall < view.stack * 0.25 ? 0.04 : 0
  const margin = allInCall ? 0.06 : 0.02
  if (e >= potOdds + margin - implied) return call(view)
  // Semifarol ocasional con proyecto
  if (view.street === 'flop' && equity >= 0.32 && n === 1 && random() < 0.1) {
    return betOrRaise(view, view.currentBet * 2.6)
  }
  return passive()
}

function call(view: BotView): BotAction {
  return view.legal.call !== null ? { type: 'call' } : { type: 'check' }
}

/** Apuesta total en la calle = fracción del bote */
function potFraction(view: BotView, fraction: number) {
  return view.currentBet + Math.round((view.pot + (view.legal.call ?? 0)) * fraction)
}

/** Subida antes del flop: N ciegas grandes, más una por cada jugador que solo igualó */
function raiseTo(view: BotView, bigBlinds: number) {
  const limpers = view.opponents.filter((o) => o.committed === view.bigBlind).length
  return Math.round(view.bigBlind * (bigBlinds + Math.max(0, limpers - 1)))
}

/**
 * Apostar o subir hasta `target` (total en la calle), ajustado a lo permitido. Si casi
 * todo su stack va en la apuesta, va all-in. Si no puede subir, paga o pasa.
 */
function betOrRaise(view: BotView, target: number): BotAction {
  const range = view.legal.bet ?? view.legal.raise
  if (!range) return view.legal.call !== null ? { type: 'call' } : { type: 'check' }
  const type: ActionType = view.legal.bet ? 'bet' : 'raise'
  // Redondear a la ciega chica para que parezca una apuesta humana
  const unit = Math.max(1, Math.round(view.bigBlind / 2))
  let amount = Math.round(target / unit) * unit
  amount = Math.min(range.max, Math.max(range.min, amount))
  if (amount >= range.max * 0.85) return { type: 'all_in' }
  return { type, amount }
}

/*
|--------------------------------------------------------------------------
| Equity (Monte Carlo)
|--------------------------------------------------------------------------
*/

/**
 * Probabilidad de ganar (los empates cuentan su parte) contra los rangos estimados
 */
export function estimateEquity(view: BotView, iterations: number, random: Random = Math.random) {
  const known = new Set([...view.holeCards, ...view.board])
  const deck = createDeck().filter((c) => !known.has(c))
  const opponents = view.opponents.length
  if (opponents === 0) return 1

  let total = 0
  for (let i = 0; i < iterations; i++) {
    const pool = [...deck]
    const take = () => pool.splice(Math.floor(random() * pool.length), 1)[0]

    const hands: Card[][] = []
    for (const opp of view.opponents) hands.push(sampleHand(pool, view.board, opp, random))

    const board = [...view.board]
    while (board.length < 5) board.push(take())

    const mine = fastScore([...view.holeCards, ...board])
    let best = mine
    let tied = 1
    for (const h of hands) {
      const s = fastScore([...h, ...board])
      if (s > best) {
        best = s
        tied = 0
      } else if (s === best) {
        tied++
      }
    }
    if (best === mine && tied > 0) total += 1 / tied
  }
  return total / iterations
}

/**
 * Reparte dos cartas a un rival según lo que hizo en la mano (rechazo con límite de
 * intentos: si no encuentra una mano del rango, se queda con la última)
 */
function sampleHand(pool: Card[], board: Card[], opp: BotOpponent, random: Random) {
  const minChen =
    opp.preflopRaises >= 3
      ? 11
      : opp.preflopRaises === 2
        ? 9
        : opp.preflopRaises === 1
          ? 6
          : -Infinity

  let picked: [number, number] = [0, 1]
  for (let attempt = 0; attempt < 40; attempt++) {
    const a = Math.floor(random() * pool.length)
    let b = Math.floor(random() * (pool.length - 1))
    if (b >= a) b++
    picked = [a, b]
    const cards = [pool[a], pool[b]]
    if (chenScore(cards) < minChen) continue
    if (board.length >= 3 && opp.postflopAggression > 0) {
      const strength = postflopStrength(cards, board)
      // Una apuesta: conectó con la mesa o tiene proyecto (o farolea, a veces)
      if (opp.postflopAggression === 1 && strength < 1 && random() > 0.3) continue
      // Varias: mano hecha fuerte casi siempre
      if (opp.postflopAggression >= 2 && strength < 2 && random() > 0.12) continue
    }
    break
  }
  // Quitarlas del mazo (primero la de índice mayor)
  const [hi, lo] = picked[0] > picked[1] ? picked : [picked[1], picked[0]]
  const second = pool.splice(hi, 1)[0]
  const first = pool.splice(lo, 1)[0]
  return [first, second]
}

/**
 * 0 = nada, 1 = pareja con la mesa o proyecto de color/escalera, 2 = top pair, overpair
 * o algo mejor
 */
export function postflopStrength(hole: Card[], board: Card[]) {
  const boardRanks = board.map(rankValue)
  const topBoard = Math.max(...boardRanks)
  const [r1, r2] = hole.map(rankValue)

  const all = [...hole, ...board] // 5 a 7 cartas
  const category = Math.floor(fastScore(all) / 15 ** 5)
  // Doble pareja o mejor que use alguna carta propia
  if (category >= 2) {
    const boardOnly = board.length >= 5 ? Math.floor(fastScore(board) / 15 ** 5) : -1
    if (category > boardOnly) return 2
  }
  if (r1 === r2 && r1 > topBoard) return 2 // overpair
  if (boardRanks.includes(r1) && r1 === topBoard) return 2
  if (boardRanks.includes(r2) && r2 === topBoard) return 2
  if (r1 === r2 || boardRanks.includes(r1) || boardRanks.includes(r2)) return 1

  // Proyectos (solo si quedan cartas por salir)
  if (board.length < 5) {
    const suits = new Map<string, number>()
    for (const c of all) suits.set(suitOf(c), (suits.get(suitOf(c)) ?? 0) + 1)
    const flushDraw = hole.some((c) => suits.get(suitOf(c))! >= 4)
    if (flushDraw) return 1
    let mask = 0
    for (const c of all) mask |= 1 << rankValue(c)
    if (mask & (1 << 14)) mask |= 1 << 1
    for (let low = 1; low <= 10; low++) {
      const window = (mask >> low) & 0b11111
      if (bitCount(window) >= 4) return 1
    }
  }
  return 0
}

function bitCount(n: number) {
  let c = 0
  while (n) {
    n &= n - 1
    c++
  }
  return c
}

/**
 * Fórmula de Chen: fuerza de dos cartas antes del flop (−1 a 20)
 */
export function chenScore(cards: Card[]) {
  const [a, b] = cards
  const ra = rankValue(a)
  const rb = rankValue(b)
  const hi = Math.max(ra, rb)
  const lo = Math.min(ra, rb)
  const base = hi === 14 ? 10 : hi === 13 ? 8 : hi === 12 ? 7 : hi === 11 ? 6 : hi / 2
  if (ra === rb) return Math.ceil(Math.max(5, base * 2))

  let score = base
  if (suitOf(a) === suitOf(b)) score += 2
  const gap = hi - lo - 1
  score -= gap === 0 ? 0 : gap === 1 ? 1 : gap === 2 ? 2 : gap === 3 ? 4 : 5
  if (gap <= 1 && hi < 12) score += 1
  return Math.ceil(score)
}

/*
|--------------------------------------------------------------------------
| Evaluador rápido (5 a 7 cartas)
|--------------------------------------------------------------------------
| Da exactamente el mismo `score` que `evaluateBest` (mismo codificado en base 15),
| pero sin probar las 21 combinaciones: la simulación lo llama miles de veces.
*/

const SUIT_INDEX: Record<string, number> = { c: 0, d: 1, h: 2, s: 3 }

function encode(category: number, tiebreakers: number[]) {
  let score = category
  for (let i = 0; i < 5; i++) score = score * 15 + (tiebreakers[i] ?? 0)
  return score
}

function straightHigh(mask: number) {
  const m = mask | (mask & (1 << 14) ? 1 << 1 : 0)
  for (let high = 14; high >= 5; high--) {
    const need = 0b11111 << (high - 4)
    if ((m & need) === need) return high
  }
  return 0
}

function topRanks(mask: number, count: number, exclude: number[] = []) {
  const out: number[] = []
  for (let r = 14; r >= 2 && out.length < count; r--) {
    if (mask & (1 << r) && !exclude.includes(r)) out.push(r)
  }
  return out
}

export function fastScore(cards: Card[]) {
  const counts = new Array<number>(15).fill(0)
  const suitMasks = [0, 0, 0, 0]
  const suitCounts = [0, 0, 0, 0]
  let mask = 0
  for (const c of cards) {
    const r = rankValue(c)
    const s = SUIT_INDEX[c[1]]
    counts[r]++
    mask |= 1 << r
    suitMasks[s] |= 1 << r
    suitCounts[s]++
  }

  // Con 7 cartas, color y póker/full no pueden darse a la vez
  for (let s = 0; s < 4; s++) {
    if (suitCounts[s] < 5) continue
    const sf = straightHigh(suitMasks[s])
    if (sf) return encode(8, [sf])
    return encode(5, topRanks(suitMasks[s], 5))
  }

  const quads: number[] = []
  const trips: number[] = []
  const pairs: number[] = []
  for (let r = 14; r >= 2; r--) {
    if (counts[r] === 4) quads.push(r)
    else if (counts[r] === 3) trips.push(r)
    else if (counts[r] === 2) pairs.push(r)
  }

  if (quads.length) return encode(7, [quads[0], ...topRanks(mask, 1, [quads[0]])])
  if (trips.length && (trips.length > 1 || pairs.length)) {
    return encode(6, [trips[0], Math.max(trips[1] ?? 0, pairs[0] ?? 0)])
  }
  const straight = straightHigh(mask)
  if (straight) return encode(4, [straight])
  if (trips.length) return encode(3, [trips[0], ...topRanks(mask, 2, [trips[0]])])
  if (pairs.length >= 2) {
    return encode(2, [pairs[0], pairs[1], ...topRanks(mask, 1, [pairs[0], pairs[1]])])
  }
  if (pairs.length) return encode(1, [pairs[0], ...topRanks(mask, 3, [pairs[0]])])
  return encode(0, topRanks(mask, 5))
}
