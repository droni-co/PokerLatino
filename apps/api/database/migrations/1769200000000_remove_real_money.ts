import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Poker Latino deja de ser un casino: solo existe una moneda de juego, las **fichas**,
 * que no se compran ni se canjean por dinero.
 *
 * - Elimina todo lo relacionado con dólares: salas USD (con sus asientos y manos),
 *   billeteras USD (con sus movimientos), estadísticas USD y la tabla de recargas.
 * - Quita la columna `currency` (ya no hay a qué moneda referirse): cada jugador tiene una
 *   sola billetera y una sola fila de estadísticas.
 * - Los movimientos solo pueden ser bono, entrada a mesa, salida de mesa o ajuste.
 *
 * `down()` restaura la estructura, no los datos borrados.
 */
export default class extends BaseSchema {
  async up() {
    this.defer(async (db) => {
      // Las llaves foráneas en cascada borran asientos, manos y movimientos asociados
      await db.from('rooms').where('currency', 'usd').delete()
      await db.from('wallets').where('currency', 'usd').delete()
      await db.from('player_stats').where('currency', 'usd').delete()
      await db.from('wallet_transactions').whereIn('type', ['deposit', 'withdrawal']).delete()
      // Las salas ya no llevan la moneda en el slug ("credits-clasica" → "clasica")
      await db.rawQuery(
        "UPDATE rooms SET slug = substring(slug from 9) WHERE slug LIKE 'credits-%'"
      )
    })

    this.schema.dropTableIfExists('deposits')

    // Postgres borra junto con la columna los índices y restricciones que la usan
    this.schema.alterTable('wallets', (table) => {
      table.dropColumn('currency')
      table.unique(['user_id'])
    })
    this.schema.alterTable('rooms', (table) => {
      table.dropColumn('currency')
      table.index(['status'])
    })
    this.schema.alterTable('hands', (table) => {
      table.dropColumn('currency')
    })
    this.schema.alterTable('player_stats', (table) => {
      table.dropColumn('currency')
      table.dropColumn('total_deposited')
      table.dropColumn('total_withdrawn')
      table.unique(['user_id'])
    })

    this.schema.raw(
      'ALTER TABLE wallet_transactions DROP CONSTRAINT IF EXISTS wallet_transactions_type_check'
    )
    this.schema.raw(`
      ALTER TABLE wallet_transactions ADD CONSTRAINT wallet_transactions_type_check
        CHECK (type IN ('signup_bonus', 'buy_in', 'cash_out', 'adjustment'))
    `)
  }

  async down() {
    this.schema.raw(
      'ALTER TABLE wallet_transactions DROP CONSTRAINT IF EXISTS wallet_transactions_type_check'
    )
    this.schema.raw(`
      ALTER TABLE wallet_transactions ADD CONSTRAINT wallet_transactions_type_check CHECK (
        type IN ('signup_bonus', 'deposit', 'withdrawal', 'buy_in', 'cash_out', 'adjustment')
      )
    `)

    this.schema.alterTable('player_stats', (table) => {
      table.dropUnique(['user_id'])
      table.enu('currency', ['credits', 'usd']).notNullable().defaultTo('credits')
      table.bigInteger('total_deposited').notNullable().defaultTo(0)
      table.bigInteger('total_withdrawn').notNullable().defaultTo(0)
      table.unique(['user_id', 'currency'])
    })
    this.schema.alterTable('hands', (table) => {
      table.enu('currency', ['credits', 'usd']).notNullable().defaultTo('credits')
    })
    this.schema.alterTable('rooms', (table) => {
      table.dropIndex(['status'])
      table.enu('currency', ['credits', 'usd']).notNullable().defaultTo('credits')
      table.index(['currency', 'status'])
    })
    this.schema.alterTable('wallets', (table) => {
      table.dropUnique(['user_id'])
      table.enu('currency', ['credits', 'usd']).notNullable().defaultTo('credits')
      table.unique(['user_id', 'currency'])
    })

    this.schema.createTable('deposits', (table) => {
      table.uuid('id').primary()
      table.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
      table.bigInteger('amount').notNullable()
      table
        .enu('status', ['pending', 'completed', 'failed', 'cancelled'])
        .notNullable()
        .defaultTo('pending')
      table.string('provider', 50).notNullable()
      table.string('provider_reference').nullable().unique()
      table.timestamp('completed_at').nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }
}
