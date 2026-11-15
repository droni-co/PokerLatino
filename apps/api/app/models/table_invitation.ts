import { TableInvitationSchema } from '#database/schema'
import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from '#models/user'
import Room from '#models/room'

export type TableInvitationStatus = 'pending' | 'accepted' | 'declined'

export default class TableInvitation extends TableInvitationSchema {
  declare status: TableInvitationStatus

  @belongsTo(() => Room)
  declare room: BelongsTo<typeof Room>

  @belongsTo(() => User, { foreignKey: 'senderId' })
  declare sender: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'recipientId' })
  declare recipient: BelongsTo<typeof User>
}
