/**
 * Configuración general del juego.
 *
 * Poker Latino es un juego, no un casino: la única moneda son las **fichas**, que no se
 * compran ni se canjean por dinero real. Los montos son enteros (1 = 1 ficha).
 */

const gameConfig = {
  /**
   * Edad mínima para registrarse
   */
  minimumAge: 18,

  /**
   * Fichas que recibe cada jugador al registrarse
   */
  signupBonus: 1000,

  /**
   * Juego entre jugadores, sin comisión de la casa: el 100% del pozo va al ganador.
   * Se deja explícito para que ningún cálculo de pozo lo olvide.
   */
  rake: 0,

  /**
   * Valores por defecto de las salas
   */
  rooms: {
    maxSeats: 5,
    actionTimeoutSeconds: 15,
    gameTypes: ['texas_holdem'] as const,
    bettingStructures: ['no_limit'] as const,

    /**
     * Mesas automáticas: cada nivel (categoría) abre otra mesa cuando se llena y cierra
     * las mesas extra que se quedan vacías.
     */
    autoTables: {
      /** Mesas que cada nivel mantiene abiertas siempre, aunque estén vacías */
      minTablesPerLevel: 1,
      /** Límite de mesas abiertas por nivel */
      maxTablesPerLevel: 20,
      /** Si los asientos libres de todo el nivel bajan de este número, se abre otra mesa */
      minFreeSeats: 2,
      /** Una mesa extra se cierra tras este tiempo sin nadie sentado */
      closeEmptyAfterMinutes: 5,
      /** Cada cuánto se revisan las mesas vacías */
      sweepIntervalSeconds: 60,
    },
  },

  /**
   * Ritmo de las mesas
   */
  table: {
    /** Pausa entre el final de una mano y el inicio de la siguiente */
    nextHandDelayMs: 12_000,
    /** Al sentarse alguien en una mesa parada: arranque rápido */
    firstHandDelayMs: 3000,
    /**
     * Manos seguidas en que al jugador se le agota el tiempo sin actuar antes de
     * levantarlo de la mesa (sus fichas vuelven a la billetera).
     */
    maxInactiveHands: 2,
    /**
     * Presencia: la app consulta el estado de la mesa cada segundo. Si un jugador sentado
     * pasa este tiempo sin consultarla (cerró la app o la pestaña, se quedó sin conexión,
     * la dejó en segundo plano), se le levanta de la mesa como si lo hubiera pedido.
     */
    disconnectTimeoutSeconds: 20,
    /** Cada cuánto se buscan jugadores desconectados */
    presenceSweepSeconds: 5,
  },

  /**
   * Jugadores de la casa (bots): para que nadie se encuentre las mesas vacías.
   *
   * - En la primera mesa de cada nivel hay siempre un bot esperando, aunque no haya nadie.
   * - En cualquier mesa con un solo jugador real se sienta un bot para jugar con él.
   * - Cuando hay al menos 2 jugadores reales, el bot termina la mano y se levanta.
   * - Antes de cada mano recarga su stack hasta el buy-in máximo de la mesa.
   * - En las mesas se muestran como bots (`isBot`). No juegan torneos.
   */
  bots: {
    enabled: true,
    /** Cada cuánto se revisa qué mesas necesitan un bot (además de al sentarse alguien) */
    syncIntervalSeconds: 3,
    /** Jugadores reales a partir de los cuales el bot se retira */
    leaveWhenHumans: 2,
    /** Tiempo que "piensa" antes de actuar (aleatorio entre ambos) */
    thinkMs: { min: 1200, max: 3500 },
    /** Simulaciones Monte Carlo por decisión (más = juega mejor, cuesta más CPU) */
    iterations: 1500,
    /** Nombres de los bots (se crean según hagan falta; si un nombre está cogido, se numera) */
    names: [
      'Pancho',
      'Lupita',
      'DonRamon',
      'LaChula',
      'Chuy',
      'Paquita',
      'Memo',
      'Nacho',
      'Chela',
      'Beto',
      'Toña',
      'Güero',
      'Rocío',
      'Chato',
      'Fermín',
      'Yoli',
    ],
  },

  /**
   * Torneos (se crean en la base de datos; cada uno define inscripción, stack, ciegas,
   * cada cuántas manos se duplican, asientos por mesa y número de mesas)
   */
  tournaments: {
    /** Cada cuánto se revisan los torneos: arrancar los que toca, eliminar, balancear mesas */
    tickSeconds: 5,
    /** Pausa entre que arranca el torneo y la primera mano (para que todos lleguen a su mesa) */
    firstHandDelayMs: 10_000,
    /** Torneos terminados o cancelados que se siguen listando (horas) */
    listFinishedForHours: 24,
    /**
     * Premios según inscritos (porcentaje del bote por puesto; sin comisión).
     * Se usa la primera fila cuyo `upTo` sea >= número de inscritos. Cobra ~15-20%.
     */
    payouts: [
      { upTo: 3, percents: [100] },
      { upTo: 9, percents: [65, 35] },
      { upTo: 18, percents: [50, 30, 20] },
      { upTo: 27, percents: [40, 25, 15, 12, 8] },
      { upTo: 45, percents: [33, 22, 15, 11, 8, 6, 5] },
      { upTo: Number.POSITIVE_INFINITY, percents: [30, 20, 13, 9, 7, 6, 5, 4, 3, 3] },
    ],
  },

  /**
   * Referidos: cada jugador tiene un enlace de invitación (/r/CODIGO). Cuando alguien crea
   * su cuenta con él, ambos reciben fichas.
   */
  referrals: {
    /** Fichas para quien invita */
    referrerReward: 500,
    /** Fichas extra para el invitado (además de las de bienvenida) */
    referredReward: 500,
    /** Invitaciones pagadas por jugador en 24 h (las siguientes se registran sin pago al que invita) */
    maxRewardedPerDay: 5,
    /** Cuentas premiadas desde una misma IP en 24 h (más allá, nadie cobra: posible abuso) */
    maxPerIpPerDay: 2,
    /** Cuánto se recuerda el enlace en el navegador del invitado */
    cookieDays: 30,
  },

  /**
   * Rescate: fichas gratis una vez cada 24 h si no alcanzan para la mesa más barata
   * (saldo + fichas sentadas en mesas normales)
   */
  rescue: {
    amount: 400,
    cooldownHours: 24,
  },

  /**
   * Experiencia y niveles (los logros están en app/game/achievements.ts)
   */
  progress: {
    /** XP por cada mano jugada (también en torneos) */
    xpPerHand: 2,
    /** XP extra por ganarla */
    xpPerWin: 3,
    /** Fichas al llegar a un nivel: nivel × esto (nivel 5 → 500) */
    levelRewardPerLevel: 100,
  },

  /**
   * Amigos e invitaciones a la mesa
   */
  social: {
    /** Amigos por jugador */
    maxFriends: 200,
    /** Solicitudes enviadas sin responder (evita el spam de solicitudes) */
    maxPendingRequests: 30,
    /** Una invitación a la mesa caduca tras estos minutos */
    invitationMinutes: 5,
    /** Conectado = usó la app en estos últimos segundos (la app consulta su buzón cada 10 s) */
    onlineSeconds: 45,
  },

  /**
   * Chat de las mesas
   */
  chat: {
    maxLength: 200,
    /** Mensajes que devuelve el historial (y el estado de la mesa sin `chatAfter`) */
    historySize: 50,
    /** Antispam: como máximo `burstLimit` mensajes cada `burstSeconds` segundos */
    burstLimit: 5,
    burstSeconds: 10,
    retentionDays: 3,
  },

  /**
   * Avatares que un jugador puede elegir en su perfil (ids; la app tiene las imágenes en
   * `assets/game/avatars/<id>.png` y `assets/game/avatars/personajes/<id>.png`).
   * Sin avatar elegido, la app asigna uno de los genéricos al azar (estable por jugador).
   */
  avatars: {
    generic: [
      'jaguar',
      'tucan',
      'ajolote',
      'quetzal',
      'condor',
      'colibri',
      'gallo',
      'llama',
      'iguana',
      'armadillo',
      'capibara',
      'toro',
      'lobo',
      'perezoso',
      'guacamaya',
      'mono',
    ],
    characters: [
      'caballero',
      'rosa',
      'luchador',
      'abuela',
      'galan',
      'mariachi',
      'patron',
      'trenzas',
      'catrina',
    ],
  },

  /**
   * Nombre de usuario: 3 a 20 letras (con acentos), números, punto, guion o guion bajo
   */
  username: { minLength: 3, maxLength: 20, pattern: /^[\p{L}\p{N}._-]+$/u },
}

export const AVATARS = [...gameConfig.avatars.generic, ...gameConfig.avatars.characters]

export default gameConfig
