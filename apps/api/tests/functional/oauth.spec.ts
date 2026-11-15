import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import { createHash, randomBytes } from 'node:crypto'
import type { ApiClient } from '@japa/api-client'
import testUtils from '@adonisjs/core/services/test_utils'
import oauthConfig from '#config/oauth'
import User from '#models/user'
import oauthServer from '#services/oauth/oauth_server'
import { FLUTTER_CLIENT } from '#database/seeders/oauth_client_seeder'

const REDIRECT = FLUTTER_CLIENT.redirectUris[0]

function pkce() {
  const verifier = randomBytes(32).toString('base64url')
  const challenge = createHash('sha256').update(verifier).digest('base64url')
  return { verifier, challenge }
}

function authorizeQs(challenge: string, extra: Record<string, string> = {}) {
  return {
    response_type: 'code',
    client_id: FLUTTER_CLIENT.id,
    redirect_uri: REDIRECT,
    scope: 'profile game',
    state: 'xyz123',
    code_challenge: challenge,
    code_challenge_method: 'S256',
    ...extra,
  }
}

function createUser(email = 'jugador@pokerlatino.test') {
  return User.create({ email, password: 'secreto123', birthDate: DateTime.fromISO('1990-05-20') })
}

/**
 * Simula al usuario ya logueado en el navegador y devuelve el code emitido
 */
async function getCode(client: ApiClient, user: User, challenge: string) {
  const res = await client
    .get('/oauth/authorize')
    .qs(authorizeQs(challenge))
    .withGuard('web')
    .loginAs(user)
    .redirects(0)
  res.assertStatus(302)
  return new URL(res.header('location')!).searchParams.get('code')!
}

function getMe(client: ApiClient, accessToken: string) {
  return client.get('/api/v1/me').bearerToken(accessToken)
}

async function login(client: ApiClient, user: User) {
  const { verifier, challenge } = pkce()
  const code = await getCode(client, user, challenge)
  const res = await client.post('/oauth/token').form({
    grant_type: 'authorization_code',
    client_id: FLUTTER_CLIENT.id,
    code,
    redirect_uri: REDIRECT,
    code_verifier: verifier,
  })
  res.assertStatus(200)
  return res.body() as { access_token: string; refresh_token: string }
}

test.group('OAuth · registro y login (páginas web)', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('el registro crea al usuario y retoma la autorización pendiente', async ({
    client,
    assert,
  }) => {
    const { challenge } = pkce()
    const res = await client
      .post('/oauth/register')
      .form({
        email: '  Nuevo@PokerLatino.test ',
        password: 'secreto123',
        password_confirmation: 'secreto123',
        birth_date: '1990-05-20',
      })
      .withSession({ oauth: { pending_authorize: authorizeQs(challenge) } })
      .withCsrfToken()
      .redirects(0)

    res.assertStatus(302)
    assert.match(res.header('location')!, /^\/oauth\/authorize\?.*client_id=poker-latino-app/)

    const user = await User.findByOrFail('email', 'nuevo@pokerlatino.test')
    assert.notEqual(user.password, 'secreto123')
  })

  test('el registro rechaza emails duplicados y contraseñas que no coinciden', async ({
    client,
    assert,
  }) => {
    await createUser()

    const duplicated = await client
      .post('/oauth/register')
      .form({
        email: 'jugador@pokerlatino.test',
        password: 'secreto123',
        password_confirmation: 'secreto123',
        birth_date: '1990-05-20',
      })
      .withCsrfToken()
      .redirects(0)
    duplicated.assertStatus(302)
    duplicated.assertFlashMessage('inputErrorsBag', {
      email: ['Ya existe una cuenta con este email'],
    })

    const mismatch = await client
      .post('/oauth/register')
      .form({
        email: 'otro@pokerlatino.test',
        password: 'secreto123',
        password_confirmation: 'distinta1',
        birth_date: '1990-05-20',
      })
      .withCsrfToken()
      .redirects(0)
    mismatch.assertStatus(302)
    assert.isNull(await User.findBy('email', 'otro@pokerlatino.test'))
  })

  test('el registro sin token CSRF es rechazado', async ({ client, assert }) => {
    const res = await client
      .post('/oauth/register')
      .form({
        email: 'a@b.test',
        password: 'secreto123',
        password_confirmation: 'secreto123',
        birth_date: '1990-05-20',
      })
      .redirects(0)
    // En formularios HTML, Shield redirige de vuelta con un mensaje en vez de responder 403
    res.assertStatus(302)
    assert.isNull(await User.findBy('email', 'a@b.test'))
  })

  test('login con contraseña incorrecta vuelve al formulario', async ({ client }) => {
    await createUser()
    const res = await client
      .post('/oauth/login')
      .form({ email: 'jugador@pokerlatino.test', password: 'incorrecta' })
      .withCsrfToken()
      .redirects(0)

    res.assertStatus(302)
    res.assertHeader('location', '/oauth/login')
    res.assertFlashMessage('error', 'Email o contraseña incorrectos')
  })

  test('login correcto retoma la autorización pendiente', async ({ client, assert }) => {
    await createUser()
    const { challenge } = pkce()
    const res = await client
      .post('/oauth/login')
      .form({ email: 'JUGADOR@pokerlatino.test', password: 'secreto123' })
      .withSession({ oauth: { pending_authorize: authorizeQs(challenge) } })
      .withCsrfToken()
      .redirects(0)

    res.assertStatus(302)
    assert.match(res.header('location')!, /^\/oauth\/authorize\?/)
  })
})

test.group('OAuth · /oauth/authorize', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('sin sesión redirige al login', async ({ client }) => {
    const res = await client.get('/oauth/authorize').qs(authorizeQs(pkce().challenge)).redirects(0)
    res.assertStatus(302)
    res.assertHeader('location', '/oauth/login')
  })

  test('client_id o redirect_uri inválidos muestran error y NO redirigen', async ({ client }) => {
    const { challenge } = pkce()
    const badClient = await client
      .get('/oauth/authorize')
      .qs(authorizeQs(challenge, { client_id: 'no-existe' }))
      .redirects(0)
    badClient.assertStatus(400)

    const badRedirect = await client
      .get('/oauth/authorize')
      .qs(authorizeQs(challenge, { redirect_uri: 'https://atacante.test/cb' }))
      .redirects(0)
    badRedirect.assertStatus(400)
  })

  test('PKCE es obligatorio y solo S256', async ({ client, assert }) => {
    const res = await client
      .get('/oauth/authorize')
      .qs(authorizeQs('', { code_challenge_method: 'plain' }))
      .redirects(0)

    res.assertStatus(302)
    const location = new URL(res.header('location')!)
    assert.equal(location.searchParams.get('error'), 'invalid_request')
    assert.equal(location.searchParams.get('state'), 'xyz123')
  })

  test('scope desconocido devuelve invalid_scope', async ({ client, assert }) => {
    const res = await client
      .get('/oauth/authorize')
      .qs(authorizeQs(pkce().challenge, { scope: 'admin' }))
      .redirects(0)
    assert.equal(new URL(res.header('location')!).searchParams.get('error'), 'invalid_scope')
  })

  test('acepta redirect loopback con cualquier puerto (Flutter web/desktop)', async ({
    client,
    assert,
  }) => {
    const user = await createUser()
    const res = await client
      .get('/oauth/authorize')
      .qs(authorizeQs(pkce().challenge, { redirect_uri: 'http://localhost:53123/oauth/callback' }))
      .withGuard('web')
      .loginAs(user)
      .redirects(0)

    res.assertStatus(302)
    assert.match(res.header('location')!, /^http:\/\/localhost:53123\/oauth\/callback\?code=/)
  })

  test('con sesión, el cliente propio recibe el code sin consentimiento', async ({
    client,
    assert,
  }) => {
    const user = await createUser()
    const res = await client
      .get('/oauth/authorize')
      .qs(authorizeQs(pkce().challenge))
      .withGuard('web')
      .loginAs(user)
      .redirects(0)

    res.assertStatus(302)
    const location = new URL(res.header('location')!)
    assert.equal(location.protocol, 'co.droni.pokerlatino:')
    assert.isString(location.searchParams.get('code'))
    assert.equal(location.searchParams.get('state'), 'xyz123')
    assert.equal(location.searchParams.get('iss'), oauthConfig.issuer)
  })

  test('un cliente de terceros muestra la pantalla de consentimiento', async ({ client }) => {
    await oauthServer.createClient({
      id: 'app-terceros',
      name: 'App de Terceros',
      redirectUris: ['https://terceros.test/cb'],
    })
    const user = await createUser()
    const res = await client
      .get('/oauth/authorize')
      .qs(
        authorizeQs(pkce().challenge, {
          client_id: 'app-terceros',
          redirect_uri: 'https://terceros.test/cb',
        })
      )
      .withGuard('web')
      .loginAs(user)
      .redirects(0)

    res.assertStatus(200)
    res.assertTextIncludes('App de Terceros quiere acceder a tu cuenta')
  })
})

test.group('OAuth · /oauth/token', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('canjea el code por tokens y permite acceder a la API', async ({ client, assert }) => {
    const user = await createUser()
    const { verifier, challenge } = pkce()
    const code = await getCode(client, user, challenge)

    const res = await client.post('/oauth/token').form({
      grant_type: 'authorization_code',
      client_id: FLUTTER_CLIENT.id,
      code,
      redirect_uri: REDIRECT,
      code_verifier: verifier,
    })

    res.assertStatus(200)
    res.assertHeader('cache-control', 'no-store')
    const body = res.body()
    assert.equal(body.token_type, 'Bearer')
    assert.equal(body.expires_in, 900)
    assert.equal(body.scope, 'profile game')
    assert.match(body.access_token, /^pl_at_/)
    assert.match(body.refresh_token!, /^pl_rt_/)

    const me = await client.get('/api/v1/me').bearerToken(body.access_token)
    me.assertStatus(200)
    assert.equal(me.body().data.email, 'jugador@pokerlatino.test')
  })

  test('code_verifier incorrecto es rechazado', async ({ client }) => {
    const user = await createUser()
    const code = await getCode(client, user, pkce().challenge)

    const res = await client.post('/oauth/token').form({
      grant_type: 'authorization_code',
      client_id: FLUTTER_CLIENT.id,
      code,
      redirect_uri: REDIRECT,
      code_verifier: pkce().verifier,
    })
    res.assertStatus(400)
    res.assertBodyContains({ error: 'invalid_grant' })
  })

  test('reutilizar un code revoca los tokens emitidos con él', async ({ client }) => {
    const user = await createUser()
    const { verifier, challenge } = pkce()
    const code = await getCode(client, user, challenge)
    const form = {
      grant_type: 'authorization_code',
      client_id: FLUTTER_CLIENT.id,
      code,
      redirect_uri: REDIRECT,
      code_verifier: verifier,
    }

    const first = await client.post('/oauth/token').form(form)
    first.assertStatus(200)

    const second = await client.post('/oauth/token').form(form)
    second.assertStatus(400)
    second.assertBodyContains({ error: 'invalid_grant' })

    const me = await client.get('/api/v1/me').bearerToken(first.body().access_token)
    me.assertStatus(401)
  })

  test('refresh rota los tokens e invalida los anteriores', async ({ client, assert }) => {
    const user = await createUser()
    const tokens = await login(client, user)

    const res = await client.post('/oauth/token').form({
      grant_type: 'refresh_token',
      client_id: FLUTTER_CLIENT.id,
      refresh_token: tokens.refresh_token,
    })
    res.assertStatus(200)
    assert.notEqual(res.body().refresh_token, tokens.refresh_token)

    const oldToken = await getMe(client, tokens.access_token)
    oldToken.assertStatus(401)
    const newToken = await getMe(client, res.body().access_token)
    newToken.assertStatus(200)
  })

  test('reutilizar un refresh token rotado revoca toda la sesión', async ({ client }) => {
    const user = await createUser()
    const tokens = await login(client, user)
    const refresh = (token: string) =>
      client.post('/oauth/token').form({
        grant_type: 'refresh_token',
        client_id: FLUTTER_CLIENT.id,
        refresh_token: token,
      })

    const rotated = await refresh(tokens.refresh_token)
    rotated.assertStatus(200)

    // Un atacante usa el refresh token viejo
    const reuse = await refresh(tokens.refresh_token)
    reuse.assertStatus(400)
    reuse.assertBodyContains({ error: 'invalid_grant' })

    // Los tokens legítimos más recientes también quedan revocados
    const latestAccess = await getMe(client, rotated.body().access_token)
    latestAccess.assertStatus(401)
    const latestRefresh = await refresh(rotated.body().refresh_token!)
    latestRefresh.assertStatus(400)
  })

  test('grant_type no soportado y cliente desconocido', async ({ client }) => {
    const unsupported = await client
      .post('/oauth/token')
      .form({ grant_type: 'password', client_id: FLUTTER_CLIENT.id })
    unsupported.assertStatus(400)
    unsupported.assertBodyContains({ error: 'unsupported_grant_type' })

    const unknown = await client
      .post('/oauth/token')
      .form({ grant_type: 'authorization_code', client_id: 'no-existe' })
    unknown.assertStatus(401)
    unknown.assertBodyContains({ error: 'invalid_client' })
  })
})

test.group('OAuth · revocación, introspección y API', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('revocar el refresh token cierra la sesión (logout)', async ({ client }) => {
    const user = await createUser()
    const tokens = await login(client, user)

    const res = await client.post('/oauth/revoke').form({
      client_id: FLUTTER_CLIENT.id,
      token: tokens.refresh_token,
      token_type_hint: 'refresh_token',
    })
    res.assertStatus(200)

    const afterLogout = await getMe(client, tokens.access_token)
    afterLogout.assertStatus(401)
  })

  test('revocar un token desconocido igual responde 200', async ({ client }) => {
    const res = await client
      .post('/oauth/revoke')
      .form({ client_id: FLUTTER_CLIENT.id, token: 'pl_rt_inventado' })
    res.assertStatus(200)
  })

  test('introspección solo para clientes confidenciales', async ({ client, assert }) => {
    const user = await createUser()
    const tokens = await login(client, user)

    const publicClient = await client
      .post('/oauth/introspect')
      .form({ client_id: FLUTTER_CLIENT.id, token: tokens.access_token })
    publicClient.assertStatus(401)

    const { secret } = await oauthServer.createClient({
      id: 'servidor-juego',
      name: 'Servidor de juego',
      redirectUris: [],
      confidential: true,
    })

    const res = await client
      .post('/oauth/introspect')
      .basicAuth('servidor-juego', secret!)
      .form({ token: tokens.access_token })
    res.assertStatus(200)
    assert.containsSubset(res.body(), {
      active: true,
      client_id: FLUTTER_CLIENT.id,
      sub: String(user.id),
      scope: 'profile game',
    })

    const wrongSecret = await client
      .post('/oauth/introspect')
      .basicAuth('servidor-juego', 'incorrecto')
      .form({ token: tokens.access_token })
    wrongSecret.assertStatus(401)
  })

  test('la API exige token y scope', async ({ client, assert }) => {
    const anonymous = await client.get('/api/v1/me')
    anonymous.assertStatus(401)
    anonymous.assertHeader('www-authenticate', 'Bearer realm="poker-latino"')
    assert.deepEqual(anonymous.body(), {
      error: 'invalid_token',
      error_description: 'Access token ausente, inválido o expirado',
    })

    const invalid = await client.get('/api/v1/me').bearerToken('pl_at_falso')
    invalid.assertStatus(401)

    const user = await createUser()
    const { token } = await oauthServer.issueTestToken(user, ['game'])
    const noScope = await client.get('/api/v1/me').bearerToken(token)
    noScope.assertStatus(403)
    noScope.assertBodyContains({ error: 'insufficient_scope' })
  })

  test('metadata de discovery (RFC 8414)', async ({ client }) => {
    const res = await client.get('/.well-known/oauth-authorization-server')
    res.assertStatus(200)
    res.assertBodyContains({
      issuer: oauthConfig.issuer,
      code_challenge_methods_supported: ['S256'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
    })
  })
})
