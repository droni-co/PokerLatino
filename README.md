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
pnpm api:seed         # salas iniciales
pnpm api:dev          # API en http://localhost:3333 (con HMR)
```

Si las bases no existen:

```bash
psql -h 127.0.0.1 -U dev -d postgres -c "CREATE DATABASE poker_latino;" -c "CREATE DATABASE poker_latino_test;"
```

Copia `apps/api/.env.example` a `apps/api/.env` si no existe y genera la clave con
`pnpm --filter @poker-latino/api exec node ace generate:key`.

### Cliente Flutter (web y móvil)

Requiere la API corriendo (`pnpm dev`) y las salas sembradas (`pnpm api:seed`).

```bash
cd apps/app
flutter pub get
flutter run -d chrome --web-port 8080 --dart-define=API_URL=http://localhost:3333   # web (= pnpm app:web)
flutter run -d emulator-5554              # Android (usa http://10.0.2.2:3333 automáticamente)
flutter run --dart-define=API_URL=http://192.168.1.10:3333   # dispositivo físico en tu red
```

- **Login**: formulario de la app (entrar / crear cuenta) con email y contraseña. El access token
  se guarda cifrado (Keychain/Keystore). Si la API responde 401 (se inició sesión en otro
  dispositivo o venció), la app vuelve al login y lo explica.
- **Mesa**: el estado se consulta cada segundo (polling). Tu asiento siempre aparece abajo.
- **Producción web**: la sirve el propio servidor de Adonis (ver "Despliegue"); la app usa su mismo
  origen como URL de la API, así que no hace falta CORS ni configurar `API_URL`.
- **Pruebas**: `flutter test` (sesión y formulario de login con servidor simulado,
  modelos contra JSON real de la API en `test/fixtures/`, lógica y widgets de la mesa en tamaños
  de móvil, horizontal y escritorio).

## Despliegue (un solo servidor)

La versión web de Flutter se compila dentro de `apps/api/public/` y la sirve Adonis en la raíz,
junto a la API, en el mismo dominio y puerto:

| Ruta | Qué responde |
|------|--------------|
| `/`, `/lobby`, `/rooms/5`… | La app web (`index.html`; las rutas de la app se resuelven en el navegador) |
| `/main.dart.js`, `/assets/…`… | Archivos de la app (`@adonisjs/static`, revalidados con ETag) |
| `/api/v1/…`, `/r/…`, `/health` | El servidor (API, enlaces de invitación, salud) |

```bash
pnpm build            # flutter build web → apps/api/public, y luego node ace build → apps/api/build
cd apps/api/build
pnpm i --prod
node bin/server.js    # con .env de producción (APP_URL=https://<tu-dominio>, NODE_ENV=production…)
node ace migration:run --force && node ace db:seed   # la primera vez / tras migraciones nuevas
```

- `APP_URL` debe ser la URL pública.
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
| `pnpm api:seed` | Crea las salas iniciales |
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

**Endpoints** (requieren token)

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

**Mesa en vivo** (requieren token)

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

### Amigos e invitaciones a la mesa

Los jugadores se buscan por nombre de usuario (o tocando su avatar en la mesa) y se envían solicitudes de
amistad; el otro las acepta o rechaza. Si los dos se envían solicitud, quedan como amigos. Rechazar, cancelar o
eliminar borra la relación (se puede volver a pedir). Límites en `config/game.ts` → `social`: 200 amigos y 30
solicitudes enviadas sin responder.

Sentado en una **mesa normal con asientos libres**, el jugador puede invitar a sus amigos (botón "Invitar amigos"
o tocando una silla libre). La invitación le aparece al amigo en cualquier pantalla de la app; "Jugar" lo lleva a
la mesa y abre la entrada. Caduca a los 5 minutos y deja de mostrarse si la mesa se llena. A las mesas de torneo
no se invita.

"Conectado" se calcula en memoria: la app consulta `GET /inbox` cada 10 s (y la mesa cada segundo); quien no lo
hizo en 45 s aparece desconectado.

| Endpoint | Descripción |
|----------|-------------|
| `GET /api/v1/inbox` | `{ friendRequests, invitations, progress }`: solicitudes, invitaciones vigentes y logros/nivel sin anunciar |
| `GET /api/v1/players?q=` | Buscar por nombre de usuario (mín. 2 letras) con la relación (`none`, `friend`, `incoming`, `outgoing`) |
| `GET /api/v1/friends?roomId=` | Amigos (conectado, mesa en la que están) y solicitudes; con `roomId`, `invitedHere` |
| `POST /api/v1/friends/requests` | `{ playerId }`: enviar solicitud (`409 already_friends`, `friend_request_exists`, `friend_limit`) |
| `POST /api/v1/friends/requests/:id/accept` | Aceptar una solicitud recibida |
| `DELETE /api/v1/friends/requests/:id` | Rechazar (recibida) o cancelar (enviada) |
| `DELETE /api/v1/friends/:id` | Dejar de ser amigos |
| `POST /api/v1/rooms/:id/invitations` | `{ playerId }`: invitar a un amigo (`409 not_seated`, `not_friends`, `room_full`, `already_invited`) |
| `POST /api/v1/invitations/:id/accept` | Devuelve `{ roomId }` (`409 invitation_expired`) |
| `DELETE /api/v1/invitations/:id` | Rechazar la invitación |

### Experiencia, niveles y logros

Cada mano jugada (también en torneo) da **2 XP**, y **3 más** si la ganas. Cada logro da su XP y sus fichas.
Para llegar al nivel *n* hace falta `50·n·(n−1)` XP en total (nivel 2 → 100, 5 → 1,000, 10 → 4,500, 20 → 19,000).
Cada nivel nuevo regala **nivel × 100 fichas** (`level_reward`); cada logro, las suyas (`achievement_reward`).
Los ritmos están en `config/game.ts` → `progress`, y el catálogo (32 logros en 6 categorías: manos, victorias,
pozos, jugadas, torneos y social) en `app/game/achievements.ts`.

El nivel sale junto al avatar en la mesa (`seats[].player.level`). Tocar a un jugador abre su tarjeta: nivel,
números y logros. La app anuncia los logros y niveles nuevos con lo que trae `GET /inbox` → `progress`.

Los jugadores anteriores a los logros arrancan con su historial: la migración carga manos, victorias, mayor pozo
y victorias all-in de las manos guardadas, y al arrancar el servidor se les repasan los logros (con sus fichas y
niveles). Rachas y jugadas ganadoras solo cuentan desde ahora.

| Endpoint | Descripción |
|----------|-------------|
| `GET /api/v1/me/progress` | Tu nivel, XP (`levelXp`, `nextLevelXp`) y todos los logros con tu avance |
| `POST /api/v1/me/progress/seen` | La app ya anunció los logros y el nivel nuevos |
| `GET /api/v1/players/:id` | Tarjeta pública de un jugador: nivel, estadísticas, logros y tu relación con él |

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

## Autenticación

Email + contraseña → access token de AdonisJS (`Authorization: Bearer pl_…`), válido 30 días.

**Una sola sesión por jugador:** al iniciar sesión se borran todos sus tokens anteriores. El otro
dispositivo recibe `401` en su siguiente petición y la app le muestra que la sesión se abrió en otro
dispositivo.

| Endpoint | Descripción |
|----------|-------------|
| `POST /api/v1/auth/register` | `{ username, email, password, password_confirmation, birth_date: "YYYY-MM-DD", referral_code? }` → `201 { data: { token, user } }`. Si no viene `referral_code`, usa el de la cookie del enlace `/r/CODIGO` |
| `POST /api/v1/auth/login` | `{ email, password }` → `{ data: { token, user } }`; cierra las demás sesiones. `401 invalid_credentials` si no coinciden |
| `DELETE /api/v1/auth/logout` | Invalida el token actual (`204`) |
| `GET /api/v1/me` | Usuario actual |
| `GET /health` | Estado de API y DB |

- Tokens opacos guardados como hash en `auth_access_tokens`; contraseñas con scrypt.
- Sin CSRF: la API no se autentica con cookies.
- Los bots de la casa no pueden iniciar sesión.
