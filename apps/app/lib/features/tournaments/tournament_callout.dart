import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api_exception.dart';
import '../../core/models/progress.dart';
import '../../core/models/social.dart';
import '../../core/models/tournament.dart';
import '../../core/providers.dart';
import '../../core/router.dart';
import '../../core/theme.dart';
import '../friends/friend_widgets.dart';
import '../progress/progress_widgets.dart';

/// Torneo en juego en el que el jugador tiene asiento (null si no hay)
Tournament? myTournamentInPlay(List<Tournament> list) => list
    .where((t) => t.status == TournamentStatus.running && t.you?.isPlaying == true && t.you?.roomId != null)
    .firstOrNull;

/// Avisos flotantes en cualquier pantalla de la app:
/// - tu torneo empezó y tienes una mesa esperándote (desaparece cuando estás en ella);
/// - un amigo te invita a su mesa ("Jugar" te lleva y abre la entrada; "Ahora no" la rechaza);
/// - subiste de nivel o desbloqueaste logros (se cierra solo a los pocos segundos).
/// Ir a otra mesa reemplaza la pantalla actual: si estabas en una mesa normal, te levantas.
class TournamentCallout extends ConsumerStatefulWidget {
  const TournamentCallout({super.key, required this.child});
  final Widget child;

  @override
  ConsumerState<TournamentCallout> createState() => _TournamentCalloutState();
}

class _TournamentCalloutState extends ConsumerState<TournamentCallout> {
  GoRouter? _router;

  /// Invitaciones ya respondidas aquí (se ocultan sin esperar al siguiente buzón)
  final _answered = <int>{};

  /// Logros y nivel que se están anunciando
  ProgressNews? _news;
  Timer? _newsTimer;

  static const newsDuration = Duration(seconds: 8);

  /// Llegaron logros o un nivel nuevo: se anuncian y se marcan como vistos
  void _onInbox(Inbox inbox) {
    final news = inbox.progress;
    if (news.isEmpty || _news != null) return;
    setState(() => _news = news);
    ref.read(apiClientProvider).markProgressSeen().ignore();
    // Sus fichas ya están en la billetera
    ref.invalidate(walletProvider);
    ref.invalidate(myProgressProvider);
    _newsTimer?.cancel();
    _newsTimer = Timer(newsDuration, _closeNews);
  }

  void _closeNews() {
    _newsTimer?.cancel();
    if (mounted) setState(() => _news = null);
  }

  Future<void> _answer(TableInvitation invitation, {required bool accept}) async {
    setState(() => _answered.add(invitation.id));
    final api = ref.read(apiClientProvider);
    final router = ref.read(routerProvider);
    final messenger = ScaffoldMessenger.maybeOf(context);
    try {
      if (accept) {
        final roomId = await api.acceptInvitation(invitation.id);
        router.go('/rooms/$roomId?sit=1');
      } else {
        await api.declineInvitation(invitation.id);
      }
    } on ApiException catch (e) {
      messenger?.showSnackBar(SnackBar(content: Text(e.message)));
    }
    ref.invalidate(inboxProvider);
  }

  void _onRoute() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    _newsTimer?.cancel();
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
    ref.listen(inboxProvider, (_, next) {
      final inbox = next.value;
      if (inbox != null) _onInbox(inbox);
    });

    final mine = myTournamentInPlay(ref.watch(tournamentsProvider).value ?? const []);
    final path = router.routerDelegate.currentConfiguration.uri.path;
    final roomId = mine?.you?.roomId;
    final show = mine != null && path != '/rooms/$roomId';

    // Una invitación a la vez (la más reciente), salvo la de la mesa donde ya estás
    final invitation = (ref.watch(inboxProvider).value?.invitations ?? const <TableInvitation>[])
        .where((i) => !_answered.contains(i.id) && path != '/rooms/${i.roomId}')
        .firstOrNull;

    return Stack(
      children: [
        widget.child,
        if (show || invitation != null || _news != null)
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            child: SafeArea(
              child: Center(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (show) TournamentCalloutCard(name: mine.name, onGo: () => router.go('/rooms/$roomId')),
                      if (show && invitation != null) const SizedBox(height: 8),
                      if (_news != null) ...[
                        ProgressToastCard(
                          news: _news!,
                          onClose: _closeNews,
                          // Desde la mesa no se sale: solo se cierra
                          onOpen: path.startsWith('/rooms')
                              ? null
                              : () {
                                  _closeNews();
                                  router.go('/stats');
                                },
                        ),
                        if (show || invitation != null) const SizedBox(height: 8),
                      ],
                      if (invitation != null)
                        InvitationCard(
                          invitation: invitation,
                          onAccept: () => _answer(invitation, accept: true),
                          onDecline: () => _answer(invitation, accept: false),
                        ),
                    ],
                  ),
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
