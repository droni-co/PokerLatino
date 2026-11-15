import { TournamentEntrySchema } from '#database/schema'
import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Tournament from '#models/tournament'
import User from '#models/user'

/**
 * Inscripción a un torneo.
 * - registered: inscrito, el torneo aún no empieza
 * - playing: sentado en una mesa del torneo
 * - eliminated / winner: terminó, con `finishPosition` y `prize`
 */
export type TournamentEntryStatus = 'registered' | 'playing' | 'eliminated' | 'winner'

export default class TournamentEntry extends TournamentEntrySchema {
  declare status: TournamentEntryStatus

  @belongsTo(() => Tournament)
  declare tournament: BelongsTo<typeof Tournament>

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>
}
