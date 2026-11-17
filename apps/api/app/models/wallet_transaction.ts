import { WalletTransactionSchema } from '#database/schema'

export type WalletTransactionType =
  | 'signup_bonus'
  | 'buy_in'
  | 'cash_out'
  | 'adjustment'
  | 'tournament_entry'
  | 'tournament_refund'
  | 'tournament_prize'
  | 'referral_reward'
  | 'referral_bonus'
  | 'rescue'
  | 'achievement_reward'
  | 'level_reward'
  | 'bot_refill'

export default class WalletTransaction extends WalletTransactionSchema {
  declare id: number
  declare type: WalletTransactionType
}
