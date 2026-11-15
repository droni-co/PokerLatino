import '../../core/models/table_state.dart';

/// Lo que ocurrió entre dos estados consecutivos de la mesa.
/// La API se consulta periódicamente, así que se infiere comparando estados.
sealed class TableEvent {
  const TableEvent();
}

/// Nueva mano: reparto de 2 cartas a cada jugador en este orden de asientos
class HandStarted extends TableEvent {
  const HandStarted(this.handId, this.dealOrder);
  final int handId;
  final List<int> dealOrder;
}

class BoardDealt extends TableEvent {
  const BoardDealt(this.from, this.count);
  final int from;
  final int count;
}

class BetMade extends TableEvent {
  const BetMade(this.seat, this.amount, this.label);
  final int seat;
  final int amount;

  /// Texto de la burbuja ("Iguala", "Sube"...), null para ciegas
  final String? label;
}

class Folded extends TableEvent {
  const Folded(this.seat);
  final int seat;
}

class Checked extends TableEvent {
  const Checked(this.seat);
  final int seat;
}

/// Las apuestas de la calle se juntan en el bote
class PotCollected extends TableEvent {
  const PotCollected(this.bets);
  final Map<int, int> bets;
}

class HandWon extends TableEvent {
  const HandWon(this.winners, {required this.showdown});
  final Map<int, int> winners;
  final bool showdown;
}

/// Orden de reparto: empieza a la izquierda del botón
List<int> dealOrder(TableState state) {
  final hand = state.hand!;
  final max = state.room.maxSeats;
  final seats = state.seats.where((s) => s.inHand).map((s) => s.seatNumber).toList()
    ..sort((a, b) => ((a - hand.dealerSeat - 1) % max).compareTo((b - hand.dealerSeat - 1) % max));
  return seats;
}

List<TableEvent> diffStates(TableState? prev, TableState next) {
  if (prev == null) return const [];
  final events = <TableEvent>[];
  final ph = prev.hand;
  final nh = next.hand;

  Map<int, int> pendingBets(TableState s) => {
        for (final seat in s.seats)
          if (seat.committed > 0) seat.seatNumber: seat.committed,
      };

  // Mano nueva
  if (nh != null && (ph == null || ph.id != nh.id)) {
    events.add(HandStarted(nh.id, dealOrder(next)));
    for (final seat in next.seats) {
      if (seat.committed > 0) events.add(BetMade(seat.seatNumber, seat.committed, null));
    }
    if (nh.board.isNotEmpty) events.add(BoardDealt(0, nh.board.length));
    return events;
  }

  // Terminó la mano que estábamos viendo
  if (ph != null && nh == null) {
    final last = next.lastHand;
    if (last == null || last.handId != ph.id) return events;
    for (final seat in next.seats) {
      final before = prev.seatAt(seat.seatNumber);
      if (before != null && before.playerId == seat.playerId && !before.folded && seat.folded) {
        events.add(Folded(seat.seatNumber));
      }
    }
    final bets = pendingBets(prev);
    if (bets.isNotEmpty) events.add(PotCollected(bets));
    if (last.board.length > ph.board.length) {
      events.add(BoardDealt(ph.board.length, last.board.length - ph.board.length));
    }
    if (last.winners.isNotEmpty) events.add(HandWon(last.winners, showdown: last.showdown));
    return events;
  }

  if (ph == null || nh == null) return events;

  // Misma mano
  final streetChanged = ph.street != nh.street || nh.board.length != ph.board.length;
  final prevBet = streetChanged ? 0 : ph.currentBet;

  for (final seat in next.seats) {
    final before = prev.seatAt(seat.seatNumber);
    if (before == null || before.playerId != seat.playerId) continue;

    if (!before.folded && seat.folded) {
      events.add(Folded(seat.seatNumber));
      continue;
    }
    final base = streetChanged ? 0 : before.committed;
    final delta = seat.committed - base;
    if (delta > 0) {
      final label = seat.allIn
          ? 'All-in'
          : seat.committed > prevBet
              ? (prevBet == 0 ? 'Apuesta' : 'Sube')
              : 'Iguala';
      events.add(BetMade(seat.seatNumber, delta, label));
    } else if (ph.toActSeat == seat.seatNumber &&
        (nh.toActSeat != seat.seatNumber || streetChanged) &&
        !seat.folded &&
        before.committed == seat.committed) {
      events.add(Checked(seat.seatNumber));
    }
  }

  if (streetChanged) {
    final bets = pendingBets(prev);
    if (bets.isNotEmpty) events.insert(0, PotCollected(bets));
    if (nh.board.length > ph.board.length) {
      events.add(BoardDealt(ph.board.length, nh.board.length - ph.board.length));
    }
  }
  return events;
}
