import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Aplicaciones registradas que pueden pedir tokens (RFC 6749 §2).
 * - Cliente público (app Flutter): secret_hash = null, se protege con PKCE.
 * - Cliente confidencial (otro backend): secret_hash con el secreto hasheado.
 */
export default class extends BaseSchema {
  protected tableName = 'oauth_clients'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.string('id', 100).primary() // client_id
      table.string('name').notNullable()
      table.string('secret_hash').nullable()
      table.jsonb('redirect_uris').notNullable().defaultTo('[]')
      table.jsonb('grant_types').notNullable().defaultTo('[]')
      table.jsonb('scopes').notNullable().defaultTo('[]')
      // Los clientes propios no muestran la pantalla de consentimiento
      table.boolean('is_first_party').notNullable().defaultTo(false)
      table.timestamp('revoked_at').nullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTableIfExists(this.tableName)
  }
}
