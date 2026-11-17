import type User from '#models/user'
import { BaseTransformer } from '@adonisjs/core/transformers'

export default class UserTransformer extends BaseTransformer<User> {
  toObject() {
    return UserTransformer.plain(this.resource)
  }

  /** Datos de la cuenta del propio jugador (incluye su email) */
  static plain(user: User) {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      avatar: user.avatar,
      createdAt: user.createdAt,
      displayName: user.displayName,
    }
  }
}
