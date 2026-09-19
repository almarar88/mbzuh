package com.savageblock.app.data

import kotlinx.serialization.Serializable
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.ZoneId

/** The exact phrase the user must type to escape the overlay in Savage mode. */
const val CONFESSION_PHRASE = "أنا أضيع وقتي بلا هدف"

/** Daily allowance applied to newly added apps. */
const val DEFAULT_LIMIT_MINUTES = 30

const val MIN_LIMIT_MINUTES = 5
const val MAX_LIMIT_MINUTES = 180

/** How many archived days we keep for reports and streaks. */
const val HISTORY_DAYS = 60

@Serializable
enum class AggressionLevel(
    val title: String,
    val description: String,
    val countdownSeconds: Int,
    val requiresConfession: Boolean,
    val vibrates: Boolean,
    val playsAlarm: Boolean,
) {
    LOW(
        title = "خفيف",
        description = "سخرية ذكية وملاحظات لاذعة. تنتظر ٥ ثوانٍ وتطلع.",
        countdownSeconds = 5,
        requiresConfession = false,
        vibrates = false,
        playsAlarm = false,
    ),
    MEDIUM(
        title = "متوسط",
        description = "طقطقة قوية ودقّ بالكلام مع اهتزاز. تنتظر ١٠ ثوانٍ.",
        countdownSeconds = 10,
        requiresConfession = false,
        vibrates = true,
        playsAlarm = false,
    ),
    SAVAGE(
        title = "عديم الرحمة",
        description = "إهانات بلا رحمة، إنذار صوتي فاضح، اهتزاز عنيف، ولا تطلع إلا باعتراف مكتوب.",
        countdownSeconds = 10,
        requiresConfession = true,
        vibrates = true,
        playsAlarm = true,
    ),
}

@Serializable
enum class Goal(val title: String, val emoji: String) {
    STUDY("دراسة", "📚"),
    WORK("شغل", "💼"),
    GYM("جيم", "🏋️"),
    BUSINESS("مشروع تجاري", "📈"),
    GENERAL("عام", "🎯"),
}

@Serializable
data class MonitoredApp(
    val packageName: String,
    val label: String,
    val limitMinutes: Int = DEFAULT_LIMIT_MINUTES,
)

/**
 * Optional focus window. Outside it usage is still counted but no strikes fire,
 * so the user can relax in the evening without turning monitoring off.
 * `days` uses [DayOfWeek.getValue] (1 = Monday … 7 = Sunday).
 */
@Serializable
data class Schedule(
    val enabled: Boolean = false,
    val startMinute: Int = 9 * 60,
    val endMinute: Int = 17 * 60,
    val days: Set<Int> = setOf(1, 2, 3, 4, 5, 6, 7),
) {
    fun isActive(now: LocalDateTime = LocalDateTime.now()): Boolean {
        if (!enabled) return true
        if (now.dayOfWeek.value !in days) return false
        val minute = now.hour * 60 + now.minute
        return if (startMinute <= endMinute) {
            minute in startMinute until endMinute
        } else {
            // Window crosses midnight (e.g. 22:00 → 06:00).
            minute >= startMinute || minute < endMinute
        }
    }

    fun label(): String = "${startMinute.toClock()} – ${endMinute.toClock()}"
}

fun Int.toClock(): String {
    val h = this / 60
    val m = this % 60
    val suffix = if (h < 12) "ص" else "م"
    val h12 = when (val x = h % 12) { 0 -> 12; else -> x }
    return "${h12.toArabicDigits()}:${m.toString().padStart(2, '0').toArabicDigitsStr()} $suffix"
}

@Serializable
data class Settings(
    val onboardingDone: Boolean = false,
    val defaultsSeeded: Boolean = false,
    val monitoringEnabled: Boolean = false,
    val goal: Goal = Goal.GENERAL,
    val aggression: AggressionLevel = AggressionLevel.MEDIUM,
    val apps: List<MonitoredApp> = emptyList(),
    val userName: String = "",
    val schedule: Schedule = Schedule(),
    /** Epoch millis until which strict mode locks every escape hatch. 0 = off. */
    val strictUntil: Long = 0L,
    /** Send a heads-up notification at this percentage of an app's limit. 0 = off. */
    val warnAtPercent: Int = 80,
) {
    fun app(packageName: String): MonitoredApp? = apps.firstOrNull { it.packageName == packageName }
    val strictActive: Boolean get() = strictUntil > System.currentTimeMillis()
    val totalLimitMinutes: Int get() = apps.sumOf { it.limitMinutes }
}

/** Per-day usage ledger. `seconds` is foreground time per package; `blocks` counts overlay strikes. */
@Serializable
data class DailyStats(
    val date: String = todayKey(),
    val seconds: Map<String, Long> = emptyMap(),
    val blocks: Int = 0,
) {
    val totalSeconds: Long get() = seconds.values.sum()
    val totalMinutes: Int get() = (totalSeconds / 60).toInt()
    fun secondsFor(packageName: String): Long = seconds[packageName] ?: 0L
    fun minutesFor(packageName: String): Int = (secondsFor(packageName) / 60).toInt()
}

/** A finished day, frozen together with the limits that applied to it. */
@Serializable
data class DayRecord(
    val date: String,
    val seconds: Map<String, Long> = emptyMap(),
    val blocks: Int = 0,
    val limitSeconds: Map<String, Long> = emptyMap(),
) {
    /** Only monitored apps count: anything without a limit was not being watched that day. */
    val monitoredSeconds: Long get() = limitSeconds.keys.sumOf { seconds[it] ?: 0L }
    val monitoredMinutes: Int get() = (monitoredSeconds / 60).toInt()
    val limitMinutes: Int get() = (limitSeconds.values.sum() / 60).toInt()
    val exceeded: Boolean get() = limitSeconds.any { (pkg, limit) -> (seconds[pkg] ?: 0L) >= limit }
    fun secondsFor(packageName: String): Long = seconds[packageName] ?: 0L
}

@Serializable
data class History(val days: List<DayRecord> = emptyList()) {
    fun record(date: String): DayRecord? = days.firstOrNull { it.date == date }
}

fun todayKey(): String = LocalDate.now().toString()

fun endOfTodayMillis(): Long =
    LocalDate.now().plusDays(1).atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli()

fun LocalTime.toMinuteOfDay(): Int = hour * 60 + minute

/** Well-known time sinks, pre-selected on first launch when installed. */
val DEFAULT_TARGETS: List<Pair<String, String>> = listOf(
    "com.zhiliaoapp.musically" to "TikTok",
    "com.ss.android.ugc.trill" to "TikTok",
    "com.instagram.android" to "Instagram",
    "com.google.android.youtube" to "YouTube",
    "com.twitter.android" to "X",
    "com.snapchat.android" to "Snapchat",
    "com.facebook.katana" to "Facebook",
    "com.reddit.frontpage" to "Reddit",
)
