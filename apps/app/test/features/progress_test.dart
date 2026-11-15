import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:poker_latino/core/api/api_client.dart';
import 'package:poker_latino/core/auth/auth_service.dart';
import 'package:poker_latino/core/auth/token_storage.dart';
import 'package:poker_latino/core/models/models.dart';
import 'package:poker_latino/core/models/progress.dart';
import 'package:poker_latino/core/models/social.dart';
import 'package:poker_latino/core/models/table_state.dart';
import 'package:poker_latino/core/providers.dart';
import 'package:poker_latino/core/theme.dart';
import 'package:poker_latino/features/progress/progress_widgets.dart';
import 'package:poker_latino/features/table/widgets/seat_view.dart';

Json achievementJson(String key, String name, {String? unlockedAt, Json? progress, String category = 'manos'}) => {
  'key': key,
  'name': name,
  'description': 'Descripción de $name',
  'category': category,
  'tier': 'bronze',
  'icon': 'cards',
  'xp': 150,
  'chips': 200,
  'unlockedAt': unlockedAt,
  'progress': progress,
};

Json cardJson({String relation = 'none'}) => {
  'player': {'id': 2, 'displayName': 'Lupita', 'avatar': null},
  'memberSince': '2026-01-01T00:00:00.000Z',
  'relation': {'status': relation, 'requestId': null},
  'level': 4,
  'xp': 750,
  'levelXp': 600,
  'nextLevelXp': 1000,
  'stats': {'hands': 1234, 'wins': 300, 'biggestPot': 15000, 'bestWinStreak': 5},
  'unlockedCount': 1,
  'totalCount': 2,
  'achievements': [
    achievementJson('first_hand', 'Primera mano', unlockedAt: '2026-11-15T10:00:00.000Z'),
    achievementJson('hands_100', 'Habitual', progress: {'current': 40, 'target': 100, 'done': false}),
  ],
};

class _Api extends ApiClient {
  _Api() : super(AuthService(storage: MemoryTokenStorage()));

  @override
  Future<PlayerCard> playerCard(int playerId) async => PlayerCard.fromJson(cardJson());

  @override
  Future<FriendsList> friends({int? roomId}) async => const FriendsList();

  @override
  Future<PlayerProgress> myProgress() async => PlayerProgress.fromJson(cardJson());

  @override
  Future<Inbox> inbox() async => const Inbox();
}

class _Auth extends AuthController {
  @override
  Future<Me?> build() async => const Me(id: 1, email: 'a@b.c', username: 'Pepe');
}

Future<void> _pump(WidgetTester tester, Widget child) async {
  tester.view.physicalSize = const Size(900, 1600);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(
    ProviderScope(
      overrides: [apiClientProvider.overrideWithValue(_Api()), authControllerProvider.overrideWith(_Auth.new)],
      child: MaterialApp(
        theme: buildTheme(),
        home: Scaffold(body: child),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  test('modelos: progreso del nivel y novedades', () {
    final p = PlayerProgress.fromJson(cardJson());
    expect(p.level, 4);
    expect(p.levelFraction, closeTo(150 / 400, 0.001));
    expect(p.achievements.first.unlocked, isTrue);
    expect(p.achievements.last.progress!.fraction, 0.4);

    final card = PlayerCard.fromJson(cardJson(relation: 'self'));
    expect(card.isSelf, isTrue);

    final news = ProgressNews.fromJson({
      'level': 5,
      'levelUp': {'from': 4, 'to': 5, 'chips': 500},
      'achievements': [achievementJson('first_win', 'Primera victoria')],
    });
    expect(news.isEmpty, isFalse);
    expect(news.levelUp!.to, 5);
    expect(const ProgressNews().isEmpty, isTrue);
  });

  test('color del nivel crece por tramos', () {
    expect(levelColor(1), tierColor('bronze'));
    expect(levelColor(10), tierColor('silver'));
    expect(levelColor(25), tierColor('gold'));
    expect(levelColor(80), tierColor('diamond'));
  });

  testWidgets('el nivel sale junto al avatar en la mesa', (tester) async {
    await _pump(
      tester,
      const Center(
        child: SeatView(
          seat: TableSeat(
            seatNumber: 1,
            playerId: 7,
            displayName: 'Lupita',
            stack: 500,
            inHand: false,
            committed: 0,
            folded: false,
            allIn: false,
            isTurn: false,
            holeCards: null,
            level: 12,
          ),
          isMe: false,
          avatarSize: 64,
        ),
      ),
    );
    expect(find.byKey(const ValueKey('level-12')), findsOneWidget);
  });

  testWidgets('tarjeta de un jugador: nivel, números y logros', (tester) async {
    await _pump(tester, const PlayerCardSheet(player: PlayerRef(id: 2, displayName: 'Lupita')));

    expect(find.text('Lupita'), findsOneWidget);
    expect(find.text('Nivel 4 · 1 de 2 logros'), findsOneWidget);
    expect(find.text('150 / 400 XP para el nivel 5'), findsOneWidget);
    expect(find.text('1,234'), findsOneWidget);
    expect(find.text('Logros (1/2)'), findsOneWidget);
    expect(find.text('Primera mano'), findsOneWidget);
    expect(find.text('Por conseguir (1)'), findsOneWidget);
    expect(find.text('Agregar'), findsOneWidget);
  });

  testWidgets('mis logros con su avance, por categoría', (tester) async {
    await _pump(tester, const SingleChildScrollView(child: MyProgressPanel()));

    expect(find.text('Pepe'), findsOneWidget);
    expect(find.text('Manos · 1/2'), findsOneWidget);
    expect(find.text('40/100'), findsOneWidget);
    expect(find.byKey(const ValueKey('achievement-hands_100')), findsOneWidget);
  });

  testWidgets('aviso de nivel nuevo y logros', (tester) async {
    var closed = 0;
    await _pump(
      tester,
      Center(
        child: ProgressToastCard(
          news: ProgressNews.fromJson({
            'level': 5,
            'levelUp': {'from': 4, 'to': 5, 'chips': 500},
            'achievements': [achievementJson('first_win', 'Primera victoria')],
          }),
          onClose: () => closed++,
        ),
      ),
    );
    expect(find.text('¡Subiste a nivel 5!'), findsOneWidget);
    expect(find.text('Logro: Primera victoria'), findsOneWidget);
    expect(find.text('+700 fichas'), findsOneWidget);
    await tester.tap(find.byTooltip('Cerrar'));
    expect(closed, 1);
  });
}
