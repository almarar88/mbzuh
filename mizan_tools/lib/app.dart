import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:provider/provider.dart';

import 'core/theme/app_theme.dart';
import 'core/tools_registry.dart';
import 'features/shell/main_shell.dart';
import 'services/notification_service.dart';
import 'services/settings_service.dart';

class MizanApp extends StatefulWidget {
  const MizanApp({super.key});

  @override
  State<MizanApp> createState() => _MizanAppState();
}

class _MizanAppState extends State<MizanApp> {
  final _navKey = GlobalKey<NavigatorState>();

  @override
  void initState() {
    super.initState();
    NotificationService.instance.lastPayload.addListener(_onNotificationTap);
  }

  @override
  void dispose() {
    NotificationService.instance.lastPayload.removeListener(_onNotificationTap);
    super.dispose();
  }

  void _onNotificationTap() {
    final payload = NotificationService.instance.lastPayload.value;
    if (payload == null) return;
    NotificationService.instance.lastPayload.value = null;
    final nav = _navKey.currentState;
    if (nav == null) return;
    final toolId = payload.startsWith('alarm') ? 'alarm' : 'timer';
    final tool = ToolsRegistry.byId(toolId);
    if (tool != null) {
      nav.push(MaterialPageRoute<void>(builder: (_) => tool.builder()));
    }
  }

  @override
  Widget build(BuildContext context) {
    final settings = context.watch<SettingsService>();
    return MaterialApp(
      title: 'ميزان',
      navigatorKey: _navKey,
      debugShowCheckedModeBanner: false,
      locale: settings.locale,
      supportedLocales: const [Locale('ar', 'AE'), Locale('en', 'US')],
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      theme: AppTheme.light(),
      darkTheme: AppTheme.dark(),
      themeMode: settings.themeMode,
      home: const MainShell(),
    );
  }
}
