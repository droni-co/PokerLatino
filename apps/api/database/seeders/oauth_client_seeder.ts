import { BaseSeeder } from '@adonisjs/lucid/seeders'
import OauthClient from '#models/oauth_client'
import oauthServer from '#services/oauth/oauth_server'
import env from '#start/env'

/** La app web servida por este mismo servidor vuelve del login a <APP_URL>/auth.html */
const appUrl = new URL('/auth.html', env.get('APP_URL')).toString()

/**
 * Cliente OAuth de la app Flutter (público, propio → sin pantalla de consentimiento).
 */
export const FLUTTER_CLIENT = {
  id: 'poker-latino-app',
  name: 'Poker Latino',
  redirectUris: [
    // Android / iOS: esquema custom (RFC 8252 §7.1)
    'co.droni.pokerlatino:/oauth/callback',
    // Flutter web en desarrollo: página web/auth.html de la app, cualquier puerto (RFC 8252 §7.3)
    'http://localhost/auth.html',
    'http://127.0.0.1/auth.html',
    // Desktop / loopback
    'http://localhost/oauth/callback',
    'http://127.0.0.1/oauth/callback',
    // App web servida por este servidor (producción: APP_URL=https://pokerlatino.com)
    ...(appUrl.startsWith('http://localhost') || appUrl.startsWith('http://127.0.0.1')
      ? []
      : [appUrl]),
  ],
}

export default class extends BaseSeeder {
  async run() {
    const existing = await OauthClient.find(FLUTTER_CLIENT.id)
    if (existing) {
      existing.merge({ name: FLUTTER_CLIENT.name, redirectUris: FLUTTER_CLIENT.redirectUris })
      await existing.save()
      return
    }

    await oauthServer.createClient({ ...FLUTTER_CLIENT, firstParty: true })
  }
}
