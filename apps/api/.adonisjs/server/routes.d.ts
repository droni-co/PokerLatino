import '@adonisjs/core/types/http'

type ParamValue = string | number | bigint | boolean

export type ScannedRoutes = {
  ALL: {
    'invite': { paramsTuple: [ParamValue]; params: {'code': ParamValue} }
    'auth.register': { paramsTuple?: []; params?: {} }
    'auth.login': { paramsTuple?: []; params?: {} }
    'auth.logout': { paramsTuple?: []; params?: {} }
    'me': { paramsTuple?: []; params?: {} }
    'me.update': { paramsTuple?: []; params?: {} }
    'game.config': { paramsTuple?: []; params?: {} }
    'wallet.show': { paramsTuple?: []; params?: {} }
    'wallet.transactions': { paramsTuple?: []; params?: {} }
    'wallet.rescue': { paramsTuple?: []; params?: {} }
    'wallet.rescue.claim': { paramsTuple?: []; params?: {} }
    'referrals.show': { paramsTuple?: []; params?: {} }
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
    'me.progress': { paramsTuple?: []; params?: {} }
    'me.progress.seen': { paramsTuple?: []; params?: {} }
    'players.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'inbox': { paramsTuple?: []; params?: {} }
    'players.search': { paramsTuple?: []; params?: {} }
    'friends.index': { paramsTuple?: []; params?: {} }
    'friends.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'friends.requests.store': { paramsTuple?: []; params?: {} }
    'friends.requests.accept': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'friends.requests.dismiss': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'rooms.invitations.store': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'invitations.accept': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'invitations.decline': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'tournaments.index': { paramsTuple?: []; params?: {} }
    'tournaments.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'tournaments.register': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'tournaments.unregister': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
  GET: {
    'invite': { paramsTuple: [ParamValue]; params: {'code': ParamValue} }
    'me': { paramsTuple?: []; params?: {} }
    'game.config': { paramsTuple?: []; params?: {} }
    'wallet.show': { paramsTuple?: []; params?: {} }
    'wallet.transactions': { paramsTuple?: []; params?: {} }
    'wallet.rescue': { paramsTuple?: []; params?: {} }
    'referrals.show': { paramsTuple?: []; params?: {} }
    'levels.index': { paramsTuple?: []; params?: {} }
    'rooms.index': { paramsTuple?: []; params?: {} }
    'rooms.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'rooms.state': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'rooms.chat': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'me.stats': { paramsTuple?: []; params?: {} }
    'me.progress': { paramsTuple?: []; params?: {} }
    'players.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'inbox': { paramsTuple?: []; params?: {} }
    'players.search': { paramsTuple?: []; params?: {} }
    'friends.index': { paramsTuple?: []; params?: {} }
    'tournaments.index': { paramsTuple?: []; params?: {} }
    'tournaments.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
  HEAD: {
    'invite': { paramsTuple: [ParamValue]; params: {'code': ParamValue} }
    'me': { paramsTuple?: []; params?: {} }
    'game.config': { paramsTuple?: []; params?: {} }
    'wallet.show': { paramsTuple?: []; params?: {} }
    'wallet.transactions': { paramsTuple?: []; params?: {} }
    'wallet.rescue': { paramsTuple?: []; params?: {} }
    'referrals.show': { paramsTuple?: []; params?: {} }
    'levels.index': { paramsTuple?: []; params?: {} }
    'rooms.index': { paramsTuple?: []; params?: {} }
    'rooms.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'rooms.state': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'rooms.chat': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'me.stats': { paramsTuple?: []; params?: {} }
    'me.progress': { paramsTuple?: []; params?: {} }
    'players.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'inbox': { paramsTuple?: []; params?: {} }
    'players.search': { paramsTuple?: []; params?: {} }
    'friends.index': { paramsTuple?: []; params?: {} }
    'tournaments.index': { paramsTuple?: []; params?: {} }
    'tournaments.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
  POST: {
    'auth.register': { paramsTuple?: []; params?: {} }
    'auth.login': { paramsTuple?: []; params?: {} }
    'wallet.rescue.claim': { paramsTuple?: []; params?: {} }
    'levels.seat': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'rooms.sit': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'rooms.act': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'rooms.show_cards': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'rooms.chat.store': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'me.progress.seen': { paramsTuple?: []; params?: {} }
    'friends.requests.store': { paramsTuple?: []; params?: {} }
    'friends.requests.accept': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'rooms.invitations.store': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'invitations.accept': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'tournaments.register': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
  DELETE: {
    'auth.logout': { paramsTuple?: []; params?: {} }
    'rooms.leave': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'friends.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'friends.requests.dismiss': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'invitations.decline': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'tournaments.unregister': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
  PATCH: {
    'me.update': { paramsTuple?: []; params?: {} }
  }
}
declare module '@adonisjs/core/types/http' {
  export interface RoutesList extends ScannedRoutes {}
}