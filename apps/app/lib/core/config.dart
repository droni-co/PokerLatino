/// Configuración de la app. Sobrescribe la URL de la API con:
/// flutter run --dart-define=API_URL=http://10.0.2.2:3333
/// (10.0.2.2 es el host visto desde el emulador de Android)
class AppConfig {
  static const apiUrl = String.fromEnvironment(
    'API_URL',
    defaultValue: 'http://localhost:3333',
  );
}
