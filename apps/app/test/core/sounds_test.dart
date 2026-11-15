import 'package:flutter_test/flutter_test.dart';
import 'package:poker_latino/core/sounds.dart';
import 'package:shared_preferences/shared_preferences.dart';

class _Recorder implements SoundBackend {
  final played = <String>[];
  @override
  Future<void> play(String asset, double volume) async => played.add(asset);
}

void main() {
  late _Recorder rec;

  setUp(() {
    SharedPreferences.setMockInitialValues({});
    Sounds.muted.value = false;
    rec = _Recorder();
    Sounds.override(rec, {Sfx.fold.asset, Sfx.deal.asset});
  });

  test('cada efecto apunta a un archivo de assets/game/sounds', () {
    for (final sfx in Sfx.values) {
      expect(sfx.asset, startsWith('assets/game/sounds/'));
    }
  });

  test('reproduce solo los efectos cuyo archivo existe', () {
    Sounds.play(Sfx.fold);
    Sounds.play(Sfx.flip); // no está disponible
    expect(rec.played, [Sfx.fold.asset]);
  });

  test('evita duplicados casi simultáneos del mismo efecto', () {
    Sounds.play(Sfx.fold);
    Sounds.play(Sfx.fold);
    expect(rec.played, hasLength(1));
  });

  test('respeta el retraso y se puede cancelar', () async {
    Sounds.play(Sfx.deal, delay: const Duration(milliseconds: 20));
    expect(rec.played, isEmpty);
    await Future<void>.delayed(const Duration(milliseconds: 60));
    expect(rec.played, [Sfx.deal.asset]);

    Sounds.play(Sfx.fold, delay: const Duration(milliseconds: 20));
    Sounds.cancelPending();
    await Future<void>.delayed(const Duration(milliseconds: 60));
    expect(rec.played, [Sfx.deal.asset]);
  });

  test('silenciar detiene los sonidos y se recuerda', () async {
    await Sounds.toggleMute();
    expect(Sounds.muted.value, isTrue);
    Sounds.play(Sfx.fold);
    expect(rec.played, isEmpty);
    final prefs = await SharedPreferences.getInstance();
    expect(prefs.getBool('sound_muted'), isTrue);
    await Sounds.toggleMute();
  });
}
