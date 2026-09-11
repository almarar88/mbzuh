import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/constants/colors.dart';
import '../../../core/l10n/strings.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/utils/responsive.dart';
import '../../../services/settings_service.dart';
import '../../../shared/widgets/custom_card.dart';
import '../../../shared/widgets/glass.dart';

class AgeResult {
  const AgeResult({
    required this.years,
    required this.months,
    required this.days,
    required this.totalDays,
    required this.daysToNextBirthday,
    required this.nextBirthday,
  });

  final int years;
  final int months;
  final int days;
  final int totalDays;
  final int daysToNextBirthday;
  final DateTime nextBirthday;

  int get totalWeeks => totalDays ~/ 7;
  int get totalMonths => years * 12 + months;
  int get totalHours => totalDays * 24;

  /// Calendar-accurate difference between [birth] and [today].
  static AgeResult compute(DateTime birth, DateTime today) {
    final b = DateTime(birth.year, birth.month, birth.day);
    final t = DateTime(today.year, today.month, today.day);

    var y = t.year - b.year;
    var m = t.month - b.month;
    var d = t.day - b.day;
    if (d < 0) {
      m--;
      final daysInPrevMonth = DateTime(t.year, t.month, 0).day;
      d += daysInPrevMonth;
    }
    if (m < 0) {
      y--;
      m += 12;
    }

    var next = _safeDate(t.year, b.month, b.day);
    if (!next.isAfter(t)) next = _safeDate(t.year + 1, b.month, b.day);
    return AgeResult(
      years: y,
      months: m,
      days: d,
      totalDays: t.difference(b).inDays,
      daysToNextBirthday: next.difference(t).inDays,
      nextBirthday: next,
    );
  }

  static DateTime _safeDate(int y, int m, int d) {
    final last = DateTime(y, m + 1, 0).day;
    return DateTime(y, m, d > last ? last : d);
  }
}

class AgeCalculatorScreen extends StatefulWidget {
  const AgeCalculatorScreen({super.key});

  @override
  State<AgeCalculatorScreen> createState() => _AgeCalculatorScreenState();
}

class _AgeCalculatorScreenState extends State<AgeCalculatorScreen> {
  DateTime? _birth;
  AgeResult? _result;

  Future<void> _pick() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: _birth ?? DateTime(now.year - 25, now.month, now.day),
      firstDate: DateTime(1900),
      lastDate: now,
      initialEntryMode: DatePickerEntryMode.calendarOnly,
    );
    if (picked == null) return;
    setState(() {
      _birth = picked;
      _result = AgeResult.compute(picked, now);
    });
  }

  @override
  Widget build(BuildContext context) {
    final s = S.of(context);
    final settings = context.watch<SettingsService>();
    final ar = settings.isArabic;
    String d(String v) => Fmt.digits(v, eastern: settings.easternDigits);

    final r = _result;
    final birth = _birth;

    return GlassScaffold(
      appBar: GlassAppBar(title: Text(s.ageTitle)),
      body: ContentConstraint(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
          children: [
            FilledButton.icon(
              onPressed: _pick,
              icon: const Icon(Icons.calendar_today_rounded),
              label: Text(
                birth == null ? s.pickBirthDate : '${s.changeDate}: ${d(Fmt.gregorianShort(birth))}',
              ),
            ),
            if (r != null && birth != null) ...[
              const SizedBox(height: 20),
              SectionHeader(s.ageSummary),
              Row(
                children: [
                  Expanded(child: StatBox(label: s.years, value: d('${r.years}'), color: AppColors.age)),
                  const SizedBox(width: 10),
                  Expanded(child: StatBox(label: s.months, value: d('${r.months}'), color: AppColors.age)),
                  const SizedBox(width: 10),
                  Expanded(child: StatBox(label: s.days, value: d('${r.days}'), color: AppColors.age)),
                ],
              ),
              const SizedBox(height: 12),
              CustomCard(
                padding: const EdgeInsets.all(14),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: Colors.purple.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Icon(Icons.cake_rounded, color: Colors.purple),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(s.nextBirthday, style: const TextStyle(fontWeight: FontWeight.w700)),
                          const SizedBox(height: 2),
                          Text(
                            '${d(s.daysToBirthday(r.daysToNextBirthday))} · ${d(Fmt.gregorianLong(r.nextBirthday, ar: ar))}',
                            style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant, fontSize: 13),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              SectionHeader(s.detailedStats),
              CustomCard(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                child: Column(
                  children: [
                    InfoRow(icon: Icons.event_rounded, label: s.bornOn, value: s.weekdayLong[birth.weekday - 1]),
                    const Divider(),
                    InfoRow(icon: Icons.nightlight_round, label: s.hijriBirthDate, value: d(Fmt.hijriLong(birth, ar: ar, adjustDays: settings.hijriAdjust))),
                    const Divider(),
                    InfoRow(icon: Icons.brightness_3_rounded, label: s.hijriAge, value: d(_hijriAge(birth, ar: ar, s: s))),
                    const Divider(),
                    InfoRow(icon: Icons.calendar_view_month_rounded, label: s.totalMonths, value: d(Fmt.number(r.totalMonths))),
                    const Divider(),
                    InfoRow(icon: Icons.view_week_rounded, label: s.totalWeeks, value: d(Fmt.number(r.totalWeeks))),
                    const Divider(),
                    InfoRow(icon: Icons.today_rounded, label: s.totalDays, value: d(Fmt.number(r.totalDays))),
                    const Divider(),
                    InfoRow(icon: Icons.schedule_rounded, label: s.totalHours, value: d(Fmt.number(r.totalHours))),
                  ],
                ),
              ),
            ] else ...[
              const SizedBox(height: 48),
              Icon(Icons.cake_outlined, size: 72, color: Theme.of(context).colorScheme.outline),
              const SizedBox(height: 12),
              Text(
                s.toolAgeDesc,
                textAlign: TextAlign.center,
                style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant),
              ),
            ],
          ],
        ),
      ),
    );
  }

  String _hijriAge(DateTime birth, {required bool ar, required S s}) {
    final b = Fmt.hijriOf(birth, ar: ar);
    final t = Fmt.hijriOf(DateTime.now(), ar: ar);
    var y = t.hYear - b.hYear;
    var m = t.hMonth - b.hMonth;
    var d = t.hDay - b.hDay;
    if (d < 0) {
      m--;
      d += 30;
    }
    if (m < 0) {
      y--;
      m += 12;
    }
    return ar ? '$y سنة، $m شهر، $d يوم' : '${y}y ${m}m ${d}d';
  }
}
