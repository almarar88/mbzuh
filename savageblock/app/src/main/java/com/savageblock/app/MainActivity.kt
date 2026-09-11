package com.savageblock.app

import android.Manifest
import android.graphics.Color
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
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.savageblock.app.ui.dashboard.AppSelectorScreen
import com.savageblock.app.ui.dashboard.DashboardScreen
import com.savageblock.app.ui.dashboard.DashboardViewModel
import com.savageblock.app.ui.onboarding.OnboardingScreen
import com.savageblock.app.ui.theme.SavageTheme
import com.savageblock.app.ui.theme.Void
import com.savageblock.app.util.Permissions

class MainActivity : ComponentActivity() {

    private val viewModel: DashboardViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge(
            statusBarStyle = SystemBarStyle.dark(Color.TRANSPARENT),
            navigationBarStyle = SystemBarStyle.dark(Color.TRANSPARENT),
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
    const val DASHBOARD = "dashboard"
    const val APPS = "apps"
}

@Composable
private fun SavageApp(viewModel: DashboardViewModel) {
    val context = LocalContext.current
    val settings by viewModel.settings.collectAsStateWithLifecycle()
    val stats by viewModel.stats.collectAsStateWithLifecycle()
    val permissions by viewModel.permissions.collectAsStateWithLifecycle()
    val serviceRunning by viewModel.serviceRunning.collectAsStateWithLifecycle()
    val installedApps by viewModel.installedApps.collectAsStateWithLifecycle()

    val notificationLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { viewModel.refreshPermissions() }

    val current = settings
    if (current == null) {
        Box(Modifier.fillMaxSize().background(Void))
        return
    }

    val navController = rememberNavController()
    val start = if (current.onboardingDone && permissions.essentialsGranted) Routes.DASHBOARD else Routes.ONBOARDING

    NavHost(navController = navController, startDestination = start) {
        composable(Routes.ONBOARDING) {
            OnboardingScreen(
                permissions = permissions,
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
                    viewModel.completeOnboarding()
                    navController.navigate(Routes.DASHBOARD) {
                        popUpTo(Routes.ONBOARDING) { inclusive = true }
                    }
                },
            )
        }
        composable(Routes.DASHBOARD) {
            DashboardScreen(
                settings = current,
                stats = stats,
                serviceRunning = serviceRunning,
                permissions = permissions,
                onToggleMonitoring = viewModel::setMonitoring,
                onGoal = viewModel::setGoal,
                onAggression = viewModel::setAggression,
                onLimit = viewModel::setLimit,
                onRemove = viewModel::removeApp,
                onAddApps = { navController.navigate(Routes.APPS) },
                onFixPermissions = { navController.navigate(Routes.ONBOARDING) },
            )
        }
        composable(Routes.APPS) {
            LaunchedEffect(Unit) { viewModel.loadInstalledApps() }
            AppSelectorScreen(
                apps = installedApps,
                selected = current.apps.map { it.packageName }.toSet(),
                onToggle = viewModel::toggleApp,
                onBack = { navController.popBackStack() },
            )
        }
    }
}
