import { existsSync } from 'node:fs'
import app from '@adonisjs/core/services/app'
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

/**
 * Prefijos que pertenecen al servidor; todo lo demás es una ruta de la app web
 */
const SERVER_PREFIXES = ['/api', '/oauth', '/.well-known', '/health', '/r']

/**
 * La app web (Flutter, compilada en `public/`) usa rutas con path (`/lobby`, `/rooms/5`).
 * Si el navegador pide una de ellas directamente (recarga, enlace compartido), no existe
 * como archivo: se responde con `index.html` y la app resuelve la ruta.
 *
 * Va después del middleware de archivos estáticos, así que solo actúa cuando no hay archivo.
 */
export default class SpaFallbackMiddleware {
  #index = app.publicPath('index.html')

  handle({ request, response }: HttpContext, next: NextFn) {
    const method = request.method()
    const path = request.url()
    const isServerPath = SERVER_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))
    // Una petición a un archivo que no existe (p. ej. /favicon.ico) sigue siendo 404
    const looksLikeFile = /\.[a-z0-9]+$/i.test(path)

    if (
      (method !== 'GET' && method !== 'HEAD') ||
      isServerPath ||
      looksLikeFile ||
      !existsSync(this.#index)
    ) {
      return next()
    }
    response.header('Cache-Control', 'no-cache')
    response.header('Content-Type', 'text/html; charset=utf-8')
    return response.download(this.#index)
  }
}
