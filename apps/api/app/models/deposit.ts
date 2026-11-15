import { randomUUID } from 'node:crypto'
import { beforeCreate } from '@adonisjs/lucid/orm'
import { DepositSchema } from '#database/schema'

export type DepositStatus = 'pending' | 'completed' | 'failed' | 'cancelled'

export default class Deposit extends DepositSchema {
  static selfAssignPrimaryKey = true
  declare status: DepositStatus

  @beforeCreate()
  static assignId(row: Deposit) {
    row.id ??= randomUUID()
  }
}
