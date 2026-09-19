package com.savageblock.app.ui.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.DeleteSweep
import androidx.compose.material.icons.rounded.Info
import androidx.compose.material.icons.rounded.Lock
import androidx.compose.material.icons.rounded.NotificationsActive
import androidx.compose.material.icons.rounded.PrivacyTip
import androidx.compose.material.icons.rounded.Schedule
import androidx.compose.material.icons.rounded.Shield
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.material3.TimePicker
import androidx.compose.material3.rememberTimePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.savageblock.app.BuildConfig
import com.savageblock.app.data.AggressionLevel
import com.savageblock.app.data.Goal
import com.savageblock.app.data.Schedule
import com.savageblock.app.data.Settings
import com.savageblock.app.data.toArabicDigits
import com.savageblock.app.data.toClock
import com.savageblock.app.ui.components.Avatar
import com.savageblock.app.ui.components.PillButton
import com.savageblock.app.ui.components.SectionHeader
import com.savageblock.app.ui.components.SettingsRow
import com.savageblock.app.ui.components.SoftCard
import com.savageblock.app.ui.components.SoftChip
import com.savageblock.app.ui.components.StatusPill
import com.savageblock.app.ui.components.SwitchRow
import com.savageblock.app.ui.components.TopBar
import com.savageblock.app.ui.theme.Blue
import com.savageblock.app.ui.theme.Canvas
import com.savageblock.app.ui.theme.Chip
import com.savageblock.app.ui.theme.Coral
import com.savageblock.app.ui.theme.CoralSoft
import com.savageblock.app.ui.theme.Green
import com.savageblock.app.ui.theme.GreenSoft
import com.savageblock.app.ui.theme.Ink
import com.savageblock.app.ui.theme.Line
import com.savageblock.app.ui.theme.Muted
import com.savageblock.app.ui.theme.Sun
import com.savageblock.app.ui.theme.Surface
import com.savageblock.app.util.PermissionState
import java.time.DayOfWeek
import java.time.format.TextStyle
import java.util.Locale

@OptIn(ExperimentalLayoutApi::class, ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    settings: Settings,
    permissions: PermissionState,
    contentPadding: PaddingValues,
    onName: (String) -> Unit,
    onGoal: (Goal) -> Unit,
    onAggression: (AggressionLevel) -> Unit,
    onSchedule: (Schedule) -> Unit,
    onWarnAt: (Int) -> Unit,
    onStrict: () -> Unit,
    onPermissions: () -> Unit,
    onPrivacy: () -> Unit,
    onClearHistory: () -> Unit,
) {
    var name by remember(settings.userName) { mutableStateOf(settings.userName) }
    var strictDialog by remember { mutableStateOf(false) }
    var clearDialog by remember { mutableStateOf(false) }
    var timeDialog by remember { mutableStateOf<Int?>(null) } // 0 = start, 1 = end

    Column(
        Modifier
            .fillMaxSize()
            .background(Canvas)
            .statusBarsPadding()
            .verticalScroll(rememberScrollState())
            .padding(bottom = contentPadding.calculateBottomPadding() + 24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        TopBar("حسابي", onBack = null)
        Column(Modifier.widthIn(max = 720.dp).fillMaxWidth().padding(horizontal = 20.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {

            // ---- profile
            SoftCard(Modifier.fillMaxWidth()) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Avatar(name, size = 56.dp)
                    Spacer(Modifier.width(14.dp))
                    TextField(
                        value = name,
                        onValueChange = { name = it; onName(it) },
                        modifier = Modifier.weight(1f),
                        singleLine = true,
                        placeholder = { Text("اسمك (عشان أناديك فيه)", color = Muted) },
                        shape = RoundedCornerShape(14.dp),
                        colors = softFieldColors(),
                    )
                }
            }

            // ---- goal
            SoftCard(Modifier.fillMaxWidth()) {
                SectionHeader("هدفك الأساسي")
                Text("أذكّرك بنقطة ضعفك بالضبط لما تضيع وقتك.", style = MaterialTheme.typography.bodySmall, color = Muted)
                Spacer(Modifier.height(10.dp))
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Goal.entries.forEach { goal ->
                        SoftChip("${goal.emoji} ${goal.title}", selected = goal == settings.goal, onClick = { onGoal(goal) })
                    }
                }
            }

            // ---- aggression
            SoftCard(Modifier.fillMaxWidth()) {
                SectionHeader("مستوى الوقاحة") {
                    if (settings.strictActive) StatusPill("مقفل للأسفل", CoralSoft, Coral)
                }
                Spacer(Modifier.height(6.dp))
                AggressionLevel.entries.forEach { level ->
                    val selected = level == settings.aggression
                    val locked = settings.strictActive && level.ordinal < settings.aggression.ordinal
                    val accent = when (level) {
                        AggressionLevel.LOW -> Green
                        AggressionLevel.MEDIUM -> Sun
                        AggressionLevel.SAVAGE -> Coral
                    }
                    Row(
                        Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(16.dp))
                            .background(if (selected) Chip else Color.Transparent)
                            .clickable(enabled = !locked) { onAggression(level) }
                            .padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Box(
                            Modifier
                                .size(24.dp)
                                .clip(CircleShape)
                                .background(if (selected) accent else Surface)
                                .then(if (selected) Modifier else Modifier.background(Line)),
                            contentAlignment = Alignment.Center,
                        ) {
                            if (selected) Icon(Icons.Rounded.Check, null, tint = Surface, modifier = Modifier.size(14.dp))
                        }
                        Spacer(Modifier.width(12.dp))
                        Column(Modifier.weight(1f)) {
                            Text(level.title, style = MaterialTheme.typography.titleMedium, color = if (locked) Muted else Ink)
                            Text(level.description, style = MaterialTheme.typography.bodySmall, color = Muted)
                        }
                    }
                }
            }

            // ---- focus schedule
            SoftCard(Modifier.fillMaxWidth()) {
                SwitchRow(
                    title = "أوقات التركيز",
                    subtitle = if (settings.schedule.enabled) "الحظر يشتغل فقط ${settings.schedule.label()}" else "الحظر شغّال طول اليوم",
                    checked = settings.schedule.enabled,
                    onCheckedChange = { onSchedule(settings.schedule.copy(enabled = it)) },
                    icon = Icons.Rounded.Schedule,
                )
                if (settings.schedule.enabled) {
                    Spacer(Modifier.height(12.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        TimeChip("من", settings.schedule.startMinute, Modifier.weight(1f)) { timeDialog = 0 }
                        TimeChip("إلى", settings.schedule.endMinute, Modifier.weight(1f)) { timeDialog = 1 }
                    }
                    Spacer(Modifier.height(12.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        listOf(DayOfWeek.SATURDAY, DayOfWeek.SUNDAY, DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY, DayOfWeek.THURSDAY, DayOfWeek.FRIDAY).forEach { d ->
                            val on = d.value in settings.schedule.days
                            Box(
                                Modifier
                                    .weight(1f)
                                    .height(38.dp)
                                    .clip(CircleShape)
                                    .background(if (on) Blue else Chip)
                                    .clickable {
                                        val days = if (on) settings.schedule.days - d.value else settings.schedule.days + d.value
                                        if (days.isNotEmpty()) onSchedule(settings.schedule.copy(days = days))
                                    },
                                contentAlignment = Alignment.Center,
                            ) {
                                Text(
                                    d.getDisplayName(TextStyle.SHORT, Locale("ar")).take(3),
                                    style = MaterialTheme.typography.labelMedium,
                                    color = if (on) Surface else Ink,
                                )
                            }
                        }
                    }
                    Spacer(Modifier.height(8.dp))
                    Text("خارج هالأوقات أحسب دقائقك بس ما أهزّئك.", style = MaterialTheme.typography.bodySmall, color = Muted)
                }
            }

            // ---- warn before limit
            SoftCard(Modifier.fillMaxWidth()) {
                var warn by remember(settings.warnAtPercent) { mutableFloatStateOf(settings.warnAtPercent.toFloat()) }
                SwitchRow(
                    title = "تنبيه قبل الحد",
                    subtitle = if (settings.warnAtPercent > 0) "أنبهك عند ${settings.warnAtPercent.toArabicDigits()}٪ من الحد" else "بدون تنبيه، مباشرة تهزيء",
                    checked = settings.warnAtPercent > 0,
                    onCheckedChange = { onWarnAt(if (it) 80 else 0) },
                    icon = Icons.Rounded.NotificationsActive,
                    iconTint = Sun,
                    iconContainer = Color(0xFFFFF3CD),
                )
                if (settings.warnAtPercent > 0) {
                    Slider(
                        value = warn,
                        onValueChange = { warn = it },
                        onValueChangeFinished = { onWarnAt(warn.toInt()) },
                        valueRange = 50f..95f,
                        steps = 8,
                        colors = SliderDefaults.colors(thumbColor = Blue, activeTrackColor = Blue, inactiveTrackColor = Line, activeTickColor = Blue, inactiveTickColor = Line),
                    )
                }
            }

            // ---- strict mode
            SoftCard(Modifier.fillMaxWidth(), color = if (settings.strictActive) CoralSoft else Surface) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.size(40.dp).clip(RoundedCornerShape(12.dp)).background(if (settings.strictActive) Coral else Chip), contentAlignment = Alignment.Center) {
                        Icon(Icons.Rounded.Lock, null, tint = if (settings.strictActive) Surface else Ink, modifier = Modifier.size(20.dp))
                    }
                    Spacer(Modifier.width(12.dp))
                    Column(Modifier.weight(1f)) {
                        Text("الوضع الصارم", style = MaterialTheme.typography.titleMedium, color = Ink)
                        Text(
                            if (settings.strictActive) "مفعّل حتى منتصف الليل. ما فيه إيقاف ولا زيادة حدود ولا حذف تطبيقات."
                            else "اقفل على نفسك حتى منتصف الليل: ما تقدر توقف المراقبة ولا تزيد الحدود ولا تحذف تطبيق.",
                            style = MaterialTheme.typography.bodySmall,
                            color = Muted,
                        )
                    }
                }
                if (!settings.strictActive) {
                    Spacer(Modifier.height(12.dp))
                    PillButton("اقفل عليّ حتى منتصف الليل", onClick = { strictDialog = true }, container = Ink, modifier = Modifier.fillMaxWidth())
                }
            }

            // ---- misc rows
            SoftCard(Modifier.fillMaxWidth(), padding = 10.dp) {
                SettingsRow(
                    Icons.Rounded.Shield, "الصلاحيات",
                    subtitle = if (permissions.essentialsGranted) "كل شي تمام" else "فيه صلاحيات ناقصة",
                    iconTint = if (permissions.essentialsGranted) Green else Coral,
                    iconContainer = if (permissions.essentialsGranted) GreenSoft else CoralSoft,
                    onClick = onPermissions,
                )
                SettingsRow(Icons.Rounded.PrivacyTip, "سياسة الخصوصية", subtitle = "كل بياناتك على جهازك فقط", onClick = onPrivacy)
                SettingsRow(Icons.Rounded.DeleteSweep, "امسح السجل", subtitle = "يحذف إحصائيات اليوم والتاريخ. الإعدادات تبقى.", iconTint = Coral, iconContainer = CoralSoft, onClick = { clearDialog = true })
                SettingsRow(Icons.Rounded.Info, "عن التطبيق", subtitle = "SavageBlock ${BuildConfig.VERSION_NAME} · تطوير Alcode", iconTint = Muted, iconContainer = Chip, onClick = {})
            }
        }
    }

    if (strictDialog) {
        AlertDialog(
            onDismissRequest = { strictDialog = false },
            title = { Text("متأكد؟") },
            text = { Text("بعد التفعيل ما فيه رجعة حتى منتصف الليل. لا إيقاف، لا زيادة حدود، لا حذف. هذا هو الهدف.") },
            confirmButton = { TextButton(onClick = { strictDialog = false; onStrict() }) { Text("اقفل عليّ", color = Coral) } },
            dismissButton = { TextButton(onClick = { strictDialog = false }) { Text("تراجعت") } },
            containerColor = Surface,
        )
    }
    if (clearDialog) {
        AlertDialog(
            onDismissRequest = { clearDialog = false },
            title = { Text("امسح السجل؟") },
            text = { Text("بيروح تاريخ الأيام والسلسلة. الإعدادات والتطبيقات المحظورة تبقى.") },
            confirmButton = { TextButton(onClick = { clearDialog = false; onClearHistory() }) { Text("امسح", color = Coral) } },
            dismissButton = { TextButton(onClick = { clearDialog = false }) { Text("إلغاء") } },
            containerColor = Surface,
        )
    }
    timeDialog?.let { which ->
        val initial = if (which == 0) settings.schedule.startMinute else settings.schedule.endMinute
        val state = rememberTimePickerState(initialHour = initial / 60, initialMinute = initial % 60, is24Hour = false)
        AlertDialog(
            onDismissRequest = { timeDialog = null },
            title = { Text(if (which == 0) "بداية التركيز" else "نهاية التركيز") },
            text = { TimePicker(state = state) },
            confirmButton = {
                TextButton(onClick = {
                    val minute = state.hour * 60 + state.minute
                    onSchedule(if (which == 0) settings.schedule.copy(startMinute = minute) else settings.schedule.copy(endMinute = minute))
                    timeDialog = null
                }) { Text("حفظ", color = Blue) }
            },
            dismissButton = { TextButton(onClick = { timeDialog = null }) { Text("إلغاء") } },
            containerColor = Surface,
        )
    }
}

@Composable
private fun TimeChip(label: String, minute: Int, modifier: Modifier = Modifier, onClick: () -> Unit) {
    Column(
        modifier.clip(RoundedCornerShape(14.dp)).background(Chip).clickable(onClick = onClick).padding(12.dp),
    ) {
        Text(label, style = MaterialTheme.typography.labelMedium, color = Muted)
        Text(minute.toClock(), style = MaterialTheme.typography.titleMedium, color = Ink)
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun softFieldColors() = TextFieldDefaults.colors(
    focusedContainerColor = Chip,
    unfocusedContainerColor = Chip,
    focusedIndicatorColor = Color.Transparent,
    unfocusedIndicatorColor = Color.Transparent,
    cursorColor = Blue,
    focusedTextColor = Ink,
    unfocusedTextColor = Ink,
)

