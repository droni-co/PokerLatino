import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * - leave_after_hand: el jugador pidió levantarse con una mano en curso; se le devuelven
 *   las fichas al terminar la mano (y no recibe cartas en la siguiente).
 * - missed_hands: manos seguidas en que se le agotó el tiempo sin actuar. Al llegar a
 *   `game.table.maxInactiveHands` se le levanta de la mesa automáticamente.
 * - Turno: 30 s → 15 s (default de la columna y salas existentes con el valor anterior).
 */
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('room_seats', (table) => {
      table.boolean('leave_after_hand').notNullable().defaultTo(false)
      table.smallint('missed_hands').notNullable().defaultTo(0)
    })
    this.schema.alterTable('rooms', (table) => {
      table.smallint('action_timeout_seconds').notNullable().defaultTo(15).alter()
    })
    this.defer(async (db) => {
      await db
        .from('rooms')
        .where('action_timeout_seconds', 30)
        .update({ action_timeout_seconds: 15 })
    })
  }

  async down() {
    this.schema.alterTable('room_seats', (table) => {
      table.dropColumn('leave_after_hand')
      table.dropColumn('missed_hands')
    })
    this.schema.alterTable('rooms', (table) => {
      table.smallint('action_timeout_seconds').notNullable().defaultTo(30).alter()
    })
  }
}
