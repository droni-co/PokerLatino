import type { HttpContext } from '@adonisjs/core/http'
import { PENDING_AUTHORIZE_KEY } from '#controllers/oauth/authorize_controller'

/**
 * Tras iniciar sesión o registrarse, retoma el flujo /oauth/authorize pendiente.
 */
export function continueFlow({ session, response, view }: HttpContext) {
  const pending = session.get(PENDING_AUTHORIZE_KEY) as Record<string, any> | undefined
  if (pending) {
    return response.redirect(`/oauth/authorize?${new URLSearchParams(pending)}`)
  }
  return view.render('oauth/done')
}
