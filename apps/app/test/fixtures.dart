import 'dart:convert';
import 'dart:io';

import 'package:poker_latino/core/models/models.dart';
import 'package:poker_latino/core/models/table_state.dart';

/// Respuestas JSON reales de la API (generadas desde las pruebas del backend)
Map<String, dynamic> fixture(String name) =>
    jsonDecode(File('test/fixtures/$name.json').readAsStringSync()) as Map<String, dynamic>;

TableState stateFrom(String name) => TableState.fromJson(fixture(name)['data'] as Json);
