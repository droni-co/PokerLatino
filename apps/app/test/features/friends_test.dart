import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:poker_latino/core/api/api_client.dart';
import 'package:poker_latino/core/auth/auth_service.dart';
import 'package:poker_latino/core/auth/token_storage.dart';
import 'package:poker_latino/core/models/models.dart';
import 'package:poker_latino/core/models/social.dart';
import 'package:poker_latino/core/providers.dart';
import 'package:poker_latino/core/theme.dart';
import 'package:poker_latino/features/friends/friend_widgets.dart';
import 'package:poker_latino/features/friends/friends_page.dart';

Json player(int id, String name) => {'id': id, 'displayName': name, 'avatar': null};

Json friendsJson() => {
  'friends': [
    {
      'player': player(2, 'Lupita'),
      'online': true,
      'table': {'roomId': 30, 'name': 'Principiantes · Mesa 1', 'smallBlind': 5, 'bigBlind': 10, 'freeSeats': 2},
      'inTournament': false,
      'invitedHere': false,
    },
    {'player': player(3, 'Toño'), 'online': false, 'table': null, 'inTournament': false, 'invitedHere': true},
  ],
  'incoming': [
    {'id': 70, 'player': player(4, 'Chepe'), 'createdAt': '2026-11-15T10:00:00.000Z'},
  ],
  'outgoing': [
    {'id': 71, 'player': player(5, 'Mari'), 'createdAt': '2026-11-15T10:00:00.000Z'},
  ],
};

class _Api extends ApiClient {
  _Api() : super(AuthService(storage: MemoryTokenStorage()));

  final calls = <String>[];

  @override
  Future<Inbox> inbox() async => const Inbox();

  @override
  Future<FriendsList> friends({int? roomId}) async => FriendsList.fromJson(friendsJson());

  @override
  Future<List<PlayerSearchResult>> searchPlayers(String text) async {
    calls.add('search:$text');
    return [PlayerSearchResult(player: PlayerRef.fromJson(player(9, 'Lucho')), relation: Relation.none)];
  }

  @override
  Future<Relation> sendFriendRequest(int playerId) async {
    calls.add('request:$playerId');
    return Relation.outgoing;
  }

  @override
  Future<void> acceptFriendRequest(int requestId) async => calls.add('accept:$requestId');

  @override
  Future<void> dismissFriendRequest(int requestId) async => calls.add('dismiss:$requestId');

  @override
  Future<void> inviteToTable(int roomId, int playerId) async => calls.add('invite:$roomId:$playerId');
}

Future<void> _pump(WidgetTester tester, _Api api, Widget child) async {
  tester.view.physicalSize = const Size(900, 1400);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(
    ProviderScope(
      overrides: [apiClientProvider.overrideWithValue(api)],
      child: MaterialApp(
        theme: buildTheme(),
        home: Scaffold(body: child),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  test('modelos: relación según la lista e invitación a la mesa', () {
    final list = FriendsList.fromJson(friendsJson());
    expect(list.relationWith(2), Relation.friend);
    expect(list.relationWith(4), Relation.incoming);
    expect(list.relationWith(5), Relation.outgoing);
    expect(list.relationWith(99), Relation.none);
    expect(friendStatus(list.friends[0]), 'En Principiantes · Mesa 1 (5/10)');
    expect(friendStatus(list.friends[1]), 'Desconectado');

    final inbox = Inbox.fromJson({
      'friendRequests': 2,
      'invitations': [
        {
          'id': 5,
          'from': player(2, 'Lupita'),
          'room': {'id': 30, 'name': 'Mesa 1', 'smallBlind': 5, 'bigBlind': 10, 'minBuyIn': 200, 'freeSeats': 2},
          'createdAt': '2026-11-15T10:00:00.000Z',
          'expiresAt': '2026-11-15T10:05:00.000Z',
        },
      ],
    });
    expect(inbox.friendRequests, 2);
    expect(inbox.invitations.single.roomId, 30);
    expect(inbox.invitations.single.from.displayName, 'Lupita');
  });

  testWidgets('página de amigos: solicitudes, amigos con su mesa y enviadas', (tester) async {
    final api = _Api();
    await _pump(tester, api, const FriendsPage());

    expect(find.text('Solicitudes recibidas (1)'), findsOneWidget);
    expect(find.text('Chepe'), findsOneWidget);
    expect(find.text('Tus amigos (2) · 1 conectados'), findsOneWidget);
    expect(find.byKey(const ValueKey('online-2')), findsOneWidget);
    expect(find.byKey(const ValueKey('offline-3')), findsOneWidget);
    expect(find.text('Ir a su mesa'), findsOneWidget);
    expect(find.text('Solicitudes enviadas (1)'), findsOneWidget);

    await tester.tap(find.text('Aceptar'));
    await tester.pumpAndSettle();
    expect(api.calls, contains('accept:70'));
    expect(find.textContaining('Chepe y tú ya son amigos'), findsOneWidget);

    await tester.tap(find.text('Cancelar'));
    await tester.pumpAndSettle();
    expect(api.calls, contains('dismiss:71'));
  });

  testWidgets('buscar un jugador y enviarle solicitud', (tester) async {
    final api = _Api();
    await _pump(tester, api, const FriendsPage());

    await tester.enterText(find.byKey(const ValueKey('friend-search')), 'luc');
    await tester.pump(const Duration(milliseconds: 400));
    await tester.pumpAndSettle();
    expect(api.calls, contains('search:luc'));
    expect(find.text('Lucho'), findsOneWidget);

    await tester.tap(find.text('Agregar'));
    await tester.pumpAndSettle();
    expect(api.calls, contains('request:9'));
    expect(find.text('Solicitud enviada a Lucho'), findsOneWidget);
  });

  testWidgets('invitar amigos desde la mesa', (tester) async {
    final api = _Api();
    await _pump(tester, api, const InviteFriendsSheet(roomId: 30, freeSeats: 2));

    expect(find.text('Quedan 2 asientos libres.'), findsOneWidget);
    // Lupita ya está en esta mesa; a Toño ya lo invitaste
    expect(find.text('En esta mesa'), findsOneWidget);
    expect(find.text('Invitado'), findsOneWidget);
    expect(find.text('Invitar'), findsNothing);
  });

  testWidgets('invitar a un amigo que está en otra mesa', (tester) async {
    final api = _Api();
    await _pump(tester, api, const InviteFriendsSheet(roomId: 99, freeSeats: 1));

    expect(find.text('Queda 1 asiento libre.'), findsOneWidget);
    await tester.tap(find.text('Invitar'));
    await tester.pumpAndSettle();
    expect(api.calls, contains('invite:99:2'));
    expect(find.text('Invitación enviada a Lupita'), findsOneWidget);
    expect(find.text('Invitado'), findsNWidgets(2));
  });

  testWidgets('aviso de invitación: jugar o ahora no', (tester) async {
    var accepted = 0;
    var declined = 0;
    final invitation = TableInvitation(
      id: 5,
      from: PlayerRef.fromJson(player(2, 'Lupita')),
      roomId: 30,
      roomName: 'Mesa 1',
      smallBlind: 5,
      bigBlind: 10,
      minBuyIn: 200,
      freeSeats: 2,
    );
    await _pump(
      tester,
      _Api(),
      Center(
        child: InvitationCard(invitation: invitation, onAccept: () => accepted++, onDecline: () => declined++),
      ),
    );
    expect(find.textContaining('te invita a su mesa', findRichText: true), findsOneWidget);
    await tester.tap(find.text('Jugar'));
    await tester.tap(find.text('Ahora no'));
    expect((accepted, declined), (1, 1));
  });
}
