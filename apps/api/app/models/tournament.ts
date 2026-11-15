import { TournamentSchema } from '#database/schema'
import { hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import TournamentEntry from '#models/tournament_entry'
import Room from '#models/room'

export type TournamentStatus = 'registering' | 'running' | 'finished' | 'cancelled'

/**
 * Torneo: se crea directamente en la base de datos (más adelante, desde el backoffice).
 * El cupo es `tableCount * maxSeats` y empieza cuando llega `startsAt` con el cupo lleno.
 */
export default class Tournament extends TournamentSchema {
  declare status: TournamentStatus

  get capacity() {
    return this.tableCount * this.maxSeats
  }

  @hasMany(() => TournamentEntry)
  declare entries: HasMany<typeof TournamentEntry>

  @hasMany(() => Room)
  declare rooms: HasMany<typeof Room>
}
