import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../core/models/table_state.dart';
import '../../../core/money.dart';
import '../../../core/sounds.dart';
import '../../../core/theme.dart';
import '../table_logic.dart';
import 'playing_card.dart';

typedef OnAction = Future<void> Function(String action, {int? amount});

/// Al terminar la mano: mis cartas y si ya las enseñé
typedef ShowCardsOption = ({List<String> cards, bool shown});

/// Botón de acción con la estética del juego: laca oscura con borde y brillo del color
/// de la acción, o dorado macizo para la acción principal ([gold]).
class ActionButton extends StatefulWidget {
  const ActionButton({
    super.key,
    required this.label,
    required this.color,
    required this.onPressed,
    this.dark = false,
    this.subtitle,
    this.icon,
    this.height = 54,
  });

  final String label;
  final String? subtitle;
  final Color color;
  final IconData? icon;
  final VoidCallback? onPressed;
  final double height;

  /// Botón dorado macizo (texto oscuro), como el resto de los botones principales del juego
  final bool dark;

  bool get gold => dark;

  @override
  State<ActionButton> createState() => _ActionButtonState();
}

class _ActionButtonState extends State<ActionButton> {
  bool _hover = false;
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final accent = widget.color;
    final enabled = widget.onPressed != null;
    final lift = enabled && _hover && !_pressed;
    final radius = BorderRadius.circular(14);
    final fg = widget.gold ? const Color(0xFF2A1B04) : Colors.white;

    final decoration = widget.gold
        ? BoxDecoration(
            borderRadius: radius,
            gradient: const LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [Color(0xFFFFE08A), PokerColors.gold, PokerColors.goldDark],
              stops: [0, 0.45, 1],
            ),
            border: Border.all(color: const Color(0xFFFFF1C2)),
            boxShadow: [
              if (enabled)
                BoxShadow(
                  color: PokerColors.gold.withValues(alpha: lift ? 0.55 : 0.32),
                  blurRadius: lift ? 20 : 14,
                ),
              const BoxShadow(color: Colors.black54, blurRadius: 6, offset: Offset(0, 3)),
            ],
          )
        : BoxDecoration(
            borderRadius: radius,
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [
                Color.lerp(const Color(0xFF1E2840), accent, enabled ? (lift ? 0.3 : 0.18) : 0.04)!,
                const Color(0xFF0E1320),
              ],
            ),
            border: Border.all(
              color: enabled ? Color.lerp(accent, Colors.white, 0.15)!.withValues(alpha: 0.9) : PokerColors.border,
              width: 1.4,
            ),
            boxShadow: [
              if (enabled)
                BoxShadow(
                  color: accent.withValues(alpha: lift ? 0.5 : 0.28),
                  blurRadius: lift ? 18 : 10,
                ),
              const BoxShadow(color: Colors.black54, blurRadius: 6, offset: Offset(0, 3)),
            ],
          );

    final iconColor = widget.gold ? fg : (enabled ? Color.lerp(accent, Colors.white, 0.35)! : PokerColors.muted);

    return AnimatedOpacity(
      duration: const Duration(milliseconds: 180),
      opacity: enabled ? 1 : 0.42,
      child: AnimatedScale(
        duration: const Duration(milliseconds: 110),
        curve: Curves.easeOut,
        scale: _pressed ? 0.96 : (lift ? 1.02 : 1),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          decoration: decoration,
          child: Material(
            type: MaterialType.transparency,
            child: InkWell(
              borderRadius: radius,
              onTap: widget.onPressed == null
                  ? null
                  : () {
                      Sounds.play(Sfx.click);
                      widget.onPressed!();
                    },
              onHover: (v) => setState(() => _hover = v),
              onHighlightChanged: (v) => setState(() => _pressed = v),
              splashColor: (widget.gold ? Colors.white : accent).withValues(alpha: 0.2),
              child: SizedBox(
                height: widget.height,
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  child: FittedBox(
                    fit: BoxFit.scaleDown,
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        if (widget.icon != null) ...[
                          Icon(widget.icon, size: 18, color: iconColor),
                          const SizedBox(width: 6),
                        ],
                        Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              widget.label.toUpperCase(),
                              style: TextStyle(
                                color: fg,
                                fontWeight: FontWeight.w800,
                                fontSize: 14,
                                letterSpacing: 0.8,
                              ),
                            ),
                            if (widget.subtitle != null)
                              Text(
                                widget.subtitle!,
                                style: TextStyle(
                                  color: widget.gold ? fg.withValues(alpha: 0.85) : PokerColors.gold,
                                  fontSize: 12,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Panel de los controles del jugador, con el marco dorado del resto del juego
class ControlPanel extends StatelessWidget {
  const ControlPanel({super.key, required this.child, this.flat = false});
  final Widget child;

  /// Sin marco ni fondo propio: va dentro de un panel lateral que ya los tiene
  final bool flat;

  @override
  Widget build(BuildContext context) => flat
      ? Padding(padding: const EdgeInsets.fromLTRB(10, 8, 10, 10), child: child)
      : Container(
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [Color(0xF21A2338), Color(0xF70C111D)],
            ),
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: PokerColors.gold.withValues(alpha: 0.45)),
            boxShadow: const [BoxShadow(color: Colors.black54, blurRadius: 18, offset: Offset(0, 6))],
          ),
          padding: const EdgeInsets.fromLTRB(10, 8, 10, 10),
          child: child,
        );
}

/// Controles del jugador sentado. Siempre muestra los mismos botones (se activan y
/// desactivan según el momento) para que nada salte de lugar:
///
/// - fila de decisiones anticipadas (mientras juegan los demás),
/// - fila de acciones (en tu turno), con el selector de apuesta que se despliega encima.
class TableControls extends StatefulWidget {
  const TableControls({
    super.key,
    required this.mySeat,
    required this.hand,
    required this.legal,
    required this.status,
    required this.preAction,
    required this.onPreAction,
    required this.onAction,
    this.countdownTo,
    this.showCards,
    this.onShowCards,
    this.vertical = false,
  });

  final TableSeat mySeat;
  final HandInfo? hand;

  /// null = no es tu turno
  final LegalActions? legal;

  /// Texto de estado ("Tu turno", "Esperando la próxima mano"...)
  final String status;
  final PreAction? preAction;
  final ValueChanged<PreAction?> onPreAction;
  final OnAction onAction;

  /// Si hay pausa entre manos: la línea de estado añade los segundos que faltan
  final DateTime? countdownTo;

  /// Entre manos, si puedo enseñar mis cartas (o ya lo hice): sustituye a las decisiones anticipadas
  final ShowCardsOption? showCards;
  final Future<void> Function()? onShowCards;

  /// Columna estrecha (teléfono en horizontal): botones y decisiones uno debajo de otro
  final bool vertical;

  @override
  State<TableControls> createState() => _TableControlsState();
}

class _TableControlsState extends State<TableControls> {
  bool _busy = false;
  bool _sizing = false;
  double? _amount;

  HandInfo? get _hand => widget.hand;
  LegalActions? get _legal => widget.hand == null ? null : widget.legal;
  bool get _myTurn => _legal != null;

  /// Puede decidir por adelantado: está en la mano, sigue vivo y no es su turno
  bool get _canPreAct {
    final seat = widget.mySeat;
    return _hand != null && !_myTurn && seat.inHand && !seat.folded && !seat.allIn;
  }

  int get _toCall => _hand == null ? 0 : math.max(0, _hand!.currentBet - widget.mySeat.committed);

  BetOptions? get _options => _legal == null
      ? null
      : BetOptions.from(_legal!, pot: _hand!.pot, currentBet: _hand!.currentBet, committed: widget.mySeat.committed);

  String? _decision(TableControls w) =>
      w.hand == null || w.legal == null ? null : '${w.hand!.id}-${w.hand!.street}-${w.hand!.currentBet}';

  @override
  void didUpdateWidget(TableControls old) {
    super.didUpdateWidget(old);
    // Otra decisión (o ya no es tu turno): cerrar el selector de apuesta
    if (_decision(old) != _decision(widget)) {
      _sizing = false;
      _amount = null;
    }
  }

  Future<void> _run(String action, {int? amount}) async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      await widget.onAction(action, amount: amount);
      if (mounted) setState(() => _sizing = false);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final legal = _legal;
    final options = _options;
    final active = legal != null && !_busy;
    final stack = widget.mySeat.stack;
    final call = legal?.call;
    final callIsAllIn = call != null && call >= stack;

    final vertical = widget.vertical;
    final buttonHeight = vertical ? 42.0 : 54.0;
    final fold = ActionButton(
      label: 'Retirarse',
      height: buttonHeight,
      icon: Icons.close_rounded,
      color: PokerColors.actionFold,
      onPressed: active && legal.fold ? () => _run('fold') : null,
    );
    // En tu turno manda lo legal; fuera de él, lo que habría que igualar ahora
    final facingBet = legal != null ? (!legal.check && call != null) : _toCall > 0;
    final toCall = legal != null ? (call ?? 0) : _toCall;
    final checkOrCall = facingBet
        ? ActionButton(
            label: callIsAllIn ? 'All-in' : 'Igualar',
            subtitle: formatChips(toCall),
            height: buttonHeight,
            icon: Icons.drag_handle_rounded,
            color: callIsAllIn ? PokerColors.actionAllIn : PokerColors.actionCall,
            onPressed: active ? () => _run('call') : null,
          )
        : ActionButton(
            label: 'Pasar',
            height: buttonHeight,
            icon: Icons.check_rounded,
            color: PokerColors.actionCall,
            onPressed: active && legal.check ? () => _run('check') : null,
          );
    final raise = ActionButton(
      label: options == null
          ? (_toCall > 0 ? 'Subir' : 'Apostar')
          : options.isBet
          ? 'Apostar'
          : 'Subir',
      icon: Icons.arrow_upward_rounded,
      height: buttonHeight,
      color: PokerColors.actionRaise,
      dark: true,
      onPressed: active && options != null
          ? () => setState(() {
              _sizing = !_sizing;
              _amount ??= options.min.toDouble();
            })
          : null,
    );

    return ControlPanel(
      flat: vertical,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _StatusLine(text: widget.status, myTurn: _myTurn, countdownTo: widget.countdownTo),
          const SizedBox(height: 8),
          AnimatedSize(
            duration: const Duration(milliseconds: 200),
            curve: Curves.easeOut,
            alignment: Alignment.bottomCenter,
            child: _sizing && options != null ? _sizer(options) : const SizedBox(width: double.infinity),
          ),
          if (vertical)
            Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [raise, const SizedBox(height: 6), checkOrCall, const SizedBox(height: 6), fold],
            )
          else
            Row(
              children: [
                Expanded(child: fold),
                const SizedBox(width: 8),
                Expanded(child: checkOrCall),
                const SizedBox(width: 8),
                Expanded(child: raise),
              ],
            ),
          const SizedBox(height: 8),
          AnimatedSwitcher(
            duration: const Duration(milliseconds: 220),
            child: widget.showCards != null && _hand == null
                ? _ShowCardsRow(
                    key: const ValueKey('show-cards'),
                    option: widget.showCards!,
                    onPressed: widget.onShowCards,
                  )
                : _PreActions(
                    vertical: vertical,
                    enabled: _canPreAct,
                    toCall: _toCall,
                    selected: _canPreAct ? widget.preAction : null,
                    onChanged: widget.onPreAction,
                  ),
          ),
        ],
      ),
    );
  }

  Widget _sizer(BetOptions options) {
    final value = (_amount ?? options.min.toDouble()).clamp(options.min.toDouble(), options.max.toDouble());
    final amount = value.round();
    final isAllIn = amount >= options.max;

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Column(
        children: [
          Row(
            children: [
              for (final (i, p) in options.presets.indexed) ...[
                if (i > 0) const SizedBox(width: 6),
                Expanded(
                  child: _Pill(
                    label: p.label,
                    selected: amount == p.amount,
                    onTap: () => setState(() => _amount = p.amount.toDouble()),
                  ),
                ),
              ],
            ],
          ),
          if (options.max > options.min)
            SliderTheme(
              data: SliderTheme.of(context).copyWith(
                activeTrackColor: PokerColors.gold,
                thumbColor: PokerColors.gold,
                inactiveTrackColor: Colors.white12,
                overlayColor: PokerColors.gold.withValues(alpha: 0.15),
              ),
              child: Slider(
                value: value,
                min: options.min.toDouble(),
                max: options.max.toDouble(),
                onChanged: (v) => setState(() => _amount = v),
              ),
            ),
          SizedBox(
            width: double.infinity,
            child: ActionButton(
              label: isAllIn ? 'All-in' : (options.isBet ? 'Apostar' : 'Subir a'),
              subtitle: formatChips(amount),
              color: isAllIn ? PokerColors.actionAllIn : PokerColors.actionRaise,
              dark: !isAllIn,
              height: 50,
              onPressed: _busy ? null : () => isAllIn ? _run('all_in') : _run(options.action, amount: amount),
            ),
          ),
        ],
      ),
    );
  }
}

class _StatusLine extends StatefulWidget {
  const _StatusLine({required this.text, required this.myTurn, this.countdownTo});
  final String text;
  final bool myTurn;
  final DateTime? countdownTo;

  @override
  State<_StatusLine> createState() => _StatusLineState();
}

class _StatusLineState extends State<_StatusLine> {
  Timer? _tick;

  @override
  void initState() {
    super.initState();
    _sync();
  }

  @override
  void didUpdateWidget(_StatusLine old) {
    super.didUpdateWidget(old);
    if (old.countdownTo != widget.countdownTo) _sync();
  }

  void _sync() {
    _tick?.cancel();
    _tick = widget.countdownTo == null
        ? null
        : Timer.periodic(const Duration(milliseconds: 500), (_) => setState(() {}));
  }

  @override
  void dispose() {
    _tick?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final myTurn = widget.myTurn;
    final to = widget.countdownTo;
    final seconds = to == null ? null : math.max(0, (to.difference(DateTime.now()).inMilliseconds / 1000).ceil());
    return Row(
      children: [
        AnimatedContainer(
          duration: const Duration(milliseconds: 250),
          width: 8,
          height: 8,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: myTurn ? PokerColors.gold : PokerColors.muted.withValues(alpha: 0.5),
            boxShadow: myTurn ? [BoxShadow(color: PokerColors.gold.withValues(alpha: 0.8), blurRadius: 8)] : null,
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            widget.text,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              color: myTurn ? PokerColors.gold : PokerColors.muted,
              fontWeight: myTurn ? FontWeight.w800 : FontWeight.w600,
              fontSize: 12.5,
              letterSpacing: myTurn ? 0.6 : 0,
            ),
          ),
        ),
        if (seconds != null)
          Container(
            key: const ValueKey('next-hand-countdown'),
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: PokerColors.gold.withValues(alpha: 0.6)),
              color: Colors.black.withValues(alpha: 0.3),
            ),
            child: Text(
              '$seconds s',
              style: const TextStyle(
                color: PokerColors.gold,
                fontWeight: FontWeight.w800,
                fontSize: 12,
                fontFeatures: [FontFeature.tabularFigures()],
              ),
            ),
          ),
      ],
    );
  }
}

/// Entre manos: mis dos cartas y el botón para enseñarlas a la mesa
class _ShowCardsRow extends StatefulWidget {
  const _ShowCardsRow({super.key, required this.option, required this.onPressed});
  final ShowCardsOption option;
  final Future<void> Function()? onPressed;

  @override
  State<_ShowCardsRow> createState() => _ShowCardsRowState();
}

class _ShowCardsRowState extends State<_ShowCardsRow> {
  bool _busy = false;

  Future<void> _show() async {
    setState(() => _busy = true);
    try {
      await widget.onPressed!();
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final shown = widget.option.shown;
    final enabled = !shown && !_busy && widget.onPressed != null;
    return SizedBox(
      height: 38,
      child: Row(
        children: [
          for (final (i, card) in widget.option.cards.indexed)
            Padding(
              padding: EdgeInsets.only(left: i == 0 ? 2 : 3),
              child: PlayingCard(card: card, width: 25),
            ),
          const SizedBox(width: 8),
          Expanded(
            child: Material(
              color: Colors.transparent,
              child: InkWell(
                key: const ValueKey('show-cards-button'),
                onTap: enabled ? _show : null,
                borderRadius: BorderRadius.circular(10),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 160),
                  alignment: Alignment.center,
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  decoration: BoxDecoration(
                    color: shown ? Colors.black.withValues(alpha: 0.25) : PokerColors.gold.withValues(alpha: 0.16),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: shown ? PokerColors.border : PokerColors.gold),
                  ),
                  child: FittedBox(
                    fit: BoxFit.scaleDown,
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          shown ? Icons.check_rounded : Icons.visibility_rounded,
                          size: 17,
                          color: shown ? PokerColors.muted : PokerColors.gold,
                        ),
                        const SizedBox(width: 6),
                        Text(
                          shown ? 'Enseñaste tus cartas' : 'Enseñar mis cartas',
                          style: TextStyle(
                            color: shown ? PokerColors.muted : Colors.white,
                            fontWeight: FontWeight.w800,
                            fontSize: 12.5,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Decisiones anticipadas: siempre las tres, activas solo mientras esperas tu turno
class _PreActions extends StatelessWidget {
  const _PreActions({
    required this.enabled,
    required this.toCall,
    required this.selected,
    required this.onChanged,
    this.vertical = false,
  });

  final bool vertical;
  final bool enabled;
  final int toCall;
  final PreAction? selected;
  final ValueChanged<PreAction?> onChanged;

  @override
  Widget build(BuildContext context) {
    Widget tile(PreAction action, String label, {required bool applies, String? amount}) {
      final on = enabled && applies;
      final tile = _PreActionTile(
        key: ValueKey('pre-${action.name}'),
        label: label,
        amount: amount,
        height: vertical ? 32 : 38,
        selected: on && selected == action,
        onTap: on ? () => onChanged(selected == action ? null : action) : null,
      );
      return vertical ? tile : Expanded(child: tile);
    }

    if (vertical) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          tile(PreAction.checkFold, 'Pasar/Retirarse', applies: true),
          const SizedBox(height: 4),
          tile(PreAction.check, 'Pasar', applies: toCall == 0),
          const SizedBox(height: 4),
          tile(PreAction.call, 'Igualar', applies: toCall > 0, amount: toCall > 0 ? formatChips(toCall) : null),
        ],
      );
    }

    return Row(
      children: [
        tile(PreAction.checkFold, 'Pasar/Retirarse', applies: true),
        const SizedBox(width: 6),
        tile(PreAction.check, 'Pasar', applies: toCall == 0),
        const SizedBox(width: 6),
        tile(PreAction.call, 'Igualar', applies: toCall > 0, amount: toCall > 0 ? formatChips(toCall) : null),
      ],
    );
  }
}

class _PreActionTile extends StatelessWidget {
  const _PreActionTile({
    super.key,
    required this.label,
    required this.selected,
    required this.onTap,
    this.amount,
    this.height = 38,
  });
  final String label;
  final double height;
  final String? amount;
  final bool selected;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final enabled = onTap != null;
    return Semantics(
      checked: selected,
      button: true,
      enabled: enabled,
      child: AnimatedOpacity(
        duration: const Duration(milliseconds: 180),
        opacity: enabled ? 1 : 0.4,
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: onTap,
            borderRadius: BorderRadius.circular(10),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 160),
              height: height,
              padding: const EdgeInsets.symmetric(horizontal: 6),
              decoration: BoxDecoration(
                color: selected ? PokerColors.gold.withValues(alpha: 0.16) : Colors.black.withValues(alpha: 0.25),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: selected ? PokerColors.gold : PokerColors.border),
              ),
              child: FittedBox(
                fit: BoxFit.scaleDown,
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      selected ? Icons.check_box_rounded : Icons.check_box_outline_blank_rounded,
                      size: 17,
                      color: selected ? PokerColors.gold : PokerColors.muted,
                    ),
                    const SizedBox(width: 5),
                    Text(
                      amount == null ? label : '$label $amount',
                      style: TextStyle(
                        color: selected ? Colors.white : PokerColors.muted,
                        fontWeight: FontWeight.w700,
                        fontSize: 12.5,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _Pill extends StatelessWidget {
  const _Pill({required this.label, required this.selected, required this.onTap});
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Material(
    color: Colors.transparent,
    child: InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        height: 32,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: selected ? PokerColors.gold : Colors.black.withValues(alpha: 0.3),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: selected ? const Color(0xFFFFF1C2) : PokerColors.gold.withValues(alpha: 0.45)),
        ),
        child: FittedBox(
          fit: BoxFit.scaleDown,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 6),
            child: Text(
              label,
              style: TextStyle(
                color: selected ? const Color(0xFF2A1B04) : Colors.white,
                fontWeight: FontWeight.w700,
                fontSize: 12.5,
              ),
            ),
          ),
        ),
      ),
    ),
  );
}
