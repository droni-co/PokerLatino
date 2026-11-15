import 'models.dart';
import 'social.dart';

int _int(Object? v) => (v as num?)?.toInt() ?? 0;
DateTime? _date(Object? v) => v is String ? DateTime.parse(v).toLocal() : null;

/// Avance hacia un logro (solo en tu propio progreso)
class AchievementProgress {
  const AchievementProgress({required this.current, required this.target, required this.done});
  final int current;
  final int target;
  final bool done;

  double get fraction => target == 0 ? 0 : (current / target).clamp(0, 1).toDouble();

  factory AchievementProgress.fromJson(Json json) =>
      AchievementProgress(current: _int(json['current']), target: _int(json['target']), done: json['done'] == true);
}

class Achievement {
  const Achievement({
    required this.key,
    required this.name,
    required this.description,
    required this.tier,
    required this.icon,
    required this.xp,
    required this.chips,
    this.category = '',
    this.unlockedAt,
    this.progress,
  });

  final String key;
  final String name;
  final String description;

  /// manos · victorias · pozos · jugadas · torneos · social
  final String category;

  /// bronze · silver · gold · diamond
  final String tier;
  final String icon;
  final int xp;
  final int chips;
  final DateTime? unlockedAt;
  final AchievementProgress? progress;

  bool get unlocked => unlockedAt != null;

  factory Achievement.fromJson(Json json) => Achievement(
    key: json['key'] as String,
    name: json['name'] as String,
    description: json['description'] as String,
    category: json['category'] as String? ?? '',
    tier: json['tier'] as String? ?? 'bronze',
    icon: json['icon'] as String? ?? 'trophy',
    xp: _int(json['xp']),
    chips: _int(json['chips']),
    unlockedAt: _date(json['unlockedAt']),
    progress: json['progress'] == null ? null : AchievementProgress.fromJson(json['progress'] as Json),
  );
}

/// Nivel, XP y logros (GET /me/progress o la tarjeta de un jugador)
class PlayerProgress {
  const PlayerProgress({
    required this.level,
    required this.xp,
    required this.levelXp,
    required this.nextLevelXp,
    required this.hands,
    required this.wins,
    required this.biggestPot,
    required this.bestWinStreak,
    required this.unlockedCount,
    required this.totalCount,
    required this.achievements,
  });

  final int level;
  final int xp;

  /// XP con la que se llegó al nivel actual y la que pide el siguiente
  final int levelXp;
  final int nextLevelXp;
  final int hands;
  final int wins;
  final int biggestPot;
  final int bestWinStreak;
  final int unlockedCount;
  final int totalCount;
  final List<Achievement> achievements;

  double get levelFraction =>
      nextLevelXp <= levelXp ? 0 : ((xp - levelXp) / (nextLevelXp - levelXp)).clamp(0, 1).toDouble();

  factory PlayerProgress.fromJson(Json json) {
    final stats = json['stats'] as Json? ?? const {};
    return PlayerProgress(
      level: _int(json['level'] ?? 1),
      xp: _int(json['xp']),
      levelXp: _int(json['levelXp']),
      nextLevelXp: _int(json['nextLevelXp']),
      hands: _int(stats['hands']),
      wins: _int(stats['wins']),
      biggestPot: _int(stats['biggestPot']),
      bestWinStreak: _int(stats['bestWinStreak']),
      unlockedCount: _int(json['unlockedCount']),
      totalCount: _int(json['totalCount']),
      achievements: [for (final a in json['achievements'] as List? ?? const []) Achievement.fromJson(a as Json)],
    );
  }
}

/// GET /players/:id: tarjeta pública de un jugador
class PlayerCard {
  const PlayerCard({
    required this.player,
    required this.progress,
    required this.relation,
    this.requestId,
    this.isSelf = false,
    this.memberSince,
  });
  final PlayerRef player;
  final PlayerProgress progress;
  final Relation relation;
  final int? requestId;
  final bool isSelf;
  final DateTime? memberSince;

  factory PlayerCard.fromJson(Json json) {
    final relation = json['relation'] as Json? ?? const {};
    return PlayerCard(
      player: PlayerRef.fromJson(json['player'] as Json),
      progress: PlayerProgress.fromJson(json),
      relation: Relation.parse(relation['status']),
      requestId: (relation['requestId'] as num?)?.toInt(),
      isSelf: relation['status'] == 'self',
      memberSince: _date(json['memberSince']),
    );
  }
}

/// Subida de nivel aún no anunciada
class LevelUp {
  const LevelUp({required this.from, required this.to, required this.chips});
  final int from;
  final int to;
  final int chips;

  factory LevelUp.fromJson(Json json) =>
      LevelUp(from: _int(json['from']), to: _int(json['to']), chips: _int(json['chips']));
}

/// Del buzón: logros y nivel que la app todavía no anunció
class ProgressNews {
  const ProgressNews({this.level = 1, this.levelUp, this.achievements = const []});
  final int level;
  final LevelUp? levelUp;
  final List<Achievement> achievements;

  bool get isEmpty => levelUp == null && achievements.isEmpty;

  factory ProgressNews.fromJson(Json json) => ProgressNews(
    level: _int(json['level'] ?? 1),
    levelUp: json['levelUp'] == null ? null : LevelUp.fromJson(json['levelUp'] as Json),
    achievements: [for (final a in json['achievements'] as List? ?? const []) Achievement.fromJson(a as Json)],
  );
}
