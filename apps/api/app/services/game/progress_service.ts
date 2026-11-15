import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import gameConfig from '#config/game'
import PlayerProgress from '#models/player_progress'
import UserAchievement from '#models/user_achievement'
import TournamentEntry from '#models/tournament_entry'
import Friendship from '#models/friendship'
import Referral from '#models/referral'
import walletService from '#services/game/wallet_service'
import {
  ACHIEVEMENTS,
  type HandOutcome,
  type ProgressMetrics,
  achievementProgress,
  levelForXp,
  levelProgress,
  levelReward,
  newlyUnlocked,
} from '#game/achievements'

const count = (rows: { $extras: Record<string, unknown> }[]) => Number(rows[0]?.$extras.total ?? 0)

/**
 * Experiencia, niveles y logros.
 *
 * - Cada mano jugada (también en torneos) suma XP y actualiza las métricas (racha, mayor
 *   pozo, victorias all-in, jugadas ganadoras).
 * - Tras cada cambio se repasan los logros: cada logro nuevo da su XP y sus fichas; si la
 *   XP alcanza otro nivel, se pagan las fichas de cada nivel nuevo.
 * - La app se entera por el buzón (logros sin ver y nivel aún no anunciado).
 */
export class ProgressService {
  /** Nivel de cada jugador para pintarlo en las mesas (se consulta cada segundo) */
  private levels = new Map<number, number>()

  /** Crea el progreso de un jugador nuevo (en la transacción del registro) */
  async create(trx: TransactionClientContract, userId: number) {
    await PlayerProgress.create({ userId, syncedAt: DateTime.now() }, { client: trx })
  }

  /** Progreso bloqueado para actualizarlo (lo crea si falta, p. ej. cuentas antiguas) */
  private async lock(trx: TransactionClientContract, userId: number) {
    await trx.rawQuery(
      `INSERT INTO player_progress (user_id, created_at, updated_at)
       VALUES (?, NOW(), NOW()) ON CONFLICT (user_id) DO NOTHING`,
      [userId]
    )
    return PlayerProgress.query({ client: trx }).where('user_id', userId).forUpdate().firstOrFail()
  }

  /**
   * Suma una mano jugada. Se llama al cerrar cada mano, fuera de su transacción.
   */
  async recordHand(userId: number, outcome: HandOutcome) {
    const { xpPerHand, xpPerWin } = gameConfig.progress
    await db.transaction(async (trx) => {
      const p = await this.lock(trx, userId)
      p.hands += 1
      p.xp = Number(p.xp) + xpPerHand + (outcome.won ? xpPerWin : 0)
      if (outcome.won) {
        p.wins += 1
        p.winStreak += 1
        p.bestWinStreak = Math.max(p.bestWinStreak, p.winStreak)
        p.biggestPot = Math.max(Number(p.biggestPot), outcome.amountWon)
        if (outcome.allIn) p.allInWins += 1
        if (outcome.winningCategory !== null) p.winCategories |= 1 << outcome.winningCategory
      } else {
        p.winStreak = 0
      }
      await this.settle(trx, p)
    })
  }

  /**
   * Repasa los logros de un jugador (tras un torneo, un amigo nuevo, una invitación…)
   */
  async evaluate(userId: number) {
    await db.transaction(async (trx) => {
      const p = await this.lock(trx, userId)
      await this.settle(trx, p)
    })
  }

  /** Igual que evaluate, sin dejar que un fallo rompa lo que lo llamó */
  async evaluateQuietly(...userIds: number[]) {
    for (const userId of userIds) {
      try {
        await this.evaluate(userId)
      } catch (error) {
        logger.error({ err: error, userId }, 'No se pudieron repasar los logros')
      }
    }
  }

  /** Métricas del jugador: las de su progreso más torneos, amigos e invitaciones */
  private async metrics(
    p: PlayerProgress,
    client?: TransactionClientContract
  ): Promise<ProgressMetrics> {
    const userId = p.userId
    const [played, cashed, won, friends, referrals] = await Promise.all([
      TournamentEntry.query({ client })
        .where('user_id', userId)
        .whereIn('status', ['playing', 'eliminated', 'winner'])
        .count('* as total'),
      TournamentEntry.query({ client })
        .where('user_id', userId)
        .where('prize', '>', 0)
        .count('* as total'),
      TournamentEntry.query({ client })
        .where('user_id', userId)
        .where('status', 'winner')
        .count('* as total'),
      Friendship.query({ client })
        .where('status', 'accepted')
        .where((q) => q.where('requester_id', userId).orWhere('addressee_id', userId))
        .count('* as total'),
      Referral.query({ client })
        .where('referrer_id', userId)
        .whereNot('status', 'blocked')
        .count('* as total'),
    ])
    return {
      hands: p.hands,
      wins: p.wins,
      bestWinStreak: p.bestWinStreak,
      biggestPot: Number(p.biggestPot),
      allInWins: p.allInWins,
      winCategories: p.winCategories,
      tournamentsPlayed: count(played),
      tournamentsCashed: count(cashed),
      tournamentsWon: count(won),
      friends: count(friends),
      referrals: count(referrals),
    }
  }

  /**
   * Desbloquea los logros cumplidos, paga sus fichas, sube de nivel (pagando cada nivel
   * nuevo) y guarda el progreso
   */
  private async settle(trx: TransactionClientContract, p: PlayerProgress) {
    const metrics = await this.metrics(p, trx)
    const owned = await UserAchievement.query({ client: trx })
      .where('user_id', p.userId)
      .select('achievement_key')
    const unlocked = newlyUnlocked(metrics, new Set(owned.map((o) => o.achievementKey)))

    const now = DateTime.now()
    for (const achievement of unlocked) {
      await UserAchievement.create(
        { userId: p.userId, achievementKey: achievement.key, unlockedAt: now },
        { client: trx }
      )
      p.xp = Number(p.xp) + achievement.xp
      if (achievement.chips > 0) {
        await walletService.credit(trx, {
          userId: p.userId,
          amount: achievement.chips,
          type: 'achievement_reward',
          description: `Logro: ${achievement.name}`,
        })
      }
    }

    const level = levelForXp(Number(p.xp))
    for (let reached = p.level + 1; reached <= level; reached++) {
      await walletService.credit(trx, {
        userId: p.userId,
        amount: levelReward(reached, gameConfig.progress.levelRewardPerLevel),
        type: 'level_reward',
        description: `Subiste a nivel ${reached}`,
      })
    }
    p.level = Math.max(p.level, level)
    p.syncedAt = now
    await p.useTransaction(trx).save()
    this.levels.set(p.userId, p.level)
    return unlocked
  }

  /**
   * Repasa a los jugadores que aún no lo están (cuentas anteriores a los logros). Se
   * ejecuta al arrancar el servidor.
   */
  async syncPending(limit = 500) {
    const pending = await PlayerProgress.query()
      .whereNull('synced_at')
      .select('user_id')
      .limit(limit)
    await this.evaluateQuietly(...pending.map((p) => p.userId))
    return pending.length
  }

  /** Niveles de varios jugadores (con caché en memoria) */
  async levelsOf(userIds: number[]) {
    const missing = userIds.filter((id) => !this.levels.has(id))
    if (missing.length > 0) {
      const rows = await PlayerProgress.query()
        .whereIn('user_id', missing)
        .select('user_id', 'level')
      for (const id of missing) this.levels.set(id, rows.find((r) => r.userId === id)?.level ?? 1)
    }
    return new Map(userIds.map((id) => [id, this.levels.get(id) ?? 1]))
  }

  /**
   * Nivel y logros de un jugador. `withProgress`: el avance hacia cada logro (solo para el
   * propio jugador).
   */
  async card(userId: number, options: { withProgress?: boolean } = {}) {
    const p =
      (await PlayerProgress.query().where('user_id', userId).first()) ??
      new PlayerProgress().merge({ userId, xp: 0, level: 1, hands: 0, wins: 0 })
    const owned = await UserAchievement.query().where('user_id', userId)
    const metrics = options.withProgress ? await this.metrics(p) : null

    return {
      ...levelProgress(Number(p.xp ?? 0)),
      level: p.level ?? 1,
      stats: {
        hands: p.hands ?? 0,
        wins: p.wins ?? 0,
        biggestPot: Number(p.biggestPot ?? 0),
        bestWinStreak: p.bestWinStreak ?? 0,
      },
      unlockedCount: owned.length,
      totalCount: ACHIEVEMENTS.length,
      achievements: ACHIEVEMENTS.map((achievement) => {
        const mine = owned.find((o) => o.achievementKey === achievement.key)
        const { key, name, description, category, tier, icon, xp, chips } = achievement
        return {
          key,
          name,
          description,
          category,
          tier,
          icon,
          xp,
          chips,
          unlockedAt: mine?.unlockedAt.toISO() ?? null,
          progress: metrics ? achievementProgress(achievement, metrics) : null,
        }
      }),
    }
  }

  /**
   * Para el buzón: logros que la app aún no anunció y subida de nivel pendiente de anunciar
   */
  async news(userId: number) {
    const p = await PlayerProgress.query().where('user_id', userId).first()
    if (!p) return { level: 1, levelUp: null, achievements: [] }
    const unseen = await UserAchievement.query()
      .where('user_id', userId)
      .whereNull('seen_at')
      .orderBy('unlocked_at', 'asc')
    const per = gameConfig.progress.levelRewardPerLevel
    let reward = 0
    for (let l = p.notifiedLevel + 1; l <= p.level; l++) reward += levelReward(l, per)
    return {
      level: p.level,
      levelUp:
        p.level > p.notifiedLevel ? { from: p.notifiedLevel, to: p.level, chips: reward } : null,
      achievements: unseen.flatMap((u) => {
        const achievement = ACHIEVEMENTS.find((x) => x.key === u.achievementKey)
        if (!achievement) return []
        const { key, name, description, tier, icon, xp, chips } = achievement
        return [{ key, name, description, tier, icon, xp, chips }]
      }),
    }
  }

  /** La app ya anunció los logros y el nivel */
  async markSeen(userId: number) {
    await UserAchievement.query()
      .where('user_id', userId)
      .whereNull('seen_at')
      .update({ seen_at: DateTime.now().toSQL() })
    await PlayerProgress.query()
      .where('user_id', userId)
      .update({ notified_level: db.raw('level') })
  }

  /** Solo tests */
  reset() {
    this.levels.clear()
  }
}

export default new ProgressService()
