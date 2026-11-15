import { randomUUID } from 'node:crypto'
import { DateTime } from 'luxon'
import { beforeCreate } from '@adonisjs/lucid/orm'
import { OauthAccessTokenSchema } from '#database/schema'
import { jsonColumn } from '#models/json_column'

export default class OauthAccessToken extends OauthAccessTokenSchema {
  static table = 'oauth_access_tokens'
  static selfAssignPrimaryKey = true

  @jsonColumn()
  declare scopes: string[]

  @beforeCreate()
  static assignId(row: OauthAccessToken) {
    row.id ??= randomUUID()
  }

  get isExpired() {
    return this.expiresAt <= DateTime.now()
  }
}
