import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart' show DateFormat;
import 'package:provider/provider.dart';

import '../../../core/constants/colors.dart';
import '../../../core/l10n/strings.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/utils/responsive.dart';
import '../../../services/currency_service.dart';
import '../../../services/settings_service.dart';
import '../../../shared/widgets/custom_card.dart';
import '../../../shared/widgets/glass.dart';

class CurrencyScreen extends StatefulWidget {
  const CurrencyScreen({super.key});

  @override
  State<CurrencyScreen> createState() => _CurrencyScreenState();
}

class _CurrencyScreenState extends State<CurrencyScreen> {
  final _amountCtrl = TextEditingController(text: '100');
  late String _from;
  late String _to;

  @override
  void initState() {
    super.initState();
    final def = context.read<SettingsService>().defaultCurrency;
    _from = def;
    _to = def == 'USD' ? 'AED' : 'USD';
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) context.read<CurrencyService>().refresh();
    });
  }

  @override
  void dispose() {
    _amountCtrl.dispose();
    super.dispose();
  }

  double get _amount => double.tryParse(_amountCtrl.text.replaceAll(',', '').replaceAll('٫', '.')) ?? 0;

  @override
  Widget build(BuildContext context) {
    final s = S.of(context);
    final settings = context.watch<SettingsService>();
    final fx = context.watch<CurrencyService>();
    final ar = settings.isArabic;
    final scheme = Theme.of(context).colorScheme;
    String d(String v) => Fmt.digits(v, eastern: settings.easternDigits);

    final converted = fx.convert(_amount, _from, _to);
    final toInfo = CurrencyService.info(_to);
    final fromInfo = CurrencyService.info(_from);

    final statusColor = fx.isLive ? AppColors.hijri : Colors.orange;
    final updatedText = fx.updatedAt == null
        ? null
        : s.lastUpdated(Fmt.western(DateFormat('d MMM yyyy، h:mm a', ar ? 'ar' : 'en').format(fx.updatedAt!)));

    return GlassScaffold(
      appBar: GlassAppBar(
        title: Text(s.currencyTitle),
        actions: [
          IconButton(
            tooltip: s.refreshRates,
            onPressed: fx.loading ? null : () => fx.refresh(force: true),
            icon: fx.loading
                ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                : const Icon(Icons.refresh_rounded),
          ),
        ],
      ),
      body: ContentConstraint(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
          children: [
            // status chip
            Row(
              children: [
                Container(width: 8, height: 8, decoration: BoxDecoration(color: statusColor, shape: BoxShape.circle)),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    updatedText == null ? s.currencyOffline : '${s.currencyLive} · ${d(updatedText)}',
                    style: TextStyle(fontSize: 12, color: scheme.onSurfaceVariant),
                  ),
                ),
              ],
            ),
            if (fx.lastError != null) ...[
              const SizedBox(height: 6),
              Text(s.fetchFailed, style: TextStyle(fontSize: 12, color: scheme.error)),
            ],
            const SizedBox(height: 14),
            CustomCard(
              child: Column(
                children: [
                  TextField(
                    controller: _amountCtrl,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[\d.,٫]'))],
                    textDirection: TextDirection.ltr,
                    style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w700),
                    decoration: InputDecoration(labelText: s.amount, suffixText: fromInfo.symbol),
                    onChanged: (_) => setState(() {}),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(child: _CurrencyPicker(label: s.from, value: _from, onChanged: (v) => setState(() => _from = v))),
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 6),
                        child: IconButton.filledTonal(
                          tooltip: s.swap,
                          onPressed: () => setState(() {
                            final t = _from;
                            _from = _to;
                            _to = t;
                          }),
                          icon: const Icon(Icons.swap_horiz_rounded),
                        ),
                      ),
                      Expanded(child: _CurrencyPicker(label: s.to, value: _to, onChanged: (v) => setState(() => _to = v))),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                gradient: const LinearGradient(colors: [Color(0xFFB45309), Color(0xFFF59E0B)]),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(s.result, style: const TextStyle(color: Colors.white70, fontSize: 13)),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      Expanded(
                        child: FittedBox(
                          fit: BoxFit.scaleDown,
                          alignment: AlignmentDirectional.centerStart,
                          child: Text(
                            '${d(Fmt.number(converted, maxFraction: _to == 'KWD' || _to == 'BHD' || _to == 'OMR' ? 3 : 2, minFraction: 2))} ${toInfo.symbol}',
                            style: const TextStyle(color: Colors.white, fontSize: 34, fontWeight: FontWeight.w700),
                          ),
                        ),
                      ),
                      IconButton(
                        tooltip: s.copy,
                        color: Colors.white,
                        onPressed: () {
                          Clipboard.setData(ClipboardData(text: Fmt.number(converted, maxFraction: 4)));
                          ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(s.copied)));
                        },
                        icon: const Icon(Icons.copy_rounded),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(
                    d('1 $_from = ${Fmt.number(fx.rate(_from, _to), maxFraction: 4)} $_to   ·   1 $_to = ${Fmt.number(fx.rate(_to, _from), maxFraction: 4)} $_from'),
                    style: const TextStyle(color: Colors.white, fontSize: 13),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 18),
            SectionHeader(s.rateTable),
            CustomCard(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Column(
                children: [
                  for (final c in CurrencyService.currencies)
                    if (c.code != _from)
                      ListTile(
                        dense: true,
                        leading: Text(c.flag, style: const TextStyle(fontSize: 22)),
                        title: Text(ar ? c.nameAr : c.nameEn, style: const TextStyle(fontWeight: FontWeight.w600)),
                        subtitle: Text(c.code, style: TextStyle(color: scheme.onSurfaceVariant)),
                        trailing: Text(
                          d('${Fmt.number(fx.convert(_amount, _from, c.code), maxFraction: c.code == 'KWD' || c.code == 'BHD' || c.code == 'OMR' ? 3 : 2, minFraction: 2)} ${c.symbol}'),
                          style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
                        ),
                        onTap: () => setState(() => _to = c.code),
                      ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CurrencyPicker extends StatelessWidget {
  const _CurrencyPicker({required this.label, required this.value, required this.onChanged});
  final String label;
  final String value;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    final ar = context.watch<SettingsService>().isArabic;
    return DropdownButtonFormField<String>(
      initialValue: value,
      isExpanded: true,
      decoration: InputDecoration(labelText: label),
      items: [
        for (final c in CurrencyService.currencies)
          DropdownMenuItem(
            value: c.code,
            child: Row(
              children: [
                Text(c.flag, style: const TextStyle(fontSize: 18)),
                const SizedBox(width: 8),
                Expanded(
                  child: Text('${c.code} · ${ar ? c.nameAr : c.nameEn}', maxLines: 1, overflow: TextOverflow.ellipsis),
                ),
              ],
            ),
          ),
      ],
      onChanged: (v) {
        if (v != null) onChanged(v);
      },
    );
  }
}
