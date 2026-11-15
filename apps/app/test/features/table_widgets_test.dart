import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:poker_latino/core/models/models.dart';
import 'package:poker_latino/core/models/table_state.dart';
import 'package:poker_latino/core/theme.dart';
import 'package:poker_latino/features/table/table_page.dart';
import 'package:poker_latino/features/table/table_logic.dart';
import 'package:poker_latino/features/table/widgets/action_bar.dart';
import 'package:poker_latino/features/table/widgets/hand_rankings.dart';
import 'package:poker_latino/features/table/widgets/table_scene.dart';

import '../fixtures.dart';


Future<void> pump(WidgetTester tester, Widget child, Size size) async {
  tester.view.physicalSize = size;
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(MaterialApp(theme: buildTheme(), home: Scaffold(body: child)));
}

const sizes = {'móvil': Size(390, 760), 'móvil horizontal': Size(800, 380), 'escritorio': Size(1440, 900)};

void main() {
  for (final MapEntry(key: label, value: size) in sizes.entries) {
    testWidgets('mesa en mano sin desbordes ($label)', (tester) async {
      final s = stateFrom('table_state_in_hand');
      final me = s.seatAt(s.you!.seatNumber)!;
      int? sitAt;
      await pump(tester, TableScene(state: s, myPlayerId: me.playerId, onSitAt: (n) => sitAt = n), size);

      expect(tester.takeException(), isNull);
      expect(find.text('Bote 15'), findsOneWidget);
      expect(find.text('Tú'), findsOneWidget);
      // 3 ocupados + 2 libres
      expect(find.byTooltip('Sentarse'), findsNWidgets(2));
      await tester.tap(find.byTooltip('Sentarse').first);
      expect(sitAt, isNotNull);
      expect(s.seatAt(sitAt!), isNull);
    });
  }

  testWidgets('tras el showdown muestra al ganador y las cartas', (tester) async {
    final s = stateFrom('table_state_showdown');
    await pump(tester, TableScene(state: s, myPlayerId: s.seats.first.playerId), const Size(390, 760));
    expect(tester.takeException(), isNull);
    expect(find.textContaining('gana'), findsOneWidget);
    // Sin onSitAt (ya sentado): los asientos libres no se pueden elegir
    expect(find.byTooltip('Sentarse'), findsNothing);
    expect(find.byTooltip('Libre'), findsNWidgets(2));
    expect(find.textContaining('Toca «Sentarse»'), findsNothing);
  });

  testWidgets('panel de acciones: igualar y subir con montos rápidos', (tester) async {
    final s = stateFrom('table_state_in_hand');
    final mySeat = s.seatAt(s.you!.seatNumber)!;
    final calls = <(String, int?)>[];
    await pump(
      tester,
      Align(
        alignment: Alignment.bottomCenter,
        child: TableControls(
          legal: s.you!.legalActions!,
          hand: s.hand!,
          mySeat: mySeat,
          status: 'TU TURNO',
          preAction: null,
          onPreAction: (_) {},
          onAction: (action, {amount}) async => calls.add((action, amount)),
        ),
      ),
      const Size(390, 760),
    );

    expect(find.text('RETIRARSE'), findsOneWidget);
    expect(find.text('IGUALAR'), findsOneWidget);
    expect(find.text('10'), findsWidgets);
    await tester.tap(find.text('IGUALAR'));
    await tester.pumpAndSettle();
    expect(calls.last, ('call', null));

    await tester.tap(find.text('SUBIR'));
    await tester.pumpAndSettle();
    expect(find.text('½ bote'), findsOneWidget);
    await tester.tap(find.text('Bote'));
    await tester.pumpAndSettle();
    expect(find.text('SUBIR A'), findsOneWidget);
    expect(find.text('35'), findsOneWidget);
    await tester.tap(find.text('SUBIR A'));
    await tester.pumpAndSettle();
    expect(calls.last, ('raise', 35));

    await tester.tap(find.text('SUBIR'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('All-in'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('ALL-IN'));
    await tester.pumpAndSettle();
    expect(calls.last, ('all_in', null));
    expect(tester.takeException(), isNull);

    // En tu turno las decisiones anticipadas están desactivadas (pero visibles)
    expect(find.byKey(const ValueKey('pre-checkFold')), findsOneWidget);
  });

  testWidgets('fuera de tu turno: mismos botones desactivados y decisiones anticipadas activas', (tester) async {
    final s = stateFrom('table_state_in_hand');
    final mySeat = s.seatAt(s.you!.seatNumber)!;
    final calls = <String>[];
    PreAction? chosen;
    await pump(
      tester,
      StatefulBuilder(
        builder: (context, setState) => Align(
          alignment: Alignment.bottomCenter,
          child: TableControls(
            legal: null,
            hand: s.hand!,
            mySeat: mySeat,
            status: 'Esperando tu turno',
            preAction: chosen,
            onPreAction: (v) => setState(() => chosen = v),
            onAction: (action, {amount}) async => calls.add(action),
          ),
        ),
      ),
      const Size(390, 760),
    );

    // Los tres botones siguen ahí, pero no hacen nada
    for (final label in ['RETIRARSE', 'IGUALAR', 'SUBIR']) {
      expect(find.text(label), findsOneWidget);
      await tester.tap(find.text(label));
    }
    await tester.pumpAndSettle();
    expect(calls, isEmpty);

    // Hay que igualar 10: "Pasar" no aplica, "Igualar 10" sí
    await tester.tap(find.byKey(const ValueKey('pre-check')));
    await tester.pump();
    expect(chosen, isNull);
    await tester.tap(find.byKey(const ValueKey('pre-call')));
    await tester.pump();
    expect(chosen, PreAction.call);
    expect(find.text('Igualar 10'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  test('cartas ganadoras del showdown', () {
    final last = stateFrom('table_state_showdown').lastHand!;
    expect(last.winningCards, {'5s', '5c', '5h', '6h', '6c'});
  });

  testWidgets('ayuda: clasificación de manos con la jugada actual resaltada', (tester) async {
    await pump(tester, const HandRankingsDialog(current: 'Full'), const Size(390, 900));
    expect(tester.takeException(), isNull);
    expect(find.text('Escalera real'), findsOneWidget);
    expect(find.text('Full'), findsOneWidget);
    await tester.scrollUntilVisible(find.text('Carta alta'), 200);
    expect(find.text('Carta alta'), findsOneWidget);
  });

  testWidgets('mano animada completa: reparto, apuestas y showdown sin errores', (tester) async {
    final inHand = stateFrom('table_state_in_hand');
    final me = inHand.seatAt(inHand.you!.seatNumber)!.playerId;
    Widget scene(TableState s) => TableScene(state: s, myPlayerId: me);

    await pump(tester, scene(beforeDeal()), const Size(1280, 720));
    expect(find.textContaining('La mano empieza'), findsOneWidget);

    // Reparto: las cartas vuelan y luego aparecen en los asientos
    await pump(tester, scene(inHand), const Size(1280, 720));
    await tester.pump(const Duration(milliseconds: 50));
    expect(tester.takeException(), isNull);
    await tester.pump(const Duration(seconds: 2));
    expect(find.text('Bote 15'), findsOneWidget);

    // Fin de la mano: fichas al bote, tablero, ganador con su brillo
    await pump(tester, scene(stateFrom('table_state_showdown')), const Size(1280, 720));
    for (var i = 0; i < 40; i++) {
      await tester.pump(const Duration(milliseconds: 150));
    }
    expect(tester.takeException(), isNull);
    expect(find.textContaining('gana 30'), findsOneWidget);
    // Que no queden temporizadores ni animaciones colgadas
    await tester.pumpWidget(const SizedBox());
    await tester.pump(const Duration(seconds: 5));
  });

  for (final MapEntry(key: label, value: size) in sizes.entries) {
    testWidgets('menú de mesa visible ($label)', (tester) async {
      await pump(
        tester,
        Stack(children: [
          Positioned(top: 0, right: 0, child: TableMenuForTest(seated: true)),
        ]),
        size,
      );
      expect(tester.takeException(), isNull);
      if (size.width >= 700) {
        expect(find.text('Abandonar la mesa'), findsOneWidget);
        expect(find.text('Levantarse'), findsOneWidget);
      } else {
        expect(find.byTooltip('Opciones de mesa'), findsOneWidget);
      }
    });
  }

  group('entrar a la mesa', () {
    final room = Room.fromJson((fixture('rooms')['data'] as List).first as Json); // 400–1000

    testWidgets('limita el máximo al saldo disponible', (tester) async {
      int? result;
      await pump(
        tester,
        Builder(
          builder: (context) => TextButton(
            onPressed: () async =>
                result = await showDialog<int>(context: context, builder: (_) => BuyInDialog(minBuyIn: room.minBuyIn, maxBuyIn: room.maxBuyIn, balance: 700)),
            child: const Text('abrir'),
          ),
        ),
        const Size(390, 760),
      );
      await tester.tap(find.text('abrir'));
      await tester.pumpAndSettle();
      expect(find.text('700 fichas'), findsOneWidget);
      await tester.tap(find.widgetWithText(FilledButton, 'Sentarse'));
      await tester.pumpAndSettle();
      expect(result, 700);
    });

    testWidgets('sin saldo suficiente no deja sentarse', (tester) async {
      await pump(tester, BuyInDialog(minBuyIn: room.minBuyIn, maxBuyIn: room.maxBuyIn, balance: 300), const Size(390, 760));
      expect(find.textContaining('Necesitas al menos 400 fichas'), findsOneWidget);
      expect(find.widgetWithText(FilledButton, 'Sentarse'), findsNothing);
    });
  });

  testWidgets('menú muestra "Saliendo…" cuando el retiro está pendiente', (tester) async {
    await pump(
      tester,
      const Stack(children: [
        Positioned(top: 0, right: 0, child: TableMenuForTest(seated: true, leaving: true)),
      ]),
      const Size(1440, 900),
    );
    expect(find.text('Saliendo…'), findsOneWidget);
    expect(find.text('Levantarse'), findsNothing);
  });

  testWidgets('asientos marcan jugadores inactivos o saliendo', (tester) async {
    final json = fixture('table_state_in_hand')['data'] as Json;
    final seats = (json['seats'] as List).cast<Json>();
    final youSeat = (json['you'] as Json)['seatNumber'];
    final others = seats.where((s) => s['seatNumber'] != youSeat).toList();
    others[0]['missedHands'] = 1;
    others[1]['leaving'] = true;
    final s = TableState.fromJson(json);
    final me = s.seatAt(s.you!.seatNumber)!;

    await pump(tester, TableScene(state: s, myPlayerId: me.playerId), const Size(1440, 900));
    expect(tester.takeException(), isNull);
    expect(find.text('Inactivo'), findsOneWidget);
    expect(find.text('Saliendo'), findsOneWidget);
  });
}

/// Copia del estado "en mano" pero entre manos (antes del reparto)
TableState beforeDeal() {
  final json = fixture('table_state_in_hand')['data'] as Json;
  return TableState.fromJson({
    ...json,
    'hand': null,
    'you': null,
    'seats': [
      for (final s in (json['seats'] as List).cast<Json>()) {...s, 'inHand': false, 'committed': 0, 'isTurn': false, 'holeCards': null},
    ],
  });
}
