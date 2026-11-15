import 'package:flutter/material.dart';

import '../../../core/models/table_state.dart';
import '../../../core/money.dart';
import '../../../core/theme.dart';
import '../../progress/progress_widgets.dart';
import 'player_avatar.dart';
import 'winner_effects.dart';

/// Ancho del bloque de un asiento en función del tamaño del avatar
double seatBlockWidth(double avatar) => avatar * 2.0;

/// Diámetro del anillo de turno
double seatRingSize(double avatar) => avatar * 1.24;

/// Avatar + anillo de turno + placa con nombre y fichas.
/// Se posiciona de modo que el centro del avatar caiga en el punto del asiento.
class SeatView extends StatelessWidget {
  const SeatView({
    super.key,
    required this.seat,
    required this.isMe,
    required this.avatarSize,
    this.hand,
    this.actionTimeoutSeconds = 30,
    this.bubble,
    this.chat,
    this.wonAmount,
    this.isWinner = false,
    this.celebrate = true,
    this.handName,
  });

  final TableSeat seat;
  final bool isMe;
  final double avatarSize;
  final HandInfo? hand;
  final int actionTimeoutSeconds;

  /// Última acción ("Sube", "Pasa"...) mostrada unos segundos
  final String? bubble;

  /// Mensaje de chat reciente del jugador (globo sobre el avatar)
  final String? chat;

  /// Mientras dura la celebración: cuánto ganó (rayos, confeti y "+N")
  final int? wonAmount;

  /// Ganó la mano anterior (cinta "GANADOR" hasta que empieza la siguiente)
  final bool isWinner;

  /// false con "reducir movimiento": sin rayos girando ni confeti
  final bool celebrate;
  final String? handName;

  @override
  Widget build(BuildContext context) {
    final a = avatarSize;
    final s = a / 64;
    final ring = seatRingSize(a);
    final out = seat.folded || (!seat.inHand && hand != null);

    return SizedBox(
      width: seatBlockWidth(a),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        SizedBox(
          width: ring,
          height: ring,
          child: Stack(clipBehavior: Clip.none, alignment: Alignment.center, children: [
            if (wonAmount != null && celebrate)
              Positioned(
                left: (ring - a * 3) / 2,
                top: (ring - a * 3) / 2,
                child: WinnerRays(size: a * 3),
              ),
            if (wonAmount != null && celebrate)
              WinnerGlow(size: a)
            else if (isWinner || wonAmount != null)
              // Brillo fijo (sin animación infinita) hasta la próxima mano
              Container(
                width: a,
                height: a,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  boxShadow: [BoxShadow(color: PokerColors.gold.withValues(alpha: 0.55), blurRadius: a * 0.35, spreadRadius: a * 0.05)],
                ),
              ),
            if (seat.isTurn)
              TurnRing(deadline: hand?.turnDeadline, totalSeconds: actionTimeoutSeconds, size: ring),
            PlayerAvatar(playerId: seat.playerId, avatar: seat.avatar, size: a, isMe: isMe, dimmed: out),
            // Nivel de experiencia, abajo a la izquierda del avatar
            Positioned(
              left: (ring - a) / 2 - a * 0.08,
              bottom: (ring - a) / 2 - a * 0.02,
              child: LevelBadge(level: seat.level, size: a * 0.36),
            ),
            if (isWinner)
              Positioned(bottom: -a * 0.02, child: WinnerRibbon(scale: s, animate: celebrate)),
            if (wonAmount != null && celebrate)
              Positioned(
                left: (ring - a * 3) / 2,
                top: (ring - a * 3) / 2,
                child: ConfettiBurst(key: ValueKey('confetti-${seat.seatNumber}-$wonAmount'), size: a * 3, seed: seat.seatNumber),
              ),
            if (bubble != null)
              Positioned(
                top: -a * 0.38,
                child: _Bubble(key: ValueKey(bubble), text: bubble!, scale: s),
              ),
            if (chat != null)
              Positioned(
                bottom: ring + a * 0.42,
                child: ChatBubble(key: ValueKey('chat-$chat'), text: chat!, scale: s),
              ),
            if (wonAmount != null)
              Positioned(
                top: -a * 0.2,
                child: _FloatingWin(key: ValueKey('win-${seat.seatNumber}-$wonAmount'), text: '+${formatChips(wonAmount!)}', scale: s),
              ),
          ]),
        ),
        Transform.translate(
          offset: Offset(0, -a * 0.12),
          child: _Plate(
            name: isMe ? 'Tú' : seat.displayName,
            value: seat.allIn
                ? 'ALL-IN'
                : seat.stack == 0 && !seat.inHand
                    ? 'Sin fichas'
                    : formatChips(seat.stack),
            valueColor: seat.allIn ? PokerColors.red : Colors.white,
            highlight: seat.isTurn || wonAmount != null || isWinner,
            subtitle: handName ??
                (seat.leaving
                    ? 'Saliendo'
                    : seat.missedHands > 0
                        ? 'Inactivo'
                        : null),
            subtitleColor: handName == null && (seat.leaving || seat.missedHands > 0)
                ? PokerColors.muted
                : PokerColors.gold,
            scale: s,
            dimmed: out,
          ),
        ),
      ]),
    );
  }
}

class _Plate extends StatelessWidget {
  const _Plate({
    required this.name,
    required this.value,
    required this.valueColor,
    required this.highlight,
    required this.scale,
    required this.dimmed,
    this.subtitle,
    this.subtitleColor = PokerColors.gold,
  });

  final String name;
  final String value;
  final Color valueColor;
  final bool highlight;
  final double scale;
  final bool dimmed;
  final String? subtitle;
  final Color subtitleColor;

  @override
  Widget build(BuildContext context) {
    final s = scale;
    return Opacity(
      opacity: dimmed ? 0.6 : 1,
      child: Container(
        constraints: BoxConstraints(minWidth: 80 * s, maxWidth: 124 * s),
        padding: EdgeInsets.symmetric(horizontal: 10 * s, vertical: 4 * s),
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            colors: [Color(0xEE1E2840), Color(0xEE0E1320)],
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
          ),
          borderRadius: BorderRadius.circular(10 * s),
          border: Border.all(color: highlight ? PokerColors.gold : PokerColors.border, width: highlight ? 1.5 : 1),
          boxShadow: const [BoxShadow(color: Colors.black54, blurRadius: 6, offset: Offset(0, 2))],
        ),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Text(name,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(fontSize: 11.5 * s, color: PokerColors.muted, fontWeight: FontWeight.w600)),
          Row(mainAxisSize: MainAxisSize.min, children: [
            Icon(Icons.toll, size: 12 * s, color: PokerColors.gold),
            SizedBox(width: 3 * s),
            Text(value, style: TextStyle(fontSize: 13.5 * s, fontWeight: FontWeight.w800, color: valueColor)),
          ]),
          if (subtitle != null)
            Text(subtitle!, style: TextStyle(fontSize: 10.5 * s, color: subtitleColor, fontWeight: FontWeight.w600)),
        ]),
      ),
    );
  }
}

/// Burbuja de acción que aparece con un pequeño rebote
class _Bubble extends StatelessWidget {
  const _Bubble({super.key, required this.text, required this.scale});
  final String text;
  final double scale;

  Color get _color => switch (text) {
        'No va' => PokerColors.actionFold,
        'Pasa' || 'Iguala' => PokerColors.actionCall,
        'All-in' => PokerColors.actionAllIn,
        _ => PokerColors.actionRaise,
      };

  @override
  Widget build(BuildContext context) {
    final s = scale;
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: const Duration(milliseconds: 380),
      curve: Curves.elasticOut,
      builder: (context, t, child) => Transform.scale(scale: 0.4 + 0.6 * t, child: child),
      child: Container(
        padding: EdgeInsets.symmetric(horizontal: 9 * s, vertical: 3 * s),
        decoration: BoxDecoration(
          color: _color,
          borderRadius: BorderRadius.circular(12 * s),
          boxShadow: const [BoxShadow(color: Colors.black45, blurRadius: 4, offset: Offset(0, 2))],
        ),
        child: Text(
          text,
          style: TextStyle(
            fontSize: 12 * s,
            fontWeight: FontWeight.w800,
            color: text == 'Sube' || text == 'Apuesta' ? const Color(0xFF241A04) : Colors.white,
          ),
        ),
      ),
    );
  }
}

/// "+60" que sube y se desvanece sobre el ganador
class _FloatingWin extends StatelessWidget {
  const _FloatingWin({super.key, required this.text, required this.scale});
  final String text;
  final double scale;

  @override
  Widget build(BuildContext context) {
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: const Duration(milliseconds: 2200),
      curve: Curves.easeOut,
      builder: (context, t, child) => Transform.translate(
        offset: Offset(0, -40 * scale * t),
        child: Opacity(opacity: t < 0.75 ? 1 : (1 - t) * 4, child: child),
      ),
      child: Text(
        text,
        style: TextStyle(
          fontSize: 20 * scale,
          fontWeight: FontWeight.w900,
          color: PokerColors.gold,
          shadows: const [Shadow(color: Colors.black, blurRadius: 6)],
        ),
      ),
    );
  }
}

/// Silla libre: con "+" si puedes sentarte, o para invitar a un amigo si ya estás sentado
class EmptySeat extends StatelessWidget {
  const EmptySeat({super.key, required this.seatNumber, required this.avatarSize, this.onSit, this.onInvite});
  final int seatNumber;
  final double avatarSize;
  final VoidCallback? onSit;

  /// Sentado en la mesa: tocar la silla libre abre "Invitar amigos"
  final VoidCallback? onInvite;

  @override
  Widget build(BuildContext context) {
    final a = avatarSize;
    final canSit = onSit != null;
    final canInvite = !canSit && onInvite != null;
    final label = canSit ? 'Sentarse' : (canInvite ? 'Invitar a un amigo' : 'Libre');
    return Tooltip(
      message: label,
      child: Semantics(
        button: canSit || canInvite,
        label: label,
        child: InkWell(
          onTap: onSit ?? onInvite,
          customBorder: const CircleBorder(),
          child: Container(
            width: a * 0.92,
            height: a * 0.92,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: Colors.black.withValues(alpha: 0.35),
              border: Border.all(
                color: canSit ? PokerColors.gold.withValues(alpha: 0.9) : Colors.white24,
                width: canSit ? 2 : 1,
              ),
              boxShadow: canSit
                  ? [BoxShadow(color: PokerColors.gold.withValues(alpha: 0.25), blurRadius: 12)]
                  : null,
            ),
            child: Icon(
              canSit ? Icons.add : (canInvite ? Icons.person_add_alt_1 : Icons.event_seat_outlined),
              color: canSit ? PokerColors.gold : (canInvite ? Colors.white54 : Colors.white24),
              size: a * (canInvite ? 0.38 : 0.42),
            ),
          ),
        ),
      ),
    );
  }
}

/// Globo de chat sobre el avatar, con la colita apuntando al jugador
class ChatBubble extends StatelessWidget {
  const ChatBubble({super.key, required this.text, required this.scale});
  final String text;
  final double scale;

  @override
  Widget build(BuildContext context) {
    final s = scale;
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: const Duration(milliseconds: 320),
      curve: Curves.easeOutBack,
      builder: (context, t, child) => Opacity(
        opacity: t.clamp(0, 1),
        child: Transform.scale(scale: 0.6 + 0.4 * t, alignment: Alignment.bottomCenter, child: child),
      ),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Container(
          constraints: BoxConstraints(maxWidth: 170 * s),
          padding: EdgeInsets.symmetric(horizontal: 10 * s, vertical: 6 * s),
          decoration: BoxDecoration(
            color: const Color(0xFFFDFBF6),
            borderRadius: BorderRadius.circular(12 * s),
            border: Border.all(color: PokerColors.gold, width: 1.2),
            boxShadow: const [BoxShadow(color: Colors.black54, blurRadius: 8, offset: Offset(0, 3))],
          ),
          child: Text(
            text,
            maxLines: 3,
            overflow: TextOverflow.ellipsis,
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 12 * s, height: 1.25, color: const Color(0xFF16181D), fontWeight: FontWeight.w600),
          ),
        ),
        CustomPaint(size: Size(14 * s, 7 * s), painter: _TailPainter()),
      ]),
    );
  }
}

class _TailPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final path = Path()
      ..moveTo(0, -1)
      ..lineTo(size.width / 2, size.height)
      ..lineTo(size.width, -1)
      ..close();
    canvas.drawPath(path, Paint()..color = const Color(0xFFFDFBF6));
    canvas.drawPath(
      Path()
        ..moveTo(0, 0)
        ..lineTo(size.width / 2, size.height)
        ..lineTo(size.width, 0),
      Paint()
        ..color = PokerColors.gold
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.2,
    );
  }

  @override
  bool shouldRepaint(_TailPainter old) => false;
}
