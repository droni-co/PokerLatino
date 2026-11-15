import { type Card, rankValue, suitOf } from '#game/holdem/cards'

export enum HandCategory {
  HighCard = 0,
  Pair = 1,
  TwoPair = 2,
  ThreeOfAKind = 3,
  Straight = 4,
  Flush = 5,
  FullHouse = 6,
  FourOfAKind = 7,
  StraightFlush = 8,
}

export const CATEGORY_NAMES: Record<HandCategory, string> = {
  [HandCategory.HighCard]: 'Carta alta',
  [HandCategory.Pair]: 'Pareja',
  [HandCategory.TwoPair]: 'Doble pareja',
  [HandCategory.ThreeOfAKind]: 'Trío',
  [HandCategory.Straight]: 'Escalera',
  [HandCategory.Flush]: 'Color',
  [HandCategory.FullHouse]: 'Full',
  [HandCategory.FourOfAKind]: 'Póker',
  [HandCategory.StraightFlush]: 'Escalera de color',
}

export type EvaluatedHand = {
  /**
   * Número comparable: mayor = mejor mano. Iguales = empate exacto.
   */
  score: number
  category: HandCategory
  name: string
  /**
   * Las 5 cartas que forman la mejor mano
   */
  cards: Card[]
}

/**
 * Codifica categoría + desempates en un solo número (base 15, cada valor 0..14).
 */
function encode(category: HandCategory, tiebreakers: number[]) {
  let score = category
  for (let i = 0; i < 5; i++) score = score * 15 + (tiebreakers[i] ?? 0)
  return score
}

/**
 * Devuelve la carta alta de la escalera, o 0 si no es escalera. Considera la rueda A-2-3-4-5.
 */
function straightHigh(sortedDistinctDesc: number[]) {
  if (sortedDistinctDesc.length !== 5) return 0
  if (sortedDistinctDesc[0] - sortedDistinctDesc[4] === 4) return sortedDistinctDesc[0]
  if (sortedDistinctDesc.join(',') === '14,5,4,3,2') return 5
  return 0
}

export function evaluateFive(cards: Card[]): EvaluatedHand {
  const values = cards.map(rankValue).sort((a, b) => b - a)
  const isFlush = cards.every((c) => suitOf(c) === suitOf(cards[0]))

  const counts = new Map<number, number>()
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1)
  // Grupos ordenados por cantidad y luego por valor: [[valor, cantidad], ...]
  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])
  const high = straightHigh([...counts.keys()].sort((a, b) => b - a))

  let category: HandCategory
  let tiebreakers: number[]

  if (high && isFlush) {
    category = HandCategory.StraightFlush
    tiebreakers = [high]
  } else if (groups[0][1] === 4) {
    category = HandCategory.FourOfAKind
    tiebreakers = [groups[0][0], groups[1][0]]
  } else if (groups[0][1] === 3 && groups[1][1] === 2) {
    category = HandCategory.FullHouse
    tiebreakers = [groups[0][0], groups[1][0]]
  } else if (isFlush) {
    category = HandCategory.Flush
    tiebreakers = values
  } else if (high) {
    category = HandCategory.Straight
    tiebreakers = [high]
  } else if (groups[0][1] === 3) {
    category = HandCategory.ThreeOfAKind
    tiebreakers = groups.map((g) => g[0])
  } else if (groups[0][1] === 2 && groups[1][1] === 2) {
    category = HandCategory.TwoPair
    tiebreakers = groups.map((g) => g[0])
  } else if (groups[0][1] === 2) {
    category = HandCategory.Pair
    tiebreakers = groups.map((g) => g[0])
  } else {
    category = HandCategory.HighCard
    tiebreakers = values
  }

  return { score: encode(category, tiebreakers), category, name: CATEGORY_NAMES[category], cards }
}

/**
 * Mejor mano de 5 cartas entre 5, 6 o 7 cartas (prueba todas las combinaciones: máx. 21).
 */
export function evaluateBest(cards: Card[]): EvaluatedHand {
  if (cards.length < 5 || cards.length > 7) {
    throw new Error(`Se necesitan entre 5 y 7 cartas, se recibieron ${cards.length}`)
  }

  let best: EvaluatedHand | null = null
  for (const combo of combinations(cards, 5)) {
    const hand = evaluateFive(combo)
    if (!best || hand.score > best.score) best = hand
  }
  return best!
}

function* combinations<T>(items: T[], size: number, start = 0, acc: T[] = []): Generator<T[]> {
  if (acc.length === size) {
    yield [...acc]
    return
  }
  for (let i = start; i <= items.length - (size - acc.length); i++) {
    acc.push(items[i])
    yield* combinations(items, size, i + 1, acc)
    acc.pop()
  }
}
