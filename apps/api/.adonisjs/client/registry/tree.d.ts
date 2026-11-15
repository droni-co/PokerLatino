/* eslint-disable prettier/prettier */
import type { routes } from './index.ts'

export interface ApiDefinition {
  token: {
    metadata: typeof routes['token.metadata']
  }
  oauth: {
    authorize: typeof routes['oauth.authorize'] & {
      decide: typeof routes['oauth.authorize.decide']
    }
    login: typeof routes['oauth.login'] & {
      store: typeof routes['oauth.login.store']
    }
    logout: typeof routes['oauth.logout']
    register: typeof routes['oauth.register'] & {
      store: typeof routes['oauth.register.store']
    }
    token: typeof routes['oauth.token']
    revoke: typeof routes['oauth.revoke']
    introspect: typeof routes['oauth.introspect']
  }
  me: typeof routes['me'] & {
    stats: typeof routes['me.stats']
  }
  game: {
    config: typeof routes['game.config']
  }
  wallets: {
    index: typeof routes['wallets.index']
    transactions: typeof routes['wallets.transactions']
  }
  deposits: {
    store: typeof routes['deposits.store']
  }
  rooms: {
    index: typeof routes['rooms.index']
    show: typeof routes['rooms.show']
    sit: typeof routes['rooms.sit']
    leave: typeof routes['rooms.leave']
    state: typeof routes['rooms.state']
    act: typeof routes['rooms.act']
  }
}
