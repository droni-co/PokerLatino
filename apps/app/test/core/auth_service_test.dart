import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:poker_latino/core/api/api_exception.dart';
import 'package:poker_latino/core/auth/auth_service.dart';
import 'package:poker_latino/core/auth/pkce.dart';
import 'package:poker_latino/core/auth/token_storage.dart';

const api = 'http://api.test';
const redirect = 'co.droni.pokerlatino:/oauth/callback';

/// Servidor OAuth simulado: responde según la ruta y registra las peticiones
class FakeServer implements HttpClientAdapter {
  final requests = <({String path, Map<String, String> form})>[];
  int tokenCounter = 0;
  bool rejectRefresh = false;
  Duration delay = Duration.zero;

  @override
  Future<ResponseBody> fetch(RequestOptions options, Stream<Uint8List>? body, Future<void>? cancel) async {
    final raw = body == null ? '' : utf8.decode(await body.expand((b) => b).toList());
    final form = raw.isEmpty ? <String, String>{} : Uri.splitQueryString(raw);
    requests.add((path: options.uri.path, form: form));
    await Future<void>.delayed(delay);

    switch (options.uri.path) {
      case '/.well-known/oauth-authorization-server':
        return _json(200, {'issuer': api});
      case '/oauth/token':
        if (form['grant_type'] == 'refresh_token' && rejectRefresh) {
          return _json(400, {'error': 'invalid_grant', 'error_description': 'Refresh token inválido'});
        }
        tokenCounter++;
        return _json(200, {
          'access_token': 'pl_at_$tokenCounter',
          'refresh_token': 'pl_rt_$tokenCounter',
          'token_type': 'Bearer',
          'expires_in': 900,
        });
      case '/oauth/revoke':
        return _json(200, {});
    }
    return _json(404, {'error': 'not_found'});
  }

  ResponseBody _json(int status, Object data) => ResponseBody.fromString(
        jsonEncode(data),
        status,
        headers: {Headers.contentTypeHeader: [Headers.jsonContentType]},
      );

  @override
  void close({bool force = false}) {}
}

/// Simula el navegador: el "usuario" inicia sesión y el servidor redirige con el code
WebAuthenticator browser({String? state, String? iss = api, String? error}) => (url, scheme) async {
      expect(scheme, 'co.droni.pokerlatino');
      final params = Uri.parse(url).queryParameters;
      final query = {
        if (error != null) 'error': error else 'code': 'pl_cs_test',
        'state': state ?? params['state']!,
        'iss': ?iss,
      };
      return Uri.parse(redirect).replace(queryParameters: query).toString();
    };

void main() {
  late FakeServer server;
  late MemoryTokenStorage storage;

  AuthService service({WebAuthenticator? authenticator}) => AuthService(
        storage: storage,
        dio: Dio()..httpClientAdapter = server,
        authenticator: authenticator ?? browser(),
        apiUrl: api,
        redirectUri: redirect,
      );

  setUp(() {
    server = FakeServer();
    storage = MemoryTokenStorage();
  });

  test('login completo con PKCE guarda los tokens', () async {
    String? authorizeUrl;
    final auth = service(authenticator: (url, scheme) {
      authorizeUrl = url;
      return browser()(url, scheme);
    });

    await auth.login();
    expect(auth.isSignedIn, isTrue);
    expect((await storage.read())!.accessToken, 'pl_at_1');

    final params = Uri.parse(authorizeUrl!).queryParameters;
    expect(params['response_type'], 'code');
    expect(params['code_challenge_method'], 'S256');
    expect(params['redirect_uri'], redirect);
    expect(params.containsKey('prompt'), isFalse);

    // El verifier enviado al canjear el code corresponde al challenge del authorize
    final exchange = server.requests.singleWhere((r) => r.path == '/oauth/token').form;
    expect(exchange['grant_type'], 'authorization_code');
    expect(exchange['code'], 'pl_cs_test');
    expect(Pkce.challengeFor(exchange['code_verifier']!), params['code_challenge']);
  });

  test('forceLogin pide credenciales de nuevo (prompt=login)', () async {
    String? url;
    await service(authenticator: (u, s) {
      url = u;
      return browser()(u, s);
    }).login(forceLogin: true);
    expect(Uri.parse(url!).queryParameters['prompt'], 'login');
  });

  test('rechaza un state distinto (CSRF)', () async {
    final auth = service(authenticator: browser(state: 'otro'));
    await expectLater(auth.login(), throwsA(isA<AuthException>().having((e) => e.code, 'code', 'invalid_state')));
    expect(server.requests.where((r) => r.path == '/oauth/token'), isEmpty);
    expect(await storage.read(), isNull);
  });

  test('rechaza un iss de otro servidor (RFC 9207)', () async {
    final auth = service(authenticator: browser(iss: 'http://malicioso.test'));
    await expectLater(auth.login(), throwsA(isA<AuthException>().having((e) => e.code, 'code', 'invalid_issuer')));
    expect(await storage.read(), isNull);
  });

  test('propaga el error del servidor y la cancelación del usuario', () async {
    await expectLater(
      service(authenticator: browser(error: 'access_denied')).login(),
      throwsA(isA<AuthException>().having((e) => e.code, 'code', 'access_denied')),
    );
    await expectLater(
      service(authenticator: (_, _) async => throw Exception('closed')).login(),
      throwsA(isA<AuthException>().having((e) => e.code, 'code', 'cancelled')),
    );
  });

  test('renovaciones simultáneas comparten una sola petición (rotación segura)', () async {
    final auth = service();
    await auth.login();
    server.delay = const Duration(milliseconds: 20);

    final results = await Future.wait([auth.refresh(), auth.refresh(), auth.refresh()]);
    expect(results.map((t) => t.accessToken).toSet(), {'pl_at_2'});
    final refreshes = server.requests.where((r) => r.form['grant_type'] == 'refresh_token').toList();
    expect(refreshes, hasLength(1));
    expect(refreshes.single.form['refresh_token'], 'pl_rt_1');

    // La siguiente renovación usa el refresh token rotado
    await auth.refresh();
    expect(server.requests.last.form['refresh_token'], 'pl_rt_2');
  });

  test('refresh rechazado (invalid_grant) cierra la sesión y lo avisa', () async {
    final auth = service();
    await auth.login();
    server.rejectRefresh = true;

    final expired = auth.onSessionExpired.first;
    await expectLater(auth.refresh(), throwsA(isA<AuthException>().having((e) => e.code, 'code', 'session_expired')));
    await expired.timeout(const Duration(seconds: 1));
    expect(auth.isSignedIn, isFalse);
    expect(await storage.read(), isNull);
  });

  test('logout revoca el refresh token y borra la sesión local', () async {
    final auth = service();
    await auth.login();
    await auth.logout();
    expect(auth.isSignedIn, isFalse);
    expect(await storage.read(), isNull);
    final revoke = server.requests.singleWhere((r) => r.path == '/oauth/revoke');
    expect(revoke.form['token'], 'pl_rt_1');
  });

  test('restaura la sesión guardada', () async {
    await service().login();
    final restored = service();
    expect(await restored.restore(), isTrue);
    expect(await restored.validAccessToken(), 'pl_at_1');
  });
}
