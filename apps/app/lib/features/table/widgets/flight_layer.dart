import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';

/// Un objeto (carta, fichas) que viaja de un punto a otro de la mesa
class Flight {
  Flight({
    required this.from,
    required this.to,
    required this.child,
    this.delay = Duration.zero,
    this.duration = const Duration(milliseconds: 380),
    this.curve = Curves.easeOutCubic,
    this.arc = 0,
    this.spin = 0,
    this.fromScale = 1,
    this.toScale = 1,
    this.fadeOut = false,
  });

  final Offset from;
  final Offset to;
  final Widget child;
  final Duration delay;
  final Duration duration;
  final Curve curve;

  /// Altura de la parábola en px (0 = recta)
  final double arc;

  /// Vueltas en radianes durante el vuelo
  final double spin;
  final double fromScale;
  final double toScale;
  final bool fadeOut;

  Duration? _startedAt;

  Duration get end => delay + duration;
}

/// Capa que dibuja los vuelos activos encima de la mesa
class FlightLayer extends StatefulWidget {
  const FlightLayer({super.key});

  @override
  State<FlightLayer> createState() => FlightLayerState();
}

class FlightLayerState extends State<FlightLayer> with SingleTickerProviderStateMixin {
  final _flights = <Flight>[];
  Duration _now = Duration.zero;
  late final Ticker _ticker = createTicker(_tick);

  void launch(Iterable<Flight> flights) {
    for (final f in flights) {
      f._startedAt = _now;
      _flights.add(f);
    }
    if (_flights.isNotEmpty && !_ticker.isActive) {
      _now = Duration.zero;
      for (final f in _flights) {
        f._startedAt = Duration.zero;
      }
      _ticker.start();
    }
    setState(() {});
  }

  void clear() {
    _flights.clear();
    if (_ticker.isActive) _ticker.stop();
    if (mounted) setState(() {});
  }

  void _tick(Duration elapsed) {
    _now = elapsed;
    _flights.removeWhere((f) => elapsed - f._startedAt! >= f.end);
    if (_flights.isEmpty) _ticker.stop();
    setState(() {});
  }

  @override
  void dispose() {
    _ticker.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: Stack(clipBehavior: Clip.none, children: [
        for (final f in _flights) ..._build(f),
      ]),
    );
  }

  Iterable<Widget> _build(Flight f) sync* {
    final local = _now - f._startedAt! - f.delay;
    if (local.isNegative) return;
    final raw = (local.inMicroseconds / f.duration.inMicroseconds).clamp(0.0, 1.0);
    final t = f.curve.transform(raw);
    final pos = Offset.lerp(f.from, f.to, t)! - Offset(0, math.sin(raw * math.pi) * f.arc);
    final scale = f.fromScale + (f.toScale - f.fromScale) * t;
    final opacity = f.fadeOut ? (1 - raw).clamp(0.0, 1.0) : 1.0;
    yield Positioned(
      left: pos.dx,
      top: pos.dy,
      child: FractionalTranslation(
        translation: const Offset(-0.5, -0.5),
        child: Opacity(
          opacity: opacity,
          child: Transform.rotate(
            angle: f.spin * t,
            child: Transform.scale(scale: scale, child: f.child),
          ),
        ),
      ),
    );
  }
}
