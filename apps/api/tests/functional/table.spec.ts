import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import { randomInt } from 'node:crypto'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import type User from '#models/user'
import Room from '#models/room'
import Hand from '#models/hand'
import HandAction from '#models/hand_action'
import RoomSeat from '#models/room_seat'
import PlayerStat from '#models/player_stat'
import accountService from '#services/game/account_service'
import roomService from '#services/game/room_service'
import tableManager, { TableManager } from '#game/table_manager'
import type { ActionType } from '#game/holdem/engine'

let counter = 0
function createPlayer() {
  return accountService.register({
    email: `mesa${++counter}@pokerlatino.test`,
    password: 'secreto123',
    birthDate: DateTime.fromISO('1990-05-20'),
  })
}

/**
 * Sala "Principiantes" (credits, ciegas 5/10) con N jugadores sentados con 500
 */
async function tableWith(count: number) {
  const room = await Room.findByOrFail('slug', 'credits-principiantes')
  const players: User[] = []
  for (let i = 0; i < count; i++) {
    const player = await createPlayer()
    await roomService.sit(player, room.id, { buyIn: 500, seatNumber: i + 1 })
    players.push(player)
  }
  return { room, players }
}

async function seatStacks(roomId: number) {
  const seats = await RoomSeat.query().where('room_id', roomId).orderBy('seat_number')
  return seats.map((s) => s.stack)
}

test.group('Mesa en vivo', (group) => {
  group.each.setup(() => {
    tableManager.reset()
    return testUtils.db().withGlobalTransaction()
  })

  test('con menos de 2 jugadores no empieza ninguna mano', async ({ assert }) => {
    const { room } = await tableWith(1)
    assert.isNull(await tableManager.startHandIfReady(room.id))
  })

  test('inicia la mano y cada jugador solo ve sus propias cartas', async ({ client, assert }) => {
    const { room, players } = await tableWith(3)
    const hand = await tableManager.startHandIfReady(room.id)
    assert.isNotNull(hand)

    const row = await Hand.query().where('room_id', room.id).preload('players').firstOrFail()
    assert.equal(row.status, 'in_progress')
    assert.lengthOf(row.players, 3)

    const res = await client.get(`/api/v1/rooms/${room.id}/state`).loginAs(players[0])
    res.assertStatus(200)
    const state = (res.body() as any).data
    assert.equal(state.hand.street, 'preflop')
    assert.equal(state.hand.pot, 15)
    assert.equal(state.hand.dealerSeat, 1)
    assert.equal(state.hand.toActSeat, 1)
    assert.lengthOf(state.you.holeCards, 2)
    assert.deepEqual(state.you.legalActions.raise, { min: 20, max: 500 })

    const others = state.seats.filter((s: any) => s.player.id !== players[0].id)
    assert.isTrue(others.every((s: any) => s.holeCards === null))
    assert.notInclude(JSON.stringify(state), players[1].email)
  })

  test('jugar una mano por HTTP guarda el historial, stacks y estadísticas', async ({
    client,
    assert,
  }) => {
    const { room, players } = await tableWith(3)
    await tableManager.startHandIfReady(room.id)
    const act = (user: User, action: ActionType, amount?: number) =>
      client.post(`/api/v1/rooms/${room.id}/actions`).json({ action, amount }).loginAs(user)

    // Botón (1) sube a 30, SB (2) se retira, BB (3) se retira
    const raise = await act(players[0], 'raise', 30)
    raise.assertStatus(200)
    assert.equal((raise.body() as any).data.hand.toActSeat, 2)
    const sbFold = await act(players[1], 'fold')
    sbFold.assertStatus(200)
    const last = await act(players[2], 'fold')
    last.assertStatus(200)

    const state = (last.body() as any).data
    assert.isNull(state.hand)
    assert.equal(state.lastHand.totalPot, 45)
    assert.isFalse(state.lastHand.showdown)
    assert.deepEqual(
      state.lastHand.pots.map((p: any) => p.winners.map((w: any) => [w.seatNumber, w.amount])),
      [[[1, 45]]]
    )

    // Persistencia
    assert.deepEqual(await seatStacks(room.id), [515, 495, 490])
    const handRow = await Hand.query().where('room_id', room.id).firstOrFail()
    assert.equal(handRow.status, 'completed')
    assert.equal(handRow.pot, 45)
    const actions = await HandAction.query().where('hand_id', handRow.id).orderBy('sequence')
    assert.deepEqual(
      actions.map((a) => a.action),
      ['small_blind', 'big_blind', 'raise', 'fold', 'fold']
    )

    const stats = await PlayerStat.query()
      .whereIn(
        'user_id',
        players.map((p) => p.id)
      )
      .where('currency', 'credits')
      .orderBy('user_id')
    assert.deepEqual(
      stats.map((s) => [s.handsPlayed, s.handsWon, s.net]),
      [
        [1, 1, 15],
        [1, 0, -5],
        [1, 0, -10],
      ]
    )

    // Al levantarse, las fichas ganadas vuelven a la billetera
    const leave = await client.delete(`/api/v1/rooms/${room.id}/seat`).loginAs(players[0])
    leave.assertBody({ data: { currency: 'credits', cashedOut: 515 } })
  })

  test('errores: fuera de turno, acción inválida y sin mano en curso', async ({ client }) => {
    const { room, players } = await tableWith(2)
    const act = (user: User, body: object) =>
      client.post(`/api/v1/rooms/${room.id}/actions`).json(body).loginAs(user)

    const noHand = await act(players[0], { action: 'check' })
    noHand.assertStatus(409)
    noHand.assertBodyContains({ error: 'no_hand_in_progress' })

    await tableManager.startHandIfReady(room.id)
    // Heads-up: el botón (asiento 1) habla primero
    const outOfTurn = await act(players[1], { action: 'check' })
    outOfTurn.assertStatus(409)
    outOfTurn.assertBodyContains({ error: 'not_your_turn' })

    const invalid = await act(players[0], { action: 'check' })
    invalid.assertStatus(422)
    invalid.assertBodyContains({ error: 'invalid_action' })

    const badRaise = await act(players[0], { action: 'raise', amount: 12 })
    badRaise.assertStatus(422)

    const outsider = await act(await createPlayer(), { action: 'fold' })
    outsider.assertBodyContains({ error: 'not_in_hand' })
  })

  test('no se puede levantar en medio de una mano', async ({ client }) => {
    const { room, players } = await tableWith(2)
    await tableManager.startHandIfReady(room.id)
    const res = await client.delete(`/api/v1/rooms/${room.id}/seat`).loginAs(players[0])
    res.assertStatus(409)
    res.assertBodyContains({ error: 'hand_in_progress' })
  })

  test('al agotarse el tiempo pasa si puede, si no se retira', async ({ assert }) => {
    const { room, players } = await tableWith(2)
    await tableManager.startHandIfReady(room.id)

    await tableManager.handleTimeout(room.id) // botón/SB debe 5 → se retira
    const state = await tableManager.getState(room.id, players[0].id)
    assert.isNull(state.hand)
    assert.deepEqual(await seatStacks(room.id), [495, 505])
  })

  test('el botón rota entre manos', async ({ assert }) => {
    const { room, players } = await tableWith(3)
    const dealers: number[] = []
    for (let i = 0; i < 4; i++) {
      const hand = (await tableManager.startHandIfReady(room.id))!
      dealers.push(hand.dealerSeat)
      // Todos se retiran hasta que gana la ciega grande
      while (!hand.isComplete) {
        const seat = hand.toActSeat!
        const user = players[seat - 1]
        await tableManager.act(room.id, user.id, { type: 'fold' })
      }
    }
    assert.deepEqual(dealers, [1, 2, 3, 1])
  })

  test('si el servidor se reinicia a mitad de mano, se cancela sin perder fichas', async ({
    client,
    assert,
  }) => {
    const { room, players } = await tableWith(2)
    await tableManager.startHandIfReady(room.id)
    await tableManager.act(room.id, players[0].id, { type: 'raise', amount: 100 })

    tableManager.reset() // simula reinicio: se pierde el estado en memoria
    const cancelled = await tableManager.recoverInterruptedHands()
    assert.equal(cancelled, 1)

    const hand = await Hand.query().where('room_id', room.id).firstOrFail()
    assert.equal(hand.status, 'cancelled')
    assert.deepEqual(await seatStacks(room.id), [500, 500])

    const leave = await client.delete(`/api/v1/rooms/${room.id}/seat`).loginAs(players[0])
    leave.assertStatus(200)
  })

  test('sesión de 50 manos: sin comisión, lo que unos ganan otros lo pierden', async ({
    assert,
  }) => {
    const { room, players } = await tableWith(5)
    const byId = new Map(players.map((p) => [p.id, p]))

    for (let i = 0; i < 50; i++) {
      const hand = await tableManager.startHandIfReady(room.id)
      if (!hand) break // quedó un solo jugador con fichas

      while (!hand.isComplete) {
        const seat = hand.toActSeat!
        const legal = hand.legalActions(seat)!
        const options: { type: ActionType; amount?: number }[] = [{ type: 'fold' }]
        if (legal.check) options.push({ type: 'check' }, { type: 'check' })
        if (legal.call !== null) options.push({ type: 'call' }, { type: 'call' }, { type: 'call' })
        const range = legal.bet ?? legal.raise
        if (range) options.push({ type: legal.bet ? 'bet' : 'raise', amount: range.min })
        if (range && randomInt(10) === 0) options.push({ type: 'all_in' })

        const userId = hand.player(seat).userId
        await tableManager.act(room.id, byId.get(userId)!.id, options[randomInt(options.length)])
      }

      // Las fichas en la mesa se conservan después de cada mano
      const stacks = await seatStacks(room.id)
      assert.equal(
        stacks.reduce((a, b) => a + b, 0),
        2500
      )
    }

    const completed = await Hand.query().where('room_id', room.id).where('status', 'completed')
    assert.isAbove(completed.length, 0)

    // Suma de ganancias netas de todos los jugadores = 0 (rake 0)
    const [{ net }] = await db
      .from('player_stats')
      .whereIn(
        'user_id',
        players.map((p) => p.id)
      )
      .where('currency', 'credits')
      .select(db.raw('COALESCE(SUM(total_won - total_wagered), 0)::bigint as net'))
    assert.equal(Number(net), 0)
  })

  test('con temporizadores reales: arranca sola, vence el turno y sigue la siguiente mano', async ({
    assert,
  }) => {
    const { room } = await tableWith(2)
    room.actionTimeoutSeconds = 1
    await room.save()

    const live = new TableManager({ timersEnabled: true, nextHandDelayMs: 50 })
    try {
      live.scheduleStart(room.id, 0)

      // Nadie actúa: cada mano termina por tiempo agotado y la siguiente empieza sola
      const deadline = Date.now() + 8000
      let completed = 0
      while (Date.now() < deadline && completed < 2) {
        await new Promise((r) => setTimeout(r, 200))
        const hands = await Hand.query().where('room_id', room.id).where('status', 'completed')
        completed = hands.length
      }
      assert.isAtLeast(completed, 2)

      const stacks = await seatStacks(room.id)
      assert.equal(stacks[0] + stacks[1], 1000)
    } finally {
      live.reset()
    }
  }).timeout(15000)
})
