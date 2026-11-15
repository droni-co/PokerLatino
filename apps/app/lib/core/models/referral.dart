import 'models.dart';

int _int(Object? v) => (v as num?)?.toInt() ?? 0;
DateTime? _date(Object? v) => v is String ? DateTime.parse(v).toLocal() : null;

/// Un amigo invitado y lo que pagó su invitación
class InvitedFriend {
  const InvitedFriend({
    required this.playerId,
    required this.displayName,
    required this.status,
    required this.reward,
    required this.createdAt,
    this.avatar,
  });

  final int playerId;
  final String displayName;
  final String? avatar;

  /// rewarded · limit_reached (ya habías cobrado el máximo del día) · blocked (no válida)
  final String status;
  final int reward;
  final DateTime createdAt;

  factory InvitedFriend.fromJson(Json json) {
    final player = json['player'] as Json;
    return InvitedFriend(
      playerId: _int(player['id']),
      displayName: player['displayName'] as String,
      avatar: player['avatar'] as String?,
      status: json['status'] as String,
      reward: _int(json['reward']),
      createdAt: _date(json['createdAt'])!,
    );
  }
}

/// GET /api/v1/referrals: tu enlace, las reglas y a quiénes invitaste
class ReferralSummary {
  const ReferralSummary({
    required this.code,
    required this.link,
    required this.referrerReward,
    required this.referredReward,
    required this.maxRewardedPerDay,
    required this.rewardedToday,
    required this.totalInvited,
    required this.totalEarned,
    required this.invited,
    this.nextSlotAt,
  });

  final String code;
  final String link;
  final int referrerReward;
  final int referredReward;
  final int maxRewardedPerDay;
  final int rewardedToday;

  /// Si hoy ya cobraste el máximo: cuándo vuelves a cobrar
  final DateTime? nextSlotAt;
  final int totalInvited;
  final int totalEarned;
  final List<InvitedFriend> invited;

  bool get limitReached => rewardedToday >= maxRewardedPerDay;

  factory ReferralSummary.fromJson(Json json) => ReferralSummary(
    code: json['code'] as String,
    link: json['link'] as String,
    referrerReward: _int(json['referrerReward']),
    referredReward: _int(json['referredReward']),
    maxRewardedPerDay: _int(json['maxRewardedPerDay']),
    rewardedToday: _int(json['rewardedToday']),
    nextSlotAt: _date(json['nextSlotAt']),
    totalInvited: _int(json['totalInvited']),
    totalEarned: _int(json['totalEarned']),
    invited: [for (final f in json['invited'] as List? ?? const []) InvitedFriend.fromJson(f as Json)],
  );
}

/// GET /api/v1/wallet/rescue: fichas gratis una vez al día si no alcanzan para jugar
class RescueStatus {
  const RescueStatus({
    required this.amount,
    required this.threshold,
    required this.eligible,
    required this.available,
    this.nextAt,
  });

  final int amount;

  /// Entrada de la mesa más barata
  final int threshold;

  /// No te alcanza para la mesa más barata
  final bool eligible;

  /// Puedes reclamarlo ahora
  final bool available;

  /// Cuándo podrás volver a reclamarlo
  final DateTime? nextAt;

  factory RescueStatus.fromJson(Json json) => RescueStatus(
    amount: _int(json['amount']),
    threshold: _int(json['threshold']),
    eligible: json['eligible'] == true,
    available: json['available'] == true,
    nextAt: _date(json['nextAt']),
  );
}
