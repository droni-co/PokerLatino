import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Historial de manos (lo escribe el motor de juego).
 */
export default class extends BaseSchema {
  async up() {
    this.schema.createTable('hands', (table) => {
      table.bigIncrements('id')
      table.integer('room_id').notNullable().references('id').inTable('rooms').onDelete('CASCADE')
      table.integer('hand_number').notNullable()
      table.enu('currency', ['credits', 'usd']).notNullable()
      table.bigInteger('small_blind').notNullable()
      table.bigInteger('big_blind').notNullable()
      table.smallint('dealer_seat').notNullable()
      table.jsonb('board').notNullable().defaultTo('[]')
      table.bigInteger('pot').notNullable().defaultTo(0)
      table
        .enu('status', ['in_progress', 'completed', 'cancelled'])
        .notNullable()
        .defaultTo('in_progress')
      table.timestamp('started_at').notNullable()
      table.timestamp('ended_at').nullable()
      table.unique(['room_id', 'hand_number'])
    })

    this.schema.createTable('hand_players', (table) => {
      table.bigIncrements('id')
      table
        .bigInteger('hand_id')
        .notNullable()
        .references('id')
        .inTable('hands')
        .onDelete('CASCADE')
      table.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
      table.smallint('seat_number').notNullable()
      table.bigInteger('starting_stack').notNullable()
      table.bigInteger('ending_stack').nullable()
      table.bigInteger('amount_wagered').notNullable().defaultTo(0)
      table.bigInteger('amount_won').notNullable().defaultTo(0)
      table.jsonb('hole_cards').nullable()
      table.boolean('folded').notNullable().defaultTo(false)
      table.boolean('went_to_showdown').notNullable().defaultTo(false)
      table.unique(['hand_id', 'user_id'])
      table.index(['user_id'])
    })

    this.schema.createTable('hand_actions', (table) => {
      table.bigIncrements('id')
      table
        .bigInteger('hand_id')
        .notNullable()
        .references('id')
        .inTable('hands')
        .onDelete('CASCADE')
      table.integer('user_id').nullable().references('id').inTable('users').onDelete('SET NULL')
      table.integer('sequence').notNullable()
      table.enu('street', ['preflop', 'flop', 'turn', 'river', 'showdown']).notNullable()
      table
        .enu('action', [
          'small_blind',
          'big_blind',
          'fold',
          'check',
          'call',
          'bet',
          'raise',
          'all_in',
        ])
        .notNullable()
      table.bigInteger('amount').notNullable().defaultTo(0)
      table.timestamp('created_at').notNullable()
      table.unique(['hand_id', 'sequence'])
    })
  }

  async down() {
    this.schema.dropTable('hand_actions')
    this.schema.dropTable('hand_players')
    this.schema.dropTable('hands')
  }
}
