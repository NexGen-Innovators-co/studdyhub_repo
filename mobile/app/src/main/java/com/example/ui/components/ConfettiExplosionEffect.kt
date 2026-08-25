package com.example.ui.components

import androidx.compose.animation.core.*
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.rotate
import kotlin.math.cos
import kotlin.math.sin
import kotlin.random.Random

private data class ConfettiParticle(
    val x: Float,
    val y: Float,
    val vx: Float,
    val vy: Float,
    val size: Float,
    val color: Color,
    val rotation: Float,
    val vRot: Float,
    val isCircle: Boolean
)

/**
 * 🎉 Vibrant Multi-Color Confetti & Star Sparkle Explosion Effect.
 * Automatically animates celebratory confetti burst across the entire screen!
 */
@Composable
fun ConfettiExplosionEffect(
    modifier: Modifier = Modifier,
    particleCount: Int = 90
) {
    val colors = remember {
        listOf(
            Color(0xFFFFD700), // Gold
            Color(0xFFFF5722), // Orange
            Color(0xFF4CAF50), // Green
            Color(0xFF2196F3), // Blue
            Color(0xFFE91E63), // Pink
            Color(0xFF9C27B0), // Purple
            Color(0xFFFFEB3B), // Yellow
            Color(0xFF00E676)  // Emerald
        )
    }

    val particles = remember {
        val random = Random(System.currentTimeMillis())
        List(particleCount) {
            val angle = random.nextDouble(0.0, Math.PI * 2.0)
            val speed = random.nextDouble(300.0, 1100.0).toFloat()
            ConfettiParticle(
                x = 0.5f,
                y = 0.45f,
                vx = (cos(angle) * speed).toFloat(),
                vy = (sin(angle) * speed - 250f).toFloat(), // Upward burst bias
                size = random.nextDouble(8.0, 18.0).toFloat(),
                color = colors.random(random),
                rotation = random.nextFloat() * 360f,
                vRot = (random.nextFloat() - 0.5f) * 720f,
                isCircle = random.nextBoolean()
            )
        }
    }

    val animTime = remember { Animatable(0f) }

    LaunchedEffect(Unit) {
        animTime.animateTo(
            targetValue = 2.5f,
            animationSpec = tween(durationMillis = 2500, easing = LinearEasing)
        )
    }

    val t = animTime.value

    Canvas(modifier = modifier.fillMaxSize()) {
        val width = size.width
        val height = size.height
        val gravity = 980f

        particles.forEach { p ->
            val curX = (p.x * width) + (p.vx * t)
            val curY = (p.y * height) + (p.vy * t) + (0.5f * gravity * t * t)
            val alpha = (1f - (t / 2.5f)).coerceIn(0f, 1f)
            val curRot = p.rotation + (p.vRot * t)

            if (curY in 0f..height + 50f && curX in -50f..width + 50f && alpha > 0.05f) {
                rotate(curRot, pivot = Offset(curX, curY)) {
                    if (p.isCircle) {
                        drawCircle(
                            color = p.color.copy(alpha = alpha),
                            radius = p.size / 2,
                            center = Offset(curX, curY)
                        )
                    } else {
                        drawRect(
                            color = p.color.copy(alpha = alpha),
                            topLeft = Offset(curX - p.size / 2, curY - p.size / 3),
                            size = androidx.compose.ui.geometry.Size(p.size, p.size * 0.7f)
                        )
                    }
                }
            }
        }
    }
}
