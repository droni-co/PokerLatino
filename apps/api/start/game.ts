/*
|--------------------------------------------------------------------------
| Arranque del juego (solo en el servidor web)
|--------------------------------------------------------------------------
| Cancela las manos que quedaron a medias si el servidor se reinició y
| reanuda las mesas que tienen jugadores sentados.
*/

import logger from '@adonisjs/core/services/logger'
import tableManager from '#game/table_manager'

const cancelled = await tableManager.recoverInterruptedHands()
if (cancelled > 0) {
  logger.warn(`${cancelled} mano(s) interrumpida(s) cancelada(s); los stacks se conservaron`)
}
