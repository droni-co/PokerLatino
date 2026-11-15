import 'package:flutter/material.dart';

import 'game_assets.dart';
import 'theme.dart';

/// Piezas visuales compartidas de la marca "Noche Latina": fondo del salón, paneles con
/// filo dorado, logo, íconos ilustrados y botón dorado. Todas funcionan sin imágenes
/// (en pruebas o si falta un asset) con un dibujo por defecto.

/// Fondo del salón detrás de las pantallas, oscurecido para que el contenido se lea
class Backdrop extends StatelessWidget {
  const Backdrop({super.key, this.image, this.dim = 0.72, required this.child});

  /// Imagen de fondo; por defecto el salón del casino
  final String? image;

  /// Oscurecimiento sobre la imagen (0 = nada, 1 = negro)
  final double dim;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final asset = GameAssets.instance.path(image ?? GameAssets.background);
    return Stack(
      fit: StackFit.expand,
      children: [
        const DecoratedBox(
          decoration: BoxDecoration(
            gradient: RadialGradient(
              center: Alignment(0, -0.6),
              radius: 1.3,
              colors: [PokerColors.backgroundPattern, PokerColors.background],
            ),
          ),
        ),
        if (asset != null) ...[
          Image.asset(asset, fit: BoxFit.cover),
          DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  PokerColors.background.withValues(alpha: dim * 0.75),
                  PokerColors.background.withValues(alpha: dim),
                  PokerColors.background.withValues(alpha: (dim + 0.15).clamp(0, 1)),
                ],
              ),
            ),
          ),
        ],
        child,
      ],
    );
  }
}

/// Panel oscuro con filo dorado, el "contenedor" de la marca
class GoldPanel extends StatelessWidget {
  const GoldPanel({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(16),
    this.radius = 18,
    this.highlight = false,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final double radius;

  /// Borde dorado más intenso y resplandor (elemento destacado)
  final bool highlight;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: padding,
      decoration: panelDecoration(radius: radius, highlight: highlight),
      child: child,
    );
  }

  static BoxDecoration panelDecoration({double radius = 18, bool highlight = false}) => BoxDecoration(
    borderRadius: BorderRadius.circular(radius),
    gradient: LinearGradient(
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
      colors: [PokerColors.surfaceHigh.withValues(alpha: 0.92), PokerColors.surface.withValues(alpha: 0.94)],
    ),
    border: Border.all(
      color: PokerColors.gold.withValues(alpha: highlight ? 0.7 : 0.28),
      width: highlight ? 1.4 : 1,
    ),
    boxShadow: [
      const BoxShadow(color: Colors.black54, blurRadius: 18, offset: Offset(0, 8)),
      if (highlight) BoxShadow(color: PokerColors.gold.withValues(alpha: 0.18), blurRadius: 24),
    ],
  );
}

/// Título de sección con ornamento dorado: ── ♦ TÍTULO ♦ ──
class SectionTitle extends StatelessWidget {
  const SectionTitle(this.text, {super.key, this.icon});
  final String text;
  final String? icon;

  @override
  Widget build(BuildContext context) {
    Widget line(bool left) => Expanded(
      child: Container(
        height: 1,
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: left
                ? [Colors.transparent, PokerColors.gold.withValues(alpha: 0.6)]
                : [PokerColors.gold.withValues(alpha: 0.6), Colors.transparent],
          ),
        ),
      ),
    );
    return Row(
      children: [
        line(true),
        const SizedBox(width: 10),
        if (icon != null) ...[
          GameIcon(icon!, size: 28),
          const SizedBox(width: 8),
        ] else
          const Text('♦  ', style: TextStyle(color: PokerColors.gold, fontSize: 12)),
        // El texto tiene prioridad; las líneas se quedan con lo que sobre
        Flexible(
          flex: 8,
          child: Text(
            text.toUpperCase(),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              color: PokerColors.gold,
              fontWeight: FontWeight.w800,
              letterSpacing: 2.2,
              fontSize: 13,
            ),
          ),
        ),
        if (icon == null) const Text('  ♦', style: TextStyle(color: PokerColors.gold, fontSize: 12)),
        const SizedBox(width: 10),
        line(false),
      ],
    );
  }
}

/// Ícono ilustrado de `assets/game/ui/icons/<name>.png`, o un ícono Material si falta
class GameIcon extends StatelessWidget {
  const GameIcon(this.name, {super.key, this.size = 32});
  final String name;
  final double size;

  static const _fallbacks = <String, IconData>{
    'chips': Icons.toll,
    'hands': Icons.style,
    'trophy': Icons.emoji_events,
    'showdown': Icons.visibility,
    'wagered': Icons.stacked_bar_chart,
    'won': Icons.savings,
    'net': Icons.trending_up,
    'pot': Icons.workspace_premium,
  };

  @override
  Widget build(BuildContext context) {
    final asset = GameAssets.instance.icon(name);
    if (asset != null) {
      return Image.asset(asset, width: size, height: size, filterQuality: FilterQuality.medium);
    }
    return Icon(_fallbacks[name] ?? Icons.circle, size: size * 0.8, color: PokerColors.gold);
  }
}

/// Logo de Poker Latino (imagen) o el nombre en dorado si falta
class LogoMark extends StatelessWidget {
  const LogoMark({super.key, required this.height});
  final double height;

  @override
  Widget build(BuildContext context) {
    final asset = GameAssets.instance.path(GameAssets.logo);
    if (asset != null) {
      return Image.asset(asset, height: height, fit: BoxFit.contain, semanticLabel: 'Poker Latino');
    }
    return SizedBox(
      height: height,
      child: FittedBox(
        child: Text(
          'Poker Latino',
          style: TextStyle(
            color: PokerColors.gold,
            fontWeight: FontWeight.w900,
            fontSize: height * 0.6,
            letterSpacing: 1.5,
          ),
        ),
      ),
    );
  }
}

/// Botón principal: dorado con degradado y brillo
class GoldButton extends StatelessWidget {
  const GoldButton({super.key, required this.onPressed, required this.child, this.height = 52});
  final VoidCallback? onPressed;
  final Widget child;
  final double height;

  @override
  Widget build(BuildContext context) {
    final enabled = onPressed != null;
    final radius = BorderRadius.circular(height / 2);
    return Opacity(
      opacity: enabled ? 1 : 0.55,
      child: DecoratedBox(
        decoration: BoxDecoration(
          borderRadius: radius,
          gradient: const LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [Color(0xFFFFE08A), PokerColors.gold, PokerColors.goldDark],
            stops: [0, 0.45, 1],
          ),
          border: Border.all(color: const Color(0xFFFFF1C2), width: 1),
          boxShadow: [
            BoxShadow(color: PokerColors.gold.withValues(alpha: enabled ? 0.35 : 0), blurRadius: 16),
            const BoxShadow(color: Colors.black54, blurRadius: 6, offset: Offset(0, 3)),
          ],
        ),
        child: Material(
          type: MaterialType.transparency,
          child: InkWell(
            borderRadius: radius,
            onTap: onPressed,
            child: SizedBox(
              height: height,
              child: Center(
                child: DefaultTextStyle.merge(
                  style: const TextStyle(
                    color: Color(0xFF2A1B04),
                    fontWeight: FontWeight.w800,
                    fontSize: 16,
                    letterSpacing: 0.8,
                  ),
                  child: IconTheme.merge(
                    data: const IconThemeData(color: Color(0xFF2A1B04)),
                    child: Padding(padding: const EdgeInsets.symmetric(horizontal: 20), child: child),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
