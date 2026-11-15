# Poker Latino

Juego de poker online multijugador. **Es un juego, no un casino:** se juega solo con **fichas**,
que no se compran, no se venden y no se cambian por dinero. Ver [Legal.md](Legal.md) antes de
agregar cualquier cosa que les dé valor real (compras, premios, intercambio).

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

### Cliente Flutter (web y móvil)

Requiere la API corriendo (`pnpm dev`) y el cliente OAuth sembrado (`pnpm api:seed`).

```bash
cd apps/app
flutter pub get
flutter run -d chrome --web-port 8080 --dart-define=API_URL=http://localhost:3333   # web (= pnpm app:web)
flutter run -d emulator-5554              # Android (usa http://10.0.2.2:3333 automáticamente)
flutter run --dart-define=API_URL=http://192.168.1.10:3333   # dispositivo físico en tu red
```

- **Login**: OAuth2 + PKCE con las páginas de la API. En web se abre una ventana emergente que
  vuelve a `/<origen>/auth.html`; en móvil, el navegador del sistema vuelve por el esquema
  `co.droni.pokerlatino:/oauth/callback`. Los tokens se guardan cifrados (Keychain/Keystore) y la
  renovación es de un solo vuelo (el servidor rota los refresh tokens).
- **Mesa**: el estado se consulta cada segundo (polling). Tu asiento siempre aparece abajo.
- **Producción web**: la sirve el propio servidor de Adonis (ver "Despliegue"); la app usa su mismo
  origen como URL de la API, así que no hace falta CORS ni configurar `API_URL`.
- **Pruebas**: `flutter test` (PKCE con el vector del RFC 7636, cliente OAuth con servidor simulado,
  modelos contra JSON real de la API en `test/fixtures/`, lógica y widgets de la mesa en tamaños
  de móvil, horizontal y escritorio).

## Despliegue (un solo servidor)

La versión web de Flutter se compila dentro de `apps/api/public/` y la sirve Adonis en la raíz,
junto a la API, en el mismo dominio y puerto:

| Ruta | Qué responde |
|------|--------------|
| `/`, `/lobby`, `/rooms/5`… | La app web (`index.html`; las rutas de la app se resuelven en el navegador) |
| `/main.dart.js`, `/assets/…`, `/auth.html`… | Archivos de la app (`@adonisjs/static`, revalidados con ETag) |
| `/api/v1/…`, `/oauth/…`, `/.well-known/…`, `/health` | El servidor (API, login OAuth, salud) |

```bash
pnpm build            # flutter build web → apps/api/public, y luego node ace build → apps/api/build
cd apps/api/build
pnpm i --prod
node bin/server.js    # con .env de producción (APP_URL=https://<tu-dominio>, NODE_ENV=production…)
node ace migration:run --force && node ace db:seed   # la primera vez / tras migraciones nuevas
```

- `APP_URL` debe ser la URL pública: el seeder registra `<APP_URL>/auth.html` como redirect OAuth
  de la app web (vuelve a correr `db:seed` si cambia el dominio).
- `apps/api/public/` no se versiona; se regenera en cada `pnpm build` / `pnpm build:web`.
- En desarrollo puedes seguir usando `pnpm app:web` (puerto 8080, con hot reload) contra `pnpm dev`.
  Si existe una build en `public/`, `pnpm dev` también la sirve en http://localhost:3333.
- Todo vive en un proceso: la mesa en memoria supone **una sola instancia** (ver motor).

### Con Docker (detrás de nginx-proxy + acme-companion)

```bash
cp .env.deploy.example .env.deploy   # DOMAIN, APP_KEY, DB_PASSWORD
docker compose -f docker-compose.prod.yml --env-file .env.deploy up -d --build
```

La imagen (`apps/api/Dockerfile`) compila la app web con Flutter (`FLUTTER_VERSION`, debe coincidir
con `apps/app/.metadata`) y la API; al arrancar corre migraciones y seeders (desactivables con
`RUN_MIGRATIONS=false` / `RUN_SEEDERS=false`). PostgreSQL persiste en el volumen `pgdata`.

## Scripts (raíz)

| Script | Descripción |
|--------|-------------|
| `pnpm dev` | Levanta la API |
| `pnpm db:psql` | Consola psql |
| `pnpm api:migrate` | Corre migraciones |
| `pnpm api:seed` | Registra el cliente OAuth `poker-latino-app` y las salas iniciales |
| `pnpm api:test` | Tests de la API (usa la DB `poker_latino_test`) |
| `pnpm app:get` / `app:dev` | `flutter pub get` / `flutter run` |
| `pnpm app:web` | App web en http://localhost:8080 (desarrollo, contra la API en :3333) |
| `pnpm build:web` | Compila la app web en `apps/api/public/` |
| `pnpm build` | Build de producción completa: app web + API en `apps/api/build/` |
| `pnpm app:test` | Tests de la app Flutter |

## Juego y economía

**Reglas generales**
- Texas Hold'em No-Limit, salas de **5 jugadores**.
- **Sin comisión de la casa** (`rake = 0`): los jugadores juegan entre sí y el 100% del pozo va al ganador.
- La única moneda son las **fichas**: 1000 de regalo al registrarse. Todos los montos de la API
  son enteros (1 = 1 ficha).

**Cómo se mueven las fichas**
- Cada jugador tiene una sola billetera de fichas (`wallets`).
- Todo movimiento queda en un libro contable inmutable (`wallet_transactions`) con el saldo resultante.
  Los únicos tipos permitidos (también en la base de datos) son `signup_bonus`, `buy_in`, `cash_out`
  y `adjustment`: no existen recargas ni retiros.
- Al sentarse, el buy-in pasa de la billetera a la mesa (`room_seats.stack`); al levantarse, vuelve.
- Las operaciones bloquean la billetera (`SELECT … FOR UPDATE`) y la base de datos impide saldos negativos.
- Invariante: fichas en billeteras + fichas en mesas solo cambia con bonos y ajustes.

**Mesas automáticas por nivel**
- Cada **nivel** (`room_levels`: Principiantes, Clásica, High Rollers) define ciegas, buy-in y asientos.
  Sus **mesas** (`rooms`) se llaman "Clásica · Mesa 2" y copian esas reglas.
- Si los asientos libres de todo el nivel bajan de 2, el servidor abre otra mesa (reutiliza primero
  la cerrada de número más bajo). Máximo 20 mesas por nivel.
- Las mesas extra que pasan 5 minutos vacías se cierran (revisión cada 60 s en `start/game.ts`).
  La Mesa 1 de cada nivel siempre queda abierta.
- "Jugar" en un nivel elige la mesa: primero una donde alguien espera solo (así empieza la partida),
  luego la que tenga más jugadores con lugar libre.
- Para evitar carreras, sentarse bloquea primero el nivel y luego la mesa (`SELECT … FOR UPDATE`).
- Todo se ajusta en `config/game.ts → rooms.autoTables`.

**Tablas:** `wallets`, `wallet_transactions`, `room_levels`, `rooms`, `room_seats`, `hands`, `hand_players`,
`hand_actions` (historial de manos) y `player_stats` (estadísticas por jugador).

**Endpoints** (requieren token con scope `game`)

| Endpoint | Descripción |
|----------|-------------|
| `GET /api/v1/game/config` | Fichas de bienvenida, rake, reglas de las salas |
| `GET /api/v1/wallet` | Fichas disponibles `{ balance }` |
| `GET /api/v1/wallet/transactions` | Historial paginado (`page`, `perPage`) |
| `GET /api/v1/levels` | Niveles con sus mesas abiertas, jugadores y asientos ocupados |
| `POST /api/v1/levels/:id/seat` | "Jugar" `{ buyIn }`: el servidor elige la mesa. `201 { roomId, seat }`; `200 { alreadySeated: true }` si ya estaba en una mesa del nivel (no cobra) |
| `GET /api/v1/rooms` | Mesas abiertas con asientos ocupados |
| `GET /api/v1/rooms/:id` | Detalle con asientos (sin emails) |
| `POST /api/v1/rooms/:id/seat` | Sentarse `{ buyIn, seatNumber? }` |
| `DELETE /api/v1/rooms/:id/seat` | Levantarse (devuelve las fichas a la billetera) |
| `GET /api/v1/me/stats` | Estadísticas del jugador |

**Mesa en vivo** (requieren scope `game`)

| Endpoint | Descripción |
|----------|-------------|
| `GET /api/v1/rooms/:id/state` | Estado de la mesa para el jugador: mano, tablero, bote, turno, asientos, **solo sus cartas**, acciones legales y resultado de la mano anterior |
| `POST /api/v1/rooms/:id/actions` | `{ action: fold\|check\|call\|bet\|raise\|all_in, amount? }`. En `bet`/`raise`, `amount` es el **total** a apostar en la calle ("subir a") |
| `POST /api/v1/rooms/:id/show` | Entre manos: enseñar mis cartas aunque no fuera obligatorio (gané sin showdown o me retiré). `409 cannot_show` con la mano en curso o si ya se vieron en el showdown |
| `GET /api/v1/rooms/:id/chat?after=` | Chat de la mesa: los mensajes posteriores a `after` o los últimos 50 |
| `POST /api/v1/rooms/:id/chat` | `{ body }` (1–200 caracteres). Pueden escribir jugadores y espectadores; máximo 5 mensajes cada 10 s (`429 chat_rate_limited`) |

`/state` acepta `?chatAfter=<id>` y devuelve en `chat` solo los mensajes nuevos, así el chat llega con el
mismo sondeo de la mesa. En `lastHand.players`, `bestCards` trae las 5 cartas de la mejor mano de quienes
llegaron al showdown (la app las resalta). Los mensajes se borran a los 3 días (`config/game.ts → chat`).

Entre manos hay una pausa de 12 s (`config/game.ts → table.nextHandDelayMs`) para ver el resultado; `/state`
trae `nextHandAt` con la hora de inicio de la siguiente y `nextHandInMs` con los milisegundos que faltan (la app usa
este último para la cuenta atrás sobre el tablero, así no depende del reloj del dispositivo). Durante esa pausa `lastHand.yourCards` trae tus cartas
(solo a ti) y `lastHand.canShow` indica si puedes enseñarlas; quienes las enseñan aparecen en `lastHand.players`
con `shown: true`, sus `holeCards` y su jugada (`handName`) si ya había flop. Cuando alguien se sienta en una mesa
parada la mano arranca en 3 s (`firstHandDelayMs`), sin acortar ni alargar una pausa en curso.

### Torneos

Torneos multi-mesa de eliminación con inscripción en fichas (sin comisión: todo el bote se reparte).

- **Inscripción** (`registering`): cobra `buy_in` de la billetera; se puede salir con reembolso completo
  mientras no empiece. El cupo es `table_count × max_seats`.
- **Inicio:** a la hora (`starts_at`) si el cupo está lleno; si no, en cuanto se llene (espera sin límite).
  Se abren las mesas (`rooms` con `tournament_id`), se sortean los asientos y cada jugador recibe
  `starting_stack` fichas de torneo (no son de la billetera). La primera mano arranca a los 10 s.
- **Ciegas:** empiezan en `small_blind`/`big_blind` y se duplican cada `blinds_up_every_hands` manos de
  cada mesa (si te cambian de mesa juegas el nivel de la nueva).
- **Eliminaciones:** quien se queda sin fichas queda fuera con su puesto (si caen varios en la misma mano,
  queda mejor quien la empezó con más fichas) y, si le toca, su premio va a la billetera.
- **Mesas:** tras cada mano se rompe una mesa si los jugadores caben en una menos y se equilibran
  (diferencia máxima de 1), moviendo solo a jugadores de mesas sin mano en curso. La app sigue al jugador a su nueva mesa.
- **Premios** según inscritos (`config/game.ts → tournaments.payouts`): hasta 3 → 100%; hasta 9 → 65/35;
  hasta 18 → 50/30/20; luego 5, 7 y 10 puestos pagados.
- En torneo no hay "levantarse" ni expulsión por inactividad o desconexión: quien se va sigue pagando
  ciegas (pasa o se retira solo al agotarse su tiempo). Las manos de torneo no cuentan en las estadísticas.

**Crear un torneo** (hasta tener backoffice, directo en la base de datos):

```sql
INSERT INTO tournaments (slug, name, description, buy_in, starting_stack, small_blind, big_blind,
  blinds_up_every_hands, max_seats, table_count, action_timeout_seconds, starts_at, status, created_at, updated_at)
VALUES ('nocturno-2026-11-20', 'Torneo Nocturno', 'Dos mesas, ciegas ×2 cada 8 manos',
  200, 1500, 10, 20, 8, 5, 2, 15, '2026-11-20 21:00:00-05', 'registering', now(), now());
```

`tournamentService.cancel(id)` cancela un torneo que no empezó y devuelve las inscripciones.

| Endpoint | Descripción |
|----------|-------------|
| `GET /api/v1/tournaments` | Abiertos, en juego y terminados en las últimas 24 h, con `you` (tu inscripción, tu mesa y tu resultado) |
| `GET /api/v1/tournaments/:id` | Detalle, `payouts` (premio por puesto) y `standings` (en juego por fichas, luego eliminados por puesto) |
| `POST /api/v1/tournaments/:id/entry` | Inscribirse (`409 tournament_full`, `already_registered`, `tournament_closed`; `422 insufficient_funds`) |
| `DELETE /api/v1/tournaments/:id/entry` | Salirse antes de que empiece (reembolso) |

En una mesa de torneo `/state` trae `tournament` (nivel, manos para la subida, próximas ciegas, jugadores que
quedan, `yourRoomId` y `yourResult`). Sentarse o levantarse a mano responde `409 tournament_table`.

### Invitaciones y rescate diario

Cada jugador tiene un enlace `<APP_URL>/r/CODIGO` (el código se crea la primera vez que lo pide). Al abrirlo
se guarda una cookie `ref` (30 días) y el formulario de registro trae el código ya puesto (también se puede
escribir a mano). Al **crear la cuenta** con un código válido:

- el invitado recibe **500 fichas** además del bono de bienvenida (`referral_bonus`), y quien invita **500**
  (`referral_reward`);
- quien invita cobra como mucho **5 invitaciones cada 24 h**; después el invitado sigue recibiendo su bono
  (estado `limit_reached`);
- no cobra nadie (`blocked`) si el invitado usa un alias del email de quien invita (`+etiqueta`, puntos de
  Gmail) o si desde la misma IP ya se premiaron 2 cuentas en 24 h.

**Rescate diario**: quien no tiene fichas para la mesa más barata (billetera + fichas sentadas en mesas
normales) puede reclamar **400 fichas** gratis una vez cada 24 h (`rescue`). La app lo ofrece en el lobby, en
Fichas y al levantarte de la mesa sin fichas. Todo se ajusta en `config/game.ts` (`referrals`, `rescue`).

| Endpoint | Descripción |
|----------|-------------|
| `GET /r/:code` | Página pública de invitación (guarda la cookie y lleva a la app) |
| `GET /api/v1/referrals` | Tu código, enlace, reglas, cupo de hoy (`rewardedToday`, `nextSlotAt`) e invitados |
| `GET /api/v1/wallet/rescue` | `{ amount, threshold, eligible, available, nextAt }` |
| `POST /api/v1/wallet/rescue` | Reclamar el rescate (`409 rescue_unavailable` si no toca) |

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

**Configuración:** `apps/api/config/game.ts` (fichas de bienvenida, rake, asientos, mesas automáticas).
Los niveles están en `database/seeders/room_seeder.ts`: Principiantes (5/10), Clásica (10/20)
y High Rollers (50/100), con buy-in de 40 a 100 ciegas grandes.

**Registro:** email, contraseña y **fecha de nacimiento**, con una edad mínima de 18 años (`config/game.ts → minimumAge`).

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
