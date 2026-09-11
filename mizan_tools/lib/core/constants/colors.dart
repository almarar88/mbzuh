import 'package:flutter/material.dart';

/// Palette inspired by iOS system colors (Apple Clock uses orange as the
/// single accent on a near-black canvas).
class AppColors {
  AppColors._();

  // Accents (dark / light variants follow Apple's HIG values)
  static const Color orange = Color(0xFFFF9F0A);
  static const Color orangeLight = Color(0xFFFF9500);
  static const Color blue = Color(0xFF0A84FF);
  static const Color green = Color(0xFF30D158);
  static const Color red = Color(0xFFFF453A);
  static const Color purple = Color(0xFFBF5AF2);
  static const Color teal = Color(0xFF64D2FF);
  static const Color pink = Color(0xFFFF375F);
  static const Color indigo = Color(0xFF5E5CE6);
  static const Color mint = Color(0xFF66D4CF);
  static const Color yellow = Color(0xFFFFD60A);

  // Canvas
  static const Color canvasDark = Color(0xFF050609);
  static const Color canvasLight = Color(0xFFF2F2F7);

  // Tool accents
  static const Color age = purple;
  static const Color calculator = orange;
  static const Color currency = green;
  static const Color alarm = orange;
  static const Color hijri = mint;
  static const Color vat = pink;
  static const Color units = indigo;
  static const Color timer = blue;
  static const Color stopwatch = green;

  // Legacy names still referenced by a few widgets
  static const Color seedLight = Color(0xFF1E3A8A);
  static const List<Color> headerGradient = [Color(0xFF1E3A8A), Color(0xFF3B82F6)];
  static const List<Color> headerGradientDark = [Color(0xFF1E293B), Color(0xFF1D4ED8)];
}
