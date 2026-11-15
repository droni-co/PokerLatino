import { RoomLevelSchema } from '#database/schema'
import { hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import Room from '#models/room'

/**
 * Nivel (categoría) de sala: define ciegas, buy-in y asientos. El servidor abre y cierra
 * mesas (`rooms`) de cada nivel según la cantidad de jugadores.
 */
export default class RoomLevel extends RoomLevelSchema {
  declare status: 'active' | 'paused'
  declare gameType: 'texas_holdem'
  declare bettingStructure: 'no_limit'

  @hasMany(() => Room, { foreignKey: 'levelId' })
  declare rooms: HasMany<typeof Room>
}
