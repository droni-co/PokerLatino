/* eslint-disable prettier/prettier */
import type { routes } from './index.ts'

export interface ApiDefinition {
  invite: typeof routes['invite']
  auth: {
    register: typeof routes['auth.register']
    login: typeof routes['auth.login']
    logout: typeof routes['auth.logout']
  }
  me: typeof routes['me'] & {
    update: typeof routes['me.update']
    stats: typeof routes['me.stats']
    progress: typeof routes['me.progress'] & {
      seen: typeof routes['me.progress.seen']
    }
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
    invitations: {
      store: typeof routes['rooms.invitations.store']
    }
  }
  players: {
    show: typeof routes['players.show']
    search: typeof routes['players.search']
  }
  inbox: typeof routes['inbox']
  friends: {
    index: typeof routes['friends.index']
    destroy: typeof routes['friends.destroy']
    requests: {
      store: typeof routes['friends.requests.store']
      accept: typeof routes['friends.requests.accept']
      dismiss: typeof routes['friends.requests.dismiss']
    }
  }
  invitations: {
    accept: typeof routes['invitations.accept']
    decline: typeof routes['invitations.decline']
  }
  tournaments: {
    index: typeof routes['tournaments.index']
    show: typeof routes['tournaments.show']
    register: typeof routes['tournaments.register']
    unregister: typeof routes['tournaments.unregister']
  }
}
