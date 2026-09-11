import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/l10n/strings.dart';
import '../../../core/tools_registry.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/utils/responsive.dart';
import '../../../services/settings_service.dart';
import '../../../shared/widgets/custom_card.dart';
import '../../../shared/widgets/glass.dart';
import '../../../shared/widgets/tool_grid_card.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  late Timer _ticker;
  DateTime _now = DateTime.now();

  @override
  void initState() {
    super.initState();
    _ticker = Timer.periodic(const Duration(seconds: 1), (_) {
      final n = DateTime.now();
      if (n.second != _now.second) setState(() => _now = n);
    });
  }

  @override
  void dispose() {
    _ticker.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final s = S.of(context);
    final settings = context.watch<SettingsService>();
    final favorites = settings.favorites.map(ToolsRegistry.byId).whereType<ToolDef>().toList();
    final bottomInset = MediaQuery.paddingOf(context).bottom;

    return GlassScaffold(
      appBar: GlassAppBar(
        title: Row(
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(9),
              child: Image.asset('assets/branding/logo.png', width: 30, height: 30),
            ),
            const SizedBox(width: 10),
            Text(s.appName),
          ],
        ),
      ),
      body: LayoutBuilder(
        builder: (context, constraints) {
          final cols = Responsive.gridColumns(constraints.maxWidth);
          final slivers = <Widget>[
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
              sliver: SliverToBoxAdapter(child: _ClockCard(now: _now)),
            ),
            if (favorites.isNotEmpty) ...[
              SliverPadding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                sliver: SliverToBoxAdapter(child: SectionHeader(s.favorites.toUpperCase())),
              ),
              _grid(favorites, cols, s, settings),
            ] else
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
                sliver: SliverToBoxAdapter(
                  child: CustomCard(
                    child: Row(
                      children: [
                        Icon(Icons.star_outline_rounded, color: Theme.of(context).colorScheme.primary),
                        const SizedBox(width: 10),
                        Expanded(child: Text(s.noFavoritesHint)),
                      ],
                    ),
                  ),
                ),
              ),
            for (final cat in ToolCategory.values) ...[
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                sliver: SliverToBoxAdapter(child: SectionHeader(ToolsRegistry.categoryTitle(cat, s).toUpperCase())),
              ),
              _grid(ToolsRegistry.byCategory(cat), cols, s, settings),
            ],
            SliverToBoxAdapter(child: SizedBox(height: 24 + bottomInset)),
          ];
          return CustomScrollView(slivers: slivers);
        },
      ),
    );
  }

  Widget _grid(List<ToolDef> tools, int cols, S s, SettingsService settings) {
    return SliverPadding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      sliver: SliverGrid(
        gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: cols,
          mainAxisSpacing: 12,
          crossAxisSpacing: 12,
          childAspectRatio: 1.15,
        ),
        delegate: SliverChildBuilderDelegate(
          (context, i) {
            final t = tools[i];
            return ToolGridCard(
              title: t.title(s),
              subtitle: t.description(s),
              icon: t.icon,
              color: t.color,
              isFavorite: settings.isFavorite(t.id),
              onTap: () => ToolsRegistry.open(context, t),
              onLongPress: () async {
                final added = await settings.toggleFavorite(t.id);
                if (!context.mounted) return;
                ScaffoldMessenger.of(context)
                  ..hideCurrentSnackBar()
                  ..showSnackBar(SnackBar(content: Text(added ? s.addedToFavorites : s.removedFromFavorites)));
              },
            );
          },
          childCount: tools.length,
        ),
      ),
    );
  }
}

/// iOS Clock-style hero: huge light-weight time, then both calendars.
class _ClockCard extends StatelessWidget {
  const _ClockCard({required this.now});
  final DateTime now;

  @override
  Widget build(BuildContext context) {
    final s = S.of(context);
    final settings = context.watch<SettingsService>();
    final scheme = Theme.of(context).colorScheme;
    final ar = settings.isArabic;
    String d(String v) => Fmt.digits(v, eastern: settings.easternDigits);

    final greeting = switch (now.hour) {
      >= 5 && < 12 => s.goodMorning,
      >= 12 && < 17 => s.goodAfternoon,
      >= 17 && < 22 => s.goodEvening,
      _ => s.goodNight,
    };
    final h = now.hour % 12 == 0 ? 12 : now.hour % 12;
    final time = d('$h:${Fmt.two(now.minute)}');
    final seconds = d(Fmt.two(now.second));
    final period = now.hour < 12 ? (ar ? 'ص' : 'AM') : (ar ? 'م' : 'PM');
    final greg = d(Fmt.gregorianLong(now, ar: ar));
    final hijri = d(Fmt.hijriLong(now, ar: ar, adjustDays: settings.hijriAdjust));

    return CustomCard(
      padding: const EdgeInsets.fromLTRB(20, 18, 20, 18),
      radius: 28,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(greeting, style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 14, fontWeight: FontWeight.w600)),
          const SizedBox(height: 2),
          Directionality(
            textDirection: TextDirection.ltr,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.baseline,
              textBaseline: TextBaseline.alphabetic,
              children: [
                Text(
                  time,
                  style: TextStyle(
                    fontSize: 64,
                    fontWeight: FontWeight.w400,
                    height: 1.15,
                    letterSpacing: -1.5,
                    color: scheme.onSurface,
                    fontFeatures: const [FontFeature.tabularFigures()],
                  ),
                ),
                const SizedBox(width: 8),
                Text(
                  seconds,
                  style: TextStyle(fontSize: 22, fontWeight: FontWeight.w400, color: scheme.primary, fontFeatures: const [FontFeature.tabularFigures()]),
                ),
                const SizedBox(width: 6),
                Text(period, style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600, color: scheme.onSurfaceVariant)),
              ],
            ),
          ),
          const SizedBox(height: 12),
          _DateLine(icon: Icons.calendar_today_rounded, label: s.gregorianLabel, text: greg),
          const SizedBox(height: 8),
          _DateLine(icon: Icons.nightlight_round, label: s.hijriLabel, text: hijri),
        ],
      ),
    );
  }
}

class _DateLine extends StatelessWidget {
  const _DateLine({required this.icon, required this.label, required this.text});
  final IconData icon;
  final String label;
  final String text;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Row(
      children: [
        Icon(icon, size: 15, color: scheme.primary),
        const SizedBox(width: 6),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
          decoration: BoxDecoration(color: scheme.primary.withValues(alpha: 0.18), borderRadius: BorderRadius.circular(8)),
          child: Text(label, style: TextStyle(color: scheme.primary, fontSize: 11, fontWeight: FontWeight.w700)),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            text,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(color: scheme.onSurface, fontSize: 14, fontWeight: FontWeight.w600),
          ),
        ),
      ],
    );
  }
}
