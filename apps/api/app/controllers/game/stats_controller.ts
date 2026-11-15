import type { HttpContext } from '@adonisjs/core/http'
import PlayerStat from '#models/player_stat'
import PlayerStatTransformer from '#transformers/player_stat_transformer'

export default class StatsController {
  /**
   * GET /api/v1/me/stats
   */
  async show({ auth, serialize }: HttpContext) {
    const stats = await PlayerStat.query().where('user_id', auth.getUserOrFail().id).firstOrFail()
    return serialize(PlayerStatTransformer.transform(stats))
  }
}
