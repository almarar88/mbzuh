import 'dart:ui' show ImageFilter;

import 'package:flutter/material.dart';

import '../../core/theme/app_theme.dart';

/// Marker so nested [GlassScaffold]s don't paint a second canvas.
class _CanvasScope extends InheritedWidget {
  const _CanvasScope({required super.child});

  static bool exists(BuildContext context) => context.getInheritedWidgetOfExactType<_CanvasScope>() != null;

  @override
  bool updateShouldNotify(_CanvasScope oldWidget) => false;
}

/// The app canvas: near-black (or soft grey) with three blurred colour
/// blooms. Translucent surfaces on top of it read as frosted glass.
class AppBackground extends StatelessWidget {
  const AppBackground({super.key, required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final g = GlassTheme.of(context);
    return _CanvasScope(
      child: Stack(
        fit: StackFit.expand,
        children: [
          ColoredBox(color: g.canvas),
          Positioned(top: -140, left: -120, child: _Bloom(color: g.blobA, size: 420)),
          Positioned(bottom: -180, right: -140, child: _Bloom(color: g.blobB, size: 480)),
          Positioned(top: 320, right: -120, child: _Bloom(color: g.blobC, size: 320)),
          child,
        ],
      ),
    );
  }
}

class _Bloom extends StatelessWidget {
  const _Bloom({required this.color, required this.size});
  final Color color;
  final double size;

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          gradient: RadialGradient(colors: [color, color.withValues(alpha: 0)]),
        ),
      ),
    );
  }
}

/// A [Scaffold] on the glass canvas. Paints the canvas only when no ancestor
/// already did (pushed routes paint their own; tabs inside the shell do not).
class GlassScaffold extends StatelessWidget {
  const GlassScaffold({
    super.key,
    this.appBar,
    this.body,
    this.floatingActionButton,
    this.bottomNavigationBar,
    this.extendBody = false,
    this.resizeToAvoidBottomInset,
  });

  final PreferredSizeWidget? appBar;
  final Widget? body;
  final Widget? floatingActionButton;
  final Widget? bottomNavigationBar;
  final bool extendBody;
  final bool? resizeToAvoidBottomInset;

  @override
  Widget build(BuildContext context) {
    final scaffold = Scaffold(
      backgroundColor: Colors.transparent,
      appBar: appBar,
      body: body,
      floatingActionButton: floatingActionButton,
      bottomNavigationBar: bottomNavigationBar,
      extendBody: extendBody,
      resizeToAvoidBottomInset: resizeToAvoidBottomInset,
    );
    if (_CanvasScope.exists(context)) return scaffold;
    return AppBackground(child: scaffold);
  }
}

/// Transparent app bar with iOS-style large bold title.
class GlassAppBar extends StatelessWidget implements PreferredSizeWidget {
  const GlassAppBar({super.key, this.title, this.actions, this.bottom, this.leading});

  final Widget? title;
  final List<Widget>? actions;
  final PreferredSizeWidget? bottom;
  final Widget? leading;

  @override
  Size get preferredSize => Size.fromHeight(kToolbarHeight + (bottom?.preferredSize.height ?? 0));

  @override
  Widget build(BuildContext context) {
    return AppBar(
      title: title,
      actions: actions,
      bottom: bottom,
      leading: leading,
      backgroundColor: Colors.transparent,
      surfaceTintColor: Colors.transparent,
    );
  }
}

/// Frosted container used for floating bars (real backdrop blur).
class GlassPanel extends StatelessWidget {
  const GlassPanel({
    super.key,
    required this.child,
    this.radius = 28,
    this.sigma = 28,
    this.padding = EdgeInsets.zero,
    this.strong = false,
  });

  final Widget child;
  final double radius;
  final double sigma;
  final EdgeInsetsGeometry padding;
  final bool strong;

  @override
  Widget build(BuildContext context) {
    final g = GlassTheme.of(context);
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return ClipRRect(
      borderRadius: BorderRadius.circular(radius),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: sigma, sigmaY: sigma),
        child: Container(
          padding: padding,
          decoration: BoxDecoration(
            color: strong ? g.fillStrong : g.fill,
            borderRadius: BorderRadius.circular(radius),
            border: Border.all(color: g.border),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: isDark ? 0.45 : 0.10),
                blurRadius: 30,
                offset: const Offset(0, 12),
              ),
            ],
          ),
          child: child,
        ),
      ),
    );
  }
}

/// iOS Clock-style round action button (Start / Stop / Lap / Reset).
class RoundActionButton extends StatelessWidget {
  const RoundActionButton({
    super.key,
    required this.label,
    required this.color,
    this.onTap,
    this.size = 84,
  });

  final String label;
  final Color color;
  final VoidCallback? onTap;
  final double size;

  @override
  Widget build(BuildContext context) {
    final enabled = onTap != null;
    final c = enabled ? color : color.withValues(alpha: 0.35);
    return Semantics(
      button: true,
      label: label,
      child: SizedBox(
        width: size,
        height: size,
        child: Material(
          color: c.withValues(alpha: 0.22),
          shape: const CircleBorder(),
          clipBehavior: Clip.antiAlias,
          child: InkWell(
            onTap: onTap,
            customBorder: const CircleBorder(),
            child: Container(
              margin: const EdgeInsets.all(2.5),
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(color: Colors.black.withValues(alpha: 0.35), width: 2),
              ),
              alignment: Alignment.center,
              child: FittedBox(
                fit: BoxFit.scaleDown,
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  child: Text(
                    label,
                    style: TextStyle(color: c, fontWeight: FontWeight.w600, fontSize: 16),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Floating bottom tab bar with backdrop blur (compact windows).
class GlassNavBar extends StatelessWidget {
  const GlassNavBar({
    super.key,
    required this.selectedIndex,
    required this.onSelected,
    required this.items,
  });

  final int selectedIndex;
  final ValueChanged<int> onSelected;
  final List<(IconData, IconData, String)> items;

  static const double height = 66;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return SafeArea(
      top: false,
      minimum: const EdgeInsets.fromLTRB(14, 0, 14, 10),
      child: GlassPanel(
        radius: 30,
        strong: true,
        child: SizedBox(
          height: height,
          child: Row(
            children: [
              for (var i = 0; i < items.length; i++)
                Expanded(
                  child: _NavItem(
                    icon: i == selectedIndex ? items[i].$2 : items[i].$1,
                    label: items[i].$3,
                    selected: i == selectedIndex,
                    color: i == selectedIndex ? scheme.primary : scheme.onSurfaceVariant,
                    onTap: () => onSelected(i),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _NavItem extends StatelessWidget {
  const _NavItem({required this.icon, required this.label, required this.selected, required this.color, required this.onTap});
  final IconData icon;
  final String label;
  final bool selected;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(22),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        margin: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
        decoration: BoxDecoration(
          color: selected ? color.withValues(alpha: 0.16) : Colors.transparent,
          borderRadius: BorderRadius.circular(20),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, color: color, size: 24),
            const SizedBox(height: 2),
            Text(label, style: TextStyle(color: color, fontSize: 11, fontWeight: selected ? FontWeight.w700 : FontWeight.w600)),
          ],
        ),
      ),
    );
  }
}
