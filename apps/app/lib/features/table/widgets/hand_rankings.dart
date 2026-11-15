import 'package:flutter/material.dart';

import '../../../core/brand.dart';
import '../../../core/theme.dart';
import 'playing_card.dart';

/// Una jugada de poker con un ejemplo. [used] = índices de las cartas que forman la jugada.
typedef HandRank = ({String name, String description, List<String> example, Set<int> used});

/// De la mejor a la peor. Los nombres coinciden con los que muestra el servidor.
const List<HandRank> handRankings = [
  (
    name: 'Escalera real',
    description: 'A, K, Q, J y 10 del mismo palo. La mejor mano posible.',
    example: ['Ah', 'Kh', 'Qh', 'Jh', 'Th'],
    used: {0, 1, 2, 3, 4},
  ),
  (
    name: 'Escalera de color',
    description: 'Cinco cartas seguidas del mismo palo.',
    example: ['9s', '8s', '7s', '6s', '5s'],
    used: {0, 1, 2, 3, 4},
  ),
  (
    name: 'Póker',
    description: 'Cuatro cartas del mismo valor.',
    example: ['Qc', 'Qd', 'Qh', 'Qs', '7d'],
    used: {0, 1, 2, 3},
  ),
  (name: 'Full', description: 'Un trío y una pareja.', example: ['Kh', 'Kd', 'Ks', '4c', '4h'], used: {0, 1, 2, 3, 4}),
  (
    name: 'Color',
    description: 'Cinco cartas del mismo palo, no seguidas.',
    example: ['Ad', 'Jd', '8d', '5d', '2d'],
    used: {0, 1, 2, 3, 4},
  ),
  (
    name: 'Escalera',
    description: 'Cinco cartas seguidas de distintos palos. El As puede ir arriba (A-K-Q-J-10) o abajo (5-4-3-2-A).',
    example: ['Tc', '9d', '8h', '7s', '6c'],
    used: {0, 1, 2, 3, 4},
  ),
  (name: 'Trío', description: 'Tres cartas del mismo valor.', example: ['7c', '7d', '7s', 'Kh', '2c'], used: {0, 1, 2}),
  (
    name: 'Doble pareja',
    description: 'Dos parejas distintas.',
    example: ['Jh', 'Jc', '4d', '4s', 'Ad'],
    used: {0, 1, 2, 3},
  ),
  (name: 'Pareja', description: 'Dos cartas del mismo valor.', example: ['Th', 'Ts', '9c', '6d', '3h'], used: {0, 1}),
  (
    name: 'Carta alta',
    description: 'Ninguna de las anteriores: cuenta la carta más alta.',
    example: ['Ac', 'Qd', '8s', '6h', '3c'],
    used: {0},
  ),
];

/// Ayuda para jugadores nuevos: clasificación de manos de la mejor a la peor
class HandRankingsDialog extends StatelessWidget {
  const HandRankingsDialog({super.key, this.current});

  /// Jugada a resaltar (p. ej. la que acaba de ganar)
  final String? current;

  static Future<void> show(BuildContext context, {String? current}) => showDialog<void>(
    context: context,
    builder: (_) => HandRankingsDialog(current: current),
  );

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;
    // En teléfonos las cartas van debajo del texto
    final stacked = width < 520;
    final cardWidth = stacked ? 34.0 : 36.0;

    return Dialog(
      insetPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 24),
      backgroundColor: Colors.transparent,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 560),
        child: GoldPanel(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 12),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  const Expanded(child: SectionTitle('Manos de poker')),
                  IconButton(tooltip: 'Cerrar', icon: const Icon(Icons.close), onPressed: () => Navigator.pop(context)),
                ],
              ),
              const Padding(
                padding: EdgeInsets.only(bottom: 10),
                child: Text(
                  'Gana la mejor combinación de 5 cartas entre tus 2 cartas y las 5 de la mesa. '
                  'De la mejor a la peor:',
                  style: TextStyle(color: PokerColors.muted, fontSize: 13),
                ),
              ),
              Flexible(
                child: ListView.separated(
                  shrinkWrap: true,
                  itemCount: handRankings.length,
                  separatorBuilder: (_, _) => const Divider(height: 1),
                  itemBuilder: (_, i) => _RankRow(
                    position: i + 1,
                    rank: handRankings[i],
                    cardWidth: cardWidth,
                    stacked: stacked,
                    highlight: handRankings[i].name == current,
                  ),
                ),
              ),
              const Padding(
                padding: EdgeInsets.only(top: 10),
                child: Text(
                  'Empate en la jugada: gana quien tenga las cartas más altas (primero las de la jugada, '
                  'luego las demás). Los palos no desempatan; si todo es igual, se reparte el bote.',
                  style: TextStyle(color: PokerColors.muted, fontSize: 12),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _RankRow extends StatelessWidget {
  const _RankRow({
    required this.position,
    required this.rank,
    required this.cardWidth,
    required this.highlight,
    required this.stacked,
  });
  final int position;
  final HandRank rank;
  final double cardWidth;
  final bool highlight;
  final bool stacked;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 6),
      decoration: highlight
          ? BoxDecoration(
              color: PokerColors.gold.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: PokerColors.gold.withValues(alpha: 0.6)),
            )
          : null,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 22,
            child: Text(
              '$position',
              style: const TextStyle(color: PokerColors.gold, fontWeight: FontWeight.w900, fontSize: 15),
            ),
          ),
          Expanded(
            child: stacked
                ? Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [_text(), const SizedBox(height: 8), _cards()],
                  )
                : Row(
                    children: [
                      Expanded(child: _text()),
                      const SizedBox(width: 8),
                      _cards(),
                    ],
                  ),
          ),
        ],
      ),
    );
  }

  Widget _text() => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(rank.name, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14.5)),
      const SizedBox(height: 2),
      Text(rank.description, style: const TextStyle(color: PokerColors.muted, fontSize: 12)),
    ],
  );

  Widget _cards() => Padding(
    padding: const EdgeInsets.only(top: 3),
    child: Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        for (final (i, card) in rank.example.indexed)
          Padding(
            padding: EdgeInsets.only(left: i == 0 ? 0 : 3),
            child: Transform.translate(
              offset: Offset(0, rank.used.contains(i) ? -3 : 0),
              child: PlayingCard(
                card: card,
                width: cardWidth,
                highlight: rank.used.contains(i),
                dimmed: !rank.used.contains(i),
              ),
            ),
          ),
      ],
    ),
  );
}
