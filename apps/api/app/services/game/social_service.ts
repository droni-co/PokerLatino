import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import type { QueryClientContract } from '@adonisjs/lucid/types/database'
import gameConfig from '#config/game'
import User from '#models/user'
import Room from '#models/room'
import RoomSeat from '#models/room_seat'
import Friendship from '#models/friendship'
import TableInvitation from '#models/table_invitation'
import { GameError } from '#exceptions/game_error'
import progressService from '#services/game/progress_service'

/** Lo que otros jugadores ven de ti: nunca el email */
export function publicPlayer(user: Pick<User, 'id' | 'avatar' | 'displayName'>) {
  return { id: user.id, displayName: user.displayName, avatar: user.avatar ?? null }
}

export type Relation = 'none' | 'friend' | 'incoming' | 'outgoing'

/** Escapa los comodines de LIKE en lo que escribe el jugador */
const likePrefix = (text: string) => `${text.replaceAll(/[\\%_]/g, (c) => `\\${c}`)}%`

/** Violación de un índice único (dos solicitudes cruzadas al mismo tiempo) */
const isUniqueViolation = (error: unknown) => (error as { code?: string })?.code === '23505'

/**
 * Amigos e invitaciones a la mesa.
 *
 * Una amistad es una fila por pareja: `pending` mientras la solicitud espera respuesta y
 * `accepted` al aceptarla. Rechazar, cancelar o eliminar borra la fila. Si te llega una
 * solicitud de alguien a quien tú también se la ibas a enviar, se aceptan las dos.
 *
 * "Conectado" sale de la propia app: consulta su buzón cada pocos segundos (y la mesa
 * cada segundo); quien no lo hizo en `onlineSeconds` aparece desconectado. Vive en memoria,
 * como la presencia en las mesas (un solo proceso de servidor).
 */
export class SocialService {
  private lastSeen = new Map<number, number>()

  /** El jugador está usando la app */
  touch(userId: number, now = Date.now()) {
    this.lastSeen.set(userId, now)
  }

  isOnline(userId: number, now = Date.now()) {
    const last = this.lastSeen.get(userId)
    return last !== undefined && now - last < gameConfig.social.onlineSeconds * 1000
  }

  private pairQuery(a: number, b: number, client?: QueryClientContract) {
    return Friendship.query({ client }).where((q) =>
      q
        .where((w) => w.where('requester_id', a).where('addressee_id', b))
        .orWhere((w) => w.where('requester_id', b).where('addressee_id', a))
    )
  }

  /** Relación de `userId` con otro jugador, con el id de la solicitud si está pendiente */
  async relation(userId: number, otherId: number) {
    const row = await this.pairQuery(userId, otherId).first()
    return {
      status: this.relationOf(row, userId),
      requestId: row?.status === 'pending' ? row.id : null,
    }
  }

  async areFriends(a: number, b: number) {
    const row = await this.pairQuery(a, b).where('status', 'accepted').first()
    return row !== null
  }

  /**
   * Buscar jugadores por nombre de usuario (empieza por…) con tu relación con cada uno
   */
  async search(userId: number, text: string) {
    const users = await User.query()
      .whereNotNull('username')
      .whereNot('id', userId)
      .whereILike('username', likePrefix(text.trim()))
      .orderByRaw('length(username), username')
      .limit(20)
    if (users.length === 0) return []

    const ids = users.map((u) => u.id)
    const rows = await Friendship.query().where((q) =>
      q
        .where((w) => w.where('requester_id', userId).whereIn('addressee_id', ids))
        .orWhere((w) => w.where('addressee_id', userId).whereIn('requester_id', ids))
    )
    return users.map((u) => {
      const row = rows.find((r) => r.otherId(userId) === u.id)
      return {
        player: publicPlayer(u),
        relation: this.relationOf(row, userId),
        requestId: row?.status === 'pending' ? row.id : null,
      }
    })
  }

  private relationOf(row: Friendship | undefined | null, userId: number): Relation {
    if (!row) return 'none'
    if (row.status === 'accepted') return 'friend'
    return row.requesterId === userId ? 'outgoing' : 'incoming'
  }

  /**
   * Enviar una solicitud de amistad. Si el otro ya te la había enviado, quedan como amigos.
   */
  async request(user: User, targetId: number) {
    if (targetId === user.id) {
      throw new GameError('invalid_friend_request', 'No puedes enviarte una solicitud a ti mismo')
    }
    const target = await User.find(targetId)
    if (!target) throw new GameError('player_not_found', 'Ese jugador no existe')

    const result = await db.transaction(async (trx) => {
      const existing = await this.pairQuery(user.id, targetId, trx).forUpdate().first()
      if (existing?.status === 'accepted') {
        throw new GameError('already_friends', `${target.displayName} ya es tu amigo`)
      }
      if (existing && existing.requesterId === user.id) {
        throw new GameError('friend_request_exists', 'Ya le enviaste una solicitud')
      }
      if (existing) {
        // Te la había enviado él: aceptarla
        await this.ensureRoom(user.id, trx)
        existing.useTransaction(trx)
        existing.status = 'accepted'
        existing.acceptedAt = DateTime.now()
        await existing.save()
        return { relation: 'friend' as Relation, requestId: null }
      }

      await this.ensureRoom(user.id, trx)
      const pending = await Friendship.query({ client: trx })
        .where('requester_id', user.id)
        .where('status', 'pending')
        .count('* as total')
      if (Number(pending[0].$extras.total) >= gameConfig.social.maxPendingRequests) {
        throw new GameError(
          'friend_limit',
          'Tienes demasiadas solicitudes sin responder. Espera a que te contesten.'
        )
      }

      try {
        const row = await Friendship.create(
          { requesterId: user.id, addresseeId: targetId, status: 'pending' },
          { client: trx }
        )
        return { relation: 'outgoing' as Relation, requestId: row.id }
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new GameError('friend_request_exists', 'Ya hay una solicitud entre ustedes')
        }
        throw error
      }
    })
    // Se aceptó una solicitud cruzada: logros de amigos para los dos
    if (result.relation === 'friend') await progressService.evaluateQuietly(user.id, targetId)
    return result
  }

  /** Lanza `friend_limit` si el jugador ya tiene el máximo de amigos */
  private async ensureRoom(userId: number, client: QueryClientContract) {
    const friends = await Friendship.query({ client })
      .where('status', 'accepted')
      .where((q) => q.where('requester_id', userId).orWhere('addressee_id', userId))
      .count('* as total')
    if (Number(friends[0].$extras.total) >= gameConfig.social.maxFriends) {
      throw new GameError(
        'friend_limit',
        `Llegaste al máximo de ${gameConfig.social.maxFriends} amigos`
      )
    }
  }

  /** Aceptar una solicitud recibida */
  async accept(user: User, requestId: number) {
    return db
      .transaction(async (trx) => {
        const row = await Friendship.query({ client: trx })
          .where('id', requestId)
          .where('addressee_id', user.id)
          .where('status', 'pending')
          .forUpdate()
          .first()
        if (!row) throw new GameError('friend_request_not_found', 'La solicitud ya no existe')
        await this.ensureRoom(user.id, trx)
        row.status = 'accepted'
        row.acceptedAt = DateTime.now()
        await row.useTransaction(trx).save()
        return row
      })
      .then(async (row) => {
        // Logros de amigos ("Buena compañía"…) para los dos
        await progressService.evaluateQuietly(row.requesterId, row.addresseeId)
        return row
      })
  }

  /** Rechazar una solicitud recibida o cancelar una enviada */
  async dismiss(user: User, requestId: number) {
    const row = await Friendship.query()
      .where('id', requestId)
      .where('status', 'pending')
      .where((q) => q.where('addressee_id', user.id).orWhere('requester_id', user.id))
      .first()
    if (!row) throw new GameError('friend_request_not_found', 'La solicitud ya no existe')
    await row.delete()
  }

  /** Dejar de ser amigos */
  async remove(user: User, friendId: number) {
    const row = await this.pairQuery(user.id, friendId).where('status', 'accepted').first()
    if (!row) throw new GameError('not_friends', 'Ese jugador no está en tus amigos')
    await row.delete()
    // Sus invitaciones pendientes entre ellos dejan de valer
    await TableInvitation.query()
      .where('status', 'pending')
      .where((q) =>
        q
          .where((w) => w.where('sender_id', user.id).where('recipient_id', friendId))
          .orWhere((w) => w.where('sender_id', friendId).where('recipient_id', user.id))
      )
      .update({ status: 'declined' })
  }

  /**
   * Tus amigos (conectados primero, con la mesa normal en la que están sentados) y las
   * solicitudes recibidas y enviadas. Con `roomId`, marca a quién ya invitaste a esa mesa.
   */
  async friends(user: User, options: { roomId?: number } = {}, now = DateTime.now()) {
    const rows = await Friendship.query()
      .where((q) => q.where('requester_id', user.id).orWhere('addressee_id', user.id))
      .preload('requester')
      .preload('addressee')
      .orderBy('created_at', 'desc')

    const other = (row: Friendship) => (row.requesterId === user.id ? row.addressee : row.requester)
    const accepted = rows.filter((r) => r.status === 'accepted')
    const friendIds = accepted.map((r) => r.otherId(user.id))

    const seats =
      friendIds.length === 0
        ? []
        : await RoomSeat.query()
            .whereIn('user_id', friendIds)
            .preload('room', (q) => q.withCount('seats', (s) => s.as('seatedCount')))
    const invited = new Set<number>()
    if (options.roomId && friendIds.length > 0) {
      const pending = await TableInvitation.query()
        .where('room_id', options.roomId)
        .where('sender_id', user.id)
        .where('status', 'pending')
        .where('expires_at', '>', now.toSQL()!)
        .select('recipient_id')
      for (const p of pending) invited.add(p.recipientId)
    }

    const nowMs = now.toMillis()
    const friends = accepted.map((row) => {
      const friend = other(row)
      const seat = seats.find((s) => s.userId === friend.id)
      const room = seat?.room
      return {
        player: publicPlayer(friend),
        online: this.isOnline(friend.id, nowMs),
        since: row.acceptedAt?.toISO() ?? row.createdAt.toISO(),
        // Solo las mesas normales: a las de torneo no se puede entrar
        table:
          room && room.tournamentId === null
            ? {
                roomId: room.id,
                name: room.name,
                smallBlind: room.smallBlind,
                bigBlind: room.bigBlind,
                freeSeats: Math.max(0, room.maxSeats - Number(room.$extras.seatedCount ?? 0)),
              }
            : null,
        inTournament: room ? room.tournamentId !== null : false,
        invitedHere: invited.has(friend.id),
      }
    })
    friends.sort(
      (a, b) =>
        Number(b.online) - Number(a.online) ||
        a.player.displayName.localeCompare(b.player.displayName, 'es')
    )

    const request = (row: Friendship) => ({
      id: row.id,
      player: publicPlayer(other(row)),
      createdAt: row.createdAt.toISO(),
    })
    return {
      friends,
      incoming: rows
        .filter((r) => r.status === 'pending' && r.addresseeId === user.id)
        .map(request),
      outgoing: rows
        .filter((r) => r.status === 'pending' && r.requesterId === user.id)
        .map(request),
    }
  }

  /**
   * Invitar a un amigo a la mesa donde estás sentado (tiene que quedar algún asiento libre)
   */
  async invite(sender: User, roomId: number, recipientId: number, now = DateTime.now()) {
    const room = await Room.query()
      .where('id', roomId)
      .withCount('seats', (q) => q.as('seatedCount'))
      .first()
    if (!room) throw new GameError('room_not_found', 'La sala no existe')
    if (room.tournamentId !== null) {
      throw new GameError('tournament_table', 'A las mesas de torneo no se puede invitar')
    }
    if (room.status !== 'active') throw new GameError('room_not_active', 'La mesa está cerrada')

    const seats = await RoomSeat.query().where('room_id', roomId).select('user_id')
    if (!seats.some((s) => s.userId === sender.id)) {
      throw new GameError('not_seated', 'Siéntate en la mesa para invitar a tus amigos')
    }
    if (seats.some((s) => s.userId === recipientId)) {
      throw new GameError('already_seated', 'Tu amigo ya está sentado en esta mesa')
    }
    if (seats.length >= room.maxSeats) {
      throw new GameError('room_full', 'La mesa está llena: no quedan asientos libres')
    }
    if (!(await this.areFriends(sender.id, recipientId))) {
      throw new GameError('not_friends', 'Solo puedes invitar a tus amigos')
    }

    const existing = await TableInvitation.query()
      .where('room_id', roomId)
      .where('sender_id', sender.id)
      .where('recipient_id', recipientId)
      .where('status', 'pending')
      .where('expires_at', '>', now.toSQL()!)
      .first()
    if (existing) throw new GameError('already_invited', 'Ya lo invitaste: espera su respuesta')

    return TableInvitation.create({
      roomId,
      senderId: sender.id,
      recipientId,
      status: 'pending',
      expiresAt: now.plus({ minutes: gameConfig.social.invitationMinutes }),
    })
  }

  /**
   * Buzón: lo que la app consulta cada pocos segundos en cualquier pantalla.
   * Solicitudes de amistad sin responder e invitaciones a mesas que siguen teniendo sitio.
   */
  async inbox(user: User, now = DateTime.now()) {
    this.touch(user.id, now.toMillis())

    const requests = await Friendship.query()
      .where('addressee_id', user.id)
      .where('status', 'pending')
      .count('* as total')

    const pending = await TableInvitation.query()
      .where('recipient_id', user.id)
      .where('status', 'pending')
      .where('expires_at', '>', now.toSQL()!)
      .preload('sender')
      .preload('room', (q) => q.withCount('seats', (s) => s.as('seatedCount')))
      .orderBy('created_at', 'desc')

    const mySeats = await RoomSeat.query().where('user_id', user.id).select('room_id')
    const seatedAt = new Set(mySeats.map((s) => s.roomId))
    const seen = new Set<number>()

    const invitations = pending
      .filter((inv) => {
        const room = inv.room
        const free = room.maxSeats - Number(room.$extras.seatedCount ?? 0)
        // Una por mesa, solo si sigue abierta, con sitio y no estás ya sentado ahí
        if (room.status !== 'active' || free <= 0 || seatedAt.has(room.id) || seen.has(room.id)) {
          return false
        }
        seen.add(room.id)
        return true
      })
      .map((inv) => ({
        id: inv.id,
        from: publicPlayer(inv.sender),
        room: {
          id: inv.room.id,
          name: inv.room.name,
          smallBlind: inv.room.smallBlind,
          bigBlind: inv.room.bigBlind,
          minBuyIn: inv.room.minBuyIn,
          freeSeats: inv.room.maxSeats - Number(inv.room.$extras.seatedCount ?? 0),
        },
        createdAt: inv.createdAt.toISO(),
        expiresAt: inv.expiresAt.toISO(),
      }))

    return {
      friendRequests: Number(requests[0].$extras.total),
      invitations,
      // Logros y subida de nivel que la app aún no anunció
      progress: await progressService.news(user.id),
    }
  }

  /** Responder una invitación a la mesa. Al aceptarla devuelve la mesa a la que ir. */
  async respond(user: User, invitationId: number, accept: boolean, now = DateTime.now()) {
    const invitation = await TableInvitation.query()
      .where('id', invitationId)
      .where('recipient_id', user.id)
      .first()
    if (!invitation || invitation.status !== 'pending') {
      throw new GameError('invitation_not_found', 'La invitación ya no existe')
    }
    if (accept && invitation.expiresAt <= now) {
      throw new GameError('invitation_expired', 'La invitación caducó')
    }
    invitation.status = accept ? 'accepted' : 'declined'
    await invitation.save()

    // Las demás invitaciones a esa misma mesa quedan respondidas también
    await TableInvitation.query()
      .where('recipient_id', user.id)
      .where('room_id', invitation.roomId)
      .where('status', 'pending')
      .update({ status: invitation.status })

    return { roomId: invitation.roomId }
  }

  /** Solo tests */
  reset() {
    this.lastSeen.clear()
  }
}

export default new SocialService()
