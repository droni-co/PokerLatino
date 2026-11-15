import { RoomSeatSchema } from '#database/schema'
import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Room from '#models/room'
import User from '#models/user'

export default class RoomSeat extends RoomSeatSchema {
  declare status: 'active' | 'sitting_out'

  @belongsTo(() => Room)
  declare room: BelongsTo<typeof Room>

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>
}
