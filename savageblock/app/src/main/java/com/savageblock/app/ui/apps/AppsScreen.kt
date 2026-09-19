package com.savageblock.app.ui.apps

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Delete
import androidx.compose.material.icons.rounded.Lock
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.savageblock.app.data.DailyStats
import com.savageblock.app.data.MAX_LIMIT_MINUTES
import com.savageblock.app.data.MIN_LIMIT_MINUTES
import com.savageblock.app.data.MonitoredApp
import com.savageblock.app.data.Settings
import com.savageblock.app.data.toArabicDigits
import com.savageblock.app.ui.components.CircleIconButton
import com.savageblock.app.ui.components.PillButton
import com.savageblock.app.ui.components.SoftCard
import com.savageblock.app.ui.components.SoftProgress
import com.savageblock.app.ui.components.StatusPill
import com.savageblock.app.ui.components.TopBar
import com.savageblock.app.ui.dashboard.AppIcon
import com.savageblock.app.ui.theme.Blue
import com.savageblock.app.ui.theme.BlueSoft
import com.savageblock.app.ui.theme.Canvas
import com.savageblock.app.ui.theme.Chip
import com.savageblock.app.ui.theme.Coral
import com.savageblock.app.ui.theme.CoralSoft
import com.savageblock.app.ui.theme.Green
import com.savageblock.app.ui.theme.GreenSoft
import com.savageblock.app.ui.theme.Ink
import com.savageblock.app.ui.theme.Line
import com.savageblock.app.ui.theme.Muted

@Composable
fun AppsScreen(
    settings: Settings,
    stats: DailyStats,
    contentPadding: PaddingValues,
    onLimit: (String, Int) -> Unit,
    onRemove: (String) -> Unit,
    onAdd: () -> Unit,
) {
    Column(Modifier.fillMaxSize().background(Canvas).statusBarsPadding()) {
        TopBar("التطبيقات المحظورة", onBack = null)
        LazyVerticalGrid(
            columns = GridCells.Adaptive(minSize = 340.dp),
            contentPadding = PaddingValues(
                start = 20.dp, end = 20.dp, top = 4.dp,
                bottom = contentPadding.calculateBottomPadding() + 24.dp,
            ),
            verticalArrangement = Arrangement.spacedBy(12.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            item(span = { GridItemSpan(maxLineSpan) }) {
                SoftCard(Modifier.fillMaxWidth(), color = BlueSoft) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)) {
                            Text(
                                "${settings.apps.size.toArabicDigits()} تطبيق تحت المراقبة",
                                style = MaterialTheme.typography.titleLarge,
                                color = Ink,
                            )
                            Text(
                                "مجموع الحدود اليومية ${settings.totalLimitMinutes.toArabicDigits()} دقيقة",
                                style = MaterialTheme.typography.bodySmall,
                                color = Muted,
                            )
                        }
                        if (settings.strictActive) {
                            StatusPill("صارم", CoralSoft, Coral)
                        } else {
                            PillButton("+ أضف", onAdd)
                        }
                    }
                }
            }
            if (settings.apps.isEmpty()) {
                item(span = { GridItemSpan(maxLineSpan) }) {
                    SoftCard(Modifier.fillMaxWidth()) {
                        Text("ما فيه تطبيقات تحت المراقبة.", style = MaterialTheme.typography.titleMedium, color = Ink)
                        Text(
                            "يعني تضيع وقتك بحرية؟ اضغط + وأضف تيك توك وإنستقرام وخلّنا نبدأ.",
                            style = MaterialTheme.typography.bodyMedium,
                            color = Muted,
                        )
                    }
                }
            }
            items(settings.apps, key = { it.packageName }) { app ->
                MonitoredAppCard(
                    app = app,
                    usedMinutes = stats.minutesFor(app.packageName),
                    strict = settings.strictActive,
                    onLimit = { onLimit(app.packageName, it) },
                    onRemove = { onRemove(app.packageName) },
                )
            }
        }
    }
}

@Composable
private fun MonitoredAppCard(
    app: MonitoredApp,
    usedMinutes: Int,
    strict: Boolean,
    onLimit: (Int) -> Unit,
    onRemove: () -> Unit,
) {
    var sliderValue by remember(app.packageName, app.limitMinutes) { mutableFloatStateOf(app.limitMinutes.toFloat()) }
    val blocked = usedMinutes >= app.limitMinutes
    val progress = if (app.limitMinutes == 0) 1f else usedMinutes.toFloat() / app.limitMinutes

    SoftCard(Modifier.fillMaxWidth()) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            AppIcon(app.packageName, size = 44.dp)
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(app.label, style = MaterialTheme.typography.titleMedium, color = Ink, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(
                    "${usedMinutes.toArabicDigits()} من ${app.limitMinutes.toArabicDigits()} دقيقة اليوم",
                    style = MaterialTheme.typography.bodySmall,
                    color = Muted,
                )
            }
            if (blocked) StatusPill("محظور", CoralSoft, Coral) else StatusPill("ضمن الحد", GreenSoft, Green)
        }
        Spacer(Modifier.height(12.dp))
        SoftProgress(progress, color = if (blocked) Coral else Blue)
        Spacer(Modifier.height(10.dp))
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text("الحد اليومي", style = MaterialTheme.typography.labelMedium, color = Muted)
                Text("${sliderValue.toInt().toArabicDigits()} دقيقة", style = MaterialTheme.typography.titleMedium, color = Ink)
            }
            if (strict) {
                Icon(Icons.Rounded.Lock, contentDescription = "مقفل", tint = Muted)
            } else {
                CircleIconButton(Icons.Rounded.Delete, "حذف", onRemove, size = 36.dp, container = Chip, tint = Coral)
            }
        }
        Slider(
            value = sliderValue,
            onValueChange = { sliderValue = it },
            onValueChangeFinished = { onLimit(sliderValue.toInt()) },
            valueRange = MIN_LIMIT_MINUTES.toFloat()..MAX_LIMIT_MINUTES.toFloat(),
            steps = (MAX_LIMIT_MINUTES - MIN_LIMIT_MINUTES) / 5 - 1,
            colors = SliderDefaults.colors(
                thumbColor = Blue,
                activeTrackColor = Blue,
                inactiveTrackColor = Line,
                activeTickColor = Blue,
                inactiveTickColor = Line,
            ),
        )
        if (strict) {
            Text("الوضع الصارم: تقدر تقلّل الحد بس ما تقدر تزيده.", style = MaterialTheme.typography.bodySmall, color = Muted)
        }
    }
}
