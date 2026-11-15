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
import Wallet from '#models/wallet'
import WalletTransaction from '#models/wallet_transaction'
import accountService from '#services/game/account_service'
import roomService from '#services/game/room_service'
import tableManager, { TableManager } from '#game/table_manager'
import type { ActionType } from '#game/holdem/engine'

let counter = 0
function createPlayer() {
  counter++
  return accountService.register({
    username: `mesa${counter}`,
    email: `mesa${counter}@pokerlatino.test`,
    password: 'secreto123',
    birthDate: DateTime.fromISO('1990-05-20'),
  })
}

/**
 * Sala "Principiantes" (ciegas 5/10) con N jugadores sentados con 500
 */
async function tableWith(count: number) {
  const room = await Room.findByOrFail('slug', 'principiantes-1')
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
    leave.assertBody({ data: { cashedOut: 515, pending: false } })
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

  test('levantarse en su turno: se retira al instante y cobra al terminar la mano', async ({
    client,
    assert,
  }) => {
    const { room, players } = await tableWith(3)
    await tableManager.startHandIfReady(room.id) // botón (1) habla primero

    const res = await client.delete(`/api/v1/rooms/${room.id}/seat`).loginAs(players[0])
    res.assertStatus(202)
    res.assertBody({ data: { cashedOut: 0, pending: true } })

    // Ya se retiró y el turno pasó a la ciega pequeña
    const state = await tableManager.getState(room.id, players[1].id)
    const leaver = state.seats.find((s) => s.player.id === players[0].id)!
    assert.isTrue(leaver.folded)
    assert.isTrue(leaver.leaving)
    assert.equal(state.hand!.toActSeat, 2)

    await tableManager.act(room.id, players[1].id, { type: 'fold' }) // gana la ciega grande
    assert.deepEqual(await seatStacks(room.id), [495, 505])
    assert.isNull(await RoomSeat.query().where('user_id', players[0].id).first())
    const wallet = await Wallet.query().where('user_id', players[0].id).firstOrFail()
    assert.equal(wallet.balance, 1000) // 500 en billetera + 500 que no llegó a apostar
  })

  test('levantarse fuera de turno: se retira cuando le toca, sin esperar su tiempo', async ({
    client,
    assert,
  }) => {
    const { room, players } = await tableWith(3)
    await tableManager.startHandIfReady(room.id)

    const res = await client.delete(`/api/v1/rooms/${room.id}/seat`).loginAs(players[2]) // ciega grande
    res.assertStatus(202)
    let state = await tableManager.getState(room.id, players[2].id)
    assert.isFalse(state.seats[2].folded)

    await tableManager.act(room.id, players[0].id, { type: 'raise', amount: 30 })
    await tableManager.act(room.id, players[1].id, { type: 'fold' })
    // Le tocaba a la ciega grande: se retiró sola y la mano terminó
    state = await tableManager.getState(room.id, players[0].id)
    assert.isNull(state.hand)
    assert.deepEqual(await seatStacks(room.id), [515, 495])
    const cashOut = await WalletTransaction.query()
      .whereIn('wallet_id', Wallet.query().select('id').where('user_id', players[2].id))
      .where('type', 'cash_out')
      .firstOrFail()
    assert.equal(cashOut.amount, 490)
  })

  test('si pidió levantarse justo al cerrar la mano, no recibe cartas en la siguiente', async ({
    assert,
  }) => {
    const { room, players } = await tableWith(3)
    await RoomSeat.query().where('user_id', players[1].id).update({ leave_after_hand: true })

    const hand = await tableManager.startHandIfReady(room.id)
    assert.lengthOf(hand!.players, 2)
    assert.notInclude(
      hand!.players.map((p) => p.userId),
      players[1].id
    )
    assert.isNull(await RoomSeat.query().where('user_id', players[1].id).first())
  })

  test('quien se queda sin fichas se levanta al empezar la siguiente mano', async ({ assert }) => {
    const { room, players } = await tableWith(3)
    await RoomSeat.query().where('user_id', players[1].id).update({ stack: 0 })

    // Durante la pausa sigue sentado (se ve el resultado con sus cartas)
    let state = await tableManager.getState(room.id, players[0].id)
    assert.lengthOf(state.seats, 3)

    const hand = await tableManager.startHandIfReady(room.id)
    assert.lengthOf(hand!.players, 2)
    assert.isNull(await RoomSeat.query().where('user_id', players[1].id).first())
    state = await tableManager.getState(room.id, players[0].id)
    assert.lengthOf(state.seats, 2)
  })

  test('sin fichas y solo: también se levanta aunque no haya mano', async ({ assert }) => {
    const { room, players } = await tableWith(2)
    await RoomSeat.query().where('user_id', players[1].id).update({ stack: 0 })
    assert.isNull(await tableManager.startHandIfReady(room.id))
    assert.isNull(await RoomSeat.query().where('user_id', players[1].id).first())
    assert.isNotNull(await RoomSeat.query().where('user_id', players[0].id).first())
  })

  test('tras reiniciar el servidor se levanta a quien quedó sin fichas', async ({ assert }) => {
    const { players } = await tableWith(2)
    await RoomSeat.query().where('user_id', players[0].id).update({ stack: 0 })
    await tableManager.recoverInterruptedHands()
    assert.isNull(await RoomSeat.query().where('user_id', players[0].id).first())
  })

  test('sin mano en curso se levanta al instante', async ({ client }) => {
    const { room, players } = await tableWith(2)
    const res = await client.delete(`/api/v1/rooms/${room.id}/seat`).loginAs(players[0])
    res.assertStatus(200)
    res.assertBody({ data: { cashedOut: 500, pending: false } })
  })

  test('inactividad: tras 2 manos seguidas sin actuar se le levanta de la mesa', async ({
    assert,
  }) => {
    const { room, players } = await tableWith(3)
    const idle = players[2]

    /** Juega una mano: el inactivo deja correr su tiempo, los demás pasan/igualan */
    async function playHand() {
      const hand = (await tableManager.startHandIfReady(room.id))!
      while (!hand.isComplete) {
        const seat = hand.toActSeat!
        const userId = hand.player(seat).userId
        if (userId === idle.id) {
          await tableManager.handleTimeout(room.id)
        } else {
          const legal = hand.legalActions(seat)!
          await tableManager.act(room.id, userId, { type: legal.check ? 'check' : 'call' })
        }
      }
    }

    await playHand()
    const seat = await RoomSeat.query().where('user_id', idle.id).firstOrFail()
    assert.equal(seat.missedHands, 1)
    const active = await RoomSeat.query().where('user_id', players[0].id).firstOrFail()
    assert.equal(active.missedHands, 0)

    await playHand()
    assert.isNull(await RoomSeat.query().where('user_id', idle.id).first())
    const cashOut = await WalletTransaction.query()
      .whereIn('wallet_id', Wallet.query().select('id').where('user_id', idle.id))
      .where('type', 'cash_out')
      .firstOrFail()
    assert.include(cashOut.description!, 'inactividad')
    assert.isAbove(cashOut.amount, 0)

    // Los demás siguen jugando
    const next = await tableManager.startHandIfReady(room.id)
    assert.lengthOf(next!.players, 2)
  })

  test('inactividad: actuar reinicia el contador', async ({ assert }) => {
    const { room, players } = await tableWith(2)
    await RoomSeat.query().where('user_id', players[0].id).update({ missed_hands: 1 })

    await tableManager.startHandIfReady(room.id)
    await tableManager.act(room.id, players[0].id, { type: 'fold' }) // botón/SB se retira
    const seat = await RoomSeat.query().where('user_id', players[0].id).firstOrFail()
    assert.equal(seat.missedHands, 0)
  })

  test('las salas dan 15 segundos por turno', async ({ client, assert }) => {
    const res = await client.get('/api/v1/rooms').loginAs(await createPlayer())
    const rooms = (res.body() as any).data
    assert.isAbove(rooms.length, 0)
    assert.isTrue(rooms.every((r: any) => r.actionTimeoutSeconds === 15))
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
