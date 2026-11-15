import { randomUUID } from 'node:crypto'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import hash from '@adonisjs/core/services/hash'
import type { HttpContext } from '@adonisjs/core/http'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import oauthConfig from '#config/oauth'
import User from '#models/user'
import OauthClient, { type GrantType } from '#models/oauth_client'
import OauthAccessToken from '#models/oauth_access_token'
import OauthRefreshToken from '#models/oauth_refresh_token'
import OauthAuthorizationCode from '#models/oauth_authorization_code'
import { OAuthError, type OAuthErrorCode } from '#services/oauth/oauth_error'
import {
  CODE_CHALLENGE_REGEX,
  CODE_VERIFIER_REGEX,
  generateToken,
  hashToken,
  verifyPkce,
} from '#services/oauth/crypto'

/**
 * Petición de autorización ya validada (GET /oauth/authorize)
 */
export type AuthorizeRequest = {
  client: OauthClient
  redirectUri: string
  scopes: string[]
  state?: string
  codeChallenge: string
  codeChallengeMethod: 'S256'
}

/**
 * Error en /oauth/authorize. Según RFC 6749 §4.1.2.1:
 * - si el client_id o redirect_uri son inválidos NO se redirige (se muestra una página de error)
 * - cualquier otro error se devuelve redirigiendo al redirect_uri del cliente
 */
export class AuthorizeError extends Error {
  constructor(
    public code: OAuthErrorCode,
    public description: string,
    public redirect?: { uri: string; state?: string }
  ) {
    super(description)
  }
}

export type TokenResponse = {
  access_token: string
  token_type: 'Bearer'
  expires_in: number
  refresh_token?: string
  scope: string
}

type TxResult =
  | { error: string; errorCode?: OAuthErrorCode; revokeFamily?: string | null }
  | { tokens: TokenResponse & { refreshTokenId?: string } }

const LOOPBACK_HOSTS = new Set(['127.0.0.1', '[::1]', 'localhost'])

export class OAuthServer {
  /*
  |--------------------------------------------------------------------------
  | Clientes
  |--------------------------------------------------------------------------
  */

  async createClient(input: {
    id: string
    name: string
    redirectUris: string[]
    scopes?: string[]
    grantTypes?: GrantType[]
    firstParty?: boolean
    confidential?: boolean
  }) {
    for (const uri of input.redirectUris) {
      if (!URL.canParse(uri) || uri.includes('#')) {
        throw new Error(`redirect_uri inválido: ${uri}`)
      }
    }

    const secret = input.confidential ? generateToken(oauthConfig.tokenPrefix.clientSecret) : null
    const client = await OauthClient.create({
      id: input.id,
      name: input.name,
      redirectUris: input.redirectUris,
      scopes: input.scopes ?? Object.keys(oauthConfig.scopes),
      grantTypes: input.grantTypes ?? ['authorization_code', 'refresh_token'],
      isFirstParty: input.firstParty ?? false,
      secretHash: secret ? await hash.make(secret) : null,
    })

    return { client, secret }
  }

  /**
   * Autentica al cliente en /token, /revoke e /introspect (RFC 6749 §2.3).
   * Acepta client_secret_basic, client_secret_post y "none" (clientes públicos).
   */
  async authenticateClient({ request }: HttpContext) {
    let clientId: string | undefined
    let clientSecret: string | undefined

    const authorization = request.header('authorization')
    if (authorization?.startsWith('Basic ')) {
      const decoded = Buffer.from(authorization.slice(6), 'base64').toString('utf8')
      const separator = decoded.indexOf(':')
      if (separator === -1) {
        throw new OAuthError('invalid_client', 'Cabecera Authorization mal formada')
      }
      clientId = decodeURIComponent(decoded.slice(0, separator))
      clientSecret = decodeURIComponent(decoded.slice(separator + 1))
    } else {
      const body = request.body()
      clientId = body.client_id
      clientSecret = body.client_secret
    }

    if (!clientId || typeof clientId !== 'string') {
      throw new OAuthError('invalid_client', 'Falta client_id')
    }

    const client = await OauthClient.find(clientId)
    if (!client || !client.isActive) {
      throw new OAuthError('invalid_client', 'Cliente desconocido')
    }

    if (client.isPublic) {
      if (clientSecret) {
        throw new OAuthError('invalid_client', 'Los clientes públicos no usan client_secret')
      }
      return client
    }

    if (!clientSecret || !(await hash.verify(client.secretHash!, clientSecret))) {
      throw new OAuthError('invalid_client', 'Credenciales del cliente inválidas')
    }
    return client
  }

  /*
  |--------------------------------------------------------------------------
  | Autorización (GET /oauth/authorize)
  |--------------------------------------------------------------------------
  */

  async validateAuthorizeRequest(params: Record<string, unknown>): Promise<AuthorizeRequest> {
    const str = (key: string) =>
      typeof params[key] === 'string' ? (params[key] as string) : undefined

    // 1. Cliente y redirect_uri: si fallan, NO redirigimos (podría ser un open redirect)
    const clientId = str('client_id')
    const client = clientId ? await OauthClient.find(clientId) : null
    if (!client || !client.isActive) {
      throw new AuthorizeError('invalid_client', 'La aplicación que inició sesión no es válida.')
    }

    const requestedUri = str('redirect_uri')
    let redirectUri: string
    if (requestedUri) {
      if (!this.redirectUriMatches(client.redirectUris, requestedUri)) {
        throw new AuthorizeError('invalid_request', 'La URL de retorno no está registrada.')
      }
      redirectUri = requestedUri
    } else if (client.redirectUris.length === 1) {
      redirectUri = client.redirectUris[0]
    } else {
      throw new AuthorizeError('invalid_request', 'Falta redirect_uri.')
    }

    // 2. A partir de aquí los errores se devuelven al cliente vía redirect
    const state = str('state')
    const fail = (error: OAuthErrorCode, description: string) =>
      new AuthorizeError(error, description, { uri: redirectUri, state })

    if (str('response_type') !== 'code') {
      throw fail('unsupported_response_type', 'Solo se admite response_type=code')
    }
    if (!client.allowsGrant('authorization_code')) {
      throw fail('unauthorized_client', 'El cliente no puede usar authorization_code')
    }

    // PKCE obligatorio para todos los clientes (OAuth 2.1), solo S256
    const codeChallenge = str('code_challenge')
    const method = str('code_challenge_method') ?? 'plain'
    if (!codeChallenge) {
      throw fail('invalid_request', 'PKCE es obligatorio: falta code_challenge')
    }
    if (method !== 'S256') {
      throw fail('invalid_request', 'Solo se admite code_challenge_method=S256')
    }
    if (!CODE_CHALLENGE_REGEX.test(codeChallenge)) {
      throw fail('invalid_request', 'code_challenge inválido')
    }

    let scopes: string[]
    try {
      scopes = this.resolveScopes(str('scope'), client.scopes)
    } catch (error) {
      throw fail('invalid_scope', (error as Error).message)
    }

    return { client, redirectUri, scopes, state, codeChallenge, codeChallengeMethod: 'S256' }
  }

  /**
   * Emite el código de autorización y devuelve la URL a la que redirigir al usuario.
   */
  async approve(req: AuthorizeRequest, user: User) {
    const code = generateToken()
    await OauthAuthorizationCode.create({
      codeHash: hashToken(code),
      clientId: req.client.id,
      userId: user.id,
      redirectUri: req.redirectUri,
      scopes: req.scopes,
      codeChallenge: req.codeChallenge,
      codeChallengeMethod: req.codeChallengeMethod,
      expiresAt: DateTime.now().plus({ seconds: oauthConfig.ttl.authorizationCode }),
    })

    return this.buildRedirect(req.redirectUri, { code, state: req.state })
  }

  buildRedirect(redirectUri: string, params: Record<string, string | undefined>) {
    const url = new URL(redirectUri)
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) url.searchParams.set(key, value)
    }
    // RFC 9207: el cliente puede verificar que la respuesta viene de este servidor
    url.searchParams.set('iss', oauthConfig.issuer)
    return url.toString()
  }

  /*
  |--------------------------------------------------------------------------
  | Token endpoint (POST /oauth/token)
  |--------------------------------------------------------------------------
  */

  async exchangeAuthorizationCode(
    client: OauthClient,
    input: { code?: string; redirectUri?: string; codeVerifier?: string }
  ): Promise<TokenResponse> {
    if (!input.code) throw new OAuthError('invalid_request', 'Falta code')
    if (!input.codeVerifier) throw new OAuthError('invalid_request', 'Falta code_verifier')
    if (!CODE_VERIFIER_REGEX.test(input.codeVerifier)) {
      throw new OAuthError('invalid_request', 'code_verifier inválido')
    }

    const result = await db.transaction(async (trx): Promise<TxResult> => {
      const authCode = await OauthAuthorizationCode.query({ client: trx })
        .where('code_hash', hashToken(input.code!))
        .forUpdate()
        .first()

      if (!authCode || authCode.clientId !== client.id) {
        return { error: 'Código de autorización inválido' }
      }

      // RFC 6749 §4.1.2: si un código se usa dos veces, revocar lo que se emitió con él
      if (authCode.usedAt) {
        return { error: 'El código ya fue utilizado', revokeFamily: authCode.familyId }
      }
      if (authCode.isExpired) return { error: 'El código expiró' }
      if (authCode.redirectUri !== input.redirectUri) {
        return { error: 'redirect_uri no coincide con el de la autorización' }
      }
      if (!verifyPkce(input.codeVerifier!, authCode.codeChallenge)) {
        return { error: 'code_verifier no coincide (PKCE)' }
      }

      const familyId = randomUUID()
      authCode.usedAt = DateTime.now()
      authCode.familyId = familyId
      await authCode.useTransaction(trx).save()

      const tokens = await this.issueTokens(trx, {
        client,
        userId: authCode.userId,
        scopes: authCode.scopes,
        familyId,
      })
      return { tokens }
    })

    return this.unwrap(result)
  }

  /**
   * Rotación de refresh tokens: cada uso devuelve uno nuevo e invalida el anterior.
   * Si llega un refresh token ya rotado, asumimos que fue robado y revocamos toda la familia.
   */
  async refresh(
    client: OauthClient,
    input: { refreshToken?: string; scope?: string }
  ): Promise<TokenResponse> {
    if (!input.refreshToken) throw new OAuthError('invalid_request', 'Falta refresh_token')

    const result = await db.transaction(async (trx): Promise<TxResult> => {
      const current = await OauthRefreshToken.query({ client: trx })
        .where('token_hash', hashToken(input.refreshToken!))
        .forUpdate()
        .first()

      if (!current || current.clientId !== client.id) {
        return { error: 'Refresh token inválido' }
      }
      if (current.revokedAt) {
        return { error: 'Refresh token revocado', revokeFamily: current.familyId }
      }
      if (current.isExpired) return { error: 'Refresh token expirado' }

      // Se puede pedir un subconjunto de los scopes originales (RFC 6749 §6)
      let scopes = current.scopes
      if (input.scope) {
        const requested = this.parseScopes(input.scope)
        if (requested.some((s) => !current.scopes.includes(s))) {
          return {
            error: 'Los scopes deben ser un subconjunto de los originales',
            errorCode: 'invalid_scope',
          }
        }
        scopes = requested
      }

      const tokens = await this.issueTokens(trx, {
        client,
        userId: current.userId,
        scopes,
        familyId: current.familyId,
      })

      const now = DateTime.now()
      current.revokedAt = now
      current.replacedById = tokens.refreshTokenId ?? null
      await current.useTransaction(trx).save()
      await OauthAccessToken.query({ client: trx })
        .where('id', current.accessTokenId)
        .whereNull('revoked_at')
        .update({ revoked_at: now.toSQL() })

      return { tokens }
    })

    return this.unwrap(result)
  }

  /**
   * Convierte el resultado de una transacción en tokens o en un OAuthError.
   * La revocación por reutilización se hace FUERA de la transacción, para que
   * el rollback no la deshaga.
   */
  private async unwrap(result: TxResult) {
    if ('tokens' in result) return result.tokens
    if (result.revokeFamily) await this.revokeFamily(result.revokeFamily)
    throw new OAuthError(result.errorCode ?? 'invalid_grant', result.error)
  }

  private async issueTokens(
    trx: TransactionClientContract,
    input: { client: OauthClient; userId: number; scopes: string[]; familyId: string }
  ) {
    const now = DateTime.now()
    const accessToken = generateToken(oauthConfig.tokenPrefix.accessToken)
    const accessRow = await OauthAccessToken.create(
      {
        tokenHash: hashToken(accessToken),
        clientId: input.client.id,
        userId: input.userId,
        scopes: input.scopes,
        familyId: input.familyId,
        expiresAt: now.plus({ seconds: oauthConfig.ttl.accessToken }),
      },
      { client: trx }
    )

    const response: TokenResponse & { refreshTokenId?: string } = {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: oauthConfig.ttl.accessToken,
      scope: input.scopes.join(' '),
    }

    if (input.client.allowsGrant('refresh_token')) {
      const refreshToken = generateToken(oauthConfig.tokenPrefix.refreshToken)
      const refreshRow = await OauthRefreshToken.create(
        {
          tokenHash: hashToken(refreshToken),
          accessTokenId: accessRow.id,
          clientId: input.client.id,
          userId: input.userId,
          scopes: input.scopes,
          familyId: input.familyId,
          expiresAt: now.plus({ seconds: oauthConfig.ttl.refreshToken }),
        },
        { client: trx }
      )
      response.refresh_token = refreshToken
      response.refreshTokenId = refreshRow.id
    }

    return response
  }

  /**
   * Quita campos internos antes de responder
   */
  toResponse({ refreshTokenId: _, ...body }: TokenResponse & { refreshTokenId?: string }) {
    return body
  }

  /*
  |--------------------------------------------------------------------------
  | Revocación (RFC 7009) e introspección (RFC 7662)
  |--------------------------------------------------------------------------
  */

  async revoke(client: OauthClient, token: string, hint?: string) {
    const tokenHash = hashToken(token)
    const lookups =
      hint === 'access_token' ? (['access', 'refresh'] as const) : (['refresh', 'access'] as const)

    for (const kind of lookups) {
      const Model = kind === 'access' ? OauthAccessToken : OauthRefreshToken
      const row = await Model.findBy('token_hash', tokenHash)
      if (!row) continue
      // Un cliente solo puede revocar sus propios tokens; si no, se ignora en silencio (RFC 7009 §2.1)
      if (row.clientId !== client.id) return

      if (kind === 'refresh') {
        // Revocar un refresh token cierra la sesión completa en ese dispositivo
        await this.revokeFamily(row.familyId)
      } else if (!row.revokedAt) {
        row.revokedAt = DateTime.now()
        await row.save()
      }
      return
    }
  }

  async introspect(token: string) {
    const tokenHash = hashToken(token)
    const accessRow = await OauthAccessToken.findBy('token_hash', tokenHash)
    const row = accessRow ?? (await OauthRefreshToken.findBy('token_hash', tokenHash))

    if (!row || row.revokedAt || row.isExpired) return { active: false }

    const user = await User.find(row.userId)
    if (!user) return { active: false }

    return {
      active: true,
      token_type: accessRow ? 'access_token' : 'refresh_token',
      scope: row.scopes.join(' '),
      client_id: row.clientId,
      sub: String(user.id),
      username: user.email,
      iat: Math.floor(row.createdAt.toSeconds()),
      exp: Math.floor(row.expiresAt.toSeconds()),
      iss: oauthConfig.issuer,
    }
  }

  async revokeFamily(familyId: string) {
    const now = DateTime.now().toSQL()
    await db.transaction(async (trx) => {
      await trx
        .from('oauth_access_tokens')
        .where('family_id', familyId)
        .whereNull('revoked_at')
        .update({ revoked_at: now })
      await trx
        .from('oauth_refresh_tokens')
        .where('family_id', familyId)
        .whereNull('revoked_at')
        .update({ revoked_at: now })
    })
  }

  /*
  |--------------------------------------------------------------------------
  | Validación de access tokens (usado por el guard "api")
  |--------------------------------------------------------------------------
  */

  async verifyAccessToken(token: string) {
    const row = await OauthAccessToken.query()
      .where('token_hash', hashToken(token))
      .whereNull('revoked_at')
      .where('expires_at', '>', DateTime.now().toSQL())
      .first()
    if (!row) return null

    const user = await User.find(row.userId)
    return user ? { user, token: row } : null
  }

  /**
   * Emite tokens directamente (sin flujo de autorización). Solo para tests.
   */
  async issueTestToken(user: User, scopes = oauthConfig.defaultScopes) {
    const client = await OauthClient.query().where('is_first_party', true).firstOrFail()
    const tokens = await db.transaction((trx) =>
      this.issueTokens(trx, { client, userId: user.id, scopes, familyId: randomUUID() })
    )
    return { token: tokens.access_token, refreshToken: tokens.refresh_token }
  }

  /*
  |--------------------------------------------------------------------------
  | Helpers
  |--------------------------------------------------------------------------
  */

  parseScopes(scope: string) {
    return [...new Set(scope.split(' ').filter(Boolean))]
  }

  private resolveScopes(scope: string | undefined, allowed: string[]) {
    const requested = scope ? this.parseScopes(scope) : oauthConfig.defaultScopes
    for (const s of requested) {
      if (!(s in oauthConfig.scopes)) throw new Error(`Scope desconocido: ${s}`)
      if (!allowed.includes(s)) throw new Error(`Scope no permitido para este cliente: ${s}`)
    }
    if (requested.length === 0) throw new Error('Debe solicitar al menos un scope')
    return requested
  }

  /**
   * Comparación exacta, salvo redirects a loopback (http://127.0.0.1:PUERTO/...) donde
   * el puerto puede variar, como permite RFC 8252 §7.3 para apps nativas/desktop.
   */
  private redirectUriMatches(registered: string[], requested: string) {
    if (!URL.canParse(requested) || requested.includes('#')) return false
    if (registered.includes(requested)) return true

    const req = new URL(requested)
    return registered.some((uri) => {
      const reg = new URL(uri)
      return (
        reg.protocol === 'http:' &&
        LOOPBACK_HOSTS.has(reg.hostname) &&
        req.protocol === reg.protocol &&
        req.hostname === reg.hostname &&
        req.pathname === reg.pathname &&
        req.search === reg.search
      )
    })
  }
}

const oauthServer = new OAuthServer()
export default oauthServer
