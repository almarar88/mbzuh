import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:math_expressions/math_expressions.dart';
import 'package:provider/provider.dart';

import '../../../core/constants/colors.dart';
import '../../../core/l10n/strings.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/utils/responsive.dart';
import '../../../services/settings_service.dart';

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
            alignment: AlignmentDirectional.bottomEnd,
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
                        fontSize: _expr.length > 14 ? 30 : 42,
                        fontWeight: FontWeight.w600,
                        color: scheme.onSurface,
                        height: 1.1,
                      ),
                    ),
                  ),
                  const SizedBox(height: 4),
                  AnimatedOpacity(
                    duration: const Duration(milliseconds: 150),
                    opacity: _preview == null ? 0 : 1,
                    child: Text(
                      _preview == null ? '' : '= ${d(_preview!)}',
                      style: TextStyle(fontSize: 20, color: scheme.onSurfaceVariant),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
        const Divider(),
        _Keypad(onKey: _tap, onClear: _clear, onBackspace: _backspace, onEquals: _equals, digits: d),
      ],
    );

    return Scaffold(
      appBar: AppBar(
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
      [_Key('C', kind: _KeyKind.action), _Key('( )', kind: _KeyKind.op), _Key('%', kind: _KeyKind.op), _Key('÷', kind: _KeyKind.op)],
      [_Key('7'), _Key('8'), _Key('9'), _Key('×', kind: _KeyKind.op)],
      [_Key('4'), _Key('5'), _Key('6'), _Key('−', kind: _KeyKind.op)],
      [_Key('1'), _Key('2'), _Key('3'), _Key('+', kind: _KeyKind.op)],
      [_Key('⌫', kind: _KeyKind.action), _Key('0'), _Key('.'), _Key('=', kind: _KeyKind.accent)],
    ];
    return Directionality(
      textDirection: TextDirection.ltr,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(12, 10, 12, 16),
        child: LayoutBuilder(
          builder: (context, c) {
            final keyH = ((c.maxWidth - 3 * 8) / 4 * 0.8).clamp(52.0, 76.0);
            return Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                for (final row in rows)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Row(
                      children: [
                        for (var i = 0; i < row.length; i++) ...[
                          if (i > 0) const SizedBox(width: 8),
                          Expanded(
                            child: SizedBox(
                              height: keyH,
                              child: _KeyButton(
                                k: row[i],
                                label: RegExp(r'^\d$').hasMatch(row[i].label) ? digits(row[i].label) : row[i].label,
                                onTap: () {
                                  switch (row[i].label) {
                                    case 'C':
                                      onClear();
                                    case '⌫':
                                      onBackspace();
                                    case '=':
                                      onEquals();
                                    default:
                                      onKey(row[i].label);
                                  }
                                },
                              ),
                            ),
                          ),
                        ],
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

enum _KeyKind { digit, op, action, accent }

class _Key {
  const _Key(this.label, {this.kind = _KeyKind.digit});
  final String label;
  final _KeyKind kind;
}

class _KeyButton extends StatelessWidget {
  const _KeyButton({required this.k, required this.label, required this.onTap});
  final _Key k;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final (bg, fg) = switch (k.kind) {
      _KeyKind.digit => (Theme.of(context).cardColor, scheme.onSurface),
      _KeyKind.op => (AppColors.calculator.withValues(alpha: isDark ? 0.22 : 0.12), AppColors.calculator),
      _KeyKind.action => (scheme.errorContainer.withValues(alpha: isDark ? 0.5 : 0.7), scheme.onErrorContainer),
      _KeyKind.accent => (scheme.primary, scheme.onPrimary),
    };
    return Material(
      color: bg,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: k.kind == _KeyKind.digit
            ? BorderSide(color: scheme.outlineVariant.withValues(alpha: isDark ? 0.35 : 0.6))
            : BorderSide.none,
      ),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        onLongPress: k.label == '⌫' ? () => Feedback.forLongPress(context) : null,
        child: Center(
          child: Text(
            label,
            style: TextStyle(fontSize: k.kind == _KeyKind.digit ? 24 : 22, fontWeight: FontWeight.w700, color: fg),
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
