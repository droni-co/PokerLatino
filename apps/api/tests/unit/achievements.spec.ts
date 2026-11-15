import { test } from '@japa/runner'
import {
  ACHIEVEMENTS,
  type ProgressMetrics,
  achievementProgress,
  levelForXp,
  levelProgress,
  newlyUnlocked,
  xpForLevel,
} from '#game/achievements'
import { HandCategory } from '#game/holdem/evaluator'

const empty: ProgressMetrics = {
  hands: 0,
  wins: 0,
  bestWinStreak: 0,
  biggestPot: 0,
  allInWins: 0,
  winCategories: 0,
  tournamentsPlayed: 0,
  tournamentsCashed: 0,
  tournamentsWon: 0,
  friends: 0,
  referrals: 0,
}

test.group('Niveles', () => {
  test('curva de experiencia', ({ assert }) => {
    assert.deepEqual([1, 2, 3, 4, 5, 10].map(xpForLevel), [0, 100, 300, 600, 1000, 4500])
    assert.equal(levelForXp(0), 1)
    assert.equal(levelForXp(99), 1)
    assert.equal(levelForXp(100), 2)
    assert.equal(levelForXp(299), 2)
    assert.equal(levelForXp(300), 3)
    assert.equal(levelForXp(4500), 10)
    assert.equal(levelForXp(4499), 9)
    // Sin saltos ni retrocesos en un rango amplio
    for (let level = 1; level < 300; level++) {
      assert.equal(levelForXp(xpForLevel(level)), level)
      assert.equal(levelForXp(xpForLevel(level + 1) - 1), level)
    }
    assert.deepEqual(levelProgress(350), { level: 3, xp: 350, levelXp: 300, nextLevelXp: 600 })
  })
})

test.group('Logros', () => {
  test('claves únicas', ({ assert }) => {
    assert.equal(new Set(ACHIEVEMENTS.map((a) => a.key)).size, ACHIEVEMENTS.length)
  })

  test('se desbloquean al llegar al umbral', ({ assert }) => {
    const keys = (m: Partial<ProgressMetrics>, owned: string[] = []) =>
      newlyUnlocked({ ...empty, ...m }, new Set(owned)).map((a) => a.key)

    assert.deepEqual(keys({}), [])
    assert.deepEqual(keys({ hands: 1 }), ['first_hand'])
    assert.includeMembers(keys({ hands: 120, wins: 1 }), ['first_hand', 'hands_100', 'first_win'])
    assert.deepEqual(keys({ hands: 120 }, ['first_hand', 'hands_100']), [])
    assert.deepEqual(keys({ winCategories: 1 << HandCategory.FullHouse }), ['win_full_house'])
    assert.deepEqual(keys({ tournamentsWon: 1 }), ['tournament_win'])
  })

  test('avance hacia un logro', ({ assert }) => {
    const hands100 = ACHIEVEMENTS.find((a) => a.key === 'hands_100')!
    assert.deepEqual(achievementProgress(hands100, { ...empty, hands: 40 }), {
      current: 40,
      target: 100,
      done: false,
    })
    assert.deepEqual(achievementProgress(hands100, { ...empty, hands: 250 }), {
      current: 100,
      target: 100,
      done: true,
    })
  })
})
