import { defineConfig } from '@adonisjs/auth'
import { sessionGuard, sessionUserProvider } from '@adonisjs/auth/session'
import type { InferAuthenticators, InferAuthEvents, Authenticators } from '@adonisjs/auth/types'
import { oauthGuard } from '#auth/oauth_guard'

const authConfig = defineConfig({
  default: 'api',

  guards: {
    /**
     * API: access tokens OAuth2 (Authorization: Bearer ...)
     */
    api: oauthGuard(),

    /**
     * Web: sesión del navegador durante el flujo /oauth/authorize (login y registro)
     */
    web: sessionGuard({
      useRememberMeTokens: false,
      provider: sessionUserProvider({
        model: () => import('#models/user'),
      }),
    }),
  },
})

export default authConfig

declare module '@adonisjs/auth/types' {
  export interface Authenticators extends InferAuthenticators<typeof authConfig> {}
}
declare module '@adonisjs/core/types' {
  interface EventsList extends InferAuthEvents<Authenticators> {}
}
