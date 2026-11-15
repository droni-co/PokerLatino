import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

/**
 * Genera un token aleatorio de 256 bits en base64url, con prefijo opcional.
 */
export function generateToken(prefix = '') {
  return prefix + randomBytes(32).toString('base64url')
}

/**
 * Los tokens tienen 256 bits de entropía, así que un SHA-256 es suficiente
 * para guardarlos (no hace falta un hash lento como con las contraseñas).
 */
export function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export function safeEqual(a: string, b: string) {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB)
}

/**
 * PKCE (RFC 7636 §4.6): BASE64URL(SHA256(code_verifier)) === code_challenge
 */
export function verifyPkce(codeVerifier: string, codeChallenge: string) {
  const computed = createHash('sha256').update(codeVerifier).digest('base64url')
  return safeEqual(computed, codeChallenge)
}

/**
 * code_verifier: 43-128 caracteres del set [A-Z a-z 0-9 - . _ ~] (RFC 7636 §4.1)
 */
export const CODE_VERIFIER_REGEX = /^[A-Za-z0-9\-._~]{43,128}$/
export const CODE_CHALLENGE_REGEX = /^[A-Za-z0-9\-_]{43}$/
