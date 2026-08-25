package com.example.ui.screens.quizzes

import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.R
import com.example.ui.components.ConfettiExplosionEffect
import com.example.ui.components.GameAudioEngine
import com.example.ui.components.Tactile3DButton
import com.example.ui.components.Tactile3DCard
import com.example.ui.components.TactileSoundSystem
import com.example.ui.components.tactileClick
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlin.random.Random

data class MathAsteroid(
    val id: Long,
    val num1: Int,
    val num2: Int,
    val operator: String,
    val answer: Int,
    val wrongOptions: List<Int>,
    var yProgress: Float = 0f, // 0.0 top -> 1.0 bottom crash
    val color: Color = Color(0xFFEF4444)
) {
    val equationText: String get() = "$num1 $operator $num2"
}

/**
 * 🚀 Math Asteroid Blaster (Falling Equation Shoot-'em-up Game).
 * Kids defend the earth/castle by tapping the laser cannons to shoot descending asteroids!
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MathAsteroidBlasterGameScreen(
    onBack: () -> Unit = {},
    onLevelCompleted: (Int, Int) -> Unit = { _, _ -> }
) {
    var score by remember { mutableIntStateOf(0) }
    var streakMultiplier by remember { mutableIntStateOf(1) }
    var shieldsLeft by remember { mutableIntStateOf(3) }
    var currentRound by remember { mutableIntStateOf(1) }
    val totalRounds = 8

    var isGameOver by remember { mutableStateOf(false) }
    var isVictory by remember { mutableStateOf(false) }
    var isShootingLaser by remember { mutableStateOf(false) }
    var laserTargetAnswer by remember { mutableStateOf<Int?>(null) }
    var isExploding by remember { mutableStateOf(false) }
    var explosionCenter by remember { mutableStateOf(Offset.Zero) }

    // Generate balanced random math problems
    fun generateAsteroid(round: Int): MathAsteroid {
        val op = if (round <= 3) "+" else if (round <= 6) "-" else "×"
        val (n1, n2, ans) = when (op) {
            "+" -> {
                val a = (2..15).random()
                val b = (1..15).random()
                Triple(a, b, a + b)
            }
            "-" -> {
                val a = (6..25).random()
                val b = (1 until a).random()
                Triple(a, b, a - b)
            }
            else -> {
                val a = (2..8).random()
                val b = (2..6).random()
                Triple(a, b, a * b)
            }
        }
        val options = mutableSetOf(ans)
        while (options.size < 4) {
            val delta = (-5..5).filter { it != 0 }.random()
            val fake = (ans + delta).coerceAtLeast(0)
            options.add(fake)
        }
        return MathAsteroid(
            id = System.currentTimeMillis(),
            num1 = n1,
            num2 = n2,
            operator = op,
            answer = ans,
            wrongOptions = options.shuffled()
        )
    }

    var currentAsteroid by remember { mutableStateOf(generateAsteroid(1)) }
    var asteroidY by remember { mutableFloatStateOf(0.12f) }

    // Descending asteroid ticker
    LaunchedEffect(currentRound, isGameOver, isVictory) {
        if (!isGameOver && !isVictory) {
            asteroidY = 0.12f
            while (asteroidY < 0.78f && !isGameOver && !isVictory) {
                delay(40L)
                val speed = 0.0035f + (currentRound * 0.0004f)
                asteroidY += speed
            }
            // Asteroid hit the defense shield!
            if (asteroidY >= 0.78f && !isGameOver && !isVictory) {
                GameAudioEngine.playDamageBuzzer()
                shieldsLeft--
                streakMultiplier = 1
                if (shieldsLeft <= 0) {
                    isGameOver = true
                } else {
                    if (currentRound < totalRounds) {
                        currentRound++
                        currentAsteroid = generateAsteroid(currentRound)
                        asteroidY = 0.12f
                    } else {
                        isVictory = true
                        GameAudioEngine.playVictoryFanfare()
                    }
                }
            }
        }
    }

    fun onAnswerClicked(chosenAnswer: Int) {
        if (isGameOver || isVictory || isShootingLaser) return

        if (chosenAnswer == currentAsteroid.answer) {
            // Correct Laser Hit!
            isShootingLaser = true
            laserTargetAnswer = chosenAnswer
            GameAudioEngine.playLaserShoot()

            kotlinx.coroutines.CoroutineScope(kotlinx.coroutines.Dispatchers.Main).launch {
                delay(120L)
                GameAudioEngine.playExplosion()
                isExploding = true
                score += (100 * streakMultiplier) + ((0.78f - asteroidY) * 100).toInt().coerceAtLeast(10)
                streakMultiplier = (streakMultiplier + 1).coerceAtMost(4)

                delay(300L)
                isShootingLaser = false
                isExploding = false
                if (currentRound < totalRounds) {
                    currentRound++
                    currentAsteroid = generateAsteroid(currentRound)
                    asteroidY = 0.12f
                } else {
                    isVictory = true
                    GameAudioEngine.playVictoryFanfare()
                }
            }
        } else {
            // Wrong answer penalty
            GameAudioEngine.playDamageBuzzer()
            streakMultiplier = 1
            shieldsLeft = (shieldsLeft - 1).coerceAtLeast(0)
            if (shieldsLeft == 0) {
                isGameOver = true
            }
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text("Math Asteroid Blaster 🚀", fontWeight = FontWeight.ExtraBold, fontSize = 16.sp)
                            Text("Round $currentRound of $totalRounds · Multiplier x$streakMultiplier", style = MaterialTheme.typography.labelSmall, color = Color(0xFFF59E0B))
                        }

                        // Shield Hearts
                        Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                            repeat(3) { i ->
                                Text(
                                    text = if (i < shieldsLeft) "❤️" else "🖤",
                                    fontSize = 18.sp
                                )
                            }
                        }
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                }
            )
        }
    ) { innerPadding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .background(
                    Brush.verticalGradient(
                        colors = listOf(
                            Color(0xFF0F172A),
                            Color(0xFF1E1B4B),
                            Color(0xFF311042),
                            Color(0xFF0B192C)
                        )
                    )
                )
        ) {
            // Star field particles background
            Canvas(modifier = Modifier.fillMaxSize()) {
                val r = java.util.Random(1337)
                repeat(40) {
                    drawCircle(
                        color = Color.White.copy(alpha = r.nextFloat() * 0.7f + 0.2f),
                        radius = r.nextFloat() * 2f + 1f,
                        center = Offset(r.nextFloat() * size.width, r.nextFloat() * size.height)
                    )
                }
            }

            Column(
                modifier = Modifier.fillMaxSize(),
                verticalArrangement = Arrangement.SpaceBetween,
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                // Top Score & Multiplier HUD
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 20.dp, vertical = 8.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Surface(
                        shape = RoundedCornerShape(14.dp),
                        color = Color(0xFFFFD700).copy(alpha = 0.2f),
                        border = androidx.compose.foundation.BorderStroke(1.5.dp, Color(0xFFFFD700))
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Text("⭐", fontSize = 16.sp)
                            Text("$score PTS", fontWeight = FontWeight.ExtraBold, color = Color(0xFFFFD700), fontSize = 15.sp)
                        }
                    }

                    if (streakMultiplier > 1) {
                        Surface(
                            shape = RoundedCornerShape(14.dp),
                            color = Color(0xFFFF7A00)
                        ) {
                            Text(
                                text = "🔥 x$streakMultiplier COMBO",
                                fontWeight = FontWeight.ExtraBold,
                                color = Color.White,
                                fontSize = 12.sp,
                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)
                            )
                        }
                    }
                }

                // Asteroid Falling Space Arena
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f),
                    contentAlignment = Alignment.TopCenter
                ) {
                    // Descending Meteor Object
                    if (!isGameOver && !isVictory && !isExploding) {
                        val infiniteRotation = rememberInfiniteTransition(label = "meteor_spin")
                        val spinAngle by infiniteRotation.animateFloat(
                            initialValue = 0f,
                            targetValue = 360f,
                            animationSpec = infiniteRepeatable(tween(4000, easing = LinearEasing)),
                            label = "spin"
                        )

                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .fillMaxHeight(asteroidY)
                                .wrapContentHeight(align = Alignment.Bottom)
                                .padding(bottom = 8.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Tactile3DCard(
                                onClick = {},
                                containerColor = Color(0xFFDC2626),
                                bevelColor = Color(0xFF991B1B),
                                cornerRadius = 32.dp,
                                elevationDepth = 8.dp,
                                modifier = Modifier.size(130.dp, 80.dp)
                            ) {
                                Column(
                                    modifier = Modifier.fillMaxSize(),
                                    horizontalAlignment = Alignment.CenterHorizontally,
                                    verticalArrangement = Arrangement.Center
                                ) {
                                    Text("☄️ METEOR", fontSize = 11.sp, fontWeight = FontWeight.ExtraBold, color = Color(0xFFFDE047))
                                    Text(
                                        text = "${currentAsteroid.equationText} = ?",
                                        style = MaterialTheme.typography.titleLarge.copy(
                                            fontWeight = FontWeight.Black,
                                            color = Color.White,
                                            fontSize = 24.sp
                                        )
                                    )
                                }
                            }
                        }
                    }

                    // Explosion Blast Animation
                    if (isExploding) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .fillMaxHeight(asteroidY)
                                .wrapContentHeight(align = Alignment.Bottom),
                            contentAlignment = Alignment.Center
                        ) {
                            Text("💥", fontSize = 90.sp)
                        }
                    }

                    // Laser Beam Shoot Path
                    if (isShootingLaser) {
                        Canvas(modifier = Modifier.fillMaxSize()) {
                            drawLine(
                                color = Color(0xFF38BDF8),
                                start = Offset(size.width / 2, size.height - 40f),
                                end = Offset(size.width / 2, size.height * asteroidY),
                                strokeWidth = 14f,
                                cap = androidx.compose.ui.graphics.StrokeCap.Round
                            )
                            drawLine(
                                color = Color.White,
                                start = Offset(size.width / 2, size.height - 40f),
                                end = Offset(size.width / 2, size.height * asteroidY),
                                strokeWidth = 6f,
                                cap = androidx.compose.ui.graphics.StrokeCap.Round
                            )
                        }
                    }
                }

                // Bottom Laser Cannon Control Pad (4 Target Answer Pods)
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Color(0xFF0F172A).copy(alpha = 0.9f))
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        text = "🔫 TAP LASER CANNON TO FIRE:",
                        style = MaterialTheme.typography.labelSmall.copy(
                            fontWeight = FontWeight.ExtraBold,
                            color = Color(0xFF94A3B8),
                            letterSpacing = 1.sp
                        )
                    )

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        currentAsteroid.wrongOptions.take(2).forEach { opt ->
                            Tactile3DButton(
                                text = "🎯 $opt",
                                onClick = { onAnswerClicked(opt) },
                                containerColor = Color(0xFF2563EB),
                                bevelColor = Color(0xFF1D4ED8),
                                modifier = Modifier.weight(1f).height(54.dp)
                            )
                        }
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        currentAsteroid.wrongOptions.drop(2).take(2).forEach { opt ->
                            Tactile3DButton(
                                text = "🎯 $opt",
                                onClick = { onAnswerClicked(opt) },
                                containerColor = Color(0xFF2563EB),
                                bevelColor = Color(0xFF1D4ED8),
                                modifier = Modifier.weight(1f).height(54.dp)
                            )
                        }
                    }
                }
            }

            // Confetti and Victory / Game Over Overlays
            if (isVictory) {
                ConfettiExplosionEffect()
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(Color.Black.copy(alpha = 0.75f))
                        .padding(20.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Tactile3DCard(
                        onClick = {},
                        containerColor = Color(0xFF1E1B4B),
                        bevelColor = Color(0xFF0F172A),
                        cornerRadius = 28.dp,
                        elevationDepth = 8.dp,
                        modifier = Modifier.fillMaxWidth(0.92f)
                    ) {
                        Column(
                            modifier = Modifier.fillMaxWidth().padding(24.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(16.dp)
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(96.dp)
                                    .clip(CircleShape)
                                    .background(
                                        Brush.radialGradient(
                                            colors = listOf(Color(0xFFFDE047), Color(0xFFD97706))
                                        )
                                    )
                                    .border(3.dp, Color(0xFFFEF08A), CircleShape),
                                contentAlignment = Alignment.Center
                            ) {
                                Text("👑", fontSize = 48.sp)
                            }

                            Text(
                                text = "🏆 Mission Accomplished!",
                                style = MaterialTheme.typography.headlineSmall.copy(
                                    fontWeight = FontWeight.ExtraBold,
                                    color = Color.White
                                ),
                                textAlign = TextAlign.Center
                            )

                            Text(
                                text = "All asteroids destroyed! Earth base defense intact.",
                                style = MaterialTheme.typography.bodyMedium,
                                color = Color.White.copy(alpha = 0.85f),
                                textAlign = TextAlign.Center
                            )

                            Tactile3DCard(
                                onClick = {},
                                containerColor = Color(0xFF312E81),
                                bevelColor = Color(0xFF1E1B4B),
                                cornerRadius = 16.dp,
                                elevationDepth = 4.dp,
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Row(
                                    modifier = Modifier.fillMaxWidth().padding(14.dp),
                                    horizontalArrangement = Arrangement.Center,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text(
                                        text = "+$score PTS ⭐",
                                        style = MaterialTheme.typography.titleLarge.copy(
                                            fontWeight = FontWeight.ExtraBold,
                                            color = Color(0xFFFFD700)
                                        )
                                    )
                                }
                            }

                            Spacer(modifier = Modifier.height(4.dp))

                            Tactile3DButton(
                                text = "CLAIM REWARDS 🎉",
                                onClick = {
                                    onLevelCompleted(score, 3)
                                    onBack()
                                },
                                containerColor = Color(0xFF10B981),
                                bevelColor = Color(0xFF047857),
                                modifier = Modifier.fillMaxWidth().height(52.dp)
                            )
                        }
                    }
                }
            } else if (isGameOver) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(Color.Black.copy(alpha = 0.75f))
                        .padding(20.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Tactile3DCard(
                        onClick = {},
                        containerColor = Color(0xFF1E1B4B),
                        bevelColor = Color(0xFF0F172A),
                        cornerRadius = 28.dp,
                        elevationDepth = 8.dp,
                        modifier = Modifier.fillMaxWidth(0.92f)
                    ) {
                        Column(
                            modifier = Modifier.fillMaxWidth().padding(24.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(16.dp)
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(88.dp)
                                    .clip(CircleShape)
                                    .background(Color(0xFFEF4444).copy(alpha = 0.2f))
                                    .border(2.dp, Color(0xFFEF4444), CircleShape),
                                contentAlignment = Alignment.Center
                            ) {
                                Text("🛡️", fontSize = 44.sp)
                            }

                            Text(
                                text = "💥 Shield Depleted!",
                                style = MaterialTheme.typography.headlineSmall.copy(
                                    fontWeight = FontWeight.ExtraBold,
                                    color = Color(0xFFFCA5A5)
                                ),
                                textAlign = TextAlign.Center
                            )

                            Text(
                                text = "The asteroids breached your defense shield. Repair lasers and try again!",
                                style = MaterialTheme.typography.bodyMedium,
                                color = Color.White.copy(alpha = 0.85f),
                                textAlign = TextAlign.Center
                            )

                            Tactile3DCard(
                                onClick = {},
                                containerColor = Color(0xFF312E81),
                                bevelColor = Color(0xFF1E1B4B),
                                cornerRadius = 16.dp,
                                elevationDepth = 4.dp,
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Row(
                                    modifier = Modifier.fillMaxWidth().padding(12.dp),
                                    horizontalArrangement = Arrangement.Center,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text(
                                        text = "Earned: $score PTS",
                                        style = MaterialTheme.typography.titleMedium.copy(
                                            fontWeight = FontWeight.Bold,
                                            color = Color.White
                                        )
                                    )
                                }
                            }

                            Spacer(modifier = Modifier.height(4.dp))

                            Tactile3DButton(
                                text = "TRY AGAIN 🔄",
                                onClick = {
                                    shieldsLeft = 3
                                    score = 0
                                    streakMultiplier = 1
                                    currentRound = 1
                                    isGameOver = false
                                    currentAsteroid = generateAsteroid(1)
                                    asteroidY = 0.12f
                                },
                                containerColor = Color(0xFFFF7A00),
                                bevelColor = Color(0xFFC45500),
                                modifier = Modifier.fillMaxWidth().height(52.dp)
                            )
                        }
                    }
                }
            }
        }
    }
}
