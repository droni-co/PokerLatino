import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:poker_latino/core/api/api_client.dart';
import 'package:poker_latino/core/api/api_exception.dart';
import 'package:poker_latino/core/auth/auth_service.dart';
import 'package:poker_latino/core/auth/token_storage.dart';
import 'package:poker_latino/core/models/models.dart';
import 'package:poker_latino/core/providers.dart';
import 'package:poker_latino/core/theme.dart';
import 'package:poker_latino/features/lobby/lobby_page.dart';

import '../fixtures.dart';

class _Auth extends AuthController {
  @override
  Future<Me?> build() async => const Me(id: 1, email: 'a@b.c', username: 'Pepe');
}

class _Api extends ApiClient {
  _Api() : super(AuthService(storage: MemoryTokenStorage()));
  final seats = <({int levelId, int buyIn})>[];
  ApiException? fail;
  bool alreadySeated = false;

  @override
  Future<Wallet> wallet() async => const Wallet(balance: 1500);

  @override
  Future<List<RoomLevel>> levels() async =>
      (fixture('levels')['data'] as List).map((l) => RoomLevel.fromJson(l as Json)).toList();

  @override
  Future<QuickSeat> quickSeat(int levelId, {required int buyIn}) async {
    if (fail != null) throw fail!;
    seats.add((levelId: levelId, buyIn: buyIn));
    return QuickSeat(roomId: 5, alreadySeated: alreadySeated);
  }
}

Future<_Api> _pumpLobby(WidgetTester tester, {double width = 420}) async {
  tester.view.physicalSize = Size(width, 1400);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  final api = _Api();
  final router = GoRouter(
    initialLocation: '/lobby',
    routes: [
      GoRoute(
        path: '/lobby',
        builder: (_, _) => const Scaffold(body: LobbyPage()),
      ),
      GoRoute(path: '/rooms/:id', builder: (_, s) => Text('mesa ${s.pathParameters['id']}')),
    ],
  );
  await tester.pumpWidget(
    ProviderScope(
      overrides: [authControllerProvider.overrideWith(_Auth.new), apiClientProvider.overrideWithValue(api)],
      child: MaterialApp.router(theme: buildTheme(), routerConfig: router),
    ),
  );
  await tester.pumpAndSettle();
  return api;
}

void main() {
  testWidgets('muestra cada nivel con sus mesas abiertas', (tester) async {
    await _pumpLobby(tester);
    expect(tester.takeException(), isNull);
    expect(find.text('Principiantes'), findsOneWidget);
    expect(find.text('3 mesas · 9 jugadores'), findsOneWidget);
    expect(find.text('1 mesa · 1 jugador'), findsOneWidget);
    expect(find.text('Llena'), findsOneWidget); // Principiantes · Mesa 1
    expect(find.text('Mesa 2'), findsOneWidget); // las demás se ven deslizando
  });

  testWidgets('JUGAR pide el buy-in, sienta en el nivel y abre la mesa elegida', (tester) async {
    final api = await _pumpLobby(tester);

    await tester.tap(find.text('JUGAR').first);
    await tester.pumpAndSettle();
    expect(find.text('Jugar en Principiantes'), findsOneWidget);
    expect(find.text('1,000 fichas'), findsWidgets); // máximo del nivel (tiene 1,500)

    await tester.tap(find.widgetWithText(FilledButton, 'Sentarse'));
    await tester.pumpAndSettle();
    expect(api.seats, [(levelId: 1, buyIn: 1000)]);
    expect(find.text('mesa 5'), findsOneWidget);
  });

  testWidgets('tocar una mesa la abre directamente', (tester) async {
    final api = await _pumpLobby(tester);
    await tester.tap(find.byKey(const ValueKey('table-4')));
    await tester.pumpAndSettle();
    expect(find.text('mesa 4'), findsOneWidget);
    expect(api.seats, isEmpty);
  });

  testWidgets('muestra el error si no se puede sentar', (tester) async {
    final api = await _pumpLobby(tester);
    api.fail = ApiException('Todas las mesas de este nivel están llenas', code: 'room_full');

    await tester.tap(find.text('JUGAR').first);
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(FilledButton, 'Sentarse'));
    await tester.pumpAndSettle();
    expect(find.text('Todas las mesas de este nivel están llenas'), findsOneWidget);
    expect(find.text('Principiantes'), findsOneWidget); // sigue en el lobby
  });

  test('RoomLevel.fromJson', () {
    final level = RoomLevel.fromJson((fixture('levels')['data'] as List).first as Json);
    expect((level.blindsLabel, level.playerCount, level.tables.length), ('5 / 10', 9, 3));
    expect(level.tables.first.isFull, isTrue);
  });
}
