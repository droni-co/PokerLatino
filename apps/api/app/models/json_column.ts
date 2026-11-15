import { column } from '@adonisjs/lucid/orm'

/**
 * Columna jsonb que guarda un array de strings.
 * `prepare` evita que el driver pg lo convierta en un array nativo de Postgres.
 */
export const jsonColumn = () =>
  column({
    prepare: (value: unknown) => JSON.stringify(value ?? []),
    consume: (value: unknown) =>
      (typeof value === 'string' ? JSON.parse(value) : (value ?? [])) as string[],
  })
