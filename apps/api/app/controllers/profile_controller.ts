import UserTransformer from '#transformers/user_transformer'
import type { HttpContext } from '@adonisjs/core/http'

export default class ProfileController {
  /**
   * GET /api/v1/me
   */
  async show({ auth, serialize }: HttpContext) {
    const user = auth.getUserOrFail()
    return serialize(UserTransformer.transform(user))
  }
}
