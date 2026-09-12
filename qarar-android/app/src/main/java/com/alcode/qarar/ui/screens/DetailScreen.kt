package com.alcode.qarar.ui.screens

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.outlined.AutoAwesome
import androidx.compose.material.icons.outlined.Balance
import androidx.compose.material.icons.outlined.Delete
import androidx.compose.material.icons.outlined.Flag
import androidx.compose.material.icons.outlined.HelpOutline
import androidx.compose.material.icons.outlined.Lightbulb
import androidx.compose.material.icons.outlined.Psychology
import androidx.compose.material.icons.outlined.RateReview
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material.icons.outlined.Visibility
import androidx.compose.material.icons.outlined.Warning
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.alcode.qarar.data.Analysis
import com.alcode.qarar.data.Decision
import com.alcode.qarar.data.DecisionStatus
import com.alcode.qarar.data.ReviewAnalysis
import com.alcode.qarar.ui.Job
import com.alcode.qarar.ui.components.BulletList
import com.alcode.qarar.ui.components.ConfidenceBar
import com.alcode.qarar.ui.components.LabeledValue
import com.alcode.qarar.ui.components.Pill
import com.alcode.qarar.ui.components.SectionCard
import com.alcode.qarar.ui.components.VSpace
import com.alcode.qarar.ui.components.formatDate
import com.alcode.qarar.ui.components.stakesColor
import com.alcode.qarar.ui.components.statusColor
import com.alcode.qarar.ui.theme.Amber
import com.alcode.qarar.ui.theme.Rose
import com.alcode.qarar.ui.theme.Teal

private const val DAY = 24L * 60 * 60 * 1000

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DetailScreen(
    decision: Decision,
    job: Job?,
    hasKey: Boolean,
    snackbar: SnackbarHostState,
    onBack: () -> Unit,
    onSave: (Decision) -> Unit,
    onDelete: () -> Unit,
    onAnalyze: () -> Unit,
    onReview: () -> Unit,
    onSettings: () -> Unit,
) {
    var confirmDelete by remember { mutableStateOf(false) }
    var contextExpanded by remember { mutableStateOf(false) }

    if (confirmDelete) {
        AlertDialog(
            onDismissRequest = { confirmDelete = false },
            title = { Text("حذف القرار؟") },
            text = { Text("سيُحذف القرار وتحليله ومراجعته نهائيًا.") },
            confirmButton = { TextButton(onClick = { confirmDelete = false; onDelete() }) { Text("حذف", color = MaterialTheme.colorScheme.error) } },
            dismissButton = { TextButton(onClick = { confirmDelete = false }) { Text("إلغاء") } },
        )
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(decision.title, maxLines = 1, overflow = TextOverflow.Ellipsis, fontWeight = FontWeight.Bold) },
                navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowForward, "رجوع") } },
                actions = { IconButton(onClick = { confirmDelete = true }) { Icon(Icons.Outlined.Delete, "حذف") } },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
            )
        },
        snackbarHost = { SnackbarHost(snackbar) },
        containerColor = MaterialTheme.colorScheme.background,
    ) { padding ->
        Column(
            Modifier.fillMaxSize().padding(padding).verticalScroll(rememberScrollState()).imePadding()
                .padding(horizontal = 16.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            // ---- Header ----
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Pill(decision.status.label, statusColor(decision.status))
                Pill(decision.stakes.label, stakesColor(decision.stakes))
                if (decision.deadline != null) Pill("الموعد ${formatDate(decision.deadline)}", MaterialTheme.colorScheme.onSurfaceVariant, icon = Icons.Outlined.Flag)
            }
            Text(decision.title, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
            Column(Modifier.clickable { contextExpanded = !contextExpanded }) {
                Text(
                    decision.context, style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = if (contextExpanded) Int.MAX_VALUE else 4, overflow = TextOverflow.Ellipsis,
                )
                if (decision.context.length > 180) Text(if (contextExpanded) "إخفاء" else "المزيد…", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.primary)
            }
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.fillMaxWidth()) {
                decision.options.forEachIndexed { i, o -> Pill("${i + 1}. $o", MaterialTheme.colorScheme.tertiary) }
            }

            // ---- AI analysis ----
            AnalysisSection(decision, job, hasKey, onAnalyze, onSettings)

            // ---- Decision ----
            DecisionSection(decision, onSave)

            // ---- Review ----
            if (decision.status != DecisionStatus.OPEN) ReviewSection(decision, job, hasKey, onSave, onReview)

            VSpace(32)
        }
    }
}

// ------------------------------------------------------------------ Analysis

@Composable
private fun AnalysisSection(d: Decision, job: Job?, hasKey: Boolean, onAnalyze: () -> Unit, onSettings: () -> Unit) {
    val a = d.analysis
    val analyzing = job == Job.ANALYZE

    if (a == null) {
        Card(
            shape = MaterialTheme.shapes.medium,
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainer),
        ) {
            Column(Modifier.fillMaxWidth().padding(20.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Box(Modifier.size(56.dp).clip(CircleShape).background(MaterialTheme.colorScheme.primary.copy(alpha = 0.15f)), contentAlignment = Alignment.Center) {
                    if (analyzing) CircularProgressIndicator(Modifier.size(28.dp), strokeWidth = 3.dp)
                    else Icon(Icons.Outlined.Psychology, null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(30.dp))
                }
                Text(if (analyzing) "«قرار» يفكّر…" else "التحليل الذكي", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                Text(
                    if (analyzing) "يبحث عن المشكلة الحقيقية، يكشف الافتراضات الخفية، ويتخيّل كيف قد يفشل كل خيار. قد يستغرق هذا دقيقة."
                    else "اكشف الافتراضات الخفية، الخيارات الناقصة، مخاطر كل مسار، وتحليل «ما قبل الفشل» — ثم توصية بثقة صادقة.",
                    style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                )
                if (!hasKey) {
                    OutlinedButton(onClick = onSettings) { Text("أضف مفتاح API أولًا") }
                } else {
                    Button(onClick = onAnalyze, enabled = !analyzing && job == null) {
                        Icon(Icons.Outlined.AutoAwesome, null); Text(" حلّل هذا القرار")
                    }
                }
            }
        }
        return
    }

    // Recommendation hero
    Card(
        shape = MaterialTheme.shapes.large,
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer),
    ) {
        Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Icon(Icons.Outlined.AutoAwesome, null, tint = MaterialTheme.colorScheme.onPrimaryContainer)
                Text("التوصية", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onPrimaryContainer)
            }
            Text(a.recommendedOption, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onPrimaryContainer)
            Text(a.recommendationWhy, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onPrimaryContainer)
            ConfidenceBar(a.confidence)
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                val rev = a.reversibility == "قابل للتراجع"
                Pill(a.reversibility, if (rev) Teal else Rose, icon = if (rev) Icons.Outlined.Refresh else Icons.Outlined.Warning)
            }
            if (a.reversibilityNote.isNotBlank()) Text(a.reversibilityNote, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onPrimaryContainer)
        }
    }

    SectionCard("المشكلة الحقيقية", icon = Icons.Outlined.Visibility) {
        Text(a.oneLine, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
        Text(a.realProblem, style = MaterialTheme.typography.bodyMedium)
    }
    SectionCard("افتراضات خفية تبني عليها", icon = Icons.Outlined.Psychology, accent = Amber) {
        BulletList(a.hiddenAssumptions, bullet = "؟")
    }
    if (a.missingOptions.isNotEmpty()) {
        SectionCard("خيارات لم تذكرها", icon = Icons.Outlined.Lightbulb, accent = Teal) {
            BulletList(a.missingOptions, bullet = "+", color = Teal)
        }
    }
    SectionCard("تشريح الخيارات", icon = Icons.Outlined.Balance) {
        a.options.forEachIndexed { i, o ->
            if (i > 0) HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(o.name, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
                    val c = when (o.riskLevel) { "منخفض" -> Teal; "متوسط" -> Amber; else -> Rose }
                    Pill("خطر ${o.riskLevel}", c)
                }
                BulletList(o.pros, bullet = "✓", color = Teal)
                BulletList(o.cons, bullet = "✗", color = Rose)
                if (o.secondOrderEffects.isNotBlank()) {
                    Text("ثم ماذا؟ " + o.secondOrderEffects, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }
    }
    SectionCard("ما قبل الفشل — تخيّل أنه فشل بعد سنة", icon = Icons.Outlined.Warning, accent = Rose) {
        BulletList(a.premortem, bullet = "!", color = Rose)
    }
    SectionCard("أسئلة أجب عنها قبل أن تقرر", icon = Icons.Outlined.HelpOutline) {
        BulletList(a.questionsToAnswer, bullet = "؟")
    }
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
        Text("حُلِّل بواسطة ${a.model} · ${formatDate(a.createdAt)}", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.outline)
        if (d.status == DecisionStatus.OPEN && hasKey) {
            TextButton(onClick = onAnalyze, enabled = job == null) {
                if (analyzing) CircularProgressIndicator(Modifier.size(16.dp), strokeWidth = 2.dp) else Icon(Icons.Outlined.Refresh, null)
                Text(" إعادة التحليل")
            }
        }
    }
}

// ------------------------------------------------------------------ Decision

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DecisionSection(d: Decision, onSave: (Decision) -> Unit) {
    if (d.status != DecisionStatus.OPEN) {
        SectionCard("قرارك", icon = Icons.Outlined.Flag, accent = statusColor(DecisionStatus.DECIDED)) {
            Text(d.chosenOption.orEmpty(), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            d.followedRecommendation?.let {
                Pill(if (it) "وافقت التوصية" else "خالفت التوصية", if (it) Teal else Amber)
            }
            LabeledValue("لماذا؟", d.decisionReason.orEmpty())
            LabeledValue("ما توقعت أن يحدث", d.expectedOutcome.orEmpty())
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                LabeledValue("تاريخ القرار", formatDate(d.decidedAt))
                LabeledValue("موعد المراجعة", formatDate(d.reviewAt))
            }
            if (d.status == DecisionStatus.DECIDED) {
                TextButton(onClick = { onSave(d.copy(chosenOption = null, decisionReason = null, expectedOutcome = null, decidedAt = null, reviewAt = null)) }) {
                    Text("تراجع عن تسجيل القرار", color = MaterialTheme.colorScheme.error)
                }
            }
        }
        return
    }

    val candidates = (d.options + (d.analysis?.missingOptions ?: emptyList())).distinct()
    var chosen by remember(d.id) { mutableStateOf<String?>(null) }
    var custom by remember(d.id) { mutableStateOf("") }
    var reason by remember(d.id) { mutableStateOf("") }
    var expected by remember(d.id) { mutableStateOf("") }
    var reviewDays by remember(d.id) { mutableStateOf(30) }
    var customReview by remember(d.id) { mutableStateOf<Long?>(null) }
    var showPicker by remember { mutableStateOf(false) }
    val useCustom = chosen == "__custom__"
    val finalChoice = if (useCustom) custom.trim() else chosen
    val valid = !finalChoice.isNullOrBlank() && reason.trim().isNotBlank()

    if (showPicker) {
        val state = rememberDatePickerState(initialSelectedDateMillis = customReview ?: (System.currentTimeMillis() + 30 * DAY))
        DatePickerDialog(
            onDismissRequest = { showPicker = false },
            confirmButton = { TextButton(onClick = { customReview = state.selectedDateMillis; reviewDays = -1; showPicker = false }) { Text("موافق") } },
            dismissButton = { TextButton(onClick = { showPicker = false }) { Text("إلغاء") } },
        ) { DatePicker(state = state) }
    }

    SectionCard("سجّل قرارك", icon = Icons.Outlined.Flag, accent = statusColor(DecisionStatus.DECIDED)) {
        Text("التحليل يقترح؛ أنت تقرر. تسجيل السبب والتوقع الآن هو ما يجعل المراجعة لاحقًا مفيدة.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        candidates.forEach { opt ->
            Row(
                Modifier.fillMaxWidth().clickable { chosen = opt }.padding(vertical = 2.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                RadioButton(selected = chosen == opt, onClick = { chosen = opt })
                Text(opt, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.weight(1f))
                if (d.analysis?.recommendedOption?.trim() == opt.trim()) Pill("موصى به", MaterialTheme.colorScheme.primary)
            }
        }
        Row(Modifier.fillMaxWidth().clickable { chosen = "__custom__" }, verticalAlignment = Alignment.CenterVertically) {
            RadioButton(selected = useCustom, onClick = { chosen = "__custom__" })
            Text("خيار آخر", style = MaterialTheme.typography.bodyMedium)
        }
        AnimatedVisibility(useCustom) {
            OutlinedTextField(value = custom, onValueChange = { custom = it }, label = { Text("اكتب الخيار") }, singleLine = true, modifier = Modifier.fillMaxWidth())
        }
        OutlinedTextField(value = reason, onValueChange = { reason = it }, label = { Text("لماذا هذا الخيار؟") }, modifier = Modifier.fillMaxWidth(), minLines = 2)
        OutlinedTextField(value = expected, onValueChange = { expected = it }, label = { Text("ما الذي تتوقع أن يحدث؟") }, placeholder = { Text("كن محددًا؛ ستقارن هذا بالواقع لاحقًا") }, modifier = Modifier.fillMaxWidth(), minLines = 2)

        Text("متى تراجع النتيجة؟", style = MaterialTheme.typography.labelLarge)
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.fillMaxWidth()) {
            listOf(7 to "أسبوع", 30 to "شهر", 90 to "3 أشهر", 180 to "6 أشهر").forEach { (days, label) ->
                FilterChip(selected = reviewDays == days, onClick = { reviewDays = days; customReview = null }, label = { Text(label) })
            }
        }
        Row(verticalAlignment = Alignment.CenterVertically) {
            FilterChip(selected = reviewDays == -1, onClick = { showPicker = true }, label = { Text(customReview?.let { formatDate(it) } ?: "تاريخ آخر") })
        }
        Button(
            onClick = {
                if (!valid) return@Button
                val now = System.currentTimeMillis()
                val reviewAt = if (reviewDays == -1) (customReview ?: now + 30 * DAY) else now + reviewDays * DAY
                onSave(d.copy(chosenOption = finalChoice, decisionReason = reason.trim(), expectedOutcome = expected.trim(), decidedAt = now, reviewAt = reviewAt))
            },
            enabled = valid, modifier = Modifier.fillMaxWidth().height(50.dp),
        ) { Text("تسجيل القرار") }
    }
}

// ------------------------------------------------------------------ Review

@Composable
private fun ReviewSection(d: Decision, job: Job?, hasKey: Boolean, onSave: (Decision) -> Unit, onReview: () -> Unit) {
    val reviewing = job == Job.REVIEW
    if (d.status == DecisionStatus.DECIDED) {
        var actual by remember(d.id) { mutableStateOf("") }
        var score by remember(d.id) { mutableStateOf(0) }
        var lessons by remember(d.id) { mutableStateOf("") }
        val due = (d.reviewAt ?: 0L) <= System.currentTimeMillis()
        SectionCard("ماذا حدث فعلًا؟", icon = Icons.Outlined.RateReview, accent = Teal) {
            Text(
                if (due) "حان موعد المراجعة. سجّل النتيجة بصدق — هذه أثمن بيانات في التطبيق."
                else "موعد المراجعة ${formatDate(d.reviewAt)}. يمكنك التسجيل مبكرًا إن اتضحت النتيجة.",
                style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            LabeledValue("كنت تتوقع", d.expectedOutcome.orEmpty())
            OutlinedTextField(value = actual, onValueChange = { actual = it }, label = { Text("ما الذي حدث؟") }, modifier = Modifier.fillMaxWidth(), minLines = 3)
            Text("كيف تقيّم النتيجة؟", style = MaterialTheme.typography.labelLarge)
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                (1..5).forEach { s ->
                    FilterChip(selected = score == s, onClick = { score = s }, label = { Text("$s") })
                }
                Text(
                    when (score) { 1 -> "سيئة جدًا"; 2 -> "سيئة"; 3 -> "مقبولة"; 4 -> "جيدة"; 5 -> "ممتازة"; else -> "" },
                    style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.align(Alignment.CenterVertically),
                )
            }
            OutlinedTextField(value = lessons, onValueChange = { lessons = it }, label = { Text("ما الذي تعلّمته؟ (اختياري)") }, modifier = Modifier.fillMaxWidth(), minLines = 2)
            Button(
                onClick = { onSave(d.copy(actualOutcome = actual.trim(), outcomeScore = score, lessons = lessons.trim().ifBlank { null }, reviewedAt = System.currentTimeMillis())) },
                enabled = actual.trim().isNotBlank() && score in 1..5, modifier = Modifier.fillMaxWidth().height(50.dp),
            ) { Text("تسجيل النتيجة") }
        }
        return
    }

    SectionCard("النتيجة", icon = Icons.Outlined.RateReview, accent = Teal) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            val s = d.outcomeScore ?: 0
            Text("$s/5", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold, color = if (s >= 4) Teal else if (s == 3) Amber else Rose)
            Text(formatDate(d.reviewedAt), style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        LabeledValue("كنت تتوقع", d.expectedOutcome.orEmpty())
        LabeledValue("حدث فعلًا", d.actualOutcome.orEmpty())
        if (!d.lessons.isNullOrBlank()) LabeledValue("درسك", d.lessons)
    }

    val r = d.reviewAnalysis
    if (r == null) {
        Card(shape = MaterialTheme.shapes.medium, colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainer)) {
            Column(Modifier.fillMaxWidth().padding(20.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(10.dp)) {
                if (reviewing) CircularProgressIndicator(Modifier.size(28.dp), strokeWidth = 3.dp)
                else Icon(Icons.Outlined.Psychology, null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(30.dp))
                Text(if (reviewing) "«قرار» يراجع…" else "مراجعة ذكية", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                Text(
                    "هل كان قرارًا جيدًا أم نتيجة جيدة فقط؟ يفصل «قرار» بين جودة القرار وجودة الحظ، ويرصد التحيزات التي أثّرت عليك.",
                    style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                )
                if (hasKey) Button(onClick = onReview, enabled = job == null) { Icon(Icons.Outlined.AutoAwesome, null); Text(" راجع قراري") }
            }
        }
    } else {
        ReviewAnalysisView(r)
        if (hasKey) TextButton(onClick = onReview, enabled = job == null) { Text("إعادة المراجعة") }
    }
}

@Composable
private fun ReviewAnalysisView(r: ReviewAnalysis) {
    Card(shape = MaterialTheme.shapes.large, colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.secondaryContainer)) {
        Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("الحكم", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSecondaryContainer)
            Text(r.verdict, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSecondaryContainer)
            Text(r.processVsLuck, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSecondaryContainer)
        }
    }
    SectionCard("تحيزات رُصدت", icon = Icons.Outlined.Psychology, accent = Amber) { BulletList(r.biases, bullet = "!", color = Amber) }
    SectionCard("ما نجح", icon = Icons.Outlined.Lightbulb, accent = Teal) { Text(r.whatWorked, style = MaterialTheme.typography.bodyMedium) }
    SectionCard("الدرس للقرار القادم", icon = Icons.Outlined.Flag) { Text(r.lesson, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium) }
}
