# ⚠️ Pendientes legales: Poker Latino

> **IMPORTANTE: revisar antes de abrir las salas con dinero real (USD).**
> Nota creada el 2026-11-14. Este documento es una lista de temas a revisar, **no es asesoría legal**.
> Las reglas cambian según el país (y a veces según el estado o la provincia).
> Todo lo que sigue debe validarlo un abogado especializado en juegos de azar online (*iGaming*)
> en cada jurisdicción donde se quiera operar.

## Estado actual del proyecto

| Tema | Estado |
|------|--------|
| Salas gratuitas (credits, sin valor monetario) | Implementado |
| Salas con dinero real (USD) | Implementadas a nivel técnico. **No deben abrirse al público** hasta resolver este documento |
| Fecha de nacimiento en el registro (mayor de 18) | Implementado (es lo que declara el usuario, **no está verificado**) |
| Proveedor de pagos, retiros, verificación de identidad (KYC) | No implementado |
| Términos y condiciones, política de privacidad | No existen |

**Recomendación:** lanzar primero solo con credits. Para eso, desactivar las salas USD (`status = 'paused'`)
y deshabilitar `POST /api/v1/deposits` hasta tener la licencia.

---

## 1. Licencia de juego

- [ ] **El poker con dinero real se considera juego de azar en casi todos los países**, aunque la casa
      no cobre comisión (*rake*). Que el modelo sea "solo jugadores entre sí" **no elimina** la necesidad de licencia.
      En muchos lugares, operar sin ella es delito, no solo una infracción administrativa.
- [ ] Definir **en qué países se va a operar** y obtener la licencia de cada uno. Referencias a investigar:
  - Colombia: Coljuegos
  - México: SEGOB (Dirección General de Juegos y Sorteos)
  - Argentina: licencias provinciales (por ejemplo, LOTBA en CABA o IPLyC en Buenos Aires)
  - Perú: MINCETUR (ley de juegos a distancia)
  - España: DGOJ
  - Estados Unidos: licencias por estado; en la mayoría de los estados el poker online con dinero real está prohibido
  - Licencias internacionales: Malta (MGA), Curazao, Isla de Man. Hay que verificar si la licencia sirve en los países destino
- [ ] Revisar si la licencia exige **servidores en el país**, auditorías o **garantías financieras** (fianzas o depósitos en garantía).
- [ ] Revisar las **leyes de publicidad** de juegos de azar (horarios, públicos, avisos obligatorios).

## 2. Edad mínima y verificación de identidad (KYC)

- [ ] **La fecha de nacimiento que se pide en el registro no garantiza la mayoría de edad**: el usuario la declara sin verificación.
      Para jugar con dinero real normalmente se exige **verificar la identidad** (documento, selfie, comprobante de domicilio).
- [ ] Confirmar la **edad mínima** de cada jurisdicción. Hoy está configurada en 18 (`config/game.ts`), pero en algunos lugares es 21.
- [ ] Integrar un proveedor de KYC (Onfido, Veriff, Sumsub, MetaMap o similar) y **bloquear depósitos y salas USD hasta completarlo**.
- [ ] Revisar si incluso las **salas gratuitas** deben restringirse a mayores de edad. Las tiendas de apps y algunos
      reguladores lo exigen para el "juego social de casino".

## 3. Prevención de lavado de dinero (AML/CFT)

- [ ] Política AML: límites de depósito y retiro, monitoreo de transacciones inusuales y reportes a la
      unidad de inteligencia financiera de cada país.
- [ ] **Riesgo propio del poker:** se puede transferir dinero entre cuentas perdiendo a propósito (*chip dumping*).
      Hace falta detectar patrones entre jugadores.
- [ ] Revisar a los usuarios contra **listas de sanciones** y personas expuestas políticamente (PEP).
- [ ] Exigir que **los retiros vayan al mismo medio de pago** usado para depositar, cuando sea posible.
- [ ] Conservar los registros (el historial de movimientos `wallet_transactions` y las manos `hands`) durante el plazo legal, normalmente de 5 a 10 años.

## 4. Pagos

- [ ] Muchas pasarelas (Stripe, PayPal, Mercado Pago) **prohíben o restringen el juego con dinero real** sin aprobación previa y licencia.
      Hay que buscar un procesador de pagos que acepte *iGaming*.
- [ ] Definir **retiros**: plazos, comisiones bancarias, verificación previa y montos mínimos.
- [ ] **Fondos de los jugadores separados**: muchas licencias exigen que el dinero de los jugadores esté en cuentas
      separadas de las de la empresa y que nunca se use para operar.
- [ ] Manejo de contracargos y fraude con tarjetas robadas.

## 5. Impuestos

- [ ] Impuestos de la **empresa operadora**: aunque no cobre rake, ¿cómo se va a financiar?
      Si más adelante se cobra comisión, una suscripción o publicidad, cambia el análisis fiscal y regulatorio.
- [ ] **Retenciones a las ganancias de los jugadores**: algunos países obligan al operador a retener y declarar los premios.
- [ ] IVA u otros impuestos sobre las recargas, según el país.

## 6. Integridad del juego

- [ ] **Certificación del generador de números aleatorios (RNG)**: la mayoría de las licencias exige que un laboratorio
      independiente (GLI, eCOGRA, BMM, iTech Labs) audite cómo se baraja. Hoy se usa `crypto.randomInt` (Fisher-Yates) en `app/game/holdem/cards.ts`.
- [ ] Prevenir **colusión** (jugadores que se comparten las cartas), **bots** y **multicuentas**.
- [ ] Reglas del juego públicas y claras, por ejemplo qué pasa si alguien se desconecta en medio de una mano.
- [ ] Proceso de reclamos y disputas, y un historial de manos que el jugador pueda consultar.

## 7. Juego responsable

- [ ] Límites de depósito, de pérdidas y de tiempo de sesión configurables por el jugador.
- [ ] **Autoexclusión** temporal y permanente, y conexión con los registros nacionales de autoexcluidos donde existan.
- [ ] Mensajes de juego responsable y enlaces a líneas de ayuda en cada país.
- [ ] Detección de conductas de riesgo.

## 8. Protección de datos personales

- [ ] Política de privacidad conforme a la ley de cada país: Ley 1581 (Colombia), LFPDPPP (México),
      Ley 25.326 (Argentina), Ley 29733 (Perú), LGPD (Brasil), GDPR (si hay usuarios en la UE).
- [ ] Datos sensibles que se guardan: email, fecha de nacimiento y, en el futuro, documentos de identidad y datos de pago.
      Definir cifrado, cuánto tiempo se conservan, derecho de acceso y de eliminación (en conflicto con la obligación AML de conservar registros).
- [ ] **No guardar datos de tarjetas**: delegarlo al procesador de pagos (cumplimiento PCI-DSS).

## 9. Bloqueo geográfico

- [ ] Bloquear el acceso a las salas USD desde **países no autorizados** (por IP y, si la licencia lo exige, por geolocalización del dispositivo).
- [ ] Detectar el uso de VPN o proxies.

## 10. Tiendas de aplicaciones

- [ ] **Apple App Store:** las apps de juego con dinero real requieren licencia en cada país, deben distribuirse
      solo en esos países, la empresa debe publicarlas a su nombre y deben ser gratuitas para descargar.
- [ ] **Google Play:** tiene un programa específico para apps de juego con dinero real, disponible solo en ciertos países,
      con solicitud previa y licencia.
- [ ] Una alternativa habitual es publicar en las tiendas **solo la versión gratuita (credits)** y ofrecer el juego con dinero real en la **web**.
- [ ] Los "credits" **no deben poder comprarse ni canjearse por dinero**. Si se pudieran, pasarían a considerarse juego con dinero real.

## 11. Documentos legales que hacen falta

- [ ] Términos y condiciones (reglas del juego, conducta, cierre de cuentas, ley aplicable y jurisdicción).
- [ ] Política de privacidad.
- [ ] Política de cookies (versión web).
- [ ] Política AML/KYC.
- [ ] Política de juego responsable.
- [ ] Constitución de la empresa operadora en una jurisdicción adecuada.

---

## Decisiones de diseño ya tomadas que ayudan al cumplimiento

- **Historial de movimientos inmutable** (`wallet_transactions`): cada cambio de saldo queda registrado con el saldo resultante.
- **Historial completo de manos** (`hands`, `hand_players`, `hand_actions`): permite auditar y resolver disputas.
- **Sin comisión (`rake = 0`)**, configurado explícitamente en `config/game.ts`.
- **Los credits no tienen valor monetario**: no se compran, no se canjean y están separados del saldo USD.
- **Las recargas solo se acreditan cuando se confirman**, y confirmarlas dos veces no duplica el saldo (`DepositService.complete`).
- **Fecha de nacimiento obligatoria** al registrarse, con validación de edad mínima (`config/game.ts → minimumAge`).
