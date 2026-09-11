import 'package:flutter/widgets.dart';
import 'package:provider/provider.dart';

import '../../services/settings_service.dart';

/// Lightweight, type-safe strings for Arabic (primary) and English.
///
/// Access with `S.of(context)`. The active language comes from
/// [SettingsService.locale]. Arabic is the default.
class S {
  const S(this.isArabic);

  final bool isArabic;

  static S of(BuildContext context) {
    final locale = context.watch<SettingsService>().locale;
    return S(locale.languageCode == 'ar');
  }

  String t(String ar, String en) => isArabic ? ar : en;

  // ---- App / navigation -------------------------------------------------
  String get appName => t('ميزان', 'Mizan');
  String get appTagline => t('أدواتك اليومية في مكان واحد', 'Your everyday tools in one place');
  String get navHome => t('الرئيسية', 'Home');
  String get navTime => t('الوقت', 'Time');
  String get navFinance => t('المالية', 'Finance');
  String get navSettings => t('الإعدادات', 'Settings');

  // ---- Home ---------------------------------------------------------------
  String get today => t('اليوم', 'Today');
  String get favorites => t('المفضلة', 'Favorites');
  String get allTools => t('كل الأدوات', 'All tools');
  String get noFavoritesHint =>
      t('اضغط مطولاً على أي أداة لإضافتها إلى المفضلة', 'Long-press any tool to add it to favorites');
  String get addedToFavorites => t('أُضيفت إلى المفضلة', 'Added to favorites');
  String get removedFromFavorites => t('أُزيلت من المفضلة', 'Removed from favorites');
  String get goodMorning => t('صباح الخير', 'Good morning');
  String get goodAfternoon => t('مساء الخير', 'Good afternoon');
  String get goodEvening => t('مساء الخير', 'Good evening');
  String get goodNight => t('ليلة سعيدة', 'Good night');
  String get hijriLabel => t('هجري', 'Hijri');
  String get gregorianLabel => t('ميلادي', 'Gregorian');

  // ---- Categories -------------------------------------------------------
  String get catTime => t('الوقت والتقويم', 'Time & Calendar');
  String get catFinance => t('الحساب والمالية', 'Math & Finance');
  String get catConvert => t('التحويل', 'Conversion');

  // ---- Tool names -------------------------------------------------------
  String get toolAge => t('حاسبة العمر', 'Age Calculator');
  String get toolCalculator => t('الآلة الحاسبة', 'Calculator');
  String get toolCurrency => t('محول العملات', 'Currency Converter');
  String get toolAlarm => t('المنبه', 'Alarm');
  String get toolTimer => t('المؤقت', 'Timer');
  String get toolStopwatch => t('ساعة الإيقاف', 'Stopwatch');
  String get toolHijri => t('التقويم الهجري', 'Hijri Calendar');
  String get toolVat => t('الضريبة والخصم', 'VAT & Discount');
  String get toolUnits => t('محول الوحدات', 'Unit Converter');

  String get toolAgeDesc => t('سنوات، أشهر، أيام وعد تنازلي لميلادك', 'Years, months, days & next birthday');
  String get toolCalculatorDesc => t('حاسبة سريعة مع سجل', 'Quick calculator with history');
  String get toolCurrencyDesc => t('أسعار مباشرة للدرهم والريال والدولار', 'Live rates for AED, SAR, USD…');
  String get toolAlarmDesc => t('منبهات متكررة مع إشعارات', 'Repeating alarms with notifications');
  String get toolTimerDesc => t('عد تنازلي بإشعار عند الانتهاء', 'Countdown with finish notification');
  String get toolStopwatchDesc => t('توقيت دقيق مع لفّات', 'Precise timing with laps');
  String get toolHijriDesc => t('تحويل بين الهجري والميلادي', 'Convert Hijri ⇄ Gregorian');
  String get toolVatDesc => t('ضريبة القيمة المضافة والخصومات', 'VAT and discount math');
  String get toolUnitsDesc => t('طول، وزن، حرارة، مساحة…', 'Length, weight, temperature, area…');

  // ---- Common -----------------------------------------------------------
  String get calculate => t('احسب', 'Calculate');
  String get reset => t('إعادة', 'Reset');
  String get cancel => t('إلغاء', 'Cancel');
  String get save => t('حفظ', 'Save');
  String get delete => t('حذف', 'Delete');
  String get edit => t('تعديل', 'Edit');
  String get done => t('تم', 'Done');
  String get copy => t('نسخ', 'Copy');
  String get copied => t('تم النسخ', 'Copied');
  String get amount => t('المبلغ', 'Amount');
  String get result => t('النتيجة', 'Result');
  String get from => t('من', 'From');
  String get to => t('إلى', 'To');
  String get start => t('ابدأ', 'Start');
  String get pause => t('إيقاف مؤقت', 'Pause');
  String get resume => t('استئناف', 'Resume');
  String get stop => t('إيقاف', 'Stop');
  String get lap => t('لفّة', 'Lap');
  String get clear => t('مسح', 'Clear');
  String get selectTool => t('اختر أداة من القائمة', 'Select a tool from the list');
  String get error => t('حدث خطأ', 'Something went wrong');

  // ---- Age --------------------------------------------------------------
  String get ageTitle => t('حاسبة العمر الدقيقة', 'Precise Age Calculator');
  String get pickBirthDate => t('اختر تاريخ ميلادك', 'Pick your birth date');
  String get birthDate => t('تاريخ الميلاد', 'Birth date');
  String get changeDate => t('تغيير التاريخ', 'Change date');
  String get years => t('سنة', 'Years');
  String get months => t('شهر', 'Months');
  String get days => t('يوم', 'Days');
  String get nextBirthday => t('الميلاد القادم', 'Next birthday');
  String daysToBirthday(int d) => d == 0
      ? t('عيد ميلادك اليوم! 🎉', 'Happy birthday! 🎉')
      : t('متبقي $d يوماً على ميلادك القادم', '$d days until your next birthday');
  String get bornOn => t('وُلدت يوم', 'Born on a');
  String get totalDays => t('إجمالي الأيام', 'Total days');
  String get totalWeeks => t('إجمالي الأسابيع', 'Total weeks');
  String get totalMonths => t('إجمالي الأشهر', 'Total months');
  String get totalHours => t('إجمالي الساعات', 'Total hours');
  String get hijriBirthDate => t('ميلادك بالهجري', 'Hijri birth date');
  String get hijriAge => t('العمر الهجري', 'Hijri age');
  String get ageSummary => t('ملخص العمر', 'Age summary');
  String get detailedStats => t('إحصائيات تفصيلية', 'Detailed stats');

  // ---- Calculator -------------------------------------------------------
  String get calcHistory => t('السجل', 'History');
  String get calcNoHistory => t('لا توجد عمليات سابقة', 'No previous calculations');
  String get calcClearHistory => t('مسح السجل', 'Clear history');
  String get calcInvalid => t('خطأ', 'Error');

  // ---- Currency ---------------------------------------------------------
  String get currencyTitle => t('محول العملات', 'Currency Converter');
  String get currencyLive => t('أسعار مباشرة', 'Live rates');
  String get currencyOffline => t('أسعار تقريبية (بدون اتصال)', 'Approximate rates (offline)');
  String lastUpdated(String when) => t('آخر تحديث: $when', 'Updated: $when');
  String get refreshRates => t('تحديث الأسعار', 'Refresh rates');
  String get swap => t('تبديل', 'Swap');
  String get rateTable => t('جدول الأسعار', 'Rate table');
  String get fetchFailed => t('تعذر جلب الأسعار، تُعرض آخر نسخة محفوظة', 'Could not fetch rates; showing last saved');

  // ---- Alarm / timer / stopwatch --------------------------------------
  String get alarmsTitle => t('المنبهات', 'Alarms');
  String get noAlarms => t('لا توجد منبهات بعد', 'No alarms yet');
  String get addAlarm => t('إضافة منبه', 'Add alarm');
  String get editAlarm => t('تعديل المنبه', 'Edit alarm');
  String get alarmLabel => t('اسم المنبه', 'Label');
  String get alarmLabelHint => t('مثال: صلاة الفجر، اجتماع', 'e.g. Fajr, Meeting');
  String get repeat => t('التكرار', 'Repeat');
  String get once => t('مرة واحدة', 'Once');
  String get daily => t('يومياً', 'Daily');
  String get weekdays => t('أيام العمل', 'Weekdays');
  String get custom => t('مخصص', 'Custom');
  String get alarmSaved => t('تم حفظ المنبه', 'Alarm saved');
  String get alarmDeleted => t('تم حذف المنبه', 'Alarm deleted');
  String get alarmPermissionNeeded => t(
        'يحتاج المنبه إلى إذن الإشعارات والمنبهات الدقيقة ليعمل والتطبيق مغلق.',
        'Alarms need the notification and exact-alarm permissions to fire while the app is closed.',
      );
  String get grantPermission => t('منح الإذن', 'Grant permission');
  String ringsIn(String d) => t('يرن بعد $d', 'Rings in $d');
  String get alarmRinging => t('المنبه يرن الآن', 'Alarm ringing');
  String get timerTitle => t('المؤقت', 'Timer');
  String get timerFinished => t('انتهى المؤقت', 'Timer finished');
  String get timerFinishedBody => t('انتهى الوقت المحدد', 'Your countdown has ended');
  String get presets => t('اختصارات', 'Presets');
  String get hours => t('ساعة', 'h');
  String get minutes => t('دقيقة', 'min');
  String get seconds => t('ثانية', 'sec');
  String get stopwatchTitle => t('ساعة الإيقاف', 'Stopwatch');
  String get laps => t('اللفّات', 'Laps');

  // ---- Hijri ------------------------------------------------------------
  String get hijriTitle => t('التقويم الهجري', 'Hijri Calendar');
  String get gregToHijri => t('ميلادي ← هجري', 'Gregorian → Hijri');
  String get hijriToGreg => t('هجري ← ميلادي', 'Hijri → Gregorian');
  String get pickDate => t('اختر التاريخ', 'Pick a date');
  String get hijriDay => t('اليوم', 'Day');
  String get hijriMonth => t('الشهر', 'Month');
  String get hijriYear => t('السنة', 'Year');
  String get invalidHijri => t('تاريخ هجري غير صالح', 'Invalid Hijri date');
  String get todayIs => t('تاريخ اليوم', 'Today');
  String get upcomingOccasions => t('مناسبات قادمة', 'Upcoming occasions');
  String daysLeft(int d) => d == 0 ? t('اليوم', 'Today') : t('بعد $d يوماً', 'in $d days');

  // ---- VAT --------------------------------------------------------------
  String get vatTitle => t('الضريبة والخصم', 'VAT & Discount');
  String get vatTab => t('الضريبة', 'VAT');
  String get discountTab => t('الخصم', 'Discount');
  String get vatRate => t('نسبة الضريبة', 'VAT rate');
  String get amountExcl => t('المبلغ قبل الضريبة', 'Amount before VAT');
  String get amountIncl => t('المبلغ شامل الضريبة', 'Amount incl. VAT');
  String get vatAmount => t('قيمة الضريبة', 'VAT amount');
  String get addVat => t('إضافة ضريبة', 'Add VAT');
  String get removeVat => t('استخراج الضريبة', 'Extract VAT');
  String get originalPrice => t('السعر الأصلي', 'Original price');
  String get discountRate => t('نسبة الخصم', 'Discount %');
  String get youSave => t('توفّر', 'You save');
  String get finalPrice => t('السعر النهائي', 'Final price');

  // ---- Units ------------------------------------------------------------
  String get unitsTitle => t('محول الوحدات', 'Unit Converter');
  String get length => t('الطول', 'Length');
  String get weight => t('الوزن', 'Weight');
  String get temperature => t('الحرارة', 'Temperature');
  String get area => t('المساحة', 'Area');
  String get volume => t('الحجم', 'Volume');
  String get speed => t('السرعة', 'Speed');
  String get data => t('البيانات', 'Data');
  String get value => t('القيمة', 'Value');

  // ---- Settings ---------------------------------------------------------
  String get settingsTitle => t('الإعدادات', 'Settings');
  String get appearance => t('المظهر', 'Appearance');
  String get themeMode => t('وضع الألوان', 'Theme');
  String get themeSystem => t('تلقائي', 'Auto');
  String get themeLight => t('فاتح', 'Light');
  String get themeDark => t('داكن', 'Dark');
  String get language => t('اللغة', 'Language');
  String get arabic => 'العربية';
  String get english => 'English';
  String get digits => t('نمط الأرقام', 'Digit style');
  String get westernDigits => t('0123 (عالمية)', '0123 (Western)');
  String get easternDigits => t('٠١٢٣ (عربية)', '٠١٢٣ (Arabic-Indic)');
  String get defaults => t('الافتراضيات', 'Defaults');
  String get defaultCurrency => t('العملة الافتراضية', 'Default currency');
  String get defaultVat => t('نسبة الضريبة الافتراضية', 'Default VAT rate');
  String get notifications => t('التنبيهات', 'Notifications');
  String get notificationsPermission => t('إذن الإشعارات', 'Notification permission');
  String get exactAlarmPermission => t('إذن المنبهات الدقيقة', 'Exact alarm permission');
  String get granted => t('ممنوح', 'Granted');
  String get notGranted => t('غير ممنوح', 'Not granted');
  String get testNotification => t('إرسال إشعار تجريبي', 'Send test notification');
  String get about => t('حول التطبيق', 'About');
  String get version => t('الإصدار', 'Version');
  String get developedBy => t('تطوير', 'Developed by');
  String get hijriAdjust => t('تصحيح التاريخ الهجري', 'Hijri date adjustment');
  String get hijriAdjustHint => t('أضف أو اطرح يوماً ليتوافق مع الرؤية المحلية', 'Shift by a day to match local sighting');

  // ---- Weekdays (Mon..Sun) -------------------------------------------
  List<String> get weekdayShort => isArabic
      ? const ['إثن', 'ثلا', 'أرب', 'خمي', 'جمع', 'سبت', 'أحد']
      : const ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  List<String> get weekdayLong => isArabic
      ? const ['الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت', 'الأحد']
      : const ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
}
