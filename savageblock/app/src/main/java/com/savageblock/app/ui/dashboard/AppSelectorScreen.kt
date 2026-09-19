package com.savageblock.app.ui.dashboard

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextField
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.savageblock.app.data.InstalledApp
import com.savageblock.app.data.InstalledApps
import com.savageblock.app.data.toArabicDigits
import com.savageblock.app.ui.components.PillButton
import com.savageblock.app.ui.components.TopBar
import com.savageblock.app.ui.settings.softFieldColors
import com.savageblock.app.ui.theme.Blue
import com.savageblock.app.ui.theme.BlueSoft
import com.savageblock.app.ui.theme.Canvas
import com.savageblock.app.ui.theme.Chip
import com.savageblock.app.ui.theme.Ink
import com.savageblock.app.ui.theme.Line
import com.savageblock.app.ui.theme.Muted
import com.savageblock.app.ui.theme.Surface

@Composable
fun AppSelectorScreen(
    apps: List<InstalledApp>?,
    selected: Set<String>,
    strict: Boolean,
    onToggle: (InstalledApp) -> Unit,
    onBack: () -> Unit,
) {
    var query by remember { mutableStateOf("") }
    val filtered = remember(apps, query) {
        val q = query.trim()
        apps.orEmpty().filter { q.isEmpty() || it.label.contains(q, ignoreCase = true) || it.packageName.contains(q, ignoreCase = true) }
    }

    Column(Modifier.fillMaxSize().background(Canvas).statusBarsPadding()) {
        TopBar("قائمة المراقبة", onBack = onBack) {
            PillButton("تم", onBack, modifier = Modifier)
        }
        Column(Modifier.padding(horizontal = 20.dp)) {
            Text("${selected.size.toArabicDigits()} تطبيق تحت المراقبة", style = MaterialTheme.typography.bodyMedium, color = Muted)
            Spacer(Modifier.padding(6.dp))
            TextField(
                value = query,
                onValueChange = { query = it },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                placeholder = { Text("ابحث عن تطبيق..", color = Muted) },
                leadingIcon = { Icon(Icons.Rounded.Search, null, tint = Muted) },
                shape = RoundedCornerShape(16.dp),
                colors = softFieldColors(),
            )
            if (strict) {
                Spacer(Modifier.padding(4.dp))
                Text("الوضع الصارم: تقدر تضيف تطبيقات بس ما تقدر تشيل.", style = MaterialTheme.typography.bodySmall, color = Muted)
            }
        }

        if (apps == null) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text("أجمع التطبيقات..", style = MaterialTheme.typography.titleMedium, color = Muted)
            }
            return
        }

        LazyVerticalGrid(
            columns = GridCells.Adaptive(minSize = 340.dp),
            contentPadding = PaddingValues(horizontal = 20.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            items(filtered, key = { it.packageName }) { app ->
                val isSelected = app.packageName in selected
                AppRow(app = app, selected = isSelected, enabled = !(strict && isSelected), onClick = { onToggle(app) })
            }
        }
    }
}

@Composable
private fun AppRow(app: InstalledApp, selected: Boolean, enabled: Boolean, onClick: () -> Unit) {
    Row(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(18.dp))
            .background(if (selected) BlueSoft else Surface)
            .clickable(enabled = enabled, onClick = onClick)
            .padding(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        AppIcon(app.packageName, size = 40.dp)
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(app.label, style = MaterialTheme.typography.titleMedium, color = Ink, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(app.packageName, style = MaterialTheme.typography.bodySmall, color = Muted, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        Spacer(Modifier.width(12.dp))
        Box(
            Modifier
                .size(26.dp)
                .clip(CircleShape)
                .background(if (selected) Blue else Line),
            contentAlignment = Alignment.Center,
        ) {
            if (selected) Icon(Icons.Rounded.Check, null, tint = Surface, modifier = Modifier.size(16.dp))
        }
    }
}

@Composable
fun AppIcon(packageName: String, size: Dp) {
    val context = LocalContext.current
    var icon by remember(packageName) { mutableStateOf<ImageBitmap?>(null) }
    LaunchedEffect(packageName) { icon = InstalledApps.icon(context, packageName) }
    Box(Modifier.size(size).clip(RoundedCornerShape(12.dp)).background(Chip), contentAlignment = Alignment.Center) {
        icon?.let { Image(bitmap = it, contentDescription = null, modifier = Modifier.size(size)) }
    }
}
