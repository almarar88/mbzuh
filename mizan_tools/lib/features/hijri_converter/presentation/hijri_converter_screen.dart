import 'package:flutter/material.dart';
import 'package:hijri/hijri_calendar.dart';
import 'package:provider/provider.dart';

import '../../../core/constants/colors.dart';
import '../../../core/l10n/strings.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/utils/responsive.dart';
import '../../../services/settings_service.dart';
import '../../../shared/widgets/custom_card.dart';
import '../../../shared/widgets/glass.dart';

enum _Mode { gregToHijri, hijriToGreg }

class HijriConverterScreen extends StatefulWidget {
  const HijriConverterScreen({super.key});

  @override
  State<HijriConverterScreen> createState() => _HijriConverterScreenState();
}

class _HijriConverterScreenState extends State<HijriConverterScreen> {
  _Mode _mode = _Mode.gregToHijri;
  DateTime _greg = DateTime.now();
  late int _hDay;
  late int _hMonth;
  late int _hYear;

  @override
  void initState() {
    super.initState();
    final h = HijriCalendar.now();
    _hDay = h.hDay;
    _hMonth = h.hMonth;
    _hYear = h.hYear;
  }

  static const _occasions = <(int month, int day, String ar, String en)>[
    (1, 1, 'رأس السنة الهجرية', 'Hijri New Year'),
    (1, 10, 'يوم عاشوراء', 'Ashura'),
    (3, 12, 'المولد النبوي', 'Mawlid'),
    (7, 27, 'الإسراء والمعراج', "Isra' & Mi'raj"),
    (8, 15, 'ليلة النصف من شعبان', 'Mid-Sha\'ban'),
    (9, 1, 'أول رمضان', 'Start of Ramadan'),
    (9, 27, 'ليلة القدر (٢٧)', 'Laylat al-Qadr (27th)'),
    (10, 1, 'عيد الفطر', 'Eid al-Fitr'),
    (12, 9, 'يوم عرفة', 'Day of Arafah'),
    (12, 10, 'عيد الأضحى', 'Eid al-Adha'),
  ];

  @override
  Widget build(BuildContext context) {
    final s = S.of(context);
    final settings = context.watch<SettingsService>();
    final ar = settings.isArabic;
    final scheme = Theme.of(context).colorScheme;
    String d(String v) => Fmt.digits(v, eastern: settings.easternDigits);
    HijriCalendar.language = ar ? 'ar' : 'en';

    final today = DateTime.now();
    final todayHijri = Fmt.hijriOf(today, ar: ar, adjustDays: settings.hijriAdjust);
    final monthNames = [for (var m = 1; m <= 12; m++) (HijriCalendar()..hYear = 1445..hMonth = m..hDay = 1).getLongMonthName()];

    // Upcoming occasions: evaluate this and next hijri year, keep future ones.
    final upcoming = <(String, DateTime, int)>[];
    for (final y in [todayHijri.hYear, todayHijri.hYear + 1]) {
      for (final o in _occasions) {
        try {
          final g = HijriCalendar().hijriToGregorian(y, o.$1, o.$2).subtract(Duration(days: settings.hijriAdjust));
          final diff = DateTime(g.year, g.month, g.day).difference(DateTime(today.year, today.month, today.day)).inDays;
          if (diff >= 0 && diff <= 400) upcoming.add((ar ? o.$3 : o.$4, g, diff));
        } catch (_) {}
      }
    }
    upcoming.sort((a, b) => a.$3.compareTo(b.$3));

    return GlassScaffold(
      appBar: GlassAppBar(title: Text(s.hijriTitle)),
      body: ContentConstraint(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
          children: [
            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                gradient: const LinearGradient(colors: [Color(0xFF047857), Color(0xFF10B981)]),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(s.todayIs, style: const TextStyle(color: Colors.white70, fontSize: 13)),
                  const SizedBox(height: 4),
                  Text(d(Fmt.hijriLong(today, ar: ar, adjustDays: settings.hijriAdjust)),
                      style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w700)),
                  Text(d(Fmt.gregorianLong(today, ar: ar)), style: const TextStyle(color: Colors.white, fontSize: 14)),
                ],
              ),
            ),
            const SizedBox(height: 16),
            SegmentedButton<_Mode>(
              segments: [
                ButtonSegment(value: _Mode.gregToHijri, label: Text(s.gregToHijri), icon: const Icon(Icons.calendar_today_rounded, size: 18)),
                ButtonSegment(value: _Mode.hijriToGreg, label: Text(s.hijriToGreg), icon: const Icon(Icons.nightlight_round, size: 18)),
              ],
              selected: {_mode},
              onSelectionChanged: (v) => setState(() => _mode = v.first),
            ),
            const SizedBox(height: 14),
            if (_mode == _Mode.gregToHijri) ...[
              FilledButton.icon(
                onPressed: () async {
                  final p = await showDatePicker(
                    context: context,
                    initialDate: _greg,
                    firstDate: DateTime(1900),
                    lastDate: DateTime(2100),
                  );
                  if (p != null) setState(() => _greg = p);
                },
                icon: const Icon(Icons.event_rounded),
                label: Text('${s.pickDate}: ${d(Fmt.gregorianShort(_greg))}'),
              ),
              const SizedBox(height: 14),
              _ResultCard(
                title: d(Fmt.hijriLong(_greg, ar: ar, adjustDays: settings.hijriAdjust)),
                subtitle: '${s.weekdayLong[_greg.weekday - 1]} · ${d(Fmt.gregorianLong(_greg, ar: ar))}',
              ),
            ] else ...[
              CustomCard(
                child: Row(
                  children: [
                    Expanded(
                      child: DropdownButtonFormField<int>(
                        initialValue: _hDay,
                        decoration: InputDecoration(labelText: s.hijriDay),
                        items: [for (var i = 1; i <= 30; i++) DropdownMenuItem(value: i, child: Text(d('$i')))],
                        onChanged: (v) => setState(() => _hDay = v ?? _hDay),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      flex: 2,
                      child: DropdownButtonFormField<int>(
                        initialValue: _hMonth,
                        isExpanded: true,
                        decoration: InputDecoration(labelText: s.hijriMonth),
                        items: [for (var i = 1; i <= 12; i++) DropdownMenuItem(value: i, child: Text(monthNames[i - 1], overflow: TextOverflow.ellipsis))],
                        onChanged: (v) => setState(() => _hMonth = v ?? _hMonth),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: DropdownButtonFormField<int>(
                        initialValue: _hYear,
                        decoration: InputDecoration(labelText: s.hijriYear),
                        items: [for (var y = 1356; y <= 1500; y++) DropdownMenuItem(value: y, child: Text(d('$y')))],
                        onChanged: (v) => setState(() => _hYear = v ?? _hYear),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 14),
              Builder(builder: (context) {
                final cal = HijriCalendar();
                final valid = cal.validateHijri(_hYear, _hMonth, _hDay) && _hDay <= cal.getDaysInMonth(_hYear, _hMonth);
                if (!valid) {
                  return CustomCard(
                    color: scheme.errorContainer.withValues(alpha: 0.4),
                    child: Row(children: [Icon(Icons.error_outline_rounded, color: scheme.error), const SizedBox(width: 8), Text(s.invalidHijri)]),
                  );
                }
                DateTime g;
                try {
                  g = HijriCalendar().hijriToGregorian(_hYear, _hMonth, _hDay).subtract(Duration(days: settings.hijriAdjust));
                } catch (_) {
                  return CustomCard(child: Text(s.invalidHijri));
                }
                return _ResultCard(
                  title: d(Fmt.gregorianLong(g, ar: ar)),
                  subtitle: d('${Fmt.gregorianShort(g)} · $_hDay ${monthNames[_hMonth - 1]} $_hYear ${ar ? 'هـ' : 'AH'}'),
                );
              }),
            ],
            const SizedBox(height: 18),
            SectionHeader(s.upcomingOccasions),
            CustomCard(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Column(
                children: [
                  for (final o in upcoming.take(8))
                    ListTile(
                      dense: true,
                      leading: Container(
                        width: 40,
                        height: 40,
                        decoration: BoxDecoration(color: AppColors.hijri.withValues(alpha: 0.14), borderRadius: BorderRadius.circular(12)),
                        child: const Icon(Icons.star_rounded, color: AppColors.hijri, size: 20),
                      ),
                      title: Text(o.$1, style: const TextStyle(fontWeight: FontWeight.w600)),
                      subtitle: Text(d(Fmt.gregorianLong(o.$2, ar: ar)), style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 12)),
                      trailing: Text(d(s.daysLeft(o.$3)), style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.hijri)),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 8),
            Text(
              ar
                  ? 'التواريخ الهجرية محسوبة وفق تقويم أم القرى وقد تختلف يوماً حسب الرؤية الشرعية.'
                  : 'Hijri dates follow the Umm al-Qura calendar and may differ by a day based on moon sighting.',
              style: TextStyle(fontSize: 12, color: scheme.onSurfaceVariant),
            ),
          ],
        ),
      ),
    );
  }
}

class _ResultCard extends StatelessWidget {
  const _ResultCard({required this.title, required this.subtitle});
  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return CustomCard(
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: AppColors.hijri.withValues(alpha: 0.14), borderRadius: BorderRadius.circular(14)),
            child: const Icon(Icons.swap_horiz_rounded, color: AppColors.hijri),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w700)),
                const SizedBox(height: 2),
                Text(subtitle, style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 13)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
