import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api_client.dart';
import '../../core/api/api_exception.dart';
import '../../core/models/models.dart';
import '../../core/models/social.dart';
import '../../core/models/table_state.dart';
import '../../core/models/tournament.dart';
import '../../core/money.dart';
import '../../core/providers.dart';
import '../../core/sounds.dart';
import '../../core/theme.dart';
import '../friends/friend_widgets.dart';
import '../progress/progress_widgets.dart';
import 'table_chat.dart';
import 'table_controller.dart';
import 'table_logic.dart';
import 'widgets/action_bar.dart';
import 'widgets/chat_panel.dart';
import 'widgets/hand_rankings.dart';
import 'widgets/table_scene.dart';
import 'widgets/table_surface.dart';

/// Ancho a partir del cual los controles flotan abajo a la derecha (como en escritorio)
/// Desde este ancho el panel de acciones flota abajo a la derecha sin tapar tus cartas
/// (panel de 480 px + margen a cada lado del centro de la mesa)
const _floatingControlsWidth = 1280.0;

class TablePage extends ConsumerStatefulWidget {
  const TablePage({super.key, required this.roomId, this.autoSit = false});
  final int roomId;

  /// Llegó aceptando una invitación: al cargar la mesa abre la entrada (si hay sitio)
  final bool autoSit;

  @override
  ConsumerState<TablePage> createState() => _TablePageState();
}

class _TablePageState extends ConsumerState<TablePage> {
  PreAction? _preAction;
  int? _preActionCall; // monto a igualar cuando se marcó "Igualar"
  String? _preActionKey; // mano+calle en que se marcó
  String? _executedKey;
  bool _wasMyTurn = false;

  /// El jugador pidió levantarse (para distinguirlo de una expulsión por inactividad)
  bool _leaveRequested = false;

  /// Hay un "Levantarse" en curso: su propio aviso informa el resultado
  bool _leaveInFlight = false;

  /// Sentado y sin haber pedido levantarse: al salir de la mesa hay que levantarlo
  bool _staying = false;

  /// La app estuvo en segundo plano: si al volver ya no tiene asiento, fue por ausencia
  bool _wasAway = false;

  late final ApiClient _api;
  late final ProviderContainer _container;
  late final AppLifecycleListener _lifecycle;

  final _scaffoldKey = GlobalKey<ScaffoldState>();

  /// Último mensaje de chat visto con el panel abierto (para el contador de no leídos)
  int _chatSeenId = 0;
  bool _chatOpen = false;

  /// Reconstruye cuando vence el próximo globo de chat
  Timer? _bubbleTimer;

  int get roomId => widget.roomId;

  bool _autoSitDone = false;

  /// Al llegar por una invitación: abrir la entrada en cuanto se vea la mesa
  void _maybeAutoSit(TableState state, int? myId) {
    if (!widget.autoSit || _autoSitDone || myId == null) return;
    _autoSitDone = true;
    final canSit = state.seatOf(myId) == null && state.tournament == null && state.seats.length < state.room.maxSeats;
    if (!canSit) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _showBuyIn(context, null);
    });
  }

  /// Sentado en una mesa normal con sitio: se puede invitar a amigos
  bool _canInvite(TableState state, TableSeat? mySeat) =>
      mySeat != null && !mySeat.leaving && state.tournament == null && state.seats.length < state.room.maxSeats;

  void _invite(TableState state) =>
      InviteFriendsSheet.show(context, roomId: roomId, freeSeats: state.room.maxSeats - state.seats.length);

  String _decisionKey(HandInfo hand) => '${hand.id}-${hand.street}';

  void _onState(TableState? prev, TableState next) {
    final me = ref.read(authControllerProvider).value;
    if (me != null) _checkSeatRemoved(prev, next, me.id);
    _maybeAutoSit(next, me?.id);
    final seat = me == null ? null : next.seatOf(me.id);
    // En torneo salir de la pantalla no te levanta: tus ciegas siguen corriendo
    _staying = seat != null && !seat.leaving && next.tournament == null;
    _followTournamentMove(next.tournament);
    if (_isVisible) _wasAway = false;
    final legal = next.you?.legalActions;
    final hand = next.hand;
    final myTurn = legal != null && hand != null;

    // Vibración al llegar tu turno (móvil)
    if (myTurn && !_wasMyTurn) {
      HapticFeedback.mediumImpact();
      Sounds.play(Sfx.tick);
    }
    _scheduleCountdown(myTurn ? hand.turnDeadline : null);
    _wasMyTurn = myTurn;

    // Las pre-acciones solo valen para la calle en que se marcaron
    if (_preAction != null && (hand == null || _decisionKey(hand) != _preActionKey)) {
      if (!(hand != null && _preAction == PreAction.checkFold)) {
        setState(() => _preAction = null);
      }
    }

    // Si cambió lo que hay que igualar, "Pasar" o "Igualar X" ya no valen
    final mine = me == null ? null : next.seatOf(me.id);
    if (_preAction != null && hand != null && mine != null && !myTurn) {
      final toCall = hand.currentBet - mine.committed;
      final stale = switch (_preAction!) {
        PreAction.check => toCall > 0,
        PreAction.call => toCall != _preActionCall,
        _ => false,
      };
      if (stale) setState(() => _preAction = null);
    }

    if (!myTurn || _preAction == null || me == null) return;
    final key = '${_decisionKey(hand)}-${hand.currentBet}';
    if (_executedKey == key) return;
    final action = resolvePreAction(_preAction!, legal, callAmount: _preActionCall);
    setState(() => _preAction = null);
    if (action == null) return;
    _executedKey = key;
    _act(action);
  }

  /// Tic-tac en los últimos segundos de tu turno
  static const _countdownSeconds = 5;
  final _countdown = <Timer>[];
  DateTime? _countdownFor;

  void _scheduleCountdown(DateTime? deadline) {
    if (deadline == _countdownFor) return;
    _cancelCountdown();
    _countdownFor = deadline;
    if (deadline == null) return;
    final now = DateTime.now();
    for (var k = _countdownSeconds; k >= 1; k--) {
      final at = deadline.subtract(Duration(seconds: k));
      if (at.isAfter(now)) _countdown.add(Timer(at.difference(now), () => Sounds.play(Sfx.tick)));
    }
  }

  void _cancelCountdown() {
    for (final t in _countdown) {
      t.cancel();
    }
    _countdown.clear();
    _countdownFor = null;
  }

  @override
  void initState() {
    super.initState();
    _api = ref.read(apiClientProvider);
    _container = ProviderScope.containerOf(context, listen: false);
    _lifecycle = AppLifecycleListener(onStateChange: _onLifecycle);
  }

  /// "inactive" no cuenta como salir: en web es solo que la ventana perdió el foco,
  /// en móvil una llamada o el panel de notificaciones encima de la app
  bool get _isVisible {
    final s = WidgetsBinding.instance.lifecycleState;
    return s == null || s == AppLifecycleState.resumed || s == AppLifecycleState.inactive;
  }

  void _onLifecycle(AppLifecycleState _) {
    if (!_isVisible) _wasAway = true;
    ref.read(tableControllerProvider(roomId).notifier).setActive(_isVisible);
  }

  @override
  void dispose() {
    // Salir de la mesa (lobby, otra pantalla, atrás del navegador) es levantarse.
    // Si cierra la app o la pestaña no llega aquí: lo levanta el servidor al dejar de verlo.
    if (_staying && !_leaveInFlight) {
      final container = _container;
      _api.leave(roomId).then((_) => container.invalidate(walletProvider), onError: (_) {}).ignore();
    }
    _lifecycle.dispose();
    _cancelCountdown();
    _bubbleTimer?.cancel();
    super.dispose();
  }

  Map<int, ChatMessage> _chatBubbles(List<ChatEntry> entries) {
    final now = DateTime.now();
    final bubbles = ref.read(tableChatProvider(roomId).notifier).bubbles(now);
    // Reconstruir cuando se apague el globo más próximo
    final next = entries
        .where((e) => e.live)
        .map((e) => e.receivedAt.add(chatBubbleDuration))
        .where((t) => t.isAfter(now))
        .fold<DateTime?>(null, (a, b) => a == null || b.isBefore(a) ? b : a);
    _bubbleTimer?.cancel();
    if (next != null) {
      _bubbleTimer = Timer(next.difference(now) + const Duration(milliseconds: 30), () {
        if (mounted) setState(() {});
      });
    }
    return bubbles;
  }

  int _unread(List<ChatEntry> entries, int myId) =>
      _chatOpen ? 0 : entries.where((e) => e.live && e.message.id > _chatSeenId && e.message.playerId != myId).length;

  void _showError(ScaffoldMessengerState messenger, ApiException e) {
    Sounds.play(Sfx.error);
    messenger.showSnackBar(SnackBar(content: Text(e.message)));
  }

  bool _moving = false;

  /// Torneo: al equilibrar las mesas te pueden cambiar de mesa. Se va a la nueva.
  void _followTournamentMove(TableTournament? tournament) {
    final target = tournament?.yourRoomId;
    if (_moving || target == null || target == roomId) return;
    _moving = true;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Te cambiamos de mesa para equilibrar el torneo. Sigues con tus fichas.')),
    );
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) context.pushReplacement('/rooms/$target');
    });
  }

  /// Torneo: eliminado o campeón
  Future<void> _showTournamentResult(TableTournament tournament, TournamentYou result) async {
    Sounds.play(result.status == 'winner' ? Sfx.shuffle : Sfx.error);
    final winner = result.status == 'winner';
    final goToStandings = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        icon: Icon(winner ? Icons.emoji_events : Icons.flag_outlined, color: PokerColors.gold, size: 40),
        title: Text(winner ? '¡Ganaste ${tournament.name}!' : 'Quedaste eliminado'),
        content: Text(
          [
            if (!winner) 'Terminaste en el puesto ${result.position}º de ${tournament.entrants}.',
            if (result.prize > 0) 'Tu premio: ${formatFichas(result.prize)} (ya está en tu cuenta).',
          ].join('\n'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialogContext, false), child: const Text('Cerrar')),
          FilledButton(onPressed: () => Navigator.pop(dialogContext, true), child: const Text('Ver clasificación')),
        ],
      ),
    );
    if (goToStandings == true && mounted) context.pushReplacement('/tournaments/${tournament.id}');
  }

  /// El servidor nos quitó el asiento: por un "Levantarse" diferido o por inactividad
  void _checkSeatRemoved(TableState? prev, TableState next, int myId) {
    final before = prev?.seatOf(myId);
    if (before == null || next.seatOf(myId) != null || _leaveInFlight) return;
    final tournament = next.tournament;
    if (tournament != null) {
      // En torneo solo se pierde el asiento al quedar eliminado, al ganar o al cambiar de mesa
      final result = tournament.yourResult;
      _preAction = null;
      if (result != null) {
        ref.invalidate(walletProvider);
        _showTournamentResult(tournament, result);
      }
      return;
    }
    final requested = _leaveRequested || before.leaving;
    final away = _wasAway;
    final busted = before.stack == 0 && !before.inHand;
    _leaveRequested = false;
    _preAction = null;
    ref.invalidate(walletProvider);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        duration: Duration(seconds: busted && !requested ? 10 : 6),
        // Sin fichas: llevarlo a donde puede conseguir más (rescate diario e invitaciones)
        action: busted && !requested
            ? SnackBarAction(label: 'Conseguir fichas', onPressed: () => context.go('/wallet'))
            : null,
        content: Text(
          requested
              ? 'Te levantaste de la mesa. Tus fichas volvieron a tu cuenta.'
              : busted
              ? 'Te quedaste sin fichas y te levantamos de la mesa. Puedes volver a sentarte cuando quieras.'
              : away
              ? 'Te levantamos de la mesa porque saliste de ella. Tus fichas volvieron a tu cuenta.'
              : 'Te levantamos de la mesa por inactividad (no actuaste en varias manos seguidas). '
                    'Tus fichas volvieron a tu cuenta.',
        ),
      ),
    );
  }

  Future<void> _act(String action, {int? amount}) async {
    try {
      await ref.read(tableControllerProvider(roomId).notifier).act(action, amount: amount);
    } on ApiException catch (e) {
      if (mounted) _showError(ScaffoldMessenger.of(context), e);
    }
  }

  @override
  Widget build(BuildContext context) {
    ref.listen(tableControllerProvider(roomId), (prev, next) {
      final value = next.value;
      if (value != null) _onState(prev?.value, value);
    });

    final table = ref.watch(tableControllerProvider(roomId));
    final me = ref.watch(authControllerProvider).value;
    final chat = ref.watch(tableChatProvider(roomId));

    final mySeat = me == null ? null : table.value?.seatOf(me.id);
    // Atrás del sistema (Android) estando sentado: igual que "Abandonar la mesa"
    return PopScope(
      canPop: mySeat == null || mySeat.leaving || table.value?.tournament != null,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _leave(context, thenExit: true);
      },
      child: Scaffold(
        key: _scaffoldKey,
        backgroundColor: PokerColors.background,
        endDrawer: ChatPanel(
          roomId: roomId,
          myPlayerId: me?.id ?? -1,
          seatedPlayerIds: {for (final s in table.value?.seats ?? const <TableSeat>[]) s.playerId},
        ),
        onEndDrawerChanged: (open) => setState(() {
          _chatOpen = open;
          _chatSeenId = chat.isEmpty ? 0 : chat.last.message.id;
        }),
        body: table.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(e.toString()),
                TextButton(
                  onPressed: () => ref.invalidate(tableControllerProvider(roomId)),
                  child: const Text('Reintentar'),
                ),
              ],
            ),
          ),
          data: (state) => _layout(context, state, me?.id ?? -1, chat),
        ),
      ),
    );
  }

  Widget _layout(BuildContext context, TableState state, int myId, List<ChatEntry> chat) {
    final mySeat = state.seatOf(myId);
    // Teléfono en horizontal: los controles van en una columna estrecha a la derecha
    final screen = MediaQuery.sizeOf(context);
    final narrowSide = screen.height < 500 && screen.width > screen.height * 1.5;
    final controls = _controls(context, state, mySeat, vertical: narrowSide);
    final reduceMotion = MediaQuery.maybeDisableAnimationsOf(context) ?? false;

    final scene = TableScene(
      background: !narrowSide,
      state: state,
      myPlayerId: myId,
      animate: !reduceMotion,
      chatBubbles: _chatBubbles(chat),
      onSitAt: mySeat == null && state.tournament == null ? (seat) => _showBuyIn(context, seat) : null,
      onInvite: _canInvite(state, mySeat) ? () => _invite(state) : null,
      onPlayerTap: (seat) => PlayerCardSheet.show(
        context,
        PlayerRef(id: seat.playerId, displayName: seat.displayName, avatar: seat.avatar),
      ),
    );
    // Jugada con la que ganaste la última mano (se resalta en la ayuda)
    final lastMine = state.lastHand?.players.where((p) => p.playerId == myId).firstOrNull;

    return LayoutBuilder(
      builder: (context, constraints) {
        final floating = constraints.maxWidth >= _floatingControlsWidth;
        // Teléfono en horizontal (poca altura): barra superior solo con iconos pequeños
        final compact = constraints.maxHeight < 500;
        final help = _GlassIconButton(
          icon: Icons.help_outline_rounded,
          tooltip: 'Manos de poker',
          compact: compact,
          onPressed: () => HandRankingsDialog.show(context, current: lastMine?.handName),
        );
        final chatButton = _ChatButton(
          unread: _unread(chat, myId),
          compact: compact,
          onPressed: () => _scaffoldKey.currentState?.openEndDrawer(),
        );
        final invite = _canInvite(state, mySeat)
            ? _GlassIconButton(
                key: const ValueKey('invite-friends'),
                icon: Icons.person_add_alt_1,
                tooltip: 'Invitar amigos',
                compact: compact,
                onPressed: () => _invite(state),
              )
            : null;
        final menu = _TableMenu(
          tournament: state.tournament != null,
          seated: mySeat != null,
          leaving: mySeat?.leaving ?? false,
          compact: compact,
          onLeaveTable: () => _leave(context, thenExit: true),
          onStandUp: mySeat == null || mySeat.leaving ? null : () => _leave(context),
        );
        final overlay = <Widget>[
          Positioned(
            top: 0,
            left: 0,
            child: SafeArea(
              child: _TableInfo(state: state, onBack: () => _leave(context, thenExit: true), compact: compact),
            ),
          ),
          Positioned(
            top: 0,
            right: 0,
            child: SafeArea(
              child: compact
                  ? Padding(
                      padding: const EdgeInsets.all(6),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          if (invite != null) ...[invite, const SizedBox(width: 6)],
                          chatButton,
                          const SizedBox(width: 6),
                          help,
                          const SizedBox(width: 6),
                          menu,
                        ],
                      ),
                    )
                  : Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        menu,
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 8),
                          child: Column(
                            children: [
                              chatButton,
                              const SizedBox(height: 8),
                              help,
                              if (invite != null) ...[const SizedBox(height: 8), invite],
                            ],
                          ),
                        ),
                      ],
                    ),
            ),
          ),
        ];

        // Teléfono en horizontal: controles en una columna a la derecha
        final side = !floating && constraints.maxWidth > constraints.maxHeight * 1.5;
        if (side) {
          final sideWidth = compact ? 200.0 : math.min(300.0, constraints.maxWidth * 0.32);
          // Un solo fondo para toda la pantalla: la mesa y el panel lateral quedan integrados
          return Stack(
            children: [
              const Positioned.fill(child: RepaintBoundary(child: TableBackground())),
              Row(
                children: [
                  Expanded(
                    child: SafeArea(
                      right: false,
                      child: Stack(
                        children: [
                          Positioned.fill(
                            child: Padding(
                              padding: EdgeInsets.only(top: compact ? 30 : 36),
                              child: scene,
                            ),
                          ),
                          ...overlay,
                        ],
                      ),
                    ),
                  ),
                  if (controls != null)
                    Container(
                      width: sideWidth + MediaQuery.paddingOf(context).right,
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          begin: Alignment.centerLeft,
                          end: Alignment.centerRight,
                          colors: [Color(0x990A0E18), Color(0xE60A0E18)],
                        ),
                        border: Border(left: BorderSide(color: PokerColors.gold.withValues(alpha: 0.35))),
                      ),
                      child: SafeArea(
                        left: false,
                        child: Align(
                          alignment: Alignment.bottomCenter,
                          child: SingleChildScrollView(child: controls),
                        ),
                      ),
                    ),
                ],
              ),
            ],
          );
        }

        if (floating) {
          return Stack(
            children: [
              Positioned.fill(
                child: Padding(padding: const EdgeInsets.only(bottom: 8), child: scene),
              ),
              ...overlay,
              if (controls != null) Positioned(right: 16, bottom: 16, width: 480, child: SafeArea(child: controls)),
            ],
          );
        }
        return Column(
          children: [
            Expanded(
              child: Stack(
                children: [
                  Positioned.fill(
                    child: Padding(padding: const EdgeInsets.only(top: 44), child: scene),
                  ),
                  ...overlay,
                ],
              ),
            ),
            if (controls != null)
              SafeArea(
                top: false,
                child: Padding(padding: const EdgeInsets.fromLTRB(8, 0, 8, 8), child: controls),
              ),
          ],
        );
      },
    );
  }

  Widget? _controls(BuildContext context, TableState state, TableSeat? mySeat, {bool vertical = false}) {
    final hand = state.hand;
    final legal = state.you?.legalActions;

    if (mySeat == null && state.tournament != null) return null;
    if (mySeat == null) {
      final full = state.seats.length >= state.room.maxSeats;
      return ControlPanel(
        flat: vertical,
        child: ActionButton(
          label: full ? 'Mesa llena' : 'Sentarse a jugar',
          color: PokerColors.actionRaise,
          dark: true,
          onPressed: full ? null : () => _showBuyIn(context, null),
        ),
      );
    }

    final myTurn = legal != null && hand != null;
    final status = switch ((hand, state.you)) {
      _ when myTurn => 'TU TURNO',
      (null, _) =>
        mySeat.stack == 0
            ? (state.tournament != null
                  ? 'Te quedaste sin fichas.'
                  : 'Te quedaste sin fichas: te levantarás al empezar la próxima mano.')
            : state.nextHandAt != null
            ? 'Próxima mano en'
            : state.playableCount < 2
            ? 'Esperando a los demás jugadores…'
            : 'Esperando la próxima mano…',
      (_, null) => 'Entrarás en la próxima mano',
      _ when mySeat.folded => 'Te retiraste de esta mano',
      _ when mySeat.allIn => 'Estás all-in · esperando el resultado',
      _ => 'Esperando tu turno · puedes decidir por adelantado',
    };

    return TableControls(
      vertical: vertical,
      mySeat: mySeat,
      hand: hand,
      legal: myTurn ? legal : null,
      status: status,
      countdownTo: hand == null && mySeat.stack > 0 ? state.nextHandAt : null,
      showCards: _showCardsOption(state, mySeat),
      onShowCards: _showCards,
      preAction: _preAction,
      onPreAction: (value) => setState(() {
        _preAction = value;
        if (hand != null) {
          _preActionKey = _decisionKey(hand);
          _preActionCall = hand.currentBet - mySeat.committed;
        }
      }),
      onAction: _act,
    );
  }

  /// Entre manos, si jugué la última y mis cartas no se vieron en el showdown
  ShowCardsOption? _showCardsOption(TableState state, TableSeat mySeat) {
    final last = state.lastHand;
    final cards = last?.yourCards;
    if (state.hand != null || last == null || cards == null) return null;
    final me = last.players.where((p) => p.seatNumber == mySeat.seatNumber).firstOrNull;
    if (me == null || (!last.canShow && !me.shown)) return null;
    return (cards: cards, shown: me.shown);
  }

  Future<void> _showCards() async {
    final messenger = ScaffoldMessenger.of(context);
    try {
      await ref.read(tableControllerProvider(roomId).notifier).showCards();
    } on ApiException catch (e) {
      messenger.showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  void _back() => context.canPop() ? context.pop() : context.go('/lobby');

  Future<void> _leave(BuildContext context, {bool thenExit = false}) async {
    final messenger = ScaffoldMessenger.of(context);
    final state = ref.read(tableControllerProvider(roomId)).value;
    final me = ref.read(authControllerProvider).value;
    final mySeat = state == null || me == null ? null : state.seatOf(me.id);
    if (state == null || mySeat == null || mySeat.leaving || state.tournament != null) {
      if (thenExit) _back();
      return;
    }

    // En plena mano levantarse equivale a retirarse: se pierde lo ya apostado
    final playingHand = state.hand != null && mySeat.inHand && !mySeat.folded;
    if (playingHand) {
      final ok = await showDialog<bool>(
        context: context,
        builder: (dialogContext) => AlertDialog(
          title: const Text('¿Levantarte ahora?'),
          content: const Text(
            'Estás jugando una mano: te retirarás de ella y perderás lo que ya apostaste. '
            'Te levantarás al terminar la mano y el resto de tus fichas volverá a tu cuenta.',
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(dialogContext, false), child: const Text('Seguir jugando')),
            FilledButton(onPressed: () => Navigator.pop(dialogContext, true), child: const Text('Levantarme')),
          ],
        ),
      );
      if (ok != true) return;
    }

    _leaveRequested = true;
    _leaveInFlight = true;
    try {
      final result = await ref.read(tableControllerProvider(roomId).notifier).leave();
      _staying = false;
      if (result.pending) {
        messenger.showSnackBar(
          const SnackBar(
            content: Text('Te retiraste de la mano. Te levantarás al terminarla y tus fichas volverán a tu cuenta.'),
          ),
        );
      } else {
        _leaveRequested = false;
        messenger.showSnackBar(
          SnackBar(content: Text('Te levantaste. ${formatFichas(result.cashedOut)} volvieron a tu cuenta.')),
        );
      }
      if (thenExit && mounted) _back();
    } on ApiException catch (e) {
      _leaveRequested = false;
      _showError(messenger, e);
    } finally {
      _leaveInFlight = false;
    }
  }

  /// [seatNumber] null: el servidor asigna el primer asiento libre
  Future<void> _showBuyIn(BuildContext context, int? seatNumber) async {
    final messenger = ScaffoldMessenger.of(context);
    final Room room;
    final Wallet wallet;
    try {
      room = await ref.read(roomProvider(roomId).future);
      wallet = await ref.read(walletProvider.future);
    } on ApiException catch (e) {
      _showError(messenger, e);
      return;
    }
    if (!context.mounted) return;

    final balance = wallet.balance;
    final buyIn = await showDialog<int>(
      context: context,
      builder: (_) => BuyInDialog(minBuyIn: room.minBuyIn, maxBuyIn: room.maxBuyIn, balance: balance),
    );
    if (buyIn == null) return;

    try {
      await ref.read(tableControllerProvider(roomId).notifier).sit(buyIn: buyIn, seatNumber: seatNumber);
    } on ApiException catch (e) {
      _showError(messenger, e);
    }
  }
}

class _TableInfo extends StatelessWidget {
  const _TableInfo({required this.state, required this.onBack, this.compact = false});
  final TableState state;
  final VoidCallback onBack;

  /// Teléfono en horizontal: solo los iconos (el nombre de la mesa ya está en el paño)
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final room = state.room;
    return Padding(
      padding: EdgeInsets.all(compact ? 6 : 8),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _GlassIconButton(icon: Icons.arrow_back, tooltip: 'Volver al lobby', compact: compact, onPressed: onBack),
          const SizedBox(width: 6),
          ValueListenableBuilder<bool>(
            valueListenable: Sounds.muted,
            builder: (_, muted, _) => _GlassIconButton(
              icon: muted ? Icons.volume_off : Icons.volume_up,
              tooltip: muted ? 'Activar sonido' : 'Silenciar',
              compact: compact,
              onPressed: Sounds.toggleMute,
            ),
          ),
          if (!compact) ...[
            const SizedBox(width: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: _glass,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(room.name, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14)),
                  Text(
                    'Ciegas ${formatChips(room.smallBlind)}/${formatChips(room.bigBlind)}'
                    '${state.hand != null ? ' · Mano #${state.hand!.number}' : ''}',
                    style: const TextStyle(fontSize: 11.5, color: PokerColors.muted),
                  ),
                  if (state.tournament case final t?)
                    Text(
                      tournamentLevelLabel(t),
                      style: const TextStyle(fontSize: 11.5, color: PokerColors.gold, fontWeight: FontWeight.w600),
                    ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/// Expuesto para pruebas
class TableMenuForTest extends StatelessWidget {
  const TableMenuForTest({super.key, required this.seated, this.leaving = false, this.tournament = false});
  final bool seated;
  final bool leaving;
  final bool tournament;

  @override
  Widget build(BuildContext context) => _TableMenu(
    tournament: tournament,
    seated: seated,
    leaving: leaving,
    onLeaveTable: () {},
    onStandUp: seated && !leaving ? () {} : null,
  );
}

class _TableMenu extends StatelessWidget {
  const _TableMenu({
    this.tournament = false,
    required this.seated,
    required this.leaving,
    required this.onLeaveTable,
    required this.onStandUp,
    this.compact = false,
  });
  final bool compact;

  /// Mesa de torneo: no se puede levantar; salir solo vuelve al lobby (sigue en juego)
  final bool tournament;
  final bool seated;
  final bool leaving;
  final VoidCallback onLeaveTable;
  final VoidCallback? onStandUp;

  @override
  Widget build(BuildContext context) {
    final popup = compact || MediaQuery.sizeOf(context).width < 700;
    if (popup) {
      return Padding(
        padding: EdgeInsets.all(compact ? 0 : 8),
        child: PopupMenuButton<String>(
          tooltip: 'Opciones de mesa',
          icon: Icon(Icons.more_vert, size: compact ? 20 : 24),
          style: IconButton.styleFrom(
            backgroundColor: const Color(0xB30A0E18),
            side: const BorderSide(color: PokerColors.border),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            minimumSize: compact ? const Size.square(36) : null,
            fixedSize: compact ? const Size.square(36) : null,
            padding: compact ? EdgeInsets.zero : null,
          ),
          onSelected: (v) => v == 'leave' ? onLeaveTable() : onStandUp?.call(),
          itemBuilder: (_) => [
            PopupMenuItem(value: 'leave', child: Text(tournament ? 'Salir al lobby' : 'Abandonar la mesa')),
            if (seated && !tournament)
              PopupMenuItem(
                value: 'stand',
                enabled: !leaving,
                child: Text(leaving ? 'Saliendo al terminar la mano…' : 'Levantarse'),
              ),
          ],
        ),
      );
    }
    return Padding(
      padding: const EdgeInsets.all(8),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          _MenuButton(label: tournament ? 'Salir al lobby' : 'Abandonar la mesa', onPressed: onLeaveTable),
          if (seated && !tournament) ...[
            const SizedBox(height: 6),
            _MenuButton(label: leaving ? 'Saliendo…' : 'Levantarse', onPressed: onStandUp),
          ],
        ],
      ),
    );
  }
}

const _glass = BoxDecoration(
  color: Color(0xB30A0E18),
  borderRadius: BorderRadius.all(Radius.circular(12)),
  border: Border.fromBorderSide(BorderSide(color: PokerColors.border)),
);

class _MenuButton extends StatelessWidget {
  const _MenuButton({required this.label, required this.onPressed});
  final String label;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) => SizedBox(
    width: 168,
    child: Material(
      color: Colors.transparent,
      child: Ink(
        decoration: _glass,
        child: InkWell(
          borderRadius: BorderRadius.circular(12),
          onTap: onPressed,
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 12),
            child: Text(
              label,
              textAlign: TextAlign.center,
              style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5),
            ),
          ),
        ),
      ),
    ),
  );
}

class _GlassIconButton extends StatelessWidget {
  const _GlassIconButton({
    super.key,
    required this.icon,
    required this.tooltip,
    required this.onPressed,
    this.compact = false,
  });
  final IconData icon;
  final String tooltip;
  final VoidCallback onPressed;

  /// Más pequeño para el teléfono en horizontal
  final bool compact;

  @override
  Widget build(BuildContext context) => Container(
    decoration: _glass,
    child: compact
        ? SizedBox.square(
            dimension: 36,
            child: IconButton(
              icon: Icon(icon, size: 20),
              tooltip: tooltip,
              padding: EdgeInsets.zero,
              onPressed: onPressed,
            ),
          )
        : IconButton(icon: Icon(icon), tooltip: tooltip, onPressed: onPressed),
  );
}

class BuyInDialog extends StatefulWidget {
  const BuyInDialog({
    super.key,
    required this.minBuyIn,
    required this.maxBuyIn,
    required this.balance,
    this.title = 'Entrar a la mesa',
  });
  final int minBuyIn;
  final int maxBuyIn;
  final int balance;
  final String title;

  @override
  State<BuyInDialog> createState() => _BuyInDialogState();
}

class _BuyInDialogState extends State<BuyInDialog> {
  late double _value = _max.toDouble();

  int get _max => widget.maxBuyIn < widget.balance ? widget.maxBuyIn : widget.balance;

  @override
  Widget build(BuildContext context) {
    final room = widget;
    final canAfford = widget.balance >= room.minBuyIn;

    return AlertDialog(
      title: Text(widget.title),
      content: canAfford
          ? Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text('Tienes ${formatFichas(widget.balance)}', style: const TextStyle(color: PokerColors.muted)),
                const SizedBox(height: 16),
                Text(
                  formatFichas(_value.round()),
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(color: PokerColors.gold),
                ),
                if (_max > room.minBuyIn)
                  Slider(
                    value: _value,
                    min: room.minBuyIn.toDouble(),
                    max: _max.toDouble(),
                    onChanged: (v) => setState(() => _value = v),
                  ),
                Text(
                  'Mín ${formatFichas(room.minBuyIn)} · Máx ${formatFichas(room.maxBuyIn)}',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ],
            )
          : Text(
              'Necesitas al menos ${formatFichas(room.minBuyIn)} para sentarte. '
              'Tienes ${formatFichas(widget.balance)}.',
            ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancelar')),
        if (canAfford)
          FilledButton(onPressed: () => Navigator.pop(context, _value.round()), child: const Text('Sentarse')),
      ],
    );
  }
}

/// Botón del chat con el contador de mensajes sin leer
class _ChatButton extends StatelessWidget {
  const _ChatButton({required this.unread, required this.onPressed, this.compact = false});
  final bool compact;
  final int unread;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) => Badge(
    isLabelVisible: unread > 0,
    label: Text(unread > 9 ? '9+' : '$unread'),
    backgroundColor: PokerColors.red,
    offset: const Offset(-2, 2),
    child: _GlassIconButton(
      icon: Icons.chat_bubble_outline_rounded,
      tooltip: 'Chat de la mesa',
      compact: compact,
      onPressed: onPressed,
    ),
  );
}

/// "Nivel 3 · suben a 80/160 en 2 manos · quedan 7"
String tournamentLevelLabel(TableTournament t) {
  final next = '${formatChips(t.nextSmallBlind)}/${formatChips(t.nextBigBlind)}';
  final hands = t.handsToNextLevel == 1 ? 'tras esta mano' : 'en ${t.handsToNextLevel} manos';
  return 'Nivel ${t.level} · suben a $next $hands · quedan ${t.playersLeft}';
}
