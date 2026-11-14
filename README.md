# Poker Latino

Juego de poker online multijugador.

| App | Ruta | Stack |
|-----|------|-------|
| API | `apps/api` | AdonisJS 7 + Lucid (TypeScript) |
| Base de datos | local | PostgreSQL (instalación local) |
| Cliente | `apps/app` | Flutter |

```
.
├── apps/
│   ├── api/            # Backend AdonisJS (auth con access tokens)
│   └── app/            # Cliente Flutter
├── packages/           # Paquetes compartidos (futuro)
├── package.json        # Scripts del monorepo (pnpm workspaces)
└── pnpm-workspace.yaml
```

## Requisitos

- Node.js >= 24 y pnpm
- PostgreSQL local con usuario `dev` y las bases `poker_latino` y `poker_latino_test`
- Flutter SDK (stable)

## Primeros pasos

```bash
pnpm install          # dependencias del workspace
pnpm api:migrate      # corre migraciones
pnpm api:dev          # API en http://localhost:3333 (con HMR)
```

Si las bases no existen:

```bash
psql -h 127.0.0.1 -U dev -d postgres -c "CREATE DATABASE poker_latino;" -c "CREATE DATABASE poker_latino_test;"
```

Copia `apps/api/.env.example` a `apps/api/.env` si no existe y genera la clave con
`pnpm --filter @poker-latino/api exec node ace generate:key`.

### Cliente Flutter

La primera vez, genera las carpetas de plataforma (android, ios, web, etc.):

```bash
cd apps/app
flutter create . --project-name poker_latino --org co.droni
flutter pub get
flutter run --dart-define=API_URL=http://localhost:3333
```

En el emulador de Android usa `API_URL=http://10.0.2.2:3333`.

## Scripts (raíz)

| Script | Descripción |
|--------|-------------|
| `pnpm dev` | Levanta la API |
| `pnpm db:psql` | Consola psql |
| `pnpm api:migrate` | Corre migraciones |
| `pnpm api:test` | Tests de la API (usa la DB `poker_latino_test`) |
| `pnpm app:get` / `app:dev` | `flutter pub get` / `flutter run` |

## Endpoints actuales

- `GET /health` — estado de API y DB
- `POST /api/v1/auth/signup` — registro (`fullName`, `email`, `password`, `passwordConfirmation`)
- `POST /api/v1/auth/login` — login, devuelve token `Bearer`
- `GET /api/v1/account/profile` — perfil (requiere token)
- `POST /api/v1/account/logout`
