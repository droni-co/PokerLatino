import type Wallet from '#models/wallet'
import { BaseTransformer } from '@adonisjs/core/transformers'

export default class WalletTransformer extends BaseTransformer<Wallet> {
  toObject() {
    return {
      currency: this.resource.currency,
      balance: this.resource.balance,
    }
  }
}
