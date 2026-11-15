import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'api/api_client.dart';
import 'auth/auth_service.dart';
import 'auth/token_storage.dart';
import 'models/models.dart';

final tokenStorageProvider = Provider<TokenStorage>((ref) => SecureTokenStorage());

final authServiceProvider = Provider<AuthService>((ref) {
  final service = AuthService(storage: ref.watch(tokenStorageProvider));
  ref.onDispose(service.dispose);
  return service;
});

final apiClientProvider = Provider<ApiClient>((ref) => ApiClient(ref.watch(authServiceProvider)));

/// Sesión: `null` = sin sesión; `Me` = jugador autenticado
final authControllerProvider = AsyncNotifierProvider<AuthController, Me?>(AuthController.new);

class AuthController extends AsyncNotifier<Me?> {
  StreamSubscription<void>? _expired;

  @override
  Future<Me?> build() async {
    final auth = ref.watch(authServiceProvider);
    _expired?.cancel();
    _expired = auth.onSessionExpired.listen((_) => state = const AsyncData(null));
    ref.onDispose(() => _expired?.cancel());

    if (!await auth.restore()) return null;
    try {
      return await ref.read(apiClientProvider).me();
    } catch (_) {
      // Si la sesión expiró, el servicio ya borró los tokens → pantalla de login.
      // Si fue un error de red, se propaga y la pantalla de login ofrece reintentar
      // sin perder la sesión guardada.
      if (!auth.isSignedIn) return null;
      rethrow;
    }
  }

  Future<void> login({bool forceLogin = false}) async {
    state = const AsyncLoading<Me?>(); // conserva el valor previo
    state = await AsyncValue.guard(() async {
      await ref.read(authServiceProvider).login(forceLogin: forceLogin);
      return ref.read(apiClientProvider).me();
    });
  }

  /// Guarda nombre de usuario y/o avatar y actualiza la sesión (ver [ApiClient.updateProfile])
  Future<Me> updateProfile({String? username, String? avatar}) async {
    final me = await ref.read(apiClientProvider).updateProfile(username: username, avatar: avatar);
    state = AsyncData(me);
    return me;
  }

  Future<void> logout() async {
    await ref.read(authServiceProvider).logout();
    _forceLoginNext = true;
    state = const AsyncData(null);
  }

  /// Tras cerrar sesión, el siguiente login pide credenciales (permite cambiar de cuenta)
  bool _forceLoginNext = false;
  bool get shouldForceLogin => _forceLoginNext;
}

/*
| Datos del juego
*/

final gameConfigProvider = FutureProvider<GameConfig>((ref) => ref.watch(apiClientProvider).config());

/// Billetera de fichas del jugador
final walletProvider = FutureProvider.autoDispose<Wallet>((ref) => ref.watch(apiClientProvider).wallet());

/// Fichas disponibles (null mientras carga)
final walletBalanceProvider = Provider.autoDispose<int?>((ref) => ref.watch(walletProvider).value?.balance);

final levelsProvider = FutureProvider.autoDispose<List<RoomLevel>>((ref) => ref.watch(apiClientProvider).levels());

final roomProvider = FutureProvider.autoDispose.family<Room, int>(
  (ref, id) => ref.watch(apiClientProvider).room(id),
);

final statsProvider = FutureProvider.autoDispose<PlayerStat>(
  (ref) => ref.watch(apiClientProvider).stats(),
);
