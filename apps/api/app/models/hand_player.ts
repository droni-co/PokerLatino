import { HandPlayerSchema } from '#database/schema'
import { column } from '@adonisjs/lucid/orm'

export default class HandPlayer extends HandPlayerSchema {
  declare id: number
  declare handId: number

  /**
   * Cartas privadas. Nunca se serializan: solo se muestran al dueño o en el showdown.
   */
  @column({
    serializeAs: null,
    prepare: (value: string[] | null) => (value ? JSON.stringify(value) : null),
  })
  declare holeCards: string[] | null
}
