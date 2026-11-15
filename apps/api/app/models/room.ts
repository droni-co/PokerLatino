import { RoomSchema } from '#database/schema'
import { hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import type { Currency } from '#config/game'
import RoomSeat from '#models/room_seat'

export type RoomStatus = 'active' | 'paused' | 'closed'

export default class Room extends RoomSchema {
  declare currency: Currency
  declare status: RoomStatus
  declare gameType: 'texas_holdem'
  declare bettingStructure: 'no_limit'

  @hasMany(() => RoomSeat)
  declare seats: HasMany<typeof RoomSeat>
}
