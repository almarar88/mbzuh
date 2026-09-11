import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:math_expressions/math_expressions.dart';
import 'package:provider/provider.dart';

import '../../../core/l10n/strings.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/responsive.dart';
import '../../../services/settings_service.dart';
import '../../../shared/widgets/glass.dart';

/// Expression calculator: shows the running expression, a live preview of the
/// result, and keeps a persisted history.
class CalculatorScreen extends StatefulWidget {
  const CalculatorScreen({super.key});

  @override
  State<CalculatorScreen> createState() => _CalculatorScreenState();
}

class _CalculatorScreenState extends State<CalculatorScreen> {
  String _expr = '';
  String? _preview;
  bool _justEvaluated = false;

  static const _ops = {'+', '−', '×', '÷'};

  bool get _endsWithOp => _expr.isNotEmpty && _ops.contains(_expr[_expr.length - 1]);

  void _tap(String key) {
    HapticFeedback.selectionClick();
    setState(() {
      if (_justEvaluated && !_ops.contains(key) && key != '%') {
        _expr = '';
      }
      _justEvaluated = false;
      if (key == '.') {
        final lastNum = RegExp(r'[\d.]+$').firstMatch(_expr)?.group(0) ?? '';
        if (lastNum.contains('.')) return;
        _expr += lastNum.isEmpty ? '0.' : '.';
      } else if (_ops.contains(key)) {
        if (_expr.isEmpty) {
          if (key == '−') _expr = '−';
          return;
        }
        if (_endsWithOp) {
          _expr = _expr.substring(0, _expr.length - 1) + key;
        } else {
          _expr += key;
        }
      } else if (key == '%') {
        if (_expr.isEmpty || _endsWithOp) return;
        _expr += '%';
      } else if (key == '( )') {
        final open = '('.allMatches(_expr).length;
        final close = ')'.allMatches(_expr).length;
        final lastIsDigit = _expr.isNotEmpty && RegExp(r'[\d.)%]$').hasMatch(_expr);
        if (open > close && lastIsDigit) {
          _expr += ')';
        } else {
          if (lastIsDigit) _expr += '×';
          _expr += '(';
        }
      } else {
        _expr += key;
      }
      _preview = _safeEval(_expr);
    });
  }

  void _backspace() {
    HapticFeedback.selectionClick();
    setState(() {
      if (_expr.isNotEmpty) _expr = _expr.substring(0, _expr.length - 1);
      _justEvaluated = false;
      _preview = _safeEval(_expr);
    });
  }

  void _clear() {
    HapticFeedback.lightImpact();
    setState(() {
      _expr = '';
      _preview = null;
      _justEvaluated = false;
    });
  }

  void _equals() {
    if (_expr.isEmpty) return;
    HapticFeedback.mediumImpact();
    final value = _safeEval(_expr);
    if (value == null) {
      setState(() => _preview = S.of(context).calcInvalid);
      return;
    }
    context.read<SettingsService>().addCalcHistory('$_expr = $value');
    setState(() {
      _expr = value;
      _preview = null;
      _justEvaluated = true;
    });
  }

  /// Converts the display expression to a parser-friendly one and evaluates.
  String? _safeEval(String display) {
    if (display.isEmpty) return null;
    var e = display.replaceAll('×', '*').replaceAll('÷', '/').replaceAll('−', '-');
    // Percent: "50%" → "(50/100)"
    e = e.replaceAllMapped(RegExp(r'(\d+(?:\.\d+)?)%'), (m) => '(${m[1]}/100)');
    // Balance parentheses.
    final open = '('.allMatches(e).length;
    final close = ')'.allMatches(e).length;
    if (open > close) e += ')' * (open - close);
    // Trim trailing operator for the live preview.
    e = e.replaceFirst(RegExp(r'[+\-*/]$'), '');
    if (e.isEmpty) return null;
    try {
      final parsed = GrammarParser().parse(e);
      final value = RealEvaluator(ContextModel()).evaluate(parsed);
      if (value.isNaN || value.isInfinite) return null;
      return Fmt.plain(value);
    } catch (_) {
      return null;
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = S.of(context);
    final settings = context.watch<SettingsService>();
    final scheme = Theme.of(context).colorScheme;
    String d(String v) => Fmt.digits(v, eastern: settings.easternDigits);

    final display = Column(
      children: [
        Expanded(
          child: Container(
            alignment: Alignment.bottomRight,
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 12),
            child: Directionality(
              textDirection: TextDirection.ltr,
              child: Column(
                mainAxisAlignment: MainAxisAlignment.end,
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    reverse: true,
                    child: Text(
                      _expr.isEmpty ? '0' : d(_expr),
                      style: TextStyle(
                        fontSize: _expr.length > 14 ? 34 : 56,
                        fontWeight: FontWeight.w300,
                        color: scheme.onSurface,
                        height: 1.1,
                        fontFeatures: const [FontFeature.tabularFigures()],
                      ),
                    ),
                  ),
                  const SizedBox(height: 4),
                  AnimatedOpacity(
                    duration: const Duration(milliseconds: 150),
                    opacity: _preview == null ? 0 : 1,
                    child: Text(
                      _preview == null ? '' : '= ${d(_preview!)}',
                      style: TextStyle(fontSize: 22, color: scheme.primary, fontWeight: FontWeight.w500),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
        _Keypad(onKey: _tap, onClear: _clear, onBackspace: _backspace, onEquals: _equals, digits: d),
      ],
    );

    return GlassScaffold(
      appBar: GlassAppBar(
        title: Text(s.toolCalculator),
        actions: [
          if (Responsive.isCompact(context))
            IconButton(
              tooltip: s.calcHistory,
              icon: const Icon(Icons.history_rounded),
              onPressed: () => showModalBottomSheet<void>(
                context: context,
                showDragHandle: true,
                builder: (_) => SizedBox(height: 380, child: _HistoryPanel(digits: d, onPick: (v) {
                  setState(() {
                    _expr = v;
                    _preview = null;
                    _justEvaluated = true;
                  });
                })),
              ),
            ),
        ],
      ),
      body: Responsive.isCompact(context)
          ? display
          : Row(
              children: [
                Expanded(flex: 3, child: display),
                const VerticalDivider(width: 1),
                Expanded(
                  flex: 2,
                  child: _HistoryPanel(
                    digits: d,
                    onPick: (v) => setState(() {
                      _expr = v;
                      _preview = null;
                      _justEvaluated = true;
                    }),
                  ),
                ),
              ],
            ),
    );
  }
}

class _Keypad extends StatelessWidget {
  const _Keypad({
    required this.onKey,
    required this.onClear,
    required this.onBackspace,
    required this.onEquals,
    required this.digits,
  });

  final void Function(String) onKey;
  final VoidCallback onClear;
  final VoidCallback onBackspace;
  final VoidCallback onEquals;
  final String Function(String) digits;

  @override
  Widget build(BuildContext context) {
    final rows = <List<_Key>>[
      [_Key('C', kind: _KeyKind.function), _Key('( )', kind: _KeyKind.function), _Key('%', kind: _KeyKind.function), _Key('÷', kind: _KeyKind.op)],
      [_Key('7'), _Key('8'), _Key('9'), _Key('×', kind: _KeyKind.op)],
      [_Key('4'), _Key('5'), _Key('6'), _Key('−', kind: _KeyKind.op)],
      [_Key('1'), _Key('2'), _Key('3'), _Key('+', kind: _KeyKind.op)],
      [_Key('⌫', kind: _KeyKind.function), _Key('0'), _Key('.'), _Key('=', kind: _KeyKind.op)],
    ];
    const gap = 12.0;
    return Directionality(
      textDirection: TextDirection.ltr,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
        child: LayoutBuilder(
          builder: (context, c) {
            final byWidth = (c.maxWidth - 3 * gap) / 4;
            final maxH = MediaQuery.sizeOf(context).height * 0.58;
            final byHeight = (maxH - 4 * gap) / 5;
            final key = byWidth.clamp(44.0, 88.0).clamp(0.0, byHeight < 44 ? 44.0 : byHeight);
            return Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                for (var r = 0; r < rows.length; r++)
                  Padding(
                    padding: EdgeInsets.only(bottom: r == rows.length - 1 ? 0 : gap),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        for (final k in rows[r])
                          SizedBox(
                            width: byWidth,
                            child: Center(
                              child: _KeyButton(
                                k: k,
                                size: key,
                                label: RegExp(r'^\d$').hasMatch(k.label) ? digits(k.label) : k.label,
                                onTap: () {
                                  switch (k.label) {
                                    case 'C':
                                      onClear();
                                    case '⌫':
                                      onBackspace();
                                    case '=':
                                      onEquals();
                                    default:
                                      onKey(k.label);
                                  }
                                },
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
              ],
            );
          },
        ),
      ),
    );
  }
}

enum _KeyKind { digit, op, function }

class _Key {
  const _Key(this.label, {this.kind = _KeyKind.digit});
  final String label;
  final _KeyKind kind;
}

/// iOS-style circular calculator key.
class _KeyButton extends StatelessWidget {
  const _KeyButton({required this.k, required this.label, required this.onTap, required this.size});
  final _Key k;
  final String label;
  final VoidCallback onTap;
  final double size;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final g = GlassTheme.of(context);
    final (bg, fg) = switch (k.kind) {
      _KeyKind.digit => (g.keyDigit, Theme.of(context).brightness == Brightness.dark ? Colors.white : Colors.black),
      _KeyKind.function => (g.keyFunction, g.onKeyFunction),
      _KeyKind.op => (scheme.primary, Colors.white),
    };
    final isIcon = k.label == '⌫';
    return SizedBox(
      width: size,
      height: size,
      child: Material(
        color: bg,
        shape: const CircleBorder(),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          customBorder: const CircleBorder(),
          child: Center(
            child: isIcon
                ? Icon(Icons.backspace_outlined, color: fg, size: size * 0.34)
                : Text(
                    label,
                    style: TextStyle(
                      fontSize: k.kind == _KeyKind.digit ? size * 0.40 : size * 0.44,
                      fontWeight: k.kind == _KeyKind.digit ? FontWeight.w500 : FontWeight.w700,
                      color: fg,
                      height: 1,
                    ),
                  ),
          ),
        ),
      ),
    );
  }
}

class _HistoryPanel extends StatelessWidget {
  const _HistoryPanel({required this.digits, this.onPick});
  final String Function(String) digits;
  final void Function(String value)? onPick;

  @override
  Widget build(BuildContext context) {
    final s = S.of(context);
    final settings = context.watch<SettingsService>();
    final scheme = Theme.of(context).colorScheme;
    final items = settings.calcHistory;
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 8, 0),
          child: Row(
            children: [
              Expanded(child: Text(s.calcHistory, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16))),
              if (items.isNotEmpty)
                TextButton.icon(
                  onPressed: settings.clearCalcHistory,
                  icon: const Icon(Icons.delete_sweep_outlined, size: 20),
                  label: Text(s.calcClearHistory),
                ),
            ],
          ),
        ),
        Expanded(
          child: items.isEmpty
              ? Center(child: Text(s.calcNoHistory, style: TextStyle(color: scheme.onSurfaceVariant)))
              : ListView.separated(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  itemCount: items.length,
                  separatorBuilder: (_, _) => const Divider(height: 1),
                  itemBuilder: (context, i) {
                    final parts = items[i].split(' = ');
                    final expr = parts.first;
                    final val = parts.length > 1 ? parts.last : '';
                    return ListTile(
                      dense: true,
                      onTap: onPick == null ? null : () {
                        onPick!(val);
                        if (Navigator.of(context).canPop() && Responsive.isCompact(context)) Navigator.of(context).pop();
                      },
                      onLongPress: () {
                        Clipboard.setData(ClipboardData(text: val));
                        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(s.copied)));
                      },
                      title: Directionality(
                        textDirection: TextDirection.ltr,
                        child: Text(digits(expr), textAlign: TextAlign.right, style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 14)),
                      ),
                      subtitle: Directionality(
                        textDirection: TextDirection.ltr,
                        child: Text('= ${digits(val)}', textAlign: TextAlign.right, style: TextStyle(fontWeight: FontWeight.w700, fontSize: 17, color: scheme.onSurface)),
                      ),
                    );
                  },
                ),
        ),
      ],
    );
  }
}
