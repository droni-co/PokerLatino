import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/brand.dart';
import '../../../core/theme.dart';
import '../table_chat.dart';
import 'player_avatar.dart';

/// Frases rápidas para escribir menos desde el teléfono
const quickPhrases = ['¡Buena mano!', 'Suerte 🍀', 'Bien jugado 👏', 'Uff 😅', '¡Vamos!', 'GG'];

/// Panel lateral con el historial del chat de la mesa y el campo para escribir
class ChatPanel extends ConsumerStatefulWidget {
  const ChatPanel({super.key, required this.roomId, required this.myPlayerId, this.seatedPlayerIds = const {}});

  final int roomId;
  final int myPlayerId;

  /// Para marcar a los espectadores (quienes no están sentados)
  final Set<int> seatedPlayerIds;

  @override
  ConsumerState<ChatPanel> createState() => _ChatPanelState();
}

class _ChatPanelState extends ConsumerState<ChatPanel> {
  final _text = TextEditingController();
  final _focus = FocusNode();
  bool _sending = false;
  String? _error;

  @override
  void dispose() {
    _text.dispose();
    _focus.dispose();
    super.dispose();
  }

  Future<void> _send([String? preset]) async {
    final body = (preset ?? _text.text).trim();
    if (body.isEmpty || _sending) return;
    setState(() {
      _sending = true;
      _error = null;
    });
    try {
      await ref.read(tableChatProvider(widget.roomId).notifier).send(body);
      if (preset == null) _text.clear();
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final entries = ref.watch(tableChatProvider(widget.roomId));
    final time = DateFormat('HH:mm');

    return Drawer(
      width: 340,
      backgroundColor: const Color(0xF20C111D),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.horizontal(left: Radius.circular(18)),
        side: BorderSide(color: Color(0x73F2C14E)),
      ),
      child: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 4, 4),
              child: Row(
                children: [
                  const Expanded(child: SectionTitle('Chat de la mesa')),
                  IconButton(tooltip: 'Cerrar', icon: const Icon(Icons.close), onPressed: () => Navigator.pop(context)),
                ],
              ),
            ),
            Expanded(
              child: entries.isEmpty
                  ? const Center(
                      child: Padding(
                        padding: EdgeInsets.all(24),
                        child: Text(
                          'Aún no hay mensajes. ¡Saluda a la mesa!',
                          textAlign: TextAlign.center,
                          style: TextStyle(color: PokerColors.muted),
                        ),
                      ),
                    )
                  : ListView.builder(
                      reverse: true,
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      itemCount: entries.length,
                      itemBuilder: (_, i) {
                        final m = entries[entries.length - 1 - i].message;
                        final mine = m.playerId == widget.myPlayerId;
                        final spectator = !widget.seatedPlayerIds.contains(m.playerId);
                        return _MessageTile(
                          key: ValueKey('chat-${m.id}'),
                          playerId: m.playerId,
                          avatar: m.avatar,
                          name: mine ? 'Tú' : m.displayName,
                          tag: spectator ? 'mirando' : null,
                          time: time.format(m.createdAt),
                          body: m.body,
                          mine: mine,
                        );
                      },
                    ),
            ),
            SizedBox(
              height: 40,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 12),
                itemCount: quickPhrases.length,
                separatorBuilder: (_, _) => const SizedBox(width: 6),
                itemBuilder: (_, i) => ActionChip(
                  label: Text(quickPhrases[i], style: const TextStyle(fontSize: 12.5)),
                  onPressed: _sending ? null : () => _send(quickPhrases[i]),
                  backgroundColor: Colors.black.withValues(alpha: 0.3),
                  side: BorderSide(color: PokerColors.gold.withValues(alpha: 0.45)),
                  visualDensity: VisualDensity.compact,
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 6, 8, 12),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: TextField(
                      controller: _text,
                      focusNode: _focus,
                      maxLength: 200,
                      minLines: 1,
                      maxLines: 3,
                      textInputAction: TextInputAction.send,
                      onSubmitted: (_) {
                        _send();
                        _focus.requestFocus();
                      },
                      decoration: InputDecoration(
                        hintText: 'Escribe un mensaje…',
                        counterText: '',
                        errorText: _error,
                        isDense: true,
                      ),
                    ),
                  ),
                  const SizedBox(width: 6),
                  IconButton.filled(
                    tooltip: 'Enviar',
                    onPressed: _sending ? null : _send,
                    style: IconButton.styleFrom(
                      backgroundColor: PokerColors.gold,
                      foregroundColor: const Color(0xFF2A1B04),
                    ),
                    icon: const Icon(Icons.send_rounded),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _MessageTile extends StatelessWidget {
  const _MessageTile({
    super.key,
    required this.playerId,
    required this.avatar,
    required this.name,
    required this.time,
    required this.body,
    required this.mine,
    this.tag,
  });

  final int playerId;
  final String? avatar;
  final String name;
  final String? tag;
  final String time;
  final String body;
  final bool mine;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          PlayerAvatar(playerId: playerId, avatar: avatar, size: 34, isMe: mine),
          const SizedBox(width: 8),
          Expanded(
            child: Container(
              padding: const EdgeInsets.fromLTRB(10, 6, 10, 8),
              decoration: BoxDecoration(
                color: mine ? PokerColors.gold.withValues(alpha: 0.12) : Colors.white.withValues(alpha: 0.05),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: mine ? PokerColors.gold.withValues(alpha: 0.5) : PokerColors.border),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Flexible(
                        child: Text(
                          name,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            color: mine ? PokerColors.gold : Colors.white,
                            fontWeight: FontWeight.w800,
                            fontSize: 12.5,
                          ),
                        ),
                      ),
                      if (tag != null) ...[
                        const SizedBox(width: 6),
                        Text(
                          tag!,
                          style: const TextStyle(color: PokerColors.muted, fontSize: 11, fontStyle: FontStyle.italic),
                        ),
                      ],
                      const Spacer(),
                      Text(time, style: const TextStyle(color: PokerColors.muted, fontSize: 11)),
                    ],
                  ),
                  const SizedBox(height: 2),
                  Text(body, style: const TextStyle(fontSize: 13.5, height: 1.3)),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
