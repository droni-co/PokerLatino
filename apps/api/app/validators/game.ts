import vine from '@vinejs/vine'
export const sitValidator = vine.create({
  buyIn: vine.number().withoutDecimals().positive(),
  seatNumber: vine.number().withoutDecimals().positive().optional(),
})

export const quickSeatValidator = vine.create({
  buyIn: vine.number().withoutDecimals().positive(),
})

export const chatMessageValidator = vine.create({
  body: vine.string().trim().minLength(1).maxLength(200),
})

export const chatListValidator = vine.create({
  after: vine.number().withoutDecimals().min(0).optional(),
})

export const tableStateValidator = vine.create({
  chatAfter: vine.number().withoutDecimals().min(0).optional(),
})

export const transactionsValidator = vine.create({
  page: vine.number().withoutDecimals().positive().optional(),
  perPage: vine.number().withoutDecimals().range([1, 100]).optional(),
})

export const tableActionValidator = vine.create({
  action: vine.enum(['fold', 'check', 'call', 'bet', 'raise', 'all_in'] as const),
  // Para bet/raise: total a apostar en la calle ("subir a")
  amount: vine.number().withoutDecimals().positive().optional(),
  chatAfter: vine.number().withoutDecimals().min(0).optional(),
})

export const playerSearchValidator = vine.create({
  q: vine.string().trim().minLength(2).maxLength(30),
})

export const friendRequestValidator = vine.create({
  playerId: vine.number().withoutDecimals().positive(),
})

export const friendsListValidator = vine.create({
  roomId: vine.number().withoutDecimals().positive().optional(),
})
