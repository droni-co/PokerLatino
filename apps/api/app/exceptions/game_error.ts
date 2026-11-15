import { Exception } from '@adonisjs/core/exceptions'
import type { HttpContext } from '@adonisjs/core/http'

export type GameErrorCode =
  | 'room_not_found'
  | 'room_not_active'
  | 'room_full'
  | 'seat_taken'
  | 'invalid_seat'
  | 'invalid_buy_in'
  | 'already_seated'
  | 'not_seated'
  | 'hand_in_progress'
  | 'insufficient_funds'
  | 'invalid_amount'
  | 'deposit_not_found'
  | 'deposit_not_pending'
  | 'no_hand_in_progress'
  | 'not_in_hand'
  | 'not_your_turn'
  | 'invalid_action'

const STATUS: Record<GameErrorCode, number> = {
  room_not_found: 404,
  room_not_active: 409,
  room_full: 409,
  seat_taken: 409,
  invalid_seat: 422,
  invalid_buy_in: 422,
  already_seated: 409,
  not_seated: 404,
  hand_in_progress: 409,
  insufficient_funds: 422,
  invalid_amount: 422,
  deposit_not_found: 404,
  deposit_not_pending: 409,
  no_hand_in_progress: 409,
  not_in_hand: 409,
  not_your_turn: 409,
  invalid_action: 422,
}

/**
 * Error de reglas del juego/economía. Responde: { "error": "room_full", "message": "..." }
 */
export class GameError extends Exception {
  constructor(
    public errorCode: GameErrorCode,
    message: string
  ) {
    super(message, { status: STATUS[errorCode], code: errorCode })
  }

  async handle(error: this, { response }: HttpContext) {
    return response.status(error.status).send({ error: error.errorCode, message: error.message })
  }
}
