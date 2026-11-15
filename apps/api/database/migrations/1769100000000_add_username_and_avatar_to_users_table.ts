import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * - username: nombre visible en las mesas. Único sin distinguir mayúsculas
 *   (índice sobre lower(username)). Nulo en cuentas creadas antes de este cambio: se
 *   muestran como "Jugador #id" hasta que elijan uno desde su perfil.
 * - avatar: id de un avatar del catálogo (`game.avatars`). Nulo = la app asigna uno
 *   genérico al azar (estable por jugador).
 */
export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('username', 20).nullable()
      table.string('avatar', 40).nullable()
    })
    this.schema.raw('CREATE UNIQUE INDEX users_username_lower_unique ON users (lower(username))')
  }

  async down() {
    this.schema.raw('DROP INDEX IF EXISTS users_username_lower_unique')
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('username')
      table.dropColumn('avatar')
    })
  }
}
