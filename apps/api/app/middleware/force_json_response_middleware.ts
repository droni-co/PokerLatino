import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import oauthConfig from '#config/oauth'

/**
 * Fuerza respuestas JSON en toda la API, excepto en las páginas HTML del flujo OAuth.
 */
export default class ForceJsonResponseMiddleware {
  handle(ctx: HttpContext, next: NextFn) {
    if (!oauthConfig.webPaths.includes(ctx.request.url())) {
      ctx.request.request.headers.accept = 'application/json'
    }
    return next()
  }
}
