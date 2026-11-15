import { Exception } from '@adonisjs/core/exceptions'
import type { HttpContext } from '@adonisjs/core/http'

export type OAuthErrorCode =
  | 'invalid_request'
  | 'invalid_client'
  | 'invalid_grant'
  | 'unauthorized_client'
  | 'unsupported_grant_type'
  | 'unsupported_response_type'
  | 'invalid_scope'
  | 'access_denied'
  | 'server_error'

const STATUS: Record<OAuthErrorCode, number> = {
  invalid_request: 400,
  invalid_client: 401,
  invalid_grant: 400,
  unauthorized_client: 400,
  unsupported_grant_type: 400,
  unsupported_response_type: 400,
  invalid_scope: 400,
  access_denied: 403,
  server_error: 500,
}

/**
 * Error con el formato de RFC 6749 §5.2:
 * { "error": "invalid_grant", "error_description": "..." }
 */
export class OAuthError extends Exception {
  constructor(
    public error: OAuthErrorCode,
    public description: string
  ) {
    super(description, { status: STATUS[error], code: error })
  }

  async handle(error: this, { response, request }: HttpContext) {
    response.header('Cache-Control', 'no-store')
    response.header('Pragma', 'no-cache')

    // RFC 6749 §5.2: si el cliente intentó autenticarse con Basic, responder con WWW-Authenticate
    if (error.error === 'invalid_client' && request.header('authorization')) {
      response.header('WWW-Authenticate', 'Basic realm="oauth"')
    }

    return response.status(error.status).send({
      error: error.error,
      error_description: error.description,
    })
  }
}
