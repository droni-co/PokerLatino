import type Deposit from '#models/deposit'
import { BaseTransformer } from '@adonisjs/core/transformers'

export default class DepositTransformer extends BaseTransformer<Deposit> {
  toObject() {
    const d = this.resource
    return {
      id: d.id,
      amount: d.amount,
      currency: 'usd' as const,
      status: d.status,
      provider: d.provider,
      createdAt: d.createdAt.toISO(),
      completedAt: d.completedAt?.toISO() ?? null,
    }
  }
}
