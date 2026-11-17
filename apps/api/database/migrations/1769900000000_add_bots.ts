import { BaseSchema } from '@adonisjs/lucid/schema'

const TYPES = [
  'signup_bonus',
  'buy_in',
  'cash_out',
  'adjustment',
  'tournament_entry',
  'tournament_refund',
  'tournament_prize',
  'referral_reward',
  'referral_bonus',
  'rescue',
  'achievement_reward',
  'level_reward',
]

/**
 * Jugadores de la casa (bots): hacen compañía en las mesas vacías y se retiran cuando
 * llegan al menos dos jugadores reales.
 *
 * - `users.is_bot`: cuenta de un bot (no inicia sesión, no aparece en búsquedas).
 * - Movimiento nuevo `bot_refill`: la casa recarga las fichas del bot.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('users', (table) => {
      table.boolean('is_bot').notNullable().defaultTo(false)
    })
    this.setTypes([...TYPES, 'bot_refill'])
  }

  async down() {
    this.defer(async (db) => {
      await db.rawQuery(`DELETE FROM wallet_transactions WHERE type = 'bot_refill'`)
    })
    this.setTypes(TYPES)
    this.schema.alterTable('users', (table) => {
      table.dropColumn('is_bot')
    })
  }

  private setTypes(types: string[]) {
    this.schema.raw(
      'ALTER TABLE wallet_transactions DROP CONSTRAINT IF EXISTS wallet_transactions_type_check'
    )
    this.schema.raw(`
      ALTER TABLE wallet_transactions ADD CONSTRAINT wallet_transactions_type_check CHECK (
        type IN (${types.map((t) => `'${t}'`).join(', ')})
      )
    `)
  }
}
