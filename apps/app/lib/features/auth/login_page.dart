import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_exception.dart';
import '../../core/brand.dart';
import '../../core/game_assets.dart';
import '../../core/providers.dart';
import '../../core/theme.dart';

class LoginPage extends ConsumerWidget {
  const LoginPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authControllerProvider);
    final controller = ref.read(authControllerProvider.notifier);
    final hasStoredSession = ref.read(authServiceProvider).isSignedIn;

    final error = auth.error;
    final String? errorMessage = switch (error) {
      null => null,
      AuthException(code: 'cancelled') => null,
      _ when hasStoredSession => 'No se pudo conectar con el servidor.',
      _ => error.toString(),
    };

    final text = Theme.of(context).textTheme;
    final shortScreen = MediaQuery.sizeOf(context).height < 640;

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
                      LogoMark(height: shortScreen ? 150 : 230),
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
                      GoldPanel(
                        highlight: true,
                        padding: const EdgeInsets.fromLTRB(20, 22, 20, 18),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            if (errorMessage != null) ...[
                              Text(
                                errorMessage,
                                textAlign: TextAlign.center,
                                style: const TextStyle(color: PokerColors.red),
                              ),
                              const SizedBox(height: 16),
                            ],
                            if (hasStoredSession && error != null)
                              GoldButton(
                                onPressed: () => ref.invalidate(authControllerProvider),
                                child: const Text('Reintentar'),
                              )
                            else ...[
                              GoldButton(
                                onPressed: auth.isLoading
                                    ? null
                                    : () => controller.login(forceLogin: controller.shouldForceLogin),
                                child: auth.isLoading
                                    ? const SizedBox.square(
                                        dimension: 22,
                                        child: CircularProgressIndicator(strokeWidth: 2.5, color: Color(0xFF2A1B04)),
                                      )
                                    : const Text('ENTRAR O CREAR CUENTA'),
                              ),
                              const SizedBox(height: 14),
                              Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  const Icon(Icons.lock_outline, size: 14, color: PokerColors.muted),
                                  const SizedBox(width: 6),
                                  Flexible(
                                    child: Text(
                                      'Se abrirá una ventana segura de Poker Latino para iniciar sesión o registrarte.',
                                      textAlign: TextAlign.center,
                                      style: text.bodySmall?.copyWith(color: PokerColors.muted),
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ],
                        ),
                      ),
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
