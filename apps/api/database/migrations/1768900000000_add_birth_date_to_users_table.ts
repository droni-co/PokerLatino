import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Fecha de nacimiento declarada al registrarse (mayoría de edad).
 * Ver Legal.md: esto NO reemplaza una verificación de identidad (KYC).
 */
export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.date('birth_date').notNullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('birth_date')
    })
  }
}
