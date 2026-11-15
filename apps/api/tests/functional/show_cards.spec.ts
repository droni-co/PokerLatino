import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import testUtils from '@adonisjs/core/services/test_utils'
import type User from '#models/user'
import Room from '#models/room'
import accountService from '#services/game/account_service'
import roomService from '#services/game/room_service'
import tableManager, { TableManager } from '#game/table_manager'

let counter = 0
function createPlayer() {
  counter++
  return accountService.register({
    username: `ensena${counter}`,
    email: `ensena${counter}@pokerlatino.test`,
    password: 'secreto123',
    birthDate: DateTime.fromISO('1990-05-20'),
  })
}

const table1 = () => Room.findByOrFail('slug', 'principiantes-1')

async function seat(room: Room, count: number, firstSeat = 1) {
  const players: User[] = []
  for (let i = 0; i < count; i++) {
    const p = await createPlayer()
    await roomService.sit(p, room.id, { buyIn: 500, seatNumber: firstSeat + i })
    players.push(p)
  }
  return players
}

/** Dos jugadores sentados y una mano repartida */
async function headsUp() {
  const room = await table1()
  const players: User[] = []
  for (let i = 0; i < 2; i++) {
    const p = await createPlayer()
    await roomService.sit(p, room.id, { buyIn: 500, seatNumber: i + 1 })
    players.push(p)
  }
  await tableManager.startHandIfReady(room.id)
  const bySeat = (n: number) => players[n - 1]
  const toAct = async () => {
    const s = await tableManager.getState(room.id, players[0].id)
    return s.hand!.toActSeat!
  }
  return { room, players, bySeat, toAct }
}

test.group('Mesa · enseñar cartas', (group) => {
  group.each.setup(() => {
    tableManager.reset()
    return testUtils.db().withGlobalTransaction()
  })

  test('quien gana sin showdown puede enseñar sus cartas', async ({ client, assert }) => {
    const { room, bySeat, toAct } = await headsUp()

    // Preflop: iguala y pasa; en el flop uno apuesta y el otro se retira
    await tableManager.act(room.id, bySeat(await toAct()).id, { type: 'call' })
    await tableManager.act(room.id, bySeat(await toAct()).id, { type: 'check' })
    const bettor = bySeat(await toAct())
    await tableManager.act(room.id, bettor.id, { type: 'bet', amount: 20 })
    const folder = bySeat(await toAct())
    await tableManager.act(room.id, folder.id, { type: 'fold' })

    // Nadie ve las cartas del ganador... salvo él
    let seen = await tableManager.getState(room.id, folder.id)
    const winnerRow = () => seen.lastHand!.players.find((p) => p.playerId === bettor.id)!
    assert.isFalse(seen.lastHand!.showdown)
    assert.isNull(winnerRow().holeCards)
    assert.isTrue(seen.lastHand!.canShow) // el que se retiró también puede enseñarlas
    assert.lengthOf(seen.lastHand!.yourCards!, 2)

    const mine = await tableManager.getState(room.id, bettor.id)
    assert.isTrue(mine.lastHand!.canShow)
    const cards = mine.lastHand!.yourCards!

    const res = await client.post(`/api/v1/rooms/${room.id}/show`).json({}).loginAs(bettor)
    res.assertStatus(200)
    assert.isFalse((res.body() as any).data.lastHand.canShow)

    seen = await tableManager.getState(room.id, folder.id)
    assert.deepEqual(winnerRow().holeCards, cards)
    assert.isTrue(winnerRow().shown)
    assert.isString(winnerRow().handName) // con flop en la mesa ya forma una jugada
    assert.isNull(winnerRow().bestCards)

    // Un espectador no puede
    const outsider = await createPlayer()
    const nope = await client.post(`/api/v1/rooms/${room.id}/show`).json({}).loginAs(outsider)
    nope.assertStatus(409)
    nope.assertBodyContains({ error: 'not_in_hand' })
  })

  test('no se puede enseñar con una mano en curso ni si ya hubo showdown', async ({
    client,
    assert,
  }) => {
    const { room, players, bySeat, toAct } = await headsUp()

    const during = await client.post(`/api/v1/rooms/${room.id}/show`).json({}).loginAs(players[0])
    during.assertStatus(409)
    during.assertBodyContains({ error: 'cannot_show' })

    await tableManager.act(room.id, bySeat(await toAct()).id, { type: 'all_in' })
    await tableManager.act(room.id, bySeat(await toAct()).id, { type: 'call' })

    const state = await tableManager.getState(room.id, players[0].id)
    assert.isTrue(state.lastHand!.showdown)
    assert.isFalse(state.lastHand!.canShow)
    const again = await client.post(`/api/v1/rooms/${room.id}/show`).json({}).loginAs(players[0])
    again.assertStatus(409)
    again.assertBodyContains({ error: 'cannot_show' })
  })

  test('la pausa entre manos se anuncia y sentarse no la acorta', async ({ assert }) => {
    const room = await table1()
    const manager = new TableManager({ timersEnabled: true, nextHandDelayMs: 60_000 })
    try {
      const [p] = await seat(room, 2)
      manager.scheduleStart(room.id)
      manager.scheduleStart(room.id, 3000) // alguien se sienta durante la pausa
      const state = await manager.getState(room.id, p.id)
      assert.isNull(state.hand)
      const seconds = DateTime.fromISO(state.nextHandAt!).diffNow().as('seconds')
      assert.isAbove(seconds, 55)
      assert.closeTo(state.nextHandInMs!, 60_000, 5000)
    } finally {
      manager.reset()
    }
  })

  test('con un solo jugador no hay cuenta atrás: espera a los demás', async ({ assert }) => {
    const room = await table1()
    const manager = new TableManager({ timersEnabled: true, nextHandDelayMs: 60_000 })
    try {
      const [alone] = await seat(room, 1)
      manager.scheduleStart(room.id, 3000)
      let state = await manager.getState(room.id, alone.id)
      assert.isNull(state.nextHandAt)
      assert.isNull(state.nextHandInMs)

      // Llega el segundo: ya se anuncia la mano
      await seat(room, 1, 2)
      state = await manager.getState(room.id, alone.id)
      assert.isNotNull(state.nextHandAt)
    } finally {
      manager.reset()
    }
  })

  test('quien entra a una mesa que se vació no ve el resultado de otra partida', async ({
    assert,
  }) => {
    const { room, players, bySeat, toAct } = await headsUp()
    await tableManager.act(room.id, bySeat(await toAct()).id, { type: 'fold' })
    const before = await tableManager.getState(room.id, players[0].id)
    assert.isNotNull(before.lastHand)

    for (const p of players) await roomService.leave(p, room.id)
    const [newcomer] = await seat(room, 1)
    const state = await tableManager.getState(room.id, newcomer.id)
    assert.isNull(state.lastHand)
    assert.isNull(state.nextHandAt)
  })

  test('si el rival se va, el ganador ve el resultado y la mesa queda esperando', async ({
    assert,
  }) => {
    const { room, bySeat, toAct } = await headsUp()
    const folder = bySeat(await toAct())
    const winner = bySeat(folder === bySeat(1) ? 2 : 1)
    await tableManager.act(room.id, folder.id, { type: 'fold' })
    await roomService.leave(folder, room.id)

    // Recién terminada la mano, quien la jugó todavía ve el resultado
    const state = await tableManager.getState(room.id, winner.id)
    assert.isNotNull(state.lastHand)
    assert.isNull(state.nextHandAt)

    // Quien llega a mirar la mesa no lo ve
    const spectator = await createPlayer()
    const seen = await tableManager.getState(room.id, spectator.id)
    assert.isNull(seen.lastHand)
  })
})
