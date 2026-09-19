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
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import com.savageblock.app.ui.components.PillButton
import com.savageblock.app.ui.components.SoftCard
import com.savageblock.app.ui.components.StatusPill
import com.savageblock.app.ui.components.TopBar
import com.savageblock.app.ui.theme.Canvas
import com.savageblock.app.ui.theme.Chip
import com.savageblock.app.ui.theme.Coral
import com.savageblock.app.ui.theme.CoralSoft
import com.savageblock.app.ui.theme.Green
import com.savageblock.app.ui.theme.GreenSoft
import com.savageblock.app.ui.theme.Ink
import com.savageblock.app.ui.theme.Muted
import com.savageblock.app.ui.theme.Surface
import com.savageblock.app.util.PermissionState

@Composable
fun PermissionsScreen(
    permissions: PermissionState,
    onBack: (() -> Unit)?,
    onRequestUsageAccess: () -> Unit,
    onRequestOverlay: () -> Unit,
    onRequestNotifications: () -> Unit,
    onRequestBattery: () -> Unit,
    onDone: () -> Unit,
) {
    Column(
        Modifier
            .fillMaxSize()
            .background(Canvas)
            .statusBarsPadding()
            .verticalScroll(rememberScrollState()),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        TopBar("الصلاحيات", onBack = onBack)
        Column(Modifier.widthIn(max = 640.dp).fillMaxWidth().padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text(
                "عشان أقدر أضبطك متلبّسًا، أحتاج صلاحيتين إجباريتين وصلاحيتين تخلّي المراقبة ما تنقطع. كل شي يبقى على جهازك.",
                style = MaterialTheme.typography.bodyMedium,
                color = Muted,
            )
            PermissionCard("١", "الوصول لبيانات الاستخدام", "عشان أعرف أي تطبيق مفتوح الحين وكم قعدت فيه.", permissions.usageAccess, true, "افتح الإعدادات", onRequestUsageAccess)
            PermissionCard("٢", "الظهور فوق التطبيقات", "عشان أغطي تيك توك وإنستقرام بشاشة التهزيء وأنت مو قادر تتخطاها.", permissions.overlay, true, "افتح الإعدادات", onRequestOverlay)
            PermissionCard("٣", "الإشعارات", "إشعار صامت يخلّي المراقبة شغّالة، وتنبيه قبل ما توصل الحد.", permissions.notifications, false, "اسمح", onRequestNotifications)
            PermissionCard("٤", "استثناء من توفير البطارية", "بعض الأجهزة تقتل الخدمات الخلفية. هذا يمنعها من قتلي وأنت تحاول تهرب.", permissions.batteryUnrestricted, false, "استثنِ التطبيق", onRequestBattery)
            Spacer(Modifier.height(8.dp))
            PillButton(
                text = if (permissions.essentialsGranted) "جاهز. خلّنا نبدأ" else "أعطني الصلاحيتين ١ و٢ أول",
                onClick = onDone,
                enabled = permissions.essentialsGranted,
                modifier = Modifier.fillMaxWidth(),
            )
            Text(
                "ما فيه سيرفر، ما فيه حساب، وما أرسل بياناتك لأحد.",
                style = MaterialTheme.typography.bodySmall,
                color = Muted,
                modifier = Modifier.fillMaxWidth(),
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
    SoftCard(Modifier.fillMaxWidth()) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                Modifier.size(38.dp).clip(CircleShape).background(if (granted) GreenSoft else if (required) CoralSoft else Chip),
                contentAlignment = Alignment.Center,
            ) {
                if (granted) Icon(Icons.Rounded.Check, null, tint = Green, modifier = Modifier.size(20.dp))
                else Text(step, style = MaterialTheme.typography.titleMedium, color = if (required) Coral else Ink)
            }
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(title, style = MaterialTheme.typography.titleMedium, color = Ink)
                Text(why, style = MaterialTheme.typography.bodySmall, color = Muted)
            }
        }
        Spacer(Modifier.height(12.dp))
        Row(verticalAlignment = Alignment.CenterVertically) {
            when {
                granted -> StatusPill("ممنوحة", GreenSoft, Green)
                required -> StatusPill("إجبارية", CoralSoft, Coral)
                else -> StatusPill("اختيارية", Chip, Muted)
            }
            Spacer(Modifier.weight(1f))
            if (!granted) PillButton(action, onClick, container = Ink, content = Surface)
        }
    }
}

