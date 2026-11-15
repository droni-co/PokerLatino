import { ReferralSchema } from '#database/schema'
import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from '#models/user'

/**
 * - rewarded: se pagó a ambos
 * - limit_reached: el que invita llegó a su tope diario; el invitado sí recibió su bono
 * - blocked: sospecha de abuso (misma IP repetida o el mismo email con otro alias): nadie cobra
 */
export type ReferralStatus = 'rewarded' | 'limit_reached' | 'blocked'

export default class Referral extends ReferralSchema {
  declare status: ReferralStatus

  @belongsTo(() => User, { foreignKey: 'referrerId' })
  declare referrer: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'referredId' })
  declare referred: BelongsTo<typeof User>
}
