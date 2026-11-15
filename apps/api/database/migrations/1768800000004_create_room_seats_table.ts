import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Jugadores sentados en una sala. `stack` son las fichas en la mesa: al sentarse
 * se descuentan de la billetera (buy-in) y al levantarse vuelven (cash-out).
 */
export default class extends BaseSchema {
  protected tableName = 'room_seats'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.integer('room_id').notNullable().references('id').inTable('rooms').onDelete('CASCADE')
      table.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
      table.smallint('seat_number').notNullable()
      table.bigInteger('stack').notNullable()
      table.enu('status', ['active', 'sitting_out']).notNullable().defaultTo('active')

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
      table.unique(['room_id', 'seat_number'])
      table.unique(['room_id', 'user_id'])
    })
    this.schema.raw(
      'ALTER TABLE room_seats ADD CONSTRAINT room_seats_stack_non_negative CHECK (stack >= 0)'
    )
    this.schema.raw(
      'ALTER TABLE room_seats ADD CONSTRAINT room_seats_seat_positive CHECK (seat_number >= 1)'
    )
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
