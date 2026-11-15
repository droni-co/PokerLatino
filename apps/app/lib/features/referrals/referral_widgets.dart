import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api_exception.dart';
import '../../core/brand.dart';
import '../../core/models/referral.dart';
import '../../core/money.dart';
import '../../core/providers.dart';
import '../../core/theme.dart';
import '../table/widgets/player_avatar.dart';

String _two(int n) => n.toString().padLeft(2, '0');

/// "hoy a las 21:05" / "mañana a las 09:00"
String formatWhen(DateTime at, {DateTime? now}) {
  final current = now ?? DateTime.now();
  final days = DateTime(
    at.year,
    at.month,
    at.day,
  ).difference(DateTime(current.year, current.month, current.day)).inDays;
  final time = '${_two(at.hour)}:${_two(at.minute)}';
  return switch (days) {
    0 => 'hoy a las $time',
    1 => 'mañana a las $time',
    _ => 'el ${_two(at.day)}/${_two(at.month)} a las $time',
  };
}

/// Mensaje listo para pegar en WhatsApp, Telegram…
String inviteMessage(ReferralSummary r, {required int signupBonus}) =>
    '¡Juega póker conmigo en Poker Latino! Crea tu cuenta con mi invitación y empieza con '
    '${formatFichas(signupBonus + r.referredReward)}: ${r.link}';

/// Reclamar el rescate diario (compartido por el lobby y la página de Fichas)
Future<void> claimRescue(BuildContext context, WidgetRef ref) async {
  final messenger = ScaffoldMessenger.of(context);
  try {
    final status = await ref.read(apiClientProvider).claimRescue();
    ref.invalidate(walletProvider);
    messenger.showSnackBar(
      SnackBar(content: Text('¡Listo! ${formatFichas(status.amount)} gratis en tu cuenta. ¡Suerte en las mesas!')),
    );
  } on ApiException catch (e) {
    ref.invalidate(rescueProvider);
    messenger.showSnackBar(SnackBar(content: Text(e.message)));
  }
}

/// Lobby: si no te alcanza para la mesa más barata, ofrece el rescate y las invitaciones
class OutOfChipsBanner extends ConsumerWidget {
  const OutOfChipsBanner({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final rescue = ref.watch(rescueProvider).value;
    if (rescue == null || !rescue.eligible) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      child: GoldPanel(
        key: const ValueKey('out-of-chips'),
        highlight: true,
        padding: const EdgeInsets.fromLTRB(14, 10, 10, 10),
        child: Wrap(
          spacing: 10,
          runSpacing: 6,
          crossAxisAlignment: WrapCrossAlignment.center,
          alignment: WrapAlignment.spaceBetween,
          children: [
            Text(
              rescue.available
                  ? 'Te quedaste sin fichas. Reclama ${formatFichas(rescue.amount)} gratis o invita a un amigo.'
                  : 'Te quedaste sin fichas. Tu próximo rescate: ${formatWhen(rescue.nextAt ?? DateTime.now())}. '
                        'Mientras, invita a un amigo y ganen fichas los dos.',
            ),
            Wrap(
              spacing: 8,
              children: [
                if (rescue.available)
                  FilledButton(
                    onPressed: () => claimRescue(context, ref),
                    child: Text('Reclamar ${formatChips(rescue.amount)}'),
                  ),
                OutlinedButton(onPressed: () => context.go('/wallet'), child: const Text('Invitar amigos')),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// Página de Fichas: rescate disponible (solo si te quedaste sin fichas)
class RescuePanel extends ConsumerWidget {
  const RescuePanel({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final rescue = ref.watch(rescueProvider).value;
    if (rescue == null || !rescue.eligible) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(top: 16),
      child: GoldPanel(
        highlight: rescue.available,
        child: Row(
          children: [
            const Icon(Icons.local_fire_department, color: PokerColors.gold, size: 34),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Rescate diario', style: TextStyle(fontWeight: FontWeight.w800)),
                  const SizedBox(height: 2),
                  Text(
                    rescue.available
                        ? 'No te alcanza para la mesa más barata (${formatFichas(rescue.threshold)}). '
                              'Reclama ${formatFichas(rescue.amount)} gratis, una vez al día.'
                        : 'Ya lo reclamaste. Vuelve ${formatWhen(rescue.nextAt ?? DateTime.now())}.',
                    style: const TextStyle(fontSize: 13, color: PokerColors.muted),
                  ),
                ],
              ),
            ),
            if (rescue.available) ...[
              const SizedBox(width: 8),
              FilledButton(onPressed: () => claimRescue(context, ref), child: const Text('Reclamar')),
            ],
          ],
        ),
      ),
    );
  }
}

/// Página de Fichas: tu enlace de invitación, las reglas y tus invitados
class InviteFriendsPanel extends ConsumerWidget {
  const InviteFriendsPanel({super.key});

  Future<void> _copy(BuildContext context, String text, String done) async {
    final messenger = ScaffoldMessenger.of(context);
    await Clipboard.setData(ClipboardData(text: text));
    messenger.showSnackBar(SnackBar(content: Text(done)));
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final summary = ref.watch(referralsProvider);
    final signupBonus = ref.watch(gameConfigProvider).value?.signupBonus ?? 1000;

    return GoldPanel(
      key: const ValueKey('invite-friends'),
      child: summary.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Text(e.toString()),
        data: (r) => Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.group_add, color: PokerColors.gold, size: 30),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'Invita amigos: ${formatChips(r.referrerReward)} para ti y '
                    '${formatChips(r.referredReward)} extra para cada amigo',
                    style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              'Cuando tu amigo crea su cuenta con tu enlace, los dos reciben fichas al instante. '
              'Cobras hasta ${r.maxRewardedPerDay} invitaciones al día.',
              style: const TextStyle(fontSize: 13, color: PokerColors.muted),
            ),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.fromLTRB(12, 4, 4, 4),
              decoration: BoxDecoration(
                color: Colors.black.withValues(alpha: 0.35),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: PokerColors.gold.withValues(alpha: 0.5)),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: SelectableText(
                      r.link,
                      maxLines: 1,
                      style: const TextStyle(fontWeight: FontWeight.w700, color: PokerColors.gold),
                    ),
                  ),
                  IconButton(
                    tooltip: 'Copiar enlace',
                    icon: const Icon(Icons.copy, size: 20),
                    onPressed: () => _copy(context, r.link, 'Enlace copiado'),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                FilledButton.icon(
                  onPressed: () => _copy(
                    context,
                    inviteMessage(r, signupBonus: signupBonus),
                    'Mensaje copiado: pégalo en WhatsApp o donde quieras',
                  ),
                  icon: const Icon(Icons.chat_bubble_outline, size: 18),
                  label: const Text('Copiar invitación'),
                ),
                Text('Código: ${r.code}', style: const TextStyle(color: PokerColors.muted)),
              ],
            ),
            const SizedBox(height: 14),
            Text(
              r.limitReached
                  ? 'Hoy ya cobraste ${r.maxRewardedPerDay} de ${r.maxRewardedPerDay}. '
                        'Vuelves a cobrar ${formatWhen(r.nextSlotAt ?? DateTime.now())} (tus amigos sí reciben su bono).'
                  : 'Hoy: ${r.rewardedToday} de ${r.maxRewardedPerDay} invitaciones cobradas · '
                        'Total ganado: ${formatFichas(r.totalEarned)}',
              style: TextStyle(fontSize: 12.5, color: r.limitReached ? PokerColors.gold : PokerColors.muted),
            ),
            if (r.invited.isNotEmpty) ...[
              const SizedBox(height: 10),
              const Divider(height: 1),
              for (final f in r.invited.take(20)) _InvitedRow(friend: f),
            ],
          ],
        ),
      ),
    );
  }
}

class _InvitedRow extends StatelessWidget {
  const _InvitedRow({required this.friend});
  final InvitedFriend friend;

  @override
  Widget build(BuildContext context) {
    final (label, color) = switch (friend.status) {
      'rewarded' => ('+${formatChips(friend.reward)}', PokerColors.positive),
      'limit_reached' => ('Sin cobro (tope del día)', PokerColors.muted),
      _ => ('No válida', PokerColors.muted),
    };
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          PlayerAvatar(playerId: friend.playerId, avatar: friend.avatar, size: 30),
          const SizedBox(width: 10),
          Expanded(child: Text(friend.displayName, maxLines: 1, overflow: TextOverflow.ellipsis)),
          Text(
            label,
            style: TextStyle(color: color, fontWeight: FontWeight.w700, fontSize: 13),
          ),
        ],
      ),
    );
  }
}
