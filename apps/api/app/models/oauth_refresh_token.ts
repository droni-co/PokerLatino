import { randomUUID } from 'node:crypto'
import { DateTime } from 'luxon'
import { beforeCreate } from '@adonisjs/lucid/orm'
import { OauthRefreshTokenSchema } from '#database/schema'
import { jsonColumn } from '#models/json_column'

export default class OauthRefreshToken extends OauthRefreshTokenSchema {
  static table = 'oauth_refresh_tokens'
  static selfAssignPrimaryKey = true

  @jsonColumn()
  declare scopes: string[]

  @beforeCreate()
  static assignId(row: OauthRefreshToken) {
    row.id ??= randomUUID()
  }

  get isExpired() {
    return this.expiresAt <= DateTime.now()
  }
}
