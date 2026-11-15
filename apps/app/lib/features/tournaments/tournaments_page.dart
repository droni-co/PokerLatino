import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/brand.dart';
import '../../core/models/tournament.dart';
import '../../core/providers.dart';
import '../../core/theme.dart';
import 'tournament_widgets.dart';

/// Lista de torneos: abiertos a inscripción, en juego y terminados recientemente
class TournamentsPage extends ConsumerWidget {
  const TournamentsPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tournaments = ref.watch(tournamentsProvider);
    final short = MediaQuery.sizeOf(context).height < 500;

    return Column(
      children: [
        Padding(padding: EdgeInsets.fromLTRB(16, short ? 6 : 14, 16, 0), child: const SectionTitle('Torneos')),
        Expanded(
          child: RefreshIndicator(
            onRefresh: () => ref.refresh(tournamentsProvider.future),
            child: tournaments.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (e, _) => _Empty(text: e.toString(), onRetry: () => ref.invalidate(tournamentsProvider)),
              data: (list) => list.isEmpty
                  ? const _Empty(text: 'No hay torneos programados por ahora.')
                  : ListView.separated(
                      padding: EdgeInsets.fromLTRB(16, short ? 8 : 16, 16, 24),
                      itemCount: list.length,
                      separatorBuilder: (_, _) => const SizedBox(height: 14),
                      itemBuilder: (_, i) => Center(
                        child: ConstrainedBox(
                          constraints: const BoxConstraints(maxWidth: 760),
                          child: TournamentCard(tournament: list[i]),
                        ),
                      ),
                    ),
            ),
          ),
        ),
      ],
    );
  }
}

class TournamentCard extends StatelessWidget {
  const TournamentCard({super.key, required this.tournament});
  final Tournament tournament;

  @override
  Widget build(BuildContext context) {
    final t = tournament;
    final you = t.you;
    return GoldPanel(
      key: ValueKey('tournament-${t.id}'),
      highlight: you != null && (t.status == TournamentStatus.running || t.status == TournamentStatus.registering),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.emoji_events, color: PokerColors.gold, size: 26),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  t.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
                ),
              ),
              const SizedBox(width: 8),
              TournamentStatusChip(status: t.status),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            tournamentWhen(t),
            style: const TextStyle(color: PokerColors.gold, fontWeight: FontWeight.w600),
          ),
          if (t.description != null && t.description!.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(t.description!, style: const TextStyle(color: PokerColors.muted, fontSize: 12.5)),
          ],
          const SizedBox(height: 12),
          TournamentFacts(tournament: t),
          if (you != null && you.isDone) ...[const SizedBox(height: 12), TournamentResultLine(you: you)],
          const SizedBox(height: 14),
          TournamentActions(tournament: t),
        ],
      ),
    );
  }
}

class _Empty extends StatelessWidget {
  const _Empty({required this.text, this.onRetry});
  final String text;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    // ListView para que funcione el "deslizar para actualizar"
    return ListView(
      padding: const EdgeInsets.all(32),
      children: [
        GoldPanel(
          child: Column(
            children: [
              const Icon(Icons.emoji_events_outlined, color: PokerColors.gold, size: 48),
              const SizedBox(height: 12),
              Text(text, textAlign: TextAlign.center),
              if (onRetry != null) ...[
                const SizedBox(height: 12),
                OutlinedButton(onPressed: onRetry, child: const Text('Reintentar')),
              ],
            ],
          ),
        ),
      ],
    );
  }
}
