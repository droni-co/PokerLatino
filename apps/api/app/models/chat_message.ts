import { ChatMessageSchema } from '#database/schema'
import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from '#models/user'
import Room from '#models/room'

export default class ChatMessage extends ChatMessageSchema {
  declare id: number

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @belongsTo(() => Room)
  declare room: BelongsTo<typeof Room>
}
