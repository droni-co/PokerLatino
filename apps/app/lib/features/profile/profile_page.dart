import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_exception.dart';
import '../../core/brand.dart';
import '../../core/game_assets.dart';
import '../../core/models/models.dart';
import '../../core/providers.dart';
import '../../core/theme.dart';
import '../table/widgets/player_avatar.dart';

/// Mismas reglas que el servidor: 3 a 20 letras (con acentos), números, punto, guion o guion bajo
final usernamePattern = RegExp(r'^[\p{L}\p{N}._-]{3,20}$', unicode: true);

/// Perfil del jugador: nombre de usuario y avatar
class ProfilePage extends ConsumerWidget {
  const ProfilePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final me = ref.watch(authControllerProvider).value;
    if (me == null) return const Center(child: CircularProgressIndicator());
    // La clave reinicia el formulario si cambia la cuenta
    return _ProfileForm(key: ValueKey(me.id), me: me);
  }
}

class _ProfileForm extends ConsumerStatefulWidget {
  const _ProfileForm({super.key, required this.me});
  final Me me;

  @override
  ConsumerState<_ProfileForm> createState() => _ProfileFormState();
}

class _ProfileFormState extends ConsumerState<_ProfileForm> {
  late final _name = TextEditingController(text: widget.me.username ?? '');

  /// Avatar seleccionado: id, o '' para el genérico al azar
  late String _avatar = widget.me.avatar ?? '';
  String? _nameError;
  bool _saving = false;

  Me get _me => ref.read(authControllerProvider).value ?? widget.me;

  String get _typedName => _name.text.trim();
  bool get _nameChanged => _typedName != (_me.username ?? '');
  bool get _avatarChanged => _avatar != (_me.avatar ?? '');
  bool get _dirty => _nameChanged || _avatarChanged;

  @override
  void initState() {
    super.initState();
    // Borra el error solo cuando cambia el texto (no al cambiar foco o selección)
    var lastText = _name.text;
    _name.addListener(() {
      if (_name.text == lastText) return;
      lastText = _name.text;
      // Reconstruye para la vista previa y el botón Guardar
      setState(() => _nameError = null);
    });
  }

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  String? _validateName() {
    if (!_nameChanged) return null;
    final name = _typedName;
    if (name.length < 3) return 'Debe tener al menos 3 caracteres';
    if (name.length > 20) return 'Debe tener como máximo 20 caracteres';
    if (!usernamePattern.hasMatch(name)) {
      return 'Usa solo letras, números, punto, guion o guion bajo (sin espacios)';
    }
    return null;
  }

  Future<void> _save() async {
    final error = _validateName();
    if (error != null) {
      setState(() => _nameError = error);
      return;
    }
    setState(() => _saving = true);
    final messenger = ScaffoldMessenger.of(context);
    try {
      await ref
          .read(authControllerProvider.notifier)
          .updateProfile(username: _nameChanged ? _typedName : null, avatar: _avatarChanged ? _avatar : null);
      messenger.showSnackBar(const SnackBar(content: Text('Perfil actualizado')));
    } on ApiException catch (e) {
      if (e.field == 'username') {
        setState(() => _nameError = e.message);
      } else {
        messenger.showSnackBar(SnackBar(content: Text(e.message)));
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final me = ref.watch(authControllerProvider).value ?? widget.me;
    final assets = GameAssets.instance;
    final previewName = _typedName.isNotEmpty ? _typedName : me.displayName;

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
      children: [
        Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 640),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Vista previa: así te ven en las mesas
                GoldPanel(
                  highlight: true,
                  child: Row(
                    children: [
                      PlayerAvatar(playerId: me.id, avatar: _avatar.isEmpty ? null : _avatar, size: 96, isMe: true),
                      const SizedBox(width: 16),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              previewName,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: Theme.of(
                                context,
                              ).textTheme.headlineSmall?.copyWith(color: PokerColors.gold, fontWeight: FontWeight.w800),
                            ),
                            const SizedBox(height: 4),
                            Text(me.email, style: const TextStyle(color: PokerColors.muted, fontSize: 13)),
                            const SizedBox(height: 6),
                            const Text(
                              'Así te verán en las mesas.',
                              style: TextStyle(color: Colors.white70, fontSize: 13),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                if (me.username == null) ...[
                  const SizedBox(height: 12),
                  const _Notice(
                    text:
                        'Aún no tienes nombre de usuario: en las mesas apareces como '
                        '"Jugador #número". Elige uno abajo.',
                  ),
                ],
                const SizedBox(height: 24),
                const SectionTitle('Nombre de usuario'),
                const SizedBox(height: 12),
                TextField(
                  controller: _name,
                  maxLength: 20,
                  textInputAction: TextInputAction.done,
                  autocorrect: false,
                  enableSuggestions: false,
                  onSubmitted: (_) => _dirty && !_saving ? _save() : null,
                  decoration: InputDecoration(
                    prefixIcon: const Icon(Icons.person_outline),
                    hintText: 'Tu nombre en las mesas',
                    helperText: '3 a 20 caracteres: letras, números, punto, guion o guion bajo.',
                    errorText: _nameError,
                    errorMaxLines: 2,
                  helperMaxLines: 2,
                  ),
                ),
                const SizedBox(height: 20),
                const SectionTitle('Avatar'),
                const SizedBox(height: 12),
                _AvatarGrid(
                  children: [
                    _AvatarOption(
                      key: const ValueKey('avatar-random'),
                      playerId: me.id,
                      avatar: null,
                      label: 'Al azar',
                      selected: _avatar.isEmpty,
                      onTap: () => setState(() => _avatar = ''),
                    ),
                    for (final path in assets.avatars)
                      _AvatarOption(
                        key: ValueKey('avatar-${GameAssets.avatarId(path)}'),
                        playerId: me.id,
                        avatar: GameAssets.avatarId(path),
                        selected: _avatar == GameAssets.avatarId(path),
                        onTap: () => setState(() => _avatar = GameAssets.avatarId(path)),
                      ),
                  ],
                ),
                if (assets.characterAvatars.isNotEmpty) ...[
                  const SizedBox(height: 20),
                  const SectionTitle('Personajes'),
                  const SizedBox(height: 12),
                  _AvatarGrid(
                    children: [
                      for (final path in assets.characterAvatars)
                        _AvatarOption(
                          key: ValueKey('avatar-${GameAssets.avatarId(path)}'),
                          playerId: me.id,
                          avatar: GameAssets.avatarId(path),
                          selected: _avatar == GameAssets.avatarId(path),
                          onTap: () => setState(() => _avatar = GameAssets.avatarId(path)),
                        ),
                    ],
                  ),
                ],
                const SizedBox(height: 28),
                GoldButton(
                  onPressed: _dirty && !_saving ? _save : null,
                  child: _saving
                      ? const SizedBox.square(
                          dimension: 22,
                          child: CircularProgressIndicator(strokeWidth: 2.5, color: Color(0xFF2A1B04)),
                        )
                      : const Text('GUARDAR CAMBIOS'),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _AvatarGrid extends StatelessWidget {
  const _AvatarGrid({required this.children});
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return GridView.extent(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      maxCrossAxisExtent: 92,
      mainAxisSpacing: 12,
      crossAxisSpacing: 12,
      children: children,
    );
  }
}

class _AvatarOption extends StatelessWidget {
  const _AvatarOption({
    super.key,
    required this.playerId,
    required this.avatar,
    required this.selected,
    required this.onTap,
    this.label,
  });

  final int playerId;
  final String? avatar;
  final bool selected;
  final VoidCallback onTap;

  /// Texto sobre el avatar (opción "Al azar")
  final String? label;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      selected: selected,
      label: label ?? avatar,
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: onTap,
        child: LayoutBuilder(
          builder: (context, constraints) {
            final size = constraints.biggest.shortestSide;
            return Stack(
              alignment: Alignment.center,
              children: [
                AnimatedContainer(
                  duration: const Duration(milliseconds: 150),
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    boxShadow: selected
                        ? [BoxShadow(color: PokerColors.gold.withValues(alpha: 0.6), blurRadius: 14, spreadRadius: 1)]
                        : null,
                  ),
                  child: Opacity(
                    opacity: selected || label != null ? 1 : 0.85,
                    child: PlayerAvatar(playerId: playerId, avatar: avatar, size: size * 0.92, isMe: selected),
                  ),
                ),
                if (label != null)
                  Positioned(
                    bottom: 0,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(
                        color: Colors.black.withValues(alpha: 0.75),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: PokerColors.gold.withValues(alpha: 0.6)),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.casino, size: 12, color: PokerColors.gold),
                          const SizedBox(width: 4),
                          Text(label!, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700)),
                        ],
                      ),
                    ),
                  ),
                if (selected)
                  Positioned(
                    top: 0,
                    right: 0,
                    child: Container(
                      padding: const EdgeInsets.all(2),
                      decoration: const BoxDecoration(color: PokerColors.gold, shape: BoxShape.circle),
                      child: const Icon(Icons.check, size: 14, color: Color(0xFF2A1B04)),
                    ),
                  ),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _Notice extends StatelessWidget {
  const _Notice({required this.text});
  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: PokerColors.gold.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: PokerColors.gold.withValues(alpha: 0.5)),
      ),
      child: Row(
        children: [
          const Icon(Icons.info_outline, color: PokerColors.gold, size: 20),
          const SizedBox(width: 10),
          Expanded(child: Text(text, style: const TextStyle(fontSize: 13))),
        ],
      ),
    );
  }
}
