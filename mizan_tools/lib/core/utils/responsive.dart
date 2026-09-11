import 'dart:ui' show DisplayFeature, DisplayFeatureType;

import 'package:flutter/material.dart';

/// Material 3 window-size classes, plus foldable helpers.
///
/// * compact  : < 600 dp (phones, folded cover screens)
/// * medium   : 600–839 dp (unfolded small tablets / foldables in portrait)
/// * expanded : >= 840 dp (unfolded foldables in landscape, tablets)
enum WindowSize { compact, medium, expanded }

class Responsive {
  Responsive._();

  static WindowSize sizeOf(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;
    if (width >= 840) return WindowSize.expanded;
    if (width >= 600) return WindowSize.medium;
    return WindowSize.compact;
  }

  static bool isCompact(BuildContext context) => sizeOf(context) == WindowSize.compact;
  static bool isExpanded(BuildContext context) => sizeOf(context) == WindowSize.expanded;

  /// Number of grid columns for tool cards at a given width.
  static int gridColumns(double width) {
    if (width >= 1200) return 5;
    if (width >= 840) return 4;
    if (width >= 600) return 3;
    return 2;
  }

  /// A vertical hinge (fold) that splits the window into two side-by-side
  /// panes, if the device reports one. Only returned when the hinge actually
  /// spans the window height (i.e. the device is in "book" posture).
  static DisplayFeature? verticalHingeOf(BuildContext context) {
    final mq = MediaQuery.of(context);
    for (final f in mq.displayFeatures) {
      final isHinge = f.type == DisplayFeatureType.hinge || f.type == DisplayFeatureType.fold;
      if (!isHinge) continue;
      final b = f.bounds;
      final spansHeight = b.top <= 0 && b.bottom >= mq.size.height - 1;
      if (spansHeight && b.width < mq.size.width / 2) return f;
    }
    return null;
  }

  /// Max content width so text lines stay readable on very wide screens.
  static const double maxContentWidth = 720;
}

/// Centers content and caps its width on large screens.
class ContentConstraint extends StatelessWidget {
  const ContentConstraint({super.key, required this.child, this.maxWidth = Responsive.maxContentWidth});

  final Widget child;
  final double maxWidth;

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.topCenter,
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: maxWidth),
        child: child,
      ),
    );
  }
}

/// Two-pane layout that respects a foldable hinge.
///
/// On compact windows only [primary] is shown. On medium/expanded windows the
/// [secondary] pane is shown next to it; if a vertical hinge is present the
/// split is placed exactly on the hinge so nothing renders under the fold.
class TwoPaneLayout extends StatefulWidget {
  const TwoPaneLayout({
    super.key,
    required this.primary,
    required this.secondary,
    this.primaryFraction = 0.42,
    this.minPrimaryWidth = 300,
  });

  final Widget primary;
  final Widget secondary;
  final double primaryFraction;
  final double minPrimaryWidth;

  @override
  State<TwoPaneLayout> createState() => _TwoPaneLayoutState();
}

class _TwoPaneLayoutState extends State<TwoPaneLayout> {
  /// Global x of this widget's left edge; hinge bounds are window-relative.
  double _globalLeft = 0;

  void _measure() {
    final box = context.findRenderObject();
    if (box is! RenderBox || !box.hasSize) return;
    final left = box.localToGlobal(Offset.zero).dx;
    if ((left - _globalLeft).abs() > 0.5 && mounted) {
      setState(() => _globalLeft = left);
    }
  }

  @override
  Widget build(BuildContext context) {
    final size = Responsive.sizeOf(context);
    if (size == WindowSize.compact) return widget.primary;

    final hinge = Responsive.verticalHingeOf(context);
    final isRtl = Directionality.of(context) == TextDirection.rtl;
    if (hinge != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _measure());
    }

    return LayoutBuilder(
      builder: (context, constraints) {
        final total = constraints.maxWidth;
        double leftWidth;
        double gap = 0;
        final hingeLocalLeft = hinge == null ? null : hinge.bounds.left - _globalLeft;
        final hingeUsable = hingeLocalLeft != null &&
            hingeLocalLeft > widget.minPrimaryWidth * 0.5 &&
            hingeLocalLeft + hinge!.bounds.width < total - widget.minPrimaryWidth * 0.5;
        if (hingeUsable) {
          leftWidth = hingeLocalLeft;
          gap = hinge.bounds.width;
        } else {
          leftWidth = (total * widget.primaryFraction).clamp(widget.minPrimaryWidth, total - widget.minPrimaryWidth);
        }
        final rightWidth = total - leftWidth - gap;

        // In RTL the primary (list) pane sits on the physical right.
        final first = isRtl ? widget.secondary : widget.primary;
        final second = isRtl ? widget.primary : widget.secondary;

        return Row(
          textDirection: TextDirection.ltr,
          children: [
            SizedBox(width: leftWidth, child: first),
            if (gap > 0) SizedBox(width: gap) else const VerticalDivider(width: 1),
            SizedBox(width: rightWidth - (gap > 0 ? 0 : 1), child: second),
          ],
        );
      },
    );
  }
}
