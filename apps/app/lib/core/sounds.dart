import 'dart:async';

import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Efectos de sonido del juego. Cada efecto apunta a un archivo de `assets/game/sounds/`;
/// si el archivo no existe, ese efecto simplemente no suena.
enum Sfx {
  /// Barajar / cuadrar el mazo: empieza la mano y el bote va al ganador
  shuffle('deck-square-up.wav', 0.8),

  /// Carta repartida (cartas propias, rivales y comunitarias)
  deal('card-draw-1.wav', 0.55),

  /// Carta que se voltea (comunitarias y showdown)
  flip('card-flip-1.wav', 0.8),

  /// Apuesta, igualar, subir
  bet('card-hover.wav', 0.9),

  /// Pasar y toques de botones
  click('menu-click.wav', 0.7),

  /// Retirarse
  fold('card-invalid-drop.wav', 0.7),

  /// Inicio de tu turno y últimos segundos del reloj
  tick('turn-timer-tick.wav', 0.8),

  /// Acción rechazada / saldo insuficiente
  error('not-enough-mana.wav', 0.8);

  const Sfx(this.file, this.volume);
  final String file;
  final double volume;

  String get asset => '${Sounds.dir}$file';
}

/// Reproduce un asset de audio. Separado para poder silenciar el audio real en pruebas.
abstract class SoundBackend {
  Future<void> play(String asset, double volume);
}

class _NoopBackend implements SoundBackend {
  @override
  Future<void> play(String asset, double volume) async {}
}

/// Varios reproductores por efecto, en rotación, para que se puedan solapar
/// (p. ej. las cartas del reparto, que salen cada 90 ms).
class AudioPlayersBackend implements SoundBackend {
  static const _voices = 4;
  final _players = <String, List<AudioPlayer>>{};
  final _next = <String, int>{};

  @override
  Future<void> play(String asset, double volume) async {
    final pool = _players.putIfAbsent(
      asset,
      () => [for (var i = 0; i < _voices; i++) AudioPlayer()..setReleaseMode(ReleaseMode.stop)],
    );
    final i = _next[asset] ?? 0;
    _next[asset] = (i + 1) % pool.length;
    final player = pool[i];
    // AssetSource antepone "assets/" por su cuenta
    await player.stop();
    await player.play(AssetSource(asset.substring('assets/'.length)), volume: volume);
  }
}

class Sounds {
  Sounds._();

  static const dir = 'assets/game/sounds/';
  static const _mutedKey = 'sound_muted';

  static SoundBackend _backend = _NoopBackend();
  static Set<String> _available = const {};
  static final _lastPlayed = <Sfx, DateTime>{};
  static final _pending = <Timer>{};

  /// Silencio elegido por el jugador (se recuerda entre sesiones)
  static final muted = ValueNotifier<bool>(false);

  /// Llamar una vez al arrancar la app. Sin esto (p. ej. en pruebas) no suena nada.
  static Future<void> init() async {
    try {
      final manifest = await AssetManifest.loadFromAssetBundle(rootBundle);
      _available = manifest.listAssets().where((a) => a.startsWith(dir)).toSet();
      _backend = AudioPlayersBackend();
    } catch (_) {
      _available = const {};
    }
    try {
      final prefs = await SharedPreferences.getInstance();
      muted.value = prefs.getBool(_mutedKey) ?? false;
    } catch (_) {}
  }

  /// Solo para pruebas
  @visibleForTesting
  static void override(SoundBackend backend, Set<String> available) {
    _backend = backend;
    _available = available;
    _lastPlayed.clear();
  }

  static Future<void> toggleMute() async {
    muted.value = !muted.value;
    if (muted.value) cancelPending();
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool(_mutedKey, muted.value);
    } catch (_) {}
  }

  /// Reproduce [sfx], opcionalmente tras [delay] (para sincronizar con animaciones)
  static void play(Sfx sfx, {Duration delay = Duration.zero}) {
    if (muted.value || !_available.contains(sfx.asset)) return;
    if (delay <= Duration.zero) {
      _playNow(sfx);
      return;
    }
    late final Timer timer;
    timer = Timer(delay, () {
      _pending.remove(timer);
      _playNow(sfx);
    });
    _pending.add(timer);
  }

  /// Cancela los sonidos programados (p. ej. al salir de la mesa)
  static void cancelPending() {
    for (final t in _pending) {
      t.cancel();
    }
    _pending.clear();
  }

  static void _playNow(Sfx sfx) {
    if (muted.value) return;
    // Evita que el mismo efecto se dispare dos veces casi a la vez
    final now = DateTime.now();
    final last = _lastPlayed[sfx];
    if (last != null && now.difference(last) < const Duration(milliseconds: 45)) return;
    _lastPlayed[sfx] = now;
    unawaited(_backend.play(sfx.asset, sfx.volume).catchError((Object _) {}));
  }
}
