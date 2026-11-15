import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/brand.dart';
import '../../core/models/tournament.dart';
import '../../core/money.dart';
import '../../core/providers.dart';
import '../../core/theme.dart';
import '../table/widgets/player_avatar.dart';
import 'tournament_widgets.dart';

/// Detalle del torneo: reglas, premios por puesto y clasificación (se actualiza sola)
class TournamentPage extends ConsumerWidget {
  const TournamentPage({super.key, required this.tournamentId});
  final int tournamentId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final detail = ref.watch(tournamentProvider(tournamentId));
    final me = ref.watch(authControllerProvider).value;

    return detail.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(e.toString()),
            TextButton(
              onPressed: () => ref.invalidate(tournamentProvider(tournamentId)),
              child: const Text('Reintentar'),
            ),
          ],
        ),
      ),
      data: (d) => RefreshIndicator(
        onRefresh: () => ref.refresh(tournamentProvider(tournamentId).future),
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
          children: [
            Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 760),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Align(
                      alignment: Alignment.centerLeft,
                      child: TextButton.icon(
                        onPressed: () => context.canPop() ? context.pop() : context.go('/tournaments'),
                        icon: const Icon(Icons.arrow_back, size: 18),
                        label: const Text('Torneos'),
                      ),
                    ),
                    _Header(tournament: d.tournament),
                    const SizedBox(height: 20),
                    const SectionTitle('Premios'),
                    const SizedBox(height: 10),
                    _Payouts(detail: d),
                    const SizedBox(height: 20),
                    const SectionTitle('Clasificación'),
                    const SizedBox(height: 10),
                    _Standings(detail: d, myId: me?.id ?? -1),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.tournament});
  final Tournament tournament;

  @override
  Widget build(BuildContext context) {
    final t = tournament;
    return GoldPanel(
      highlight: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.emoji_events, color: PokerColors.gold, size: 30),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  t.name,
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
                ),
              ),
              TournamentStatusChip(status: t.status),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            tournamentWhen(t),
            style: const TextStyle(color: PokerColors.gold, fontWeight: FontWeight.w600),
          ),
          if (t.description != null && t.description!.isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(t.description!, style: const TextStyle(color: PokerColors.muted)),
          ],
          const SizedBox(height: 14),
          TournamentFacts(tournament: t),
          if (t.you != null && t.you!.isDone) ...[const SizedBox(height: 14), TournamentResultLine(you: t.you!)],
          const SizedBox(height: 16),
          TournamentActions(tournament: t, showDetailLink: false),
        ],
      ),
    );
  }
}

class _Payouts extends StatelessWidget {
  const _Payouts({required this.detail});
  final TournamentDetail detail;

  @override
  Widget build(BuildContext context) {
    final t = detail.tournament;
    return GoldPanel(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (t.status == TournamentStatus.registering)
            const Padding(
              padding: EdgeInsets.only(bottom: 8),
              child: Text(
                'Con el cupo completo. Sin comisión: todo el bote se reparte.',
                style: TextStyle(color: PokerColors.muted, fontSize: 12),
              ),
            ),
          Wrap(
            spacing: 10,
            runSpacing: 8,
            children: [
              for (final (i, amount) in detail.payouts.indexed)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: Colors.black.withValues(alpha: 0.3),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: PokerColors.gold.withValues(alpha: i == 0 ? 0.8 : 0.35)),
                  ),
                  child: Text.rich(
                    TextSpan(
                      children: [
                        TextSpan(
                          text: '${positionLabel(i + 1)}  ',
                          style: const TextStyle(color: PokerColors.gold, fontWeight: FontWeight.w800),
                        ),
                        TextSpan(text: formatFichas(amount)),
                      ],
                    ),
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class _Standings extends StatelessWidget {
  const _Standings({required this.detail, required this.myId});
  final TournamentDetail detail;
  final int myId;

  @override
  Widget build(BuildContext context) {
    final rows = detail.standings;
    if (rows.isEmpty) {
      return const GoldPanel(
        child: Text(
          'Todavía no hay inscritos.',
          textAlign: TextAlign.center,
          style: TextStyle(color: PokerColors.muted),
        ),
      );
    }
    return GoldPanel(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Column(
        children: [
          for (final (i, row) in rows.indexed) ...[
            if (i > 0) const Divider(height: 1),
            _StandingRow(row: row, isMe: row.playerId == myId),
          ],
        ],
      ),
    );
  }
}

class _StandingRow extends StatelessWidget {
  const _StandingRow({required this.row, required this.isMe});
  final TournamentStanding row;
  final bool isMe;

  @override
  Widget build(BuildContext context) {
    final out = row.status == 'eliminated';
    final detail = switch (row.status) {
      'playing' => '${formatChips(row.chips ?? 0)} fichas · Mesa ${row.tableNumber ?? '-'}',
      'winner' => 'Campeón',
      'eliminated' => 'Eliminado',
      _ => 'Inscrito',
    };
    return Container(
      key: ValueKey('standing-${row.playerId}'),
      color: isMe ? PokerColors.gold.withValues(alpha: 0.08) : null,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      child: Row(
        children: [
          SizedBox(
            width: 36,
            child: Text(
              row.position == null ? '–' : positionLabel(row.position!),
              style: TextStyle(
                color: out ? PokerColors.muted : PokerColors.gold,
                fontWeight: FontWeight.w800,
                fontSize: 15,
              ),
            ),
          ),
          PlayerAvatar(playerId: row.playerId, avatar: row.avatar, size: 34, isMe: isMe, dimmed: out),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  isMe ? '${row.displayName} (tú)' : row.displayName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(fontWeight: FontWeight.w700, color: out ? PokerColors.muted : Colors.white),
                ),
                Text(detail, style: const TextStyle(fontSize: 12, color: PokerColors.muted)),
              ],
            ),
          ),
          if (row.prize > 0)
            Text(
              formatFichas(row.prize),
              style: const TextStyle(color: PokerColors.gold, fontWeight: FontWeight.w700),
            ),
        ],
      ),
    );
  }
}
