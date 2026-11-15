import 'package:intl/intl.dart';

/// Poker Latino es un juego, no un casino: la única moneda son las **fichas**. No se
/// compran ni se canjean por dinero. Los montos llegan como enteros (1 = 1 ficha).
final _number = NumberFormat.decimalPattern('en_US');

/// 1250 → "1,250 fichas" · 1 → "1 ficha"
String formatFichas(int amount) => '${_number.format(amount)} ${amount.abs() == 1 ? 'ficha' : 'fichas'}';

/// Versión corta para la mesa (stacks, apuestas, bote): 1250 → "1,250"
String formatChips(int amount) => _number.format(amount);
