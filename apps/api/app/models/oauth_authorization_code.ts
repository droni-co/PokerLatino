import { randomUUID } from 'node:crypto'
import { DateTime } from 'luxon'
import { beforeCreate } from '@adonisjs/lucid/orm'
import { OauthAuthorizationCodeSchema } from '#database/schema'
import { jsonColumn } from '#models/json_column'

export default class OauthAuthorizationCode extends OauthAuthorizationCodeSchema {
  static table = 'oauth_authorization_codes'
  static selfAssignPrimaryKey = true

  @jsonColumn()
  declare scopes: string[]

  @beforeCreate()
  static assignId(row: OauthAuthorizationCode) {
    row.id ??= randomUUID()
  }

  get isExpired() {
    return this.expiresAt <= DateTime.now()
  }
}
