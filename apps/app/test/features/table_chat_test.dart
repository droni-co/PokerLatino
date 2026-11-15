import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:poker_latino/core/api/api_client.dart';
import 'package:poker_latino/core/api/api_exception.dart';
import 'package:poker_latino/core/auth/auth_service.dart';
import 'package:poker_latino/core/auth/token_storage.dart';
import 'package:poker_latino/core/models/table_state.dart';
import 'package:poker_latino/core/providers.dart';
import 'package:poker_latino/core/theme.dart';
import 'package:poker_latino/features/table/table_chat.dart';
import 'package:poker_latino/features/table/widgets/chat_panel.dart';
import 'package:poker_latino/features/table/widgets/table_scene.dart';

import '../fixtures.dart';

ChatMessage msg(int id, int playerId, String body) => ChatMessage(
  id: id,
  playerId: playerId,
  displayName: 'Jugador #$playerId',
  body: body,
  createdAt: DateTime(2026, 11, 14, 18),
);

class _Api extends ApiClient {
  _Api() : super(AuthService(storage: MemoryTokenStorage()));
  final sent = <String>[];
  ApiException? fail;

  @override
  Future<ChatMessage> sendChat(int roomId, String body) async {
    if (fail != null) throw fail!;
    sent.add(body);
    return msg(100 + sent.length, 1, body);
  }
}

void main() {
  test('merge: sin duplicados, en orden, y el historial inicial no es burbuja', () {
    final container = ProviderContainer();
    addTearDown(container.dispose);
    final sub = container.listen(tableChatProvider(1), (_, _) {});
    addTearDown(sub.close);
    final chat = container.read(tableChatProvider(1).notifier);
    final t0 = DateTime(2026, 11, 14, 18);

    chat.merge([msg(2, 7, 'hola'), msg(1, 8, 'buenas')], live: false, now: t0);
    chat.merge([msg(2, 7, 'hola'), msg(3, 7, '¡vamos!')], now: t0);

    expect(container.read(tableChatProvider(1)).map((e) => e.message.id), [1, 2, 3]);
    expect(chat.lastId, 3);
    // Solo el mensaje en vivo aparece sobre el jugador, y por unos segundos
    expect(chat.bubbles(t0).map((k, v) => MapEntry(k, v.body)), {7: '¡vamos!'});
    expect(chat.bubbles(t0.add(chatBubbleDuration)), isEmpty);
  });

  testWidgets('el mensaje aparece en un globo sobre el jugador', (tester) async {
    final s = stateFrom('table_state_showdown');
    tester.view.physicalSize = const Size(1280, 720);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(
      MaterialApp(
        theme: buildTheme(),
        home: Scaffold(
          body: TableScene(state: s, myPlayerId: 1, animate: false, chatBubbles: {2: msg(7, 2, '¡Full de cincos!')}),
        ),
      ),
    );
    expect(tester.takeException(), isNull);
    expect(find.text('¡Full de cincos!'), findsOneWidget);
    expect(find.text('GANADOR'), findsOneWidget);
  });

  testWidgets('panel de chat: historial, espectadores, enviar y frases rápidas', (tester) async {
    tester.view.physicalSize = const Size(420, 900);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    final api = _Api();
    final container = ProviderContainer(overrides: [apiClientProvider.overrideWithValue(api)]);
    addTearDown(container.dispose);
    final state = stateFrom('table_state_showdown');
    container.read(tableChatProvider(1).notifier).merge(state.chat, live: false);

    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: MaterialApp(
          theme: buildTheme(),
          home: const Scaffold(body: ChatPanel(roomId: 1, myPlayerId: 1, seatedPlayerIds: {1, 2, 3})),
        ),
      ),
    );
    expect(tester.takeException(), isNull);
    expect(find.text('¡Full de cincos!'), findsOneWidget);
    expect(find.text('mirando'), findsOneWidget); // "Mirón" no está sentado

    await tester.enterText(find.byType(TextField), '  Hola mesa  ');
    await tester.tap(find.byTooltip('Enviar'));
    await tester.pumpAndSettle();
    expect(api.sent, ['Hola mesa']);
    expect(find.text('Hola mesa'), findsOneWidget);
    expect(find.text('Tú'), findsOneWidget);

    await tester.tap(find.text(quickPhrases.first));
    await tester.pumpAndSettle();
    expect(api.sent.last, quickPhrases.first);

    api.fail = ApiException('Vas muy rápido: espera unos segundos', code: 'chat_rate_limited');
    await tester.enterText(find.byType(TextField), 'otro');
    await tester.tap(find.byTooltip('Enviar'));
    await tester.pumpAndSettle();
    expect(find.text('Vas muy rápido: espera unos segundos'), findsOneWidget);
  });
}
