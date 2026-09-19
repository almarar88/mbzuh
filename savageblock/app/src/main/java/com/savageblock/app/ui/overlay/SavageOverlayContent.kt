package com.savageblock.app.ui.overlay

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.savageblock.app.data.CONFESSION_PHRASE
import com.savageblock.app.data.Roasts
import com.savageblock.app.data.toArabicDigits
import com.savageblock.app.service.OverlaySession
import com.savageblock.app.ui.components.PillButton
import com.savageblock.app.ui.components.SoftCard
import com.savageblock.app.ui.components.StatusPill
import com.savageblock.app.ui.theme.Blue
import com.savageblock.app.ui.theme.Canvas
import com.savageblock.app.ui.theme.Chip
import com.savageblock.app.ui.theme.Coral
import com.savageblock.app.ui.theme.CoralSoft
import com.savageblock.app.ui.theme.Ink
import com.savageblock.app.ui.theme.Lavender
import com.savageblock.app.ui.theme.Mint
import com.savageblock.app.ui.theme.Muted
import com.savageblock.app.ui.theme.Peach
import kotlinx.coroutines.delay

/**
 * The full-screen strike. A mandatory countdown gates the exit button; in Savage mode the
 * user must additionally type the confession phrase before the button unlocks.
 */
@Composable
fun SavageOverlayContent(session: OverlaySession, onLeave: () -> Unit) {
    var remaining by remember(session.id) { mutableIntStateOf(session.level.countdownSeconds) }
    var confession by remember(session.id) { mutableStateOf("") }
    val hint = remember(session.id) { Roasts.countdownHints.random() }

    LaunchedEffect(session.id) {
        while (remaining > 0) {
            delay(1_000)
            remaining -= 1
        }
    }

    val confessed = confession.normalizeArabic() == CONFESSION_PHRASE.normalizeArabic()
    val needsConfession = session.level.requiresConfession
    val canLeave = remaining == 0 && (!needsConfession || confessed)

    val blink by rememberInfiniteTransition(label = "blink").animateFloat(
        initialValue = 1f,
        targetValue = 0.2f,
        animationSpec = infiniteRepeatable(tween(500), RepeatMode.Reverse),
        label = "blinkAlpha",
    )

    Column(
        Modifier
            .fillMaxSize()
            .background(Canvas)
            .systemBarsPadding()
            .imePadding()
            .verticalScroll(rememberScrollState()),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Column(
            Modifier
                .widthIn(max = 640.dp)
                .fillMaxWidth()
                .padding(20.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(12.dp).alpha(blink).clip(CircleShape).background(Coral))
                Spacer(Modifier.width(10.dp))
                StatusPill("تم ضبطك · ${session.level.title}", CoralSoft, Coral)
            }
            Spacer(Modifier.height(18.dp))
            Text(session.appLabel, style = MaterialTheme.typography.headlineMedium, color = Blue)
            Spacer(Modifier.height(10.dp))
            Text(session.roast, style = MaterialTheme.typography.displaySmall, color = Ink)

            Spacer(Modifier.height(22.dp))
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Stat("دقيقة اليوم", session.wastedMinutes.toArabicDigits(), Lavender, Modifier.weight(1f))
                Stat("الحد المسموح", session.limitMinutes.toArabicDigits(), Mint, Modifier.weight(1f))
                Stat("ضربة اليوم", session.strikesToday.toArabicDigits(), Peach, Modifier.weight(1f))
            }

            Spacer(Modifier.height(26.dp))
            SoftCard(Modifier.fillMaxWidth(), padding = 22.dp) {
                if (remaining > 0) {
                    Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(remaining.toArabicDigits(), style = MaterialTheme.typography.displayLarge, color = Blue)
                        Text(hint, style = MaterialTheme.typography.bodyMedium, color = Muted, textAlign = TextAlign.Center)
                    }
                } else if (needsConfession) {
                    Text("اكتب الاعتراف عشان تطلع:", style = MaterialTheme.typography.titleMedium, color = Ink)
                    Spacer(Modifier.height(6.dp))
                    Text("«$CONFESSION_PHRASE»", style = MaterialTheme.typography.titleLarge, color = Coral)
                    Spacer(Modifier.height(12.dp))
                    TextField(
                        value = confession,
                        onValueChange = { confession = it },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        placeholder = { Text("اكتبها هنا بالحرف", color = Muted) },
                        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
                        shape = RoundedCornerShape(16.dp),
                        colors = TextFieldDefaults.colors(
                            focusedContainerColor = Chip,
                            unfocusedContainerColor = Chip,
                            focusedIndicatorColor = Color.Transparent,
                            unfocusedIndicatorColor = Color.Transparent,
                            cursorColor = Blue,
                            focusedTextColor = Ink,
                            unfocusedTextColor = Ink,
                        ),
                    )
                    if (confession.isNotBlank() && !confessed) {
                        Spacer(Modifier.height(6.dp))
                        Text("مو هذي. اكتبها بالضبط، بدون تحايل.", style = MaterialTheme.typography.bodySmall, color = Coral)
                    }
                } else {
                    Text("خلاص، فهمت؟", style = MaterialTheme.typography.titleLarge, color = Ink)
                    Text("اطلع الحين وارجع لشغلك قبل ما تخسر أكثر.", style = MaterialTheme.typography.bodyMedium, color = Muted)
                }
            }

            Spacer(Modifier.height(20.dp))
            PillButton(
                text = when {
                    remaining > 0 -> "انتظر.. ${remaining.toArabicDigits()}"
                    needsConfession && !confessed -> "اعترف أول"
                    else -> "أنا طالع.. وأعرف إني غلطان"
                },
                onClick = onLeave,
                enabled = canLeave,
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(Modifier.height(10.dp))
            Text(
                "ما فيه زر رجوع ولا تخطي. تبي ترفع الحظر فعلًا؟ من تطبيق SavageBlock: «إيقاف مؤقت» أو «إعفاء اليوم».",
                style = MaterialTheme.typography.bodySmall,
                color = Muted,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }
}

@Composable
private fun Stat(label: String, value: String, color: Color, modifier: Modifier = Modifier) {
    Column(modifier.clip(RoundedCornerShape(18.dp)).background(color).padding(14.dp)) {
        Text(value, style = MaterialTheme.typography.headlineSmall, color = Ink)
        Text(label, style = MaterialTheme.typography.labelSmall, color = Muted)
    }
}

/** Lenient comparison: ignore tashkeel, alef variants, punctuation and extra whitespace. */
internal fun String.normalizeArabic(): String =
    this
        .replace(Regex("[\\u064B-\\u0652\\u0640]"), "")   // harakat + tatweel
        .replace(Regex("[أإآٱ]"), "ا")
        .replace('ة', 'ه')
        .replace('ى', 'ي')
        .replace(Regex("[^\\p{L}\\p{N}\\s]"), "")
        .replace(Regex("\\s+"), " ")
        .trim()
