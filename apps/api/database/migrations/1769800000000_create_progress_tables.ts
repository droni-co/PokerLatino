import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Experiencia, niveles y logros.
 *
 * - `player_progress`: XP, nivel y las métricas con las que se comprueban los logros
 *   (manos, victorias, rachas, mayor pozo… contando también las manos de torneo).
 *   `notified_level`: último nivel que la app ya le anunció al jugador.
 *   `synced_at` null: falta repasar sus logros (al arrancar el servidor se hace solo).
 * - `user_achievements`: logros desbloqueados (`seen_at` null: la app aún no lo anunció).
 * - Movimientos nuevos: recompensa por logro y por subir de nivel.
 *
 * Los jugadores que ya existen arrancan con su historial: manos, victorias, mayor pozo y
 * victorias all-in salen de las manos guardadas; la XP de esas manos también.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.createTable('player_progress', (table) => {
      table.increments('id')
      table
        .integer('user_id')
        .notNullable()
        .unique()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
      table.bigInteger('xp').notNullable().defaultTo(0)
      table.integer('level').notNullable().defaultTo(1)
      table.integer('notified_level').notNullable().defaultTo(1)
      table.integer('hands').notNullable().defaultTo(0)
      table.integer('wins').notNullable().defaultTo(0)
      table.integer('win_streak').notNullable().defaultTo(0)
      table.integer('best_win_streak').notNullable().defaultTo(0)
      table.bigInteger('biggest_pot').notNullable().defaultTo(0)
      table.integer('all_in_wins').notNullable().defaultTo(0)
      table.integer('win_categories').notNullable().defaultTo(0)
      table.timestamp('synced_at').nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })

    this.schema.createTable('user_achievements', (table) => {
      table.increments('id')
      table.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
      table.string('achievement_key', 40).notNullable()
      table.timestamp('unlocked_at').notNullable()
      table.timestamp('seen_at').nullable()
      table.unique(['user_id', 'achievement_key'])
    })

    this.schema.raw(
      'ALTER TABLE wallet_transactions DROP CONSTRAINT IF EXISTS wallet_transactions_type_check'
    )
    this.schema.raw(`
      ALTER TABLE wallet_transactions ADD CONSTRAINT wallet_transactions_type_check CHECK (
        type IN ('signup_bonus', 'buy_in', 'cash_out', 'adjustment',
          'tournament_entry', 'tournament_refund', 'tournament_prize',
          'referral_reward', 'referral_bonus', 'rescue',
          'achievement_reward', 'level_reward')
      )
    `)

    // Historial de los jugadores existentes (sus logros y niveles se repasan al arrancar)
    this.defer(async (db) => {
      await db.rawQuery(`
        INSERT INTO player_progress
          (user_id, xp, hands, wins, biggest_pot, all_in_wins, created_at, updated_at)
        SELECT u.id,
          COALESCE(h.hands, 0) * 2 + COALESCE(h.wins, 0) * 3,
          COALESCE(h.hands, 0), COALESCE(h.wins, 0), COALESCE(h.biggest, 0),
          COALESCE(h.all_in_wins, 0), NOW(), NOW()
        FROM users u
        LEFT JOIN (
          SELECT hp.user_id,
            COUNT(*) AS hands,
            COUNT(*) FILTER (WHERE hp.amount_won > hp.amount_wagered) AS wins,
            MAX(hp.amount_won) FILTER (WHERE hp.amount_won > hp.amount_wagered) AS biggest,
            COUNT(*) FILTER (
              WHERE hp.amount_won > hp.amount_wagered
                AND hp.amount_wagered > 0 AND hp.amount_wagered = hp.starting_stack
            ) AS all_in_wins
          FROM hand_players hp
          JOIN hands ON hands.id = hp.hand_id AND hands.status = 'completed'
          GROUP BY hp.user_id
        ) h ON h.user_id = u.id
      `)
    })
  }

  async down() {
    this.defer(async (db) => {
      await db
        .from('wallet_transactions')
        .whereIn('type', ['achievement_reward', 'level_reward'])
        .delete()
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
    this.schema.dropTable('user_achievements')
    this.schema.dropTable('player_progress')
  }
}
