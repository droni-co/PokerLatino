import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/router.dart';
import 'core/theme.dart';
import 'features/tournaments/tournament_callout.dart';

class PokerLatinoApp extends ConsumerWidget {
  const PokerLatinoApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return MaterialApp.router(
      title: 'Poker Latino',
      debugShowCheckedModeBanner: false,
      theme: buildTheme(),
      routerConfig: ref.watch(routerProvider),
      // Encima de cualquier pantalla: "tu torneo empezó · ir a mi mesa"
      builder: (_, child) => TournamentCallout(child: child ?? const SizedBox.shrink()),
    );
  }
}
