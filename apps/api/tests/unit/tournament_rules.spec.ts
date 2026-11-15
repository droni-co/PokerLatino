import { test } from '@japa/runner'
import { blindsForHand, payoutAmounts, planBalance } from '#game/tournament_rules'

test.group('Reglas de torneo', () => {
  test('premios: escala según inscritos y reparte exactamente el bote', ({ assert }) => {
    assert.deepEqual(payoutAmounts(300, 3), [300])
    assert.deepEqual(payoutAmounts(600, 6), [390, 210])
    assert.deepEqual(payoutAmounts(1000, 10), [500, 300, 200])
    assert.lengthOf(payoutAmounts(2500, 25), 5)
    assert.lengthOf(payoutAmounts(10_000, 100), 10)

    // El resto del redondeo es para el 1.º
    const odd = payoutAmounts(1001, 10)
    assert.equal(
      odd.reduce((a, b) => a + b, 0),
      1001
    )
    assert.equal(odd[0], 501)
  })

  test('ciegas: se duplican cada N manos', ({ assert }) => {
    const t = { smallBlind: 10, bigBlind: 20, blindsUpEveryHands: 3 }
    assert.containsSubset(blindsForHand(t, 1), {
      level: 1,
      smallBlind: 10,
      bigBlind: 20,
      handsLeft: 3,
    })
    assert.containsSubset(blindsForHand(t, 3), { level: 1, handsLeft: 1, nextBigBlind: 40 })
    assert.containsSubset(blindsForHand(t, 4), {
      level: 2,
      smallBlind: 20,
      bigBlind: 40,
      handsLeft: 3,
    })
    assert.containsSubset(blindsForHand(t, 10), { level: 4, smallBlind: 80, bigBlind: 160 })
  })

  test('balanceo: rompe la mesa más vacía si los jugadores caben en una menos', ({ assert }) => {
    const plan = planBalance(
      [
        { id: 1, players: [1, 2, 3], busy: false },
        { id: 2, players: [4, 5], busy: false },
        { id: 3, players: [6], busy: false },
      ],
      4
    )
    assert.deepEqual(plan.close, [3])
    assert.deepEqual(plan.moves, [{ userId: 6, from: 3, to: 2 }])
  })

  test('balanceo: iguala las mesas (diferencia máxima de 1)', ({ assert }) => {
    const plan = planBalance(
      [
        { id: 1, players: [1, 2, 3, 4, 5], busy: false },
        { id: 2, players: [6, 7], busy: false },
      ],
      5
    )
    assert.deepEqual(plan.close, [])
    assert.deepEqual(plan.moves, [{ userId: 5, from: 1, to: 2 }])
  })

  test('balanceo: no saca jugadores de una mesa en plena mano', ({ assert }) => {
    const plan = planBalance(
      [
        { id: 1, players: [1, 2, 3, 4, 5], busy: true },
        { id: 2, players: [6], busy: false },
      ],
      5
    )
    assert.deepEqual(plan, { moves: [], close: [] })

    // Pero sí puede romper la otra y mandar a sus jugadores a la mesa ocupada
    const merge = planBalance(
      [
        { id: 1, players: [1, 2, 3], busy: true },
        { id: 2, players: [4], busy: false },
      ],
      5
    )
    assert.deepEqual(merge, { moves: [{ userId: 4, from: 2, to: 1 }], close: [2] })
  })
})
