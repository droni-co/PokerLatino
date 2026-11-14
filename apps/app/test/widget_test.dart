import 'package:flutter_test/flutter_test.dart';
import 'package:poker_latino/main.dart';

void main() {
  testWidgets('muestra la pantalla de inicio', (tester) async {
    await tester.pumpWidget(const PokerLatinoApp());
    expect(find.text('Poker Latino'), findsOneWidget);
    expect(find.text('Probar conexión con la API'), findsOneWidget);
  });
}
