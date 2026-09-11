import 'package:flutter/material.dart';

/// Brand palette for Mizan. Kept intentionally small: one seed for the
/// Material 3 scheme, plus a fixed set of accent colors for tool cards.
class AppColors {
  AppColors._();

  static const Color seedLight = Color(0xFF1E3A8A);
  static const Color seedDark = Color(0xFF60A5FA);

  static const Color scaffoldLight = Color(0xFFF6F7FB);
  static const Color scaffoldDark = Color(0xFF0B1220);

  static const Color cardLight = Colors.white;
  static const Color cardDark = Color(0xFF141C2E);

  static const List<Color> headerGradient = [Color(0xFF1E3A8A), Color(0xFF3B82F6)];
  static const List<Color> headerGradientDark = [Color(0xFF1E293B), Color(0xFF1D4ED8)];

  // Tool accents
  static const Color age = Color(0xFF6366F1);
  static const Color calculator = Color(0xFF14B8A6);
  static const Color currency = Color(0xFFF59E0B);
  static const Color alarm = Color(0xFFF97316);
  static const Color hijri = Color(0xFF10B981);
  static const Color vat = Color(0xFFEC4899);
  static const Color units = Color(0xFF8B5CF6);
  static const Color timer = Color(0xFF0EA5E9);
  static const Color stopwatch = Color(0xFFEF4444);
}
