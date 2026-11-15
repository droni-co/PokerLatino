import type { HttpContext } from '@adonisjs/core/http'
import tableManager from '#game/table_manager'
import { tableActionValidator, tableStateValidator } from '#validators/game'

export default class TablesController {
  /**
   * GET /api/v1/rooms/:id/state: estado de la mesa visto por el jugador
   * (solo incluye sus propias cartas)
   */
  async show({ auth, params, request }: HttpContext) {
    const { chatAfter } = await request.validateUsing(tableStateValidator, { data: request.qs() })
    const userId = auth.getUserOrFail().id
    return { data: await tableManager.getState(Number(params.id), userId, { chatAfter }) }
  }

  /**
   * POST /api/v1/rooms/:id/actions  { action, amount? }
   */
  async act({ auth, params, request }: HttpContext) {
    const { action, amount, chatAfter } = await request.validateUsing(tableActionValidator)
    const roomId = Number(params.id)
    const userId = auth.getUserOrFail().id

    await tableManager.act(roomId, userId, { type: action, amount })
    return { data: await tableManager.getState(roomId, userId, { chatAfter }) }
  }

  /**
   * POST /api/v1/rooms/:id/show: enseñar mis cartas al terminar la mano (voluntario)
   */
  async showCards({ auth, params, request }: HttpContext) {
    const { chatAfter } = await request.validateUsing(tableStateValidator)
    const roomId = Number(params.id)
    const userId = auth.getUserOrFail().id

    await tableManager.show(roomId, userId)
    return { data: await tableManager.getState(roomId, userId, { chatAfter }) }
  }
}
