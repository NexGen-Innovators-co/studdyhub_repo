package com.example.ui.screens.quizzes

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material.icons.filled.Group
import androidx.compose.material.icons.filled.Lightbulb
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.LocalFireDepartment
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.example.R
import com.example.ui.components.DEFAULT_GAME_GUIDE_STEPS
import com.example.ui.components.OllieMascot
import com.example.ui.components.OllieMood
import com.example.ui.components.Tactile3DButton
import com.example.ui.components.Tactile3DCard
import com.example.ui.components.TactileSoundSystem
import com.example.ui.components.TaskInteractiveGuideOverlay
import com.example.ui.components.studdyPressScale
import com.example.ui.components.tactileClick
import com.example.ui.theme.AcademicTier
import org.json.JSONObject

/** Parses a stars/best-scores JSON map like {"1":3,"2":2} into an Int map. */
private fun parseIntMap(json: String): Map<String, Int> {
    val result = mutableMapOf<String, Int>()
    try {
        val obj = JSONObject(json)
        val keys = obj.keys()
        while (keys.hasNext()) {
            val k = keys.next()
            result[k] = obj.optInt(k, 0)
        }
    } catch (e: Exception) { /* ignore malformed */ }
    return result
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ExplorerGameDetailScreen(
    gameKey: String,
    viewModel: QuizzesViewModel,
    streakCount: Int = 1,
    onBack: () -> Unit = {},
    onLaunchLevel: () -> Unit = {},
    onLaunchSpelling: (Int) -> Unit = {},
    onLaunchSpeedRace: () -> Unit = {}
) {
    val game = EXPLORER_GAMES[normalizeGameKey(gameKey)] ?: EXPLORER_GAMES["maths_quest"]!!
    val context = LocalContext.current
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val progress by viewModel.gameProgress(game.key).collectAsStateWithLifecycle(initialValue = null)

    // Which level the kid tapped while bank/AI questions were being prepared.
    var pendingLevel by remember { mutableStateOf<Int?>(null) }
    var generationError by remember { mutableStateOf<String?>(null) }
    val isGenerating = pendingLevel != null && generationError == null

    val starsByLevel = remember(progress) { parseIntMap(progress?.starsByLevelJson ?: "{}") }
    val unlockedLevel = progress?.unlockedLevel ?: 1
    val totalStars = starsByLevel.values.sum()

    // Speed Race (live): Quick Race = public lobby; Friend Room = private host/join.
    var showFriendRoomDialog by remember { mutableStateOf(false) }
    var friendPin by remember { mutableStateOf("") }

    if (showFriendRoomDialog) {
        AlertDialog(
            onDismissRequest = { showFriendRoomDialog = false },
            title = { Text("Friend Room 👥", fontWeight = FontWeight.Bold) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text(
                        "Create a private room and share the PIN with a friend, or join their room with the PIN they share with you.",
                        style = MaterialTheme.typography.bodyMedium
                    )
                    OutlinedTextField(
                        value = friendPin,
                        onValueChange = { friendPin = it.uppercase().take(6) },
                        label = { Text("Room PIN (blank = create)") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        showFriendRoomDialog = false
                        val pin = friendPin.trim()
                        if (pin.isEmpty()) {
                            // Host a private room — the PIN shows in the lobby to share.
                            viewModel.startSpeedRace(context, game.key, game.title, isPublicLobby = false)
                        } else {
                            // Join a friend's room by PIN.
                            viewModel.startLiveSession(
                                pin = pin,
                                isHost = false,
                                topicName = "${game.title} Speed Race",
                                config = QuizConfig(
                                    topic = game.title,
                                    difficulty = "medium",
                                    questionCount = 5,
                                    timeLimitSec = 60,
                                    advanceMode = "auto",
                                    allowLateJoin = false
                                ),
                                customQuestions = null,
                                speedGameKey = game.key
                            )
                        }
                        onLaunchSpeedRace()
                    }
                ) { Text(if (friendPin.isBlank()) "Create Room" else "Join Room") }
            },
            dismissButton = {
                TextButton(onClick = { showFriendRoomDialog = false }) { Text("Cancel") }
            }
        )
    }

    // Navigate to the runner once the level quiz is ready.
    LaunchedEffect(uiState.activeQuiz?.id, pendingLevel) {
        val lvl = pendingLevel
        if (lvl != null && uiState.activeQuiz != null) {
            pendingLevel = null
            onLaunchLevel()
        }
    }

    // Generation finished without a quiz — surface the REAL reason (the ViewModel
    // logs the exact backend/AI failure) instead of a generic message, and let them retry.
    LaunchedEffect(uiState.isLoading, pendingLevel, uiState.activeQuiz?.id) {
        if (pendingLevel != null && !uiState.isLoading && uiState.activeQuiz == null) {
            pendingLevel = null
            val realError = uiState.userMessage?.takeIf { it.isNotBlank() }
            generationError = realError
                ?: "Ollie couldn't prepare this level. Check your connection and try again."
        }
    }

    fun playLevel(level: ExplorerGameLevel) {
        generationError = null
        pendingLevel = level.index
        viewModel.startExplorerLevel(context, game.key, level.index)
    }

    val guidePrefs = remember { context.getSharedPreferences("studdyhub_task_guide_prefs", android.content.Context.MODE_PRIVATE) }
    var showGameGuide by remember {
        mutableStateOf(!guidePrefs.getBoolean("has_seen_game_guide_${game.key}", false))
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = game.title,
                        style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold)
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onBack, modifier = Modifier.testTag("explorer_game_back_btn")) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    IconButton(
                        onClick = {
                            TactileSoundSystem.playPopSound()
                            showGameGuide = true
                        }
                    ) {
                        Icon(
                            Icons.Default.Lightbulb,
                            contentDescription = "Game Guide",
                            tint = Color(0xFFD97706)
                        )
                    }

                    Surface(
                        shape = RoundedCornerShape(14.dp),
                        color = Color(0xFFFFF7ED),
                        border = BorderStroke(1.dp, Color(0xFFFED7AA)),
                        modifier = Modifier.padding(end = 8.dp)
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            Icon(Icons.Default.LocalFireDepartment, contentDescription = "Streak", tint = Color(0xFFEA580C), modifier = Modifier.size(16.dp))
                            Text("${maxOf(streakCount, 1)}d", fontWeight = FontWeight.Bold, color = Color(0xFFEA580C), fontSize = 12.sp)
                        }
                    }
                }
            )
        }
    ) { innerPadding ->
        Box(modifier = Modifier.fillMaxSize()) {
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding)
                    .padding(horizontal = 18.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
            // Hero Card
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(24.dp),
                    colors = CardDefaults.cardColors(containerColor = game.bgLightColor),
                    border = BorderStroke(1.5.dp, game.primaryColor.copy(alpha = 0.3f))
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(20.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(80.dp)
                                .clip(CircleShape)
                                .background(Color.White),
                            contentAlignment = Alignment.Center
                        ) {
                            Image(
                                painter = painterResource(id = game.drawableId),
                                contentDescription = game.title,
                                modifier = Modifier.size(68.dp).clip(CircleShape),
                                contentScale = ContentScale.Crop
                            )
                        }

                        Text(
                            text = "${game.emoji} ${game.title.uppercase()}",
                            style = MaterialTheme.typography.headlineSmall.copy(
                                fontWeight = FontWeight.ExtraBold,
                                color = Color(0xFF0F172A)
                            )
                        )

                        Surface(
                            shape = RoundedCornerShape(10.dp),
                            color = game.primaryColor
                        ) {
                            Text(
                                text = game.badge,
                                style = MaterialTheme.typography.labelSmall.copy(
                                    fontWeight = FontWeight.ExtraBold,
                                    color = Color.White
                                ),
                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                            )
                        }

                        Text(
                            text = game.description,
                            style = MaterialTheme.typography.bodyMedium.copy(
                                color = Color(0xFF334155),
                                textAlign = TextAlign.Center
                            ),
                            modifier = Modifier.padding(horizontal = 8.dp)
                        )

                        // Progress summary
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.Center,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Surface(
                                shape = RoundedCornerShape(12.dp),
                                color = Color.White.copy(alpha = 0.9f),
                                border = BorderStroke(1.dp, game.primaryColor.copy(alpha = 0.25f))
                            ) {
                                Row(
                                    modifier = Modifier.padding(horizontal = 14.dp, vertical = 8.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                                ) {
                                    Icon(
                                        Icons.Default.Star,
                                        contentDescription = null,
                                        tint = Color(0xFFF59E0B),
                                        modifier = Modifier.size(20.dp)
                                    )
                                    Text(
                                        text = "$totalStars / ${game.totalLevels * 3} stars",
                                        fontWeight = FontWeight.Bold,
                                        color = Color(0xFF0F172A)
                                    )
                                    Text(
                                        text = "· Level $unlockedLevel unlocked",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = Color(0xFF475569)
                                    )
                                }
                            }
                        }
                    }
                }
            }

            // Speed Race (live multiplayer) mode
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(22.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)),
                    border = BorderStroke(1.5.dp, Color(0xFF1D4ED8).copy(alpha = 0.35f))
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Icon(Icons.Default.Bolt, contentDescription = null, tint = Color(0xFF3B82F6))
                            Text(
                                text = "Speed Race ⚡",
                                style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                                color = MaterialTheme.colorScheme.onSurface
                            )
                        }
                        Text(
                            text = "Race other kids online! ⚡ Quick Race matches you instantly with another player. \u2022 Friend Room lets you create a private game and share the PIN.",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            Button(
                                onClick = {
                                    viewModel.startSpeedRace(context, game.key, game.title, isPublicLobby = true)
                                    onLaunchSpeedRace()
                                },
                                modifier = Modifier.weight(1f).height(48.dp),
                                shape = RoundedCornerShape(14.dp),
                                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF2563EB))
                            ) { Text("⚡ Quick Race", fontWeight = FontWeight.Bold) }
                            OutlinedButton(
                                onClick = { showFriendRoomDialog = true },
                                modifier = Modifier.weight(1f).height(48.dp),
                                shape = RoundedCornerShape(14.dp)
                            ) {
                                Icon(Icons.Default.Group, contentDescription = null, modifier = Modifier.size(18.dp))
                                Spacer(modifier = Modifier.width(6.dp))
                                Text("Friend Room", fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            }

            // Generation status card
            if (isGenerating || generationError != null) {
                item {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(20.dp),
                        colors = CardDefaults.cardColors(
                            containerColor = if (generationError != null) {
                                MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.4f)
                            } else {
                                game.primaryColor.copy(alpha = 0.12f)
                            }
                        ),
                        border = BorderStroke(1.dp, game.primaryColor.copy(alpha = 0.35f))
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(16.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(14.dp)
                        ) {
                            if (generationError != null) {
                                Icon(Icons.Default.Warning, contentDescription = null, tint = MaterialTheme.colorScheme.error)
                            } else {
                                CircularProgressIndicator(
                                    modifier = Modifier.size(28.dp),
                                    strokeWidth = 3.dp,
                                    color = game.primaryColor
                                )
                            }
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = generationError ?: "Ollie is preparing the level…",
                                    style = MaterialTheme.typography.titleSmall.copy(
                                        fontWeight = FontWeight.Bold,
                                        color = if (generationError != null) MaterialTheme.colorScheme.error else game.primaryColor
                                    )
                                )
                                Text(
                                    text = if (generationError != null) "Tap PLAY again to retry." else "This can take a few seconds. You'll jump straight into the game.",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)
                                )
                            }
                        }
                    }
                }
            }

            // Level Ladder Header
            item {
                Spacer(modifier = Modifier.height(4.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(
                        text = "Level Journey 🗺️",
                        style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.ExtraBold)
                    )
                    Surface(
                        shape = RoundedCornerShape(12.dp),
                        color = game.primaryColor.copy(alpha = 0.15f)
                    ) {
                        Text(
                            text = "Level $unlockedLevel of ${game.levels.size}",
                            fontWeight = FontWeight.ExtraBold,
                            color = game.primaryColor,
                            fontSize = 12.sp,
                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                        )
                    }
                }
                Spacer(modifier = Modifier.height(2.dp))
                Text(
                    text = "Master each level with 3 stars to conquer the ${game.title} realm!",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(modifier = Modifier.height(6.dp))
            }

            game.levels.forEach { level ->
                val locked = level.index > unlockedLevel
                val isCurrent = level.index == unlockedLevel
                val levelStars = starsByLevel[level.index.toString()] ?: 0
                val isLevelGenerating = pendingLevel == level.index && generationError == null

                item {
                    val baseModifier = Modifier.fillMaxWidth()
                    Card(
                        onClick = {
                            if (!locked && !isGenerating) {
                                if (game.isSpelling) onLaunchSpelling(level.index) else playLevel(level)
                            }
                        },
                        enabled = !locked && !isGenerating,
                        shape = RoundedCornerShape(20.dp),
                        colors = CardDefaults.cardColors(
                            containerColor = when {
                                locked -> MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f)
                                levelStars >= 3 -> Color(0xFFFEF9C3)
                                isCurrent -> game.bgLightColor
                                else -> MaterialTheme.colorScheme.surface
                            }
                        ),
                        border = BorderStroke(
                            width = if (isCurrent) 2.dp else 1.dp,
                            color = when {
                                locked -> Color(0xFFE2E8F0)
                                isCurrent -> game.primaryColor
                                levelStars >= 3 -> Color(0xFFF59E0B)
                                else -> Color(0xFFE2E8F0)
                            }
                        ),
                        modifier = baseModifier
                            .alpha(if (locked) 0.6f else 1f)
                            .studdyPressScale(enabled = !locked && !isGenerating)
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(16.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(14.dp)
                        ) {
                            // Level number badge
                            Box(
                                modifier = Modifier
                                    .size(48.dp)
                                    .clip(RoundedCornerShape(14.dp))
                                    .background(
                                        when {
                                            locked -> Color(0xFFCBD5E1)
                                            levelStars >= 3 -> Color(0xFFF59E0B)
                                            isCurrent -> game.primaryColor
                                            else -> game.primaryColor.copy(alpha = 0.15f)
                                        }
                                    ),
                                contentAlignment = Alignment.Center
                            ) {
                                if (locked) {
                                    Icon(
                                        Icons.Default.Lock,
                                        contentDescription = "Locked",
                                        tint = Color(0xFF64748B),
                                        modifier = Modifier.size(22.dp)
                                    )
                                } else {
                                    Text(
                                        text = level.index.toString(),
                                        style = MaterialTheme.typography.titleMedium.copy(
                                            fontWeight = FontWeight.Black,
                                            color = if (levelStars >= 3 || isCurrent) Color.White else game.primaryColor
                                        )
                                    )
                                }
                            }

                            // Level Info
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = level.name,
                                    fontWeight = FontWeight.Bold,
                                    style = MaterialTheme.typography.titleMedium,
                                    color = if (locked) Color(0xFF94A3B8) else MaterialTheme.colorScheme.onSurface
                                )
                                Text(
                                    text = "${level.difficulty.replaceFirstChar { it.uppercase() }} · ${level.questionCount} questions · +${level.xpReward} XP",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                                Spacer(modifier = Modifier.height(4.dp))
                                Row(horizontalArrangement = Arrangement.spacedBy(3.dp)) {
                                    (1..3).forEach { s ->
                                        Icon(
                                            Icons.Default.Star,
                                            contentDescription = null,
                                            tint = if (s <= levelStars) Color(0xFFF59E0B) else Color(0xFFCBD5E1),
                                            modifier = Modifier.size(18.dp)
                                        )
                                    }
                                }
                            }

                            // Action button
                            if (isLevelGenerating) {
                                CircularProgressIndicator(
                                    modifier = Modifier.size(28.dp),
                                    strokeWidth = 3.dp,
                                    color = game.primaryColor
                                )
                            } else if (!locked) {
                                Surface(
                                    shape = RoundedCornerShape(12.dp),
                                    color = if (isCurrent) game.primaryColor else game.primaryColor.copy(alpha = 0.15f),
                                    modifier = Modifier.testTag("explorer_level_${level.index}_play")
                                ) {
                                    Row(
                                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                                    ) {
                                        Text(
                                            text = if (isCurrent) "PLAY 🚀" else "TRY 🔄",
                                            fontWeight = FontWeight.ExtraBold,
                                            color = if (isCurrent) Color.White else game.primaryColor,
                                            fontSize = 12.sp
                                        )
                                    }
                                }
                            } else {
                                Text(
                                    text = "LOCKED",
                                    fontWeight = FontWeight.Bold,
                                    color = Color(0xFF94A3B8),
                                    fontSize = 11.sp
                                )
                            }
                        }
                    }
                }
            }

            // Ollie Mascot Cheer Banner
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(20.dp),
                    colors = CardDefaults.cardColors(containerColor = game.primaryColor.copy(alpha = 0.1f))
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(14.dp)
                    ) {
                        OllieMascot(
                            tier = AcademicTier.EXPLORER,
                            mood = OllieMood.CELEBRATING,
                            size = 64.dp
                        )
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = "Ollie's Pro Tip! 💡",
                                style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold, color = game.primaryColor)
                            )
                            Text(
                                text = "Win all three stars to become a ${game.title} Master! Playing daily keeps your streak alive and boosts your ranking.",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.8f)
                            )
                        }
                    }
                }
                Spacer(modifier = Modifier.height(40.dp))
            }
        }

        // Interactive Spotlight Walkthrough with Professor Ollie
        if (showGameGuide) {
            TaskInteractiveGuideOverlay(
                steps = DEFAULT_GAME_GUIDE_STEPS,
                onDismiss = {
                    showGameGuide = false
                    guidePrefs.edit().putBoolean("has_seen_game_guide_${game.key}", true).apply()
                }
            )
        }
    }
}
}
