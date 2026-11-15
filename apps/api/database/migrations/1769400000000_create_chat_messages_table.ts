import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Chat de cada mesa. Los mensajes viejos se borran periódicamente (ver start/game.ts).
 */
export default class extends BaseSchema {
  protected tableName = 'chat_messages'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.bigIncrements('id')
      table.integer('room_id').notNullable().references('id').inTable('rooms').onDelete('CASCADE')
      table.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
      table.string('body', 200).notNullable()
      table.timestamp('created_at').notNullable()
      table.index(['room_id', 'id'])
      table.index(['user_id', 'created_at'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
