import '@adonisjs/core/types/http'

type ParamValue = string | number | bigint | boolean

export type ScannedRoutes = {
  ALL: {
    'token.metadata': { paramsTuple?: []; params?: {} }
    'oauth.authorize': { paramsTuple?: []; params?: {} }
    'oauth.authorize.decide': { paramsTuple?: []; params?: {} }
    'oauth.login': { paramsTuple?: []; params?: {} }
    'oauth.login.store': { paramsTuple?: []; params?: {} }
    'oauth.logout': { paramsTuple?: []; params?: {} }
    'oauth.register': { paramsTuple?: []; params?: {} }
    'oauth.register.store': { paramsTuple?: []; params?: {} }
    'oauth.token': { paramsTuple?: []; params?: {} }
    'oauth.revoke': { paramsTuple?: []; params?: {} }
    'oauth.introspect': { paramsTuple?: []; params?: {} }
    'me': { paramsTuple?: []; params?: {} }
    'me.update': { paramsTuple?: []; params?: {} }
    'game.config': { paramsTuple?: []; params?: {} }
    'wallet.show': { paramsTuple?: []; params?: {} }
    'wallet.transactions': { paramsTuple?: []; params?: {} }
    'levels.index': { paramsTuple?: []; params?: {} }
    'levels.seat': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'rooms.index': { paramsTuple?: []; params?: {} }
    'rooms.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'rooms.sit': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'rooms.leave': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'rooms.state': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'rooms.act': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'rooms.show_cards': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'rooms.chat': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'rooms.chat.store': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'me.stats': { paramsTuple?: []; params?: {} }
  }
  GET: {
    'token.metadata': { paramsTuple?: []; params?: {} }
    'oauth.authorize': { paramsTuple?: []; params?: {} }
    'oauth.login': { paramsTuple?: []; params?: {} }
    'oauth.register': { paramsTuple?: []; params?: {} }
    'me': { paramsTuple?: []; params?: {} }
    'game.config': { paramsTuple?: []; params?: {} }
    'wallet.show': { paramsTuple?: []; params?: {} }
    'wallet.transactions': { paramsTuple?: []; params?: {} }
    'levels.index': { paramsTuple?: []; params?: {} }
    'rooms.index': { paramsTuple?: []; params?: {} }
    'rooms.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'rooms.state': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'rooms.chat': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'me.stats': { paramsTuple?: []; params?: {} }
  }
  HEAD: {
    'token.metadata': { paramsTuple?: []; params?: {} }
    'oauth.authorize': { paramsTuple?: []; params?: {} }
    'oauth.login': { paramsTuple?: []; params?: {} }
    'oauth.register': { paramsTuple?: []; params?: {} }
    'me': { paramsTuple?: []; params?: {} }
    'game.config': { paramsTuple?: []; params?: {} }
    'wallet.show': { paramsTuple?: []; params?: {} }
    'wallet.transactions': { paramsTuple?: []; params?: {} }
    'levels.index': { paramsTuple?: []; params?: {} }
    'rooms.index': { paramsTuple?: []; params?: {} }
    'rooms.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'rooms.state': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'rooms.chat': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'me.stats': { paramsTuple?: []; params?: {} }
  }
  POST: {
    'oauth.authorize.decide': { paramsTuple?: []; params?: {} }
    'oauth.login.store': { paramsTuple?: []; params?: {} }
    'oauth.logout': { paramsTuple?: []; params?: {} }
    'oauth.register.store': { paramsTuple?: []; params?: {} }
    'oauth.token': { paramsTuple?: []; params?: {} }
    'oauth.revoke': { paramsTuple?: []; params?: {} }
    'oauth.introspect': { paramsTuple?: []; params?: {} }
    'levels.seat': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'rooms.sit': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'rooms.act': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'rooms.show_cards': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'rooms.chat.store': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
  PATCH: {
    'me.update': { paramsTuple?: []; params?: {} }
  }
  DELETE: {
    'rooms.leave': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
}
declare module '@adonisjs/core/types/http' {
  export interface RoutesList extends ScannedRoutes {}
}