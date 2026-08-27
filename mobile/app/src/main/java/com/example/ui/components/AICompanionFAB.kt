package com.example.ui.components

import androidx.compose.animation.core.*
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.R
import com.example.ui.theme.AcademicTier
import com.example.ui.theme.StuddyHubThemeTokens

/**
 * Animated Floating Action Button for the level-tuned AI Companion.
 * Tapping it opens the shared, tier-branded AI Tutor screen (AIChatScreen),
 * which dynamically re-brands itself to the active [AcademicTier].
 */
@Composable
fun AICompanionFAB(
    tier: AcademicTier = StuddyHubThemeTokens.tier,
    modifier: Modifier = Modifier,
    onOpenCompanion: () -> Unit
) {
    val haptic = LocalHapticFeedback.current
    val view = LocalView.current

    val infiniteTransition = rememberInfiniteTransition(label = "fab_pulse")
    val scale by infiniteTransition.animateFloat(
        initialValue = 1f,
        targetValue = 1.05f,
        animationSpec = infiniteRepeatable(
            animation = tween(1400, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "fab_scale"
    )

    val (label, containerColor, _) = when (tier) {
        AcademicTier.EXPLORER -> Triple("Ask Ollie! 🦉", Color(0xFFF59E0B), Color(0xFF92400E))
        AcademicTier.ACHIEVER -> Triple("WASSCE Coach ⚡", Color(0xFF4F46E5), Color(0xFFEEF2FF))
        AcademicTier.SCHOLAR -> Triple("Copilot 🎓", Color(0xFF0F172A), Color(0xFFE2E8F0))
        AcademicTier.ALL -> Triple("Ask Ollie! 🦉", Color(0xFFF59E0B), Color(0xFF92400E))
    }

    Surface(
        shape = RoundedCornerShape(26.dp),
        color = containerColor,
        shadowElevation = 12.dp,
        border = BorderStroke(2.dp, Color.White),
        modifier = modifier
            .scale(scale)
            .studdyPressScale()
            .clickable {
                haptic.performHapticFeedback(HapticFeedbackType.LongPress)
                TactileSoundSystem.playPopSound(view)
                onOpenCompanion()
            }
            .testTag("ai_companion_fab")
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            // Mascot / Avatar in circular badge
            Surface(
                shape = CircleShape,
                color = Color.White,
                modifier = Modifier.size(32.dp)
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Image(
                        painter = painterResource(
                            id = if (tier == AcademicTier.EXPLORER) R.drawable.img_prof_ollie_1786717163116 else R.drawable.img_ghana_student_1786717174359
                        ),
                        contentDescription = "Mascot Avatar",
                        modifier = Modifier.size(28.dp).clip(CircleShape)
                    )
                }
            }

            Text(
                text = label,
                style = MaterialTheme.typography.labelLarge.copy(
                    fontWeight = FontWeight.ExtraBold,
                    color = Color.White,
                    fontSize = 13.sp
                )
            )
        }
    }
}
