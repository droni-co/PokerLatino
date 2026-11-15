import vine from '@vinejs/vine'
import { CURRENCIES } from '#config/game'

export const listRoomsValidator = vine.create({
  currency: vine.enum(CURRENCIES).optional(),
})

export const sitValidator = vine.create({
  buyIn: vine.number().withoutDecimals().positive(),
  seatNumber: vine.number().withoutDecimals().positive().optional(),
})

export const createDepositValidator = vine.create({
  amount: vine.number().withoutDecimals().positive(),
})

export const transactionsValidator = vine.create({
  page: vine.number().withoutDecimals().positive().optional(),
  perPage: vine.number().withoutDecimals().range([1, 100]).optional(),
})

export const tableActionValidator = vine.create({
  action: vine.enum(['fold', 'check', 'call', 'bet', 'raise', 'all_in'] as const),
  // Para bet/raise: total a apostar en la calle ("subir a")
  amount: vine.number().withoutDecimals().positive().optional(),
})
