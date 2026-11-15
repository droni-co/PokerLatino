import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Amigos e invitaciones a la mesa.
 *
 * - `friendships`: una fila por pareja. `pending` es una solicitud de `requester` a
 *   `addressee`; al aceptarla pasa a `accepted`. Rechazarla o eliminar al amigo borra la fila
 *   (se puede volver a pedir más tarde). Un índice único sobre la pareja ordenada impide
 *   dos filas para los mismos jugadores.
 * - `table_invitations`: un amigo te invita a la mesa donde está sentado. Caducan solas
 *   (`expires_at`).
 */
export default class extends BaseSchema {
  async up() {
    this.schema.createTable('friendships', (table) => {
      table.increments('id')
      table
        .integer('requester_id')
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
      table
        .integer('addressee_id')
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
      table.enu('status', ['pending', 'accepted']).notNullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('accepted_at').nullable()
      table.index(['addressee_id', 'status'])
      table.index(['requester_id', 'status'])
    })
    this.schema.raw(
      'ALTER TABLE friendships ADD CONSTRAINT friendships_not_self CHECK (requester_id <> addressee_id)'
    )
    this.schema.raw(
      'CREATE UNIQUE INDEX friendships_pair_unique ON friendships ' +
        '(LEAST(requester_id, addressee_id), GREATEST(requester_id, addressee_id))'
    )

    this.schema.createTable('table_invitations', (table) => {
      table.increments('id')
      table.integer('room_id').notNullable().references('id').inTable('rooms').onDelete('CASCADE')
      table.integer('sender_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
      table
        .integer('recipient_id')
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
      table.enu('status', ['pending', 'accepted', 'declined']).notNullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('expires_at').notNullable()
      table.index(['recipient_id', 'status', 'expires_at'])
      table.index(['room_id', 'sender_id', 'recipient_id'])
    })
  }

  async down() {
    this.schema.dropTable('table_invitations')
    this.schema.dropTable('friendships')
  }
}
