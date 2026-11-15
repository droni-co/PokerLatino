import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

/**
 * node ace oauth:client --id=mi-backend --name="Mi backend" --redirect=https://x.com/cb --confidential
 */
export default class OauthClientCommand extends BaseCommand {
  static commandName = 'oauth:client'
  static description = 'Registra un cliente OAuth2'
  static options: CommandOptions = { startApp: true }

  @flags.string({ description: 'client_id (único)', required: true })
  declare id: string

  @flags.string({ description: 'Nombre visible en la pantalla de consentimiento', required: true })
  declare name: string

  @flags.array({ description: 'redirect_uri permitido (repetible)', alias: 'r' })
  declare redirect: string[]

  @flags.array({ description: 'Scopes permitidos (por defecto todos)' })
  declare scope?: string[]

  @flags.boolean({ description: 'Cliente confidencial (genera client_secret)' })
  declare confidential: boolean

  @flags.boolean({ description: 'App propia: omite la pantalla de consentimiento' })
  declare firstParty: boolean

  async run() {
    const { default: oauthServer } = await import('#services/oauth/oauth_server')

    try {
      const { client, secret } = await oauthServer.createClient({
        id: this.id,
        name: this.name,
        redirectUris: this.redirect ?? [],
        scopes: this.scope,
        confidential: this.confidential,
        firstParty: this.firstParty,
      })

      this.logger.success(`Cliente "${client.name}" creado`)
      this.logger.log(`client_id:     ${client.id}`)
      if (secret) {
        this.logger.log(`client_secret: ${secret}`)
        this.logger.warning('Guarda el secreto ahora: no se puede volver a mostrar.')
      }
    } catch (error) {
      this.logger.error((error as Error).message)
      this.exitCode = 1
    }
  }
}
