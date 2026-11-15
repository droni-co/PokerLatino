import { randomInt } from 'node:crypto'

/**
 * Carta en notación de 2 caracteres: rango + palo. Ej: 'As' (as de picas), 'Td' (10 de diamantes).
 *   Rangos: 2 3 4 5 6 7 8 9 T J Q K A
 *   Palos:  c (tréboles) d (diamantes) h (corazones) s (picas)
 */
export type Card = string

export const RANKS = '23456789TJQKA'
export const SUITS = 'cdhs'

export function createDeck(): Card[] {
  const deck: Card[] = []
  for (const suit of SUITS) {
    for (const rank of RANKS) deck.push(rank + suit)
  }
  return deck
}

/**
 * Fisher-Yates con generador criptográficamente seguro (crypto.randomInt).
 * Ver Legal.md §6: el RNG deberá ser certificado por un laboratorio independiente.
 */
export function shuffle(deck: Card[], random: (max: number) => number = randomInt): Card[] {
  const result = [...deck]
  for (let i = result.length - 1; i > 0; i--) {
    const j = random(i + 1)
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

export function shuffledDeck() {
  return shuffle(createDeck())
}

/**
 * 2..14 (el As vale 14; en la escalera A-2-3-4-5 se trata como 1)
 */
export function rankValue(card: Card) {
  return RANKS.indexOf(card[0]) + 2
}

export function suitOf(card: Card) {
  return card[1]
}

export function isValidCard(card: string) {
  return card.length === 2 && RANKS.includes(card[0]) && SUITS.includes(card[1])
}
