import type { HttpContext } from '@adonisjs/core/http'
import socialService from '#services/game/social_service'
import {
  friendRequestValidator,
  friendsListValidator,
  playerSearchValidator,
} from '#validators/game'

export default class FriendsController {
  /**
   * GET /api/v1/friends?roomId=: amigos (conectados primero, con su mesa) y solicitudes.
   * Con `roomId` marca a quién ya invitaste a esa mesa.
   */
  async index({ auth, request }: HttpContext) {
    const { roomId } = await request.validateUsing(friendsListValidator, { data: request.qs() })
    return { data: await socialService.friends(auth.getUserOrFail(), { roomId }) }
  }

  /**
   * GET /api/v1/players?q=: buscar jugadores por nombre de usuario
   */
  async search({ auth, request }: HttpContext) {
    const { q } = await request.validateUsing(playerSearchValidator, { data: request.qs() })
    return { data: await socialService.search(auth.getUserOrFail().id, q) }
  }

  /**
   * POST /api/v1/friends/requests { playerId }: enviar una solicitud de amistad
   */
  async request({ auth, request, response }: HttpContext) {
    const { playerId } = await request.validateUsing(friendRequestValidator)
    const result = await socialService.request(auth.getUserOrFail(), playerId)
    return response.created({ data: result })
  }

  /**
   * POST /api/v1/friends/requests/:id/accept
   */
  async accept({ auth, params }: HttpContext) {
    await socialService.accept(auth.getUserOrFail(), Number(params.id))
    return { data: { relation: 'friend' } }
  }

  /**
   * DELETE /api/v1/friends/requests/:id: rechazar (recibida) o cancelar (enviada)
   */
  async dismiss({ auth, params, response }: HttpContext) {
    await socialService.dismiss(auth.getUserOrFail(), Number(params.id))
    return response.noContent()
  }

  /**
   * DELETE /api/v1/friends/:id: dejar de ser amigos
   */
  async destroy({ auth, params, response }: HttpContext) {
    await socialService.remove(auth.getUserOrFail(), Number(params.id))
    return response.noContent()
  }
}
