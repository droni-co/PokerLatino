import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_exception.dart';
import '../../core/brand.dart';
import '../../core/config.dart';
import '../../core/game_assets.dart';
import '../../core/providers.dart';
import '../../core/theme.dart';

/// Edad mínima para registrarse (el servidor también lo comprueba)
const _minimumAge = 18;

const _months = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

class LoginPage extends ConsumerStatefulWidget {
  const LoginPage({super.key});

  @override
  ConsumerState<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends ConsumerState<LoginPage> {
  /// Con un código de invitación en la URL se abre directamente "Crear cuenta"
  late bool _registering = AppConfig.referralCodeFromUrl != null;

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authControllerProvider);
    final controller = ref.read(authControllerProvider.notifier);
    final hasStoredSession = ref.read(authServiceProvider).isSignedIn;

    final text = Theme.of(context).textTheme;
    final shortScreen = MediaQuery.sizeOf(context).height < 640;

    final Widget content;
    if (hasStoredSession && auth.hasError) {
      // Hay sesión guardada pero no se pudo comprobar (sin red): reintentar sin perderla
      content = Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text(
            'No se pudo conectar con el servidor.',
            textAlign: TextAlign.center,
            style: TextStyle(color: PokerColors.red),
          ),
          const SizedBox(height: 16),
          GoldButton(onPressed: () => ref.invalidate(authControllerProvider), child: const Text('Reintentar')),
        ],
      );
    } else {
      content = Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _ModeSwitch(registering: _registering, onChanged: (v) => setState(() => _registering = v)),
          const SizedBox(height: 18),
          if (controller.sessionReplaced && !_registering) ...[
            const _Notice(
              'Tu sesión se cerró porque iniciaste sesión en otro dispositivo. '
              'Solo puedes jugar desde un dispositivo a la vez.',
            ),
            const SizedBox(height: 14),
          ],
          AnimatedSize(
            duration: const Duration(milliseconds: 200),
            alignment: Alignment.topCenter,
            child: _registering ? const _RegisterForm() : const _LoginForm(),
          ),
        ],
      );
    }

    return Scaffold(
      body: Backdrop(
        image: GameAssets.loginHero,
        dim: 0.35,
        child: DecoratedBox(
          // Viñeta: oscurece el centro para que el panel se lea sobre el arte
          decoration: BoxDecoration(
            gradient: RadialGradient(
              radius: 0.9,
              colors: [PokerColors.background.withValues(alpha: 0.75), Colors.transparent],
            ),
          ),
          child: SafeArea(
            child: Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(24),
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 400),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      LogoMark(height: shortScreen || _registering ? 120 : 200),
                      const SizedBox(height: 12),
                      Text(
                        'Texas Hold\'em entre jugadores.\nEmpieza con 1,000 fichas de regalo.',
                        textAlign: TextAlign.center,
                        style: text.titleSmall?.copyWith(
                          color: Colors.white.withValues(alpha: 0.85),
                          height: 1.4,
                          shadows: const [Shadow(color: Colors.black, blurRadius: 8)],
                        ),
                      ),
                      const SizedBox(height: 24),
                      GoldPanel(highlight: true, padding: const EdgeInsets.fromLTRB(20, 18, 20, 20), child: content),
                      const SizedBox(height: 20),
                      const _Suits(),
                    ],
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

/// Entrar / Crear cuenta
class _ModeSwitch extends StatelessWidget {
  const _ModeSwitch({required this.registering, required this.onChanged});
  final bool registering;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    Widget tab(String label, bool value) {
      final selected = registering == value;
      return Expanded(
        child: InkWell(
          key: ValueKey('auth-tab-$label'),
          borderRadius: BorderRadius.circular(10),
          onTap: () => onChanged(value),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 150),
            padding: const EdgeInsets.symmetric(vertical: 10),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(10),
              color: selected ? PokerColors.gold.withValues(alpha: 0.18) : Colors.transparent,
              border: Border.all(color: selected ? PokerColors.gold : PokerColors.border),
            ),
            child: Text(
              label,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontWeight: FontWeight.w800,
                letterSpacing: 0.6,
                color: selected ? PokerColors.gold : PokerColors.muted,
              ),
            ),
          ),
        ),
      );
    }

    return Row(children: [tab('ENTRAR', false), const SizedBox(width: 10), tab('CREAR CUENTA', true)]);
  }
}

class _Notice extends StatelessWidget {
  const _Notice(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(10),
        color: PokerColors.gold.withValues(alpha: 0.1),
        border: Border.all(color: PokerColors.gold.withValues(alpha: 0.5)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.devices_other, size: 18, color: PokerColors.gold),
          const SizedBox(width: 10),
          Expanded(child: Text(text, style: const TextStyle(fontSize: 13, height: 1.35))),
        ],
      ),
    );
  }
}

/// Mensaje general y errores por campo a partir de la respuesta del servidor
class _ServerErrors {
  _ServerErrors(Object error) : field = error is ApiException ? error.field : null, message = error.toString();
  final String? field;
  final String message;

  String? forField(String name) => field == name ? message : null;
  String? get general => field == null ? message : null;
}

class _LoginForm extends ConsumerStatefulWidget {
  const _LoginForm();

  @override
  ConsumerState<_LoginForm> createState() => _LoginFormState();
}

class _LoginFormState extends ConsumerState<_LoginForm> {
  final _form = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _busy = false;
  _ServerErrors? _errors;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_busy || !_form.currentState!.validate()) return;
    setState(() {
      _busy = true;
      _errors = null;
    });
    try {
      await ref.read(authControllerProvider.notifier).login(email: _email.text.trim(), password: _password.text);
    } catch (error) {
      if (mounted) setState(() => _errors = _ServerErrors(error));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Form(
      key: _form,
      child: AutofillGroup(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            TextFormField(
              key: const ValueKey('login-email'),
              controller: _email,
              keyboardType: TextInputType.emailAddress,
              autofillHints: const [AutofillHints.email],
              textInputAction: TextInputAction.next,
              decoration: InputDecoration(labelText: 'Email', errorText: _errors?.forField('email')),
              validator: (v) => (v ?? '').trim().contains('@') ? null : 'Escribe tu email',
            ),
            const SizedBox(height: 12),
            _PasswordField(
              key: const ValueKey('login-password'),
              controller: _password,
              label: 'Contraseña',
              autofillHints: const [AutofillHints.password],
              errorText: _errors?.forField('password'),
              onSubmitted: (_) => _submit(),
              validator: (v) => (v ?? '').isEmpty ? 'Escribe tu contraseña' : null,
            ),
            if (_errors?.general != null) ...[
              const SizedBox(height: 12),
              Text(
                _errors!.general!,
                textAlign: TextAlign.center,
                style: const TextStyle(color: PokerColors.red),
              ),
            ],
            const SizedBox(height: 18),
            GoldButton(
              key: const ValueKey('login-submit'),
              onPressed: _busy ? null : _submit,
              child: _busy ? const _Spinner() : const Text('ENTRAR'),
            ),
          ],
        ),
      ),
    );
  }
}

class _RegisterForm extends ConsumerStatefulWidget {
  const _RegisterForm();

  @override
  ConsumerState<_RegisterForm> createState() => _RegisterFormState();
}

class _RegisterFormState extends ConsumerState<_RegisterForm> {
  final _form = GlobalKey<FormState>();
  final _username = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _confirmation = TextEditingController();
  final _referral = TextEditingController(text: AppConfig.referralCodeFromUrl ?? '');
  int? _day;
  int? _month;
  int? _year;
  bool _busy = false;
  _ServerErrors? _errors;

  @override
  void dispose() {
    for (final c in [_username, _email, _password, _confirmation, _referral]) {
      c.dispose();
    }
    super.dispose();
  }

  DateTime? get _birthDate {
    if (_day == null || _month == null || _year == null) return null;
    final date = DateTime(_year!, _month!, _day!);
    // 31 de febrero, etc.
    return date.month == _month ? date : null;
  }

  String? _birthDateError() {
    final date = _birthDate;
    if (date == null) return 'Indica tu fecha de nacimiento';
    final now = DateTime.now();
    final adult = DateTime(now.year - _minimumAge, now.month, now.day);
    if (date.isAfter(adult)) return 'Debes ser mayor de edad para registrarte';
    return null;
  }

  Future<void> _submit() async {
    if (_busy || !_form.currentState!.validate()) return;
    setState(() {
      _busy = true;
      _errors = null;
    });
    try {
      await ref
          .read(authControllerProvider.notifier)
          .register(
            username: _username.text.trim(),
            email: _email.text.trim(),
            password: _password.text,
            passwordConfirmation: _confirmation.text,
            birthDate: _birthDate!,
            referralCode: _referral.text,
          );
    } catch (error) {
      if (mounted) setState(() => _errors = _ServerErrors(error));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final years = [for (var y = now.year - _minimumAge; y >= now.year - 100; y--) y];

    return Form(
      key: _form,
      child: AutofillGroup(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            TextFormField(
              key: const ValueKey('register-username'),
              controller: _username,
              autofillHints: const [AutofillHints.newUsername],
              textInputAction: TextInputAction.next,
              maxLength: 20,
              decoration: InputDecoration(
                labelText: 'Nombre de usuario',
                helperText: 'Es el nombre que verán los demás en la mesa',
                counterText: '',
                errorText: _errors?.forField('username'),
              ),
              validator: (v) {
                final value = (v ?? '').trim();
                if (value.length < 3) return 'Mínimo 3 caracteres';
                if (!RegExp(r'^[\p{L}\p{N}._-]+$', unicode: true).hasMatch(value)) {
                  return 'Solo letras, números, punto, guion o guion bajo';
                }
                return null;
              },
            ),
            const SizedBox(height: 12),
            TextFormField(
              key: const ValueKey('register-email'),
              controller: _email,
              keyboardType: TextInputType.emailAddress,
              autofillHints: const [AutofillHints.email],
              textInputAction: TextInputAction.next,
              decoration: InputDecoration(labelText: 'Email', errorText: _errors?.forField('email')),
              validator: (v) => (v ?? '').trim().contains('@') ? null : 'Escribe un email válido',
            ),
            const SizedBox(height: 12),
            _PasswordField(
              key: const ValueKey('register-password'),
              controller: _password,
              label: 'Contraseña',
              autofillHints: const [AutofillHints.newPassword],
              errorText: _errors?.forField('password'),
              validator: (v) => (v ?? '').length < 8 ? 'Mínimo 8 caracteres' : null,
            ),
            const SizedBox(height: 12),
            _PasswordField(
              key: const ValueKey('register-confirmation'),
              controller: _confirmation,
              label: 'Repite la contraseña',
              autofillHints: const [AutofillHints.newPassword],
              errorText: _errors?.forField('password_confirmation'),
              validator: (v) => v == _password.text ? null : 'Las contraseñas no coinciden',
            ),
            const SizedBox(height: 14),
            Text(
              'Fecha de nacimiento',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(color: PokerColors.muted),
            ),
            const SizedBox(height: 6),
            FormField<void>(
              validator: (_) => _birthDateError(),
              builder: (field) => Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    children: [
                      Expanded(
                        flex: 3,
                        child: _Picker<int>(
                          hint: 'Día',
                          value: _day,
                          items: [for (var d = 1; d <= 31; d++) (d, '$d')],
                          onChanged: (v) => setState(() => _day = v),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        flex: 5,
                        child: _Picker<int>(
                          hint: 'Mes',
                          value: _month,
                          items: [for (var m = 1; m <= 12; m++) (m, _months[m - 1])],
                          onChanged: (v) => setState(() => _month = v),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        flex: 4,
                        child: _Picker<int>(
                          hint: 'Año',
                          value: _year,
                          items: [for (final y in years) (y, '$y')],
                          onChanged: (v) => setState(() => _year = v),
                        ),
                      ),
                    ],
                  ),
                  if (field.errorText != null || _errors?.forField('birth_date') != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 6, left: 12),
                      child: Text(
                        field.errorText ?? _errors!.forField('birth_date')!,
                        style: TextStyle(color: Theme.of(context).colorScheme.error, fontSize: 12),
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            TextFormField(
              key: const ValueKey('register-referral'),
              controller: _referral,
              textCapitalization: TextCapitalization.characters,
              decoration: InputDecoration(
                labelText: 'Código de invitación (opcional)',
                errorText: _errors?.forField('referral_code'),
              ),
            ),
            if (_errors?.general != null) ...[
              const SizedBox(height: 12),
              Text(
                _errors!.general!,
                textAlign: TextAlign.center,
                style: const TextStyle(color: PokerColors.red),
              ),
            ],
            const SizedBox(height: 18),
            GoldButton(
              key: const ValueKey('register-submit'),
              onPressed: _busy ? null : _submit,
              child: _busy ? const _Spinner() : const Text('CREAR CUENTA'),
            ),
            const SizedBox(height: 10),
            Text(
              'Debes ser mayor de $_minimumAge años. Las fichas son solo para jugar: '
              'no se compran ni se cambian por dinero.',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(color: PokerColors.muted),
            ),
          ],
        ),
      ),
    );
  }
}

class _Picker<T> extends StatelessWidget {
  const _Picker({required this.hint, required this.value, required this.items, required this.onChanged});
  final String hint;
  final T? value;
  final List<(T, String)> items;
  final ValueChanged<T?> onChanged;

  @override
  Widget build(BuildContext context) {
    return DropdownButtonFormField<T>(
      initialValue: value,
      isExpanded: true,
      hint: Text(hint, overflow: TextOverflow.ellipsis),
      decoration: const InputDecoration(contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 12)),
      items: [
        for (final (v, label) in items)
          DropdownMenuItem(
            value: v,
            child: Text(label, overflow: TextOverflow.ellipsis),
          ),
      ],
      onChanged: onChanged,
    );
  }
}

class _PasswordField extends StatefulWidget {
  const _PasswordField({
    super.key,
    required this.controller,
    required this.label,
    this.autofillHints,
    this.errorText,
    this.validator,
    this.onSubmitted,
  });
  final TextEditingController controller;
  final String label;
  final Iterable<String>? autofillHints;
  final String? errorText;
  final FormFieldValidator<String>? validator;
  final ValueChanged<String>? onSubmitted;

  @override
  State<_PasswordField> createState() => _PasswordFieldState();
}

class _PasswordFieldState extends State<_PasswordField> {
  bool _hidden = true;

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      controller: widget.controller,
      obscureText: _hidden,
      autofillHints: widget.autofillHints,
      onFieldSubmitted: widget.onSubmitted,
      textInputAction: widget.onSubmitted != null ? TextInputAction.done : TextInputAction.next,
      validator: widget.validator,
      decoration: InputDecoration(
        labelText: widget.label,
        errorText: widget.errorText,
        suffixIcon: IconButton(
          tooltip: _hidden ? 'Mostrar' : 'Ocultar',
          icon: Icon(_hidden ? Icons.visibility_outlined : Icons.visibility_off_outlined),
          onPressed: () => setState(() => _hidden = !_hidden),
        ),
      ),
    );
  }
}

class _Spinner extends StatelessWidget {
  const _Spinner();

  @override
  Widget build(BuildContext context) => const SizedBox.square(
    dimension: 22,
    child: CircularProgressIndicator(strokeWidth: 2.5, color: Color(0xFF2A1B04)),
  );
}

class _Suits extends StatelessWidget {
  const _Suits();

  @override
  Widget build(BuildContext context) {
    TextStyle style(Color c) => TextStyle(fontSize: 18, letterSpacing: 14, color: c.withValues(alpha: 0.7));
    return Text.rich(
      TextSpan(
        children: [
          TextSpan(text: '♠', style: style(Colors.white)),
          TextSpan(text: '♥', style: style(PokerColors.red)),
          TextSpan(text: '♦', style: style(PokerColors.red)),
          TextSpan(text: '♣', style: style(Colors.white)),
        ],
      ),
      textAlign: TextAlign.center,
    );
  }
}
