package com.savageblock.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.GridView
import androidx.compose.material.icons.rounded.Home
import androidx.compose.material.icons.rounded.Person
import androidx.compose.material.icons.rounded.PieChart
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.savageblock.app.ui.theme.Blue
import com.savageblock.app.ui.theme.BlueSoft
import com.savageblock.app.ui.theme.Chip
import com.savageblock.app.ui.theme.Dark
import com.savageblock.app.ui.theme.Ink
import com.savageblock.app.ui.theme.Line
import com.savageblock.app.ui.theme.Muted
import com.savageblock.app.ui.theme.Surface

/** White rounded card with a whisper of shadow. Pass [color] for pastel tiles. */
@Composable
fun SoftCard(
    modifier: Modifier = Modifier,
    color: Color = Surface,
    radius: Dp = 24.dp,
    padding: Dp = 18.dp,
    onClick: (() -> Unit)? = null,
    content: @Composable ColumnScope.() -> Unit,
) {
    val shape = RoundedCornerShape(radius)
    Column(
        modifier
            .shadow(if (color == Surface) 1.dp else 0.dp, shape, ambientColor = Color(0x14000000), spotColor = Color(0x14000000))
            .clip(shape)
            .background(color)
            .then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier)
            .padding(padding),
        content = content,
    )
}

@Composable
fun PillButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    container: Color = Blue,
    content: Color = Surface,
    icon: ImageVector? = null,
) {
    val bg = if (enabled) container else Chip
    val fg = if (enabled) content else Muted
    Row(
        modifier
            .clip(CircleShape)
            .background(bg)
            .clickable(enabled = enabled, onClick = onClick)
            .padding(horizontal = 22.dp, vertical = 14.dp),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(text, style = MaterialTheme.typography.titleMedium, color = fg, textAlign = TextAlign.Center)
        if (icon != null) {
            Spacer(Modifier.width(8.dp))
            Icon(icon, contentDescription = null, tint = fg, modifier = Modifier.size(18.dp))
        }
    }
}

@Composable
fun CircleIconButton(
    icon: ImageVector,
    contentDescription: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    size: Dp = 44.dp,
    container: Color = Surface,
    tint: Color = Ink,
    bordered: Boolean = false,
) {
    Box(
        modifier
            .size(size)
            .clip(CircleShape)
            .background(container)
            .then(if (bordered) Modifier.border(1.dp, Line, CircleShape) else Modifier)
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Icon(icon, contentDescription = contentDescription, tint = tint, modifier = Modifier.size(size * 0.45f))
    }
}

@Composable
fun BackButton(onBack: () -> Unit) =
    CircleIconButton(Icons.AutoMirrored.Rounded.ArrowBack, "رجوع", onBack, bordered = true)

@Composable
fun StatusPill(text: String, container: Color, content: Color, modifier: Modifier = Modifier) {
    Text(
        text,
        modifier
            .clip(CircleShape)
            .background(container)
            .padding(horizontal = 12.dp, vertical = 5.dp),
        style = MaterialTheme.typography.labelMedium,
        color = content,
    )
}

/** Daily / Weekly / Monthly style selector: white track, dark selected segment. */
@Composable
fun SegmentedPill(options: List<String>, selected: Int, onSelect: (Int) -> Unit, modifier: Modifier = Modifier) {
    Row(
        modifier
            .fillMaxWidth()
            .clip(CircleShape)
            .background(Surface)
            .padding(4.dp),
    ) {
        options.forEachIndexed { index, label ->
            val active = index == selected
            Box(
                Modifier
                    .weight(1f)
                    .clip(CircleShape)
                    .background(if (active) Dark else Color.Transparent)
                    .clickable { onSelect(index) }
                    .padding(vertical = 12.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text(label, style = MaterialTheme.typography.titleSmall, color = if (active) Surface else Ink)
            }
        }
    }
}

@Composable
fun SoftChip(text: String, selected: Boolean, onClick: () -> Unit, modifier: Modifier = Modifier, enabled: Boolean = true) {
    Text(
        text,
        modifier
            .clip(CircleShape)
            .background(if (selected) Ink else Surface)
            .border(1.dp, if (selected) Ink else Line, CircleShape)
            .clickable(enabled = enabled, onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 10.dp),
        style = MaterialTheme.typography.titleSmall,
        color = if (selected) Surface else if (enabled) Ink else Muted,
    )
}

@Composable
fun SectionHeader(title: String, modifier: Modifier = Modifier, trailing: @Composable RowScope.() -> Unit = {}) {
    Row(modifier.fillMaxWidth().padding(vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(title, style = MaterialTheme.typography.titleLarge, color = Ink, modifier = Modifier.weight(1f))
        trailing()
    }
}

@Composable
fun TopBar(title: String, onBack: (() -> Unit)?, modifier: Modifier = Modifier, trailing: @Composable () -> Unit = {}) {
    Row(
        modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (onBack != null) BackButton(onBack) else Spacer(Modifier.size(44.dp))
        Text(
            title,
            Modifier.weight(1f),
            style = MaterialTheme.typography.titleLarge,
            color = Ink,
            textAlign = TextAlign.Center,
        )
        Box(Modifier.size(44.dp), contentAlignment = Alignment.Center) { trailing() }
    }
}

/** Initial-letter avatar (the design's photo circle, without needing a photo). */
@Composable
fun Avatar(name: String, size: Dp = 48.dp, modifier: Modifier = Modifier) {
    val initial = name.trim().firstOrNull()?.uppercaseChar()
    Box(
        modifier.size(size).clip(CircleShape).background(BlueSoft),
        contentAlignment = Alignment.Center,
    ) {
        if (initial != null) {
            Text(initial.toString(), style = MaterialTheme.typography.titleLarge, color = Blue)
        } else {
            Icon(Icons.Rounded.Person, contentDescription = null, tint = Blue, modifier = Modifier.size(size * 0.55f))
        }
    }
}

@Composable
fun LegendDot(color: Color, text: String) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(8.dp).clip(CircleShape).background(color))
        Spacer(Modifier.width(6.dp))
        Text(text, style = MaterialTheme.typography.bodySmall, color = Muted)
    }
}

@Composable
fun SwitchRow(
    title: String,
    subtitle: String?,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit,
    enabled: Boolean = true,
    icon: ImageVector? = null,
    iconTint: Color = Blue,
    iconContainer: Color = BlueSoft,
) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        if (icon != null) {
            Box(Modifier.size(40.dp).clip(RoundedCornerShape(12.dp)).background(iconContainer), contentAlignment = Alignment.Center) {
                Icon(icon, null, tint = iconTint, modifier = Modifier.size(20.dp))
            }
            Spacer(Modifier.width(12.dp))
        }
        Column(Modifier.weight(1f)) {
            Text(title, style = MaterialTheme.typography.titleMedium, color = Ink)
            if (subtitle != null) Text(subtitle, style = MaterialTheme.typography.bodySmall, color = Muted)
        }
        Switch(
            checked = checked,
            onCheckedChange = onCheckedChange,
            enabled = enabled,
            colors = SwitchDefaults.colors(
                checkedTrackColor = Blue,
                checkedThumbColor = Surface,
                uncheckedTrackColor = Line,
                uncheckedThumbColor = Surface,
                uncheckedBorderColor = Color.Transparent,
            ),
        )
    }
}

@Composable
fun SettingsRow(
    icon: ImageVector,
    title: String,
    subtitle: String? = null,
    iconTint: Color = Blue,
    iconContainer: Color = BlueSoft,
    onClick: () -> Unit,
    trailing: @Composable () -> Unit = {},
) {
    Row(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).clickable(onClick = onClick).padding(vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.size(40.dp).clip(RoundedCornerShape(12.dp)).background(iconContainer), contentAlignment = Alignment.Center) {
            Icon(icon, null, tint = iconTint, modifier = Modifier.size(20.dp))
        }
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(title, style = MaterialTheme.typography.titleMedium, color = Ink, maxLines = 1, overflow = TextOverflow.Ellipsis)
            if (subtitle != null) Text(subtitle, style = MaterialTheme.typography.bodySmall, color = Muted)
        }
        trailing()
    }
}

/** Rounded progress bar with a soft track. */
@Composable
fun SoftProgress(progress: Float, color: Color, modifier: Modifier = Modifier, track: Color = Line, height: Dp = 8.dp) {
    Box(modifier.fillMaxWidth().height(height).clip(CircleShape).background(track)) {
        Box(
            Modifier
                .fillMaxWidth(progress.coerceIn(0f, 1f))
                .height(height)
                .clip(CircleShape)
                .background(color),
        )
    }
}

enum class Tab(val icon: ImageVector, val label: String) {
    HOME(Icons.Rounded.Home, "الرئيسية"),
    APPS(Icons.Rounded.GridView, "التطبيقات"),
    REPORTS(Icons.Rounded.PieChart, "التقارير"),
    SETTINGS(Icons.Rounded.Person, "حسابي"),
}

/** Dark floating pill with four tabs plus the blue "+" action, as in the design. */
@Composable
fun BottomNav(selected: Tab, onSelect: (Tab) -> Unit, onAdd: () -> Unit, modifier: Modifier = Modifier) {
    Row(
        modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Row(
            Modifier
                .weight(1f)
                .height(64.dp)
                .clip(CircleShape)
                .background(Dark)
                .padding(horizontal = 8.dp),
            horizontalArrangement = Arrangement.SpaceEvenly,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Tab.entries.forEach { tab ->
                val active = tab == selected
                Box(
                    Modifier
                        .size(48.dp)
                        .clip(CircleShape)
                        .background(if (active) Surface else Color.Transparent)
                        .clickable { onSelect(tab) },
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(tab.icon, contentDescription = tab.label, tint = if (active) Dark else Surface, modifier = Modifier.size(22.dp))
                }
            }
        }
        Box(
            Modifier.size(64.dp).clip(CircleShape).background(Blue).clickable(onClick = onAdd),
            contentAlignment = Alignment.Center,
        ) {
            Icon(Icons.Rounded.Add, contentDescription = "أضف تطبيق", tint = Surface, modifier = Modifier.size(28.dp))
        }
    }
}
