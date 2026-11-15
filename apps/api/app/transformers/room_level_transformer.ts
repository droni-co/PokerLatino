import type RoomLevel from '#models/room_level'
import { BaseTransformer } from '@adonisjs/core/transformers'

/**
 * Nivel para el lobby: reglas, totales y la lista de mesas abiertas
 */
export default class RoomLevelTransformer extends BaseTransformer<RoomLevel> {
  toObject() {
    const level = this.resource
    const tables = (level.$preloaded.rooms ? level.rooms : []).map((room) => ({
      id: room.id,
      tableNumber: room.tableNumber,
      name: room.name,
      maxSeats: room.maxSeats,
      seatedCount: Number(room.$extras.seatedCount ?? 0),
    }))
    return {
      id: level.id,
      slug: level.slug,
      name: level.name,
      gameType: level.gameType,
      bettingStructure: level.bettingStructure,
      maxSeats: level.maxSeats,
      smallBlind: level.smallBlind,
      bigBlind: level.bigBlind,
      minBuyIn: level.minBuyIn,
      maxBuyIn: level.maxBuyIn,
      actionTimeoutSeconds: level.actionTimeoutSeconds,
      playerCount: tables.reduce((sum, t) => sum + t.seatedCount, 0),
      tables,
    }
  }
}
