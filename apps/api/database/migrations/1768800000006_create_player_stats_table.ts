import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Estadísticas acumuladas por jugador y moneda (credits y usd por separado).
 */
export default class extends BaseSchema {
  protected tableName = 'player_stats'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
      table.enu('currency', ['credits', 'usd']).notNullable()
      table.integer('hands_played').notNullable().defaultTo(0)
      table.integer('hands_won').notNullable().defaultTo(0)
      table.integer('showdowns_reached').notNullable().defaultTo(0)
      table.bigInteger('total_wagered').notNullable().defaultTo(0)
      table.bigInteger('total_won').notNullable().defaultTo(0)
      table.bigInteger('biggest_pot_won').notNullable().defaultTo(0)
      table.bigInteger('total_deposited').notNullable().defaultTo(0)
      table.bigInteger('total_withdrawn').notNullable().defaultTo(0)
      table.unique(['user_id', 'currency'])

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
