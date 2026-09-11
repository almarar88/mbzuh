package com.savageblock.app.data

import kotlinx.serialization.Serializable
import java.time.LocalDate

/** The exact phrase the user must type to escape the overlay in Savage mode. */
const val CONFESSION_PHRASE = "أنا أضيع وقتي بلا هدف"

/** Daily allowance applied to newly added apps. */
const val DEFAULT_LIMIT_MINUTES = 30

const val MIN_LIMIT_MINUTES = 5
const val MAX_LIMIT_MINUTES = 180

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

@Serializable
data class Settings(
    val onboardingDone: Boolean = false,
    val defaultsSeeded: Boolean = false,
    val monitoringEnabled: Boolean = false,
    val goal: Goal = Goal.GENERAL,
    val aggression: AggressionLevel = AggressionLevel.MEDIUM,
    val apps: List<MonitoredApp> = emptyList(),
) {
    fun app(packageName: String): MonitoredApp? = apps.firstOrNull { it.packageName == packageName }
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

fun todayKey(): String = LocalDate.now().toString()

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
