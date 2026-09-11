import 'package:flutter/material.dart';

import '../../core/l10n/strings.dart';
import '../../core/utils/responsive.dart';
import '../finance_hub/presentation/finance_hub_screen.dart';
import '../home/presentation/home_screen.dart';
import '../settings/presentation/settings_screen.dart';
import '../time_hub/presentation/time_hub_screen.dart';

/// Root navigation. Bottom bar on phones / folded state, side rail when the
/// window is medium or expanded (unfolded foldables, tablets, landscape).
class MainShell extends StatefulWidget {
  const MainShell({super.key});

  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> {
  int _index = 0;

  static const _screens = <Widget>[
    HomeScreen(),
    TimeHubScreen(),
    FinanceHubScreen(),
    SettingsScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    final s = S.of(context);
    final size = Responsive.sizeOf(context);
    final body = IndexedStack(index: _index, children: _screens);

    final items = [
      (Icons.grid_view_outlined, Icons.grid_view_rounded, s.navHome),
      (Icons.schedule_outlined, Icons.schedule_rounded, s.navTime),
      (Icons.account_balance_wallet_outlined, Icons.account_balance_wallet_rounded, s.navFinance),
      (Icons.settings_outlined, Icons.settings_rounded, s.navSettings),
    ];

    if (size == WindowSize.compact) {
      return Scaffold(
        body: body,
        bottomNavigationBar: NavigationBar(
          selectedIndex: _index,
          onDestinationSelected: (i) => setState(() => _index = i),
          destinations: [
            for (final it in items)
              NavigationDestination(icon: Icon(it.$1), selectedIcon: Icon(it.$2), label: it.$3),
          ],
        ),
      );
    }

    return Scaffold(
      body: Row(
        children: [
          NavigationRail(
            selectedIndex: _index,
            onDestinationSelected: (i) => setState(() => _index = i),
            extended: size == WindowSize.expanded && MediaQuery.sizeOf(context).width >= 1100,
            minExtendedWidth: 190,
            leading: Padding(
              padding: const EdgeInsets.symmetric(vertical: 12),
              child: Column(
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(colors: [Color(0xFF1E3A8A), Color(0xFF3B82F6)]),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: const Icon(Icons.balance_rounded, color: Colors.white),
                  ),
                ],
              ),
            ),
            destinations: [
              for (final it in items)
                NavigationRailDestination(icon: Icon(it.$1), selectedIcon: Icon(it.$2), label: Text(it.$3)),
            ],
          ),
          const VerticalDivider(width: 1),
          Expanded(child: body),
        ],
      ),
    );
  }
}
