import 'models.dart';

int _int(Object? v) => (v as num?)?.toInt() ?? 0;
List<String> _cards(Object? v) => (v as List?)?.cast<String>() ?? const [];

/// Estado de la mesa visto por el jugador (GET /api/v1/rooms/:id/state)
class TableState {
  const TableState({
    required this.room,
    required this.hand,
    required this.seats,
    required this.you,
    required this.lastHand,
    this.chat = const [],
    this.nextHandAt,
  });

  final TableRoom room;
  final HandInfo? hand;
  final List<TableSeat> seats;
  final YouInfo? you;
  final LastHand? lastHand;

  /// Mensajes de chat nuevos desde el último que tenía el cliente (`chatAfter`)
  final List<ChatMessage> chat;

  /// Entre manos: cuándo empieza la siguiente (null si no hay ninguna programada)
  final DateTime? nextHandAt;

  TableSeat? seatOf(int playerId) {
    for (final seat in seats) {
      if (seat.playerId == playerId) return seat;
    }
    return null;
  }

  TableSeat? seatAt(int seatNumber) {
    for (final seat in seats) {
      if (seat.seatNumber == seatNumber) return seat;
    }
    return null;
  }

  factory TableState.fromJson(Json json) => TableState(
    room: TableRoom.fromJson(json['room'] as Json),
    hand: json['hand'] == null ? null : HandInfo.fromJson(json['hand'] as Json),
    seats: (json['seats'] as List).map((s) => TableSeat.fromJson(s as Json)).toList(),
    you: json['you'] == null ? null : YouInfo.fromJson(json['you'] as Json),
    lastHand: json['lastHand'] == null ? null : LastHand.fromJson(json['lastHand'] as Json),
    chat: [for (final m in json['chat'] as List? ?? const []) ChatMessage.fromJson(m as Json)],
    nextHandAt: _nextHandAt(json),
  );
}

/// Hora local de inicio de la siguiente mano. Se prefiere `nextHandInMs` (relativo a la respuesta)
/// para no depender de que el reloj del dispositivo coincida con el del servidor.
DateTime? _nextHandAt(Json json) {
  final ms = json['nextHandInMs'];
  if (ms is num) return DateTime.now().add(Duration(milliseconds: ms.round()));
  final at = json['nextHandAt'];
  return at is String ? DateTime.parse(at).toLocal() : null;
}

/// Mensaje del chat de la mesa
class ChatMessage {
  const ChatMessage({
    required this.id,
    required this.playerId,
    required this.displayName,
    required this.body,
    required this.createdAt,
    this.avatar,
  });

  final int id;
  final int playerId;
  final String displayName;
  final String? avatar;
  final String body;
  final DateTime createdAt;

  factory ChatMessage.fromJson(Json json) => ChatMessage(
    id: _int(json['id']),
    playerId: _int(json['playerId']),
    displayName: json['displayName'] as String,
    avatar: json['avatar'] as String?,
    body: json['body'] as String,
    createdAt: DateTime.parse(json['createdAt'] as String).toLocal(),
  );
}

class TableRoom {
  const TableRoom({
    required this.id,
    required this.name,
    required this.smallBlind,
    required this.bigBlind,
    required this.maxSeats,
    required this.actionTimeoutSeconds,
  });

  final int id;
  final String name;
  final int smallBlind;
  final int bigBlind;
  final int maxSeats;
  final int actionTimeoutSeconds;

  factory TableRoom.fromJson(Json json) => TableRoom(
    id: _int(json['id']),
    name: json['name'] as String,
    smallBlind: _int(json['smallBlind']),
    bigBlind: _int(json['bigBlind']),
    maxSeats: _int(json['maxSeats']),
    actionTimeoutSeconds: _int(json['actionTimeoutSeconds']),
  );
}

class HandInfo {
  const HandInfo({
    required this.id,
    required this.number,
    required this.street,
    required this.board,
    required this.pot,
    required this.currentBet,
    required this.dealerSeat,
    required this.smallBlindSeat,
    required this.bigBlindSeat,
    required this.toActSeat,
    required this.turnDeadline,
  });

  final int id;
  final int number;
  final String street;
  final List<String> board;
  final int pot;
  final int currentBet;
  final int dealerSeat;
  final int smallBlindSeat;
  final int bigBlindSeat;
  final int? toActSeat;
  final DateTime? turnDeadline;

  String get streetLabel => switch (street) {
    'preflop' => 'Pre-flop',
    'flop' => 'Flop',
    'turn' => 'Turn',
    'river' => 'River',
    _ => 'Showdown',
  };

  factory HandInfo.fromJson(Json json) => HandInfo(
    id: _int(json['id']),
    number: _int(json['number']),
    street: json['street'] as String,
    board: _cards(json['board']),
    pot: _int(json['pot']),
    currentBet: _int(json['currentBet']),
    dealerSeat: _int(json['dealerSeat']),
    smallBlindSeat: _int(json['smallBlindSeat']),
    bigBlindSeat: _int(json['bigBlindSeat']),
    toActSeat: (json['toActSeat'] as num?)?.toInt(),
    turnDeadline: json['turnDeadline'] == null ? null : DateTime.parse(json['turnDeadline'] as String).toLocal(),
  );
}

class TableSeat {
  const TableSeat({
    required this.seatNumber,
    required this.playerId,
    required this.displayName,
    required this.stack,
    required this.inHand,
    required this.committed,
    required this.folded,
    required this.allIn,
    required this.isTurn,
    required this.holeCards,
    this.leaving = false,
    this.missedHands = 0,
    this.avatar,
  });

  final int seatNumber;
  final int playerId;
  final String displayName;

  /// Avatar elegido por el jugador; null = genérico al azar
  final String? avatar;
  final int stack;
  final bool inHand;
  final int committed;
  final bool folded;
  final bool allIn;
  final bool isTurn;

  /// Solo trae las cartas del propio jugador (las de los demás son null)
  final List<String>? holeCards;

  /// Pidió levantarse: se retira de la mesa al terminar la mano en curso
  final bool leaving;

  /// Manos seguidas en que se le agotó el tiempo; al llegar al límite el servidor lo levanta
  final int missedHands;

  factory TableSeat.fromJson(Json json) {
    final player = json['player'] as Json;
    return TableSeat(
      seatNumber: _int(json['seatNumber']),
      playerId: _int(player['id']),
      displayName: player['displayName'] as String,
      avatar: player['avatar'] as String?,
      stack: _int(json['stack']),
      inHand: json['inHand'] as bool? ?? false,
      committed: _int(json['committed']),
      folded: json['folded'] as bool? ?? false,
      allIn: json['allIn'] as bool? ?? false,
      isTurn: json['isTurn'] as bool? ?? false,
      holeCards: json['holeCards'] == null ? null : _cards(json['holeCards']),
      leaving: json['leaving'] as bool? ?? false,
      missedHands: _int(json['missedHands'] ?? 0),
    );
  }
}

class BetRange {
  const BetRange(this.min, this.max);
  final int min;
  final int max;

  static BetRange? fromJson(Object? json) =>
      json == null ? null : BetRange(_int((json as Json)['min']), _int(json['max']));
}

class LegalActions {
  const LegalActions({required this.fold, required this.check, this.call, this.bet, this.raise});

  final bool fold;
  final bool check;

  /// Fichas para igualar (null si no hay apuesta que igualar)
  final int? call;

  /// Rango "apostar hasta" / "subir hasta" (total en la calle)
  final BetRange? bet;
  final BetRange? raise;

  factory LegalActions.fromJson(Json json) => LegalActions(
    fold: json['fold'] as bool? ?? false,
    check: json['check'] as bool? ?? false,
    call: (json['call'] as num?)?.toInt(),
    bet: BetRange.fromJson(json['bet']),
    raise: BetRange.fromJson(json['raise']),
  );
}

class YouInfo {
  const YouInfo({required this.seatNumber, required this.holeCards, required this.legalActions});
  final int seatNumber;
  final List<String> holeCards;

  /// null cuando no es tu turno
  final LegalActions? legalActions;

  factory YouInfo.fromJson(Json json) => YouInfo(
    seatNumber: _int(json['seatNumber']),
    holeCards: _cards(json['holeCards']),
    legalActions: json['legalActions'] == null ? null : LegalActions.fromJson(json['legalActions'] as Json),
  );
}

class LastHand {
  const LastHand({
    required this.handId,
    required this.handNumber,
    required this.board,
    required this.showdown,
    required this.totalPot,
    required this.winners,
    required this.players,
    this.yourCards,
    this.canShow = false,
  });

  final int handId;
  final int handNumber;
  final List<String> board;
  final bool showdown;
  final int totalPot;

  /// Ganadores agregados de todos los botes: seatNumber → monto
  final Map<int, int> winners;
  final List<LastHandPlayer> players;

  /// Mis cartas en esa mano (privadas: solo me llegan a mí)
  final List<String>? yourCards;

  /// Puedo enseñarlas voluntariamente (no fueron al showdown y la siguiente mano no empezó)
  final bool canShow;

  /// Cartas que forman las manos ganadoras (para resaltarlas en la mesa)
  Set<String> get winningCards => {
    for (final p in players)
      if (winners.containsKey(p.seatNumber)) ...?p.bestCards,
  };

  factory LastHand.fromJson(Json json) {
    final winners = <int, int>{};
    for (final pot in (json['pots'] as List).cast<Json>()) {
      for (final w in (pot['winners'] as List).cast<Json>()) {
        final seat = _int(w['seatNumber']);
        winners[seat] = (winners[seat] ?? 0) + _int(w['amount']);
      }
    }
    return LastHand(
      handId: _int(json['handId']),
      handNumber: _int(json['handNumber']),
      board: _cards(json['board']),
      showdown: json['showdown'] as bool? ?? false,
      totalPot: _int(json['totalPot']),
      winners: winners,
      players: (json['players'] as List).map((p) => LastHandPlayer.fromJson(p as Json)).toList(),
      yourCards: json['yourCards'] == null ? null : _cards(json['yourCards']),
      canShow: json['canShow'] as bool? ?? false,
    );
  }
}

class LastHandPlayer {
  const LastHandPlayer({
    required this.seatNumber,
    required this.playerId,
    required this.net,
    required this.holeCards,
    required this.handName,
    this.bestCards,
    this.shown = false,
  });

  final int seatNumber;
  final int playerId;
  final int net;

  /// Las 5 cartas de su mejor mano (solo si llegó al showdown)
  final List<String>? bestCards;

  /// De quienes llegaron al showdown o las enseñaron ([shown])
  final List<String>? holeCards;
  final String? handName;

  /// Enseñó sus cartas por voluntad propia al terminar la mano
  final bool shown;

  factory LastHandPlayer.fromJson(Json json) => LastHandPlayer(
    seatNumber: _int(json['seatNumber']),
    playerId: _int(json['playerId']),
    net: _int(json['net']),
    holeCards: json['holeCards'] == null ? null : _cards(json['holeCards']),
    handName: json['handName'] as String?,
    bestCards: json['bestCards'] == null ? null : _cards(json['bestCards']),
    shown: json['shown'] as bool? ?? false,
  );
}
