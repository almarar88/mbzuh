package com.savageblock.app.data

import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import java.time.LocalDate
import java.time.ZoneId

/**
 * Cheap foreground-app detection built on [UsageStatsManager.queryEvents].
 *
 * Each call only scans events newer than the last one seen, so a 1-second polling loop
 * costs almost nothing. Requires the PACKAGE_USAGE_STATS app-op to be granted.
 */
class ForegroundDetector(context: Context) {

    private val usageStatsManager =
        context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager

    private var lastPackage: String? = null
    private var lastEventTime = 0L

    @Suppress("DEPRECATION")
    fun currentForeground(): String? {
        val now = System.currentTimeMillis()
        // First call looks back an hour to find whatever is already on screen.
        val begin = if (lastEventTime == 0L) now - 60 * 60 * 1000L else lastEventTime + 1
        val events = usageStatsManager.queryEvents(begin, now) ?: return lastPackage
        val event = UsageEvents.Event()
        while (events.hasNextEvent()) {
            events.getNextEvent(event)
            // ACTIVITY_RESUMED (API 29) shares the value of MOVE_TO_FOREGROUND.
            if (event.eventType == UsageEvents.Event.MOVE_TO_FOREGROUND) {
                lastPackage = event.packageName
                lastEventTime = event.timeStamp
            }
        }
        return lastPackage
    }

    /** Foreground seconds per package since local midnight, as reported by the system. */
    fun todaySecondsByPackage(): Map<String, Long> {
        val start = LocalDate.now().atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli()
        val now = System.currentTimeMillis()
        val stats = usageStatsManager.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, start, now)
            ?: return emptyMap()
        return stats
            .filter { it.lastTimeUsed >= start }
            .groupBy { it.packageName }
            .mapValues { (_, list) -> list.sumOf { it.totalTimeInForeground } / 1000L }
    }
}
