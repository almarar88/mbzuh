import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'notification_service.dart';

class Alarm {
  Alarm({
    required this.id,
    required this.hour,
    required this.minute,
    this.label = '',
    Set<int>? weekdays,
    this.enabled = true,
  }) : weekdays = weekdays ?? <int>{};

  final int id;
  int hour;
  int minute;
  String label;
  Set<int> weekdays; // DateTime.monday..sunday, empty = once
  bool enabled;

  TimeOfDay get time => TimeOfDay(hour: hour, minute: minute);

  /// Next time this alarm will ring, or null if disabled.
  DateTime? nextRing([DateTime? from]) {
    if (!enabled) return null;
    final now = from ?? DateTime.now();
    var t = DateTime(now.year, now.month, now.day, hour, minute);
    if (!t.isAfter(now)) t = t.add(const Duration(days: 1));
    if (weekdays.isEmpty) return t;
    for (var i = 0; i < 7; i++) {
      if (weekdays.contains(t.weekday)) return t;
      t = t.add(const Duration(days: 1));
    }
    return t;
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'hour': hour,
        'minute': minute,
        'label': label,
        'weekdays': weekdays.toList(),
        'enabled': enabled,
      };

  factory Alarm.fromJson(Map<String, dynamic> j) => Alarm(
        id: j['id'] as int,
        hour: j['hour'] as int,
        minute: j['minute'] as int,
        label: (j['label'] as String?) ?? '',
        weekdays: ((j['weekdays'] as List?) ?? const []).map((e) => e as int).toSet(),
        enabled: (j['enabled'] as bool?) ?? true,
      );
}

/// Persists alarms and keeps the OS schedule in sync.
class AlarmStore extends ChangeNotifier {
  AlarmStore(this._prefs) {
    _load();
  }

  final SharedPreferences _prefs;
  static const _key = 'alarms_v1';
  List<Alarm> _alarms = [];

  List<Alarm> get alarms => List.unmodifiable(_alarms);

  void _load() {
    final raw = _prefs.getString(_key);
    if (raw == null) return;
    try {
      final list = jsonDecode(raw) as List;
      _alarms = list.map((e) => Alarm.fromJson(e as Map<String, dynamic>)).toList();
      _sort();
    } catch (_) {
      _alarms = [];
    }
  }

  void _sort() => _alarms.sort((a, b) => (a.hour * 60 + a.minute).compareTo(b.hour * 60 + b.minute));

  Future<void> _persist() async {
    await _prefs.setString(_key, jsonEncode(_alarms.map((a) => a.toJson()).toList()));
  }

  int _nextId() {
    var id = 1;
    final used = _alarms.map((a) => a.id).toSet();
    while (used.contains(id)) {
      id++;
    }
    return id;
  }

  Alarm newAlarm(TimeOfDay t) => Alarm(id: _nextId(), hour: t.hour, minute: t.minute);

  Future<void> upsert(Alarm alarm, {required bool ar, required String defaultTitle}) async {
    final idx = _alarms.indexWhere((a) => a.id == alarm.id);
    if (idx >= 0) {
      _alarms[idx] = alarm;
    } else {
      _alarms.add(alarm);
    }
    _sort();
    notifyListeners();
    await _persist();
    await _sync(alarm, ar: ar, defaultTitle: defaultTitle);
  }

  Future<void> setEnabled(Alarm alarm, bool enabled, {required bool ar, required String defaultTitle}) async {
    alarm.enabled = enabled;
    notifyListeners();
    await _persist();
    await _sync(alarm, ar: ar, defaultTitle: defaultTitle);
  }

  Future<void> remove(Alarm alarm) async {
    _alarms.removeWhere((a) => a.id == alarm.id);
    notifyListeners();
    await _persist();
    await NotificationService.instance.cancelAlarm(alarm.id);
  }

  /// Re-registers every enabled alarm with the OS (e.g. after app update).
  Future<void> resyncAll({required bool ar, required String defaultTitle}) async {
    for (final a in _alarms) {
      await _sync(a, ar: ar, defaultTitle: defaultTitle);
    }
  }

  Future<void> _sync(Alarm a, {required bool ar, required String defaultTitle}) async {
    final n = NotificationService.instance;
    if (!a.enabled) {
      await n.cancelAlarm(a.id);
      return;
    }
    final label = a.label.trim().isEmpty ? defaultTitle : a.label.trim();
    final h = a.hour % 12 == 0 ? 12 : a.hour % 12;
    final suffix = a.hour < 12 ? (ar ? 'ص' : 'AM') : (ar ? 'م' : 'PM');
    final timeText = '$h:${a.minute.toString().padLeft(2, '0')} $suffix';
    await n.scheduleAlarm(
      alarmId: a.id,
      hour: a.hour,
      minute: a.minute,
      weekdays: a.weekdays,
      title: label,
      body: ar ? 'حان الوقت: $timeText' : "It's $timeText",
      ar: ar,
    );
  }
}
