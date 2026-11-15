import 'package:flutter_test/flutter_test.dart';
import 'package:poker_latino/core/game_assets.dart';

void main() {
  final avatars = [for (var i = 1; i <= 16; i++) 'assets/game/avatars/a${i.toString().padLeft(2, '0')}.png'];

  setUp(
    () => GameAssets.override({
      ...avatars,
      'assets/game/avatars/personajes/caballero.png',
      'assets/game/ui/rooms/1_cantina.jpg',
      'assets/game/ui/rooms/2_malecon.jpg',
      'assets/game/ui/icons/chips.png',
    }),
  );
  tearDown(() => GameAssets.override(const {}));

  test('los avatares genéricos no incluyen subcarpetas', () {
    expect(GameAssets.instance.avatars, avatars);
  });

  test('cada jugador recibe siempre el mismo avatar genérico', () {
    final first = GameAssets.instance.avatarFor(42);
    expect(first, isNotNull);
    expect(GameAssets.instance.avatarFor(42), first);
  });

  test('la asignación parece aleatoria y usa todo el catálogo', () {
    final assigned = [for (var id = 1; id <= 400; id++) GameAssets.instance.avatarFor(id)];
    // Ids consecutivos no reciben avatares consecutivos
    final sequential = [for (var id = 1; id <= 16; id++) avatars[id % 16]];
    expect(assigned.take(16).toList(), isNot(sequential));
    // Reparto parejo: cada avatar aparece al menos una vez y ninguno acapara
    final counts = <String, int>{};
    for (final a in assigned) {
      counts[a!] = (counts[a] ?? 0) + 1;
    }
    expect(counts.length, 16);
    expect(counts.values.reduce((a, b) => a > b ? a : b), lessThan(50));
  });

  test('el índice estable coincide con la aritmética de 32 bits exacta (igual en web)', () {
    int reference(int seed, int count) {
      final mask = BigInt.from(0xffffffff);
      var h = BigInt.from(seed) & mask;
      final m = BigInt.from(0x45d9f3b);
      h = ((h ^ (h >> 16)) * m) & mask;
      h = ((h ^ (h >> 16)) * m) & mask;
      h = h ^ (h >> 16);
      return (h % BigInt.from(count)).toInt();
    }

    for (final seed in [0, 1, 2, 7, 1000, 65535, 65536, 123456789, 0x7fffffff, 0xffffffff]) {
      expect(GameAssets.stableIndex(seed, 16), reference(seed, 16), reason: 'seed $seed');
    }
  });

  test('el avatar elegido tiene prioridad (genérico o personaje)', () {
    final assets = GameAssets.instance;
    expect(assets.avatarFor(42, avatar: 'a03'), 'assets/game/avatars/a03.png');
    expect(assets.avatarFor(42, avatar: 'caballero'), 'assets/game/avatars/personajes/caballero.png');
    expect(assets.characterAvatars, ['assets/game/avatars/personajes/caballero.png']);
    // Un id desconocido (p. ej. app desactualizada) cae al avatar al azar
    expect(assets.avatarFor(42, avatar: 'dragon'), assets.avatarFor(42));
    expect(GameAssets.avatarId('assets/game/avatars/personajes/caballero.png'), 'caballero');
  });

  test('sin avatares no hay asignación (se usa el dibujo por defecto)', () {
    GameAssets.override(const {});
    expect(GameAssets.instance.avatarFor(1), isNull);
    expect(GameAssets.instance.roomBannerFor(1), isNull);
  });

  test('banners de sala e íconos', () {
    expect(GameAssets.instance.roomBannerFor(5), isIn(GameAssets.instance.roomBanners));
    expect(GameAssets.instance.icon('chips'), 'assets/game/ui/icons/chips.png');
    expect(GameAssets.instance.icon('nope'), isNull);
  });
}
