/**
 * Configuración general del juego y de la economía.
 *
 * Montos SIEMPRE en unidades mínimas (enteros):
 *   - credits: 1 = 1 crédito
 *   - usd:     1 = 1 centavo  (1000 = $10.00)
 */

export const CURRENCIES = ['credits', 'usd'] as const
export type Currency = (typeof CURRENCIES)[number]

const gameConfig = {
  /**
   * Edad mínima para registrarse (ver Legal.md: en algunas jurisdicciones es 21)
   */
  minimumAge: 18,

  currencies: {
    credits: { label: 'Créditos', symbol: 'CR', decimals: 0, realMoney: false },
    usd: { label: 'Dólares', symbol: 'USD', decimals: 2, realMoney: true },
  } satisfies Record<
    Currency,
    { label: string; symbol: string; decimals: number; realMoney: boolean }
  >,

  /**
   * Saldo inicial que recibe cada jugador al registrarse
   */
  signupBonus: { credits: 1000, usd: 0 } satisfies Record<Currency, number>,

  /**
   * Juego entre jugadores, sin comisión de la casa: el 100% del pozo va al ganador.
   * Se deja explícito para que ningún cálculo de pozo lo olvide.
   */
  rake: 0,

  /**
   * Valores por defecto de las salas
   */
  rooms: {
    maxSeats: 5,
    actionTimeoutSeconds: 30,
    gameTypes: ['texas_holdem'] as const,
    bettingStructures: ['no_limit'] as const,
  },

  /**
   * Ritmo de las mesas
   */
  table: {
    /** Pausa entre el final de una mano y el inicio de la siguiente */
    nextHandDelayMs: 4000,
  },

  /**
   * Límites de recarga (en centavos)
   */
  deposits: {
    minAmount: 500, // $5.00
    maxAmount: 100_000, // $1,000.00
  },
}

export default gameConfig
