import { test } from '@japa/runner'
import { shuffledDeck } from '#game/holdem/cards'
import { evaluateBest } from '#game/holdem/evaluator'
import { HoldemHand } from '#game/holdem/engine'
import {
  type BotView,
  botView,
  chenScore,
  decide,
  estimateEquity,
  fastScore,
} from '#game/bot/strategy'

/** Generador determinista (mulberry32) para que los tests no dependan del azar */
function seeded(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function view(overrides: Partial<BotView>): BotView {
  return {
    holeCards: ['As', 'Ad'],
    board: [],
    street: 'preflop',
    pot: 30,
    currentBet: 20,
    bigBlind: 20,
    stack: 2000,
    committed: 10,
    legal: {
      fold: true,
      check: false,
      call: 10,
      bet: null,
      raise: { min: 40, max: 2010 },
    },
    opponents: [
      { stack: 1980, committed: 20, allIn: false, preflopRaises: 0, postflopAggression: 0 },
    ],
    inPosition: true,
    unopenedPreflop: true,
    aggressorThisStreet: false,
    ...overrides,
  }
}

test.group('Bot · evaluador rápido', () => {
  test('da el mismo score que evaluateBest con 5, 6 y 7 cartas', ({ assert }) => {
    for (let i = 0; i < 3000; i++) {
      const cards = shuffledDeck().slice(0, 5 + (i % 3))
      assert.equal(fastScore(cards), evaluateBest(cards).score, cards.join(' '))
    }
  })

  test('casos límite: rueda, escalera de color, dos tríos, tres parejas', ({ assert }) => {
    for (const cards of [
      ['As', '2d', '3c', '4h', '5s', 'Kd', 'Kc'],
      ['9h', 'Th', 'Jh', 'Qh', 'Kh', 'Ah', '2c'],
      ['9h', '9d', '9c', 'Kh', 'Kd', 'Kc', '2c'],
      ['9h', '9d', 'Kc', 'Kh', '2d', '2c', 'Ac'],
      ['Ah', '2h', '3h', '4h', '5h', '6d', '7c'],
    ]) {
      assert.equal(fastScore(cards), evaluateBest(cards).score, cards.join(' '))
    }
  })
})

test.group('Bot · equity y fuerza', () => {
  test('fórmula de Chen', ({ assert }) => {
    assert.equal(chenScore(['As', 'Ad']), 20)
    assert.equal(chenScore(['Ks', 'Kd']), 16)
    assert.equal(chenScore(['Ah', 'Kh']), 12)
    assert.equal(chenScore(['7c', '2d']), -1)
    assert.equal(chenScore(['2c', '2d']), 5)
  })

  test('AA contra una mano al azar gana ~85%; 72o ~35%', ({ assert }) => {
    const random = seeded(1)
    const aa = estimateEquity(view({ holeCards: ['As', 'Ad'] }), 3000, random)
    const seven = estimateEquity(view({ holeCards: ['7c', '2d'] }), 3000, random)
    assert.closeTo(aa, 0.85, 0.03)
    assert.closeTo(seven, 0.34, 0.04)
  })

  test('contra un rival que resubió, su equity baja', ({ assert }) => {
    const random = seeded(2)
    const vsRandom = estimateEquity(view({ holeCards: ['Qs', 'Jd'] }), 3000, random)
    const vsRaiser = estimateEquity(
      view({
        holeCards: ['Qs', 'Jd'],
        opponents: [
          { stack: 1800, committed: 200, allIn: false, preflopRaises: 2, postflopAggression: 0 },
        ],
      }),
      3000,
      random
    )
    assert.isBelow(vsRaiser, vsRandom - 0.08)
  })

  test('con escalera hecha en el river la equity es casi 1', ({ assert }) => {
    const equity = estimateEquity(
      view({
        holeCards: ['9s', 'Td'],
        board: ['Jc', 'Qh', 'Ks', '2d', '3c'],
        street: 'river',
      }),
      1000,
      seeded(3)
    )
    assert.isAbove(equity, 0.9)
  })
})

test.group('Bot · decisiones', () => {
  test('nunca tira una mano que puede pasar gratis', ({ assert }) => {
    const random = seeded(4)
    for (let i = 0; i < 50; i++) {
      const action = decide(
        view({
          holeCards: ['7c', '2d'],
          board: ['As', 'Kd', 'Qh'],
          street: 'flop',
          currentBet: 0,
          committed: 0,
          pot: 40,
          legal: { fold: true, check: true, call: null, bet: { min: 20, max: 1980 }, raise: null },
        }),
        { iterations: 200, random }
      )
      assert.notEqual(action.type, 'fold')
    }
  })

  test('con AA preflop sube; con 72o ante una subida grande se retira', ({ assert }) => {
    const random = seeded(5)
    const aa = decide(view({ holeCards: ['As', 'Ad'] }), { iterations: 400, random })
    assert.oneOf(aa.type, ['raise', 'all_in'])

    const seven = decide(
      view({
        holeCards: ['7c', '2d'],
        currentBet: 300,
        pot: 320,
        legal: { fold: true, check: false, call: 290, bet: null, raise: { min: 580, max: 2010 } },
        opponents: [
          { stack: 1700, committed: 300, allIn: false, preflopRaises: 1, postflopAggression: 0 },
        ],
        unopenedPreflop: false,
      }),
      { iterations: 400, random }
    )
    assert.equal(seven.type, 'fold')
  })

  test('paga un all-in con la mejor mano posible (nuts)', ({ assert }) => {
    const action = decide(
      view({
        holeCards: ['Ah', 'Kh'],
        board: ['Qh', 'Jh', 'Th', '2c', '3d'],
        street: 'river',
        currentBet: 2000,
        committed: 0,
        pot: 2100,
        stack: 2000,
        legal: { fold: true, check: false, call: 2000, bet: null, raise: null },
        opponents: [
          { stack: 0, committed: 2000, allIn: true, preflopRaises: 0, postflopAggression: 1 },
        ],
      }),
      { iterations: 300, random: seeded(6) }
    )
    assert.equal(action.type, 'call')
  })

  test('en manos completas entre bots toda acción es legal y las fichas se conservan', ({
    assert,
  }) => {
    const random = seeded(7)
    for (let n = 0; n < 60; n++) {
      const count = 2 + (n % 4)
      const players = Array.from({ length: count }, (_, i) => ({
        seat: i + 1,
        userId: i + 1,
        stack: 200 + Math.floor(random() * 2000),
      }))
      const hand = new HoldemHand({
        players,
        dealerSeat: 1 + (n % count),
        smallBlind: 10,
        bigBlind: 20,
      })
      let guard = 0
      while (!hand.isComplete && guard++ < 200) {
        const seat = hand.toActSeat!
        const action = decide(botView(hand, seat), { iterations: 60, random })
        assert.doesNotThrow(() => hand.applyAction(seat, action), JSON.stringify(action))
      }
      assert.isTrue(hand.isComplete)
      const before = players.reduce((s, p) => s + p.stack, 0)
      const after = hand.players.reduce((s, p) => s + p.stack, 0)
      assert.equal(after, before)
    }
  })

  test('botView no expone las cartas de los rivales', ({ assert }) => {
    const hand = new HoldemHand({
      players: [
        { seat: 1, userId: 1, stack: 1000 },
        { seat: 2, userId: 2, stack: 1000 },
      ],
      dealerSeat: 1,
      smallBlind: 10,
      bigBlind: 20,
    })
    const v = botView(hand, hand.toActSeat!)
    const rival = hand.players.find((p) => p.seat !== hand.toActSeat)!
    const serialized = JSON.stringify(v)
    for (const card of rival.holeCards) assert.notInclude(serialized, `"${card}"`)
  })
})
