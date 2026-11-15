import 'package:dio/dio.dart';

/// Error de la API con el formato del servidor:
///   { "error": "room_full", "message": "La sala está llena" }
///   { "error": "invalid_grant", "error_description": "..." }  (OAuth)
///   { "errors": [{ "message": "...", "field": "..." }] }       (validación)
class ApiException implements Exception {
  ApiException(this.message, {this.code, this.statusCode, this.field});

  final String message;
  final String? code;
  final int? statusCode;

  /// Campo con el error de validación (p. ej. "username")
  final String? field;

  factory ApiException.fromDio(DioException error) {
    final response = error.response;
    final data = response?.data;

    if (data is Map) {
      final errors = data['errors'];
      if (errors is List && errors.isNotEmpty && errors.first is Map) {
        final first = errors.first as Map;
        return ApiException(
          first['message']?.toString() ?? 'Datos inválidos',
          code: 'validation_error',
          statusCode: response?.statusCode,
          field: first['field']?.toString(),
        );
      }
      final message = data['message'] ?? data['error_description'];
      if (message != null || data['error'] != null) {
        return ApiException(
          (message ?? data['error']).toString(),
          code: data['error']?.toString(),
          statusCode: response?.statusCode,
        );
      }
    }

    return switch (error.type) {
      DioExceptionType.connectionError ||
      DioExceptionType.connectionTimeout =>
        ApiException('No se pudo conectar con el servidor', code: 'network_error'),
      DioExceptionType.receiveTimeout => ApiException('El servidor tardó demasiado', code: 'timeout'),
      _ => ApiException('Error inesperado (${response?.statusCode ?? 'sin respuesta'})',
          statusCode: response?.statusCode),
    };
  }

  @override
  String toString() => message;
}

class AuthException implements Exception {
  AuthException(this.message, {this.code});
  final String message;
  final String? code;

  @override
  String toString() => message;
}
