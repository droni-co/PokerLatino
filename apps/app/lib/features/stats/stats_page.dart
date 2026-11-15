import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/brand.dart';
import '../../core/models/models.dart';
import '../../core/money.dart';
import '../../core/providers.dart';
import '../../core/theme.dart';

class StatsPage extends ConsumerWidget {
  const StatsPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final stats = ref.watch(statsProvider);
    return RefreshIndicator(
      onRefresh: () => ref.refresh(statsProvider.future),
      child: stats.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => ListView(
          children: [Padding(padding: const EdgeInsets.all(32), child: Text('$e'))],
        ),
        data: (s) => ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 560),
                child: _StatCard(stat: s),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard({required this.stat});
  final PlayerStat stat;

  @override
  Widget build(BuildContext context) {
    final rows = <(String, String, String, Color?)>[
      ('hands', 'Manos jugadas', '${stat.handsPlayed}', null),
      ('trophy', 'Manos ganadas', '${stat.handsWon} (${(stat.winRate * 100).toStringAsFixed(1)}%)', null),
      ('showdown', 'Llegó al showdown', '${stat.showdownsReached}', null),
      ('wagered', 'Total apostado', formatFichas(stat.totalWagered), null),
      ('won', 'Total ganado', formatFichas(stat.totalWon), null),
      (
        'net',
        'Resultado neto',
        '${stat.net >= 0 ? '+' : '−'}${formatFichas(stat.net.abs())}',
        stat.net >= 0 ? PokerColors.positive : PokerColors.red,
      ),
      ('pot', 'Bote más grande', formatFichas(stat.biggestPotWon), null),
    ];

    return Padding(
      padding: const EdgeInsets.only(bottom: 20),
      child: GoldPanel(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const SectionTitle('Tus partidas', icon: 'chips'),
            const SizedBox(height: 12),
            _WinRateBar(rate: stat.winRate),
            const SizedBox(height: 8),
            for (final (icon, label, value, color) in rows)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 5),
                child: Row(
                  children: [
                    GameIcon(icon, size: 34),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(label, style: const TextStyle(color: PokerColors.muted)),
                    ),
                    Text(
                      value,
                      style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15, color: color),
                    ),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}

/// Barra de porcentaje de manos ganadas
class _WinRateBar extends StatelessWidget {
  const _WinRateBar({required this.rate});
  final double rate;

  @override
  Widget build(BuildContext context) {
    final value = rate.clamp(0.0, 1.0);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Efectividad ${(value * 100).toStringAsFixed(1)}%',
          style: const TextStyle(color: PokerColors.gold, fontWeight: FontWeight.w700, fontSize: 12),
        ),
        const SizedBox(height: 6),
        ClipRRect(
          borderRadius: BorderRadius.circular(6),
          child: Stack(
            children: [
              Container(height: 10, color: Colors.black.withValues(alpha: 0.4)),
              FractionallySizedBox(
                widthFactor: value,
                child: Container(
                  height: 10,
                  decoration: const BoxDecoration(
                    gradient: LinearGradient(colors: [PokerColors.goldDark, PokerColors.gold, Color(0xFFFFE08A)]),
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
