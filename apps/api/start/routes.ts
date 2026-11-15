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
| Servidor OAuth2
|--------------------------------------------------------------------------
| Páginas HTML (sesión del navegador): authorize, login, register, logout
| Endpoints máquina a máquina: token, revoke, introspect
*/
router.get('/.well-known/oauth-authorization-server', [controllers.oauth.Token, 'metadata'])

router
  .group(() => {
    router.get('authorize', [controllers.oauth.Authorize, 'show']).as('authorize')
    router.post('authorize', [controllers.oauth.Authorize, 'decide']).as('authorize.decide')

    router.get('login', [controllers.oauth.Session, 'create']).as('login')
    router.post('login', [controllers.oauth.Session, 'store']).as('login.store')
    router.post('logout', [controllers.oauth.Session, 'destroy']).as('logout')

    router.get('register', [controllers.oauth.Register, 'create']).as('register')
    router.post('register', [controllers.oauth.Register, 'store']).as('register.store')

    router.post('token', [controllers.oauth.Token, 'token']).as('token')
    router.post('revoke', [controllers.oauth.Token, 'revoke']).as('revoke')
    router.post('introspect', [controllers.oauth.Token, 'introspect']).as('introspect')
  })
  .prefix('/oauth')
  .as('oauth')

/*
|--------------------------------------------------------------------------
| API (requiere access token OAuth2)
|--------------------------------------------------------------------------
*/
router
  .group(() => {
    router
      .group(() => {
        router.get('me', [controllers.Profile, 'show']).as('me')
        router.patch('me', [controllers.Profile, 'update']).as('me.update')
      })
      .use(middleware.scope({ scopes: ['profile'] }))

    // Juego: requiere el scope "game"
    router
      .group(() => {
        router.get('game/config', [controllers.game.Config, 'show']).as('game.config')

        router.get('wallet', [controllers.game.Wallets, 'show']).as('wallet.show')
        router
          .get('wallet/transactions', [controllers.game.Wallets, 'transactions'])
          .as('wallet.transactions')

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
      })
      .where('id', router.matchers.number())
      .use(middleware.scope({ scopes: ['game'] }))
  })
  .prefix('/api/v1')
  .use(middleware.auth())
