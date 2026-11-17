import 'package:flutter/foundation.dart';

/// Configuración de la app.
///
/// La URL de la API se puede sobrescribir con:
///   flutter run --dart-define=API_URL=https://pokerlatino.com
class AppConfig {
  static const _apiUrlOverride = String.fromEnvironment('API_URL');

  /// En web, la app la sirve el propio servidor de la API: mismo origen.
  /// En desarrollo (`pnpm app:web`, puerto 8080) se pasa API_URL=http://localhost:3333.
  /// En el emulador de Android, `localhost` es el propio emulador: el host es 10.0.2.2
  static String get apiUrl {
    if (_apiUrlOverride.isNotEmpty) return _apiUrlOverride;
    if (kIsWeb) return Uri.base.origin;
    if (!kIsWeb && defaultTargetPlatform == TargetPlatform.android) {
      return 'http://10.0.2.2:3333';
    }
    return 'http://localhost:3333';
  }

  /// Código de invitación del enlace `/r/CODIGO` (en web, la página de invitación
  /// abre la app con `?ref=CODIGO`)
  static String? get referralCodeFromUrl {
    if (!kIsWeb) return null;
    final code = Uri.base.queryParameters['ref']?.trim();
    return code == null || code.isEmpty ? null : code;
  }

  /// Cada cuánto se consulta el estado de la mesa (hasta tener tiempo real)
  static const tablePollInterval = Duration(seconds: 1);
}
