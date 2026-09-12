package com.alcode.qarar.ui.screens

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.BasicText
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.outlined.AutoAwesome
import androidx.compose.material.icons.outlined.Insights
import androidx.compose.material.icons.outlined.Lightbulb
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material.icons.outlined.Warning
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.alcode.qarar.data.AppSettings
import com.alcode.qarar.data.Decision
import com.alcode.qarar.data.DecisionStatus
import com.alcode.qarar.ui.components.Pill
import com.alcode.qarar.ui.components.StatTile
import com.alcode.qarar.ui.components.EmptyState
import com.alcode.qarar.ui.components.formatDate
import com.alcode.qarar.ui.components.stakesColor
import com.alcode.qarar.ui.components.statusColor
import com.alcode.qarar.ui.theme.Amber
import com.alcode.qarar.ui.theme.Teal

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    decisions: List<Decision>,
    settings: AppSettings,
    snackbar: SnackbarHostState,
    onNew: () -> Unit,
    onOpen: (String) -> Unit,
    onInsights: () -> Unit,
    onSettings: () -> Unit,
) {
    var filter by remember { mutableStateOf<DecisionStatus?>(null) }
    val filtered = decisions.filter { filter == null || it.status == filter }
    val now = System.currentTimeMillis()
    val dueReviews = decisions.filter { it.status == DecisionStatus.DECIDED && (it.reviewAt ?: Long.MAX_VALUE) <= now }
    val avgScore = decisions.mapNotNull { it.outcomeScore }.average().takeIf { !it.isNaN() }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text("قرار", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
                        Text("فكّر أوضح. قرّر أسرع. تعلّم أعمق.", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                },
                actions = {
                    IconButton(onClick = onInsights) { Icon(Icons.Outlined.Insights, contentDescription = "الأنماط") }
                    IconButton(onClick = onSettings) { Icon(Icons.Outlined.Settings, contentDescription = "الإعدادات") }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
            )
        },
        floatingActionButton = {
            ExtendedFloatingActionButton(
                onClick = onNew,
                icon = { Icon(Icons.Default.Add, null) },
                text = { Text("قرار جديد") },
                containerColor = MaterialTheme.colorScheme.primary,
                contentColor = MaterialTheme.colorScheme.onPrimary,
            )
        },
        snackbarHost = { SnackbarHost(snackbar) },
        containerColor = MaterialTheme.colorScheme.background,
    ) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding),
            contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 4.dp, bottom = 96.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            if (!settings.hasKey) {
                item {
                    Card(
                        onClick = onSettings,
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer),
                        shape = MaterialTheme.shapes.medium,
                    ) {
                        Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            Icon(Icons.Outlined.AutoAwesome, null, tint = MaterialTheme.colorScheme.onPrimaryContainer)
                            Column(Modifier.weight(1f)) {
                                Text("فعّل الذكاء الاصطناعي", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onPrimaryContainer)
                                Text("أضف مفتاح Claude API من الإعدادات ليحلّل «قرار» قراراتك ويراجعها.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onPrimaryContainer)
                            }
                        }
                    }
                }
            }
            if (dueReviews.isNotEmpty()) {
                item {
                    Card(
                        onClick = { onOpen(dueReviews.first().id) },
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.secondaryContainer),
                        shape = MaterialTheme.shapes.medium,
                    ) {
                        Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            Icon(Icons.Outlined.Lightbulb, null, tint = MaterialTheme.colorScheme.onSecondaryContainer)
                            Column(Modifier.weight(1f)) {
                                Text("حان وقت المراجعة", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSecondaryContainer)
                                Text(
                                    if (dueReviews.size == 1) "«${dueReviews.first().title}» — سجّل ما حدث فعلًا لتتعلّم منه."
                                    else "${dueReviews.size} قرارات تنتظر تسجيل نتائجها.",
                                    style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSecondaryContainer,
                                )
                            }
                        }
                    }
                }
            }
            item {
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    StatTile("${decisions.count { it.status == DecisionStatus.OPEN }}", "مفتوحة", Amber, Modifier.weight(1f))
                    StatTile("${decisions.count { it.status != DecisionStatus.OPEN }}", "محسومة", statusColor(DecisionStatus.DECIDED), Modifier.weight(1f))
                    StatTile(avgScore?.let { String.format(java.util.Locale.US, "%.1f", it) } ?: "—", "متوسط النتائج", Teal, Modifier.weight(1f))
                }
            }
            item {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    FilterChip(selected = filter == null, onClick = { filter = null }, label = { Text("الكل") })
                    DecisionStatus.entries.forEach { s ->
                        FilterChip(selected = filter == s, onClick = { filter = if (filter == s) null else s }, label = { Text(s.label) })
                    }
                }
            }
            if (filtered.isEmpty()) {
                item {
                    EmptyState(
                        title = if (decisions.isEmpty()) "لا قرارات بعد" else "لا شيء هنا",
                        body = if (decisions.isEmpty()) "اكتب أول معضلة تشغل بالك. سيحلّلها «قرار» ويكشف ما لا تراه، ثم يراجع معك النتيجة لاحقًا." else "جرّب تصفية أخرى.",
                        icon = Icons.Outlined.Lightbulb,
                    )
                }
            }
            items(filtered, key = { it.id }) { d -> DecisionCard(d, now) { onOpen(d.id) } }
        }
    }
}

@Composable
private fun DecisionCard(d: Decision, now: Long, onClick: () -> Unit) {
    val overdueReview = d.status == DecisionStatus.DECIDED && (d.reviewAt ?: Long.MAX_VALUE) <= now
    val overdueDeadline = d.status == DecisionStatus.OPEN && (d.deadline ?: Long.MAX_VALUE) <= now
    Card(
        onClick = onClick,
        shape = MaterialTheme.shapes.medium,
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainer),
    ) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Pill(d.status.label, statusColor(d.status))
                Pill(d.stakes.label, stakesColor(d.stakes))
                if (d.analysis != null) Pill("محلَّل", MaterialTheme.colorScheme.tertiary, icon = Icons.Outlined.AutoAwesome)
                if (overdueReview || overdueDeadline) Pill(if (overdueReview) "مراجعة مستحقة" else "تجاوز الموعد", MaterialTheme.colorScheme.error, icon = Icons.Outlined.Warning)
            }
            Text(d.title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, maxLines = 2, overflow = TextOverflow.Ellipsis)
            val summary = d.analysis?.oneLine?.takeIf { it.isNotBlank() } ?: d.context
            Text(summary, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 2, overflow = TextOverflow.Ellipsis)
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Text(
                    when (d.status) {
                        DecisionStatus.OPEN -> if (d.deadline != null) "الموعد: ${formatDate(d.deadline)}" else "${d.options.size} خيارات"
                        DecisionStatus.DECIDED -> "اخترت: ${d.chosenOption}"
                        DecisionStatus.REVIEWED -> "النتيجة: ${d.outcomeScore ?: "-"}/5"
                    },
                    style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1, overflow = TextOverflow.Ellipsis,
                )
                Text(formatDate(d.createdAt), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.outline)
            }
        }
    }
}
