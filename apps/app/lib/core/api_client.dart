import 'dart:convert';

import 'package:http/http.dart' as http;

import 'config.dart';

class ApiClient {
  ApiClient({http.Client? client, String? baseUrl})
      : _client = client ?? http.Client(),
        _baseUrl = baseUrl ?? AppConfig.apiUrl;

  final http.Client _client;
  final String _baseUrl;

  Future<Map<String, dynamic>> health() async {
    final res = await _client.get(Uri.parse('$_baseUrl/health'));
    return jsonDecode(res.body) as Map<String, dynamic>;
  }
}
