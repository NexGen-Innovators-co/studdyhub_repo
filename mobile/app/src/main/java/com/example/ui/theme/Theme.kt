package com.example.ui.theme

import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext

private val DarkColorScheme = darkColorScheme(
    primary = IndigoSecondary,
    secondary = EmeraldAccent,
    tertiary = VioletTertiary,
    background = DarkBackground,
    surface = DarkSurface,
    surfaceVariant = DarkCard,
    onPrimary = Color.White,
    onSecondary = Color.White,
    onBackground = TextPrimaryDark,
    onSurface = TextPrimaryDark
)

private val LightColorScheme = lightColorScheme(
    primary = IndigoPrimary,
    secondary = EmeraldAccent,
    tertiary = VioletTertiary,
    background = LightBackground,
    surface = LightSurface,
    surfaceVariant = LightCard,
    onPrimary = Color.White,
    onSecondary = Color.White,
    onBackground = TextPrimaryLight,
    onSurface = TextPrimaryLight
)

@Composable
fun StuddyHubTheme(
    tier: AcademicTier = AcademicTier.ACHIEVER,
    darkTheme: Boolean = isSystemInDarkTheme(),
    dynamicColor: Boolean = false,
    content: @Composable () -> Unit
) {
    if (dynamicColor && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        val context = LocalContext.current
        val colorScheme = if (darkTheme) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)
        val tierColors = when (tier) {
            AcademicTier.EXPLORER -> if (darkTheme) ExplorerDarkColors else ExplorerLightColors
            AcademicTier.ACHIEVER -> if (darkTheme) AchieverDarkColors else AchieverLightColors
            AcademicTier.SCHOLAR -> if (darkTheme) ScholarDarkColors else ScholarLightColors
            AcademicTier.ALL -> if (darkTheme) ExplorerDarkColors else ExplorerLightColors
        }
        androidx.compose.runtime.CompositionLocalProvider(
            LocalAcademicTier provides tier,
            LocalTierColors provides tierColors
        ) {
            MaterialTheme(
                colorScheme = colorScheme,
                typography = Typography,
                content = content
            )
        }
    } else {
        ProvideTierTheme(
            tier = tier,
            darkTheme = darkTheme,
            content = content
        )
    }
}
