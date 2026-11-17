/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
*/

import { middleware } from '#start/kernel'
import router from '@adonisjs/core/services/router'
import db from '@adonisjs/lucid/services/db'
import { controllers } from '#generated/controllers'

// Con la app web compilada en public/, "/" sirve la app (middleware de estáticos) y
// esta ruta solo responde si no hay build web
const apiInfo = () => ({ name: 'Poker Latino API', version: 'v1' })
router.get('/', apiInfo)
router.get('/api', apiInfo)

// Enlace de invitación: recuerda el código y lleva a la app
router.get('/r/:code', [controllers.Invite, 'show']).as('invite')

router.get('/health', async ({ response }) => {
  try {
    await db.rawQuery('select 1')
    return { status: 'ok', database: 'up' }
  } catch {
    return response.serviceUnavailable({ status: 'error', database: 'down' })
  }
})

/*
|--------------------------------------------------------------------------
| Cuentas: registro e inicio de sesión (devuelven el access token)
|--------------------------------------------------------------------------
*/
router
  .group(() => {
    router.post('register', [controllers.Auth, 'register']).as('register')
    router.post('login', [controllers.Auth, 'login']).as('login')
    router.delete('logout', [controllers.Auth, 'logout']).as('logout').use(middleware.auth())
  })
  .prefix('/api/v1/auth')
  .as('auth')

/*
|--------------------------------------------------------------------------
| API (requiere access token)
|--------------------------------------------------------------------------
*/
router
  .group(() => {
    router.get('me', [controllers.Profile, 'show']).as('me')
    router.patch('me', [controllers.Profile, 'update']).as('me.update')

    router
      .group(() => {
        router.get('game/config', [controllers.game.Config, 'show']).as('game.config')

        router.get('wallet', [controllers.game.Wallets, 'show']).as('wallet.show')
        router
          .get('wallet/transactions', [controllers.game.Wallets, 'transactions'])
          .as('wallet.transactions')
        router.get('wallet/rescue', [controllers.game.Wallets, 'rescue']).as('wallet.rescue')
        router
          .post('wallet/rescue', [controllers.game.Wallets, 'claimRescue'])
          .as('wallet.rescue.claim')
        router.get('referrals', [controllers.game.Referrals, 'show']).as('referrals.show')

        router.get('levels', [controllers.game.Levels, 'index']).as('levels.index')
        router.post('levels/:id/seat', [controllers.game.Levels, 'seat']).as('levels.seat')
        router.get('rooms', [controllers.game.Rooms, 'index']).as('rooms.index')
        router.get('rooms/:id', [controllers.game.Rooms, 'show']).as('rooms.show')
        router.post('rooms/:id/seat', [controllers.game.Rooms, 'sit']).as('rooms.sit')
        router.delete('rooms/:id/seat', [controllers.game.Rooms, 'leave']).as('rooms.leave')
        router.get('rooms/:id/state', [controllers.game.Tables, 'show']).as('rooms.state')
        router.post('rooms/:id/actions', [controllers.game.Tables, 'act']).as('rooms.act')
        router.post('rooms/:id/show', [controllers.game.Tables, 'showCards']).as('rooms.show_cards')
        router.get('rooms/:id/chat', [controllers.game.Chat, 'index']).as('rooms.chat')
        router.post('rooms/:id/chat', [controllers.game.Chat, 'store']).as('rooms.chat.store')

        router.get('me/stats', [controllers.game.Stats, 'show']).as('me.stats')
        router.get('me/progress', [controllers.game.Progress, 'show']).as('me.progress')
        router.post('me/progress/seen', [controllers.game.Progress, 'seen']).as('me.progress.seen')
        router.get('players/:id', [controllers.game.Progress, 'player']).as('players.show')

        // Amigos e invitaciones a la mesa
        router.get('inbox', [controllers.game.Invitations, 'inbox']).as('inbox')
        router.get('players', [controllers.game.Friends, 'search']).as('players.search')
        router.get('friends', [controllers.game.Friends, 'index']).as('friends.index')
        router.delete('friends/:id', [controllers.game.Friends, 'destroy']).as('friends.destroy')
        router
          .post('friends/requests', [controllers.game.Friends, 'request'])
          .as('friends.requests.store')
        router
          .post('friends/requests/:id/accept', [controllers.game.Friends, 'accept'])
          .as('friends.requests.accept')
        router
          .delete('friends/requests/:id', [controllers.game.Friends, 'dismiss'])
          .as('friends.requests.dismiss')
        router
          .post('rooms/:id/invitations', [controllers.game.Invitations, 'store'])
          .as('rooms.invitations.store')
        router
          .post('invitations/:id/accept', [controllers.game.Invitations, 'accept'])
          .as('invitations.accept')
        router
          .delete('invitations/:id', [controllers.game.Invitations, 'decline'])
          .as('invitations.decline')

        router.get('tournaments', [controllers.game.Tournaments, 'index']).as('tournaments.index')
        router.get('tournaments/:id', [controllers.game.Tournaments, 'show']).as('tournaments.show')
        router
          .post('tournaments/:id/entry', [controllers.game.Tournaments, 'register'])
          .as('tournaments.register')
        router
          .delete('tournaments/:id/entry', [controllers.game.Tournaments, 'unregister'])
          .as('tournaments.unregister')
      })
      .where('id', router.matchers.number())
  })
  .prefix('/api/v1')
  .use(middleware.auth())
