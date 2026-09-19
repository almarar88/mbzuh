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
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Bolt
import androidx.compose.material.icons.rounded.ChevronLeft
import androidx.compose.material.icons.rounded.ChevronRight
import androidx.compose.material.icons.rounded.HourglassBottom
import androidx.compose.material.icons.rounded.LocalFireDepartment
import androidx.compose.material.icons.rounded.Lock
import androidx.compose.material.icons.rounded.Menu
import androidx.compose.material.icons.rounded.Notifications
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import com.savageblock.app.data.DailyStats
import com.savageblock.app.data.History
import com.savageblock.app.data.Insights
import com.savageblock.app.data.Settings
import com.savageblock.app.data.Standing
import com.savageblock.app.data.toArabicDigits
import com.savageblock.app.ui.components.AreaSparkline
import com.savageblock.app.ui.components.Avatar
import com.savageblock.app.ui.components.CircleIconButton
import com.savageblock.app.ui.components.LineChart
import com.savageblock.app.ui.components.MiniBars
import com.savageblock.app.ui.components.PillButton
import com.savageblock.app.ui.components.SectionHeader
import com.savageblock.app.ui.components.SoftCard
import com.savageblock.app.ui.components.StatusPill
import com.savageblock.app.ui.components.SwitchRow
import com.savageblock.app.ui.theme.Blue
import com.savageblock.app.ui.theme.BlueSoft
import com.savageblock.app.ui.theme.Canvas
import com.savageblock.app.ui.theme.Coral
import com.savageblock.app.ui.theme.CoralSoft
import com.savageblock.app.ui.theme.Dark
import com.savageblock.app.ui.theme.Green
import com.savageblock.app.ui.theme.GreenSoft
import com.savageblock.app.ui.theme.Ink
import com.savageblock.app.ui.theme.Lavender
import com.savageblock.app.ui.theme.LavenderInk
import com.savageblock.app.ui.theme.Mint
import com.savageblock.app.ui.theme.MintInk
import com.savageblock.app.ui.theme.Muted
import com.savageblock.app.ui.theme.Peach
import com.savageblock.app.ui.theme.PeachInk
import com.savageblock.app.ui.theme.Surface
import com.savageblock.app.util.PermissionState

@Composable
fun HomeScreen(
    settings: Settings,
    stats: DailyStats,
    history: History,
    serviceRunning: Boolean,
    permissions: PermissionState,
    contentPadding: PaddingValues,
    onToggleMonitoring: (Boolean) -> Unit,
    onReports: () -> Unit,
    onSettings: () -> Unit,
    onFixPermissions: () -> Unit,
) {
    val week = remember(settings, stats, history) { Insights.lastDays(history, stats, settings, 7) }
    val streak = remember(settings, stats, history) { Insights.streak(history, stats, settings) }
    val todayMinutes = week.last().minutes
    val limit = settings.totalLimitMinutes
    val standing = Insights.standing(todayMinutes, limit)
    val remaining = (limit - todayMinutes).coerceAtLeast(0)
    val active = serviceRunning && settings.monitoringEnabled

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
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Avatar(settings.userName, size = 48.dp)
                Spacer(Modifier.weight(1f))
                Row(
                    Modifier.clip(CircleShape).background(Surface).padding(4.dp),
                    horizontalArrangement = Arrangement.spacedBy(2.dp),
                ) {
                    CircleIconButton(Icons.Rounded.Notifications, "التنبيهات", onClick = onSettings, size = 40.dp)
                    CircleIconButton(Icons.Rounded.Menu, "الإعدادات", onClick = onSettings, size = 40.dp)
                }
            }
            Spacer(Modifier.height(16.dp))
            Text(Insights.greeting(), style = MaterialTheme.typography.bodyLarge, color = Muted)
            Text(
                settings.userName.ifBlank { "يا بطل" },
                style = MaterialTheme.typography.headlineLarge,
                color = Ink,
            )
            Spacer(Modifier.height(16.dp))

            if (!permissions.essentialsGranted) {
                SoftCard(Modifier.fillMaxWidth(), color = CoralSoft) {
                    Text("صلاحيات ناقصة", style = MaterialTheme.typography.titleMedium, color = Coral)
                    Text(
                        "بدون صلاحية الاستخدام والظهور فوق التطبيقات ما أقدر أضبطك.",
                        style = MaterialTheme.typography.bodySmall,
                        color = Ink,
                    )
                    Spacer(Modifier.height(12.dp))
                    PillButton("أصلح الصلاحيات", onFixPermissions, container = Coral)
                }
                Spacer(Modifier.height(14.dp))
            }

            // ---- headline card: wasted minutes today
            SoftCard(Modifier.fillMaxWidth(), color = BlueSoft) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("الوقت الضائع اليوم", style = MaterialTheme.typography.titleSmall, color = Ink, modifier = Modifier.weight(1f))
                    StandingPill(standing)
                }
                Spacer(Modifier.height(10.dp))
                Row(verticalAlignment = Alignment.Bottom) {
                    Text(todayMinutes.toArabicDigits(), style = MaterialTheme.typography.displayMedium, color = Ink)
                    Spacer(Modifier.width(8.dp))
                    Text(
                        "دقيقة من ${limit.toArabicDigits()}",
                        style = MaterialTheme.typography.bodyMedium,
                        color = Muted,
                        modifier = Modifier.padding(bottom = 10.dp),
                    )
                    Spacer(Modifier.weight(1f))
                    MiniBars(
                        values = week.map { it.ratio.coerceAtLeast(0.05f) },
                        modifier = Modifier.width(96.dp).height(44.dp).padding(bottom = 6.dp),
                    )
                }
            }

            Spacer(Modifier.height(20.dp))
            SectionHeader("نظرة عامة") {
                CircleIconButton(Icons.Rounded.ChevronRight, "التقارير", onReports, size = 36.dp, bordered = true)
                Spacer(Modifier.width(6.dp))
                CircleIconButton(Icons.Rounded.ChevronLeft, "التقارير", onReports, size = 36.dp, container = Dark, tint = Surface)
            }
            Spacer(Modifier.height(8.dp))

            // ---- pastel tiles
            Row(Modifier.fillMaxWidth().height(196.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                SoftCard(Modifier.weight(1f).fillMaxHeight(), color = Lavender, radius = 22.dp, padding = 16.dp) {
                    TileHeader("الضربات", Icons.Rounded.Bolt, LavenderInk)
                    Text(stats.blocks.toArabicDigits(), style = MaterialTheme.typography.headlineLarge, color = Ink)
                    Spacer(Modifier.weight(1f))
                    AreaSparkline(
                        values = week.map { it.blocks.toFloat() },
                        color = LavenderInk,
                        modifier = Modifier.fillMaxWidth().height(56.dp),
                    )
                }
                Column(Modifier.weight(1f).fillMaxHeight(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    SoftCard(Modifier.weight(1f).fillMaxWidth(), color = Mint, radius = 22.dp, padding = 16.dp) {
                        TileHeader("السلسلة", Icons.Rounded.LocalFireDepartment, MintInk)
                        Row(verticalAlignment = Alignment.Bottom) {
                            Text(streak.current.toArabicDigits(), style = MaterialTheme.typography.headlineMedium, color = Ink)
                            Spacer(Modifier.width(4.dp))
                            Text("يوم", style = MaterialTheme.typography.bodySmall, color = Muted, modifier = Modifier.padding(bottom = 6.dp))
                        }
                    }
                    SoftCard(Modifier.weight(1f).fillMaxWidth(), color = Peach, radius = 22.dp, padding = 16.dp) {
                        TileHeader("المتبقي", Icons.Rounded.HourglassBottom, PeachInk)
                        Row(verticalAlignment = Alignment.Bottom) {
                            Text(remaining.toArabicDigits(), style = MaterialTheme.typography.headlineMedium, color = Ink)
                            Spacer(Modifier.width(4.dp))
                            Text("دقيقة", style = MaterialTheme.typography.bodySmall, color = Muted, modifier = Modifier.padding(bottom = 6.dp))
                        }
                    }
                }
            }

            Spacer(Modifier.height(14.dp))

            // ---- monitoring switch
            SoftCard(Modifier.fillMaxWidth()) {
                SwitchRow(
                    title = if (active) "المراقبة شغّالة" else "المراقبة متوقفة",
                    subtitle = when {
                        settings.strictActive -> "الوضع الصارم مفعّل حتى منتصف الليل. ما فيه إيقاف."
                        !permissions.essentialsGranted -> "أعطني الصلاحيات الإجبارية أول."
                        settings.apps.isEmpty() -> "أضف تطبيق واحد على الأقل."
                        active -> "أراقب ${settings.apps.size.toArabicDigits()} تطبيق. تعدّي الحد.. تنهزأ."
                        else -> "أنت الحين حر تضيع وقتك. مبروك."
                    },
                    checked = active,
                    onCheckedChange = onToggleMonitoring,
                    enabled = !settings.strictActive && (active || (permissions.essentialsGranted && settings.apps.isNotEmpty())),
                    icon = if (settings.strictActive) Icons.Rounded.Lock else Icons.Rounded.Bolt,
                    iconTint = if (active) Green else Muted,
                    iconContainer = if (active) GreenSoft else com.savageblock.app.ui.theme.Chip,
                )
            }

            Spacer(Modifier.height(14.dp))

            // ---- weekly trend
            SoftCard(Modifier.fillMaxWidth()) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("اتجاه التضييع", style = MaterialTheme.typography.titleMedium, color = Ink, modifier = Modifier.weight(1f))
                    StatusPill("أسبوعي", com.savageblock.app.ui.theme.Chip, Ink)
                }
                Spacer(Modifier.height(12.dp))
                LineChart(
                    values = week.map { it.minutes.toFloat() },
                    limit = limit.toFloat(),
                    labels = week.map { it.shortLabel },
                )
                Spacer(Modifier.height(8.dp))
                Text(
                    "الخط الأحمر المتقطع هو حدّك اليومي. اللي فوقه مو إنجاز.",
                    style = MaterialTheme.typography.bodySmall,
                    color = Muted,
                )
            }
            Spacer(Modifier.height(24.dp))
        }
    }
}

@Composable
fun StandingPill(standing: Standing) {
    val (bg, fg) = when (standing) {
        Standing.CLEAN -> GreenSoft to Green
        Standing.WARNING -> Color(0xFFFFF3CD) to Color(0xFFB7791F)
        Standing.OVER -> CoralSoft to Coral
        Standing.FAR_OVER -> Coral to Surface
    }
    StatusPill(standing.title, bg, fg)
}

@Composable
private fun TileHeader(title: String, icon: ImageVector, tint: Color) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Text(title, style = MaterialTheme.typography.titleSmall, color = Ink, modifier = Modifier.weight(1f))
        Box(Modifier.size(30.dp).clip(CircleShape).background(Surface), contentAlignment = Alignment.Center) {
            Icon(icon, contentDescription = null, tint = tint, modifier = Modifier.size(16.dp))
        }
    }
    Spacer(Modifier.height(6.dp))
}

