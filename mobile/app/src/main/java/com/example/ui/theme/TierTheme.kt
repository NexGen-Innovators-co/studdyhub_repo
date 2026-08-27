package com.example.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.ColorScheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color

/**
 * The 3 Academic Tiers for StuddyHub's adaptive learning experience.
 */
enum class AcademicTier(
    val key: String,
    val displayName: String,
    val subtitle: String,
    val tagLine: String,
    val mascotRole: String,
    val emoji: String
) {
    ALL(
        key = "all",
        displayName = "All",
        subtitle = "Every User",
        tagLine = "Global Ranking",
        mascotRole = "",
        emoji = "🌍"
    ),
    EXPLORER(
        key = "explorer",
        displayName = "Explorer",
        subtitle = "Basic School & JHS",
        tagLine = "Curious & Fun",
        mascotRole = "Study Pal Ollie 🎒",
        emoji = "🎒"
    ),
    ACHIEVER(
        key = "achiever",
        displayName = "Achiever",
        subtitle = "SHS & WASSCE Prep",
        tagLine = "Goal & Exam Driven",
        mascotRole = "Coach Ollie ⚡",
        emoji = "⚡"
    ),
    SCHOLAR(
        key = "scholar",
        displayName = "Scholar",
        subtitle = "University & Research",
        tagLine = "Deep Focus & Rigor",
        mascotRole = "Professor Ollie 🎓",
        emoji = "🎓"
    );

    companion object {
        fun fromKey(key: String?): AcademicTier {
            val normalized = key?.lowercase()?.trim() ?: return ALL
            return when {
                normalized.contains("all") -> ALL
                normalized.contains("explorer") || normalized.contains("basic") || normalized.contains("jhs") || normalized.contains("primary") -> EXPLORER
                normalized.contains("scholar") || normalized.contains("undergraduate") || normalized.contains("graduate") ||
                    normalized.contains("phd") || normalized.contains("post-doc") || normalized.contains("self-learner") || normalized.contains("university") -> SCHOLAR
                normalized.contains("achiever") || normalized.contains("high_school") || normalized.contains("shs") || normalized.contains("wassce") -> ACHIEVER
                else -> ALL
            }
        }
    }
}

/**
 * Extended color attributes specific to each Academic Tier.
 */
data class TierColors(
    val primary: Color,
    val primaryVariant: Color,
    val secondary: Color,
    val tertiary: Color,
    val accent: Color,
    val bannerGradientStart: Color,
    val bannerGradientEnd: Color,
    val pillBackground: Color,
    val pillTextColor: Color,
    val cardBorder: Color,
    val badgeBackground: Color,
    val badgeTextColor: Color,
    val accentMuted: Color,
    val surfaceBackground: Color,
    val cardBackground: Color,
    val isDark: Boolean = false
) {
    val bannerBrush: Brush
        get() = Brush.horizontalGradient(listOf(bannerGradientStart, bannerGradientEnd))

    val bannerVerticalBrush: Brush
        get() = Brush.verticalGradient(listOf(bannerGradientStart, bannerGradientEnd))
}

// ── EXPLORER PALETTES (Clean Cloud Base, Vivid Playful Accents, Crisp Contrast) ──
val ExplorerLightColors = TierColors(
    primary = Color(0xFF2563EB),            // Energetic Royal Blue
    primaryVariant = Color(0xFF3B82F6),     // Bright Sky Blue
    secondary = Color(0xFF10B981),          // Mint Emerald
    tertiary = Color(0xFFF59E0B),           // Sunshine Gold
    accent = Color(0xFFEC4899),             // Coral Rose
    bannerGradientStart = Color(0xFF2563EB),
    bannerGradientEnd = Color(0xFF7C3AED),
    pillBackground = Color(0xFFEFF6FF),
    pillTextColor = Color(0xFF1D4ED8),
    cardBorder = Color(0xFFE2E8F0),
    badgeBackground = Color(0xFFFEF3C7),
    badgeTextColor = Color(0xFFB45309),
    accentMuted = Color(0xFF3B82F6).copy(alpha = 0.15f),
    surfaceBackground = Color(0xFFF8FAFC),  // Crisp Cloud White/Slate Canvas
    cardBackground = Color(0xFFFFFFFF),
    isDark = false
)

val ExplorerDarkColors = TierColors(
    primary = Color(0xFF60A5FA),
    primaryVariant = Color(0xFF3B82F6),
    secondary = Color(0xFF34D399),
    tertiary = Color(0xFFFBBF24),
    accent = Color(0xFFF472B6),
    bannerGradientStart = Color(0xFF1E3A8A),
    bannerGradientEnd = Color(0xFF4C1D95),
    pillBackground = Color(0xFF1E293B),
    pillTextColor = Color(0xFF93C5FD),
    cardBorder = Color(0xFF334155),
    badgeBackground = Color(0xFF451A03),
    badgeTextColor = Color(0xFFFDE68A),
    accentMuted = Color(0xFF60A5FA).copy(alpha = 0.2f),
    surfaceBackground = Color(0xFF0F172A),  // Deep Sleek Slate
    cardBackground = Color(0xFF1E293B),
    isDark = true
)

// ── ACHIEVER PALETTES (Electric Indigo, Vivid Cyan, Energetic) ──
val AchieverLightColors = TierColors(
    primary = Color(0xFF4F46E5),            // Electric Indigo
    primaryVariant = Color(0xFF6366F1),     // Indigo Secondary
    secondary = Color(0xFF06B6D4),          // Vivid Cyan
    tertiary = Color(0xFF8B5CF6),           // Royal Violet
    accent = Color(0xFF10B981),             // Emerald
    bannerGradientStart = Color(0xFF4F46E5),
    bannerGradientEnd = Color(0xFF7C3AED),
    pillBackground = Color(0xFFEEF2FF),
    pillTextColor = Color(0xFF3730A3),
    cardBorder = Color(0xFFE0E7FF),
    badgeBackground = Color(0xFFEEF2FF),
    badgeTextColor = Color(0xFF4338CA),
    accentMuted = Color(0xFF4F46E5).copy(alpha = 0.15f),
    surfaceBackground = Color(0xFFF8FAFC),
    cardBackground = Color(0xFFFFFFFF),
    isDark = false
)

val AchieverDarkColors = TierColors(
    primary = Color(0xFF6366F1),
    primaryVariant = Color(0xFF818CF8),
    secondary = Color(0xFF22D3EE),
    tertiary = Color(0xFFA78BFA),
    accent = Color(0xFF34D399),
    bannerGradientStart = Color(0xFF1E1B4B),
    bannerGradientEnd = Color(0xFF312E81),
    pillBackground = Color(0xFF1E1B4B),
    pillTextColor = Color(0xFFC7D2FE),
    cardBorder = Color(0xFF3730A3),
    badgeBackground = Color(0xFF312E81),
    badgeTextColor = Color(0xFFC7D2FE),
    accentMuted = Color(0xFF6366F1).copy(alpha = 0.25f),
    surfaceBackground = Color(0xFF0F172A),
    cardBackground = Color(0xFF1E293B),
    isDark = true
)

// ── SCHOLAR PALETTES (Deep Slate, Refined Academic Emerald & Burgundy) ──
val ScholarLightColors = TierColors(
    primary = Color(0xFF0F172A),            // Deep Slate / Navy
    primaryVariant = Color(0xFF1E293B),     // Charcoal
    secondary = Color(0xFF059669),          // Academic Emerald
    tertiary = Color(0xFF991B1B),           // Oxford Crimson / Burgundy
    accent = Color(0xFFD97706),             // Brass / Gold
    bannerGradientStart = Color(0xFF0F172A),
    bannerGradientEnd = Color(0xFF1E1B4B),
    pillBackground = Color(0xFFF1F5F9),
    pillTextColor = Color(0xFF0F172A),
    cardBorder = Color(0xFFCBD5E1),
    badgeBackground = Color(0xFFF1F5F9),
    badgeTextColor = Color(0xFF0F172A),
    accentMuted = Color(0xFF0F172A).copy(alpha = 0.12f),
    surfaceBackground = Color(0xFFF8FAFC),
    cardBackground = Color(0xFFFFFFFF),
    isDark = false
)

val ScholarDarkColors = TierColors(
    primary = Color(0xFFE2E8F0),
    primaryVariant = Color(0xFFCBD5E1),
    secondary = Color(0xFF10B981),
    tertiary = Color(0xFFEF4444),
    accent = Color(0xFFF59E0B),
    bannerGradientStart = Color(0xFF020617),
    bannerGradientEnd = Color(0xFF0F172A),
    pillBackground = Color(0xFF1E293B),
    pillTextColor = Color(0xFFF8FAFC),
    cardBorder = Color(0xFF334155),
    badgeBackground = Color(0xFF1E293B),
    badgeTextColor = Color(0xFFE2E8F0),
    accentMuted = Color(0xFFE2E8F0).copy(alpha = 0.2f),
    surfaceBackground = Color(0xFF020617),
    cardBackground = Color(0xFF0F172A),
    isDark = true
)

/**
 * CompositionLocals for accessing the active tier and its custom tokens.
 */
val LocalAcademicTier = staticCompositionLocalOf { AcademicTier.ACHIEVER }
val LocalTierColors = staticCompositionLocalOf { AchieverLightColors }

object StuddyHubThemeTokens {
    val tier: AcademicTier
        @Composable
        @ReadOnlyComposable
        get() = LocalAcademicTier.current

    val colors: TierColors
        @Composable
        @ReadOnlyComposable
        get() = LocalTierColors.current
}

/**
 * Tier-aware accent aliases for screens that predate the tier system and hardcoded
 * Indigo/Violet/Emerald. Using these keeps every screen visually consistent with the
 * active academic tier (Explorer warm & playful, Achiever electric indigo, Scholar
 * deep slate & emerald) instead of showing the same indigo/violet everywhere.
 */
@Composable
@ReadOnlyComposable
fun tierPrimary(): Color = StuddyHubThemeTokens.colors.primary

@Composable
@ReadOnlyComposable
fun tierSecondary(): Color = StuddyHubThemeTokens.colors.secondary

@Composable
@ReadOnlyComposable
fun tierTertiary(): Color = StuddyHubThemeTokens.colors.tertiary

@Composable
@ReadOnlyComposable
fun tierAccent(): Color = StuddyHubThemeTokens.colors.accent

@Composable
@ReadOnlyComposable
fun tierBannerBrush(): Brush = StuddyHubThemeTokens.colors.bannerBrush

// ── Tier-specific copy for shared feature screens ─────────────────────────────

/** Quiz library title, branded per tier. */
@Composable
@ReadOnlyComposable
fun tierQuizTitle(): String = when (StuddyHubThemeTokens.tier) {
    AcademicTier.EXPLORER -> "Quiz Quest 🎮"
    AcademicTier.ACHIEVER -> "Exam Arena ⚡"
    AcademicTier.SCHOLAR -> "Quiz Lab 🎓"
    AcademicTier.ALL -> "Quiz Quest 🎮"
}

/** Quiz library subtitle, branded per tier. */
@Composable
@ReadOnlyComposable
fun tierQuizSubtitle(count: Int): String = when (StuddyHubThemeTokens.tier) {
    AcademicTier.EXPLORER -> "$count Quizzes Available • Play & Learn"
    AcademicTier.ACHIEVER -> "$count Quizzes Available • WASSCE Prep"
    AcademicTier.SCHOLAR -> "$count Quizzes Available • Academic Practice"
    AcademicTier.ALL -> "$count Quizzes Available"
}

/** Flashcards screen title, branded per tier. */
@Composable
@ReadOnlyComposable
fun tierFlashcardTitle(): String = when (StuddyHubThemeTokens.tier) {
    AcademicTier.EXPLORER -> "Flashcard Fun 🃏"
    AcademicTier.ACHIEVER -> "Flashcard Drill ⚡"
    AcademicTier.SCHOLAR -> "Flashcard Deck 🎓"
    AcademicTier.ALL -> "Flashcards 🃏"
}

/** Full display name of the shared AI tutor, branded per tier (matches AIChatScreen). */
@Composable
@ReadOnlyComposable
fun tierTutorDisplayName(): String = when (StuddyHubThemeTokens.tier) {
    AcademicTier.EXPLORER -> "Ollie the Wise Owl 🦉"
    AcademicTier.ACHIEVER -> "Master Kwame ⚡"
    AcademicTier.SCHOLAR -> "Professor Ollie 🎓"
    AcademicTier.ALL -> "Ollie the Wise Owl 🦉"
}

/**
 * Build a Material 3 ColorScheme from the selected Academic Tier.
 */
fun buildTierColorScheme(tier: AcademicTier, isDark: Boolean): ColorScheme {
    return when (tier) {
        AcademicTier.EXPLORER -> {
            if (isDark) {
                darkColorScheme(
                    primary = ExplorerDarkColors.primary,
                    onPrimary = Color(0xFF0F172A),
                    primaryContainer = Color(0xFF1E3A8A),
                    secondary = ExplorerDarkColors.secondary,
                    onSecondary = Color.Black,
                    tertiary = ExplorerDarkColors.tertiary,
                    background = ExplorerDarkColors.surfaceBackground,
                    surface = ExplorerDarkColors.cardBackground,
                    surfaceVariant = Color(0xFF334155),
                    onBackground = TextPrimaryDark,
                    onSurface = TextPrimaryDark
                )
            } else {
                lightColorScheme(
                    primary = ExplorerLightColors.primary,
                    onPrimary = Color.White,
                    primaryContainer = ExplorerLightColors.pillBackground,
                    secondary = ExplorerLightColors.secondary,
                    onSecondary = Color.White,
                    tertiary = ExplorerLightColors.tertiary,
                    background = ExplorerLightColors.surfaceBackground,
                    surface = ExplorerLightColors.cardBackground,
                    surfaceVariant = Color(0xFFF1F5F9),
                    onBackground = TextPrimaryLight,
                    onSurface = TextPrimaryLight
                )
            }
        }
        AcademicTier.ACHIEVER -> {
            if (isDark) {
                darkColorScheme(
                    primary = AchieverDarkColors.primary,
                    onPrimary = Color.White,
                    primaryContainer = Color(0xFF312E81),
                    secondary = AchieverDarkColors.secondary,
                    onSecondary = Color.Black,
                    tertiary = AchieverDarkColors.tertiary,
                    background = AchieverDarkColors.surfaceBackground,
                    surface = AchieverDarkColors.cardBackground,
                    surfaceVariant = DarkCard,
                    onBackground = TextPrimaryDark,
                    onSurface = TextPrimaryDark
                )
            } else {
                lightColorScheme(
                    primary = AchieverLightColors.primary,
                    onPrimary = Color.White,
                    primaryContainer = Color(0xFFE0E7FF),
                    secondary = AchieverLightColors.secondary,
                    onSecondary = Color.White,
                    tertiary = AchieverLightColors.tertiary,
                    background = AchieverLightColors.surfaceBackground,
                    surface = AchieverLightColors.cardBackground,
                    surfaceVariant = LightCard,
                    onBackground = TextPrimaryLight,
                    onSurface = TextPrimaryLight
                )
            }
        }
        AcademicTier.SCHOLAR -> {
            if (isDark) {
                darkColorScheme(
                    primary = ScholarDarkColors.secondary,
                    onPrimary = Color.Black,
                    primaryContainer = Color(0xFF1E293B),
                    secondary = ScholarDarkColors.accent,
                    onSecondary = Color.Black,
                    tertiary = ScholarDarkColors.tertiary,
                    background = ScholarDarkColors.surfaceBackground,
                    surface = ScholarDarkColors.cardBackground,
                    surfaceVariant = Color(0xFF1E293B),
                    onBackground = TextPrimaryDark,
                    onSurface = TextPrimaryDark
                )
            } else {
                lightColorScheme(
                    primary = ScholarLightColors.primary,
                    onPrimary = Color.White,
                    primaryContainer = Color(0xFFE2E8F0),
                    secondary = ScholarLightColors.secondary,
                    onSecondary = Color.White,
                    tertiary = ScholarLightColors.tertiary,
                    background = ScholarLightColors.surfaceBackground,
                    surface = ScholarLightColors.cardBackground,
                    surfaceVariant = Color(0xFFE2E8F0),
                    onBackground = TextPrimaryLight,
                    onSurface = TextPrimaryLight
                )
            }
        }
        AcademicTier.ALL -> {
            // ALL tier defaults to Explorer colors for a welcoming, universal look
            if (isDark) {
                darkColorScheme(
                    primary = ExplorerDarkColors.primary,
                    onPrimary = Color(0xFF0F172A),
                    primaryContainer = Color(0xFF1E3A8A),
                    secondary = ExplorerDarkColors.secondary,
                    onSecondary = Color.Black,
                    tertiary = ExplorerDarkColors.tertiary,
                    background = ExplorerDarkColors.surfaceBackground,
                    surface = ExplorerDarkColors.cardBackground,
                    surfaceVariant = Color(0xFF334155),
                    onBackground = TextPrimaryDark,
                    onSurface = TextPrimaryDark
                )
            } else {
                lightColorScheme(
                    primary = ExplorerLightColors.primary,
                    onPrimary = Color.White,
                    primaryContainer = ExplorerLightColors.pillBackground,
                    secondary = ExplorerLightColors.secondary,
                    onSecondary = Color.White,
                    tertiary = ExplorerLightColors.tertiary,
                    background = ExplorerLightColors.surfaceBackground,
                    surface = ExplorerLightColors.cardBackground,
                    surfaceVariant = Color(0xFFF1F5F9),
                    onBackground = TextPrimaryLight,
                    onSurface = TextPrimaryLight
                )
            }
        }
    }
}

/**
 * Provides the active Academic Tier theme and CompositionLocals to child composables.
 */
@Composable
fun ProvideTierTheme(
    tier: AcademicTier,
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    val tierColors = when (tier) {
        AcademicTier.EXPLORER -> if (darkTheme) ExplorerDarkColors else ExplorerLightColors
        AcademicTier.ACHIEVER -> if (darkTheme) AchieverDarkColors else AchieverLightColors
        AcademicTier.SCHOLAR -> if (darkTheme) ScholarDarkColors else ScholarLightColors
        AcademicTier.ALL -> if (darkTheme) ExplorerDarkColors else ExplorerLightColors
    }

    val colorScheme = buildTierColorScheme(tier, darkTheme)

    CompositionLocalProvider(
        LocalAcademicTier provides tier,
        LocalTierColors provides tierColors
    ) {
        MaterialTheme(
            colorScheme = colorScheme,
            typography = Typography,
            content = content
        )
    }
}
