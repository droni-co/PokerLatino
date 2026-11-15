import 'package:flutter/services.dart';

/// Imágenes opcionales del juego en `assets/game/`.
///
/// Cada elemento visual (fondo, mesa, reverso de cartas, crupier, avatares, fichas, logo,
/// íconos) tiene un dibujo por defecto. Si existe el archivo correspondiente se usa la
/// imagen en su lugar: basta con copiarlo en `assets/game/` y recompilar.
class GameAssets {
  GameAssets._(this._available);

  static GameAssets instance = GameAssets._(const {});

  // Mesa
  static const background = 'assets/game/background.png';
  static const table = 'assets/game/table.png';
  static const cardBack = 'assets/game/card_back.png';
  static const dealer = 'assets/game/dealer.png';
  static const chip = 'assets/game/chip.png';

  // Interfaz
  static const logo = 'assets/game/ui/logo.png';
  static const emblem = 'assets/game/ui/emblem.png';
  static const loginHero = 'assets/game/ui/login_hero.jpg';
  static const roomBannersDir = 'assets/game/ui/rooms/';
  static const iconsDir = 'assets/game/ui/icons/';

  /// Avatares genéricos (`<id>.png`): se asigna uno a cada jugador sin avatar elegido
  static const avatarsDir = 'assets/game/avatars/';

  /// Avatares de personajes (`<id>.png`), solo se usan si el jugador los elige
  static const charactersDir = 'assets/game/avatars/personajes/';

  final Set<String> _available;

  /// Lee el manifiesto de assets una sola vez al arrancar
  static Future<void> load() async {
    try {
      final manifest = await AssetManifest.loadFromAssetBundle(rootBundle);
      instance = GameAssets._(manifest.listAssets().where(_isGameImage).toSet());
    } catch (_) {
      instance = GameAssets._(const {});
    }
  }

  static bool _isGameImage(String asset) =>
      asset.startsWith('assets/game/') && RegExp(r'\.(png|jpe?g|webp)$', caseSensitive: false).hasMatch(asset);

  /// Solo para pruebas
  static void override(Set<String> available) => instance = GameAssets._(available);

  String? path(String asset) => _available.contains(asset) ? asset : null;

  /// Archivos directamente dentro de [dir] (sin subcarpetas), en orden alfabético
  List<String> _filesIn(String dir) =>
      _available.where((a) => a.startsWith(dir) && !a.substring(dir.length).contains('/')).toList()..sort();

  /// Avatares genéricos (rutas)
  List<String> get avatars => _filesIn(avatarsDir);

  /// Avatares de personajes (rutas)
  List<String> get characterAvatars => _filesIn(charactersDir);

  /// Id de un avatar a partir de su ruta: `assets/game/avatars/jaguar.png` → `jaguar`
  static String avatarId(String path) {
    final name = path.substring(path.lastIndexOf('/') + 1);
    final dot = name.lastIndexOf('.');
    return dot < 0 ? name : name.substring(0, dot);
  }

  /// Ruta del avatar con ese id (genérico o personaje), si existe
  String? avatarPath(String id) {
    for (final path in [...avatars, ...characterAvatars]) {
      if (avatarId(path) == id) return path;
    }
    return null;
  }

  List<String> get roomBanners => _filesIn(roomBannersDir);

  /// Ícono de interfaz por nombre (`assets/game/ui/icons/<name>.png`)
  String? icon(String name) => path('$iconsDir$name.png');

  /// Avatar genérico del jugador mientras no tenga uno personalizado.
  ///
  /// Se elige "al azar" con un hash del id: parece aleatorio (jugadores con ids
  /// consecutivos no reciben avatares consecutivos) pero es estable y todos los
  /// clientes ven el mismo avatar para el mismo jugador, sin guardarlo en el servidor.
  ///
  /// Si el jugador eligió un [avatar] (id) y la imagen existe, se usa ese.
  String? avatarFor(int playerId, {String? avatar}) {
    if (avatar != null) {
      final chosen = avatarPath(avatar);
      if (chosen != null) return chosen;
    }
    final list = avatars;
    return list.isEmpty ? null : list[stableIndex(playerId, list.length)];
  }

  /// Banner de una sala, repartido igual que los avatares
  String? roomBannerFor(int roomId) {
    final list = roomBanners;
    return list.isEmpty ? null : list[stableIndex(roomId, list.length)];
  }

  /// Banner de un nivel según su posición (del más barato al más caro)
  String? levelBanner(int index) {
    final list = roomBanners;
    return list.isEmpty ? null : list[index % list.length];
  }

  /// Índice pseudoaleatorio estable en `[0, count)` a partir de [seed]
  static int stableIndex(int seed, int count) {
    // Mezcla de enteros de 32 bits (estilo finalizador de MurmurHash3)
    var h = seed & 0xffffffff;
    h = _mul32(h ^ (h >> 16), 0x45d9f3b);
    h = _mul32(h ^ (h >> 16), 0x45d9f3b);
    h = h ^ (h >> 16);
    return h % count;
  }

  /// `a * b` módulo 2^32 sin pasar de 2^53, para dar el mismo resultado en web (JS)
  static int _mul32(int a, int b) {
    final lo = (a & 0xffff) * b;
    final hi = (((a >> 16) * b) & 0xffff) << 16;
    return (lo + hi) & 0xffffffff;
  }
}
