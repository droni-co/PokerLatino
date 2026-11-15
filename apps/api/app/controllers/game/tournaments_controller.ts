import type { HttpContext } from '@adonisjs/core/http'
import tournamentService from '#services/game/tournament_service'
import { tournamentSummary } from '#transformers/tournament_transformer'

export default class TournamentsController {
  /**
   * GET /api/v1/tournaments: abiertos, en juego y terminados recientemente
   */
  async index({ auth }: HttpContext) {
    const user = auth.getUserOrFail()
    const tournaments = await tournamentService.list()
    const viewer = await tournamentService.viewerInfo(
      user.id,
      tournaments.map((t) => t.id)
    )
    return { data: tournaments.map((t) => tournamentSummary(t, viewer.get(t.id))) }
  }

  /**
   * GET /api/v1/tournaments/:id: detalle, premios por puesto y clasificación
   */
  async show({ auth, params }: HttpContext) {
    const user = auth.getUserOrFail()
    const tournament = await tournamentService.find(Number(params.id))
    const viewer = await tournamentService.viewerInfo(user.id, [tournament.id])
    return {
      data: {
        ...tournamentSummary(tournament, viewer.get(tournament.id)),
        payouts: tournamentService.payouts(tournament),
        standings: await tournamentService.standings(tournament),
      },
    }
  }

  /**
   * POST /api/v1/tournaments/:id/entry: inscribirse (se cobra la inscripción)
   */
  async register({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const id = Number(params.id)
    await tournamentService.register(user, id)
    return response.created(await this.summary(user.id, id))
  }

  /**
   * DELETE /api/v1/tournaments/:id/entry: salirse antes de que empiece (reembolso completo)
   */
  async unregister({ auth, params }: HttpContext) {
    const user = auth.getUserOrFail()
    const id = Number(params.id)
    const { refunded } = await tournamentService.unregister(user, id)
    return { ...(await this.summary(user.id, id)), refunded }
  }

  private async summary(userId: number, id: number) {
    const tournament = await tournamentService.find(id)
    const viewer = await tournamentService.viewerInfo(userId, [id])
    return { data: tournamentSummary(tournament, viewer.get(id)) }
  }
}
