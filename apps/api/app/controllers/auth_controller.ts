import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import accountService from '#services/game/account_service'
import UserTransformer from '#transformers/user_transformer'
import { loginValidator, registerValidator } from '#validators/user'
import { REFERRAL_COOKIE } from '#controllers/invite_controller'

/**
 * Cuentas: registro, inicio y cierre de sesión con email + contraseña.
 *
 * Responden `{ data: { token, user } }`. El token se envía después en cada petición
 * (Authorization: Bearer pl_...). Un jugador solo puede tener una sesión abierta: al
 * iniciar sesión se borran sus tokens anteriores y el otro dispositivo recibe 401.
 */
export default class AuthController {
  /**
   * POST /api/v1/auth/register
   */
  async register({ request, response }: HttpContext) {
    const {
      username,
      email,
      password,
      birth_date: birthDate,
      referral_code: referralCode,
    } = await request.validateUsing(registerValidator)

    // Código de invitación: el del formulario o, si llegó por un enlace /r/CODIGO en este
    // navegador, el que quedó guardado en la cookie
    const code = referralCode ?? (request.cookie(REFERRAL_COOKIE) as string | undefined)
    const user = await accountService.register(
      { username, email, password, birthDate },
      code ? { code, ip: request.ip() } : undefined
    )
    response.clearCookie(REFERRAL_COOKIE)

    const token = await User.accessTokens.create(user)
    return response.created({
      data: { token: token.value!.release(), user: UserTransformer.plain(user) },
    })
  }

  /**
   * POST /api/v1/auth/login: cierra cualquier otra sesión del jugador
   */
  async login({ request, response }: HttpContext) {
    const { email, password } = await request.validateUsing(loginValidator)

    let user: User
    try {
      user = await User.verifyCredentials(email, password)
    } catch {
      return response.unauthorized({
        error: 'invalid_credentials',
        message: 'Email o contraseña incorrectos',
      })
    }
    if (user.isBot) {
      return response.unauthorized({
        error: 'invalid_credentials',
        message: 'Email o contraseña incorrectos',
      })
    }

    // Una sola sesión: los demás dispositivos quedan fuera
    await User.accessTokens.deleteAll(user)
    const token = await User.accessTokens.create(user)
    return { data: { token: token.value!.release(), user: UserTransformer.plain(user) } }
  }

  /**
   * DELETE /api/v1/auth/logout: invalida el token de esta sesión
   */
  async logout({ auth, response }: HttpContext) {
    const user = auth.getUserOrFail()
    await User.accessTokens.delete(user, user.currentAccessToken.identifier)
    return response.noContent()
  }
}
