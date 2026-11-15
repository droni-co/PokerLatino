import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'oauth_authorization_codes'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary()
      table.string('code_hash', 64).notNullable().unique()
      table
        .string('client_id', 100)
        .notNullable()
        .references('id')
        .inTable('oauth_clients')
        .onDelete('CASCADE')
      table.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
      table.text('redirect_uri').notNullable()
      table.jsonb('scopes').notNullable().defaultTo('[]')
      table.string('code_challenge', 128).notNullable()
      table.string('code_challenge_method', 10).notNullable()
      // Familia de tokens emitida al canjear el código (para revocarla si el código se reutiliza)
      table.uuid('family_id').nullable()
      table.timestamp('expires_at').notNullable()
      table.timestamp('used_at').nullable()

      table.timestamp('created_at').notNullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
