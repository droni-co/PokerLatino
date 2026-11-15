import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import testUtils from '@adonisjs/core/services/test_utils'
import type User from '#models/user'
import Room from '#models/room'
import Friendship from '#models/friendship'
import TableInvitation from '#models/table_invitation'
import accountService from '#services/game/account_service'
import roomService from '#services/game/room_service'
import socialService from '#services/game/social_service'
import tableManager from '#game/table_manager'

let counter = 0
function createPlayer(username?: string) {
  counter++
  return accountService.register({
    username: username ?? `social${counter}`,
    email: `social${counter}@pokerlatino.test`,
    password: 'secreto123',
    birthDate: DateTime.fromISO('1990-05-20'),
  })
}

async function makeFriends(a: User, b: User) {
  await Friendship.create({
    requesterId: a.id,
    addresseeId: b.id,
    status: 'accepted',
    acceptedAt: DateTime.now(),
  })
}

async function pendingInvitations(user: User) {
  const inbox = await socialService.inbox(user)
  return inbox.invitations
}

const body = (res: { body(): unknown }) => (res.body() as any).data

test.group('Amigos', (group) => {
  group.each.setup(() => {
    socialService.reset()
    return testUtils.db().withGlobalTransaction()
  })

  test('buscar jugadores por nombre con la relación de cada uno', async ({ client, assert }) => {
    const me = await createPlayer('pepe_busca')
    await createPlayer('lupita_01')
    const lupe = await createPlayer('lupita_02')
    await createPlayer('otro_nombre')
    await Friendship.create({ requesterId: lupe.id, addresseeId: me.id, status: 'pending' })

    const res = await client.get('/api/v1/players').qs({ q: 'LUPITA' }).loginAs(me)
    res.assertStatus(200)
    const found = body(res)
    assert.deepEqual(
      found.map((r: any) => [r.player.displayName, r.relation]),
      [
        ['lupita_01', 'none'],
        ['lupita_02', 'incoming'],
      ]
    )
    assert.notProperty(found[0].player, 'email')

    // Los comodines de LIKE se buscan como texto
    const wild = await client.get('/api/v1/players').qs({ q: '%%' }).loginAs(me)
    assert.lengthOf(body(wild), 0)

    const short = await client.get('/api/v1/players').qs({ q: 'l' }).loginAs(me)
    short.assertStatus(422)
  })

  test('enviar, aceptar y eliminar', async ({ client, assert }) => {
    const ana = await createPlayer()
    const beto = await createPlayer()

    const sent = await client
      .post('/api/v1/friends/requests')
      .json({ playerId: beto.id })
      .loginAs(ana)
    sent.assertStatus(201)
    assert.equal(body(sent).relation, 'outgoing')

    const again = await client
      .post('/api/v1/friends/requests')
      .json({ playerId: beto.id })
      .loginAs(ana)
    again.assertStatus(409)
    assert.equal((again.body() as any).error, 'friend_request_exists')

    let list = body(await client.get('/api/v1/friends').loginAs(beto))
    assert.lengthOf(list.incoming, 1)
    assert.equal(list.incoming[0].player.id, ana.id)
    assert.lengthOf(body(await client.get('/api/v1/friends').loginAs(ana)).outgoing, 1)

    const inbox = body(await client.get('/api/v1/inbox').loginAs(beto))
    assert.equal(inbox.friendRequests, 1)

    // Solo el destinatario puede aceptarla
    const notMine = await client
      .post(`/api/v1/friends/requests/${list.incoming[0].id}/accept`)
      .loginAs(ana)
    notMine.assertStatus(404)

    const ok = await client
      .post(`/api/v1/friends/requests/${list.incoming[0].id}/accept`)
      .loginAs(beto)
    ok.assertStatus(200)

    list = body(await client.get('/api/v1/friends').loginAs(ana))
    assert.lengthOf(list.friends, 1)
    assert.containsSubset(list.friends[0], { player: { id: beto.id }, online: true, table: null })
    assert.lengthOf(list.outgoing, 0)

    const dupe = await client
      .post('/api/v1/friends/requests')
      .json({ playerId: ana.id })
      .loginAs(beto)
    assert.equal((dupe.body() as any).error, 'already_friends')

    const removed = await client.delete(`/api/v1/friends/${ana.id}`).loginAs(beto)
    removed.assertStatus(204)
    assert.lengthOf(body(await client.get('/api/v1/friends').loginAs(ana)).friends, 0)
  })

  test('si los dos se envían solicitud, quedan como amigos', async ({ client, assert }) => {
    const ana = await createPlayer()
    const beto = await createPlayer()
    await client.post('/api/v1/friends/requests').json({ playerId: beto.id }).loginAs(ana)
    const back = await client
      .post('/api/v1/friends/requests')
      .json({ playerId: ana.id })
      .loginAs(beto)
    back.assertStatus(201)
    assert.equal(body(back).relation, 'friend')
    assert.isTrue(await socialService.areFriends(ana.id, beto.id))
    assert.equal(
      await Friendship.query()
        .count('* as n')
        .then((r) => Number(r[0].$extras.n)),
      1
    )
  })

  test('rechazar y cancelar borran la solicitud', async ({ client, assert }) => {
    const ana = await createPlayer()
    const beto = await createPlayer()
    const sent = await client
      .post('/api/v1/friends/requests')
      .json({ playerId: beto.id })
      .loginAs(ana)

    const stranger = await createPlayer()
    const notYours = await client
      .delete(`/api/v1/friends/requests/${body(sent).requestId}`)
      .loginAs(stranger)
    notYours.assertStatus(404)

    const declined = await client
      .delete(`/api/v1/friends/requests/${body(sent).requestId}`)
      .loginAs(beto)
    declined.assertStatus(204)
    assert.isNull(await Friendship.find(body(sent).requestId))

    // Se puede volver a pedir más tarde
    const retry = await client
      .post('/api/v1/friends/requests')
      .json({ playerId: beto.id })
      .loginAs(ana)
    retry.assertStatus(201)
  })

  test('no puedes enviarte una solicitud ni pedirla a quien no existe', async ({ client }) => {
    const ana = await createPlayer()
    const self = await client
      .post('/api/v1/friends/requests')
      .json({ playerId: ana.id })
      .loginAs(ana)
    self.assertStatus(422)
    const ghost = await client
      .post('/api/v1/friends/requests')
      .json({ playerId: 999999 })
      .loginAs(ana)
    ghost.assertStatus(404)
  })
})

test.group('Invitaciones a la mesa', (group) => {
  group.each.setup(() => {
    tableManager.reset()
    socialService.reset()
    return testUtils.db().withGlobalTransaction()
  })

  test('invitar a un amigo: le llega al buzón y al aceptar va a la mesa', async ({
    client,
    assert,
  }) => {
    const ana = await createPlayer()
    const beto = await createPlayer()
    await makeFriends(ana, beto)
    const room = await Room.findByOrFail('slug', 'principiantes-1')
    await roomService.sit(ana, room.id, { buyIn: 500, seatNumber: 1 })

    // La lista de amigos muestra en qué mesa está
    const friendsOfBeto = body(await client.get('/api/v1/friends').loginAs(beto))
    assert.containsSubset(friendsOfBeto.friends[0], {
      table: { roomId: room.id, freeSeats: room.maxSeats - 1 },
    })

    const sent = await client
      .post(`/api/v1/rooms/${room.id}/invitations`)
      .json({ playerId: beto.id })
      .loginAs(ana)
    sent.assertStatus(201)

    const again = await client
      .post(`/api/v1/rooms/${room.id}/invitations`)
      .json({ playerId: beto.id })
      .loginAs(ana)
    assert.equal((again.body() as any).error, 'already_invited')

    const forRoom = body(await client.get('/api/v1/friends').qs({ roomId: room.id }).loginAs(ana))
    assert.isTrue(forRoom.friends[0].invitedHere)

    const inbox = body(await client.get('/api/v1/inbox').loginAs(beto))
    assert.lengthOf(inbox.invitations, 1)
    assert.containsSubset(inbox.invitations[0], {
      from: { id: ana.id },
      room: { id: room.id, freeSeats: room.maxSeats - 1 },
    })

    const accepted = await client
      .post(`/api/v1/invitations/${inbox.invitations[0].id}/accept`)
      .loginAs(beto)
    accepted.assertStatus(200)
    assert.deepEqual(body(accepted), { roomId: room.id })
    assert.lengthOf(body(await client.get('/api/v1/inbox').loginAs(beto)).invitations, 0)
  })

  test('solo a amigos, sentado en la mesa y con asientos libres', async ({ client, assert }) => {
    const ana = await createPlayer()
    const beto = await createPlayer()
    const room = await Room.findByOrFail('slug', 'principiantes-1')

    const notSeated = await client
      .post(`/api/v1/rooms/${room.id}/invitations`)
      .json({ playerId: beto.id })
      .loginAs(ana)
    assert.equal((notSeated.body() as any).error, 'not_seated')

    await roomService.sit(ana, room.id, { buyIn: 500, seatNumber: 1 })
    const stranger = await client
      .post(`/api/v1/rooms/${room.id}/invitations`)
      .json({ playerId: beto.id })
      .loginAs(ana)
    assert.equal((stranger.body() as any).error, 'not_friends')

    await makeFriends(ana, beto)
    // Llenar la mesa
    for (let seat = 2; seat <= room.maxSeats; seat++) {
      await roomService.sit(await createPlayer(), room.id, { buyIn: 500, seatNumber: seat })
    }
    const full = await client
      .post(`/api/v1/rooms/${room.id}/invitations`)
      .json({ playerId: beto.id })
      .loginAs(ana)
    assert.equal((full.body() as any).error, 'room_full')
  })

  test('la invitación desaparece si la mesa se llena o caduca, y se puede rechazar', async ({
    client,
    assert,
  }) => {
    const ana = await createPlayer()
    const beto = await createPlayer()
    await makeFriends(ana, beto)
    const room = await Room.findByOrFail('slug', 'principiantes-1')
    await roomService.sit(ana, room.id, { buyIn: 500, seatNumber: 1 })
    const invitation = await socialService.invite(ana, room.id, beto.id)

    // Caducada
    await TableInvitation.query()
      .where('id', invitation.id)
      .update({ expiresAt: DateTime.now().minus({ minutes: 1 }).toSQL() })
    assert.lengthOf(await pendingInvitations(beto), 0)
    const late = await client.post(`/api/v1/invitations/${invitation.id}/accept`).loginAs(beto)
    assert.equal((late.body() as any).error, 'invitation_expired')

    // Otra, rechazada
    const second = await socialService.invite(ana, room.id, beto.id)
    const declined = await client.delete(`/api/v1/invitations/${second.id}`).loginAs(beto)
    declined.assertStatus(204)
    assert.lengthOf(await pendingInvitations(beto), 0)

    // Otra, y la mesa se llena
    await socialService.invite(ana, room.id, beto.id)
    assert.lengthOf(await pendingInvitations(beto), 1)
    for (let seat = 2; seat <= room.maxSeats; seat++) {
      await roomService.sit(await createPlayer(), room.id, { buyIn: 500, seatNumber: seat })
    }
    assert.lengthOf(await pendingInvitations(beto), 0)
  })

  test('conectado según el uso de la app', async ({ assert }) => {
    const ana = await createPlayer()
    const beto = await createPlayer()
    await makeFriends(ana, beto)
    let list = await socialService.friends(ana)
    assert.isFalse(list.friends[0].online)

    socialService.touch(beto.id)
    list = await socialService.friends(ana)
    assert.isTrue(list.friends[0].online)

    socialService.touch(beto.id, Date.now() - 60_000)
    list = await socialService.friends(ana)
    assert.isFalse(list.friends[0].online)
  })
})
