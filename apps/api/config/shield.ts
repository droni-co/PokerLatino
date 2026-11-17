import { defineConfig } from '@adonisjs/shield'
const shieldConfig = defineConfig({
  /**
   * CSP para las páginas HTML del servidor (invitación /r/CODIGO)
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
   * Sin CSRF: la API se autentica con un token en la cabecera Authorization, no con
   * cookies, así que otra web no puede hacer peticiones en nombre del jugador.
   */
  csrf: {
    enabled: false,
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
