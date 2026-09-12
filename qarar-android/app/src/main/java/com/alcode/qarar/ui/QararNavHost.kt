package com.alcode.qarar.ui

import androidx.compose.material3.SnackbarHostState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.alcode.qarar.QararApp
import com.alcode.qarar.ui.screens.DetailScreen
import com.alcode.qarar.ui.screens.HomeScreen
import com.alcode.qarar.ui.screens.InsightsScreen
import com.alcode.qarar.ui.screens.NewDecisionScreen
import com.alcode.qarar.ui.screens.OnboardingScreen
import com.alcode.qarar.ui.screens.SettingsScreen

@Composable
fun QararNavHost() {
    val app = LocalContext.current.applicationContext as QararApp
    val vm: AppViewModel = viewModel(factory = AppViewModel.factory(app))
    val nav = rememberNavController()
    val snackbar = remember { SnackbarHostState() }

    val decisions by vm.decisions.collectAsStateWithLifecycle()
    val settings by vm.settings.collectAsStateWithLifecycle()
    val busy by vm.busy.collectAsStateWithLifecycle()
    val insights by vm.insights.collectAsStateWithLifecycle()
    val pingResult by vm.pingResult.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) { vm.messages.collect { snackbar.showSnackbar(it) } }

    val start = if (settings.onboardingDone) "home" else "onboarding"

    NavHost(navController = nav, startDestination = start) {
        composable("onboarding") {
            OnboardingScreen(onDone = {
                vm.completeOnboarding()
                nav.navigate("home") { popUpTo("onboarding") { inclusive = true } }
            })
        }
        composable("home") {
            HomeScreen(
                decisions = decisions, settings = settings, snackbar = snackbar,
                onNew = { nav.navigate("new") },
                onOpen = { nav.navigate("detail/$it") },
                onInsights = { nav.navigate("insights") },
                onSettings = { nav.navigate("settings") },
            )
        }
        composable("new") {
            NewDecisionScreen(
                onBack = { nav.popBackStack() },
                onSave = { d ->
                    vm.save(d)
                    nav.navigate("detail/${d.id}") { popUpTo("home") }
                },
            )
        }
        composable("detail/{id}", arguments = listOf(navArgument("id") { type = NavType.StringType })) { entry ->
            val id = entry.arguments?.getString("id").orEmpty()
            val decision = decisions.firstOrNull { it.id == id }
            if (decision == null) {
                LaunchedEffect(id) { nav.popBackStack() }
            } else {
                DetailScreen(
                    decision = decision,
                    job = busy[id],
                    hasKey = settings.hasKey,
                    snackbar = snackbar,
                    onBack = { nav.popBackStack() },
                    onSave = vm::save,
                    onDelete = { vm.delete(id); nav.popBackStack() },
                    onAnalyze = { vm.analyze(id) },
                    onReview = { vm.review(id) },
                    onSettings = { nav.navigate("settings") },
                )
            }
        }
        composable("insights") {
            InsightsScreen(
                decisions = decisions, insights = insights,
                busy = busy.containsKey(AppViewModel.INSIGHTS_KEY),
                hasKey = settings.hasKey, snackbar = snackbar,
                onBack = { nav.popBackStack() },
                onGenerate = vm::generateInsights,
            )
        }
        composable("settings") {
            SettingsScreen(
                settings = settings, pingResult = pingResult,
                pinging = busy.containsKey(AppViewModel.PING_KEY),
                snackbar = snackbar,
                onBack = { nav.popBackStack() },
                onUpdate = vm::updateSettings,
                onPing = vm::ping,
            )
        }
    }
}
