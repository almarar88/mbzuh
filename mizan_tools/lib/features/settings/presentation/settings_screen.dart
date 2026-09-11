import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/l10n/strings.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/utils/responsive.dart';
import '../../../services/alarm_store.dart';
import '../../../services/currency_service.dart';
import '../../../services/notification_service.dart';
import '../../../services/settings_service.dart';
import '../../../shared/widgets/custom_card.dart';
import '../../../shared/widgets/glass.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> with WidgetsBindingObserver {
  bool? _notif;
  bool? _exact;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _refreshPermissions();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) _refreshPermissions();
  }

  Future<void> _refreshPermissions() async {
    final n = NotificationService.instance;
    final a = await n.notificationsGranted();
    final b = await n.exactAlarmsGranted();
    if (!mounted) return;
    setState(() {
      _notif = a;
      _exact = b;
    });
  }

  @override
  Widget build(BuildContext context) {
    final s = S.of(context);
    final settings = context.watch<SettingsService>();
    final scheme = Theme.of(context).colorScheme;
    final ar = settings.isArabic;
    String d(String v) => Fmt.digits(v, eastern: settings.easternDigits);

    return GlassScaffold(
      appBar: GlassAppBar(title: Text(s.settingsTitle)),
      body: ContentConstraint(
        child: ListView(
          padding: EdgeInsets.fromLTRB(16, 4, 16, 32 + MediaQuery.paddingOf(context).bottom),
          children: [
            SectionHeader(s.appearance),
            CustomCard(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _Label(s.themeMode),
                  SegmentedButton<ThemeMode>(
                    segments: [
                      ButtonSegment(value: ThemeMode.system, label: Text(s.themeSystem), icon: const Icon(Icons.brightness_auto_rounded, size: 18)),
                      ButtonSegment(value: ThemeMode.light, label: Text(s.themeLight), icon: const Icon(Icons.light_mode_rounded, size: 18)),
                      ButtonSegment(value: ThemeMode.dark, label: Text(s.themeDark), icon: const Icon(Icons.dark_mode_rounded, size: 18)),
                    ],
                    selected: {settings.themeMode},
                    onSelectionChanged: (v) => settings.setThemeMode(v.first),
                  ),
                  const SizedBox(height: 14),
                  _Label(s.language),
                  SegmentedButton<String>(
                    segments: [
                      ButtonSegment(value: 'ar', label: Text(s.arabic)),
                      ButtonSegment(value: 'en', label: Text(s.english)),
                    ],
                    selected: {settings.locale.languageCode},
                    onSelectionChanged: (v) => settings.setLanguage(v.first),
                  ),
                  const SizedBox(height: 14),
                  _Label(s.digits),
                  SegmentedButton<bool>(
                    segments: [
                      ButtonSegment(value: false, label: Text(s.westernDigits)),
                      ButtonSegment(value: true, label: Text(s.easternDigits)),
                    ],
                    selected: {settings.easternDigits},
                    onSelectionChanged: (v) => settings.setEasternDigits(v.first),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 8),
            SectionHeader(s.defaults),
            CustomCard(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  DropdownButtonFormField<String>(
                    initialValue: settings.defaultCurrency,
                    isExpanded: true,
                    decoration: InputDecoration(labelText: s.defaultCurrency, prefixIcon: const Icon(Icons.payments_outlined)),
                    items: [
                      for (final c in CurrencyService.currencies)
                        DropdownMenuItem(value: c.code, child: Text('${c.flag}  ${c.code} · ${ar ? c.nameAr : c.nameEn}', overflow: TextOverflow.ellipsis)),
                    ],
                    onChanged: (v) {
                      if (v != null) settings.setDefaultCurrency(v);
                    },
                  ),
                  const SizedBox(height: 12),
                  _Label('${s.defaultVat}: ${d(Fmt.plain(settings.defaultVat))}%'),
                  Slider(
                    value: settings.defaultVat,
                    min: 0,
                    max: 25,
                    divisions: 50,
                    label: '${Fmt.plain(settings.defaultVat)}%',
                    onChanged: (v) => settings.setDefaultVat((v * 2).roundToDouble() / 2),
                  ),
                  const SizedBox(height: 6),
                  _Label(s.hijriAdjust),
                  Text(s.hijriAdjustHint, style: TextStyle(fontSize: 12, color: scheme.onSurfaceVariant)),
                  const SizedBox(height: 6),
                  SegmentedButton<int>(
                    segments: [
                      for (final v in const [-2, -1, 0, 1, 2]) ButtonSegment(value: v, label: Text(d(v > 0 ? '+$v' : '$v'))),
                    ],
                    selected: {settings.hijriAdjust},
                    onSelectionChanged: (v) => settings.setHijriAdjust(v.first),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 8),
            SectionHeader(s.notifications),
            CustomCard(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Column(
                children: [
                  ListTile(
                    leading: Icon(Icons.notifications_active_outlined, color: _notif == true ? Colors.green : scheme.error),
                    title: Text(s.notificationsPermission),
                    subtitle: Text(_notif == null ? '…' : (_notif! ? s.granted : s.notGranted)),
                    trailing: _notif == true ? null : TextButton(onPressed: () async {
                      await NotificationService.instance.requestPermissions();
                      await _refreshPermissions();
                    }, child: Text(s.grantPermission)),
                  ),
                  ListTile(
                    leading: Icon(Icons.alarm_on_rounded, color: _exact == true ? Colors.green : scheme.error),
                    title: Text(s.exactAlarmPermission),
                    subtitle: Text(_exact == null ? '…' : (_exact! ? s.granted : s.notGranted)),
                    trailing: _exact == true ? null : TextButton(onPressed: () async {
                      await NotificationService.instance.requestPermissions();
                      await _refreshPermissions();
                    }, child: Text(s.grantPermission)),
                  ),
                  ListTile(
                    leading: const Icon(Icons.send_rounded),
                    title: Text(s.testNotification),
                    onTap: () async {
                      final store = context.read<AlarmStore>();
                      await NotificationService.instance.requestPermissions();
                      await NotificationService.instance.showTest(ar: ar);
                      await store.resyncAll(ar: ar, defaultTitle: s.toolAlarm);
                      await _refreshPermissions();
                    },
                  ),
                ],
              ),
            ),
            const SizedBox(height: 8),
            SectionHeader(s.about),
            CustomCard(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Column(
                children: [
                  ListTile(
                    leading: Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(colors: [Color(0xFF1E3A8A), Color(0xFF3B82F6)]),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Icon(Icons.balance_rounded, color: Colors.white),
                    ),
                    title: Text(s.appName, style: const TextStyle(fontWeight: FontWeight.w700)),
                    subtitle: Text(s.appTagline),
                  ),
                  ListTile(
                    leading: const Icon(Icons.info_outline_rounded),
                    title: Text(s.version),
                    trailing: Text(d('1.1.0'), style: TextStyle(color: scheme.onSurfaceVariant)),
                  ),
                  ListTile(
                    leading: const Icon(Icons.code_rounded),
                    title: Text(s.developedBy),
                    trailing: Text('Alcode', style: TextStyle(color: scheme.onSurfaceVariant)),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Label extends StatelessWidget {
  const _Label(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Text(text, style: const TextStyle(fontWeight: FontWeight.w700)),
    );
  }
}
