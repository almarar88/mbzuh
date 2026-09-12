package com.alcode.qarar.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.outlined.AutoAwesome
import androidx.compose.material.icons.outlined.Flag
import androidx.compose.material.icons.outlined.Insights
import androidx.compose.material.icons.outlined.Lightbulb
import androidx.compose.material.icons.outlined.Psychology
import androidx.compose.material.icons.outlined.Warning
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.alcode.qarar.data.Decision
import com.alcode.qarar.data.DecisionStatus
import com.alcode.qarar.data.Insights
import com.alcode.qarar.data.Stakes
import com.alcode.qarar.ui.components.BulletList
import com.alcode.qarar.ui.components.SectionCard
import com.alcode.qarar.ui.components.StatTile
import com.alcode.qarar.ui.components.VSpace
import com.alcode.qarar.ui.components.formatDate
import com.alcode.qarar.ui.theme.Amber
import com.alcode.qarar.ui.theme.Rose
import com.alcode.qarar.ui.theme.Teal

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun InsightsScreen(
    decisions: List<Decision>,
    insights: Insights?,
    busy: Boolean,
    hasKey: Boolean,
    snackbar: SnackbarHostState,
    onBack: () -> Unit,
    onGenerate: () -> Unit,
) {
    val decided = decisions.filter { it.status != DecisionStatus.OPEN }
    val reviewed = decisions.filter { it.status == DecisionStatus.REVIEWED }
    val followed = decided.mapNotNull { it.followedRecommendation }
    val followRate = if (followed.isEmpty()) null else followed.count { it } * 100 / followed.size
    val avg = reviewed.mapNotNull { it.outcomeScore }.average().takeIf { !it.isNaN() }
    val highStakesAvg = reviewed.filter { it.stakes == Stakes.HIGH }.mapNotNull { it.outcomeScore }.average().takeIf { !it.isNaN() }
    val followedAvg = reviewed.filter { it.followedRecommendation == true }.mapNotNull { it.outcomeScore }.average().takeIf { !it.isNaN() }
    val defiedAvg = reviewed.filter { it.followedRecommendation == false }.mapNotNull { it.outcomeScore }.average().takeIf { !it.isNaN() }
    val avgConfidence = decisions.mapNotNull { it.analysis?.confidence }.average().takeIf { !it.isNaN() }
    fun f(v: Double?) = v?.let { String.format(java.util.Locale.US, "%.1f", it) } ?: "—"

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("أنماطك", fontWeight = FontWeight.Bold) },
                navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowForward, "رجوع") } },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
            )
        },
        snackbarHost = { SnackbarHost(snackbar) },
        containerColor = MaterialTheme.colorScheme.background,
    ) { padding ->
        Column(
            Modifier.fillMaxSize().padding(padding).verticalScroll(rememberScrollState()).padding(horizontal = 16.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text("كيف تقرر فعلًا — بالأرقام", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                StatTile("${decisions.size}", "إجمالي القرارات", MaterialTheme.colorScheme.tertiary, Modifier.weight(1f))
                StatTile("${reviewed.size}", "مُراجَعة", Teal, Modifier.weight(1f))
                StatTile(followRate?.let { "$it٪" } ?: "—", "التزامك بالتوصية", Amber, Modifier.weight(1f))
            }
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                StatTile(f(avg), "متوسط النتائج", Teal, Modifier.weight(1f))
                StatTile(f(highStakesAvg), "نتائج المصيرية", Rose, Modifier.weight(1f))
                StatTile(avgConfidence?.let { "${it.toInt()}٪" } ?: "—", "متوسط ثقة التحليل", Amber, Modifier.weight(1f))
            }
            if (followedAvg != null || defiedAvg != null) {
                Card(shape = MaterialTheme.shapes.medium, colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainer)) {
                    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text("حين وافقت التوصية مقابل حين خالفتها", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceAround) {
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Text(f(followedAvg), style = MaterialTheme.typography.headlineSmall, color = Teal, fontWeight = FontWeight.Bold)
                                Text("وافقت", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Text(f(defiedAvg), style = MaterialTheme.typography.headlineSmall, color = Amber, fontWeight = FontWeight.Bold)
                                Text("خالفت", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                        }
                        Text("متوسط تقييم النتيجة من 5. عيّنة صغيرة = استنتاج حذر.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }

            VSpace(4)
            Text("تحليل الأنماط بالذكاء الاصطناعي", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            if (insights == null) {
                Card(shape = MaterialTheme.shapes.medium, colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainer)) {
                    Column(Modifier.fillMaxWidth().padding(20.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        if (busy) CircularProgressIndicator(Modifier.size(28.dp), strokeWidth = 3.dp)
                        else Icon(Icons.Outlined.Insights, null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(32.dp))
                        Text(if (busy) "يقرأ «قرار» سجلّك…" else "ما الذي لا تراه في طريقة اتخاذك للقرارات؟", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center)
                        Text(
                            "يقرأ «قرار» كل قراراتك المحسومة وتوقعاتك ونتائجك، ويستخرج أنماطك المتكررة: أين تُصيب، وأين تُخطئ بنفس الطريقة كل مرة. يحتاج قرارين محسومين على الأقل (لديك ${decided.size}).",
                            style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, textAlign = TextAlign.Center,
                        )
                        Button(onClick = onGenerate, enabled = !busy && hasKey && decided.size >= 2) {
                            Icon(Icons.Outlined.AutoAwesome, null); Text(" استخرج أنماطي")
                        }
                        if (!hasKey) Text("يتطلب مفتاح API من الإعدادات", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.error)
                    }
                }
            } else {
                Card(shape = MaterialTheme.shapes.large, colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)) {
                    Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text("خلاصة", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onPrimaryContainer)
                        Text(insights.headline, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onPrimaryContainer)
                    }
                }
                SectionCard("أنماط متكررة", icon = Icons.Outlined.Insights) { BulletList(insights.patterns) }
                SectionCard("نقاط قوتك", icon = Icons.Outlined.Lightbulb, accent = Teal) { BulletList(insights.strengths, bullet = "✓", color = Teal) }
                SectionCard("تحيزاتك المتكررة", icon = Icons.Outlined.Psychology, accent = Rose) { BulletList(insights.biases, bullet = "!", color = Rose) }
                SectionCard("نصيحة واحدة للقرار القادم", icon = Icons.Outlined.Flag, accent = Amber) {
                    Text(insights.advice, style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.Medium)
                }
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    Text("بناءً على ${insights.basedOn} قرارًا · ${formatDate(insights.createdAt)}", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.outline)
                    TextButton(onClick = onGenerate, enabled = !busy && hasKey && decided.size >= 2) {
                        if (busy) CircularProgressIndicator(Modifier.size(16.dp), strokeWidth = 2.dp)
                        Text(" تحديث")
                    }
                }
            }
            VSpace(24)
        }
    }
}
