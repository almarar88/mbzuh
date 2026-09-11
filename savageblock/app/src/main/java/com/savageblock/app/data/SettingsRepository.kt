package com.savageblock.app.data

import android.content.Context
import android.content.pm.PackageManager
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.serialization.json.Json

private val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "savageblock")

/**
 * Single source of truth for user settings and the daily usage ledger.
 *
 * Settings are persisted as JSON in Preferences DataStore. Daily stats are kept hot in a
 * [StateFlow] (updated once per second by the monitor service) and flushed to disk periodically.
 */
class SettingsRepository(private val context: Context) {

    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    private val settingsKey = stringPreferencesKey("settings_json")
    private val statsKey = stringPreferencesKey("stats_json")

    val settings: Flow<Settings> = context.dataStore.data.map { prefs ->
        prefs[settingsKey]?.let { runCatching { json.decodeFromString<Settings>(it) }.getOrNull() } ?: Settings()
    }

    private val _liveStats = MutableStateFlow(DailyStats())
    val liveStats: StateFlow<DailyStats> = _liveStats.asStateFlow()

    init {
        scope.launch {
            val stored = context.dataStore.data.first()[statsKey]
                ?.let { runCatching { json.decodeFromString<DailyStats>(it) }.getOrNull() }
            if (stored != null && stored.date == todayKey()) {
                _liveStats.update { live ->
                    // Merge so a fast-starting service never loses ticks recorded before the load.
                    val merged = (stored.seconds.keys + live.seconds.keys).associateWith { pkg ->
                        maxOf(stored.secondsFor(pkg), live.secondsFor(pkg))
                    }
                    DailyStats(stored.date, merged, maxOf(stored.blocks, live.blocks))
                }
            }
        }
    }

    suspend fun currentSettings(): Settings = settings.first()

    suspend fun updateSettings(transform: (Settings) -> Settings) {
        context.dataStore.edit { prefs ->
            val current = prefs[settingsKey]
                ?.let { runCatching { json.decodeFromString<Settings>(it) }.getOrNull() } ?: Settings()
            prefs[settingsKey] = json.encodeToString(Settings.serializer(), transform(current))
        }
    }

    /** Fire-and-forget settings write on the repository's own scope (safe from a dying service). */
    fun updateSettingsAsync(transform: (Settings) -> Settings) {
        scope.launch { updateSettings(transform) }
    }

    /** Applies an in-memory change to today's ledger; rolls the ledger over if the day changed. */
    fun updateLiveStats(transform: (DailyStats) -> DailyStats) {
        _liveStats.update { current ->
            val base = if (current.date == todayKey()) current else DailyStats()
            transform(base)
        }
    }

    suspend fun persistStats() {
        val snapshot = _liveStats.value
        context.dataStore.edit { prefs ->
            prefs[statsKey] = json.encodeToString(DailyStats.serializer(), snapshot)
        }
    }

    /** On first run, pre-select the usual suspects that happen to be installed. */
    suspend fun seedDefaultsIfNeeded(pm: PackageManager) {
        val current = currentSettings()
        if (current.defaultsSeeded) return
        val installed = DEFAULT_TARGETS
            .filter { (pkg, _) -> runCatching { pm.getApplicationInfo(pkg, 0) }.isSuccess }
            .map { (pkg, label) ->
                val realLabel = runCatching {
                    pm.getApplicationLabel(pm.getApplicationInfo(pkg, 0)).toString()
                }.getOrDefault(label)
                MonitoredApp(pkg, realLabel, DEFAULT_LIMIT_MINUTES)
            }
            .distinctBy { it.packageName }
        updateSettings { it.copy(defaultsSeeded = true, apps = (it.apps + installed).distinctBy { a -> a.packageName }) }
    }
}
