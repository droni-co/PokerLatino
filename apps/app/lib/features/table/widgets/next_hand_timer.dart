import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';

import '../../../core/sounds.dart';
import '../../../core/theme.dart';

/// Pausa habitual entre manos (`table.nextHandDelayMs` en la API): da la escala del anillo
const nextHandPause = Duration(seconds: 12);

/// Cuenta atrás en el centro de la mesa hasta la siguiente mano: un anillo dorado que se vacía
/// con los segundos en grande. En los últimos 3 segundos late y suena el tic.
class NextHandTimer extends StatefulWidget {
  const NextHandTimer({super.key, required this.deadline, required this.scale, this.sound = true});

  final DateTime deadline;
  final double scale;
  final bool sound;

  @override
  State<NextHandTimer> createState() => _NextHandTimerState();
}

class _NextHandTimerState extends State<NextHandTimer> with SingleTickerProviderStateMixin {
  late final Ticker _ticker = createTicker((_) => _tick());
  late Duration _total;
  int? _lastSecond;

  Duration get _remaining {
    final r = widget.deadline.difference(DateTime.now());
    return r.isNegative ? Duration.zero : r;
  }

  @override
  void initState() {
    super.initState();
    _total = _remaining > nextHandPause ? _remaining : nextHandPause;
    _lastSecond = _seconds;
    if (_remaining > Duration.zero) _ticker.start();
  }

  @override
  void didUpdateWidget(NextHandTimer old) {
    super.didUpdateWidget(old);
    // Cada consulta a la API corrige el plazo unos milisegundos: el anillo sigue, no se reinicia
    if (_remaining > _total) _total = _remaining;
    if (_remaining > Duration.zero && !_ticker.isActive) _ticker.start();
  }

  int get _seconds => (_remaining.inMilliseconds / 1000).ceil();

  void _tick() {
    final s = _seconds;
    if (s != _lastSecond) {
      _lastSecond = s;
      if (widget.sound && s > 0 && s <= 3) Sounds.play(Sfx.tick);
    }
    if (s == 0) _ticker.stop();
    setState(() {});
  }

  @override
  void dispose() {
    _ticker.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final s = widget.scale;
    final remaining = _remaining;
    final seconds = _seconds;
    final progress = (remaining.inMilliseconds / _total.inMilliseconds).clamp(0.0, 1.0);
    final urgent = seconds <= 3;
    // Late al cambiar de segundo cuando queda poco
    final frac = (remaining.inMilliseconds % 1000) / 1000;
    final pulse = urgent && seconds > 0 ? 1 + 0.12 * math.pow(frac, 3) : 1.0;
    final size = 50 * s;
    final color = urgent ? const Color(0xFFFFE08A) : PokerColors.gold;

    return Semantics(
      label: 'Siguiente mano en $seconds segundos',
      child: Column(
        key: const ValueKey('next-hand-timer'),
        mainAxisSize: MainAxisSize.min,
        children: [
          Transform.scale(
            scale: pulse.toDouble(),
            child: SizedBox.square(
              dimension: size,
              child: CustomPaint(
                painter: _RingPainter(progress: progress, color: color, stroke: 4 * s),
                child: Center(
                  child: Text(
                    seconds == 0 ? '¡Ya!' : '$seconds',
                    style: TextStyle(
                      color: color,
                      fontWeight: FontWeight.w900,
                      fontSize: (seconds == 0 ? 14 : 20) * s,
                      height: 1,
                      fontFeatures: const [FontFeature.tabularFigures()],
                    ),
                  ),
                ),
              ),
            ),
          ),
          SizedBox(height: 4 * s),
          Container(
            padding: EdgeInsets.symmetric(horizontal: 8 * s, vertical: 2 * s),
            decoration: BoxDecoration(
              color: Colors.black.withValues(alpha: 0.55),
              borderRadius: BorderRadius.circular(10 * s),
            ),
            child: Text(
              'SIGUIENTE MANO',
              style: TextStyle(
                color: Colors.white.withValues(alpha: 0.85),
                fontWeight: FontWeight.w800,
                fontSize: 9.5 * s,
                letterSpacing: 1.1,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _RingPainter extends CustomPainter {
  _RingPainter({required this.progress, required this.color, required this.stroke});
  final double progress;
  final Color color;
  final double stroke;

  @override
  void paint(Canvas canvas, Size size) {
    final c = size.center(Offset.zero);
    final r = size.shortestSide / 2 - stroke / 2;
    canvas.drawCircle(c, r + stroke / 2, Paint()..color = Colors.black.withValues(alpha: 0.6));
    canvas.drawCircle(
      c,
      r,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = stroke
        ..color = Colors.white.withValues(alpha: 0.12),
    );
    if (progress <= 0) return;
    canvas.drawArc(
      Rect.fromCircle(center: c, radius: r),
      -math.pi / 2,
      2 * math.pi * progress,
      false,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = stroke
        ..strokeCap = StrokeCap.round
        ..color = color
        ..maskFilter = const MaskFilter.blur(BlurStyle.solid, 2),
    );
  }

  @override
  bool shouldRepaint(_RingPainter old) => old.progress != progress || old.color != color;
}
