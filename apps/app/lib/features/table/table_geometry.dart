import 'dart:math' as math;
import 'dart:ui';

/// Posiciones de todos los elementos de la mesa para un tamaño de pantalla.
///
/// La mesa es una elipse; el crupier va arriba al centro y los asientos se reparten
/// alrededor empezando abajo al centro (siempre el jugador local) en sentido horario.
class TableGeometry {
  TableGeometry._({
    required this.size,
    required this.center,
    required this.radii,
    required this.avatarSize,
    required this.boardCardWidth,
    required this.seats,
  });

  final Size size;
  final Offset center;

  /// Semiejes de la elipse del paño (sin contar el riel)
  final Size radii;
  final double avatarSize;
  final double boardCardWidth;

  /// Por posición visual (0 = abajo al centro)
  final List<SeatGeometry> seats;

  bool get isPortrait => size.height > size.width;

  /// Escala de textos y adornos respecto a un avatar de 64 px
  double get scale => avatarSize / 64;

  double get railWidth => avatarSize * 0.32;

  Rect get feltRect => Rect.fromCenter(center: center, width: radii.width * 2, height: radii.height * 2);

  Rect get tableRect => feltRect.inflate(railWidth);

  /// De dónde salen las cartas (frente al crupier)
  Offset get dealerPoint => Offset(center.dx, center.dy - radii.height * 0.78);

  /// Crupier, detrás del riel superior
  Offset get dealerFigurePoint => Offset(center.dx, center.dy - radii.height - railWidth * 0.2);

  Offset get potPoint => Offset(center.dx, center.dy - boardCardWidth * 1.15);

  Offset get boardCenter => Offset(center.dx, center.dy + boardCardWidth * 0.1);

  double get boardGap => boardCardWidth * 0.08;

  Offset boardSlot(int index) {
    final step = boardCardWidth + boardGap;
    return Offset(boardCenter.dx + (index - 2) * step, boardCenter.dy);
  }

  /// [visualIndex] 0..maxSeats-1
  static double seatAngle(int visualIndex, int maxSeats) => math.pi / 2 + 2 * math.pi * visualIndex / maxSeats;

  factory TableGeometry.compute(Size size, {required int maxSeats}) {
    final w = size.width;
    final h = size.height;
    final portrait = h > w;

    final avatar = (size.shortestSide * (portrait ? 0.15 : 0.13)).clamp(40.0, 88.0);
    // Bajo el centro del asiento: medio anillo de turno + placa de hasta 3 líneas
    // (nombre, fichas y jugada/estado)
    final seatBlockBelow = avatar * 0.62 + avatar * 0.85;
    final top = avatar * (portrait ? 1.3 : 1.55); // crupier / asientos superiores
    final bottom = seatBlockBelow + avatar * 0.08;

    double rx;
    double ry;
    if (portrait) {
      rx = w / 2 - avatar * 1.05;
      ry = (h - top - bottom) / 2;
      ry = math.min(ry, rx * 1.75);
    } else {
      ry = (h - top - bottom) / 2;
      rx = w / 2 - avatar * 1.55;
      // Pantallas alargadas (teléfono en horizontal): mesa más ovalada para aprovechar el ancho
      rx = math.min(rx, ry * 2.25);
    }
    rx = math.max(rx, 60);
    ry = math.max(ry, 60);

    final center = Offset(w / 2, top + ry + (h - top - bottom - 2 * ry) / 2);
    final boardCard = math.min(rx * (portrait ? 0.3 : 0.17), ry * 0.36).clamp(26.0, 92.0);

    final seats = [
      for (var i = 0; i < maxSeats; i++)
        SeatGeometry.compute(angle: seatAngle(i, maxSeats), center: center, radii: Size(rx, ry), avatar: avatar),
    ];

    return TableGeometry._(
      size: size,
      center: center,
      radii: Size(rx, ry),
      avatarSize: avatar,
      boardCardWidth: boardCard,
      seats: seats,
    );
  }
}

class SeatGeometry {
  const SeatGeometry({
    required this.angle,
    required this.avatarCenter,
    required this.betPoint,
    required this.cardsPoint,
    required this.dealerButtonPoint,
  });

  final double angle;
  final Offset avatarCenter;

  /// Donde quedan las fichas apostadas en la calle actual
  final Offset betPoint;

  /// Cartas boca abajo de los rivales (junto al avatar, hacia el centro)
  final Offset cardsPoint;
  final Offset dealerButtonPoint;

  bool get isBottom => math.sin(angle) > 0.9;

  factory SeatGeometry.compute({
    required double angle,
    required Offset center,
    required Size radii,
    required double avatar,
  }) {
    final dir = Offset(math.cos(angle), math.sin(angle));
    Offset onEllipse(double k) => center + Offset(dir.dx * radii.width * k, dir.dy * radii.height * k);

    final seat = onEllipse(1.02);
    final toCenter = center - seat;
    final unit = toCenter / toCenter.distance;
    // Perpendicular, para separar el botón del dealer de las fichas
    final side = Offset(-unit.dy, unit.dx);

    return SeatGeometry(
      angle: angle,
      avatarCenter: seat,
      // En los asientos de arriba la placa queda debajo del avatar: bajar las fichas
      betPoint: onEllipse(0.6) + (dir.dy < -0.3 ? Offset(0, avatar * 0.4) : Offset.zero),
      cardsPoint: seat + unit * avatar * 0.78 + side * avatar * 0.38,
      dealerButtonPoint: onEllipse(0.74) - side * avatar * 0.62,
    );
  }
}
