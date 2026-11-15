import { PlayerStatSchema } from '#database/schema'
import type { Currency } from '#config/game'

export default class PlayerStat extends PlayerStatSchema {
  declare currency: Currency

  /**
   * Ganancia neta en la mesa (sin contar recargas ni retiros)
   */
  get net() {
    return this.totalWon - this.totalWagered
  }

  get winRate() {
    return this.handsPlayed === 0 ? 0 : this.handsWon / this.handsPlayed
  }
}
