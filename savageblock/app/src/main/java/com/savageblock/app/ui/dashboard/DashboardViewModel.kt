package com.savageblock.app.ui.dashboard

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.savageblock.app.SavageBlockApp
import com.savageblock.app.data.AggressionLevel
import com.savageblock.app.data.DEFAULT_LIMIT_MINUTES
import com.savageblock.app.data.DailyStats
import com.savageblock.app.data.Goal
import com.savageblock.app.data.History
import com.savageblock.app.data.InstalledApp
import com.savageblock.app.data.InstalledApps
import com.savageblock.app.data.MAX_LIMIT_MINUTES
import com.savageblock.app.data.MIN_LIMIT_MINUTES
import com.savageblock.app.data.MonitoredApp
import com.savageblock.app.data.Schedule
import com.savageblock.app.data.Settings
import com.savageblock.app.data.endOfTodayMillis
import com.savageblock.app.service.MonitorService
import com.savageblock.app.util.PermissionState
import com.savageblock.app.util.Permissions
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

class DashboardViewModel(application: Application) : AndroidViewModel(application) {

    private val context get() = getApplication<Application>()
    private val repository = SavageBlockApp.repository(application)

    /** `null` until the first read from disk completes. */
    val settings: StateFlow<Settings?> = repository.settings
        .map<Settings, Settings?> { it }
        .stateIn(viewModelScope, SharingStarted.Eagerly, null)

    val history: StateFlow<History> = repository.history
        .stateIn(viewModelScope, SharingStarted.Eagerly, History())

    val stats: StateFlow<DailyStats> = repository.liveStats
    val serviceRunning: StateFlow<Boolean> = MonitorService.isRunning

    private val _permissions = MutableStateFlow(Permissions.state(application))
    val permissions: StateFlow<PermissionState> = _permissions.asStateFlow()

    private val _installedApps = MutableStateFlow<List<InstalledApp>?>(null)
    val installedApps: StateFlow<List<InstalledApp>?> = _installedApps.asStateFlow()

    init {
        viewModelScope.launch { repository.seedDefaultsIfNeeded(context.packageManager) }
    }

    fun refreshPermissions() {
        _permissions.value = Permissions.state(context)
    }

    /** Called on resume: roll the ledger over if needed and restart the monitor if it died. */
    fun ensureServiceState() {
        val s = settings.value ?: return
        repository.rolloverIfNeeded(s)
        if (s.monitoringEnabled && permissions.value.essentialsGranted && !serviceRunning.value) {
            MonitorService.start(context)
        }
    }

    fun loadInstalledApps() {
        if (_installedApps.value != null) return
        viewModelScope.launch { _installedApps.value = InstalledApps.launchable(context) }
    }

    fun completeOnboarding() = update { it.copy(onboardingDone = true) }

    fun setName(name: String) = update { it.copy(userName = name.take(24)) }

    fun setGoal(goal: Goal) = update { it.copy(goal = goal) }

    /** Strict mode never lets the user soften the level. */
    fun setAggression(level: AggressionLevel) = update { s ->
        if (s.strictActive && level.ordinal < s.aggression.ordinal) s else s.copy(aggression = level)
    }

    /** Strict mode allows tightening a limit but never loosening it. */
    fun setLimit(packageName: String, minutes: Int) = update { s ->
        val clamped = minutes.coerceIn(MIN_LIMIT_MINUTES, MAX_LIMIT_MINUTES)
        s.copy(
            apps = s.apps.map {
                if (it.packageName != packageName) it
                else if (s.strictActive && clamped > it.limitMinutes) it
                else it.copy(limitMinutes = clamped)
            },
        )
    }

    fun removeApp(packageName: String) = update { s ->
        if (s.strictActive) s else s.copy(apps = s.apps.filterNot { it.packageName == packageName })
    }

    fun toggleApp(app: InstalledApp) = update { s ->
        if (s.app(app.packageName) != null) {
            if (s.strictActive) s else s.copy(apps = s.apps.filterNot { it.packageName == app.packageName })
        } else {
            s.copy(apps = s.apps + MonitoredApp(app.packageName, app.label, DEFAULT_LIMIT_MINUTES))
        }
    }

    fun setSchedule(schedule: Schedule) = update { s ->
        // Strict mode may not shrink the focus window to nothing; disabling the schedule widens it (fine).
        s.copy(schedule = schedule)
    }

    fun setWarnAt(percent: Int) = update { it.copy(warnAtPercent = percent.coerceIn(0, 95)) }

    /** Locks every escape hatch until local midnight. There is deliberately no undo. */
    fun enableStrictMode() = update { it.copy(strictUntil = endOfTodayMillis(), monitoringEnabled = true) }
        .also { MonitorService.start(context) }

    fun setMonitoring(enabled: Boolean) {
        val s = settings.value
        if (!enabled && s?.strictActive == true) return
        viewModelScope.launch {
            repository.updateSettings { it.copy(monitoringEnabled = enabled) }
            if (enabled) MonitorService.start(context) else MonitorService.stop(context)
        }
    }

    fun clearHistory() {
        viewModelScope.launch { repository.clearHistory() }
    }

    private fun update(transform: (Settings) -> Settings) {
        viewModelScope.launch { repository.updateSettings(transform) }
    }
}
