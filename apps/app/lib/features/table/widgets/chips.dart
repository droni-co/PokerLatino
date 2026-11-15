import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../core/game_assets.dart';
import '../../../core/money.dart';
import '../../../core/theme.dart';

/// Colores de ficha según su valor en ciegas grandes
const _chipColors = [
  Color(0xFFF4F1E8), // < 1 BB
  Color(0xFFD94848), // 1 BB
  Color(0xFF2F80ED), // 5 BB
  Color(0xFF27AE60), // 25 BB
  Color(0xFF1B1B1F), // 100 BB
  Color(0xFF9B51E0), // 500 BB
];

/// Desglose aproximado de un monto en fichas (máx. [maxChips]) para dibujar la pila
List<Color> chipColorsFor(int amount, int bigBlind, {int maxChips = 5}) {
  if (amount <= 0) return const [];
  final bb = math.max(1, bigBlind);
  const values = [500, 100, 25, 5, 1];
  final result = <Color>[];
  var remaining = amount / bb;
  for (var i = 0; i < values.length && result.length < maxChips; i++) {
    while (remaining >= values[i] && result.length < maxChips) {
      result.add(_chipColors[5 - i]);
      remaining -= values[i];
    }
  }
  if (result.isEmpty) result.add(_chipColors[0]);
  return result.reversed.toList();
}

class Chip3D extends StatelessWidget {
  const Chip3D({super.key, required this.color, required this.size});
  final Color color;
  final double size;

  @override
  Widget build(BuildContext context) {
    final asset = GameAssets.instance.path(GameAssets.chip);
    if (asset != null) {
      return SizedBox.square(
        dimension: size,
        child: ColorFiltered(
          colorFilter: ColorFilter.mode(color.withValues(alpha: 0.55), BlendMode.modulate),
          child: Image.asset(asset),
        ),
      );
    }
    return CustomPaint(size: Size.square(size), painter: _ChipPainter(color));
  }
}

class _ChipPainter extends CustomPainter {
  _ChipPainter(this.color);
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final r = size.width / 2;
    final c = Offset(r, r);
    canvas.drawCircle(c + Offset(0, r * 0.12), r, Paint()..color = Colors.black45);
    canvas.drawCircle(c, r, Paint()..color = color);
    // Rayas del canto
    final stripe = Paint()
      ..color = Colors.white.withValues(alpha: color.computeLuminance() > 0.6 ? 0.0 : 0.85)
      ..style = PaintingStyle.stroke
      ..strokeWidth = r * 0.28;
    final edge = color.computeLuminance() > 0.6 ? const Color(0xFFD94848) : Colors.white;
    stripe.color = edge;
    for (var i = 0; i < 6; i++) {
      final a = i * math.pi / 3;
      canvas.drawArc(Rect.fromCircle(center: c, radius: r * 0.86), a, math.pi / 9, false, stripe);
    }
    canvas.drawCircle(
      c,
      r * 0.58,
      Paint()
        ..color = Colors.white.withValues(alpha: 0.85)
        ..style = PaintingStyle.stroke
        ..strokeWidth = r * 0.07,
    );
    canvas.drawCircle(c, r * 0.5, Paint()..color = Color.lerp(color, Colors.white, 0.12)!);
  }

  @override
  bool shouldRepaint(_ChipPainter old) => old.color != color;
}

/// Pila de fichas (vista en perspectiva, unas sobre otras)
class ChipStack extends StatelessWidget {
  const ChipStack({super.key, required this.amount, required this.bigBlind, required this.size});
  final int amount;
  final int bigBlind;
  final double size;

  @override
  Widget build(BuildContext context) {
    final colors = chipColorsFor(amount, bigBlind);
    final lift = size * 0.16;
    return SizedBox(
      width: size,
      height: size + lift * (colors.length - 1),
      child: Stack(children: [
        for (var i = 0; i < colors.length; i++)
          Positioned(
            left: 0,
            bottom: i * lift,
            child: Chip3D(color: colors[i], size: size),
          ),
      ]),
    );
  }
}

/// Apuesta de un jugador frente a su asiento: fichas + monto
class BetChips extends StatelessWidget {
  const BetChips({
    super.key,
    required this.amount,
    required this.bigBlind,
    required this.scale,
  });

  final int amount;
  final int bigBlind;
  final double scale;

  @override
  Widget build(BuildContext context) {
    return Row(mainAxisSize: MainAxisSize.min, children: [
      ChipStack(amount: amount, bigBlind: bigBlind, size: 18 * scale),
      SizedBox(width: 4 * scale),
      Container(
        padding: EdgeInsets.symmetric(horizontal: 6 * scale, vertical: 2 * scale),
        decoration: BoxDecoration(
          color: Colors.black.withValues(alpha: 0.55),
          borderRadius: BorderRadius.circular(10 * scale),
        ),
        child: Text(
          formatChips(amount),
          style: TextStyle(color: PokerColors.gold, fontSize: 12 * scale, fontWeight: FontWeight.w700),
        ),
      ),
    ]);
  }
}
