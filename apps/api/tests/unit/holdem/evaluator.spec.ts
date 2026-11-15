import { test } from '@japa/runner'
import { evaluateBest, evaluateFive, HandCategory } from '#game/holdem/evaluator'
import { createDeck, shuffle } from '#game/holdem/cards'

const ev = (cards: string) => evaluateBest(cards.split(' '))

test.group('Holdem · evaluador de manos', () => {
  test('reconoce cada categoría', ({ assert }) => {
    const cases: [string, HandCategory][] = [
      ['As Ks Qs Js Ts', HandCategory.StraightFlush],
      ['9h 9d 9s 9c 2d', HandCategory.FourOfAKind],
      ['Kh Kd Ks 3c 3d', HandCategory.FullHouse],
      ['2h 7h 9h Jh Ah', HandCategory.Flush],
      ['5c 6d 7h 8s 9c', HandCategory.Straight],
      ['Qc Qd Qh 4s 2c', HandCategory.ThreeOfAKind],
      ['Jc Jd 4h 4s Ac', HandCategory.TwoPair],
      ['Tc Td 4h 7s Ac', HandCategory.Pair],
      ['2c 5d 9h Js Kc', HandCategory.HighCard],
    ]
    for (const [cards, category] of cases) {
      assert.equal(ev(cards).category, category, cards)
    }
  })

  test('el orden de categorías es correcto', ({ assert }) => {
    const ordered = [
      '2c 5d 9h Js Kc',
      'Tc Td 4h 7s Ac',
      'Jc Jd 4h 4s Ac',
      'Qc Qd Qh 4s 2c',
      '5c 6d 7h 8s 9c',
      '2h 7h 9h Jh Ah',
      'Kh Kd Ks 3c 3d',
      '9h 9d 9s 9c 2d',
      'As Ks Qs Js Ts',
    ].map((c) => ev(c).score)
    for (let i = 1; i < ordered.length; i++) assert.isAbove(ordered[i], ordered[i - 1])
  })

  test('la rueda A-2-3-4-5 es la escalera más baja', ({ assert }) => {
    const wheel = ev('Ac 2d 3h 4s 5c')
    assert.equal(wheel.category, HandCategory.Straight)
    assert.isBelow(wheel.score, ev('2c 3d 4h 5s 6c').score)
    assert.equal(ev('Ah 2h 3h 4h 5h').category, HandCategory.StraightFlush)
    // A-K-Q-J-T no es "vuelta": Q-K-A-2-3 no es escalera
    assert.equal(ev('Qc Kd Ah 2s 3c').category, HandCategory.HighCard)
  })

  test('desempata por kickers', ({ assert }) => {
    assert.isAbove(ev('Ac Ad Kh 7s 2c').score, ev('Ah As Qh 7d 2d').score)
    assert.isAbove(ev('Jc Jd 4h 4s Ac').score, ev('Jh Js 4c 4d Kc').score)
    assert.isAbove(ev('Jc Jd 5h 5s 2c').score, ev('Jh Js 4c 4d Ac').score)
    assert.isAbove(ev('Kh Kd Ks 3c 3d').score, ev('Qh Qd Qs Ac Ad').score)
    assert.isAbove(ev('2h 7h 9h Jh Ah').score, ev('2d 7d 9d Td Ad').score)
  })

  test('manos idénticas en valor empatan aunque cambien los palos', ({ assert }) => {
    assert.equal(ev('Ac Kd Qh Js 9c').score, ev('Ad Kh Qs Jc 9d').score)
  })

  test('elige la mejor combinación de 7 cartas', ({ assert }) => {
    // Escalera y color disponibles: gana el color
    const flushOverStraight = ev('4h 5c 6h 7h 8d 9h Kh')
    assert.equal(flushOverStraight.category, HandCategory.Flush)
    assert.sameMembers(flushOverStraight.cards, ['4h', '6h', '7h', '9h', 'Kh'])

    // Dos tríos: full con el trío más alto
    const full = ev('Kh Kd Ks 3c 3d 3h 2c')
    assert.equal(full.category, HandCategory.FullHouse)
    assert.equal(full.score, ev('Kh Kd Ks 3c 3d').score)

    // Tres parejas: doble pareja con el mejor kicker posible
    assert.equal(ev('Ah Ad Kc Ks Qh Qd 2c').score, ev('Ah Ad Kc Ks Qh').score)
  })

  test('evaluateFive y evaluateBest coinciden con 5 cartas aleatorias', ({ assert }) => {
    for (let i = 0; i < 500; i++) {
      const hand = shuffle(createDeck()).slice(0, 5)
      assert.equal(evaluateBest(hand).score, evaluateFive(hand).score)
    }
  })
})
