import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import testUtils from '@adonisjs/core/services/test_utils'
import type User from '#models/user'
import Room from '#models/room'
import RoomSeat from '#models/room_seat'
import Wallet from '#models/wallet'
import WalletTransaction from '#models/wallet_transaction'
import accountService from '#services/game/account_service'
import roomService from '#services/game/room_service'
import presenceService from '#services/game/presence_service'
import tableManager from '#game/table_manager'
import gameConfig from '#config/game'

const TIMEOUT_MS = gameConfig.table.disconnectTimeoutSeconds * 1000

let counter = 0
function createPlayer() {
  counter++
  return accountService.register({
    username: `presente${counter}`,
    email: `presente${counter}@pokerlatino.test`,
    password: 'secreto123',
    birthDate: DateTime.fromISO('1990-05-20'),
  })
}

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

test.group('Presencia en la mesa', (group) => {
  group.each.setup(() => {
    tableManager.reset()
    presenceService.reset()
    return testUtils.db().withGlobalTransaction()
  })

  test('quien deja de consultar la mesa se levanta y recupera sus fichas', async ({
    client,
    assert,
  }) => {
    const { room, players } = await tableWith(2)
    const [gone, here] = players
    const t0 = Date.now()

    // Ambos consultan la mesa; después solo uno sigue haciéndolo
    for (const p of players) {
      await client.get(`/api/v1/rooms/${room.id}/state`).loginAs(p)
    }
    presenceService.touch(room.id, here.id, t0 + TIMEOUT_MS)

    assert.lengthOf(await presenceService.sweep(t0 + TIMEOUT_MS - 1000), 0)
    const absent = await presenceService.sweep(t0 + TIMEOUT_MS + 1000)
    assert.deepEqual(absent, [{ roomId: room.id, userId: gone.id }])

    assert.isNull(await RoomSeat.query().where('user_id', gone.id).first())
    assert.isNotNull(await RoomSeat.query().where('user_id', here.id).first())
    const wallet = await Wallet.query().where('user_id', gone.id).firstOrFail()
    assert.equal(wallet.balance, 1000)
    const cashOut = await WalletTransaction.query()
      .where('wallet_id', wallet.id)
      .where('type', 'cash_out')
      .firstOrFail()
    assert.include(cashOut.description!, 'desconexión')
  })

  test('sin registro (p. ej. tras reiniciar el servidor) tiene el margen completo', async ({
    assert,
  }) => {
    const { players } = await tableWith(1)
    const t0 = Date.now()

    assert.lengthOf(await presenceService.sweep(t0), 0) // empieza a contar
    assert.lengthOf(await presenceService.sweep(t0 + TIMEOUT_MS - 1), 0)
    assert.lengthOf(await presenceService.sweep(t0 + TIMEOUT_MS), 1)
    assert.isNull(await RoomSeat.query().where('user_id', players[0].id).first())
  })

  test('desconectado en plena mano: se retira y se levanta al terminarla', async ({ assert }) => {
    const { room, players } = await tableWith(3)
    await tableManager.startHandIfReady(room.id) // el botón (asiento 1) habla primero
    const t0 = Date.now()
    for (const p of players) presenceService.touch(room.id, p.id, t0)
    presenceService.touch(room.id, players[1].id, t0 + TIMEOUT_MS)
    presenceService.touch(room.id, players[2].id, t0 + TIMEOUT_MS)

    const absent = await presenceService.sweep(t0 + TIMEOUT_MS)
    assert.deepEqual(absent, [{ roomId: room.id, userId: players[0].id }])

    // Se retiró en su turno y queda marcado para levantarse
    const state = await tableManager.getState(room.id, players[1].id)
    const leaver = state.seats.find((s) => s.player.id === players[0].id)!
    assert.isTrue(leaver.folded)
    assert.isTrue(leaver.leaving)

    // Un nuevo barrido no lo vuelve a procesar (ya está marcado para levantarse)
    presenceService.touch(room.id, players[1].id, t0 + 2 * TIMEOUT_MS)
    presenceService.touch(room.id, players[2].id, t0 + 2 * TIMEOUT_MS)
    assert.lengthOf(await presenceService.sweep(t0 + 2 * TIMEOUT_MS), 0)
  })

  test('levantarse por su cuenta sigue funcionando y lo olvida', async ({ client, assert }) => {
    const { room, players } = await tableWith(2)
    const res = await client.delete(`/api/v1/rooms/${room.id}/seat`).loginAs(players[0])
    res.assertStatus(200)
    res.assertBody({ data: { cashedOut: 500, pending: false } })

    const absent = await presenceService.sweep(Date.now() + 10 * TIMEOUT_MS)
    assert.notDeepInclude(absent, { roomId: room.id, userId: players[0].id })
  })
})
