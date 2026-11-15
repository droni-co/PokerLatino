import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Referidos y rescate diario.
 *
 * - `users.referral_code`: código para el enlace de invitación (/r/CODIGO). Se genera la
 *   primera vez que el jugador lo pide.
 * - `users.referred_by_id`: quién lo invitó (solo se fija al crear la cuenta).
 * - `referrals`: cada cuenta creada con un código, con lo que se pagó a cada uno o por qué no.
 * - Movimientos nuevos: recompensa por invitar, bono por llegar invitado y rescate diario.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('users', (table) => {
      table.string('referral_code', 16).nullable().unique()
      table
        .integer('referred_by_id')
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
    })

    this.schema.createTable('referrals', (table) => {
      table.increments('id')
      table
        .integer('referrer_id')
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
      table
        .integer('referred_id')
        .notNullable()
        .unique()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
      // rewarded: pagado a ambos · limit_reached: el que invita llegó a su tope diario (el
      // invitado sí recibe su bono) · blocked: sospecha de abuso (nadie cobra)
      table.enu('status', ['rewarded', 'limit_reached', 'blocked']).notNullable()
      table.bigInteger('referrer_reward').notNullable().defaultTo(0)
      table.bigInteger('referred_reward').notNullable().defaultTo(0)
      table.string('ip', 64).nullable()
      table.timestamp('created_at').notNullable()
      table.index(['referrer_id', 'created_at'])
      table.index(['ip', 'created_at'])
    })

    this.schema.raw(
      'ALTER TABLE wallet_transactions DROP CONSTRAINT IF EXISTS wallet_transactions_type_check'
    )
    this.schema.raw(`
      ALTER TABLE wallet_transactions ADD CONSTRAINT wallet_transactions_type_check CHECK (
        type IN ('signup_bonus', 'buy_in', 'cash_out', 'adjustment',
          'tournament_entry', 'tournament_refund', 'tournament_prize',
          'referral_reward', 'referral_bonus', 'rescue')
      )
    `)
    this.schema.alterTable('wallet_transactions', (table) => {
      table.index(['wallet_id', 'type', 'created_at'])
    })
  }

  async down() {
    this.defer(async (db) => {
      await db
        .from('wallet_transactions')
        .whereIn('type', ['referral_reward', 'referral_bonus', 'rescue'])
        .delete()
    })
    this.schema.alterTable('wallet_transactions', (table) => {
      table.dropIndex(['wallet_id', 'type', 'created_at'])
    })
    this.schema.raw(
      'ALTER TABLE wallet_transactions DROP CONSTRAINT IF EXISTS wallet_transactions_type_check'
    )
    this.schema.raw(`
      ALTER TABLE wallet_transactions ADD CONSTRAINT wallet_transactions_type_check CHECK (
        type IN ('signup_bonus', 'buy_in', 'cash_out', 'adjustment',
          'tournament_entry', 'tournament_refund', 'tournament_prize')
      )
    `)
    this.schema.dropTable('referrals')
    this.schema.alterTable('users', (table) => {
      table.dropColumn('referred_by_id')
      table.dropColumn('referral_code')
    })
  }
}
