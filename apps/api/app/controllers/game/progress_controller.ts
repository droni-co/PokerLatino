import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import progressService from '#services/game/progress_service'
import socialService, { publicPlayer } from '#services/game/social_service'
import { GameError } from '#exceptions/game_error'

export default class ProgressController {
  /**
   * GET /api/v1/me/progress: tu nivel, XP y todos los logros con tu avance
   */
  async show({ auth }: HttpContext) {
    return { data: await progressService.card(auth.getUserOrFail().id, { withProgress: true }) }
  }

  /**
   * POST /api/v1/me/progress/seen: la app ya anunció los logros nuevos y el nivel
   */
  async seen({ auth, response }: HttpContext) {
    await progressService.markSeen(auth.getUserOrFail().id)
    return response.noContent()
  }

  /**
   * GET /api/v1/players/:id: tarjeta pública de un jugador (nivel, estadísticas, logros
   * y tu relación con él). Nunca incluye el email.
   */
  async player({ auth, params }: HttpContext) {
    const me = auth.getUserOrFail()
    const user = await User.find(Number(params.id))
    if (!user) throw new GameError('player_not_found', 'Ese jugador no existe')
    const card = await progressService.card(user.id)
    return {
      data: {
        player: publicPlayer(user),
        memberSince: user.createdAt.toISO(),
        relation:
          user.id === me.id
            ? { status: 'self', requestId: null }
            : await socialService.relation(me.id, user.id),
        ...card,
      },
    }
  }
}
