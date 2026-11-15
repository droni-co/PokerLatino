import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api_exception.dart';
import '../../core/brand.dart';
import '../../core/game_assets.dart';
import '../../core/models/models.dart';
import '../../core/money.dart';
import '../../core/providers.dart';
import '../../core/theme.dart';
import '../referrals/referral_widgets.dart';
import '../table/table_page.dart';

class LobbyPage extends ConsumerWidget {
  const LobbyPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final levels = ref.watch(levelsProvider);
    final needsUsername = ref.watch(authControllerProvider.select((a) => a.value != null && a.value!.username == null));

    final short = MediaQuery.sizeOf(context).height < 500;

    return Column(
      children: [
        if (needsUsername) const _UsernameBanner(),
        const OutOfChipsBanner(),
        Padding(padding: EdgeInsets.fromLTRB(16, short ? 6 : 14, 16, 0), child: const SectionTitle('Elige tu mesa')),
        Expanded(
          child: RefreshIndicator(
            onRefresh: () => ref.refresh(levelsProvider.future),
            child: levels.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (e, _) => _Message(text: e.toString(), onRetry: () => ref.invalidate(levelsProvider)),
              data: (list) => list.isEmpty
                  ? const _Message(text: 'No hay salas disponibles.')
                  : GridView.builder(
                      padding: EdgeInsets.fromLTRB(16, short ? 8 : 16, 16, 16),
                      gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
                        maxCrossAxisExtent: 480,
                        mainAxisExtent: 286,
                        mainAxisSpacing: 16,
                        crossAxisSpacing: 16,
                      ),
                      itemCount: list.length,
                      itemBuilder: (_, i) => LevelCard(level: list[i], banner: GameAssets.instance.levelBanner(i)),
                    ),
            ),
          ),
        ),
      ],
    );
  }
}

/// Nivel (categoría): "Jugar" sienta al jugador en la mejor mesa; abajo, las mesas abiertas
class LevelCard extends ConsumerStatefulWidget {
  const LevelCard({super.key, required this.level, this.banner});
  final RoomLevel level;
  final String? banner;

  @override
  ConsumerState<LevelCard> createState() => _LevelCardState();
}

class _LevelCardState extends ConsumerState<LevelCard> {
  bool _joining = false;

  Future<void> _play() async {
    final level = widget.level;
    final messenger = ScaffoldMessenger.of(context);
    final router = GoRouter.of(context);
    try {
      final wallet = await ref.read(walletProvider.future);
      if (!mounted) return;
      final buyIn = await showDialog<int>(
        context: context,
        builder: (_) => BuyInDialog(
          title: 'Jugar en ${level.name}',
          minBuyIn: level.minBuyIn,
          maxBuyIn: level.maxBuyIn,
          balance: wallet.balance,
        ),
      );
      if (buyIn == null) return;

      setState(() => _joining = true);
      final seat = await ref.read(apiClientProvider).quickSeat(level.id, buyIn: buyIn);
      ref.invalidate(walletProvider);
      ref.invalidate(levelsProvider);
      if (seat.alreadySeated) {
        messenger.showSnackBar(const SnackBar(content: Text('Ya estabas sentado en esta mesa.')));
      }
      router.push('/rooms/${seat.roomId}');
    } on ApiException catch (e) {
      messenger.showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _joining = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final level = widget.level;
    final text = Theme.of(context).textTheme;
    final radius = BorderRadius.circular(18);
    final tables = level.tables.length;

    return DecoratedBox(
      decoration: GoldPanel.panelDecoration(radius: 18),
      child: ClipRRect(
        borderRadius: radius,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Banner ilustrado con nombre y ciegas
            Expanded(
              child: Stack(
                fit: StackFit.expand,
                children: [
                  if (widget.banner != null)
                    Image.asset(widget.banner!, fit: BoxFit.cover)
                  else
                    const DecoratedBox(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(colors: [PokerColors.felt, PokerColors.feltDark]),
                      ),
                    ),
                  DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [Colors.transparent, PokerColors.background.withValues(alpha: 0.92)],
                        stops: const [0.3, 1],
                      ),
                    ),
                  ),
                  Positioned(top: 10, right: 10, child: _BlindsBadge(label: level.blindsLabel)),
                  Positioned(
                    left: 14,
                    right: 14,
                    bottom: 8,
                    child: Text(
                      level.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: text.titleLarge?.copyWith(
                        fontWeight: FontWeight.w800,
                        color: Colors.white,
                        shadows: const [Shadow(color: Colors.black, blurRadius: 6)],
                      ),
                    ),
                  ),
                ],
              ),
            ),
            // Entrada, ocupación y botón
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 10, 14, 6),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Entrada ${formatFichas(level.minBuyIn)} – ${formatFichas(level.maxBuyIn)}',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: text.bodySmall?.copyWith(color: PokerColors.muted),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '$tables ${tables == 1 ? 'mesa' : 'mesas'} · '
                          '${level.playerCount} ${level.playerCount == 1 ? 'jugador' : 'jugadores'}',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: text.bodySmall?.copyWith(color: PokerColors.gold, fontWeight: FontWeight.w600),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 12),
                  SizedBox(
                    width: 104,
                    child: GoldButton(
                      height: 40,
                      onPressed: _joining ? null : _play,
                      child: _joining
                          ? const SizedBox.square(
                              dimension: 18,
                              child: CircularProgressIndicator(strokeWidth: 2.5, color: Color(0xFF2A1B04)),
                            )
                          : const Text('JUGAR'),
                    ),
                  ),
                ],
              ),
            ),
            // Mesas abiertas: tocar una para verla o elegir asiento
            SizedBox(
              height: 44,
              child: ListView.separated(
                padding: const EdgeInsets.fromLTRB(14, 0, 14, 10),
                scrollDirection: Axis.horizontal,
                itemCount: level.tables.length,
                separatorBuilder: (_, _) => const SizedBox(width: 8),
                itemBuilder: (_, i) => _TableChip(table: level.tables[i]),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _TableChip extends StatelessWidget {
  const _TableChip({required this.table});
  final LevelTable table;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: table.isFull ? 'Mesa llena: entrar a mirar' : 'Ver la mesa y elegir asiento',
      child: InkWell(
        key: ValueKey('table-${table.id}'),
        borderRadius: BorderRadius.circular(16),
        onTap: () => context.push('/rooms/${table.id}'),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10),
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: Colors.black.withValues(alpha: 0.35),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: PokerColors.gold.withValues(alpha: table.isFull ? 0.25 : 0.55)),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text('Mesa ${table.tableNumber}', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
              const SizedBox(width: 6),
              _SeatDots(taken: table.seatedCount, total: table.maxSeats),
              if (table.isFull) const Text('Llena', style: TextStyle(fontSize: 11, color: PokerColors.red)),
            ],
          ),
        ),
      ),
    );
  }
}

class _BlindsBadge extends StatelessWidget {
  const _BlindsBadge({required this.label});
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.6),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: PokerColors.gold.withValues(alpha: 0.6)),
      ),
      child: Text(
        'Ciegas $label',
        style: const TextStyle(color: PokerColors.gold, fontWeight: FontWeight.w700, fontSize: 12),
      ),
    );
  }
}

class _SeatDots extends StatelessWidget {
  const _SeatDots({required this.taken, required this.total});
  final int taken;
  final int total;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        for (var i = 0; i < total; i++)
          Container(
            width: 9,
            height: 9,
            margin: const EdgeInsets.only(right: 3),
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: i < taken ? PokerColors.gold : Colors.transparent,
              border: Border.all(color: PokerColors.gold.withValues(alpha: 0.8)),
              boxShadow: i < taken ? [BoxShadow(color: PokerColors.gold.withValues(alpha: 0.5), blurRadius: 4)] : null,
            ),
          ),
      ],
    );
  }
}

class _Message extends StatelessWidget {
  const _Message({required this.text, this.onRetry});
  final String text;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    // ListView para que funcione el "deslizar para actualizar"
    return ListView(
      padding: const EdgeInsets.all(32),
      children: [
        GoldPanel(
          child: Column(
            children: [
              const GameIcon('hands', size: 56),
              const SizedBox(height: 12),
              Text(text, textAlign: TextAlign.center),
              if (onRetry != null) ...[
                const SizedBox(height: 12),
                OutlinedButton(onPressed: onRetry, child: const Text('Reintentar')),
              ],
            ],
          ),
        ),
      ],
    );
  }
}

/// Cuentas creadas antes del nombre de usuario: invita a elegir uno
class _UsernameBanner extends StatelessWidget {
  const _UsernameBanner();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      child: GoldPanel(
        highlight: true,
        padding: const EdgeInsets.fromLTRB(14, 10, 10, 10),
        child: Row(
          children: [
            const Icon(Icons.badge_outlined, color: PokerColors.gold),
            const SizedBox(width: 12),
            const Expanded(child: Text('Elige tu nombre de usuario para que te reconozcan en las mesas.')),
            TextButton(onPressed: () => context.go('/profile'), child: const Text('Elegir')),
          ],
        ),
      ),
    );
  }
}
