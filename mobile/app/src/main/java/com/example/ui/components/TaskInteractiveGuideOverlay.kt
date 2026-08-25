package com.example.ui.components

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.scaleOut
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.AutoStories
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material.icons.filled.Lightbulb
import androidx.compose.material.icons.filled.RecordVoiceOver
import androidx.compose.material.icons.filled.Speed
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.ui.theme.AcademicTier

data class TaskGuideStep(
    val stepNumber: Int,
    val title: String,
    val description: String,
    val targetLabel: String,
    val icon: ImageVector,
    val accentColor: Color,
    val mood: OllieMood = OllieMood.GREETING,
    val hintBubble: String
)

val DEFAULT_LESSON_GUIDE_STEPS = listOf(
    TaskGuideStep(
        stepNumber = 1,
        title = "AI Read-Aloud Voice 🔊",
        description = "Professor Ollie can read the full lesson for you! Tap 'Read Entire Lesson Aloud' or switch between 🐢 Slow and 🐇 Fast speech mode in the top bar anytime.",
        targetLabel = "TOP BAR & READ-ALOUD BANNER",
        icon = Icons.Default.RecordVoiceOver,
        accentColor = Color(0xFF2563EB),
        mood = OllieMood.GREETING,
        hintBubble = "Tap the big blue button to hear me read everything!"
    ),
    TaskGuideStep(
        stepNumber = 2,
        title = "Tap-to-Speak Words 🗣️",
        description = "Whenever you see vocabulary pill chips, tap on them to hear the correct pronunciation and practice saying new words!",
        targetLabel = "VOCABULARY PILLS",
        icon = Icons.Default.Speed,
        accentColor = Color(0xFFD97706),
        mood = OllieMood.STUDYING,
        hintBubble = "Tap any word chip to hear Ollie pronounce it!"
    ),
    TaskGuideStep(
        stepNumber = 3,
        title = "Karaoke Paragraphs 🎶",
        description = "Tap on any paragraph card to listen to that specific section. It lights up in golden karaoke style so you can follow along with Ollie!",
        targetLabel = "PARAGRAPH CARDS",
        icon = Icons.Default.AutoStories,
        accentColor = Color(0xFF7C3AED),
        mood = OllieMood.CELEBRATING,
        hintBubble = "Tap any paragraph card to hear and highlight it!"
    ),
    TaskGuideStep(
        stepNumber = 4,
        title = "Ollie's Smart Tips 💡",
        description = "Look out for Ollie's Smart Tips! They summarize the key rules and quick memory tricks you need before starting your quiz check.",
        targetLabel = "SMART TIPS BOX",
        icon = Icons.Default.Lightbulb,
        accentColor = Color(0xFFF59E0B),
        mood = OllieMood.THINKING,
        hintBubble = "These memory tricks will help you score 100%!"
    ),
    TaskGuideStep(
        stepNumber = 5,
        title = "Practice Check & Stars 🏆",
        description = "Ready to test your skills? Tap the green 'Start Practice Check' button at the bottom to answer 3 quick questions, unlock stars, and collect your +XP!",
        targetLabel = "START PRACTICE CHECK BUTTON",
        icon = Icons.Default.EmojiEvents,
        accentColor = Color(0xFF10B981),
        mood = OllieMood.MOTIVATING,
        hintBubble = "Ace the check to ignite your daily streak!"
    )
)

val DEFAULT_GAME_GUIDE_STEPS = listOf(
    TaskGuideStep(
        stepNumber = 1,
        title = "Climb the Levels 🪜",
        description = "Start at Level 1 and unlock higher challenges as you advance! Each level awards up to 3 Gold Stars and XP towards your badges.",
        targetLabel = "LEVEL LADDER CARDS",
        icon = Icons.Default.EmojiEvents,
        accentColor = Color(0xFFD97706),
        mood = OllieMood.CELEBRATING,
        hintBubble = "Clear Level 1 with 3 stars to unlock Level 2!"
    ),
    TaskGuideStep(
        stepNumber = 2,
        title = "1v1 Speed Race ⚡",
        description = "Tap 'Quick Race' to match instantly with AI bots or real classmates, or create a private Friend Room PIN to race together live!",
        targetLabel = "LIVE BATTLE ARENA",
        icon = Icons.Default.Speed,
        accentColor = Color(0xFF2563EB),
        mood = OllieMood.GREETING,
        hintBubble = "Race friends and see who answers fastest!"
    ),
    TaskGuideStep(
        stepNumber = 3,
        title = "Trophy Badges 🎖️",
        description = "Play games daily to unlock Ghanaian Heritage trophies, like the Oware Grandmaster, Spelling Bee Champion, and Science Pioneer badges!",
        targetLabel = "TROPHIES & REWARDS",
        icon = Icons.Default.Lightbulb,
        accentColor = Color(0xFF059669),
        mood = OllieMood.MOTIVATING,
        hintBubble = "Collect all 5 badges to become a Champion!"
    )
)

/**
 * Interactive step-by-step walkthrough overlay with Professor Ollie.
 * Visually highlights UI sections with glowing borders and contextual mascot explanations.
 */
@Composable
fun TaskInteractiveGuideOverlay(
    steps: List<TaskGuideStep> = DEFAULT_LESSON_GUIDE_STEPS,
    onDismiss: () -> Unit
) {
    var currentStepIndex by remember { mutableIntStateOf(0) }
    val step = steps.getOrElse(currentStepIndex) { steps.first() }
    val isLastStep = currentStepIndex == steps.size - 1

    val infiniteTransition = rememberInfiniteTransition(label = "guide_glow")
    val pulseGlow by infiniteTransition.animateFloat(
        initialValue = 0.6f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(900, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "glow"
    )

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black.copy(alpha = 0.72f))
            .clickable(
                interactionSource = remember { MutableInteractionSource() },
                indication = null,
                onClick = { /* prevent click through */ }
            )
            .padding(16.dp),
        contentAlignment = Alignment.Center
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 4.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Target spotlight badge indicator
            Surface(
                shape = RoundedCornerShape(16.dp),
                color = step.accentColor,
                border = androidx.compose.foundation.BorderStroke(2.dp, Color.White.copy(alpha = pulseGlow)),
                modifier = Modifier.shadow(8.dp, RoundedCornerShape(16.dp))
            ) {
                Row(
                    modifier = Modifier.padding(horizontal = 14.dp, vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Icon(
                        imageVector = step.icon,
                        contentDescription = null,
                        tint = Color.White,
                        modifier = Modifier.size(16.dp)
                    )
                    Text(
                        text = "FOCUS: ${step.targetLabel}",
                        style = MaterialTheme.typography.labelSmall.copy(
                            fontWeight = FontWeight.Black,
                            letterSpacing = 0.8.sp,
                            color = Color.White
                        )
                    )
                }
            }

            // Main Ollie Dialog Card
            Tactile3DCard(
                onClick = {},
                containerColor = Color.White,
                bevelColor = Color(0xFFE2E8F0),
                cornerRadius = 28.dp,
                elevationDepth = 6.dp,
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(20.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    // Header with Step Index and Close Button
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Surface(
                            shape = RoundedCornerShape(10.dp),
                            color = step.accentColor.copy(alpha = 0.12f)
                        ) {
                            Text(
                                text = "STEP ${currentStepIndex + 1} OF ${steps.size}",
                                style = MaterialTheme.typography.labelSmall.copy(
                                    fontWeight = FontWeight.ExtraBold,
                                    color = step.accentColor
                                ),
                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                            )
                        }

                        IconButton(
                            onClick = {
                                TactileSoundSystem.playPopSound()
                                onDismiss()
                            },
                            modifier = Modifier.size(32.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Close,
                                contentDescription = "Close Guide",
                                tint = Color(0xFF64748B)
                            )
                        }
                    }

                    // Mascot + Speech Bubble Row
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(14.dp)
                    ) {
                        OllieMascot(
                            tier = AcademicTier.EXPLORER,
                            mood = step.mood,
                            size = 72.dp
                        )

                        Surface(
                            shape = RoundedCornerShape(18.dp),
                            color = step.accentColor.copy(alpha = 0.08f),
                            border = androidx.compose.foundation.BorderStroke(1.5.dp, step.accentColor.copy(alpha = 0.3f)),
                            modifier = Modifier.weight(1f)
                        ) {
                            Column(modifier = Modifier.padding(12.dp)) {
                                Text(
                                    text = "Professor Ollie says:",
                                    style = MaterialTheme.typography.labelSmall.copy(
                                        fontWeight = FontWeight.Bold,
                                        color = step.accentColor
                                    )
                                )
                                Spacer(modifier = Modifier.height(2.dp))
                                Text(
                                    text = "\"${step.hintBubble}\"",
                                    style = MaterialTheme.typography.bodySmall.copy(
                                        fontWeight = FontWeight.SemiBold,
                                        color = Color(0xFF1E293B)
                                    )
                                )
                            }
                        }
                    }

                    // Title and Description
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text(
                            text = step.title,
                            style = MaterialTheme.typography.titleMedium.copy(
                                fontWeight = FontWeight.Black,
                                fontSize = 18.sp,
                                color = Color(0xFF0F172A)
                            )
                        )
                        Text(
                            text = step.description,
                            style = MaterialTheme.typography.bodyMedium.copy(
                                lineHeight = 21.sp,
                                color = Color(0xFF334155)
                            )
                        )
                    }

                    // Progress Dots
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.Center,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        steps.forEachIndexed { idx, _ ->
                            val isCurrent = idx == currentStepIndex
                            Box(
                                modifier = Modifier
                                    .padding(horizontal = 4.dp)
                                    .size(if (isCurrent) 10.dp else 7.dp)
                                    .clip(CircleShape)
                                    .background(if (isCurrent) step.accentColor else Color(0xFFCBD5E1))
                            )
                        }
                    }

                    // Bottom Navigation Buttons
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        if (currentStepIndex > 0) {
                            Tactile3DButton(
                                text = "Back",
                                onClick = {
                                    TactileSoundSystem.playPopSound()
                                    currentStepIndex -= 1
                                },
                                containerColor = Color(0xFFF1F5F9),
                                bevelColor = Color(0xFFCBD5E1),
                                textColor = Color(0xFF475569),
                                modifier = Modifier.weight(1f).height(48.dp)
                            )
                        } else {
                            Tactile3DButton(
                                text = "Skip Tour",
                                onClick = {
                                    TactileSoundSystem.playPopSound()
                                    onDismiss()
                                },
                                containerColor = Color(0xFFF1F5F9),
                                bevelColor = Color(0xFFCBD5E1),
                                textColor = Color(0xFF64748B),
                                modifier = Modifier.weight(1f).height(48.dp)
                            )
                        }

                        Tactile3DButton(
                            text = if (isLastStep) "Let's Learn! 🚀" else "Next 👉",
                            onClick = {
                                if (isLastStep) {
                                    TactileSoundSystem.playCelebrationBeep()
                                    onDismiss()
                                } else {
                                    TactileSoundSystem.playPopSound()
                                    currentStepIndex += 1
                                }
                            },
                            containerColor = step.accentColor,
                            bevelColor = step.accentColor.copy(alpha = 0.8f),
                            textColor = Color.White,
                            modifier = Modifier.weight(1.4f).height(48.dp)
                        )
                    }
                }
            }
        }
    }
}
