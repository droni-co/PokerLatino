import '../money.dart';

typedef Json = Map<String, dynamic>;

int _int(Object? v) => (v as num?)?.toInt() ?? 0;

class Me {
  const Me({
    required this.id,
    required this.email,
    this.username,
    String? displayName,
    this.avatar,
  }) : displayName = displayName ?? username ?? 'Jugador #$id';

  final int id;
  final String email;

  /// Nombre de usuario elegido (null en cuentas anteriores a este campo)
  final String? username;

  /// Nombre que ven los demás: el nombre de usuario o "Jugador #id"
  final String displayName;

  /// Id del avatar elegido; null = avatar genérico asignado al azar
  final String? avatar;

  factory Me.fromJson(Json json) => Me(
        id: _int(json['id']),
        email: json['email'] as String,
        username: json['username'] as String?,
        displayName: json['displayName'] as String?,
        avatar: json['avatar'] as String?,
      );
}

class GameConfig {
  const GameConfig({required this.signupBonus, required this.rake, required this.maxSeats});

  /// Fichas de bienvenida
  final int signupBonus;
  final int rake;
  final int maxSeats;

  factory GameConfig.fromJson(Json json) => GameConfig(
        signupBonus: _int(json['signupBonus']),
        rake: _int(json['rake']),
        maxSeats: _int((json['rooms'] as Json)['maxSeats']),
      );
}

/// Billetera de fichas (solo para jugar: no se compran ni se canjean)
class Wallet {
  const Wallet({required this.balance});
  final int balance;

  factory Wallet.fromJson(Json json) => Wallet(balance: _int(json['balance']));
}

class WalletTransaction {
  const WalletTransaction({
    required this.id,
    required this.type,
    required this.amount,
    required this.balanceAfter,
    required this.description,
    required this.createdAt,
  });

  final int id;
  final String type;
  final int amount;
  final int balanceAfter;
  final String? description;
  final DateTime createdAt;

  String get label => switch (type) {
        'signup_bonus' => 'Fichas de bienvenida',
        'buy_in' => 'Entrada a mesa',
        'cash_out' => 'Salida de mesa',
        'adjustment' => 'Ajuste',
        'tournament_entry' => 'Inscripción a torneo',
        'tournament_refund' => 'Reembolso de torneo',
        'tournament_prize' => 'Premio de torneo',
        'referral_reward' => 'Invitaste a un amigo',
        'referral_bonus' => 'Bono de invitación',
        'rescue' => 'Rescate diario',
        _ => type,
      };

  factory WalletTransaction.fromJson(Json json) => WalletTransaction(
        id: _int(json['id']),
        type: json['type'] as String,
        amount: _int(json['amount']),
        balanceAfter: _int(json['balanceAfter']),
        description: json['description'] as String?,
        createdAt: DateTime.parse(json['createdAt'] as String).toLocal(),
      );
}

class Paginated<T> {
  const Paginated({required this.items, required this.currentPage, required this.lastPage});
  final List<T> items;
  final int currentPage;
  final int lastPage;
  bool get hasMore => currentPage < lastPage;
}

class Room {
  const Room({
    required this.id,
    required this.name,
    required this.maxSeats,
    required this.smallBlind,
    required this.bigBlind,
    required this.minBuyIn,
    required this.maxBuyIn,
    required this.actionTimeoutSeconds,
    required this.seatedCount,
  });

  final int id;
  final String name;
  final int maxSeats;
  final int smallBlind;
  final int bigBlind;
  final int minBuyIn;
  final int maxBuyIn;
  final int actionTimeoutSeconds;
  final int seatedCount;

  bool get isFull => seatedCount >= maxSeats;

  String get blindsLabel =>
      '${formatChips(smallBlind)} / ${formatChips(bigBlind)}';

  factory Room.fromJson(Json json) => Room(
        id: _int(json['id']),
        name: json['name'] as String,
        maxSeats: _int(json['maxSeats']),
        smallBlind: _int(json['smallBlind']),
        bigBlind: _int(json['bigBlind']),
        minBuyIn: _int(json['minBuyIn']),
        maxBuyIn: _int(json['maxBuyIn']),
        actionTimeoutSeconds: _int(json['actionTimeoutSeconds']),
        seatedCount: _int(json['seatedCount']),
      );
}

class PlayerStat {
  const PlayerStat({
    required this.handsPlayed,
    required this.handsWon,
    required this.winRate,
    required this.showdownsReached,
    required this.totalWagered,
    required this.totalWon,
    required this.net,
    required this.biggestPotWon,
  });

  final int handsPlayed;
  final int handsWon;
  final double winRate;
  final int showdownsReached;
  final int totalWagered;
  final int totalWon;
  final int net;
  final int biggestPotWon;

  factory PlayerStat.fromJson(Json json) => PlayerStat(
        handsPlayed: _int(json['handsPlayed']),
        handsWon: _int(json['handsWon']),
        winRate: (json['winRate'] as num?)?.toDouble() ?? 0,
        showdownsReached: _int(json['showdownsReached']),
        totalWagered: _int(json['totalWagered']),
        totalWon: _int(json['totalWon']),
        net: _int(json['net']),
        biggestPotWon: _int(json['biggestPotWon']),
      );
}

/// Nivel (categoría) de sala: el servidor abre y cierra mesas según los jugadores
class RoomLevel {
  const RoomLevel({
    required this.id,
    required this.name,
    required this.smallBlind,
    required this.bigBlind,
    required this.minBuyIn,
    required this.maxBuyIn,
    required this.maxSeats,
    required this.playerCount,
    required this.tables,
  });

  final int id;
  final String name;
  final int smallBlind;
  final int bigBlind;
  final int minBuyIn;
  final int maxBuyIn;
  final int maxSeats;
  final int playerCount;
  final List<LevelTable> tables;

  String get blindsLabel => '${formatChips(smallBlind)} / ${formatChips(bigBlind)}';

  factory RoomLevel.fromJson(Json json) => RoomLevel(
        id: _int(json['id']),
        name: json['name'] as String,
        smallBlind: _int(json['smallBlind']),
        bigBlind: _int(json['bigBlind']),
        minBuyIn: _int(json['minBuyIn']),
        maxBuyIn: _int(json['maxBuyIn']),
        maxSeats: _int(json['maxSeats']),
        playerCount: _int(json['playerCount']),
        tables: [for (final t in json['tables'] as List? ?? const []) LevelTable.fromJson(t as Json)],
      );
}

/// Mesa abierta de un nivel
class LevelTable {
  const LevelTable({required this.id, required this.tableNumber, required this.seatedCount, required this.maxSeats});

  final int id;
  final int tableNumber;
  final int seatedCount;
  final int maxSeats;

  bool get isFull => seatedCount >= maxSeats;

  factory LevelTable.fromJson(Json json) => LevelTable(
        id: _int(json['id']),
        tableNumber: _int(json['tableNumber']),
        seatedCount: _int(json['seatedCount']),
        maxSeats: _int(json['maxSeats']),
      );
}

/// Resultado de "Jugar" en un nivel
class QuickSeat {
  const QuickSeat({required this.roomId, required this.alreadySeated});
  final int roomId;

  /// Ya estaba sentado en una mesa del nivel (no se cobró otra vez)
  final bool alreadySeated;

  factory QuickSeat.fromJson(Json json) =>
      QuickSeat(roomId: _int(json['roomId']), alreadySeated: json['alreadySeated'] == true);
}
