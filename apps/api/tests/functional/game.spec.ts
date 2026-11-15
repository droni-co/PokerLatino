import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import User from '#models/user'
import Room from '#models/room'
import Hand from '#models/hand'
import HandPlayer from '#models/hand_player'
import Wallet from '#models/wallet'
import PlayerStat from '#models/player_stat'
import accountService from '#services/game/account_service'
import oauthServer from '#services/oauth/oauth_server'

let counter = 0
function createPlayer(email = `jugador${++counter}@pokerlatino.test`) {
  return accountService.register({
    username: email.split('@')[0],
    email,
    password: 'secreto123',
    birthDate: DateTime.fromISO('1990-05-20'),
  })
}

async function balance(user: User) {
  const wallet = await Wallet.query().where('user_id', user.id).firstOrFail()
  return wallet.balance
}

const roomBySlug = (slug: string) => Room.findByOrFail('slug', slug)

test.group('Juego · cuentas y billeteras', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('el registro exige fecha de nacimiento y mayoría de edad', async ({ client, assert }) => {
    const register = (birthDate?: string) =>
      client
        .post('/oauth/register')
        .form({
          username: 'edad',
          email: 'edad@pokerlatino.test',
          password: 'secreto123',
          password_confirmation: 'secreto123',
          ...(birthDate ? { birth_date: birthDate } : {}),
        })
        .withCsrfToken()
        .redirects(0)

    const missing = await register()
    missing.assertStatus(302)
    missing.assertFlashMessage('inputErrorsBag', { birth_date: ['Este campo es obligatorio'] })

    const almost18 = DateTime.now().minus({ years: 18 }).plus({ days: 1 }).toISODate()!
    const underage = await register(almost18)
    underage.assertStatus(302)
    underage.assertFlashMessage('inputErrorsBag', {
      birth_date: ['Debes ser mayor de edad para registrarte'],
    })
    assert.isNull(await User.findBy('email', 'edad@pokerlatino.test'))

    const exactly18 = DateTime.now().minus({ years: 18 }).toISODate()!
    const ok = await register(exactly18)
    ok.assertStatus(200)
    const user = await User.findByOrFail('email', 'edad@pokerlatino.test')
    assert.equal(user.birthDate.toISODate(), exactly18)
  })

  test('al registrarse recibe una billetera con 1000 fichas', async ({ client, assert }) => {
    const res = await client
      .post('/oauth/register')
      .form({
        username: 'nuevo',
        email: 'nuevo@pokerlatino.test',
        password: 'secreto123',
        password_confirmation: 'secreto123',
        birth_date: '1990-05-20',
      })
      .withCsrfToken()
      .redirects(0)
    res.assertStatus(200)

    const user = await User.findByOrFail('email', 'nuevo@pokerlatino.test')
    assert.equal(await balance(user), 1000)
    assert.lengthOf(await Wallet.query().where('user_id', user.id), 1)

    const ledger = await db
      .from('wallet_transactions')
      .join('wallets', 'wallets.id', 'wallet_transactions.wallet_id')
      .where('wallets.user_id', user.id)
      .select('wallet_transactions.*')
    assert.lengthOf(ledger, 1)
    assert.containsSubset(ledger[0], {
      type: 'signup_bonus',
      amount: 1000,
      balance_after: 1000,
      description: 'Fichas de bienvenida',
    })

    const stats = await PlayerStat.query().where('user_id', user.id)
    assert.lengthOf(stats, 1)
  })

  test('GET /wallet devuelve el saldo de fichas', async ({ client }) => {
    const user = await createPlayer()
    const res = await client.get('/api/v1/wallet').loginAs(user)
    res.assertStatus(200)
    res.assertBody({ data: { balance: 1000 } })
  })

  test('GET /wallet/transactions pagina el historial', async ({ client, assert }) => {
    const user = await createPlayer()
    const res = await client.get('/api/v1/wallet/transactions').loginAs(user)
    res.assertStatus(200)
    const body = res.body() as any
    assert.lengthOf(body.data, 1)
    assert.equal(body.data[0].type, 'signup_bonus')
    assert.equal(body.metadata.total, 1)
  })

  test('no existe forma de comprar ni canjear fichas', async ({ client, assert }) => {
    const user = await createPlayer()
    for (const [method, url] of [
      ['post', '/api/v1/deposits'],
      ['post', '/api/v1/withdrawals'],
      ['get', '/api/v1/wallets'],
      ['get', '/api/v1/wallets/usd/transactions'],
    ] as const) {
      const res = await client[method](url).loginAs(user)
      assert.equal(res.status(), 404, `${method.toUpperCase()} ${url}`)
    }

    // La base de datos tampoco admite movimientos de dinero real
    const wallet = await Wallet.findByOrFail('user_id', user.id)
    await assert.rejects(() =>
      db.table('wallet_transactions').insert({
        wallet_id: wallet.id,
        type: 'deposit',
        amount: 100,
        balance_after: 1100,
        created_at: new Date(),
      })
    )
  })

  test('las rutas del juego exigen el scope "game"', async ({ client }) => {
    const user = await createPlayer()
    const { token } = await oauthServer.issueTestToken(user, ['profile'])
    const res = await client.get('/api/v1/rooms').bearerToken(token)
    res.assertStatus(403)
  })

  test('GET /game/config expone las reglas (sin comisión)', async ({ client }) => {
    const user = await createPlayer()
    const res = await client.get('/api/v1/game/config').loginAs(user)
    res.assertStatus(200)
    res.assertBodyContains({
      data: { rake: 0, signupBonus: 1000, rooms: { maxSeats: 5 } },
    })
  })
})

test.group('Juego · salas', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('lista las salas (todas en fichas)', async ({ client, assert }) => {
    const user = await createPlayer()
    const res = await client.get('/api/v1/rooms').loginAs(user)
    res.assertStatus(200)
    const rooms = (res.body() as any).data
    assert.deepEqual(
      rooms.map((r: any) => r.slug),
      ['principiantes-1', 'clasica-1', 'high-rollers-1']
    )
    assert.isTrue(rooms.every((r: any) => !('currency' in r) && r.maxSeats === 5))
    assert.equal(rooms[0].seatedCount, 0)
  })

  test('sentarse descuenta el buy-in y levantarse lo devuelve', async ({ client, assert }) => {
    const user = await createPlayer()
    const room = await roomBySlug('principiantes-1') // ciegas 5/10, buy-in 400-1000

    const sit = await client
      .post(`/api/v1/rooms/${room.id}/seat`)
      .json({ buyIn: 400, seatNumber: 3 })
      .loginAs(user)
    sit.assertStatus(201)
    sit.assertBodyContains({ data: { seatNumber: 3, stack: 400, player: { id: user.id } } })
    assert.equal(await balance(user), 600)

    // La sala muestra el asiento sin exponer el email
    const show = await client.get(`/api/v1/rooms/${room.id}`).loginAs(user)
    show.assertStatus(200)
    assert.equal((show.body() as any).data.seatedCount, 1)
    assert.notInclude(JSON.stringify(show.body()), user.email)

    const leave = await client.delete(`/api/v1/rooms/${room.id}/seat`).loginAs(user)
    leave.assertStatus(200)
    leave.assertBody({ data: { cashedOut: 400, pending: false } })
    assert.equal(await balance(user), 1000)

    const types = await db
      .from('wallet_transactions')
      .join('wallets', 'wallets.id', 'wallet_transactions.wallet_id')
      .where('wallets.user_id', user.id)
      .orderBy('wallet_transactions.id')
      .select('type', 'amount', 'balance_after')
    assert.deepEqual(types, [
      { type: 'signup_bonus', amount: 1000, balance_after: 1000 },
      { type: 'buy_in', amount: -400, balance_after: 600 },
      { type: 'cash_out', amount: 400, balance_after: 1000 },
    ])
  })

  test('valida buy-in, asiento ocupado y jugador ya sentado', async ({ client }) => {
    const [ana, beto] = [await createPlayer(), await createPlayer()]
    const room = await roomBySlug('principiantes-1')
    const sit = (user: User, body: object) =>
      client.post(`/api/v1/rooms/${room.id}/seat`).json(body).loginAs(user)

    const tooSmall = await sit(ana, { buyIn: 100 })
    tooSmall.assertStatus(422)
    tooSmall.assertBodyContains({ error: 'invalid_buy_in' })

    const badSeat = await sit(ana, { buyIn: 400, seatNumber: 6 })
    badSeat.assertBodyContains({ error: 'invalid_seat' })

    const first = await sit(ana, { buyIn: 400, seatNumber: 1 })
    first.assertStatus(201)

    const again = await sit(ana, { buyIn: 400 })
    again.assertStatus(409)
    again.assertBodyContains({ error: 'already_seated' })

    const taken = await sit(beto, { buyIn: 400, seatNumber: 1 })
    taken.assertStatus(409)
    taken.assertBodyContains({ error: 'seat_taken' })

    // Sin seatNumber toma el primer asiento libre
    const auto = await sit(beto, { buyIn: 400 })
    auto.assertBodyContains({ data: { seatNumber: 2 } })
  })

  test('una sala admite máximo 5 jugadores', async ({ client }) => {
    const room = await roomBySlug('principiantes-1')
    for (let i = 0; i < 5; i++) {
      const player = await createPlayer()
      const res = await client
        .post(`/api/v1/rooms/${room.id}/seat`)
        .json({ buyIn: 400 })
        .loginAs(player)
      res.assertStatus(201)
    }

    const sixth = await client
      .post(`/api/v1/rooms/${room.id}/seat`)
      .json({ buyIn: 400 })
      .loginAs(await createPlayer())
    sixth.assertStatus(409)
    sixth.assertBodyContains({ error: 'room_full' })
  })

  test('no se puede levantar en medio de una mano', async ({ client }) => {
    const user = await createPlayer()
    const room = await roomBySlug('principiantes-1')
    const seated = await client
      .post(`/api/v1/rooms/${room.id}/seat`)
      .json({ buyIn: 400 })
      .loginAs(user)
    seated.assertStatus(201)

    const hand = await Hand.create({
      roomId: room.id,
      handNumber: 1,
      smallBlind: 5,
      bigBlind: 10,
      dealerSeat: 1,
      board: [],
      status: 'in_progress',
      startedAt: DateTime.now(),
    })
    await HandPlayer.create({ handId: hand.id, userId: user.id, seatNumber: 1, startingStack: 400 })

    // Con una mano en curso queda pendiente: se levanta al terminarla
    const res = await client.delete(`/api/v1/rooms/${room.id}/seat`).loginAs(user)
    res.assertStatus(202)
    res.assertBodyContains({ data: { pending: true, cashedOut: 0 } })
  })

  test('sala inexistente y levantarse sin estar sentado', async ({ client }) => {
    const user = await createPlayer()
    const missing = await client.get('/api/v1/rooms/999999').loginAs(user)
    missing.assertStatus(404)
    const res = await client.delete('/api/v1/rooms/999999/seat').loginAs(user)
    res.assertStatus(404)
    res.assertBodyContains({ error: 'room_not_found' })
  })
})

/**
 * Sin transacción global: aquí se prueban bloqueos reales entre conexiones.
 */
test.group('Juego · concurrencia', () => {
  test('dos buy-ins simultáneos no pueden gastar el mismo saldo', async ({ client, assert }) => {
    const user = await createPlayer('concurrencia@pokerlatino.test')
    try {
      const [a, b] = await Promise.all([
        roomBySlug('principiantes-1'),
        roomBySlug('clasica-1'), // buy-in 800-2000
      ])

      // 1000 fichas: 1000 + 800 no alcanza para ambas
      const [r1, r2] = await Promise.all([
        client.post(`/api/v1/rooms/${a.id}/seat`).json({ buyIn: 1000 }).loginAs(user),
        client.post(`/api/v1/rooms/${b.id}/seat`).json({ buyIn: 800 }).loginAs(user),
      ])

      const statuses = [r1.status(), r2.status()].sort()
      assert.deepEqual(statuses, [201, 422])

      // Invariante: saldo + fichas en mesa = 1000 (no se crean ni se pierden fichas)
      const seats = await db.from('room_seats').where('user_id', user.id).sum('stack as total')
      assert.equal((await balance(user)) + Number(seats[0].total), 1000)
    } finally {
      await user.delete()
    }
  })
})
