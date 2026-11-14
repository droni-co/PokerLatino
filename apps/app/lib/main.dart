import 'package:flutter/material.dart';

import 'features/home/home_page.dart';

void main() {
  runApp(const PokerLatinoApp());
}

class PokerLatinoApp extends StatelessWidget {
  const PokerLatinoApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Poker Latino',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF0B6E4F), // verde mesa de poker
          brightness: Brightness.dark,
        ),
        useMaterial3: true,
      ),
      home: const HomePage(),
    );
  }
}
