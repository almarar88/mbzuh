package com.savageblock.app.ui.theme

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
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

// ---------------------------------------------------------------- palette
val Void = Color(0xFF0A0A0A)      // background
val Steel = Color(0xFF141414)     // card surface
val Concrete = Color(0xFF232323)  // raised / disabled surface
val Ash = Color(0xFF8A8A8A)       // muted text
val Bone = Color(0xFFFFFFFF)      // primary text & borders
val Crimson = Color(0xFFFF2A55)   // strikes, warnings
val Acid = Color(0xFFF5EE38)      // active elements, accents

private val SavageColorScheme = darkColorScheme(
    primary = Crimson,
    onPrimary = Bone,
    secondary = Acid,
    onSecondary = Void,
    tertiary = Acid,
    onTertiary = Void,
    background = Void,
    onBackground = Bone,
    surface = Steel,
    onSurface = Bone,
    surfaceVariant = Concrete,
    onSurfaceVariant = Ash,
    outline = Bone,
    error = Crimson,
    onError = Bone,
)

// ---------------------------------------------------------------- type
private val Heavy = FontFamily.Default

val SavageTypography = Typography(
    displayLarge = TextStyle(fontFamily = Heavy, fontWeight = FontWeight.Black, fontSize = 96.sp, lineHeight = 96.sp),
    displayMedium = TextStyle(fontFamily = Heavy, fontWeight = FontWeight.Black, fontSize = 40.sp, lineHeight = 52.sp),
    displaySmall = TextStyle(fontFamily = Heavy, fontWeight = FontWeight.Black, fontSize = 34.sp, lineHeight = 42.sp),
    headlineLarge = TextStyle(fontFamily = Heavy, fontWeight = FontWeight.Black, fontSize = 30.sp, lineHeight = 38.sp),
    headlineMedium = TextStyle(fontFamily = Heavy, fontWeight = FontWeight.Black, fontSize = 26.sp, lineHeight = 34.sp),
    headlineSmall = TextStyle(fontFamily = Heavy, fontWeight = FontWeight.ExtraBold, fontSize = 22.sp, lineHeight = 30.sp),
    titleLarge = TextStyle(fontFamily = Heavy, fontWeight = FontWeight.ExtraBold, fontSize = 20.sp, lineHeight = 28.sp),
    titleMedium = TextStyle(fontFamily = Heavy, fontWeight = FontWeight.Bold, fontSize = 17.sp, lineHeight = 24.sp),
    titleSmall = TextStyle(fontFamily = Heavy, fontWeight = FontWeight.Bold, fontSize = 14.sp, lineHeight = 20.sp),
    bodyLarge = TextStyle(fontFamily = Heavy, fontWeight = FontWeight.Medium, fontSize = 16.sp, lineHeight = 26.sp),
    bodyMedium = TextStyle(fontFamily = Heavy, fontWeight = FontWeight.Medium, fontSize = 14.sp, lineHeight = 22.sp),
    bodySmall = TextStyle(fontFamily = Heavy, fontWeight = FontWeight.Medium, fontSize = 12.sp, lineHeight = 18.sp),
    labelLarge = TextStyle(fontFamily = Heavy, fontWeight = FontWeight.Black, fontSize = 13.sp, lineHeight = 18.sp, letterSpacing = 1.sp),
    labelMedium = TextStyle(fontFamily = Heavy, fontWeight = FontWeight.Bold, fontSize = 12.sp, lineHeight = 16.sp, letterSpacing = 0.8.sp),
    labelSmall = TextStyle(fontFamily = Heavy, fontWeight = FontWeight.Bold, fontSize = 11.sp, lineHeight = 14.sp, letterSpacing = 0.6.sp),
)

/** Neo-brutalism: no rounded corners anywhere. */
private val SavageShapes = Shapes(
    extraSmall = RoundedCornerShape(0.dp),
    small = RoundedCornerShape(0.dp),
    medium = RoundedCornerShape(0.dp),
    large = RoundedCornerShape(0.dp),
    extraLarge = RoundedCornerShape(0.dp),
)

/** Dark-only, RTL-forced theme shared by the activity and the overlay window. */
@Composable
fun SavageTheme(content: @Composable () -> Unit) {
    CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
        MaterialTheme(
            colorScheme = SavageColorScheme,
            typography = SavageTypography,
            shapes = SavageShapes,
            content = content,
        )
    }
}
