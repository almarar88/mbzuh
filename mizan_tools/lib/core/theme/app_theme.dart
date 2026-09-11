import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../constants/colors.dart';

/// Tokens for the frosted-glass look. Read with `GlassTheme.of(context)`.
class GlassTheme extends ThemeExtension<GlassTheme> {
  const GlassTheme({
    required this.canvas,
    required this.fill,
    required this.fillStrong,
    required this.border,
    required this.highlight,
    required this.blobA,
    required this.blobB,
    required this.blobC,
    required this.keyDigit,
    required this.keyFunction,
    required this.onKeyFunction,
  });

  final Color canvas;
  final Color fill;
  final Color fillStrong;
  final Color border;
  final Color highlight;
  final Color blobA;
  final Color blobB;
  final Color blobC;
  final Color keyDigit;
  final Color keyFunction;
  final Color onKeyFunction;

  static GlassTheme of(BuildContext context) => Theme.of(context).extension<GlassTheme>()!;

  static const dark = GlassTheme(
    canvas: AppColors.canvasDark,
    fill: Color(0x14FFFFFF),
    fillStrong: Color(0x24FFFFFF),
    border: Color(0x22FFFFFF),
    highlight: Color(0x2EFFFFFF),
    blobA: Color(0x8C1D4ED8),
    blobB: Color(0x667C3AED),
    blobC: Color(0x40FF9F0A),
    keyDigit: Color(0xFF333333),
    keyFunction: Color(0xFFA5A5A5),
    onKeyFunction: Color(0xFF000000),
  );

  static const light = GlassTheme(
    canvas: AppColors.canvasLight,
    fill: Color(0xB3FFFFFF),
    fillStrong: Color(0xE6FFFFFF),
    border: Color(0x14000000),
    highlight: Color(0xFFFFFFFF),
    blobA: Color(0x5993C5FD),
    blobB: Color(0x4DC4B5FD),
    blobC: Color(0x40FDBA74),
    keyDigit: Color(0xFFE5E5EA),
    keyFunction: Color(0xFFC7C7CC),
    onKeyFunction: Color(0xFF000000),
  );

  @override
  GlassTheme copyWith({Color? canvas}) => this;

  @override
  GlassTheme lerp(ThemeExtension<GlassTheme>? other, double t) {
    if (other is! GlassTheme) return this;
    return GlassTheme(
      canvas: Color.lerp(canvas, other.canvas, t)!,
      fill: Color.lerp(fill, other.fill, t)!,
      fillStrong: Color.lerp(fillStrong, other.fillStrong, t)!,
      border: Color.lerp(border, other.border, t)!,
      highlight: Color.lerp(highlight, other.highlight, t)!,
      blobA: Color.lerp(blobA, other.blobA, t)!,
      blobB: Color.lerp(blobB, other.blobB, t)!,
      blobC: Color.lerp(blobC, other.blobC, t)!,
      keyDigit: Color.lerp(keyDigit, other.keyDigit, t)!,
      keyFunction: Color.lerp(keyFunction, other.keyFunction, t)!,
      onKeyFunction: Color.lerp(onKeyFunction, other.onKeyFunction, t)!,
    );
  }
}

class AppTheme {
  AppTheme._();

  static const String fontFamily = 'Cairo';

  static ThemeData light() => _build(Brightness.light);
  static ThemeData dark() => _build(Brightness.dark);

  static ThemeData _build(Brightness brightness) {
    final isDark = brightness == Brightness.dark;
    final glass = isDark ? GlassTheme.dark : GlassTheme.light;
    final accent = isDark ? AppColors.orange : AppColors.orangeLight;

    final onSurface = isDark ? Colors.white : const Color(0xFF111114);
    final onSurfaceVariant = isDark ? const Color(0xFF9A9AA3) : const Color(0xFF6E6E73);

    final scheme = ColorScheme(
      brightness: brightness,
      primary: accent,
      onPrimary: isDark ? Colors.black : Colors.white,
      primaryContainer: accent.withValues(alpha: 0.22),
      onPrimaryContainer: accent,
      secondary: AppColors.blue,
      onSecondary: Colors.white,
      secondaryContainer: AppColors.blue.withValues(alpha: 0.22),
      onSecondaryContainer: isDark ? Colors.white : AppColors.blue,
      tertiary: AppColors.green,
      onTertiary: Colors.black,
      error: AppColors.red,
      onError: Colors.white,
      errorContainer: AppColors.red.withValues(alpha: 0.22),
      onErrorContainer: isDark ? Colors.white : AppColors.red,
      surface: glass.canvas,
      onSurface: onSurface,
      onSurfaceVariant: onSurfaceVariant,
      surfaceContainerHighest: isDark ? const Color(0x2AFFFFFF) : const Color(0x14000000),
      surfaceContainerHigh: isDark ? const Color(0xFF1C1C1E) : Colors.white,
      surfaceContainer: isDark ? const Color(0xFF16161A) : Colors.white,
      surfaceContainerLow: isDark ? const Color(0xFF101014) : const Color(0xFFF7F7FA),
      outline: isDark ? const Color(0xFF5A5A63) : const Color(0xFFB9B9C0),
      outlineVariant: glass.border,
      inverseSurface: isDark ? Colors.white : Colors.black,
      onInverseSurface: isDark ? Colors.black : Colors.white,
      inversePrimary: accent,
      shadow: Colors.black,
      scrim: Colors.black,
      surfaceTint: Colors.transparent,
    );

    final base = ThemeData(
      useMaterial3: true,
      brightness: brightness,
      colorScheme: scheme,
      fontFamily: fontFamily,
      scaffoldBackgroundColor: Colors.transparent,
      canvasColor: scheme.surfaceContainerHigh,
      cardColor: glass.fill,
      splashFactory: InkSparkle.splashFactory,
      extensions: [glass],
    );

    final textTheme = base.textTheme.apply(bodyColor: onSurface, displayColor: onSurface);

    return base.copyWith(
      textTheme: textTheme.copyWith(
        headlineLarge: textTheme.headlineLarge?.copyWith(fontWeight: FontWeight.w700, letterSpacing: -0.5),
        titleLarge: textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700),
        titleMedium: textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: Colors.transparent,
        foregroundColor: onSurface,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        titleSpacing: 20,
        titleTextStyle: TextStyle(
          fontFamily: fontFamily,
          fontSize: 26,
          fontWeight: FontWeight.w700,
          letterSpacing: -0.3,
          color: onSurface,
        ),
        iconTheme: IconThemeData(color: accent),
        actionsIconTheme: IconThemeData(color: accent),
        systemOverlayStyle: isDark ? SystemUiOverlayStyle.light : SystemUiOverlayStyle.dark,
      ),
      tabBarTheme: TabBarThemeData(
        labelColor: accent,
        unselectedLabelColor: onSurfaceVariant,
        indicatorColor: accent,
        dividerColor: Colors.transparent,
        labelStyle: const TextStyle(fontFamily: fontFamily, fontWeight: FontWeight.w700, fontSize: 13),
        unselectedLabelStyle: const TextStyle(fontFamily: fontFamily, fontWeight: FontWeight.w600, fontSize: 13),
      ),
      cardTheme: CardThemeData(
        color: glass.fill,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(22),
          side: BorderSide(color: glass.border),
        ),
      ),
      navigationRailTheme: NavigationRailThemeData(
        backgroundColor: Colors.transparent,
        indicatorColor: accent.withValues(alpha: 0.22),
        labelType: NavigationRailLabelType.all,
        selectedIconTheme: IconThemeData(color: accent),
        unselectedIconTheme: IconThemeData(color: onSurfaceVariant),
        selectedLabelTextStyle: TextStyle(fontFamily: fontFamily, fontSize: 12, fontWeight: FontWeight.w700, color: accent),
        unselectedLabelTextStyle: TextStyle(fontFamily: fontFamily, fontSize: 12, color: onSurfaceVariant),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: isDark ? const Color(0x1AFFFFFF) : const Color(0x0D000000),
        labelStyle: TextStyle(color: onSurfaceVariant),
        floatingLabelStyle: TextStyle(color: accent),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: BorderSide.none),
        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: BorderSide(color: glass.border)),
        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: BorderSide(color: accent, width: 1.4)),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size.fromHeight(52),
          backgroundColor: accent,
          foregroundColor: isDark ? Colors.black : Colors.white,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          textStyle: const TextStyle(fontFamily: fontFamily, fontSize: 16, fontWeight: FontWeight.w700),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          minimumSize: const Size.fromHeight(48),
          foregroundColor: onSurface,
          backgroundColor: glass.fill,
          side: BorderSide(color: glass.border),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          textStyle: const TextStyle(fontFamily: fontFamily, fontSize: 15, fontWeight: FontWeight.w600),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: accent,
          textStyle: const TextStyle(fontFamily: fontFamily, fontWeight: FontWeight.w600),
        ),
      ),
      iconButtonTheme: IconButtonThemeData(
        style: IconButton.styleFrom(foregroundColor: accent),
      ),
      floatingActionButtonTheme: FloatingActionButtonThemeData(
        backgroundColor: accent,
        foregroundColor: isDark ? Colors.black : Colors.white,
        elevation: 0,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        extendedTextStyle: const TextStyle(fontFamily: fontFamily, fontWeight: FontWeight.w700),
      ),
      segmentedButtonTheme: SegmentedButtonThemeData(
        style: ButtonStyle(
          textStyle: const WidgetStatePropertyAll(TextStyle(fontFamily: fontFamily, fontWeight: FontWeight.w600, fontSize: 13)),
          backgroundColor: WidgetStateProperty.resolveWith(
            (s) => s.contains(WidgetState.selected) ? (isDark ? const Color(0x38FFFFFF) : Colors.white) : glass.fill,
          ),
          foregroundColor: WidgetStateProperty.resolveWith(
            (s) => s.contains(WidgetState.selected) ? onSurface : onSurfaceVariant,
          ),
          side: WidgetStatePropertyAll(BorderSide(color: glass.border)),
          shape: WidgetStatePropertyAll(RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
          padding: const WidgetStatePropertyAll(EdgeInsets.symmetric(horizontal: 10)),
          visualDensity: VisualDensity.compact,
        ),
      ),
      chipTheme: base.chipTheme.copyWith(
        backgroundColor: glass.fill,
        selectedColor: accent.withValues(alpha: 0.25),
        side: BorderSide(color: glass.border),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        labelStyle: TextStyle(fontFamily: fontFamily, fontWeight: FontWeight.w600, color: onSurface),
        secondaryLabelStyle: TextStyle(fontFamily: fontFamily, fontWeight: FontWeight.w700, color: accent),
        checkmarkColor: accent,
      ),
      switchTheme: SwitchThemeData(
        thumbColor: const WidgetStatePropertyAll(Colors.white),
        trackColor: WidgetStateProperty.resolveWith(
          (s) => s.contains(WidgetState.selected) ? AppColors.green : (isDark ? const Color(0xFF39393D) : const Color(0xFFE9E9EA)),
        ),
        trackOutlineColor: const WidgetStatePropertyAll(Colors.transparent),
      ),
      sliderTheme: SliderThemeData(activeTrackColor: accent, thumbColor: Colors.white, inactiveTrackColor: glass.fillStrong),
      listTileTheme: ListTileThemeData(
        iconColor: accent,
        textColor: onSurface,
        shape: const RoundedRectangleBorder(borderRadius: BorderRadius.all(Radius.circular(14))),
      ),
      dividerTheme: DividerThemeData(color: glass.border, space: 1),
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        backgroundColor: isDark ? const Color(0xFF2C2C2E) : const Color(0xFF1C1C1E),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        contentTextStyle: const TextStyle(fontFamily: fontFamily, color: Colors.white),
      ),
      dialogTheme: DialogThemeData(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        backgroundColor: scheme.surfaceContainerHigh,
      ),
      bottomSheetTheme: BottomSheetThemeData(
        backgroundColor: scheme.surfaceContainerHigh,
        dragHandleColor: onSurfaceVariant,
        shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(28))),
      ),
      timePickerTheme: TimePickerThemeData(
        backgroundColor: scheme.surfaceContainerHigh,
        hourMinuteColor: isDark ? const Color(0x22FFFFFF) : const Color(0x0D000000),
        hourMinuteTextColor: onSurface,
        dayPeriodColor: accent.withValues(alpha: 0.25),
        dayPeriodTextColor: onSurface,
        dialHandColor: accent,
        dialBackgroundColor: isDark ? const Color(0x14FFFFFF) : const Color(0x0A000000),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      ),
      datePickerTheme: DatePickerThemeData(
        backgroundColor: scheme.surfaceContainerHigh,
        headerForegroundColor: onSurface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      ),
      dropdownMenuTheme: DropdownMenuThemeData(
        menuStyle: MenuStyle(backgroundColor: WidgetStatePropertyAll(scheme.surfaceContainerHigh)),
      ),
      popupMenuTheme: PopupMenuThemeData(color: scheme.surfaceContainerHigh),
      progressIndicatorTheme: ProgressIndicatorThemeData(color: accent),
    );
  }
}
