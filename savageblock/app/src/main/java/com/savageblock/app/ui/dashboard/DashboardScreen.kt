package com.savageblock.app.ui.dashboard

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
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
import com.savageblock.app.data.AggressionLevel
import com.savageblock.app.data.DailyStats
import com.savageblock.app.data.Goal
import com.savageblock.app.data.MAX_LIMIT_MINUTES
import com.savageblock.app.data.MIN_LIMIT_MINUTES
import com.savageblock.app.data.MonitoredApp
import com.savageblock.app.data.Settings
import com.savageblock.app.data.Shame
import com.savageblock.app.data.toArabicDigits
import com.savageblock.app.ui.components.BrutalButton
import com.savageblock.app.ui.components.BrutalCard
import com.savageblock.app.ui.components.BrutalChip
import com.savageblock.app.ui.components.BrutalProgress
import com.savageblock.app.ui.components.HazardStripes
import com.savageblock.app.ui.components.SectionTitle
import com.savageblock.app.ui.theme.Acid
import com.savageblock.app.ui.theme.Ash
import com.savageblock.app.ui.theme.Bone
import com.savageblock.app.ui.theme.Concrete
import com.savageblock.app.ui.theme.Crimson
import com.savageblock.app.ui.theme.Steel
import com.savageblock.app.ui.theme.Void
import com.savageblock.app.util.PermissionState

/** Width at which the dashboard switches to two panes (unfolded foldables, tablets, desktop windows). */
private val TwoPaneBreakpoint = 720.dp

@Composable
fun DashboardScreen(
    settings: Settings,
    stats: DailyStats,
    serviceRunning: Boolean,
    permissions: PermissionState,
    onToggleMonitoring: (Boolean) -> Unit,
    onGoal: (Goal) -> Unit,
    onAggression: (AggressionLevel) -> Unit,
    onLimit: (String, Int) -> Unit,
    onRemove: (String) -> Unit,
    onAddApps: () -> Unit,
    onFixPermissions: () -> Unit,
) {
    val monitoredMinutes = settings.apps.sumOf { stats.minutesFor(it.packageName) }

    // Re-measured live on fold / unfold thanks to configChanges in the manifest.
    BoxWithConstraints(Modifier.fillMaxSize().background(Void).systemBarsPadding()) {
        val twoPane = maxWidth >= TwoPaneBreakpoint
        Column(Modifier.fillMaxSize()) {
            HazardStripes()
            Header(running = serviceRunning && settings.monitoringEnabled)
            if (twoPane) {
                Row(Modifier.fillMaxSize()) {
                    Column(
                        Modifier
                            .weight(1f)
                            .fillMaxHeight()
                            .verticalScroll(rememberScrollState())
                            .padding(start = 20.dp, end = 10.dp, bottom = 40.dp),
                    ) {
                        ControlSections(
                            settings, permissions, serviceRunning, monitoredMinutes, stats.blocks,
                            onToggleMonitoring, onGoal, onAggression, onFixPermissions,
                        )
                    }
                    LazyColumn(
                        Modifier.weight(1f).fillMaxHeight(),
                        contentPadding = PaddingValues(start = 10.dp, end = 20.dp, bottom = 40.dp),
                    ) {
                        appsSection(settings, stats, onLimit, onRemove, onAddApps)
                    }
                }
            } else {
                LazyColumn(
                    Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(start = 20.dp, end = 20.dp, bottom = 40.dp),
                ) {
                    item {
                        ControlSections(
                            settings, permissions, serviceRunning, monitoredMinutes, stats.blocks,
                            onToggleMonitoring, onGoal, onAggression, onFixPermissions,
                        )
                    }
                    appsSection(settings, stats, onLimit, onRemove, onAddApps)
                }
            }
        }
    }
}

@Composable
private fun Header(running: Boolean) {
    Row(
        Modifier.padding(horizontal = 20.dp, vertical = 20.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f)) {
            Text("SAVAGEBLOCK", style = MaterialTheme.typography.displaySmall, color = Bone)
            Text("كافي تضييع", style = MaterialTheme.typography.titleLarge, color = Acid)
        }
        StatusPill(running = running)
    }
}

/** Everything except the app list: permissions warning, monitor toggle, shame, goal, aggression. */
@Composable
private fun ControlSections(
    settings: Settings,
    permissions: PermissionState,
    serviceRunning: Boolean,
    monitoredMinutes: Int,
    strikes: Int,
    onToggleMonitoring: (Boolean) -> Unit,
    onGoal: (Goal) -> Unit,
    onAggression: (AggressionLevel) -> Unit,
    onFixPermissions: () -> Unit,
) {
    Column {
        if (!permissions.essentialsGranted) {
            BrutalCard(borderColor = Crimson, shadowColor = Crimson) {
                Text("صلاحيات ناقصة", style = MaterialTheme.typography.titleLarge, color = Crimson)
                Spacer(Modifier.height(6.dp))
                Text(
                    "بدون صلاحية الاستخدام والظهور فوق التطبيقات ما أقدر أضبطك. أعطني إياها وبعدين نتكلم.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = Ash,
                )
                Spacer(Modifier.height(12.dp))
                BrutalButton(text = "أصلح الصلاحيات", onClick = onFixPermissions, modifier = Modifier.fillMaxWidth())
            }
            Spacer(Modifier.height(16.dp))
        }

        MonitorCard(
            enabled = settings.monitoringEnabled,
            running = serviceRunning,
            appCount = settings.apps.size,
            canStart = permissions.essentialsGranted && settings.apps.isNotEmpty(),
            onToggle = onToggleMonitoring,
        )
        Spacer(Modifier.height(20.dp))

        SectionTitle("جدار العار")
        HallOfShameCard(minutes = monitoredMinutes, strikes = strikes)
        Spacer(Modifier.height(24.dp))

        SectionTitle("هدفك الأساسي", accent = Acid)
        Text(
            "أذكّرك بنقطة ضعفك بالضبط لما تضيع وقتك.",
            style = MaterialTheme.typography.bodySmall,
            color = Ash,
        )
        Spacer(Modifier.height(10.dp))
        GoalSelector(selected = settings.goal, onSelect = onGoal)
        Spacer(Modifier.height(24.dp))

        SectionTitle("مستوى الوقاحة")
        AggressionSelector(selected = settings.aggression, onSelect = onAggression)
        Spacer(Modifier.height(24.dp))
    }
}

/** The monitored-app list, shared by the single-column and two-pane layouts. */
private fun LazyListScope.appsSection(
    settings: Settings,
    stats: DailyStats,
    onLimit: (String, Int) -> Unit,
    onRemove: (String) -> Unit,
    onAddApps: () -> Unit,
) {
    item {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            SectionTitle("التطبيقات المحظورة", modifier = Modifier.weight(1f), accent = Acid)
            BrutalButton(text = "+ أضف", onClick = onAddApps, container = Acid, content = Void)
        }
        Spacer(Modifier.height(4.dp))
    }
    if (settings.apps.isEmpty()) {
        item {
            BrutalCard(shadowColor = Concrete, borderColor = Ash) {
                Text("ما فيه تطبيقات تحت المراقبة.", style = MaterialTheme.typography.titleMedium, color = Bone)
                Text("يعني تضيع وقتك بحرية؟ أضف تيك توك وإنستقرام وخلّنا نبدأ.", style = MaterialTheme.typography.bodyMedium, color = Ash)
            }
        }
    }
    items(settings.apps, key = { it.packageName }) { app ->
        Box(Modifier.padding(bottom = 14.dp)) {
            MonitoredAppCard(
                app = app,
                usedMinutes = stats.minutesFor(app.packageName),
                onLimit = { onLimit(app.packageName, it) },
                onRemove = { onRemove(app.packageName) },
            )
        }
    }
}

// ---------------------------------------------------------------- pieces

@Composable
private fun StatusPill(running: Boolean) {
    Row(
        Modifier
            .border(2.dp, if (running) Acid else Ash)
            .background(if (running) Acid else Void)
            .padding(horizontal = 10.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.size(8.dp).background(if (running) Void else Crimson))
        Spacer(Modifier.width(6.dp))
        Text(
            if (running) "يراقب" else "نايم",
            style = MaterialTheme.typography.labelMedium,
            color = if (running) Void else Ash,
        )
    }
}

@Composable
private fun MonitorCard(
    enabled: Boolean,
    running: Boolean,
    appCount: Int,
    canStart: Boolean,
    onToggle: (Boolean) -> Unit,
) {
    val active = enabled && running
    BrutalCard(
        borderColor = if (active) Acid else Bone,
        shadowColor = if (active) Acid else Crimson,
    ) {
        Text(
            if (active) "المراقبة شغّالة" else "المراقبة متوقفة",
            style = MaterialTheme.typography.headlineSmall,
            color = if (active) Acid else Bone,
        )
        Spacer(Modifier.height(4.dp))
        Text(
            when {
                active -> "أراقب ${appCount.toArabicDigits()} تطبيق. تعدّي الحد.. تنهزأ."
                !canStart && appCount == 0 -> "أضف تطبيق واحد على الأقل قبل ما تشغّلني."
                !canStart -> "أعطني الصلاحيات الإجبارية أول."
                else -> "أنت الحين حر تضيع وقتك. مبروك."
            },
            style = MaterialTheme.typography.bodyMedium,
            color = Ash,
        )
        Spacer(Modifier.height(14.dp))
        BrutalButton(
            text = if (active) "وقّف المراقبة (جبان)" else "شغّل المراقبة",
            onClick = { onToggle(!active) },
            enabled = active || canStart,
            modifier = Modifier.fillMaxWidth(),
            container = if (active) Concrete else Crimson,
            content = Bone,
        )
    }
}

@Composable
private fun HallOfShameCard(minutes: Int, strikes: Int) {
    val equivalents = Shame.equivalents(minutes)
    BrutalCard(borderColor = Crimson, shadowColor = Crimson, background = Steel) {
        Row(verticalAlignment = Alignment.Bottom) {
            Text(minutes.toArabicDigits(), style = MaterialTheme.typography.displayMedium, color = Crimson)
            Spacer(Modifier.width(10.dp))
            Column(Modifier.padding(bottom = 10.dp)) {
                Text("دقيقة ضايعة اليوم", style = MaterialTheme.typography.titleMedium, color = Bone)
                Text("${strikes.toArabicDigits()} ضربة تهزيء", style = MaterialTheme.typography.labelMedium, color = Ash)
            }
        }
        Spacer(Modifier.height(10.dp))
        Text(Shame.remark(minutes), style = MaterialTheme.typography.bodyLarge, color = Bone)
        if (equivalents.isNotEmpty()) {
            Spacer(Modifier.height(14.dp))
            Text("كان يمديك بدالها:", style = MaterialTheme.typography.labelMedium, color = Ash)
            Spacer(Modifier.height(6.dp))
            equivalents.forEach { eq ->
                Row(Modifier.padding(vertical = 3.dp), verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.size(8.dp).background(Acid))
                    Spacer(Modifier.width(8.dp))
                    Text(eq.value, style = MaterialTheme.typography.titleMedium, color = Acid)
                    Spacer(Modifier.width(6.dp))
                    Text(eq.label, style = MaterialTheme.typography.bodyMedium, color = Bone)
                }
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun GoalSelector(selected: Goal, onSelect: (Goal) -> Unit) {
    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Goal.entries.forEach { goal ->
            BrutalChip(
                text = "${goal.emoji} ${goal.title}",
                selected = goal == selected,
                onClick = { onSelect(goal) },
            )
        }
    }
}

@Composable
private fun AggressionSelector(selected: AggressionLevel, onSelect: (AggressionLevel) -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        AggressionLevel.entries.forEach { level ->
            val isSelected = level == selected
            val accent = when (level) {
                AggressionLevel.LOW -> Bone
                AggressionLevel.MEDIUM -> Acid
                AggressionLevel.SAVAGE -> Crimson
            }
            Row(
                Modifier
                    .fillMaxWidth()
                    .border(3.dp, if (isSelected) accent else Concrete)
                    .background(if (isSelected) Steel else Void)
                    .clickable { onSelect(level) }
                    .padding(14.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(
                    Modifier
                        .size(22.dp)
                        .border(3.dp, accent)
                        .background(if (isSelected) accent else Void),
                )
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Text(level.title, style = MaterialTheme.typography.titleLarge, color = if (isSelected) accent else Bone)
                    Text(level.description, style = MaterialTheme.typography.bodySmall, color = Ash)
                }
            }
        }
    }
}

@Composable
private fun MonitoredAppCard(
    app: MonitoredApp,
    usedMinutes: Int,
    onLimit: (Int) -> Unit,
    onRemove: () -> Unit,
) {
    var sliderValue by remember(app.packageName, app.limitMinutes) { mutableFloatStateOf(app.limitMinutes.toFloat()) }
    val blocked = usedMinutes >= app.limitMinutes
    val progress = if (app.limitMinutes == 0) 1f else usedMinutes.toFloat() / app.limitMinutes

    BrutalCard(
        borderColor = if (blocked) Crimson else Bone,
        shadowColor = if (blocked) Crimson else Concrete,
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            AppIcon(app.packageName, size = 44.dp)
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(app.label, style = MaterialTheme.typography.titleLarge, color = Bone, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(
                    if (blocked) "محظور اليوم. تعدّيت الحد." else "${usedMinutes.toArabicDigits()} من ${app.limitMinutes.toArabicDigits()} دقيقة",
                    style = MaterialTheme.typography.labelMedium,
                    color = if (blocked) Crimson else Ash,
                )
            }
            Box(
                Modifier
                    .border(2.dp, Ash)
                    .clickable(onClick = onRemove)
                    .padding(horizontal = 10.dp, vertical = 6.dp),
            ) {
                Text("حذف", style = MaterialTheme.typography.labelMedium, color = Ash)
            }
        }
        Spacer(Modifier.height(12.dp))
        BrutalProgress(progress = progress, color = if (blocked) Crimson else Acid)
        Spacer(Modifier.height(10.dp))
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("الحد اليومي", style = MaterialTheme.typography.labelMedium, color = Ash)
            Spacer(Modifier.width(8.dp))
            Text("${sliderValue.toInt().toArabicDigits()} دقيقة", style = MaterialTheme.typography.titleMedium, color = Acid)
        }
        Slider(
            value = sliderValue,
            onValueChange = { sliderValue = it },
            onValueChangeFinished = { onLimit(sliderValue.toInt()) },
            valueRange = MIN_LIMIT_MINUTES.toFloat()..MAX_LIMIT_MINUTES.toFloat(),
            steps = (MAX_LIMIT_MINUTES - MIN_LIMIT_MINUTES) / 5 - 1,
            colors = SliderDefaults.colors(
                thumbColor = Acid,
                activeTrackColor = Acid,
                inactiveTrackColor = Concrete,
                activeTickColor = Void,
                inactiveTickColor = Concrete,
            ),
        )
    }
}
