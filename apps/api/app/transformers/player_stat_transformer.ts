import type PlayerStat from '#models/player_stat'
import { BaseTransformer } from '@adonisjs/core/transformers'

export default class PlayerStatTransformer extends BaseTransformer<PlayerStat> {
  toObject() {
    const s = this.resource
    return {
      handsPlayed: s.handsPlayed,
      handsWon: s.handsWon,
      winRate: Math.round(s.winRate * 10_000) / 10_000,
      showdownsReached: s.showdownsReached,
      totalWagered: s.totalWagered,
      totalWon: s.totalWon,
      net: s.net,
      biggestPotWon: s.biggestPotWon,
    }
  }
}
