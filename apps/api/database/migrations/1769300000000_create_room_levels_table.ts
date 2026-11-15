import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Niveles de sala (categorías): ciegas, buy-in y asientos. Cada nivel tiene una o más
 * mesas (`rooms`) que el servidor abre y cierra según la cantidad de jugadores.
 *
 * Las salas que ya existían pasan a ser la "Mesa 1" de un nivel con su mismo nombre y slug.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.createTable('room_levels', (table) => {
      table.increments('id')
      table.string('slug', 80).notNullable().unique()
      table.string('name', 100).notNullable()
      table.enu('game_type', ['texas_holdem']).notNullable().defaultTo('texas_holdem')
      table.enu('betting_structure', ['no_limit']).notNullable().defaultTo('no_limit')
      table.smallint('max_seats').notNullable().defaultTo(5)
      table.bigInteger('small_blind').notNullable()
      table.bigInteger('big_blind').notNullable()
      table.bigInteger('min_buy_in').notNullable()
      table.bigInteger('max_buy_in').notNullable()
      table.smallint('action_timeout_seconds').notNullable().defaultTo(15)
      table.enu('status', ['active', 'paused']).notNullable().defaultTo('active')
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
    this.schema.raw(`
      ALTER TABLE room_levels ADD CONSTRAINT room_levels_valid_config CHECK (
        max_seats BETWEEN 2 AND 10
        AND small_blind > 0
        AND big_blind >= small_blind
        AND min_buy_in >= big_blind
        AND max_buy_in >= min_buy_in
      )
    `)

    this.schema.alterTable('rooms', (table) => {
      table.integer('level_id').nullable().references('id').inTable('room_levels')
      table.smallint('table_number').nullable()
      // Desde cuándo la mesa no tiene a nadie sentado (para cerrar las mesas extra vacías)
      table.timestamp('empty_since').nullable()
    })

    this.defer(async (db) => {
      await db.rawQuery(`
        INSERT INTO room_levels (slug, name, game_type, betting_structure, max_seats, small_blind,
          big_blind, min_buy_in, max_buy_in, action_timeout_seconds, status, created_at, updated_at)
        SELECT slug, name, game_type, betting_structure, max_seats, small_blind, big_blind,
          min_buy_in, max_buy_in, action_timeout_seconds,
          CASE WHEN status = 'active' THEN 'active' ELSE 'paused' END, now(), now()
        FROM rooms
      `)
      await db.rawQuery(`
        UPDATE rooms r SET level_id = l.id, table_number = 1,
          slug = r.slug || '-1', name = r.name || ' · Mesa 1'
        FROM room_levels l WHERE l.slug = r.slug
      `)
      await db.rawQuery(`
        UPDATE rooms SET empty_since = now()
        WHERE NOT EXISTS (SELECT 1 FROM room_seats s WHERE s.room_id = rooms.id)
      `)
    })

    this.schema.raw('ALTER TABLE rooms ALTER COLUMN level_id SET NOT NULL')
    this.schema.raw('ALTER TABLE rooms ALTER COLUMN table_number SET NOT NULL')
    this.schema.alterTable('rooms', (table) => {
      table.unique(['level_id', 'table_number'])
      table.index(['level_id', 'status'])
    })
  }

  async down() {
    // Solo sobrevive la Mesa 1 de cada nivel, que vuelve a ser una sala suelta
    this.defer(async (db) => {
      await db.from('rooms').where('table_number', '>', 1).delete()
      await db.rawQuery(`
        UPDATE rooms SET slug = regexp_replace(slug, '-1$', ''),
          name = regexp_replace(name, ' · Mesa 1$', '')
      `)
    })
    this.schema.alterTable('rooms', (table) => {
      table.dropUnique(['level_id', 'table_number'])
      table.dropIndex(['level_id', 'status'])
      table.dropColumn('level_id')
      table.dropColumn('table_number')
      table.dropColumn('empty_since')
    })
    this.schema.dropTable('room_levels')
  }
}
