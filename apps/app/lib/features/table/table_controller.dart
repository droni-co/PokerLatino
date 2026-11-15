import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/config.dart';
import '../../core/models/table_state.dart';
import '../../core/api/api_client.dart';
import '../../core/providers.dart';
import 'table_chat.dart';

/// Estado de una mesa. Hasta tener tiempo real (WebSockets) se consulta
/// periódicamente; las acciones del jugador actualizan el estado al instante.
final tableControllerProvider = AsyncNotifierProvider.autoDispose.family<TableController, TableState, int>(
  TableController.new,
);

class TableController extends AsyncNotifier<TableState> {
  TableController(this.roomId);

  final int roomId;
  Timer? _timer;
  bool _polling = false;

  @override
  Future<TableState> build() async {
    final api = ref.watch(apiClientProvider);
    _timer?.cancel();
    _timer = Timer.periodic(AppConfig.tablePollInterval, (_) => refreshSilently());
    ref.onDispose(() => _timer?.cancel());
    final chat = ref.read(tableChatProvider(roomId).notifier);
    final initial = await api.tableState(roomId, chatAfter: chat.lastId);
    // Lo que había al entrar es historial: no se muestra como burbuja
    chat.merge(initial.chat, live: chat.lastId != null);
    return initial;
  }

  TableChat get _chat => ref.read(tableChatProvider(roomId).notifier);

  void _accept(TableState next) {
    _chat.merge(next.chat);
    state = AsyncData(next);
  }

  /// Actualiza sin mostrar "cargando" y sin borrar el último estado si falla la red
  Future<void> refreshSilently() async {
    if (_polling) return;
    _polling = true;
    try {
      final next = await ref.read(apiClientProvider).tableState(roomId, chatAfter: _chat.lastId);
      if (ref.mounted) _accept(next);
    } catch (_) {
      // Se reintenta en el siguiente ciclo
    } finally {
      _polling = false;
    }
  }

  Future<void> act(String action, {int? amount}) async {
    final next = await ref.read(apiClientProvider).act(roomId, action, amount: amount, chatAfter: _chat.lastId);
    if (ref.mounted) _accept(next);
  }

  Future<void> showCards() async {
    final next = await ref.read(apiClientProvider).showCards(roomId, chatAfter: _chat.lastId);
    if (ref.mounted) _accept(next);
  }

  Future<void> sit({required int buyIn, int? seatNumber}) async {
    await ref.read(apiClientProvider).sit(roomId, buyIn: buyIn, seatNumber: seatNumber);
    ref.invalidate(walletProvider);
    await refreshSilently();
  }

  Future<LeaveResult> leave() async {
    final result = await ref.read(apiClientProvider).leave(roomId);
    if (!result.pending) ref.invalidate(walletProvider);
    await refreshSilently();
    return result;
  }
}
