import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import User from '#models/user'
import Wallet from '#models/wallet'
import accountService from '#services/game/account_service'
import referralService from '#services/game/referral_service'
import { BotService } from '#services/game/bot_service'

const PASSWORD = 'secreto123'

function createPlayer(username: string) {
  return accountService.register({
    username,
    email: `${username}@pokerlatino.test`,
    password: PASSWORD,
    birthDate: DateTime.fromISO('1990-05-20'),
  })
}

async function tokensOf(userId: number) {
  const rows = await db.from('auth_access_tokens').where('tokenable_id', userId).count('* as total')
  return Number(rows[0].total)
}

/** Estado HTTP de GET /me con ese token */
async function meStatus(client: any, token?: string) {
  const req = client.get('/api/v1/me')
  const res = await (token ? req.bearerToken(token) : req)
  return res.status() as number
}

test.group('Cuentas · registro e inicio de sesión', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('el registro devuelve un token que sirve para la API', async ({ client, assert }) => {
    const res = await client.post('/api/v1/auth/register').json({
      username: 'Recien',
      email: 'Recien@PokerLatino.test',
      password: PASSWORD,
      password_confirmation: PASSWORD,
      birth_date: '1990-05-20',
    } as any)
    res.assertStatus(201)
    const { token, user } = (res.body() as any).data
    assert.match(token, /^pl_/)
    assert.containsSubset(user, { username: 'Recien', email: 'recien@pokerlatino.test' })

    const me = await client.get('/api/v1/me').bearerToken(token)
    me.assertStatus(200)
    me.assertBodyContains({ data: { username: 'Recien' } })
  })

  test('login con credenciales correctas e incorrectas', async ({ client, assert }) => {
    await createPlayer('lola')

    const wrong = await client
      .post('/api/v1/auth/login')
      .json({ email: 'lola@pokerlatino.test', password: 'otra-clave' })
    wrong.assertStatus(401)
    wrong.assertBodyContains({ error: 'invalid_credentials' })

    const unknown = await client
      .post('/api/v1/auth/login')
      .json({ email: 'nadie@pokerlatino.test', password: PASSWORD })
    unknown.assertStatus(401)

    const ok = await client
      .post('/api/v1/auth/login')
      .json({ email: 'LOLA@pokerlatino.test', password: PASSWORD })
    ok.assertStatus(200)
    assert.match((ok.body() as any).data.token, /^pl_/)
  })

  test('iniciar sesión cierra la sesión del otro dispositivo', async ({ client, assert }) => {
    const user = await createPlayer('doble')
    const login = async () => {
      const res = await client
        .post('/api/v1/auth/login')
        .json({ email: 'doble@pokerlatino.test', password: PASSWORD })
      res.assertStatus(200)
      return (res.body() as any).data.token as string
    }

    const phone = await login()
    assert.equal(await meStatus(client, phone), 200)

    const laptop = await login()
    const kicked = await client.get('/api/v1/me').bearerToken(phone)
    kicked.assertStatus(401)
    kicked.assertBodyContains({ error: 'unauthorized' })
    assert.equal(await meStatus(client, laptop), 200)
    assert.equal(await tokensOf(user.id), 1)
  })

  test('cerrar sesión invalida el token', async ({ client, assert }) => {
    const user = await createPlayer('salida')
    const res = await client
      .post('/api/v1/auth/login')
      .json({ email: 'salida@pokerlatino.test', password: PASSWORD })
    const token = (res.body() as any).data.token

    const out = await client.delete('/api/v1/auth/logout').bearerToken(token)
    out.assertStatus(204)
    assert.equal(await meStatus(client, token), 401)
    assert.equal(await tokensOf(user.id), 0)
  })

  test('sin token, o con uno inventado, la API responde 401', async ({ client, assert }) => {
    assert.equal(await meStatus(client), 401)
    assert.equal(await meStatus(client, 'pl_inventado.abc'), 401)
  })

  test('los bots no pueden iniciar sesión', async ({ client }) => {
    const bot = await new BotService(true).createBot()
    // Aunque alguien conociera su contraseña
    bot.password = PASSWORD
    await bot.save()
    const res = await client
      .post('/api/v1/auth/login')
      .json({ email: bot.email, password: PASSWORD })
    res.assertStatus(401)
  })

  test('el código de invitación del enlace /r/CODIGO se aplica al registrarse', async ({
    client,
    assert,
  }) => {
    const referrer = await createPlayer('anfitrion')
    const code = await referralService.codeFor(referrer)

    const res = await client
      .post('/api/v1/auth/register')
      .withCookie('ref', code)
      .json({
        username: 'invitada',
        email: 'invitada@pokerlatino.test',
        password: PASSWORD,
        password_confirmation: PASSWORD,
        birth_date: '1990-05-20',
      } as any)
    res.assertStatus(201)
    const user = await User.findByOrFail('email', 'invitada@pokerlatino.test')
    const wallet = await Wallet.findByOrFail('user_id', user.id)
    assert.equal(wallet.balance, 1500)
  })
})
