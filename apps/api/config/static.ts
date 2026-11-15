import { defineConfig } from '@adonisjs/static'

/**
 * Configuration options to tweak the static files middleware.
 * The complete set of options are documented on the
 * official documentation website.
 *
 * https://docs.adonisjs.com/guides/static-assets
 */
const staticServerConfig = defineConfig({
  enabled: true,
  etag: true,
  lastModified: true,
  dotFiles: 'ignore',
  // La app web (Flutter) no usa nombres con hash: el navegador revalida con el ETag
  // en cada carga, así una nueva versión se ve al instante sin perder la caché
  headers: () => ({ 'Cache-Control': 'no-cache' }),
})

export default staticServerConfig
