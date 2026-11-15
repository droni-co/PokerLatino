import 'package:flutter_test/flutter_test.dart';
import 'package:poker_latino/core/money.dart';

void main() {
  test('los montos se muestran en fichas', () {
    expect(formatFichas(1250), '1,250 fichas');
    expect(formatFichas(1), '1 ficha');
    expect(formatFichas(0), '0 fichas');
    expect(formatChips(1250), '1,250');
    expect(formatChips(5), '5');
  });
}
