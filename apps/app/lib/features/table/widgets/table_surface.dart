import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../core/game_assets.dart';
import '../../../core/theme.dart';
import '../table_geometry.dart';

/// Fondo de la sala: `assets/game/background.png` o un patrón sutil de palos
class TableBackground extends StatelessWidget {
  const TableBackground({super.key});

  @override
  Widget build(BuildContext context) {
    final asset = GameAssets.instance.path(GameAssets.background);
    if (asset != null) {
      return Image.asset(asset, fit: BoxFit.cover, width: double.infinity, height: double.infinity);
    }
    return const CustomPaint(painter: _BackgroundPainter(), size: Size.infinite);
  }
}

class _BackgroundPainter extends CustomPainter {
  const _BackgroundPainter();

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset.zero & size;
    canvas.drawRect(
      rect,
      Paint()
        ..shader = RadialGradient(
          center: const Alignment(0, -0.2),
          radius: 1.1,
          colors: [PokerColors.backgroundPattern, PokerColors.background],
        ).createShader(rect),
    );
    const suits = ['♠', '♥', '♦', '♣'];
    const step = 56.0;
    final painters = [
      for (final s in suits)
        TextPainter(
          text: TextSpan(
            text: s,
            style: TextStyle(fontSize: 16, color: Colors.white.withValues(alpha: 0.035)),
          ),
          textDirection: TextDirection.ltr,
        )..layout(),
    ];
    var row = 0;
    for (var y = 0.0; y < size.height + step; y += step, row++) {
      final offset = row.isEven ? 0.0 : step / 2;
      var col = 0;
      for (var x = -step + offset; x < size.width + step; x += step, col++) {
        painters[(row + col) % 4].paint(canvas, Offset(x, y));
      }
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

/// Mesa: `assets/game/table.png` estirada al óvalo, o riel de cuero + paño dibujados
class TableSurface extends StatelessWidget {
  const TableSurface({super.key, required this.geometry, required this.label});
  final TableGeometry geometry;

  /// Texto impreso en el paño (nombre de la sala)
  final String label;

  @override
  Widget build(BuildContext context) {
    final asset = GameAssets.instance.path(GameAssets.table);
    final rect = geometry.tableRect;
    return Stack(children: [
      Positioned.fromRect(
        rect: rect.inflate(geometry.railWidth * 0.2),
        child: asset != null
            ? Image.asset(asset, fit: BoxFit.fill)
            : CustomPaint(painter: _TablePainter(geometry)),
      ),
      // Marca en el paño
      Positioned.fromRect(
        rect: Rect.fromCenter(
          center: geometry.center + Offset(0, geometry.boardCardWidth * 1.25),
          width: geometry.radii.width * 1.4,
          height: geometry.boardCardWidth * 0.9,
        ),
        child: IgnorePointer(
          child: FittedBox(
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              Text(
                'POKER LATINO',
                style: TextStyle(
                  color: Colors.white.withValues(alpha: 0.12),
                  fontWeight: FontWeight.w900,
                  letterSpacing: 6,
                  fontSize: 40,
                ),
              ),
              Text(
                label.toUpperCase(),
                style: TextStyle(color: Colors.white.withValues(alpha: 0.1), letterSpacing: 4, fontSize: 18),
              ),
            ]),
          ),
        ),
      ),
    ]);
  }
}

class _TablePainter extends CustomPainter {
  _TablePainter(this.g);
  final TableGeometry g;

  RRect _stadium(Rect r) => RRect.fromRectAndRadius(r, Radius.circular(math.min(r.width, r.height) / 2));

  @override
  void paint(Canvas canvas, Size size) {
    final outer = Offset.zero & size;
    final rail = g.railWidth;
    final tableRect = outer.deflate(rail * 0.2);
    final feltRect = tableRect.deflate(rail);

    // Sombra en el piso
    canvas.drawRRect(
      _stadium(tableRect.shift(Offset(0, rail * 0.5))),
      Paint()
        ..color = Colors.black.withValues(alpha: 0.6)
        ..maskFilter = MaskFilter.blur(BlurStyle.normal, rail * 0.8),
    );

    // Riel de cuero
    canvas.drawRRect(
      _stadium(tableRect),
      Paint()
        ..shader = LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [PokerColors.railHighlight, PokerColors.feltEdge, const Color(0xFF24150D)],
          stops: const [0, 0.55, 1],
        ).createShader(tableRect),
    );
    // Costuras del riel
    canvas.drawRRect(
      _stadium(tableRect.deflate(rail * 0.5)),
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1
        ..color = Colors.black.withValues(alpha: 0.35),
    );
    // Filo dorado
    canvas.drawRRect(
      _stadium(feltRect.inflate(rail * 0.12)),
      Paint()
        ..shader = const LinearGradient(
          colors: [PokerColors.goldDark, PokerColors.railTrim, PokerColors.goldDark],
        ).createShader(feltRect),
    );
    // Paño
    canvas.drawRRect(
      _stadium(feltRect),
      Paint()
        ..shader = RadialGradient(
          radius: 0.75,
          colors: [PokerColors.felt, PokerColors.feltDark],
        ).createShader(feltRect),
    );
    // Sombra interior del riel sobre el paño
    canvas.save();
    canvas.clipRRect(_stadium(feltRect));
    canvas.drawRRect(
      _stadium(feltRect.inflate(rail * 0.4)),
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = rail
        ..color = Colors.black.withValues(alpha: 0.35)
        ..maskFilter = MaskFilter.blur(BlurStyle.normal, rail * 0.35),
    );
    canvas.restore();
    // Línea de apuestas
    canvas.drawRRect(
      _stadium(feltRect.deflate(rail * 1.6)),
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.5
        ..color = PokerColors.feltLine,
    );
  }

  @override
  bool shouldRepaint(_TablePainter old) => old.g.size != g.size;
}

/// Crupier detrás de la mesa: `assets/game/dealer.png` o una bandeja de fichas
class DealerFigure extends StatelessWidget {
  const DealerFigure({super.key, required this.size});
  final double size;

  static bool get hasImage => GameAssets.instance.path(GameAssets.dealer) != null;

  @override
  Widget build(BuildContext context) {
    final asset = GameAssets.instance.path(GameAssets.dealer);
    if (asset != null) return Image.asset(asset, width: size, height: size, fit: BoxFit.contain);

    // Bandeja de fichas del crupier
    const colors = [Color(0xFFD94848), Color(0xFF2F80ED), Color(0xFF27AE60), Color(0xFF1B1B1F), Color(0xFF9B51E0)];
    return Container(
      width: size,
      height: size * 0.32,
      padding: EdgeInsets.all(size * 0.03),
      decoration: BoxDecoration(
        color: const Color(0xFF1A120C),
        borderRadius: BorderRadius.circular(size * 0.06),
        border: Border.all(color: PokerColors.goldDark, width: 1.5),
        boxShadow: const [BoxShadow(color: Colors.black54, blurRadius: 8, offset: Offset(0, 3))],
      ),
      child: Row(children: [
        for (final c in colors)
          Expanded(
            child: Container(
              margin: EdgeInsets.symmetric(horizontal: size * 0.012),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(size * 0.03),
                gradient: LinearGradient(
                  colors: [Color.lerp(c, Colors.white, 0.25)!, c, Color.lerp(c, Colors.black, 0.4)!],
                  begin: Alignment.centerLeft,
                  end: Alignment.centerRight,
                ),
              ),
            ),
          ),
      ]),
    );
  }
}
