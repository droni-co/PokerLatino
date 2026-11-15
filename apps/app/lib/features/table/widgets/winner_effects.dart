import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../core/theme.dart';

/// Cómo se muestra una carta al final de la mano
enum CardEmphasis {
  /// Mano en curso o sin showdown
  none,

  /// Forma parte de la mano ganadora: se ilumina y se eleva
  winner,

  /// No forma parte: se oscurece para que destaquen las ganadoras
  loser,
}

/// Envuelve una carta: tras [delay], si es ganadora sube [lift] píxeles con un rebote
/// (como cuando el crupier separa la mano ganadora en una mesa real).
class WinningCard extends StatefulWidget {
  const WinningCard({
    super.key,
    required this.state,
    required this.builder,
    required this.lift,
    this.delay = Duration.zero,
  });

  final CardEmphasis state;
  final double lift;
  final Duration delay;

  /// Construye la carta con el énfasis vigente (none hasta que pasa [delay])
  final Widget Function(CardEmphasis emphasis) builder;

  @override
  State<WinningCard> createState() => _WinningCardState();
}

class _WinningCardState extends State<WinningCard> with SingleTickerProviderStateMixin {
  late final _controller = AnimationController(vsync: this, duration: const Duration(milliseconds: 550));
  bool _started = false;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _schedule();
  }

  @override
  void didUpdateWidget(WinningCard old) {
    super.didUpdateWidget(old);
    if (old.state != widget.state) {
      _started = false;
      _controller.value = 0;
      _schedule();
    }
  }

  void _schedule() {
    _timer?.cancel();
    if (widget.state == CardEmphasis.none) return;
    if (widget.delay == Duration.zero) {
      _started = true;
      _controller.value = 1;
      return;
    }
    _timer = Timer(widget.delay, () {
      if (!mounted) return;
      setState(() => _started = true);
      _controller.forward();
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final emphasis = _started ? widget.state : CardEmphasis.none;
    final card = widget.builder(emphasis);
    if (emphasis != CardEmphasis.winner) return card;
    return AnimatedBuilder(
      animation: _controller,
      child: card,
      builder: (context, child) {
        final t = Curves.easeOutBack.transform(_controller.value);
        return Transform.translate(
          offset: Offset(0, -widget.lift * t),
          child: Transform.scale(scale: 1 + 0.06 * t, child: child),
        );
      },
    );
  }
}

/// Rayos dorados que giran detrás del avatar del ganador (el sol del logo)
class WinnerRays extends StatefulWidget {
  const WinnerRays({super.key, required this.size, this.animate = true});
  final double size;
  final bool animate;

  @override
  State<WinnerRays> createState() => _WinnerRaysState();
}

class _WinnerRaysState extends State<WinnerRays> with TickerProviderStateMixin {
  late final _spin = AnimationController(vsync: this, duration: const Duration(seconds: 8));
  late final _appear = AnimationController(vsync: this, duration: const Duration(milliseconds: 500));

  @override
  void initState() {
    super.initState();
    if (widget.animate) {
      _spin.repeat();
      _appear.forward();
    } else {
      _appear.value = 1;
    }
  }

  @override
  void dispose() {
    _spin.dispose();
    _appear.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => IgnorePointer(
    child: AnimatedBuilder(
      animation: Listenable.merge([_spin, _appear]),
      builder: (context, _) => CustomPaint(
        size: Size.square(widget.size),
        painter: _RaysPainter(rotation: _spin.value * 2 * math.pi, opacity: Curves.easeOut.transform(_appear.value)),
      ),
    ),
  );
}

class _RaysPainter extends CustomPainter {
  _RaysPainter({required this.rotation, required this.opacity});
  final double rotation;
  final double opacity;

  @override
  void paint(Canvas canvas, Size size) {
    final c = size.center(Offset.zero);
    final r = size.shortestSide / 2;
    canvas.save();
    canvas.translate(c.dx, c.dy);
    canvas.rotate(rotation);
    const rays = 14;
    final paint = Paint()
      ..shader = RadialGradient(
        colors: [
          const Color(0xFFFFE08A).withValues(alpha: 0.95 * opacity),
          PokerColors.gold.withValues(alpha: 0.5 * opacity),
          PokerColors.gold.withValues(alpha: 0),
        ],
        stops: const [0.3, 0.72, 1],
      ).createShader(Rect.fromCircle(center: Offset.zero, radius: r));
    for (var i = 0; i < rays; i++) {
      final a = 2 * math.pi * i / rays;
      const half = math.pi / rays * 0.55;
      final path = Path()
        ..moveTo(0, 0)
        ..lineTo(math.cos(a - half) * r, math.sin(a - half) * r)
        ..lineTo(math.cos(a + half) * r, math.sin(a + half) * r)
        ..close();
      canvas.drawPath(path, paint);
    }
    canvas.restore();
    // Halo suave
    canvas.drawCircle(
      c,
      r * 0.45,
      Paint()
        ..color = PokerColors.gold.withValues(alpha: 0.28 * opacity)
        ..maskFilter = MaskFilter.blur(BlurStyle.normal, r * 0.18),
    );
  }

  @override
  bool shouldRepaint(_RaysPainter old) => old.rotation != rotation || old.opacity != opacity;
}

/// Lluvia de confeti que estalla una vez desde el centro
class ConfettiBurst extends StatefulWidget {
  const ConfettiBurst({super.key, required this.size, this.seed = 7});
  final double size;
  final int seed;

  @override
  State<ConfettiBurst> createState() => _ConfettiBurstState();
}

class _ConfettiBurstState extends State<ConfettiBurst> with SingleTickerProviderStateMixin {
  late final _controller = AnimationController(vsync: this, duration: const Duration(milliseconds: 1900))..forward();
  late final List<_Particle> _particles = _Particle.burst(widget.seed);

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => IgnorePointer(
    child: AnimatedBuilder(
      animation: _controller,
      builder: (context, _) =>
          CustomPaint(size: Size.square(widget.size), painter: _ConfettiPainter(_particles, _controller.value)),
    ),
  );
}

class _Particle {
  const _Particle(this.angle, this.speed, this.spin, this.color, this.width);
  final double angle;
  final double speed;
  final double spin;
  final Color color;
  final double width;

  static const _colors = [
    PokerColors.gold,
    Color(0xFFFFE08A),
    PokerColors.red,
    PokerColors.positive,
    Colors.white,
    Color(0xFF3FA9F5),
  ];

  static List<_Particle> burst(int seed) {
    final rnd = math.Random(seed);
    return List.generate(34, (i) {
      // Más partículas hacia arriba, como un estallido
      final angle = -math.pi / 2 + (rnd.nextDouble() - 0.5) * math.pi * 1.6;
      return _Particle(
        angle,
        0.55 + rnd.nextDouble() * 0.5,
        (rnd.nextDouble() - 0.5) * 14,
        _colors[i % _colors.length],
        0.6 + rnd.nextDouble() * 0.6,
      );
    });
  }
}

class _ConfettiPainter extends CustomPainter {
  _ConfettiPainter(this.particles, this.t);
  final List<_Particle> particles;
  final double t;

  @override
  void paint(Canvas canvas, Size size) {
    if (t <= 0 || t >= 1) return;
    final c = size.center(Offset.zero);
    final r = size.shortestSide / 2;
    final unit = size.shortestSide / 60;
    final fade = t < 0.7 ? 1.0 : (1 - t) / 0.3;
    for (final p in particles) {
      final travel = Curves.easeOutCubic.transform(t) * p.speed * r;
      final gravity = t * t * r * 0.55;
      final pos = c + Offset(math.cos(p.angle) * travel, math.sin(p.angle) * travel + gravity);
      canvas.save();
      canvas.translate(pos.dx, pos.dy);
      canvas.rotate(p.spin * t);
      canvas.drawRect(
        Rect.fromCenter(center: Offset.zero, width: unit * 2.2 * p.width, height: unit * 1.1),
        Paint()..color = p.color.withValues(alpha: fade),
      );
      canvas.restore();
    }
  }

  @override
  bool shouldRepaint(_ConfettiPainter old) => old.t != t;
}

/// Cinta "GANADOR" que aparece con un rebote bajo el avatar
class WinnerRibbon extends StatelessWidget {
  const WinnerRibbon({super.key, required this.scale, this.animate = true});
  final double scale;
  final bool animate;

  @override
  Widget build(BuildContext context) {
    final s = scale;
    final ribbon = Container(
      padding: EdgeInsets.symmetric(horizontal: 9 * s, vertical: 2.5 * s),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(8 * s),
        gradient: const LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Color(0xFFFFE08A), PokerColors.gold, PokerColors.goldDark],
        ),
        border: Border.all(color: const Color(0xFFFFF1C2)),
        boxShadow: [
          BoxShadow(color: PokerColors.gold.withValues(alpha: 0.6), blurRadius: 10 * s),
          const BoxShadow(color: Colors.black54, blurRadius: 4, offset: Offset(0, 2)),
        ],
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.emoji_events_rounded, size: 12 * s, color: const Color(0xFF2A1B04)),
          SizedBox(width: 3 * s),
          Text(
            'GANADOR',
            style: TextStyle(
              fontSize: 10.5 * s,
              fontWeight: FontWeight.w900,
              letterSpacing: 1,
              color: const Color(0xFF2A1B04),
            ),
          ),
        ],
      ),
    );
    if (!animate) return ribbon;
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: const Duration(milliseconds: 600),
      curve: Curves.elasticOut,
      builder: (context, t, child) => Transform.scale(scale: 0.3 + 0.7 * t, child: child),
      child: ribbon,
    );
  }
}
