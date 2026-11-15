import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/brand.dart';
import '../../core/models/progress.dart';
import '../../core/models/social.dart';
import '../../core/money.dart';
import '../../core/providers.dart';
import '../../core/theme.dart';
import '../friends/friend_widgets.dart';
import '../table/widgets/player_avatar.dart';

/// Colores de cada rango de logro
Color tierColor(String tier) => switch (tier) {
  'silver' => const Color(0xFFC9D3E3),
  'gold' => PokerColors.gold,
  'diamond' => const Color(0xFF7FE3F0),
  _ => const Color(0xFFD08A4E), // bronce
};

String tierName(String tier) => switch (tier) {
  'silver' => 'Plata',
  'gold' => 'Oro',
  'diamond' => 'Diamante',
  _ => 'Bronce',
};

/// Ícono de un logro según el nombre que manda el servidor
IconData achievementIcon(String icon) => switch (icon) {
  'cards' => Icons.style,
  'trophy' => Icons.emoji_events,
  'fire' => Icons.local_fire_department,
  'bolt' => Icons.bolt,
  'chips' => Icons.toll,
  'hand' => Icons.back_hand,
  'tournament' => Icons.military_tech,
  'medal' => Icons.workspace_premium,
  'crown' => Icons.diamond,
  'friends' => Icons.people,
  'invite' => Icons.card_giftcard,
  _ => Icons.star,
};

const categoryNames = {
  'manos': 'Manos',
  'victorias': 'Victorias',
  'pozos': 'Pozos',
  'jugadas': 'Jugadas',
  'torneos': 'Torneos',
  'social': 'Social',
};

/// Color del nivel: crece con él (bronce, plata, oro, diamante)
Color levelColor(int level) => switch (level) {
  >= 50 => tierColor('diamond'),
  >= 25 => tierColor('gold'),
  >= 10 => tierColor('silver'),
  _ => tierColor('bronze'),
};

/// Insignia redonda con el nivel (junto al avatar en la mesa y en las tarjetas)
class LevelBadge extends StatelessWidget {
  const LevelBadge({super.key, required this.level, this.size = 22});
  final int level;
  final double size;

  @override
  Widget build(BuildContext context) {
    final color = levelColor(level);
    return Tooltip(
      message: 'Nivel $level',
      child: Container(
        key: ValueKey('level-$level'),
        width: size,
        height: size,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          gradient: RadialGradient(colors: [Color.lerp(color, Colors.white, 0.35)!, color]),
          border: Border.all(color: const Color(0xFF1A1206), width: size * 0.08),
          boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.5), blurRadius: size * 0.2)],
        ),
        child: Padding(
          padding: EdgeInsets.all(size * 0.08),
          child: FittedBox(
            child: Text(
              '$level',
              style: const TextStyle(fontWeight: FontWeight.w900, color: Color(0xFF1A1206), height: 1),
            ),
          ),
        ),
      ),
    );
  }
}

/// Barra de experiencia del nivel actual
class XpBar extends StatelessWidget {
  const XpBar({super.key, required this.progress, this.showNumbers = true});
  final PlayerProgress progress;
  final bool showNumbers;

  @override
  Widget build(BuildContext context) {
    final p = progress;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(6),
          child: LinearProgressIndicator(
            value: p.levelFraction,
            minHeight: 8,
            backgroundColor: Colors.black.withValues(alpha: 0.4),
            color: levelColor(p.level),
          ),
        ),
        if (showNumbers) ...[
          const SizedBox(height: 4),
          Text(
            '${formatChips(p.xp - p.levelXp)} / ${formatChips(p.nextLevelXp - p.levelXp)} XP para el nivel ${p.level + 1}',
            style: const TextStyle(fontSize: 12, color: PokerColors.muted),
          ),
        ],
      ],
    );
  }
}

/// Medalla de un logro (a color si lo tiene, gris si no)
class AchievementMedal extends StatelessWidget {
  const AchievementMedal({super.key, required this.achievement, this.size = 44});
  final Achievement achievement;
  final double size;

  @override
  Widget build(BuildContext context) {
    final on = achievement.unlocked;
    final color = on ? tierColor(achievement.tier) : const Color(0xFF3A4560);
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: on ? color.withValues(alpha: 0.18) : Colors.black.withValues(alpha: 0.3),
        border: Border.all(color: color, width: on ? 2 : 1),
        boxShadow: on ? [BoxShadow(color: color.withValues(alpha: 0.35), blurRadius: 10)] : null,
      ),
      child: Icon(
        on ? achievementIcon(achievement.icon) : Icons.lock_outline,
        color: on ? color : const Color(0xFF59647D),
        size: size * 0.5,
      ),
    );
  }
}

/// Fila de un logro: medalla, nombre, descripción, avance y recompensa
class AchievementTile extends StatelessWidget {
  const AchievementTile({super.key, required this.achievement});
  final Achievement achievement;

  @override
  Widget build(BuildContext context) {
    final a = achievement;
    final progress = a.progress;
    return Padding(
      key: ValueKey('achievement-${a.key}'),
      padding: const EdgeInsets.symmetric(vertical: 7),
      child: Row(
        children: [
          AchievementMedal(achievement: a),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  a.name,
                  style: TextStyle(fontWeight: FontWeight.w800, color: a.unlocked ? Colors.white : Colors.white70),
                ),
                Text(a.description, style: const TextStyle(fontSize: 12.5, color: PokerColors.muted)),
                if (!a.unlocked && progress != null && progress.target > 1) ...[
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      Expanded(
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(4),
                          child: LinearProgressIndicator(
                            value: progress.fraction,
                            minHeight: 5,
                            backgroundColor: Colors.black.withValues(alpha: 0.4),
                            color: tierColor(a.tier),
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        '${formatChips(progress.current)}/${formatChips(progress.target)}',
                        style: const TextStyle(fontSize: 11, color: PokerColors.muted),
                      ),
                    ],
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(width: 8),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                '+${formatChips(a.xp)} XP',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: a.unlocked ? PokerColors.positive : PokerColors.muted,
                ),
              ),
              if (a.chips > 0)
                Text(
                  '+${formatChips(a.chips)} fichas',
                  style: TextStyle(fontSize: 12, color: a.unlocked ? PokerColors.gold : PokerColors.muted),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

/// Cabecera de nivel: avatar con su insignia, nombre, nivel y barra de XP
class LevelHeader extends StatelessWidget {
  const LevelHeader({super.key, required this.player, required this.progress, this.trailing});
  final PlayerRef player;
  final PlayerProgress progress;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        SizedBox(
          width: 64,
          height: 64,
          child: Stack(
            clipBehavior: Clip.none,
            children: [
              PlayerAvatar(playerId: player.id, avatar: player.avatar, size: 64),
              Positioned(left: -4, bottom: -4, child: LevelBadge(level: progress.level, size: 28)),
            ],
          ),
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                player.displayName,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
              ),
              Text(
                'Nivel ${progress.level} · ${progress.unlockedCount} de ${progress.totalCount} logros',
                style: TextStyle(color: levelColor(progress.level), fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 6),
              XpBar(progress: progress),
            ],
          ),
        ),
        if (trailing != null) ...[const SizedBox(width: 10), trailing!],
      ],
    );
  }
}

/// Cuatro números: manos, ganadas, mayor pozo, mejor racha
class ProgressStats extends StatelessWidget {
  const ProgressStats({super.key, required this.progress});
  final PlayerProgress progress;

  @override
  Widget build(BuildContext context) {
    Widget item(String label, String value) => Expanded(
      child: Column(
        children: [
          FittedBox(
            child: Text(value, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
          ),
          Text(label, style: const TextStyle(fontSize: 11.5, color: PokerColors.muted)),
        ],
      ),
    );
    return Row(
      children: [
        item('Manos', formatChips(progress.hands)),
        item('Ganadas', formatChips(progress.wins)),
        item('Mayor pozo', formatChips(progress.biggestPot)),
        item('Mejor racha', '${progress.bestWinStreak}'),
      ],
    );
  }
}

/// Tarjeta de un jugador (al tocarlo en la mesa o en Amigos): nivel, números, logros y
/// el botón para agregarlo como amigo
class PlayerCardSheet extends ConsumerWidget {
  const PlayerCardSheet({super.key, required this.player});
  final PlayerRef player;

  static Future<void> show(BuildContext context, PlayerRef player) => showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: PokerColors.surface,
    showDragHandle: true,
    constraints: const BoxConstraints(maxWidth: 560),
    builder: (_) => FractionallySizedBox(heightFactor: 0.8, child: PlayerCardSheet(player: player)),
  );

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final card = ref.watch(playerCardProvider(player.id));
    // La relación se actualiza con la lista de amigos (tras "Agregar" o "Aceptar")
    final friends = ref.watch(friendsProvider).value;

    return card.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(child: Text(e.toString())),
      data: (c) {
        final relation = friends?.relationWith(c.player.id) ?? c.relation;
        final requestId = friends?.incoming.where((r) => r.player.id == c.player.id).firstOrNull?.id ?? c.requestId;
        final unlocked = c.progress.achievements.where((a) => a.unlocked).toList()
          ..sort((a, b) => b.unlockedAt!.compareTo(a.unlockedAt!));
        final locked = c.progress.achievements.where((a) => !a.unlocked).toList();

        return ListView(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
          children: [
            LevelHeader(
              player: c.player,
              progress: c.progress,
              trailing: c.isSelf ? null : RelationButton(player: c.player, relation: relation, requestId: requestId),
            ),
            const SizedBox(height: 16),
            GoldPanel(
              padding: const EdgeInsets.symmetric(vertical: 10),
              child: ProgressStats(progress: c.progress),
            ),
            const SizedBox(height: 16),
            Text(
              'Logros (${c.progress.unlockedCount}/${c.progress.totalCount})',
              style: const TextStyle(fontWeight: FontWeight.w800, color: PokerColors.gold),
            ),
            const SizedBox(height: 8),
            if (unlocked.isEmpty) const Text('Todavía no tiene logros.', style: TextStyle(color: PokerColors.muted)),
            for (final a in unlocked) AchievementTile(achievement: a),
            if (locked.isNotEmpty) ...[
              const SizedBox(height: 12),
              Text('Por conseguir (${locked.length})', style: const TextStyle(color: PokerColors.muted)),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (final a in locked)
                    Tooltip(
                      message: '${a.name}: ${a.description}',
                      child: AchievementMedal(achievement: a, size: 36),
                    ),
                ],
              ),
            ],
          ],
        );
      },
    );
  }
}

/// Tu nivel y todos los logros con tu avance (página de Estadísticas)
class MyProgressPanel extends ConsumerWidget {
  const MyProgressPanel({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final progress = ref.watch(myProgressProvider);
    final me = ref.watch(authControllerProvider).value;
    return progress.when(
      loading: () => const Padding(
        padding: EdgeInsets.all(24),
        child: Center(child: CircularProgressIndicator()),
      ),
      error: (e, _) => Text(e.toString()),
      data: (p) {
        final byCategory = <String, List<Achievement>>{};
        for (final a in p.achievements) {
          byCategory.putIfAbsent(a.category, () => []).add(a);
        }
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            GoldPanel(
              highlight: true,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (me != null)
                    LevelHeader(
                      player: PlayerRef(id: me.id, displayName: me.displayName, avatar: me.avatar),
                      progress: p,
                    ),
                  const SizedBox(height: 10),
                  const Text(
                    'Ganas experiencia con cada mano (más si la ganas) y con cada logro. Cada nivel nuevo '
                    'te regala fichas: nivel × 100.',
                    style: TextStyle(fontSize: 12.5, color: PokerColors.muted),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),
            for (final entry in byCategory.entries) ...[
              Padding(
                padding: const EdgeInsets.only(left: 4, bottom: 6),
                child: Text(
                  '${categoryNames[entry.key] ?? entry.key} · '
                  '${entry.value.where((a) => a.unlocked).length}/${entry.value.length}',
                  style: const TextStyle(fontWeight: FontWeight.w800, color: PokerColors.gold),
                ),
              ),
              GoldPanel(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                child: Column(children: [for (final a in entry.value) AchievementTile(achievement: a)]),
              ),
              const SizedBox(height: 16),
            ],
          ],
        );
      },
    );
  }
}

/// Aviso flotante: subiste de nivel y/o desbloqueaste logros
class ProgressToastCard extends StatelessWidget {
  const ProgressToastCard({super.key, required this.news, required this.onClose, this.onOpen});
  final ProgressNews news;
  final VoidCallback onClose;
  final VoidCallback? onOpen;

  @override
  Widget build(BuildContext context) {
    final levelUp = news.levelUp;
    final achievements = news.achievements;
    final chips = achievements.fold<int>(0, (sum, a) => sum + a.chips) + (levelUp?.chips ?? 0);
    final title = levelUp != null ? '¡Subiste a nivel ${levelUp.to}!' : null;
    final detail = achievements.isEmpty
        ? null
        : achievements.length == 1
        ? 'Logro: ${achievements.first.name}'
        : '${achievements.length} logros: ${achievements.map((a) => a.name).join(', ')}';

    return Material(
      key: const ValueKey('progress-toast'),
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(30),
        onTap: onOpen,
        child: Container(
          constraints: const BoxConstraints(maxWidth: 520),
          padding: const EdgeInsets.fromLTRB(8, 6, 4, 6),
          decoration: BoxDecoration(
            color: PokerColors.background.withValues(alpha: 0.95),
            borderRadius: BorderRadius.circular(30),
            border: Border.all(color: PokerColors.gold, width: 1.4),
            boxShadow: [
              BoxShadow(color: PokerColors.gold.withValues(alpha: 0.35), blurRadius: 18),
              const BoxShadow(color: Colors.black54, blurRadius: 10, offset: Offset(0, 4)),
            ],
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (levelUp != null)
                LevelBadge(level: levelUp.to, size: 34)
              else
                AchievementMedal(
                  achievement: Achievement(
                    key: achievements.first.key,
                    name: achievements.first.name,
                    description: '',
                    tier: achievements.first.tier,
                    icon: achievements.first.icon,
                    xp: 0,
                    chips: 0,
                    unlockedAt: DateTime(2000),
                  ),
                  size: 34,
                ),
              const SizedBox(width: 10),
              Flexible(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (title != null)
                      Text(
                        title,
                        style: const TextStyle(fontWeight: FontWeight.w900, color: PokerColors.gold),
                      ),
                    if (detail != null)
                      Text(
                        detail,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontWeight: title == null ? FontWeight.w800 : FontWeight.w600,
                          fontSize: 13,
                          color: title == null ? PokerColors.gold : Colors.white,
                        ),
                      ),
                    if (chips > 0)
                      Text(
                        '+${formatFichas(chips)}',
                        style: const TextStyle(
                          fontSize: 12.5,
                          color: PokerColors.positive,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                  ],
                ),
              ),
              IconButton(
                tooltip: 'Cerrar',
                visualDensity: VisualDensity.compact,
                icon: const Icon(Icons.close, size: 18),
                onPressed: onClose,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
