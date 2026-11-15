import UserTransformer from '#transformers/user_transformer'
import { updateProfileValidator } from '#validators/user'
import type { HttpContext } from '@adonisjs/core/http'

export default class ProfileController {
  /**
   * GET /api/v1/me
   */
  async show({ auth, serialize }: HttpContext) {
    const user = auth.getUserOrFail()
    return serialize(UserTransformer.transform(user))
  }

  /**
   * PATCH /api/v1/me: nombre de usuario y avatar
   */
  async update({ auth, request, serialize }: HttpContext) {
    const user = auth.getUserOrFail()
    const data = await request.validateUsing(updateProfileValidator(user.id))

    if (data.username !== undefined) user.username = data.username
    if (data.avatar !== undefined) user.avatar = data.avatar
    await user.save()

    return serialize(UserTransformer.transform(user))
  }
}
