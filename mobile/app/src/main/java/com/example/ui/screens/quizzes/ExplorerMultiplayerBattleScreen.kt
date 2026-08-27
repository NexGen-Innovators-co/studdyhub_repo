package com.example.ui.screens.quizzes

import android.widget.Toast
import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.example.ui.components.Avatar3DRenderer
import com.example.ui.components.Tactile3DButton
import com.example.ui.components.Tactile3DCard
import com.example.ui.components.TactileSoundSystem
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

private val battleGradient = Brush.verticalGradient(
    listOf(
        Color(0xFFFF5722),
        Color(0xFFFF9800),
        Color(0xFFFFC107)
    )
)

data class ExplorerBattleTopic(
    val id: String,
    val title: String,
    val emoji: String,
    val description: String,
    val color: Color
)

val EXPLORER_BATTLE_TOPICS = listOf(
    ExplorerBattleTopic("maths_quest", "Galaxy Math 🪐", "🪐", "Fast addition, subtraction & multiplication challenges!", Color(0xFF3B82F6)),
    ExplorerBattleTopic("science_explorer", "Science Sparks 🔬", "🔬", "Cool experiments, space, and nature secrets!", Color(0xFF10B981)),
    ExplorerBattleTopic("kente_quiz", "Heritage Bowl 🧶", "🧶", "Ghanaian history, culture & national pride!", Color(0xFFF59E0B)),
    ExplorerBattleTopic("ananse_riddles", "Ananse Riddles 🕷️", "🕷️", "Logic puzzles & brain teasers!", Color(0xFF8B5CF6)),
    ExplorerBattleTopic("spelling_bee", "Word Master 🐝", "🐝", "Fun vocabulary, rhymes & spelling!", Color(0xFFEC4899))
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ExplorerMultiplayerBattleScreen(
    viewModel: QuizzesViewModel,
    onBack: () -> Unit = {}
) {
    val context = LocalContext.current
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val session = uiState.activeLiveSession
    val coroutineScope = rememberCoroutineScope()

    var showCreateDialog by remember { mutableStateOf(false) }
    var showJoinDialog by remember { mutableStateOf(false) }
    var joinPinInput by remember { mutableStateOf("") }
    var selectedTopic by remember { mutableStateOf(EXPLORER_BATTLE_TOPICS.first()) }
    var selectedDifficulty by remember { mutableStateOf("medium") }
    var selectedQuestionCount by remember { mutableIntStateOf(5) }
    var timeLimitSec by remember { mutableIntStateOf(15) }
    var isStartingMatch by remember { mutableStateOf(false) }
    var isCreatingRoom by remember { mutableStateOf(false) }
    var isJoiningRoom by remember { mutableStateOf(false) }
    var publicLobbies by remember { mutableStateOf<List<LiveLobbyItem>>(emptyList()) }
    var loadingLobbies by remember { mutableStateOf(true) }
    val snackbarHostState = remember { SnackbarHostState() }

    // Load public lobbies on screen entry and refresh every 8 seconds
    LaunchedEffect(Unit) {
        loadingLobbies = true
        publicLobbies = viewModel.activeLobbiesFromServer.value
        loadingLobbies = false
        while (true) {
            delay(8000)
            publicLobbies = viewModel.activeLobbiesFromServer.value
            loadingLobbies = false
        }
    }

    // Show error feedback when battle creation/join fails
    LaunchedEffect(uiState.userMessage) {
        uiState.userMessage?.let { msg ->
            snackbarHostState.showSnackbar(msg, duration = SnackbarDuration.Short)
            viewModel.clearUserMessage()
        }
    }

    // Reset loading flags when session activates (success) or loading stops without session (error)
    LaunchedEffect(uiState.isLoading, session) {
        if (session != null) {
            isStartingMatch = false
            isCreatingRoom = false
            isJoiningRoom = false
        } else if (!uiState.isLoading && (isStartingMatch || isCreatingRoom || isJoiningRoom)) {
            // Loading finished but no session created — likely an error. Show feedback.
            val errorMsg = uiState.userMessage ?: "Something went wrong. Please try again."
            snackbarHostState.showSnackbar(errorMsg, duration = SnackbarDuration.Short)
            viewModel.clearUserMessage()
            isStartingMatch = false
            isCreatingRoom = false
            isJoiningRoom = false
        }
    }

    // If there is an active session, render the interactive Live Session Runner
    if (session != null) {
        SpeedRaceScreen(
            viewModel = viewModel,
            onBack = {
                viewModel.exitLiveSession()
                onBack()
            }
        )
        return
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = "⚔️ 1v1 Battle Arena",
                        fontWeight = FontWeight.ExtraBold
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = Color.Transparent
                )
            )
        },
        snackbarHost = { SnackbarHost(snackbarHostState) },
        containerColor = MaterialTheme.colorScheme.background
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // ── Hero Banner ──
            Tactile3DCard(
                onClick = {},
                containerColor = Color(0xFFFF5722),
                bevelColor = Color(0xFFD84315),
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
                        text = "⚡ VS ARENA ⚡",
                        style = MaterialTheme.typography.labelMedium.copy(
                            fontWeight = FontWeight.Black,
                            color = Color(0xFFFFE082),
                            letterSpacing = 1.5.sp
                        )
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = "Real-Time Quiz Battles!",
                        style = MaterialTheme.typography.headlineSmall.copy(
                            fontWeight = FontWeight.ExtraBold,
                            color = Color.White
                        ),
                        textAlign = TextAlign.Center
                    )
                    Spacer(modifier = Modifier.height(6.dp))
                    Text(
                        text = "Challenge classmates or race random players to win Stars & climb the Leaderboard! 🌟",
                        style = MaterialTheme.typography.bodySmall.copy(
                            color = Color.White.copy(alpha = 0.9f)
                        ),
                        textAlign = TextAlign.Center
                    )
                }
            }

            // ── Open Public Battles ──
            if (publicLobbies.isNotEmpty()) {
                Text(
                    text = "🔥 Open Battles",
                    style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.ExtraBold),
                    modifier = Modifier.fillMaxWidth()
                )
                publicLobbies.forEach { lobby ->
                    Tactile3DCard(
                        onClick = {
                            if (isJoiningRoom || isStartingMatch) return@Tactile3DCard
                            TactileSoundSystem.playPopSound()
                            isJoiningRoom = true
                            viewModel.startLiveSession(pin = lobby.pin, isHost = false, topicName = lobby.topic)
                        },
                        containerColor = Color(0xFFF97316),
                        bevelColor = Color(0xFFC2410C),
                        cornerRadius = 18.dp,
                        elevationDepth = 3.dp,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth().padding(14.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            Surface(shape = CircleShape, color = Color.White.copy(alpha = 0.2f), modifier = Modifier.size(44.dp)) {
                                Box(contentAlignment = Alignment.Center) { Text("🎮", fontSize = 22.sp) }
                            }
                            Column(modifier = Modifier.weight(1f)) {
                                Text(lobby.topic, fontWeight = FontWeight.ExtraBold, color = Color.White, style = MaterialTheme.typography.titleSmall)
                                Text("PIN: ${lobby.pin} • Tap to join!", style = MaterialTheme.typography.bodySmall, color = Color.White.copy(alpha = 0.85f))
                            }
                            Icon(Icons.Default.PlayArrow, contentDescription = "Join", tint = Color.White, modifier = Modifier.size(24.dp))
                        }
                    }
                }
            } else if (loadingLobbies) {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp),
                    horizontalArrangement = Arrangement.Center,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Looking for open battles…", style = MaterialTheme.typography.bodySmall, color = Color(0xFF64748B))
                }
            } else {
                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = Color(0xFFF8FAFC),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Text("🔍", fontSize = 18.sp)
                        Text(
                            text = "No open battles right now. Tap \"Create Battle Room\" to host one!",
                            style = MaterialTheme.typography.bodySmall.copy(color = Color(0xFF64748B))
                        )
                    }
                }
            }

            // ── Quick Match explanation banner ──
            Surface(
                shape = RoundedCornerShape(14.dp),
                color = Color(0xFF22C55E).copy(alpha = 0.08f),
                border = BorderStroke(1.dp, Color(0xFF22C55E).copy(alpha = 0.2f)),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp),
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("💡", fontSize = 18.sp)
                    Text(
                        text = "Quick Match instantly finds another player online and starts a 5-question Math Race. Win to earn Stars!",
                        style = MaterialTheme.typography.bodySmall.copy(color = Color(0xFF15803D)),
                        modifier = Modifier.weight(1f)
                    )
                }
            }

            // ── Quick Match Loading Overlay ──
            if (isStartingMatch) {
                Surface(
                    shape = RoundedCornerShape(16.dp),
                    color = Color(0xFF22C55E).copy(alpha = 0.15f),
                    border = BorderStroke(1.dp, Color(0xFF22C55E).copy(alpha = 0.4f)),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 18.dp, vertical = 14.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        CircularProgressIndicator(modifier = Modifier.size(24.dp), strokeWidth = 2.5.dp, color = Color(0xFF22C55E))
                        Column(modifier = Modifier.weight(1f)) {
                            Text("Finding opponent…", fontWeight = FontWeight.ExtraBold, color = Color(0xFF22C55E), style = MaterialTheme.typography.titleSmall)
                            Text("Professor Ollie is searching for players!", style = MaterialTheme.typography.bodySmall, color = Color(0xFF64748B))
                        }
                    }
                }
            }

            // ── Action Mode 1: Quick Match (Instant 1-Tap) ──
            Tactile3DCard(
                onClick = {
                    if (isStartingMatch) return@Tactile3DCard
                    TactileSoundSystem.playPopSound()
                    isStartingMatch = true
                    viewModel.startSpeedRace(context, "maths_quest", "Maths Quest", true)
                },
                containerColor = if (isStartingMatch) Color(0xFF86EFAC) else Color(0xFF22C55E),
                bevelColor = Color(0xFF15803D),
                cornerRadius = 22.dp,
                elevationDepth = 5.dp,
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(18.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    if (isStartingMatch) {
                        CircularProgressIndicator(modifier = Modifier.size(54.dp), strokeWidth = 3.dp, color = Color.White)
                    } else {
                        Surface(
                            shape = RoundedCornerShape(16.dp),
                            color = Color.White.copy(alpha = 0.25f),
                            modifier = Modifier.size(54.dp)
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                Text("⚡", fontSize = 28.sp)
                            }
                        }
                    }

                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = if (isStartingMatch) "Matching…" else "Quick Match",
                            style = MaterialTheme.typography.titleMedium.copy(
                                fontWeight = FontWeight.ExtraBold,
                                color = Color.White
                            )
                        )
                        Text(
                            text = if (isStartingMatch) "Connecting you to live players!" else "Find an opponent & start in 3 seconds!",
                            style = MaterialTheme.typography.bodySmall.copy(
                                color = Color.White.copy(alpha = 0.9f)
                            )
                        )
                    }

                    if (!isStartingMatch) {
                        Icon(
                            imageVector = Icons.Default.PlayArrow,
                            contentDescription = "Play",
                            tint = Color.White,
                            modifier = Modifier.size(28.dp)
                        )
                    }
                }
            }

            // ── Action Mode 2: Create Custom Room (Host) ──
            Tactile3DCard(
                onClick = {
                    if (isCreatingRoom || isStartingMatch) return@Tactile3DCard
                    TactileSoundSystem.playPopSound()
                    showCreateDialog = true
                },
                containerColor = Color(0xFF3B82F6),
                bevelColor = Color(0xFF1D4ED8),
                cornerRadius = 22.dp,
                elevationDepth = 5.dp,
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(18.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    Surface(
                        shape = RoundedCornerShape(16.dp),
                        color = Color.White.copy(alpha = 0.25f),
                        modifier = Modifier.size(54.dp)
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Text("👑", fontSize = 28.sp)
                        }
                    }

                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = "Create Battle Room",
                            style = MaterialTheme.typography.titleMedium.copy(
                                fontWeight = FontWeight.ExtraBold,
                                color = Color.White
                            )
                        )
                        Text(
                            text = "Pick a topic & get a PIN for friends!",
                            style = MaterialTheme.typography.bodySmall.copy(
                                color = Color.White.copy(alpha = 0.9f)
                            )
                        )
                    }

                    Icon(
                        imageVector = Icons.Default.AddCircle,
                        contentDescription = "Create",
                        tint = Color.White,
                        modifier = Modifier.size(28.dp)
                    )
                }
            }

            // ── Action Mode 3: Join Room with PIN ──
            Tactile3DCard(
                onClick = {
                    if (isJoiningRoom || isStartingMatch) return@Tactile3DCard
                    TactileSoundSystem.playPopSound()
                    showJoinDialog = true
                },
                containerColor = Color(0xFF8B5CF6),
                bevelColor = Color(0xFF6D28D9),
                cornerRadius = 22.dp,
                elevationDepth = 5.dp,
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(18.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    Surface(
                        shape = RoundedCornerShape(16.dp),
                        color = Color.White.copy(alpha = 0.25f),
                        modifier = Modifier.size(54.dp)
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Text("🎮", fontSize = 28.sp)
                        }
                    }

                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = "Join with Game PIN",
                            style = MaterialTheme.typography.titleMedium.copy(
                                fontWeight = FontWeight.ExtraBold,
                                color = Color.White
                            )
                        )
                        Text(
                            text = "Type your friend's 4-digit code to enter!",
                            style = MaterialTheme.typography.bodySmall.copy(
                                color = Color.White.copy(alpha = 0.9f)
                            )
                        )
                    }

                    Icon(
                        imageVector = Icons.Default.Login,
                        contentDescription = "Join",
                        tint = Color.White,
                        modifier = Modifier.size(28.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(20.dp))
        }
    }

    // ── Create Battle Room Dialog ──
    if (showCreateDialog) {
        AlertDialog(
            onDismissRequest = { showCreateDialog = false },
            title = {
                Text(
                    text = "👑 Create Battle Room",
                    fontWeight = FontWeight.ExtraBold
                )
            },
            text = {
                Column(
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .heightIn(max = 450.dp)
                        .verticalScroll(rememberScrollState())
                ) {
                    Text(
                        text = "Choose Battle Topic:",
                        style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold)
                    )

                    EXPLORER_BATTLE_TOPICS.forEach { topic ->
                        val isSelected = selectedTopic.id == topic.id
                        Tactile3DCard(
                            onClick = {
                                selectedTopic = topic
                                TactileSoundSystem.playPopSound()
                            },
                            containerColor = if (isSelected) topic.color.copy(alpha = 0.15f) else Color.White,
                            bevelColor = if (isSelected) topic.color else Color(0xFFE2E8F0),
                            cornerRadius = 16.dp,
                            elevationDepth = if (isSelected) 4.dp else 2.dp,
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Row(
                                modifier = Modifier.padding(12.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(12.dp)
                            ) {
                                Text(topic.emoji, fontSize = 24.sp)
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        text = topic.title,
                                        style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold, color = if (isSelected) topic.color else Color(0xFF1E293B))
                                    )
                                    Text(
                                        text = topic.description,
                                        style = MaterialTheme.typography.labelSmall.copy(color = Color(0xFF64748B))
                                    )
                                }
                                if (isSelected) {
                                    Icon(Icons.Default.CheckCircle, contentDescription = "Selected", tint = topic.color)
                                }
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = "Battle Difficulty:",
                        style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold)
                    )
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        listOf(
                            Triple("easy", "🟢 Explorer", Color(0xFF10B981)),
                            Triple("medium", "🟡 Master", Color(0xFFF59E0B)),
                            Triple("hard", "🔴 Legend", Color(0xFFEF4444))
                        ).forEach { (diffKey, label, color) ->
                            val isSelected = selectedDifficulty == diffKey
                            Surface(
                                shape = RoundedCornerShape(10.dp),
                                color = if (isSelected) color.copy(alpha = 0.2f) else MaterialTheme.colorScheme.surfaceVariant,
                                border = BorderStroke(if (isSelected) 1.5.dp else 0.dp, if (isSelected) color else Color.Transparent),
                                modifier = Modifier
                                    .weight(1f)
                                    .clickable { selectedDifficulty = diffKey }
                            ) {
                                Box(
                                    modifier = Modifier.padding(vertical = 8.dp),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text(
                                        text = label,
                                        style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold),
                                        color = if (isSelected) color else MaterialTheme.colorScheme.onSurface
                                    )
                                }
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = "Number of Questions:",
                        style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold)
                    )
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        listOf(5, 10).forEach { count ->
                            val isSelected = selectedQuestionCount == count
                            Surface(
                                shape = RoundedCornerShape(10.dp),
                                color = if (isSelected) Color(0xFF6366F1) else MaterialTheme.colorScheme.surfaceVariant,
                                modifier = Modifier
                                    .weight(1f)
                                    .clickable { selectedQuestionCount = count }
                            ) {
                                Box(
                                    modifier = Modifier.padding(vertical = 8.dp),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text(
                                        text = "$count Questions 🎯",
                                        fontWeight = FontWeight.Bold,
                                        style = MaterialTheme.typography.labelMedium,
                                        color = if (isSelected) Color.White else MaterialTheme.colorScheme.onSurface
                                    )
                                }
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = "Time Per Question:",
                        style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold)
                    )
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        listOf(15, 20, 30, 60).forEach { sec ->
                            val isSelected = timeLimitSec == sec
                            Surface(
                                shape = RoundedCornerShape(10.dp),
                                color = if (isSelected) Color(0xFF3B82F6) else MaterialTheme.colorScheme.surfaceVariant,
                                modifier = Modifier
                                    .weight(1f)
                                    .clickable { timeLimitSec = sec }
                            ) {
                                Box(
                                    modifier = Modifier.padding(vertical = 8.dp),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text(
                                        text = "${sec}s",
                                        fontWeight = FontWeight.Bold,
                                        color = if (isSelected) Color.White else MaterialTheme.colorScheme.onSurface
                                    )
                                }
                            }
                        }
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        if (isCreatingRoom) return@Button
                        isCreatingRoom = true
                        showCreateDialog = false
                        TactileSoundSystem.playCelebrationBeep()
                        viewModel.startSpeedRace(
                            context = context,
                            gameKey = selectedTopic.id,
                            gameTitle = selectedTopic.title,
                            isPublicLobby = false,
                            difficulty = selectedDifficulty,
                            timeLimitSec = timeLimitSec,
                            questionCount = selectedQuestionCount
                        )
                    },
                    enabled = !isCreatingRoom
                ) {
                    if (isCreatingRoom) {
                        CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp, color = Color.White)
                        Spacer(modifier = Modifier.width(8.dp))
                    }
                    Text(if (isCreatingRoom) "Setting up…" else "Start Room 🚀")
                }
            },
            dismissButton = {
                TextButton(onClick = { showCreateDialog = false }) {
                    Text("Cancel")
                }
            }
        )
    }

    // ── Join Room with PIN Dialog ──
    if (showJoinDialog) {
        AlertDialog(
            onDismissRequest = { showJoinDialog = false },
            title = {
                Text(
                    text = "🎮 Enter Game PIN",
                    fontWeight = FontWeight.ExtraBold
                )
            },
            text = {
                Column(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    Text(
                        text = "Ask your friend or teacher for the 4-digit PIN!",
                        style = MaterialTheme.typography.bodySmall,
                        color = Color(0xFF64748B),
                        textAlign = TextAlign.Center
                    )

                    OutlinedTextField(
                        value = joinPinInput,
                        onValueChange = { if (it.length <= 6) joinPinInput = it.filter { ch -> ch.isLetterOrDigit() } },
                        placeholder = { Text("e.g. 4821") },
                        singleLine = true,
                        textStyle = MaterialTheme.typography.headlineMedium.copy(
                            fontWeight = FontWeight.Black,
                            textAlign = TextAlign.Center,
                            letterSpacing = 4.sp
                        ),
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        if (joinPinInput.isNotBlank() && !isJoiningRoom) {
                            isJoiningRoom = true
                            showJoinDialog = false
                            TactileSoundSystem.playCelebrationBeep()
                            viewModel.startLiveSession(pin = joinPinInput.trim(), isHost = false, topicName = "Multiplayer Arena")
                        } else {
                            Toast.makeText(context, "Please enter a PIN", Toast.LENGTH_SHORT).show()
                        }
                    },
                    enabled = joinPinInput.isNotBlank() && !isJoiningRoom
                ) {
                    if (isJoiningRoom) {
                        CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp, color = Color.White)
                        Spacer(modifier = Modifier.width(8.dp))
                    }
                    Text(if (isJoiningRoom) "Joining…" else "Join Match ⚔️")
                }
            },
            dismissButton = {
                TextButton(onClick = { showJoinDialog = false }) {
                    Text("Cancel")
                }
            }
        )
    }
}
