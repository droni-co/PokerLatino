import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Room from '#models/room'
import gameConfig, { type Currency } from '#config/game'

type RoomSeed = {
  slug: string
  name: string
  currency: Currency
  smallBlind: number
  bigBlind: number
}

/**
 * Salas iniciales. Buy-in estándar: mínimo 40 ciegas grandes, máximo 100.
 * Montos en unidades mínimas (créditos / centavos).
 */
const ROOMS: RoomSeed[] = [
  // Gratis (credits)
  {
    slug: 'credits-principiantes',
    name: 'Principiantes',
    currency: 'credits',
    smallBlind: 5,
    bigBlind: 10,
  },
  { slug: 'credits-clasica', name: 'Clásica', currency: 'credits', smallBlind: 10, bigBlind: 20 },
  {
    slug: 'credits-high-rollers',
    name: 'High Rollers',
    currency: 'credits',
    smallBlind: 50,
    bigBlind: 100,
  },
  // Pago (usd, en centavos)
  { slug: 'usd-micro', name: 'Micro $0.01/$0.02', currency: 'usd', smallBlind: 1, bigBlind: 2 },
  { slug: 'usd-low', name: 'Low $0.05/$0.10', currency: 'usd', smallBlind: 5, bigBlind: 10 },
  { slug: 'usd-mid', name: 'Mid $0.25/$0.50', currency: 'usd', smallBlind: 25, bigBlind: 50 },
]

export default class extends BaseSeeder {
  async run() {
    for (const room of ROOMS) {
      await Room.updateOrCreate(
        { slug: room.slug },
        {
          ...room,
          minBuyIn: room.bigBlind * 40,
          maxBuyIn: room.bigBlind * 100,
          maxSeats: gameConfig.rooms.maxSeats,
          actionTimeoutSeconds: gameConfig.rooms.actionTimeoutSeconds,
          gameType: 'texas_holdem',
          bettingStructure: 'no_limit',
          status: 'active',
        }
      )
    }
  }
}
