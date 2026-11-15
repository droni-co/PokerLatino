import 'package:flutter_test/flutter_test.dart';
import 'package:poker_latino/core/models/models.dart';
import 'package:poker_latino/core/models/table_state.dart';

import '../fixtures.dart';

void main() {
  test('estado de mesa durante una mano', () {
    final s = TableState.fromJson(fixture('table_state_in_hand')['data'] as Json);
    expect(s.room.maxSeats, 5);
    expect(s.hand!.street, 'preflop');
    expect(s.hand!.pot, 15);
    expect(s.hand!.turnDeadline, isNotNull);
    expect(s.seats, hasLength(3));
    expect(s.you!.holeCards, hasLength(2));
    // Las cartas de los rivales nunca llegan
    expect(s.seats.where((x) => x.seatNumber != s.you!.seatNumber).every((x) => x.holeCards == null), isTrue);

    final legal = s.you!.legalActions!;
    expect(legal.fold, isTrue);
    expect(legal.check, isFalse);
    expect(legal.call, 10);
    expect(legal.bet, isNull);
    expect((legal.raise!.min, legal.raise!.max), (20, 500));
  });

  test('estado de mesa después de un showdown', () {
    final s = TableState.fromJson(fixture('table_state_showdown')['data'] as Json);
    expect(s.hand, isNull);
    final last = s.lastHand!;
    expect(last.showdown, isTrue);
    expect(last.board, hasLength(5));
    expect(last.totalPot, 30);
    expect(last.winners.values.fold<int>(0, (a, b) => a + b), last.totalPot);
    expect(last.players.every((p) => p.holeCards?.length == 2 && p.handName != null), isTrue);
    // Sin comisión: lo que unos ganan, otros lo pierden
    expect(last.players.fold<int>(0, (a, p) => a + p.net), 0);
  });

  test('salas, billetera de fichas, movimientos, estadísticas y configuración', () {
    final rooms = (fixture('rooms')['data'] as List).map((r) => Room.fromJson(r as Json)).toList();
    expect(rooms.first.minBuyIn, 400);
    expect(rooms.first.seatedCount, 3);
    expect(rooms.first.blindsLabel, '5 / 10');

    expect(Wallet.fromJson(fixture('wallet')['data'] as Json).balance, 500);

    final txs = (fixture('transactions')['data'] as List).map((t) => WalletTransaction.fromJson(t as Json)).toList();
    expect(txs.map((t) => t.label), ['Entrada a mesa', 'Fichas de bienvenida']);
    expect(txs.first.amount, -500);

    final stats = PlayerStat.fromJson(fixture('stats')['data'] as Json);
    expect((stats.handsPlayed, stats.net), (1, -10));

    final config = GameConfig.fromJson(fixture('game_config')['data'] as Json);
    expect(config.signupBonus, 1000);
    expect(config.rake, 0);
    expect(config.maxSeats, 5);
  });

  test('asiento: retiro pendiente e inactividad (con valores por omisión)', () {
    final base = {
      'seatNumber': 2,
      'player': {'id': 9, 'displayName': 'Ana'},
      'stack': 500,
    };
    final plain = TableSeat.fromJson(base);
    expect(plain.leaving, isFalse);
    expect(plain.missedHands, 0);

    final flagged = TableSeat.fromJson({...base, 'leaving': true, 'missedHands': 1});
    expect(flagged.leaving, isTrue);
    expect(flagged.missedHands, 1);
  });
}
