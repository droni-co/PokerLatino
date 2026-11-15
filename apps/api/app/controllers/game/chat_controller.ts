import type { HttpContext } from '@adonisjs/core/http'
import chatService, { publicMessage } from '#services/game/chat_service'
import { chatListValidator, chatMessageValidator } from '#validators/game'

export default class ChatController {
  /**
   * GET /api/v1/rooms/:id/chat?after=<id>: historial de la mesa
   */
  async index({ params, request }: HttpContext) {
    const { after } = await request.validateUsing(chatListValidator, { data: request.qs() })
    const messages = await chatService.list(Number(params.id), after)
    return { data: messages.map(publicMessage) }
  }

  /**
   * POST /api/v1/rooms/:id/chat  { body }
   */
  async store({ auth, params, request, response }: HttpContext) {
    const { body } = await request.validateUsing(chatMessageValidator)
    const message = await chatService.send(auth.getUserOrFail(), Number(params.id), body)
    return response.created({ data: publicMessage(message) })
  }
}
