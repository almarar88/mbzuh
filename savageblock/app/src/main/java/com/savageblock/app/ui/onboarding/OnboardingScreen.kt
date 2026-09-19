package com.savageblock.app.ui.onboarding

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.KeyboardDoubleArrowLeft
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.savageblock.app.ui.components.DotIndicator
import com.savageblock.app.ui.components.Gauge
import com.savageblock.app.ui.components.MiniBars
import com.savageblock.app.ui.components.PillButton
import com.savageblock.app.ui.components.SoftCard
import com.savageblock.app.ui.components.StatusPill
import com.savageblock.app.ui.theme.Blue
import com.savageblock.app.ui.theme.BlueSoft
import com.savageblock.app.ui.theme.Canvas
import com.savageblock.app.ui.theme.Coral
import com.savageblock.app.ui.theme.CoralSoft
import com.savageblock.app.ui.theme.Dark
import com.savageblock.app.ui.theme.Green
import com.savageblock.app.ui.theme.GreenSoft
import com.savageblock.app.ui.theme.Ink
import com.savageblock.app.ui.theme.Lavender
import com.savageblock.app.ui.theme.Mint
import com.savageblock.app.ui.theme.Muted
import com.savageblock.app.ui.theme.Surface
import kotlinx.coroutines.launch

private data class Slide(val title: String, val body: String)

private val slides = listOf(
    Slide("كل وقتك الضائع\nفي مكان واحد", "سجّل استخدامك، تابع الاتجاه، وخذ قرارات أذكى عن وقتك بدون ما تكذب على نفسك."),
    Slide("حظر ما يرحم\nولا يجامل", "تعدّيت الحد؟ الشاشة تنقفل بتهزيء يناسب مستواك. ما فيه تخطي، فيه اعتراف."),
    Slide("تقارير تفضحك\nقبل غيرك", "يومي، أسبوعي، شهري. سلسلة التزام، أوقات تركيز، ووضع صارم ما تقدر تلغيه."),
)

@Composable
fun OnboardingScreen(onFinish: () -> Unit) {
    val pager = rememberPagerState(pageCount = { slides.size })
    val scope = rememberCoroutineScope()
    val last = pager.currentPage == slides.lastIndex

    Column(
        Modifier
            .fillMaxSize()
            .background(Brush.verticalGradient(listOf(BlueSoft, Canvas)))
            .systemBarsPadding(),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Column(Modifier.widthIn(max = 640.dp).fillMaxWidth().weight(1f)) {
            Row(Modifier.fillMaxWidth().padding(20.dp), verticalAlignment = Alignment.CenterVertically) {
                Spacer(Modifier.weight(1f))
                Text(
                    "تخطي",
                    Modifier
                        .clip(CircleShape)
                        .background(Surface.copy(alpha = 0.7f))
                        .clickable(onClick = onFinish)
                        .padding(horizontal = 18.dp, vertical = 10.dp),
                    style = MaterialTheme.typography.titleSmall,
                    color = Ink,
                )
            }
            HorizontalPager(state = pager, modifier = Modifier.weight(1f)) { page ->
                Column(Modifier.fillMaxSize().padding(horizontal = 24.dp).verticalScroll(rememberScrollState())) {
                    Text(slides[page].title, style = MaterialTheme.typography.headlineLarge, color = Ink)
                    Spacer(Modifier.height(10.dp))
                    Text(slides[page].body, style = MaterialTheme.typography.bodyMedium, color = Muted)
                    Spacer(Modifier.height(16.dp))
                    DotIndicator(slides.size, page)
                    Spacer(Modifier.height(24.dp))
                    PhoneFrame {
                        when (page) {
                            0 -> MockHome()
                            1 -> MockOverlay()
                            else -> MockReport()
                        }
                    }
                }
            }
        }
        Row(
            Modifier.widthIn(max = 640.dp).fillMaxWidth().padding(20.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            PillButton(
                text = if (last) "يلا نبدأ" else "التالي",
                onClick = { if (last) onFinish() else scope.launch { pager.animateScrollToPage(pager.currentPage + 1) } },
                modifier = Modifier.weight(1f),
                icon = if (last) null else Icons.Rounded.KeyboardDoubleArrowLeft,
            )
            if (!last) {
                Box(
                    Modifier
                        .weight(1f)
                        .clip(CircleShape)
                        .background(Surface)
                        .clickable(onClick = onFinish)
                        .padding(vertical = 14.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Text("تخطي", style = MaterialTheme.typography.titleMedium, color = Muted)
                }
            }
        }
    }
}

/** Rounded dark phone bezel showing a miniature of a real screen. */
@Composable
private fun PhoneFrame(content: @Composable () -> Unit) {
    Box(
        Modifier
            .fillMaxWidth()
            .height(360.dp)
            .clip(RoundedCornerShape(topStart = 40.dp, topEnd = 40.dp))
            .background(Dark)
            .padding(start = 8.dp, end = 8.dp, top = 8.dp),
    ) {
        Column(
            Modifier
                .fillMaxSize()
                .clip(RoundedCornerShape(topStart = 32.dp, topEnd = 32.dp))
                .background(Canvas)
                .padding(16.dp),
        ) {
            Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                Box(Modifier.width(70.dp).height(18.dp).clip(CircleShape).background(Dark))
            }
            Spacer(Modifier.height(12.dp))
            content()
        }
    }
}

@Composable
private fun MockHome() {
    Text("صباح الخير 👋", style = MaterialTheme.typography.bodySmall, color = Muted)
    Text("يا بطل", style = MaterialTheme.typography.titleLarge, color = Ink)
    Spacer(Modifier.height(10.dp))
    SoftCard(Modifier.fillMaxWidth(), color = BlueSoft, padding = 14.dp, radius = 18.dp) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("الوقت الضائع اليوم", style = MaterialTheme.typography.labelMedium, color = Ink, modifier = Modifier.weight(1f))
            StatusPill("ممتاز", GreenSoft, Green)
        }
        Row(verticalAlignment = Alignment.Bottom) {
            Text("١٢", style = MaterialTheme.typography.displaySmall, color = Ink)
            Spacer(Modifier.width(6.dp))
            Text("دقيقة", style = MaterialTheme.typography.bodySmall, color = Muted, modifier = Modifier.padding(bottom = 8.dp))
            Spacer(Modifier.weight(1f))
            MiniBars(listOf(0.3f, 0.7f, 1f, 0.5f, 0.8f, 0.4f, 0.6f), Modifier.width(80.dp).height(36.dp))
        }
    }
    Spacer(Modifier.height(10.dp))
    Row(Modifier.fillMaxWidth().height(90.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        SoftCard(Modifier.weight(1f).fillMaxHeight(), color = Lavender, padding = 12.dp, radius = 16.dp) {
            Text("الضربات", style = MaterialTheme.typography.labelSmall, color = Ink)
            Text("٣", style = MaterialTheme.typography.headlineSmall, color = Ink)
        }
        SoftCard(Modifier.weight(1f).fillMaxHeight(), color = Mint, padding = 12.dp, radius = 16.dp) {
            Text("السلسلة", style = MaterialTheme.typography.labelSmall, color = Ink)
            Text("٧ أيام", style = MaterialTheme.typography.headlineSmall, color = Ink)
        }
    }
}

@Composable
private fun MockOverlay() {
    StatusPill("تم ضبطك · عديم الرحمة", CoralSoft, Coral)
    Spacer(Modifier.height(8.dp))
    Text("TikTok", style = MaterialTheme.typography.titleMedium, color = Blue)
    Text("مستقبلك يضيع وأنت تطالع مقاطع تافهة؟ ارجع اشتغل.", style = MaterialTheme.typography.titleLarge, color = Ink)
    Spacer(Modifier.height(12.dp))
    SoftCard(Modifier.fillMaxWidth(), padding = 14.dp, radius = 18.dp) {
        Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
            Text("٧", style = MaterialTheme.typography.displaySmall, color = Blue)
            Text("الانتظار جزء من العقوبة.", style = MaterialTheme.typography.labelSmall, color = Muted)
        }
    }
    Spacer(Modifier.height(10.dp))
    Box(Modifier.fillMaxWidth().clip(CircleShape).background(Color(0xFFEDEFF3)).padding(vertical = 12.dp), contentAlignment = Alignment.Center) {
        Text("انتظر.. ٧", style = MaterialTheme.typography.titleSmall, color = Muted)
    }
}

@Composable
private fun MockReport() {
    Row(Modifier.fillMaxWidth().clip(CircleShape).background(Surface).padding(3.dp)) {
        listOf("يومي", "أسبوعي", "شهري").forEachIndexed { i, s ->
            Box(
                Modifier.weight(1f).clip(CircleShape).background(if (i == 1) Dark else Color.Transparent).padding(vertical = 8.dp),
                contentAlignment = Alignment.Center,
            ) { Text(s, style = MaterialTheme.typography.labelSmall, color = if (i == 1) Surface else Ink) }
        }
    }
    Spacer(Modifier.height(12.dp))
    SoftCard(Modifier.fillMaxWidth(), padding = 14.dp, radius = 18.dp) {
        Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.BottomCenter) {
            Gauge(1.6f, Modifier.fillMaxWidth(0.8f), stroke = 14.dp)
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text("٢٥٠", style = MaterialTheme.typography.headlineLarge, color = Ink)
                Text("دقيقة", style = MaterialTheme.typography.labelSmall, color = Muted)
            }
        }
    }
    Spacer(Modifier.height(10.dp))
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.Bottom) {
        listOf(0.5f, 0.9f, 0.4f, 1f, 0.6f).forEachIndexed { i, f ->
            Box(
                Modifier
                    .weight(1f)
                    .height((50 * f).dp + 10.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .background(if (i == 3) Dark else Color(0xFFE3E5EA))
                    .border(1.dp, if (i == 3) Dark else Muted.copy(alpha = 0.3f), RoundedCornerShape(8.dp)),
            )
        }
    }
}
