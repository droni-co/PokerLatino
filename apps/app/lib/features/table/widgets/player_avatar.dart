import 'dart:math' as math;

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';

import '../../../core/game_assets.dart';
import '../../../core/theme.dart';

const _avatarGradients = [
  [Color(0xFFFF8A5B), Color(0xFFC2410C)],
  [Color(0xFF5EEAD4), Color(0xFF0F766E)],
  [Color(0xFFA78BFA), Color(0xFF6D28D9)],
  [Color(0xFFFDE047), Color(0xFFCA8A04)],
  [Color(0xFF7DD3FC), Color(0xFF0369A1)],
  [Color(0xFFF9A8D4), Color(0xFFBE185D)],
];

/// Avatar circular: imagen de `assets/game/avatars/` o un degradado con silueta
class PlayerAvatar extends StatelessWidget {
  const PlayerAvatar({
    super.key,
    required this.playerId,
    required this.size,
    this.avatar,
    this.isMe = false,
    this.dimmed = false,
  });
  final int playerId;

  /// Avatar elegido por el jugador (id); null = genérico al azar
  final String? avatar;
  final double size;
  final bool isMe;
  final bool dimmed;

  @override
  Widget build(BuildContext context) {
    final asset = GameAssets.instance.avatarFor(playerId, avatar: avatar);
    final colors = _avatarGradients[playerId % _avatarGradients.length];
    Widget content = asset != null
        ? Image.asset(asset, fit: BoxFit.cover)
        : DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(colors: colors, begin: Alignment.topLeft, end: Alignment.bottomRight),
            ),
            child: Align(
              alignment: const Alignment(0, 0.6),
              child: Icon(Icons.person, size: size * 0.85, color: Colors.black.withValues(alpha: 0.28)),
            ),
          );
    if (dimmed) {
      content = ColorFiltered(
        colorFilter: const ColorFilter.matrix([
          0.33, 0.33, 0.33, 0, 0, //
          0.33, 0.33, 0.33, 0, 0,
          0.33, 0.33, 0.33, 0, 0,
          0, 0, 0, 0.7, 0,
        ]),
        child: content,
      );
    }
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(color: isMe ? PokerColors.gold : const Color(0xFF2B3550), width: size * 0.05),
        boxShadow: const [BoxShadow(color: Colors.black54, blurRadius: 8, offset: Offset(0, 3))],
      ),
      child: ClipOval(child: content),
    );
  }
}

/// Anillo de tiempo alrededor del avatar: verde → amarillo → rojo, suave (60 fps)
/// Anillo de tiempo del turno. Avanza de forma continua (cada fotograma) con un reloj
/// local monotónico: el plazo del servidor solo se usa para sincronizar al inicio del
/// turno o si se desvía más de [_resyncThreshold], así el sondeo de estado no lo hace saltar.
class TurnRing extends StatefulWidget {
  const TurnRing({super.key, required this.deadline, required this.totalSeconds, required this.size});
  final DateTime? deadline;
  final int totalSeconds;
  final double size;

  @override
  State<TurnRing> createState() => _TurnRingState();
}

const _resyncThreshold = Duration(milliseconds: 600);

class _TurnRingState extends State<TurnRing> with SingleTickerProviderStateMixin {
  final _fraction = ValueNotifier<double>(1);
  final _clock = Stopwatch()..start();
  late final Ticker _ticker;

  /// Milisegundos restantes al momento [_anchorAt] del reloj local
  int? _anchorRemaining;
  int _anchorAt = 0;

  int get _totalMs => widget.totalSeconds * 1000;

  @override
  void initState() {
    super.initState();
    _sync(force: true);
    _ticker = createTicker((_) => _tick())..start();
  }

  @override
  void didUpdateWidget(TurnRing old) {
    super.didUpdateWidget(old);
    _sync(force: old.deadline == null || widget.deadline == null);
  }

  void _sync({required bool force}) {
    final deadline = widget.deadline;
    if (deadline == null) {
      _anchorRemaining = null;
      return;
    }
    final serverRemaining = deadline.difference(DateTime.now()).inMilliseconds.clamp(0, _totalMs);
    if (!force && _anchorRemaining != null && (serverRemaining - _remaining).abs() < _resyncThreshold.inMilliseconds) {
      return;
    }
    _anchorRemaining = serverRemaining;
    _anchorAt = _clock.elapsedMilliseconds;
  }

  int get _remaining {
    final anchor = _anchorRemaining;
    if (anchor == null) return _totalMs;
    return (anchor - (_clock.elapsedMilliseconds - _anchorAt)).clamp(0, _totalMs);
  }

  void _tick() => _fraction.value = _totalMs == 0 ? 0 : _remaining / _totalMs;

  @override
  void dispose() {
    _ticker.dispose();
    _fraction.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => RepaintBoundary(
        child: CustomPaint(size: Size.square(widget.size), painter: _RingPainter(_fraction)),
      );
}

class _RingPainter extends CustomPainter {
  _RingPainter(this.fraction) : super(repaint: fraction);
  final ValueListenable<double> fraction;

  static Color colorFor(double f) => f > 0.5
      ? Color.lerp(const Color(0xFFF2C14E), PokerColors.positive, (f - 0.5) * 2)!
      : Color.lerp(PokerColors.red, const Color(0xFFF2C14E), f * 2)!;

  @override
  void paint(Canvas canvas, Size size) {
    final f = fraction.value;
    final stroke = size.width * 0.075;
    final rect = (Offset.zero & size).deflate(stroke / 2);
    canvas.drawArc(rect, 0, math.pi * 2, false, Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..color = Colors.black45);
    if (f <= 0) return;

    final color = colorFor(f);
    final sweep = math.pi * 2 * f;
    // Halo suave que se intensifica al final del turno
    canvas.drawArc(rect, -math.pi / 2, sweep, false, Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke * 1.9
      ..strokeCap = StrokeCap.round
      ..color = color.withValues(alpha: 0.18 + (1 - f) * 0.22)
      ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 4));
    canvas.drawArc(rect, -math.pi / 2, sweep, false, Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..strokeCap = StrokeCap.round
      ..shader = SweepGradient(
        startAngle: 0,
        endAngle: math.pi * 2,
        transform: const GradientRotation(-math.pi / 2),
        colors: [Color.lerp(color, Colors.black, 0.25)!, color, Color.lerp(color, Colors.white, 0.35)!],
        stops: [0, (f * 0.85).clamp(0.01, 0.98), f.clamp(0.02, 1.0)],
      ).createShader(rect));
    // Chispa en la punta del arco
    final angle = -math.pi / 2 + sweep;
    final tip = rect.center + Offset(math.cos(angle), math.sin(angle)) * (rect.width / 2);
    canvas.drawCircle(tip, stroke * 0.95, Paint()
      ..color = Colors.white.withValues(alpha: 0.85)
      ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 3));
    canvas.drawCircle(tip, stroke * 0.45, Paint()..color = Colors.white);
  }

  @override
  bool shouldRepaint(_RingPainter old) => old.fraction != fraction;
}

/// Brillo pulsante (ganador de la mano)
class WinnerGlow extends StatefulWidget {
  const WinnerGlow({super.key, required this.size});
  final double size;

  @override
  State<WinnerGlow> createState() => _WinnerGlowState();
}

class _WinnerGlowState extends State<WinnerGlow> with SingleTickerProviderStateMixin {
  late final _controller = AnimationController(vsync: this, duration: const Duration(milliseconds: 900))
    ..repeat(reverse: true);

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
        animation: _controller,
        builder: (context, _) => Container(
          width: widget.size,
          height: widget.size,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            boxShadow: [
              BoxShadow(
                color: PokerColors.gold.withValues(alpha: 0.35 + 0.4 * _controller.value),
                blurRadius: widget.size * (0.25 + 0.2 * _controller.value),
                spreadRadius: widget.size * 0.05,
              ),
            ],
          ),
        ),
      );
}
