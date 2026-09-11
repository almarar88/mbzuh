import 'package:flutter_test/flutter_test.dart';
import 'package:mizan_tools/core/utils/formatters.dart';
import 'package:mizan_tools/features/age_calculator/presentation/age_calculator_screen.dart';
import 'package:mizan_tools/services/alarm_store.dart';

void main() {
  group('AgeResult.compute', () {
    test('exact birthday', () {
      final r = AgeResult.compute(DateTime(2000, 5, 10), DateTime(2025, 5, 10));
      expect(r.years, 25);
      expect(r.months, 0);
      expect(r.days, 0);
      expect(r.daysToNextBirthday, 365);
    });

    test('day before birthday borrows month/days', () {
      final r = AgeResult.compute(DateTime(2000, 5, 10), DateTime(2025, 5, 9));
      expect(r.years, 24);
      expect(r.months, 11);
      expect(r.days, 29);
      expect(r.daysToNextBirthday, 1);
    });

    test('feb 29 birthday on non-leap year clamps to feb 28', () {
      final r = AgeResult.compute(DateTime(2004, 2, 29), DateTime(2025, 1, 1));
      expect(r.years, 20);
      expect(r.nextBirthday, DateTime(2025, 2, 28));
    });

    test('total days matches difference', () {
      final r = AgeResult.compute(DateTime(2020, 1, 1), DateTime(2021, 1, 1));
      expect(r.totalDays, 366);
      expect(r.totalWeeks, 52);
      expect(r.totalMonths, 12);
    });
  });

  group('Fmt', () {
    test('eastern digits conversion', () {
      expect(Fmt.digits('12:30 PM', eastern: true), '١٢:٣٠ PM');
      expect(Fmt.digits('12:30', eastern: false), '12:30');
    });

    test('plain trims zeros', () {
      expect(Fmt.plain(5.0), '5');
      expect(Fmt.plain(2.5), '2.5');
      expect(Fmt.plain(1 / 3), '0.3333333333');
    });

    test('number groups thousands', () {
      expect(Fmt.number(1234567.891), '1,234,567.89');
      expect(Fmt.number(10, minFraction: 2), '10.00');
    });

    test('duration formatting', () {
      expect(Fmt.duration(const Duration(hours: 1, minutes: 2, seconds: 3)), '01:02:03');
      expect(Fmt.duration(const Duration(minutes: 2, seconds: 3), showHours: false), '02:03');
    });

    test('hijri conversion is stable for a known date', () {
      // 1 Ramadan 1445 AH = 11 March 2024 (Umm al-Qura).
      final h = Fmt.hijriOf(DateTime(2024, 3, 11), ar: false);
      expect(h.hYear, 1445);
      expect(h.hMonth, 9);
      expect(h.hDay, 1);
    });
  });

  group('Alarm.nextRing', () {
    test('one-shot alarm later today', () {
      final a = Alarm(id: 1, hour: 10, minute: 0);
      final next = a.nextRing(DateTime(2025, 1, 1, 8));
      expect(next, DateTime(2025, 1, 1, 10));
    });

    test('one-shot alarm already passed rolls to tomorrow', () {
      final a = Alarm(id: 1, hour: 10, minute: 0);
      final next = a.nextRing(DateTime(2025, 1, 1, 11));
      expect(next, DateTime(2025, 1, 2, 10));
    });

    test('weekday alarm skips to the next matching day', () {
      // 2025-01-01 is a Wednesday; alarm only on Friday.
      final a = Alarm(id: 1, hour: 7, minute: 30, weekdays: {DateTime.friday});
      final next = a.nextRing(DateTime(2025, 1, 1, 8));
      expect(next, DateTime(2025, 1, 3, 7, 30));
      expect(next!.weekday, DateTime.friday);
    });

    test('disabled alarm has no next ring', () {
      final a = Alarm(id: 1, hour: 7, minute: 30, enabled: false);
      expect(a.nextRing(), isNull);
    });

    test('json round trip', () {
      final a = Alarm(id: 3, hour: 6, minute: 15, label: 'فجر', weekdays: {1, 2});
      final b = Alarm.fromJson(a.toJson());
      expect(b.id, 3);
      expect(b.hour, 6);
      expect(b.minute, 15);
      expect(b.label, 'فجر');
      expect(b.weekdays, {1, 2});
      expect(b.enabled, isTrue);
    });
  });
}
