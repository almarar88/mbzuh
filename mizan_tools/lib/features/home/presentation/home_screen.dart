import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/constants/colors.dart';
import '../../../core/l10n/strings.dart';
import '../../../core/tools_registry.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/utils/responsive.dart';
import '../../../services/settings_service.dart';
import '../../../shared/widgets/custom_card.dart';
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
      if (n.minute != _now.minute || n.hour != _now.hour) setState(() => _now = n);
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

    return Scaffold(
      appBar: AppBar(
        title: Row(
          children: [
            Container(
              width: 34,
              height: 34,
              decoration: BoxDecoration(
                gradient: const LinearGradient(colors: AppColors.headerGradient),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(Icons.balance_rounded, color: Colors.white, size: 20),
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
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
              sliver: SliverToBoxAdapter(child: _HeaderCard(now: _now)),
            ),
            if (favorites.isNotEmpty) ...[
              SliverPadding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                sliver: SliverToBoxAdapter(child: SectionHeader(s.favorites)),
              ),
              _grid(favorites, cols, s, settings),
            ] else
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
                sliver: SliverToBoxAdapter(
                  child: CustomCard(
                    child: Row(
                      children: [
                        Icon(Icons.star_outline_rounded, color: Colors.amber.shade600),
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
                sliver: SliverToBoxAdapter(child: SectionHeader(ToolsRegistry.categoryTitle(cat, s))),
              ),
              _grid(ToolsRegistry.byCategory(cat), cols, s, settings),
            ],
            const SliverToBoxAdapter(child: SizedBox(height: 24)),
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

class _HeaderCard extends StatelessWidget {
  const _HeaderCard({required this.now});
  final DateTime now;

  @override
  Widget build(BuildContext context) {
    final s = S.of(context);
    final settings = context.watch<SettingsService>();
    final ar = settings.isArabic;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final greeting = switch (now.hour) {
      >= 5 && < 12 => s.goodMorning,
      >= 12 && < 17 => s.goodAfternoon,
      >= 17 && < 22 => s.goodEvening,
      _ => s.goodNight,
    };
    final time = Fmt.digits(Fmt.time(now, ar: ar), eastern: settings.easternDigits);
    final greg = Fmt.digits(Fmt.gregorianLong(now, ar: ar), eastern: settings.easternDigits);
    final hijri = Fmt.digits(
      Fmt.hijriLong(now, ar: ar, adjustDays: settings.hijriAdjust),
      eastern: settings.easternDigits,
    );

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: isDark ? AppColors.headerGradientDark : AppColors.headerGradient,
          begin: AlignmentDirectional.topStart,
          end: AlignmentDirectional.bottomEnd,
        ),
        borderRadius: BorderRadius.circular(22),
        boxShadow: [
          BoxShadow(color: AppColors.seedLight.withValues(alpha: isDark ? 0.15 : 0.3), blurRadius: 24, offset: const Offset(0, 10)),
        ],
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(greeting, style: const TextStyle(color: Colors.white70, fontSize: 14)),
                const SizedBox(height: 4),
                Text(
                  time,
                  style: const TextStyle(color: Colors.white, fontSize: 40, fontWeight: FontWeight.w700, height: 1.1),
                ),
                const SizedBox(height: 10),
                _DateLine(icon: Icons.calendar_today_rounded, label: s.gregorianLabel, text: greg),
                const SizedBox(height: 6),
                _DateLine(icon: Icons.nightlight_round, label: s.hijriLabel, text: hijri),
              ],
            ),
          ),
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
    return Row(
      children: [
        Icon(icon, size: 15, color: Colors.white70),
        const SizedBox(width: 6),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
          decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.16), borderRadius: BorderRadius.circular(8)),
          child: Text(label, style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w600)),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            text,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w600),
          ),
        ),
      ],
    );
  }
}
