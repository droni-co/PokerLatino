import Wallet from '#models/wallet'
import WalletTransaction from '#models/wallet_transaction'

/**
 * Saldo sin las recompensas de logros y niveles (que dependen de lo jugado en cada test):
 * para comprobar la cuenta de mesas, torneos e invitaciones sin que interfieran.
 */
export async function balanceWithoutRewards(userId: number) {
  const wallet = await Wallet.findByOrFail('user_id', userId)
  const rewards = await WalletTransaction.query()
    .where('wallet_id', wallet.id)
    .whereIn('type', ['achievement_reward', 'level_reward'])
    .sum('amount as total')
  return wallet.balance - Number(rewards[0]?.$extras.total ?? 0)
}
