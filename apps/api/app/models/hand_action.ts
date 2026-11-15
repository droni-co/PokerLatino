import { HandActionSchema } from '#database/schema'

export type Street = 'preflop' | 'flop' | 'turn' | 'river' | 'showdown'
export type PlayerAction =
  'small_blind' | 'big_blind' | 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'all_in'

export default class HandAction extends HandActionSchema {
  declare id: number
  declare handId: number
  declare street: Street
  declare action: PlayerAction
}
