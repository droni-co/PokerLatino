import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../features/auth/login_page.dart';
import '../features/lobby/lobby_page.dart';
import '../features/profile/profile_page.dart';
import '../features/shell/app_shell.dart';
import '../features/stats/stats_page.dart';
import '../features/table/table_page.dart';
import '../features/tournaments/tournament_page.dart';
import '../features/tournaments/tournaments_page.dart';
import '../features/wallet/wallet_page.dart';
import 'providers.dart';

final routerProvider = Provider<GoRouter>((ref) {
  // Notifica a go_router cuando cambia la sesión para reevaluar el redirect
  final authChanges = ValueNotifier(0);
  ref.listen(authControllerProvider, (_, _) => authChanges.value++);
  ref.onDispose(authChanges.dispose);

  return GoRouter(
    initialLocation: '/lobby',
    refreshListenable: authChanges,
    redirect: (context, state) {
      final auth = ref.read(authControllerProvider);
      if (auth.isLoading && !auth.hasValue) return null; // restaurando sesión
      final signedIn = auth.value != null;
      final atLogin = state.matchedLocation == '/login';

      if (!signedIn && !atLogin) return '/login';
      if (signedIn && atLogin) return '/lobby';
      return null;
    },
    routes: [
      GoRoute(path: '/login', builder: (_, _) => const LoginPage()),
      GoRoute(path: '/', redirect: (_, _) => '/lobby'),
      ShellRoute(
        builder: (context, state, child) => AppShell(location: state.matchedLocation, child: child),
        routes: [
          GoRoute(path: '/lobby', builder: (_, _) => const LobbyPage()),
          // Enlaces viejos (/lobby/credits, /lobby/usd) llevan a las salas
          GoRoute(path: '/lobby/:old', redirect: (_, _) => '/lobby'),
          GoRoute(path: '/tournaments', builder: (_, _) => const TournamentsPage()),
          GoRoute(
            path: '/tournaments/:id',
            builder: (_, state) => TournamentPage(tournamentId: int.parse(state.pathParameters['id']!)),
          ),
          GoRoute(path: '/wallet', builder: (_, _) => const WalletPage()),
          GoRoute(path: '/stats', builder: (_, _) => const StatsPage()),
          GoRoute(path: '/profile', builder: (_, _) => const ProfilePage()),
        ],
      ),
      // La mesa ocupa toda la pantalla (sin navegación inferior)
      GoRoute(
        path: '/rooms/:id',
        builder: (_, state) => TablePage(roomId: int.parse(state.pathParameters['id']!)),
      ),
    ],
  );
});
