import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/models/table_state.dart';
import '../../core/providers.dart';

/// Mensaje recibido y cuándo llegó (para mostrarlo unos segundos sobre el jugador)
class ChatEntry {
  const ChatEntry(this.message, {required this.receivedAt, required this.live});
  final ChatMessage message;
  final DateTime receivedAt;

  /// false = historial cargado al entrar a la mesa (no aparece como burbuja)
  final bool live;
}

/// Tiempo que un mensaje se ve sobre el avatar de quien lo escribió
const chatBubbleDuration = Duration(seconds: 6);

/// Mensajes que se conservan en memoria por mesa
const _maxEntries = 150;

/// Historial del chat de una mesa. Lo alimenta el sondeo del estado de la mesa
/// (`TableController`) con los mensajes nuevos y los envíos propios.
final tableChatProvider = NotifierProvider.autoDispose.family<TableChat, List<ChatEntry>, int>(TableChat.new);

class TableChat extends Notifier<List<ChatEntry>> {
  TableChat(this.roomId);
  final int roomId;

  @override
  List<ChatEntry> build() => const [];

  /// Id del último mensaje conocido (para pedir solo los nuevos)
  int? get lastId => state.isEmpty ? null : state.last.message.id;

  /// Agrega mensajes sin duplicar. [live] = recién llegados (se muestran como burbuja).
  void merge(List<ChatMessage> messages, {bool live = true, DateTime? now}) {
    if (messages.isEmpty) return;
    final known = {for (final e in state) e.message.id};
    final at = now ?? DateTime.now();
    final fresh = [
      for (final m in messages)
        if (!known.contains(m.id)) ChatEntry(m, receivedAt: at, live: live),
    ];
    if (fresh.isEmpty) return;
    final all = [...state, ...fresh]..sort((a, b) => a.message.id.compareTo(b.message.id));
    state = all.length > _maxEntries ? all.sublist(all.length - _maxEntries) : all;
  }

  Future<void> send(String body) async {
    final message = await ref.read(apiClientProvider).sendChat(roomId, body);
    merge([message]);
  }

  /// Último mensaje "en vivo" de cada jugador que aún debe verse como burbuja
  Map<int, ChatMessage> bubbles(DateTime now) => {
    for (final e in state)
      if (e.live && now.difference(e.receivedAt) < chatBubbleDuration) e.message.playerId: e.message,
  };
}
