import { HandCategory } from '#game/holdem/evaluator'

/**
 * Logros y niveles (reglas puras, sin base de datos).
 *
 * Nivel: hace falta 50·n·(n−1) de experiencia total para llegar al nivel n
 * (2 → 100 XP, 3 → 300, 4 → 600, 5 → 1,000, 10 → 4,500, 20 → 19,000…).
 * Cada nivel pide 100 XP más que el anterior.
 */

/** XP total necesaria para llegar a `level` */
export function xpForLevel(level: number) {
  return 50 * level * (level - 1)
}

/** Nivel que corresponde a una experiencia total */
export function levelForXp(xp: number) {
  let level = Math.max(1, Math.floor((1 + Math.sqrt(1 + Math.max(0, xp) / 12.5)) / 2))
  // Corrige el redondeo de la raíz en los bordes
  while (xpForLevel(level + 1) <= xp) level++
  while (level > 1 && xpForLevel(level) > xp) level--
  return level
}

/** Progreso dentro del nivel actual */
export function levelProgress(xp: number) {
  const level = levelForXp(xp)
  return { level, xp, levelXp: xpForLevel(level), nextLevelXp: xpForLevel(level + 1) }
}

/** Fichas por llegar a un nivel */
export function levelReward(level: number, perLevel: number) {
  return level * perLevel
}

/** Métricas con las que se comprueban los logros */
export type ProgressMetrics = {
  hands: number
  wins: number
  bestWinStreak: number
  biggestPot: number
  allInWins: number
  /** Bits de las categorías (HandCategory) con las que ganó un showdown */
  winCategories: number
  tournamentsPlayed: number
  tournamentsCashed: number
  tournamentsWon: number
  friends: number
  referrals: number
}

export type Metric = keyof Omit<ProgressMetrics, 'winCategories'> | 'winCategory'

export type AchievementCategory = 'manos' | 'victorias' | 'pozos' | 'jugadas' | 'torneos' | 'social'
export type AchievementTier = 'bronze' | 'silver' | 'gold' | 'diamond'

export type Achievement = {
  key: string
  name: string
  description: string
  category: AchievementCategory
  tier: AchievementTier
  /** Nombre del ícono (la app lo traduce a uno de los suyos) */
  icon: string
  metric: Metric
  /** Umbral; en `winCategory`, la categoría de mano */
  target: number
  xp: number
  chips: number
}

const a = (
  key: string,
  name: string,
  description: string,
  category: AchievementCategory,
  tier: AchievementTier,
  icon: string,
  metric: Metric,
  target: number,
  xp: number,
  chips: number
): Achievement => ({ key, name, description, category, tier, icon, metric, target, xp, chips })

export const ACHIEVEMENTS: Achievement[] = [
  // Manos jugadas
  a(
    'first_hand',
    'Primera mano',
    'Juega tu primera mano',
    'manos',
    'bronze',
    'cards',
    'hands',
    1,
    50,
    50
  ),
  a('hands_100', 'Habitual', 'Juega 100 manos', 'manos', 'bronze', 'cards', 'hands', 100, 150, 200),
  a(
    'hands_1000',
    'Veterano',
    'Juega 1,000 manos',
    'manos',
    'silver',
    'cards',
    'hands',
    1000,
    500,
    1000
  ),
  a(
    'hands_5000',
    'Curtido',
    'Juega 5,000 manos',
    'manos',
    'gold',
    'cards',
    'hands',
    5000,
    1200,
    3000
  ),
  a(
    'hands_20000',
    'Leyenda de la mesa',
    'Juega 20,000 manos',
    'manos',
    'diamond',
    'cards',
    'hands',
    20000,
    3000,
    8000
  ),

  // Manos ganadas
  a(
    'first_win',
    'Primera victoria',
    'Gana una mano',
    'victorias',
    'bronze',
    'trophy',
    'wins',
    1,
    50,
    50
  ),
  a('wins_50', 'Ganador', 'Gana 50 manos', 'victorias', 'bronze', 'trophy', 'wins', 50, 200, 300),
  a(
    'wins_500',
    'Tiburón',
    'Gana 500 manos',
    'victorias',
    'silver',
    'trophy',
    'wins',
    500,
    800,
    2000
  ),
  a(
    'wins_2500',
    'Depredador',
    'Gana 2,500 manos',
    'victorias',
    'gold',
    'trophy',
    'wins',
    2500,
    2000,
    6000
  ),
  a(
    'streak_3',
    'En racha',
    'Gana 3 manos seguidas',
    'victorias',
    'bronze',
    'fire',
    'bestWinStreak',
    3,
    150,
    200
  ),
  a(
    'streak_5',
    'Imparable',
    'Gana 5 manos seguidas',
    'victorias',
    'silver',
    'fire',
    'bestWinStreak',
    5,
    400,
    600
  ),
  a(
    'streak_8',
    'Intocable',
    'Gana 8 manos seguidas',
    'victorias',
    'gold',
    'fire',
    'bestWinStreak',
    8,
    1000,
    2000
  ),
  a(
    'all_in_win',
    'Todo o nada',
    'Gana una mano yendo all-in',
    'victorias',
    'bronze',
    'bolt',
    'allInWins',
    1,
    100,
    150
  ),
  a(
    'all_in_25',
    'Sangre fría',
    'Gana 25 manos yendo all-in',
    'victorias',
    'silver',
    'bolt',
    'allInWins',
    25,
    500,
    1000
  ),

  // Pozos
  a(
    'pot_1000',
    'Buen pozo',
    'Gana un pozo de 1,000 fichas',
    'pozos',
    'bronze',
    'chips',
    'biggestPot',
    1000,
    100,
    150
  ),
  a(
    'pot_10000',
    'Pozo enorme',
    'Gana un pozo de 10,000 fichas',
    'pozos',
    'silver',
    'chips',
    'biggestPot',
    10000,
    400,
    800
  ),
  a(
    'pot_100000',
    'Botín legendario',
    'Gana un pozo de 100,000 fichas',
    'pozos',
    'gold',
    'chips',
    'biggestPot',
    100000,
    1000,
    3000
  ),

  // Jugadas (ganando el showdown)
  a(
    'win_straight',
    'Escalera',
    'Gana un showdown con escalera',
    'jugadas',
    'bronze',
    'hand',
    'winCategory',
    HandCategory.Straight,
    100,
    100
  ),
  a(
    'win_flush',
    'Color',
    'Gana un showdown con color',
    'jugadas',
    'bronze',
    'hand',
    'winCategory',
    HandCategory.Flush,
    100,
    100
  ),
  a(
    'win_full_house',
    'Full',
    'Gana un showdown con full',
    'jugadas',
    'silver',
    'hand',
    'winCategory',
    HandCategory.FullHouse,
    200,
    250
  ),
  a(
    'win_four_kind',
    'Póker',
    'Gana un showdown con póker',
    'jugadas',
    'gold',
    'hand',
    'winCategory',
    HandCategory.FourOfAKind,
    500,
    800
  ),
  a(
    'win_straight_flush',
    'Escalera de color',
    'Gana un showdown con escalera de color',
    'jugadas',
    'diamond',
    'hand',
    'winCategory',
    HandCategory.StraightFlush,
    1500,
    3000
  ),

  // Torneos
  a(
    'tournament_first',
    'Debut',
    'Juega tu primer torneo',
    'torneos',
    'bronze',
    'tournament',
    'tournamentsPlayed',
    1,
    100,
    100
  ),
  a(
    'tournament_10',
    'Habitual de torneos',
    'Juega 10 torneos',
    'torneos',
    'silver',
    'tournament',
    'tournamentsPlayed',
    10,
    400,
    600
  ),
  a(
    'tournament_cash',
    'En los premios',
    'Cobra premio en un torneo',
    'torneos',
    'silver',
    'medal',
    'tournamentsCashed',
    1,
    300,
    300
  ),
  a(
    'tournament_win',
    'Campeón',
    'Gana un torneo',
    'torneos',
    'gold',
    'crown',
    'tournamentsWon',
    1,
    800,
    1000
  ),
  a(
    'tournament_wins_5',
    'Multicampeón',
    'Gana 5 torneos',
    'torneos',
    'diamond',
    'crown',
    'tournamentsWon',
    5,
    2000,
    4000
  ),

  // Social
  a(
    'first_friend',
    'Buena compañía',
    'Haz tu primer amigo',
    'social',
    'bronze',
    'friends',
    'friends',
    1,
    50,
    50
  ),
  a(
    'friends_10',
    'Popular',
    'Ten 10 amigos',
    'social',
    'silver',
    'friends',
    'friends',
    10,
    300,
    400
  ),
  a(
    'referral_first',
    'Embajador',
    'Invita a un amigo que cree su cuenta',
    'social',
    'silver',
    'invite',
    'referrals',
    1,
    200,
    200
  ),
  a(
    'referral_10',
    'Anfitrión',
    'Invita a 10 amigos que creen su cuenta',
    'social',
    'gold',
    'invite',
    'referrals',
    10,
    1000,
    1500
  ),
]

export const ACHIEVEMENT_KEYS = new Set(ACHIEVEMENTS.map((x) => x.key))

/** Avance hacia un logro: `current` de `target` (en jugadas, 0 o 1) */
export function achievementProgress(achievement: Achievement, m: ProgressMetrics) {
  if (achievement.metric === 'winCategory') {
    const done = (m.winCategories & (1 << achievement.target)) !== 0
    return { current: done ? 1 : 0, target: 1, done }
  }
  const current = m[achievement.metric]
  return {
    current: Math.min(current, achievement.target),
    target: achievement.target,
    done: current >= achievement.target,
  }
}

/** Logros que se cumplen con estas métricas y aún no tiene */
export function newlyUnlocked(m: ProgressMetrics, unlocked: Set<string>) {
  return ACHIEVEMENTS.filter((x) => !unlocked.has(x.key) && achievementProgress(x, m).done)
}

/** Lo que aporta una mano a la experiencia y a las métricas de un jugador */
export type HandOutcome = {
  won: boolean
  amountWon: number
  allIn: boolean
  /** Categoría de su mano si ganó un showdown */
  winningCategory: HandCategory | null
}
