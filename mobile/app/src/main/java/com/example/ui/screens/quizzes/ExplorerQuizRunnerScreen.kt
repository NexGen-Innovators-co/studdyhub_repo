package com.example.ui.screens.quizzes

import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
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
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.example.ui.components.Tactile3DButton
import com.example.ui.components.Tactile3DCard
import com.example.ui.components.TactileSoundSystem
import com.example.ui.components.tactileClick
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * 🎮 Super-Gamified Explorer Quiz Arena.
 * Features:
 * - 3 Lives / Hearts HUD with heart crack animation
 * - Dynamic Combo Streak Multiplier (🔥 2X / 3X / 4X)
 * - Animated rolling Star & Coin HUD
 * - 50/50 & Hint Power-Ups
 * - 4 Giant 3D Kahoot-style Shape Answer Buttons (Red Triangle, Blue Diamond, Yellow Circle, Green Square)
 * - Kahoot Celebration Screen with sound, trophy & confetti!
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ExplorerQuizRunnerScreen(
    viewModel: QuizzesViewModel,
    onBack: () -> Unit = {}
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val quiz = uiState.activeQuiz
    val questions = remember(quiz) { parseQuizQuestionsJson(quiz?.questionsJson ?: "") }

    var currentIndex by rememberSaveable { mutableIntStateOf(0) }
    var score by rememberSaveable { mutableIntStateOf(0) }
    var starsEarned by rememberSaveable { mutableIntStateOf(0) }
    var comboCount by rememberSaveable { mutableIntStateOf(0) }
    var lives by rememberSaveable { mutableIntStateOf(3) }
    var hiddenOptions by rememberSaveable { mutableStateOf(setOf<Int>()) }

    var selectedIndex by rememberSaveable { mutableStateOf<Int?>(null) }
    var isAnswered by rememberSaveable { mutableStateOf(false) }
    var isFinished by rememberSaveable { mutableStateOf(false) }
    // Track wrong answers for post-quiz review
    var wrongAnswers by remember { mutableStateOf(listOf<WrongAnswerItem>()) }

    val coroutineScope = rememberCoroutineScope()
    var burstKey by remember { mutableIntStateOf(0) }

    val currentQ = questions.getOrNull(currentIndex)

    val multiplier = when {
        comboCount >= 4 -> 4
        comboCount >= 2 -> 2
        else -> 1
    }

    // Rolling animated stars HUD
    val animatedStars by animateIntAsState(
        targetValue = starsEarned,
        animationSpec = tween(durationMillis = 600, easing = FastOutSlowInEasing),
        label = "animatedStars"
    )

    fun useFiftyFifty() {
        if (hiddenOptions.isNotEmpty() || currentQ == null) return
        val wrongIndices = currentQ.options.indices.filter { it != currentQ.correctIndex }
        hiddenOptions = wrongIndices.shuffled().take(2).toSet()
        TactileSoundSystem.playPopSound()
    }

    fun answerTap(idx: Int) {
        if (isAnswered || lives <= 0) return
        isAnswered = true
        selectedIndex = idx
        val isCorrect = idx == currentQ?.correctIndex

        if (isCorrect) {
            score++
            comboCount++
            val pts = 20 * multiplier
            starsEarned += pts
            burstKey++
            TactileSoundSystem.playCorrectSound()
            TactileSoundSystem.playCoinSound()
        } else {
            comboCount = 0
            lives = (lives - 1).coerceAtLeast(0)
            TactileSoundSystem.playWrongSound()
            // Track wrong answer for review
            if (currentQ != null) {
                wrongAnswers = wrongAnswers + WrongAnswerItem(
                    question = currentQ.question,
                    userAnswer = currentQ.options.getOrElse(idx) { "?" },
                    correctAnswer = currentQ.options.getOrElse(currentQ.correctIndex) { "?" },
                    explanation = currentQ.explanation
                )
            }
        }

        coroutineScope.launch {
            delay(if (isCorrect) 800L else 1400L)
            if (lives <= 0 || currentIndex + 1 >= questions.size) {
                isFinished = true
                TactileSoundSystem.playCelebrationBeep()
            } else {
                currentIndex++
                isAnswered = false
                selectedIndex = null
                hiddenOptions = emptySet()
            }
        }
    }

    if (isFinished) {
        GamifiedResultArena(
            score = score,
            total = questions.size,
            stars = starsEarned,
            livesLeft = lives,
            burstKey = burstKey,
            wrongAnswers = wrongAnswers,
            onFinish = {
                viewModel.finishQuiz(score, questions.size, 60)
                onBack()
            },
            onRetry = {
                currentIndex = 0
                score = 0
                starsEarned = 0
                comboCount = 0
                lives = 3
                selectedIndex = null
                isAnswered = false
                isFinished = false
                hiddenOptions = emptySet()
            }
        )
        return
    }

    Scaffold(
        containerColor = Color.Transparent,
        topBar = {
            TopAppBar(
                title = {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        // Lives HUD
                        Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                            repeat(3) { i ->
                                Text(
                                    text = if (i < lives) "❤️" else "🖤",
                                    fontSize = 18.sp
                                )
                            }
                        }

                        // Combo Streak Multiplier
                        if (comboCount >= 2) {
                            Surface(
                                shape = RoundedCornerShape(12.dp),
                                color = Color(0xFFFF7A00),
                                border = BorderStroke(1.dp, Color(0xFFFFD700))
                            ) {
                                Text(
                                    text = "🔥 ${multiplier}X COMBO!",
                                    style = MaterialTheme.typography.labelSmall.copy(
                                        fontWeight = FontWeight.ExtraBold,
                                        color = Color.White
                                    ),
                                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                                )
                            }
                        }

                        // Star HUD
                        Surface(
                            shape = RoundedCornerShape(16.dp),
                            color = Color(0xFFFFD700),
                            border = BorderStroke(1.5.dp, Color(0xFFB45309))
                        ) {
                            Row(
                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(4.dp)
                            ) {
                                Text("⭐", fontSize = 14.sp)
                                Text(
                                    text = "$animatedStars",
                                    style = MaterialTheme.typography.labelMedium.copy(
                                        fontWeight = FontWeight.ExtraBold,
                                        color = Color(0xFF78350F)
                                    )
                                )
                            }
                        }
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Exit", tint = Color.White)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Color(0xFF1E1B4B))
            )
        }
    ) { innerPadding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    Brush.verticalGradient(
                        listOf(Color(0xFF1E1B4B), Color(0xFF312E81), Color(0xFF1E3A8A))
                    )
                )
                .padding(innerPadding)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(horizontal = 18.dp, vertical = 10.dp),
                verticalArrangement = Arrangement.SpaceBetween
            ) {
                // Progress Bar
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(
                            text = "Question ${currentIndex + 1} of ${questions.size}",
                            style = MaterialTheme.typography.labelMedium.copy(
                                fontWeight = FontWeight.Bold,
                                color = Color.White.copy(alpha = 0.8f)
                            )
                        )
                        Text(
                            text = "${((currentIndex + 1) * 100) / questions.size.coerceAtLeast(1)}%",
                            style = MaterialTheme.typography.labelSmall.copy(
                                color = Color(0xFF38BDF8),
                                fontWeight = FontWeight.ExtraBold
                            )
                        )
                    }
                    LinearProgressIndicator(
                        progress = { (currentIndex + 1).toFloat() / questions.size.coerceAtLeast(1) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(8.dp)
                            .clip(RoundedCornerShape(4.dp)),
                        color = Color(0xFFFF7A00),
                        trackColor = Color.White.copy(alpha = 0.15f)
                    )
                }

                // Question Card in 3D
                Tactile3DCard(
                    onClick = {},
                    containerColor = Color.White,
                    bevelColor = Color(0xFFCBD5E1),
                    cornerRadius = 24.dp,
                    elevationDepth = 6.dp,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(20.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text(
                            text = currentQ?.question ?: "Loading next challenge...",
                            style = MaterialTheme.typography.titleLarge.copy(
                                fontWeight = FontWeight.ExtraBold,
                                color = Color(0xFF0F172A),
                                fontSize = 19.sp,
                                lineHeight = 26.sp
                            ),
                            textAlign = TextAlign.Center
                        )
                    }
                }

                // Power-Up Bar (50/50 & Hint)
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Tactile3DButton(
                        text = if (hiddenOptions.isEmpty()) "50/50 💡" else "USED ⚡",
                        onClick = { useFiftyFifty() },
                        containerColor = Color(0xFF8B5CF6),
                        bevelColor = Color(0xFF6D28D9),
                        enabled = hiddenOptions.isEmpty(),
                        modifier = Modifier.weight(1f)
                    )
                }

                // 4 Chunky 3D Kahoot-style Answer Buttons
                val buttonThemes = listOf(
                    Triple(Color(0xFFEF4444), Color(0xFFB91C1C), "▲ Red Triangle"),
                    Triple(Color(0xFF3B82F6), Color(0xFF1D4ED8), "◆ Blue Diamond"),
                    Triple(Color(0xFFF59E0B), Color(0xFFB45309), "● Yellow Circle"),
                    Triple(Color(0xFF10B981), Color(0xFF047857), "■ Green Square")
                )

                Column(
                    modifier = Modifier.fillMaxWidth(),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    currentQ?.options?.chunked(2)?.forEachIndexed { rowIndex, pair ->
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            pair.forEachIndexed { colIndex, option ->
                                val optIndex = rowIndex * 2 + colIndex
                                val isHidden = hiddenOptions.contains(optIndex)
                                val theme = buttonThemes.getOrElse(optIndex) { buttonThemes[0] }

                                val isChosen = selectedIndex == optIndex
                                val isCorrect = optIndex == currentQ.correctIndex

                                val buttonColor = when {
                                    isAnswered && isCorrect -> Color(0xFF22C55E)
                                    isAnswered && isChosen -> Color(0xFFEF4444)
                                    else -> theme.first
                                }
                                val bevelColor = when {
                                    isAnswered && isCorrect -> Color(0xFF15803D)
                                    isAnswered && isChosen -> Color(0xFF991B1B)
                                    else -> theme.second
                                }

                                if (isHidden) {
                                    Spacer(modifier = Modifier.weight(1f))
                                } else {
                                    Tactile3DCard(
                                        onClick = { answerTap(optIndex) },
                                        containerColor = buttonColor,
                                        bevelColor = bevelColor,
                                        cornerRadius = 20.dp,
                                        elevationDepth = 6.dp,
                                        enabled = !isAnswered,
                                        modifier = Modifier.weight(1f)
                                    ) {
                                        Column(
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .padding(horizontal = 10.dp, vertical = 14.dp),
                                            horizontalAlignment = Alignment.CenterHorizontally,
                                            verticalArrangement = Arrangement.Center
                                        ) {
                                            Text(
                                                text = option,
                                                style = MaterialTheme.typography.bodyMedium.copy(
                                                    fontWeight = FontWeight.ExtraBold,
                                                    color = Color.White,
                                                    fontSize = 13.sp,
                                                    lineHeight = 17.sp
                                                ),
                                                textAlign = TextAlign.Center,
                                                maxLines = 4,
                                                minLines = 1
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.height(10.dp))
            }
        }
    }
}

/**
 * 🏆 Kahoot/Duolingo-style Celebration Finish Screen.
 */
@Composable
fun GamifiedResultArena(
    score: Int,
    total: Int,
    stars: Int,
    livesLeft: Int,
    burstKey: Int,
    wrongAnswers: List<WrongAnswerItem> = emptyList(),
    onFinish: () -> Unit,
    onRetry: () -> Unit
) {
    val percent = if (total > 0) (score * 100) / total else 0
    val starRating = when {
        percent >= 80 -> 3
        percent >= 50 -> 2
        else -> 1
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    colors = listOf(Color(0xFF1E1B4B), Color(0xFF0F172A), Color(0xFF020617))
                )
            ),
        contentAlignment = Alignment.Center
    ) {
        // Floating celebration stars background
        Canvas(modifier = Modifier.fillMaxSize()) {
            val colors = listOf(Color(0xFFFFD700), Color(0xFFFF7A00), Color(0xFF10B981), Color(0xFF38BDF8), Color(0xFFF43F5E))
            for (i in 0 until 40) {
                val x = (i * 97 % size.width.toInt()).toFloat()
                val y = (i * 131 % size.height.toInt()).toFloat()
                val color = colors[i % colors.size]
                drawCircle(
                    color = color.copy(alpha = 0.4f),
                    radius = (i % 5 + 3).toFloat(),
                    center = Offset(x, y)
                )
            }
        }

        Tactile3DCard(
            onClick = {},
            containerColor = Color(0xFF1E1B4B),
            bevelColor = Color(0xFF0F172A),
            cornerRadius = 28.dp,
            elevationDepth = 8.dp,
            modifier = Modifier
                .fillMaxWidth(0.92f)
                .padding(16.dp)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // 3D Gold Showcase Pedestal for Top Performer
                Box(
                    modifier = Modifier
                        .size(100.dp)
                        .clip(CircleShape)
                        .background(
                            Brush.radialGradient(
                                colors = listOf(Color(0xFFFDE047), Color(0xFFD97706))
                            )
                        )
                        .border(3.dp, Color(0xFFFEF08A), CircleShape),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = if (starRating >= 3) "👑" else if (starRating >= 2) "🥈" else "🥉",
                        fontSize = 48.sp
                    )
                }

                Text(
                    text = if (starRating >= 3) "🏆 VICTORY CHAMPION!" else if (starRating >= 2) "🎉 GREAT JOB!" else "💪 GOOD TRY!",
                    style = MaterialTheme.typography.headlineSmall.copy(
                        fontWeight = FontWeight.ExtraBold,
                        color = Color.White
                    ),
                    textAlign = TextAlign.Center
                )

                // 3 Big Stars
                Row(horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                    repeat(3) { i ->
                        val filled = i < starRating
                        Icon(
                            imageVector = Icons.Default.Star,
                            contentDescription = null,
                            tint = if (filled) Color(0xFFFFD700) else Color.White.copy(alpha = 0.2f),
                            modifier = Modifier.size(44.dp)
                        )
                    }
                }

                // Stats Row with Tactile Cards
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Tactile3DCard(
                        onClick = {},
                        containerColor = Color(0xFF312E81),
                        bevelColor = Color(0xFF1E1B4B),
                        cornerRadius = 16.dp,
                        elevationDepth = 4.dp,
                        modifier = Modifier.weight(1f)
                    ) {
                        Column(
                            modifier = Modifier.fillMaxWidth().padding(12.dp),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Text(
                                "$score / $total",
                                style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.ExtraBold, color = Color.White)
                            )
                            Text("Accuracy", color = Color.White.copy(alpha = 0.7f), fontSize = 12.sp)
                        }
                    }

                    Tactile3DCard(
                        onClick = {},
                        containerColor = Color(0xFF312E81),
                        bevelColor = Color(0xFF1E1B4B),
                        cornerRadius = 16.dp,
                        elevationDepth = 4.dp,
                        modifier = Modifier.weight(1f)
                    ) {
                        Column(
                            modifier = Modifier.fillMaxWidth().padding(12.dp),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Text(
                                "+$stars ⭐",
                                style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.ExtraBold, color = Color(0xFFFFD700))
                            )
                            Text("Coins Earned 🪙", color = Color.White.copy(alpha = 0.7f), fontSize = 12.sp)
                        }
                    }
                }

                Spacer(modifier = Modifier.height(8.dp))

                // Wrong Answers Review
                if (wrongAnswers.isNotEmpty()) {
                    Surface(
                        shape = RoundedCornerShape(14.dp),
                        color = Color(0xFFEF4444).copy(alpha = 0.15f),
                        border = BorderStroke(1.dp, Color(0xFFEF4444).copy(alpha = 0.3f)),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(modifier = Modifier.padding(14.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Default.Cancel, contentDescription = null, tint = Color(0xFFEF4444), modifier = Modifier.size(18.dp))
                                Spacer(modifier = Modifier.width(6.dp))
                                Text("${wrongAnswers.size} Wrong — Review Below", fontWeight = FontWeight.ExtraBold, color = Color.White, fontSize = 13.sp)
                            }
                            Spacer(modifier = Modifier.height(8.dp))
                            wrongAnswers.forEachIndexed { idx, item ->
                                if (idx > 0) Spacer(modifier = Modifier.height(6.dp))
                                Column {
                                    Text(item.question, fontWeight = FontWeight.Bold, color = Color.White, fontSize = 12.sp, lineHeight = 16.sp)
                                    Spacer(modifier = Modifier.height(2.dp))
                                    Text("Your answer: ${item.userAnswer}", color = Color(0xFFFCA5A5), fontSize = 11.sp)
                                    Text("Correct: ${item.correctAnswer}", color = Color(0xFF86EFAC), fontWeight = FontWeight.Bold, fontSize = 11.sp)
                                }
                            }
                        }
                    }
                }

                Tactile3DButton(
                    text = "CONTINUE JOURNEY 🚀",
                    onClick = onFinish,
                    containerColor = Color(0xFFFF7A00),
                    bevelColor = Color(0xFFC45500),
                    modifier = Modifier.fillMaxWidth().height(52.dp)
                )

                TextButton(
                    onClick = onRetry,
                    modifier = Modifier.height(48.dp)
                ) {
                    Text("Play Again 🔁", color = Color.White.copy(alpha = 0.85f), fontWeight = FontWeight.Bold, fontSize = 15.sp)
                }
            }
        }
    }
}
