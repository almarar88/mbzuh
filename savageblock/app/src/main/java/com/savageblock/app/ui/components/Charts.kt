package com.savageblock.app.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.RoundRect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.clipPath
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import com.savageblock.app.ui.theme.Blue
import com.savageblock.app.ui.theme.Coral
import com.savageblock.app.ui.theme.Dark
import com.savageblock.app.ui.theme.Ink
import com.savageblock.app.ui.theme.Line
import com.savageblock.app.ui.theme.Muted
import com.savageblock.app.ui.theme.Sun
import com.savageblock.app.ui.theme.Surface
import kotlin.math.cos
import kotlin.math.sin

/** Charts read left→right regardless of the RTL UI, like the reference design. */
@Composable
fun Ltr(content: @Composable () -> Unit) {
    CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr, content = content)
}

/** Vertically-centred stubby bars alternating two colours: the "pulse" next to the big number. */
@Composable
fun MiniBars(values: List<Float>, modifier: Modifier = Modifier, colors: List<Color> = listOf(Coral, Dark)) {
    Canvas(modifier) {
        if (values.isEmpty()) return@Canvas
        val slot = size.width / values.size
        val barW = (slot * 0.45f).coerceAtMost(6.dp.toPx())
        val maxV = values.maxOrNull()?.takeIf { it > 0f } ?: 1f
        values.forEachIndexed { i, v ->
            val h = (size.height * (0.25f + 0.75f * (v / maxV)))
            val x = i * slot + (slot - barW) / 2f
            drawRoundRect(
                colors[i % colors.size],
                topLeft = Offset(x, (size.height - h) / 2f),
                size = Size(barW, h),
                cornerRadius = CornerRadius(barW / 2f),
            )
        }
    }
}

/** Smooth filled curve used in the pastel tiles. */
@Composable
fun AreaSparkline(values: List<Float>, color: Color, modifier: Modifier = Modifier) {
    Canvas(modifier) {
        if (values.size < 2) return@Canvas
        val maxV = values.maxOrNull()?.takeIf { it > 0f } ?: 1f
        val stepX = size.width / (values.size - 1)
        val pts = values.mapIndexed { i, v -> Offset(i * stepX, size.height * (1f - 0.85f * (v / maxV)) ) }
        val line = Path().apply {
            moveTo(pts.first().x, pts.first().y)
            for (i in 1 until pts.size) {
                val p0 = pts[i - 1]
                val p1 = pts[i]
                val cx = (p0.x + p1.x) / 2f
                cubicTo(cx, p0.y, cx, p1.y, p1.x, p1.y)
            }
        }
        val area = Path().apply {
            addPath(line)
            lineTo(pts.last().x, size.height)
            lineTo(pts.first().x, size.height)
            close()
        }
        drawPath(area, color.copy(alpha = 0.35f))
        drawPath(line, color, style = Stroke(width = 2.5.dp.toPx(), cap = StrokeCap.Round))
    }
}

/**
 * Semi-circular gauge: blue (within limit), yellow (over), red (far over) with a marker on the
 * current position. [ratio] is minutes / limit, clamped to 0..2.
 */
@Composable
fun Gauge(ratio: Float, modifier: Modifier = Modifier, stroke: Dp = 22.dp) {
    Canvas(modifier.aspectRatio(2f)) {
        val strokePx = stroke.toPx()
        val inset = strokePx / 2f + 6.dp.toPx()
        val arcSize = Size(size.width - inset * 2, (size.width - inset * 2))
        val topLeft = Offset(inset, inset)
        val gap = 4f
        // Ratio 0..2 maps onto 180°. Segments: 0..1 blue (90°), 1..1.5 yellow (45°), 1.5..2 red (45°).
        val segments = listOf(Triple(180f, 90f, Blue), Triple(270f, 45f, Sun), Triple(315f, 45f, Coral))
        segments.forEach { (start, sweep, color) ->
            drawArc(
                color = color,
                startAngle = start + gap / 2f,
                sweepAngle = sweep - gap,
                useCenter = false,
                topLeft = topLeft,
                size = arcSize,
                style = Stroke(strokePx, cap = StrokeCap.Round),
            )
        }
        val clamped = ratio.coerceIn(0f, 2f)
        val angle = Math.toRadians((180f + clamped / 2f * 180f).toDouble())
        val r = arcSize.width / 2f
        val center = Offset(topLeft.x + r, topLeft.y + r)
        val marker = Offset(center.x + (r * cos(angle)).toFloat(), center.y + (r * sin(angle)).toFloat())
        drawCircle(Surface, radius = strokePx * 0.55f, center = marker)
        drawCircle(Coral, radius = strokePx * 0.55f, center = marker, style = Stroke(3.dp.toPx()))
    }
}

data class Bar(val label: String, val value: Float, val highlight: Boolean = false, val pill: String? = null)

/** Dot-patterned bars with one solid dark highlight carrying a pill label, as in the design. */
@Composable
fun PatternBarChart(bars: List<Bar>, modifier: Modifier = Modifier, height: Dp = 160.dp) {
    val maxV = bars.maxOfOrNull { it.value }?.takeIf { it > 0f } ?: 1f
    Ltr {
        Row(modifier.fillMaxWidth().height(height + 52.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            bars.forEach { bar ->
                Column(Modifier.weight(1f).fillMaxHeight(), horizontalAlignment = Alignment.CenterHorizontally) {
                    Box(Modifier.height(24.dp), contentAlignment = Alignment.Center) {
                        if (bar.pill != null) {
                            StatusPill(bar.pill, com.savageblock.app.ui.theme.GreenSoft, com.savageblock.app.ui.theme.Green)
                        }
                    }
                    Spacer(Modifier.height(4.dp))
                    Box(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.BottomCenter) {
                        val frac = (bar.value / maxV).coerceIn(0.06f, 1f)
                        Canvas(Modifier.fillMaxWidth(0.8f).fillMaxHeight(frac)) {
                            val radius = 10.dp.toPx()
                            val rect = Rect(0f, 0f, size.width, size.height)
                            if (bar.highlight) {
                                drawRoundRect(Dark, cornerRadius = CornerRadius(radius))
                                drawCircle(Surface, radius = 3.dp.toPx(), center = Offset(size.width / 2f, 10.dp.toPx()))
                            } else {
                                val path = Path().apply { addRoundRect(RoundRect(rect, CornerRadius(radius))) }
                                clipPath(path) {
                                    drawRect(Color(0xFFF7F7F9))
                                    val step = 5.dp.toPx()
                                    var y = step / 2f
                                    var rowIndex = 0
                                    while (y < size.height) {
                                        var x = if (rowIndex % 2 == 0) step / 2f else step
                                        while (x < size.width) {
                                            drawCircle(Ink, radius = 1.2.dp.toPx(), center = Offset(x, y))
                                            x += step
                                        }
                                        y += step
                                        rowIndex++
                                    }
                                }
                            }
                        }
                    }
                    Spacer(Modifier.height(8.dp))
                    Text(bar.label, style = MaterialTheme.typography.labelSmall, color = Muted, maxLines = 1, textAlign = TextAlign.Center)
                }
            }
        }
    }
}

/** Line chart with dashed guide line for the limit and a dot on the last point. */
@Composable
fun LineChart(values: List<Float>, limit: Float, labels: List<String>, modifier: Modifier = Modifier, height: Dp = 120.dp) {
    Ltr {
        Column(modifier.fillMaxWidth()) {
            Canvas(Modifier.fillMaxWidth().height(height)) {
                if (values.size < 2) return@Canvas
                val maxV = maxOf(values.maxOrNull() ?: 0f, limit, 1f) * 1.15f
                val padTop = 8.dp.toPx()
                val usable = size.height - padTop
                val stepX = size.width / (values.size - 1)
                fun y(v: Float) = padTop + usable * (1f - v / maxV)
                if (limit > 0f) {
                    drawLine(
                        Coral.copy(alpha = 0.6f), Offset(0f, y(limit)), Offset(size.width, y(limit)),
                        strokeWidth = 1.5.dp.toPx(),
                        pathEffect = PathEffect.dashPathEffect(floatArrayOf(10f, 8f)),
                    )
                }
                val pts = values.mapIndexed { i, v -> Offset(i * stepX, y(v)) }
                val path = Path().apply {
                    moveTo(pts.first().x, pts.first().y)
                    for (i in 1 until pts.size) {
                        val p0 = pts[i - 1]
                        val p1 = pts[i]
                        val cx = (p0.x + p1.x) / 2f
                        cubicTo(cx, p0.y, cx, p1.y, p1.x, p1.y)
                    }
                }
                val fill = Path().apply {
                    addPath(path)
                    lineTo(pts.last().x, size.height)
                    lineTo(pts.first().x, size.height)
                    close()
                }
                drawPath(fill, Blue.copy(alpha = 0.10f))
                drawPath(path, Blue, style = Stroke(2.5.dp.toPx(), cap = StrokeCap.Round))
                pts.forEachIndexed { i, p ->
                    drawCircle(Line, radius = 1f, center = p)
                    if (i == pts.lastIndex) {
                        drawCircle(Surface, radius = 6.dp.toPx(), center = p)
                        drawCircle(Blue, radius = 6.dp.toPx(), center = p, style = Stroke(3.dp.toPx()))
                    }
                }
            }
            Spacer(Modifier.height(6.dp))
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                labels.forEach { Text(it, style = MaterialTheme.typography.labelSmall, color = Muted) }
            }
        }
    }
}

/** Page indicator: small dots with an elongated active pill. */
@Composable
fun DotIndicator(count: Int, index: Int, modifier: Modifier = Modifier) {
    Row(modifier, horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
        repeat(count) { i ->
            val active = i == index
            Box(
                Modifier
                    .height(6.dp)
                    .width(if (active) 28.dp else 6.dp)
                    .clip(CircleShape)
                    .background(if (active) Blue else Line),
            )
        }
    }
}

/** A little bar-glyph icon pair used inside tiles (decorative). */
@Composable
fun TileIcon(container: Color, content: @Composable () -> Unit) {
    Box(Modifier.size(32.dp).clip(CircleShape).background(container), contentAlignment = Alignment.Center) { content() }
}
