import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_web_plugins/url_strategy.dart';

import 'app.dart';
import 'core/game_assets.dart';
import 'core/sounds.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // URLs limpias en web: /lobby en vez de /#/lobby
  usePathUrlStrategy();
  await GameAssets.load();
  await Sounds.init();
  runApp(const ProviderScope(child: PokerLatinoApp()));
}
