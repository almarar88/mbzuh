import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../../../core/constants/colors.dart';
import '../../../core/l10n/strings.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/utils/responsive.dart';
import '../../../services/currency_service.dart';
import '../../../services/settings_service.dart';
import '../../../shared/widgets/custom_card.dart';
import '../../../shared/widgets/glass.dart';

class VatScreen extends StatefulWidget {
  const VatScreen({super.key});

  @override
  State<VatScreen> createState() => _VatScreenState();
}

class _VatScreenState extends State<VatScreen> with SingleTickerProviderStateMixin {
  late final TabController _tabs = TabController(length: 2, vsync: this);

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final s = S.of(context);
    return GlassScaffold(
      appBar: GlassAppBar(
        title: Text(s.vatTitle),
        bottom: TabBar(controller: _tabs, tabs: [Tab(text: s.vatTab), Tab(text: s.discountTab)]),
      ),
      body: TabBarView(controller: _tabs, children: const [_VatTab(), _DiscountTab()]),
    );
  }
}

class _MoneyField extends StatelessWidget {
  const _MoneyField({required this.controller, required this.label, this.suffix, this.onChanged});
  final TextEditingController controller;
  final String label;
  final String? suffix;
  final ValueChanged<String>? onChanged;

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      keyboardType: const TextInputType.numberWithOptions(decimal: true),
      inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[\d.]'))],
      textDirection: TextDirection.ltr,
      style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700),
      decoration: InputDecoration(labelText: label, suffixText: suffix),
      onChanged: onChanged,
    );
  }
}

class _VatTab extends StatefulWidget {
  const _VatTab();

  @override
  State<_VatTab> createState() => _VatTabState();
}

class _VatTabState extends State<_VatTab> {
  final _amount = TextEditingController();
  late final TextEditingController _rate;
  bool _addMode = true;

  @override
  void initState() {
    super.initState();
    _rate = TextEditingController(text: Fmt.plain(context.read<SettingsService>().defaultVat));
  }

  @override
  void dispose() {
    _amount.dispose();
    _rate.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final s = S.of(context);
    final settings = context.watch<SettingsService>();
    final sym = CurrencyService.info(settings.defaultCurrency).symbol;
    String d(String v) => Fmt.digits(v, eastern: settings.easternDigits);

    final amount = double.tryParse(_amount.text) ?? 0;
    final rate = (double.tryParse(_rate.text) ?? 0) / 100;
    final double excl, incl, vat;
    if (_addMode) {
      excl = amount;
      vat = amount * rate;
      incl = amount + vat;
    } else {
      incl = amount;
      excl = rate == -1 ? 0 : amount / (1 + rate);
      vat = incl - excl;
    }
    String money(double v) => d('${Fmt.number(v, minFraction: 2)} $sym');

    return ContentConstraint(
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
        children: [
          SegmentedButton<bool>(
            segments: [
              ButtonSegment(value: true, label: Text(s.addVat), icon: const Icon(Icons.add_rounded, size: 18)),
              ButtonSegment(value: false, label: Text(s.removeVat), icon: const Icon(Icons.remove_rounded, size: 18)),
            ],
            selected: {_addMode},
            onSelectionChanged: (v) => setState(() => _addMode = v.first),
          ),
          const SizedBox(height: 14),
          CustomCard(
            child: Column(
              children: [
                _MoneyField(controller: _amount, label: _addMode ? s.amountExcl : s.amountIncl, suffix: sym, onChanged: (_) => setState(() {})),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(child: _MoneyField(controller: _rate, label: s.vatRate, suffix: '%', onChanged: (_) => setState(() {}))),
                    const SizedBox(width: 10),
                    for (final r in const [5, 10, 15])
                      Padding(
                        padding: const EdgeInsetsDirectional.only(start: 4),
                        child: ChoiceChip(
                          label: Text(d('$r%')),
                          selected: _rate.text == '$r',
                          onSelected: (_) => setState(() => _rate.text = '$r'),
                        ),
                      ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          CustomCard(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Column(
              children: [
                InfoRow(icon: Icons.money_off_csred_rounded, label: s.amountExcl, value: money(excl)),
                const Divider(),
                InfoRow(icon: Icons.percent_rounded, label: s.vatAmount, value: money(vat)),
                const Divider(),
                InfoRow(icon: Icons.receipt_long_rounded, label: s.amountIncl, value: money(incl), emphasize: true),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _DiscountTab extends StatefulWidget {
  const _DiscountTab();

  @override
  State<_DiscountTab> createState() => _DiscountTabState();
}

class _DiscountTabState extends State<_DiscountTab> {
  final _price = TextEditingController();
  final _discount = TextEditingController(text: '10');
  bool _applyVat = false;

  @override
  void dispose() {
    _price.dispose();
    _discount.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final s = S.of(context);
    final settings = context.watch<SettingsService>();
    final sym = CurrencyService.info(settings.defaultCurrency).symbol;
    String d(String v) => Fmt.digits(v, eastern: settings.easternDigits);

    final price = double.tryParse(_price.text) ?? 0;
    final pct = (double.tryParse(_discount.text) ?? 0).clamp(0, 100) / 100;
    final save = price * pct;
    var finalPrice = price - save;
    final vat = _applyVat ? finalPrice * settings.defaultVat / 100 : 0.0;
    finalPrice += vat;
    String money(double v) => d('${Fmt.number(v, minFraction: 2)} $sym');

    return ContentConstraint(
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
        children: [
          CustomCard(
            child: Column(
              children: [
                _MoneyField(controller: _price, label: s.originalPrice, suffix: sym, onChanged: (_) => setState(() {})),
                const SizedBox(height: 12),
                _MoneyField(controller: _discount, label: s.discountRate, suffix: '%', onChanged: (_) => setState(() {})),
                const SizedBox(height: 10),
                Wrap(
                  spacing: 8,
                  children: [
                    for (final r in const [5, 10, 15, 20, 25, 30, 50, 70])
                      ChoiceChip(label: Text(d('$r%')), selected: _discount.text == '$r', onSelected: (_) => setState(() => _discount.text = '$r')),
                  ],
                ),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  value: _applyVat,
                  onChanged: (v) => setState(() => _applyVat = v),
                  title: Text('${s.addVat} (${d(Fmt.plain(settings.defaultVat))}%)'),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          CustomCard(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Column(
              children: [
                InfoRow(icon: Icons.sell_outlined, label: s.originalPrice, value: money(price)),
                const Divider(),
                InfoRow(icon: Icons.savings_outlined, label: s.youSave, value: money(save)),
                if (_applyVat) ...[
                  const Divider(),
                  InfoRow(icon: Icons.percent_rounded, label: s.vatAmount, value: money(vat)),
                ],
                const Divider(),
                InfoRow(icon: Icons.local_offer_rounded, label: s.finalPrice, value: money(finalPrice), emphasize: true),
              ],
            ),
          ),
          const SizedBox(height: 8),
          Center(
            child: Text(
              d('${Fmt.number(pct * 100)}% ${s.youSave.toLowerCase()} · ${Fmt.number(price == 0 ? 0 : finalPrice / price * 100)}% ${s.finalPrice.toLowerCase()}'),
              style: TextStyle(fontSize: 12, color: Theme.of(context).colorScheme.onSurfaceVariant),
            ),
          ),
          const SizedBox(height: 4),
          Center(child: Icon(Icons.local_offer_outlined, color: AppColors.vat.withValues(alpha: 0.4))),
        ],
      ),
    );
  }
}
