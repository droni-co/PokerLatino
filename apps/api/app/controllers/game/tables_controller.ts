import type { HttpContext } from '@adonisjs/core/http'
import tableManager from '#game/table_manager'
import { tableActionValidator } from '#validators/game'

export default class TablesController {
  /**
   * GET /api/v1/rooms/:id/state: estado de la mesa visto por el jugador
   * (solo incluye sus propias cartas)
   */
  async show({ auth, params }: HttpContext) {
    return { data: await tableManager.getState(Number(params.id), auth.getUserOrFail().id) }
  }

  /**
   * POST /api/v1/rooms/:id/actions  { action, amount? }
   */
  async act({ auth, params, request }: HttpContext) {
    const { action, amount } = await request.validateUsing(tableActionValidator)
    const roomId = Number(params.id)
    const userId = auth.getUserOrFail().id

    await tableManager.act(roomId, userId, { type: action, amount })
    return { data: await tableManager.getState(roomId, userId) }
  }
}
