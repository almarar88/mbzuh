import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/l10n/strings.dart';
import '../../core/tools_registry.dart';
import '../../core/utils/responsive.dart';
import '../../services/settings_service.dart';
import 'tool_grid_card.dart';

/// A category hub: a grid of tools on phones, a list + detail pane on
/// unfolded foldables and tablets (respecting the hinge).
class ToolHubScreen extends StatefulWidget {
  const ToolHubScreen({super.key, required this.title, required this.tools});

  final String title;
  final List<ToolDef> tools;

  @override
  State<ToolHubScreen> createState() => _ToolHubScreenState();
}

class _ToolHubScreenState extends State<ToolHubScreen> {
  String? _selectedId;

  @override
  Widget build(BuildContext context) {
    final s = S.of(context);
    final settings = context.watch<SettingsService>();
    final compact = Responsive.isCompact(context);

    final selected = _selectedId == null ? null : ToolsRegistry.byId(_selectedId!);

    final grid = Scaffold(
      appBar: AppBar(title: Text(widget.title)),
      body: LayoutBuilder(
        builder: (context, c) {
          final cols = compact ? Responsive.gridColumns(c.maxWidth) : (c.maxWidth >= 520 ? 2 : 1);
          return GridView.builder(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
            gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: cols,
              mainAxisSpacing: 12,
              crossAxisSpacing: 12,
              childAspectRatio: compact ? 1.05 : 1.35,
            ),
            itemCount: widget.tools.length,
            itemBuilder: (context, i) {
              final t = widget.tools[i];
              return ToolGridCard(
                title: t.title(s),
                subtitle: t.description(s),
                icon: t.icon,
                color: t.color,
                isFavorite: settings.isFavorite(t.id),
                selected: !compact && t.id == _selectedId,
                onTap: () {
                  if (compact) {
                    ToolsRegistry.open(context, t);
                  } else {
                    setState(() => _selectedId = t.id);
                  }
                },
                onLongPress: () async {
                  final added = await settings.toggleFavorite(t.id);
                  if (!context.mounted) return;
                  ScaffoldMessenger.of(context)
                    ..hideCurrentSnackBar()
                    ..showSnackBar(SnackBar(content: Text(added ? s.addedToFavorites : s.removedFromFavorites)));
                },
              );
            },
          );
        },
      ),
    );

    if (compact) return grid;

    final detail = selected == null
        ? Scaffold(
            body: Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.touch_app_outlined, size: 56, color: Theme.of(context).colorScheme.outline),
                  const SizedBox(height: 12),
                  Text(s.selectTool, style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant)),
                ],
              ),
            ),
          )
        : KeyedSubtree(key: ValueKey(selected.id), child: selected.builder());

    return TwoPaneLayout(primary: grid, secondary: detail);
  }
}
