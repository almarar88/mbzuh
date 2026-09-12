package com.alcode.qarar.ui.screens

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.clickable
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
import androidx.compose.material.icons.outlined.Key
import androidx.compose.material.icons.outlined.OpenInNew
import androidx.compose.material.icons.outlined.Psychology
import androidx.compose.material.icons.outlined.Shield
import androidx.compose.material.icons.outlined.Visibility
import androidx.compose.material.icons.outlined.VisibilityOff
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
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
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import com.alcode.qarar.data.AiModel
import com.alcode.qarar.data.AppSettings
import com.alcode.qarar.ui.components.SectionCard
import com.alcode.qarar.ui.components.VSpace
import com.alcode.qarar.ui.theme.Teal

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    settings: AppSettings,
    pingResult: String?,
    pinging: Boolean,
    snackbar: SnackbarHostState,
    onBack: () -> Unit,
    onUpdate: ((AppSettings) -> AppSettings) -> Unit,
    onPing: () -> Unit,
) {
    val ctx = LocalContext.current
    var key by remember(settings.apiKey) { mutableStateOf(settings.apiKey) }
    var showKey by remember { mutableStateOf(false) }
    val dirty = key.trim() != settings.apiKey

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("الإعدادات", fontWeight = FontWeight.Bold) },
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
            SectionCard("مفتاح Claude API", icon = Icons.Outlined.Key) {
                Text(
                    "يعمل «قرار» بنموذج Claude من Anthropic عبر مفتاحك الخاص. تُرسل نصوص القرار إلى Anthropic فقط حين تطلب تحليلًا، ولا تمر عبر أي خادم وسيط.",
                    style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                OutlinedTextField(
                    value = key, onValueChange = { key = it },
                    label = { Text("sk-ant-…") }, singleLine = true, modifier = Modifier.fillMaxWidth(),
                    visualTransformation = if (showKey) VisualTransformation.None else PasswordVisualTransformation(),
                    trailingIcon = {
                        IconButton(onClick = { showKey = !showKey }) {
                            Icon(if (showKey) Icons.Outlined.VisibilityOff else Icons.Outlined.Visibility, null)
                        }
                    },
                )
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    Button(onClick = { onUpdate { it.copy(apiKey = key.trim()) } }, enabled = dirty) { Text("حفظ") }
                    OutlinedButton(onClick = onPing, enabled = settings.hasKey && !dirty && !pinging) {
                        if (pinging) CircularProgressIndicator(Modifier.size(16.dp), strokeWidth = 2.dp) else Text("اختبار الاتصال")
                    }
                }
                if (pingResult != null) {
                    Text(pingResult, style = MaterialTheme.typography.bodySmall, color = if (pingResult.startsWith("✓")) Teal else MaterialTheme.colorScheme.error)
                }
                OutlinedButton(onClick = {
                    runCatching { ctx.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://console.anthropic.com/settings/keys"))) }
                }) { Icon(Icons.Outlined.OpenInNew, null, Modifier.size(16.dp)); Text(" احصل على مفتاح من console.anthropic.com") }
            }

            SectionCard("النموذج", icon = Icons.Outlined.Psychology) {
                AiModel.ALL.forEach { m ->
                    Row(Modifier.fillMaxWidth().clickable { onUpdate { it.copy(modelId = m.id) } }, verticalAlignment = Alignment.CenterVertically) {
                        RadioButton(selected = settings.modelId == m.id, onClick = { onUpdate { it.copy(modelId = m.id) } })
                        Column {
                            Text(m.label, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium)
                            Text(m.hint, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                }
                if (!settings.modelId.startsWith("claude-haiku")) {
                    VSpace(4)
                    Text("عمق التفكير", style = MaterialTheme.typography.labelLarge)
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        listOf("low" to "سريع", "medium" to "متوسط", "high" to "عميق", "xhigh" to "أعمق").forEach { (v, l) ->
                            FilterChip(selected = settings.effort == v, onClick = { onUpdate { it.copy(effort = v) } }, label = { Text(l) })
                        }
                    }
                    Text("الأعمق أدق لكنه أبطأ وأغلى. «عميق» مناسب لمعظم القرارات.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }

            SectionCard("الخصوصية", icon = Icons.Outlined.Shield, accent = Teal) {
                Text(
                    "كل قراراتك محفوظة على جهازك فقط. لا حسابات، لا تتبّع، لا خادم لنا. المفتاح يُخزَّن في التخزين الخاص بالتطبيق ويُستثنى من النسخ الاحتياطي السحابي.",
                    style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            Text("قرار · الإصدار 1.0.0 · تطوير Alcode", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.outline, modifier = Modifier.padding(top = 8.dp))
            VSpace(24)
        }
    }
}
