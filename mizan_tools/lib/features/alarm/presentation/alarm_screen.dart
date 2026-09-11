import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../../../core/constants/colors.dart';
import '../../../core/l10n/strings.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/utils/responsive.dart';
import '../../../services/alarm_store.dart';
import '../../../services/notification_service.dart';
import '../../../services/settings_service.dart';
import '../../../shared/widgets/custom_card.dart';

enum AlarmTab { alarms, timer, stopwatch }

class AlarmScreen extends StatefulWidget {
  const AlarmScreen({super.key, this.initialTab = AlarmTab.alarms});
  final AlarmTab initialTab;

  @override
  State<AlarmScreen> createState() => _AlarmScreenState();
}

class _AlarmScreenState extends State<AlarmScreen> with SingleTickerProviderStateMixin {
  late final TabController _tabs;

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 3, vsync: this, initialIndex: widget.initialTab.index);
  }

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final s = S.of(context);
    return Scaffold(
      appBar: AppBar(
        title: Text(s.toolAlarm),
        bottom: TabBar(
          controller: _tabs,
          tabs: [
            Tab(icon: const Icon(Icons.alarm_rounded), text: s.alarmsTitle),
            Tab(icon: const Icon(Icons.hourglass_bottom_rounded), text: s.timerTitle),
            Tab(icon: const Icon(Icons.timer_rounded), text: s.stopwatchTitle),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabs,
        children: const [_AlarmsTab(), _TimerTab(), _StopwatchTab()],
      ),
    );
  }
}

// =============================================================================
// Alarms
// =============================================================================

class _AlarmsTab extends StatefulWidget {
  const _AlarmsTab();

  @override
  State<_AlarmsTab> createState() => _AlarmsTabState();
}

class _AlarmsTabState extends State<_AlarmsTab> {
  bool? _notifGranted;
  bool? _exactGranted;
  Timer? _ticker;

  @override
  void initState() {
    super.initState();
    _checkPermissions();
    _ticker = Timer.periodic(const Duration(seconds: 30), (_) => setState(() {}));
  }

  @override
  void dispose() {
    _ticker?.cancel();
    super.dispose();
  }

  Future<void> _checkPermissions() async {
    final n = NotificationService.instance;
    final a = await n.notificationsGranted();
    final b = await n.exactAlarmsGranted();
    if (!mounted) return;
    setState(() {
      _notifGranted = a;
      _exactGranted = b;
    });
  }

  Future<void> _requestPermissions() async {
    await NotificationService.instance.requestPermissions();
    await _checkPermissions();
  }

  Future<void> _add() async {
    final now = TimeOfDay.now();
    final t = await showTimePicker(context: context, initialTime: now);
    if (t == null || !mounted) return;
    final store = context.read<AlarmStore>();
    final alarm = store.newAlarm(t);
    await _editSheet(alarm, isNew: true);
  }

  Future<void> _editSheet(Alarm alarm, {bool isNew = false}) async {
    final s = S.of(context);
    final settings = context.read<SettingsService>();
    final store = context.read<AlarmStore>();
    final result = await showModalBottomSheet<Alarm>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => _AlarmEditor(alarm: alarm, isNew: isNew),
    );
    if (result == null || !mounted) return;
    await store.upsert(result, ar: settings.isArabic, defaultTitle: s.toolAlarm);
    if (!mounted) return;
    if (_notifGranted != true || _exactGranted != true) await _requestPermissions();
    if (!mounted) return;
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(s.alarmSaved)));
  }

  @override
  Widget build(BuildContext context) {
    final s = S.of(context);
    final settings = context.watch<SettingsService>();
    final store = context.watch<AlarmStore>();
    final scheme = Theme.of(context).colorScheme;
    final ar = settings.isArabic;
    String d(String v) => Fmt.digits(v, eastern: settings.easternDigits);
    final needsPermission = _notifGranted == false || _exactGranted == false;

    return Scaffold(
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _add,
        icon: const Icon(Icons.add_alarm_rounded),
        label: Text(s.addAlarm),
      ),
      body: ContentConstraint(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 96),
          children: [
            if (needsPermission)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: CustomCard(
                  color: scheme.errorContainer.withValues(alpha: 0.35),
                  borderColor: scheme.error.withValues(alpha: 0.4),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Icon(Icons.notifications_off_outlined, color: scheme.error),
                          const SizedBox(width: 10),
                          Expanded(child: Text(s.alarmPermissionNeeded, style: const TextStyle(fontSize: 13))),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Align(
                        alignment: AlignmentDirectional.centerEnd,
                        child: FilledButton.tonal(
                          style: FilledButton.styleFrom(minimumSize: const Size(0, 40)),
                          onPressed: _requestPermissions,
                          child: Text(s.grantPermission),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            if (store.alarms.isEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 80),
                child: Column(
                  children: [
                    Icon(Icons.alarm_off_rounded, size: 72, color: scheme.outline),
                    const SizedBox(height: 12),
                    Text(s.noAlarms, style: TextStyle(color: scheme.onSurfaceVariant)),
                  ],
                ),
              ),
            for (final a in store.alarms)
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Dismissible(
                  key: ValueKey('alarm-${a.id}'),
                  direction: DismissDirection.endToStart,
                  background: Container(
                    alignment: AlignmentDirectional.centerEnd,
                    padding: const EdgeInsets.symmetric(horizontal: 20),
                    decoration: BoxDecoration(color: scheme.error, borderRadius: BorderRadius.circular(18)),
                    child: Icon(Icons.delete_outline_rounded, color: scheme.onError),
                  ),
                  onDismissed: (_) {
                    store.remove(a);
                    ScaffoldMessenger.of(context)
                      ..hideCurrentSnackBar()
                      ..showSnackBar(SnackBar(content: Text(s.alarmDeleted)));
                  },
                  child: CustomCard(
                    onTap: () => _editSheet(a),
                    padding: const EdgeInsets.fromLTRB(16, 12, 8, 12),
                    child: Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                d(Fmt.timeOfDay(a.time, ar: ar)),
                                style: TextStyle(
                                  fontSize: 30,
                                  fontWeight: FontWeight.w700,
                                  color: a.enabled ? scheme.onSurface : scheme.outline,
                                  height: 1.1,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                [
                                  if (a.label.trim().isNotEmpty) a.label.trim(),
                                  _repeatText(a, s),
                                  if (a.enabled && a.nextRing() != null)
                                    s.ringsIn(Fmt.durationWords(a.nextRing()!.difference(DateTime.now()), ar: ar)),
                                ].join(' · '),
                                style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 13),
                              ),
                            ],
                          ),
                        ),
                        Switch(
                          value: a.enabled,
                          onChanged: (v) async {
                            await store.setEnabled(a, v, ar: ar, defaultTitle: s.toolAlarm);
                            if (v && needsPermission) await _requestPermissions();
                          },
                        ),
                      ],
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  String _repeatText(Alarm a, S s) {
    if (a.weekdays.isEmpty) return s.once;
    if (a.weekdays.length == 7) return s.daily;
    final sorted = a.weekdays.toList()..sort();
    return sorted.map((w) => s.weekdayShort[w - 1]).join('، ');
  }
}

class _AlarmEditor extends StatefulWidget {
  const _AlarmEditor({required this.alarm, required this.isNew});
  final Alarm alarm;
  final bool isNew;

  @override
  State<_AlarmEditor> createState() => _AlarmEditorState();
}

class _AlarmEditorState extends State<_AlarmEditor> {
  late TimeOfDay _time;
  late Set<int> _days;
  late final TextEditingController _label;

  @override
  void initState() {
    super.initState();
    _time = widget.alarm.time;
    _days = Set.of(widget.alarm.weekdays);
    _label = TextEditingController(text: widget.alarm.label);
  }

  @override
  void dispose() {
    _label.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final s = S.of(context);
    final settings = context.watch<SettingsService>();
    final ar = settings.isArabic;
    final scheme = Theme.of(context).colorScheme;
    final weekdaysSet = {DateTime.sunday, DateTime.monday, DateTime.tuesday, DateTime.wednesday, DateTime.thursday};

    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: ContentConstraint(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(widget.isNew ? s.addAlarm : s.editAlarm, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
              const SizedBox(height: 12),
              Center(
                child: InkWell(
                  borderRadius: BorderRadius.circular(16),
                  onTap: () async {
                    final t = await showTimePicker(context: context, initialTime: _time);
                    if (t != null) setState(() => _time = t);
                  },
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 8),
                    child: Text(
                      Fmt.digits(Fmt.timeOfDay(_time, ar: ar), eastern: settings.easternDigits),
                      style: TextStyle(fontSize: 52, fontWeight: FontWeight.w700, color: scheme.primary, height: 1.1),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: _label,
                textInputAction: TextInputAction.done,
                decoration: InputDecoration(labelText: s.alarmLabel, hintText: s.alarmLabelHint, prefixIcon: const Icon(Icons.label_outline_rounded)),
              ),
              const SizedBox(height: 16),
              Text(s.repeat, style: const TextStyle(fontWeight: FontWeight.w700)),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  ChoiceChip(label: Text(s.once), selected: _days.isEmpty, onSelected: (_) => setState(() => _days = {})),
                  ChoiceChip(label: Text(s.daily), selected: _days.length == 7, onSelected: (_) => setState(() => _days = {1, 2, 3, 4, 5, 6, 7})),
                  ChoiceChip(
                    label: Text(s.weekdays),
                    selected: _days.length == 5 && _days.containsAll(weekdaysSet),
                    onSelected: (_) => setState(() => _days = Set.of(weekdaysSet)),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  for (var w = 1; w <= 7; w++) ...[
                    Expanded(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 2),
                        child: FilterChip(
                          showCheckmark: false,
                          padding: EdgeInsets.zero,
                          labelPadding: const EdgeInsets.symmetric(horizontal: 4),
                          label: SizedBox(width: double.infinity, child: Text(s.weekdayShort[w - 1], textAlign: TextAlign.center, style: const TextStyle(fontSize: 11))),
                          selected: _days.contains(w),
                          onSelected: (v) => setState(() => v ? _days.add(w) : _days.remove(w)),
                        ),
                      ),
                    ),
                  ],
                ],
              ),
              const SizedBox(height: 20),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(onPressed: () => Navigator.pop(context), child: Text(s.cancel)),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    flex: 2,
                    child: FilledButton(
                      style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48)),
                      onPressed: () {
                        final a = widget.alarm
                          ..hour = _time.hour
                          ..minute = _time.minute
                          ..label = _label.text
                          ..weekdays = _days
                          ..enabled = true;
                        Navigator.pop(context, a);
                      },
                      child: Text(s.save),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// =============================================================================
// Timer (state survives navigation via a process-wide controller)
// =============================================================================

class TimerController extends ChangeNotifier {
  TimerController._();
  static final TimerController instance = TimerController._();

  Duration total = const Duration(minutes: 5);
  Duration remaining = const Duration(minutes: 5);
  bool running = false;
  bool finished = false;
  DateTime? _endAt;
  Timer? _ticker;

  void setTotal(Duration d) {
    if (running) return;
    total = d;
    remaining = d;
    finished = false;
    notifyListeners();
  }

  Future<void> start({required bool ar, required String title, required String body}) async {
    if (remaining <= Duration.zero) return;
    running = true;
    finished = false;
    _endAt = DateTime.now().add(remaining);
    await NotificationService.instance.scheduleTimer(remaining, ar: ar, title: title, body: body);
    _ticker?.cancel();
    _ticker = Timer.periodic(const Duration(milliseconds: 250), (_) => _tick());
    notifyListeners();
  }

  void _tick() {
    final end = _endAt;
    if (end == null) return;
    final left = end.difference(DateTime.now());
    if (left <= Duration.zero) {
      remaining = Duration.zero;
      running = false;
      finished = true;
      _ticker?.cancel();
      HapticFeedback.heavyImpact();
    } else {
      remaining = left;
    }
    notifyListeners();
  }

  Future<void> pause() async {
    _ticker?.cancel();
    running = false;
    await NotificationService.instance.cancelTimer();
    notifyListeners();
  }

  Future<void> reset() async {
    _ticker?.cancel();
    running = false;
    finished = false;
    remaining = total;
    await NotificationService.instance.cancelTimer();
    notifyListeners();
  }
}

class _TimerTab extends StatefulWidget {
  const _TimerTab();

  @override
  State<_TimerTab> createState() => _TimerTabState();
}

class _TimerTabState extends State<_TimerTab> {
  final _ctrl = TimerController.instance;

  @override
  Widget build(BuildContext context) {
    final s = S.of(context);
    final settings = context.watch<SettingsService>();
    final ar = settings.isArabic;
    final scheme = Theme.of(context).colorScheme;
    String d(String v) => Fmt.digits(v, eastern: settings.easternDigits);

    return ListenableBuilder(
      listenable: _ctrl,
      builder: (context, _) {
        final progress = _ctrl.total.inMilliseconds == 0 ? 0.0 : _ctrl.remaining.inMilliseconds / _ctrl.total.inMilliseconds;
        return ContentConstraint(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
            children: [
              Center(
                child: SizedBox(
                  width: 240,
                  height: 240,
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      CircularProgressIndicator(
                        value: progress.clamp(0, 1),
                        strokeWidth: 12,
                        strokeCap: StrokeCap.round,
                        backgroundColor: scheme.surfaceContainerHighest,
                        color: _ctrl.finished ? AppColors.stopwatch : AppColors.timer,
                      ),
                      Center(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              d(Fmt.duration(_ctrl.remaining, showHours: _ctrl.total.inHours > 0)),
                              style: const TextStyle(fontSize: 44, fontWeight: FontWeight.w700, fontFeatures: [FontFeature.tabularFigures()]),
                            ),
                            if (_ctrl.finished)
                              Text(s.timerFinished, style: TextStyle(color: AppColors.stopwatch, fontWeight: FontWeight.w700)),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 24),
              if (!_ctrl.running && !_ctrl.finished) ...[
                _DurationPicker(value: _ctrl.total, onChanged: _ctrl.setTotal),
                const SizedBox(height: 12),
                SectionHeader(s.presets),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    for (final m in const [1, 3, 5, 10, 15, 20, 30, 45, 60])
                      ActionChip(
                        label: Text(d(m < 60 ? '$m ${s.minutes}' : '1 ${s.hours}')),
                        onPressed: () => _ctrl.setTotal(Duration(minutes: m)),
                      ),
                  ],
                ),
              ],
              const SizedBox(height: 24),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: _ctrl.reset,
                      icon: const Icon(Icons.replay_rounded),
                      label: Text(s.reset),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    flex: 2,
                    child: FilledButton.icon(
                      style: FilledButton.styleFrom(backgroundColor: _ctrl.running ? AppColors.alarm : AppColors.timer),
                      onPressed: _ctrl.finished
                          ? _ctrl.reset
                          : () async {
                              if (_ctrl.running) {
                                await _ctrl.pause();
                              } else {
                                await NotificationService.instance.requestPermissions();
                                await _ctrl.start(ar: ar, title: s.timerFinished, body: s.timerFinishedBody);
                              }
                            },
                      icon: Icon(_ctrl.running ? Icons.pause_rounded : Icons.play_arrow_rounded),
                      label: Text(_ctrl.finished ? s.done : (_ctrl.running ? s.pause : (_ctrl.remaining < _ctrl.total ? s.resume : s.start))),
                    ),
                  ),
                ],
              ),
            ],
          ),
        );
      },
    );
  }
}

class _DurationPicker extends StatelessWidget {
  const _DurationPicker({required this.value, required this.onChanged});
  final Duration value;
  final ValueChanged<Duration> onChanged;

  @override
  Widget build(BuildContext context) {
    final s = S.of(context);
    final h = value.inHours;
    final m = value.inMinutes.remainder(60);
    final sec = value.inSeconds.remainder(60);
    return CustomCard(
      padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 8),
      child: Row(
        children: [
          Expanded(child: _Spinner(label: s.hours, value: h, max: 23, onChanged: (v) => onChanged(Duration(hours: v, minutes: m, seconds: sec)))),
          Expanded(child: _Spinner(label: s.minutes, value: m, max: 59, onChanged: (v) => onChanged(Duration(hours: h, minutes: v, seconds: sec)))),
          Expanded(child: _Spinner(label: s.seconds, value: sec, max: 59, onChanged: (v) => onChanged(Duration(hours: h, minutes: m, seconds: v)))),
        ],
      ),
    );
  }
}

class _Spinner extends StatelessWidget {
  const _Spinner({required this.label, required this.value, required this.max, required this.onChanged});
  final String label;
  final int value;
  final int max;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    final settings = context.watch<SettingsService>();
    final scheme = Theme.of(context).colorScheme;
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        IconButton(onPressed: () => onChanged(value >= max ? 0 : value + 1), icon: const Icon(Icons.keyboard_arrow_up_rounded)),
        Text(
          Fmt.digits(Fmt.two(value), eastern: settings.easternDigits),
          style: const TextStyle(fontSize: 30, fontWeight: FontWeight.w700, fontFeatures: [FontFeature.tabularFigures()]),
        ),
        Text(label, style: TextStyle(fontSize: 12, color: scheme.onSurfaceVariant)),
        IconButton(onPressed: () => onChanged(value <= 0 ? max : value - 1), icon: const Icon(Icons.keyboard_arrow_down_rounded)),
      ],
    );
  }
}

// =============================================================================
// Stopwatch
// =============================================================================

class StopwatchController extends ChangeNotifier {
  StopwatchController._();
  static final StopwatchController instance = StopwatchController._();

  final Stopwatch _sw = Stopwatch();
  final List<Duration> laps = [];
  Timer? _ticker;

  bool get running => _sw.isRunning;
  Duration get elapsed => _sw.elapsed;
  bool get hasStarted => _sw.elapsedMilliseconds > 0 || _sw.isRunning;

  void start() {
    _sw.start();
    _ticker?.cancel();
    _ticker = Timer.periodic(const Duration(milliseconds: 50), (_) => notifyListeners());
    notifyListeners();
  }

  void pause() {
    _sw.stop();
    _ticker?.cancel();
    notifyListeners();
  }

  void reset() {
    _sw.stop();
    _sw.reset();
    _ticker?.cancel();
    laps.clear();
    notifyListeners();
  }

  void lap() {
    laps.insert(0, _sw.elapsed);
    notifyListeners();
  }
}

class _StopwatchTab extends StatelessWidget {
  const _StopwatchTab();

  static String _fmt(Duration d) {
    final h = d.inHours;
    final m = d.inMinutes.remainder(60);
    final s = d.inSeconds.remainder(60);
    final cs = (d.inMilliseconds.remainder(1000) ~/ 10);
    final head = h > 0 ? '${Fmt.two(h)}:${Fmt.two(m)}:${Fmt.two(s)}' : '${Fmt.two(m)}:${Fmt.two(s)}';
    return '$head.${Fmt.two(cs)}';
  }

  @override
  Widget build(BuildContext context) {
    final s = S.of(context);
    final settings = context.watch<SettingsService>();
    final scheme = Theme.of(context).colorScheme;
    final ctrl = StopwatchController.instance;
    String d(String v) => Fmt.digits(v, eastern: settings.easternDigits);

    return ListenableBuilder(
      listenable: ctrl,
      builder: (context, _) {
        return ContentConstraint(
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 32, 16, 16),
                child: Directionality(
                  textDirection: TextDirection.ltr,
                  child: Text(
                    d(_fmt(ctrl.elapsed)),
                    style: TextStyle(
                      fontSize: 58,
                      fontWeight: FontWeight.w700,
                      color: ctrl.running ? AppColors.stopwatch : scheme.onSurface,
                      fontFeatures: const [FontFeature.tabularFigures()],
                    ),
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: ctrl.hasStarted ? (ctrl.running ? ctrl.lap : ctrl.reset) : null,
                        icon: Icon(ctrl.running ? Icons.flag_rounded : Icons.replay_rounded),
                        label: Text(ctrl.running ? s.lap : s.reset),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      flex: 2,
                      child: FilledButton.icon(
                        style: FilledButton.styleFrom(backgroundColor: ctrl.running ? AppColors.alarm : AppColors.stopwatch),
                        onPressed: ctrl.running ? ctrl.pause : ctrl.start,
                        icon: Icon(ctrl.running ? Icons.pause_rounded : Icons.play_arrow_rounded),
                        label: Text(ctrl.running ? s.pause : (ctrl.hasStarted ? s.resume : s.start)),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              if (ctrl.laps.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: SectionHeader(s.laps),
                ),
              Expanded(
                child: ListView.builder(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                  itemCount: ctrl.laps.length,
                  itemBuilder: (context, i) {
                    final idx = ctrl.laps.length - i;
                    final lapTime = ctrl.laps[i];
                    final prev = i + 1 < ctrl.laps.length ? ctrl.laps[i + 1] : Duration.zero;
                    final split = lapTime - prev;
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: CustomCard(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                        child: Row(
                          children: [
                            CircleAvatar(
                              radius: 14,
                              backgroundColor: AppColors.stopwatch.withValues(alpha: 0.15),
                              child: Text(d('$idx'), style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.stopwatch)),
                            ),
                            const SizedBox(width: 12),
                            Expanded(child: Text(d(_fmt(split)), style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 18, fontFeatures: [FontFeature.tabularFigures()]))),
                            Text(d(_fmt(lapTime)), style: TextStyle(color: scheme.onSurfaceVariant, fontFeatures: const [FontFeature.tabularFigures()])),
                          ],
                        ),
                      ),
                    );
                  },
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
