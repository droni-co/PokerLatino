/*
|--------------------------------------------------------------------------
| Arranque del juego (solo en el servidor web)
|--------------------------------------------------------------------------
| Cancela las manos que quedaron a medias si el servidor se reinició y
| reanuda las mesas que tienen jugadores sentados.
*/

import logger from '@adonisjs/core/services/logger'
import tableManager from '#game/table_manager'
import roomService from '#services/game/room_service'
import chatService from '#services/game/chat_service'
import presenceService from '#services/game/presence_service'
import tournamentService from '#services/game/tournament_service'
import gameConfig from '#config/game'

const cancelled = await tableManager.recoverInterruptedHands()
if (cancelled > 0) {
  logger.warn(`${cancelled} mano(s) interrumpida(s) cancelada(s); los stacks se conservaron`)
}

/**
 * Mesas automáticas: cierra periódicamente las mesas extra que quedaron vacías
 * (y abre las que falten si cambió la configuración).
 */
const sweep = setInterval(async () => {
  try {
    const closed = await roomService.closeIdleTables()
    if (closed.length > 0) logger.info({ rooms: closed }, 'Mesas vacías cerradas')
    await chatService.prune()
  } catch (error) {
    logger.error({ err: error }, 'No se pudieron revisar las mesas vacías')
  }
}, gameConfig.rooms.autoTables.sweepIntervalSeconds * 1000)
sweep.unref()

/**
 * Presencia: levanta de la mesa a quien cerró la app, la pestaña o perdió la conexión
 */
const presence = setInterval(async () => {
  try {
    await presenceService.sweep()
  } catch (error) {
    logger.error({ err: error }, 'No se pudo revisar la presencia en las mesas')
  }
}, gameConfig.table.presenceSweepSeconds * 1000)
presence.unref()

/**
 * Torneos: arranca los que llegaron a su hora con el cupo lleno y mantiene los que están
 * en juego (eliminaciones, balanceo de mesas, final)
 */
const tournaments = setInterval(async () => {
  try {
    await tournamentService.tick()
  } catch (error) {
    logger.error({ err: error }, 'No se pudieron revisar los torneos')
  }
}, gameConfig.tournaments.tickSeconds * 1000)
tournaments.unref()
