#!/bin/sh
set -e

# Migraciones pendientes antes de arrancar (desactivar con RUN_MIGRATIONS=false)
if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  node ace migration:run --force
fi

# Seeders idempotentes: niveles de sala
if [ "${RUN_SEEDERS:-true}" = "true" ]; then
  node ace db:seed
fi

exec "$@"
