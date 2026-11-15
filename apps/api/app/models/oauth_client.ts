import { OauthClientSchema } from '#database/schema'
import { jsonColumn } from '#models/json_column'

export type GrantType = 'authorization_code' | 'refresh_token'

export default class OauthClient extends OauthClientSchema {
  static table = 'oauth_clients'
  static selfAssignPrimaryKey = true

  @jsonColumn()
  declare redirectUris: string[]

  @jsonColumn()
  declare grantTypes: GrantType[]

  @jsonColumn()
  declare scopes: string[]

  /**
   * Cliente público (app móvil/SPA): no puede guardar un secreto,
   * por eso PKCE es obligatorio.
   */
  get isPublic() {
    return this.secretHash === null
  }

  get isActive() {
    return this.revokedAt === null
  }

  allowsGrant(grant: GrantType) {
    return this.grantTypes.includes(grant)
  }
}
