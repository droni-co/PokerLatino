/* eslint-disable prettier/prettier */
import type { AdonisEndpoint } from '@tuyau/core/types'
import type { Registry } from './schema.d.ts'
import type { ApiDefinition } from './tree.d.ts'

export type { Route, Path } from './schema.d.ts'

const placeholder: any = {}

const routes = {
  'token.metadata': {
    methods: ["GET","HEAD"],
    pattern: '/.well-known/oauth-authorization-server',
    tokens: [[0,".well-known"],[0,"oauth-authorization-server"]],
    types: placeholder as Registry['token.metadata']['types'],
  },
  'oauth.authorize': {
    methods: ["GET","HEAD"],
    pattern: '/oauth/authorize',
    tokens: [[0,"oauth"],[0,"authorize"]],
    types: placeholder as Registry['oauth.authorize']['types'],
  },
  'oauth.authorize.decide': {
    methods: ["POST"],
    pattern: '/oauth/authorize',
    tokens: [[0,"oauth"],[0,"authorize"]],
    types: placeholder as Registry['oauth.authorize.decide']['types'],
  },
  'oauth.login': {
    methods: ["GET","HEAD"],
    pattern: '/oauth/login',
    tokens: [[0,"oauth"],[0,"login"]],
    types: placeholder as Registry['oauth.login']['types'],
  },
  'oauth.login.store': {
    methods: ["POST"],
    pattern: '/oauth/login',
    tokens: [[0,"oauth"],[0,"login"]],
    types: placeholder as Registry['oauth.login.store']['types'],
  },
  'oauth.logout': {
    methods: ["POST"],
    pattern: '/oauth/logout',
    tokens: [[0,"oauth"],[0,"logout"]],
    types: placeholder as Registry['oauth.logout']['types'],
  },
  'oauth.register': {
    methods: ["GET","HEAD"],
    pattern: '/oauth/register',
    tokens: [[0,"oauth"],[0,"register"]],
    types: placeholder as Registry['oauth.register']['types'],
  },
  'oauth.register.store': {
    methods: ["POST"],
    pattern: '/oauth/register',
    tokens: [[0,"oauth"],[0,"register"]],
    types: placeholder as Registry['oauth.register.store']['types'],
  },
  'oauth.token': {
    methods: ["POST"],
    pattern: '/oauth/token',
    tokens: [[0,"oauth"],[0,"token"]],
    types: placeholder as Registry['oauth.token']['types'],
  },
  'oauth.revoke': {
    methods: ["POST"],
    pattern: '/oauth/revoke',
    tokens: [[0,"oauth"],[0,"revoke"]],
    types: placeholder as Registry['oauth.revoke']['types'],
  },
  'oauth.introspect': {
    methods: ["POST"],
    pattern: '/oauth/introspect',
    tokens: [[0,"oauth"],[0,"introspect"]],
    types: placeholder as Registry['oauth.introspect']['types'],
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
