package com.savageblock.app.service

import android.app.Notification
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import com.savageblock.app.MainActivity
import com.savageblock.app.R
import com.savageblock.app.SavageBlockApp
import com.savageblock.app.data.DailyStats
import com.savageblock.app.data.ForegroundDetector
import com.savageblock.app.data.MonitoredApp
import com.savageblock.app.data.Roasts
import com.savageblock.app.data.Settings
import com.savageblock.app.data.SettingsRepository
import com.savageblock.app.data.todayKey
import com.savageblock.app.util.Permissions
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withContext

/**
 * Foreground service that polls the foreground app once per second, accumulates today's usage
 * for monitored packages, and fires the savage overlay when a limit is breached.
 */
class MonitorService : Service() {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private lateinit var repository: SettingsRepository
    private lateinit var detector: ForegroundDetector
    private lateinit var overlay: OverlayManager
    private lateinit var effects: PenaltyEffects

    private var loopJob: Job? = null
    private var ticksSincePersist = 0
    private var seededDate: String? = null
    private var overlaySessionCounter = 0L

    /** After the user leaves an app we ignore it briefly so the launcher event can land. */
    private val snoozeUntil = HashMap<String, Long>()

    override fun onCreate() {
        super.onCreate()
        repository = SavageBlockApp.repository(this)
        detector = ForegroundDetector(this)
        overlay = OverlayManager(this)
        effects = PenaltyEffects(this)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            // Written on the repository scope: this service's own scope dies in onDestroy.
            repository.updateSettingsAsync { it.copy(monitoringEnabled = false) }
            stopSelf()
            return START_NOT_STICKY
        }
        startAsForeground()
        if (loopJob == null) loopJob = scope.launch { monitorLoop() }
        _isRunning.value = true
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        _isRunning.value = false
        dismissOverlay()
        runBlocking { runCatching { repository.persistStats() } }
        scope.cancel()
        super.onDestroy()
    }

    // ---------------------------------------------------------------- loop

    private suspend fun monitorLoop() {
        val settingsFlow = repository.settings.stateIn(scope, SharingStarted.Eagerly, repository.currentSettings())
        while (scope.isActive) {
            val settings = settingsFlow.value
            if (!Permissions.hasUsageAccess(this)) {
                // Permission revoked mid-run: keep the service alive but stay quiet.
                dismissOverlay()
                delay(5_000)
                continue
            }
            seedFromSystemIfNewDay(settings)
            val foreground = withContext(Dispatchers.Default) { detector.currentForeground() }
            tick(settings, foreground)
            if (++ticksSincePersist >= PERSIST_EVERY_TICKS) {
                ticksSincePersist = 0
                withContext(Dispatchers.IO) { runCatching { repository.persistStats() } }
            }
            delay(TICK_MS)
        }
    }

    private fun tick(settings: Settings, foreground: String?) {
        if (foreground == null || foreground == packageName) {
            dismissOverlay()
            return
        }
        val app = settings.app(foreground)
        if (app == null) {
            dismissOverlay()
            return
        }
        if (overlay.isShowing && overlay.currentPackage != foreground) dismissOverlay()

        // Time spent staring at the roast is punishment, not usage.
        if (!overlay.isShowing) {
            repository.updateLiveStats { stats ->
                stats.copy(seconds = stats.seconds + (foreground to stats.secondsFor(foreground) + 1))
            }
        }

        val stats = repository.liveStats.value
        val used = stats.secondsFor(foreground)
        val limitSeconds = app.limitMinutes * 60L
        val snoozed = (snoozeUntil[foreground] ?: 0L) > System.currentTimeMillis()
        if (used >= limitSeconds && !overlay.isShowing && !snoozed) {
            strike(settings, app, stats)
        }
    }

    /** Once per day, adopt the system's own usage counters so restarts don't reset the ledger. */
    private suspend fun seedFromSystemIfNewDay(settings: Settings) {
        val today = todayKey()
        if (seededDate == today) return
        seededDate = today
        val system = withContext(Dispatchers.Default) { runCatching { detector.todaySecondsByPackage() }.getOrDefault(emptyMap()) }
        val monitored = settings.apps.map { it.packageName }.toSet()
        repository.updateLiveStats { stats ->
            val merged = stats.seconds.toMutableMap()
            for (pkg in monitored) {
                val sys = system[pkg] ?: continue
                merged[pkg] = maxOf(merged[pkg] ?: 0L, sys)
            }
            stats.copy(seconds = merged)
        }
    }

    // ---------------------------------------------------------------- overlay

    private fun strike(settings: Settings, app: MonitoredApp, stats: DailyStats) {
        val wastedMinutes = (stats.secondsFor(app.packageName) / 60).toInt()
        repository.updateLiveStats { it.copy(blocks = it.blocks + 1) }
        val session = OverlaySession(
            id = ++overlaySessionCounter,
            packageName = app.packageName,
            appLabel = app.label,
            roast = Roasts.pick(settings.goal, settings.aggression, app.label, wastedMinutes),
            level = settings.aggression,
            goal = settings.goal,
            wastedMinutes = wastedMinutes,
            limitMinutes = app.limitMinutes,
            strikesToday = stats.blocks + 1,
        )
        overlay.show(session) { leave(app.packageName) }
        if (overlay.isShowing) effects.start(settings.aggression)
    }

    private fun leave(packageName: String) {
        snoozeUntil[packageName] = System.currentTimeMillis() + LEAVE_SNOOZE_MS
        dismissOverlay()
        goHome()
    }

    private fun dismissOverlay() {
        if (!overlay.isShowing) return
        effects.stop()
        overlay.hide()
    }

    private fun goHome() {
        val home = Intent(Intent.ACTION_MAIN)
            .addCategory(Intent.CATEGORY_HOME)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        runCatching { startActivity(home) }
    }

    // ---------------------------------------------------------------- notification

    private fun startAsForeground() {
        val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE
        } else {
            0
        }
        ServiceCompat.startForeground(this, NOTIFICATION_ID, buildNotification(), type)
    }

    private fun buildNotification(): Notification {
        val openIntent = PendingIntent.getActivity(
            this, 0, Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val stopIntent = PendingIntent.getService(
            this, 1, Intent(this, MonitorService::class.java).setAction(ACTION_STOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        return NotificationCompat.Builder(this, SavageBlockApp.MONITOR_CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(getString(R.string.notification_title))
            .setContentText("تفتح تطبيق محظور.. تنهزأ. بسيطة.")
            .setContentIntent(openIntent)
            .addAction(0, getString(R.string.notification_stop), stopIntent)
            .setOngoing(true)
            .setSilent(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .build()
    }

    companion object {
        private const val ACTION_START = "com.savageblock.app.action.START"
        private const val ACTION_STOP = "com.savageblock.app.action.STOP"
        private const val NOTIFICATION_ID = 1001
        private const val TICK_MS = 1_000L
        private const val PERSIST_EVERY_TICKS = 15
        private const val LEAVE_SNOOZE_MS = 4_000L

        private val _isRunning = MutableStateFlow(false)
        val isRunning: StateFlow<Boolean> = _isRunning.asStateFlow()

        fun start(context: Context) {
            val intent = Intent(context, MonitorService::class.java).setAction(ACTION_START)
            ContextCompat.startForegroundService(context, intent)
        }

        fun stop(context: Context) {
            context.stopService(Intent(context, MonitorService::class.java))
        }
    }
}
