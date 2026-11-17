import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'oauth_access_tokens'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary()
      table.string('token_hash', 64).notNullable().unique()
      table
        .string('client_id', 100)
        .notNullable()
        .references('id')
        .inTable('oauth_clients')
        .onDelete('CASCADE')
      table.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
      table.jsonb('scopes').notNullable().defaultTo('[]')
      // Todos los tokens que vienen del mismo login comparten family_id
      table.uuid('family_id').notNullable().index()
      table.timestamp('expires_at').notNullable()
      table.timestamp('revoked_at').nullable()

      table.timestamp('created_at').notNullable()
    })
  }

  async down() {
    this.schema.dropTableIfExists(this.tableName)
  }
}
