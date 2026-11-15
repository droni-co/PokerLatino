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
import depositService from '#services/game/deposit_service'
import oauthServer from '#services/oauth/oauth_server'
import type { Currency } from '#config/game'

let counter = 0
function createPlayer(email = `jugador${++counter}@pokerlatino.test`) {
  return accountService.register({
    email,
    password: 'secreto123',
    birthDate: DateTime.fromISO('1990-05-20'),
  })
}

async function balance(user: User, currency: Currency) {
  const wallet = await Wallet.query()
    .where('user_id', user.id)
    .where('currency', currency)
    .firstOrFail()
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

  test('al registrarse recibe 1000 credits y una billetera USD vacía', async ({
    client,
    assert,
  }) => {
    const res = await client
      .post('/oauth/register')
      .form({
        email: 'nuevo@pokerlatino.test',
        password: 'secreto123',
        password_confirmation: 'secreto123',
        birth_date: '1990-05-20',
      })
      .withCsrfToken()
      .redirects(0)
    res.assertStatus(200)

    const user = await User.findByOrFail('email', 'nuevo@pokerlatino.test')
    assert.equal(await balance(user, 'credits'), 1000)
    assert.equal(await balance(user, 'usd'), 0)

    const ledger = await db
      .from('wallet_transactions')
      .join('wallets', 'wallets.id', 'wallet_transactions.wallet_id')
      .where('wallets.user_id', user.id)
      .select('wallet_transactions.*', 'wallets.currency')
    assert.lengthOf(ledger, 1)
    assert.containsSubset(ledger[0], {
      type: 'signup_bonus',
      amount: 1000,
      balance_after: 1000,
      currency: 'credits',
    })

    const stats = await PlayerStat.query().where('user_id', user.id)
    assert.lengthOf(stats, 2)
  })

  test('GET /wallets devuelve ambos saldos', async ({ client }) => {
    const user = await createPlayer()
    const res = await client.get('/api/v1/wallets').loginAs(user)
    res.assertStatus(200)
    res.assertBody({
      data: [
        { currency: 'credits', balance: 1000 },
        { currency: 'usd', balance: 0 },
      ],
    })
  })

  test('GET /wallets/:currency/transactions pagina el historial', async ({ client, assert }) => {
    const user = await createPlayer()
    const res = await client.get('/api/v1/wallets/credits/transactions').loginAs(user)
    res.assertStatus(200)
    const body = res.body() as any
    assert.lengthOf(body.data, 1)
    assert.equal(body.data[0].type, 'signup_bonus')
    assert.equal(body.metadata.total, 1)

    const invalid = await client.get('/api/v1/wallets/euros/transactions').loginAs(user)
    invalid.assertStatus(404)
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
      data: { rake: 0, signupBonus: { credits: 1000, usd: 0 }, rooms: { maxSeats: 5 } },
    })
  })
})

test.group('Juego · salas', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('lista salas filtradas por moneda', async ({ client, assert }) => {
    const user = await createPlayer()
    const res = await client.get('/api/v1/rooms').qs({ currency: 'credits' }).loginAs(user)
    res.assertStatus(200)
    const rooms = (res.body() as any).data
    assert.isAtLeast(rooms.length, 1)
    assert.isTrue(rooms.every((r: any) => r.currency === 'credits' && r.maxSeats === 5))
    assert.equal(rooms[0].seatedCount, 0)

    const invalid = await client.get('/api/v1/rooms').unsafeQs({ currency: 'euros' }).loginAs(user)
    invalid.assertStatus(422)
  })

  test('sentarse descuenta el buy-in y levantarse lo devuelve', async ({ client, assert }) => {
    const user = await createPlayer()
    const room = await roomBySlug('credits-principiantes') // ciegas 5/10, buy-in 400-1000

    const sit = await client
      .post(`/api/v1/rooms/${room.id}/seat`)
      .json({ buyIn: 400, seatNumber: 3 })
      .loginAs(user)
    sit.assertStatus(201)
    sit.assertBodyContains({ data: { seatNumber: 3, stack: 400, player: { id: user.id } } })
    assert.equal(await balance(user, 'credits'), 600)

    // La sala muestra el asiento sin exponer el email
    const show = await client.get(`/api/v1/rooms/${room.id}`).loginAs(user)
    show.assertStatus(200)
    assert.equal((show.body() as any).data.seatedCount, 1)
    assert.notInclude(JSON.stringify(show.body()), user.email)

    const leave = await client.delete(`/api/v1/rooms/${room.id}/seat`).loginAs(user)
    leave.assertStatus(200)
    leave.assertBody({ data: { currency: 'credits', cashedOut: 400 } })
    assert.equal(await balance(user, 'credits'), 1000)

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
    const room = await roomBySlug('credits-principiantes')
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
    const room = await roomBySlug('credits-principiantes')
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

  test('las salas USD usan el saldo en dólares, no los credits', async ({ client, assert }) => {
    const user = await createPlayer()
    const room = await roomBySlug('usd-micro') // buy-in 80-200 centavos

    const broke = await client
      .post(`/api/v1/rooms/${room.id}/seat`)
      .json({ buyIn: 100 })
      .loginAs(user)
    broke.assertStatus(422)
    broke.assertBodyContains({ error: 'insufficient_funds' })
    assert.equal(await balance(user, 'credits'), 1000)

    const deposit = await depositService.createPending(user.id, 500)
    await depositService.complete(deposit.id)

    const sit = await client
      .post(`/api/v1/rooms/${room.id}/seat`)
      .json({ buyIn: 200 })
      .loginAs(user)
    sit.assertStatus(201)
    assert.equal(await balance(user, 'usd'), 300)
    assert.equal(await balance(user, 'credits'), 1000)
  })

  test('no se puede levantar en medio de una mano', async ({ client }) => {
    const user = await createPlayer()
    const room = await roomBySlug('credits-principiantes')
    const seated = await client
      .post(`/api/v1/rooms/${room.id}/seat`)
      .json({ buyIn: 400 })
      .loginAs(user)
    seated.assertStatus(201)

    const hand = await Hand.create({
      roomId: room.id,
      handNumber: 1,
      currency: 'credits',
      smallBlind: 5,
      bigBlind: 10,
      dealerSeat: 1,
      board: [],
      status: 'in_progress',
      startedAt: DateTime.now(),
    })
    await HandPlayer.create({ handId: hand.id, userId: user.id, seatNumber: 1, startingStack: 400 })

    const res = await client.delete(`/api/v1/rooms/${room.id}/seat`).loginAs(user)
    res.assertStatus(409)
    res.assertBodyContains({ error: 'hand_in_progress' })
  })

  test('sala inexistente y levantarse sin estar sentado', async ({ client }) => {
    const user = await createPlayer()
    const missing = await client.get('/api/v1/rooms/999999').loginAs(user)
    missing.assertStatus(404)
    const res = await client.delete('/api/v1/rooms/999999/seat').loginAs(user)
    res.assertStatus(404)
    res.assertBodyContains({ error: 'not_seated' })
  })
})

test.group('Juego · recargas', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('POST /deposits crea una recarga pendiente sin acreditar saldo', async ({
    client,
    assert,
  }) => {
    const user = await createPlayer()

    const tooSmall = await client.post('/api/v1/deposits').json({ amount: 100 }).loginAs(user)
    tooSmall.assertStatus(422)

    const res = await client.post('/api/v1/deposits').json({ amount: 2500 }).loginAs(user)
    res.assertStatus(201)
    res.assertBodyContains({ data: { amount: 2500, currency: 'usd', status: 'pending' } })
    assert.equal(await balance(user, 'usd'), 0)
  })

  test('completar una recarga acredita una sola vez (idempotente)', async ({ assert }) => {
    const user = await createPlayer()
    const deposit = await depositService.createPending(user.id, 2500)

    await depositService.complete(deposit.id, 'pago-123')
    await depositService.complete(deposit.id, 'pago-123')

    assert.equal(await balance(user, 'usd'), 2500)
    const stats = await PlayerStat.query()
      .where('user_id', user.id)
      .where('currency', 'usd')
      .firstOrFail()
    assert.equal(stats.totalDeposited, 2500)
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
        roomBySlug('credits-principiantes'),
        roomBySlug('credits-clasica'), // buy-in 800-2000
      ])

      // 1000 credits: 1000 + 800 no alcanza para ambas
      const [r1, r2] = await Promise.all([
        client.post(`/api/v1/rooms/${a.id}/seat`).json({ buyIn: 1000 }).loginAs(user),
        client.post(`/api/v1/rooms/${b.id}/seat`).json({ buyIn: 800 }).loginAs(user),
      ])

      const statuses = [r1.status(), r2.status()].sort()
      assert.deepEqual(statuses, [201, 422])

      // Invariante: saldo + fichas en mesa = 1000 (no se crea ni se pierde dinero)
      const seats = await db.from('room_seats').where('user_id', user.id).sum('stack as total')
      assert.equal((await balance(user, 'credits')) + Number(seats[0].total), 1000)
    } finally {
      await user.delete()
    }
  })
})
