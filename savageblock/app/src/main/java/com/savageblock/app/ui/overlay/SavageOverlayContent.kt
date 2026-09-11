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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
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
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.savageblock.app.data.CONFESSION_PHRASE
import com.savageblock.app.data.Roasts
import com.savageblock.app.data.toArabicDigits
import com.savageblock.app.service.OverlaySession
import com.savageblock.app.ui.components.BrutalButton
import com.savageblock.app.ui.components.HazardStripes
import com.savageblock.app.ui.theme.Acid
import com.savageblock.app.ui.theme.Ash
import com.savageblock.app.ui.theme.Bone
import com.savageblock.app.ui.theme.Concrete
import com.savageblock.app.ui.theme.Crimson
import com.savageblock.app.ui.theme.Void
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
        targetValue = 0.15f,
        animationSpec = infiniteRepeatable(tween(450), RepeatMode.Reverse),
        label = "blinkAlpha",
    )

    Column(
        Modifier
            .fillMaxSize()
            .background(Void)
            .systemBarsPadding()
            .imePadding()
            .verticalScroll(rememberScrollState()),
    ) {
        HazardStripes(colorA = Crimson)
        Column(Modifier.fillMaxWidth().padding(24.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(14.dp).alpha(blink).background(Crimson))
                Spacer(Modifier.width(10.dp))
                Text(
                    text = "تم ضبطك · ${session.level.title}",
                    style = MaterialTheme.typography.labelLarge,
                    color = Crimson,
                )
            }
            Spacer(Modifier.height(10.dp))
            Text(session.appLabel, style = MaterialTheme.typography.headlineMedium, color = Acid)

            Spacer(Modifier.height(28.dp))
            Text(session.roast, style = MaterialTheme.typography.displayMedium, color = Bone)

            Spacer(Modifier.height(28.dp))
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Stat(label = "دقيقة اليوم", value = session.wastedMinutes.toArabicDigits(), modifier = Modifier.weight(1f))
                Stat(label = "الحد المسموح", value = session.limitMinutes.toArabicDigits(), modifier = Modifier.weight(1f))
                Stat(label = "ضربة اليوم", value = session.strikesToday.toArabicDigits(), modifier = Modifier.weight(1f))
            }

            Spacer(Modifier.height(36.dp))
            if (remaining > 0) {
                Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = remaining.toArabicDigits(),
                        style = MaterialTheme.typography.displayLarge,
                        color = Acid,
                        textAlign = TextAlign.Center,
                    )
                    Text(hint, style = MaterialTheme.typography.bodyMedium, color = Ash, textAlign = TextAlign.Center)
                }
            } else if (needsConfession) {
                Text("اكتب الاعتراف عشان تطلع:", style = MaterialTheme.typography.titleMedium, color = Bone)
                Spacer(Modifier.height(8.dp))
                Text("«$CONFESSION_PHRASE»", style = MaterialTheme.typography.titleLarge, color = Acid)
                Spacer(Modifier.height(12.dp))
                OutlinedTextField(
                    value = confession,
                    onValueChange = { confession = it },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    placeholder = { Text("اكتبها هنا بالحرف", color = Ash) },
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
                    textStyle = MaterialTheme.typography.bodyLarge,
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = Bone,
                        unfocusedTextColor = Bone,
                        cursorColor = Acid,
                        focusedBorderColor = Acid,
                        unfocusedBorderColor = Bone,
                        focusedContainerColor = Concrete,
                        unfocusedContainerColor = Concrete,
                    ),
                )
                if (confession.isNotBlank() && !confessed) {
                    Spacer(Modifier.height(6.dp))
                    Text("مو هذي. اكتبها بالضبط، بدون تحايل.", style = MaterialTheme.typography.bodySmall, color = Crimson)
                }
            }

            Spacer(Modifier.height(28.dp))
            BrutalButton(
                text = when {
                    remaining > 0 -> "انتظر.. ${remaining.toArabicDigits()}"
                    needsConfession && !confessed -> "اعترف أول"
                    else -> "أنا طالع.. وأعرف إني غلطان"
                },
                onClick = onLeave,
                enabled = canLeave,
                modifier = Modifier.fillMaxWidth(),
                container = Acid,
                content = Void,
            )
            Spacer(Modifier.height(12.dp))
            Text(
                text = "ما فيه زر رجوع. ما فيه تخطي. فيه بس إنك تقفل وتروح تشتغل.",
                style = MaterialTheme.typography.bodySmall,
                color = Ash,
            )
        }
        Spacer(Modifier.height(8.dp))
        HazardStripes(colorA = Crimson)
    }
}

@Composable
private fun Stat(label: String, value: String, modifier: Modifier = Modifier) {
    Column(modifier.background(Concrete).padding(10.dp)) {
        Text(value, style = MaterialTheme.typography.headlineSmall, color = Bone)
        Text(label, style = MaterialTheme.typography.labelSmall, color = Ash)
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
