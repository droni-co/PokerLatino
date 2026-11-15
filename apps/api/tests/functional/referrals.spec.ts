import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import User from '#models/user'
import Wallet from '#models/wallet'
import Referral from '#models/referral'
import Room from '#models/room'
import WalletTransaction from '#models/wallet_transaction'
import accountService from '#services/game/account_service'
import referralService, { normalizeEmail } from '#services/game/referral_service'
import roomService from '#services/game/room_service'
import tableManager from '#game/table_manager'
import { balanceWithoutRewards } from '#tests/helpers/wallet'

let counter = 0
function createPlayer(options: { email?: string; code?: string; ip?: string } = {}) {
  counter++
  return accountService.register(
    {
      username: `amigo${counter}`,
      email: options.email ?? `amigo${counter}@pokerlatino.test`,
      password: 'secreto123',
      birthDate: DateTime.fromISO('1990-05-20'),
    },
    options.code ? { code: options.code, ip: options.ip ?? `10.0.0.${counter}` } : undefined
  )
}

/** Saldo sin recompensas de logros y niveles */
function balance(user: User) {
  return balanceWithoutRewards(user.id)
}

async function setBalance(user: User, amount: number) {
  await Wallet.query().where('user_id', user.id).update({ balance: amount })
}

test.group('Referidos', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('normaliza alias de email', ({ assert }) => {
    assert.equal(normalizeEmail('Juan.Perez+poker@Gmail.com'), 'juanperez@gmail.com')
    assert.equal(normalizeEmail('juan.perez@googlemail.com'), 'juanperez@gmail.com')
    assert.equal(normalizeEmail('ana.maria+1@empresa.co'), 'ana.maria@empresa.co')
  })

  test('GET /referrals crea el código y el enlace una sola vez', async ({ client, assert }) => {
    const user = await createPlayer()
    const res = await client.get('/api/v1/referrals').loginAs(user)
    res.assertStatus(200)
    const data = (res.body() as any).data
    assert.match(data.code, /^[A-Z2-9]{7}$/)
    assert.match(data.link, new RegExp(`/r/${data.code}$`))
    assert.containsSubset(data, {
      referrerReward: 500,
      referredReward: 500,
      maxRewardedPerDay: 5,
      rewardedToday: 0,
      totalInvited: 0,
      invited: [],
    })

    const again = await client.get('/api/v1/referrals').loginAs(user)
    assert.equal((again.body() as any).data.code, data.code)
  })

  test('crear la cuenta con un código paga a los dos', async ({ client, assert }) => {
    const referrer = await createPlayer()
    const code = await referralService.codeFor(referrer)
    const friend = await createPlayer({ code: code.toLowerCase() })

    assert.equal(await balance(friend), 1500)
    assert.equal(await balance(referrer), 1500)
    await friend.refresh()
    assert.equal(friend.referredById, referrer.id)
    const bonus = await WalletTransaction.query()
      .where('type', 'referral_reward')
      .where('reference_id', String(friend.id))
      .firstOrFail()
    assert.equal(bonus.amount, 500)

    const res = await client.get('/api/v1/referrals').loginAs(referrer)
    assert.containsSubset((res.body() as any).data, {
      rewardedToday: 1,
      totalInvited: 1,
      totalEarned: 500,
      invited: [{ player: { id: friend.id }, status: 'rewarded', reward: 500 }],
    })
  })

  test('máximo 5 invitaciones pagadas al día al que invita', async ({ client, assert }) => {
    const referrer = await createPlayer()
    const code = await referralService.codeFor(referrer)
    for (let i = 0; i < 5; i++) await createPlayer({ code })
    const sixth = await createPlayer({ code })

    assert.equal(await balance(referrer), 1000 + 5 * 500)
    assert.equal(await balance(sixth), 1500) // el invitado sí recibe su bono
    const referral = await Referral.findByOrFail('referred_id', sixth.id)
    assert.equal(referral.status, 'limit_reached')

    const res = await client.get('/api/v1/referrals').loginAs(referrer)
    const data = (res.body() as any).data
    assert.equal(data.rewardedToday, 5)
    assert.isString(data.nextSlotAt)

    // Pasadas 24 h vuelve a cobrar
    await db
      .from('referrals')
      .where('referrer_id', referrer.id)
      .update({
        created_at: DateTime.now().minus({ hours: 25 }).toSQL(),
      })
    await createPlayer({ code })
    assert.equal(await balance(referrer), 1000 + 6 * 500)
  })

  test('abuso: misma IP repetida o alias del propio email no cobran', async ({ assert }) => {
    const referrer = await createPlayer({ email: 'juan.perez@gmail.com' })
    const code = await referralService.codeFor(referrer)

    const alias = await createPlayer({ email: 'juanperez+2@gmail.com', code })
    assert.equal(await balance(alias), 1000)
    const aliasReferral = await Referral.findByOrFail('referred_id', alias.id)
    assert.equal(aliasReferral.status, 'blocked')

    const a = await createPlayer({ code, ip: '1.2.3.4' })
    const b = await createPlayer({ code, ip: '1.2.3.4' })
    const c = await createPlayer({ code, ip: '1.2.3.4' })
    assert.equal(await balance(a), 1500)
    assert.equal(await balance(b), 1500)
    assert.equal(await balance(c), 1000)
    const cReferral = await Referral.findByOrFail('referred_id', c.id)
    assert.equal(cReferral.status, 'blocked')
    assert.equal(await balance(referrer), 1000 + 2 * 500)
  })

  test('formulario de registro con código y página de invitación', async ({ client, assert }) => {
    const referrer = await createPlayer()
    const code = await referralService.codeFor(referrer)

    const page = await client.get(`/r/${code.toLowerCase()}`).redirects(0)
    page.assertStatus(200)
    page.assertTextIncludes(`${referrer.displayName} te invita`)
    assert.match(page.text(), /1,500\s+fichas/)
    page.assertCookie('ref', code)

    const unknown = await client.get('/r/NOEXISTE').redirects(0)
    unknown.assertStatus(302)

    const bad = await client
      .post('/oauth/register')
      .form({
        username: 'invitado_malo',
        email: 'invitado_malo@pokerlatino.test',
        password: 'secreto123',
        password_confirmation: 'secreto123',
        birth_date: '1990-05-20',
        referral_code: 'ZZZZZZZ',
      })
      .withCsrfToken()
      .redirects(0)
    bad.assertStatus(302)
    bad.assertFlashMessage('inputErrorsBag', {
      referral_code: ['Ese código de invitación no existe'],
    })

    const ok = await client
      .post('/oauth/register')
      .form({
        username: 'invitado_bueno',
        email: 'invitado_bueno@pokerlatino.test',
        password: 'secreto123',
        password_confirmation: 'secreto123',
        birth_date: '1990-05-20',
        referral_code: code,
      })
      .withCsrfToken()
      .redirects(0)
    ok.assertStatus(200)
    const friend = await User.findByOrFail('email', 'invitado_bueno@pokerlatino.test')
    assert.equal(await balance(friend), 1500)
  })
})

test.group('Rescate diario', (group) => {
  group.each.setup(() => {
    tableManager.reset()
    return testUtils.db().withGlobalTransaction()
  })

  test('solo sin fichas para la mesa más barata y una vez cada 24 h', async ({
    client,
    assert,
  }) => {
    const user = await createPlayer()

    let res = await client.get('/api/v1/wallet/rescue').loginAs(user)
    assert.containsSubset((res.body() as any).data, {
      amount: 400,
      threshold: 400,
      eligible: false,
      available: false,
    })
    const early = await client.post('/api/v1/wallet/rescue').loginAs(user)
    early.assertStatus(409)
    early.assertBodyContains({ error: 'rescue_unavailable' })

    await setBalance(user, 150)
    res = await client.get('/api/v1/wallet/rescue').loginAs(user)
    assert.containsSubset((res.body() as any).data, {
      eligible: true,
      available: true,
      nextAt: null,
    })

    const claim = await client.post('/api/v1/wallet/rescue').loginAs(user)
    claim.assertStatus(201)
    assert.equal(await balance(user), 550)

    // Lo pierde de nuevo: tiene que esperar 24 h
    await setBalance(user, 0)
    res = await client.get('/api/v1/wallet/rescue').loginAs(user)
    const data = (res.body() as any).data
    assert.isTrue(data.eligible)
    assert.isFalse(data.available)
    assert.isString(data.nextAt)
    const again = await client.post('/api/v1/wallet/rescue').loginAs(user)
    again.assertStatus(409)

    await db
      .from('wallet_transactions')
      .where('type', 'rescue')
      .update({ created_at: DateTime.now().minus({ hours: 25 }).toSQL() })
    const later = await client.post('/api/v1/wallet/rescue').loginAs(user)
    later.assertStatus(201)
  })

  test('las fichas sentadas en una mesa cuentan', async ({ assert }) => {
    const { default: rescueService } = await import('#services/game/rescue_service')
    const user = await createPlayer()
    const room = await Room.findByOrFail('slug', 'principiantes-1')
    await roomService.sit(user, room.id, { buyIn: 1000, seatNumber: 1 })
    const status = await rescueService.status(user.id)
    assert.isFalse(status.eligible) // saldo 0, pero 1,000 en la mesa
  })
})
