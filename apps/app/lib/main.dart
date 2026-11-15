import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_web_plugins/url_strategy.dart';

import 'app.dart';
import 'core/game_assets.dart';
import 'core/sounds.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // URLs limpias en web: /lobby en vez de /#/lobby
  usePathUrlStrategy();
  if (!kIsWeb) {
    // En el teléfono el juego va siempre en horizontal y a pantalla completa
    // (las barras del sistema aparecen deslizando desde el borde)
    await SystemChrome.setPreferredOrientations([DeviceOrientation.landscapeLeft, DeviceOrientation.landscapeRight]);
    await SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
  }
  await GameAssets.load();
  await Sounds.init();
  runApp(const ProviderScope(child: PokerLatinoApp()));
}
