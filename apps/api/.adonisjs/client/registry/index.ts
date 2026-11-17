/* eslint-disable prettier/prettier */
import type { AdonisEndpoint } from '@tuyau/core/types'
import type { Registry } from './schema.d.ts'
import type { ApiDefinition } from './tree.d.ts'

export type { Route, Path } from './schema.d.ts'

const placeholder: any = {}

const routes = {
  'invite': {
    methods: ["GET","HEAD"],
    pattern: '/r/:code',
    tokens: [[0,"r"],[1,"code"]],
    types: placeholder as Registry['invite']['types'],
  },
  'auth.register': {
    methods: ["POST"],
    pattern: '/api/v1/auth/register',
    tokens: [[0,"api"],[0,"v1"],[0,"auth"],[0,"register"]],
    types: placeholder as Registry['auth.register']['types'],
  },
  'auth.login': {
    methods: ["POST"],
    pattern: '/api/v1/auth/login',
    tokens: [[0,"api"],[0,"v1"],[0,"auth"],[0,"login"]],
    types: placeholder as Registry['auth.login']['types'],
  },
  'auth.logout': {
    methods: ["DELETE"],
    pattern: '/api/v1/auth/logout',
    tokens: [[0,"api"],[0,"v1"],[0,"auth"],[0,"logout"]],
    types: placeholder as Registry['auth.logout']['types'],
  },
  'me': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/me',
    tokens: [[0,"api"],[0,"v1"],[0,"me"]],
    types: placeholder as Registry['me']['types'],
  },
  'me.update': {
    methods: ["PATCH"],
    pattern: '/api/v1/me',
    tokens: [[0,"api"],[0,"v1"],[0,"me"]],
    types: placeholder as Registry['me.update']['types'],
  },
  'game.config': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/game/config',
    tokens: [[0,"api"],[0,"v1"],[0,"game"],[0,"config"]],
    types: placeholder as Registry['game.config']['types'],
  },
  'wallet.show': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/wallet',
    tokens: [[0,"api"],[0,"v1"],[0,"wallet"]],
    types: placeholder as Registry['wallet.show']['types'],
  },
  'wallet.transactions': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/wallet/transactions',
    tokens: [[0,"api"],[0,"v1"],[0,"wallet"],[0,"transactions"]],
    types: placeholder as Registry['wallet.transactions']['types'],
  },
  'wallet.rescue': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/wallet/rescue',
    tokens: [[0,"api"],[0,"v1"],[0,"wallet"],[0,"rescue"]],
    types: placeholder as Registry['wallet.rescue']['types'],
  },
  'wallet.rescue.claim': {
    methods: ["POST"],
    pattern: '/api/v1/wallet/rescue',
    tokens: [[0,"api"],[0,"v1"],[0,"wallet"],[0,"rescue"]],
    types: placeholder as Registry['wallet.rescue.claim']['types'],
  },
  'referrals.show': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/referrals',
    tokens: [[0,"api"],[0,"v1"],[0,"referrals"]],
    types: placeholder as Registry['referrals.show']['types'],
  },
  'levels.index': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/levels',
    tokens: [[0,"api"],[0,"v1"],[0,"levels"]],
    types: placeholder as Registry['levels.index']['types'],
  },
  'levels.seat': {
    methods: ["POST"],
    pattern: '/api/v1/levels/:id/seat',
    tokens: [[0,"api"],[0,"v1"],[0,"levels"],[1,"id"],[0,"seat"]],
    types: placeholder as Registry['levels.seat']['types'],
  },
  'rooms.index': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/rooms',
    tokens: [[0,"api"],[0,"v1"],[0,"rooms"]],
    types: placeholder as Registry['rooms.index']['types'],
  },
  'rooms.show': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/rooms/:id',
    tokens: [[0,"api"],[0,"v1"],[0,"rooms"],[1,"id"]],
    types: placeholder as Registry['rooms.show']['types'],
  },
  'rooms.sit': {
    methods: ["POST"],
    pattern: '/api/v1/rooms/:id/seat',
    tokens: [[0,"api"],[0,"v1"],[0,"rooms"],[1,"id"],[0,"seat"]],
    types: placeholder as Registry['rooms.sit']['types'],
  },
  'rooms.leave': {
    methods: ["DELETE"],
    pattern: '/api/v1/rooms/:id/seat',
    tokens: [[0,"api"],[0,"v1"],[0,"rooms"],[1,"id"],[0,"seat"]],
    types: placeholder as Registry['rooms.leave']['types'],
  },
  'rooms.state': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/rooms/:id/state',
    tokens: [[0,"api"],[0,"v1"],[0,"rooms"],[1,"id"],[0,"state"]],
    types: placeholder as Registry['rooms.state']['types'],
  },
  'rooms.act': {
    methods: ["POST"],
    pattern: '/api/v1/rooms/:id/actions',
    tokens: [[0,"api"],[0,"v1"],[0,"rooms"],[1,"id"],[0,"actions"]],
    types: placeholder as Registry['rooms.act']['types'],
  },
  'rooms.show_cards': {
    methods: ["POST"],
    pattern: '/api/v1/rooms/:id/show',
    tokens: [[0,"api"],[0,"v1"],[0,"rooms"],[1,"id"],[0,"show"]],
    types: placeholder as Registry['rooms.show_cards']['types'],
  },
  'rooms.chat': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/rooms/:id/chat',
    tokens: [[0,"api"],[0,"v1"],[0,"rooms"],[1,"id"],[0,"chat"]],
    types: placeholder as Registry['rooms.chat']['types'],
  },
  'rooms.chat.store': {
    methods: ["POST"],
    pattern: '/api/v1/rooms/:id/chat',
    tokens: [[0,"api"],[0,"v1"],[0,"rooms"],[1,"id"],[0,"chat"]],
    types: placeholder as Registry['rooms.chat.store']['types'],
  },
  'me.stats': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/me/stats',
    tokens: [[0,"api"],[0,"v1"],[0,"me"],[0,"stats"]],
    types: placeholder as Registry['me.stats']['types'],
  },
  'me.progress': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/me/progress',
    tokens: [[0,"api"],[0,"v1"],[0,"me"],[0,"progress"]],
    types: placeholder as Registry['me.progress']['types'],
  },
  'me.progress.seen': {
    methods: ["POST"],
    pattern: '/api/v1/me/progress/seen',
    tokens: [[0,"api"],[0,"v1"],[0,"me"],[0,"progress"],[0,"seen"]],
    types: placeholder as Registry['me.progress.seen']['types'],
  },
  'players.show': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/players/:id',
    tokens: [[0,"api"],[0,"v1"],[0,"players"],[1,"id"]],
    types: placeholder as Registry['players.show']['types'],
  },
  'inbox': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/inbox',
    tokens: [[0,"api"],[0,"v1"],[0,"inbox"]],
    types: placeholder as Registry['inbox']['types'],
  },
  'players.search': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/players',
    tokens: [[0,"api"],[0,"v1"],[0,"players"]],
    types: placeholder as Registry['players.search']['types'],
  },
  'friends.index': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/friends',
    tokens: [[0,"api"],[0,"v1"],[0,"friends"]],
    types: placeholder as Registry['friends.index']['types'],
  },
  'friends.destroy': {
    methods: ["DELETE"],
    pattern: '/api/v1/friends/:id',
    tokens: [[0,"api"],[0,"v1"],[0,"friends"],[1,"id"]],
    types: placeholder as Registry['friends.destroy']['types'],
  },
  'friends.requests.store': {
    methods: ["POST"],
    pattern: '/api/v1/friends/requests',
    tokens: [[0,"api"],[0,"v1"],[0,"friends"],[0,"requests"]],
    types: placeholder as Registry['friends.requests.store']['types'],
  },
  'friends.requests.accept': {
    methods: ["POST"],
    pattern: '/api/v1/friends/requests/:id/accept',
    tokens: [[0,"api"],[0,"v1"],[0,"friends"],[0,"requests"],[1,"id"],[0,"accept"]],
    types: placeholder as Registry['friends.requests.accept']['types'],
  },
  'friends.requests.dismiss': {
    methods: ["DELETE"],
    pattern: '/api/v1/friends/requests/:id',
    tokens: [[0,"api"],[0,"v1"],[0,"friends"],[0,"requests"],[1,"id"]],
    types: placeholder as Registry['friends.requests.dismiss']['types'],
  },
  'rooms.invitations.store': {
    methods: ["POST"],
    pattern: '/api/v1/rooms/:id/invitations',
    tokens: [[0,"api"],[0,"v1"],[0,"rooms"],[1,"id"],[0,"invitations"]],
    types: placeholder as Registry['rooms.invitations.store']['types'],
  },
  'invitations.accept': {
    methods: ["POST"],
    pattern: '/api/v1/invitations/:id/accept',
    tokens: [[0,"api"],[0,"v1"],[0,"invitations"],[1,"id"],[0,"accept"]],
    types: placeholder as Registry['invitations.accept']['types'],
  },
  'invitations.decline': {
    methods: ["DELETE"],
    pattern: '/api/v1/invitations/:id',
    tokens: [[0,"api"],[0,"v1"],[0,"invitations"],[1,"id"]],
    types: placeholder as Registry['invitations.decline']['types'],
  },
  'tournaments.index': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/tournaments',
    tokens: [[0,"api"],[0,"v1"],[0,"tournaments"]],
    types: placeholder as Registry['tournaments.index']['types'],
  },
  'tournaments.show': {
    methods: ["GET","HEAD"],
    pattern: '/api/v1/tournaments/:id',
    tokens: [[0,"api"],[0,"v1"],[0,"tournaments"],[1,"id"]],
    types: placeholder as Registry['tournaments.show']['types'],
  },
  'tournaments.register': {
    methods: ["POST"],
    pattern: '/api/v1/tournaments/:id/entry',
    tokens: [[0,"api"],[0,"v1"],[0,"tournaments"],[1,"id"],[0,"entry"]],
    types: placeholder as Registry['tournaments.register']['types'],
  },
  'tournaments.unregister': {
    methods: ["DELETE"],
    pattern: '/api/v1/tournaments/:id/entry',
    tokens: [[0,"api"],[0,"v1"],[0,"tournaments"],[1,"id"],[0,"entry"]],
    types: placeholder as Registry['tournaments.unregister']['types'],
  },
} as const satisfies Record<string, AdonisEndpoint>

export { routes }

export const registry = {
  routes,
  $tree: {} as ApiDefinition,
}

declare module '@tuyau/core/types' {
  export interface UserRegistry {
    routes: typeof routes
    $tree: ApiDefinition
  }
}
