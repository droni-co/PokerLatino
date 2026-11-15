import 'package:flutter_test/flutter_test.dart';
import 'package:poker_latino/core/models/models.dart';
import 'package:poker_latino/core/models/table_state.dart';
import 'package:poker_latino/features/table/table_logic.dart';

import '../fixtures.dart';

void main() {
  group('visualIndex', () {
    test('mi asiento siempre queda en la posición 0 (abajo)', () {
      for (var anchor = 1; anchor <= 5; anchor++) {
        expect(visualIndex(anchor, anchorSeat: anchor, maxSeats: 5), 0);
      }
    });

    test('el resto mantiene el orden de la mesa', () {
      expect([for (var s = 1; s <= 5; s++) visualIndex(s, anchorSeat: 3, maxSeats: 5)], [3, 4, 0, 1, 2]);
    });
  });

  test('las posiciones de los asientos quedan dentro de la mesa', () {
    final a = seatAlignments(5);
    expect(a, hasLength(5));
    expect(a.first.y, greaterThan(0.8)); // abajo
    expect(a.every((x) => x.x.abs() <= 1 && x.y.abs() <= 1), isTrue);
  });

  group('BetOptions', () {
    test('sin apuesta ni subida posible → null', () {
      const legal = LegalActions(fold: true, check: false, call: 50);
      expect(BetOptions.from(legal, pot: 100, currentBet: 50, committed: 0), isNull);
    });

    test('apuesta: ½ bote y bote sobre el bote actual', () {
      const legal = LegalActions(fold: true, check: true, bet: BetRange(10, 500));
      final o = BetOptions.from(legal, pot: 60, currentBet: 0, committed: 0)!;
      expect(o.action, 'bet');
      expect(o.presets.map((p) => (p.label, p.amount)), [
        ('Mín', 10),
        ('½ bote', 30),
        ('Bote', 60),
        ('All-in', 500),
      ]);
    });

    test('subida: se calcula sobre el bote después de igualar', () {
      // Preflop: ciegas 5/10, bote 15, me toca con 0 puesto
      const legal = LegalActions(fold: true, check: false, call: 10, raise: BetRange(20, 500));
      final o = BetOptions.from(legal, pot: 15, currentBet: 10, committed: 0)!;
      expect(o.action, 'raise');
      // bote tras igualar = 25 → ½ = 10+12 = 22; bote = 10+25 = 35
      expect(o.presets.map((p) => p.amount), [20, 22, 35, 500]);
    });

    test('se recortan al rango y se eliminan duplicados', () {
      const legal = LegalActions(fold: true, check: true, bet: BetRange(10, 40));
      final o = BetOptions.from(legal, pot: 200, currentBet: 0, committed: 0)!;
      expect(o.presets.map((p) => (p.label, p.amount)), [('Mín', 10), ('½ bote', 40)]);
    });
  });

  test('resumen de la mano anterior', () {
    final s = TableState.fromJson(fixture('table_state_showdown')['data'] as Json);
    final lines = describeLastHand(s.lastHand!, s, (a) => '$a');
    expect(lines, hasLength(1));
    expect(lines.single, matches(RegExp(r'^Jugador #\d+ gana 30 con .+$')));
  });
}
