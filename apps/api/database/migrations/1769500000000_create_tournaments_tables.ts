import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Torneos (multi-mesa, eliminación).
 *
 * - `tournaments`: cada edición, con su inscripción (en fichas), stack inicial, ciegas
 *   iniciales (se duplican cada `blinds_up_every_hands` manos en cada mesa), tamaño y número
 *   de mesas. El cupo es `table_count * max_seats`: empieza a la hora programada si está
 *   lleno; si no, en cuanto se llene.
 * - `tournament_entries`: inscritos y su resultado (puesto y premio).
 * - Las mesas de un torneo son `rooms` con `tournament_id` (sin nivel). Sus ciegas suben,
 *   así que no aplican las reglas de buy-in de las mesas normales.
 * - Nuevos movimientos de billetera: inscripción, reembolso y premio de torneo.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.createTable('tournaments', (table) => {
      table.increments('id')
      table.string('slug', 80).notNullable().unique()
      table.string('name', 100).notNullable()
      table.text('description').nullable()
      table.bigInteger('buy_in').notNullable()
      table.bigInteger('starting_stack').notNullable()
      table.bigInteger('small_blind').notNullable()
      table.bigInteger('big_blind').notNullable()
      table.smallint('blinds_up_every_hands').notNullable().defaultTo(10)
      table.smallint('max_seats').notNullable().defaultTo(5)
      table.smallint('table_count').notNullable().defaultTo(1)
      table.smallint('action_timeout_seconds').notNullable().defaultTo(15)
      table.timestamp('starts_at').notNullable()
      table
        .enu('status', ['registering', 'running', 'finished', 'cancelled'])
        .notNullable()
        .defaultTo('registering')
      table.bigInteger('prize_pool').notNullable().defaultTo(0)
      table.timestamp('started_at').nullable()
      table.timestamp('finished_at').nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
      table.index(['status', 'starts_at'])
    })
    this.schema.raw(`
      ALTER TABLE tournaments ADD CONSTRAINT tournaments_valid_config CHECK (
        buy_in > 0
        AND small_blind > 0
        AND big_blind >= small_blind
        AND starting_stack >= big_blind
        AND blinds_up_every_hands > 0
        AND max_seats BETWEEN 2 AND 10
        AND table_count >= 1
      )
    `)

    this.schema.createTable('tournament_entries', (table) => {
      table.increments('id')
      table
        .integer('tournament_id')
        .notNullable()
        .references('id')
        .inTable('tournaments')
        .onDelete('CASCADE')
      table.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
      table
        .enu('status', ['registered', 'playing', 'eliminated', 'winner'])
        .notNullable()
        .defaultTo('registered')
      table.smallint('finish_position').nullable()
      table.bigInteger('prize').notNullable().defaultTo(0)
      table.timestamp('eliminated_at').nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
      table.unique(['tournament_id', 'user_id'])
      table.index(['user_id', 'status'])
    })

    this.schema.raw('ALTER TABLE rooms ALTER COLUMN level_id DROP NOT NULL')
    this.schema.alterTable('rooms', (table) => {
      table
        .integer('tournament_id')
        .nullable()
        .references('id')
        .inTable('tournaments')
        .onDelete('CASCADE')
      table.unique(['tournament_id', 'table_number'])
    })
    this.schema.raw('ALTER TABLE rooms DROP CONSTRAINT IF EXISTS rooms_valid_config')
    this.schema.raw(`
      ALTER TABLE rooms ADD CONSTRAINT rooms_valid_config CHECK (
        max_seats BETWEEN 2 AND 10
        AND small_blind > 0
        AND big_blind >= small_blind
        AND (tournament_id IS NOT NULL OR (min_buy_in >= big_blind AND max_buy_in >= min_buy_in))
      )
    `)
    this.schema.raw(`
      ALTER TABLE rooms ADD CONSTRAINT rooms_level_or_tournament
        CHECK ((level_id IS NULL) <> (tournament_id IS NULL))
    `)

    this.schema.raw(
      'ALTER TABLE wallet_transactions DROP CONSTRAINT IF EXISTS wallet_transactions_type_check'
    )
    this.schema.raw(`
      ALTER TABLE wallet_transactions ADD CONSTRAINT wallet_transactions_type_check CHECK (
        type IN ('signup_bonus', 'buy_in', 'cash_out', 'adjustment',
          'tournament_entry', 'tournament_refund', 'tournament_prize')
      )
    `)
  }

  async down() {
    this.defer(async (db) => {
      await db
        .from('wallet_transactions')
        .whereIn('type', ['tournament_entry', 'tournament_refund', 'tournament_prize'])
        .delete()
    })
    this.schema.raw(
      'ALTER TABLE wallet_transactions DROP CONSTRAINT IF EXISTS wallet_transactions_type_check'
    )
    this.schema.raw(`
      ALTER TABLE wallet_transactions ADD CONSTRAINT wallet_transactions_type_check
        CHECK (type IN ('signup_bonus', 'buy_in', 'cash_out', 'adjustment'))
    `)

    // Las mesas de torneo se borran en cascada con los torneos
    this.schema.raw('ALTER TABLE rooms DROP CONSTRAINT IF EXISTS rooms_level_or_tournament')
    this.schema.raw('ALTER TABLE rooms DROP CONSTRAINT IF EXISTS rooms_valid_config')
    this.schema.alterTable('rooms', (table) => {
      table.dropUnique(['tournament_id', 'table_number'])
      table.dropColumn('tournament_id')
    })
    this.schema.dropTable('tournament_entries')
    this.schema.dropTable('tournaments')
    this.schema.raw(`
      ALTER TABLE rooms ADD CONSTRAINT rooms_valid_config CHECK (
        max_seats BETWEEN 2 AND 10
        AND small_blind > 0
        AND big_blind >= small_blind
        AND min_buy_in >= big_blind
        AND max_buy_in >= min_buy_in
      )
    `)
    this.schema.raw('ALTER TABLE rooms ALTER COLUMN level_id SET NOT NULL')
  }
}
