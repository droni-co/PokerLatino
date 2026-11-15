import type { HttpContext } from '@adonisjs/core/http'
import roomService from '#services/game/room_service'
import tableManager from '#game/table_manager'
import gameConfig from '#config/game'
import { sitValidator } from '#validators/game'
import RoomTransformer from '#transformers/room_transformer'

export default class RoomsController {
  /**
   * GET /api/v1/rooms
   */
  async index({ serialize }: HttpContext) {
    const rooms = await roomService.list()
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
    tableManager.scheduleStart(seat.roomId, gameConfig.table.firstHandDelayMs)
    return response.created({ data: RoomTransformer.seat(seat) })
  }

  /**
   * DELETE /api/v1/rooms/:id/seat
   *
   * 200 { cashedOut, pending: false }: se levantó y las fichas volvieron.
   * 202 { cashedOut: 0, pending: true }: estaba en una mano; se retira de ella
   *     y se levanta al terminarla.
   */
  async leave({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const roomId = Number(params.id)
    const result = await roomService.leave(user, roomId)
    if (result.pending) {
      await tableManager.requestLeave(roomId, user.id)
      return response.accepted({ data: result })
    }
    return { data: result }
  }
}
