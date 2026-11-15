import 'dart:math' as math;

import 'package:flutter/painting.dart';

import '../../core/models/table_state.dart';

/// Posición visual (0 = abajo al centro, luego en sentido horario) de un asiento,
/// rotando la mesa para que el jugador siempre se vea abajo.
int visualIndex(int seatNumber, {required int anchorSeat, required int maxSeats}) =>
    (seatNumber - anchorSeat) % maxSeats;

/// Ubicación de cada posición visual alrededor de una elipse.
/// Índice 0 abajo al centro; avanza hacia la izquierda (sentido horario en pantalla).
List<Alignment> seatAlignments(int maxSeats) => List.generate(maxSeats, (i) {
      final angle = 2 * math.pi * i / maxSeats;
      return Alignment(-math.sin(angle) * 0.92, math.cos(angle) * 0.86);
    });

/// Opciones de apuesta/subida para el panel de acciones.
/// Todos los montos son "apostar/subir HASTA" (total en la calle), como espera la API.
class BetOptions {
  const BetOptions({
    required this.isBet,
    required this.min,
    required this.max,
    required this.presets,
  });

  final bool isBet;
  final int min;
  final int max;
  final List<({String label, int amount})> presets;

  String get action => isBet ? 'bet' : 'raise';

  static BetOptions? from(
    LegalActions legal, {
    required int pot,
    required int currentBet,
    required int committed,
  }) {
    final range = legal.bet ?? legal.raise;
    if (range == null) return null;
    final isBet = legal.bet != null;

    int clamp(int v) => v.clamp(range.min, range.max);

    // Bote después de igualar: base estándar para calcular "½ bote" y "bote"
    final toCall = math.max(0, currentBet - committed);
    final potAfterCall = pot + toCall;
    final half = isBet ? pot ~/ 2 : currentBet + potAfterCall ~/ 2;
    final full = isBet ? pot : currentBet + potAfterCall;

    final presets = <({String label, int amount})>[];
    void add(String label, int amount) {
      final value = clamp(amount);
      if (presets.every((p) => p.amount != value)) presets.add((label: label, amount: value));
    }

    add('Mín', range.min);
    add('½ bote', half);
    add('Bote', full);
    add('All-in', range.max);

    return BetOptions(isBet: isBet, min: range.min, max: range.max, presets: presets);
  }
}

/// Texto del resultado de la mano anterior, ej: "Jugador #3 gana 45 con Trío"
List<String> describeLastHand(
  LastHand last,
  TableState state,
  String Function(int amount) format,
) {
  return [
    for (final entry in last.winners.entries)
      () {
        final player = last.players.where((p) => p.seatNumber == entry.key).firstOrNull;
        final name = state.seatAt(entry.key)?.displayName ?? 'Asiento ${entry.key}';
        final hand = player?.handName;
        return '$name gana ${format(entry.value)}${hand != null ? ' con $hand' : ''}';
      }(),
  ];
}

/// Acción elegida por adelantado mientras no es tu turno
enum PreAction {
  fold('Retirarse'),
  check('Pasar'),
  checkFold('Pasar/Retirarse'),
  call('Igualar');

  const PreAction(this.label);
  final String label;
}

/// Qué enviar cuando llega tu turno con una pre-acción marcada.
/// null = la pre-acción ya no aplica (ej. alguien subió) y se descarta.
/// [callAmount] es lo que había que igualar cuando se marcó "Igualar".
String? resolvePreAction(PreAction pre, LegalActions legal, {int? callAmount}) => switch (pre) {
      PreAction.fold => legal.check ? 'check' : 'fold',
      PreAction.check => legal.check ? 'check' : null,
      PreAction.checkFold => legal.check ? 'check' : 'fold',
      PreAction.call => legal.check
          ? 'check'
          : legal.call != null && (callAmount == null || legal.call == callAmount)
              ? 'call'
              : null,
    };
