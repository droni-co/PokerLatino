import { PlayerProgressSchema } from '#database/schema'

/** Experiencia, nivel y métricas de logros de un jugador (incluye las manos de torneo) */
export default class PlayerProgress extends PlayerProgressSchema {
  static table = 'player_progress'
}
