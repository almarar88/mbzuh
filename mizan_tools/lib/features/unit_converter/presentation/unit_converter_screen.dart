import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../../../core/constants/colors.dart';
import '../../../core/l10n/strings.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/utils/responsive.dart';
import '../../../services/settings_service.dart';
import '../../../shared/widgets/custom_card.dart';
import '../../../shared/widgets/glass.dart';

class _Unit {
  const _Unit(this.id, this.ar, this.en, this.factor);
  final String id;
  final String ar;
  final String en;
  /// Multiplier to the category's base unit (for temperature: unused).
  final double factor;
}

class _Category {
  const _Category(this.id, this.icon, this.units);
  final String id;
  final IconData icon;
  final List<_Unit> units;
}

const _categories = <_Category>[
  _Category('length', Icons.straighten_rounded, [
    _Unit('mm', 'ملليمتر', 'Millimeter', 0.001),
    _Unit('cm', 'سنتيمتر', 'Centimeter', 0.01),
    _Unit('m', 'متر', 'Meter', 1),
    _Unit('km', 'كيلومتر', 'Kilometer', 1000),
    _Unit('in', 'إنش', 'Inch', 0.0254),
    _Unit('ft', 'قدم', 'Foot', 0.3048),
    _Unit('yd', 'ياردة', 'Yard', 0.9144),
    _Unit('mi', 'ميل', 'Mile', 1609.344),
    _Unit('nmi', 'ميل بحري', 'Nautical mile', 1852),
  ]),
  _Category('weight', Icons.fitness_center_rounded, [
    _Unit('mg', 'ملليغرام', 'Milligram', 0.000001),
    _Unit('g', 'غرام', 'Gram', 0.001),
    _Unit('kg', 'كيلوغرام', 'Kilogram', 1),
    _Unit('t', 'طن', 'Tonne', 1000),
    _Unit('oz', 'أونصة', 'Ounce', 0.028349523125),
    _Unit('lb', 'رطل', 'Pound', 0.45359237),
    _Unit('st', 'ستون', 'Stone', 6.35029318),
  ]),
  _Category('temperature', Icons.thermostat_rounded, [
    _Unit('c', 'مئوية °C', 'Celsius °C', 1),
    _Unit('f', 'فهرنهايت °F', 'Fahrenheit °F', 1),
    _Unit('k', 'كلفن K', 'Kelvin K', 1),
  ]),
  _Category('area', Icons.crop_square_rounded, [
    _Unit('cm2', 'سم²', 'cm²', 0.0001),
    _Unit('m2', 'متر²', 'm²', 1),
    _Unit('km2', 'كم²', 'km²', 1000000),
    _Unit('ft2', 'قدم²', 'ft²', 0.09290304),
    _Unit('ac', 'فدان', 'Acre', 4046.8564224),
    _Unit('ha', 'هكتار', 'Hectare', 10000),
  ]),
  _Category('volume', Icons.water_drop_rounded, [
    _Unit('ml', 'ملليلتر', 'Milliliter', 0.001),
    _Unit('l', 'لتر', 'Liter', 1),
    _Unit('m3', 'متر³', 'm³', 1000),
    _Unit('gal', 'غالون (أمريكي)', 'Gallon (US)', 3.785411784),
    _Unit('galuk', 'غالون (بريطاني)', 'Gallon (UK)', 4.54609),
    _Unit('cup', 'كوب', 'Cup (US)', 0.2365882365),
    _Unit('floz', 'أونصة سائلة', 'Fluid ounce (US)', 0.0295735295625),
  ]),
  _Category('speed', Icons.speed_rounded, [
    _Unit('kmh', 'كم/س', 'km/h', 1),
    _Unit('ms', 'م/ث', 'm/s', 3.6),
    _Unit('mph', 'ميل/س', 'mph', 1.609344),
    _Unit('kn', 'عقدة', 'Knot', 1.852),
  ]),
  _Category('data', Icons.storage_rounded, [
    _Unit('b', 'بايت', 'Byte', 1),
    _Unit('kb', 'كيلوبايت', 'KB', 1024),
    _Unit('mb', 'ميغابايت', 'MB', 1048576),
    _Unit('gb', 'غيغابايت', 'GB', 1073741824),
    _Unit('tb', 'تيرابايت', 'TB', 1099511627776),
  ]),
];

double _convert(_Category c, _Unit from, _Unit to, double v) {
  if (c.id == 'temperature') {
    final celsius = switch (from.id) {
      'f' => (v - 32) * 5 / 9,
      'k' => v - 273.15,
      _ => v,
    };
    return switch (to.id) {
      'f' => celsius * 9 / 5 + 32,
      'k' => celsius + 273.15,
      _ => celsius,
    };
  }
  return v * from.factor / to.factor;
}

class UnitConverterScreen extends StatefulWidget {
  const UnitConverterScreen({super.key});

  @override
  State<UnitConverterScreen> createState() => _UnitConverterScreenState();
}

class _UnitConverterScreenState extends State<UnitConverterScreen> {
  final _value = TextEditingController(text: '1');
  int _cat = 0;
  int _from = 2;
  int _to = 3;

  @override
  void dispose() {
    _value.dispose();
    super.dispose();
  }

  String _catName(String id, S s) => switch (id) {
        'length' => s.length,
        'weight' => s.weight,
        'temperature' => s.temperature,
        'area' => s.area,
        'volume' => s.volume,
        'speed' => s.speed,
        _ => s.data,
      };

  @override
  Widget build(BuildContext context) {
    final s = S.of(context);
    final settings = context.watch<SettingsService>();
    final ar = settings.isArabic;
    final scheme = Theme.of(context).colorScheme;
    String d(String v) => Fmt.digits(v, eastern: settings.easternDigits);

    final cat = _categories[_cat];
    final from = cat.units[_from.clamp(0, cat.units.length - 1)];
    final to = cat.units[_to.clamp(0, cat.units.length - 1)];
    final v = double.tryParse(_value.text) ?? 0;
    final result = _convert(cat, from, to, v);
    String name(_Unit u) => ar ? u.ar : u.en;

    return GlassScaffold(
      appBar: GlassAppBar(title: Text(s.unitsTitle)),
      body: ContentConstraint(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
          children: [
            SizedBox(
              height: 44,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: _categories.length,
                separatorBuilder: (_, _) => const SizedBox(width: 8),
                itemBuilder: (context, i) => ChoiceChip(
                  avatar: Icon(_categories[i].icon, size: 18, color: _cat == i ? scheme.onSecondaryContainer : AppColors.units),
                  label: Text(_catName(_categories[i].id, s)),
                  selected: _cat == i,
                  onSelected: (_) => setState(() {
                    _cat = i;
                    _from = 0;
                    _to = 1;
                  }),
                ),
              ),
            ),
            const SizedBox(height: 14),
            CustomCard(
              child: Column(
                children: [
                  TextField(
                    controller: _value,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true, signed: true),
                    inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[\d.\-]'))],
                    textDirection: TextDirection.ltr,
                    style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w700),
                    decoration: InputDecoration(labelText: s.value),
                    onChanged: (_) => setState(() {}),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: DropdownButtonFormField<int>(
                          key: ValueKey('from-${cat.id}'),
                          initialValue: cat.units.indexOf(from),
                          isExpanded: true,
                          decoration: InputDecoration(labelText: s.from),
                          items: [for (var i = 0; i < cat.units.length; i++) DropdownMenuItem(value: i, child: Text(name(cat.units[i]), overflow: TextOverflow.ellipsis))],
                          onChanged: (i) => setState(() => _from = i ?? _from),
                        ),
                      ),
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 6),
                        child: IconButton.filledTonal(
                          onPressed: () => setState(() {
                            final t = _from;
                            _from = _to;
                            _to = t;
                          }),
                          icon: const Icon(Icons.swap_horiz_rounded),
                        ),
                      ),
                      Expanded(
                        child: DropdownButtonFormField<int>(
                          key: ValueKey('to-${cat.id}'),
                          initialValue: cat.units.indexOf(to),
                          isExpanded: true,
                          decoration: InputDecoration(labelText: s.to),
                          items: [for (var i = 0; i < cat.units.length; i++) DropdownMenuItem(value: i, child: Text(name(cat.units[i]), overflow: TextOverflow.ellipsis))],
                          onChanged: (i) => setState(() => _to = i ?? _to),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                gradient: const LinearGradient(colors: [Color(0xFF5B21B6), Color(0xFF8B5CF6)]),
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
                            '${d(Fmt.number(result, maxFraction: 6))} ${name(to)}',
                            style: const TextStyle(color: Colors.white, fontSize: 30, fontWeight: FontWeight.w700),
                          ),
                        ),
                      ),
                      IconButton(
                        color: Colors.white,
                        tooltip: s.copy,
                        onPressed: () {
                          Clipboard.setData(ClipboardData(text: Fmt.plain(result, maxFraction: 6)));
                          ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(s.copied)));
                        },
                        icon: const Icon(Icons.copy_rounded),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${d(Fmt.number(v, maxFraction: 6))} ${name(from)} = ${d(Fmt.number(result, maxFraction: 6))} ${name(to)}',
                    style: const TextStyle(color: Colors.white, fontSize: 13),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 18),
            SectionHeader(name(from)),
            CustomCard(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Column(
                children: [
                  for (final u in cat.units)
                    if (u.id != from.id)
                      ListTile(
                        dense: true,
                        title: Text(name(u)),
                        trailing: Text(d(Fmt.number(_convert(cat, from, u, v), maxFraction: 6)), style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                        onTap: () => setState(() => _to = cat.units.indexOf(u)),
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
