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
     * Errores del guard OAuth2 en la API: respuesta JSON estilo RFC 6750
     */
    if (error instanceof authErrors.E_UNAUTHORIZED_ACCESS && error.guardDriverName === 'oauth2') {
      return ctx.response.unauthorized({
        error: 'invalid_token',
        error_description: 'Access token ausente, inválido o expirado',
      })
    }

    return super.handle(error, ctx)
  }

  async report(error: unknown, ctx: HttpContext) {
    return super.report(error, ctx)
  }
}
