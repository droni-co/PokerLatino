import 'package:flutter/material.dart';

/// Identidad visual de Poker Latino: noche profunda, paño esmeralda, riel de cuero
/// con filo dorado y acentos cálidos.
class PokerColors {
  // Fondo y superficies
  static const background = Color(0xFF0A0E18);
  static const backgroundPattern = Color(0xFF131A2A);
  static const surface = Color(0xFF151C2B);
  static const surfaceHigh = Color(0xFF1E2840);
  static const border = Color(0xFF2A3654);

  // Mesa
  static const felt = Color(0xFF128060);
  static const feltDark = Color(0xFF0A4A38);
  static const feltLine = Color(0x33FFFFFF);
  static const feltEdge = Color(0xFF3B2317); // riel de cuero
  static const railHighlight = Color(0xFF6E4429);
  static const railTrim = Color(0xFFD9A441);

  // Acentos
  static const gold = Color(0xFFF2C14E);
  static const goldDark = Color(0xFFB8862B);
  static const red = Color(0xFFE5484D);
  static const positive = Color(0xFF3DD68C);
  static const muted = Color(0xFF9AA6BF);

  // Botones de acción
  static const actionFold = Color(0xFFC23B3B);
  static const actionCall = Color(0xFF1C9A74);
  static const actionRaise = Color(0xFFE0A526);
  static const actionAllIn = Color(0xFF9B4DCA);

  // Cartas
  static const cardFace = Color(0xFFFDFBF6);
  static const cardRed = Color(0xFFD02B2B);
  static const cardBlack = Color(0xFF16181D);
  static const cardBack = Color(0xFF8C1D2F);
  static const cardBackDark = Color(0xFF4E0E1A);
}

ThemeData buildTheme() {
  final scheme = ColorScheme.fromSeed(
    seedColor: PokerColors.felt,
    brightness: Brightness.dark,
  ).copyWith(
    primary: PokerColors.gold,
    onPrimary: const Color(0xFF1A1405),
    secondary: PokerColors.felt,
    surface: PokerColors.surface,
    error: PokerColors.red,
  );

  return ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    scaffoldBackgroundColor: PokerColors.background,
    appBarTheme: const AppBarTheme(
      backgroundColor: PokerColors.background,
      centerTitle: false,
      elevation: 0,
    ),
    cardTheme: CardThemeData(
      color: PokerColors.surface,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: const BorderSide(color: PokerColors.border),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        minimumSize: const Size(0, 48),
        textStyle: const TextStyle(fontWeight: FontWeight.w600),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: PokerColors.gold,
        side: BorderSide(color: PokerColors.gold.withValues(alpha: 0.6)),
        shape: const StadiumBorder(),
        textStyle: const TextStyle(fontWeight: FontWeight.w700),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(foregroundColor: PokerColors.gold),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: Colors.transparent,
      indicatorColor: PokerColors.gold.withValues(alpha: 0.18),
      iconTheme: WidgetStateProperty.resolveWith((s) => IconThemeData(
            color: s.contains(WidgetState.selected) ? PokerColors.gold : PokerColors.muted,
          )),
      labelTextStyle: WidgetStateProperty.resolveWith((s) => TextStyle(
            fontSize: 12,
            fontWeight: s.contains(WidgetState.selected) ? FontWeight.w700 : FontWeight.w500,
            color: s.contains(WidgetState.selected) ? PokerColors.gold : PokerColors.muted,
          )),
    ),
    navigationRailTheme: NavigationRailThemeData(
      backgroundColor: Colors.transparent,
      indicatorColor: PokerColors.gold.withValues(alpha: 0.18),
      selectedIconTheme: const IconThemeData(color: PokerColors.gold),
      unselectedIconTheme: const IconThemeData(color: PokerColors.muted),
      selectedLabelTextStyle: const TextStyle(color: PokerColors.gold, fontWeight: FontWeight.w700),
      unselectedLabelTextStyle: const TextStyle(color: PokerColors.muted),
    ),
    tabBarTheme: TabBarThemeData(
      labelColor: PokerColors.gold,
      unselectedLabelColor: PokerColors.muted,
      indicatorColor: PokerColors.gold,
      dividerColor: PokerColors.gold.withValues(alpha: 0.15),
      labelStyle: const TextStyle(fontWeight: FontWeight.w700, letterSpacing: 0.5),
    ),
    dialogTheme: DialogThemeData(
      backgroundColor: PokerColors.surface,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(20),
        side: BorderSide(color: PokerColors.gold.withValues(alpha: 0.35)),
      ),
      titleTextStyle: const TextStyle(color: PokerColors.gold, fontSize: 20, fontWeight: FontWeight.w700),
    ),
    popupMenuTheme: PopupMenuThemeData(
      color: PokerColors.surface,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: BorderSide(color: PokerColors.gold.withValues(alpha: 0.3)),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: PokerColors.background.withValues(alpha: 0.6),
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: PokerColors.border),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: PokerColors.gold, width: 1.5),
      ),
    ),
    progressIndicatorTheme: const ProgressIndicatorThemeData(color: PokerColors.gold),
    dividerTheme: DividerThemeData(color: PokerColors.gold.withValues(alpha: 0.12)),
    snackBarTheme: const SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      backgroundColor: PokerColors.surfaceHigh,
      contentTextStyle: TextStyle(color: Colors.white),
    ),
  );
}
