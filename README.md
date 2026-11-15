# Poker Latino

Juego de poker online multijugador.

> ⚠️ **Antes de habilitar las salas con dinero real, revisar [Legal.md](Legal.md)** (licencias, KYC, AML, pagos, tiendas de apps).

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
pnpm api:seed         # cliente OAuth de la app Flutter + salas iniciales
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
| `pnpm api:seed` | Registra el cliente OAuth `poker-latino-app` y las salas iniciales |
| `pnpm api:test` | Tests de la API (usa la DB `poker_latino_test`) |
| `pnpm app:get` / `app:dev` | `flutter pub get` / `flutter run` |

## Juego y economía

**Reglas generales**
- Texas Hold'em No-Limit, salas de **5 jugadores**.
- **Sin comisión de la casa** (`rake = 0`): los jugadores juegan entre sí y el 100% del pozo va al ganador.
- Cada sala es de una sola moneda:

| Moneda | Tipo | Cómo se obtiene | Unidad en la API |
|--------|------|-----------------|------------------|
| `credits` | Gratis | 1000 al registrarse | 1 = 1 crédito |
| `usd` | Pago | Recarga de saldo | 1 = 1 centavo (`2500` = $25.00) |

Todos los montos de la API son **enteros en unidades mínimas**. La app los formatea usando
`decimals` de `GET /api/v1/game/config`.

**Cómo se mueve el dinero**
- Cada jugador tiene una billetera por moneda (`wallets`).
- Todo movimiento queda en un libro contable inmutable (`wallet_transactions`) con el saldo resultante.
- Al sentarse, el buy-in pasa de la billetera a la mesa (`room_seats.stack`); al levantarse, vuelve.
- Las operaciones bloquean la billetera (`SELECT … FOR UPDATE`) y la base de datos impide saldos negativos.
- Invariante: saldo en billeteras + fichas en mesas solo cambia con bonos, recargas y retiros.

**Tablas:** `wallets`, `wallet_transactions`, `deposits`, `rooms`, `room_seats`, `hands`,
`hand_players`, `hand_actions` (historial que escribirá el motor de juego) y `player_stats`
(estadísticas por jugador y moneda).

**Endpoints** (requieren token con scope `game`)

| Endpoint | Descripción |
|----------|-------------|
| `GET /api/v1/game/config` | Monedas, bono inicial, rake, límites |
| `GET /api/v1/wallets` | Saldos `credits` y `usd` |
| `GET /api/v1/wallets/:currency/transactions` | Historial paginado (`page`, `perPage`) |
| `POST /api/v1/deposits` | Inicia una recarga USD `{ amount }` (queda `pending`) |
| `GET /api/v1/rooms?currency=credits\|usd` | Salas activas con asientos ocupados |
| `GET /api/v1/rooms/:id` | Detalle con asientos (sin emails) |
| `POST /api/v1/rooms/:id/seat` | Sentarse `{ buyIn, seatNumber? }` |
| `DELETE /api/v1/rooms/:id/seat` | Levantarse (devuelve las fichas a la billetera) |
| `GET /api/v1/me/stats` | Estadísticas por moneda |

**Mesa en vivo** (requieren scope `game`)

| Endpoint | Descripción |
|----------|-------------|
| `GET /api/v1/rooms/:id/state` | Estado de la mesa para el jugador: mano, tablero, bote, turno, asientos, **solo sus cartas**, acciones legales y resultado de la mano anterior |
| `POST /api/v1/rooms/:id/actions` | `{ action: fold\|check\|call\|bet\|raise\|all_in, amount? }`. En `bet`/`raise`, `amount` es el **total** a apostar en la calle ("subir a") |

### Motor de Texas Hold'em

- `app/game/holdem/engine.ts`: motor **puro** (no usa base de datos ni red). Implementa ciegas (y las reglas de heads-up),
  subida mínima, all-in corto que no reabre la acción, botes paralelos, showdown, empates con ficha impar
  y conservación de fichas comprobada al final de cada mano.
- `app/game/holdem/evaluator.ts`: evalúa la mejor mano de 5 cartas entre 7.
- `app/game/holdem/cards.ts`: mazo barajado con `crypto.randomInt` (Fisher-Yates).
- `app/game/table_manager.ts`: conecta el motor con las salas.
  - Inicia una mano cuando hay 2 o más jugadores con fichas y rota el botón.
  - Procesa las acciones de cada mesa en serie y controla el tiempo de turno (al agotarse: pasar o retirarse).
  - Al terminar la mano guarda el historial (`hands`, `hand_players`, `hand_actions`), los stacks y las estadísticas.
  - Si el servidor se reinicia a mitad de una mano, la cancela al arrancar y los jugadores conservan sus fichas.

**Limitaciones actuales**
- Un solo proceso de servidor (el estado de las mesas vive en memoria). Para escalar habrá que usar Redis.
- La app debe consultar `/state` periódicamente; falta enviar las actualizaciones en tiempo real (WebSockets/SSE).
- Los jugadores que dejan vencer su turno siguen recibiendo cartas; falta pasarlos a "sentado fuera" (*sitting out*).
- Al entrar a una mano no se cobran ciegas pendientes (sin reglas de "dead button" ni "missed blinds").

**Configuración:** `apps/api/config/game.ts` (bono, rake, asientos, límites de recarga).
Las salas iniciales están en `database/seeders/room_seeder.ts`: 3 de credits y 3 de USD,
con buy-in de 40 a 100 ciegas grandes.

**Registro:** email, contraseña y **fecha de nacimiento**, con una edad mínima de 18 años (`config/game.ts → minimumAge`).

**Desarrollo:** para simular una recarga confirmada:
```bash
cd apps/api && node ace deposit:simulate --email=jugador@x.com --amount=2500
```

## Autenticación (OAuth2)

La API es su propio servidor OAuth2 (`authorization_code` + PKCE, según OAuth 2.1). El registro y el
login son páginas HTML del servidor que la app abre en el navegador del sistema.

```
App Flutter                     Navegador                         API
    │ genera code_verifier + code_challenge
    │── abre /oauth/authorize?...&code_challenge=… ──▶ login / registro (sesión web)
    │◀── co.droni.pokerlatino:/oauth/callback?code=…&state=… ──┘
    │── POST /oauth/token (code + code_verifier) ─────────────────────────▶
    │◀── { access_token (15 min), refresh_token (30 días, rotativo) } ─────
    │── GET /api/v1/me  Authorization: Bearer pl_at_… ────────────────────▶
```

| Endpoint | Descripción |
|----------|-------------|
| `GET /.well-known/oauth-authorization-server` | Metadata de discovery (RFC 8414) |
| `GET /oauth/authorize` | Inicio del flujo. Parámetros: `response_type=code`, `client_id`, `redirect_uri`, `scope`, `state`, `code_challenge`, `code_challenge_method=S256`, opcional `prompt=login` |
| `GET/POST /oauth/login`, `/oauth/register` | Páginas HTML de login y registro (email + contraseña) |
| `POST /oauth/logout` | Cierra la sesión del navegador |
| `POST /oauth/token` | `grant_type=authorization_code` o `refresh_token` |
| `POST /oauth/revoke` | Revoca un token (RFC 7009). Revocar el refresh token = cerrar sesión en la app |
| `POST /oauth/introspect` | Introspección (RFC 7662), solo clientes confidenciales |
| `GET /api/v1/me` | Usuario actual (requiere scope `profile`) |
| `GET /health` | Estado de API y DB |

**Seguridad implementada**
- PKCE obligatorio (solo `S256`), `state` y parámetro `iss` en la respuesta (RFC 9207).
- `redirect_uri` con coincidencia exacta; para loopback (`http://localhost`) se acepta cualquier puerto (RFC 8252).
- Codes de un solo uso (5 min): si se reutilizan, se revocan los tokens emitidos con ellos.
- Refresh tokens rotativos con detección de reutilización: si se usa uno ya rotado, se revoca toda la sesión.
- Tokens opacos guardados como SHA-256; contraseñas y secretos de cliente con scrypt.
- CSRF y CSP en las páginas HTML; `Cache-Control: no-store` en las respuestas de tokens.

**Scopes:** `profile` (datos de la cuenta) y `game` (jugar).

**Clientes OAuth**
- `poker-latino-app`: la app Flutter. Es un cliente público y propio (no muestra pantalla de consentimiento). Se registra con `pnpm api:seed`.
- Para registrar otros clientes:

```bash
cd apps/api
node ace oauth:client --id=mi-backend --name="Mi backend" --confidential
node ace oauth:client --id=app-amiga --name="App amiga" -r https://amiga.test/callback
```
