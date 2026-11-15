import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import testUtils from '@adonisjs/core/services/test_utils'
import Wallet from '#models/wallet'
import Room from '#models/room'
import PlayerProgress from '#models/player_progress'
import UserAchievement from '#models/user_achievement'
import WalletTransaction from '#models/wallet_transaction'
import type User from '#models/user'
import accountService from '#services/game/account_service'
import progressService from '#services/game/progress_service'
import socialService from '#services/game/social_service'
import roomService from '#services/game/room_service'
import tableManager from '#game/table_manager'
import { HandCategory } from '#game/holdem/evaluator'

let counter = 0
function createPlayer() {
  counter++
  return accountService.register({
    username: `nivel${counter}`,
    email: `nivel${counter}@pokerlatino.test`,
    password: 'secreto123',
    birthDate: DateTime.fromISO('1990-05-20'),
  })
}

async function balance(user: User) {
  const wallet = await Wallet.findByOrFail('user_id', user.id)
  return wallet.balance
}

async function keys(user: User) {
  const rows = await UserAchievement.query().where('user_id', user.id).orderBy('achievement_key')
  return rows.map((r) => r.achievementKey)
}

const body = (res: { body(): unknown }) => (res.body() as any).data

const lose = { won: false, amountWon: 0, allIn: false, winningCategory: null }

test.group('Experiencia y logros', (group) => {
  group.each.setup(() => {
    progressService.reset()
    tableManager.reset()
    socialService.reset()
    return testUtils.db().withGlobalTransaction()
  })

  test('jugar y ganar da XP, logros y sus fichas', async ({ assert }) => {
    const user = await createPlayer()
    const before = await balance(user)

    await progressService.recordHand(user.id, lose)
    assert.deepEqual(await keys(user), ['first_hand'])

    await progressService.recordHand(user.id, {
      won: true,
      amountWon: 1500,
      allIn: true,
      winningCategory: HandCategory.Flush,
    })
    assert.sameMembers(await keys(user), [
      'first_hand',
      'first_win',
      'all_in_win',
      'pot_1000',
      'win_flush',
    ])

    const progress = await PlayerProgress.findByOrFail('user_id', user.id)
    assert.equal(progress.hands, 2)
    assert.equal(progress.wins, 1)
    assert.equal(progress.winStreak, 1)
    // 2 + 5 por las manos, 50+50+100+100+100 por los logros = 407 → nivel 3 (300)
    assert.equal(Number(progress.xp), 407)
    assert.equal(progress.level, 3)

    // Logros: 50+50+150+150+100 = 500; niveles 2 y 3: 200+300 = 500
    assert.equal((await balance(user)) - before, 1000)
    const wallet = await Wallet.findByOrFail('user_id', user.id)
    const types = await WalletTransaction.query()
      .where('wallet_id', wallet.id)
      .whereIn('type', ['achievement_reward', 'level_reward'])
    assert.lengthOf(types, 7)
  })

  test('rachas de victorias', async ({ assert }) => {
    const user = await createPlayer()
    const win = { won: true, amountWon: 10, allIn: false, winningCategory: null }
    await progressService.recordHand(user.id, win)
    await progressService.recordHand(user.id, win)
    await progressService.recordHand(user.id, lose)
    await progressService.recordHand(user.id, win)
    let progress = await PlayerProgress.findByOrFail('user_id', user.id)
    assert.equal(progress.bestWinStreak, 2)
    assert.notInclude(await keys(user), 'streak_3')

    await progressService.recordHand(user.id, win)
    await progressService.recordHand(user.id, win)
    progress = await PlayerProgress.findByOrFail('user_id', user.id)
    assert.equal(progress.bestWinStreak, 3)
    assert.include(await keys(user), 'streak_3')
  })

  test('el buzón anuncia logros y nivel una sola vez', async ({ client, assert }) => {
    const user = await createPlayer()
    await progressService.recordHand(user.id, {
      won: true,
      amountWon: 2000,
      allIn: false,
      winningCategory: null,
    })

    const inbox = body(await client.get('/api/v1/inbox').loginAs(user))
    assert.equal(inbox.progress.level, 2)
    assert.deepEqual(inbox.progress.levelUp, { from: 1, to: 2, chips: 200 })
    assert.sameMembers(
      inbox.progress.achievements.map((a: any) => a.key),
      ['first_hand', 'first_win', 'pot_1000']
    )

    const seen = await client.post('/api/v1/me/progress/seen').loginAs(user)
    seen.assertStatus(204)
    const after = body(await client.get('/api/v1/inbox').loginAs(user))
    assert.isNull(after.progress.levelUp)
    assert.lengthOf(after.progress.achievements, 0)
  })

  test('mi progreso trae el avance hacia cada logro', async ({ client, assert }) => {
    const user = await createPlayer()
    await progressService.recordHand(user.id, lose)

    const res = await client.get('/api/v1/me/progress').loginAs(user)
    res.assertStatus(200)
    const data = body(res)
    assert.containsSubset(data, {
      level: 1,
      xp: 52,
      levelXp: 0,
      nextLevelXp: 100,
      unlockedCount: 1,
    })
    const hands100 = data.achievements.find((a: any) => a.key === 'hands_100')
    assert.deepEqual(hands100.progress, { current: 1, target: 100, done: false })
    assert.isNull(hands100.unlockedAt)
    assert.isNotNull(data.achievements.find((a: any) => a.key === 'first_hand').unlockedAt)
  })

  test('tarjeta pública de otro jugador', async ({ client, assert }) => {
    const me = await createPlayer()
    const other = await createPlayer()
    await progressService.recordHand(other.id, lose)

    const res = await client.get(`/api/v1/players/${other.id}`).loginAs(me)
    res.assertStatus(200)
    const data = body(res)
    assert.containsSubset(data, {
      player: { id: other.id, displayName: other.username },
      relation: { status: 'none' },
      level: 1,
      unlockedCount: 1,
      stats: { hands: 1, wins: 0 },
    })
    assert.notProperty(data.player, 'email')
    // El avance de cada logro solo lo ve su dueño
    assert.isNull(data.achievements[0].progress)

    const missing = await client.get('/api/v1/players/999999').loginAs(me)
    missing.assertStatus(404)
  })

  test('hacer un amigo desbloquea "Buena compañía" para los dos', async ({ assert }) => {
    const ana = await createPlayer()
    const beto = await createPlayer()
    const { requestId } = await socialService.request(ana, beto.id)
    await socialService.accept(beto, requestId!)
    assert.include(await keys(ana), 'first_friend')
    assert.include(await keys(beto), 'first_friend')
  })

  test('el nivel sale junto al jugador en la mesa', async ({ client, assert }) => {
    const user = await createPlayer()
    await progressService.recordHand(user.id, {
      won: true,
      amountWon: 2000,
      allIn: false,
      winningCategory: null,
    })
    const room = await Room.findByOrFail('slug', 'principiantes-1')
    await roomService.sit(user, room.id, { buyIn: 1000, seatNumber: 1 })

    const state = body(await client.get(`/api/v1/rooms/${room.id}/state`).loginAs(user))
    assert.equal(state.seats[0].player.level, 2) // 5 + 50 + 50 + 100 = 205 XP
  })

  test('las cuentas anteriores se ponen al día con su historial', async ({ assert }) => {
    const user = await createPlayer()
    // Como las dejó la migración: manos del historial sin repasar
    await PlayerProgress.query()
      .where('user_id', user.id)
      .update({ hands: 150, wins: 60, xp: 480, synced_at: null })
    const before = await balance(user)

    await progressService.syncPending()

    assert.sameMembers(await keys(user), ['first_hand', 'hands_100', 'first_win', 'wins_50'])
    const progress = await PlayerProgress.findByOrFail('user_id', user.id)
    assert.isNotNull(progress.syncedAt)
    // 480 + 50 + 150 + 50 + 200 = 930 → nivel 4 (600)
    assert.equal(progress.level, 4)
    // Logros 50+200+50+300 = 600; niveles 2,3,4 = 900
    assert.equal((await balance(user)) - before, 1500)
    // Volver a repasar no paga dos veces
    await progressService.evaluate(user.id)
    assert.equal((await balance(user)) - before, 1500)
  })
})
