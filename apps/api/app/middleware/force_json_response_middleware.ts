import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

/**
 * Fuerza respuestas JSON (también en los errores) en toda la API
 */
export default class ForceJsonResponseMiddleware {
  handle(ctx: HttpContext, next: NextFn) {
    ctx.request.request.headers.accept = 'application/json'
    return next()
  }
}
