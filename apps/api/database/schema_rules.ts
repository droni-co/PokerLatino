import { type SchemaRules } from '@adonisjs/lucid/types/schema_generator'

/**
 * - bigint se expone como `number` (ver el parser de int8 en config/database.ts).
 * - Las columnas jsonb se declaran a mano en los modelos (ver app/models/json_column.ts)
 *   porque necesitan `prepare: JSON.stringify`.
 */
export default {
  types: {
    bigint: { tsType: 'number', decorators: [{ name: '@column' }] },
  },
  tables: {
    oauth_clients: { skipColumns: ['redirect_uris', 'grant_types', 'scopes'] },
    oauth_authorization_codes: { skipColumns: ['scopes'] },
    oauth_access_tokens: { skipColumns: ['scopes'] },
    oauth_refresh_tokens: { skipColumns: ['scopes'] },
    hands: { skipColumns: ['board'] },
    hand_players: { skipColumns: ['hole_cards'] },
  },
} satisfies SchemaRules
