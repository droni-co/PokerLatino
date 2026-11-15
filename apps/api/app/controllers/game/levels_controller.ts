import type { HttpContext } from '@adonisjs/core/http'
import roomService from '#services/game/room_service'
import tableManager from '#game/table_manager'
import gameConfig from '#config/game'
import { quickSeatValidator } from '#validators/game'
import RoomLevelTransformer from '#transformers/room_level_transformer'
import RoomTransformer from '#transformers/room_transformer'

export default class LevelsController {
  /**
   * GET /api/v1/levels: niveles (categorías) con sus mesas abiertas
   */
  async index({ serialize }: HttpContext) {
    const levels = await roomService.levels()
    return serialize(RoomLevelTransformer.transform(levels))
  }

  /**
   * POST /api/v1/levels/:id/seat  { buyIn }
   *
   * El servidor elige la mesa (y abre otra si hace falta).
   * 201 { roomId, seat, alreadySeated: false }: se sentó.
   * 200 { roomId, seat, alreadySeated: true }: ya estaba en una mesa del nivel; no se cobra.
   */
  async seat({ auth, params, request, response }: HttpContext) {
    const input = await request.validateUsing(quickSeatValidator)
    const { seat, alreadySeated } = await roomService.quickSeat(
      auth.getUserOrFail(),
      Number(params.id),
      input
    )
    await seat.load('user')
    const data = { roomId: seat.roomId, seat: RoomTransformer.seat(seat), alreadySeated }
    if (alreadySeated) return { data }
    tableManager.scheduleStart(seat.roomId, gameConfig.table.firstHandDelayMs)
    return response.created({ data })
  }
}
