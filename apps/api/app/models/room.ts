import { RoomSchema } from '#database/schema'
import { belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import RoomSeat from '#models/room_seat'
import RoomLevel from '#models/room_level'

export type RoomStatus = 'active' | 'paused' | 'closed'

export default class Room extends RoomSchema {
  declare status: RoomStatus
  declare gameType: 'texas_holdem'
  declare bettingStructure: 'no_limit'

  @belongsTo(() => RoomLevel, { foreignKey: 'levelId' })
  declare level: BelongsTo<typeof RoomLevel>

  @hasMany(() => RoomSeat)
  declare seats: HasMany<typeof RoomSeat>
}
