import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:poker_latino/core/api/api_client.dart';
import 'package:poker_latino/core/api/api_exception.dart';
import 'package:poker_latino/core/auth/auth_service.dart';
import 'package:poker_latino/core/auth/token_storage.dart';
import 'package:poker_latino/core/models/models.dart';
import 'package:poker_latino/core/models/referral.dart';
import 'package:poker_latino/core/providers.dart';
import 'package:poker_latino/core/theme.dart';
import 'package:poker_latino/features/referrals/referral_widgets.dart';

Json summaryJson({int rewardedToday = 1, String? nextSlotAt}) => {
  'code': 'ABC2345',
  'link': 'https://poker.test/r/ABC2345',
  'referrerReward': 500,
  'referredReward': 500,
  'maxRewardedPerDay': 5,
  'rewardedToday': rewardedToday,
  'nextSlotAt': nextSlotAt,
  'totalInvited': 3,
  'totalEarned': 1000,
  'invited': [
    {
      'player': {'id': 2, 'displayName': 'Lupita', 'avatar': null},
      'status': 'rewarded',
      'reward': 500,
      'createdAt': '2026-11-15T10:00:00.000Z',
    },
    {
      'player': {'id': 3, 'displayName': 'Toño', 'avatar': null},
      'status': 'limit_reached',
      'reward': 0,
      'createdAt': '2026-11-15T09:00:00.000Z',
    },
    {
      'player': {'id': 4, 'displayName': 'Pepe2', 'avatar': null},
      'status': 'blocked',
      'reward': 0,
      'createdAt': '2026-11-15T08:00:00.000Z',
    },
  ],
};

class _Api extends ApiClient {
  _Api({required this.rescue, Json? summary})
    : summary = summary ?? summaryJson(),
      super(AuthService(storage: MemoryTokenStorage()));

  Json rescue;
  Json summary;
  int balance = 0;
  int claims = 0;

  @override
  Future<Wallet> wallet() async => Wallet(balance: balance);

  @override
  Future<GameConfig> config() async => const GameConfig(signupBonus: 1000, rake: 0, maxSeats: 9);

  @override
  Future<RescueStatus> rescueStatus() async => RescueStatus.fromJson(rescue);

  @override
  Future<ReferralSummary> referrals() async => ReferralSummary.fromJson(summary);

  @override
  Future<RescueStatus> claimRescue() async {
    if (rescue['available'] != true) throw ApiException('Ya reclamaste tu rescate: vuelve mañana');
    claims++;
    balance += 400;
    rescue = {...rescue, 'eligible': false, 'available': false};
    return RescueStatus.fromJson({...rescue, 'eligible': true});
  }
}

Json rescueJson({bool eligible = true, bool available = true, String? nextAt}) => {
  'amount': 400,
  'threshold': 200,
  'eligible': eligible,
  'available': available,
  'nextAt': nextAt,
};

Future<void> _pump(WidgetTester tester, _Api api, Widget child) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [apiClientProvider.overrideWithValue(api)],
      child: MaterialApp(
        theme: buildTheme(),
        home: Scaffold(body: SingleChildScrollView(child: child)),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  group('formatWhen', () {
    final now = DateTime(2026, 11, 15, 12);
    test('hoy, mañana u otro día', () {
      expect(formatWhen(DateTime(2026, 11, 15, 21, 5), now: now), 'hoy a las 21:05');
      expect(formatWhen(DateTime(2026, 11, 16, 9), now: now), 'mañana a las 09:00');
      expect(formatWhen(DateTime(2026, 11, 18, 9), now: now), 'el 18/11 a las 09:00');
    });
  });

  test('el mensaje de invitación suma el bono de bienvenida y el de invitado', () {
    final message = inviteMessage(ReferralSummary.fromJson(summaryJson()), signupBonus: 1000);
    expect(message, contains('1,500 fichas'));
    expect(message, endsWith('https://poker.test/r/ABC2345'));
  });

  test('limitReached', () {
    expect(ReferralSummary.fromJson(summaryJson()).limitReached, isFalse);
    expect(ReferralSummary.fromJson(summaryJson(rewardedToday: 5)).limitReached, isTrue);
  });

  testWidgets('el aviso de sin fichas no aparece si te alcanza para jugar', (tester) async {
    await _pump(tester, _Api(rescue: rescueJson(eligible: false, available: false)), const OutOfChipsBanner());
    expect(find.byKey(const ValueKey('out-of-chips')), findsNothing);
  });

  testWidgets('reclamar el rescate desde el aviso del lobby', (tester) async {
    final api = _Api(rescue: rescueJson());
    await _pump(tester, api, const OutOfChipsBanner());

    expect(find.byKey(const ValueKey('out-of-chips')), findsOneWidget);
    expect(find.textContaining('Reclama 400 fichas gratis'), findsOneWidget);
    expect(find.text('Invitar amigos'), findsOneWidget);

    await tester.tap(find.text('Reclamar 400'));
    await tester.pumpAndSettle();

    expect(api.claims, 1);
    expect(find.textContaining('400 fichas gratis en tu cuenta'), findsOneWidget);
    // Ya tiene fichas: el aviso se va
    expect(find.byKey(const ValueKey('out-of-chips')), findsNothing);
  });

  testWidgets('rescate ya reclamado: dice cuándo vuelve y no ofrece reclamar', (tester) async {
    final next = DateTime.now().add(const Duration(hours: 3)).toUtc().toIso8601String();
    await _pump(tester, _Api(rescue: rescueJson(available: false, nextAt: next)), const RescuePanel());

    expect(find.text('Rescate diario'), findsOneWidget);
    expect(find.textContaining('Ya lo reclamaste'), findsOneWidget);
    expect(find.text('Reclamar'), findsNothing);
  });

  testWidgets('panel de invitaciones: enlace, cupo del día e invitados', (tester) async {
    final copied = <String>[];
    tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(SystemChannels.platform, (call) async {
      if (call.method == 'Clipboard.setData') copied.add((call.arguments as Map)['text'] as String);
      return null;
    });
    addTearDown(() => tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(SystemChannels.platform, null));

    await _pump(tester, _Api(rescue: rescueJson(eligible: false)), const InviteFriendsPanel());

    expect(find.text('https://poker.test/r/ABC2345'), findsOneWidget);
    expect(find.text('Código: ABC2345'), findsOneWidget);
    expect(find.textContaining('Hoy: 1 de 5 invitaciones cobradas'), findsOneWidget);
    expect(find.text('+500'), findsOneWidget);
    expect(find.text('Sin cobro (tope del día)'), findsOneWidget);
    expect(find.text('No válida'), findsOneWidget);

    await tester.tap(find.text('Copiar invitación'));
    await tester.pump();
    expect(copied.single, contains('1,500 fichas'));
    expect(find.textContaining('Mensaje copiado'), findsOneWidget);
  });

  testWidgets('panel de invitaciones con el tope del día alcanzado', (tester) async {
    final next = DateTime.now().add(const Duration(hours: 2)).toUtc().toIso8601String();
    await _pump(
      tester,
      _Api(
        rescue: rescueJson(eligible: false),
        summary: summaryJson(rewardedToday: 5, nextSlotAt: next),
      ),
      const InviteFriendsPanel(),
    );
    expect(find.textContaining('Hoy ya cobraste 5 de 5'), findsOneWidget);
    expect(find.textContaining('tus amigos sí reciben su bono'), findsOneWidget);
  });
}
