import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../core/brand.dart';
import '../../core/models/models.dart';
import '../../core/money.dart';
import '../../core/providers.dart';
import '../../core/theme.dart';
import '../referrals/referral_widgets.dart';

final _transactionsProvider = FutureProvider.autoDispose<Paginated<WalletTransaction>>((ref) {
  // Al cambiar el saldo (p. ej. al reclamar el rescate) se recargan los movimientos
  ref.watch(walletProvider);
  return ref.watch(apiClientProvider).transactions();
});

/// Fichas del jugador y sus movimientos. Las fichas no se compran ni se canjean por dinero.
class WalletPage extends ConsumerWidget {
  const WalletPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final wallet = ref.watch(walletProvider);
    final transactions = ref.watch(_transactionsProvider);
    final dateFormat = DateFormat('dd/MM/yyyy HH:mm');

    return RefreshIndicator(
      onRefresh: () async {
        ref.invalidate(_transactionsProvider);
        ref.invalidate(referralsProvider);
        await ref.refresh(walletProvider.future).then((_) {}, onError: (_) {});
      },
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
        children: [
          Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 640),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  wallet.when(
                    loading: () => const LinearProgressIndicator(),
                    error: (e, _) => Text(e.toString()),
                    data: (w) => _BalanceCard(balance: w.balance),
                  ),
                  const RescuePanel(),
                  const SizedBox(height: 16),
                  const InviteFriendsPanel(),
                  const SizedBox(height: 24),
                  const SectionTitle('Movimientos'),
                  const SizedBox(height: 8),
                  transactions.when(
                    loading: () => const Padding(
                      padding: EdgeInsets.all(24),
                      child: Center(child: CircularProgressIndicator()),
                    ),
                    error: (e, _) => Padding(padding: const EdgeInsets.all(24), child: Text(e.toString())),
                    data: (page) => page.items.isEmpty
                        ? const Padding(
                            padding: EdgeInsets.all(24),
                            child: Center(
                              child: Text('Sin movimientos', style: TextStyle(color: PokerColors.muted)),
                            ),
                          )
                        : Column(
                            children: [
                              for (final (i, tx) in page.items.indexed) ...[
                                if (i > 0) const Divider(height: 1),
                                _TransactionTile(tx: tx, dateFormat: dateFormat),
                              ],
                            ],
                          ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _BalanceCard extends StatelessWidget {
  const _BalanceCard({required this.balance});
  final int balance;

  @override
  Widget build(BuildContext context) {
    return GoldPanel(
      highlight: true,
      child: Row(
        children: [
          const GameIcon('chips', size: 64),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Tus fichas', style: TextStyle(color: PokerColors.muted)),
                const SizedBox(height: 4),
                FittedBox(
                  fit: BoxFit.scaleDown,
                  alignment: Alignment.centerLeft,
                  child: Text(
                    formatFichas(balance),
                    style: Theme.of(
                      context,
                    ).textTheme.headlineSmall?.copyWith(color: PokerColors.gold, fontWeight: FontWeight.w800),
                  ),
                ),
                const SizedBox(height: 6),
                const Text(
                  'Las fichas son solo para jugar: no se compran, no se venden y no se cambian por dinero.',
                  style: TextStyle(fontSize: 12, color: Colors.white70),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _TransactionTile extends StatelessWidget {
  const _TransactionTile({required this.tx, required this.dateFormat});
  final WalletTransaction tx;
  final DateFormat dateFormat;

  @override
  Widget build(BuildContext context) {
    final positive = tx.amount >= 0;
    return ListTile(
      contentPadding: const EdgeInsets.symmetric(horizontal: 4),
      leading: GameIcon(_txIcon(tx.type), size: 36),
      title: Text(tx.label),
      subtitle: Text([tx.description, dateFormat.format(tx.createdAt)].whereType<String>().join(' · ')),
      trailing: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Text(
            '${positive ? '+' : '−'}${formatChips(tx.amount.abs())}',
            style: TextStyle(color: positive ? PokerColors.positive : PokerColors.red, fontWeight: FontWeight.w600),
          ),
          Text(formatFichas(tx.balanceAfter), style: const TextStyle(fontSize: 12, color: PokerColors.muted)),
        ],
      ),
    );
  }
}

/// Ícono ilustrado según el tipo de movimiento
String _txIcon(String type) => switch (type) {
  'signup_bonus' => 'trophy',
  'buy_in' => 'wagered',
  'cash_out' => 'won',
  'tournament_prize' => 'trophy',
  'referral_reward' || 'referral_bonus' => 'trophy',
  _ => 'chips',
};
