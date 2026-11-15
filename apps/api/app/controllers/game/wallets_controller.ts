import type { HttpContext } from '@adonisjs/core/http'
import type { Currency } from '#config/game'
import Wallet from '#models/wallet'
import WalletTransaction from '#models/wallet_transaction'
import walletService from '#services/game/wallet_service'
import { transactionsValidator } from '#validators/game'
import WalletTransformer from '#transformers/wallet_transformer'
import WalletTransactionTransformer from '#transformers/wallet_transaction_transformer'

export default class WalletsController {
  /**
   * GET /api/v1/wallets
   */
  async index({ auth, serialize }: HttpContext) {
    const wallets = await walletService.getWallets(auth.getUserOrFail().id)
    return serialize(WalletTransformer.transform(wallets))
  }

  /**
   * GET /api/v1/wallets/:currency/transactions
   */
  async transactions({ auth, params, request, serialize }: HttpContext) {
    const { page = 1, perPage = 20 } = await request.validateUsing(transactionsValidator, {
      data: request.qs(),
    })
    const wallet = await Wallet.query()
      .where('user_id', auth.getUserOrFail().id)
      .where('currency', params.currency as Currency)
      .firstOrFail()

    const paginator = await WalletTransaction.query()
      .where('wallet_id', wallet.id)
      .orderBy('id', 'desc')
      .paginate(page, perPage)

    return serialize(WalletTransactionTransformer.paginate(paginator.all(), paginator.getMeta()))
  }
}
