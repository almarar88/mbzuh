import 'package:flutter/material.dart';

/// Flat, rounded surface used across the app.
class CustomCard extends StatelessWidget {
  const CustomCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(16),
    this.onTap,
    this.onLongPress,
    this.color,
    this.borderColor,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final VoidCallback? onTap;
  final VoidCallback? onLongPress;
  final Color? color;
  final Color? borderColor;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final shape = RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(18),
      side: BorderSide(
        color: borderColor ?? theme.colorScheme.outlineVariant.withValues(alpha: theme.brightness == Brightness.dark ? 0.35 : 0.6),
      ),
    );
    return Material(
      color: color ?? theme.cardColor,
      shape: shape,
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        onLongPress: onLongPress,
        child: Padding(padding: padding, child: child),
      ),
    );
  }
}

class SectionHeader extends StatelessWidget {
  const SectionHeader(this.title, {super.key, this.action});
  final String title;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 8, bottom: 10),
      child: Row(
        children: [
          Expanded(
            child: Text(title, style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
          ),
          ?action,
        ],
      ),
    );
  }
}

/// Big number + small label box used in result grids.
class StatBox extends StatelessWidget {
  const StatBox({super.key, required this.label, required this.value, this.color, this.small = false});
  final String label;
  final String value;
  final Color? color;
  final bool small;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return CustomCard(
      padding: EdgeInsets.symmetric(vertical: small ? 12 : 18, horizontal: 8),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          FittedBox(
            fit: BoxFit.scaleDown,
            child: Text(
              value,
              style: TextStyle(
                fontSize: small ? 20 : 28,
                fontWeight: FontWeight.w700,
                color: color ?? scheme.primary,
                height: 1.2,
              ),
            ),
          ),
          const SizedBox(height: 2),
          Text(label, style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 13)),
        ],
      ),
    );
  }
}

/// A key/value row inside a card.
class InfoRow extends StatelessWidget {
  const InfoRow({super.key, required this.label, required this.value, this.icon, this.emphasize = false});
  final String label;
  final String value;
  final IconData? icon;
  final bool emphasize;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          if (icon != null) ...[
            Icon(icon, size: 20, color: scheme.primary),
            const SizedBox(width: 10),
          ],
          Expanded(child: Text(label, style: TextStyle(color: scheme.onSurfaceVariant))),
          Text(
            value,
            style: TextStyle(
              fontWeight: emphasize ? FontWeight.w700 : FontWeight.w600,
              fontSize: emphasize ? 18 : 15,
              color: emphasize ? scheme.primary : scheme.onSurface,
            ),
          ),
        ],
      ),
    );
  }
}
