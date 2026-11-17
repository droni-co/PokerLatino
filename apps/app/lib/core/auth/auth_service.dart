import 'dart:async';

import 'package:dio/dio.dart';

import '../api/api_exception.dart';
import '../config.dart';
import '../models/models.dart';
import 'token_storage.dart';

/// Sesión del jugador: email + contraseña → access token.
///
/// - El servidor solo admite una sesión por jugador: al iniciar sesión en otro dispositivo
///   este token deja de valer y la API responde 401. Entonces [expire] borra el token y
///   avisa por [onSessionExpired] para volver a la pantalla de inicio de sesión.
/// - El token dura 30 días; no hay renovación.
class AuthService {
  AuthService({required this.storage, Dio? dio, String? apiUrl})
    : _dio = dio ?? Dio(),
      _apiUrl = apiUrl ?? AppConfig.apiUrl;

  final TokenStorage storage;
  final Dio _dio;
  final String _apiUrl;

  String? _token;

  final _sessionExpired = StreamController<void>.broadcast();

  /// Emite cuando el servidor rechaza el token (otra sesión lo reemplazó o venció)
  Stream<void> get onSessionExpired => _sessionExpired.stream;

  bool get isSignedIn => _token != null;

  String? get token => _token;

  Future<bool> restore() async {
    _token = await storage.read();
    return _token != null;
  }

  /// Inicia sesión (cierra la sesión que hubiera en otro dispositivo)
  Future<Me> login({required String email, required String password}) =>
      _authenticate('/auth/login', {'email': email, 'password': password});

  /// Crea la cuenta y deja la sesión iniciada
  Future<Me> register({
    required String username,
    required String email,
    required String password,
    required String passwordConfirmation,
    required DateTime birthDate,
    String? referralCode,
  }) => _authenticate('/auth/register', {
    'username': username,
    'email': email,
    'password': password,
    'password_confirmation': passwordConfirmation,
    'birth_date': _isoDate(birthDate),
    if (referralCode != null && referralCode.trim().isNotEmpty) 'referral_code': referralCode.trim(),
  });

  /// Cierra la sesión en este dispositivo
  Future<void> logout() async {
    final token = _token;
    await _clear();
    if (token == null) return;
    try {
      await _dio.delete<void>(
        '$_apiUrl/api/v1/auth/logout',
        options: Options(headers: {'Authorization': 'Bearer $token'}),
      );
    } catch (_) {
      // Sin red: localmente ya no existe y el token vence solo
    }
  }

  /// El servidor rechazó el token: la sesión terminó
  Future<void> expire() async {
    if (_token == null) return;
    await _clear();
    _sessionExpired.add(null);
  }

  Future<Me> _authenticate(String path, Map<String, Object> body) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>('$_apiUrl/api/v1$path', data: body);
      final data = response.data!['data'] as Map<String, dynamic>;
      _token = data['token'] as String;
      await storage.write(_token!);
      return Me.fromJson(data['user'] as Map<String, dynamic>);
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  Future<void> _clear() async {
    _token = null;
    await storage.clear();
  }

  static String _isoDate(DateTime d) =>
      '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

  void dispose() => _sessionExpired.close();
}
