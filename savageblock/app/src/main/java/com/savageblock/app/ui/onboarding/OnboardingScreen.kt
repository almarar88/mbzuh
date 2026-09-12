package com.savageblock.app.ui.onboarding

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.savageblock.app.ui.components.BrutalButton
import com.savageblock.app.ui.components.BrutalCard
import com.savageblock.app.ui.components.HazardStripes
import com.savageblock.app.ui.theme.Acid
import com.savageblock.app.ui.theme.Ash
import com.savageblock.app.ui.theme.Bone
import com.savageblock.app.ui.theme.Concrete
import com.savageblock.app.ui.theme.Crimson
import com.savageblock.app.ui.theme.Void
import com.savageblock.app.util.PermissionState

@Composable
fun OnboardingScreen(
    permissions: PermissionState,
    onRequestUsageAccess: () -> Unit,
    onRequestOverlay: () -> Unit,
    onRequestNotifications: () -> Unit,
    onRequestBattery: () -> Unit,
    onDone: () -> Unit,
) {
    Column(
        Modifier
            .fillMaxSize()
            .background(Void)
            .systemBarsPadding()
            .verticalScroll(rememberScrollState()),
    ) {
        HazardStripes()
        Column(
            Modifier
                .widthIn(max = 720.dp)
                .align(Alignment.CenterHorizontally)
                .fillMaxWidth()
                .padding(24.dp),
        ) {
            Text("SAVAGEBLOCK", style = MaterialTheme.typography.displaySmall, color = Bone)
            Text("كافي تضييع", style = MaterialTheme.typography.headlineMedium, color = Acid)
            Spacer(Modifier.height(12.dp))
            Text(
                "عشان أقدر أضبطك متلبّسًا، أحتاج صلاحيتين إجباريتين وصلاحيتين تخلّي المراقبة ما تنقطع. بدونها أنا مجرد تطبيق جميل بلا فايدة.",
                style = MaterialTheme.typography.bodyLarge,
                color = Ash,
            )
            Spacer(Modifier.height(24.dp))

            PermissionCard(
                step = "١",
                title = "الوصول لبيانات الاستخدام",
                why = "عشان أعرف أي تطبيق مفتوح الحين وكم قعدت فيه.",
                granted = permissions.usageAccess,
                required = true,
                action = "افتح الإعدادات",
                onClick = onRequestUsageAccess,
            )
            Spacer(Modifier.height(16.dp))
            PermissionCard(
                step = "٢",
                title = "الظهور فوق التطبيقات",
                why = "عشان أغطي تيك توك وإنستقرام بشاشة التهزيء وأنت مو قادر تتخطاها.",
                granted = permissions.overlay,
                required = true,
                action = "افتح الإعدادات",
                onClick = onRequestOverlay,
            )
            Spacer(Modifier.height(16.dp))
            PermissionCard(
                step = "٣",
                title = "الإشعارات",
                why = "إشعار صامت دائم يخلّي المراقبة شغّالة بالخلفية بدون ما يقتلها النظام.",
                granted = permissions.notifications,
                required = false,
                action = "اسمح",
                onClick = onRequestNotifications,
            )
            Spacer(Modifier.height(16.dp))
            PermissionCard(
                step = "٤",
                title = "استثناء من توفير البطارية",
                why = "بعض الأجهزة تقتل الخدمات الخلفية. هذا يمنعها من قتلي وأنت تحاول تهرب.",
                granted = permissions.batteryUnrestricted,
                required = false,
                action = "استثنِ التطبيق",
                onClick = onRequestBattery,
            )

            Spacer(Modifier.height(32.dp))
            BrutalButton(
                text = if (permissions.essentialsGranted) "جاهز. خلّنا نبدأ" else "أعطني الصلاحيتين الأولى والثانية أول",
                onClick = onDone,
                enabled = permissions.essentialsGranted,
                modifier = Modifier.fillMaxWidth(),
                container = Acid,
                content = Void,
            )
            Spacer(Modifier.height(12.dp))
            Text(
                "كل شي يشتغل على جهازك. ما فيه سيرفر، ما فيه حساب، وما أرسل بياناتك لأحد.",
                style = MaterialTheme.typography.bodySmall,
                color = Ash,
            )
        }
    }
}

@Composable
private fun PermissionCard(
    step: String,
    title: String,
    why: String,
    granted: Boolean,
    required: Boolean,
    action: String,
    onClick: () -> Unit,
) {
    BrutalCard(
        borderColor = if (granted) Acid else Bone,
        shadowColor = if (granted) Acid else Crimson,
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                Modifier.size(36.dp).background(if (granted) Acid else Crimson),
                contentAlignment = Alignment.Center,
            ) {
                Text(step, style = MaterialTheme.typography.titleLarge, color = if (granted) Void else Bone)
            }
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(title, style = MaterialTheme.typography.titleLarge, color = Bone)
                Text(
                    text = when {
                        granted -> "✔ ممنوحة"
                        required -> "إجبارية"
                        else -> "اختيارية (مستحسنة)"
                    },
                    style = MaterialTheme.typography.labelMedium,
                    color = if (granted) Acid else if (required) Crimson else Ash,
                )
            }
        }
        Spacer(Modifier.height(10.dp))
        Text(why, style = MaterialTheme.typography.bodyMedium, color = Ash)
        if (!granted) {
            Spacer(Modifier.height(12.dp))
            Row(horizontalArrangement = Arrangement.End, modifier = Modifier.fillMaxWidth()) {
                BrutalButton(text = action, onClick = onClick, container = Concrete, content = Bone)
            }
        }
    }
}
