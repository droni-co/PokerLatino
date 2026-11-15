import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Libro contable inmutable: cada cambio de saldo deja una fila (nunca se edita ni borra).
 * amount > 0 entra a la billetera, amount < 0 sale.
 */
export default class extends BaseSchema {
  protected tableName = 'wallet_transactions'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.bigIncrements('id')
      table
        .integer('wallet_id')
        .notNullable()
        .references('id')
        .inTable('wallets')
        .onDelete('CASCADE')
      table
        .enu('type', ['signup_bonus', 'deposit', 'withdrawal', 'buy_in', 'cash_out', 'adjustment'])
        .notNullable()
      table.bigInteger('amount').notNullable()
      table.bigInteger('balance_after').notNullable()
      // Entidad relacionada (room, deposit, ...) para auditoría
      table.string('reference_type', 50).nullable()
      table.string('reference_id', 100).nullable()
      table.string('description').nullable()

      table.timestamp('created_at').notNullable()
      table.index(['wallet_id', 'created_at'])
      table.index(['reference_type', 'reference_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
