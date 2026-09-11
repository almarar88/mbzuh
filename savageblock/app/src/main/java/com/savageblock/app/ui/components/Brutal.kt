package com.savageblock.app.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.absoluteOffset
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.savageblock.app.ui.theme.Acid
import com.savageblock.app.ui.theme.Ash
import com.savageblock.app.ui.theme.Bone
import com.savageblock.app.ui.theme.Concrete
import com.savageblock.app.ui.theme.Crimson
import com.savageblock.app.ui.theme.Steel
import com.savageblock.app.ui.theme.Void

/** Hard-edged card with a thick border and a solid offset "shadow" block. */
@Composable
fun BrutalCard(
    modifier: Modifier = Modifier,
    borderColor: Color = Bone,
    background: Color = Steel,
    shadowColor: Color = Crimson,
    shadowOffset: Dp = 6.dp,
    contentPadding: Dp = 16.dp,
    content: @Composable ColumnScope.() -> Unit,
) {
    Box(modifier.padding(PaddingValues.Absolute(right = shadowOffset, bottom = shadowOffset))) {
        Box(
            Modifier
                .matchParentSize()
                .absoluteOffset(x = shadowOffset, y = shadowOffset)
                .background(shadowColor),
        )
        Column(
            Modifier
                .fillMaxWidth()
                .border(3.dp, borderColor)
                .background(background)
                .padding(contentPadding),
            content = content,
        )
    }
}

@Composable
fun BrutalButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    container: Color = Crimson,
    content: Color = Bone,
) {
    val bg = if (enabled) container else Concrete
    val fg = if (enabled) content else Ash
    Box(
        modifier
            .border(3.dp, if (enabled) Bone else Ash)
            .background(bg)
            .clickable(enabled = enabled, onClick = onClick)
            .padding(horizontal = 20.dp, vertical = 16.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = text,
            style = MaterialTheme.typography.titleMedium,
            color = fg,
            textAlign = TextAlign.Center,
        )
    }
}

@Composable
fun BrutalChip(
    text: String,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier
            .border(2.dp, if (selected) Acid else Bone)
            .background(if (selected) Acid else Void)
            .clickable(onClick = onClick)
            .padding(horizontal = 14.dp, vertical = 10.dp),
    ) {
        Text(
            text = text,
            style = MaterialTheme.typography.titleSmall,
            color = if (selected) Void else Bone,
        )
    }
}

@Composable
fun SectionTitle(text: String, modifier: Modifier = Modifier, accent: Color = Crimson) {
    Row(modifier.padding(top = 8.dp, bottom = 12.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(12.dp).background(accent))
        Spacer(Modifier.width(10.dp))
        Text(text, style = MaterialTheme.typography.labelLarge, color = Bone)
    }
}

/** Blocky progress bar: filled portion in [color], remaining in [Concrete]. */
@Composable
fun BrutalProgress(progress: Float, modifier: Modifier = Modifier, color: Color = Acid) {
    val clamped = progress.coerceIn(0f, 1f)
    Canvas(modifier.fillMaxWidth().height(10.dp).border(2.dp, Bone)) {
        drawRect(Concrete)
        // Fill from the right edge because the UI is RTL.
        val w = size.width * clamped
        drawRect(color, topLeft = androidx.compose.ui.geometry.Offset(size.width - w, 0f), size = androidx.compose.ui.geometry.Size(w, size.height))
    }
}

/** Diagonal hazard tape used as a divider in the overlay and dashboard header. */
@Composable
fun HazardStripes(
    modifier: Modifier = Modifier.fillMaxWidth().height(12.dp),
    colorA: Color = Acid,
    colorB: Color = Void,
) {
    Canvas(modifier) {
        drawRect(colorB)
        val stripe = 18.dp.toPx()
        val h = size.height
        var x = -h
        while (x < size.width + h) {
            val path = Path().apply {
                moveTo(x, h)
                lineTo(x + h, 0f)
                lineTo(x + h + stripe / 2f, 0f)
                lineTo(x + stripe / 2f, h)
                close()
            }
            drawPath(path, colorA)
            x += stripe
        }
    }
}
