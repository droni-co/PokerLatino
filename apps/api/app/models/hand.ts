import { HandSchema } from '#database/schema'
import { hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import type { Currency } from '#config/game'
import { jsonColumn } from '#models/json_column'
import HandPlayer from '#models/hand_player'
import HandAction from '#models/hand_action'

export default class Hand extends HandSchema {
  declare id: number
  declare currency: Currency
  declare status: 'in_progress' | 'completed' | 'cancelled'

  /**
   * Cartas comunitarias, ej: ['Ah', 'Kd', '7c']
   */
  @jsonColumn()
  declare board: string[]

  @hasMany(() => HandPlayer)
  declare players: HasMany<typeof HandPlayer>

  @hasMany(() => HandAction)
  declare actions: HasMany<typeof HandAction>
}
