import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

/**
 * Exige que el access token tenga TODOS los scopes indicados.
 * Uso: .use([middleware.auth(), middleware.scope({ scopes: ['game'] })])
 */
export default class ScopeMiddleware {
  async handle(ctx: HttpContext, next: NextFn, options: { scopes: string[] }) {
    const granted = ctx.auth.user?.currentAccessToken?.scopes ?? []
    const missing = options.scopes.filter((s) => !granted.includes(s))

    if (missing.length) {
      // RFC 6750 §3.1
      ctx.response.header(
        'WWW-Authenticate',
        `Bearer error="insufficient_scope", scope="${options.scopes.join(' ')}"`
      )
      return ctx.response.forbidden({
        error: 'insufficient_scope',
        error_description: `Faltan scopes: ${missing.join(', ')}`,
      })
    }

    return next()
  }
}
