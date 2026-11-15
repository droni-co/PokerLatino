import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:poker_latino/core/models/models.dart';
import 'package:poker_latino/core/models/table_state.dart';
import 'package:poker_latino/core/theme.dart';
import 'package:poker_latino/features/table/widgets/action_bar.dart';
import 'package:poker_latino/features/table/widgets/table_scene.dart';

import '../fixtures.dart';

/// Última mano sin showdown: el jugador 2 ganó porque los demás se retiraron
Json betweenHands({bool shown = false, bool canShow = true}) {
  final data = fixture('table_state_showdown')['data'] as Json;
  final last = data['lastHand'] as Json;
  last['showdown'] = false;
  for (final p in (last['players'] as List).cast<Json>()) {
    final winner = p['playerId'] == 2;
    p['folded'] = !winner;
    p['bestCards'] = null;
    p['handName'] = winner && shown ? 'Full' : null;
    p['shown'] = winner && shown;
    if (!(winner && shown)) p['holeCards'] = null;
  }
  last['yourCards'] = ['Jd', 'Qc'];
  last['canShow'] = canShow;
  data['nextHandAt'] = DateTime.now().add(const Duration(seconds: 12)).toUtc().toIso8601String();
  return data;
}

Future<void> pump(WidgetTester tester, Widget child, Size size) async {
  tester.view.physicalSize = size;
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(
    MaterialApp(
      theme: buildTheme(),
      home: Scaffold(body: child),
    ),
  );
}

void main() {
  test('lee mis cartas, si puedo enseñarlas y cuándo empieza la siguiente mano', () {
    final s = TableState.fromJson(betweenHands(shown: true, canShow: false));
    final last = s.lastHand!;
    expect(last.yourCards, ['Jd', 'Qc']);
    expect(last.canShow, isFalse);
    final winner = last.players.firstWhere((p) => p.playerId == 2);
    expect(winner.shown, isTrue);
    expect(winner.holeCards, ['6h', '5s']);
    expect(s.nextHandAt!.isAfter(DateTime.now()), isTrue);
    // Sin showdown no hay cartas ganadoras que resaltar
    expect(last.winningCards, isEmpty);
  });

  testWidgets('entre manos: cuenta atrás y botón para enseñar mis cartas', (tester) async {
    final s = TableState.fromJson(betweenHands());
    final mySeat = s.seatAt(1)!;
    var shown = false;
    var taps = 0;
    await pump(
      tester,
      StatefulBuilder(
        builder: (context, setState) => Align(
          alignment: Alignment.bottomCenter,
          child: TableControls(
            mySeat: mySeat,
            hand: null,
            legal: null,
            status: 'Próxima mano en',
            countdownTo: s.nextHandAt,
            showCards: (cards: s.lastHand!.yourCards!, shown: shown),
            onShowCards: () async => setState(() {
              taps++;
              shown = true;
            }),
            preAction: null,
            onPreAction: (_) {},
            onAction: (action, {amount}) async {},
          ),
        ),
      ),
      const Size(390, 760),
    );

    expect(find.byKey(const ValueKey('next-hand-countdown')), findsOneWidget);
    expect(find.textContaining(RegExp(r'^1[12] s$')), findsOneWidget);
    expect(find.byKey(const ValueKey('pre-check')), findsNothing); // sustituidas por el botón

    await tester.tap(find.text('Enseñar mis cartas'));
    await tester.pump();
    expect(taps, 1);
    expect(find.text('Enseñaste tus cartas'), findsOneWidget);
    await tester.tap(find.text('Enseñaste tus cartas'));
    await tester.pump();
    expect(taps, 1);
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox()); // detiene el reloj de la cuenta atrás
  });

  testWidgets('cuando un rival enseña sus cartas se voltean en la mesa', (tester) async {
    final before = TableState.fromJson(betweenHands());
    final after = TableState.fromJson(betweenHands(shown: true));
    Widget scene(TableState s) => TableScene(state: s, myPlayerId: 1);

    await pump(tester, scene(before), const Size(1280, 720));
    expect(find.text('Full'), findsNothing);

    await tester.pumpWidget(
      MaterialApp(
        theme: buildTheme(),
        home: Scaffold(body: scene(after)),
      ),
    );
    await tester.pump(const Duration(milliseconds: 100));
    expect(find.text('Enseña'), findsOneWidget);
    expect(find.text('Full'), findsOneWidget);

    await tester.pump(const Duration(seconds: 1)); // termina el volteo
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox()); // la escena usa el reloj real para los globos
  });
}
