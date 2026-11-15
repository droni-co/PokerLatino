import { test } from '@japa/runner'
import { randomInt } from 'node:crypto'
import { HoldemHand, InvalidActionError, type ActionType } from '#game/holdem/engine'
import { riggedDeck } from '#tests/helpers/deck'

const totalChips = (hand: HoldemHand) => hand.players.reduce((s, p) => s + p.stack, 0) + hand.pot

function threeHanded(stacks = [1000, 1000, 1000], deck?: string[]) {
  return new HoldemHand({
    players: stacks.map((stack, i) => ({ seat: i + 1, userId: 100 + i + 1, stack })),
    dealerSeat: 1,
    smallBlind: 5,
    bigBlind: 10,
    deck,
  })
}

test.group('Holdem · ciegas y turnos', () => {
  test('3 jugadores: ciegas a la izquierda del botón, habla primero el botón (UTG)', ({
    assert,
  }) => {
    const hand = threeHanded()
    assert.equal(hand.smallBlindSeat, 2)
    assert.equal(hand.bigBlindSeat, 3)
    assert.equal(hand.player(2).committed, 5)
    assert.equal(hand.player(3).committed, 10)
    assert.equal(hand.pot, 15)
    assert.equal(hand.toActSeat, 1)
    assert.equal(hand.street, 'preflop')
    hand.players.forEach((p) => assert.lengthOf(p.holeCards, 2))
  })

  test('heads-up: el botón pone la ciega chica, habla primero preflop y último postflop', ({
    assert,
  }) => {
    const hand = new HoldemHand({
      players: [
        { seat: 2, userId: 1, stack: 500 },
        { seat: 5, userId: 2, stack: 500 },
      ],
      dealerSeat: 5,
      smallBlind: 5,
      bigBlind: 10,
    })
    assert.equal(hand.smallBlindSeat, 5)
    assert.equal(hand.bigBlindSeat, 2)
    assert.equal(hand.toActSeat, 5)

    hand.applyAction(5, { type: 'call' })
    assert.equal(hand.toActSeat, 2) // opción de la ciega grande
    hand.applyAction(2, { type: 'check' })

    assert.equal(hand.street, 'flop')
    assert.lengthOf(hand.board, 3)
    assert.equal(hand.toActSeat, 2) // postflop habla primero quien no tiene el botón
  })

  test('si todos se retiran, la ciega grande gana sin showdown', ({ assert }) => {
    const hand = threeHanded()
    hand.applyAction(1, { type: 'fold' })
    hand.applyAction(2, { type: 'fold' })

    assert.isTrue(hand.isComplete)
    const result = hand.result!
    assert.isFalse(result.showdown)
    assert.equal(hand.player(3).stack, 1005)
    assert.equal(hand.player(2).stack, 995)
    assert.isTrue(result.players.find((p) => p.seat === 3)!.isWinner)
    assert.deepEqual(
      result.players.map((p) => p.hand),
      [null, null, null]
    )
  })

  test('no se puede actuar fuera de turno', ({ assert }) => {
    const hand = threeHanded()
    assert.throws(() => hand.applyAction(2, { type: 'call' }), 'No es tu turno')
    assert.isNull(hand.legalActions(2))
  })

  test('la ciega grande tiene opción de subir aunque todos igualen', ({ assert }) => {
    const hand = threeHanded()
    hand.applyAction(1, { type: 'call' })
    hand.applyAction(2, { type: 'call' })
    assert.equal(hand.toActSeat, 3)
    const legal = hand.legalActions(3)!
    assert.isTrue(legal.check)
    assert.deepEqual(legal.raise, { min: 20, max: 1000 })
  })
})

test.group('Holdem · apuestas', () => {
  test('subida mínima = última subida completa', ({ assert }) => {
    const hand = threeHanded()
    assert.deepEqual(hand.legalActions(1)!.raise, { min: 20, max: 1000 })
    assert.throws(() => hand.applyAction(1, { type: 'raise', amount: 15 }), /entre 20 y 1000/)

    hand.applyAction(1, { type: 'raise', amount: 35 }) // sube 25
    assert.deepEqual(hand.legalActions(2)!.raise, { min: 60, max: 1000 })
    assert.equal(hand.legalActions(2)!.call, 30)
  })

  test('postflop: apuesta mínima = ciega grande y la calle avanza al pasar todos', ({ assert }) => {
    const hand = threeHanded()
    hand.applyAction(1, { type: 'call' })
    hand.applyAction(2, { type: 'call' })
    hand.applyAction(3, { type: 'check' })

    assert.equal(hand.street, 'flop')
    assert.equal(hand.toActSeat, 2)
    assert.deepEqual(hand.legalActions(2)!.bet, { min: 10, max: 990 })
    assert.isNull(hand.legalActions(2)!.raise)
    assert.throws(() => hand.applyAction(2, { type: 'bet', amount: 5 }))
    assert.throws(() => hand.applyAction(2, { type: 'raise', amount: 20 }), 'No puedes subir ahora')

    hand.applyAction(2, { type: 'check' })
    hand.applyAction(3, { type: 'check' })
    hand.applyAction(1, { type: 'check' })
    assert.equal(hand.street, 'turn')
    assert.lengthOf(hand.board, 4)
  })

  test('un all-in que no completa la subida no reabre la acción', ({ assert }) => {
    // Asiento 3 queda con 150 tras el preflop
    const hand = threeHanded([1000, 1000, 160])
    hand.applyAction(1, { type: 'call' })
    hand.applyAction(2, { type: 'call' })
    hand.applyAction(3, { type: 'check' })

    hand.applyAction(2, { type: 'bet', amount: 100 })
    hand.applyAction(3, { type: 'all_in' }) // 150: sube solo 50 (< 100)

    // El asiento 1 aún no actuó en la calle: puede subir
    assert.isNotNull(hand.legalActions(1)!.raise)
    hand.applyAction(1, { type: 'call' })

    // El asiento 2 ya actuó y solo enfrenta una subida incompleta: igualar o retirarse
    const legal = hand.legalActions(2)!
    assert.equal(legal.call, 50)
    assert.isNull(legal.raise)
    assert.throws(() => hand.applyAction(2, { type: 'all_in' }), /solo igualar/)
    hand.applyAction(2, { type: 'call' })
    assert.equal(hand.street, 'turn')
  })

  test('el registro de acciones refleja ciegas, montos y all-in', ({ assert }) => {
    const hand = threeHanded([1000, 1000, 50])
    hand.applyAction(1, { type: 'raise', amount: 40 })
    hand.applyAction(2, { type: 'fold' })
    hand.applyAction(3, { type: 'all_in' })
    assert.deepEqual(
      hand.actions.map((a) => [a.seat, a.action, a.amount]),
      [
        [2, 'small_blind', 5],
        [3, 'big_blind', 10],
        [1, 'raise', 40],
        [2, 'fold', 0],
        [3, 'all_in', 40],
      ]
    )
  })

  test('acción automática por tiempo: pasa si puede, si no se retira', ({ assert }) => {
    const hand = threeHanded()
    assert.deepEqual(hand.timeoutAction(), { type: 'fold' })
    hand.applyAction(1, { type: 'call' })
    hand.applyAction(2, { type: 'call' })
    assert.deepEqual(hand.timeoutAction(), { type: 'check' })
  })
})

test.group('Holdem · showdown y botes', () => {
  test('gana la mejor mano en el showdown', ({ assert }) => {
    const deck = riggedDeck({
      seats: [1, 2, 3],
      dealerSeat: 1,
      holeCards: { 1: ['Ah', 'Ad'], 2: ['Kh', 'Kd'], 3: ['7c', '2s'] },
      board: ['Ac', '9d', '4s', '8h', '3c'],
    })
    const hand = threeHanded(undefined, deck)
    assert.deepEqual(hand.player(1).holeCards, ['Ah', 'Ad'])

    hand.applyAction(1, { type: 'call' })
    hand.applyAction(2, { type: 'call' })
    hand.applyAction(3, { type: 'check' })
    for (let street = 0; street < 3; street++) {
      hand.applyAction(2, { type: 'check' })
      hand.applyAction(3, { type: 'check' })
      hand.applyAction(1, { type: 'check' })
    }

    const result = hand.result!
    assert.isTrue(result.showdown)
    assert.deepEqual(result.board, ['Ac', '9d', '4s', '8h', '3c'])
    assert.equal(result.totalPot, 30)
    assert.deepEqual(result.pots[0].winners, [{ seat: 1, userId: 101, amount: 30 }])
    const winner = result.players.find((p) => p.seat === 1)!
    assert.equal(winner.hand!.name, 'Trío')
    assert.equal(winner.endingStack, 1020)
    assert.isTrue(result.players.every((p) => p.wentToShowdown))
  })

  test('botes paralelos con tres all-in de distinto tamaño', ({ assert }) => {
    // Corto (100) tiene la mejor mano, mediano (300) la segunda, grande (500) la peor
    const deck = riggedDeck({
      seats: [1, 2, 3],
      dealerSeat: 1,
      holeCards: { 1: ['2c', '7d'], 2: ['Ah', 'Ad'], 3: ['Kh', 'Kd'] },
      board: ['As', 'Ks', '9c', '5h', '3d'],
    })
    const hand = new HoldemHand({
      players: [
        { seat: 1, userId: 1, stack: 500 },
        { seat: 2, userId: 2, stack: 100 },
        { seat: 3, userId: 3, stack: 300 },
      ],
      dealerSeat: 1,
      smallBlind: 5,
      bigBlind: 10,
      deck,
    })
    hand.applyAction(1, { type: 'all_in' })
    hand.applyAction(2, { type: 'all_in' })
    hand.applyAction(3, { type: 'all_in' })

    assert.isTrue(hand.isComplete)
    assert.lengthOf(hand.board, 5)
    const { pots } = hand.result!
    // Principal: 100 x 3 → corto (AAA)
    assert.equal(pots[0].amount, 300)
    assert.deepEqual(
      pots[0].winners.map((w) => w.seat),
      [2]
    )
    // Lateral: 200 x 2 → mediano (KKK) le gana al grande
    assert.equal(pots[1].amount, 400)
    assert.deepEqual(
      pots[1].winners.map((w) => w.seat),
      [3]
    )
    // 200 no igualados del grande vuelven a él (no cuenta como "ganar")
    assert.equal(pots[2].amount, 200)
    assert.equal(pots[2].contributors, 1)

    assert.deepEqual(
      hand.players.map((p) => p.stack),
      [200, 300, 400]
    )
    const seat1 = hand.result!.players.find((p) => p.seat === 1)!
    assert.isFalse(seat1.isWinner)
  })

  test('empate: se divide el bote y la ficha impar va a la izquierda del botón', ({ assert }) => {
    // Escalera real en el tablero: todos empatan
    const deck = riggedDeck({
      seats: [1, 2, 3],
      dealerSeat: 1,
      holeCards: { 1: ['2c', '3d'], 2: ['2d', '3c'], 3: ['2h', '3s'] },
      board: ['As', 'Ks', 'Qs', 'Js', 'Ts'],
    })
    const hand = threeHanded(undefined, deck)
    hand.applyAction(1, { type: 'fold' }) // aporta 0
    hand.applyAction(2, { type: 'raise', amount: 26 }) // SB sube a 26
    hand.applyAction(3, { type: 'raise', amount: 47 }) // BB re-sube (21 = subida completa)
    hand.applyAction(2, { type: 'call' })
    for (let street = 0; street < 3; street++) {
      hand.applyAction(2, { type: 'check' })
      hand.applyAction(3, { type: 'check' })
    }
    // Bote 94 → 47 / 47 (par). Repetimos con un bote impar:
    assert.deepEqual(
      hand.result!.pots[0].winners.map((w) => w.amount),
      [47, 47]
    )

    const odd = threeHanded(undefined, deck)
    odd.applyAction(1, { type: 'call' }) // 10
    odd.applyAction(2, { type: 'fold' }) // SB deja 5
    odd.applyAction(3, { type: 'check' })
    for (let street = 0; street < 3; street++) {
      odd.applyAction(3, { type: 'check' })
      odd.applyAction(1, { type: 'check' })
    }
    // Bote 25 entre asientos 3 y 1: el 3 está antes que el 1 a la izquierda del botón
    assert.deepEqual(
      odd.result!.pots[0].winners.map((w) => [w.seat, w.amount]),
      [
        [3, 13],
        [1, 12],
      ]
    )
  })

  test('ciega grande all-in corta: el resto debe igualar la ciega completa', ({ assert }) => {
    const hand = new HoldemHand({
      players: [
        { seat: 1, userId: 1, stack: 1000 },
        { seat: 2, userId: 2, stack: 1000 },
        { seat: 3, userId: 3, stack: 4 },
      ],
      dealerSeat: 1,
      smallBlind: 5,
      bigBlind: 10,
    })
    assert.isTrue(hand.player(3).allIn)
    assert.equal(hand.legalActions(1)!.call, 10)
    hand.applyAction(1, { type: 'call' })
    hand.applyAction(2, { type: 'call' })
    assert.equal(hand.street, 'flop')
    assert.equal(totalChips(hand), 2004)
  })
})

test.group('Holdem · simulación aleatoria', () => {
  test('5000 manos con acciones aleatorias conservan las fichas', ({ assert }) => {
    for (let i = 0; i < 5000; i++) {
      const count = 2 + randomInt(4) // 2..5 jugadores
      const seats = [1, 2, 3, 4, 5].sort(() => randomInt(3) - 1).slice(0, count)
      const players = seats.map((seat, idx) => ({
        seat,
        userId: idx + 1,
        stack: 1 + randomInt(600),
      }))
      const initial = players.reduce((s, p) => s + p.stack, 0)
      const bigBlind = 2 + randomInt(20)
      const hand = new HoldemHand({
        players,
        dealerSeat: seats[randomInt(count)],
        smallBlind: Math.max(1, Math.floor(bigBlind / 2)),
        bigBlind,
      })

      let guard = 0
      while (!hand.isComplete) {
        assert.isBelow(++guard, 500, 'la mano no termina')
        const seat = hand.toActSeat!
        const legal = hand.legalActions(seat)!
        const options: { type: ActionType; amount?: number }[] = [{ type: 'fold' }]
        if (legal.check) options.push({ type: 'check' }, { type: 'check' })
        if (legal.call !== null) options.push({ type: 'call' }, { type: 'call' })
        const range = legal.bet ?? legal.raise
        if (range) {
          const type = legal.bet ? 'bet' : 'raise'
          options.push({ type, amount: range.min + randomInt(range.max - range.min + 1) })
          options.push({ type: 'all_in' })
        }
        hand.applyAction(seat, options[randomInt(options.length)])
      }

      const result = hand.result!
      const final = result.players.reduce((s, p) => s + p.endingStack, 0)
      assert.equal(final, initial)
      assert.isTrue(result.players.every((p) => p.endingStack >= 0))
      assert.equal(
        result.pots.reduce((s, p) => s + p.amount, 0),
        result.totalPot
      )
      if (result.showdown) assert.lengthOf(result.board, 5)
    }
  })

  test('una acción inválida no cambia el estado', ({ assert }) => {
    const hand = threeHanded()
    const snapshot = JSON.stringify(hand.players)
    assert.throws(() => hand.applyAction(1, { type: 'check' }), InvalidActionError as any)
    assert.equal(JSON.stringify(hand.players), snapshot)
  })
})
