import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// User preferences persisted with shared_preferences.
class SettingsService extends ChangeNotifier {
  SettingsService(this._prefs) {
    _load();
  }

  final SharedPreferences _prefs;

  static const _kTheme = 'theme_mode';
  static const _kLocale = 'locale';
  static const _kDigits = 'eastern_digits';
  static const _kCurrency = 'default_currency';
  static const _kVat = 'default_vat';
  static const _kHijriAdjust = 'hijri_adjust';
  static const _kFavorites = 'favorites';
  static const _kCalcHistory = 'calc_history';

  ThemeMode _themeMode = ThemeMode.dark;
  Locale _locale = const Locale('ar', 'AE');
  bool _easternDigits = false;
  String _defaultCurrency = 'AED';
  double _defaultVat = 5;
  int _hijriAdjust = 0;
  List<String> _favorites = const ['age', 'calculator', 'currency', 'alarm'];
  List<String> _calcHistory = const [];

  ThemeMode get themeMode => _themeMode;
  Locale get locale => _locale;
  bool get isArabic => _locale.languageCode == 'ar';
  bool get easternDigits => _easternDigits;
  String get defaultCurrency => _defaultCurrency;
  double get defaultVat => _defaultVat;
  int get hijriAdjust => _hijriAdjust;
  List<String> get favorites => List.unmodifiable(_favorites);
  List<String> get calcHistory => List.unmodifiable(_calcHistory);

  void _load() {
    _themeMode = ThemeMode.values[_prefs.getInt(_kTheme) ?? ThemeMode.dark.index];
    final lang = _prefs.getString(_kLocale) ?? 'ar';
    _locale = lang == 'en' ? const Locale('en', 'US') : const Locale('ar', 'AE');
    _easternDigits = _prefs.getBool(_kDigits) ?? false;
    _defaultCurrency = _prefs.getString(_kCurrency) ?? 'AED';
    _defaultVat = _prefs.getDouble(_kVat) ?? 5;
    _hijriAdjust = _prefs.getInt(_kHijriAdjust) ?? 0;
    _favorites = _prefs.getStringList(_kFavorites) ?? _favorites;
    _calcHistory = _prefs.getStringList(_kCalcHistory) ?? const [];
  }

  Future<void> setThemeMode(ThemeMode mode) async {
    _themeMode = mode;
    notifyListeners();
    await _prefs.setInt(_kTheme, mode.index);
  }

  Future<void> setLanguage(String code) async {
    _locale = code == 'en' ? const Locale('en', 'US') : const Locale('ar', 'AE');
    notifyListeners();
    await _prefs.setString(_kLocale, code);
  }

  Future<void> setEasternDigits(bool value) async {
    _easternDigits = value;
    notifyListeners();
    await _prefs.setBool(_kDigits, value);
  }

  Future<void> setDefaultCurrency(String code) async {
    _defaultCurrency = code;
    notifyListeners();
    await _prefs.setString(_kCurrency, code);
  }

  Future<void> setDefaultVat(double rate) async {
    _defaultVat = rate;
    notifyListeners();
    await _prefs.setDouble(_kVat, rate);
  }

  Future<void> setHijriAdjust(int days) async {
    _hijriAdjust = days.clamp(-2, 2);
    notifyListeners();
    await _prefs.setInt(_kHijriAdjust, _hijriAdjust);
  }

  bool isFavorite(String toolId) => _favorites.contains(toolId);

  Future<bool> toggleFavorite(String toolId) async {
    final list = List<String>.from(_favorites);
    final added = !list.remove(toolId);
    if (added) list.add(toolId);
    _favorites = list;
    notifyListeners();
    await _prefs.setStringList(_kFavorites, list);
    return added;
  }

  Future<void> addCalcHistory(String entry) async {
    final list = [entry, ..._calcHistory.where((e) => e != entry)];
    if (list.length > 30) list.removeRange(30, list.length);
    _calcHistory = list;
    notifyListeners();
    await _prefs.setStringList(_kCalcHistory, list);
  }

  Future<void> clearCalcHistory() async {
    _calcHistory = const [];
    notifyListeners();
    await _prefs.remove(_kCalcHistory);
  }
}
