package com.savageblock.app.ui.dashboard

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.savageblock.app.data.InstalledApp
import com.savageblock.app.data.InstalledApps
import com.savageblock.app.data.toArabicDigits
import com.savageblock.app.ui.components.BrutalButton
import com.savageblock.app.ui.theme.Acid
import com.savageblock.app.ui.theme.Ash
import com.savageblock.app.ui.theme.Bone
import com.savageblock.app.ui.theme.Concrete
import com.savageblock.app.ui.theme.Steel
import com.savageblock.app.ui.theme.Void

@Composable
fun AppSelectorScreen(
    apps: List<InstalledApp>?,
    selected: Set<String>,
    onToggle: (InstalledApp) -> Unit,
    onBack: () -> Unit,
) {
    var query by remember { mutableStateOf("") }
    val filtered = remember(apps, query) {
        val q = query.trim()
        apps.orEmpty().filter { q.isEmpty() || it.label.contains(q, ignoreCase = true) || it.packageName.contains(q, ignoreCase = true) }
    }

    Column(Modifier.fillMaxSize().background(Void).systemBarsPadding()) {
        Column(Modifier.padding(horizontal = 20.dp, vertical = 16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text("قائمة المراقبة", style = MaterialTheme.typography.headlineMedium, color = Bone)
                    Text(
                        "${selected.size.toArabicDigits()} تطبيق تحت المراقبة",
                        style = MaterialTheme.typography.labelMedium,
                        color = Acid,
                    )
                }
                BrutalButton(text = "تم", onClick = onBack, container = Acid, content = Void)
            }
            Spacer(Modifier.height(14.dp))
            OutlinedTextField(
                value = query,
                onValueChange = { query = it },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                placeholder = { Text("ابحث عن تطبيق..", color = Ash) },
                textStyle = MaterialTheme.typography.bodyLarge,
                colors = OutlinedTextFieldDefaults.colors(
                    focusedTextColor = Bone,
                    unfocusedTextColor = Bone,
                    cursorColor = Acid,
                    focusedBorderColor = Acid,
                    unfocusedBorderColor = Bone,
                    focusedContainerColor = Steel,
                    unfocusedContainerColor = Steel,
                ),
            )
        }

        if (apps == null) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text("أجمع التطبيقات..", style = MaterialTheme.typography.titleMedium, color = Ash)
            }
            return
        }

        // Adaptive grid: one column on a phone / folded cover screen, two or more when unfolded.
        LazyVerticalGrid(
            columns = GridCells.Adaptive(minSize = 340.dp),
            contentPadding = PaddingValues(horizontal = 20.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            items(filtered, key = { it.packageName }) { app ->
                val isSelected = app.packageName in selected
                AppRow(app = app, selected = isSelected, onClick = { onToggle(app) })
            }
        }
    }
}

@Composable
private fun AppRow(app: InstalledApp, selected: Boolean, onClick: () -> Unit) {
    Row(
        Modifier
            .fillMaxWidth()
            .border(2.dp, if (selected) Acid else Concrete)
            .background(if (selected) Steel else Void)
            .clickable(onClick = onClick)
            .padding(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        AppIcon(app.packageName, size = 40.dp)
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(app.label, style = MaterialTheme.typography.titleMedium, color = Bone, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(app.packageName, style = MaterialTheme.typography.bodySmall, color = Ash, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        Spacer(Modifier.width(12.dp))
        Box(
            Modifier
                .size(26.dp)
                .border(3.dp, if (selected) Acid else Bone)
                .background(if (selected) Acid else Void),
            contentAlignment = Alignment.Center,
        ) {
            if (selected) Text("✕", style = MaterialTheme.typography.titleMedium, color = Void)
        }
    }
}

@Composable
fun AppIcon(packageName: String, size: androidx.compose.ui.unit.Dp) {
    val context = LocalContext.current
    var icon by remember(packageName) { mutableStateOf<ImageBitmap?>(null) }
    LaunchedEffect(packageName) { icon = InstalledApps.icon(context, packageName) }
    Box(Modifier.size(size).background(Concrete), contentAlignment = Alignment.Center) {
        icon?.let { Image(bitmap = it, contentDescription = null, modifier = Modifier.size(size)) }
    }
}
