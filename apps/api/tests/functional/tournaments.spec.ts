import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import testUtils from '@adonisjs/core/services/test_utils'
import type User from '#models/user'
import Tournament from '#models/tournament'
import TournamentEntry from '#models/tournament_entry'
import Room from '#models/room'
import RoomSeat from '#models/room_seat'
import Hand from '#models/hand'
import PlayerStat from '#models/player_stat'
import WalletTransaction from '#models/wallet_transaction'
import accountService from '#services/game/account_service'
import tournamentService from '#services/game/tournament_service'
import presenceService from '#services/game/presence_service'
import tableManager from '#game/table_manager'
import { balanceWithoutRewards } from '#tests/helpers/wallet'

let counter = 0
function createPlayer() {
  counter++
  return accountService.register({
    username: `torneo${counter}`,
    email: `torneo${counter}@pokerlatino.test`,
    password: 'secreto123',
    birthDate: DateTime.fromISO('1990-05-20'),
  })
}

let slugs = 0
function createTournament(overrides: Partial<Tournament> = {}) {
  slugs++
  return Tournament.create({
    slug: `prueba-${slugs}`,
    name: `Torneo de prueba ${slugs}`,
    buyIn: 100,
    startingStack: 1000,
    smallBlind: 10,
    bigBlind: 20,
    blindsUpEveryHands: 5,
    maxSeats: 3,
    tableCount: 1,
    actionTimeoutSeconds: 15,
    startsAt: DateTime.now().minus({ minutes: 1 }),
    status: 'registering',
    prizePool: 0,
    ...overrides,
  })
}

async function registerMany(tournament: Tournament, count: number) {
  const players: User[] = []
  for (let i = 0; i < count; i++) {
    const p = await createPlayer()
    await tournamentService.register(p, tournament.id)
    players.push(p)
  }
  return players
}

/** Saldo sin recompensas de logros y niveles */
function balance(user: User) {
  return balanceWithoutRewards(user.id)
}
const tables = (tournamentId: number) =>
  Room.query().where('tournament_id', tournamentId).preload('seats').orderBy('table_number')

test.group('Torneos · inscripción', (group) => {
  group.each.setup(() => {
    tableManager.reset()
    return testUtils.db().withGlobalTransaction()
  })

  test('inscribirse cobra la inscripción y aparece en el lobby', async ({ client, assert }) => {
    const tournament = await createTournament({ startsAt: DateTime.now().plus({ hours: 1 }) })
    const user = await createPlayer()

    const res = await client.post(`/api/v1/tournaments/${tournament.id}/entry`).loginAs(user)
    res.assertStatus(201)
    res.assertBodyContains({ data: { entriesCount: 1, you: { status: 'registered' } } })
    assert.equal(await balance(user), 900)
    const tx = await WalletTransaction.query()
      .where('type', 'tournament_entry')
      .where('reference_id', String(tournament.id))
      .firstOrFail()
    assert.equal(tx.amount, -100)

    const again = await client.post(`/api/v1/tournaments/${tournament.id}/entry`).loginAs(user)
    again.assertStatus(409)
    again.assertBodyContains({ error: 'already_registered' })

    const list = await client.get('/api/v1/tournaments').loginAs(user)
    list.assertStatus(200)
    const item = (list.body() as any).data.find((t: any) => t.id === tournament.id)
    assert.containsSubset(item, {
      status: 'registering',
      buyIn: 100,
      capacity: 3,
      entriesCount: 1,
      prizePool: 100,
      you: { status: 'registered', roomId: null },
    })
  })

  test('salirse antes de empezar devuelve la inscripción', async ({ client, assert }) => {
    const tournament = await createTournament({ startsAt: DateTime.now().plus({ hours: 1 }) })
    const user = await createPlayer()
    await tournamentService.register(user, tournament.id)

    const res = await client.delete(`/api/v1/tournaments/${tournament.id}/entry`).loginAs(user)
    res.assertStatus(200)
    res.assertBodyContains({ refunded: 100, data: { entriesCount: 0, you: null } })
    assert.equal(await balance(user), 1000)
  })

  test('sin fichas suficientes no se inscribe y el cupo es el límite', async ({ client }) => {
    const tournament = await createTournament({
      buyIn: 5000,
      startsAt: DateTime.now().plus({ hours: 1 }),
    })
    const poor = await createPlayer()
    const res = await client.post(`/api/v1/tournaments/${tournament.id}/entry`).loginAs(poor)
    res.assertStatus(422)
    res.assertBodyContains({ error: 'insufficient_funds' })

    const small = await createTournament({ startsAt: DateTime.now().plus({ hours: 1 }) })
    await registerMany(small, 3)
    const late = await client.post(`/api/v1/tournaments/${small.id}/entry`).loginAs(poor)
    late.assertStatus(409)
    late.assertBodyContains({ error: 'tournament_full' })
  })

  test('cancelar un torneo devuelve todas las inscripciones', async ({ assert }) => {
    const tournament = await createTournament({ startsAt: DateTime.now().plus({ hours: 1 }) })
    const players = await registerMany(tournament, 2)
    await tournamentService.cancel(tournament.id)
    await tournament.refresh()
    assert.equal(tournament.status, 'cancelled')
    for (const p of players) assert.equal(await balance(p), 1000)
  })
})

test.group('Torneos · inicio', (group) => {
  group.each.setup(() => {
    tableManager.reset()
    return testUtils.db().withGlobalTransaction()
  })

  test('no empieza antes de la hora aunque esté lleno', async ({ assert }) => {
    const tournament = await createTournament({ startsAt: DateTime.now().plus({ hours: 1 }) })
    await registerMany(tournament, 3)
    await tournamentService.tick()
    await tournament.refresh()
    assert.equal(tournament.status, 'registering')

    // Llega la hora
    await tournamentService.tick(DateTime.now().plus({ hours: 2 }))
    await tournament.refresh()
    assert.equal(tournament.status, 'running')
  })

  test('a la hora sin cupo lleno espera; empieza en cuanto se llena', async ({ assert }) => {
    const tournament = await createTournament({ maxSeats: 3, tableCount: 2 })
    const players = await registerMany(tournament, 5)
    await tournamentService.tick()
    await tournament.refresh()
    assert.equal(tournament.status, 'registering')

    players.push(...(await registerMany(tournament, 1)))
    await tournament.refresh()
    assert.equal(tournament.status, 'running')
    assert.equal(tournament.prizePool, 600)

    // Dos mesas de 3, cada jugador con el stack inicial
    const rooms = await tables(tournament.id)
    assert.deepEqual(
      rooms.map((r) => r.seats.length),
      [3, 3]
    )
    assert.isTrue(rooms.every((r) => r.levelId === null && r.bigBlind === 20))
    assert.isTrue(rooms.flatMap((r) => r.seats).every((s) => s.stack === 1000))
    const entries = await TournamentEntry.query().where('tournament_id', tournament.id)
    assert.isTrue(entries.every((e) => e.status === 'playing'))

    // Las mesas de torneo no salen en las salas normales
    const rooms2 = await Room.query().whereNull('tournament_id')
    assert.isFalse(rooms2.some((r) => r.tournamentId))
  })

  test('en una mesa de torneo no se entra ni se sale a mano', async ({ client }) => {
    const tournament = await createTournament()
    const [player] = await registerMany(tournament, 3)
    const [room] = await tables(tournament.id)
    const outsider = await createPlayer()

    const sit = await client
      .post(`/api/v1/rooms/${room.id}/seat`)
      .json({ buyIn: 1000 })
      .loginAs(outsider)
    sit.assertStatus(409)
    sit.assertBodyContains({ error: 'tournament_table' })

    const leave = await client.delete(`/api/v1/rooms/${room.id}/seat`).loginAs(player)
    leave.assertStatus(409)
    leave.assertBodyContains({ error: 'tournament_table' })
  })

  test('quien se desconecta en torneo sigue sentado', async ({ assert }) => {
    const tournament = await createTournament()
    await registerMany(tournament, 3)
    presenceService.reset()
    const now = Date.now()
    await presenceService.sweep(now)
    assert.lengthOf(await presenceService.sweep(now + 10 * 60_000), 0)
    const [room] = await tables(tournament.id)
    assert.lengthOf(room.seats, 3)
  })
})

test.group('Torneos · juego', (group) => {
  group.each.setup(() => {
    tableManager.reset()
    return testUtils.db().withGlobalTransaction()
  })

  test('las ciegas se duplican cada N manos de la mesa', async ({ assert }) => {
    const tournament = await createTournament({ blindsUpEveryHands: 2 })
    const players = await registerMany(tournament, 3)
    const [room] = await tables(tournament.id)

    const blinds: string[] = []
    for (let i = 0; i < 5; i++) {
      const hand = (await tableManager.startHandIfReady(room.id))!
      blinds.push(`${hand.smallBlind}/${hand.bigBlind}`)
      // Todos se retiran hasta que gana la ciega grande
      while (!hand.isComplete) {
        await tableManager.act(room.id, hand.player(hand.toActSeat!).userId, { type: 'fold' })
      }
    }
    assert.deepEqual(blinds, ['10/20', '10/20', '20/40', '20/40', '40/80'])

    // La mesa informa el nivel y cuándo suben
    const state = await tableManager.getState(room.id, players[0].id)
    assert.containsSubset(state.tournament, {
      id: tournament.id,
      level: 3,
      handsToNextLevel: 1,
      nextSmallBlind: 80,
      nextBigBlind: 160,
      playersLeft: 3,
      yourRoomId: room.id,
      yourResult: null,
    })
    assert.equal(state.room.bigBlind, 80)
  })

  test('mano a mano hasta el final: eliminado, campeón y premio', async ({ assert }) => {
    const tournament = await createTournament({ maxSeats: 2 })
    const players = await registerMany(tournament, 2)
    const [room] = await tables(tournament.id)

    // Todo o nada hasta que alguien se quede sin fichas (un empate repite la mano)
    for (let i = 0; i < 30; i++) {
      await tournament.refresh()
      if (tournament.status === 'finished') break
      const hand = (await tableManager.startHandIfReady(room.id))!
      while (!hand.isComplete) {
        const seat = hand.toActSeat!
        const legal = hand.legalActions(seat)!
        await tableManager.act(room.id, hand.player(seat).userId, {
          type: legal.call || legal.raise ? 'all_in' : 'check',
        })
      }
    }
    await tournament.refresh()
    assert.equal(tournament.status, 'finished')

    const entries = await TournamentEntry.query()
      .where('tournament_id', tournament.id)
      .orderBy('finish_position')
    assert.deepEqual(
      entries.map((e) => [e.status, e.finishPosition, e.prize]),
      [
        ['winner', 1, 200],
        ['eliminated', 2, 0],
      ]
    )
    const winner = players.find((p) => p.id === entries[0].userId)!
    assert.equal(await balance(winner), 900 + 200)
    await room.refresh()
    assert.equal(room.status, 'closed')
    assert.isNull(await RoomSeat.query().where('room_id', room.id).first())

    // Las fichas de torneo no cuentan en las estadísticas
    const hands = await Hand.query().where('room_id', room.id)
    assert.isAbove(hands.length, 0)
    const stat = await PlayerStat.findByOrFail('user_id', winner.id)
    assert.equal(stat.handsPlayed, 0)

    const state = await tableManager.getState(room.id, entries[1].userId)
    assert.containsSubset(state.tournament, {
      status: 'finished',
      yourRoomId: null,
      yourResult: { status: 'eliminated', position: 2, prize: 0 },
    })
  })

  test('eliminaciones: puestos, balanceo y mesa final', async ({ client, assert }) => {
    const tournament = await createTournament({ maxSeats: 3, tableCount: 2 })
    await registerMany(tournament, 6)
    let [t1, t2] = await tables(tournament.id)

    // Caen dos de la mesa 2 (queda mejor quien empezó la última mano con más fichas)
    await RoomSeat.query()
      .whereIn(
        'id',
        t2.seats.slice(0, 2).map((s) => s.id)
      )
      .update({ stack: 0 })
    await tournamentService.maintain(tournament.id)

    let eliminated = await TournamentEntry.query()
      .where('tournament_id', tournament.id)
      .where('status', 'eliminated')
    assert.sameMembers(
      eliminated.map((e) => e.finishPosition),
      [5, 6]
    )
    // 3 en la mesa 1 y 1 en la mesa 2: se equilibra a 2 y 2
    ;[t1, t2] = await tables(tournament.id)
    assert.deepEqual([t1.seats.length, t2.seats.length], [2, 2])

    // Cae otro: 3 jugadores caben en una mesa → se rompe una y queda la mesa final
    await RoomSeat.query().where('id', t2.seats[0].id).update({ stack: 0 })
    await tournamentService.maintain(tournament.id)
    const rooms = await tables(tournament.id)
    const open = rooms.filter((r) => r.status === 'active')
    assert.lengthOf(open, 1)
    assert.lengthOf(open[0].seats, 3)
    assert.isTrue(open[0].seats.every((s) => s.stack === 1000))

    // Clasificación: 3 jugando (por fichas) y los eliminados por puesto
    const someone = await createPlayer()
    const res = await client.get(`/api/v1/tournaments/${tournament.id}`).loginAs(someone)
    res.assertStatus(200)
    const data = (res.body() as any).data
    assert.equal(data.playersLeft, 3)
    assert.deepEqual(
      data.standings.map((s: any) => [s.status, s.position]),
      [
        ['playing', 1],
        ['playing', 2],
        ['playing', 3],
        ['eliminated', 4],
        ['eliminated', 5],
        ['eliminated', 6],
      ]
    )
    // 6 inscritos: cobran 1.º y 2.º (65/35 de 600)
    assert.deepEqual(data.payouts, [
      { position: 1, amount: 390 },
      { position: 2, amount: 210 },
    ])
    eliminated = await TournamentEntry.query()
      .where('tournament_id', tournament.id)
      .where('status', 'eliminated')
    assert.isTrue(eliminated.every((e) => e.prize === 0))
  })

  test('no se mueve a nadie de una mesa con mano en curso', async ({ assert }) => {
    const tournament = await createTournament({ maxSeats: 3, tableCount: 2 })
    await registerMany(tournament, 6)
    const [t1, t2] = await tables(tournament.id)
    await tableManager.startHandIfReady(t1.id) // mesa 1 jugando

    await RoomSeat.query()
      .whereIn(
        'id',
        t2.seats.slice(0, 2).map((s) => s.id)
      )
      .update({ stack: 0 })
    await tournamentService.maintain(tournament.id)

    // La mesa 2 quedó con 1 y la mesa 1 está en mano: todavía no se equilibra
    const [a, b] = await tables(tournament.id)
    assert.deepEqual([a.seats.length, b.seats.length], [3, 1])
  })
})
