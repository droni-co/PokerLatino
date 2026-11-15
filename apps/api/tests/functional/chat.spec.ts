import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import testUtils from '@adonisjs/core/services/test_utils'
import type User from '#models/user'
import Room from '#models/room'
import ChatMessage from '#models/chat_message'
import accountService from '#services/game/account_service'
import roomService from '#services/game/room_service'
import chatService, { cleanBody } from '#services/game/chat_service'
import tableManager from '#game/table_manager'
import gameConfig from '#config/game'

let counter = 0
function createPlayer() {
  counter++
  return accountService.register({
    username: `charla${counter}`,
    email: `charla${counter}@pokerlatino.test`,
    password: 'secreto123',
    birthDate: DateTime.fromISO('1990-05-20'),
  })
}

const table1 = () => Room.findByOrFail('slug', 'principiantes-1')

test.group('Mesa · chat', (group) => {
  group.each.setup(() => {
    tableManager.reset()
    return testUtils.db().withGlobalTransaction()
  })

  test('enviar y leer mensajes (también espectadores)', async ({ client, assert }) => {
    const room = await table1()
    const [ana, beto] = [await createPlayer(), await createPlayer()]
    await roomService.sit(ana, room.id, { buyIn: 500 })

    const sent = await client
      .post(`/api/v1/rooms/${room.id}/chat`)
      .json({ body: '  ¡Hola   mesa!  ' })
      .loginAs(ana)
    sent.assertStatus(201)
    sent.assertBodyContains({
      data: { playerId: ana.id, displayName: ana.username, body: '¡Hola mesa!' },
    })
    assert.notInclude(JSON.stringify(sent.body()), ana.email)

    // Beto no está sentado: puede mirar y escribir
    const reply = await client
      .post(`/api/v1/rooms/${room.id}/chat`)
      .json({ body: 'Buena suerte' })
      .loginAs(beto)
    reply.assertStatus(201)

    const history = await client.get(`/api/v1/rooms/${room.id}/chat`).loginAs(beto)
    history.assertStatus(200)
    const messages = (history.body() as any).data
    assert.deepEqual(
      messages.map((m: any) => m.body),
      ['¡Hola mesa!', 'Buena suerte']
    )

    const after = await client
      .get(`/api/v1/rooms/${room.id}/chat`)
      .qs({ after: messages[0].id })
      .loginAs(beto)
    assert.deepEqual(
      (after.body() as any).data.map((m: any) => m.body),
      ['Buena suerte']
    )
  })

  test('el estado de la mesa trae los mensajes nuevos', async ({ client, assert }) => {
    const room = await table1()
    const ana = await createPlayer()
    const first = await chatService.send(ana, room.id, 'uno')
    await chatService.send(ana, room.id, 'dos')

    const all = await client.get(`/api/v1/rooms/${room.id}/state`).loginAs(ana)
    assert.deepEqual(
      (all.body() as any).data.chat.map((m: any) => m.body),
      ['uno', 'dos']
    )

    const newer = await client
      .get(`/api/v1/rooms/${room.id}/state`)
      .qs({ chatAfter: first.id })
      .loginAs(ana)
    assert.deepEqual(
      (newer.body() as any).data.chat.map((m: any) => m.body),
      ['dos']
    )
  })

  test('valida el mensaje y frena el spam', async ({ client, assert }) => {
    const room = await table1()
    const ana = await createPlayer()
    const send = (body: unknown) =>
      client.post(`/api/v1/rooms/${room.id}/chat`).json({ body }).loginAs(ana)

    for (const bad of ['', 'x'.repeat(201), '\u200B\u200B']) {
      const res = await send(bad)
      res.assertStatus(422)
    }

    for (let i = 0; i < gameConfig.chat.burstLimit; i++) {
      const res = await send(`m${i}`)
      res.assertStatus(201)
    }
    const spam = await send('uno más')
    spam.assertStatus(429)
    spam.assertBodyContains({ error: 'chat_rate_limited' })

    const missing = await client
      .post('/api/v1/rooms/999999/chat')
      .json({ body: 'hola' })
      .loginAs(ana)
    missing.assertStatus(404)
    assert.lengthOf(await ChatMessage.query().where('user_id', ana.id), 5)
  })

  test('limpia caracteres de control y borra mensajes viejos', async ({ assert }) => {
    assert.equal(cleanBody('a\nb\t\u0000c\u202Ed'), 'a b c d')

    const room = await table1()
    const ana = await createPlayer()
    await chatService.send(ana, room.id, 'viejo')
    const later = DateTime.now().plus({ days: gameConfig.chat.retentionDays, minutes: 1 })
    assert.equal(await chatService.prune(later), 1)
    assert.lengthOf(await chatService.list(room.id), 0)
  })
})

test.group('Mesa · cartas ganadoras', (group) => {
  group.each.setup(() => {
    tableManager.reset()
    return testUtils.db().withGlobalTransaction()
  })

  test('el showdown publica las 5 cartas de la mejor mano', async ({ client, assert }) => {
    const room = await table1()
    const players: User[] = []
    for (let i = 0; i < 2; i++) {
      const p = await createPlayer()
      await roomService.sit(p, room.id, { buyIn: 500, seatNumber: i + 1 })
      players.push(p)
    }
    await tableManager.startHandIfReady(room.id)

    // Heads-up: los dos van all-in y se reparte el tablero completo
    let state: any
    for (let i = 0; i < 2; i++) {
      const current = await tableManager.getState(room.id, players[0].id)
      const toAct = current.hand!.toActSeat!
      const res = await client
        .post(`/api/v1/rooms/${room.id}/actions`)
        .json({ action: i === 0 ? 'all_in' : 'call' })
        .loginAs(players[toAct - 1])
      res.assertStatus(200)
      state = (res.body() as any).data
    }

    const last = state.lastHand
    assert.isTrue(last.showdown)
    assert.lengthOf(last.board, 5)
    for (const p of last.players) {
      assert.lengthOf(p.bestCards, 5)
      const available = [...p.holeCards, ...last.board]
      assert.isTrue(p.bestCards.every((c: string) => available.includes(c)))
    }
  })
})
