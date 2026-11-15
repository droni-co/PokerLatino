import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Una billetera por usuario y moneda.
 * Montos en unidades mínimas: credits = 1 crédito, usd = 1 centavo.
 */
export default class extends BaseSchema {
  protected tableName = 'wallets'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
      table.enu('currency', ['credits', 'usd']).notNullable()
      table.bigInteger('balance').notNullable().defaultTo(0)
      table.unique(['user_id', 'currency'])

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })

    // El saldo nunca puede quedar negativo, aunque falle la lógica de la app
    this.schema.raw(
      'ALTER TABLE wallets ADD CONSTRAINT wallets_balance_non_negative CHECK (balance >= 0)'
    )
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
