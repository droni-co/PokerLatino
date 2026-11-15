import { symbols, errors } from '@adonisjs/auth'
import type { HttpContext } from '@adonisjs/core/http'
import type { AuthClientResponse, GuardContract } from '@adonisjs/auth/types'
import type User from '#models/user'

/**
 * Import diferido: este archivo se carga desde config/auth.ts, antes de que
 * existan servicios como `hash`, que el modelo User necesita.
 */
async function getOAuthServer() {
  const { default: server } = await import('#services/oauth/oauth_server')
  return server
}

/**
 * Guard que autentica peticiones con un access token OAuth2:
 *   Authorization: Bearer pl_at_xxx
 */
export class OAuthGuard implements GuardContract<User> {
  declare [symbols.GUARD_KNOWN_EVENTS]: {}

  readonly driverName = 'oauth2' as const

  authenticationAttempted = false
  isAuthenticated = false
  user?: User

  constructor(private ctx: HttpContext) {}

  getUserOrFail(): User {
    if (!this.user) {
      throw new errors.E_UNAUTHORIZED_ACCESS('Unauthorized access', {
        guardDriverName: this.driverName,
      })
    }
    return this.user
  }

  async authenticate(): Promise<User> {
    if (this.authenticationAttempted) return this.getUserOrFail()
    this.authenticationAttempted = true

    const header = this.ctx.request.header('authorization')
    const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : undefined
    const server = await getOAuthServer()
    const result = token ? await server.verifyAccessToken(token) : null

    if (!result) {
      // RFC 6750 §3
      this.ctx.response.header(
        'WWW-Authenticate',
        token ? 'Bearer error="invalid_token"' : 'Bearer realm="poker-latino"'
      )
      throw new errors.E_UNAUTHORIZED_ACCESS('Unauthorized access', {
        guardDriverName: this.driverName,
      })
    }

    this.user = result.user
    this.user.currentAccessToken = result.token
    this.isAuthenticated = true
    return this.user
  }

  async check(): Promise<boolean> {
    try {
      await this.authenticate()
      return true
    } catch (error) {
      if (error instanceof errors.E_UNAUTHORIZED_ACCESS) return false
      throw error
    }
  }

  /**
   * Verifica que el token actual tenga el scope indicado
   */
  hasScope(scope: string) {
    return this.user?.currentAccessToken?.scopes.includes(scope) ?? false
  }

  /**
   * Usado por `client.loginAs(user)` en los tests
   */
  async authenticateAsClient(user: User): Promise<AuthClientResponse> {
    const server = await getOAuthServer()
    const { token } = await server.issueTestToken(user)
    return { headers: { authorization: `Bearer ${token}` } }
  }
}

export function oauthGuard() {
  return {
    async resolver() {
      return (ctx: HttpContext) => new OAuthGuard(ctx)
    },
  }
}
