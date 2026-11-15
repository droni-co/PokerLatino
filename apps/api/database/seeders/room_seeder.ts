import { BaseSeeder } from '@adonisjs/lucid/seeders'
import db from '@adonisjs/lucid/services/db'
import RoomLevel from '#models/room_level'
import roomService from '#services/game/room_service'
import gameConfig from '#config/game'

type LevelSeed = {
  slug: string
  name: string
  smallBlind: number
  bigBlind: number
}

/**
 * Niveles (categorías) de sala, todos en fichas. Buy-in estándar: de 40 a 100 ciegas grandes.
 * Las mesas de cada nivel las abre y cierra el servidor según la cantidad de jugadores.
 */
const LEVELS: LevelSeed[] = [
  { slug: 'principiantes', name: 'Principiantes', smallBlind: 5, bigBlind: 10 },
  { slug: 'clasica', name: 'Clásica', smallBlind: 10, bigBlind: 20 },
  { slug: 'high-rollers', name: 'High Rollers', smallBlind: 50, bigBlind: 100 },
]

export default class extends BaseSeeder {
  async run() {
    for (const seed of LEVELS) {
      const level = await RoomLevel.updateOrCreate(
        { slug: seed.slug },
        {
          ...seed,
          minBuyIn: seed.bigBlind * 40,
          maxBuyIn: seed.bigBlind * 100,
          maxSeats: gameConfig.rooms.maxSeats,
          actionTimeoutSeconds: gameConfig.rooms.actionTimeoutSeconds,
          gameType: 'texas_holdem',
          bettingStructure: 'no_limit',
          status: 'active',
        }
      )
      // Abre la(s) primera(s) mesa(s) del nivel
      await db.transaction((trx) => roomService.ensureCapacity(trx, level))
    }
  }
}
