import 'package:flutter_test/flutter_test.dart';
import 'package:poker_latino/core/auth/pkce.dart';

void main() {
  test('challenge S256 coincide con el ejemplo del RFC 7636 (apéndice B)', () {
    expect(
      Pkce.challengeFor('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'),
      'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    );
  });

  test('verifier aleatorio, url-safe y con longitud válida (43-128)', () {
    final a = Pkce.generate();
    final b = Pkce.generate();
    expect(a.verifier, isNot(b.verifier));
    expect(a.verifier, matches(RegExp(r'^[A-Za-z0-9\-_]{43,128}$')));
    expect(a.challenge, Pkce.challengeFor(a.verifier));
  });
}
