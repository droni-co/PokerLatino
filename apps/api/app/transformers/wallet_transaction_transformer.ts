import type WalletTransaction from '#models/wallet_transaction'
import { BaseTransformer } from '@adonisjs/core/transformers'

export default class WalletTransactionTransformer extends BaseTransformer<WalletTransaction> {
  toObject() {
    const tx = this.resource
    return {
      id: tx.id,
      type: tx.type,
      amount: tx.amount,
      balanceAfter: tx.balanceAfter,
      description: tx.description,
      reference: tx.referenceType ? { type: tx.referenceType, id: tx.referenceId } : null,
      createdAt: tx.createdAt.toISO(),
    }
  }
}
