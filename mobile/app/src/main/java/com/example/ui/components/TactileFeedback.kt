package com.example.ui.components

import android.media.AudioManager
import android.media.ToneGenerator
import android.view.SoundEffectConstants
import android.view.View
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

/**
 * Sound and Haptic Controller for 3D Tactile Kids & Student UI.
 * All tone synthesis is dispatched off the UI thread to guarantee 60fps animations.
 */
object TactileSoundSystem {
    private var toneGenerator: ToneGenerator? = null
    private val audioScope = CoroutineScope(Dispatchers.Default + SupervisorJob())

    /** Persisted SFX enabled state — read once, updated via [setSoundEnabled]. */
    var isSoundEnabled: Boolean = true
        private set

    init {
        try {
            toneGenerator = ToneGenerator(AudioManager.STREAM_MUSIC, 70)
        } catch (_: Exception) {}
    }

    /** Call on app start to restore persisted preference. */
    fun restoreSoundPreference(context: android.content.Context) {
        isSoundEnabled = context.getSharedPreferences("studdyhub_session", android.content.Context.MODE_PRIVATE)
            .getBoolean("sfx_enabled", true)
    }

    fun setSoundPreference(context: android.content.Context, enabled: Boolean) {
        isSoundEnabled = enabled
        context.getSharedPreferences("studdyhub_session", android.content.Context.MODE_PRIVATE)
            .edit().putBoolean("sfx_enabled", enabled).apply()
    }

    fun playPopSound(view: View? = null) {
        if (!isSoundEnabled) { view?.playSoundEffect(SoundEffectConstants.CLICK); return }
        view?.playSoundEffect(SoundEffectConstants.CLICK)
        audioScope.launch {
            try {
                toneGenerator?.startTone(ToneGenerator.TONE_PROP_BEEP, 35)
            } catch (_: Exception) {}
        }
    }

    fun playCelebrationBeep() {
        if (!isSoundEnabled) return
        audioScope.launch {
            try {
                GameAudioEngine.playVictoryFanfare()
            } catch (_: Exception) {
                try {
                    toneGenerator?.startTone(ToneGenerator.TONE_CDMA_ALERT_CALL_GUARD, 80)
                } catch (_: Exception) {}
            }
        }
    }

    fun playCorrectSound() {
        if (!isSoundEnabled) return
        audioScope.launch {
            try {
                GameAudioEngine.playStarChime()
            } catch (_: Exception) {
                try {
                    toneGenerator?.startTone(ToneGenerator.TONE_CDMA_ALERT_NETWORK_LITE, 100)
                } catch (_: Exception) {}
            }
        }
    }

    fun playWrongSound() {
        if (!isSoundEnabled) return
        audioScope.launch {
            try {
                GameAudioEngine.playDamageBuzzer()
            } catch (_: Exception) {
                try {
                    toneGenerator?.startTone(ToneGenerator.TONE_PROP_NACK, 120)
                } catch (_: Exception) {}
            }
        }
    }

    fun playCoinSound() {
        if (!isSoundEnabled) return
        audioScope.launch {
            try {
                GameAudioEngine.playWordCrushPop(1)
            } catch (_: Exception) {
                try {
                    toneGenerator?.startTone(ToneGenerator.TONE_CDMA_PIP, 45)
                } catch (_: Exception) {}
            }
        }
    }

    fun playLevelUpSound() {
        if (!isSoundEnabled) return
        audioScope.launch {
            try {
                GameAudioEngine.playVictoryFanfare()
            } catch (_: Exception) {
                try {
                    toneGenerator?.startTone(ToneGenerator.TONE_CDMA_HIGH_L, 160)
                } catch (_: Exception) {}
            }
        }
    }
}

/**
 * 3D Tactile Clay/Chunky Button for Explorer (Basic School) UI.
 * Gives deep skeuomorphic bottom extrusion that visibly presses down with sound & haptics!
 */
@Composable
fun Tactile3DCard(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    containerColor: Color = Color(0xFFE0E7FF),
    bevelColor: Color = Color(0xFF818CF8),
    cornerRadius: Dp = 22.dp,
    elevationDepth: Dp = 6.dp,
    enabled: Boolean = true,
    content: @Composable BoxScope.() -> Unit
) {
    val haptic = LocalHapticFeedback.current
    val view = LocalView.current
    val interactionSource = remember { MutableInteractionSource() }
    val isPressed by interactionSource.collectIsPressedAsState()

    val effectiveDepth = if (enabled) elevationDepth else 2.dp
    val topOffset by animateDpAsState(
        targetValue = if (isPressed && enabled) effectiveDepth else 0.dp,
        animationSpec = tween(durationMillis = 60),
        label = "pressOffset"
    )

    Box(
        modifier = modifier.padding(bottom = effectiveDepth),
        contentAlignment = Alignment.Center
    ) {
        // Bottom bevel shadow (3D physical extrusion)
        Box(
            modifier = Modifier
                .matchParentSize()
                .offset(y = effectiveDepth)
                .clip(RoundedCornerShape(cornerRadius))
                .background(bevelColor)
        )

        // Top interactive surface background + click handler
        Box(
            modifier = Modifier
                .matchParentSize()
                .offset(y = topOffset)
                .clip(RoundedCornerShape(cornerRadius))
                .background(containerColor)
                .border(
                    width = 1.dp,
                    color = Color.White.copy(alpha = 0.35f),
                    shape = RoundedCornerShape(cornerRadius)
                )
                .clickable(
                    interactionSource = interactionSource,
                    indication = null,
                    enabled = enabled
                ) {
                    haptic.performHapticFeedback(HapticFeedbackType.LongPress)
                    TactileSoundSystem.playPopSound(view)
                    onClick()
                }
        )

        // Content layer
        Box(
            modifier = Modifier
                .offset(y = topOffset),
            contentAlignment = Alignment.Center,
            content = content
        )
    }
}

/**
 * Chunky 3D Push Button with Text / Icon.
 */
@Composable
fun Tactile3DButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    icon: (@Composable () -> Unit)? = null,
    containerColor: Color = Color(0xFFFF7A00),
    bevelColor: Color = Color(0xFFC45500),
    textColor: Color = Color.White,
    cornerRadius: Dp = 16.dp,
    elevationDepth: Dp = 4.dp,
    enabled: Boolean = true
) {
    Tactile3DCard(
        onClick = onClick,
        modifier = modifier,
        containerColor = if (enabled) containerColor else Color(0xFFCBD5E1),
        bevelColor = if (enabled) bevelColor else Color(0xFF94A3B8),
        cornerRadius = cornerRadius,
        elevationDepth = elevationDepth,
        enabled = enabled
    ) {
        Row(
            modifier = Modifier
                .padding(horizontal = 14.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.Center
        ) {
            if (icon != null) {
                icon()
                Spacer(modifier = Modifier.width(6.dp))
            }
            Text(
                text = text,
                style = MaterialTheme.typography.labelLarge.copy(
                    fontWeight = FontWeight.ExtraBold,
                    color = if (enabled) textColor else Color(0xFF64748B),
                    fontSize = 13.sp
                )
            )
        }
    }
}

/**
 * Modifier for 3D press physics on buttons.
 */
@Composable
fun Modifier.tactileClick(
    onClick: () -> Unit,
    hapticType: HapticFeedbackType = HapticFeedbackType.TextHandleMove
): Modifier {
    val haptic = LocalHapticFeedback.current
    val view = LocalView.current
    return this.then(
        Modifier
            .studdyPressScale()
            .clickable {
                haptic.performHapticFeedback(hapticType)
                TactileSoundSystem.playPopSound(view)
                onClick()
            }
    )
}
