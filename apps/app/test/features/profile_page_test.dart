import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:poker_latino/core/api/api_client.dart';
import 'package:poker_latino/core/api/api_exception.dart';
import 'package:poker_latino/core/auth/auth_service.dart';
import 'package:poker_latino/core/auth/token_storage.dart';
import 'package:poker_latino/core/game_assets.dart';
import 'package:poker_latino/core/models/models.dart';
import 'package:poker_latino/core/providers.dart';
import 'package:poker_latino/core/theme.dart';
import 'package:poker_latino/features/profile/profile_page.dart';

class _Auth extends AuthController {
  _Auth(this.me);
  final Me me;
  @override
  Future<Me?> build() async => me;
}

/// API simulada: registra lo que se envía y devuelve el perfil actualizado
class _Api extends ApiClient {
  _Api(this.current) : super(AuthService(storage: MemoryTokenStorage()));
  Me current;
  final calls = <({String? username, String? avatar})>[];
  ApiException? fail;

  @override
  Future<Me> updateProfile({String? username, String? avatar}) async {
    calls.add((username: username, avatar: avatar));
    if (fail != null) throw fail!;
    current = Me(
      id: current.id,
      email: current.email,
      username: username ?? current.username,
      avatar: avatar == null ? current.avatar : (avatar.isEmpty ? null : avatar),
    );
    return current;
  }
}

Future<_Api> _pumpProfile(WidgetTester tester, Me me) async {
  tester.view.physicalSize = const Size(420, 1800);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  final api = _Api(me);
  await tester.pumpWidget(
    ProviderScope(
      overrides: [authControllerProvider.overrideWith(() => _Auth(me)), apiClientProvider.overrideWithValue(api)],
      child: MaterialApp(
        theme: buildTheme(),
        home: const Scaffold(body: ProfilePage()),
      ),
    ),
  );
  await tester.pumpAndSettle();
  return api;
}

void main() {
  setUp(
    () => GameAssets.override({
      'assets/game/avatars/jaguar.png',
      'assets/game/avatars/tucan.png',
      'assets/game/avatars/personajes/catrina.png',
    }),
  );
  tearDown(() => GameAssets.override(const {}));

  testWidgets('muestra el perfil y guarda nombre y avatar', (tester) async {
    final api = await _pumpProfile(tester, const Me(id: 7, email: 'yo@ejemplo.com', username: 'Pepe'));

    expect(tester.takeException(), isNull);
    expect(find.text('Pepe'), findsWidgets);
    expect(find.text('PERSONAJES'), findsOneWidget);
    // "Al azar" + 2 genéricos + 1 personaje
    expect(find.byKey(const ValueKey('avatar-random')), findsOneWidget);
    expect(find.byKey(const ValueKey('avatar-catrina')), findsOneWidget);

    await tester.enterText(find.byType(TextField), 'ElJaguar');
    await tester.pump();
    await tester.tap(find.byKey(const ValueKey('avatar-catrina')));
    await tester.pump();
    await tester.tap(find.text('GUARDAR CAMBIOS'));
    await tester.pumpAndSettle();

    expect(api.calls, [(username: 'ElJaguar', avatar: 'catrina')]);
    expect(find.text('Perfil actualizado'), findsOneWidget);
  });

  testWidgets('solo envía lo que cambió y "Al azar" quita el avatar', (tester) async {
    final api = await _pumpProfile(tester, const Me(id: 7, email: 'yo@ejemplo.com', username: 'Pepe', avatar: 'tucan'));

    await tester.tap(find.byKey(const ValueKey('avatar-random')));
    await tester.pump();
    await tester.tap(find.text('GUARDAR CAMBIOS'));
    await tester.pumpAndSettle();

    expect(api.calls, [(username: null, avatar: '')]);
  });

  testWidgets('valida el nombre antes de enviar y muestra errores del servidor', (tester) async {
    final api = await _pumpProfile(tester, const Me(id: 7, email: 'yo@ejemplo.com'));
    expect(find.textContaining('Aún no tienes nombre de usuario'), findsOneWidget);

    await tester.enterText(find.byType(TextField), 'con espacio');
    await tester.pump(); // enterText no reconstruye: habilita el botón Guardar
    await tester.tap(find.text('GUARDAR CAMBIOS'));
    await tester.pump();
    expect(find.textContaining('sin espacios'), findsOneWidget);
    expect(api.calls, isEmpty);

    api.fail = ApiException('Ese nombre de usuario ya está en uso', code: 'validation_error', field: 'username');
    await tester.enterText(find.byType(TextField), 'Ocupado');
    await tester.pump();
    await tester.tap(find.text('GUARDAR CAMBIOS'));
    await tester.pumpAndSettle();
    expect(find.text('Ese nombre de usuario ya está en uso'), findsOneWidget);
  });

  test('Me.fromJson con y sin nombre de usuario', () {
    final me = Me.fromJson({'id': 3, 'email': 'a@b.c', 'username': 'Lola', 'displayName': 'Lola', 'avatar': 'jaguar'});
    expect((me.username, me.displayName, me.avatar), ('Lola', 'Lola', 'jaguar'));

    final old = Me.fromJson({'id': 9, 'email': 'a@b.c', 'username': null, 'avatar': null});
    expect((old.username, old.displayName, old.avatar), (null, 'Jugador #9', null));
  });

  test('ProfilePage acepta los mismos nombres que el servidor', () {
    for (final ok in ['Pepe', 'Peña_Ávila', 'a.b-c', '123']) {
      expect(usernamePattern.hasMatch(ok), isTrue, reason: ok);
    }
    for (final bad in ['ab', 'con espacio', 'hola!', 'x' * 21]) {
      expect(usernamePattern.hasMatch(bad), isFalse, reason: bad);
    }
  });
}
