import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import type User from '#models/user'
import Room from '#models/room'
import RoomLevel from '#models/room_level'
import RoomSeat from '#models/room_seat'
import Wallet from '#models/wallet'
import accountService from '#services/game/account_service'
import roomService, { pickTable } from '#services/game/room_service'
import tableManager from '#game/table_manager'
import gameConfig from '#config/game'

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

const level = () => RoomLevel.findByOrFail('slug', 'principiantes')

async function tablesOf(levelId: number) {
  const rooms = await Room.query()
    .where('level_id', levelId)
    .where('status', 'active')
    .withCount('seats', (q) => q.as('seatedCount'))
    .orderBy('table_number')
  return rooms.map((r) => ({ table: r.tableNumber, seated: Number(r.$extras.seatedCount) }))
}

/** Sienta `count` jugadores nuevos con "Jugar" en el nivel */
async function quickSeatMany(levelId: number, count: number) {
  const players: User[] = []
  for (let i = 0; i < count; i++) {
    const player = await createPlayer()
    await roomService.quickSeat(player, levelId, { buyIn: 400 })
    players.push(player)
  }
  return players
}

test.group('Niveles · mesas automáticas', (group) => {
  group.each.setup(() => {
    tableManager.reset()
    return testUtils.db().withGlobalTransaction()
  })

  test('GET /levels lista los niveles con sus mesas', async ({ client, assert }) => {
    const user = await createPlayer()
    const res = await client.get('/api/v1/levels').loginAs(user)
    res.assertStatus(200)
    const levels = (res.body() as any).data
    assert.deepEqual(
      levels.map((l: any) => l.slug),
      ['principiantes', 'clasica', 'high-rollers']
    )
    assert.containsSubset(levels[0], {
      name: 'Principiantes',
      smallBlind: 5,
      bigBlind: 10,
      minBuyIn: 400,
      maxBuyIn: 1000,
      maxSeats: 5,
      playerCount: 0,
      tables: [{ tableNumber: 1, name: 'Principiantes · Mesa 1', seatedCount: 0, maxSeats: 5 }],
    })
  })

  test('cuando el nivel se llena se abre otra mesa', async ({ assert }) => {
    const { id } = await level()

    await quickSeatMany(id, 3)
    assert.deepEqual(await tablesOf(id), [{ table: 1, seated: 3 }])

    // Con 4 sentados queda 1 asiento libre (< 2): se abre la Mesa 2
    await quickSeatMany(id, 1)
    assert.deepEqual(await tablesOf(id), [
      { table: 1, seated: 4 },
      { table: 2, seated: 0 },
    ])

    // "Jugar" completa primero la mesa con más jugadores
    await quickSeatMany(id, 1)
    assert.deepEqual(await tablesOf(id), [
      { table: 1, seated: 5 },
      { table: 2, seated: 0 },
    ])

    await quickSeatMany(id, 4)
    assert.deepEqual(await tablesOf(id), [
      { table: 1, seated: 5 },
      { table: 2, seated: 4 },
      { table: 3, seated: 0 },
    ])

    const third = await Room.findByOrFail('slug', 'principiantes-3')
    assert.equal(third.name, 'Principiantes · Mesa 3')
    assert.equal(third.bigBlind, 10)
    assert.equal(third.minBuyIn, 400)
  })

  test('"Jugar" prefiere la mesa donde alguien espera solo', async ({ assert }) => {
    const { id } = await level()
    await quickSeatMany(id, 4) // Mesa 1 con 4, Mesa 2 vacía

    // Alguien elige la Mesa 2 a mano y queda esperando rival
    const table2 = await Room.findByOrFail('slug', 'principiantes-2')
    await roomService.sit(await createPlayer(), table2.id, { buyIn: 400 })

    await quickSeatMany(id, 1)
    const tables = await tablesOf(id)
    assert.deepEqual(tables.slice(0, 2), [
      { table: 1, seated: 4 },
      { table: 2, seated: 2 },
    ])
  })

  test('POST /levels/:id/seat sienta y cobra una sola vez', async ({ client, assert }) => {
    const user = await createPlayer()
    const { id } = await level()

    const res = await client.post(`/api/v1/levels/${id}/seat`).json({ buyIn: 500 }).loginAs(user)
    res.assertStatus(201)
    const table1 = await Room.findByOrFail('slug', 'principiantes-1')
    res.assertBodyContains({
      data: {
        roomId: table1.id,
        alreadySeated: false,
        seat: { stack: 500, player: { id: user.id } },
      },
    })

    // Si ya está en una mesa del nivel, lo lleva a esa mesa sin cobrar
    const again = await client.post(`/api/v1/levels/${id}/seat`).json({ buyIn: 500 }).loginAs(user)
    again.assertStatus(200)
    again.assertBodyContains({ data: { roomId: table1.id, alreadySeated: true } })
    const wallet = await Wallet.findByOrFail('user_id', user.id)
    assert.equal(wallet.balance, 500)

    const badBuyIn = await client
      .post(`/api/v1/levels/${id}/seat`)
      .json({ buyIn: 50 })
      .loginAs(await createPlayer())
    badBuyIn.assertStatus(422)
    badBuyIn.assertBodyContains({ error: 'invalid_buy_in' })

    const missing = await client
      .post('/api/v1/levels/999999/seat')
      .json({ buyIn: 500 })
      .loginAs(user)
    missing.assertStatus(404)
    missing.assertBodyContains({ error: 'level_not_found' })
  })

  test('sentarse en una mesa elegida también abre mesas', async ({ assert }) => {
    const { id } = await level()
    const table1 = await Room.findByOrFail('slug', 'principiantes-1')
    for (let i = 0; i < 4; i++) {
      await roomService.sit(await createPlayer(), table1.id, { buyIn: 400 })
    }
    assert.lengthOf(await tablesOf(id), 2)
  })

  test('las mesas extra vacías se cierran después de un rato y se reutilizan', async ({
    assert,
  }) => {
    const { id } = await level()
    const players = await quickSeatMany(id, 9) // Mesas 1 (5), 2 (4) y 3 (0)
    assert.lengthOf(await tablesOf(id), 3)

    // Se vacía la Mesa 2
    const table2 = await Room.findByOrFail('slug', 'principiantes-2')
    const atTable2 = await RoomSeat.query().where('room_id', table2.id)
    for (const seat of atTable2) {
      const user = players.find((p) => p.id === seat.userId)!
      await roomService.leave(user, table2.id)
    }
    await table2.refresh()
    assert.isNotNull(table2.emptySince)

    // Recién vaciadas: no se cierran todavía
    assert.deepEqual(await roomService.closeIdleTables(), [])

    // Pasado el tiempo se cierra la de número más alto; la otra queda para tener 2+ asientos libres
    const later = DateTime.now().plus({
      minutes: gameConfig.rooms.autoTables.closeEmptyAfterMinutes + 1,
    })
    const closed = await roomService.closeIdleTables(later)
    const table3 = await Room.findByOrFail('slug', 'principiantes-3')
    assert.deepEqual(closed, [table3.id])
    assert.deepEqual(await tablesOf(id), [
      { table: 1, seated: 5 },
      { table: 2, seated: 0 },
    ])

    // Si hace falta otra mesa, se reabre la Mesa 3 en vez de crear la 4
    await roomService.sit(await createPlayer(), table2.id, { buyIn: 400 })
    await roomService.sit(await createPlayer(), table2.id, { buyIn: 400 })
    await roomService.sit(await createPlayer(), table2.id, { buyIn: 400 })
    await roomService.sit(await createPlayer(), table2.id, { buyIn: 400 })
    assert.deepEqual(await tablesOf(id), [
      { table: 1, seated: 5 },
      { table: 2, seated: 4 },
      { table: 3, seated: 0 },
    ])
    assert.lengthOf(await Room.query().where('level_id', id), 3)
  })

  test('la Mesa 1 nunca se cierra y hay un límite de mesas por nivel', async ({ assert }) => {
    const { id } = await level()
    const later = DateTime.now().plus({ days: 1 })
    assert.deepEqual(await roomService.closeIdleTables(later), [])
    assert.lengthOf(await tablesOf(id), 1)

    // Aunque "falten" asientos, nunca pasa del límite de mesas
    const autoTables = gameConfig.rooms.autoTables
    const original = autoTables.minFreeSeats
    autoTables.minFreeSeats = 10_000
    try {
      const lvl = await level()
      await db.transaction((trx) => roomService.ensureCapacity(trx, lvl))
    } finally {
      autoTables.minFreeSeats = original
    }
    assert.lengthOf(await tablesOf(id), autoTables.maxTablesPerLevel)
  })

  test('pickTable: espera solo > más llena > número más bajo; null si todas llenas', ({
    assert,
  }) => {
    const table = (tableNumber: number, seated: number) => {
      const room = new Room()
      room.merge({ tableNumber, maxSeats: 5 })
      room.$extras.seatedCount = seated
      return room
    }
    assert.equal(pickTable([table(1, 3), table(2, 1), table(3, 0)])!.tableNumber, 2)
    assert.equal(pickTable([table(1, 3), table(2, 4), table(3, 0)])!.tableNumber, 2)
    assert.equal(pickTable([table(1, 0), table(2, 0)])!.tableNumber, 1)
    assert.equal(pickTable([table(1, 5), table(2, 0)])!.tableNumber, 2)
    assert.isUndefined(pickTable([table(1, 5), table(2, 5)]))
  })
})

/**
 * Sin transacción global: bloqueos reales entre conexiones
 */
test.group('Niveles · concurrencia', () => {
  test('10 "Jugar" simultáneos: nadie queda en una mesa llena ni dos veces', async ({ assert }) => {
    const { id } = await level()
    const players = await Promise.all(Array.from({ length: 10 }, () => createPlayer()))
    try {
      const results = await Promise.allSettled(
        players.map((p) => roomService.quickSeat(p, id, { buyIn: 400 }))
      )
      assert.isTrue(results.every((r) => r.status === 'fulfilled'))

      const tables = await tablesOf(id)
      assert.equal(
        tables.reduce((sum, t) => sum + t.seated, 0),
        10
      )
      assert.isTrue(tables.every((t) => t.seated <= 5))
      // Siempre quedan al menos 2 asientos libres en el nivel
      const free = tables.reduce((sum, t) => sum + 5 - t.seated, 0)
      assert.isAtLeast(free, gameConfig.rooms.autoTables.minFreeSeats)
    } finally {
      await RoomSeat.query()
        .whereIn(
          'user_id',
          players.map((p) => p.id)
        )
        .delete()
      await Promise.all(players.map((p) => p.delete()))
      await Room.query().where('level_id', id).where('table_number', '>', 1).delete()
      await Room.query().where('level_id', id).update({ empty_since: new Date() })
    }
  })
})
