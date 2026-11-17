import 'package:dio/dio.dart';

import '../auth/auth_service.dart';
import '../config.dart';
import '../models/models.dart';
import '../models/table_state.dart';
import '../models/progress.dart';
import '../models/referral.dart';
import '../models/social.dart';
import '../models/tournament.dart';
import 'api_exception.dart';

/// Cliente de la API del juego. Agrega el token en cada petición. Si el servidor responde
/// 401 (la sesión se abrió en otro dispositivo o venció), cierra la sesión local.
class ApiClient {
  ApiClient(this._auth, {Dio? dio, String? baseUrl})
    : _dio =
          dio ??
          Dio(
            BaseOptions(
              baseUrl: '${baseUrl ?? AppConfig.apiUrl}/api/v1',
              connectTimeout: const Duration(seconds: 10),
              receiveTimeout: const Duration(seconds: 15),
            ),
          ) {
    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          final token = _auth.token;
          if (token != null) options.headers['Authorization'] = 'Bearer $token';
          handler.next(options);
        },
        onError: (error, handler) async {
          // Solo si el token rechazado es el actual (no una respuesta tardía de una sesión vieja)
          final sent = error.requestOptions.headers['Authorization'];
          if (error.response?.statusCode == 401 && _auth.token != null && sent == 'Bearer ${_auth.token}') {
            await _auth.expire();
          }
          handler.next(error);
        },
      ),
    );
  }

  final AuthService _auth;
  final Dio _dio;

  Future<T> _get<T>(String path, T Function(dynamic data) parse, {Map<String, dynamic>? query}) async {
    try {
      final response = await _dio.get<Json>(path, queryParameters: query);
      return parse(response.data!['data']);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<T> _send<T>(String method, String path, T Function(dynamic data) parse, {Object? body}) async {
    try {
      final response = await _dio.request<Json>(
        path,
        data: body,
        options: Options(method: method),
      );
      return parse(response.data!['data']);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  /// Petición sin datos de respuesta (p. ej. 204 No Content)
  Future<void> _sendEmpty(String method, String path, {Object? body}) async {
    try {
      await _dio.request<Object?>(
        path,
        data: body,
        options: Options(method: method),
      );
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<Me> me() => _get('/me', (d) => Me.fromJson(d as Json));

  /// Cambia el nombre de usuario y/o el avatar. [avatar] vacío (`''`) vuelve al
  /// avatar genérico al azar; null deja el actual.
  Future<Me> updateProfile({String? username, String? avatar}) => _send(
    'PATCH',
    '/me',
    (d) => Me.fromJson(d as Json),
    body: {'username': ?username, if (avatar != null) 'avatar': avatar.isEmpty ? null : avatar},
  );

  Future<GameConfig> config() => _get('/game/config', (d) => GameConfig.fromJson(d as Json));

  Future<Wallet> wallet() => _get('/wallet', (d) => Wallet.fromJson(d as Json));

  Future<Paginated<WalletTransaction>> transactions({int page = 1}) async {
    try {
      final response = await _dio.get<Json>('/wallet/transactions', queryParameters: {'page': page, 'perPage': 20});
      final body = response.data!;
      final meta = body['metadata'] as Json;
      return Paginated(
        items: (body['data'] as List).map((t) => WalletTransaction.fromJson(t as Json)).toList(),
        currentPage: (meta['currentPage'] as num).toInt(),
        lastPage: (meta['lastPage'] as num).toInt(),
      );
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  Future<List<RoomLevel>> levels() =>
      _get('/levels', (d) => (d as List).map((l) => RoomLevel.fromJson(l as Json)).toList());

  /// "Jugar" en un nivel: el servidor elige la mesa (y abre otra si hace falta)
  Future<QuickSeat> quickSeat(int levelId, {required int buyIn}) =>
      _send('POST', '/levels/$levelId/seat', (d) => QuickSeat.fromJson(d as Json), body: {'buyIn': buyIn});

  Future<Room> room(int id) => _get('/rooms/$id', (d) => Room.fromJson(d as Json));

  Future<void> sit(int roomId, {required int buyIn, int? seatNumber}) =>
      _send('POST', '/rooms/$roomId/seat', (_) {}, body: {'buyIn': buyIn, 'seatNumber': ?seatNumber});

  /// Devuelve las fichas que volvieron a tu cuenta
  /// Si hay una mano en curso el servidor retira al jugador de ella y lo levanta al
  /// terminarla (`pending`); si no, lo levanta de inmediato y devuelve las fichas.
  Future<LeaveResult> leave(int roomId) => _send('DELETE', '/rooms/$roomId/seat', (d) {
    final json = d as Json;
    return LeaveResult(cashedOut: (json['cashedOut'] as num? ?? 0).toInt(), pending: json['pending'] as bool? ?? false);
  });

  /// Tu enlace de invitación, las reglas y a quiénes invitaste
  Future<ReferralSummary> referrals() => _get('/referrals', (d) => ReferralSummary.fromJson(d as Json));

  /// Si puedes reclamar el rescate diario
  Future<RescueStatus> rescueStatus() => _get('/wallet/rescue', (d) => RescueStatus.fromJson(d as Json));

  /// Reclamar el rescate diario (409 si no toca)
  Future<RescueStatus> claimRescue() => _send('POST', '/wallet/rescue', (d) => RescueStatus.fromJson(d as Json));

  /// Torneos abiertos, en juego y terminados recientemente
  Future<List<Tournament>> tournaments() =>
      _get('/tournaments', (d) => [for (final t in d as List) Tournament.fromJson(t as Json)]);

  Future<TournamentDetail> tournament(int id) => _get('/tournaments/$id', (d) => TournamentDetail.fromJson(d as Json));

  /// Inscribirse: se cobra la inscripción en fichas
  Future<Tournament> registerTournament(int id) =>
      _send('POST', '/tournaments/$id/entry', (d) => Tournament.fromJson(d as Json));

  /// Salirse antes de que empiece: se devuelve la inscripción
  Future<Tournament> unregisterTournament(int id) =>
      _send('DELETE', '/tournaments/$id/entry', (d) => Tournament.fromJson(d as Json));

  /// [chatAfter]: id del último mensaje de chat que ya se tiene (solo llegan los nuevos)
  Future<TableState> tableState(int roomId, {int? chatAfter}) =>
      _get('/rooms/$roomId/state', (d) => TableState.fromJson(d as Json), query: {'chatAfter': ?chatAfter});

  /// `amount` en bet/raise es el TOTAL a apostar en la calle ("subir a")
  Future<TableState> act(int roomId, String action, {int? amount, int? chatAfter}) => _send(
    'POST',
    '/rooms/$roomId/actions',
    (d) => TableState.fromJson(d as Json),
    body: {'action': action, 'amount': ?amount, 'chatAfter': ?chatAfter},
  );

  /// Enseñar mis cartas al terminar la mano (cuando no era obligatorio)
  Future<TableState> showCards(int roomId, {int? chatAfter}) =>
      _send('POST', '/rooms/$roomId/show', (d) => TableState.fromJson(d as Json), body: {'chatAfter': ?chatAfter});

  Future<ChatMessage> sendChat(int roomId, String body) =>
      _send('POST', '/rooms/$roomId/chat', (d) => ChatMessage.fromJson(d as Json), body: {'body': body});

  /*
  | Amigos e invitaciones a la mesa
  */

  /// Solicitudes sin responder e invitaciones a mesas (se consulta cada pocos segundos)
  Future<Inbox> inbox() => _get('/inbox', (d) => Inbox.fromJson(d as Json));

  /// Tus amigos y solicitudes. Con [roomId] marca a quién ya invitaste a esa mesa.
  Future<FriendsList> friends({int? roomId}) =>
      _get('/friends', (d) => FriendsList.fromJson(d as Json), query: {'roomId': ?roomId});

  Future<List<PlayerSearchResult>> searchPlayers(String text) =>
      _get('/players', (d) => [for (final p in d as List) PlayerSearchResult.fromJson(p as Json)], query: {'q': text});

  /// Devuelve la relación resultante (`outgoing`, o `friend` si él ya te la había enviado)
  Future<Relation> sendFriendRequest(int playerId) =>
      _send('POST', '/friends/requests', (d) => Relation.parse((d as Json)['relation']), body: {'playerId': playerId});

  Future<void> acceptFriendRequest(int requestId) => _sendEmpty('POST', '/friends/requests/$requestId/accept');

  /// Rechazar una solicitud recibida o cancelar una enviada
  Future<void> dismissFriendRequest(int requestId) => _sendEmpty('DELETE', '/friends/requests/$requestId');

  Future<void> removeFriend(int playerId) => _sendEmpty('DELETE', '/friends/$playerId');

  Future<void> inviteToTable(int roomId, int playerId) =>
      _sendEmpty('POST', '/rooms/$roomId/invitations', body: {'playerId': playerId});

  /// Devuelve la mesa a la que ir
  Future<int> acceptInvitation(int id) =>
      _send('POST', '/invitations/$id/accept', (d) => ((d as Json)['roomId'] as num).toInt());

  Future<void> declineInvitation(int id) => _sendEmpty('DELETE', '/invitations/$id');

  /// Tu nivel, XP y todos los logros con tu avance
  Future<PlayerProgress> myProgress() => _get('/me/progress', (d) => PlayerProgress.fromJson(d as Json));

  /// La app ya anunció los logros nuevos y el nivel
  Future<void> markProgressSeen() => _sendEmpty('POST', '/me/progress/seen');

  /// Tarjeta pública de un jugador: nivel, estadísticas, logros y tu relación con él
  Future<PlayerCard> playerCard(int playerId) => _get('/players/$playerId', (d) => PlayerCard.fromJson(d as Json));

  Future<PlayerStat> stats() => _get('/me/stats', (d) => PlayerStat.fromJson(d as Json));
}

class LeaveResult {
  const LeaveResult({required this.cashedOut, required this.pending});
  final int cashedOut;
  final bool pending;
}
