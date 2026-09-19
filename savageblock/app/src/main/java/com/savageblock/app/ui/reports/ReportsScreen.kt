package com.savageblock.app.ui.reports

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Share
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.savageblock.app.data.DailyStats
import com.savageblock.app.data.DayPoint
import com.savageblock.app.data.History
import com.savageblock.app.data.Insights
import com.savageblock.app.data.Settings
import com.savageblock.app.data.Shame
import com.savageblock.app.data.Standing
import com.savageblock.app.data.toArabicDigits
import com.savageblock.app.ui.components.Bar
import com.savageblock.app.ui.components.CircleIconButton
import com.savageblock.app.ui.components.Gauge
import com.savageblock.app.ui.components.LegendDot
import com.savageblock.app.ui.components.PatternBarChart
import com.savageblock.app.ui.components.SegmentedPill
import com.savageblock.app.ui.components.SoftCard
import com.savageblock.app.ui.components.SoftProgress
import com.savageblock.app.ui.components.TopBar
import com.savageblock.app.ui.dashboard.AppIcon
import com.savageblock.app.ui.theme.Blue
import com.savageblock.app.ui.theme.Canvas
import com.savageblock.app.ui.theme.Coral
import com.savageblock.app.ui.theme.Ink
import com.savageblock.app.ui.theme.Muted
import com.savageblock.app.ui.theme.Sun

private val RANGES = listOf("يومي", "أسبوعي", "شهري")

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun ReportsScreen(
    settings: Settings,
    stats: DailyStats,
    history: History,
    contentPadding: PaddingValues,
    onBack: (() -> Unit)?,
    onShare: (String) -> Unit,
) {
    var range by remember { mutableIntStateOf(1) }
    val days = when (range) { 0 -> 1; 1 -> 7; else -> 30 }
    val points = remember(settings, stats, history, days) { Insights.lastDays(history, stats, settings, days) }
    val today = points.last()
    val minutes = if (range == 0) today.minutes else points.sumOf { it.minutes } / points.size
    val limit = settings.totalLimitMinutes
    val ratio = if (limit == 0) 0f else today.minutes.toFloat() / limit
    val (clean, over, far) = Insights.distribution(Insights.lastDays(history, stats, settings, if (range == 2) 30 else 7))
    val standing = Insights.standing(today.minutes, limit)

    val bars = remember(points, range) { buildBars(points, range, stats, settings) }

    Column(
        Modifier
            .fillMaxSize()
            .background(Canvas)
            .statusBarsPadding()
            .verticalScroll(rememberScrollState())
            .padding(bottom = contentPadding.calculateBottomPadding() + 24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        TopBar("التقارير", onBack = onBack) {
            CircleIconButton(Icons.Rounded.Share, "مشاركة", onClick = { onShare(shareText(settings, points, range)) }, bordered = true)
        }
        Column(Modifier.widthIn(max = 720.dp).fillMaxWidth().padding(horizontal = 20.dp)) {
            SegmentedPill(RANGES, range, onSelect = { range = it })
            Spacer(Modifier.height(18.dp))

            // ---- gauge
            SoftCard(Modifier.fillMaxWidth(), padding = 20.dp) {
                Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.BottomCenter) {
                    Gauge(ratio, Modifier.fillMaxWidth(0.82f))
                    Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.padding(bottom = 4.dp)) {
                        Row(verticalAlignment = Alignment.Bottom) {
                            Text(minutes.toArabicDigits(), style = MaterialTheme.typography.displayMedium, color = Ink)
                            Spacer(Modifier.width(6.dp))
                            Text("دقيقة", style = MaterialTheme.typography.bodyMedium, color = Muted, modifier = Modifier.padding(bottom = 10.dp))
                        }
                        Text(
                            when (range) { 0 -> "اليوم"; 1 -> "متوسط الأسبوع"; else -> "متوسط الشهر" },
                            style = MaterialTheme.typography.bodyMedium,
                            color = Muted,
                        )
                    }
                }
                Spacer(Modifier.height(16.dp))
                FlowRow(
                    Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(14.dp, Alignment.CenterHorizontally),
                    verticalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    LegendDot(Blue, "ضمن الحد (${clean.toArabicDigits()}٪)")
                    LegendDot(Sun, "تجاوز (${over.toArabicDigits()}٪)")
                    LegendDot(Coral, "تجاوز كبير (${far.toArabicDigits()}٪)")
                }
                Spacer(Modifier.height(6.dp))
                Text(
                    "المؤشر يعرض وضعك اليوم: ${standing.title}. النسب من آخر ${(if (range == 2) 30 else 7).toArabicDigits()} يوم.",
                    style = MaterialTheme.typography.bodySmall,
                    color = Muted,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth(),
                )
            }

            Spacer(Modifier.height(16.dp))

            // ---- bars
            SoftCard(Modifier.fillMaxWidth()) {
                Text(
                    when (range) { 0 -> "التضييع حسب التطبيق"; 1 -> "متوسط الوقت الضائع"; else -> "الوقت الضائع أسبوعيًا" },
                    style = MaterialTheme.typography.titleMedium,
                    color = Ink,
                )
                Spacer(Modifier.height(14.dp))
                if (bars.isEmpty()) {
                    Text("ما فيه بيانات بعد. افتح تطبيق محظور وبتشوف.", style = MaterialTheme.typography.bodyMedium, color = Muted)
                } else {
                    PatternBarChart(bars)
                }
            }

            Spacer(Modifier.height(16.dp))

            // ---- per-app breakdown
            SoftCard(Modifier.fillMaxWidth()) {
                Text("حسب التطبيق", style = MaterialTheme.typography.titleMedium, color = Ink)
                Spacer(Modifier.height(8.dp))
                if (settings.apps.isEmpty()) {
                    Text("ما فيه تطبيقات محظورة.", style = MaterialTheme.typography.bodyMedium, color = Muted)
                }
                settings.apps.sortedByDescending { appMinutes(it.packageName, range, stats, history) }.forEach { app ->
                    val used = appMinutes(app.packageName, range, stats, history)
                    val perDayLimit = app.limitMinutes
                    val denom = if (range == 0) perDayLimit else perDayLimit * days
                    Row(Modifier.padding(vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                        AppIcon(app.packageName, size = 40.dp)
                        Spacer(Modifier.width(12.dp))
                        Column(Modifier.weight(1f)) {
                            Row {
                                Text(app.label, style = MaterialTheme.typography.titleSmall, color = Ink, modifier = Modifier.weight(1f), maxLines = 1, overflow = TextOverflow.Ellipsis)
                                Text("${used.toArabicDigits()} د", style = MaterialTheme.typography.titleSmall, color = Ink)
                            }
                            Spacer(Modifier.height(6.dp))
                            SoftProgress(
                                progress = if (denom == 0) 0f else used.toFloat() / denom,
                                color = if (denom > 0 && used >= denom) Coral else Blue,
                                height = 6.dp,
                            )
                        }
                    }
                }
            }

            Spacer(Modifier.height(16.dp))

            // ---- hall of shame
            SoftCard(Modifier.fillMaxWidth(), color = com.savageblock.app.ui.theme.Peach) {
                Text("جدار العار", style = MaterialTheme.typography.titleMedium, color = Ink)
                Spacer(Modifier.height(6.dp))
                val shameMinutes = if (range == 0) today.minutes else points.sumOf { it.minutes }
                Text(Shame.remark(shameMinutes), style = MaterialTheme.typography.bodyLarge, color = Ink)
                val eq = Shame.equivalents(shameMinutes)
                if (eq.isNotEmpty()) {
                    Spacer(Modifier.height(10.dp))
                    Text("كان يمديك بدالها:", style = MaterialTheme.typography.labelMedium, color = Muted)
                    eq.forEach {
                        Row(Modifier.padding(vertical = 2.dp)) {
                            Text(it.value, style = MaterialTheme.typography.titleSmall, color = com.savageblock.app.ui.theme.PeachInk)
                            Spacer(Modifier.width(6.dp))
                            Text(it.label, style = MaterialTheme.typography.bodyMedium, color = Ink)
                        }
                    }
                }
            }
        }
    }
}

private fun appMinutes(pkg: String, range: Int, stats: DailyStats, history: History): Int {
    if (range == 0) return stats.minutesFor(pkg)
    val days = if (range == 1) 7 else 30
    val end = java.time.LocalDate.now()
    var seconds = stats.secondsFor(pkg)
    for (back in 1 until days) {
        seconds += history.record(end.minusDays(back.toLong()).toString())?.secondsFor(pkg) ?: 0L
    }
    return (seconds / 60).toInt()
}

private fun buildBars(points: List<DayPoint>, range: Int, stats: DailyStats, settings: Settings): List<Bar> = when (range) {
    0 -> settings.apps
        .map { it to stats.minutesFor(it.packageName) }
        .sortedByDescending { it.second }
        .take(6)
        .let { list ->
            val top = list.maxByOrNull { it.second }
            list.map { (app, m) ->
                Bar(app.label.take(8), m.toFloat(), highlight = app == top?.first && m > 0, pill = if (app == top?.first && m > 0) "الأسوأ" else null)
            }
        }
    1 -> points.map { p ->
        Bar(p.shortLabel, p.minutes.toFloat(), highlight = p.isToday, pill = if (p.isToday) Insights.standing(p.minutes, p.limitMinutes).title else null)
    }
    else -> points.chunked(8).mapIndexed { i, week ->
        val avg = week.sumOf { it.minutes } / week.size
        val last = i == points.chunked(8).lastIndex
        Bar("أ${(i + 1).toArabicDigits()}", avg.toFloat(), highlight = last, pill = if (last) "هذا الأسبوع" else null)
    }
}

private fun shareText(settings: Settings, points: List<DayPoint>, range: Int): String {
    val total = points.sumOf { it.minutes }
    val label = when (range) { 0 -> "اليوم"; 1 -> "هذا الأسبوع"; else -> "هذا الشهر" }
    val standing = Insights.standing(points.last().minutes, settings.totalLimitMinutes)
    return buildString {
        appendLine("SavageBlock — تقرير $label")
        appendLine("ضيّعت ${total.toArabicDigits()} دقيقة على ${settings.apps.size.toArabicDigits()} تطبيق.")
        appendLine("وضعي اليوم: ${standing.title}${if (standing == Standing.CLEAN) " 💪" else " 😬"}")
        appendLine(Shame.remark(total))
        append("#كافي_تضييع")
    }
}
