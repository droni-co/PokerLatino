import type { HttpContext } from '@adonisjs/core/http'
import roomService from '#services/game/room_service'
import tableManager from '#game/table_manager'
import { listRoomsValidator, sitValidator } from '#validators/game'
import RoomTransformer from '#transformers/room_transformer'

export default class RoomsController {
  /**
   * GET /api/v1/rooms?currency=credits|usd
   */
  async index({ request, serialize }: HttpContext) {
    const filters = await request.validateUsing(listRoomsValidator, { data: request.qs() })
    const rooms = await roomService.list(filters)
    return serialize(RoomTransformer.transform(rooms))
  }

  /**
   * GET /api/v1/rooms/:id
   */
  async show({ params, serialize }: HttpContext) {
    const room = await roomService.find(Number(params.id))
    return serialize(RoomTransformer.transform(room))
  }

  /**
   * POST /api/v1/rooms/:id/seat  { buyIn, seatNumber? }
   */
  async sit({ auth, params, request, response }: HttpContext) {
    const input = await request.validateUsing(sitValidator)
    const seat = await roomService.sit(auth.getUserOrFail(), Number(params.id), input)
    await seat.load('user')
    // Si ya hay 2 o más jugadores, empieza una mano
    tableManager.scheduleStart(seat.roomId)
    return response.created({ data: RoomTransformer.seat(seat) })
  }

  /**
   * DELETE /api/v1/rooms/:id/seat
   */
  async leave({ auth, params }: HttpContext) {
    const result = await roomService.leave(auth.getUserOrFail(), Number(params.id))
    return { data: result }
  }
}
