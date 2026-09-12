import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_timezone/flutter_timezone.dart';
import 'package:timezone/data/latest_all.dart' as tzdata;
import 'package:timezone/timezone.dart' as tz;

/// Thin wrapper over flutter_local_notifications for alarms and timers.
class NotificationService {
  NotificationService._();
  static final NotificationService instance = NotificationService._();

  final _plugin = FlutterLocalNotificationsPlugin();
  bool _ready = false;

  static const alarmChannelId = 'mizan_alarms';
  static const timerChannelId = 'mizan_timers';
  static const timerNotificationId = 900000;

  /// Notifies listeners (the UI) when a notification is tapped.
  final ValueNotifier<String?> lastPayload = ValueNotifier<String?>(null);

  /// Notifications are Android-only; on other targets every call is a no-op.
  bool get _supported => !kIsWeb && defaultTargetPlatform == TargetPlatform.android;
  bool get _usable => _supported && _ready;

  Future<void> init() async {
    if (_ready || !_supported) return;
    tzdata.initializeTimeZones();
    try {
      final info = await FlutterTimezone.getLocalTimezone();
      tz.setLocalLocation(tz.getLocation(info.identifier));
    } catch (_) {
      tz.setLocalLocation(tz.UTC);
    }

    try {
      await _plugin.initialize(
        settings: const InitializationSettings(
          android: AndroidInitializationSettings('@drawable/ic_notification'),
        ),
        onDidReceiveNotificationResponse: (resp) => lastPayload.value = resp.payload,
      );
      _ready = true;
    } catch (e) {
      // Fall back to the launcher icon if the small icon is missing for any reason.
      debugPrint('Notification init failed ($e); retrying with launcher icon');
      await _plugin.initialize(
        settings: const InitializationSettings(
          android: AndroidInitializationSettings('@mipmap/ic_launcher'),
        ),
        onDidReceiveNotificationResponse: (resp) => lastPayload.value = resp.payload,
      );
      _ready = true;
    }
  }

  /// True once the plugin is initialised on a supported platform.
  bool get isReady => _ready;

  AndroidFlutterLocalNotificationsPlugin? get _android =>
      _plugin.resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>();

  Future<bool> requestPermissions() async {
    if (!_supported) return true;
    if (!_ready) await init();
    final android = _android;
    if (android == null) return false;
    final notif = await android.requestNotificationsPermission() ?? false;
    final exact = await android.canScheduleExactNotifications() ?? false;
    if (!exact) {
      await android.requestExactAlarmsPermission();
    }
    return notif;
  }

  Future<bool> notificationsGranted() async {
    if (!_supported) return true;
    if (!_ready) await init();
    return await _android?.areNotificationsEnabled() ?? false;
  }

  Future<bool> exactAlarmsGranted() async {
    if (!_supported) return true;
    if (!_ready) await init();
    return await _android?.canScheduleExactNotifications() ?? false;
  }

  NotificationDetails _alarmDetails({required bool ar}) => NotificationDetails(
        android: AndroidNotificationDetails(
          alarmChannelId,
          ar ? 'المنبهات' : 'Alarms',
          channelDescription: ar ? 'تنبيهات المنبه' : 'Alarm notifications',
          importance: Importance.max,
          priority: Priority.max,
          category: AndroidNotificationCategory.alarm,
          fullScreenIntent: true,
          playSound: true,
          enableVibration: true,
          audioAttributesUsage: AudioAttributesUsage.alarm,
          vibrationPattern: Int64List.fromList([0, 800, 400, 800, 400, 800]),
          visibility: NotificationVisibility.public,
          ticker: ar ? 'المنبه' : 'Alarm',
        ),
      );

  NotificationDetails _timerDetails({required bool ar}) => NotificationDetails(
        android: AndroidNotificationDetails(
          timerChannelId,
          ar ? 'المؤقت' : 'Timer',
          channelDescription: ar ? 'إشعار انتهاء المؤقت' : 'Timer finished notification',
          importance: Importance.max,
          priority: Priority.max,
          category: AndroidNotificationCategory.alarm,
          playSound: true,
          enableVibration: true,
          audioAttributesUsage: AudioAttributesUsage.alarm,
          visibility: NotificationVisibility.public,
        ),
      );

  /// Schedules an alarm.
  ///
  /// [weekdays] uses DateTime.monday..sunday. Empty → one-shot at the next
  /// occurrence of [time]. Each weekday gets its own notification id
  /// (`alarmId * 10 + weekday`).
  Future<void> scheduleAlarm({
    required int alarmId,
    required int hour,
    required int minute,
    required Set<int> weekdays,
    required String title,
    required String body,
    required bool ar,
  }) async {
    if (!_supported) return;
    if (!_ready) await init();
    if (!_usable) return;
    await cancelAlarm(alarmId);
    final details = _alarmDetails(ar: ar);
    if (weekdays.isEmpty) {
      await _plugin.zonedSchedule(
        id: alarmId * 10,
        title: title,
        body: body,
        scheduledDate: _nextInstance(hour, minute),
        notificationDetails: details,
        androidScheduleMode: AndroidScheduleMode.alarmClock,
        payload: 'alarm:$alarmId',
      );
      return;
    }
    for (final wd in weekdays) {
      await _plugin.zonedSchedule(
        id: alarmId * 10 + wd,
        title: title,
        body: body,
        scheduledDate: _nextInstanceOfWeekday(hour, minute, wd),
        notificationDetails: details,
        androidScheduleMode: AndroidScheduleMode.alarmClock,
        matchDateTimeComponents: DateTimeComponents.dayOfWeekAndTime,
        payload: 'alarm:$alarmId',
      );
    }
  }

  Future<void> cancelAlarm(int alarmId) async {
    if (!_supported) return;
    if (!_ready) await init();
    if (!_usable) return;
    for (var i = 0; i <= 7; i++) {
      await _plugin.cancel(id: alarmId * 10 + i);
    }
  }

  Future<void> scheduleTimer(Duration d, {required bool ar, required String title, required String body}) async {
    if (!_supported) return;
    if (!_ready) await init();
    if (!_usable) return;
    await cancelTimer();
    final when = tz.TZDateTime.now(tz.local).add(d);
    await _plugin.zonedSchedule(
      id: timerNotificationId,
      title: title,
      body: body,
      scheduledDate: when,
      notificationDetails: _timerDetails(ar: ar),
      androidScheduleMode: AndroidScheduleMode.alarmClock,
      payload: 'timer',
    );
  }

  Future<void> cancelTimer() async {
    if (!_supported) return;
    if (!_ready) await init();
    if (!_usable) return;
    await _plugin.cancel(id: timerNotificationId);
  }

  Future<void> showTest({required bool ar}) async {
    if (!_supported) return;
    if (!_ready) await init();
    if (!_usable) return;
    await _plugin.show(
        id: 1,
        title: ar ? 'ميزان' : 'Mizan',
        body: ar ? 'الإشعارات تعمل بشكل صحيح ✅' : 'Notifications are working ✅',
        notificationDetails: _timerDetails(ar: ar),
      );
  }

  tz.TZDateTime _nextInstance(int hour, int minute) {
    final now = tz.TZDateTime.now(tz.local);
    var t = tz.TZDateTime(tz.local, now.year, now.month, now.day, hour, minute);
    if (!t.isAfter(now)) t = t.add(const Duration(days: 1));
    return t;
  }

  tz.TZDateTime _nextInstanceOfWeekday(int hour, int minute, int weekday) {
    var t = _nextInstance(hour, minute);
    while (t.weekday != weekday) {
      t = t.add(const Duration(days: 1));
    }
    return t;
  }
}
