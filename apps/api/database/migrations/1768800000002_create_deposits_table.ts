import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Recargas de saldo en dinero real. El saldo solo se acredita cuando el
 * proveedor de pagos confirma (status = completed).
 */
export default class extends BaseSchema {
  protected tableName = 'deposits'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary()
      table.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
      table.bigInteger('amount').notNullable() // centavos de USD
      table
        .enu('status', ['pending', 'completed', 'failed', 'cancelled'])
        .notNullable()
        .defaultTo('pending')
      table.string('provider', 50).notNullable() // 'manual', 'stripe', ...
      table.string('provider_reference').nullable().unique()
      table.timestamp('completed_at').nullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
    this.schema.raw(
      'ALTER TABLE deposits ADD CONSTRAINT deposits_amount_positive CHECK (amount > 0)'
    )
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
