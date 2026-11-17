import app from '@adonisjs/core/services/app'
import { errors as authErrors } from '@adonisjs/auth'
import { type HttpContext, ExceptionHandler } from '@adonisjs/core/http'

export default class HttpExceptionHandler extends ExceptionHandler {
  /**
   * In debug mode, the exception handler will display verbose errors
   * with pretty printed stack traces.
   */
  protected debug = !app.inProduction

  async handle(error: unknown, ctx: HttpContext) {
    /**
     * Token ausente, vencido o invalidado (p. ej. el jugador inició sesión en otro
     * dispositivo): la app vuelve a la pantalla de inicio de sesión
     */
    if (error instanceof authErrors.E_UNAUTHORIZED_ACCESS) {
      return ctx.response.unauthorized({
        error: 'unauthorized',
        message: 'Tu sesión terminó. Inicia sesión de nuevo.',
      })
    }

    return super.handle(error, ctx)
  }

  async report(error: unknown, ctx: HttpContext) {
    return super.report(error, ctx)
  }
}
