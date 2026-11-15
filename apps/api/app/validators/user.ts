import vine from '@vinejs/vine'
import { DateTime } from 'luxon'
import gameConfig, { AVATARS } from '#config/game'

const email = () => vine.string().trim().toLowerCase().email().maxLength(254)

/**
 * Nombre de usuario único sin distinguir mayúsculas. Al editar el perfil, [exceptUserId]
 * permite conservar el propio.
 */
const username = (exceptUserId?: number) =>
  vine
    .string()
    .trim()
    .minLength(gameConfig.username.minLength)
    .maxLength(gameConfig.username.maxLength)
    .regex(gameConfig.username.pattern)
    .unique({
      table: 'users',
      column: 'username',
      caseInsensitive: true,
      filter: exceptUserId
        ? (db) => {
            db.whereNot('id', exceptUserId)
          }
        : undefined,
    })

export const registerValidator = vine.create({
  username: username(),
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
  // Código de invitación (opcional): debe existir
  referral_code: vine
    .string()
    .trim()
    .toUpperCase()
    .maxLength(16)
    .exists({ table: 'users', column: 'referral_code' })
    .optional(),
})

export const loginValidator = vine.create({
  email: email(),
  password: vine.string().maxLength(72),
})

/**
 * PATCH /api/v1/me: cada campo es opcional; `avatar: null` vuelve al avatar al azar
 */
export const updateProfileValidator = (userId: number) =>
  vine.create({
    username: username(userId).optional(),
    avatar: vine.enum(AVATARS).nullable().optional(),
  })
