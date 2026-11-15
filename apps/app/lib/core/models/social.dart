import 'models.dart';
import 'progress.dart';

int _int(Object? v) => (v as num?)?.toInt() ?? 0;
DateTime? _date(Object? v) => v is String ? DateTime.parse(v).toLocal() : null;

/// Lo que se ve de otro jugador (nunca su email)
class PlayerRef {
  const PlayerRef({required this.id, required this.displayName, this.avatar});
  final int id;
  final String displayName;
  final String? avatar;

  factory PlayerRef.fromJson(Json json) =>
      PlayerRef(id: _int(json['id']), displayName: json['displayName'] as String, avatar: json['avatar'] as String?);
}

/// Relación con otro jugador
enum Relation {
  none,
  friend,

  /// Te envió una solicitud
  incoming,

  /// Le enviaste una solicitud
  outgoing;

  static Relation parse(Object? v) => switch (v) {
    'friend' => friend,
    'incoming' => incoming,
    'outgoing' => outgoing,
    _ => none,
  };
}

/// Mesa normal en la que está sentado un amigo
class FriendTable {
  const FriendTable({
    required this.roomId,
    required this.name,
    required this.smallBlind,
    required this.bigBlind,
    required this.freeSeats,
  });
  final int roomId;
  final String name;
  final int smallBlind;
  final int bigBlind;
  final int freeSeats;

  factory FriendTable.fromJson(Json json) => FriendTable(
    roomId: _int(json['roomId']),
    name: json['name'] as String,
    smallBlind: _int(json['smallBlind']),
    bigBlind: _int(json['bigBlind']),
    freeSeats: _int(json['freeSeats']),
  );
}

class Friend {
  const Friend({
    required this.player,
    required this.online,
    this.table,
    this.inTournament = false,
    this.invitedHere = false,
  });
  final PlayerRef player;
  final bool online;
  final FriendTable? table;
  final bool inTournament;

  /// Ya lo invitaste a la mesa consultada (`roomId`)
  final bool invitedHere;

  factory Friend.fromJson(Json json) => Friend(
    player: PlayerRef.fromJson(json['player'] as Json),
    online: json['online'] == true,
    table: json['table'] == null ? null : FriendTable.fromJson(json['table'] as Json),
    inTournament: json['inTournament'] == true,
    invitedHere: json['invitedHere'] == true,
  );
}

class FriendRequest {
  const FriendRequest({required this.id, required this.player, this.createdAt});
  final int id;
  final PlayerRef player;
  final DateTime? createdAt;

  factory FriendRequest.fromJson(Json json) => FriendRequest(
    id: _int(json['id']),
    player: PlayerRef.fromJson(json['player'] as Json),
    createdAt: _date(json['createdAt']),
  );
}

/// GET /api/v1/friends
class FriendsList {
  const FriendsList({this.friends = const [], this.incoming = const [], this.outgoing = const []});
  final List<Friend> friends;
  final List<FriendRequest> incoming;
  final List<FriendRequest> outgoing;

  /// Relación con un jugador según esta lista
  Relation relationWith(int playerId) {
    if (friends.any((f) => f.player.id == playerId)) return Relation.friend;
    if (incoming.any((r) => r.player.id == playerId)) return Relation.incoming;
    if (outgoing.any((r) => r.player.id == playerId)) return Relation.outgoing;
    return Relation.none;
  }

  factory FriendsList.fromJson(Json json) => FriendsList(
    friends: [for (final f in json['friends'] as List? ?? const []) Friend.fromJson(f as Json)],
    incoming: [for (final r in json['incoming'] as List? ?? const []) FriendRequest.fromJson(r as Json)],
    outgoing: [for (final r in json['outgoing'] as List? ?? const []) FriendRequest.fromJson(r as Json)],
  );
}

/// Resultado de buscar jugadores
class PlayerSearchResult {
  const PlayerSearchResult({required this.player, required this.relation, this.requestId});
  final PlayerRef player;
  final Relation relation;
  final int? requestId;

  factory PlayerSearchResult.fromJson(Json json) => PlayerSearchResult(
    player: PlayerRef.fromJson(json['player'] as Json),
    relation: Relation.parse(json['relation']),
    requestId: (json['requestId'] as num?)?.toInt(),
  );
}

/// Un amigo te invita a su mesa
class TableInvitation {
  const TableInvitation({
    required this.id,
    required this.from,
    required this.roomId,
    required this.roomName,
    required this.smallBlind,
    required this.bigBlind,
    required this.minBuyIn,
    required this.freeSeats,
    this.expiresAt,
  });
  final int id;
  final PlayerRef from;
  final int roomId;
  final String roomName;
  final int smallBlind;
  final int bigBlind;
  final int minBuyIn;
  final int freeSeats;
  final DateTime? expiresAt;

  factory TableInvitation.fromJson(Json json) {
    final room = json['room'] as Json;
    return TableInvitation(
      id: _int(json['id']),
      from: PlayerRef.fromJson(json['from'] as Json),
      roomId: _int(room['id']),
      roomName: room['name'] as String,
      smallBlind: _int(room['smallBlind']),
      bigBlind: _int(room['bigBlind']),
      minBuyIn: _int(room['minBuyIn']),
      freeSeats: _int(room['freeSeats']),
      expiresAt: _date(json['expiresAt']),
    );
  }
}

/// GET /api/v1/inbox: lo que la app consulta cada pocos segundos
class Inbox {
  const Inbox({this.friendRequests = 0, this.invitations = const [], this.progress = const ProgressNews()});
  final int friendRequests;
  final List<TableInvitation> invitations;

  /// Logros y nivel que la app aún no anunció
  final ProgressNews progress;

  factory Inbox.fromJson(Json json) => Inbox(
    friendRequests: _int(json['friendRequests']),
    invitations: [for (final i in json['invitations'] as List? ?? const []) TableInvitation.fromJson(i as Json)],
    progress: json['progress'] == null ? const ProgressNews() : ProgressNews.fromJson(json['progress'] as Json),
  );
}
