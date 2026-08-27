package com.example.ui.screens.quizzes

import androidx.compose.animation.*
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.material3.pulltorefresh.rememberPullToRefreshState
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.example.R
import com.example.data.local.entities.QuizAttemptEntity
import com.example.data.local.entities.QuizEntity
import com.example.ui.components.ProfessorOllieLoader
import com.example.ui.components.TactileSoundSystem
import com.example.ui.components.tactileClick
import com.example.ui.theme.AcademicTier
import com.example.ui.theme.StuddyHubThemeTokens
import com.example.ui.theme.EmeraldAccent
import com.example.ui.theme.tierAccent
import com.example.ui.theme.tierPrimary
import com.example.ui.theme.tierQuizSubtitle
import com.example.ui.theme.tierQuizTitle
import com.example.ui.theme.tierSecondary
import com.example.ui.theme.tierTertiary
import com.example.ui.theme.tierTutorDisplayName
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject

data class QuizQuestionItem(
    val question: String,
    val options: List<String>,
    val correctIndex: Int,
    val explanation: String
)

fun parseQuizQuestionsJson(json: String): List<QuizQuestionItem> {
    val list = mutableListOf<QuizQuestionItem>()
    try {
        val arr = JSONArray(json)
        for (i in 0 until arr.length()) {
            val obj = arr.getJSONObject(i)
            val qText = obj.optString("question", obj.optString("question_text", ""))
            val optsArr = obj.optJSONArray("options")
            val opts = mutableListOf<String>()
            if (optsArr != null) {
                for (j in 0 until optsArr.length()) {
                    opts.add(optsArr.getString(j))
                }
            }
            // Accept the mobile key (correct) and the backend/web keys (correct_answer, correctAnswer)
            // so quizzes created on the web or by the backend edge functions score correctly.
            val correct = obj.optInt("correct", obj.optInt("correct_answer", obj.optInt("correctAnswer", 0)))
            val exp = obj.optString("explanation", "")
            if (qText.isNotBlank() && opts.isNotEmpty()) {
                list.add(QuizQuestionItem(qText, opts, correct, exp))
            }
        }
    } catch (e: Exception) {
        // Parsing failure returns empty list; caller falls back gracefully.
    }
    return list
}

data class LiveResultsPlayerEntry(
    val id: String,
    val name: String,
    val score: Int,
    val isYou: Boolean
)

data class LiveResultsQuestionEntry(
    val question: String,
    val options: List<String>,
    val correctIndex: Int,
    val explanation: String,
    val userAnswerIndex: Int?,
    val isCorrect: Boolean
)

data class LiveResultsSnapshot(
    val title: String,
    val pin: String,
    val currentUserId: String,
    val players: List<LiveResultsPlayerEntry>,
    val questions: List<LiveResultsQuestionEntry>
)

fun parseLiveResultsSnapshot(json: String?): LiveResultsSnapshot? {
    if (json.isNullOrBlank()) return null
    return try {
        val root = JSONObject(json)
        val players = mutableListOf<LiveResultsPlayerEntry>()
        root.optJSONArray("players")?.let { arr ->
            for (i in 0 until arr.length()) {
                val p = arr.getJSONObject(i)
                players.add(
                    LiveResultsPlayerEntry(
                        id = p.optString("id", ""),
                        name = p.optString("name", "Player"),
                        score = p.optInt("score", 0),
                        isYou = p.optBoolean("isYou", false)
                    )
                )
            }
        }
        val questions = mutableListOf<LiveResultsQuestionEntry>()
        root.optJSONArray("questions")?.let { arr ->
            for (i in 0 until arr.length()) {
                val q = arr.getJSONObject(i)
                val options = mutableListOf<String>()
                q.optJSONArray("options")?.let { opts ->
                    for (j in 0 until opts.length()) options.add(opts.getString(j))
                }
                val userAnswerIndex = if (q.has("userAnswerIndex")) {
                    q.optInt("userAnswerIndex", -1).takeIf { it >= 0 }
                } else null
                questions.add(
                    LiveResultsQuestionEntry(
                        question = q.optString("question", ""),
                        options = options,
                        correctIndex = q.optInt("correctIndex", 0),
                        explanation = q.optString("explanation", ""),
                        userAnswerIndex = userAnswerIndex,
                        isCorrect = q.optBoolean("isCorrect", false)
                    )
                )
            }
        }
        LiveResultsSnapshot(
            title = root.optString("title", ""),
            pin = root.optString("pin", ""),
            currentUserId = root.optString("currentUserId", ""),
            players = players,
            questions = questions
        )
    } catch (e: Exception) {
        null
    }
}

/**
 * Computes the current user's 1-based rank from a saved live-results leaderboard snapshot,
 * or null when there is no snapshot / the user isn't on the board. Shared by the History card
 * and the full results screen so the two can never disagree.
 */
fun yourRankFromSnapshot(snapshot: LiveResultsSnapshot?): Int? {
    if (snapshot == null) return null
    val sorted = snapshot.players.sortedByDescending { it.score }
    val userId = snapshot.currentUserId
    return sorted.indexOfFirst {
        it.isYou || (userId.isNotBlank() && it.id == userId)
    }.takeIf { it >= 0 }?.plus(1)
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun QuizzesScreen(
    viewModel: QuizzesViewModel,
    onBack: () -> Unit = {},
    initialAction: String? = null,
    onLaunchGame: (gameKey: String) -> Unit = {},
    onOpenTrophies: () -> Unit = {}
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val isAIGenerating by viewModel.isAIGenerating.collectAsStateWithLifecycle()
    val generationMessage by viewModel.generationMessage.collectAsStateWithLifecycle()
    val recentlyClosedSession by viewModel.recentlyClosedLiveSession.collectAsStateWithLifecycle()
    val activeLobbiesFromServer by viewModel.activeLobbiesFromServer.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) {
        viewModel.checkActiveSessions()
    }

    var searchQuery by remember { mutableStateOf("") }
    var selectedFilter by remember { mutableStateOf("All Quizzes") }
    var isCreatingAIQuiz by remember { mutableStateOf(false) }
    var isCreatingLiveQuiz by remember { mutableStateOf(false) }
    var isRefreshing by remember { mutableStateOf(false) }
    val coroutineScope = rememberCoroutineScope()
    var showFilterMenu by remember { mutableStateOf(false) }
    var quizToDelete by remember { mutableStateOf<QuizEntity?>(null) }

    // "ai_quiz" opens the full AI quiz creator directly (used by the Assistant tab's
    // "Generate Quiz" shortcut) instead of landing on the quiz library.
    // "live_quiz" opens the full live-quiz setup directly (used by the Explorer
    // dashboard's "Multiplayer Arena" card) instead of landing on the quiz library.
    LaunchedEffect(initialAction) {
        if (initialAction == "ai_quiz") {
            isCreatingAIQuiz = true
        } else if (initialAction == "live_quiz") {
            isCreatingLiveQuiz = true
        }
    }
    var selectedAttemptForDetails by remember { mutableStateOf<Pair<QuizAttemptEntity, QuizEntity?>?>(null) }
    var selectedLiveResultsForDetails by remember { mutableStateOf<Pair<QuizAttemptEntity, QuizEntity?>?>(null) }
    var currentRulesConfig by remember { mutableStateOf<QuizConfig?>(null) }
    var showQuizRulesDialog by remember { mutableStateOf(false) }

    val snackbarHostState = remember { SnackbarHostState() }
    LaunchedEffect(state.userMessage) {
        state.userMessage?.let { msg ->
            snackbarHostState.showSnackbar(msg)
            viewModel.clearUserMessage()
        }
    }

    if (state.activeLiveSession != null) {
        LiveQuizSessionRunner(
            session = state.activeLiveSession!!,
            viewModel = viewModel
        )
    } else if (selectedLiveResultsForDetails != null) {
        val (attempt, quiz) = selectedLiveResultsForDetails!!
        LiveQuizResultsScreen(
            attempt = attempt,
            quiz = quiz,
            onBack = { selectedLiveResultsForDetails = null },
            onPlayAgain = {
                selectedLiveResultsForDetails = null
                if (quiz != null) {
                    // Relaunch a live room using the questions saved with the past session.
                    viewModel.startLiveSession(
                        pin = "",
                        isHost = true,
                        topicName = quiz.title,
                        config = QuizConfig(topic = quiz.title),
                        customQuestions = parseQuizQuestionsJson(quiz.questionsJson).ifEmpty { null }
                    )
                }
            }
        )
    } else if (state.activeQuiz != null) {
        val isExplorerQuiz = StuddyHubThemeTokens.tier == AcademicTier.EXPLORER
        if (isExplorerQuiz) {
            ExplorerQuizRunnerScreen(
                viewModel = viewModel,
                onBack = { viewModel.exitActiveQuiz() }
            )
        } else {
            ActiveQuizRunner(
                quiz = state.activeQuiz!!,
                onFinish = { score, total, timeSec -> viewModel.finishQuiz(score, total, timeSec) },
                onCancel = { viewModel.exitActiveQuiz() }
            )
        }
    } else if (isCreatingAIQuiz) {
        FullAIQuizCreatorScreen(
            state = state,
            onBack = { isCreatingAIQuiz = false },
            onGenerateFromTopic = { topic, focusAreas, config ->
                viewModel.generateQuizFromTopic(topic, focusAreas, config)
                isCreatingAIQuiz = false
            },
            onGenerateFromNotes = { noteIds, pastedText, config ->
                viewModel.generateQuizFromNotes(noteIds, pastedText, config)
                isCreatingAIQuiz = false
            },
            onGenerateFromRecording = { recordingId, config ->
                viewModel.generateQuizFromRecording(recordingId, config)
                isCreatingAIQuiz = false
            },
            onGenerateFromDocument = { documentId, config ->
                viewModel.generateQuizFromDocument(documentId, config)
                isCreatingAIQuiz = false
            }
        )
    } else if (isCreatingLiveQuiz) {
        if (StuddyHubThemeTokens.tier == AcademicTier.EXPLORER) {
            ExplorerMultiplayerBattleScreen(
                viewModel = viewModel,
                onBack = { isCreatingLiveQuiz = false }
            )
        } else {
            FullLiveQuizSetupScreen(
                state = state,
                onBack = { isCreatingLiveQuiz = false },
                onStartLiveSession = { pin, isHost, title, customQuestions, config, quizId, playerName, playerEmoji ->
                    viewModel.startLiveSession(pin, isHost, title, config, customQuestions, quizId, playerName, playerEmoji)
                    isCreatingLiveQuiz = false
                },
                onViewRules = { config ->
                    currentRulesConfig = config
                    showQuizRulesDialog = true
                }
            )
        }
    } else if (StuddyHubThemeTokens.tier == AcademicTier.EXPLORER) {
        ExplorerArcadeHub(
            state = state,
            viewModel = viewModel,
            onBack = onBack,
            onLaunchGame = onLaunchGame,
            onOpenMultiplayer = { isCreatingLiveQuiz = true },
            onOpenTrophies = onOpenTrophies
        )
    } else {
        Box(modifier = Modifier.fillMaxSize()) {
            Scaffold(
                snackbarHost = { SnackbarHost(snackbarHostState) },
                topBar = {
                    TopAppBar(
                        navigationIcon = {
                        IconButton(
                            onClick = onBack,
                            modifier = Modifier.testTag("back_button")
                        ) {
                            Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                        }
                        },
                        title = {
                            Column {
                                Text(
                                    text = tierQuizTitle(),
                                    fontWeight = FontWeight.Bold,
                                    style = MaterialTheme.typography.titleMedium,
                                    maxLines = 1,
                                    overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis
                                )
                                Text(
                                    text = tierQuizSubtitle(state.quizzes.count { it.sourceType != "live_kahoot" }),
                                    style = MaterialTheme.typography.labelSmall,
                                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f),
                                    maxLines = 1,
                                    overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis
                                )
                            }
                        },
                        actions = {
                            IconButton(onClick = { isCreatingLiveQuiz = true }) {
                                Icon(
                                    imageVector = Icons.Default.FlashOn,
                                    contentDescription = "Live Kahoot Session",
                                    tint = tierTertiary()
                                )
                            }
                            IconButton(onClick = { isCreatingAIQuiz = true }) {
                                Icon(
                                    imageVector = Icons.Default.AutoAwesome,
                                    contentDescription = "Generate AI Quiz",
                                    tint = tierPrimary()
                                )
                            }
                        }
                    )
                },
                floatingActionButton = {
                    ExtendedFloatingActionButton(
                        onClick = { isCreatingAIQuiz = true },
                        icon = { Icon(Icons.Default.AutoAwesome, contentDescription = null) },
                        text = { Text("New AI Quiz", fontWeight = FontWeight.Bold) },
                        containerColor = tierPrimary(),
                        contentColor = Color.White,
                        modifier = Modifier.testTag("quizzes_fab_create")
                    )
                }
            ) { innerPadding ->
                PullToRefreshBox(
                    isRefreshing = isRefreshing,
                    onRefresh = {
                        coroutineScope.launch {
                            isRefreshing = true
                            viewModel.refreshQuizzes()
                            delay(600)
                            isRefreshing = false
                        }
                    },
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(innerPadding),
                    state = rememberPullToRefreshState()
                ) {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(horizontal = 16.dp)
                ) {
                    // Search & Live Session Header Row
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        OutlinedTextField(
                            value = searchQuery,
                            onValueChange = { searchQuery = it },
                            placeholder = { Text("Search quizzes...", style = MaterialTheme.typography.bodyMedium) },
                            leadingIcon = { Icon(Icons.Default.Search, contentDescription = null, modifier = Modifier.size(20.dp)) },
                            trailingIcon = {
                                if (searchQuery.isNotEmpty()) {
                                    IconButton(onClick = { searchQuery = "" }) {
                                        Icon(Icons.Default.Clear, contentDescription = "Clear", modifier = Modifier.size(18.dp))
                                    }
                                }
                            },
                            modifier = Modifier
                                .weight(1f)
                                .height(50.dp)
                                .testTag("quiz_search_input"),
                            shape = RoundedCornerShape(12.dp),
                            singleLine = true
                        )

                    }

                    Spacer(modifier = Modifier.height(12.dp))

                    // Minimalist Stats Overview Strip
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Surface(
                            shape = RoundedCornerShape(10.dp),
                            color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
                            modifier = Modifier.weight(1f)
                        ) {
                            Row(
                                modifier = Modifier.padding(10.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Icon(Icons.Default.Quiz, contentDescription = null, tint = tierPrimary(), modifier = Modifier.size(18.dp))
                                Spacer(modifier = Modifier.width(6.dp))
                                Column {
                                    val libraryQuizCount = state.quizzes.count { it.sourceType != "live_kahoot" }
                                    Text("$libraryQuizCount Quizzes", style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold))
                                    Text("Created", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f))
                                }
                            }
                        }

                        Surface(
                            shape = RoundedCornerShape(10.dp),
                            color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
                            modifier = Modifier
                                .weight(1f)
                                .clickable { selectedFilter = "History & Rankings" }
                        ) {
                            Row(
                                modifier = Modifier.padding(10.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Icon(Icons.Default.EmojiEvents, contentDescription = null, tint = tierAccent(), modifier = Modifier.size(18.dp))
                                Spacer(modifier = Modifier.width(6.dp))
                                Column {
                                    Text("${state.attempts.size} Completed", style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold))
                                    Text("View History", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f))
                                }
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(12.dp))

                    // --- Ongoing Live Session Resume Card ---
                    if (recentlyClosedSession != null) {
                        val session = recentlyClosedSession!!
                        Card(
                            shape = RoundedCornerShape(16.dp),
                            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer),
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 4.dp),
                            border = androidx.compose.foundation.BorderStroke(1.5.dp, MaterialTheme.colorScheme.primary)
                        ) {
                            Column(modifier = Modifier.padding(16.dp)) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Icon(
                                            Icons.Default.FlashOn,
                                            contentDescription = null,
                                            tint = MaterialTheme.colorScheme.primary,
                                            modifier = Modifier.size(20.dp)
                                        )
                                        Spacer(modifier = Modifier.width(8.dp))
                                        Text(
                                            text = "Ongoing Live Quiz (Paused)",
                                            style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold),
                                            color = MaterialTheme.colorScheme.onPrimaryContainer
                                        )
                                    }
                                    IconButton(
                                        onClick = { viewModel.dismissRecentlyClosedSession() },
                                        modifier = Modifier.size(24.dp)
                                    ) {
                                        Icon(
                                            Icons.Default.Close,
                                            contentDescription = "Dismiss",
                                            modifier = Modifier.size(16.dp),
                                            tint = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.6f)
                                        )
                                    }
                                }
                                Spacer(modifier = Modifier.height(8.dp))
                                Text(
                                    text = "Topic: ${session.title}\nPIN: ${session.pin}",
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.8f)
                                )
                                Spacer(modifier = Modifier.height(12.dp))
                                Row(
                                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Button(
                                        onClick = { viewModel.resumeRecentlyClosedSession() },
                                        modifier = Modifier.weight(1f),
                                        colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary)
                                    ) {
                                        Text("Resume Session", style = MaterialTheme.typography.labelLarge.copy(fontWeight = FontWeight.Bold))
                                    }
                                }
                            }
                        }
                        Spacer(modifier = Modifier.height(12.dp))
                    } else {
                        // Show active lobbies from server that this user is hosting
                        val hostedLobbies = activeLobbiesFromServer.filter { it.isHost }
                        if (hostedLobbies.isNotEmpty()) {
                            hostedLobbies.forEach { lobby ->
                                Card(
                                    shape = RoundedCornerShape(16.dp),
                                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.secondaryContainer),
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(vertical = 4.dp),
                                    border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.secondary)
                                ) {
                                    Column(modifier = Modifier.padding(16.dp)) {
                                        Row(
                                            verticalAlignment = Alignment.CenterVertically,
                                            horizontalArrangement = Arrangement.SpaceBetween,
                                            modifier = Modifier.fillMaxWidth()
                                        ) {
                                            Row(verticalAlignment = Alignment.CenterVertically) {
                                                Icon(
                                                    Icons.Default.FlashOn,
                                                    contentDescription = null,
                                                    tint = MaterialTheme.colorScheme.secondary,
                                                    modifier = Modifier.size(20.dp)
                                                )
                                                Spacer(modifier = Modifier.width(8.dp))
                                                Text(
                                                    text = "Your Active Live Room",
                                                    style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold),
                                                    color = MaterialTheme.colorScheme.onSecondaryContainer
                                                )
                                            }
                                        }
                                        Spacer(modifier = Modifier.height(8.dp))
                                        Text(
                                            text = "Topic: ${lobby.topic}\nPIN: ${lobby.pin}",
                                            style = MaterialTheme.typography.bodyMedium,
                                            color = MaterialTheme.colorScheme.onSecondaryContainer.copy(alpha = 0.8f)
                                        )
                                        Spacer(modifier = Modifier.height(12.dp))
                                        Row(
                                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                                            modifier = Modifier.fillMaxWidth()
                                        ) {
                                            OutlinedButton(
                                                onClick = { viewModel.endSessionDirect(lobby.id) },
                                                modifier = Modifier.weight(1f),
                                                colors = ButtonDefaults.outlinedButtonColors(contentColor = MaterialTheme.colorScheme.error),
                                                border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.error.copy(alpha = 0.5f))
                                            ) {
                                                Text("End Lobby", style = MaterialTheme.typography.labelLarge)
                                            }
                                            Button(
                                                onClick = {
                                                    viewModel.startLiveSession(
                                                        pin = lobby.pin,
                                                        isHost = false,
                                                        topicName = lobby.topic
                                                    )
                                                },
                                                modifier = Modifier.weight(1.2f),
                                                colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.secondary)
                                            ) {
                                                Text("Rejoin as Host", style = MaterialTheme.typography.labelLarge.copy(fontWeight = FontWeight.Bold))
                                            }
                                        }
                                    }
                                }
                                Spacer(modifier = Modifier.height(12.dp))
                            }
                        }
                    }

                    // Filter control — the five filters collapse behind one chip so the
                    // quiz list (the primary content) gets the above-the-fold space.
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Box {
                            FilterChip(
                                selected = false,
                                onClick = { showFilterMenu = true },
                                label = { Text(selectedFilter, maxLines = 1, overflow = TextOverflow.Ellipsis) },
                                leadingIcon = {
                                    Icon(
                                        Icons.Default.FilterList,
                                        contentDescription = null,
                                        modifier = Modifier.size(16.dp)
                                    )
                                },
                                trailingIcon = {
                                    Icon(
                                        Icons.Default.ArrowDropDown,
                                        contentDescription = null,
                                        modifier = Modifier.size(16.dp)
                                    )
                                },
                                shape = RoundedCornerShape(20.dp)
                            )
                            DropdownMenu(
                                expanded = showFilterMenu,
                                onDismissRequest = { showFilterMenu = false }
                            ) {
                                val filters = listOf("All Quizzes", "Public Live Lobbies", "AI Practice", "Live Competitions", "History & Rankings")
                                filters.forEach { filter ->
                                    DropdownMenuItem(
                                        text = { Text(filter) },
                                        onClick = {
                                            selectedFilter = filter
                                            showFilterMenu = false
                                        },
                                        trailingIcon = if (selectedFilter == filter) {
                                            { Icon(Icons.Default.Check, contentDescription = "Selected", modifier = Modifier.size(16.dp)) }
                                        } else null
                                    )
                                }
                            }
                        }
                        Spacer(modifier = Modifier.weight(1f))
                        // Secondary Live-PIN entry — demoted out of the header row so it only
                        // competes for attention when the user is actually looking for it.
                        TextButton(
                            onClick = { isCreatingLiveQuiz = true },
                            modifier = Modifier.testTag("live_quiz_pill_button"),
                            contentPadding = PaddingValues(horizontal = 8.dp)
                        ) {
                            Icon(Icons.Default.FlashOn, contentDescription = null, tint = tierTertiary(), modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("Live PIN", color = tierTertiary(), style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.SemiBold))
                        }
                        Text(
                            text = "${state.quizzes.count { it.sourceType != "live_kahoot" }} quizzes",
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
                        )
                    }

                    Spacer(modifier = Modifier.height(12.dp))

                    if (state.isLoading) {
                        LinearProgressIndicator(modifier = Modifier.fillMaxWidth())
                        Spacer(modifier = Modifier.height(8.dp))
                    }

                    if (selectedFilter == "Public Live Lobbies") {
                        Box(modifier = Modifier.weight(1f).verticalScroll(rememberScrollState())) {
                            PublicLiveLobbiesList(
                                searchQuery = searchQuery,
                                onJoinSession = { pin, topic, isHost, config ->
                                    viewModel.startLiveSession(pin, isHost, topic, config)
                                },
                                onViewRules = { config ->
                                    currentRulesConfig = config
                                    showQuizRulesDialog = true
                                }
                            )
                        }
                    } else if (selectedFilter == "History & Rankings" || selectedFilter == "Live Competitions") {
                        PastAttemptsAndRankingsList(
                            attempts = state.attempts,
                            quizzes = state.quizzes,
                            searchQuery = searchQuery,
                            filterMode = selectedFilter,
                            onSelectAttempt = { attempt, quiz ->
                                // Host's own live attempts point at the real library quiz row, so the
                                // liveResultsJson snapshot is the reliable "this was live" signal.
                                val isLive = attempt.liveResultsJson != null || quiz?.sourceType == "live_kahoot" || (quiz?.title?.contains("Live", ignoreCase = true) == true)
                                if (isLive) {
                                    selectedLiveResultsForDetails = Pair(attempt, quiz)
                                } else {
                                    selectedAttemptForDetails = Pair(attempt, quiz)
                                }
                            },
                            modifier = Modifier.weight(1f)
                        )
                    } else {
                        // Filter Quizzes
                        val filteredQuizzes = remember(state.quizzes, searchQuery, selectedFilter, state.attempts) {
                            state.quizzes.filter { quiz ->
                                // Live-session mirrors live in History / Live Competitions, not the practice library grid.
                                if (quiz.sourceType == "live_kahoot") return@filter false
                                val matchesSearch = quiz.title.contains(searchQuery, ignoreCase = true)
                                val matchesFilter = when (selectedFilter) {
                                    "AI Practice" -> quiz.sourceType == "ai" || quiz.title.contains("Quiz", ignoreCase = true)
                                    else -> true
                                }
                                matchesSearch && matchesFilter
                            }
                        }

                    // First-attempt-per-quiz lookup, built once per attempts change. The old code
                    // scanned the whole attempts list inside every quiz card on every recomposition
                    // (O(cards × attempts) per frame); this turns it into an O(1) map lookup.
                    val lastAttemptByQuiz = remember(state.attempts) {
                        val map = HashMap<String, QuizAttemptEntity>()
                        state.attempts.forEach { a -> if (!map.containsKey(a.quizId)) map[a.quizId] = a }
                        map
                    }

                    if (filteredQuizzes.isEmpty()) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .weight(1f),
                            contentAlignment = Alignment.Center
                        ) {
                            Column(
                                horizontalAlignment = Alignment.CenterHorizontally,
                                modifier = Modifier.padding(24.dp)
                            ) {
                                coil.compose.SubcomposeAsyncImage(
                                    model = R.drawable.img_empty_quizzes_alt,
                                    contentDescription = "Empty Quizzes Art",
                                    modifier = Modifier
                                        .size(150.dp)
                                        .clip(RoundedCornerShape(20.dp)),
                                    contentScale = ContentScale.Crop,
                                    loading = {
                                        Box(
                                            modifier = Modifier.fillMaxSize(),
                                            contentAlignment = Alignment.Center
                                        ) {
                                            CircularProgressIndicator(
                                                color = tierPrimary(),
                                                modifier = Modifier.size(36.dp)
                                            )
                                        }
                                    },
                                    error = {
                                        Box(
                                            modifier = Modifier
                                                .fillMaxSize()
                                                .background(MaterialTheme.colorScheme.surfaceVariant),
                                            contentAlignment = Alignment.Center
                                        ) {
                                            Icon(
                                                imageVector = Icons.Default.QuestionAnswer,
                                                contentDescription = null,
                                                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                                                modifier = Modifier.size(48.dp)
                                            )
                                        }
                                    }
                                )
                                Spacer(modifier = Modifier.height(16.dp))
                                Text(
                                    text = if (searchQuery.isNotEmpty()) "No Quizzes Found" else "No Practice Quizzes Yet",
                                    style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold)
                                )
                                Spacer(modifier = Modifier.height(4.dp))
                                Text(
                                    text = "${tierTutorDisplayName()} is ready! Tap 'New AI Quiz' to generate practice questions for any subject.",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f),
                                    modifier = Modifier.padding(horizontal = 16.dp)
                                )
                                Spacer(modifier = Modifier.height(16.dp))
                                Button(
                                    onClick = { isCreatingAIQuiz = true },
                                    colors = ButtonDefaults.buttonColors(containerColor = tierPrimary()),
                                    shape = RoundedCornerShape(12.dp)
                                ) {
                                    Icon(Icons.Default.AutoAwesome, contentDescription = null, modifier = Modifier.size(18.dp))
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Text("Generate First Quiz", fontWeight = FontWeight.Bold)
                                }
                            }
                        }
                    } else {
                        LazyColumn(
                            modifier = Modifier.weight(1f),
                            verticalArrangement = Arrangement.spacedBy(10.dp),
                            contentPadding = PaddingValues(bottom = 80.dp)
                        ) {
                            items(filteredQuizzes, key = { it.id }) { quiz ->
                                // Full questions-JSON parse just to count items, cached per quiz —
                                // previously re-parsed on every recomposition of every visible card.
                                val questionsCount = remember(quiz.id, quiz.questionsJson) {
                                    try { JSONArray(quiz.questionsJson).length() } catch (e: Exception) { 3 }
                                }
                                val lastAttempt = lastAttemptByQuiz[quiz.id]

                                Card(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clickable { viewModel.startQuiz(quiz) }
                                        .testTag("quiz_card_${quiz.id}"),
                                    shape = RoundedCornerShape(14.dp),
                                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.6f)),
                                    border = androidx.compose.foundation.BorderStroke(0.5.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.2f))
                                ) {
                                    Row(
                                        modifier = Modifier.padding(14.dp),
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Surface(
                                            shape = RoundedCornerShape(10.dp),
                                            color = tierPrimary().copy(alpha = 0.12f),
                                            modifier = Modifier.size(42.dp)
                                        ) {
                                            Box(contentAlignment = Alignment.Center) {
                                                Icon(
                                                    imageVector = Icons.Default.Quiz,
                                                    contentDescription = null,
                                                    tint = tierPrimary(),
                                                    modifier = Modifier.size(22.dp)
                                                )
                                            }
                                        }
                                        Spacer(modifier = Modifier.width(12.dp))
                                        Column(modifier = Modifier.weight(1f)) {
                                            Text(
                                                text = quiz.title,
                                                style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold),
                                                maxLines = 1,
                                                overflow = TextOverflow.Ellipsis
                                            )
                                            Spacer(modifier = Modifier.height(2.dp))
                                            Row(verticalAlignment = Alignment.CenterVertically) {
                                                Text(
                                                    text = "$questionsCount Questions",
                                                    style = MaterialTheme.typography.bodySmall,
                                                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
                                                )
                                                if (lastAttempt != null) {
                                                    Text(
                                                        text = " • Score: ${lastAttempt.percentage}%",
                                                        style = MaterialTheme.typography.bodySmall.copy(
                                                            fontWeight = FontWeight.Bold,
                                                            color = if (lastAttempt.percentage >= 70) EmeraldAccent else MaterialTheme.colorScheme.primary
                                                        )
                                                    )
                                                }
                                            }
                                        }
                                        Spacer(modifier = Modifier.width(8.dp))
                                        IconButton(
                                            onClick = { quizToDelete = quiz },
                                            modifier = Modifier.size(32.dp)
                                        ) {
                                            Icon(
                                                imageVector = Icons.Default.DeleteOutline,
                                                contentDescription = "Delete Quiz",
                                                tint = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f),
                                                modifier = Modifier.size(18.dp)
                                            )
                                        }
                                        Spacer(modifier = Modifier.width(4.dp))
                                        Button(
                                            onClick = { viewModel.startQuiz(quiz) },
                                            shape = RoundedCornerShape(10.dp),
                                            contentPadding = PaddingValues(horizontal = 14.dp, vertical = 6.dp),
                                            colors = ButtonDefaults.buttonColors(containerColor = tierPrimary())
                                        ) {
                                            Text(if (lastAttempt != null) "Retake" else "Start", style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold))
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

                if (isAIGenerating) {
                    ProfessorOllieLoader(message = generationMessage)
                }
                }
            } // end PullToRefreshBox
        }
    }

    quizToDelete?.let { quiz ->
        AlertDialog(
            onDismissRequest = { quizToDelete = null },
            title = { Text("Delete Quiz?", fontWeight = FontWeight.Bold) },
            text = { Text("Are you sure you want to delete \"${quiz.title}\"?") },
            confirmButton = {
                Button(
                    onClick = {
                        viewModel.deleteQuiz(quiz.id)
                        quizToDelete = null
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error)
                ) {
                    Text("Delete")
                }
            },
            dismissButton = {
                TextButton(onClick = { quizToDelete = null }) {
                    Text("Cancel")
                }
            }
        )
    }

    selectedAttemptForDetails?.let { (attempt, quiz) ->
        PastAttemptDetailModal(
            attempt = attempt,
            quiz = quiz,
            onDismiss = { selectedAttemptForDetails = null },
            onReplay = {
                selectedAttemptForDetails = null
                if (quiz != null) {
                    if (quiz.sourceType == "live_kahoot" || quiz.title.contains("Live", ignoreCase = true)) {
                        // Relaunch a live room using the questions saved with the past session.
                        viewModel.startLiveSession(
                            pin = "",
                            isHost = true,
                            topicName = quiz.title,
                            config = QuizConfig(topic = quiz.title),
                            customQuestions = parseQuizQuestionsJson(quiz.questionsJson).ifEmpty { null }
                        )
                    } else {
                        viewModel.startQuiz(quiz)
                    }
                }
            }
        )
    }

    if (showQuizRulesDialog && currentRulesConfig != null) {
        QuizRulesAndGuidelinesModal(
            config = currentRulesConfig!!,
            onDismiss = { showQuizRulesDialog = false }
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ActiveQuizRunner(
    quiz: QuizEntity,
    onFinish: (score: Int, total: Int, timeTakenSec: Int) -> Unit,
    onCancel: () -> Unit
) {
    val questions = remember(quiz) {
        val list = mutableListOf<QuizQuestionItem>()
        try {
            val arr = JSONArray(quiz.questionsJson)
            for (i in 0 until arr.length()) {
                val obj = arr.getJSONObject(i)
                val qText = obj.optString("question")
                val optArr = obj.optJSONArray("options")
                val opts = mutableListOf<String>()
                if (optArr != null) {
                    for (j in 0 until optArr.length()) {
                        opts.add(optArr.getString(j))
                    }
                }
                // Read the mobile key (correct) and the backend/web keys (correct_answer, correctAnswer).
                val correct = obj.optInt("correct", obj.optInt("correct_answer", obj.optInt("correctAnswer", 0)))
                val exp = obj.optString("explanation", "")
                if (qText.isNotBlank()) {
                    list.add(QuizQuestionItem(qText, opts, correct, exp))
                }
            }
        } catch (e: Exception) {
            // Parse failure leaves the list empty; the runner shows an honest error state below.
        }
        list
    }

    var currentIndex by remember { mutableIntStateOf(0) }
    var selectedOptionIndex by remember { mutableStateOf<Int?>(null) }
    var score by remember { mutableIntStateOf(0) }
    var isSubmitted by remember { mutableStateOf(false) }
    var timerSeconds by remember { mutableIntStateOf(0) }
    var isFinished by remember { mutableStateOf(false) }
    // Track wrong answers for post-quiz review
    var wrongAnswers by remember { mutableStateOf(listOf<WrongAnswerItem>()) }
    var showReview by remember { mutableStateOf(false) }

    // Explorer (kids) get tactile feedback — chunky press physics, pop sounds and haptics
    // on every answer tap, matching their arcade-style game screens.
    val isExplorerTier = StuddyHubThemeTokens.tier == AcademicTier.EXPLORER
    val tactileView = LocalView.current

    // Timer effect
    LaunchedEffect(isFinished) {
        if (!isFinished) {
            while (true) {
                delay(1000L)
                timerSeconds++
            }
        }
    }

    val currentQ = questions.getOrNull(currentIndex)

    Scaffold(
        topBar = {
            TopAppBar(
                navigationIcon = {
                    IconButton(onClick = onCancel) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Exit Quiz")
                    }
                },
                title = {
                    Column {
                        // Interactive Active Quiz Breadcrumb Header
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.testTag("active_quiz_breadcrumb_header")
                        ) {
                            Text(
                                text = "Quizzes",
                                style = MaterialTheme.typography.labelSmall,
                                color = tierPrimary(),
                                modifier = Modifier.clickable { onCancel() }
                            )
                            Text(
                                text = "  >  ",
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.3f)
                            )
                            Text(
                                text = quiz.title,
                                style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold),
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                        }
                        Text("Active Practice Session", style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold))
                    }
                },
                actions = {
                    // Timer Chip
                    val minutes = timerSeconds / 60
                    val secs = timerSeconds % 60
                    Surface(
                        shape = RoundedCornerShape(12.dp),
                        color = MaterialTheme.colorScheme.surfaceVariant,
                        modifier = Modifier.padding(end = 12.dp)
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(Icons.Default.Timer, contentDescription = null, modifier = Modifier.size(16.dp), tint = MaterialTheme.colorScheme.primary)
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(
                                text = String.format("%02d:%02d", minutes, secs),
                                style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold)
                            )
                        }
                    }
                }
            )
        }
    ) { innerPadding ->
        if (isFinished) {
            // Quiz Summary View
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding),
                contentAlignment = Alignment.Center
            ) {
                Card(
                    modifier = Modifier
                        .fillMaxWidth(0.9f)
                        .padding(16.dp),
                    shape = RoundedCornerShape(20.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.2f))
                ) {
                    Column(
                        modifier = Modifier.padding(24.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Surface(
                            shape = CircleShape,
                            color = EmeraldAccent.copy(alpha = 0.15f),
                            modifier = Modifier.size(64.dp)
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                Icon(Icons.Default.EmojiEvents, contentDescription = null, tint = EmeraldAccent, modifier = Modifier.size(36.dp))
                            }
                        }
                        Spacer(modifier = Modifier.height(12.dp))
                        Text("Quiz Completed!", style = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.Bold))
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(quiz.title, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f))

                        Spacer(modifier = Modifier.height(20.dp))

                        val percentage = if (questions.isNotEmpty()) (score * 100) / questions.size else 0
                        val xpEarned = score * 25 + 50

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceEvenly
                        ) {
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Text("$score / ${questions.size}", style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold))
                                Text("Score", style = MaterialTheme.typography.labelSmall)
                            }
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Text("$percentage%", style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold, color = EmeraldAccent))
                                Text("Accuracy", style = MaterialTheme.typography.labelSmall)
                            }
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Text("+$xpEarned 🪙", style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold, color = tierPrimary()))
                                Text("Coins Earned", style = MaterialTheme.typography.labelSmall)
                            }
                        }

                        // ── Wrong Answers Review Section ──
                        if (wrongAnswers.isNotEmpty()) {
                            Spacer(modifier = Modifier.height(16.dp))
                            Surface(
                                shape = RoundedCornerShape(14.dp),
                                color = MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.3f),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Column(modifier = Modifier.padding(14.dp)) {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Icon(Icons.Default.Cancel, contentDescription = null, tint = MaterialTheme.colorScheme.error, modifier = Modifier.size(18.dp))
                                        Spacer(modifier = Modifier.width(6.dp))
                                        Text("Review: ${wrongAnswers.size} Wrong Answer${if (wrongAnswers.size > 1) "s" else ""}", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.labelLarge)
                                    }
                                    Spacer(modifier = Modifier.height(8.dp))
                                    wrongAnswers.forEachIndexed { idx, item ->
                                        if (idx > 0) HorizontalDivider(modifier = Modifier.padding(vertical = 6.dp))
                                        Column {
                                            Text(item.question, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.bodySmall)
                                            Spacer(modifier = Modifier.height(4.dp))
                                            Row {
                                                Text("Your answer: ", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error)
                                                Text(item.userAnswer, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error)
                                            }
                                            Row {
                                                Text("Correct: ", style = MaterialTheme.typography.bodySmall, color = EmeraldAccent)
                                                Text(item.correctAnswer, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.bodySmall, color = EmeraldAccent)
                                            }
                                            if (item.explanation.isNotBlank()) {
                                                Text(item.explanation, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f), modifier = Modifier.padding(top = 2.dp))
                                            }
                                        }
                                    }
                                }
                            }
                        }

                        Spacer(modifier = Modifier.height(24.dp))

                        Button(
                            onClick = {
                                if (isExplorerTier) TactileSoundSystem.playCelebrationBeep()
                                onFinish(score, questions.size, timerSeconds)
                            },
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(48.dp),
                            shape = RoundedCornerShape(12.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = tierPrimary())
                        ) {
                            Text("Save Score & Return", fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
            return@Scaffold
        }

        if (currentQ == null) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.padding(24.dp)) {
                    Icon(
                        imageVector = Icons.Default.ErrorOutline,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.error,
                        modifier = Modifier.size(44.dp)
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    Text(
                        "This quiz has no loadable questions.",
                        style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                        textAlign = androidx.compose.ui.text.style.TextAlign.Center
                    )
                    Spacer(modifier = Modifier.height(6.dp))
                    Text(
                        "The question data could not be parsed. Please delete this quiz and generate a new one.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f),
                        textAlign = androidx.compose.ui.text.style.TextAlign.Center
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    Button(onClick = onCancel) {
                        Text("Back to Quizzes")
                    }
                }
            }
            return@Scaffold
        }

        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .padding(20.dp),
            verticalArrangement = Arrangement.SpaceBetween
        ) {
            Column {
                // Sleek Question Progress Bar
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "Question ${currentIndex + 1} of ${questions.size}",
                        style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold),
                        color = tierPrimary()
                    )
                    Text(
                        text = "${((currentIndex + 1).toFloat() / questions.size * 100).toInt()}%",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f)
                    )
                }

                Spacer(modifier = Modifier.height(6.dp))

                LinearProgressIndicator(
                    progress = { (currentIndex + 1).toFloat() / questions.size },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(6.dp)
                        .clip(RoundedCornerShape(3.dp)),
                    color = tierPrimary()
                )

                Spacer(modifier = Modifier.height(20.dp))

                // Question Text
                Text(
                    text = currentQ.question,
                    style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold)
                )

                Spacer(modifier = Modifier.height(20.dp))

                // Options List
                currentQ.options.forEachIndexed { optIdx, optionText ->
                    val isSelected = selectedOptionIndex == optIdx
                    val isCorrect = optIdx == currentQ.correctIndex

                    val containerColor = when {
                        !isSubmitted -> if (isSelected) tierPrimary().copy(alpha = 0.15f) else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
                        isCorrect -> EmeraldAccent.copy(alpha = 0.2f)
                        isSelected && !isCorrect -> MaterialTheme.colorScheme.error.copy(alpha = 0.2f)
                        else -> MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f)
                    }

                    val borderColor = when {
                        !isSubmitted -> if (isSelected) tierPrimary() else Color.Transparent
                        isCorrect -> EmeraldAccent
                        isSelected && !isCorrect -> MaterialTheme.colorScheme.error
                        else -> Color.Transparent
                    }

                    Card(
                        modifier = if (isExplorerTier) {
                            Modifier
                                .fillMaxWidth()
                                .padding(vertical = 5.dp)
                                .tactileClick(onClick = { if (!isSubmitted) selectedOptionIndex = optIdx })
                        } else {
                            Modifier
                                .fillMaxWidth()
                                .padding(vertical = 5.dp)
                                .clickable(enabled = !isSubmitted) { selectedOptionIndex = optIdx }
                        },
                        shape = RoundedCornerShape(12.dp),
                        colors = CardDefaults.cardColors(containerColor = containerColor),
                        border = androidx.compose.foundation.BorderStroke(1.dp, borderColor)
                    ) {
                        Row(
                            modifier = Modifier
                                .padding(14.dp)
                                .fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Surface(
                                shape = CircleShape,
                                color = if (isSelected || (isSubmitted && isCorrect)) tierPrimary() else MaterialTheme.colorScheme.surfaceVariant,
                                modifier = Modifier.size(28.dp)
                            ) {
                                Box(contentAlignment = Alignment.Center) {
                                    Text(
                                        text = "${('A' + optIdx)}",
                                        style = MaterialTheme.typography.labelMedium.copy(
                                            fontWeight = FontWeight.Bold,
                                            color = if (isSelected || (isSubmitted && isCorrect)) Color.White else MaterialTheme.colorScheme.onSurface
                                        )
                                    )
                                }
                            }
                            Spacer(modifier = Modifier.width(12.dp))
                            Text(
                                text = optionText,
                                style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Medium),
                                modifier = Modifier.weight(1f)
                            )
                            if (isSubmitted) {
                                if (isCorrect) {
                                    Icon(Icons.Default.CheckCircle, contentDescription = "Correct", tint = EmeraldAccent)
                                } else if (isSelected) {
                                    Icon(Icons.Default.Cancel, contentDescription = "Wrong", tint = MaterialTheme.colorScheme.error)
                                }
                            }
                        }
                    }
                }

                if (isSubmitted && currentQ.explanation.isNotBlank()) {
                    Spacer(modifier = Modifier.height(16.dp))
                    Surface(
                        shape = RoundedCornerShape(12.dp),
                        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.7f),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(modifier = Modifier.padding(14.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Default.Info, contentDescription = null, tint = tierPrimary(), modifier = Modifier.size(18.dp))
                                Spacer(modifier = Modifier.width(6.dp))
                                Text("Explanation", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.labelLarge)
                            }
                            Spacer(modifier = Modifier.height(6.dp))
                            Text(currentQ.explanation, style = MaterialTheme.typography.bodyMedium)
                        }
                    }
                }
            }

            // Bottom Navigation Control Button
            Box(modifier = Modifier.fillMaxWidth().padding(bottom = 12.dp)) {
                if (!isSubmitted) {
                    Button(
                        onClick = {
                            if (isExplorerTier) TactileSoundSystem.playPopSound(tactileView)
                            if (selectedOptionIndex != null) {
                                isSubmitted = true
                                if (selectedOptionIndex == currentQ.correctIndex) {
                                    score += 1
                                    if (isExplorerTier) TactileSoundSystem.playCelebrationBeep()
                                } else {
                                    // Track wrong answers for post-quiz review
                                    wrongAnswers = wrongAnswers + WrongAnswerItem(
                                        question = currentQ.question,
                                        userAnswer = currentQ.options.getOrElse(selectedOptionIndex!!) { "?" },
                                        correctAnswer = currentQ.options.getOrElse(currentQ.correctIndex) { "?" },
                                        explanation = currentQ.explanation
                                    )
                                }
                            }
                        },
                        enabled = selectedOptionIndex != null,
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(48.dp),
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = tierPrimary())
                    ) {
                        Text("Submit Answer", fontWeight = FontWeight.Bold)
                    }
                } else {
                    Button(
                        onClick = {
                            if (isExplorerTier) TactileSoundSystem.playPopSound(tactileView)
                            if (currentIndex + 1 < questions.size) {
                                currentIndex += 1
                                selectedOptionIndex = null
                                isSubmitted = false
                            } else {
                                isFinished = true
                            }
                        },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(48.dp),
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = tierPrimary())
                    ) {
                        Text(
                            if (currentIndex + 1 < questions.size) "Next Question" else "View Final Results",
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LiveQuizSessionRunner(
    session: LiveQuizSession,
    viewModel: QuizzesViewModel
) {
    val currentQuestion = session.questions.getOrNull(session.currentQuestionIndex)
    // Use the host-configured time limit instead of a hardcoded 15s
    val questionTimeLimit = session.config.timeLimitSec.coerceIn(5, 120)
    var selectedOption by remember(session.currentQuestionIndex) { mutableStateOf<Int?>(null) }
    var timeRemainingSec by remember(session.currentQuestionIndex) { mutableIntStateOf(questionTimeLimit) }
    var answerSubmitted by remember(session.currentQuestionIndex) { mutableStateOf(false) }
    // True when the countdown hit 0 without an answer. Display-only: the SERVER is the sole
    // authority for closing questions and marking timeouts, so the client never auto-submits.
    var timeUp by remember(session.currentQuestionIndex) { mutableStateOf(false) }
    // Host-only toggle: peek at the live ranking while a question is in progress. Joined
    // players only see the ranking after the quiz ends (matches the web).
    var showHostRanking by remember(session.currentQuestionIndex) { mutableStateOf(false) }
    val isMediatorHost = session.isHost && session.config.hostRole == "mediator"

    // Match start "GO!" flash — brief non-blocking toast (no overlay, so the timer
    // starts immediately and the user can read the first question right away).
    var showGoFlash by remember(session.pin) { mutableStateOf(session.phase == LiveQuizPhase.QUESTION && session.currentQuestionIndex == 0) }

    LaunchedEffect(session.phase) {
        if (session.phase == LiveQuizPhase.QUESTION && session.currentQuestionIndex == 0) {
            showGoFlash = true
            TactileSoundSystem.playCelebrationBeep()
            delay(1200L)
            showGoFlash = false
        }
    }

    // Server-authoritative countdown (Kahoot-style). The remaining time is computed from the
    // question's server end_time — NOT a fresh local timer — so every player's clock matches
    // the host's exactly, no matter when their device first received the question. This is what
    // eliminates the "some players get the question early, others get interrupted" unfairness.
    LaunchedEffect(session.phase, session.currentQuestionIndex, session.currentQuestionEndTime, answerSubmitted) {
        if (session.phase == LiveQuizPhase.QUESTION && !answerSubmitted) {
            val endTime = session.currentQuestionEndTime
            if (endTime != null && endTime > 0L) {
                // Tick off the wall-clock distance to the server deadline.
                while (timeRemainingSec > 0 && !answerSubmitted) {
                    val remaining = ((endTime - System.currentTimeMillis()) / 1000L).toInt()
                    timeRemainingSec = remaining.coerceAtLeast(0)
                    if (remaining <= 0) break
                    delay(250L)
                }
            } else {
                // No server deadline yet (e.g. between the host starting and the first state
                // refresh returning) — count down locally until the deadline arrives.
                timeRemainingSec = questionTimeLimit
                while (timeRemainingSec > 0 && !answerSubmitted) {
                    delay(1000L)
                    timeRemainingSec--
                }
            }
            if (!answerSubmitted) {
                // Time expired — the client never decides the outcome. The server (watchdog +
                // advance RPC) closes the question and marks unanswered players; we just show
                // a waiting state until the next realtime/poll refresh moves us forward.
                timeRemainingSec = 0
                timeUp = true
            }
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                navigationIcon = {
                    IconButton(onClick = { viewModel.exitLiveSession() }) {
                        Icon(Icons.Default.Close, contentDescription = "Exit Live Quiz")
                    }
                },
                title = {
                    Column {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.testTag("live_quiz_breadcrumbs")
                        ) {
                            Text(
                                text = "Quizzes",
                                style = MaterialTheme.typography.labelSmall,
                                color = tierTertiary(),
                                modifier = Modifier.clickable { viewModel.exitLiveSession() }
                            )
                            Text(
                                text = "  /  ",
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.3f)
                            )
                            Text(
                                text = "Live PIN: ${session.pin}",
                                style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold),
                                color = MaterialTheme.colorScheme.onSurface
                            )
                        }
                        Text(
                            text = session.title,
                            style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold)
                        )
                    }
                },
                actions = {
                    Surface(
                        shape = RoundedCornerShape(20.dp),
                        color = tierTertiary().copy(alpha = 0.15f),
                        modifier = Modifier.padding(end = 12.dp)
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                        ) {
                            Icon(
                                imageVector = if (session.isHost) Icons.Default.WorkspacePremium else Icons.Default.FlashOn,
                                contentDescription = null,
                                tint = tierTertiary(),
                                modifier = Modifier.size(12.dp)
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(
                                text = if (session.isHost) "HOST" else "PLAYER",
                                style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold, color = tierTertiary())
                            )
                        }
                    }
                }
            )
        }
    ) { innerPadding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .padding(16.dp)
        ) {
            when (session.phase) {
                LiveQuizPhase.LOBBY -> {
                    Column(
                        modifier = Modifier.fillMaxSize(),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.SpaceBetween
                    ) {
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Spacer(modifier = Modifier.height(16.dp))
                            Surface(
                                shape = RoundedCornerShape(20.dp),
                                color = tierTertiary().copy(alpha = 0.12f),
                                border = androidx.compose.foundation.BorderStroke(2.dp, tierTertiary()),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Column(
                                    modifier = Modifier.padding(24.dp),
                                    horizontalAlignment = Alignment.CenterHorizontally
                                ) {
                                    Text(
                                        text = "GAME PIN",
                                        style = MaterialTheme.typography.labelLarge.copy(fontWeight = FontWeight.Bold, color = tierTertiary())
                                    )
                                    Spacer(modifier = Modifier.height(4.dp))
                                    Text(
                                        text = session.pin,
                                        style = MaterialTheme.typography.displayMedium.copy(fontWeight = FontWeight.Black, letterSpacing = 2.sp, color = tierTertiary())
                                    )
                                    Spacer(modifier = Modifier.height(8.dp))
                                    Text(
                                        text = "Broadcast this PIN to join real-time multiplayer session",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
                                    )
                                }
                            }

                            Spacer(modifier = Modifier.height(24.dp))

                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = "Players in Lobby (${session.players.size})",
                                    style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold)
                                )
                                CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp, color = tierTertiary())
                            }

                            Spacer(modifier = Modifier.height(12.dp))

                            LazyColumn(
                                verticalArrangement = Arrangement.spacedBy(8.dp),
                                modifier = Modifier.heightIn(max = 280.dp)
                            ) {
                                items(session.players) { player ->
                                    Card(
                                        shape = RoundedCornerShape(12.dp),
                                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)),
                                        modifier = Modifier.fillMaxWidth()
                                    ) {
                                        Row(
                                            modifier = Modifier.padding(12.dp),
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            com.example.ui.components.Avatar3DRenderer(
                                                avatarIdOrEmoji = player.avatarEmoji,
                                                size = 36.dp,
                                                showAura = false,
                                                isAnimated = false
                                            )
                                            Spacer(modifier = Modifier.width(12.dp))
                                            Text(player.name, style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Bold))
                                            Spacer(modifier = Modifier.weight(1f))
                                            Surface(
                                                shape = CircleShape,
                                                color = EmeraldAccent.copy(alpha = 0.2f)
                                            ) {
                                                Text(
                                                    text = "READY",
                                                    style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold, color = EmeraldAccent),
                                                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp)
                                                )
                                            }
                                        }
                                    }
                                }
                            }
                        }

                        if (session.isHost) {
                            Button(
                                onClick = { viewModel.startHostLiveSession() },
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(52.dp),
                                shape = RoundedCornerShape(14.dp),
                                colors = ButtonDefaults.buttonColors(containerColor = tierTertiary())
                            ) {
                                Icon(Icons.Default.PlayArrow, contentDescription = null)
                                Spacer(modifier = Modifier.width(8.dp))
                                Text("Start Live Quiz", style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold))
                            }
                        } else {
                            Card(
                                shape = RoundedCornerShape(14.dp),
                                colors = CardDefaults.cardColors(containerColor = tierTertiary().copy(alpha = 0.1f)),
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 4.dp),
                                border = androidx.compose.foundation.BorderStroke(1.dp, tierTertiary().copy(alpha = 0.3f))
                            ) {
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(16.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.Center
                                ) {
                                    CircularProgressIndicator(
                                        modifier = Modifier.size(20.dp),
                                        strokeWidth = 2.dp,
                                        color = tierTertiary()
                                    )
                                    Spacer(modifier = Modifier.width(12.dp))
                                    Text(
                                        text = "Waiting for Host to start the quiz...",
                                        style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Bold, color = tierTertiary())
                                    )
                                }
                            }
                        }
                    }
                }

                LiveQuizPhase.QUESTION -> {
                    if (currentQuestion != null) {
                        Column(
                            modifier = Modifier.fillMaxSize(),
                            verticalArrangement = Arrangement.SpaceBetween
                        ) {
                            Column {
                                // Ticker Bar & Question Progress
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text(
                                        text = "Question ${session.currentQuestionIndex + 1} of ${session.questions.size}",
                                        style = MaterialTheme.typography.labelLarge.copy(fontWeight = FontWeight.Bold, color = tierTertiary())
                                    )
                                    Row(
                                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        if (session.isHost) {
                                            FilterChip(
                                                selected = showHostRanking,
                                                onClick = { showHostRanking = !showHostRanking },
                                                label = { Text(if (showHostRanking) "Hide" else "Ranking") },
                                                leadingIcon = { Icon(Icons.Default.EmojiEvents, contentDescription = null, modifier = Modifier.size(14.dp)) }
                                            )
                                        }
                                        Surface(
                                            shape = RoundedCornerShape(12.dp),
                                            color = if (timeRemainingSec <= 5) MaterialTheme.colorScheme.error else tierTertiary()
                                        ) {
                                            Row(
                                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
                                                verticalAlignment = Alignment.CenterVertically
                                            ) {
                                                Icon(Icons.Default.Timer, contentDescription = null, tint = Color.White, modifier = Modifier.size(16.dp))
                                                Spacer(modifier = Modifier.width(4.dp))
                                                Text(
                                                    text = "${timeRemainingSec}s",
                                                    style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold, color = Color.White)
                                                )
                                            }
                                        }
                                    }
                                }

                                Spacer(modifier = Modifier.height(8.dp))

                                LinearProgressIndicator(
                                    progress = { (timeRemainingSec.toFloat() / questionTimeLimit).coerceIn(0f, 1f) },
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .height(8.dp)
                                        .clip(RoundedCornerShape(4.dp)),
                                    color = if (timeRemainingSec <= 5) MaterialTheme.colorScheme.error else tierTertiary()
                                )

                                Spacer(modifier = Modifier.height(24.dp))

                                Card(
                                    shape = RoundedCornerShape(16.dp),
                                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.6f)),
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Text(
                                        text = currentQuestion.question,
                                        style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold),
                                        modifier = Modifier.padding(20.dp)
                                    )
                                }

                                Spacer(modifier = Modifier.height(20.dp))

                                if (session.isHost && showHostRanking) {
                                    // Host peek at the live ranking while the question is open (host-only toggle).
                                    LiveRankingList(
                                        players = session.players.filter { it.isPlaying },
                                        currentUserId = session.currentUserId
                                    )
                                } else if (isMediatorHost) {
                                    // Mediator host: moderates but does not answer (web behavior).
                                    Surface(
                                        shape = RoundedCornerShape(14.dp),
                                        color = tierTertiary().copy(alpha = 0.12f),
                                        border = BorderStroke(1.dp, tierTertiary().copy(alpha = 0.3f)),
                                        modifier = Modifier.fillMaxWidth()
                                    ) {
                                        Row(
                                            modifier = Modifier.padding(16.dp),
                                            verticalAlignment = Alignment.CenterVertically,
                                            horizontalArrangement = Arrangement.Center
                                        ) {
                                            Icon(Icons.Default.Visibility, contentDescription = null, tint = tierTertiary())
                                            Spacer(modifier = Modifier.width(10.dp))
                                            Text(
                                                "Mediator — no answer required. You're moderating this quiz.",
                                                style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Bold, color = tierTertiary())
                                            )
                                        }
                                    }
                                } else {
                                // Kahoot Shape Color Buttons (Triangle, Diamond, Circle, Square)
                                val kahootColors = listOf(
                                    Color(0xFFE21B3C), // Red Triangle
                                    Color(0xFF1368CE), // Blue Diamond
                                    Color(0xFFD97706), // Orange Circle
                                    Color(0xFF26890C)  // Green Square
                                )
                                val kahootSymbols = listOf("▲", "◆", "●", "■")

                                currentQuestion.options.forEachIndexed { idx, option ->
                                    val isSelected = selectedOption == idx
                                    val buttonColor = kahootColors.getOrElse(idx) { tierTertiary() }
                                    val symbol = kahootSymbols.getOrElse(idx) { "●" }
                                    val interactionLocked = answerSubmitted || timeUp

                                    Surface(
                                        shape = RoundedCornerShape(14.dp),
                                        color = buttonColor.copy(alpha = if (interactionLocked && !isSelected) 0.3f else 1f),
                                        border = if (isSelected) androidx.compose.foundation.BorderStroke(3.dp, Color.White) else null,
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .padding(vertical = 6.dp)
                                            .clickable(enabled = !interactionLocked) {
                                                selectedOption = idx
                                                answerSubmitted = true
                                                val isCorrect = idx == currentQuestion.correctIndex
                                                viewModel.submitLiveAnswer(isCorrect, timeRemainingSec, idx)
                                            }
                                    ) {
                                        Row(
                                            modifier = Modifier.padding(16.dp),
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Text(
                                                text = symbol,
                                                fontSize = 20.sp,
                                                color = Color.White,
                                                fontWeight = FontWeight.Black
                                            )
                                            Spacer(modifier = Modifier.width(14.dp))
                                            Text(
                                                text = option,
                                                style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold, color = Color.White),
                                                modifier = Modifier.weight(1f)
                                            )
                                        }
                                    }
                                }
                                }
                            }

                            if (answerSubmitted) {
                                Surface(
                                    shape = RoundedCornerShape(12.dp),
                                    color = MaterialTheme.colorScheme.surfaceVariant,
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Row(
                                        modifier = Modifier.padding(14.dp),
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.Center
                                    ) {
                                        CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
                                        Spacer(modifier = Modifier.width(10.dp))
                                        Text("Answer Locked! Syncing with live lobby...", style = MaterialTheme.typography.labelLarge.copy(fontWeight = FontWeight.Bold))
                                    }
                                }
                            } else if (timeUp) {
                                Surface(
                                    shape = RoundedCornerShape(12.dp),
                                    color = MaterialTheme.colorScheme.surfaceVariant,
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Row(
                                        modifier = Modifier.padding(14.dp),
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.Center
                                    ) {
                                        CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
                                        Spacer(modifier = Modifier.width(10.dp))
                                        Text("Time's up! The server is tallying results...", style = MaterialTheme.typography.labelLarge.copy(fontWeight = FontWeight.Bold))
                                    }
                                }
                            }
                        }
                    }
                }

                LiveQuizPhase.LEADERBOARD -> {
                    if (session.isHost) {
                        Column(
                            modifier = Modifier.fillMaxSize(),
                            verticalArrangement = Arrangement.SpaceBetween
                        ) {
                            Column {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Icon(Icons.Default.EmojiEvents, contentDescription = null, tint = tierTertiary())
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Text("Live Leaderboard", style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold))
                                }
                                Spacer(modifier = Modifier.height(4.dp))
                                Text("Real-time scoreboard after Question ${session.currentQuestionIndex + 1}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f))

                                Spacer(modifier = Modifier.height(16.dp))

                                // Only playing participants rank (mediator hosts are excluded, like the web).
                                LiveRankingList(
                                    players = session.players.filter { it.isPlaying },
                                    currentUserId = session.currentUserId
                                )
                            }

                            if (session.config.advanceMode == "manual") {
                                // Manual pacing: the host drives the next question.
                                Button(
                                    onClick = { viewModel.nextLiveQuestion() },
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .height(52.dp),
                                    shape = RoundedCornerShape(14.dp),
                                    colors = ButtonDefaults.buttonColors(containerColor = tierTertiary())
                                ) {
                                    Text(
                                        if (session.currentQuestionIndex + 1 < session.questions.size) "Next Question →" else "View Final Podium 🏆",
                                        style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold)
                                    )
                                }
                            } else {
                                // Auto mode: the server advances when the timer elapses — the host
                                // doesn't manually advance (matches the web's auto-pacing).
                                Card(
                                    shape = RoundedCornerShape(14.dp),
                                    colors = CardDefaults.cardColors(containerColor = tierTertiary().copy(alpha = 0.1f)),
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(vertical = 4.dp),
                                    border = androidx.compose.foundation.BorderStroke(1.dp, tierTertiary().copy(alpha = 0.3f))
                                ) {
                                    Row(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .padding(16.dp),
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.Center
                                    ) {
                                        CircularProgressIndicator(
                                            modifier = Modifier.size(20.dp),
                                            strokeWidth = 2.dp,
                                            color = tierTertiary()
                                        )
                                        Spacer(modifier = Modifier.width(12.dp))
                                        Text(
                                            text = "Auto-advancing to the next question...",
                                            style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Bold, color = tierTertiary())
                                        )
                                    }
                                }
                            }
                        }
                    } else {
                        // Joined players only see rankings AFTER the quiz ends (Kahoot-style).
                        Column(
                            modifier = Modifier.fillMaxSize(),
                            verticalArrangement = Arrangement.Center,
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(28.dp),
                                strokeWidth = 3.dp,
                                color = tierTertiary()
                            )
                            Spacer(modifier = Modifier.height(16.dp))
                            Text(
                                "Question ${session.currentQuestionIndex + 1} complete!",
                                style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold)
                            )
                            Spacer(modifier = Modifier.height(6.dp))
                            Text(
                                "Final rankings are revealed at the end of the quiz.",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f),
                                textAlign = androidx.compose.ui.text.style.TextAlign.Center
                            )
                        }
                    }
                }

                LiveQuizPhase.PODIUM -> {
                    Column(
                        modifier = Modifier.fillMaxSize(),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.SpaceBetween
                    ) {
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Spacer(modifier = Modifier.height(16.dp))
                            Icon(Icons.Default.EmojiEvents, contentDescription = null, tint = Color(0xFFFFD700), modifier = Modifier.size(64.dp))
                            Spacer(modifier = Modifier.height(8.dp))
                            Text("LIVE QUIZ VICTORY PODIUM", style = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.Black, color = tierTertiary()))
                            Text("Great performance in ${session.title}!", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f))

                            Spacer(modifier = Modifier.height(24.dp))

                            // Podium Displays Top 3 (only playing participants — mediators don't rank)
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceEvenly,
                                verticalAlignment = Alignment.Bottom
                            ) {
                                val top3 = session.players.filter { it.isPlaying }.take(3)
                                val silver = top3.getOrNull(1)
                                val gold = top3.getOrNull(0)
                                val bronze = top3.getOrNull(2)

                                // #2 Silver
                                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                    com.example.ui.components.Avatar3DRenderer(
                                        avatarIdOrEmoji = silver?.avatarEmoji,
                                        size = 48.dp,
                                        showAura = true,
                                        isAnimated = true
                                    )
                                    Spacer(modifier = Modifier.height(2.dp))
                                    Text(silver?.name ?: "P2", style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold))
                                    Spacer(modifier = Modifier.height(4.dp))
                                    Surface(
                                        shape = RoundedCornerShape(topStart = 12.dp, topEnd = 12.dp),
                                        color = Color(0xFFC0C0C0),
                                        modifier = Modifier.width(80.dp).height(100.dp)
                                    ) {
                                        Box(contentAlignment = Alignment.Center) {
                                            Text("#2", style = MaterialTheme.typography.headlineMedium.copy(fontWeight = FontWeight.Black, color = Color.White))
                                        }
                                    }
                                }

                                // #1 Gold
                                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                    com.example.ui.components.Avatar3DRenderer(
                                        avatarIdOrEmoji = gold?.avatarEmoji,
                                        size = 56.dp,
                                        showAura = true,
                                        isAnimated = true,
                                        accessoryEmoji = "👑"
                                    )
                                    Spacer(modifier = Modifier.height(2.dp))
                                    Text(gold?.name ?: "P1", style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold))
                                    Spacer(modifier = Modifier.height(4.dp))
                                    Surface(
                                        shape = RoundedCornerShape(topStart = 12.dp, topEnd = 12.dp),
                                        color = Color(0xFFFFD700),
                                        modifier = Modifier.width(90.dp).height(130.dp)
                                    ) {
                                        Box(contentAlignment = Alignment.Center) {
                                            Text("#1", style = MaterialTheme.typography.headlineLarge.copy(fontWeight = FontWeight.Black, color = Color.White))
                                        }
                                    }
                                }

                                // #3 Bronze
                                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                    com.example.ui.components.Avatar3DRenderer(
                                        avatarIdOrEmoji = bronze?.avatarEmoji,
                                        size = 44.dp,
                                        showAura = true,
                                        isAnimated = true
                                    )
                                    Spacer(modifier = Modifier.height(2.dp))
                                    Text(bronze?.name ?: "P3", style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold))
                                    Spacer(modifier = Modifier.height(4.dp))
                                    Surface(
                                        shape = RoundedCornerShape(topStart = 12.dp, topEnd = 12.dp),
                                        color = Color(0xFFCD7F32),
                                        modifier = Modifier.width(80.dp).height(80.dp)
                                    ) {
                                        Box(contentAlignment = Alignment.Center) {
                                            Text("#3", style = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.Black, color = Color.White))
                                        }
                                    }
                                }
                            }
                        }

                        Button(
                            onClick = { viewModel.finishLiveSession() },
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(52.dp),
                            shape = RoundedCornerShape(14.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = tierPrimary())
                        ) {
                            Text("Finish & Return to Quizzes", style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold))
                        }
                    }
                }
            }

            // ── Non-blocking "GO!" flash (does not eat into question time) ──
            if (showGoFlash) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(16.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Surface(
                        shape = RoundedCornerShape(20.dp),
                        color = Color(0xFF22C55E).copy(alpha = 0.95f),
                        shadowElevation = 8.dp
                    ) {
                        Column(
                            modifier = Modifier.padding(horizontal = 32.dp, vertical = 20.dp),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Text(
                                text = "⚔️ MATCH ON! ⚔️",
                                style = MaterialTheme.typography.titleLarge.copy(
                                    fontWeight = FontWeight.Black,
                                    color = Color.White,
                                    letterSpacing = 2.sp
                                )
                            )
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = "🚀 GO!",
                                style = MaterialTheme.typography.displayLarge.copy(
                                    fontWeight = FontWeight.Black,
                                    fontSize = 48.sp,
                                    color = Color.White
                                )
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun LiveRankingList(
    players: List<LivePlayer>,
    currentUserId: String
) {
    if (players.isEmpty()) {
        Box(
            modifier = Modifier.fillMaxWidth().padding(24.dp),
            contentAlignment = Alignment.Center
        ) {
            Text("No playing participants yet.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f))
        }
        return
    }
    LazyColumn(
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        itemsIndexed(players) { rank, player ->
            val isUser = player.id.isNotBlank() && currentUserId.isNotBlank() && player.id == currentUserId
            Card(
                shape = RoundedCornerShape(14.dp),
                colors = CardDefaults.cardColors(
                    containerColor = if (isUser) tierTertiary().copy(alpha = 0.15f) else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
                ),
                border = if (isUser) androidx.compose.foundation.BorderStroke(1.5.dp, tierTertiary()) else null,
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier.padding(14.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "#${rank + 1}",
                        style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Black),
                        color = when (rank) {
                            0 -> Color(0xFFFFD700)
                            1 -> Color(0xFFC0C0C0)
                            2 -> Color(0xFFCD7F32)
                            else -> MaterialTheme.colorScheme.onSurface
                        }
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    com.example.ui.components.Avatar3DRenderer(
                        avatarIdOrEmoji = player.avatarEmoji,
                        size = 32.dp,
                        showAura = false,
                        isAnimated = false
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text(player.name, style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Bold))
                        if (player.streak > 1) {
                            Text("🔥 ${player.streak} Answer Streak!", style = MaterialTheme.typography.labelSmall, color = Color(0xFFF2994A))
                        }
                    }
                    Text(
                        text = "${player.score} pts",
                        style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Black, color = tierTertiary())
                    )
                }
            }
        }
    }
}

@Composable
fun PastAttemptsAndRankingsList(
    attempts: List<QuizAttemptEntity>,
    quizzes: List<QuizEntity>,
    searchQuery: String,
    filterMode: String,
    onSelectAttempt: (QuizAttemptEntity, QuizEntity?) -> Unit,
    modifier: Modifier = Modifier
) {
    val dateFormat = remember { java.text.SimpleDateFormat("MMM dd, yyyy • h:mm a", java.util.Locale.getDefault()) }

    val filteredPairs = remember(attempts, quizzes, searchQuery, filterMode) {
        attempts.map { attempt ->
            val quiz = quizzes.find { it.id == attempt.quizId }
            Pair(attempt, quiz)
        }.filter { (attempt, quiz) ->
            val title = quiz?.title ?: "Practice Quiz"
            val matchesSearch = title.contains(searchQuery, ignoreCase = true)
            // Live attempts carry a results snapshot — host AND player attempts are labeled
            // LIVE KAHOOT even when the quiz resolves to a real library quiz (host's own).
            val isLive = attempt.liveResultsJson != null || quiz?.sourceType == "live_kahoot" || title.contains("Live", ignoreCase = true)
            val matchesFilter = when (filterMode) {
                "Live Competitions" -> isLive
                else -> true
            }
            matchesSearch && matchesFilter
        }
    }

    if (filteredPairs.isEmpty()) {
        Box(
            modifier = modifier
                .fillMaxWidth()
                .padding(32.dp),
            contentAlignment = Alignment.Center
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Icon(
                    Icons.Default.EmojiEvents,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.3f),
                    modifier = Modifier.size(56.dp)
                )
                Spacer(modifier = Modifier.height(12.dp))
                Text(
                    text = if (filterMode == "Live Competitions") "No Past Live Competitions" else "No Completed Quiz History",
                    style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold)
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "Complete practice quizzes or join live multiplayer sessions to view performance stats, rankings, and score breakdowns!",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f),
                    textAlign = androidx.compose.ui.text.style.TextAlign.Center
                )
            }
        }
    } else {
        LazyColumn(
            modifier = modifier.fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(12.dp),
            contentPadding = PaddingValues(bottom = 80.dp)
        ) {
            items(filteredPairs, key = { (attempt, _) -> attempt.id }) { (attempt, quiz) ->
                val title = quiz?.title ?: "Live Quiz Session"
                // A live attempt is identified by its results snapshot (works for host & players).
                val isLive = attempt.liveResultsJson != null || quiz?.sourceType == "live_kahoot" || title.contains("Live", ignoreCase = true)
                val formattedDate = try { dateFormat.format(java.util.Date(attempt.createdAt)) } catch (e: Exception) { "Recent" }

                Card(
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.6f)),
                    border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.15f)),
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { onSelectAttempt(attempt, quiz) }
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween,
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Surface(
                                shape = RoundedCornerShape(20.dp),
                                color = if (isLive) tierTertiary().copy(alpha = 0.15f) else tierPrimary().copy(alpha = 0.15f)
                            ) {
                                Row(
                                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Icon(
                                        imageVector = if (isLive) Icons.Default.FlashOn else Icons.Default.Quiz,
                                        contentDescription = null,
                                        tint = if (isLive) tierTertiary() else tierPrimary(),
                                        modifier = Modifier.size(14.dp)
                                    )
                                    Spacer(modifier = Modifier.width(4.dp))
                                    Text(
                                        text = if (isLive) "LIVE KAHOOT" else "SOLO PRACTICE",
                                        style = MaterialTheme.typography.labelSmall.copy(
                                            fontWeight = FontWeight.Bold,
                                            color = if (isLive) tierTertiary() else tierPrimary()
                                        )
                                    )
                                }
                            }

                            if (isLive) {
                                // Real rank from the saved leaderboard snapshot — exactly what the
                                // tapped results screen shows. Never fabricate a rank from the score
                                // percentage.
                                val snapshot = remember(attempt) { parseLiveResultsSnapshot(attempt.liveResultsJson) }
                                val yourRank = yourRankFromSnapshot(snapshot)

                                if (yourRank != null) {
                                    val (rankText, rankColor) = when (yourRank) {
                                        1 -> "🏆 Rank #1 Gold" to Color(0xFFFFD700)
                                        2 -> "🥈 Rank #2 Silver" to Color(0xFFC0C0C0)
                                        3 -> "🥉 Rank #3 Bronze" to Color(0xFFCD7F32)
                                        else -> "🎯 Rank #$yourRank Player" to tierTertiary()
                                    }
                                    Surface(
                                        shape = RoundedCornerShape(20.dp),
                                        color = rankColor.copy(alpha = 0.2f)
                                    ) {
                                        Text(
                                            text = rankText,
                                            style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold, color = rankColor),
                                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                                        )
                                    }
                                } else {
                                    // No usable snapshot (older attempt) — show accuracy instead of guessing.
                                    Surface(
                                        shape = RoundedCornerShape(20.dp),
                                        color = EmeraldAccent.copy(alpha = 0.15f)
                                    ) {
                                        Text(
                                            text = "${attempt.percentage}% Accuracy",
                                            style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold, color = EmeraldAccent),
                                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                                        )
                                    }
                                }
                            } else {
                                Surface(
                                    shape = RoundedCornerShape(20.dp),
                                    color = EmeraldAccent.copy(alpha = 0.15f)
                                ) {
                                    Text(
                                        text = "${attempt.percentage}% Accuracy",
                                        style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold, color = EmeraldAccent),
                                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                                    )
                                }
                            }
                        }

                        Spacer(modifier = Modifier.height(10.dp))

                        Text(
                            text = title,
                            style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                            maxLines = 2,
                            overflow = TextOverflow.Ellipsis
                        )

                        Spacer(modifier = Modifier.height(6.dp))

                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(16.dp)
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Default.CheckCircle, contentDescription = null, tint = EmeraldAccent, modifier = Modifier.size(16.dp))
                                Spacer(modifier = Modifier.width(4.dp))
                                Text(
                                    text = "${attempt.score}/${attempt.totalQuestions} Correct",
                                    style = MaterialTheme.typography.bodySmall.copy(fontWeight = FontWeight.SemiBold)
                                )
                            }

                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Default.Timer, contentDescription = null, tint = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f), modifier = Modifier.size(16.dp))
                                Spacer(modifier = Modifier.width(4.dp))
                                Text(
                                    text = "${attempt.timeTakenSeconds}s",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)
                                )
                            }

                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Default.Stars, contentDescription = null, tint = Color(0xFFFFB800), modifier = Modifier.size(16.dp))
                                Spacer(modifier = Modifier.width(4.dp))
                                Text(
                                    text = "+${attempt.xpEarned} XP",
                                    style = MaterialTheme.typography.bodySmall.copy(fontWeight = FontWeight.Bold, color = Color(0xFFFFB800))
                                )
                            }
                        }

                        Spacer(modifier = Modifier.height(12.dp))

                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween,
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text(
                                text = formattedDate,
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f)
                            )

                            OutlinedButton(
                                onClick = { onSelectAttempt(attempt, quiz) },
                                shape = RoundedCornerShape(10.dp),
                                contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp),
                                modifier = Modifier.height(34.dp)
                            ) {
                                Icon(Icons.Default.Analytics, contentDescription = null, modifier = Modifier.size(14.dp))
                                Spacer(modifier = Modifier.width(4.dp))
                                Text("Breakdown & Rankings", style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold))
                            }
                        }
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PastAttemptDetailModal(
    attempt: QuizAttemptEntity,
    quiz: QuizEntity?,
    onDismiss: () -> Unit,
    onReplay: () -> Unit
) {
    val isLive = quiz?.sourceType == "live_kahoot" || (quiz?.title?.contains("Live", ignoreCase = true) == true)
    val title = quiz?.title ?: "Practice Quiz"
    val dateFormat = remember { java.text.SimpleDateFormat("MMMM dd, yyyy • h:mm a", java.util.Locale.getDefault()) }
    val formattedDate = try { dateFormat.format(java.util.Date(attempt.createdAt)) } catch (e: Exception) { "Recent" }

    AlertDialog(
        onDismissRequest = onDismiss,
        confirmButton = {
            Button(
                onClick = onReplay,
                colors = ButtonDefaults.buttonColors(containerColor = if (isLive) tierTertiary() else tierPrimary()),
                shape = RoundedCornerShape(10.dp)
            ) {
                Icon(if (isLive) Icons.Default.FlashOn else Icons.Default.Replay, contentDescription = null, modifier = Modifier.size(16.dp))
                Spacer(modifier = Modifier.width(6.dp))
                Text(if (isLive) "Launch Live Game" else "Retake Quiz")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Close")
            }
        },
        title = {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    imageVector = if (isLive) Icons.Default.EmojiEvents else Icons.Default.Analytics,
                    contentDescription = null,
                    tint = if (isLive) tierTertiary() else tierPrimary()
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = if (isLive) "Live Competition Summary" else "Quiz Performance Analysis",
                    style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold)
                )
            }
        },
        text = {
            Column(modifier = Modifier.fillMaxWidth()) {
                Text(text = title, style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold))
                Spacer(modifier = Modifier.height(2.dp))
                Text(text = formattedDate, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f))

                Spacer(modifier = Modifier.height(16.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Card(
                        modifier = Modifier.weight(1f),
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Column(
                            modifier = Modifier.padding(12.dp),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Text("Accuracy", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f))
                            Spacer(modifier = Modifier.height(4.dp))
                            Text("${attempt.percentage}%", style = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.Black, color = EmeraldAccent))
                            Text("${attempt.score}/${attempt.totalQuestions} Correct", style = MaterialTheme.typography.labelSmall)
                        }
                    }

                    Card(
                        modifier = Modifier.weight(1f),
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Column(
                            modifier = Modifier.padding(12.dp),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Text("XP Earned", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f))
                            Spacer(modifier = Modifier.height(4.dp))
                            Text("+${attempt.xpEarned}", style = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.Black, color = Color(0xFFFFB800)))
                            Text("${attempt.timeTakenSeconds}s Speed", style = MaterialTheme.typography.labelSmall)
                        }
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                if (isLive) {
                    Text(
                        text = "Final Leaderboard Standings 🏆",
                        style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold)
                    )
                    Spacer(modifier = Modifier.height(8.dp))

                    // Live results now open in the full-page results screen (real leaderboard + question review).
                    // If this fallback modal is ever shown, render the real leaderboard from the saved snapshot.
                    val snapshotPlayers = parseLiveResultsSnapshot(attempt.liveResultsJson)
                    if (snapshotPlayers != null && snapshotPlayers.players.isNotEmpty()) {
                        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            snapshotPlayers.players.forEachIndexed { rank, player ->
                                Surface(
                                    shape = RoundedCornerShape(8.dp),
                                    color = if (player.isYou) tierTertiary().copy(alpha = 0.15f) else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f),
                                    border = if (player.isYou) androidx.compose.foundation.BorderStroke(1.dp, tierTertiary()) else null,
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Row(
                                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 8.dp),
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Text(
                                            text = "#${rank + 1}",
                                            style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Bold),
                                            color = when (rank) {
                                                0 -> Color(0xFFFFD700)
                                                1 -> Color(0xFFC0C0C0)
                                                2 -> Color(0xFFCD7F32)
                                                else -> MaterialTheme.colorScheme.onSurface
                                            }
                                        )
                                        Spacer(modifier = Modifier.width(8.dp))
                                        Text("👤", fontSize = 16.sp)
                                        Spacer(modifier = Modifier.width(8.dp))
                                        Text(player.name, style = MaterialTheme.typography.bodySmall.copy(fontWeight = if (player.isYou) FontWeight.Bold else FontWeight.Normal), modifier = Modifier.weight(1f))
                                        Text("${player.score} pts", style = MaterialTheme.typography.bodySmall.copy(fontWeight = FontWeight.Bold, color = tierTertiary()))
                                    }
                                }
                            }
                        }
                    } else {
                        Text(
                            text = "Open this attempt to view the full results page with rankings and question review.",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
                        )
                    }
                } else {
                    Surface(
                        shape = RoundedCornerShape(12.dp),
                        color = EmeraldAccent.copy(alpha = 0.12f),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Row(
                            modifier = Modifier.padding(12.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(Icons.Default.CheckCircle, contentDescription = null, tint = EmeraldAccent)
                            Spacer(modifier = Modifier.width(10.dp))
                            Text(
                                text = "Great job! All questions and explanations were reviewed. Retake anytime to improve speed and boost your streak.",
                                style = MaterialTheme.typography.bodySmall
                            )
                        }
                    }
                }
            }
        }
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LiveQuizResultsScreen(
    attempt: QuizAttemptEntity,
    quiz: QuizEntity?,
    onBack: () -> Unit,
    onPlayAgain: () -> Unit
) {
    val snapshot = remember(attempt) { parseLiveResultsSnapshot(attempt.liveResultsJson) }
    val title = snapshot?.title?.takeIf { it.isNotBlank() } ?: quiz?.title ?: "Live Competition"
    val dateFormat = remember { java.text.SimpleDateFormat("MMMM dd, yyyy • h:mm a", java.util.Locale.getDefault()) }
    val formattedDate = try { dateFormat.format(java.util.Date(attempt.createdAt)) } catch (e: Exception) { "Recent" }

    // If no snapshot exists (older attempts), fall back to the mirrored questions so the
    // question review still has content. The leaderboard simply shows the user's own score.
    val fallbackQuestions = if (snapshot == null) parseQuizQuestionsJson(quiz?.questionsJson ?: "[]") else emptyList()
    val players = snapshot?.players.orEmpty()
    val sortedPlayers = players.sortedByDescending { it.score }
    // Shared helper keeps the card and the results screen in lockstep.
    val yourRank = yourRankFromSnapshot(snapshot)

    Scaffold(
        topBar = {
            TopAppBar(
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                title = {
                    Column {
                        Text("Live Quiz Results", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleMedium)
                        Text(title, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f), maxLines = 1, overflow = TextOverflow.Ellipsis)
                    }
                },
                actions = {
                    IconButton(onClick = onPlayAgain) {
                        Icon(Icons.Default.FlashOn, contentDescription = "Play Again", tint = tierTertiary())
                    }
                }
            )
        }
    ) { innerPadding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding),
            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            // ─── Header ───
            item {
                Surface(
                    shape = RoundedCornerShape(20.dp),
                    color = tierTertiary().copy(alpha = 0.10f),
                    border = androidx.compose.foundation.BorderStroke(1.dp, tierTertiary().copy(alpha = 0.25f)),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(
                        modifier = Modifier.padding(20.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Icon(Icons.Default.EmojiEvents, contentDescription = null, tint = Color(0xFFFFD700), modifier = Modifier.size(52.dp))
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = "SESSION COMPLETE",
                            style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Black, color = tierTertiary())
                        )
                        Text(formattedDate, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f))
                    }
                }
            }

            // ─── Your performance ───
            item {
                val accuracy = if (attempt.totalQuestions > 0) (attempt.score * 100) / attempt.totalQuestions else 0
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    StatTile(label = "Score", value = "${attempt.score}/${attempt.totalQuestions}", color = EmeraldAccent, modifier = Modifier.weight(1f))
                    StatTile(label = "Accuracy", value = "$accuracy%", color = tierPrimary(), modifier = Modifier.weight(1f))
                    StatTile(label = "Rank", value = if (yourRank != null) "#$yourRank" else "—", color = Color(0xFFFFD700), modifier = Modifier.weight(1f))
                }
            }

            // ─── 3D Tiered Podium (top 3) ───
            if (sortedPlayers.size >= 1) {
                item {
                    Text(
                        text = "🏆 Final Standings Podium",
                        style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.ExtraBold)
                    )
                    Spacer(modifier = Modifier.height(12.dp))

                    Surface(
                        shape = RoundedCornerShape(24.dp),
                        color = Color(0xFF0F172A),
                        border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFF1E293B)),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(top = 16.dp, start = 8.dp, end = 8.dp, bottom = 12.dp),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceEvenly,
                                verticalAlignment = Alignment.Bottom
                            ) {
                                val silver = sortedPlayers.getOrNull(1)
                                val gold = sortedPlayers.getOrNull(0)
                                val bronze = sortedPlayers.getOrNull(2)

                                // 2nd Place (Silver)
                                if (silver != null) {
                                    PodiumColumn3D(
                                        name = silver.name,
                                        score = silver.score,
                                        rank = 2,
                                        pedestalHeight = 100.dp,
                                        topBevelColor = Color(0xFFF1F5F9),
                                        pedestalBrush = Brush.verticalGradient(listOf(Color(0xFFE2E8F0), Color(0xFF94A3B8), Color(0xFF64748B))),
                                        isYou = silver.isYou,
                                        modifier = Modifier.weight(1f)
                                    )
                                } else {
                                    Spacer(modifier = Modifier.weight(1f))
                                }

                                // 1st Place (Gold)
                                if (gold != null) {
                                    PodiumColumn3D(
                                        name = gold.name,
                                        score = gold.score,
                                        rank = 1,
                                        pedestalHeight = 135.dp,
                                        topBevelColor = Color(0xFFFEF08A),
                                        pedestalBrush = Brush.verticalGradient(listOf(Color(0xFFFDE047), Color(0xFFF59E0B), Color(0xFFD97706))),
                                        isYou = gold.isYou,
                                        modifier = Modifier.weight(1.15f)
                                    )
                                } else {
                                    Spacer(modifier = Modifier.weight(1.15f))
                                }

                                // 3rd Place (Bronze)
                                if (bronze != null) {
                                    PodiumColumn3D(
                                        name = bronze.name,
                                        score = bronze.score,
                                        rank = 3,
                                        pedestalHeight = 80.dp,
                                        topBevelColor = Color(0xFFFFEDD5),
                                        pedestalBrush = Brush.verticalGradient(listOf(Color(0xFFFDBA74), Color(0xFFEA580C), Color(0xFF9A3412))),
                                        isYou = bronze.isYou,
                                        modifier = Modifier.weight(1f)
                                    )
                                } else {
                                    Spacer(modifier = Modifier.weight(1f))
                                }
                            }
                        }
                    }
                }
            }

            // ─── Final rankings (real players) ───
            if (sortedPlayers.isNotEmpty()) {
                item {
                    Text("Final Rankings", style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold))
                    Spacer(modifier = Modifier.height(8.dp))
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        sortedPlayers.forEachIndexed { index, player ->
                            val isYou = player.isYou
                            Surface(
                                shape = RoundedCornerShape(12.dp),
                                color = if (isYou) tierTertiary().copy(alpha = 0.15f) else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f),
                                border = if (isYou) androidx.compose.foundation.BorderStroke(1.5.dp, tierTertiary()) else null,
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Row(
                                    modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text(
                                        text = "#${index + 1}",
                                        style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Black),
                                        color = when (index) {
                                            0 -> Color(0xFFFFD700)
                                            1 -> Color(0xFFC0C0C0)
                                            2 -> Color(0xFFCD7F32)
                                            else -> MaterialTheme.colorScheme.onSurface
                                        }
                                    )
                                    Spacer(modifier = Modifier.width(12.dp))
                                    Surface(shape = CircleShape, color = if (isYou) tierTertiary() else MaterialTheme.colorScheme.surfaceVariant, modifier = Modifier.size(30.dp)) {
                                        Box(contentAlignment = Alignment.Center) {
                                            Text(
                                                text = (player.name.take(1).uppercase()),
                                                style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold, color = if (isYou) Color.White else MaterialTheme.colorScheme.onSurface)
                                            )
                                        }
                                    }
                                    Spacer(modifier = Modifier.width(10.dp))
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(player.name, style = MaterialTheme.typography.bodyMedium.copy(fontWeight = if (isYou) FontWeight.Bold else FontWeight.Medium), maxLines = 1, overflow = TextOverflow.Ellipsis)
                                        if (isYou) {
                                            Text("You", style = MaterialTheme.typography.labelSmall, color = tierTertiary())
                                        }
                                    }
                                    Text(
                                        text = "${player.score} pts",
                                        style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Black, color = tierTertiary())
                                    )
                                }
                            }
                        }
                    }
                }
            }

            // ─── Question review (like the web) ───
            val reviewQuestions = snapshot?.questions.orEmpty().ifEmpty {
                fallbackQuestions.map { q ->
                    LiveResultsQuestionEntry(
                        question = q.question,
                        options = q.options,
                        correctIndex = q.correctIndex,
                        explanation = q.explanation,
                        userAnswerIndex = null,
                        isCorrect = false
                    )
                }
            }
            if (reviewQuestions.isNotEmpty()) {
                item {
                    Text("Review Your Answers", style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold))
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        "See how you answered each question, the correct option, and the explanation.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
                    )
                    Spacer(modifier = Modifier.height(10.dp))
                }

                items(reviewQuestions.size) { idx ->
                    val q = reviewQuestions[idx]
                    QuestionReviewCard(index = idx, question = q)
                }
            }

            // ─── Actions ───
            item {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Button(
                        onClick = onPlayAgain,
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(52.dp),
                        shape = RoundedCornerShape(14.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = tierTertiary())
                    ) {
                        Icon(Icons.Default.FlashOn, contentDescription = null)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Play Again", style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold))
                    }
                    OutlinedButton(
                        onClick = onBack,
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(48.dp),
                        shape = RoundedCornerShape(14.dp)
                    ) {
                        Text("Back to Quizzes", fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}

@Composable
private fun StatTile(label: String, value: String, color: Color, modifier: Modifier = Modifier) {
    Card(
        modifier = modifier,
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f))
    ) {
        Column(
            modifier = Modifier.padding(12.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(value, style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Black, color = color))
            Text(label, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f))
        }
    }
}

@Composable
private fun PodiumColumn3D(
    name: String?,
    score: Int?,
    rank: Int,
    pedestalHeight: androidx.compose.ui.unit.Dp,
    topBevelColor: Color,
    pedestalBrush: Brush,
    isYou: Boolean = false,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier.padding(horizontal = 4.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        // Crown / Medal badge for top 3
        if (rank == 1) {
            Text("👑", fontSize = 24.sp, modifier = Modifier.padding(bottom = 2.dp))
        } else {
            val medal = when (rank) { 2 -> "🥈"; else -> "🥉" }
            Text(medal, fontSize = 20.sp, modifier = Modifier.padding(bottom = 2.dp))
        }

        // Circular Avatar Badge
        Surface(
            shape = CircleShape,
            color = if (isYou) tierTertiary() else when (rank) {
                1 -> Color(0xFFFBBF24)
                2 -> Color(0xFF94A3B8)
                else -> Color(0xFFF97316)
            },
            border = androidx.compose.foundation.BorderStroke(if (rank == 1) 2.5.dp else 1.5.dp, Color.White),
            modifier = Modifier.size(if (rank == 1) 54.dp else 44.dp)
        ) {
            Box(contentAlignment = Alignment.Center) {
                Text(
                    text = name?.take(1)?.uppercase() ?: "?",
                    style = MaterialTheme.typography.titleMedium.copy(
                        fontWeight = FontWeight.Black,
                        color = Color.White,
                        fontSize = if (rank == 1) 18.sp else 14.sp
                    )
                )
            }
        }

        Spacer(modifier = Modifier.height(4.dp))

        Text(
            text = if (isYou) "You" else (name ?: "Explorer"),
            style = MaterialTheme.typography.labelMedium.copy(
                fontWeight = FontWeight.ExtraBold,
                color = Color.White,
                fontSize = if (rank == 1) 12.sp else 11.sp
            ),
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(horizontal = 2.dp)
        )

        // XP/Points Pill
        Surface(
            shape = RoundedCornerShape(8.dp),
            color = Color.Black.copy(alpha = 0.45f),
            modifier = Modifier.padding(top = 2.dp, bottom = 6.dp)
        ) {
            Row(
                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(2.dp)
            ) {
                Text("⭐", fontSize = 9.sp)
                Text(
                    text = "${score ?: 0}",
                    style = MaterialTheme.typography.labelSmall.copy(
                        fontWeight = FontWeight.ExtraBold,
                        color = Color(0xFFFFD700),
                        fontSize = 10.sp
                    )
                )
            }
        }

        // 3D Pedestal Block with Top Isometric Bevel
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .height(pedestalHeight),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // Top Isometric Lip
            Surface(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(8.dp),
                shape = RoundedCornerShape(topStart = 14.dp, topEnd = 14.dp),
                color = topBevelColor
            ) {}

            // Front Column Pillar
            Surface(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f),
                shape = RoundedCornerShape(bottomStart = 8.dp, bottomEnd = 8.dp),
                color = Color.Transparent
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(pedestalBrush),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "$rank",
                        style = MaterialTheme.typography.titleLarge.copy(
                            fontWeight = FontWeight.Black,
                            color = Color.White.copy(alpha = 0.85f),
                            fontSize = if (rank == 1) 28.sp else 22.sp
                        )
                    )
                }
            }
        }
    }
}

@Composable
private fun QuestionReviewCard(index: Int, question: LiveResultsQuestionEntry) {
    val wasCorrect = question.isCorrect
    Card(
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Surface(
                    shape = CircleShape,
                    color = if (wasCorrect) EmeraldAccent else MaterialTheme.colorScheme.error,
                    modifier = Modifier.size(26.dp)
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Text(
                            text = if (wasCorrect) "✓" else "✗",
                            style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Black, color = Color.White)
                        )
                    }
                }
                Spacer(modifier = Modifier.width(10.dp))
                Text("Question ${index + 1}", style = MaterialTheme.typography.labelLarge.copy(fontWeight = FontWeight.Bold))
                Spacer(modifier = Modifier.weight(1f))
                if (question.userAnswerIndex == null) {
                    Text("Not answered", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f))
                }
            }

            Spacer(modifier = Modifier.height(10.dp))
            Text(question.question, style = MaterialTheme.typography.bodyLarge.copy(fontWeight = FontWeight.Medium))
            Spacer(modifier = Modifier.height(10.dp))

            question.options.forEachIndexed { optIdx, optionText ->
                val isCorrectOption = optIdx == question.correctIndex
                val isUserAnswer = optIdx == question.userAnswerIndex
                val isWrongAnswer = isUserAnswer && !isCorrectOption

                val containerColor = when {
                    isCorrectOption -> EmeraldAccent.copy(alpha = 0.16f)
                    isWrongAnswer -> MaterialTheme.colorScheme.error.copy(alpha = 0.16f)
                    else -> MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f)
                }
                val borderColor = when {
                    isCorrectOption -> EmeraldAccent
                    isWrongAnswer -> MaterialTheme.colorScheme.error
                    else -> Color.Transparent
                }

                Surface(
                    shape = RoundedCornerShape(10.dp),
                    color = containerColor,
                    border = androidx.compose.foundation.BorderStroke(1.dp, borderColor),
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 3.dp)
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 9.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "${('A' + optIdx)}",
                            style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold),
                            color = if (isCorrectOption) EmeraldAccent else if (isWrongAnswer) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurface
                        )
                        Spacer(modifier = Modifier.width(10.dp))
                        Text(optionText, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.weight(1f))
                        if (isCorrectOption) {
                            Text("✓ Correct", style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold, color = EmeraldAccent))
                        }
                        if (isWrongAnswer) {
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("Your answer", style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.error))
                        }
                    }
                }
            }

            if (question.explanation.isNotBlank()) {
                Spacer(modifier = Modifier.height(10.dp))
                Surface(
                    shape = RoundedCornerShape(10.dp),
                    color = tierPrimary().copy(alpha = 0.10f),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(modifier = Modifier.padding(12.dp), verticalAlignment = Alignment.Top) {
                        Icon(Icons.Default.Info, contentDescription = null, tint = tierPrimary(), modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = question.explanation,
                            style = MaterialTheme.typography.bodySmall,
                            modifier = Modifier.weight(1f)
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun PublicLiveLobbiesList(
    searchQuery: String,
    onJoinSession: (pin: String, topic: String, isHost: Boolean, config: QuizConfig) -> Unit,
    onViewRules: (QuizConfig) -> Unit
) {
    var lobbiesState by remember {
        mutableStateOf<List<Pair<Triple<String, String, QuizConfig>, Pair<String, String>>>>(emptyList())
    }
    var isLoading by remember { mutableStateOf(true) }

    LaunchedEffect(Unit) {
        val result = com.example.data.remote.BackendApiService.getLiveQuizLobbies()
        if (result is com.example.data.remote.BackendResult.Success) {
            val array = result.data
            val parsedList = mutableListOf<Pair<Triple<String, String, QuizConfig>, Pair<String, String>>>()
            for (i in 0 until array.length()) {
                val obj = array.getJSONObject(i)
                // Privacy: private sessions (allow_late_join = false) never appear in the
                // public discoverable lobby list — join only by PIN (web behavior).
                if (!obj.optBoolean("allow_late_join", true)) continue
                val id = obj.optString("id", "")
                // Only show sessions with a real server-assigned PIN — never fabricate one.
                val pin = obj.optString("join_code", "")
                if (pin.isBlank()) continue
                val quizId = obj.optString("quiz_id", "")
                val quizzesObj = obj.optJSONObject("quizzes")
                val quizTitle = quizzesObj?.optString("title", "")?.takeIf { it.isNotBlank() }
                val title = quizTitle ?: quizId.replace("-", " ").capitalize()
                val status = obj.optString("status", "waiting")
                val displayStatus = if (status == "in_progress") "LIVE 🔴" else "LOBBY ⏳"
                val hostId = obj.optString("host_user_id", "Scholar")
                val shortHost = if (hostId.length > 8) hostId.take(8) else hostId
                val maxPlayers = 10
                parsedList.add(
                    Triple(
                        title,
                        pin,
                        QuizConfig(topic = title, questionCount = 5, maxPlayers = maxPlayers)
                    ) to Pair("Scholar_$shortHost", "1 / $maxPlayers Players • $displayStatus")
                )
            }
            lobbiesState = parsedList
        }
        isLoading = false
    }

    val filtered = lobbiesState.filter { (lobbyData, hostData) ->
        val title = lobbyData.first
        val host = hostData.first
        title.contains(searchQuery, ignoreCase = true) || host.contains(searchQuery, ignoreCase = true)
    }

    if (filtered.isEmpty()) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .padding(32.dp),
            contentAlignment = Alignment.Center
        ) {
            Text("No public live lobbies matching \"$searchQuery\"", style = MaterialTheme.typography.bodyMedium)
        }
    } else {
        Column(
            verticalArrangement = Arrangement.spacedBy(12.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            filtered.forEach { (lobbyData, hostData) ->
                val (title, pin, config) = lobbyData
                val (hostName, statusText) = hostData

                Card(
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    border = androidx.compose.foundation.BorderStroke(1.dp, tierTertiary().copy(alpha = 0.25f)),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Surface(
                                shape = RoundedCornerShape(8.dp),
                                color = tierTertiary().copy(alpha = 0.15f)
                            ) {
                                Row(
                                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Icon(Icons.Default.FlashOn, contentDescription = null, tint = tierTertiary(), modifier = Modifier.size(14.dp))
                                    Spacer(modifier = Modifier.width(4.dp))
                                    Text("PIN: $pin", style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold, color = tierTertiary()))
                                }
                            }

                            Text(statusText, style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold, color = EmeraldAccent))
                        }

                        Spacer(modifier = Modifier.height(10.dp))

                        Text(title, style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold))
                        Spacer(modifier = Modifier.height(2.dp))
                        Text("Host: $hostName", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f))

                        Spacer(modifier = Modifier.height(12.dp))

                        // Config Badges
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(6.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Surface(shape = CircleShape, color = MaterialTheme.colorScheme.surfaceVariant) {
                                Text("${config.questionCount} Qs", style = MaterialTheme.typography.labelSmall, modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp))
                            }
                            Surface(shape = CircleShape, color = MaterialTheme.colorScheme.surfaceVariant) {
                                Text("${config.timeLimitSec}s Timer", style = MaterialTheme.typography.labelSmall, modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp))
                            }
                            Surface(shape = CircleShape, color = MaterialTheme.colorScheme.surfaceVariant) {
                                Text(config.difficulty, style = MaterialTheme.typography.labelSmall, modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp))
                            }
                        }

                        Spacer(modifier = Modifier.height(16.dp))

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            OutlinedButton(
                                onClick = { onViewRules(config) },
                                modifier = Modifier.weight(1f),
                                shape = RoundedCornerShape(10.dp)
                            ) {
                                Icon(Icons.Default.MenuBook, contentDescription = null, modifier = Modifier.size(16.dp))
                                Spacer(modifier = Modifier.width(4.dp))
                                Text("Rules", style = MaterialTheme.typography.labelMedium)
                            }

                            Button(
                                onClick = { onJoinSession(pin, title, false, config) },
                                modifier = Modifier.weight(1.3f),
                                colors = ButtonDefaults.buttonColors(containerColor = tierTertiary()),
                                shape = RoundedCornerShape(10.dp)
                            ) {
                                Icon(Icons.Default.PlayArrow, contentDescription = null, modifier = Modifier.size(18.dp))
                                Spacer(modifier = Modifier.width(4.dp))
                                Text("Join Session", style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold))
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun QuizRulesAndGuidelinesModal(
    config: QuizConfig,
    onDismiss: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Default.MenuBook, contentDescription = null, tint = tierPrimary())
                Spacer(modifier = Modifier.width(8.dp))
                Text("Quiz Rules & Guidelines", fontWeight = FontWeight.Bold)
            }
        },
        text = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 4.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = tierTertiary().copy(alpha = 0.1f),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(12.dp)) {
                        Text("CURRENT SESSION CONFIGURATION", style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold, color = tierTertiary()))
                        Spacer(modifier = Modifier.height(4.dp))
                        Text("• Topic: ${config.topic}", style = MaterialTheme.typography.bodySmall)
                        Text("• Question Count: ${config.questionCount} Questions", style = MaterialTheme.typography.bodySmall)
                        Text("• Time Limit: ${config.timeLimitSec} seconds per question", style = MaterialTheme.typography.bodySmall)
                        Text("• Difficulty: ${config.difficulty}", style = MaterialTheme.typography.bodySmall)
                    }
                }

                // Rule 1
                Row(verticalAlignment = Alignment.Top) {
                    Surface(shape = CircleShape, color = tierPrimary().copy(alpha = 0.15f), modifier = Modifier.size(28.dp)) {
                        Box(contentAlignment = Alignment.Center) {
                            Text("1", style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold, color = tierPrimary()))
                        }
                    }
                    Spacer(modifier = Modifier.width(10.dp))
                    Column {
                        Text("Kahoot-Style Speed Scoring", style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Bold))
                        Text("Each correct answer grants 1,000 base points. If Speed Bonus is enabled, fast responses earn up to +900 additional points based on remaining clock time!", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f))
                    }
                }

                // Rule 2
                Row(verticalAlignment = Alignment.Top) {
                    Surface(shape = CircleShape, color = tierSecondary().copy(alpha = 0.2f), modifier = Modifier.size(28.dp)) {
                        Box(contentAlignment = Alignment.Center) {
                            Text("2", style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold, color = tierSecondary()))
                        }
                    }
                    Spacer(modifier = Modifier.width(10.dp))
                    Column {
                        Text("🔥 Streak Multipliers", style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Bold))
                        Text("Maintain consecutive correct answers to unlock streak multipliers (+100 XP per streak level). Missing a question resets your streak to 0.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f))
                    }
                }

                // Rule 3
                Row(verticalAlignment = Alignment.Top) {
                    Surface(shape = CircleShape, color = tierTertiary().copy(alpha = 0.2f), modifier = Modifier.size(28.dp)) {
                        Box(contentAlignment = Alignment.Center) {
                            Text("3", style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold, color = tierTertiary()))
                        }
                    }
                    Spacer(modifier = Modifier.width(10.dp))
                    Column {
                        Text("🎮 Interactive Kahoot Shapes", style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Bold))
                        Text("Options correspond to geometric shapes:\n• Red Triangle 🔴 = Option A\n• Blue Diamond 🔷 = Option B\n• Yellow Circle 🟡 = Option C\n• Green Square 🟢 = Option D", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f))
                    }
                }

                // Rule 4
                Row(verticalAlignment = Alignment.Top) {
                    Surface(shape = CircleShape, color = MaterialTheme.colorScheme.secondaryContainer, modifier = Modifier.size(28.dp)) {
                        Box(contentAlignment = Alignment.Center) {
                            Text("4", style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold))
                        }
                    }
                    Spacer(modifier = Modifier.width(10.dp))
                    Column {
                        Text("🏆 Live Podium & History", style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Bold))
                        Text("Real-time scoreboards reveal top competitors after each question. Final standings award XP and save your quiz for future retakes in the All Quiz tab.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f))
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = onDismiss,
                colors = ButtonDefaults.buttonColors(containerColor = tierPrimary()),
                shape = RoundedCornerShape(10.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Text("Understood! Let's Play 🚀", fontWeight = FontWeight.Bold)
            }
        }
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FullAIQuizCreatorScreen(
    state: QuizzesUiState,
    onBack: () -> Unit,
    onGenerateFromTopic: (String, List<String>, QuizConfig) -> Unit,
    onGenerateFromNotes: (List<String>, String, QuizConfig) -> Unit,
    onGenerateFromRecording: (String, QuizConfig) -> Unit,
    onGenerateFromDocument: (String, QuizConfig) -> Unit
) {
    var selectedSourceTab by remember { mutableIntStateOf(0) }

    // Topic Tab state
    var topicText by remember { mutableStateOf("Computer Science & AI") }
    var selectedFocusArea by remember { mutableStateOf("") }
    val focusAreas = remember { mutableStateListOf<String>() }

    // Notes Tab state
    val selectedNoteIds = remember { mutableStateListOf<String>() }
    var pastedNotesText by remember { mutableStateOf("") }

    // Recording Tab state
    var selectedRecordingId by remember { mutableStateOf(state.recordings.firstOrNull()?.id ?: "") }

    // Document Tab state
    var selectedDocumentId by remember { mutableStateOf(state.documents.firstOrNull()?.id ?: "") }

    // Quiz Config settings
    var questionCount by remember { mutableIntStateOf(5) }
    var difficulty by remember { mutableStateOf("Medium") }
    var questionType by remember { mutableStateOf("Multiple Choice") }
    var timeLimitSec by remember { mutableIntStateOf(20) }

    val commonTopics = listOf("Biology", "Computer Science", "Mathematics", "History", "Physics", "Chemistry", "Economics", "Psychology", "Calculus", "Data Structures")

    Scaffold(
        topBar = {
            TopAppBar(
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back to Practice Quizzes")
                    }
                },
                title = {
                    Column {
                        Text("Create AI Practice Quiz 🎯", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleMedium)
                        Text("Professor Ollie's Question Engine", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f))
                    }
                },
                actions = {
                    IconButton(onClick = { /* Help */ }) {
                        Icon(Icons.Default.AutoAwesome, contentDescription = null, tint = tierPrimary())
                    }
                }
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            LazyColumn(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f)
                    .padding(horizontal = 16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp),
                contentPadding = PaddingValues(top = 12.dp, bottom = 24.dp)
            ) {
                // Ollie Banner
                item {
                    Surface(
                        shape = RoundedCornerShape(16.dp),
                        color = tierPrimary().copy(alpha = 0.08f),
                        border = BorderStroke(1.dp, tierPrimary().copy(alpha = 0.2f)),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Row(
                            modifier = Modifier.padding(16.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(48.dp)
                                    .clip(CircleShape)
                                    .background(tierPrimary().copy(alpha = 0.15f)),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(Icons.Default.Psychology, contentDescription = null, tint = tierPrimary(), modifier = Modifier.size(28.dp))
                            }
                            Spacer(modifier = Modifier.width(14.dp))
                            Column(modifier = Modifier.weight(1f)) {
                                Text("Select a Study Source", style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold, color = tierPrimary()))
                                Text("Generate interactive practice questions directly from topics, study notes, lecture audio transcripts, or uploaded PDFs!", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f))
                            }
                        }
                    }
                }

                // Source Tabs
                item {
                    ScrollableTabRow(
                        selectedTabIndex = selectedSourceTab,
                        edgePadding = 0.dp,
                        containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f),
                        modifier = Modifier.clip(RoundedCornerShape(12.dp))
                    ) {
                        Tab(
                            selected = selectedSourceTab == 0,
                            onClick = { selectedSourceTab = 0 },
                            text = { Text("AI Topic", fontWeight = if (selectedSourceTab == 0) FontWeight.Bold else FontWeight.Normal) },
                            icon = { Icon(Icons.Default.Psychology, contentDescription = null, modifier = Modifier.size(18.dp)) }
                        )
                        Tab(
                            selected = selectedSourceTab == 1,
                            onClick = { selectedSourceTab = 1 },
                            text = { Text("Notes (${state.notes.size})", fontWeight = if (selectedSourceTab == 1) FontWeight.Bold else FontWeight.Normal) },
                            icon = { Icon(Icons.Default.Description, contentDescription = null, modifier = Modifier.size(18.dp)) }
                        )
                        Tab(
                            selected = selectedSourceTab == 2,
                            onClick = { selectedSourceTab = 2 },
                            text = { Text("Recordings (${state.recordings.size})", fontWeight = if (selectedSourceTab == 2) FontWeight.Bold else FontWeight.Normal) },
                            icon = { Icon(Icons.Default.Mic, contentDescription = null, modifier = Modifier.size(18.dp)) }
                        )
                        Tab(
                            selected = selectedSourceTab == 3,
                            onClick = { selectedSourceTab = 3 },
                            text = { Text("Docs (${state.documents.size})", fontWeight = if (selectedSourceTab == 3) FontWeight.Bold else FontWeight.Normal) },
                            icon = { Icon(Icons.Default.Folder, contentDescription = null, modifier = Modifier.size(18.dp)) }
                        )
                    }
                }

                // Selected Tab Panel Content Card
                item {
                    Card(
                        shape = RoundedCornerShape(16.dp),
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.35f)),
                        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.15f)),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                            when (selectedSourceTab) {
                                0 -> { // AI Topic
                                    Text("Specify Subject & Focus Areas", style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold))
                                    OutlinedTextField(
                                        value = topicText,
                                        onValueChange = { topicText = it },
                                        label = { Text("Quiz Topic / Subject Name") },
                                        placeholder = { Text("e.g. Cellular Biology, Linear Algebra") },
                                        singleLine = true,
                                        modifier = Modifier.fillMaxWidth(),
                                        shape = RoundedCornerShape(10.dp)
                                    )

                                    Text("Popular Subjects:", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f))
                                    LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                        items(commonTopics) { t ->
                                            FilterChip(
                                                selected = topicText == t,
                                                onClick = { topicText = t },
                                                label = { Text(t) },
                                                shape = RoundedCornerShape(16.dp)
                                            )
                                        }
                                    }

                                    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
                                        OutlinedTextField(
                                            value = selectedFocusArea,
                                            onValueChange = { selectedFocusArea = it },
                                            label = { Text("Add Focus Topic (e.g. Mitosis, Integrals)") },
                                            singleLine = true,
                                            modifier = Modifier.weight(1f),
                                            shape = RoundedCornerShape(10.dp)
                                        )
                                        Spacer(modifier = Modifier.width(8.dp))
                                        Button(
                                            onClick = {
                                                if (selectedFocusArea.isNotBlank() && selectedFocusArea !in focusAreas) {
                                                    focusAreas.add(selectedFocusArea.trim())
                                                    selectedFocusArea = ""
                                                }
                                            },
                                            shape = RoundedCornerShape(10.dp),
                                            colors = ButtonDefaults.buttonColors(containerColor = tierPrimary())
                                        ) {
                                            Text("Add")
                                        }
                                    }

                                    if (focusAreas.isNotEmpty()) {
                                        LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                            items(focusAreas) { fa ->
                                                InputChip(
                                                    selected = true,
                                                    onClick = { focusAreas.remove(fa) },
                                                    label = { Text(fa) },
                                                    trailingIcon = { Icon(Icons.Default.Close, contentDescription = null, modifier = Modifier.size(14.dp)) }
                                                )
                                            }
                                        }
                                    }
                                }

                                1 -> { // Notes
                                    Text("Select Study Notes Source", style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold))
                                    if (state.notes.isEmpty()) {
                                        Surface(
                                            shape = RoundedCornerShape(12.dp),
                                            color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
                                            modifier = Modifier.fillMaxWidth()
                                        ) {
                                            Column(modifier = Modifier.padding(16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                                                Icon(Icons.Default.Description, contentDescription = null, tint = tierPrimary(), modifier = Modifier.size(32.dp))
                                                Spacer(modifier = Modifier.height(6.dp))
                                                Text("No saved study notes yet", style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold))
                                                Text("Paste your study text below to generate a note-based quiz!", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f))
                                            }
                                        }
                                    } else {
                                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                            state.notes.take(6).forEach { note ->
                                                val isSelected = note.id in selectedNoteIds
                                                Surface(
                                                    shape = RoundedCornerShape(10.dp),
                                                    color = if (isSelected) tierPrimary().copy(alpha = 0.12f) else MaterialTheme.colorScheme.surface,
                                                    border = BorderStroke(1.dp, if (isSelected) tierPrimary() else MaterialTheme.colorScheme.outline.copy(alpha = 0.2f)),
                                                    modifier = Modifier
                                                        .fillMaxWidth()
                                                        .clickable {
                                                            if (isSelected) selectedNoteIds.remove(note.id) else selectedNoteIds.add(note.id)
                                                        }
                                                ) {
                                                    Row(
                                                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
                                                        verticalAlignment = Alignment.CenterVertically
                                                    ) {
                                                        Checkbox(
                                                            checked = isSelected,
                                                            onCheckedChange = {
                                                                if (it) selectedNoteIds.add(note.id) else selectedNoteIds.remove(note.id)
                                                            }
                                                        )
                                                        Spacer(modifier = Modifier.width(8.dp))
                                                        Column(modifier = Modifier.weight(1f)) {
                                                            Text(note.title, style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Bold), maxLines = 1, overflow = TextOverflow.Ellipsis)
                                                            Text("${note.category} • ${note.content.take(60)}...", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f), maxLines = 1)
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }

                                    OutlinedTextField(
                                        value = pastedNotesText,
                                        onValueChange = { pastedNotesText = it },
                                        label = { Text("Or Paste Custom Study Notes / Syllabus Text") },
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .height(110.dp),
                                        shape = RoundedCornerShape(10.dp)
                                    )
                                }

                                2 -> { // Recordings
                                    Text("Select Lecture Recording Transcript", style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold))
                                    if (state.recordings.isEmpty()) {
                                        Surface(
                                            shape = RoundedCornerShape(12.dp),
                                            color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
                                            modifier = Modifier.fillMaxWidth()
                                        ) {
                                            Column(modifier = Modifier.padding(20.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                                                Icon(Icons.Default.Mic, contentDescription = null, tint = tierTertiary(), modifier = Modifier.size(32.dp))
                                                Spacer(modifier = Modifier.height(6.dp))
                                                Text("No Lecture Recordings Available", style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold))
                                                Text("Record or upload lectures in the Recordings tab to create AI quizzes directly from transcripts!", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f))
                                            }
                                        }
                                    } else {
                                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                            state.recordings.forEach { rec ->
                                                val isSelected = selectedRecordingId == rec.id
                                                Surface(
                                                    shape = RoundedCornerShape(10.dp),
                                                    color = if (isSelected) tierTertiary().copy(alpha = 0.12f) else MaterialTheme.colorScheme.surface,
                                                    border = BorderStroke(1.dp, if (isSelected) tierTertiary() else MaterialTheme.colorScheme.outline.copy(alpha = 0.2f)),
                                                    modifier = Modifier
                                                        .fillMaxWidth()
                                                        .clickable { selectedRecordingId = rec.id }
                                                ) {
                                                    Row(
                                                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
                                                        verticalAlignment = Alignment.CenterVertically
                                                    ) {
                                                        RadioButton(selected = isSelected, onClick = { selectedRecordingId = rec.id })
                                                        Spacer(modifier = Modifier.width(8.dp))
                                                        Column {
                                                            Text(rec.title, style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Bold), maxLines = 1)
                                                            Text("${rec.subject} • ${rec.summary.take(80)}...", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f), maxLines = 1)
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }

                                3 -> { // Documents
                                    Text("Select Uploaded Study Document", style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold))
                                    if (state.documents.isEmpty()) {
                                        Surface(
                                            shape = RoundedCornerShape(12.dp),
                                            color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
                                            modifier = Modifier.fillMaxWidth()
                                        ) {
                                            Column(modifier = Modifier.padding(20.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                                                Icon(Icons.Default.Folder, contentDescription = null, tint = tierAccent(), modifier = Modifier.size(32.dp))
                                                Spacer(modifier = Modifier.height(6.dp))
                                                Text("No Uploaded Study Documents", style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold))
                                                Text("Upload PDFs or DOCX files in the Documents screen to auto-generate quizzes from files!", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f))
                                            }
                                        }
                                    } else {
                                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                            state.documents.forEach { doc ->
                                                val isSelected = selectedDocumentId == doc.id
                                                Surface(
                                                    shape = RoundedCornerShape(10.dp),
                                                    color = if (isSelected) tierAccent().copy(alpha = 0.12f) else MaterialTheme.colorScheme.surface,
                                                    border = BorderStroke(1.dp, if (isSelected) tierAccent() else MaterialTheme.colorScheme.outline.copy(alpha = 0.2f)),
                                                    modifier = Modifier
                                                        .fillMaxWidth()
                                                        .clickable { selectedDocumentId = doc.id }
                                                ) {
                                                    Row(
                                                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
                                                        verticalAlignment = Alignment.CenterVertically
                                                    ) {
                                                        RadioButton(selected = isSelected, onClick = { selectedDocumentId = doc.id })
                                                        Spacer(modifier = Modifier.width(8.dp))
                                                        Column {
                                                            Text(doc.title, style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Bold), maxLines = 1)
                                                            Text("${doc.fileType.uppercase()} • ${doc.fileSizeKb} KB", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f))
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                // Configuration Settings Card
                item {
                    Card(
                        shape = RoundedCornerShape(16.dp),
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.35f)),
                        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.15f)),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Default.Tune, contentDescription = null, tint = tierPrimary())
                                Spacer(modifier = Modifier.width(8.dp))
                                Text("Quiz Generator Settings", style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold))
                            }

                            // Question Count
                            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                Text("Number of Questions:", style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold))
                                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    listOf(3, 5, 8, 10, 15).forEach { cnt ->
                                        FilterChip(
                                            selected = questionCount == cnt,
                                            onClick = { questionCount = cnt },
                                            label = { Text("$cnt Questions") },
                                            modifier = Modifier.weight(1f)
                                        )
                                    }
                                }
                            }

                            // Difficulty
                            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                Text("Difficulty Level:", style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold))
                                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                    listOf("Easy", "Medium", "Hard", "Ollie 🦉").forEach { diff ->
                                        FilterChip(
                                            selected = difficulty == diff,
                                            onClick = { difficulty = diff },
                                            label = { Text(diff) },
                                            modifier = Modifier.weight(1f)
                                        )
                                    }
                                }
                            }

                            // Question Type
                            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                Text("Question Format:", style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold))
                                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                    listOf("Multiple Choice", "True/False", "Mixed").forEach { type ->
                                        FilterChip(
                                            selected = questionType == type,
                                            onClick = { questionType = type },
                                            label = { Text(type) },
                                            modifier = Modifier.weight(1f)
                                        )
                                    }
                                }
                            }

                            // Time Limit per Question
                            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                Text("Timer per Question:", style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold))
                                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                    listOf(10, 15, 20, 30, 60).forEach { sec ->
                                        FilterChip(
                                            selected = timeLimitSec == sec,
                                            onClick = { timeLimitSec = sec },
                                            label = { Text("${sec}s") },
                                            modifier = Modifier.weight(1f)
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // Bottom Sticky Action Bar
            Surface(
                tonalElevation = 8.dp,
                shadowElevation = 8.dp,
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    OutlinedButton(
                        onClick = onBack,
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.weight(1f)
                    ) {
                        Text("Cancel")
                    }

                    val config = QuizConfig(
                        topic = topicText,
                        questionCount = questionCount,
                        difficulty = difficulty,
                        questionType = questionType,
                        timeLimitSec = timeLimitSec
                    )

                    Button(
                        onClick = {
                            when (selectedSourceTab) {
                                0 -> onGenerateFromTopic(topicText, focusAreas, config)
                                1 -> onGenerateFromNotes(selectedNoteIds, pastedNotesText, config)
                                2 -> onGenerateFromRecording(selectedRecordingId, config)
                                3 -> onGenerateFromDocument(selectedDocumentId, config)
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = tierPrimary()),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.weight(2f)
                    ) {
                        Icon(Icons.Default.AutoAwesome, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("Generate AI Quiz", fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FullLiveQuizSetupScreen(
    state: QuizzesUiState,
    onBack: () -> Unit,
    onStartLiveSession: (pin: String, isHost: Boolean, title: String, customQuestions: List<QuizQuestionItem>?, config: QuizConfig, quizId: String?, playerName: String?, playerEmoji: String) -> Unit,
    onViewRules: (QuizConfig) -> Unit
) {
    var selectedModeTab by remember { mutableIntStateOf(0) } // 0: Host, 1: Join

    // Host Settings
    var selectedHostRole by remember { mutableStateOf("participant") } // participant vs mediator
    var selectedAdvanceMode by remember { mutableStateOf("auto") } // auto vs manual
    var selectedQuizMode by remember { mutableStateOf("synchronized") } // synchronized vs individual_auto
    var selectedTimeLimit by remember { mutableIntStateOf(20) }
    var speedBonusEnabled by remember { mutableStateOf(true) }
    var streakMultiplierEnabled by remember { mutableStateOf(true) }
    // Privacy: false = private (hidden from public list + no late join), true = public.
    var isPublicSession by remember { mutableStateOf(true) }
    var pinCode by remember { mutableStateOf("") }

    // Host Quiz Source (0: Library, 1: Custom Question Creator)
    var selectedHostSourceTab by remember { mutableIntStateOf(0) }
    var selectedQuizId by remember { mutableStateOf(state.quizzes.firstOrNull()?.id ?: "") }

    // Custom Question Builder State
    val customQuestions = remember { mutableStateListOf<QuizQuestionItem>() }
    var qText by remember { mutableStateOf("") }
    var optA by remember { mutableStateOf("") }
    var optB by remember { mutableStateOf("") }
    var optC by remember { mutableStateOf("") }
    var optD by remember { mutableStateOf("") }
    var correctOptIndex by remember { mutableIntStateOf(0) }
    var qExplanation by remember { mutableStateOf("") }

    // Join Settings
    var joinPinInput by remember { mutableStateOf("") }
    var playerNameInput by remember { mutableStateOf("") }
    var selectedEmoji by remember { mutableStateOf("🚀") }
    val emojiOptions = listOf("🚀", "🦉", "⚡", "🧠", "🎯", "🐱", "🦊", "🤖")

    val selectedQuizEntity = state.quizzes.find { it.id == selectedQuizId }
    val currentTopic = if (selectedHostSourceTab == 0) (selectedQuizEntity?.title ?: "Live Kahoot Session") else "Custom Live Quiz"

    val currentConfig = QuizConfig(
        topic = currentTopic,
        questionCount = if (selectedHostSourceTab == 0) 5 else customQuestions.size.coerceAtLeast(3),
        timeLimitSec = selectedTimeLimit,
        speedBonusEnabled = speedBonusEnabled,
        streakMultiplierEnabled = streakMultiplierEnabled,
        hostRole = selectedHostRole,
        advanceMode = if (selectedQuizMode == "individual_auto") "auto" else selectedAdvanceMode,
        quizMode = selectedQuizMode,
        allowLateJoin = isPublicSession
    )

    Scaffold(
        topBar = {
            TopAppBar(
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                    }
                },
                title = {
                    Column {
                        Text("Live Kahoot Quiz Studio", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleMedium)
                        Text("Host multiplayer sessions or join live PIN rooms", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f))
                    }
                },
                actions = {
                    IconButton(onClick = { onViewRules(currentConfig) }) {
                        Icon(Icons.Default.MenuBook, contentDescription = "Rules", tint = tierPrimary())
                    }
                }
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            // Mode Picker Tabs (Host vs Join)
            TabRow(
                selectedTabIndex = selectedModeTab,
                containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f),
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp).clip(RoundedCornerShape(12.dp))
            ) {
                Tab(
                    selected = selectedModeTab == 0,
                    onClick = { selectedModeTab = 0 },
                    text = { Text("👑 Host Live Quiz", fontWeight = if (selectedModeTab == 0) FontWeight.Bold else FontWeight.Normal) },
                    icon = { Icon(Icons.Default.FlashOn, contentDescription = null, tint = tierTertiary()) }
                )
                Tab(
                    selected = selectedModeTab == 1,
                    onClick = { selectedModeTab = 1 },
                    text = { Text("Join with PIN", fontWeight = if (selectedModeTab == 1) FontWeight.Bold else FontWeight.Normal) },
                    icon = { Icon(Icons.Default.Group, contentDescription = null, tint = tierPrimary()) }
                )
            }

            LazyColumn(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f)
                    .padding(horizontal = 16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp),
                contentPadding = PaddingValues(top = 8.dp, bottom = 24.dp)
            ) {
                if (selectedModeTab == 0) { // HOST MODE
                    // Source Sub-Tabs
                    item {
                        Card(
                            shape = RoundedCornerShape(16.dp),
                            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.35f)),
                            border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.15f)),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                                Text("1. Select Question Source", style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold))

                                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                                    FilterChip(
                                        selected = selectedHostSourceTab == 0,
                                        onClick = { selectedHostSourceTab = 0 },
                                        label = { Text("Library Quizzes (${state.quizzes.count { it.sourceType != "live_kahoot" }})") },
                                        leadingIcon = { Icon(Icons.Default.Quiz, contentDescription = null, modifier = Modifier.size(16.dp)) },
                                        modifier = Modifier.weight(1f)
                                    )
                                    FilterChip(
                                        selected = selectedHostSourceTab == 1,
                                        onClick = { selectedHostSourceTab = 1 },
                                        label = { Text("Custom Creator (${customQuestions.size})") },
                                        leadingIcon = { Icon(Icons.Default.Edit, contentDescription = null, modifier = Modifier.size(16.dp)) },
                                        modifier = Modifier.weight(1f)
                                    )
                                }

                                if (selectedHostSourceTab == 0) {
                                    if (state.quizzes.isEmpty()) {
                                        Text("No quizzes in your library. Generate a practice quiz first or build custom questions below!", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f))
                                    } else {
                                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                            state.quizzes.take(5).forEach { quiz ->
                                                val isSelected = selectedQuizId == quiz.id
                                                Surface(
                                                    shape = RoundedCornerShape(10.dp),
                                                    color = if (isSelected) tierTertiary().copy(alpha = 0.12f) else MaterialTheme.colorScheme.surface,
                                                    border = BorderStroke(1.dp, if (isSelected) tierTertiary() else MaterialTheme.colorScheme.outline.copy(alpha = 0.2f)),
                                                    modifier = Modifier.fillMaxWidth().clickable { selectedQuizId = quiz.id }
                                                ) {
                                                    Row(modifier = Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                                                        RadioButton(selected = isSelected, onClick = { selectedQuizId = quiz.id })
                                                        Spacer(modifier = Modifier.width(8.dp))
                                                        Column {
                                                            Text(quiz.title, style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Bold))
                                                            Text("${quiz.sourceType.uppercase()} • Practice Quiz", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f))
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                } else {
                                    // Custom Builder
                                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                                        Text("Build Custom Kahoot Questions", style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold))
                                        OutlinedTextField(
                                            value = qText,
                                            onValueChange = { qText = it },
                                            label = { Text("Question Prompt") },
                                            modifier = Modifier.fillMaxWidth(),
                                            shape = RoundedCornerShape(10.dp)
                                        )

                                        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                            OutlinedTextField(value = optA, onValueChange = { optA = it }, label = { Text("🔴 Option A (Triangle)") }, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(8.dp))
                                            OutlinedTextField(value = optB, onValueChange = { optB = it }, label = { Text("🔷 Option B (Diamond)") }, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(8.dp))
                                            OutlinedTextField(value = optC, onValueChange = { optC = it }, label = { Text("🟡 Option C (Circle)") }, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(8.dp))
                                            OutlinedTextField(value = optD, onValueChange = { optD = it }, label = { Text("🟢 Option D (Square)") }, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(8.dp))
                                        }

                                        Text("Select Correct Option:", style = MaterialTheme.typography.labelSmall)
                                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                            listOf("A 🔴", "B 🔷", "C 🟡", "D 🟢").forEachIndexed { index, label ->
                                                FilterChip(
                                                    selected = correctOptIndex == index,
                                                    onClick = { correctOptIndex = index },
                                                    label = { Text(label) },
                                                    modifier = Modifier.weight(1f)
                                                )
                                            }
                                        }

                                        OutlinedTextField(
                                            value = qExplanation,
                                            onValueChange = { qExplanation = it },
                                            label = { Text("Explanation (Optional)") },
                                            modifier = Modifier.fillMaxWidth(),
                                            shape = RoundedCornerShape(8.dp)
                                        )

                                        Button(
                                            onClick = {
                                                if (qText.isNotBlank() && optA.isNotBlank() && optB.isNotBlank()) {
                                                    val options = listOf(optA, optB, optC.ifBlank { "N/A" }, optD.ifBlank { "N/A" })
                                                    customQuestions.add(
                                                        QuizQuestionItem(
                                                            question = qText,
                                                            options = options,
                                                            correctIndex = correctOptIndex,
                                                            explanation = qExplanation.ifBlank { "Correct answer is ${options[correctOptIndex]}" }
                                                        )
                                                    )
                                                    qText = ""; optA = ""; optB = ""; optC = ""; optD = ""; qExplanation = ""
                                                }
                                            },
                                            shape = RoundedCornerShape(10.dp),
                                            colors = ButtonDefaults.buttonColors(containerColor = tierTertiary()),
                                            modifier = Modifier.fillMaxWidth()
                                        ) {
                                            Icon(Icons.Default.Add, contentDescription = null)
                                            Spacer(modifier = Modifier.width(6.dp))
                                            Text("Add Question to Live Quiz", fontWeight = FontWeight.Bold)
                                        }

                                        if (customQuestions.isNotEmpty()) {
                                            Text("${customQuestions.size} Questions Added:", style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold))
                                            customQuestions.forEachIndexed { idx, q ->
                                                Surface(
                                                    shape = RoundedCornerShape(8.dp),
                                                    color = MaterialTheme.colorScheme.surface,
                                                    modifier = Modifier.fillMaxWidth()
                                                ) {
                                                    Row(modifier = Modifier.padding(10.dp), verticalAlignment = Alignment.CenterVertically) {
                                                        Text("${idx + 1}. ${q.question}", style = MaterialTheme.typography.bodySmall, modifier = Modifier.weight(1f), maxLines = 1)
                                                        IconButton(onClick = { customQuestions.removeAt(idx) }, modifier = Modifier.size(24.dp)) {
                                                            Icon(Icons.Default.Close, contentDescription = "Delete", modifier = Modifier.size(16.dp))
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }

                    // Host & Room Settings Card (Matching Web Version LiveQuizMenu.tsx!)
                    item {
                        Card(
                            shape = RoundedCornerShape(16.dp),
                            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.35f)),
                            border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.15f)),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                                Text("2. Host Role & Session Configurations", style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold))

                                // Host Role
                                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                    Text("Host Participation Role:", style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold))
                                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                        FilterChip(
                                            selected = selectedHostRole == "participant",
                                            onClick = { selectedHostRole = "participant" },
                                            label = { Text("🎮 Host & Play") },
                                            modifier = Modifier.weight(1f)
                                        )
                                        FilterChip(
                                            selected = selectedHostRole == "mediator",
                                            onClick = { selectedHostRole = "mediator" },
                                            label = { Text("👁️ Mediator (Spectate)") },
                                            modifier = Modifier.weight(1f)
                                        )
                                    }
                                }

                                // Advance Mode (forced Auto in individual_auto mode, like the web)
                                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                    Text("Question Pacing Mode:", style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold))
                                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                        FilterChip(
                                            selected = selectedAdvanceMode == "auto",
                                            onClick = { selectedAdvanceMode = "auto" },
                                            label = { Text("Auto Timer") },
                                            modifier = Modifier.weight(1f)
                                        )
                                        FilterChip(
                                            selected = selectedAdvanceMode == "manual",
                                            onClick = {
                                                if (selectedQuizMode != "individual_auto") selectedAdvanceMode = "manual"
                                            },
                                            enabled = selectedQuizMode != "individual_auto",
                                            label = { Text("👆 Manual Control") },
                                            modifier = Modifier.weight(1f)
                                        )
                                    }
                                }

                                // Question Timer
                                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                    Text("Question Time Limit:", style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold))
                                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                        listOf(10, 15, 20, 30, 45, 60).forEach { sec ->
                                            FilterChip(
                                                selected = selectedTimeLimit == sec,
                                                onClick = { selectedTimeLimit = sec },
                                                label = { Text("${sec}s") },
                                                modifier = Modifier.weight(1f)
                                            )
                                        }
                                    }
                                }

                                // Quiz Mode (server config.quiz_mode)
                                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                    Text("Quiz Mode:", style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold))
                                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                        FilterChip(
                                            selected = selectedQuizMode == "synchronized",
                                            onClick = { selectedQuizMode = "synchronized" },
                                            label = { Text("🎯 Synchronized") },
                                            modifier = Modifier.weight(1f)
                                        )
                                        FilterChip(
                                            selected = selectedQuizMode == "individual_auto",
                                            onClick = { selectedQuizMode = "individual_auto" },
                                            label = { Text("🚶 Individual Auto") },
                                            modifier = Modifier.weight(1f)
                                        )
                                    }
                                }

                                // Game Modifiers
                                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                                        Text("Speed Points Bonus", style = MaterialTheme.typography.bodyMedium)
                                        Switch(checked = speedBonusEnabled, onCheckedChange = { speedBonusEnabled = it })
                                    }
                                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                                        Text("Streak Multiplier 🔥", style = MaterialTheme.typography.bodyMedium)
                                        Switch(checked = streakMultiplierEnabled, onCheckedChange = { streakMultiplierEnabled = it })
                                    }
                                    // Privacy — public/private (web: "Visibility & Access / Private Session").
                                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                                        Column(Modifier.weight(1f)) {
                                            Text("Session Privacy", style = MaterialTheme.typography.bodyMedium)
                                            Text(
                                                if (isPublicSession) "Public — visible in lobby list" else "Private — hidden & PIN only",
                                                style = MaterialTheme.typography.labelSmall,
                                                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
                                            )
                                        }
                                        Switch(checked = isPublicSession, onCheckedChange = { isPublicSession = it })
                                    }
                                }

                                // PIN Code
                                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
                                    OutlinedTextField(
                                        value = pinCode,
                                        onValueChange = { if (it.length <= 6) pinCode = it },
                                        label = { Text("Session Game PIN") },
                                        singleLine = true,
                                        modifier = Modifier.weight(1f),
                                        shape = RoundedCornerShape(10.dp)
                                    )
                                    Spacer(modifier = Modifier.width(8.dp))
                                    IconButton(
                                        onClick = { pinCode = (100000..999999).random().toString() },
                                        modifier = Modifier.background(tierTertiary().copy(alpha = 0.15f), RoundedCornerShape(10.dp))
                                    ) {
                                        Icon(Icons.Default.Shuffle, contentDescription = "Randomize PIN", tint = tierTertiary())
                                    }
                                }
                            }
                        }
                    }
                } else { // JOIN MODE
                    item {
                        Card(
                            shape = RoundedCornerShape(16.dp),
                            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.35f)),
                            border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.15f)),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Column(modifier = Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                                Text("Enter Game PIN & Player Profile", style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold))

                                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                    Text("Choose Avatar Emoji:", style = MaterialTheme.typography.labelMedium)
                                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                                        emojiOptions.forEach { emo ->
                                            Surface(
                                                shape = CircleShape,
                                                color = if (selectedEmoji == emo) tierPrimary().copy(alpha = 0.2f) else MaterialTheme.colorScheme.surface,
                                                border = BorderStroke(1.dp, if (selectedEmoji == emo) tierPrimary() else Color.Transparent),
                                                modifier = Modifier.size(38.dp).clickable { selectedEmoji = emo }
                                            ) {
                                                Box(contentAlignment = Alignment.Center) {
                                                    Text(emo, fontSize = 18.sp)
                                                }
                                            }
                                        }
                                    }
                                }

                                OutlinedTextField(
                                    value = playerNameInput,
                                    onValueChange = { playerNameInput = it },
                                    label = { Text("Player Display Name") },
                                    singleLine = true,
                                    modifier = Modifier.fillMaxWidth(),
                                    shape = RoundedCornerShape(10.dp)
                                )

                                OutlinedTextField(
                                    value = joinPinInput,
                                    onValueChange = { if (it.length <= 6) joinPinInput = it },
                                    label = { Text("6-Digit Game PIN") },
                                    placeholder = { Text("e.g. 123456") },
                                    singleLine = true,
                                    modifier = Modifier.fillMaxWidth(),
                                    shape = RoundedCornerShape(10.dp)
                                )

                                Button(
                                    onClick = {
                                        // Require a real server-assigned 6-digit PIN — never silently join with a dummy one.
                                        val pinToUse = joinPinInput.trim()
                                        if (pinToUse.length == 6 && pinToUse.all { it.isDigit() }) {
                                            onStartLiveSession(pinToUse, false, "Live Kahoot Session", null, currentConfig, null, playerNameInput, selectedEmoji)
                                        }
                                    },
                                    enabled = joinPinInput.trim().length == 6 && joinPinInput.trim().all { it.isDigit() },
                                    colors = ButtonDefaults.buttonColors(containerColor = tierTertiary()),
                                    shape = RoundedCornerShape(12.dp),
                                    modifier = Modifier.fillMaxWidth().height(48.dp)
                                ) {
                                    Icon(Icons.Default.FlashOn, contentDescription = null)
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Text("Verify & Join Live Session", fontWeight = FontWeight.Bold)
                                }
                            }
                        }
                    }

                    item {
                        Text("Active Public Waiting Rooms", style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold))
                        PublicLiveLobbiesList(
                            searchQuery = "",
                            onJoinSession = { pin, topic, isHost, config ->
                                onStartLiveSession(pin, isHost, topic, null, config, null, playerNameInput, selectedEmoji)
                            },
                            onViewRules = onViewRules
                        )
                    }
                }
            }

            if (selectedModeTab == 0) {
                // Host Sticky Launch Button
                Surface(
                    tonalElevation = 8.dp,
                    shadowElevation = 8.dp,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(16.dp),
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        OutlinedButton(
                            onClick = onBack,
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.weight(1f)
                        ) {
                            Text("Cancel")
                        }

                        Button(
                            onClick = {
                                onStartLiveSession(
                                    pinCode,
                                    true,
                                    currentTopic,
                                    if (selectedHostSourceTab == 1) customQuestions else null,
                                    currentConfig,
                                    if (selectedHostSourceTab == 0) selectedQuizId else null,
                                    null,
                                    selectedEmoji
                                )
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = tierTertiary()),
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.weight(2f)
                        ) {
                            Icon(Icons.Default.FlashOn, contentDescription = null, modifier = Modifier.size(18.dp))
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("Launch Live Session 🚀", fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }
    }
}
