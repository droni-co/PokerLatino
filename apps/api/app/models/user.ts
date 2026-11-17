import { UserSchema } from '#database/schema'
import hash from '@adonisjs/core/services/hash'
import { compose } from '@adonisjs/core/helpers'
import { withAuthFinder } from '@adonisjs/auth/mixins/lucid'
import { hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import { DbAccessTokensProvider } from '@adonisjs/auth/access_tokens'
import Wallet from '#models/wallet'
import PlayerStat from '#models/player_stat'

export default class User extends compose(UserSchema, withAuthFinder(hash)) {
  /**
   * Access tokens (Authorization: Bearer pl_...). Un jugador tiene como mucho uno vivo:
   * al iniciar sesión se borran los anteriores (ver AuthController).
   */
  static accessTokens = DbAccessTokensProvider.forModel(User, {
    prefix: 'pl_',
    table: 'auth_access_tokens',
    type: 'auth_token',
    expiresIn: '30 days',
  })

  @hasMany(() => Wallet)
  declare wallets: HasMany<typeof Wallet>

  @hasMany(() => PlayerStat)
  declare stats: HasMany<typeof PlayerStat>

  /**
   * Nombre visible para otros jugadores. Nunca se expone el email en las mesas.
   * Las cuentas anteriores al nombre de usuario se muestran como "Jugador #id".
   */
  get displayName() {
    return this.username ?? `Jugador #${this.id}`
  }
}
