# Notas legales: Poker Latino

> Actualizado el 2026-11-14. Es una lista de temas a revisar, **no es asesoría legal**. Las reglas
> cambian según el país; cualquier cambio en la economía del juego debe validarlo un abogado.

## Decisión: es un juego, no un casino

Poker Latino se juega **solo con fichas sin valor monetario**:

- Se regalan al registrarse (1000) y solo se ganan o pierden jugando.
- **No se compran, no se venden, no se canjean** por dinero, premios ni nada con valor fuera del juego.
- No hay recargas, retiros ni proveedor de pagos. Se eliminaron el código, las rutas y la tabla
  `deposits`, y la base de datos rechaza movimientos que no sean `signup_bonus`, `buy_in`, `cash_out`
  o `adjustment` (migración `1769200000000_remove_real_money`).

En la mayoría de las jurisdicciones una actividad es apuesta (y requiere licencia) cuando reúne
**pago + azar + premio con valor**. Sin compra de fichas ni canje, falta el pago y el premio. Mantener
esa separación es lo que sostiene esta decisión.

## Antes de cambiar la economía

Cualquiera de estos cambios puede convertir el juego en apuestas y exige revisión legal previa:

- Vender fichas (aunque sea "solo para divertirse") o regalarlas a cambio de publicidad pagada.
- Premios, sorteos o torneos con premio en dinero, bienes o tarjetas de regalo.
- Permitir transferir fichas entre jugadores (crea un mercado secundario donde se venden por fuera).
- Integrar criptomonedas, NFT o cualquier token intercambiable.

## Pendiente aunque no haya dinero real

| Tema | Estado |
|------|--------|
| Edad mínima de 18 años en el registro | Implementado (lo declara el usuario, **no está verificado**) |
| Clasificación en tiendas: Apple y Google tratan el poker como "juego de azar simulado" (clasificación 17+/18+ y declaración en el cuestionario de contenido) | Pendiente |
| Términos y condiciones: aclarar que las fichas no tienen valor, no son propiedad del usuario y pueden ajustarse o reiniciarse | No existen |
| Política de privacidad (email, fecha de nacimiento, historial de manos) y borrado de cuenta (lo exigen ambas tiendas) | No existen |
| Mensajes de juego responsable y enlaces de ayuda, recomendados para juegos de azar simulados | Pendiente |
| Reglas contra trampas y colusión, y moderación de nombres de usuario | Pendiente |
