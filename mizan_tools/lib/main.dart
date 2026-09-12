import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'app.dart';
import 'services/alarm_store.dart';
import 'services/currency_service.dart';
import 'services/notification_service.dart';
import 'services/settings_service.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
  await initializeDateFormatting('ar');
  await initializeDateFormatting('en');

  final prefs = await SharedPreferences.getInstance();
  final settings = SettingsService(prefs);
  final alarms = AlarmStore(prefs);

  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider.value(value: settings),
        ChangeNotifierProvider.value(value: alarms),
        ChangeNotifierProvider(create: (_) => CurrencyService(prefs)),
      ],
      child: const MizanApp(),
    ),
  );

  // Notifications are wired after the first frame so a plugin problem can
  // never keep the app on the splash screen.
  unawaited(_initNotifications(settings, alarms));
}

Future<void> _initNotifications(SettingsService settings, AlarmStore alarms) async {
  try {
    await NotificationService.instance.init().timeout(const Duration(seconds: 10));
    // Make sure the OS schedule matches the saved alarms (after updates/reboots).
    await alarms.resyncAll(ar: settings.isArabic, defaultTitle: settings.isArabic ? 'المنبه' : 'Alarm');
  } catch (e, st) {
    debugPrint('Notification setup failed: $e');
    debugPrintStack(stackTrace: st, maxFrames: 10);
  }
}
