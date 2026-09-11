import 'package:flutter/material.dart';

import 'constants/colors.dart';
import 'l10n/strings.dart';
import '../features/age_calculator/presentation/age_calculator_screen.dart';
import '../features/alarm/presentation/alarm_screen.dart';
import '../features/calculator/presentation/calculator_screen.dart';
import '../features/currency_converter/presentation/currency_screen.dart';
import '../features/hijri_converter/presentation/hijri_converter_screen.dart';
import '../features/unit_converter/presentation/unit_converter_screen.dart';
import '../features/vat_calculator/presentation/vat_screen.dart';

enum ToolCategory { time, finance, convert }

class ToolDef {
  const ToolDef({
    required this.id,
    required this.icon,
    required this.color,
    required this.category,
    required this.title,
    required this.description,
    required this.builder,
  });

  final String id;
  final IconData icon;
  final Color color;
  final ToolCategory category;
  final String Function(S s) title;
  final String Function(S s) description;
  final Widget Function() builder;
}

/// Single source of truth for every tool in the app. The home grid, hubs,
/// favorites and two-pane layouts all read from this list.
class ToolsRegistry {
  ToolsRegistry._();

  static final List<ToolDef> all = [
    ToolDef(
      id: 'age',
      icon: Icons.cake_rounded,
      color: AppColors.age,
      category: ToolCategory.time,
      title: (s) => s.toolAge,
      description: (s) => s.toolAgeDesc,
      builder: () => const AgeCalculatorScreen(),
    ),
    ToolDef(
      id: 'alarm',
      icon: Icons.alarm_rounded,
      color: AppColors.alarm,
      category: ToolCategory.time,
      title: (s) => s.toolAlarm,
      description: (s) => s.toolAlarmDesc,
      builder: () => const AlarmScreen(initialTab: AlarmTab.alarms),
    ),
    ToolDef(
      id: 'timer',
      icon: Icons.hourglass_bottom_rounded,
      color: AppColors.timer,
      category: ToolCategory.time,
      title: (s) => s.toolTimer,
      description: (s) => s.toolTimerDesc,
      builder: () => const AlarmScreen(initialTab: AlarmTab.timer),
    ),
    ToolDef(
      id: 'stopwatch',
      icon: Icons.timer_rounded,
      color: AppColors.stopwatch,
      category: ToolCategory.time,
      title: (s) => s.toolStopwatch,
      description: (s) => s.toolStopwatchDesc,
      builder: () => const AlarmScreen(initialTab: AlarmTab.stopwatch),
    ),
    ToolDef(
      id: 'hijri',
      icon: Icons.calendar_month_rounded,
      color: AppColors.hijri,
      category: ToolCategory.time,
      title: (s) => s.toolHijri,
      description: (s) => s.toolHijriDesc,
      builder: () => const HijriConverterScreen(),
    ),
    ToolDef(
      id: 'calculator',
      icon: Icons.calculate_rounded,
      color: AppColors.calculator,
      category: ToolCategory.finance,
      title: (s) => s.toolCalculator,
      description: (s) => s.toolCalculatorDesc,
      builder: () => const CalculatorScreen(),
    ),
    ToolDef(
      id: 'currency',
      icon: Icons.currency_exchange_rounded,
      color: AppColors.currency,
      category: ToolCategory.finance,
      title: (s) => s.toolCurrency,
      description: (s) => s.toolCurrencyDesc,
      builder: () => const CurrencyScreen(),
    ),
    ToolDef(
      id: 'vat',
      icon: Icons.receipt_long_rounded,
      color: AppColors.vat,
      category: ToolCategory.finance,
      title: (s) => s.toolVat,
      description: (s) => s.toolVatDesc,
      builder: () => const VatScreen(),
    ),
    ToolDef(
      id: 'units',
      icon: Icons.straighten_rounded,
      color: AppColors.units,
      category: ToolCategory.convert,
      title: (s) => s.toolUnits,
      description: (s) => s.toolUnitsDesc,
      builder: () => const UnitConverterScreen(),
    ),
  ];

  static ToolDef? byId(String id) {
    for (final t in all) {
      if (t.id == id) return t;
    }
    return null;
  }

  static List<ToolDef> byCategory(ToolCategory c) => all.where((t) => t.category == c).toList();
  static List<ToolDef> get timeTools => byCategory(ToolCategory.time);
  static List<ToolDef> get financeTools => [...byCategory(ToolCategory.finance), ...byCategory(ToolCategory.convert)];

  static String categoryTitle(ToolCategory c, S s) => switch (c) {
        ToolCategory.time => s.catTime,
        ToolCategory.finance => s.catFinance,
        ToolCategory.convert => s.catConvert,
      };

  /// Opens a tool full-screen (used on compact windows).
  static Future<void> open(BuildContext context, ToolDef tool) {
    return Navigator.of(context).push(
      MaterialPageRoute<void>(builder: (_) => tool.builder(), settings: RouteSettings(name: '/tool/${tool.id}')),
    );
  }
}
