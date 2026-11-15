import { defineConfig } from '@adonisjs/shield'
import oauthConfig from '#config/oauth'

const isWebPage = (url: string) => oauthConfig.webPaths.includes(url)

const shieldConfig = defineConfig({
  /**
   * CSP para las páginas de login/registro. No se restringe `form-action` porque
   * el navegador también lo aplica a la redirección final hacia la app (esquema custom).
   */
  csp: {
    enabled: true,
    directives: {
      defaultSrc: [`'self'`],
      styleSrc: [`'self'`, '@nonce'],
      imgSrc: [`'self'`, 'data:'],
      frameAncestors: [`'none'`],
    },
    reportOnly: false,
  },

  /**
   * CSRF solo en los formularios HTML. Los endpoints JSON (/oauth/token, /api/*)
   * no usan cookies para autenticarse, así que no lo necesitan.
   */
  csrf: {
    enabled: true,
    exceptRoutes: (ctx) => !isWebPage(ctx.request.url()),
    enableXsrfCookie: false,
    methods: ['POST', 'PUT', 'PATCH', 'DELETE'],
  },

  xFrame: {
    enabled: true,
    action: 'DENY',
  },

  hsts: {
    enabled: true,
    maxAge: '180 days',
  },

  contentTypeSniffing: {
    enabled: true,
  },
})

export default shieldConfig
