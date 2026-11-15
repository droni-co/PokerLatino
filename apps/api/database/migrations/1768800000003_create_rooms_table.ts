import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Salas de juego. Cada sala es de una sola moneda: credits (gratis) o usd (pago).
 */
export default class extends BaseSchema {
  protected tableName = 'rooms'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('slug', 80).notNullable().unique()
      table.string('name', 100).notNullable()
      table.enu('currency', ['credits', 'usd']).notNullable()
      table.enu('game_type', ['texas_holdem']).notNullable().defaultTo('texas_holdem')
      table.enu('betting_structure', ['no_limit']).notNullable().defaultTo('no_limit')
      table.smallint('max_seats').notNullable().defaultTo(5)
      table.bigInteger('small_blind').notNullable()
      table.bigInteger('big_blind').notNullable()
      table.bigInteger('min_buy_in').notNullable()
      table.bigInteger('max_buy_in').notNullable()
      table.smallint('action_timeout_seconds').notNullable().defaultTo(30)
      table.enu('status', ['active', 'paused', 'closed']).notNullable().defaultTo('active')

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
      table.index(['currency', 'status'])
    })

    this.schema.raw(`
      ALTER TABLE rooms ADD CONSTRAINT rooms_valid_config CHECK (
        max_seats BETWEEN 2 AND 10
        AND small_blind > 0
        AND big_blind >= small_blind
        AND min_buy_in >= big_blind
        AND max_buy_in >= min_buy_in
      )
    `)
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
