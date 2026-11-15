import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

/**
 * Solo desarrollo: simula una recarga confirmada por el proveedor de pagos.
 *   node ace deposit:simulate --email=jugador@x.com --amount=2500   (= $25.00)
 */
export default class DepositSimulate extends BaseCommand {
  static commandName = 'deposit:simulate'
  static description = 'Acredita una recarga USD de prueba (solo desarrollo)'
  static options: CommandOptions = { startApp: true }

  @flags.string({ description: 'Email del jugador', required: true })
  declare email: string

  @flags.number({ description: 'Monto en centavos (2500 = $25.00)', required: true })
  declare amount: number

  async run() {
    if (this.app.inProduction) {
      this.logger.error('Este comando no se puede usar en producción')
      this.exitCode = 1
      return
    }

    const { default: User } = await import('#models/user')
    const { default: depositService } = await import('#services/game/deposit_service')

    const user = await User.findBy('email', this.email.trim().toLowerCase())
    if (!user) {
      this.logger.error(`No existe un usuario con email ${this.email}`)
      this.exitCode = 1
      return
    }

    try {
      const pending = await depositService.createPending(user.id, this.amount, 'manual')
      await depositService.complete(pending.id, `simulated-${pending.id}`)
      this.logger.success(
        `Recarga de $${(this.amount / 100).toFixed(2)} acreditada a ${user.email}`
      )
    } catch (error) {
      this.logger.error((error as Error).message)
      this.exitCode = 1
    }
  }
}
