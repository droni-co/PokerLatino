import 'dart:ui';

import 'package:flutter_test/flutter_test.dart';
import 'package:poker_latino/core/models/models.dart';
import 'package:poker_latino/core/models/table_state.dart';
import 'package:poker_latino/features/table/table_events.dart';
import 'package:poker_latino/features/table/table_geometry.dart';
import 'package:poker_latino/features/table/table_logic.dart';

import '../fixtures.dart';

Json base() => Map<String, dynamic>.from(fixture('table_state_in_hand')['data'] as Json);

/// Modifica el estado en mano: [hand] campos de la mano, [seats] por número de asiento
TableState edit(Json json, {Json hand = const {}, Map<int, Json> seats = const {}}) {
  final h = {...json['hand'] as Json, ...hand};
  final s = [
    for (final seat in (json['seats'] as List).cast<Json>()) {...seat, ...?seats[seat['seatNumber']]},
  ];
  return TableState.fromJson({...json, 'hand': h, 'seats': s});
}

void main() {
  final json = base();
  final start = TableState.fromJson(json);

  test('sin estado previo no hay eventos (no se anima al entrar)', () {
    expect(diffStates(null, start), isEmpty);
  });

  test('mano nueva: reparto empezando a la izquierda del botón + ciegas', () {
    final before = edit(json, hand: {'id': 0});
    final events = diffStates(before, start);
    final started = events.whereType<HandStarted>().single;
    expect(started.dealOrder, [2, 3, 1]); // botón en el 1
    expect(events.whereType<BetMade>().map((b) => (b.seat, b.amount, b.label)), [(2, 5, null), (3, 10, null)]);
  });

  test('subida, igualada, retirada y pase', () {
    // Botón (1) sube a 30
    final raised = edit(json, hand: {'currentBet': 30, 'toActSeat': 2}, seats: {1: {'committed': 30}});
    expect(diffStates(start, raised).single, isA<BetMade>().having((b) => b.label, 'label', 'Sube').having((b) => b.amount, 'amount', 30));

    // SB (2) iguala
    final called = edit(json, hand: {'currentBet': 30, 'toActSeat': 3}, seats: {1: {'committed': 30}, 2: {'committed': 30}});
    expect(diffStates(raised, called).single, isA<BetMade>().having((b) => b.label, 'label', 'Iguala'));

    // BB (3) se retira
    final folded = edit(json, hand: {'currentBet': 30, 'toActSeat': null}, seats: {1: {'committed': 30}, 2: {'committed': 30}, 3: {'folded': true}});
    expect(diffStates(called, folded).single, isA<Folded>().having((f) => f.seat, 'seat', 3));

    // Flop: las apuestas van al bote, salen 3 cartas, y el 2 pasa
    final flop = edit(json,
        hand: {'street': 'flop', 'board': ['Ah', 'Kd', '7c'], 'currentBet': 0, 'pot': 70, 'toActSeat': 2},
        seats: {1: {'committed': 0}, 2: {'committed': 0}, 3: {'folded': true}});
    final events = diffStates(folded, flop);
    expect(events.first, isA<PotCollected>().having((p) => p.bets, 'bets', {1: 30, 2: 30, 3: 10}));
    expect(events.whereType<BoardDealt>().single.count, 3);

    final checked = edit(json,
        hand: {'street': 'flop', 'board': ['Ah', 'Kd', '7c'], 'currentBet': 0, 'pot': 70, 'toActSeat': 1},
        seats: {1: {'committed': 0}, 2: {'committed': 0}, 3: {'folded': true}});
    expect(diffStates(flop, checked).single, isA<Checked>().having((c) => c.seat, 'seat', 2));

    // Apuesta en el flop
    final bet = edit(json,
        hand: {'street': 'flop', 'board': ['Ah', 'Kd', '7c'], 'currentBet': 40, 'pot': 110, 'toActSeat': 2},
        seats: {1: {'committed': 40}, 2: {'committed': 0}, 3: {'folded': true}});
    expect((diffStates(checked, bet).single as BetMade).label, 'Apuesta');
  });

  test('fin de la mano: apuestas al bote, cartas restantes y ganador', () {
    final showdown = stateFrom('table_state_showdown');
    final events = diffStates(start, showdown);
    expect(events.whereType<PotCollected>().single.bets, {2: 5, 3: 10});
    expect(events.whereType<BoardDealt>().single.count, 5);
    final won = events.whereType<HandWon>().single;
    expect(won.showdown, isTrue);
    expect(won.winners.values.reduce((a, b) => a + b), 30);
  });

  group('pre-acciones', () {
    const facingBet = LegalActions(fold: true, check: false, call: 20, raise: BetRange(40, 500));
    const free = LegalActions(fold: true, check: true, bet: BetRange(10, 500));

    test('pasar/retirarse pasa si es gratis y se retira si hay apuesta', () {
      expect(resolvePreAction(PreAction.checkFold, free), 'check');
      expect(resolvePreAction(PreAction.checkFold, facingBet), 'fold');
    });

    test('"pasar" se descarta si alguien apostó', () {
      expect(resolvePreAction(PreAction.check, free), 'check');
      expect(resolvePreAction(PreAction.check, facingBet), isNull);
    });

    test('"igualar" solo si el monto no cambió', () {
      expect(resolvePreAction(PreAction.call, facingBet, callAmount: 20), 'call');
      expect(resolvePreAction(PreAction.call, facingBet, callAmount: 10), isNull);
      expect(resolvePreAction(PreAction.call, free, callAmount: 10), 'check');
    });

    test('"retirarse" nunca tira una mano que se puede ver gratis', () {
      expect(resolvePreAction(PreAction.fold, facingBet), 'fold');
      expect(resolvePreAction(PreAction.fold, free), 'check');
    });
  });

  group('geometría', () {
    for (final size in const [Size(390, 700), Size(800, 380), Size(1440, 860)]) {
      test('asientos dentro de la pantalla y el mío abajo ($size)', () {
        final g = TableGeometry.compute(size, maxSeats: 5);
        final screen = Offset.zero & size;
        for (final s in g.seats) {
          expect(screen.inflate(1).contains(s.avatarCenter), isTrue, reason: '${s.avatarCenter}');
        }
        expect(g.seats.first.isBottom, isTrue);
        expect(g.seats.first.avatarCenter.dx, closeTo(size.width / 2, 0.01));
        // El crupier queda arriba y el tablero entra en el paño
        expect(g.dealerPoint.dy, lessThan(g.center.dy));
        expect(g.feltRect.contains(g.boardSlot(0)) && g.feltRect.contains(g.boardSlot(4)), isTrue);
      });
    }
  });
}
