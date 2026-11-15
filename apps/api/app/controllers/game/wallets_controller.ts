import type { HttpContext } from '@adonisjs/core/http'
import WalletTransaction from '#models/wallet_transaction'
import walletService from '#services/game/wallet_service'
import { transactionsValidator } from '#validators/game'
import WalletTransformer from '#transformers/wallet_transformer'
import WalletTransactionTransformer from '#transformers/wallet_transaction_transformer'

/**
 * Billetera de fichas del jugador. Las fichas son solo para jugar: no se compran ni
 * se canjean por dinero.
 */
export default class WalletsController {
  /**
   * GET /api/v1/wallet
   */
  async show({ auth, serialize }: HttpContext) {
    const wallet = await walletService.getWallet(auth.getUserOrFail().id)
    return serialize(WalletTransformer.transform(wallet))
  }

  /**
   * GET /api/v1/wallet/transactions
   */
  async transactions({ auth, request, serialize }: HttpContext) {
    const { page = 1, perPage = 20 } = await request.validateUsing(transactionsValidator, {
      data: request.qs(),
    })
    const wallet = await walletService.getWallet(auth.getUserOrFail().id)

    const paginator = await WalletTransaction.query()
      .where('wallet_id', wallet.id)
      .orderBy('id', 'desc')
      .paginate(page, perPage)

    return serialize(WalletTransactionTransformer.paginate(paginator.all(), paginator.getMeta()))
  }
}
