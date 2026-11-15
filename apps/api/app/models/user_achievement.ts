import { UserAchievementSchema } from '#database/schema'

/** Logro desbloqueado (`seenAt` null: la app aún no se lo anunció al jugador) */
export default class UserAchievement extends UserAchievementSchema {}
