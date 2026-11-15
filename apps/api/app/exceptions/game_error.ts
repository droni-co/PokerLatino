import { Exception } from '@adonisjs/core/exceptions'
import type { HttpContext } from '@adonisjs/core/http'

export type GameErrorCode =
  | 'room_not_found'
  | 'level_not_found'
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
  | 'no_hand_in_progress'
  | 'not_in_hand'
  | 'cannot_show'
  | 'not_your_turn'
  | 'invalid_action'
  | 'invalid_message'
  | 'chat_rate_limited'
  | 'tournament_not_found'
  | 'tournament_closed'
  | 'tournament_full'
  | 'already_registered'
  | 'not_registered'
  | 'tournament_table'
  | 'rescue_unavailable'
  | 'player_not_found'
  | 'invalid_friend_request'
  | 'already_friends'
  | 'friend_request_exists'
  | 'friend_request_not_found'
  | 'friend_limit'
  | 'not_friends'
  | 'already_invited'
  | 'invitation_not_found'
  | 'invitation_expired'

const STATUS: Record<GameErrorCode, number> = {
  room_not_found: 404,
  level_not_found: 404,
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
  no_hand_in_progress: 409,
  not_in_hand: 409,
  cannot_show: 409,
  not_your_turn: 409,
  invalid_action: 422,
  invalid_message: 422,
  chat_rate_limited: 429,
  tournament_not_found: 404,
  tournament_closed: 409,
  tournament_full: 409,
  already_registered: 409,
  not_registered: 404,
  tournament_table: 409,
  rescue_unavailable: 409,
  player_not_found: 404,
  invalid_friend_request: 422,
  already_friends: 409,
  friend_request_exists: 409,
  friend_request_not_found: 404,
  friend_limit: 409,
  not_friends: 409,
  already_invited: 409,
  invitation_not_found: 404,
  invitation_expired: 409,
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
