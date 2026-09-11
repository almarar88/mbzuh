import 'package:flutter/material.dart';
import 'package:hijri/hijri_calendar.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../services/settings_service.dart';

/// Number/date formatting that respects the user's digit preference.
class Fmt {
  Fmt._();

  static const _eastern = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

  /// Maps Arabic-Indic digits (٠..٩) back to ASCII so every formatter starts
  /// from the same baseline regardless of the intl locale used.
  static String western(String input) {
    final sb = StringBuffer();
    for (final ch in input.runes) {
      if (ch >= 0x660 && ch <= 0x669) {
        sb.writeCharCode(0x30 + (ch - 0x660));
      } else if (ch >= 0x6F0 && ch <= 0x6F9) {
        sb.writeCharCode(0x30 + (ch - 0x6F0));
      } else {
        sb.writeCharCode(ch);
      }
    }
    return sb.toString();
  }

  static String digits(String input, {required bool eastern}) {
    if (!eastern) return western(input);
    final sb = StringBuffer();
    for (final ch in input.runes) {
      if (ch >= 0x30 && ch <= 0x39) {
        sb.write(_eastern[ch - 0x30]);
      } else {
        sb.writeCharCode(ch);
      }
    }
    return sb.toString();
  }

  /// Formats a number with grouping and up to [maxFraction] decimals,
  /// trimming trailing zeros.
  static String number(num value, {int maxFraction = 2, int minFraction = 0}) {
    if (value.isNaN) return '—';
    if (value.isInfinite) return '∞';
    final f = NumberFormat.decimalPatternDigits(locale: 'en_US', decimalDigits: maxFraction);
    f.minimumFractionDigits = minFraction;
    return f.format(value);
  }

  /// Compact representation for calculator displays: no grouping, up to 10
  /// significant fraction digits, integer if whole.
  static String plain(num value, {int maxFraction = 10}) {
    if (value.isNaN) return 'NaN';
    if (value.isInfinite) return '∞';
    if (value == value.roundToDouble() && value.abs() < 1e15) return value.toInt().toString();
    var s = value.toStringAsFixed(maxFraction);
    s = s.replaceFirst(RegExp(r'0+$'), '').replaceFirst(RegExp(r'\.$'), '');
    return s;
  }

  static String two(int n) => n.toString().padLeft(2, '0');

  static String duration(Duration d, {bool showHours = true}) {
    final h = d.inHours;
    final m = d.inMinutes.remainder(60);
    final s = d.inSeconds.remainder(60);
    if (showHours || h > 0) return '${two(h)}:${two(m)}:${two(s)}';
    return '${two(m)}:${two(s)}';
  }

  /// Human friendly "1h 20m" style.
  static String durationWords(Duration d, {required bool ar}) {
    final h = d.inHours;
    final m = d.inMinutes.remainder(60);
    if (h == 0 && m == 0) return ar ? 'أقل من دقيقة' : 'less than a minute';
    final parts = <String>[];
    if (h > 0) parts.add(ar ? '$h س' : '${h}h');
    if (m > 0) parts.add(ar ? '$m د' : '${m}m');
    return parts.join(' ');
  }

  static String gregorianLong(DateTime d, {required bool ar}) =>
      western(DateFormat('EEEE، d MMMM yyyy', ar ? 'ar' : 'en').format(d));

  static String gregorianShort(DateTime d) => DateFormat('yyyy/MM/dd').format(d);

  static String time(DateTime d, {required bool ar}) =>
      DateFormat('h:mm', 'en').format(d) + (d.hour >= 12 ? (ar ? ' م' : ' PM') : (ar ? ' ص' : ' AM'));

  static String timeOfDay(TimeOfDay t, {required bool ar}) {
    final h = t.hourOfPeriod == 0 ? 12 : t.hourOfPeriod;
    final suffix = t.period == DayPeriod.am ? (ar ? 'ص' : 'AM') : (ar ? 'م' : 'PM');
    return '$h:${two(t.minute)} $suffix';
  }

  static HijriCalendar hijriOf(DateTime d, {required bool ar, int adjustDays = 0}) {
    HijriCalendar.language = ar ? 'ar' : 'en';
    return HijriCalendar.fromDate(d.add(Duration(days: adjustDays)));
  }

  static String hijriLong(DateTime d, {required bool ar, int adjustDays = 0}) {
    final h = hijriOf(d, ar: ar, adjustDays: adjustDays);
    return '${h.hDay} ${h.longMonthName} ${h.hYear} ${ar ? 'هـ' : 'AH'}';
  }
}

/// Extension to apply the user's digit style in widgets.
extension DigitsX on String {
  String localized(BuildContext context) {
    final eastern = context.watch<SettingsService>().easternDigits;
    return Fmt.digits(this, eastern: eastern);
  }
}
