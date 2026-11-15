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
    nextHandDelayMs: 15_000,
    /** Al sentarse alguien en una mesa parada: arranque rápido */
    firstHandDelayMs: 3000,
    /**
     * Manos seguidas en que al jugador se le agota el tiempo sin actuar antes de
     * levantarlo de la mesa (sus fichas vuelven a la billetera).
     */
    maxInactiveHands: 2,
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
