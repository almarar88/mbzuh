package com.savageblock.app

import android.Manifest
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.savageblock.app.ui.apps.AppsScreen
import com.savageblock.app.ui.components.BottomNav
import com.savageblock.app.ui.components.Tab
import com.savageblock.app.ui.dashboard.AppSelectorScreen
import com.savageblock.app.ui.dashboard.DashboardViewModel
import com.savageblock.app.ui.home.HomeScreen
import com.savageblock.app.ui.onboarding.OnboardingScreen
import com.savageblock.app.ui.onboarding.PermissionsScreen
import com.savageblock.app.ui.reports.ReportsScreen
import com.savageblock.app.ui.settings.SettingsScreen
import com.savageblock.app.ui.theme.Canvas
import com.savageblock.app.ui.theme.SavageTheme
import com.savageblock.app.util.Permissions

class MainActivity : ComponentActivity() {

    private val viewModel: DashboardViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge(
            statusBarStyle = SystemBarStyle.light(Color.TRANSPARENT, Color.TRANSPARENT),
            navigationBarStyle = SystemBarStyle.light(Color.TRANSPARENT, Color.TRANSPARENT),
        )
        super.onCreate(savedInstanceState)
        setContent {
            SavageTheme {
                SavageApp(viewModel)
            }
        }
    }

    override fun onResume() {
        super.onResume()
        viewModel.refreshPermissions()
        viewModel.ensureServiceState()
    }
}

private object Routes {
    const val ONBOARDING = "onboarding"
    const val PERMISSIONS = "permissions"
    const val HOME = "home"
    const val APPS = "apps"
    const val REPORTS = "reports"
    const val SETTINGS = "settings"
    const val SELECTOR = "selector"

    fun forTab(tab: Tab) = when (tab) {
        Tab.HOME -> HOME
        Tab.APPS -> APPS
        Tab.REPORTS -> REPORTS
        Tab.SETTINGS -> SETTINGS
    }

    fun tabFor(route: String?): Tab? = when (route) {
        HOME -> Tab.HOME
        APPS -> Tab.APPS
        REPORTS -> Tab.REPORTS
        SETTINGS -> Tab.SETTINGS
        else -> null
    }
}

@Composable
private fun SavageApp(viewModel: DashboardViewModel) {
    val context = LocalContext.current
    val settings by viewModel.settings.collectAsStateWithLifecycle()
    val stats by viewModel.stats.collectAsStateWithLifecycle()
    val history by viewModel.history.collectAsStateWithLifecycle()
    val permissions by viewModel.permissions.collectAsStateWithLifecycle()
    val serviceRunning by viewModel.serviceRunning.collectAsStateWithLifecycle()
    val installedApps by viewModel.installedApps.collectAsStateWithLifecycle()

    val notificationLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { viewModel.refreshPermissions() }

    val current = settings
    if (current == null) {
        Box(Modifier.fillMaxSize().background(Canvas))
        return
    }

    val navController = rememberNavController()
    val backStack by navController.currentBackStackEntryAsState()
    val currentTab = Routes.tabFor(backStack?.destination?.route)
    val start = when {
        !current.onboardingDone -> Routes.ONBOARDING
        !permissions.essentialsGranted -> Routes.PERMISSIONS
        else -> Routes.HOME
    }

    fun switchTab(tab: Tab) {
        navController.navigate(Routes.forTab(tab)) {
            popUpTo(Routes.HOME) { saveState = true }
            launchSingleTop = true
            restoreState = true
        }
    }

    Scaffold(
        containerColor = Canvas,
        bottomBar = {
            if (currentTab != null) {
                Box(Modifier.navigationBarsPadding()) {
                    BottomNav(
                        selected = currentTab,
                        onSelect = ::switchTab,
                        onAdd = { navController.navigate(Routes.SELECTOR) },
                    )
                }
            }
        },
    ) { padding ->
        NavHost(navController = navController, startDestination = start) {
            composable(Routes.ONBOARDING) {
                OnboardingScreen(
                    onFinish = {
                        viewModel.completeOnboarding()
                        navController.navigate(Routes.PERMISSIONS) { popUpTo(Routes.ONBOARDING) { inclusive = true } }
                    },
                )
            }
            composable(Routes.PERMISSIONS) {
                PermissionsScreen(
                    permissions = permissions,
                    onBack = if (current.onboardingDone && permissions.essentialsGranted) ({ navController.popBackStack() }) else null,
                    onRequestUsageAccess = { context.startActivity(Permissions.usageAccessIntent()) },
                    onRequestOverlay = { context.startActivity(Permissions.overlayIntent(context)) },
                    onRequestNotifications = {
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                            notificationLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
                        } else {
                            context.startActivity(Permissions.appNotificationSettingsIntent(context))
                        }
                    },
                    onRequestBattery = { context.startActivity(Permissions.batteryIntent(context)) },
                    onDone = {
                        navController.navigate(Routes.HOME) { popUpTo(Routes.PERMISSIONS) { inclusive = true } }
                    },
                )
            }
            composable(Routes.HOME) {
                HomeScreen(
                    settings = current,
                    stats = stats,
                    history = history,
                    serviceRunning = serviceRunning,
                    permissions = permissions,
                    contentPadding = padding,
                    onToggleBlocking = viewModel::setMonitoring,
                    onPause = { minutes -> if (minutes < 0) viewModel.pauseUntilTomorrow() else viewModel.pauseFor(minutes) },
                    onExempt = viewModel::setExemptToday,
                    onAddApps = { navController.navigate(Routes.SELECTOR) },
                    onManageApps = { switchTab(Tab.APPS) },
                    onReports = { switchTab(Tab.REPORTS) },
                    onSettings = { switchTab(Tab.SETTINGS) },
                    onFixPermissions = { navController.navigate(Routes.PERMISSIONS) },
                    onDismissHelp = viewModel::dismissHelp,
                )
            }
            composable(Routes.APPS) {
                AppsScreen(
                    settings = current,
                    stats = stats,
                    contentPadding = padding,
                    onLimit = viewModel::setLimit,
                    onRemove = viewModel::removeApp,
                    onExempt = viewModel::setExemptToday,
                    onAdd = { navController.navigate(Routes.SELECTOR) },
                )
            }
            composable(Routes.REPORTS) {
                ReportsScreen(
                    settings = current,
                    stats = stats,
                    history = history,
                    contentPadding = padding,
                    onBack = null,
                    onShare = { text ->
                        val send = Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, text)
                        context.startActivity(Intent.createChooser(send, "مشاركة التقرير"))
                    },
                )
            }
            composable(Routes.SETTINGS) {
                SettingsScreen(
                    settings = current,
                    permissions = permissions,
                    contentPadding = padding,
                    onName = viewModel::setName,
                    onGoal = viewModel::setGoal,
                    onAggression = viewModel::setAggression,
                    onSchedule = viewModel::setSchedule,
                    onWarnAt = viewModel::setWarnAt,
                    onStrict = viewModel::enableStrictMode,
                    onEmergencyUnlock = viewModel::emergencyUnlock,
                    onPermissions = { navController.navigate(Routes.PERMISSIONS) },
                    onPrivacy = {
                        runCatching {
                            context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(context.getString(R.string.privacy_policy_url))))
                        }
                    },
                    onClearHistory = viewModel::clearHistory,
                )
            }
            composable(Routes.SELECTOR) {
                LaunchedEffect(Unit) { viewModel.loadInstalledApps() }
                AppSelectorScreen(
                    apps = installedApps,
                    selected = current.apps.map { it.packageName }.toSet(),
                    strict = current.strictActive,
                    onToggle = viewModel::toggleApp,
                    onBack = { navController.popBackStack() },
                )
            }
        }
    }
}
