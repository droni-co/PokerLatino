import type Tournament from '#models/tournament'
import type TournamentEntry from '#models/tournament_entry'

type Viewer = { entry: TournamentEntry; roomId: number | null } | undefined

/**
 * Torneo para el lobby. `you`: la inscripción del jugador que consulta (null si no está
 * inscrito), con la mesa en la que juega y su resultado.
 */
export function tournamentSummary(tournament: Tournament, viewer: Viewer) {
  return {
    id: tournament.id,
    slug: tournament.slug,
    name: tournament.name,
    description: tournament.description,
    status: tournament.status,
    startsAt: tournament.startsAt.toISO(),
    startedAt: tournament.startedAt?.toISO() ?? null,
    finishedAt: tournament.finishedAt?.toISO() ?? null,
    buyIn: tournament.buyIn,
    startingStack: tournament.startingStack,
    smallBlind: tournament.smallBlind,
    bigBlind: tournament.bigBlind,
    blindsUpEveryHands: tournament.blindsUpEveryHands,
    maxSeats: tournament.maxSeats,
    tableCount: tournament.tableCount,
    capacity: tournament.capacity,
    actionTimeoutSeconds: tournament.actionTimeoutSeconds,
    entriesCount: Number(tournament.$extras.entriesCount ?? 0),
    playersLeft: Number(tournament.$extras.playersLeft ?? 0),
    prizePool:
      tournament.status === 'registering'
        ? Number(tournament.$extras.entriesCount ?? 0) * tournament.buyIn
        : tournament.prizePool,
    you: viewer
      ? {
          status: viewer.entry.status,
          roomId: viewer.roomId,
          position: viewer.entry.finishPosition,
          prize: viewer.entry.prize,
        }
      : null,
  }
}
