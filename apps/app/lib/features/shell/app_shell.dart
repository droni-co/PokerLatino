import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/brand.dart';
import '../../core/money.dart';
import '../../core/providers.dart';
import '../../core/theme.dart';
import '../table/widgets/player_avatar.dart';

/// Navegación principal: barra inferior en teléfono, rail lateral en pantallas anchas
class AppShell extends ConsumerWidget {
  const AppShell({super.key, required this.location, required this.child});

  final String location;
  final Widget child;

  static const _destinations = [
    (path: '/lobby', icon: Icons.casino_outlined, selected: Icons.casino, label: 'Salas'),
    (path: '/tournaments', icon: Icons.emoji_events_outlined, selected: Icons.emoji_events, label: 'Torneos'),
    (path: '/wallet', icon: Icons.toll_outlined, selected: Icons.toll, label: 'Fichas'),
    (path: '/stats', icon: Icons.insights_outlined, selected: Icons.insights, label: 'Estadísticas'),
    (path: '/profile', icon: Icons.person_outline, selected: Icons.person, label: 'Perfil'),
  ];

  int get _index {
    if (location.startsWith('/tournaments')) return 1;
    if (location.startsWith('/wallet')) return 2;
    if (location.startsWith('/stats')) return 3;
    if (location.startsWith('/profile')) return 4;
    return 0;
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final size = MediaQuery.sizeOf(context);
    // Teléfono en horizontal: barra superior más baja y menú lateral (una barra inferior
    // se comería media pantalla)
    final short = size.height < 500;
    final wide = size.width >= 800 || (short && size.width > size.height);
    void go(int i) => context.go(_destinations[i].path);

    final appBar = AppBar(
      backgroundColor: Colors.transparent,
      surfaceTintColor: Colors.transparent,
      toolbarHeight: short ? 50 : 64,
      titleSpacing: 12,
      flexibleSpace: const _BarBackground(top: true),
      title: LogoMark(height: short ? 40 : 50),
      actions: const [_Balances(), SizedBox(width: 10), _AccountMenu(), SizedBox(width: 10)],
    );

    if (wide) {
      return Backdrop(
        child: Scaffold(
          backgroundColor: Colors.transparent,
          appBar: appBar,
          body: Row(
            children: [
              DecoratedBox(
                decoration: BoxDecoration(
                  color: PokerColors.background.withValues(alpha: 0.7),
                  border: Border(right: BorderSide(color: PokerColors.gold.withValues(alpha: 0.2))),
                ),
                child: NavigationRail(
                  selectedIndex: _index,
                  onDestinationSelected: go,
                  // Con poca altura solo lleva texto la sección activa, para que quepan las cuatro
                  labelType: short ? NavigationRailLabelType.selected : NavigationRailLabelType.all,
                  destinations: [
                    for (final d in _destinations)
                      NavigationRailDestination(
                        icon: Icon(d.icon),
                        selectedIcon: Icon(d.selected),
                        label: Text(d.label),
                      ),
                  ],
                ),
              ),
              Expanded(
                child: Align(
                  alignment: Alignment.topCenter,
                  child: ConstrainedBox(constraints: const BoxConstraints(maxWidth: 1040), child: child),
                ),
              ),
            ],
          ),
        ),
      );
    }

    return Backdrop(
      child: Scaffold(
        backgroundColor: Colors.transparent,
        appBar: appBar,
        body: child,
        bottomNavigationBar: Stack(
          children: [
            const Positioned.fill(child: _BarBackground(top: false)),
            NavigationBar(
              selectedIndex: _index,
              onDestinationSelected: go,
              destinations: [
                for (final d in _destinations)
                  NavigationDestination(icon: Icon(d.icon), selectedIcon: Icon(d.selected), label: d.label),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// Fondo de las barras superior/inferior: noche profunda con un filo dorado
class _BarBackground extends StatelessWidget {
  const _BarBackground({required this.top});
  final bool top;

  @override
  Widget build(BuildContext context) {
    final edge = BorderSide(color: PokerColors.gold.withValues(alpha: 0.35));
    return DecoratedBox(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: top ? Alignment.topCenter : Alignment.bottomCenter,
          end: top ? Alignment.bottomCenter : Alignment.topCenter,
          colors: [PokerColors.background, PokerColors.background.withValues(alpha: 0.88)],
        ),
        border: top ? Border(bottom: edge) : Border(top: edge),
      ),
    );
  }
}

class _Balances extends ConsumerWidget {
  const _Balances();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final narrow = MediaQuery.sizeOf(context).width < 420;
    final balance = ref.watch(walletBalanceProvider);
    if (balance == null) return const SizedBox.shrink();

    Widget chip(String icon, String text) => Container(
      padding: const EdgeInsets.fromLTRB(4, 3, 12, 3),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        color: Colors.black.withValues(alpha: 0.35),
        border: Border.all(color: PokerColors.gold.withValues(alpha: 0.4)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          GameIcon(icon, size: 24),
          const SizedBox(width: 6),
          Text(
            text,
            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: PokerColors.gold),
          ),
        ],
      ),
    );

    return Tooltip(
      message: 'Tus fichas',
      child: InkWell(
        borderRadius: BorderRadius.circular(20),
        onTap: () => context.go('/wallet'),
        child: chip('chips', narrow ? formatChips(balance) : formatFichas(balance)),
      ),
    );
  }
}

class _AccountMenu extends ConsumerWidget {
  const _AccountMenu();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final me = ref.watch(authControllerProvider).value;
    return PopupMenuButton<String>(
      tooltip: 'Cuenta',
      padding: EdgeInsets.zero,
      icon: me == null
          ? const Icon(Icons.account_circle_outlined)
          : PlayerAvatar(playerId: me.id, avatar: me.avatar, size: 38, isMe: true),
      onSelected: (value) {
        if (value == 'logout') ref.read(authControllerProvider.notifier).logout();
        if (value == 'profile') context.go('/profile');
      },
      itemBuilder: (_) => [
        PopupMenuItem(
          enabled: false,
          child: Row(
            children: [
              if (me != null) PlayerAvatar(playerId: me.id, avatar: me.avatar, size: 44, isMe: true),
              const SizedBox(width: 12),
              Flexible(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      me?.displayName ?? '',
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(color: PokerColors.gold, fontWeight: FontWeight.w700),
                    ),
                    Text(
                      me?.email ?? '',
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(color: PokerColors.muted, fontSize: 12),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        const PopupMenuDivider(),
        const PopupMenuItem(
          value: 'profile',
          child: Row(children: [Icon(Icons.person_outline, size: 18), SizedBox(width: 10), Text('Mi perfil')]),
        ),
        const PopupMenuItem(
          value: 'logout',
          child: Row(children: [Icon(Icons.logout, size: 18), SizedBox(width: 10), Text('Cerrar sesión')]),
        ),
      ],
    );
  }
}
