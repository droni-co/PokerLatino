import 'models.dart';

int _int(Object? v) => (v as num?)?.toInt() ?? 0;
int? _intOrNull(Object? v) => (v as num?)?.toInt();
DateTime? _date(Object? v) => v is String ? DateTime.parse(v).toLocal() : null;

/// Estado de un torneo
enum TournamentStatus {
  registering,
  running,
  finished,
  cancelled;

  static TournamentStatus parse(Object? v) =>
      TournamentStatus.values.firstWhere((s) => s.name == v, orElse: () => TournamentStatus.registering);
}

/// Inscripción del jugador que consulta
class TournamentYou {
  const TournamentYou({required this.status, this.roomId, this.position, this.prize = 0});

  /// registered · playing · eliminated · winner
  final String status;

  /// Mesa en la que juega ahora (null si no está jugando)
  final int? roomId;
  final int? position;
  final int prize;

  bool get isPlaying => status == 'playing';
  bool get isDone => status == 'eliminated' || status == 'winner';

  factory TournamentYou.fromJson(Json json) => TournamentYou(
    status: json['status'] as String,
    roomId: _intOrNull(json['roomId']),
    position: _intOrNull(json['position']),
    prize: _int(json['prize']),
  );
}

/// Torneo (lista del lobby y cabecera del detalle)
class Tournament {
  const Tournament({
    required this.id,
    required this.name,
    required this.status,
    required this.startsAt,
    required this.buyIn,
    required this.startingStack,
    required this.smallBlind,
    required this.bigBlind,
    required this.blindsUpEveryHands,
    required this.maxSeats,
    required this.tableCount,
    required this.capacity,
    required this.entriesCount,
    required this.playersLeft,
    required this.prizePool,
    this.description,
    this.startedAt,
    this.finishedAt,
    this.you,
  });

  final int id;
  final String name;
  final String? description;
  final TournamentStatus status;
  final DateTime startsAt;
  final DateTime? startedAt;
  final DateTime? finishedAt;
  final int buyIn;
  final int startingStack;
  final int smallBlind;
  final int bigBlind;

  /// Las ciegas se duplican cada tantas manos de cada mesa
  final int blindsUpEveryHands;
  final int maxSeats;
  final int tableCount;

  /// Cupo: mesas × asientos. El torneo empieza a su hora si está lleno, o en cuanto se llene
  final int capacity;
  final int entriesCount;
  final int playersLeft;
  final int prizePool;
  final TournamentYou? you;

  bool get isFull => entriesCount >= capacity;
  bool get isRegistered => you != null;

  factory Tournament.fromJson(Json json) => Tournament(
    id: _int(json['id']),
    name: json['name'] as String,
    description: json['description'] as String?,
    status: TournamentStatus.parse(json['status']),
    startsAt: _date(json['startsAt'])!,
    startedAt: _date(json['startedAt']),
    finishedAt: _date(json['finishedAt']),
    buyIn: _int(json['buyIn']),
    startingStack: _int(json['startingStack']),
    smallBlind: _int(json['smallBlind']),
    bigBlind: _int(json['bigBlind']),
    blindsUpEveryHands: _int(json['blindsUpEveryHands']),
    maxSeats: _int(json['maxSeats']),
    tableCount: _int(json['tableCount']),
    capacity: _int(json['capacity']),
    entriesCount: _int(json['entriesCount']),
    playersLeft: _int(json['playersLeft']),
    prizePool: _int(json['prizePool']),
    you: json['you'] == null ? null : TournamentYou.fromJson(json['you'] as Json),
  );
}

/// Una fila de la clasificación
class TournamentStanding {
  const TournamentStanding({
    required this.position,
    required this.status,
    required this.playerId,
    required this.displayName,
    this.avatar,
    this.chips,
    this.tableNumber,
    this.roomId,
    this.prize = 0,
  });

  /// Puesto final (eliminados y campeón) o en vivo por fichas (los que juegan)
  final int? position;
  final String status;
  final int playerId;
  final String displayName;
  final String? avatar;
  final int? chips;
  final int? tableNumber;
  final int? roomId;
  final int prize;

  factory TournamentStanding.fromJson(Json json) {
    final player = json['player'] as Json;
    return TournamentStanding(
      position: _intOrNull(json['position']),
      status: json['status'] as String,
      playerId: _int(player['id']),
      displayName: player['displayName'] as String,
      avatar: player['avatar'] as String?,
      chips: _intOrNull(json['chips']),
      tableNumber: _intOrNull(json['tableNumber']),
      roomId: _intOrNull(json['roomId']),
      prize: _int(json['prize']),
    );
  }
}

/// Detalle: el torneo, los premios por puesto y la clasificación
class TournamentDetail {
  const TournamentDetail({required this.tournament, required this.payouts, required this.standings});

  final Tournament tournament;

  /// Premio de cada puesto pagado (índice 0 = 1.º)
  final List<int> payouts;
  final List<TournamentStanding> standings;

  factory TournamentDetail.fromJson(Json json) => TournamentDetail(
    tournament: Tournament.fromJson(json),
    payouts: [for (final p in json['payouts'] as List? ?? const []) _int((p as Json)['amount'])],
    standings: [for (final s in json['standings'] as List? ?? const []) TournamentStanding.fromJson(s as Json)],
  );
}

/// Información de torneo en la mesa (GET /rooms/:id/state)
class TableTournament {
  const TableTournament({
    required this.id,
    required this.name,
    required this.status,
    required this.level,
    required this.handsToNextLevel,
    required this.nextSmallBlind,
    required this.nextBigBlind,
    required this.playersLeft,
    required this.entrants,
    this.yourRoomId,
    this.yourResult,
  });

  final int id;
  final String name;
  final TournamentStatus status;

  /// Nivel de ciegas (desde 1)
  final int level;

  /// Manos que quedan en este nivel (contando la actual o la próxima)
  final int handsToNextLevel;
  final int nextSmallBlind;
  final int nextBigBlind;
  final int playersLeft;
  final int entrants;

  /// Mesa en la que está sentado ahora (otra si lo movieron; null si ya no juega)
  final int? yourRoomId;

  /// Su resultado si ya terminó (eliminado o campeón)
  final TournamentYou? yourResult;

  factory TableTournament.fromJson(Json json) => TableTournament(
    id: _int(json['id']),
    name: json['name'] as String,
    status: TournamentStatus.parse(json['status']),
    level: _int(json['level']),
    handsToNextLevel: _int(json['handsToNextLevel']),
    nextSmallBlind: _int(json['nextSmallBlind']),
    nextBigBlind: _int(json['nextBigBlind']),
    playersLeft: _int(json['playersLeft']),
    entrants: _int(json['entrants']),
    yourRoomId: _intOrNull(json['yourRoomId']),
    yourResult: json['yourResult'] == null ? null : TournamentYou.fromJson(json['yourResult'] as Json),
  );
}
