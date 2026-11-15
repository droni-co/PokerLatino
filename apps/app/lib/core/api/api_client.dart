import 'package:dio/dio.dart';

import '../auth/auth_service.dart';
import '../config.dart';
import '../models/models.dart';
import '../models/table_state.dart';
import 'api_exception.dart';

/// Cliente de la API del juego. Agrega el token en cada petición y,
/// si el servidor responde 401, renueva el token y reintenta una vez.
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
        onRequest: (options, handler) async {
          final token = await _auth.validAccessToken();
          if (token != null) options.headers['Authorization'] = 'Bearer $token';
          handler.next(options);
        },
        onError: (error, handler) async {
          final retried = error.requestOptions.extra['retried'] == true;
          if (error.response?.statusCode != 401 || retried || !_auth.isSignedIn) {
            return handler.next(error);
          }
          try {
            final tokens = await _auth.refresh();
            final options = error.requestOptions
              ..extra['retried'] = true
              ..headers['Authorization'] = 'Bearer ${tokens.accessToken}';
            handler.resolve(await _dio.fetch<dynamic>(options));
          } catch (_) {
            handler.next(error);
          }
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

  Future<PlayerStat> stats() => _get('/me/stats', (d) => PlayerStat.fromJson(d as Json));
}

class LeaveResult {
  const LeaveResult({required this.cashedOut, required this.pending});
  final int cashedOut;
  final bool pending;
}
