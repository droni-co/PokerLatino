/* eslint-disable prettier/prettier */
import type { routes } from './index.ts'

export interface ApiDefinition {
  invite: typeof routes['invite']
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
    update: typeof routes['me.update']
    stats: typeof routes['me.stats']
  }
  game: {
    config: typeof routes['game.config']
  }
  wallet: {
    show: typeof routes['wallet.show']
    transactions: typeof routes['wallet.transactions']
    rescue: typeof routes['wallet.rescue'] & {
      claim: typeof routes['wallet.rescue.claim']
    }
  }
  referrals: {
    show: typeof routes['referrals.show']
  }
  levels: {
    index: typeof routes['levels.index']
    seat: typeof routes['levels.seat']
  }
  rooms: {
    index: typeof routes['rooms.index']
    show: typeof routes['rooms.show']
    sit: typeof routes['rooms.sit']
    leave: typeof routes['rooms.leave']
    state: typeof routes['rooms.state']
    act: typeof routes['rooms.act']
    showCards: typeof routes['rooms.show_cards']
    chat: typeof routes['rooms.chat'] & {
      store: typeof routes['rooms.chat.store']
    }
  }
  tournaments: {
    index: typeof routes['tournaments.index']
    show: typeof routes['tournaments.show']
    register: typeof routes['tournaments.register']
    unregister: typeof routes['tournaments.unregister']
  }
}
