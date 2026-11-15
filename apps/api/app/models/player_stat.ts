import { PlayerStatSchema } from '#database/schema'

export default class PlayerStat extends PlayerStatSchema {
  /**
   * Fichas ganadas menos fichas apostadas en las mesas
   */
  get net() {
    return this.totalWon - this.totalWagered
  }

  get winRate() {
    return this.handsPlayed === 0 ? 0 : this.handsWon / this.handsPlayed
  }
}
