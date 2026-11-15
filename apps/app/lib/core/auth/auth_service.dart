import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_web_auth_2/flutter_web_auth_2.dart';

import '../api/api_exception.dart';
import '../config.dart';
import 'pkce.dart';
import 'token_storage.dart';

/// Abre el navegador en `url` y devuelve la URL de callback completa.
typedef WebAuthenticator = Future<String> Function(String url, String callbackScheme);

Future<String> defaultWebAuthenticator(String url, String callbackScheme) =>
    FlutterWebAuth2.authenticate(url: url, callbackUrlScheme: callbackScheme);

/// Cliente OAuth2 (authorization_code + PKCE) contra el servidor de la API.
///
/// - El login y el registro ocurren en las páginas del servidor (navegador del sistema
///   en móvil, ventana emergente en web).
/// - La renovación es de "un solo vuelo": si varias peticiones necesitan renovar el token
///   a la vez, todas esperan la misma renovación. Es importante porque el servidor rota los
///   refresh tokens y, si detecta uno reutilizado, cierra la sesión por seguridad.
class AuthService {
  AuthService({
    required this.storage,
    Dio? dio,
    WebAuthenticator? authenticator,
    String? apiUrl,
    String? redirectUri,
  })  : _dio = dio ?? Dio(),
        _authenticator = authenticator ?? defaultWebAuthenticator,
        _apiUrl = apiUrl ?? AppConfig.apiUrl,
        _redirectUri = redirectUri ?? AppConfig.redirectUri;

  final TokenStorage storage;
  final Dio _dio;
  final WebAuthenticator _authenticator;
  final String _apiUrl;
  final String _redirectUri;

  AuthTokens? _tokens;
  Future<AuthTokens>? _refreshing;
  String? _issuer;

  final _sessionExpired = StreamController<void>.broadcast();

  /// Emite cuando la sesión ya no se puede renovar (hay que volver a iniciar sesión)
  Stream<void> get onSessionExpired => _sessionExpired.stream;

  bool get isSignedIn => _tokens != null;

  Future<bool> restore() async {
    _tokens = await storage.read();
    return _tokens != null;
  }

  /// Flujo completo: navegador → code → tokens.
  /// [forceLogin] pide credenciales aunque haya sesión en el navegador (para cambiar de cuenta).
  Future<void> login({bool forceLogin = false}) async {
    final pkce = Pkce.generate();
    final state = randomUrlSafe(16);

    final authorizeUrl = Uri.parse('$_apiUrl/oauth/authorize').replace(queryParameters: {
      'response_type': 'code',
      'client_id': AppConfig.clientId,
      'redirect_uri': _redirectUri,
      'scope': AppConfig.scopes,
      'state': state,
      'code_challenge': pkce.challenge,
      'code_challenge_method': 'S256',
      if (forceLogin) 'prompt': 'login',
    });

    final String callback;
    try {
      callback = await _authenticator(authorizeUrl.toString(), AppConfig.callbackScheme);
    } catch (_) {
      throw AuthException('Se canceló el inicio de sesión', code: 'cancelled');
    }

    final params = Uri.parse(callback).queryParameters;
    if (params['error'] != null) {
      throw AuthException(params['error_description'] ?? params['error']!, code: params['error']);
    }
    if (params['state'] != state) {
      throw AuthException('Respuesta de autenticación inválida (state)', code: 'invalid_state');
    }
    // RFC 9207: confirmar que la respuesta viene de nuestro servidor
    final iss = params['iss'];
    if (iss != null && iss != await _getIssuer()) {
      throw AuthException('Respuesta de autenticación inválida (iss)', code: 'invalid_issuer');
    }
    final code = params['code'];
    if (code == null) throw AuthException('No se recibió el código de autorización');

    final tokens = await _tokenRequest({
      'grant_type': 'authorization_code',
      'client_id': AppConfig.clientId,
      'code': code,
      'redirect_uri': _redirectUri,
      'code_verifier': pkce.verifier,
    });
    await _save(tokens);
  }

  /// Access token válido; lo renueva si está por vencer.
  Future<String?> validAccessToken() async {
    final tokens = _tokens;
    if (tokens == null) return null;
    if (!tokens.isExpiringSoon) return tokens.accessToken;
    try {
      return (await refresh()).accessToken;
    } on AuthException {
      return null;
    }
  }

  /// Renueva los tokens. Llamadas simultáneas comparten la misma petición.
  Future<AuthTokens> refresh() {
    return _refreshing ??= _doRefresh().whenComplete(() => _refreshing = null);
  }

  Future<AuthTokens> _doRefresh() async {
    final current = _tokens;
    if (current == null) throw AuthException('No hay sesión', code: 'signed_out');

    try {
      final tokens = await _tokenRequest({
        'grant_type': 'refresh_token',
        'client_id': AppConfig.clientId,
        'refresh_token': current.refreshToken,
      });
      await _save(tokens);
      return tokens;
    } on ApiException catch (error) {
      // invalid_grant: refresh token vencido o revocado → la sesión terminó
      if (error.code == 'invalid_grant' || error.code == 'invalid_client') {
        await _clear();
        _sessionExpired.add(null);
        throw AuthException('Tu sesión expiró. Inicia sesión de nuevo.', code: 'session_expired');
      }
      rethrow;
    }
  }

  /// Cierra la sesión en este dispositivo revocando el refresh token (RFC 7009)
  Future<void> logout() async {
    final tokens = _tokens;
    await _clear();
    if (tokens == null) return;
    try {
      await _dio.post<void>(
        '$_apiUrl/oauth/revoke',
        data: {'client_id': AppConfig.clientId, 'token': tokens.refreshToken},
        options: Options(contentType: Headers.formUrlEncodedContentType),
      );
    } catch (_) {
      // Si falla la red, el token igual vence; localmente ya no existe
    }
  }

  Future<AuthTokens> _tokenRequest(Map<String, String> body) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '$_apiUrl/oauth/token',
        data: body,
        options: Options(contentType: Headers.formUrlEncodedContentType),
      );
      return AuthTokens.fromTokenResponse(response.data!);
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<String> _getIssuer() async {
    if (_issuer != null) return _issuer!;
    final response =
        await _dio.get<Map<String, dynamic>>('$_apiUrl/.well-known/oauth-authorization-server');
    return _issuer = response.data!['issuer'] as String;
  }

  Future<void> _save(AuthTokens tokens) async {
    _tokens = tokens;
    await storage.write(tokens);
  }

  Future<void> _clear() async {
    _tokens = null;
    await storage.clear();
  }

  void dispose() => _sessionExpired.close();
}
