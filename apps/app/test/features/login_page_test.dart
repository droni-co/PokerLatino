import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:poker_latino/core/api/api_exception.dart';
import 'package:poker_latino/core/auth/auth_service.dart';
import 'package:poker_latino/core/auth/token_storage.dart';
import 'package:poker_latino/core/models/models.dart';
import 'package:poker_latino/core/providers.dart';
import 'package:poker_latino/core/theme.dart';
import 'package:poker_latino/features/auth/login_page.dart';

/// Sesión simulada: registra los intentos y falla con [fail] si se indica
class _Auth extends AuthController {
  final logins = <(String, String)>[];
  final registrations = <Map<String, Object?>>[];
  ApiException? fail;

  @override
  Future<Me?> build() async => null;

  @override
  Future<void> login({required String email, required String password}) async {
    logins.add((email, password));
    if (fail != null) throw fail!;
  }

  @override
  Future<void> register({
    required String username,
    required String email,
    required String password,
    required String passwordConfirmation,
    required DateTime birthDate,
    String? referralCode,
  }) async {
    registrations.add({'username': username, 'birthDate': birthDate, 'referralCode': referralCode});
    if (fail != null) throw fail!;
  }
}

Future<_Auth> _pump(WidgetTester tester) async {
  tester.view.physicalSize = const Size(420, 2000);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  final auth = _Auth();
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        authControllerProvider.overrideWith(() => auth),
        authServiceProvider.overrideWithValue(AuthService(storage: MemoryTokenStorage())),
      ],
      child: MaterialApp(theme: buildTheme(), home: const LoginPage()),
    ),
  );
  await tester.pumpAndSettle();
  return auth;
}

Future<void> _pick(WidgetTester tester, String hint, String option) async {
  final dropdown = find.widgetWithText(DropdownButtonFormField<int>, hint);
  await tester.ensureVisible(dropdown);
  await tester.tap(dropdown);
  await tester.pumpAndSettle();
  await tester.tap(find.text(option).last);
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('entrar con email y contraseña; muestra el error del servidor', (tester) async {
    final auth = await _pump(tester);

    await tester.ensureVisible(find.byKey(const ValueKey('login-submit')));
    await tester.tap(find.byKey(const ValueKey('login-submit')));
    await tester.pumpAndSettle();
    expect(find.text('Escribe tu email'), findsOneWidget);
    expect(auth.logins, isEmpty);

    await tester.enterText(find.byKey(const ValueKey('login-email')), ' ana@test.com ');
    await tester.enterText(find.byKey(const ValueKey('login-password')), 'mala');
    auth.fail = ApiException('Email o contraseña incorrectos', code: 'invalid_credentials');
    await tester.ensureVisible(find.byKey(const ValueKey('login-submit')));
    await tester.tap(find.byKey(const ValueKey('login-submit')));
    await tester.pumpAndSettle();

    expect(auth.logins, [('ana@test.com', 'mala')]);
    expect(find.text('Email o contraseña incorrectos'), findsOneWidget);
  });

  testWidgets('crear cuenta: valida la edad y envía los datos', (tester) async {
    final auth = await _pump(tester);
    await tester.tap(find.byKey(const ValueKey('auth-tab-CREAR CUENTA')));
    await tester.pumpAndSettle();

    await tester.enterText(find.byKey(const ValueKey('register-username')), 'ana_77');
    await tester.enterText(find.byKey(const ValueKey('register-email')), 'ana@test.com');
    await tester.enterText(find.byKey(const ValueKey('register-password')), 'secreto123');
    await tester.enterText(find.byKey(const ValueKey('register-confirmation')), 'otra');
    final submit = find.byKey(const ValueKey('register-submit'));
    await tester.ensureVisible(submit);
    await tester.tap(submit);
    await tester.pumpAndSettle();
    expect(find.text('Las contraseñas no coinciden'), findsOneWidget);
    expect(find.text('Indica tu fecha de nacimiento'), findsOneWidget);
    expect(auth.registrations, isEmpty);

    await tester.enterText(find.byKey(const ValueKey('register-confirmation')), 'secreto123');
    await _pick(tester, 'Día', '2');
    await _pick(tester, 'Mes', 'mayo');
    await _pick(tester, 'Año', '1990');
    auth.fail = ApiException('Ese nombre de usuario ya está en uso', code: 'validation_error', field: 'username');
    await tester.ensureVisible(submit);
    await tester.tap(submit);
    await tester.pumpAndSettle();

    expect(auth.registrations.single['birthDate'], DateTime(1990, 5, 2));
    expect(auth.registrations.single['username'], 'ana_77');
    expect(find.text('Ese nombre de usuario ya está en uso'), findsOneWidget);
  });
}
