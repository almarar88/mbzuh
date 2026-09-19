package com.savageblock.app.ui.home

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.Bolt
import androidx.compose.material.icons.rounded.HourglassBottom
import androidx.compose.material.icons.rounded.LocalFireDepartment
import androidx.compose.material.icons.rounded.Lock
import androidx.compose.material.icons.rounded.Pause
import androidx.compose.material.icons.rounded.PieChart
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material.icons.rounded.Settings
import androidx.compose.material.icons.rounded.Shield
import androidx.compose.material.icons.rounded.Tune
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.savageblock.app.data.DailyStats
import com.savageblock.app.data.History
import com.savageblock.app.data.Insights
import com.savageblock.app.data.MonitoredApp
import com.savageblock.app.data.Settings
import com.savageblock.app.data.Standing
import com.savageblock.app.data.toArabicDigits
import com.savageblock.app.data.toClockFromEpoch
import com.savageblock.app.ui.components.Avatar
import com.savageblock.app.ui.components.CircleIconButton
import com.savageblock.app.ui.components.MiniBars
import com.savageblock.app.ui.components.PillButton
import com.savageblock.app.ui.components.SoftCard
import com.savageblock.app.ui.components.SoftProgress
import com.savageblock.app.ui.components.StatusPill
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
import com.savageblock.app.ui.theme.Lavender
import com.savageblock.app.ui.theme.LavenderInk
import com.savageblock.app.ui.theme.Line
import com.savageblock.app.ui.theme.Mint
import com.savageblock.app.ui.theme.MintInk
import com.savageblock.app.ui.theme.Muted
import com.savageblock.app.ui.theme.Peach
import com.savageblock.app.ui.theme.PeachInk
import com.savageblock.app.ui.theme.Sun
import com.savageblock.app.ui.theme.Surface
import com.savageblock.app.util.PermissionState

private val SunSoft = Color(0xFFFFF3CD)
private val SunInk = Color(0xFFB7791F)

@Composable
fun HomeScreen(
    settings: Settings,
    stats: DailyStats,
    history: History,
    serviceRunning: Boolean,
    permissions: PermissionState,
    contentPadding: PaddingValues,
    onToggleBlocking: (Boolean) -> Unit,
    /** minutes to pause; 0 = resume now; -1 = until tomorrow. */
    onPause: (Int) -> Unit,
    onExempt: (String, Boolean) -> Unit,
    onAddApps: () -> Unit,
    onManageApps: () -> Unit,
    onReports: () -> Unit,
    onSettings: () -> Unit,
    onFixPermissions: () -> Unit,
    onDismissHelp: () -> Unit,
) {
    val week = remember(settings, stats, history) { Insights.lastDays(history, stats, settings, 7) }
    val streak = remember(settings, stats, history) { Insights.streak(history, stats, settings) }
    val todayMinutes = week.last().minutes
    val limit = settings.totalLimitMinutes
    val standing = Insights.standing(todayMinutes, limit)
    val remaining = (limit - todayMinutes).coerceAtLeast(0)
    val active = serviceRunning && settings.monitoringEnabled
    val ready = permissions.essentialsGranted && settings.apps.isNotEmpty()
    var pauseDialog by remember { mutableStateOf(false) }

    Column(
        Modifier
            .fillMaxSize()
            .background(Canvas)
            .statusBarsPadding()
            .verticalScroll(rememberScrollState())
            .padding(contentPadding),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Column(Modifier.widthIn(max = 720.dp).fillMaxWidth().padding(horizontal = 20.dp)) {
            Spacer(Modifier.height(12.dp))

            // ---- header
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Avatar(settings.userName, size = 48.dp)
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Text(Insights.greeting(), style = MaterialTheme.typography.bodyMedium, color = Muted)
                    Text(settings.userName.ifBlank { "يا بطل" }, style = MaterialTheme.typography.headlineSmall, color = Ink)
                }
                CircleIconButton(Icons.Rounded.Settings, "الإعدادات", onClick = onSettings, bordered = true)
            }
            Spacer(Modifier.height(18.dp))

            // ---- the one control that matters
            when {
                !permissions.essentialsGranted -> SoftCard(Modifier.fillMaxWidth(), color = CoralSoft) {
                    Text("أكمل الإعداد أول", style = MaterialTheme.typography.titleLarge, color = Coral)
                    Spacer(Modifier.height(4.dp))
                    Text("التطبيق يحتاج صلاحيتين حتى يقدر يحظر: بيانات الاستخدام والظهور فوق التطبيقات.", style = MaterialTheme.typography.bodyMedium, color = Ink)
                    Spacer(Modifier.height(12.dp))
                    PillButton("أعطِ الصلاحيات", onFixPermissions, container = Coral, modifier = Modifier.fillMaxWidth())
                }
                settings.apps.isEmpty() -> SoftCard(Modifier.fillMaxWidth()) {
                    Text("اختر وش تبي تحظر", style = MaterialTheme.typography.titleLarge, color = Ink)
                    Spacer(Modifier.height(4.dp))
                    Text("أضف تيك توك أو إنستقرام أو أي تطبيق يضيع وقتك، وحدد له دقائق يومية.", style = MaterialTheme.typography.bodyMedium, color = Muted)
                    Spacer(Modifier.height(12.dp))
                    PillButton("أضف تطبيق", onAddApps, icon = Icons.Rounded.Add, modifier = Modifier.fillMaxWidth())
                }
                else -> BlockingCard(
                    active = active,
                    settings = settings,
                    onToggle = onToggleBlocking,
                    onResume = { onPause(0) },
                )
            }

            Spacer(Modifier.height(18.dp))

            // ---- shortcuts
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Shortcut(
                    icon = if (settings.isPaused) Icons.Rounded.PlayArrow else Icons.Rounded.Pause,
                    label = if (settings.isPaused) "استئناف" else "إيقاف مؤقت",
                    tint = SunInk, container = SunSoft,
                    enabled = ready && !settings.strictActive,
                    onClick = { if (settings.isPaused) onPause(0) else pauseDialog = true },
                )
                Shortcut(Icons.Rounded.Add, "أضف تطبيق", Blue, BlueSoft, onClick = onAddApps)
                Shortcut(Icons.Rounded.PieChart, "التقارير", LavenderInk, Lavender, onClick = onReports)
                Shortcut(Icons.Rounded.Tune, "التطبيقات", MintInk, Mint, onClick = onManageApps)
            }

            Spacer(Modifier.height(20.dp))

            // ---- today
            SoftCard(Modifier.fillMaxWidth(), color = BlueSoft) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("الوقت الضائع اليوم", style = MaterialTheme.typography.titleSmall, color = Ink, modifier = Modifier.weight(1f))
                    StandingPill(standing)
                }
                Spacer(Modifier.height(8.dp))
                Row(verticalAlignment = Alignment.Bottom) {
                    Text(todayMinutes.toArabicDigits(), style = MaterialTheme.typography.displayMedium, color = Ink)
                    Spacer(Modifier.width(8.dp))
                    Text("دقيقة من ${limit.toArabicDigits()}", style = MaterialTheme.typography.bodyMedium, color = Muted, modifier = Modifier.padding(bottom = 10.dp))
                    Spacer(Modifier.weight(1f))
                    MiniBars(values = week.map { it.ratio.coerceAtLeast(0.05f) }, modifier = Modifier.width(96.dp).height(44.dp).padding(bottom = 6.dp))
                }
            }

            Spacer(Modifier.height(12.dp))
            Row(Modifier.fillMaxWidth().height(112.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Tile("الضربات", stats.blocks.toArabicDigits(), "اليوم", Icons.Rounded.Bolt, Lavender, LavenderInk, Modifier.weight(1f))
                Tile("السلسلة", streak.current.toArabicDigits(), "يوم", Icons.Rounded.LocalFireDepartment, Mint, MintInk, Modifier.weight(1f))
                Tile("المتبقي", remaining.toArabicDigits(), "دقيقة", Icons.Rounded.HourglassBottom, Peach, PeachInk, Modifier.weight(1f))
            }

            // ---- per-app quick control
            if (settings.apps.isNotEmpty()) {
                Spacer(Modifier.height(22.dp))
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Text("تطبيقاتك", style = MaterialTheme.typography.titleLarge, color = Ink, modifier = Modifier.weight(1f))
                    Text(
                        "إدارة الكل",
                        Modifier.clip(CircleShape).clickable(onClick = onManageApps).padding(horizontal = 10.dp, vertical = 6.dp),
                        style = MaterialTheme.typography.titleSmall,
                        color = Blue,
                    )
                }
                Spacer(Modifier.height(6.dp))
                settings.apps.sortedByDescending { stats.minutesFor(it.packageName) }.take(5).forEach { app ->
                    AppQuickRow(
                        app = app,
                        used = stats.minutesFor(app.packageName),
                        exempt = settings.isExemptToday(app.packageName),
                        strict = settings.strictActive,
                        onExempt = { onExempt(app.packageName, it) },
                    )
                    Spacer(Modifier.height(8.dp))
                }
            }

            // ---- how it works
            if (!settings.helpDismissed) {
                Spacer(Modifier.height(14.dp))
                SoftCard(Modifier.fillMaxWidth()) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Rounded.Shield, null, tint = Blue)
                        Spacer(Modifier.width(8.dp))
                        Text("كيف يشتغل؟", style = MaterialTheme.typography.titleMedium, color = Ink)
                    }
                    Spacer(Modifier.height(8.dp))
                    HelpStep("١", "أضف التطبيقات اللي تضيع وقتك وحدد دقائق يومية لكل واحد.")
                    HelpStep("٢", "شغّل «الحظر» من المفتاح فوق. التطبيق يحسب دقائقك بالخلفية.")
                    HelpStep("٣", "لما تتعدى الحد وتفتح التطبيق، تطلع شاشة التهزيء وما تقدر تكمل.")
                    HelpStep("٤", "تبي تلغي الحظر؟ «إيقاف مؤقت» لكل شي، أو «إعفاء اليوم» لتطبيق واحد، أو اقفل المفتاح.")
                    Spacer(Modifier.height(8.dp))
                    PillButton("فهمت", onDismissHelp, container = Chip, content = Ink, modifier = Modifier.fillMaxWidth())
                }
            }
            Spacer(Modifier.height(24.dp))
        }
    }

    if (pauseDialog) {
        AlertDialog(
            onDismissRequest = { pauseDialog = false },
            containerColor = Surface,
            title = { Text("إيقاف الحظر مؤقتًا") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("الدقائق تستمر بالحساب، بس ما تطلع شاشة التهزيء خلال المدة.", style = MaterialTheme.typography.bodyMedium, color = Muted)
                    listOf(15 to "١٥ دقيقة", 30 to "٣٠ دقيقة", 60 to "ساعة", -1 to "حتى بكرة").forEach { (m, label) ->
                        PillButton(label, onClick = { onPause(m); pauseDialog = false }, container = Chip, content = Ink, modifier = Modifier.fillMaxWidth())
                    }
                }
            },
            confirmButton = {},
            dismissButton = { TextButton(onClick = { pauseDialog = false }) { Text("إلغاء") } },
        )
    }
}

@Composable
private fun BlockingCard(active: Boolean, settings: Settings, onToggle: (Boolean) -> Unit, onResume: () -> Unit) {
    val paused = settings.isPaused
    val outsideSchedule = settings.schedule.enabled && !settings.schedule.isActive()
    val bg = when {
        !active -> Surface
        paused || outsideSchedule -> SunSoft
        else -> Blue
    }
    val fg = if (active && !paused && !outsideSchedule) Surface else Ink
    val sub = if (active && !paused && !outsideSchedule) Surface.copy(alpha = 0.8f) else Muted
    SoftCard(Modifier.fillMaxWidth(), color = bg) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                Modifier.size(44.dp).clip(CircleShape).background(if (bg == Blue) Surface.copy(alpha = 0.2f) else Chip),
                contentAlignment = Alignment.Center,
            ) {
                Icon(if (settings.strictActive) Icons.Rounded.Lock else Icons.Rounded.Shield, null, tint = fg)
            }
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(
                    when {
                        !active -> "الحظر متوقف"
                        paused -> "الحظر متوقف مؤقتًا"
                        outsideSchedule -> "الحظر نايم الحين"
                        else -> "الحظر شغّال"
                    },
                    style = MaterialTheme.typography.titleLarge,
                    color = fg,
                )
                Text(
                    when {
                        !active -> "اضغط المفتاح وابدأ. ${settings.apps.size.toArabicDigits()} تطبيق جاهز للحظر."
                        paused -> "يرجع تلقائيًا الساعة ${settings.pausedUntil.toClockFromEpoch()}."
                        outsideSchedule -> "خارج أوقات التركيز ${settings.schedule.label()}. الدقائق تنحسب بس بدون تهزيء."
                        settings.strictActive -> "الوضع الصارم مفعّل حتى منتصف الليل."
                        else -> "أراقب ${settings.apps.size.toArabicDigits()} تطبيق. تعدّي الحد.. تنهزأ."
                    },
                    style = MaterialTheme.typography.bodySmall,
                    color = sub,
                )
            }
            Spacer(Modifier.width(8.dp))
            Switch(
                checked = active,
                onCheckedChange = onToggle,
                enabled = !settings.strictActive,
                colors = SwitchDefaults.colors(
                    checkedTrackColor = if (bg == Blue) Surface else Blue,
                    checkedThumbColor = if (bg == Blue) Blue else Surface,
                    uncheckedTrackColor = Line,
                    uncheckedThumbColor = Surface,
                    uncheckedBorderColor = Color.Transparent,
                    disabledCheckedTrackColor = Surface.copy(alpha = 0.6f),
                    disabledCheckedThumbColor = Blue,
                ),
            )
        }
        if (paused) {
            Spacer(Modifier.height(12.dp))
            PillButton("استئناف الحظر الآن", onResume, container = Ink, modifier = Modifier.fillMaxWidth())
        }
        if (settings.strictActive) {
            Spacer(Modifier.height(10.dp))
            StatusPill("الوضع الصارم: ما ينقفل حتى منتصف الليل", CoralSoft, Coral)
        }
    }
}

@Composable
private fun Shortcut(
    icon: ImageVector,
    label: String,
    tint: Color,
    container: Color,
    enabled: Boolean = true,
    onClick: () -> Unit,
) {
    Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.width(76.dp)) {
        Box(
            Modifier
                .size(58.dp)
                .clip(CircleShape)
                .background(if (enabled) container else Chip)
                .clickable(enabled = enabled, onClick = onClick),
            contentAlignment = Alignment.Center,
        ) {
            Icon(icon, contentDescription = label, tint = if (enabled) tint else Muted, modifier = Modifier.size(26.dp))
        }
        Spacer(Modifier.height(6.dp))
        Text(label, style = MaterialTheme.typography.labelMedium, color = if (enabled) Ink else Muted, textAlign = TextAlign.Center, maxLines = 1)
    }
}

@Composable
private fun Tile(title: String, value: String, unit: String, icon: ImageVector, color: Color, tint: Color, modifier: Modifier) {
    SoftCard(modifier.fillMaxHeight(), color = color, radius = 20.dp, padding = 12.dp) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text(title, style = MaterialTheme.typography.labelMedium, color = Ink, modifier = Modifier.weight(1f))
            Icon(icon, null, tint = tint, modifier = Modifier.size(16.dp))
        }
        Spacer(Modifier.weight(1f))
        Row(verticalAlignment = Alignment.Bottom) {
            Text(value, style = MaterialTheme.typography.headlineMedium, color = Ink)
            Spacer(Modifier.width(4.dp))
            Text(unit, style = MaterialTheme.typography.labelSmall, color = Muted, modifier = Modifier.padding(bottom = 6.dp))
        }
    }
}

@Composable
private fun AppQuickRow(app: MonitoredApp, used: Int, exempt: Boolean, strict: Boolean, onExempt: (Boolean) -> Unit) {
    val blocked = used >= app.limitMinutes && !exempt
    SoftCard(Modifier.fillMaxWidth(), radius = 20.dp, padding = 12.dp) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            AppIcon(app.packageName, size = 40.dp)
            Spacer(Modifier.width(10.dp))
            Column(Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(app.label, style = MaterialTheme.typography.titleSmall, color = Ink, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f, fill = false))
                    Spacer(Modifier.width(6.dp))
                    when {
                        exempt -> StatusPill("معفى اليوم", SunSoft, SunInk)
                        blocked -> StatusPill("محظور", CoralSoft, Coral)
                        else -> StatusPill("${(app.limitMinutes - used).coerceAtLeast(0).toArabicDigits()} د باقي", GreenSoft, Green)
                    }
                }
                Spacer(Modifier.height(6.dp))
                SoftProgress(if (app.limitMinutes == 0) 1f else used.toFloat() / app.limitMinutes, color = if (blocked) Coral else Blue, height = 6.dp)
                Spacer(Modifier.height(4.dp))
                Text("${used.toArabicDigits()} من ${app.limitMinutes.toArabicDigits()} دقيقة", style = MaterialTheme.typography.labelSmall, color = Muted)
            }
            Spacer(Modifier.width(10.dp))
            if (strict) {
                Icon(Icons.Rounded.Lock, null, tint = Muted, modifier = Modifier.size(18.dp))
            } else {
                Text(
                    if (exempt) "رجّع الحظر" else "إعفاء اليوم",
                    Modifier
                        .clip(RoundedCornerShape(12.dp))
                        .background(if (exempt) Chip else SunSoft)
                        .clickable { onExempt(!exempt) }
                        .padding(horizontal = 10.dp, vertical = 8.dp),
                    style = MaterialTheme.typography.labelMedium,
                    color = if (exempt) Ink else SunInk,
                )
            }
        }
    }
}

@Composable
private fun HelpStep(n: String, text: String) {
    Row(Modifier.padding(vertical = 4.dp), verticalAlignment = Alignment.Top) {
        Box(Modifier.size(24.dp).clip(CircleShape).background(BlueSoft), contentAlignment = Alignment.Center) {
            Text(n, style = MaterialTheme.typography.labelMedium, color = Blue)
        }
        Spacer(Modifier.width(10.dp))
        Text(text, style = MaterialTheme.typography.bodyMedium, color = Ink, modifier = Modifier.weight(1f))
    }
}

@Composable
fun StandingPill(standing: Standing) {
    val (bg, fg) = when (standing) {
        Standing.CLEAN -> GreenSoft to Green
        Standing.WARNING -> SunSoft to SunInk
        Standing.OVER -> CoralSoft to Coral
        Standing.FAR_OVER -> Coral to Surface
    }
    StatusPill(standing.title, bg, fg)
}

@Suppress("unused")
private val keepSun = Sun
