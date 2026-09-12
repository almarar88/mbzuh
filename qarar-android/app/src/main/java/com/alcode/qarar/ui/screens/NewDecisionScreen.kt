package com.alcode.qarar.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.Event
import androidx.compose.material3.Button
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.alcode.qarar.data.Decision
import com.alcode.qarar.data.Stakes
import com.alcode.qarar.ui.components.formatDate
import com.alcode.qarar.ui.components.stakesColor

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NewDecisionScreen(onBack: () -> Unit, onSave: (Decision) -> Unit) {
    var title by remember { mutableStateOf("") }
    var context by remember { mutableStateOf("") }
    val options = remember { mutableStateListOf("", "") }
    var stakes by remember { mutableStateOf(Stakes.MEDIUM) }
    var deadline by remember { mutableStateOf<Long?>(null) }
    var showPicker by remember { mutableStateOf(false) }
    var attempted by remember { mutableStateOf(false) }

    val cleanOptions = options.map { it.trim() }.filter { it.isNotBlank() }
    val valid = title.isNotBlank() && context.trim().length >= 10 && cleanOptions.size >= 2

    if (showPicker) {
        val state = rememberDatePickerState(initialSelectedDateMillis = deadline)
        DatePickerDialog(
            onDismissRequest = { showPicker = false },
            confirmButton = { TextButton(onClick = { deadline = state.selectedDateMillis; showPicker = false }) { Text("موافق") } },
            dismissButton = { TextButton(onClick = { showPicker = false }) { Text("إلغاء") } },
        ) { DatePicker(state = state) }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("قرار جديد", fontWeight = FontWeight.Bold) },
                navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowForward, "رجوع") } },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
            )
        },
        containerColor = MaterialTheme.colorScheme.background,
    ) { padding ->
        Column(
            Modifier.fillMaxSize().padding(padding).verticalScroll(rememberScrollState()).imePadding()
                .padding(horizontal = 16.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Text(
                "كلما كان السياق أصدق وأكثر تفصيلًا، كان التحليل أدق. اكتب ما يقلقك فعلًا، لا النسخة المهذّبة.",
                style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            OutlinedTextField(
                value = title, onValueChange = { title = it },
                label = { Text("ما القرار؟") },
                placeholder = { Text("مثال: هل أقبل عرض العمل في الرياض؟") },
                singleLine = true, modifier = Modifier.fillMaxWidth(),
                isError = attempted && title.isBlank(),
            )
            OutlinedTextField(
                value = context, onValueChange = { context = it },
                label = { Text("السياق") },
                placeholder = { Text("الوضع الحالي، ما يهمّك، القيود، ما تخشاه، ما تأمله…") },
                modifier = Modifier.fillMaxWidth().height(170.dp),
                isError = attempted && context.trim().length < 10,
                supportingText = { Text("${context.trim().length} حرفًا") },
            )

            Text("الخيارات المطروحة", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
            options.forEachIndexed { i, value ->
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    OutlinedTextField(
                        value = value, onValueChange = { options[i] = it },
                        label = { Text("الخيار ${i + 1}") },
                        singleLine = true, modifier = Modifier.weight(1f),
                        isError = attempted && cleanOptions.size < 2 && value.isBlank(),
                    )
                    if (options.size > 2) IconButton(onClick = { options.removeAt(i) }) { Icon(Icons.Outlined.Close, "حذف") }
                }
            }
            if (options.size < 6) {
                OutlinedButton(onClick = { options.add("") }) {
                    Icon(Icons.Default.Add, null); Text(" إضافة خيار")
                }
            }

            Text("درجة الأهمية", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Stakes.entries.forEach { s ->
                    FilterChip(
                        selected = stakes == s, onClick = { stakes = s },
                        label = { Text(s.label) },
                        leadingIcon = if (stakes == s) ({ Icon(Icons.Outlined.Event, null, tint = stakesColor(s)) }) else null,
                    )
                }
            }
            Text(
                when (stakes) {
                    Stakes.LOW -> "قرار يمكن التراجع عنه بسهولة. لا تُطل التفكير."
                    Stakes.MEDIUM -> "قرار مؤثر لكنه قابل للتصحيح."
                    Stakes.HIGH -> "قرار يصعب الرجوع عنه. سيُشدَّد التحليل على المخاطر التي لا رجعة فيها."
                },
                style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant,
            )

            Text("الموعد النهائي (اختياري)", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(onClick = { showPicker = true }) {
                    Icon(Icons.Outlined.Event, null); Text(" " + (deadline?.let { formatDate(it) } ?: "اختر تاريخًا"))
                }
                if (deadline != null) TextButton(onClick = { deadline = null }) { Text("إزالة") }
            }

            Button(
                onClick = {
                    attempted = true
                    if (valid) onSave(Decision(title = title.trim(), context = context.trim(), options = cleanOptions, stakes = stakes, deadline = deadline))
                },
                modifier = Modifier.fillMaxWidth().height(52.dp),
            ) { Text("حفظ القرار", style = MaterialTheme.typography.titleMedium) }
            if (attempted && !valid) {
                Text("أكمل العنوان والسياق (10 أحرف على الأقل) وخيارين على الأقل.", color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
            }
            Text(" ", modifier = Modifier.height(24.dp))
        }
    }
}
