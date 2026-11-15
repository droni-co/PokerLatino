import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../core/models/table_state.dart';
import '../../../core/money.dart';
import '../../../core/sounds.dart';
import '../../../core/theme.dart';
import '../table_events.dart';
import '../table_geometry.dart';
import '../table_logic.dart';
import 'chips.dart';
import 'winner_effects.dart';
import 'flight_layer.dart';
import 'next_hand_timer.dart';
import 'playing_card.dart';
import 'seat_view.dart';
import 'table_surface.dart';

/// Tiempos de las animaciones
class TableTimings {
  static const dealStagger = Duration(milliseconds: 90);
  static const dealFlight = Duration(milliseconds: 320);
  static const chipFlight = Duration(milliseconds: 360);
  static const boardStagger = Duration(milliseconds: 140);
  static const boardFlight = Duration(milliseconds: 320);
  static const bubble = Duration(milliseconds: 2500);
  static const winnerShow = Duration(milliseconds: 3800);
}

/// Mesa completa con animaciones: reparto, fichas que viajan, cartas que se voltean,
/// burbujas de acción y celebración del ganador.
class TableScene extends StatefulWidget {
  const TableScene({
    super.key,
    required this.state,
    required this.myPlayerId,
    this.onSitAt,
    this.animate = true,
    this.chatBubbles = const {},
    this.background = true,
  });

  final TableState state;
  final int myPlayerId;

  /// Último mensaje de chat de cada jugador (playerId) que aún se muestra sobre su avatar
  final Map<int, ChatMessage> chatBubbles;

  /// false cuando la página pinta el fondo detrás de toda la pantalla (escena + controles)
  final bool background;

  /// Si el jugador no está sentado, permite elegir asiento
  final void Function(int seatNumber)? onSitAt;

  /// false en pruebas o con "reducir movimiento"
  final bool animate;

  @override
  State<TableScene> createState() => _TableSceneState();
}

class _TableSceneState extends State<TableScene> {
  final _flights = GlobalKey<FlightLayerState>();
  TableGeometry? _geo;

  final _cardsHiddenUntil = <int, DateTime>{};
  final _betsHiddenUntil = <int, DateTime>{};
  final _boardHiddenUntil = <int, DateTime>{};
  final _boardFlip = <int>{};
  final _bubbles = <int, (String, DateTime)>{};
  final _winners = <int, (int, DateTime, DateTime)>{}; // monto, desde, hasta
  final _flipHoleCards = <int>{}; // asientos cuyas cartas se voltean al aparecer
  Timer? _refresh;

  TableState get state => widget.state;

  @override
  void didUpdateWidget(TableScene old) {
    super.didUpdateWidget(old);
    if (!widget.animate || _geo == null || identical(old.state, widget.state)) return;
    final events = diffStates(old.state, widget.state);
    if (events.isNotEmpty) _play(events, old.state);
    _revealShownCards(old.state.lastHand, widget.state.lastHand);
  }

  /// Alguien enseñó sus cartas al terminar la mano: se voltean y avisa con un globo
  void _revealShownCards(LastHand? before, LastHand? after) {
    if (before == null || after == null || before.handId != after.handId) return;
    final until = DateTime.now().add(const Duration(milliseconds: 2500));
    for (final p in after.players) {
      final was = before.players.where((b) => b.playerId == p.playerId).firstOrNull;
      if (!p.shown || was == null || was.holeCards != null || _isMe(p.seatNumber)) continue;
      _flipHoleCards.add(p.seatNumber);
      _bubbles[p.seatNumber] = ('Enseña', until);
      Sounds.play(Sfx.flip);
    }
    _scheduleRefresh();
  }

  @override
  void dispose() {
    Sounds.cancelPending();
    _refresh?.cancel();
    super.dispose();
  }

  int _anchor() => state.seatOf(widget.myPlayerId)?.seatNumber ?? 1;

  SeatGeometry _seatGeo(int seatNumber) =>
      _geo!.seats[visualIndex(seatNumber, anchorSeat: _anchor(), maxSeats: state.room.maxSeats)];

  bool _isMe(int seatNumber) => state.seatAt(seatNumber)?.playerId == widget.myPlayerId;

  Offset _holeCardsPoint(int seatNumber) {
    final g = _seatGeo(seatNumber);
    return _isMe(seatNumber) ? _myCardsCenter(g) : g.cardsPoint;
  }

  Offset _myCardsCenter(SeatGeometry g) {
    final a = _geo!.avatarSize;
    return g.avatarCenter + Offset(a * 1.25, -a * 0.1);
  }

  double get _oppCardWidth => _geo!.avatarSize * 0.42;
  double get _myCardWidth => _geo!.avatarSize * 0.78;

  void _play(List<TableEvent> events, TableState prev) {
    final g = _geo!;
    final now = DateTime.now();
    final flights = <Flight>[];
    var cursor = Duration.zero;
    final bb = state.room.bigBlind;
    DateTime at(Duration d) => now.add(d);

    for (final e in events) {
      switch (e) {
        case HandStarted(:final dealOrder):
          _winners.clear();
          _bubbles.clear();
          _boardFlip.clear();
          _boardHiddenUntil.clear();
          Sounds.play(Sfx.shuffle);
          final n = dealOrder.length;
          for (var round = 0; round < 2; round++) {
            for (var i = 0; i < n; i++) {
              final seat = dealOrder[i];
              final delay = TableTimings.dealStagger * (round * n + i);
              final mine = _isMe(seat);
              Sounds.play(Sfx.deal, delay: delay + TableTimings.dealFlight * 0.6);
              flights.add(
                Flight(
                  from: g.dealerPoint,
                  to: _holeCardsPoint(seat) + Offset((round - 0.5) * (mine ? _myCardWidth : _oppCardWidth) * 0.5, 0),
                  child: CardBack(width: mine ? _myCardWidth : _oppCardWidth),
                  delay: delay,
                  duration: TableTimings.dealFlight,
                  fromScale: 0.5,
                  spin: math.pi * 2,
                ),
              );
              if (round == 1) {
                _cardsHiddenUntil[seat] = at(delay + TableTimings.dealFlight);
                if (mine) _flipHoleCards.add(seat);
              }
            }
          }
          cursor = TableTimings.dealStagger * (2 * n) + TableTimings.dealFlight;

        case BetMade(:final seat, :final amount, :final label):
          final sg = _seatGeo(seat);
          Sounds.play(Sfx.bet);
          flights.add(
            Flight(
              from: sg.avatarCenter,
              to: sg.betPoint,
              child: ChipStack(amount: amount, bigBlind: bb, size: 18 * g.scale),
              duration: TableTimings.chipFlight,
              arc: 12 * g.scale,
            ),
          );
          _betsHiddenUntil[seat] = at(TableTimings.chipFlight);
          if (label != null) _bubbles[seat] = (label, at(TableTimings.bubble));

        case Checked(:final seat):
          _bubbles[seat] = ('Pasa', at(TableTimings.bubble));
          Sounds.play(Sfx.click);

        case Folded(:final seat):
          _bubbles[seat] = ('No va', at(TableTimings.bubble));
          Sounds.play(Sfx.fold);
          final mine = _isMe(seat);
          final from = _holeCardsPoint(seat);
          for (var i = 0; i < 2; i++) {
            flights.add(
              Flight(
                from: from + Offset(i * 6.0, 0),
                to: g.dealerPoint,
                child: CardBack(width: mine ? _myCardWidth : _oppCardWidth),
                delay: Duration(milliseconds: i * 60),
                duration: const Duration(milliseconds: 420),
                curve: Curves.easeInCubic,
                toScale: 0.4,
                spin: -math.pi,
                fadeOut: true,
              ),
            );
          }

        case PotCollected(:final bets):
          if (bets.isNotEmpty) Sounds.play(Sfx.bet, delay: TableTimings.chipFlight * 0.7);
          for (final MapEntry(key: seat, value: amount) in bets.entries) {
            flights.add(
              Flight(
                from: _seatGeo(seat).betPoint,
                to: g.potPoint,
                child: ChipStack(amount: amount, bigBlind: bb, size: 18 * g.scale),
                duration: TableTimings.chipFlight,
                curve: Curves.easeInOutCubic,
              ),
            );
          }
          cursor += TableTimings.chipFlight;

        case BoardDealt(:final from, :final count):
          for (var k = 0; k < count; k++) {
            final index = from + k;
            final delay = cursor + TableTimings.boardStagger * k;
            Sounds.play(Sfx.deal, delay: delay + TableTimings.boardFlight * 0.6);
            Sounds.play(Sfx.flip, delay: delay + TableTimings.boardFlight);
            flights.add(
              Flight(
                from: g.dealerPoint,
                to: g.boardSlot(index),
                child: CardBack(width: g.boardCardWidth),
                delay: delay,
                duration: TableTimings.boardFlight,
                fromScale: 0.5,
              ),
            );
            _boardHiddenUntil[index] = at(delay + TableTimings.boardFlight);
            _boardFlip.add(index);
          }
          cursor += TableTimings.boardStagger * count + TableTimings.boardFlight;

        case HandWon(:final winners, :final showdown):
          final start = cursor + Duration(milliseconds: showdown ? 900 : 250);
          if (showdown) Sounds.play(Sfx.flip, delay: cursor + const Duration(milliseconds: 150));
          Sounds.play(Sfx.shuffle, delay: start + const Duration(milliseconds: 500));
          for (final MapEntry(key: seat, value: amount) in winners.entries) {
            flights.add(
              Flight(
                from: g.potPoint,
                to: _seatGeo(seat).avatarCenter,
                child: ChipStack(amount: amount, bigBlind: bb, size: 22 * g.scale),
                delay: start,
                duration: const Duration(milliseconds: 650),
                curve: Curves.easeInOutCubic,
                arc: 30 * g.scale,
              ),
            );
            final landed = at(start + const Duration(milliseconds: 650));
            _winners[seat] = (amount, landed, landed.add(TableTimings.winnerShow));
          }
          if (showdown) {
            for (final p in state.lastHand?.players ?? const <LastHandPlayer>[]) {
              if (!_isMe(p.seatNumber) && p.holeCards != null) _flipHoleCards.add(p.seatNumber);
            }
          }
      }
    }

    // Lanzar los vuelos después del frame actual (no se puede tocar otro estado durante build)
    WidgetsBinding.instance.addPostFrameCallback((_) => _flights.currentState?.launch(flights));
    _scheduleRefresh();
  }

  /// Reconstruye cuando vence el próximo "oculto hasta" / burbuja / celebración
  void _scheduleRefresh() {
    final now = DateTime.now();
    final times = <DateTime>[
      ..._cardsHiddenUntil.values,
      ..._betsHiddenUntil.values,
      ..._boardHiddenUntil.values,
      ..._bubbles.values.map((b) => b.$2),
      for (final w in _winners.values) ...[w.$2, w.$3],
    ].where((t) => t.isAfter(now)).toList()..sort();
    _refresh?.cancel();
    if (times.isEmpty) return;
    _refresh = Timer(times.first.difference(now) + const Duration(milliseconds: 16), () {
      if (!mounted) return;
      setState(() {});
      _scheduleRefresh();
    });
  }

  bool _hidden(Map<int, DateTime> map, int key, DateTime now) {
    final until = map[key];
    if (until == null) return false;
    if (now.isBefore(until)) return true;
    map.remove(key);
    return false;
  }

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final g = _geo = TableGeometry.compute(constraints.biggest, maxSeats: state.room.maxSeats);
        final now = DateTime.now();
        final hand = state.hand;
        final last = hand == null ? state.lastHand : null;
        final a = g.avatarSize;

        final children = <Widget>[
          if (widget.background) const Positioned.fill(child: RepaintBoundary(child: TableBackground())),
          // Crupier (imagen) detrás del riel superior
          if (DealerFigure.hasImage)
            Positioned(
              left: g.dealerFigurePoint.dx - a * 1.1,
              top: g.dealerFigurePoint.dy - a * 1.55,
              width: a * 2.2,
              height: a * 1.6,
              child: Align(
                alignment: Alignment.bottomCenter,
                child: DealerFigure(size: a * 1.6),
              ),
            ),
          Positioned.fill(
            child: RepaintBoundary(
              child: TableSurface(geometry: g, label: state.room.name),
            ),
          ),
          // Sin imagen: bandeja de fichas sobre el paño, junto al riel
          if (!DealerFigure.hasImage)
            _centered(Offset(g.center.dx, g.feltRect.top + a * 0.32), DealerFigure(size: a * 1.9)),
        ];

        // Bote
        if (hand != null && hand.pot > 0) {
          children.add(_centered(g.potPoint, _PotLabel(amount: hand.pot, state: state, scale: g.scale)));
        }

        // Entre manos: cuenta atrás hasta la siguiente, encima del tablero (la ven también los espectadores)
        final nextHandAt = state.nextHandAt;
        if (hand == null && nextHandAt != null) {
          final boardTop = g.boardCenter.dy - g.boardCardWidth * 0.7;
          children.add(
            Positioned(
              left: g.center.dx,
              top: boardTop - g.boardCardWidth * 0.3,
              child: FractionalTranslation(
                translation: const Offset(-0.5, -1),
                child: NextHandTimer(deadline: nextHandAt, scale: g.scale, sound: widget.animate),
              ),
            ),
          );
        }

        // Tablero. Tras el showdown, las cartas de la mano ganadora se iluminan y se elevan
        final board = hand?.board ?? last?.board ?? const <String>[];
        final boardHandId = hand?.id ?? last?.handId ?? 0;
        final winning = last != null && last.showdown ? last.winningCards : const <String>{};
        for (var i = 0; i < 5; i++) {
          final Widget slot;
          if (i < board.length && !_hidden(_boardHiddenUntil, i, now)) {
            final card = board[i];
            final flip = _boardFlip.remove(i);
            slot = WinningCard(
              key: ValueKey('board-win-$boardHandId-$i-${winning.isNotEmpty}'),
              state: winning.isEmpty
                  ? CardEmphasis.none
                  : (winning.contains(card) ? CardEmphasis.winner : CardEmphasis.loser),
              lift: g.boardCardWidth * 0.22,
              delay: widget.animate ? _showdownRevealDelay(flip) : Duration.zero,
              builder: (emphasis) => FlipCard(
                key: ValueKey('board-$boardHandId-$i-$card'),
                card: card,
                width: g.boardCardWidth,
                animate: flip,
                highlight: emphasis == CardEmphasis.winner,
                dimmed: emphasis == CardEmphasis.loser,
              ),
            );
          } else {
            slot = CardSlot(width: g.boardCardWidth);
          }
          children.add(_centered(g.boardSlot(i), slot));
        }

        // Resultado de la mano anterior, bajo el tablero
        if (last != null) {
          final lines = describeLastHand(last, state, (v) => formatChips(v));
          if (lines.isNotEmpty) {
            children.add(
              _centered(
                g.boardCenter + Offset(0, g.boardCardWidth * 1.15),
                _ResultBanner(key: ValueKey('result-${last.handId}'), text: lines.join('\n'), scale: g.scale),
              ),
            );
          }
        } else if (hand == null) {
          children.add(
            _centered(
              g.boardCenter + Offset(0, g.boardCardWidth * 1.15),
              _WaitingBanner(state: state, seated: state.seatOf(widget.myPlayerId) != null, scale: g.scale),
            ),
          );
        }

        // Apuestas frente a cada asiento
        for (final seat in state.seats) {
          if (seat.committed <= 0 || _hidden(_betsHiddenUntil, seat.seatNumber, now)) continue;
          children.add(
            _centered(
              _seatGeo(seat.seatNumber).betPoint,
              BetChips(amount: seat.committed, bigBlind: state.room.bigBlind, scale: g.scale),
            ),
          );
        }

        // Botón del dealer: se desliza al siguiente asiento
        if (hand != null) {
          final p = _seatGeo(hand.dealerSeat).dealerButtonPoint;
          final d = 22 * g.scale;
          children.add(
            AnimatedPositioned(
              key: const ValueKey('dealer-button'),
              duration: const Duration(milliseconds: 600),
              curve: Curves.easeInOutCubic,
              left: p.dx - d / 2,
              top: p.dy - d / 2,
              child: _DealerButton(size: d),
            ),
          );
        }

        // Asientos
        for (var n = 1; n <= state.room.maxSeats; n++) {
          final sg = _seatGeo(n);
          final seat = state.seatAt(n);
          if (seat == null) {
            children.add(
              _centered(
                sg.avatarCenter,
                EmptySeat(
                  seatNumber: n,
                  avatarSize: a,
                  onSit: widget.onSitAt == null ? null : () => widget.onSitAt!(n),
                ),
              ),
            );
            continue;
          }
          children.addAll(_seatWidgets(seat, sg, g, hand, last, now));
        }

        children.add(Positioned.fill(child: FlightLayer(key: _flights)));
        return Stack(clipBehavior: Clip.none, children: children);
      },
    );
  }

  Iterable<Widget> _seatWidgets(
    TableSeat seat,
    SeatGeometry sg,
    TableGeometry g,
    HandInfo? hand,
    LastHand? last,
    DateTime now,
  ) sync* {
    final a = g.avatarSize;
    final isMe = seat.playerId == widget.myPlayerId;
    final result = last?.players.where((p) => p.seatNumber == seat.seatNumber).firstOrNull;
    final hidden = _hidden(_cardsHiddenUntil, seat.seatNumber, now);
    final flip = _flipHoleCards.contains(seat.seatNumber);

    // Cartas
    final List<String>? faceUp = seat.holeCards ?? result?.holeCards;
    final showBacks = !isMe && seat.inHand && !seat.folded && faceUp == null;
    if (!hidden && (faceUp != null || showBacks)) {
      final width = isMe ? _myCardWidth : (faceUp != null ? a * 0.52 : _oppCardWidth);
      final center = isMe ? _myCardsCenter(sg) : sg.cardsPoint;
      final angles = isMe ? const [-0.12, 0.1] : const [-0.14, 0.14];
      if (flip) _flipHoleCards.remove(seat.seatNumber);
      final winning = last != null && last.showdown ? last.winningCards : const <String>{};
      for (var i = 0; i < 2; i++) {
        final card = faceUp != null && i < faceUp.length ? faceUp[i] : null;
        final offset = Offset((i - 0.5) * width * (isMe ? 0.62 : 0.5), i * width * 0.04);
        final emphasis = card == null || winning.isEmpty
            ? CardEmphasis.none
            : (winning.contains(card) ? CardEmphasis.winner : CardEmphasis.loser);
        yield _centered(
          center + offset,
          Transform.rotate(
            angle: angles[i],
            child: card == null
                ? CardBack(width: width)
                : WinningCard(
                    key: ValueKey('hole-win-${seat.seatNumber}-${last?.handId}-$i-${winning.isNotEmpty}'),
                    state: emphasis,
                    lift: width * 0.25,
                    delay: widget.animate ? _showdownRevealDelay(flip) : Duration.zero,
                    builder: (e) => FlipCard(
                      key: ValueKey('hole-${seat.seatNumber}-${hand?.id ?? last?.handId}-$card'),
                      card: card,
                      width: width,
                      animate: flip,
                      delay: Duration(milliseconds: i * 120),
                      highlight: e == CardEmphasis.winner,
                      dimmed: (seat.folded && hand != null) || e == CardEmphasis.loser,
                    ),
                  ),
          ),
        );
      }
    }

    final bubble = _bubbles[seat.seatNumber];
    final bubbleText = bubble != null && now.isBefore(bubble.$2) ? bubble.$1 : null;
    final win = _winners[seat.seatNumber];
    final winning = win != null && !now.isBefore(win.$2) && now.isBefore(win.$3);

    final ring = seatRingSize(a);
    final blockWidth = seatBlockWidth(a);
    yield Positioned(
      // La placa nunca se sale de la pantalla en asientos laterales
      left: (sg.avatarCenter.dx - blockWidth / 2).clamp(0.0, math.max(0.0, g.size.width - blockWidth)),
      top: sg.avatarCenter.dy - ring / 2,
      child: SeatView(
        seat: seat,
        isMe: isMe,
        avatarSize: a,
        hand: hand,
        actionTimeoutSeconds: state.room.actionTimeoutSeconds,
        bubble: bubbleText,
        chat: widget.chatBubbles[seat.playerId]?.body,
        wonAmount: winning ? win.$1 : null,
        isWinner: last != null && last.winners.containsKey(seat.seatNumber),
        celebrate: widget.animate,
        handName: result?.handName,
      ),
    );
  }

  /// Las cartas ganadoras se resaltan cuando ya se ven todas (tras voltearse)
  static Duration _showdownRevealDelay(bool flipping) =>
      flipping ? const Duration(milliseconds: 1500) : const Duration(milliseconds: 900);

  static Widget _centered(Offset p, Widget child) => Positioned(
    left: p.dx,
    top: p.dy,
    child: FractionalTranslation(translation: const Offset(-0.5, -0.5), child: child),
  );
}

class _PotLabel extends StatelessWidget {
  const _PotLabel({required this.amount, required this.state, required this.scale});
  final int amount;
  final TableState state;
  final double scale;

  @override
  Widget build(BuildContext context) {
    final s = scale;
    final collected = amount - state.seats.fold<int>(0, (sum, x) => sum + x.committed);
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (collected > 0) ...[
          ChipStack(amount: collected, bigBlind: state.room.bigBlind, size: 20 * s),
          SizedBox(width: 6 * s),
        ],
        Container(
          padding: EdgeInsets.symmetric(horizontal: 10 * s, vertical: 4 * s),
          decoration: BoxDecoration(
            color: Colors.black.withValues(alpha: 0.5),
            borderRadius: BorderRadius.circular(14 * s),
            border: Border.all(color: PokerColors.gold.withValues(alpha: 0.4)),
          ),
          child: TweenAnimationBuilder<double>(
            tween: Tween(end: amount.toDouble()),
            duration: const Duration(milliseconds: 450),
            builder: (context, v, _) => Text(
              'Bote ${formatChips(v.round())}',
              style: TextStyle(color: PokerColors.gold, fontWeight: FontWeight.w800, fontSize: 14 * s),
            ),
          ),
        ),
      ],
    );
  }
}

class _DealerButton extends StatelessWidget {
  const _DealerButton({required this.size});
  final double size;

  @override
  Widget build(BuildContext context) => Container(
    width: size,
    height: size,
    alignment: Alignment.center,
    decoration: const BoxDecoration(
      shape: BoxShape.circle,
      gradient: RadialGradient(colors: [Colors.white, Color(0xFFD9D4C7)]),
      boxShadow: [BoxShadow(color: Colors.black54, blurRadius: 4, offset: Offset(0, 2))],
    ),
    child: Text(
      'D',
      style: TextStyle(fontSize: size * 0.55, fontWeight: FontWeight.w900, color: Colors.black87),
    ),
  );
}

class _ResultBanner extends StatelessWidget {
  const _ResultBanner({super.key, required this.text, required this.scale});
  final String text;
  final double scale;

  @override
  Widget build(BuildContext context) {
    final s = scale;
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: const Duration(milliseconds: 500),
      curve: Curves.easeOutBack,
      builder: (context, t, child) => Opacity(
        opacity: t.clamp(0, 1),
        child: Transform.scale(scale: 0.8 + 0.2 * t, child: child),
      ),
      child: Container(
        padding: EdgeInsets.symmetric(horizontal: 14 * s, vertical: 6 * s),
        decoration: BoxDecoration(
          gradient: const LinearGradient(colors: [Color(0xDD2A1F06), Color(0xDD3B2B08)]),
          borderRadius: BorderRadius.circular(16 * s),
          border: Border.all(color: PokerColors.gold),
          boxShadow: [BoxShadow(color: PokerColors.gold.withValues(alpha: 0.25), blurRadius: 12)],
        ),
        child: Text(
          text,
          textAlign: TextAlign.center,
          style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 13.5 * s),
        ),
      ),
    );
  }
}

class _WaitingBanner extends StatelessWidget {
  const _WaitingBanner({required this.state, required this.seated, required this.scale});
  final TableState state;
  final bool seated;
  final double scale;

  @override
  Widget build(BuildContext context) {
    final count = state.seats.length;
    final players = '$count/${state.room.maxSeats} sentados';
    final text = !seated
        ? 'Toca «Sentarse» para jugar · $players'
        : state.playableCount < 2
        ? 'Esperando a los demás jugadores · $players'
        : 'La mano empieza en un momento…';
    return Container(
      padding: EdgeInsets.symmetric(horizontal: 12 * scale, vertical: 5 * scale),
      decoration: BoxDecoration(color: Colors.black45, borderRadius: BorderRadius.circular(16 * scale)),
      child: Text(
        text,
        style: TextStyle(color: Colors.white, fontSize: 13 * scale, fontWeight: FontWeight.w600),
      ),
    );
  }
}
