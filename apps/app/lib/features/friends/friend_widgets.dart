import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_exception.dart';
import '../../core/models/social.dart';
import '../../core/money.dart';
import '../../core/providers.dart';
import '../../core/theme.dart';
import '../table/widgets/player_avatar.dart';

/// Avatar con el punto verde de "conectado"
class FriendAvatar extends StatelessWidget {
  const FriendAvatar({super.key, required this.player, this.online, this.size = 40});
  final PlayerRef player;

  /// null: no se muestra el estado
  final bool? online;
  final double size;

  @override
  Widget build(BuildContext context) {
    final dot = size * 0.3;
    return SizedBox(
      width: size,
      height: size,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          PlayerAvatar(playerId: player.id, avatar: player.avatar, size: size),
          if (online != null)
            Positioned(
              right: -1,
              bottom: -1,
              child: Container(
                key: ValueKey(online! ? 'online-${player.id}' : 'offline-${player.id}'),
                width: dot,
                height: dot,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: online! ? PokerColors.positive : const Color(0xFF59647D),
                  border: Border.all(color: PokerColors.background, width: 2),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// Texto de estado de un amigo: "En Principiantes · Mesa 1 (5/10)", "En un torneo", "Conectado"…
String friendStatus(Friend f) {
  final table = f.table;
  if (table != null) return 'En ${table.name} (${formatChips(table.smallBlind)}/${formatChips(table.bigBlind)})';
  if (f.inTournament) return 'Jugando un torneo';
  return f.online ? 'Conectado' : 'Desconectado';
}

/// Llama a la API mostrando el error (si lo hay) en un SnackBar. Devuelve si salió bien.
Future<bool> runSocial(BuildContext context, Future<void> Function() call, {String? done}) async {
  final messenger = ScaffoldMessenger.maybeOf(context);
  try {
    await call();
    if (done != null) messenger?.showSnackBar(SnackBar(content: Text(done)));
    return true;
  } on ApiException catch (e) {
    messenger?.showSnackBar(SnackBar(content: Text(e.message)));
    return false;
  }
}

/// Enviar solicitud de amistad (si él ya te la había enviado, quedan como amigos)
Future<void> addFriend(BuildContext context, WidgetRef ref, PlayerRef player) async {
  final messenger = ScaffoldMessenger.maybeOf(context);
  try {
    final relation = await ref.read(apiClientProvider).sendFriendRequest(player.id);
    messenger?.showSnackBar(
      SnackBar(
        content: Text(
          relation == Relation.friend
              ? '¡${player.displayName} y tú ya son amigos!'
              : 'Solicitud enviada a ${player.displayName}',
        ),
      ),
    );
  } on ApiException catch (e) {
    messenger?.showSnackBar(SnackBar(content: Text(e.message)));
  }
  ref.invalidate(friendsProvider);
}

/// Botón según la relación con un jugador (agregar, pendiente, aceptar, amigos)
class RelationButton extends ConsumerWidget {
  const RelationButton({super.key, required this.player, required this.relation, this.requestId});
  final PlayerRef player;
  final Relation relation;
  final int? requestId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return switch (relation) {
      Relation.friend => const Chip(
        avatar: Icon(Icons.check, size: 16, color: PokerColors.positive),
        label: Text('Amigos'),
        visualDensity: VisualDensity.compact,
      ),
      Relation.outgoing => const Chip(label: Text('Solicitud enviada'), visualDensity: VisualDensity.compact),
      Relation.incoming => FilledButton(
        onPressed: requestId == null
            ? () => addFriend(context, ref, player)
            : () async {
                await runSocial(
                  context,
                  () => ref.read(apiClientProvider).acceptFriendRequest(requestId!),
                  done: '¡${player.displayName} y tú ya son amigos!',
                );
                ref.invalidate(friendsProvider);
              },
        child: const Text('Aceptar'),
      ),
      Relation.none => FilledButton.icon(
        onPressed: () => addFriend(context, ref, player),
        icon: const Icon(Icons.person_add_alt_1, size: 18),
        label: const Text('Agregar'),
      ),
    };
  }
}

/// Desde la mesa: invitar amigos a sentarse en los asientos libres
class InviteFriendsSheet extends ConsumerWidget {
  const InviteFriendsSheet({super.key, required this.roomId, required this.freeSeats});
  final int roomId;
  final int freeSeats;

  static Future<void> show(BuildContext context, {required int roomId, required int freeSeats}) =>
      showModalBottomSheet<void>(
        context: context,
        isScrollControlled: true,
        backgroundColor: PokerColors.surface,
        showDragHandle: true,
        constraints: const BoxConstraints(maxWidth: 560),
        builder: (_) => FractionallySizedBox(
          heightFactor: 0.7,
          child: InviteFriendsSheet(roomId: roomId, freeSeats: freeSeats),
        ),
      );

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final friends = ref.watch(roomFriendsProvider(roomId));
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 4),
          child: Text(
            'Invitar amigos a la mesa',
            style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 8),
          child: Text(
            freeSeats == 1 ? 'Queda 1 asiento libre.' : 'Quedan $freeSeats asientos libres.',
            style: const TextStyle(color: PokerColors.muted),
          ),
        ),
        Expanded(
          child: friends.when(
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (e, _) => Center(child: Text(e.toString())),
            data: (list) => list.friends.isEmpty
                ? const Padding(
                    padding: EdgeInsets.all(24),
                    child: Text(
                      'Aún no tienes amigos. Agrégalos tocando su avatar en la mesa o búscalos en '
                      'Amigos (desde el lobby).',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: PokerColors.muted),
                    ),
                  )
                : ListView(
                    children: [
                      for (final f in list.friends)
                        ListTile(
                          leading: FriendAvatar(player: f.player, online: f.online),
                          title: Text(f.player.displayName, overflow: TextOverflow.ellipsis),
                          subtitle: Text(friendStatus(f), overflow: TextOverflow.ellipsis),
                          trailing: _InviteButton(roomId: roomId, friend: f),
                        ),
                    ],
                  ),
          ),
        ),
      ],
    );
  }
}

class _InviteButton extends ConsumerStatefulWidget {
  const _InviteButton({required this.roomId, required this.friend});
  final int roomId;
  final Friend friend;

  @override
  ConsumerState<_InviteButton> createState() => _InviteButtonState();
}

class _InviteButtonState extends ConsumerState<_InviteButton> {
  bool _busy = false;
  bool _sent = false;

  @override
  Widget build(BuildContext context) {
    final f = widget.friend;
    if (f.table?.roomId == widget.roomId) {
      return const Text('En esta mesa', style: TextStyle(color: PokerColors.muted));
    }
    if (f.invitedHere || _sent) {
      return const Chip(
        avatar: Icon(Icons.check, size: 16, color: PokerColors.positive),
        label: Text('Invitado'),
        visualDensity: VisualDensity.compact,
      );
    }
    if (f.inTournament) return const Text('En torneo', style: TextStyle(color: PokerColors.muted));
    return FilledButton(
      onPressed: _busy
          ? null
          : () async {
              setState(() => _busy = true);
              final ok = await runSocial(
                context,
                () => ref.read(apiClientProvider).inviteToTable(widget.roomId, f.player.id),
                done: 'Invitación enviada a ${f.player.displayName}',
              );
              if (!mounted) return;
              setState(() {
                _busy = false;
                _sent = ok;
              });
              ref.invalidate(roomFriendsProvider(widget.roomId));
            },
      child: const Text('Invitar'),
    );
  }
}

/// Aviso "Fulano te invita a su mesa" (lo muestra el aviso flotante de la app)
class InvitationCard extends StatelessWidget {
  const InvitationCard({super.key, required this.invitation, required this.onAccept, required this.onDecline});
  final TableInvitation invitation;
  final VoidCallback onAccept;
  final VoidCallback onDecline;

  @override
  Widget build(BuildContext context) {
    final i = invitation;
    return Material(
      key: ValueKey('invitation-${i.id}'),
      color: Colors.transparent,
      child: Container(
        constraints: const BoxConstraints(maxWidth: 520),
        padding: const EdgeInsets.fromLTRB(8, 6, 6, 6),
        decoration: BoxDecoration(
          color: PokerColors.background.withValues(alpha: 0.95),
          borderRadius: BorderRadius.circular(30),
          border: Border.all(color: PokerColors.positive, width: 1.4),
          boxShadow: [
            BoxShadow(color: PokerColors.positive.withValues(alpha: 0.3), blurRadius: 18),
            const BoxShadow(color: Colors.black54, blurRadius: 10, offset: Offset(0, 4)),
          ],
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            PlayerAvatar(playerId: i.from.id, avatar: i.from.avatar, size: 34),
            const SizedBox(width: 8),
            Flexible(
              child: Text.rich(
                TextSpan(
                  children: [
                    TextSpan(
                      text: i.from.displayName,
                      style: const TextStyle(color: PokerColors.gold),
                    ),
                    TextSpan(
                      text:
                          ' te invita a su mesa · ${formatChips(i.smallBlind)}/${formatChips(i.bigBlind)}'
                          ', entrada desde ${formatChips(i.minBuyIn)}',
                    ),
                  ],
                ),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
              ),
            ),
            const SizedBox(width: 6),
            TextButton(
              onPressed: onDecline,
              style: TextButton.styleFrom(visualDensity: VisualDensity.compact),
              child: const Text('Ahora no'),
            ),
            FilledButton(
              onPressed: onAccept,
              style: FilledButton.styleFrom(
                backgroundColor: PokerColors.positive,
                foregroundColor: const Color(0xFF052315),
                visualDensity: VisualDensity.compact,
                shape: const StadiumBorder(),
              ),
              child: const Text('Jugar', style: TextStyle(fontWeight: FontWeight.w800)),
            ),
          ],
        ),
      ),
    );
  }
}
