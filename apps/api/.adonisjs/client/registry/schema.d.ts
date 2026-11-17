/* eslint-disable prettier/prettier */
/// <reference path="../manifest.d.ts" />

import type { ExtractBody, ExtractErrorResponse, ExtractQuery, ExtractQueryForGet, ExtractRawResponse, ExtractResponse, Method, PathWithRegistry, PatternsByMethod, RouteWithRegistry } from '@tuyau/core/types'
import type { InferInput, SimpleError } from '@vinejs/vine/types'
import type { routes } from './index.ts'

export type ParamValue = string | number | bigint | boolean

export interface Registry {
  'invite': {
    methods: ["GET","HEAD"]
    pattern: '/r/:code'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { code: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/invite_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/invite_controller').default['show']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/invite_controller').default['show']>>>
    }
  }
  'auth.register': {
    methods: ["POST"]
    pattern: '/api/v1/auth/register'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/user').registerValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/user').registerValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/auth_controller').default['register']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/auth_controller').default['register']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/auth_controller').default['register']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'auth.login': {
    methods: ["POST"]
    pattern: '/api/v1/auth/login'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/user').loginValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/user').loginValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/auth_controller').default['login']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/auth_controller').default['login']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/auth_controller').default['login']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'auth.logout': {
    methods: ["DELETE"]
    pattern: '/api/v1/auth/logout'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/auth_controller').default['logout']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/auth_controller').default['logout']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/auth_controller').default['logout']>>>
    }
  }
  'me': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/me'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/profile_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/profile_controller').default['show']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/profile_controller').default['show']>>>
    }
  }
  'me.update': {
    methods: ["PATCH"]
    pattern: '/api/v1/me'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/user').updateProfileValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/user').updateProfileValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/profile_controller').default['update']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/profile_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/profile_controller').default['update']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'game.config': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/game/config'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/game/config_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/game/config_controller').default['show']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/game/config_controller').default['show']>>>
    }
  }
  'wallet.show': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/wallet'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/game/wallets_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/game/wallets_controller').default['show']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/game/wallets_controller').default['show']>>>
    }
  }
  'wallet.transactions': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/wallet/transactions'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: ExtractQueryForGet<InferInput<(typeof import('#validators/game').transactionsValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/game/wallets_controller').default['transactions']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/game/wallets_controller').default['transactions']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/game/wallets_controller').default['transactions']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'wallet.rescue': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/wallet/rescue'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/game/wallets_controller').default['rescue']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/game/wallets_controller').default['rescue']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/game/wallets_controller').default['rescue']>>>
    }
  }
  'wallet.rescue.claim': {
    methods: ["POST"]
    pattern: '/api/v1/wallet/rescue'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/game/wallets_controller').default['claimRescue']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/game/wallets_controller').default['claimRescue']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/game/wallets_controller').default['claimRescue']>>>
    }
  }
  'referrals.show': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/referrals'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/game/referrals_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/game/referrals_controller').default['show']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/game/referrals_controller').default['show']>>>
    }
  }
  'levels.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/levels'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/game/levels_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/game/levels_controller').default['index']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/game/levels_controller').default['index']>>>
    }
  }
  'levels.seat': {
    methods: ["POST"]
    pattern: '/api/v1/levels/:id/seat'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/game').quickSeatValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/game').quickSeatValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/game/levels_controller').default['seat']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/game/levels_controller').default['seat']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/game/levels_controller').default['seat']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'rooms.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/rooms'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/game/rooms_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/game/rooms_controller').default['index']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/game/rooms_controller').default['index']>>>
    }
  }
  'rooms.show': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/rooms/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/game/rooms_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/game/rooms_controller').default['show']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/game/rooms_controller').default['show']>>>
    }
  }
  'rooms.sit': {
    methods: ["POST"]
    pattern: '/api/v1/rooms/:id/seat'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/game').sitValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/game').sitValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/game/rooms_controller').default['sit']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/game/rooms_controller').default['sit']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/game/rooms_controller').default['sit']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'rooms.leave': {
    methods: ["DELETE"]
    pattern: '/api/v1/rooms/:id/seat'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/game/rooms_controller').default['leave']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/game/rooms_controller').default['leave']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/game/rooms_controller').default['leave']>>>
    }
  }
  'rooms.state': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/rooms/:id/state'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQueryForGet<InferInput<(typeof import('#validators/game').tableStateValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/game/tables_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/game/tables_controller').default['show']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/game/tables_controller').default['show']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'rooms.act': {
    methods: ["POST"]
    pattern: '/api/v1/rooms/:id/actions'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/game').tableActionValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/game').tableActionValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/game/tables_controller').default['act']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/game/tables_controller').default['act']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/game/tables_controller').default['act']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'rooms.show_cards': {
    methods: ["POST"]
    pattern: '/api/v1/rooms/:id/show'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/game').tableStateValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/game').tableStateValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/game/tables_controller').default['showCards']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/game/tables_controller').default['showCards']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/game/tables_controller').default['showCards']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'rooms.chat': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/rooms/:id/chat'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQueryForGet<InferInput<(typeof import('#validators/game').chatListValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/game/chat_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/game/chat_controller').default['index']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/game/chat_controller').default['index']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'rooms.chat.store': {
    methods: ["POST"]
    pattern: '/api/v1/rooms/:id/chat'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/game').chatMessageValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/game').chatMessageValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/game/chat_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/game/chat_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/game/chat_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'me.stats': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/me/stats'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/game/stats_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/game/stats_controller').default['show']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/game/stats_controller').default['show']>>>
    }
  }
  'me.progress': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/me/progress'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/game/progress_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/game/progress_controller').default['show']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/game/progress_controller').default['show']>>>
    }
  }
  'me.progress.seen': {
    methods: ["POST"]
    pattern: '/api/v1/me/progress/seen'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/game/progress_controller').default['seen']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/game/progress_controller').default['seen']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/game/progress_controller').default['seen']>>>
    }
  }
  'players.show': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/players/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/game/progress_controller').default['player']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/game/progress_controller').default['player']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/game/progress_controller').default['player']>>>
    }
  }
  'inbox': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/inbox'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/game/invitations_controller').default['inbox']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/game/invitations_controller').default['inbox']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/game/invitations_controller').default['inbox']>>>
    }
  }
  'players.search': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/players'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: ExtractQueryForGet<InferInput<(typeof import('#validators/game').playerSearchValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/game/friends_controller').default['search']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/game/friends_controller').default['search']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/game/friends_controller').default['search']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'friends.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/friends'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: ExtractQueryForGet<InferInput<(typeof import('#validators/game').friendsListValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/game/friends_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/game/friends_controller').default['index']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/game/friends_controller').default['index']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'friends.destroy': {
    methods: ["DELETE"]
    pattern: '/api/v1/friends/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/game/friends_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/game/friends_controller').default['destroy']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/game/friends_controller').default['destroy']>>>
    }
  }
  'friends.requests.store': {
    methods: ["POST"]
    pattern: '/api/v1/friends/requests'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/game').friendRequestValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/game').friendRequestValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/game/friends_controller').default['request']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/game/friends_controller').default['request']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/game/friends_controller').default['request']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'friends.requests.accept': {
    methods: ["POST"]
    pattern: '/api/v1/friends/requests/:id/accept'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/game/friends_controller').default['accept']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/game/friends_controller').default['accept']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/game/friends_controller').default['accept']>>>
    }
  }
  'friends.requests.dismiss': {
    methods: ["DELETE"]
    pattern: '/api/v1/friends/requests/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/game/friends_controller').default['dismiss']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/game/friends_controller').default['dismiss']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/game/friends_controller').default['dismiss']>>>
    }
  }
  'rooms.invitations.store': {
    methods: ["POST"]
    pattern: '/api/v1/rooms/:id/invitations'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/game').friendRequestValidator)>>
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: ExtractQuery<InferInput<(typeof import('#validators/game').friendRequestValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/game/invitations_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/game/invitations_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/game/invitations_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'invitations.accept': {
    methods: ["POST"]
    pattern: '/api/v1/invitations/:id/accept'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/game/invitations_controller').default['accept']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/game/invitations_controller').default['accept']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/game/invitations_controller').default['accept']>>>
    }
  }
  'invitations.decline': {
    methods: ["DELETE"]
    pattern: '/api/v1/invitations/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/game/invitations_controller').default['decline']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/game/invitations_controller').default['decline']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/game/invitations_controller').default['decline']>>>
    }
  }
  'tournaments.index': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/tournaments'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/game/tournaments_controller').default['index']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/game/tournaments_controller').default['index']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/game/tournaments_controller').default['index']>>>
    }
  }
  'tournaments.show': {
    methods: ["GET","HEAD"]
    pattern: '/api/v1/tournaments/:id'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/game/tournaments_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/game/tournaments_controller').default['show']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/game/tournaments_controller').default['show']>>>
    }
  }
  'tournaments.register': {
    methods: ["POST"]
    pattern: '/api/v1/tournaments/:id/entry'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/game/tournaments_controller').default['register']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/game/tournaments_controller').default['register']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/game/tournaments_controller').default['register']>>>
    }
  }
  'tournaments.unregister': {
    methods: ["DELETE"]
    pattern: '/api/v1/tournaments/:id/entry'
    types: {
      body: {}
      paramsTuple: [ParamValue]
      params: { id: ParamValue }
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/game/tournaments_controller').default['unregister']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/game/tournaments_controller').default['unregister']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/game/tournaments_controller').default['unregister']>>>
    }
  }
}

export namespace Route {
  export type Request<Name extends keyof typeof routes> = RouteWithRegistry.Request<typeof routes, Name>
  export type Response<Name extends keyof typeof routes> = RouteWithRegistry.Response<typeof routes, Name>
  export type Params<Name extends keyof typeof routes> = RouteWithRegistry.Params<typeof routes, Name>
  export type Body<Name extends keyof typeof routes> = RouteWithRegistry.Body<typeof routes, Name>
  export type Query<Name extends keyof typeof routes> = RouteWithRegistry.Query<typeof routes, Name>
  export type Error<Name extends keyof typeof routes> = RouteWithRegistry.Error<typeof routes, Name>
}

export namespace Path {
  export type Request<M extends Method, P extends PatternsByMethod<typeof routes, M>> =
    PathWithRegistry.Request<typeof routes, M, P>
  export type Response<M extends Method, P extends PatternsByMethod<typeof routes, M>> =
    PathWithRegistry.Response<typeof routes, M, P>
  export type Params<M extends Method, P extends PatternsByMethod<typeof routes, M>> =
    PathWithRegistry.Params<typeof routes, M, P>
  export type Body<M extends Method, P extends PatternsByMethod<typeof routes, M>> =
    PathWithRegistry.Body<typeof routes, M, P>
  export type Query<M extends Method, P extends PatternsByMethod<typeof routes, M>> =
    PathWithRegistry.Query<typeof routes, M, P>
  export type Error<M extends Method, P extends PatternsByMethod<typeof routes, M>> =
    PathWithRegistry.Error<typeof routes, M, P>
}
