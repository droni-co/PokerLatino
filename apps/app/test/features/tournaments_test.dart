import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:poker_latino/core/api/api_client.dart';
import 'package:poker_latino/core/auth/auth_service.dart';
import 'package:poker_latino/core/auth/token_storage.dart';
import 'package:poker_latino/core/models/models.dart';
import 'package:poker_latino/core/models/table_state.dart';
import 'package:poker_latino/core/models/tournament.dart';
import 'package:poker_latino/core/providers.dart';
import 'package:poker_latino/core/theme.dart';
import 'package:poker_latino/features/table/table_geometry.dart';
import 'package:poker_latino/features/table/table_page.dart';
import 'package:poker_latino/features/tournaments/tournament_callout.dart';
import 'package:poker_latino/features/tournaments/tournament_page.dart';
import 'package:poker_latino/features/tournaments/tournament_widgets.dart';
import 'package:poker_latino/features/tournaments/tournaments_page.dart';

import '../fixtures.dart';

/// Como lo devuelve GET /api/v1/tournaments
Json tournamentJson({int id = 7, String status = 'registering', int entries = 3, Json? you, String? startsAt}) => {
  'id': id,
  'slug': 'nocturno-$id',
  'name': 'Torneo Nocturno',
  'description': 'Todos los días a las 21:00',
  'status': status,
  'startsAt': startsAt ?? DateTime.now().add(const Duration(days: 1)).toUtc().toIso8601String(),
  'startedAt': status == 'registering' ? null : DateTime.now().toUtc().toIso8601String(),
  'finishedAt': null,
  'buyIn': 100,
  'startingStack': 1500,
  'smallBlind': 10,
  'bigBlind': 20,
  'blindsUpEveryHands': 5,
  'maxSeats': 5,
  'tableCount': 2,
  'capacity': 10,
  'actionTimeoutSeconds': 15,
  'entriesCount': entries,
  'playersLeft': status == 'running' ? entries : 0,
  'prizePool': entries * 100,
  'you': you,
};

class _Auth extends AuthController {
  @override
  Future<Me?> build() async => const Me(id: 1, email: 'a@b.c', username: 'Pepe');
}

class _Api extends ApiClient {
  _Api(this.list) : super(AuthService(storage: MemoryTokenStorage()));
  List<Json> list;
  final registered = <int>[];
  final unregistered = <int>[];

  @override
  Future<Wallet> wallet() async => const Wallet(balance: 1000);

  @override
  Future<List<Tournament>> tournaments() async => list.map(Tournament.fromJson).toList();

  @override
  Future<TournamentDetail> tournament(int id) async => TournamentDetail.fromJson({
    ...list.firstWhere((t) => t['id'] == id),
    'payouts': [
      {'position': 1, 'amount': 650},
      {'position': 2, 'amount': 350},
    ],
    'standings': [
      {
        'position': 1,
        'status': 'playing',
        'player': {'id': 2, 'displayName': 'Lupita', 'avatar': null},
        'chips': 2400,
        'tableNumber': 1,
        'roomId': 30,
        'prize': 0,
      },
      {
        'position': 2,
        'status': 'playing',
        'player': {'id': 1, 'displayName': 'Pepe', 'avatar': null},
        'chips': 900,
        'tableNumber': 2,
        'roomId': 31,
        'prize': 0,
      },
      {
        'position': 10,
        'status': 'eliminated',
        'player': {'id': 3, 'displayName': 'Chucho', 'avatar': null},
        'chips': null,
        'tableNumber': null,
        'roomId': null,
        'prize': 0,
      },
    ],
  });

  @override
  Future<Tournament> registerTournament(int id) async {
    registered.add(id);
    list = [
      for (final t in list)
        t['id'] == id
            ? {
                ...t,
                'entriesCount': (t['entriesCount'] as int) + 1,
                'you': {'status': 'registered'},
              }
            : t,
    ];
    return Tournament.fromJson(list.firstWhere((t) => t['id'] == id));
  }

  @override
  Future<Tournament> unregisterTournament(int id) async {
    unregistered.add(id);
    list = [
      for (final t in list) t['id'] == id ? {...t, 'you': null} : t,
    ];
    return Tournament.fromJson(list.firstWhere((t) => t['id'] == id));
  }
}

Future<_Api> _pump(WidgetTester tester, List<Json> list, {String initial = '/tournaments'}) async {
  tester.view.physicalSize = const Size(900, 1400);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  final api = _Api(list);
  final router = GoRouter(
    initialLocation: initial,
    routes: [
      GoRoute(
        path: '/tournaments',
        builder: (_, _) => const Scaffold(body: TournamentsPage()),
      ),
      GoRoute(
        path: '/tournaments/:id',
        builder: (_, s) => Scaffold(body: TournamentPage(tournamentId: int.parse(s.pathParameters['id']!))),
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
  group('modelos', () {
    test('torneo con inscripción del jugador', () {
      final t = Tournament.fromJson(
        tournamentJson(you: {'status': 'playing', 'roomId': 31, 'position': null, 'prize': 0}),
      );
      expect(t.capacity, 10);
      expect(t.isFull, isFalse);
      expect(t.you!.isPlaying, isTrue);
      expect(t.you!.roomId, 31);
    });

    test('estado de mesa de torneo', () {
      final json = Map<String, dynamic>.from(fixture('table_state_in_hand')['data'] as Json);
      json['tournament'] = {
        'id': 7,
        'name': 'Torneo Nocturno',
        'status': 'running',
        'level': 3,
        'handsToNextLevel': 2,
        'nextSmallBlind': 80,
        'nextBigBlind': 160,
        'playersLeft': 7,
        'entrants': 10,
        'yourRoomId': 31,
        'yourResult': null,
      };
      final state = TableState.fromJson(json);
      expect(state.tournament!.level, 3);
      expect(tournamentLevelLabel(state.tournament!), 'Nivel 3 · suben a 80/160 en 2 manos · quedan 7');
    });

    test('fecha de inicio en palabras', () {
      final now = DateTime(2026, 11, 15, 12);
      expect(formatTournamentStart(DateTime(2026, 11, 15, 21), now: now), 'Hoy 21:00');
      expect(formatTournamentStart(DateTime(2026, 11, 16, 9, 5), now: now), 'Mañana 09:05');
      expect(formatTournamentStart(DateTime(2026, 11, 24, 21), now: now), '24/11 21:00');
    });
  });

  testWidgets('lista los torneos con sus reglas e inscribe tras confirmar', (tester) async {
    final api = await _pump(tester, [tournamentJson()]);
    expect(tester.takeException(), isNull);
    expect(find.text('Torneo Nocturno'), findsOneWidget);
    expect(find.text('Inscripción abierta'), findsOneWidget);
    expect(find.text('3/10'), findsOneWidget);
    expect(find.text('10/20 · ×2 cada 5 manos'), findsOneWidget);

    await tester.tap(find.text('INSCRIBIRME'));
    await tester.pumpAndSettle();
    expect(find.textContaining('La inscripción cuesta 100 fichas'), findsOneWidget);
    await tester.tap(find.widgetWithText(FilledButton, 'Inscribirme'));
    await tester.pumpAndSettle();

    expect(api.registered, [7]);
    expect(find.text('Inscrito'), findsOneWidget);
    expect(find.text('4/10'), findsOneWidget);

    await tester.tap(find.text('Salirme'));
    await tester.pumpAndSettle();
    expect(api.unregistered, [7]);
    expect(find.text('INSCRIBIRME'), findsOneWidget);
  });

  testWidgets('a la hora sin cupo completo explica que espera a llenarse', (tester) async {
    await _pump(tester, [
      tournamentJson(startsAt: DateTime.now().subtract(const Duration(minutes: 5)).toUtc().toIso8601String()),
    ]);
    expect(find.text('Empieza en cuanto se complete el cupo (7 libres)'), findsOneWidget);
  });

  testWidgets('en juego: lleva a la mesa del jugador', (tester) async {
    await _pump(tester, [
      tournamentJson(status: 'running', entries: 10, you: {'status': 'playing', 'roomId': 31}),
    ]);
    expect(find.text('En juego'), findsOneWidget);
    await tester.tap(find.text('IR A MI MESA'));
    await tester.pumpAndSettle();
    expect(find.text('mesa 31'), findsOneWidget);
  });

  testWidgets('detalle: premios y clasificación', (tester) async {
    await _pump(tester, [
      tournamentJson(status: 'running', entries: 10, you: {'status': 'playing', 'roomId': 31}),
    ], initial: '/tournaments/7');
    expect(tester.takeException(), isNull);
    expect(find.textContaining('650 fichas', findRichText: true), findsOneWidget);
    expect(find.text('Pepe (tú)'), findsOneWidget);
    expect(find.text('2,400 fichas · Mesa 1'), findsOneWidget);
    expect(find.text('Eliminado'), findsOneWidget);
  });

  testWidgets('torneo terminado: muestra el resultado del jugador', (tester) async {
    await _pump(tester, [
      tournamentJson(status: 'finished', entries: 10, you: {'status': 'eliminated', 'position': 2, 'prize': 350}),
    ]);
    expect(find.text('Terminaste en el puesto 2º · Premio: 350 fichas'), findsOneWidget);
  });

  testWidgets('menú de mesa de torneo: sin levantarse', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: buildTheme(),
        home: const Scaffold(body: TableMenuForTest(seated: true, tournament: true)),
      ),
    );
    expect(find.text('Salir al lobby'), findsOneWidget);
    expect(find.text('Levantarse'), findsNothing);
  });

  group('aviso de torneo en juego', () {
    test('solo cuando juegas un torneo en curso y tienes mesa', () {
      Tournament t(String status, Json? you) => Tournament.fromJson(tournamentJson(status: status, you: you));
      expect(
        myTournamentInPlay([
          t('registering', {'status': 'registered'}),
        ]),
        isNull,
      );
      expect(
        myTournamentInPlay([
          t('running', {'status': 'eliminated', 'position': 4}),
        ]),
        isNull,
      );
      expect(
        myTournamentInPlay([
          t('running', {'status': 'playing', 'roomId': 31}),
        ])?.you?.roomId,
        31,
      );
    });

    testWidgets('el botón lleva a la mesa', (tester) async {
      var went = false;
      await tester.pumpWidget(
        MaterialApp(
          theme: buildTheme(),
          home: Scaffold(
            body: TournamentCalloutCard(name: 'Torneo Nocturno', onGo: () => went = true),
          ),
        ),
      );
      expect(find.text('Torneo Nocturno empezó: tu mesa te espera'), findsOneWidget);
      await tester.tap(find.text('Ir a mi mesa'));
      expect(went, isTrue);
    });
  });

  test('asientos de arriba: las cartas van al lado del avatar, no bajo él (donde va la placa)', () {
    for (final size in const [Size(1280, 720), Size(844, 390), Size(390, 844)]) {
      for (final seats in const [2, 5, 6]) {
        final g = TableGeometry.compute(size, maxSeats: seats);
        for (final s in g.seats.where((s) => s.avatarCenter.dy < g.center.dy - g.radii.height * 0.3)) {
          expect(s.cardsPoint.dy, lessThanOrEqualTo(s.avatarCenter.dy), reason: '$size/$seats');
          expect((s.cardsPoint.dx - s.avatarCenter.dx).abs(), greaterThan(g.avatarSize), reason: '$size/$seats');
          // Hacia el centro de la mesa
          final toward = (g.center.dx - s.avatarCenter.dx).sign;
          if (toward != 0) expect((s.cardsPoint.dx - s.avatarCenter.dx).sign, toward);
        }
      }
    }
  });
}
