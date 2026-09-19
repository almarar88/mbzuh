package com.savageblock.app.ui.theme

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.Typography
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

// ---------------------------------------------------------------- palette (light, soft)
val Canvas = Color(0xFFF2F4F7)       // page background
val Surface = Color(0xFFFFFFFF)      // cards
val Chip = Color(0xFFEDEFF3)         // subtle chips / segmented track
val Line = Color(0xFFE5E7EB)         // hairlines, empty progress
val Ink = Color(0xFF111827)          // primary text
val Muted = Color(0xFF6B7280)        // secondary text
val Dark = Color(0xFF17181C)         // bottom nav, highlighted bar

val Blue = Color(0xFF3D7BF6)         // primary action
val BlueSoft = Color(0xFFDCE8FB)
val Lavender = Color(0xFFE9E4F7)
val LavenderInk = Color(0xFF8B7BD1)
val Mint = Color(0xFFE2F3E7)
val MintInk = Color(0xFF2E9E6B)
val Peach = Color(0xFFFCE7DD)
val PeachInk = Color(0xFFE0784D)
val Sun = Color(0xFFF6C744)
val Coral = Color(0xFFE5484D)
val CoralSoft = Color(0xFFFDE2E3)
val Green = Color(0xFF22A06B)
val GreenSoft = Color(0xFFDDF5E6)

private val SoftColorScheme = lightColorScheme(
    primary = Blue,
    onPrimary = Surface,
    primaryContainer = BlueSoft,
    onPrimaryContainer = Ink,
    secondary = Green,
    onSecondary = Surface,
    secondaryContainer = GreenSoft,
    onSecondaryContainer = Ink,
    tertiary = Sun,
    onTertiary = Ink,
    background = Canvas,
    onBackground = Ink,
    surface = Surface,
    onSurface = Ink,
    surfaceVariant = Chip,
    onSurfaceVariant = Muted,
    outline = Line,
    outlineVariant = Line,
    error = Coral,
    onError = Surface,
    errorContainer = CoralSoft,
    onErrorContainer = Ink,
)

// ---------------------------------------------------------------- type
private val Sans = FontFamily.Default

val SoftTypography = Typography(
    displayLarge = TextStyle(fontFamily = Sans, fontWeight = FontWeight.SemiBold, fontSize = 64.sp, lineHeight = 68.sp),
    displayMedium = TextStyle(fontFamily = Sans, fontWeight = FontWeight.SemiBold, fontSize = 44.sp, lineHeight = 50.sp),
    displaySmall = TextStyle(fontFamily = Sans, fontWeight = FontWeight.SemiBold, fontSize = 34.sp, lineHeight = 40.sp),
    headlineLarge = TextStyle(fontFamily = Sans, fontWeight = FontWeight.SemiBold, fontSize = 28.sp, lineHeight = 36.sp),
    headlineMedium = TextStyle(fontFamily = Sans, fontWeight = FontWeight.SemiBold, fontSize = 24.sp, lineHeight = 32.sp),
    headlineSmall = TextStyle(fontFamily = Sans, fontWeight = FontWeight.SemiBold, fontSize = 20.sp, lineHeight = 28.sp),
    titleLarge = TextStyle(fontFamily = Sans, fontWeight = FontWeight.SemiBold, fontSize = 18.sp, lineHeight = 26.sp),
    titleMedium = TextStyle(fontFamily = Sans, fontWeight = FontWeight.SemiBold, fontSize = 16.sp, lineHeight = 24.sp),
    titleSmall = TextStyle(fontFamily = Sans, fontWeight = FontWeight.Medium, fontSize = 14.sp, lineHeight = 20.sp),
    bodyLarge = TextStyle(fontFamily = Sans, fontWeight = FontWeight.Normal, fontSize = 16.sp, lineHeight = 26.sp),
    bodyMedium = TextStyle(fontFamily = Sans, fontWeight = FontWeight.Normal, fontSize = 14.sp, lineHeight = 22.sp),
    bodySmall = TextStyle(fontFamily = Sans, fontWeight = FontWeight.Normal, fontSize = 12.sp, lineHeight = 18.sp),
    labelLarge = TextStyle(fontFamily = Sans, fontWeight = FontWeight.Medium, fontSize = 14.sp, lineHeight = 20.sp),
    labelMedium = TextStyle(fontFamily = Sans, fontWeight = FontWeight.Medium, fontSize = 12.sp, lineHeight = 16.sp),
    labelSmall = TextStyle(fontFamily = Sans, fontWeight = FontWeight.Medium, fontSize = 11.sp, lineHeight = 14.sp),
)

private val SoftShapes = Shapes(
    extraSmall = RoundedCornerShape(8.dp),
    small = RoundedCornerShape(12.dp),
    medium = RoundedCornerShape(16.dp),
    large = RoundedCornerShape(24.dp),
    extraLarge = RoundedCornerShape(32.dp),
)

/** Light, rounded, RTL-forced theme shared by the activity and the overlay window. */
@Composable
fun SavageTheme(content: @Composable () -> Unit) {
    CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
        MaterialTheme(
            colorScheme = SoftColorScheme,
            typography = SoftTypography,
            shapes = SoftShapes,
            content = content,
        )
    }
}
