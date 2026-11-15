import { WalletSchema } from '#database/schema'
import { belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import type { Currency } from '#config/game'
import User from '#models/user'
import WalletTransaction from '#models/wallet_transaction'

export default class Wallet extends WalletSchema {
  declare currency: Currency

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @hasMany(() => WalletTransaction)
  declare transactions: HasMany<typeof WalletTransaction>
}
