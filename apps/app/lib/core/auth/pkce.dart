import 'dart:convert';
import 'dart:math';

import 'package:crypto/crypto.dart';

/// PKCE (RFC 7636): el verifier queda en la app, el challenge viaja en /authorize.
class Pkce {
  Pkce._(this.verifier, this.challenge);

  final String verifier;
  final String challenge;

  factory Pkce.generate() {
    final verifier = randomUrlSafe(32);
    return Pkce._(verifier, challengeFor(verifier));
  }

  /// BASE64URL(SHA256(verifier)) sin padding
  static String challengeFor(String verifier) =>
      _base64UrlNoPadding(sha256.convert(ascii.encode(verifier)).bytes);
}

/// Cadena aleatoria criptográficamente segura (para verifier y state)
String randomUrlSafe(int bytes) {
  final random = Random.secure();
  return _base64UrlNoPadding(List<int>.generate(bytes, (_) => random.nextInt(256)));
}

String _base64UrlNoPadding(List<int> bytes) => base64Url.encode(bytes).replaceAll('=', '');
