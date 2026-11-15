import { WalletTransactionSchema } from '#database/schema'

export type WalletTransactionType = 'signup_bonus' | 'buy_in' | 'cash_out' | 'adjustment'

export default class WalletTransaction extends WalletTransactionSchema {
  declare id: number
  declare type: WalletTransactionType
}
