import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Autenticación simple: email + contraseña → access token (los de AdonisJS).
 *
 * - Sustituye al servidor OAuth2: se borran sus tablas (todas las sesiones abiertas se
 *   cierran; cada jugador vuelve a entrar con su email y contraseña).
 * - `auth_access_tokens`: un jugador tiene como mucho un token vivo; al iniciar sesión se
 *   borran los anteriores (una sola sesión a la vez, en un solo dispositivo).
 *
 * `down` solo quita la tabla de tokens: las tablas OAuth no se restauran.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.dropTableIfExists('oauth_refresh_tokens')
    this.schema.dropTableIfExists('oauth_access_tokens')
    this.schema.dropTableIfExists('oauth_authorization_codes')
    this.schema.dropTableIfExists('oauth_clients')

    this.schema.createTable('auth_access_tokens', (table) => {
      table.increments('id')
      table
        .integer('tokenable_id')
        .notNullable()
        .unsigned()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
      table.string('type').notNullable()
      table.string('name').nullable()
      table.string('hash').notNullable()
      table.text('abilities').notNullable()
      table.timestamp('created_at')
      table.timestamp('updated_at')
      table.timestamp('last_used_at').nullable()
      table.timestamp('expires_at').nullable()
      table.index(['tokenable_id'])
    })
  }

  async down() {
    this.schema.dropTable('auth_access_tokens')
  }
}
