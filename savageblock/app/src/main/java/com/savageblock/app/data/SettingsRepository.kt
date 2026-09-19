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
 * Single source of truth for user settings, today's ledger and the archived history.
 *
 * Settings and history are persisted as JSON in Preferences DataStore. Today's stats are kept hot
 * in a [StateFlow] (updated once per second by the monitor service) and flushed periodically.
 */
class SettingsRepository(private val context: Context) {

    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    private val settingsKey = stringPreferencesKey("settings_json")
    private val statsKey = stringPreferencesKey("stats_json")
    private val historyKey = stringPreferencesKey("history_json")

    val settings: Flow<Settings> = context.dataStore.data.map { prefs -> prefs.settings() }

    val history: Flow<History> = context.dataStore.data.map { prefs -> prefs.history() }

    private val _liveStats = MutableStateFlow(DailyStats())
    val liveStats: StateFlow<DailyStats> = _liveStats.asStateFlow()

    init {
        scope.launch {
            val prefs = context.dataStore.data.first()
            val stored = prefs[statsKey]?.let { runCatching { json.decodeFromString<DailyStats>(it) }.getOrNull() }
                ?: return@launch
            if (stored.date == todayKey()) {
                _liveStats.update { live ->
                    // Merge so a fast-starting service never loses ticks recorded before the load.
                    val merged = (stored.seconds.keys + live.seconds.keys).associateWith { pkg ->
                        maxOf(stored.secondsFor(pkg), live.secondsFor(pkg))
                    }
                    DailyStats(stored.date, merged, maxOf(stored.blocks, live.blocks))
                }
            } else {
                // The app was closed over midnight: archive the stale day before it is lost.
                archive(stored, prefs.settings())
            }
        }
    }

    private fun Preferences.settings(): Settings =
        this[settingsKey]?.let { runCatching { json.decodeFromString<Settings>(it) }.getOrNull() } ?: Settings()

    private fun Preferences.history(): History =
        this[historyKey]?.let { runCatching { json.decodeFromString<History>(it) }.getOrNull() } ?: History()

    suspend fun currentSettings(): Settings = settings.first()

    suspend fun updateSettings(transform: (Settings) -> Settings) {
        context.dataStore.edit { prefs ->
            prefs[settingsKey] = json.encodeToString(Settings.serializer(), transform(prefs.settings()))
        }
    }

    /** Fire-and-forget settings write on the repository's own scope (safe from a dying service). */
    fun updateSettingsAsync(transform: (Settings) -> Settings) {
        scope.launch { updateSettings(transform) }
    }

    /** Applies an in-memory change to today's ledger; rolls the ledger over if the day changed. */
    fun updateLiveStats(settings: Settings? = null, transform: (DailyStats) -> DailyStats) {
        rolloverIfNeeded(settings)
        _liveStats.update(transform)
    }

    /**
     * If the hot ledger belongs to a previous day, freeze it into history (with the limits that
     * applied) and start a fresh one. Safe to call every tick.
     */
    fun rolloverIfNeeded(settings: Settings?) {
        val current = _liveStats.value
        if (current.date == todayKey()) return
        if (_liveStats.compareAndSet(current, DailyStats())) {
            scope.launch { archive(current, settings ?: currentSettings()) }
        }
    }

    private suspend fun archive(day: DailyStats, settings: Settings) {
        if (day.seconds.isEmpty() && day.blocks == 0) return
        val limits = settings.apps.associate { it.packageName to it.limitMinutes * 60L }
        val record = DayRecord(day.date, day.seconds, day.blocks, limits)
        context.dataStore.edit { prefs ->
            val existing = prefs.history().days.filterNot { it.date == record.date }
            val trimmed = (existing + record).sortedBy { it.date }.takeLast(HISTORY_DAYS)
            prefs[historyKey] = json.encodeToString(History.serializer(), History(trimmed))
        }
    }

    suspend fun persistStats() {
        val snapshot = _liveStats.value
        context.dataStore.edit { prefs ->
            prefs[statsKey] = json.encodeToString(DailyStats.serializer(), snapshot)
        }
    }

    /** Wipes ledger + history (Settings → "امسح البيانات"). Settings are kept. */
    suspend fun clearHistory() {
        _liveStats.value = DailyStats()
        context.dataStore.edit { prefs ->
            prefs.remove(historyKey)
            prefs.remove(statsKey)
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
