package com.example.ui.components

import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.R
import com.example.ui.theme.EmeraldAccent
import com.example.ui.theme.IndigoPrimary
import com.example.ui.theme.VioletTertiary

@Composable
fun ProfessorOllieLoader(
    message: String,
    modifier: Modifier = Modifier
) {
    // Elegant pulsing and rotating animations for Professor Ollie's magic orb
    val infiniteTransition = rememberInfiniteTransition(label = "pulse")
    
    val rotation by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = 360f,
        animationSpec = infiniteRepeatable(
            animation = tween(4000, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "rotation"
    )

    val scale by infiniteTransition.animateFloat(
        initialValue = 0.95f,
        targetValue = 1.05f,
        animationSpec = infiniteRepeatable(
            animation = tween(1200, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "scale"
    )

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(Color.Black.copy(alpha = 0.65f))
            .padding(24.dp),
        contentAlignment = Alignment.Center
    ) {
        Card(
            shape = RoundedCornerShape(24.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
            modifier = Modifier
                .fillMaxWidth(0.85f)
                .graphicsLayer {
                    scaleX = scale
                    scaleY = scale
                }
                .border(
                    width = 2.dp,
                    brush = Brush.sweepGradient(
                        colors = listOf(IndigoPrimary, VioletTertiary, EmeraldAccent, IndigoPrimary)
                    ),
                    shape = RoundedCornerShape(24.dp)
                )
        ) {
            Column(
                modifier = Modifier.padding(28.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(20.dp)
            ) {
                // High-Fidelity Animated Glowing Ollie Image Container
                Box(
                    contentAlignment = Alignment.Center,
                    modifier = Modifier.size(96.dp)
                ) {
                    // Outer rotating rainbow gradient halo
                    Box(
                        modifier = Modifier
                            .size(96.dp)
                            .graphicsLayer { rotationZ = rotation }
                            .clip(CircleShape)
                            .border(
                                width = 3.dp,
                                brush = Brush.sweepGradient(
                                    listOf(
                                        Color(0xFFF59E0B),
                                        Color(0xFF10B981),
                                        Color(0xFF6366F1),
                                        Color(0xFFEC4899),
                                        Color(0xFFF59E0B)
                                    )
                                ),
                                shape = CircleShape
                            )
                    )

                    // Ollie Mascot Portrait Image
                    Image(
                        painter = painterResource(id = R.drawable.img_prof_ollie_1786717163116),
                        contentDescription = "Professor Ollie",
                        modifier = Modifier
                            .size(82.dp)
                            .clip(CircleShape)
                            .border(2.dp, Color.White, CircleShape),
                        contentScale = ContentScale.Crop
                    )

                    // Sparkle Accent Badge
                    Surface(
                        shape = CircleShape,
                        color = Color(0xFF10B981),
                        border = BorderStroke(1.5.dp, Color.White),
                        modifier = Modifier
                            .size(26.dp)
                            .align(Alignment.TopEnd)
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Icon(
                                imageVector = Icons.Default.AutoAwesome,
                                contentDescription = null,
                                tint = Color.White,
                                modifier = Modifier.size(16.dp)
                            )
                        }
                    }
                }

                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text(
                        text = "Professor Ollie",
                        fontWeight = FontWeight.Bold,
                        style = MaterialTheme.typography.titleMedium,
                        color = IndigoPrimary
                    )
                    
                    Text(
                        text = "StuddyHub AI TUTOR",
                        style = MaterialTheme.typography.labelSmall.copy(
                            letterSpacing = 1.5.sp,
                            fontWeight = FontWeight.ExtraBold,
                            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.4f)
                        )
                    )
                }

                // Smooth linear progress indicator
                LinearProgressIndicator(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(6.dp)
                        .clip(RoundedCornerShape(3.dp)),
                    color = IndigoPrimary,
                    trackColor = IndigoPrimary.copy(alpha = 0.15f)
                )

                Text(
                    text = message.ifBlank { "Professor Ollie is synthesizing your study materials..." },
                    style = MaterialTheme.typography.bodyMedium.copy(lineHeight = 20.sp),
                    textAlign = TextAlign.Center,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.8f),
                    modifier = Modifier.padding(horizontal = 8.dp)
                )
            }
        }
    }
}
