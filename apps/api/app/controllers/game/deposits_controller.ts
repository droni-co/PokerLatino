import type { HttpContext } from '@adonisjs/core/http'
import depositService from '#services/game/deposit_service'
import { createDepositValidator } from '#validators/game'
import DepositTransformer from '#transformers/deposit_transformer'

export default class DepositsController {
  /**
   * POST /api/v1/deposits: inicia una recarga en USD (queda "pending" hasta que el
   * proveedor de pagos la confirme).
   */
  async store({ auth, request, response, serialize }: HttpContext) {
    const { amount } = await request.validateUsing(createDepositValidator)
    const deposit = await depositService.createPending(auth.getUserOrFail().id, amount)
    response.status(201)
    return serialize(DepositTransformer.transform(deposit))
  }
}
