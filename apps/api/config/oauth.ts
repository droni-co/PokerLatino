import env from '#start/env'

/**
 * Configuración del servidor OAuth2 (authorization_code + PKCE, refresh tokens con rotación).
 */
const oauthConfig = {
  /**
   * Identificador del servidor de autorización (RFC 8414). Debe ser la URL pública de la API.
   */
  issuer: env.get('APP_URL'),

  /**
   * Scopes que existen en el sistema
   */
  scopes: {
    profile: 'Ver tu email y datos de cuenta',
    game: 'Unirte a mesas y jugar con tus fichas',
  } as Record<string, string>,

  /**
   * Scopes que se otorgan cuando el cliente no envía `scope`
   */
  defaultScopes: ['profile', 'game'],

  /**
   * Duración de cada credencial, en segundos
   */
  ttl: {
    authorizationCode: 5 * 60, // 5 minutos (RFC 6749 recomienda máx. 10)
    accessToken: 15 * 60, // 15 minutos
    refreshToken: 30 * 24 * 60 * 60, // 30 días (se renueva al rotar)
  },

  /**
   * Rutas que son páginas HTML (formularios con sesión y CSRF).
   * El resto de la API responde siempre JSON y no usa CSRF.
   */
  webPaths: ['/oauth/authorize', '/oauth/login', '/oauth/register', '/oauth/logout'],

  /**
   * Prefijos para reconocer fácilmente el tipo de token (y detectarlos en logs/secret scanners)
   */
  tokenPrefix: {
    accessToken: 'pl_at_',
    refreshToken: 'pl_rt_',
    clientSecret: 'pl_cs_',
  },
}

export default oauthConfig
