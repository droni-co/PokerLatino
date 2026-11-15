import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api_exception.dart';
import '../../core/brand.dart';
import '../../core/models/tournament.dart';
import '../../core/money.dart';
import '../../core/providers.dart';
import '../../core/theme.dart';

String _two(int n) => n.toString().padLeft(2, '0');

/// "Hoy 21:00", "Mañana 21:00" o "24/11 21:00"
String formatTournamentStart(DateTime at, {DateTime? now}) {
  final today = now ?? DateTime.now();
  final day = DateTime(at.year, at.month, at.day);
  final diff = day.difference(DateTime(today.year, today.month, today.day)).inDays;
  final time = '${_two(at.hour)}:${_two(at.minute)}';
  return switch (diff) {
    0 => 'Hoy $time',
    1 => 'Mañana $time',
    -1 => 'Ayer $time',
    _ => '${_two(at.day)}/${_two(at.month)} $time',
  };
}

/// Cuándo empieza (o empezó) el torneo, en palabras
String tournamentWhen(Tournament t, {DateTime? now}) {
  final current = now ?? DateTime.now();
  return switch (t.status) {
    TournamentStatus.registering when !t.startsAt.isAfter(current) =>
      'Empieza en cuanto se complete el cupo (${t.capacity - t.entriesCount} libres)',
    TournamentStatus.registering => 'Empieza ${formatTournamentStart(t.startsAt, now: current)}',
    TournamentStatus.running => 'En juego desde ${formatTournamentStart(t.startedAt ?? t.startsAt, now: current)}',
    TournamentStatus.finished => 'Terminó ${formatTournamentStart(t.finishedAt ?? t.startsAt, now: current)}',
    TournamentStatus.cancelled => 'Cancelado',
  };
}

String positionLabel(int position) => '$positionº';

/// Etiqueta de estado (Inscripción abierta, En juego…)
class TournamentStatusChip extends StatelessWidget {
  const TournamentStatusChip({super.key, required this.status});
  final TournamentStatus status;

  @override
  Widget build(BuildContext context) {
    final (label, color) = switch (status) {
      TournamentStatus.registering => ('Inscripción abierta', PokerColors.positive),
      TournamentStatus.running => ('En juego', PokerColors.gold),
      TournamentStatus.finished => ('Terminado', PokerColors.muted),
      TournamentStatus.cancelled => ('Cancelado', PokerColors.red),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withValues(alpha: 0.7)),
      ),
      child: Text(
        label,
        style: TextStyle(color: color, fontSize: 11.5, fontWeight: FontWeight.w700),
      ),
    );
  }
}

/// Dato con etiqueta (Inscripción · 100 fichas)
class TournamentFact extends StatelessWidget {
  const TournamentFact({super.key, required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(label, style: const TextStyle(fontSize: 11, color: PokerColors.muted)),
        const SizedBox(height: 2),
        Text(value, style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700)),
      ],
    );
  }
}

/// Reglas y cifras del torneo
class TournamentFacts extends StatelessWidget {
  const TournamentFacts({super.key, required this.tournament});
  final Tournament tournament;

  @override
  Widget build(BuildContext context) {
    final t = tournament;
    final players = switch (t.status) {
      TournamentStatus.running => '${t.playersLeft} de ${t.entriesCount} siguen',
      _ => '${t.entriesCount}/${t.capacity}',
    };
    return Wrap(
      spacing: 22,
      runSpacing: 10,
      children: [
        TournamentFact(label: 'Inscripción', value: formatFichas(t.buyIn)),
        TournamentFact(label: 'Bote', value: formatFichas(t.prizePool)),
        TournamentFact(label: 'Jugadores', value: players),
        TournamentFact(label: 'Stack inicial', value: formatChips(t.startingStack)),
        TournamentFact(
          label: 'Ciegas',
          value: '${formatChips(t.smallBlind)}/${formatChips(t.bigBlind)} · ×2 cada ${t.blindsUpEveryHands} manos',
        ),
        TournamentFact(
          label: 'Mesas',
          value: '${t.tableCount} de ${t.maxSeats} ${t.maxSeats == 1 ? 'asiento' : 'asientos'}',
        ),
      ],
    );
  }
}

/// Lo que el jugador puede hacer con el torneo: inscribirse, salirse o ir a su mesa
class TournamentActions extends ConsumerStatefulWidget {
  const TournamentActions({super.key, required this.tournament, this.showDetailLink = true});
  final Tournament tournament;
  final bool showDetailLink;

  @override
  ConsumerState<TournamentActions> createState() => _TournamentActionsState();
}

class _TournamentActionsState extends ConsumerState<TournamentActions> {
  bool _busy = false;

  void _refresh() {
    ref.invalidate(tournamentsProvider);
    ref.invalidate(tournamentProvider(widget.tournament.id));
    ref.invalidate(walletProvider);
  }

  Future<void> _register() async {
    final t = widget.tournament;
    final messenger = ScaffoldMessenger.of(context);
    final ok = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text('Inscribirte en ${t.name}'),
        content: Text(
          'La inscripción cuesta ${formatFichas(t.buyIn)}. Recibirás ${formatChips(t.startingStack)} fichas de torneo.\n\n'
          'El torneo empieza ${formatTournamentStart(t.startsAt)} si el cupo está completo; si no, en cuanto se complete. '
          'Puedes salirte con reembolso mientras no empiece.',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialogContext, false), child: const Text('Cancelar')),
          FilledButton(onPressed: () => Navigator.pop(dialogContext, true), child: const Text('Inscribirme')),
        ],
      ),
    );
    if (ok != true) return;
    await _run(() async {
      final updated = await ref.read(apiClientProvider).registerTournament(t.id);
      messenger.showSnackBar(
        SnackBar(
          content: Text(
            updated.status == TournamentStatus.running
                ? '¡Completaste el cupo! El torneo empieza ahora.'
                : 'Te inscribiste en ${t.name}.',
          ),
        ),
      );
    });
  }

  Future<void> _unregister() async {
    final t = widget.tournament;
    final messenger = ScaffoldMessenger.of(context);
    await _run(() async {
      await ref.read(apiClientProvider).unregisterTournament(t.id);
      messenger.showSnackBar(
        SnackBar(content: Text('Saliste del torneo. ${formatFichas(t.buyIn)} volvieron a tu cuenta.')),
      );
    });
  }

  Future<void> _run(Future<void> Function() action) async {
    final messenger = ScaffoldMessenger.of(context);
    setState(() => _busy = true);
    try {
      await action();
      _refresh();
    } on ApiException catch (e) {
      messenger.showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = widget.tournament;
    final you = t.you;
    final buttons = <Widget>[];

    Widget gold(String label, VoidCallback? onPressed) => SizedBox(
      height: 40,
      child: GoldButton(
        height: 40,
        onPressed: _busy ? null : onPressed,
        child: Padding(padding: const EdgeInsets.symmetric(horizontal: 18), child: Text(label)),
      ),
    );

    if (t.status == TournamentStatus.registering) {
      if (you == null) {
        buttons.add(gold(t.isFull ? 'CUPO COMPLETO' : 'INSCRIBIRME', t.isFull ? null : _register));
      } else {
        buttons.add(
          const Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.check_circle, color: PokerColors.positive, size: 20),
              SizedBox(width: 6),
              Text(
                'Inscrito',
                style: TextStyle(color: PokerColors.positive, fontWeight: FontWeight.w700),
              ),
            ],
          ),
        );
        buttons.add(TextButton(onPressed: _busy ? null : _unregister, child: const Text('Salirme')));
      }
    } else if (you != null && you.isPlaying && you.roomId != null) {
      buttons.add(gold('IR A MI MESA', () => context.push('/rooms/${you.roomId}')));
    }

    if (widget.showDetailLink) {
      buttons.add(
        OutlinedButton(
          onPressed: () => context.push('/tournaments/${t.id}'),
          child: Text(t.status == TournamentStatus.registering ? 'Ver detalles' : 'Clasificación'),
        ),
      );
    }

    return Wrap(spacing: 10, runSpacing: 8, crossAxisAlignment: WrapCrossAlignment.center, children: buttons);
  }
}

/// Resultado del jugador en un torneo terminado (o del que fue eliminado)
class TournamentResultLine extends StatelessWidget {
  const TournamentResultLine({super.key, required this.you});
  final TournamentYou you;

  @override
  Widget build(BuildContext context) {
    final winner = you.status == 'winner';
    final text = [
      winner ? '¡Ganaste el torneo!' : 'Terminaste en el puesto ${positionLabel(you.position ?? 0)}',
      if (you.prize > 0) 'Premio: ${formatFichas(you.prize)}',
    ].join(' · ');
    return Row(
      children: [
        Icon(
          winner ? Icons.emoji_events : Icons.flag_outlined,
          color: you.prize > 0 ? PokerColors.gold : PokerColors.muted,
          size: 20,
        ),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            text,
            style: TextStyle(color: you.prize > 0 ? PokerColors.gold : Colors.white, fontWeight: FontWeight.w700),
          ),
        ),
      ],
    );
  }
}
