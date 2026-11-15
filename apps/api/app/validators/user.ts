import vine from '@vinejs/vine'
import { DateTime } from 'luxon'
import gameConfig from '#config/game'

const email = () => vine.string().trim().toLowerCase().email().maxLength(254)

export const registerValidator = vine.create({
  email: email().unique({ table: 'users', column: 'email' }),
  password: vine
    .string()
    .minLength(8)
    .maxLength(72)
    .confirmed({ confirmationField: 'password_confirmation' }),
  // Debe haber cumplido la edad mínima hoy (ver Legal.md: es declarativo, no reemplaza KYC)
  birth_date: vine
    .date({ formats: ['YYYY-MM-DD'] })
    .afterOrEqual('1900-01-01')
    .beforeOrEqual(() =>
      DateTime.now().minus({ years: gameConfig.minimumAge }).toFormat('yyyy-MM-dd')
    ),
})

export const loginValidator = vine.create({
  email: email(),
  password: vine.string().maxLength(72),
})
