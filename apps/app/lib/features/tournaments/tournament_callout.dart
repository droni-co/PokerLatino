import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/models/tournament.dart';
import '../../core/providers.dart';
import '../../core/router.dart';
import '../../core/theme.dart';

/// Torneo en juego en el que el jugador tiene asiento (null si no hay)
Tournament? myTournamentInPlay(List<Tournament> list) => list
    .where((t) => t.status == TournamentStatus.running && t.you?.isPlaying == true && t.you?.roomId != null)
    .firstOrNull;

/// Aviso flotante en cualquier pantalla de la app: tu torneo empezó y tienes una mesa
/// esperándote. Desaparece cuando estás en esa mesa. Ir a ella reemplaza la pantalla
/// actual: si estabas en una mesa normal, te levantas de ella.
class TournamentCallout extends ConsumerStatefulWidget {
  const TournamentCallout({super.key, required this.child});
  final Widget child;

  @override
  ConsumerState<TournamentCallout> createState() => _TournamentCalloutState();
}

class _TournamentCalloutState extends ConsumerState<TournamentCallout> {
  GoRouter? _router;

  void _onRoute() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    _router?.routerDelegate.removeListener(_onRoute);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final router = ref.watch(routerProvider);
    if (!identical(router, _router)) {
      _router?.routerDelegate.removeListener(_onRoute);
      _router = router..routerDelegate.addListener(_onRoute);
    }

    final signedIn = ref.watch(authControllerProvider).value != null;
    if (!signedIn) return widget.child;

    final mine = myTournamentInPlay(ref.watch(tournamentsProvider).value ?? const []);
    final path = router.routerDelegate.currentConfiguration.uri.path;
    final roomId = mine?.you?.roomId;
    final show = mine != null && path != '/rooms/$roomId';

    return Stack(
      children: [
        widget.child,
        if (show)
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            child: SafeArea(
              child: Center(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
                  child: TournamentCalloutCard(name: mine.name, onGo: () => router.go('/rooms/$roomId')),
                ),
              ),
            ),
          ),
      ],
    );
  }
}

/// La tarjeta del aviso (separada para poder probarla)
class TournamentCalloutCard extends StatelessWidget {
  const TournamentCalloutCard({super.key, required this.name, required this.onGo});
  final String name;
  final VoidCallback onGo;

  @override
  Widget build(BuildContext context) {
    return Material(
      key: const ValueKey('tournament-callout'),
      color: Colors.transparent,
      child: Container(
        constraints: const BoxConstraints(maxWidth: 520),
        padding: const EdgeInsets.fromLTRB(14, 6, 6, 6),
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
            const Icon(Icons.emoji_events, color: PokerColors.gold, size: 22),
            const SizedBox(width: 8),
            Flexible(
              child: Text(
                '$name empezó: tu mesa te espera',
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
              ),
            ),
            const SizedBox(width: 10),
            FilledButton(
              onPressed: onGo,
              style: FilledButton.styleFrom(
                backgroundColor: PokerColors.gold,
                foregroundColor: const Color(0xFF2A1B04),
                visualDensity: VisualDensity.compact,
                shape: const StadiumBorder(),
              ),
              child: const Text('Ir a mi mesa', style: TextStyle(fontWeight: FontWeight.w800)),
            ),
          ],
        ),
      ),
    );
  }
}
