import type { HttpContext } from '@adonisjs/core/http'
import socialService from '#services/game/social_service'
import { friendRequestValidator } from '#validators/game'

export default class InvitationsController {
  /**
   * GET /api/v1/inbox: solicitudes de amistad sin responder e invitaciones a mesas.
   * La app lo consulta cada pocos segundos (también cuenta como "conectado").
   */
  async inbox({ auth }: HttpContext) {
    return { data: await socialService.inbox(auth.getUserOrFail()) }
  }

  /**
   * POST /api/v1/rooms/:id/invitations { playerId }: invitar a un amigo a tu mesa
   */
  async store({ auth, params, request, response }: HttpContext) {
    const { playerId } = await request.validateUsing(friendRequestValidator)
    const invitation = await socialService.invite(auth.getUserOrFail(), Number(params.id), playerId)
    return response.created({
      data: { id: invitation.id, expiresAt: invitation.expiresAt.toISO() },
    })
  }

  /**
   * POST /api/v1/invitations/:id/accept: devuelve { roomId } para ir a la mesa
   */
  async accept({ auth, params }: HttpContext) {
    return { data: await socialService.respond(auth.getUserOrFail(), Number(params.id), true) }
  }

  /**
   * DELETE /api/v1/invitations/:id: "ahora no"
   */
  async decline({ auth, params, response }: HttpContext) {
    await socialService.respond(auth.getUserOrFail(), Number(params.id), false)
    return response.noContent()
  }
}
