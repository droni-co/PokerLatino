import { type Card, createDeck } from '#game/holdem/cards'

/**
 * Arma un mazo "trucado" para tests respetando el orden de reparto del motor:
 *  - 2 vueltas de una carta, empezando por el asiento a la izquierda del botón
 *  - quemar + flop (3), quemar + turn, quemar + river
 */
export function riggedDeck(options: {
  seats: number[]
  dealerSeat: number
  holeCards: Record<number, [Card, Card]>
  board?: Card[]
}): Card[] {
  const seats = [...options.seats].sort((a, b) => a - b)
  const start = seats.indexOf(options.dealerSeat)
  const order = seats.map((_, i) => seats[(start + 1 + i) % seats.length])

  const used = new Set<Card>([...Object.values(options.holeCards).flat(), ...(options.board ?? [])])
  const filler = createDeck().filter((c) => !used.has(c))
  const next = () => filler.shift()!

  const deck: Card[] = []
  for (let round = 0; round < 2; round++) {
    for (const seat of order) deck.push(options.holeCards[seat]?.[round] ?? next())
  }
  const board = options.board ?? []
  const boardCard = (i: number) => board[i] ?? next()
  deck.push(next(), boardCard(0), boardCard(1), boardCard(2)) // quemar + flop
  deck.push(next(), boardCard(3)) // quemar + turn
  deck.push(next(), boardCard(4)) // quemar + river
  return [...deck, ...filler]
}
