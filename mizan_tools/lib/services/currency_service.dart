import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class CurrencyInfo {
  const CurrencyInfo(this.code, this.nameAr, this.nameEn, this.symbol, this.flag);
  final String code;
  final String nameAr;
  final String nameEn;
  final String symbol;
  final String flag;
}

/// Exchange rates relative to USD, fetched from open.er-api.com (free, no key)
/// and cached locally. Falls back to built-in approximate rates when offline.
class CurrencyService extends ChangeNotifier {
  CurrencyService(this._prefs) {
    _loadCache();
  }

  final SharedPreferences _prefs;
  static const _kRates = 'fx_rates';
  static const _kUpdated = 'fx_updated';
  static const _endpoint = 'https://open.er-api.com/v6/latest/USD';

  static const List<CurrencyInfo> currencies = [
    CurrencyInfo('AED', 'درهم إماراتي', 'UAE Dirham', 'د.إ', '🇦🇪'),
    CurrencyInfo('SAR', 'ريال سعودي', 'Saudi Riyal', 'ر.س', '🇸🇦'),
    CurrencyInfo('KWD', 'دينار كويتي', 'Kuwaiti Dinar', 'د.ك', '🇰🇼'),
    CurrencyInfo('QAR', 'ريال قطري', 'Qatari Riyal', 'ر.ق', '🇶🇦'),
    CurrencyInfo('BHD', 'دينار بحريني', 'Bahraini Dinar', 'د.ب', '🇧🇭'),
    CurrencyInfo('OMR', 'ريال عماني', 'Omani Rial', 'ر.ع', '🇴🇲'),
    CurrencyInfo('USD', 'دولار أمريكي', 'US Dollar', r'$', '🇺🇸'),
    CurrencyInfo('EUR', 'يورو', 'Euro', '€', '🇪🇺'),
    CurrencyInfo('GBP', 'جنيه إسترليني', 'British Pound', '£', '🇬🇧'),
    CurrencyInfo('EGP', 'جنيه مصري', 'Egyptian Pound', 'ج.م', '🇪🇬'),
    CurrencyInfo('JOD', 'دينار أردني', 'Jordanian Dinar', 'د.أ', '🇯🇴'),
    CurrencyInfo('TRY', 'ليرة تركية', 'Turkish Lira', '₺', '🇹🇷'),
    CurrencyInfo('INR', 'روبية هندية', 'Indian Rupee', '₹', '🇮🇳'),
    CurrencyInfo('PKR', 'روبية باكستانية', 'Pakistani Rupee', '₨', '🇵🇰'),
    CurrencyInfo('JPY', 'ين ياباني', 'Japanese Yen', '¥', '🇯🇵'),
    CurrencyInfo('CNY', 'يوان صيني', 'Chinese Yuan', '¥', '🇨🇳'),
  ];

  /// Approximate reference rates (1 USD = x) used only when no network data
  /// has ever been cached. Gulf pegs are exact; floating currencies are rough.
  static const Map<String, double> _fallback = {
    'USD': 1.0,
    'AED': 3.6725,
    'SAR': 3.75,
    'KWD': 0.3065,
    'QAR': 3.64,
    'BHD': 0.376,
    'OMR': 0.3845,
    'JOD': 0.709,
    'EUR': 0.86,
    'GBP': 0.75,
    'EGP': 48.5,
    'TRY': 41.0,
    'INR': 88.0,
    'PKR': 281.0,
    'JPY': 147.0,
    'CNY': 7.15,
  };

  Map<String, double> _rates = Map.of(_fallback);
  DateTime? _updatedAt;
  bool _loading = false;
  String? _lastError;

  Map<String, double> get rates => _rates;
  DateTime? get updatedAt => _updatedAt;
  bool get isLive => _updatedAt != null;
  bool get loading => _loading;
  String? get lastError => _lastError;

  static CurrencyInfo info(String code) => currencies.firstWhere((c) => c.code == code, orElse: () => currencies.first);

  void _loadCache() {
    final raw = _prefs.getString(_kRates);
    final ts = _prefs.getInt(_kUpdated);
    if (raw != null && ts != null) {
      try {
        final map = (jsonDecode(raw) as Map<String, dynamic>).map((k, v) => MapEntry(k, (v as num).toDouble()));
        _rates = {..._fallback, ...map};
        _updatedAt = DateTime.fromMillisecondsSinceEpoch(ts);
      } catch (_) {}
    }
  }

  /// Fetches fresh rates if the cache is older than [maxAge] (or [force]).
  Future<void> refresh({bool force = false, Duration maxAge = const Duration(hours: 6)}) async {
    if (_loading) return;
    if (!force && _updatedAt != null && DateTime.now().difference(_updatedAt!) < maxAge) return;
    _loading = true;
    _lastError = null;
    notifyListeners();
    try {
      final resp = await http.get(Uri.parse(_endpoint)).timeout(const Duration(seconds: 12));
      if (resp.statusCode != 200) throw Exception('HTTP ${resp.statusCode}');
      final body = jsonDecode(resp.body) as Map<String, dynamic>;
      if (body['result'] != 'success') throw Exception('API error');
      final all = (body['rates'] as Map<String, dynamic>);
      final wanted = <String, double>{};
      for (final c in currencies) {
        final v = all[c.code];
        if (v is num) wanted[c.code] = v.toDouble();
      }
      if (wanted.length < 5) throw Exception('Incomplete data');
      _rates = {..._fallback, ...wanted};
      final unix = body['time_last_update_unix'];
      _updatedAt = unix is num ? DateTime.fromMillisecondsSinceEpoch(unix.toInt() * 1000) : DateTime.now();
      await _prefs.setString(_kRates, jsonEncode(wanted));
      await _prefs.setInt(_kUpdated, _updatedAt!.millisecondsSinceEpoch);
    } catch (e) {
      _lastError = e.toString();
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  double convert(double amount, String from, String to) {
    final fromRate = _rates[from] ?? 1;
    final toRate = _rates[to] ?? 1;
    return amount / fromRate * toRate;
  }

  /// How many units of [to] one unit of [from] buys.
  double rate(String from, String to) => convert(1, from, to);
}
