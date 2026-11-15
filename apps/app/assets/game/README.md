# Imágenes del juego

Identidad visual **"Noche Latina"** (generada con Layer.ai): casino nocturno latino, paño
esmeralda, filigrana dorada art déco, papel picado, talavera y cempasúchil.

Todas son opcionales: si un archivo no existe, la app dibuja una versión por defecto.

## Mesa

| Archivo | Uso | Tamaño |
|---------|-----|--------|
| `background.png` | Fondo del salón (mesa y pantallas del menú, oscurecido) | 1920×1080 |
| `table.png` | Mesa vista desde arriba, fondo transparente | 2048×1024 (2:1) |
| `card_back.png` | Reverso de las cartas | 600×840 |
| `dealer.png` | Crupier detrás de la mesa, fondo transparente | 512×512 |
| `chip.png` | Ficha vista desde arriba en grises (el código la tiñe) | 256×256 |

## Avatares

| Carpeta | Uso |
|---------|-----|
| `avatars/<id>.png` | Avatares genéricos (fauna latina). Quien no eligió avatar recibe uno "al azar" pero estable: `GameAssets.avatarFor(id)` usa un hash del id, así todos los clientes ven el mismo. Agregar o quitar archivos cambia el reparto. 256×256 |
| `avatars/personajes/<id>.png` | 9 personajes ilustrados, solo se usan si el jugador los elige en su perfil. |

El nombre del archivo (sin extensión) es el **id** del avatar que guarda la API (`users.avatar`).
Para agregar un avatar elegible: copia la imagen aquí **y** agrega su id a `avatars` en
`apps/api/config/game.ts` (la API rechaza ids que no estén en esa lista).

## Interfaz (`ui/`)

| Archivo | Uso |
|---------|-----|
| `ui/logo.png` | Logo con texto (login y barra superior), transparente |
| `ui/emblem.png` | Emblema cuadrado (fuente de los íconos de la app) |
| `ui/login_hero.jpg` | Arte de fondo de la pantalla de login |
| `ui/rooms/*.jpg` | Banners de las tarjetas de sala del lobby (se reparten por id de sala) |
| `ui/icons/<nombre>.png` | Íconos ilustrados: `chips` (moneda de fichas), `hands`, `trophy`, `showdown`, `wagered`, `won`, `net`, `pot` (128×128) |
