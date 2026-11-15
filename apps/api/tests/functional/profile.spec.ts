import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import testUtils from '@adonisjs/core/services/test_utils'
import User from '#models/user'
import Room from '#models/room'
import accountService from '#services/game/account_service'
import roomService from '#services/game/room_service'
import oauthServer from '#services/oauth/oauth_server'
import tableManager from '#game/table_manager'

let counter = 0
function createPlayer(username = `perfil${++counter}`) {
  return accountService.register({
    username,
    email: `${username.toLowerCase()}@pokerlatino.test`,
    password: 'secreto123',
    birthDate: DateTime.fromISO('1990-05-20'),
  })
}

async function tokenFor(user: User, scopes = ['profile', 'game']) {
  const { token } = await oauthServer.issueTestToken(user, scopes)
  return token
}

test.group('Perfil · nombre de usuario y avatar', (group) => {
  group.each.setup(() => {
    tableManager.reset()
    return testUtils.db().withGlobalTransaction()
  })

  test('GET /me incluye nombre, nombre visible y avatar', async ({ client }) => {
    const user = await createPlayer('Pepito')
    const res = await client.get('/api/v1/me').bearerToken(await tokenFor(user))
    res.assertStatus(200)
    res.assertBodyContains({
      data: { id: user.id, username: 'Pepito', displayName: 'Pepito', avatar: null },
    })
  })

  test('cuentas sin nombre de usuario se muestran como "Jugador #id"', async ({ client }) => {
    const user = await User.create({
      email: 'antiguo@pokerlatino.test',
      password: 'secreto123',
      birthDate: DateTime.fromISO('1990-05-20'),
    })
    const res = await client.get('/api/v1/me').bearerToken(await tokenFor(user))
    res.assertBodyContains({ data: { username: null, displayName: `Jugador #${user.id}` } })
  })

  test('PATCH /me cambia el nombre de usuario y el avatar', async ({ client, assert }) => {
    const user = await createPlayer()
    const res = await client
      .patch('/api/v1/me')
      .bearerToken(await tokenFor(user))
      .json({ username: '  ElJaguar ', avatar: 'jaguar' })
    res.assertStatus(200)
    res.assertBodyContains({
      data: { username: 'ElJaguar', displayName: 'ElJaguar', avatar: 'jaguar' },
    })

    await user.refresh()
    assert.equal(user.username, 'ElJaguar')
    assert.equal(user.avatar, 'jaguar')

    // null vuelve al avatar al azar; omitir un campo no lo cambia
    const reset = await client
      .patch('/api/v1/me')
      .bearerToken(await tokenFor(user))
      .json({ avatar: null })
    reset.assertStatus(200)
    reset.assertBodyContains({ data: { username: 'ElJaguar', avatar: null } })
  })

  test('se puede elegir un avatar de personaje', async ({ client }) => {
    const user = await createPlayer()
    const res = await client
      .patch('/api/v1/me')
      .bearerToken(await tokenFor(user))
      .json({ avatar: 'catrina' })
    res.assertStatus(200)
    res.assertBodyContains({ data: { avatar: 'catrina' } })
  })

  test('rechaza avatares que no existen y nombres inválidos', async ({ client }) => {
    const user = await createPlayer()
    const token = await tokenFor(user)

    const avatar = await client.patch('/api/v1/me').bearerToken(token).json({ avatar: 'dragon' })
    avatar.assertStatus(422)
    avatar.assertBodyContains({ errors: [{ field: 'avatar', message: 'Ese avatar no existe' }] })

    for (const username of ['ab', 'nombre con espacios', 'x'.repeat(21), 'hola!']) {
      const res = await client.patch('/api/v1/me').bearerToken(token).json({ username })
      res.assertStatus(422)
    }
    const spaces = await client
      .patch('/api/v1/me')
      .bearerToken(token)
      .json({ username: 'con espacio' })
    spaces.assertBodyContains({
      errors: [
        {
          field: 'username',
          message: 'Usa solo letras, números, punto, guion o guion bajo (sin espacios)',
        },
      ],
    })

    // Acentos y ñ sí están permitidos
    const accents = await client
      .patch('/api/v1/me')
      .bearerToken(token)
      .json({ username: 'Peña_Ávila' })
    accents.assertStatus(200)
  })

  test('el nombre de usuario es único sin distinguir mayúsculas', async ({ client }) => {
    await createPlayer('Tiburon')
    const other = await createPlayer()
    const token = await tokenFor(other)

    const taken = await client.patch('/api/v1/me').bearerToken(token).json({ username: 'TIBURON' })
    taken.assertStatus(422)
    taken.assertBodyContains({
      errors: [{ field: 'username', message: 'Ese nombre de usuario ya está en uso' }],
    })

    // Conservar (o cambiar mayúsculas de) el propio nombre está permitido
    const own = await createPlayer('Delfin')
    const same = await client
      .patch('/api/v1/me')
      .bearerToken(await tokenFor(own))
      .json({ username: 'DELFIN' })
    same.assertStatus(200)
    same.assertBodyContains({ data: { username: 'DELFIN' } })
  })

  test('el registro exige un nombre de usuario libre', async ({ client, assert }) => {
    await createPlayer('Ocupado')
    const register = (username?: string) =>
      client
        .post('/oauth/register')
        .form({
          ...(username ? { username } : {}),
          email: 'registro@pokerlatino.test',
          password: 'secreto123',
          password_confirmation: 'secreto123',
          birth_date: '1990-05-20',
        })
        .withCsrfToken()
        .redirects(0)

    const missing = await register()
    missing.assertFlashMessage('inputErrorsBag', { username: ['Este campo es obligatorio'] })

    const taken = await register('ocupado')
    taken.assertFlashMessage('inputErrorsBag', {
      username: ['Ese nombre de usuario ya está en uso'],
    })
    assert.isNull(await User.findBy('email', 'registro@pokerlatino.test'))
  })

  test('PATCH /me requiere el scope "profile"', async ({ client }) => {
    const user = await createPlayer()
    const res = await client
      .patch('/api/v1/me')
      .bearerToken(await tokenFor(user, ['game']))
      .json({ avatar: 'jaguar' })
    res.assertStatus(403)
  })

  test('la mesa y la sala muestran el nombre y el avatar del jugador', async ({ client }) => {
    const room = await Room.findByOrFail('slug', 'principiantes-1')
    const player = await createPlayer('Mariachi_77')
    player.avatar = 'mariachi'
    await player.save()
    await roomService.sit(player, room.id, { buyIn: 500, seatNumber: 1 })

    const viewer = await createPlayer()
    const token = await tokenFor(viewer)

    const state = await client.get(`/api/v1/rooms/${room.id}/state`).bearerToken(token)
    state.assertStatus(200)
    state.assertBodyContains({
      data: {
        seats: [{ player: { id: player.id, displayName: 'Mariachi_77', avatar: 'mariachi' } }],
      },
    })

    const show = await client.get(`/api/v1/rooms/${room.id}`).bearerToken(token)
    show.assertStatus(200)
  })
})
