package com.alcode.qarar.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.alcode.qarar.R

// Palette: deep navy ground, amber for the "decision" accent, teal for progress/success.
val Navy900 = Color(0xFF0B1220)
val Navy800 = Color(0xFF131C2E)
val Navy700 = Color(0xFF1B2740)
val Navy600 = Color(0xFF26355A)
val Amber = Color(0xFFF5B942)
val AmberDeep = Color(0xFFC8912A)
val Teal = Color(0xFF2DD4BF)
val TealDeep = Color(0xFF0F9F8F)
val Rose = Color(0xFFF87171)
val Sand = Color(0xFFFAF6EE)
val Ink = Color(0xFF14161C)

private val DarkScheme = darkColorScheme(
    primary = Amber,
    onPrimary = Navy900,
    primaryContainer = Color(0xFF3A2E12),
    onPrimaryContainer = Color(0xFFFFE2A6),
    secondary = Teal,
    onSecondary = Navy900,
    secondaryContainer = Color(0xFF0F3B39),
    onSecondaryContainer = Color(0xFFB6F5EC),
    tertiary = Color(0xFFA5B4FC),
    background = Navy900,
    onBackground = Color(0xFFEDEFF5),
    surface = Navy900,
    onSurface = Color(0xFFEDEFF5),
    surfaceVariant = Navy800,
    onSurfaceVariant = Color(0xFFB4BCCE),
    surfaceContainer = Navy800,
    surfaceContainerHigh = Navy700,
    surfaceContainerHighest = Navy600,
    surfaceContainerLow = Color(0xFF0F1727),
    outline = Color(0xFF3B4863),
    outlineVariant = Color(0xFF26314A),
    error = Rose,
    onError = Navy900,
    errorContainer = Color(0xFF4A1D1D),
    onErrorContainer = Color(0xFFFFC9C9),
)

private val LightScheme = lightColorScheme(
    primary = AmberDeep,
    onPrimary = Color.White,
    primaryContainer = Color(0xFFFFE9BD),
    onPrimaryContainer = Color(0xFF3A2E12),
    secondary = TealDeep,
    onSecondary = Color.White,
    secondaryContainer = Color(0xFFCCF3EC),
    onSecondaryContainer = Color(0xFF07332F),
    tertiary = Color(0xFF4F5FD8),
    background = Sand,
    onBackground = Ink,
    surface = Sand,
    onSurface = Ink,
    surfaceVariant = Color(0xFFF0EAE0),
    onSurfaceVariant = Color(0xFF5B5F6B),
    surfaceContainer = Color(0xFFF3EEE4),
    surfaceContainerHigh = Color(0xFFECE6DA),
    surfaceContainerHighest = Color(0xFFE4DDD0),
    surfaceContainerLow = Color(0xFFFCFAF5),
    outline = Color(0xFFB9B3A6),
    outlineVariant = Color(0xFFDDD6C8),
    error = Color(0xFFB3261E),
)

val Tajawal = FontFamily(
    Font(R.font.tajawal_regular, FontWeight.Normal),
    Font(R.font.tajawal_medium, FontWeight.Medium),
    Font(R.font.tajawal_bold, FontWeight.Bold),
)

private val QararTypography = Typography(
    displaySmall = TextStyle(fontFamily = Tajawal, fontWeight = FontWeight.Bold, fontSize = 34.sp, lineHeight = 42.sp),
    headlineMedium = TextStyle(fontFamily = Tajawal, fontWeight = FontWeight.Bold, fontSize = 26.sp, lineHeight = 34.sp),
    headlineSmall = TextStyle(fontFamily = Tajawal, fontWeight = FontWeight.Bold, fontSize = 22.sp, lineHeight = 30.sp),
    titleLarge = TextStyle(fontFamily = Tajawal, fontWeight = FontWeight.Bold, fontSize = 20.sp, lineHeight = 28.sp),
    titleMedium = TextStyle(fontFamily = Tajawal, fontWeight = FontWeight.Medium, fontSize = 17.sp, lineHeight = 24.sp),
    titleSmall = TextStyle(fontFamily = Tajawal, fontWeight = FontWeight.Medium, fontSize = 15.sp, lineHeight = 22.sp),
    bodyLarge = TextStyle(fontFamily = Tajawal, fontWeight = FontWeight.Normal, fontSize = 17.sp, lineHeight = 27.sp),
    bodyMedium = TextStyle(fontFamily = Tajawal, fontWeight = FontWeight.Normal, fontSize = 15.sp, lineHeight = 24.sp),
    bodySmall = TextStyle(fontFamily = Tajawal, fontWeight = FontWeight.Normal, fontSize = 13.sp, lineHeight = 20.sp),
    labelLarge = TextStyle(fontFamily = Tajawal, fontWeight = FontWeight.Medium, fontSize = 15.sp, lineHeight = 20.sp),
    labelMedium = TextStyle(fontFamily = Tajawal, fontWeight = FontWeight.Medium, fontSize = 13.sp, lineHeight = 18.sp),
    labelSmall = TextStyle(fontFamily = Tajawal, fontWeight = FontWeight.Medium, fontSize = 11.sp, lineHeight = 16.sp),
)

private val QararShapes = Shapes(
    extraSmall = RoundedCornerShape(8.dp),
    small = RoundedCornerShape(12.dp),
    medium = RoundedCornerShape(18.dp),
    large = RoundedCornerShape(24.dp),
    extraLarge = RoundedCornerShape(32.dp),
)

@Composable
fun QararTheme(darkTheme: Boolean = isSystemInDarkTheme(), content: @Composable () -> Unit) {
    CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
        MaterialTheme(
            colorScheme = if (darkTheme) DarkScheme else LightScheme,
            typography = QararTypography,
            shapes = QararShapes,
            content = content,
        )
    }
}
