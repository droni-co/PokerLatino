import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api_exception.dart';
import '../../core/brand.dart';
import '../../core/models/social.dart';
import '../../core/providers.dart';
import '../../core/theme.dart';
import '../progress/progress_widgets.dart';
import 'friend_widgets.dart';

/// Amigos: buscar jugadores, responder solicitudes y ver quién está jugando y dónde
class FriendsPage extends ConsumerStatefulWidget {
  const FriendsPage({super.key});

  @override
  ConsumerState<FriendsPage> createState() => _FriendsPageState();
}

class _FriendsPageState extends ConsumerState<FriendsPage> {
  final _search = TextEditingController();
  Timer? _debounce;
  String _query = '';
  Future<List<PlayerSearchResult>>? _results;

  @override
  void dispose() {
    _debounce?.cancel();
    _search.dispose();
    super.dispose();
  }

  void _onSearch(String text) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 350), () => _runSearch(text.trim()));
  }

  void _runSearch(String text) {
    if (!mounted) return;
    setState(() {
      _query = text;
      _results = text.length < 2 ? null : ref.read(apiClientProvider).searchPlayers(text);
    });
  }

  @override
  Widget build(BuildContext context) {
    final friends = ref.watch(friendsProvider);

    return RefreshIndicator(
      onRefresh: () => ref.refresh(friendsProvider.future),
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
        children: [
          Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 640),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const SectionTitle('Amigos'),
                  const SizedBox(height: 12),
                  TextField(
                    key: const ValueKey('friend-search'),
                    controller: _search,
                    onChanged: _onSearch,
                    onSubmitted: (t) => _runSearch(t.trim()),
                    textInputAction: TextInputAction.search,
                    decoration: InputDecoration(
                      prefixIcon: const Icon(Icons.search),
                      hintText: 'Buscar jugadores por nombre de usuario',
                      suffixIcon: _query.isEmpty
                          ? null
                          : IconButton(
                              tooltip: 'Limpiar',
                              icon: const Icon(Icons.close),
                              onPressed: () {
                                _search.clear();
                                _runSearch('');
                              },
                            ),
                    ),
                  ),
                  if (_results != null) _SearchResults(results: _results!, query: _query),
                  const SizedBox(height: 16),
                  friends.when(
                    loading: () => const Padding(
                      padding: EdgeInsets.all(24),
                      child: Center(child: CircularProgressIndicator()),
                    ),
                    error: (e, _) => Padding(padding: const EdgeInsets.all(24), child: Text(e.toString())),
                    data: (list) => _FriendsSections(list: list),
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

class _SearchResults extends ConsumerWidget {
  const _SearchResults({required this.results, required this.query});
  final Future<List<PlayerSearchResult>> results;
  final String query;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Al cambiar la lista de amigos (p. ej. tras "Agregar"), la relación sale de ella
    final friends = ref.watch(friendsProvider).value;
    return FutureBuilder(
      future: results,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return const Padding(padding: EdgeInsets.all(16), child: LinearProgressIndicator());
        }
        if (snapshot.hasError) {
          final error = snapshot.error;
          return Padding(
            padding: const EdgeInsets.all(16),
            child: Text(error is ApiException ? error.message : error.toString()),
          );
        }
        final found = snapshot.data!;
        if (found.isEmpty) {
          return Padding(
            padding: const EdgeInsets.all(16),
            child: Text('Nadie se llama "$query…"', style: const TextStyle(color: PokerColors.muted)),
          );
        }
        return GoldPanel(
          padding: const EdgeInsets.symmetric(vertical: 4),
          child: Column(
            children: [
              for (final r in found)
                ListTile(
                  onTap: () => PlayerCardSheet.show(context, r.player),
                  leading: FriendAvatar(player: r.player),
                  title: Text(r.player.displayName, overflow: TextOverflow.ellipsis),
                  trailing: RelationButton(
                    player: r.player,
                    relation: friends?.relationWith(r.player.id) ?? r.relation,
                    requestId:
                        friends?.incoming.where((i) => i.player.id == r.player.id).firstOrNull?.id ?? r.requestId,
                  ),
                ),
            ],
          ),
        );
      },
    );
  }
}

class _FriendsSections extends ConsumerWidget {
  const _FriendsSections({required this.list});
  final FriendsList list;

  Future<void> _call(BuildContext context, WidgetRef ref, Future<void> Function() call, {String? done}) async {
    await runSocial(context, call, done: done);
    ref.invalidate(friendsProvider);
    ref.invalidate(inboxProvider);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final api = ref.read(apiClientProvider);
    final online = list.friends.where((f) => f.online).length;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (list.incoming.isNotEmpty) ...[
          _Heading('Solicitudes recibidas (${list.incoming.length})'),
          GoldPanel(
            highlight: true,
            padding: const EdgeInsets.symmetric(vertical: 4),
            child: Column(
              children: [
                for (final r in list.incoming)
                  ListTile(
                    key: ValueKey('incoming-${r.id}'),
                    onTap: () => PlayerCardSheet.show(context, r.player),
                    leading: FriendAvatar(player: r.player),
                    title: Text(r.player.displayName, overflow: TextOverflow.ellipsis),
                    subtitle: const Text('Quiere ser tu amigo'),
                    trailing: Wrap(
                      spacing: 4,
                      children: [
                        IconButton(
                          tooltip: 'Rechazar',
                          icon: const Icon(Icons.close),
                          onPressed: () => _call(context, ref, () => api.dismissFriendRequest(r.id)),
                        ),
                        FilledButton(
                          onPressed: () => _call(
                            context,
                            ref,
                            () => api.acceptFriendRequest(r.id),
                            done: '¡${r.player.displayName} y tú ya son amigos!',
                          ),
                          child: const Text('Aceptar'),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 16),
        ],
        _Heading(list.friends.isEmpty ? 'Tus amigos' : 'Tus amigos (${list.friends.length}) · $online conectados'),
        if (list.friends.isEmpty)
          const GoldPanel(
            child: Text(
              'Aún no tienes amigos. Búscalos arriba por su nombre de usuario o toca su avatar en una '
              'mesa. Con amigos puedes invitarlos a tu mesa cuando haya asientos libres.',
              style: TextStyle(color: PokerColors.muted),
            ),
          )
        else
          GoldPanel(
            padding: const EdgeInsets.symmetric(vertical: 4),
            child: Column(
              children: [
                for (final f in list.friends)
                  ListTile(
                    key: ValueKey('friend-${f.player.id}'),
                    onTap: () => PlayerCardSheet.show(context, f.player),
                    leading: FriendAvatar(player: f.player, online: f.online),
                    title: Text(f.player.displayName, overflow: TextOverflow.ellipsis),
                    subtitle: Text(
                      friendStatus(f),
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(color: f.table != null ? PokerColors.positive : PokerColors.muted),
                    ),
                    trailing: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        if (f.table != null)
                          OutlinedButton(
                            onPressed: () => context.go('/rooms/${f.table!.roomId}'),
                            child: Text(f.table!.freeSeats > 0 ? 'Ir a su mesa' : 'Mirar'),
                          ),
                        PopupMenuButton<String>(
                          tooltip: 'Más',
                          onSelected: (_) async {
                            final ok = await showDialog<bool>(
                              context: context,
                              builder: (dialogContext) => AlertDialog(
                                title: Text('¿Eliminar a ${f.player.displayName}?'),
                                content: const Text('Dejarán de ser amigos. Podrás volver a enviarle una solicitud.'),
                                actions: [
                                  TextButton(
                                    onPressed: () => Navigator.pop(dialogContext, false),
                                    child: const Text('Cancelar'),
                                  ),
                                  FilledButton(
                                    onPressed: () => Navigator.pop(dialogContext, true),
                                    child: const Text('Eliminar'),
                                  ),
                                ],
                              ),
                            );
                            if (ok == true && context.mounted) {
                              await _call(context, ref, () => api.removeFriend(f.player.id));
                            }
                          },
                          itemBuilder: (_) => const [PopupMenuItem(value: 'remove', child: Text('Eliminar amigo'))],
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          ),
        if (list.outgoing.isNotEmpty) ...[
          const SizedBox(height: 16),
          _Heading('Solicitudes enviadas (${list.outgoing.length})'),
          GoldPanel(
            padding: const EdgeInsets.symmetric(vertical: 4),
            child: Column(
              children: [
                for (final r in list.outgoing)
                  ListTile(
                    leading: FriendAvatar(player: r.player),
                    title: Text(r.player.displayName, overflow: TextOverflow.ellipsis),
                    subtitle: const Text('Esperando respuesta'),
                    trailing: TextButton(
                      onPressed: () => _call(context, ref, () => api.dismissFriendRequest(r.id)),
                      child: const Text('Cancelar'),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ],
    );
  }
}

class _Heading extends StatelessWidget {
  const _Heading(this.text);
  final String text;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 8, left: 4),
    child: Text(
      text,
      style: const TextStyle(fontWeight: FontWeight.w800, color: PokerColors.gold),
    ),
  );
}
