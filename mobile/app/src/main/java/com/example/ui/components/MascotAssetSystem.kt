package com.example.ui.components

import androidx.compose.animation.core.*
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.R
import com.example.ui.theme.AcademicTier
import com.example.ui.theme.Radius
import com.example.ui.theme.Spacing
import com.example.ui.theme.StuddyHubThemeTokens

/**
 * Expression and Mood States for Ollie Mascot.
 */
enum class OllieMood(val label: String) {
    GREETING("Greeting"),
    THINKING("Thinking"),
    CELEBRATING("Celebrating"),
    MOTIVATING("Motivating"),
    STUDYING("Studying")
}

/**
 * Render Ollie mascot according to the active AcademicTier and requested Mood,
 * displaying the official Professor Ollie mascot illustration.
 */
@Composable
fun OllieMascot(
    mood: OllieMood = OllieMood.GREETING,
    tier: AcademicTier = StuddyHubThemeTokens.tier,
    size: Dp = 80.dp,
    showSpeechBubble: Boolean = false,
    speechText: String = "",
    modifier: Modifier = Modifier
) {
    val tierColors = StuddyHubThemeTokens.colors

    val infiniteTransition = rememberInfiniteTransition(label = "ollie_bounce")
    val bounceOffset by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = if (mood == OllieMood.CELEBRATING) -8f else -4f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = if (mood == OllieMood.CELEBRATING) 600 else 1200, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "bounce"
    )

    Column(
        modifier = modifier,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        if (showSpeechBubble && speechText.isNotBlank()) {
            OllieSpeechBubble(
                text = speechText,
                tier = tier
            )
            Spacer(modifier = Modifier.height(Spacing.xs))
        }

        Box(
            modifier = Modifier
                .size(size)
                .graphicsLayer { translationY = bounceOffset.dp.toPx() },
            contentAlignment = Alignment.Center
        ) {
            // Ambient Halo Glow
            Box(
                modifier = Modifier
                    .size(size)
                    .clip(CircleShape)
                    .background(
                        Brush.radialGradient(
                            colors = listOf(
                                tierColors.primary.copy(alpha = 0.28f),
                                Color.Transparent
                            )
                        )
                    )
            )

            // High-Res Professor Ollie Portrait
            Surface(
                shape = CircleShape,
                color = Color.White,
                border = BorderStroke(
                    width = if (size > 80.dp) 3.dp else 2.dp,
                    color = when (tier) {
                        AcademicTier.EXPLORER -> Color(0xFFF59E0B)
                        AcademicTier.ACHIEVER -> Color(0xFF4F46E5)
                        AcademicTier.SCHOLAR -> Color(0xFF0F172A)
                        AcademicTier.ALL -> Color(0xFFF59E0B)
                    }
                ),
                shadowElevation = if (mood == OllieMood.CELEBRATING) 8.dp else 4.dp,
                modifier = Modifier
                    .size(size * 0.88f)
                    .align(Alignment.Center)
            ) {
                Image(
                    painter = painterResource(id = R.drawable.img_prof_ollie_1786717163116),
                    contentDescription = "Professor Ollie Mascot",
                    modifier = Modifier
                        .fillMaxSize()
                        .clip(CircleShape),
                    contentScale = ContentScale.Crop
                )
            }

            // Mood Indicator Pill Badge
            val badgeSize = (size * 0.32f).coerceIn(20.dp, 36.dp)
            Surface(
                shape = CircleShape,
                color = when (mood) {
                    OllieMood.CELEBRATING -> Color(0xFF10B981)
                    OllieMood.THINKING -> Color(0xFF6366F1)
                    OllieMood.MOTIVATING -> Color(0xFFF59E0B)
                    OllieMood.STUDYING -> Color(0xFF0EA5E9)
                    OllieMood.GREETING -> tierColors.primary
                },
                border = BorderStroke(1.5.dp, Color.White),
                shadowElevation = 4.dp,
                modifier = Modifier
                    .size(badgeSize)
                    .align(Alignment.BottomEnd)
            ) {
                Box(contentAlignment = Alignment.Center) {
                    val iconVector = when (mood) {
                        OllieMood.GREETING -> Icons.Default.WavingHand
                        OllieMood.THINKING -> Icons.Default.Lightbulb
                        OllieMood.CELEBRATING -> Icons.Default.Celebration
                        OllieMood.MOTIVATING -> Icons.Default.Star
                        OllieMood.STUDYING -> Icons.Default.MenuBook
                    }
                    Icon(
                        imageVector = iconVector,
                        contentDescription = mood.label,
                        tint = Color.White,
                        modifier = Modifier.size(badgeSize * 0.62f)
                    )
                }
            }
        }
    }
}

/**
 * Speech bubble with tier-styled borders and pointer arrow.
 */
@Composable
fun OllieSpeechBubble(
    text: String,
    tier: AcademicTier = StuddyHubThemeTokens.tier,
    modifier: Modifier = Modifier
) {
    val tierColors = StuddyHubThemeTokens.colors

    Surface(
        shape = RoundedCornerShape(14.dp),
        color = tierColors.pillBackground,
        border = androidx.compose.foundation.BorderStroke(1.dp, tierColors.cardBorder),
        modifier = modifier.padding(horizontal = Spacing.sm)
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            Text(
                text = "${tier.emoji} ",
                fontSize = 12.sp
            )
            Text(
                text = text,
                style = MaterialTheme.typography.labelMedium.copy(
                    fontWeight = FontWeight.SemiBold,
                    color = tierColors.pillTextColor
                )
            )
        }
    }
}
