import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:poker_latino/core/api/api_client.dart';
import 'package:poker_latino/core/api/api_exception.dart';
import 'package:poker_latino/core/auth/auth_service.dart';
import 'package:poker_latino/core/auth/token_storage.dart';

const api = 'http://api.test';

/// Servidor simulado: un solo token válido por cuenta (el último que emitió)
class FakeServer implements HttpClientAdapter {
  final requests = <({String method, String path, Map<String, dynamic> body, String? auth})>[];
  String? validToken;
  int counter = 0;

  @override
  Future<ResponseBody> fetch(RequestOptions options, Stream<Uint8List>? body, Future<void>? cancel) async {
    final raw = body == null ? '' : utf8.decode(await body.expand((b) => b).toList());
    final json = raw.isEmpty ? <String, dynamic>{} : jsonDecode(raw) as Map<String, dynamic>;
    final auth = options.headers['Authorization'] as String?;
    requests.add((method: options.method, path: options.uri.path, body: json, auth: auth));

    final user = {'id': 1, 'email': 'ana@test.com', 'username': 'ana', 'displayName': 'ana', 'avatar': null};
    switch (options.uri.path) {
      case '/api/v1/auth/login':
        if (json['password'] != 'secreto123') {
          return _json(401, {'error': 'invalid_credentials', 'message': 'Email o contraseña incorrectos'});
        }
        validToken = 'pl_${++counter}';
        return _json(200, {
          'data': {'token': validToken, 'user': user},
        });
      case '/api/v1/auth/register':
        if (json['username'] == 'ocupado') {
          return _json(422, {
            'errors': [
              {'field': 'username', 'message': 'Ese nombre de usuario ya está en uso'},
            ],
          });
        }
        validToken = 'pl_${++counter}';
        return _json(201, {
          'data': {'token': validToken, 'user': user},
        });
      case '/api/v1/auth/logout':
        validToken = null;
        return ResponseBody.fromString('', 204);
      case '/api/v1/me':
        if (auth != 'Bearer $validToken') {
          return _json(401, {'error': 'unauthorized', 'message': 'Tu sesión terminó'});
        }
        return _json(200, {'data': user});
    }
    return _json(404, {'error': 'not_found'});
  }

  ResponseBody _json(int status, Object data) => ResponseBody.fromString(
    jsonEncode(data),
    status,
    headers: {
      Headers.contentTypeHeader: [Headers.jsonContentType],
    },
  );

  @override
  void close({bool force = false}) {}
}

void main() {
  late FakeServer server;
  late MemoryTokenStorage storage;

  AuthService service() => AuthService(storage: storage, dio: Dio()..httpClientAdapter = server, apiUrl: api);
  ApiClient client(AuthService auth) =>
      ApiClient(auth, dio: Dio(BaseOptions(baseUrl: '$api/api/v1'))..httpClientAdapter = server);

  setUp(() {
    server = FakeServer();
    storage = MemoryTokenStorage();
  });

  test('login guarda el token y lo envía en cada petición', () async {
    final auth = service();
    final me = await auth.login(email: 'ana@test.com', password: 'secreto123');
    expect(me.username, 'ana');
    expect(auth.isSignedIn, isTrue);
    expect(storage.token, 'pl_1');

    await client(auth).me();
    expect(server.requests.last.auth, 'Bearer pl_1');
  });

  test('credenciales incorrectas: ApiException con el mensaje del servidor', () async {
    final auth = service();
    await expectLater(
      auth.login(email: 'ana@test.com', password: 'mala'),
      throwsA(isA<ApiException>().having((e) => e.code, 'code', 'invalid_credentials')),
    );
    expect(auth.isSignedIn, isFalse);
  });

  test('registro envía la fecha en ISO y el código de invitación', () async {
    final auth = service();
    await auth.register(
      username: 'ana',
      email: 'ana@test.com',
      password: 'secreto123',
      passwordConfirmation: 'secreto123',
      birthDate: DateTime(1990, 5, 2),
      referralCode: ' ABC123 ',
    );
    final body = server.requests.last.body;
    expect(body['birth_date'], '1990-05-02');
    expect(body['referral_code'], 'ABC123');
    expect(body['password_confirmation'], 'secreto123');
    expect(storage.token, 'pl_1');
  });

  test('errores de validación del registro indican el campo', () async {
    await expectLater(
      service().register(
        username: 'ocupado',
        email: 'x@test.com',
        password: 'secreto123',
        passwordConfirmation: 'secreto123',
        birthDate: DateTime(1990),
      ),
      throwsA(isA<ApiException>().having((e) => e.field, 'field', 'username')),
    );
  });

  test('restore recupera la sesión guardada', () async {
    storage.token = 'pl_guardado';
    final auth = service();
    expect(await auth.restore(), isTrue);
    expect(auth.token, 'pl_guardado');
  });

  test('si otro dispositivo inicia sesión, el 401 cierra la sesión local y avisa', () async {
    final phone = service();
    await phone.login(email: 'ana@test.com', password: 'secreto123');

    // Otro dispositivo entra con la misma cuenta: el token del teléfono deja de valer
    await AuthService(
      storage: MemoryTokenStorage(),
      dio: Dio()..httpClientAdapter = server,
      apiUrl: api,
    ).login(email: 'ana@test.com', password: 'secreto123');

    var expired = 0;
    phone.onSessionExpired.listen((_) => expired++);
    await expectLater(client(phone).me(), throwsA(isA<ApiException>()));
    await Future<void>.delayed(Duration.zero);
    expect(expired, 1);
    expect(phone.isSignedIn, isFalse);
    expect(storage.token, isNull);
  });

  test('logout borra el token local y avisa al servidor', () async {
    final auth = service();
    await auth.login(email: 'ana@test.com', password: 'secreto123');
    await auth.logout();
    expect(auth.isSignedIn, isFalse);
    expect(storage.token, isNull);
    final last = server.requests.last;
    expect((last.method, last.path, last.auth), ('DELETE', '/api/v1/auth/logout', 'Bearer pl_1'));
  });
}
