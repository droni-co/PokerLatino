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

  /// Cliente OAuth registrado en la API (database/seeders/oauth_client_seeder.ts)
  static const clientId = 'poker-latino-app';
  static const scopes = 'profile game';

  /// Esquema propio para volver a la app tras el login (Android/iOS)
  static const callbackScheme = 'co.droni.pokerlatino';

  /// En web el callback es la página web/auth.html servida por la propia app
  static String get redirectUri =>
      kIsWeb ? '${Uri.base.origin}/auth.html' : '$callbackScheme:/oauth/callback';

  /// Cada cuánto se consulta el estado de la mesa (hasta tener tiempo real)
  static const tablePollInterval = Duration(seconds: 1);
}
