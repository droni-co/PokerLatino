import 'package:flutter/material.dart';

import '../../core/api_client.dart';

class HomePage extends StatefulWidget {
  const HomePage({super.key, this.api});

  final ApiClient? api;

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  late final ApiClient _api = widget.api ?? ApiClient();
  String _status = 'Sin verificar';

  Future<void> _checkApi() async {
    setState(() => _status = 'Conectando...');
    try {
      final data = await _api.health();
      setState(() => _status = 'API: ${data['status']} · DB: ${data['database']}');
    } catch (e) {
      setState(() => _status = 'Error: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Poker Latino')),
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('♠ ♥ ♦ ♣', style: TextStyle(fontSize: 48)),
            const SizedBox(height: 16),
            Text(_status),
            const SizedBox(height: 16),
            FilledButton(
              onPressed: _checkApi,
              child: const Text('Probar conexión con la API'),
            ),
          ],
        ),
      ),
    );
  }
}
