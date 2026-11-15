import { FriendshipSchema } from '#database/schema'
import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from '#models/user'

/** pending: solicitud de `requester` esperando a `addressee` · accepted: son amigos */
export type FriendshipStatus = 'pending' | 'accepted'

export default class Friendship extends FriendshipSchema {
  declare status: FriendshipStatus

  @belongsTo(() => User, { foreignKey: 'requesterId' })
  declare requester: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'addresseeId' })
  declare addressee: BelongsTo<typeof User>

  /** El otro jugador de la pareja */
  otherId(userId: number) {
    return this.requesterId === userId ? this.addresseeId : this.requesterId
  }
}
