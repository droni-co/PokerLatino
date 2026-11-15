import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../core/game_assets.dart';
import '../../../core/theme.dart';

/// Carta en notación 'Ah', 'Td', '7c'...
class PlayingCard extends StatelessWidget {
  const PlayingCard({super.key, this.card, this.width = 44, this.dimmed = false, this.highlight = false});

  /// null = carta boca abajo
  final String? card;
  final double width;
  final bool dimmed;

  /// Borde dorado (cartas de la mano ganadora)
  final bool highlight;

  static const _suits = {'s': '♠', 'h': '♥', 'd': '♦', 'c': '♣'};

  static String rankLabel(String card) => card[0] == 'T' ? '10' : card[0];
  static String suitSymbol(String card) => _suits[card[1]] ?? '?';
  static bool isRed(String card) => card[1] == 'h' || card[1] == 'd';

  @override
  Widget build(BuildContext context) {
    final card = this.card;
    final child = card == null ? CardBack(width: width) : _face(card);
    if (!dimmed) return child;
    return ColorFiltered(colorFilter: const ColorFilter.mode(Color(0x88000000), BlendMode.srcATop), child: child);
  }

  /// Cara limpia: el valor grande arriba a la izquierda (lo que asoma cuando las cartas
  /// se abren en abanico) y un único palo grande en el centro.
  Widget _face(String card) {
    final height = width * 1.4;
    final color = isRed(card) ? PokerColors.cardRed : PokerColors.cardBlack;
    final rank = rankLabel(card);
    final suit = suitSymbol(card);
    final radius = width * 0.1;

    return Semantics(
      label: '$rank de ${_suitName(card)}',
      child: Container(
        width: width,
        height: height,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(radius),
          gradient: const LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Colors.white, PokerColors.cardFace],
          ),
          border: highlight
              ? Border.all(color: PokerColors.gold, width: width * 0.05)
              : Border.all(color: Colors.black.withValues(alpha: 0.18), width: math.max(0.5, width * 0.012)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.45),
              blurRadius: width * 0.12,
              offset: Offset(0, width * 0.04),
            ),
            if (highlight) BoxShadow(color: PokerColors.gold.withValues(alpha: 0.6), blurRadius: width * 0.3),
          ],
        ),
        child: Stack(
          children: [
            Positioned(
              left: width * 0.08,
              top: width * 0.04,
              child: Text(
                rank,
                style: TextStyle(
                  color: color,
                  fontWeight: FontWeight.w900,
                  fontSize: width * (rank.length > 1 ? 0.4 : 0.46),
                  height: 1.05,
                  letterSpacing: rank.length > 1 ? -width * 0.05 : 0,
                ),
              ),
            ),
            Positioned(
              left: 0,
              right: 0,
              bottom: width * 0.1,
              child: Center(
                child: Text(
                  suit,
                  style: TextStyle(color: color, fontSize: width * 0.72, height: 1),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  static String _suitName(String card) => switch (card[1]) {
    's' => 'picas',
    'h' => 'corazones',
    'd' => 'diamantes',
    _ => 'tréboles',
  };
}

/// Reverso: imagen `assets/game/card_back.png` si existe, si no un diseño vectorial
class CardBack extends StatelessWidget {
  const CardBack({super.key, required this.width});
  final double width;

  @override
  Widget build(BuildContext context) {
    final height = width * 1.4;
    final radius = BorderRadius.circular(width * 0.1);
    final asset = GameAssets.instance.path(GameAssets.cardBack);
    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        borderRadius: radius,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.45),
            blurRadius: width * 0.12,
            offset: Offset(0, width * 0.04),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: radius,
        child: asset != null ? Image.asset(asset, fit: BoxFit.cover) : CustomPaint(painter: _CardBackPainter()),
      ),
    );
  }
}

class _CardBackPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final rect = Offset.zero & size;
    canvas.drawRect(rect, Paint()..color = PokerColors.cardFace);
    final inner = rect.deflate(w * 0.07);
    final innerR = RRect.fromRectAndRadius(inner, Radius.circular(w * 0.06));
    canvas.drawRRect(
      innerR,
      Paint()
        ..shader = const LinearGradient(
          colors: [PokerColors.cardBack, PokerColors.cardBackDark],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ).createShader(inner),
    );
    // Rombos
    canvas.save();
    canvas.clipRRect(innerR);
    final line = Paint()
      ..color = Colors.white.withValues(alpha: 0.12)
      ..strokeWidth = w * 0.02;
    final step = w * 0.16;
    for (var x = -size.height; x < w + size.height; x += step) {
      canvas.drawLine(Offset(x, 0), Offset(x + size.height, size.height), line);
      canvas.drawLine(Offset(x + size.height, 0), Offset(x, size.height), line);
    }
    canvas.restore();
    // Filo dorado y monograma
    canvas.drawRRect(
      innerR.deflate(w * 0.04),
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = w * 0.025
        ..color = PokerColors.gold.withValues(alpha: 0.7),
    );
    final c = inner.center;
    final diamond = Path()
      ..moveTo(c.dx, c.dy - w * 0.22)
      ..lineTo(c.dx + w * 0.16, c.dy)
      ..lineTo(c.dx, c.dy + w * 0.22)
      ..lineTo(c.dx - w * 0.16, c.dy)
      ..close();
    canvas.drawPath(diamond, Paint()..color = PokerColors.gold);
    canvas.drawPath(
      diamond,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = w * 0.015
        ..color = PokerColors.cardBackDark,
    );
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

/// Carta que se voltea (reverso → cara) al aparecer
class FlipCard extends StatefulWidget {
  const FlipCard({
    super.key,
    required this.card,
    required this.width,
    this.animate = true,
    this.delay = Duration.zero,
    this.highlight = false,
    this.dimmed = false,
  });

  final String card;
  final double width;
  final bool animate;
  final Duration delay;
  final bool highlight;
  final bool dimmed;

  @override
  State<FlipCard> createState() => _FlipCardState();
}

class _FlipCardState extends State<FlipCard> with SingleTickerProviderStateMixin {
  late final _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 420),
    value: widget.animate ? 0 : 1,
  );

  @override
  void initState() {
    super.initState();
    if (widget.animate) {
      Future<void>.delayed(widget.delay, () {
        if (mounted) _controller.forward();
      });
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, _) {
        final t = Curves.easeInOut.transform(_controller.value);
        final angle = (1 - t) * math.pi;
        final showFace = angle < math.pi / 2;
        return Transform(
          alignment: Alignment.center,
          transform: Matrix4.identity()
            ..setEntry(3, 2, 0.0015)
            ..rotateY(showFace ? angle : angle - math.pi)
            ..scaleByDouble(1 + math.sin(t * math.pi) * 0.08, 1 + math.sin(t * math.pi) * 0.08, 1, 1),
          child: PlayingCard(
            card: showFace ? widget.card : null,
            width: widget.width,
            highlight: widget.highlight && t == 1,
            dimmed: widget.dimmed,
          ),
        );
      },
    );
  }
}

/// Hueco vacío para cartas comunitarias que aún no salen
class CardSlot extends StatelessWidget {
  const CardSlot({super.key, this.width = 44});
  final double width;

  @override
  Widget build(BuildContext context) => Container(
    width: width,
    height: width * 1.4,
    decoration: BoxDecoration(
      borderRadius: BorderRadius.circular(width * 0.1),
      border: Border.all(color: PokerColors.feltLine, width: 1.2),
      color: Colors.black.withValues(alpha: 0.08),
    ),
  );
}
