import gameConfig from '#config/game'

/*
|--------------------------------------------------------------------------
| Reglas de torneo (funciones puras)
|--------------------------------------------------------------------------
*/

/**
 * Porcentaje del bote para cada puesto pagado (índice 0 = 1.º), según inscritos
 */
export function payoutPercents(entrants: number) {
  const row = gameConfig.tournaments.payouts.find((p) => entrants <= p.upTo)
  return (row ?? gameConfig.tournaments.payouts.at(-1)!).percents.slice(0, Math.max(1, entrants))
}

/**
 * Premio en fichas de cada puesto pagado. Se redondea hacia abajo y lo que sobra
 * (por redondeo) es para el 1.º: el total repartido es exactamente el bote.
 */
export function payoutAmounts(prizePool: number, entrants: number) {
  const amounts = payoutPercents(entrants).map((pct) => Math.floor((prizePool * pct) / 100))
  const rest = prizePool - amounts.reduce((sum, a) => sum + a, 0)
  if (amounts.length > 0) amounts[0] += rest
  return amounts
}

/** Tope de duplicaciones (2^40 ya es absurdo; evita salir de los enteros seguros) */
const MAX_LEVEL = 40

/**
 * Ciegas de una mano de torneo: se duplican cada `blindsUpEveryHands` manos de la mesa.
 * `handNumber` es el número de mano en la mesa (desde 1). `level` empieza en 1.
 * `handsLeft`: manos que quedan en el nivel contando esta.
 */
export function blindsForHand(
  t: { smallBlind: number; bigBlind: number; blindsUpEveryHands: number },
  handNumber: number
) {
  const every = Math.max(1, t.blindsUpEveryHands)
  const index = Math.min(MAX_LEVEL, Math.floor((Math.max(1, handNumber) - 1) / every))
  const factor = 2 ** index
  const nextFactor = 2 ** Math.min(MAX_LEVEL, index + 1)
  return {
    level: index + 1,
    smallBlind: t.smallBlind * factor,
    bigBlind: t.bigBlind * factor,
    nextSmallBlind: t.smallBlind * nextFactor,
    nextBigBlind: t.bigBlind * nextFactor,
    handsLeft: every - ((Math.max(1, handNumber) - 1) % every),
  }
}

export type BalanceTable = {
  id: number
  /** Jugadores sentados (userId), en orden de asiento */
  players: number[]
  /** Hay una mano en curso: no se le puede quitar a nadie (sí recibir jugadores) */
  busy: boolean
}

export type BalancePlan = {
  moves: { userId: number; from: number; to: number }[]
  close: number[]
}

/**
 * Plan para equilibrar las mesas de un torneo tras eliminaciones:
 * 1. Si los jugadores caben en una mesa menos, se rompe la mesa (libre de mano) con menos
 *    jugadores (a igualdad, la de id más alto) y se reparten sus jugadores.
 * 2. Mientras la mesa más llena (libre de mano) tenga 2 o más jugadores que la más vacía,
 *    se mueve uno de ella a la más vacía.
 * Solo se sacan jugadores de mesas sin mano en curso; lo que no se pueda hacer ahora se
 * hará cuando esas mesas terminen su mano.
 */
export function planBalance(input: BalanceTable[], maxSeats: number): BalancePlan {
  const tables = input.map((t) => ({ ...t, players: [...t.players] }))
  const moves: BalancePlan['moves'] = []
  const close: number[] = []
  const open = () => tables.filter((t) => !close.includes(t.id))
  const total = () => open().reduce((sum, t) => sum + t.players.length, 0)

  const move = (from: (typeof tables)[number], to: (typeof tables)[number]) => {
    const userId = from.players.pop()!
    to.players.push(userId)
    moves.push({ userId, from: from.id, to: to.id })
  }

  // 1. Romper mesas
  while (open().length > 1 && total() <= (open().length - 1) * maxSeats) {
    const candidate = open()
      .filter((t) => !t.busy)
      .sort((a, b) => a.players.length - b.players.length || b.id - a.id)[0]
    if (!candidate) break
    close.push(candidate.id)
    while (candidate.players.length > 0) {
      const target = open()
        .filter((t) => t.players.length < maxSeats)
        .sort((a, b) => a.players.length - b.players.length || a.id - b.id)[0]
      move(candidate, target)
    }
  }

  // 2. Equilibrar
  for (;;) {
    const tablesOpen = open()
    if (tablesOpen.length < 2) break
    const smallest = [...tablesOpen].sort(
      (a, b) => a.players.length - b.players.length || a.id - b.id
    )[0]
    const largest = tablesOpen
      .filter((t) => !t.busy && t.id !== smallest.id)
      .sort((a, b) => b.players.length - a.players.length || a.id - b.id)[0]
    if (!largest || largest.players.length - smallest.players.length < 2) break
    move(largest, smallest)
  }

  return { moves, close }
}
