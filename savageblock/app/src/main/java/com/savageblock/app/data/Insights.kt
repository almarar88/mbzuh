package com.savageblock.app.data

import java.time.DayOfWeek
import java.time.LocalDate
import java.time.format.TextStyle
import java.util.Locale

/** One bar in a report chart. */
data class DayPoint(
    val date: LocalDate,
    val minutes: Int,
    val limitMinutes: Int,
    val blocks: Int,
    val isToday: Boolean,
) {
    val ratio: Float get() = if (limitMinutes <= 0) 0f else minutes.toFloat() / limitMinutes
    val shortLabel: String get() = date.dayOfWeek.arabicShort()
}

data class Streak(val current: Int, val best: Int, val todayClean: Boolean)

/** Where today sits relative to the limit; drives pills, gauge colour and copy. */
enum class Standing(val title: String) {
    CLEAN("ممتاز"),
    WARNING("على الحافة"),
    OVER("تجاوزت"),
    FAR_OVER("كارثة"),
}

/** Derived numbers for the home screen and reports. Pure functions, easy to unit test. */
object Insights {

    fun standing(minutes: Int, limitMinutes: Int): Standing {
        if (limitMinutes <= 0) return Standing.CLEAN
        val r = minutes.toFloat() / limitMinutes
        return when {
            r < 0.8f -> Standing.CLEAN
            r < 1f -> Standing.WARNING
            r < 1.5f -> Standing.OVER
            else -> Standing.FAR_OVER
        }
    }

    /** Today's ledger merged onto the archived history as a list of the last [days] days, oldest first. */
    fun lastDays(history: History, today: DailyStats, settings: Settings, days: Int): List<DayPoint> {
        val end = LocalDate.now()
        val todayLimit = settings.totalLimitMinutes
        val monitored = settings.apps.map { it.packageName }
        return (days - 1 downTo 0).map { back ->
            val date = end.minusDays(back.toLong())
            if (back == 0) {
                DayPoint(
                    date = date,
                    minutes = monitored.sumOf { today.minutesFor(it) },
                    limitMinutes = todayLimit,
                    blocks = today.blocks,
                    isToday = true,
                )
            } else {
                val rec = history.record(date.toString())
                DayPoint(
                    date = date,
                    minutes = rec?.monitoredMinutes ?: 0,
                    limitMinutes = rec?.limitMinutes ?: 0,
                    blocks = rec?.blocks ?: 0,
                    isToday = false,
                )
            }
        }
    }

    /** Consecutive days (ending yesterday) without exceeding any limit, plus whether today is still clean. */
    fun streak(history: History, today: DailyStats, settings: Settings): Streak {
        val todayClean = settings.apps.none { today.secondsFor(it.packageName) >= it.limitMinutes * 60L }
        val byDate = history.days.associateBy { it.date }
        var current = 0
        var cursor = LocalDate.now().minusDays(1)
        while (true) {
            val rec = byDate[cursor.toString()] ?: break
            if (rec.exceeded) break
            current++
            cursor = cursor.minusDays(1)
        }
        // Best streak over the whole archive.
        var best = 0
        var run = 0
        history.days.sortedBy { it.date }.forEach { rec ->
            run = if (rec.exceeded) 0 else run + 1
            if (run > best) best = run
        }
        val currentWithToday = if (todayClean) current + 1 else current
        return Streak(current = currentWithToday, best = maxOf(best, currentWithToday), todayClean = todayClean)
    }

    /** Share of the last [days] days that ended clean / over / far over, for the report legend. */
    fun distribution(points: List<DayPoint>): Triple<Int, Int, Int> {
        val counted = points.filter { it.limitMinutes > 0 }
        if (counted.isEmpty()) return Triple(100, 0, 0)
        val clean = counted.count { it.ratio < 1f }
        val over = counted.count { it.ratio >= 1f && it.ratio < 1.5f }
        val far = counted.size - clean - over
        val pct = { n: Int -> n * 100 / counted.size }
        return Triple(pct(clean), pct(over), pct(far))
    }

    fun greeting(hour: Int = java.time.LocalTime.now().hour): String = when (hour) {
        in 5..11 -> "صباح الخير 👋"
        in 12..16 -> "يومك سعيد 👋"
        in 17..21 -> "مساء الخير 👋"
        else -> "ساهر؟ 👀"
    }
}

fun DayOfWeek.arabicShort(): String = when (this) {
    DayOfWeek.SATURDAY -> "سبت"
    DayOfWeek.SUNDAY -> "أحد"
    DayOfWeek.MONDAY -> "اثنين"
    DayOfWeek.TUESDAY -> "ثلاثاء"
    DayOfWeek.WEDNESDAY -> "أربعاء"
    DayOfWeek.THURSDAY -> "خميس"
    DayOfWeek.FRIDAY -> "جمعة"
}

fun DayOfWeek.arabicLetter(): String = getDisplayName(TextStyle.NARROW, Locale("ar")).ifBlank { arabicShort().take(1) }
