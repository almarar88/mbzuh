import 'package:flutter/material.dart';

import 'custom_card.dart';

class ToolGridCard extends StatelessWidget {
  const ToolGridCard({
    super.key,
    required this.title,
    required this.icon,
    required this.color,
    this.subtitle,
    this.onTap,
    this.onLongPress,
    this.isFavorite = false,
    this.selected = false,
  });

  final String title;
  final String? subtitle;
  final IconData icon;
  final Color color;
  final VoidCallback? onTap;
  final VoidCallback? onLongPress;
  final bool isFavorite;
  final bool selected;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return CustomCard(
      padding: const EdgeInsets.all(14),
      onTap: onTap,
      onLongPress: onLongPress,
      borderColor: selected ? scheme.primary.withValues(alpha: 0.8) : null,
      color: selected ? scheme.primary.withValues(alpha: 0.12) : null,
      child: Stack(
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 46,
                height: 46,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [color.withValues(alpha: 0.95), color.withValues(alpha: 0.65)],
                  ),
                  boxShadow: [BoxShadow(color: color.withValues(alpha: 0.35), blurRadius: 14, offset: const Offset(0, 6))],
                ),
                child: Icon(icon, color: Colors.white, size: 24),
              ),
              const Spacer(),
              Text(
                title,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
              ),
              if (subtitle != null) ...[
                const SizedBox(height: 2),
                Text(
                  subtitle!,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(color: scheme.onSurfaceVariant, fontSize: 12, height: 1.3),
                ),
              ],
            ],
          ),
          if (isFavorite)
            PositionedDirectional(
              top: 0,
              end: 0,
              child: Icon(Icons.star_rounded, color: scheme.primary, size: 20),
            ),
        ],
      ),
    );
  }
}
