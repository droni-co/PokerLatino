import gameConfig from '#config/game'

export default class ConfigController {
  /**
   * GET /api/v1/game/config: datos que la app necesita para mostrar montos y reglas
   */
  async show() {
    return {
      data: {
        currencies: gameConfig.currencies,
        signupBonus: gameConfig.signupBonus,
        rake: gameConfig.rake,
        rooms: gameConfig.rooms,
        deposits: gameConfig.deposits,
      },
    }
  }
}
