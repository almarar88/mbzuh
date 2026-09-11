import 'package:flutter/material.dart';

import '../../../core/l10n/strings.dart';
import '../../../core/tools_registry.dart';
import '../../../shared/widgets/tool_hub.dart';

class FinanceHubScreen extends StatelessWidget {
  const FinanceHubScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final s = S.of(context);
    return ToolHubScreen(title: s.catFinance, tools: ToolsRegistry.financeTools);
  }
}
