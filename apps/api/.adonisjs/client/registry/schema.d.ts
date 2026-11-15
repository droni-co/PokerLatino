/* eslint-disable prettier/prettier */
/// <reference path="../manifest.d.ts" />

import type { ExtractBody, ExtractErrorResponse, ExtractQuery, ExtractQueryForGet, ExtractRawResponse, ExtractResponse, Method, PathWithRegistry, PatternsByMethod, RouteWithRegistry } from '@tuyau/core/types'
import type { InferInput, SimpleError } from '@vinejs/vine/types'
import type { routes } from './index.ts'

export type ParamValue = string | number | bigint | boolean

export interface Registry {
  'token.metadata': {
    methods: ["GET","HEAD"]
    pattern: '/.well-known/oauth-authorization-server'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/oauth/token_controller').default['metadata']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/oauth/token_controller').default['metadata']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/oauth/token_controller').default['metadata']>>>
    }
  }
  'oauth.authorize': {
    methods: ["GET","HEAD"]
    pattern: '/oauth/authorize'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/oauth/authorize_controller').default['show']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/oauth/authorize_controller').default['show']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/oauth/authorize_controller').default['show']>>>
    }
  }
  'oauth.authorize.decide': {
    methods: ["POST"]
    pattern: '/oauth/authorize'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/oauth/authorize_controller').default['decide']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/oauth/authorize_controller').default['decide']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/oauth/authorize_controller').default['decide']>>>
    }
  }
  'oauth.login': {
    methods: ["GET","HEAD"]
    pattern: '/oauth/login'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/oauth/session_controller').default['create']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/oauth/session_controller').default['create']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/oauth/session_controller').default['create']>>>
    }
  }
  'oauth.login.store': {
    methods: ["POST"]
    pattern: '/oauth/login'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/user').loginValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/user').loginValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/oauth/session_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/oauth/session_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/oauth/session_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'oauth.logout': {
    methods: ["POST"]
    pattern: '/oauth/logout'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/oauth/session_controller').default['destroy']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/oauth/session_controller').default['destroy']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/oauth/session_controller').default['destroy']>>>
    }
  }
  'oauth.register': {
    methods: ["GET","HEAD"]
    pattern: '/oauth/register'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/oauth/register_controller').default['create']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/oauth/register_controller').default['create']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/oauth/register_controller').default['create']>>>
    }
  }
  'oauth.register.store': {
    methods: ["POST"]
    pattern: '/oauth/register'
    types: {
      body: ExtractBody<InferInput<(typeof import('#validators/user').registerValidator)>>
      paramsTuple: []
      params: {}
      query: ExtractQuery<InferInput<(typeof import('#validators/user').registerValidator)>>
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/oauth/register_controller').default['store']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/oauth/register_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/oauth/register_controller').default['store']>>> | { status: 422; response: { errors: SimpleError[] } }
    }
  }
  'oauth.token': {
    methods: ["POST"]
    pattern: '/oauth/token'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/oauth/token_controller').default['token']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/oauth/token_controller').default['token']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/oauth/token_controller').default['token']>>>
    }
  }
  'oauth.revoke': {
    methods: ["POST"]
    pattern: '/oauth/revoke'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/oauth/token_controller').default['revoke']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/oauth/token_controller').default['revoke']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/oauth/token_controller').default['revoke']>>>
    }
  }
  'oauth.introspect': {
    methods: ["POST"]
    pattern: '/oauth/introspect'
    types: {
      body: {}
      paramsTuple: []
      params: {}
      query: {}
      response: ExtractResponse<Awaited<ReturnType<import('#controllers/oauth/token_controller').default['introspect']>>>
      errorResponse: ExtractErrorResponse<Awaited<ReturnType<import('#controllers/oauth/token_controller').default['introspect']>>>
      rawResponse: ExtractRawResponse<Awaited<ReturnType<import('#controllers/oauth/token_controller').default['introspect']>>>
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
