package com.example.ui.screens.quizzes

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.data.local.entities.ClassRecordingEntity
import com.example.data.local.entities.DocumentEntity
import com.example.data.local.entities.GameProgressEntity
import com.example.data.local.entities.NoteEntity
import com.example.data.local.entities.QuizAttemptEntity
import com.example.data.local.entities.QuizEntity
import com.example.data.repository.StuddyHubRepository
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import kotlinx.coroutines.*
import com.example.data.remote.BackendApiService
import com.example.data.remote.BackendResult
import com.example.data.remote.LiveQuizRealtimeClient

import org.json.JSONArray
import org.json.JSONObject

/**
 * Live-quiz request bodies carry session PINs, user ids and question text. They're useful when
 * debugging the edge function but shouldn't be written to Logcat on a user's device, so payload
 * logging is debug-only.
 */
private fun logPayload(message: String) {
    if (com.example.BuildConfig.DEBUG) android.util.Log.d("QuizzesViewModel", message)
}

/** Active Explorer (kids) game level session — used to record stars/progress on finish. */
data class ExplorerSession(
    val gameKey: String,
    val gameTitle: String,
    val levelIndex: Int,
    val questionCount: Int
)

/**
 * Outcome of a live question-generation attempt. When [questions] is null the caller must show
 * [errorMessage] to the user — the real backend error (e.g. "Edge function 'generate-ai-quiz'
 * returned HTTP 500") instead of silently falling back to seeded/banked content.
 */
data class LiveQuestionResult(
    val questions: List<QuizQuestionItem>? = null,
    val errorMessage: String? = null
)

/** Outcome of a live spelling-word generation attempt (same error-surfacing contract). */
data class SpellingWordsResult(
    val words: List<SpellingWordItem>? = null,
    val errorMessage: String? = null
)

data class QuizConfig(
    val topic: String = "General Knowledge & AI",
    val questionCount: Int = 5,
    val difficulty: String = "Medium", // Easy, Medium, Hard, Ollie Expert
    val questionType: String = "Multiple Choice", // Multiple Choice, True/False, Mixed
    val timeLimitSec: Int = 20, // 10s, 15s, 20s, 30s, 60s
    val speedBonusEnabled: Boolean = true,
    val streakMultiplierEnabled: Boolean = true,
    val gameMode: String = "Classic Solo", // Classic Solo, Team Battle, Blitz
    val maxPlayers: Int = 10,
    val hostRole: String = "participant", // participant vs mediator
    val advanceMode: String = "auto", // auto vs manual
    val quizMode: String = "synchronized", // synchronized vs individual_auto
    val allowLateJoin: Boolean = true
)

data class LivePlayer(
    val id: String,
    val name: String,
    val avatarEmoji: String,
    var score: Int = 0,
    var streak: Int = 0,
    var lastAnswerCorrect: Boolean? = null,
    // Server flag: mediator hosts have is_playing=false and never appear in rankings.
    val isPlaying: Boolean = true,
    val isMediator: Boolean = false
)

enum class LiveQuizPhase { LOBBY, QUESTION, LEADERBOARD, PODIUM }

data class LiveQuizSession(
    val pin: String,
    val title: String,
    val questions: List<QuizQuestionItem>,
    val isHost: Boolean,
    val players: List<LivePlayer>,
    val currentQuestionIndex: Int = 0,
    val phase: LiveQuizPhase = LiveQuizPhase.LOBBY,
    val config: QuizConfig = QuizConfig(),
    val sessionId: String? = null,
    val currentQuestionId: String? = null,
    // Server question row ids (parallel to `questions`), resolved from the session state. Used
    // so a submit-answer can always carry a real question_id — even for the very first question,
    // before the current_question payload has arrived (a blank id would 400 on the server).
    val serverQuestionIds: List<String> = emptyList(),
    // Server-authoritative deadline (epoch millis) of the current question, parsed from the
    // session state's current_question.end_time. The runner derives its countdown from this
    // so every player's clock matches the host's (Kahoot-style fairness).
    val currentQuestionEndTime: Long? = null,
    val quizId: String? = null,
    val correctAnswers: Int = 0,
    val totalAnswers: Int = 0,
    val totalTimeTakenSec: Int = 0,
    // Per-question selected option index (parallel to `questions`); null = unanswered/timeout.
    val userAnswers: List<Int?> = emptyList(),
    val currentUserId: String = "",
    // Avatar emoji the current user chose when joining/hosting (players list avatars fall back
    // to 🚀 because the server only stores display_name, like the web's avatar_url approach).
    val currentUserEmoji: String = "🚀",
    // Speed Race (Explorer) marker — enables the public-lobby auto-start for the host.
    val isSpeedRace: Boolean = false,
    val speedGameKey: String? = null
)

data class LiveLobbyItem(
    val id: String,
    val pin: String,
    val topic: String,
    val hostUserId: String,
    val isHost: Boolean,
    val status: String = "waiting"
)

data class QuizzesUiState(
    val quizzes: List<QuizEntity> = emptyList(),
    val attempts: List<QuizAttemptEntity> = emptyList(),
    val notes: List<NoteEntity> = emptyList(),
    val recordings: List<ClassRecordingEntity> = emptyList(),
    val documents: List<DocumentEntity> = emptyList(),
    val activeQuiz: QuizEntity? = null,
    val activeLiveSession: LiveQuizSession? = null,
    val explorerSession: ExplorerSession? = null,
    val isLoading: Boolean = false,
    val userMessage: String? = null
)

private data class LocalState(
    val activeQuiz: QuizEntity? = null,
    val activeLiveSession: LiveQuizSession? = null,
    val explorerSession: ExplorerSession? = null,
    val isLoading: Boolean = false,
    val userMessage: String? = null
)

class QuizzesViewModel(private val repository: StuddyHubRepository) : ViewModel() {

    val isAIGenerating: StateFlow<Boolean> = repository.isAIGenerating
    val generationMessage: StateFlow<String> = repository.generationMessage

    private val _activeQuiz = MutableStateFlow<QuizEntity?>(null)
    private val _activeLiveSession = MutableStateFlow<LiveQuizSession?>(null)
    private val _explorerSession = MutableStateFlow<ExplorerSession?>(null)
    private val _isLoading = MutableStateFlow(false)
    private val _userMessage = MutableStateFlow<String?>(null)

    private val _recentlyClosedLiveSession = MutableStateFlow<LiveQuizSession?>(null)
    val recentlyClosedLiveSession = _recentlyClosedLiveSession.asStateFlow()

    private val _activeLobbiesFromServer = MutableStateFlow<List<LiveLobbyItem>>(emptyList())
    val activeLobbiesFromServer = _activeLobbiesFromServer.asStateFlow()

    init {
        // Lightweight local DB read only — NO network calls here. The ViewModel is created
        // eagerly at the StuddyHubApp level (before the user is authenticated), so firing
        // syncCloudDataToLocal() or getLiveQuizLobbies() here wastes requests on the login
        // screen. Heavy work is deferred to onScreenResumed().
        viewModelScope.launch {
            repository.allQuizzes.first()
            repository.allAttempts.first()
        }
    }

    /**
     * Called when the user actually navigates to a quiz-related screen. Gates all network
     * calls behind an authentication check so the login / splash screens never trigger
     * unnecessary API requests (the original cause of double `getLiveQuizLobbies` calls
     * on the login screen).
     */
    fun onScreenResumed() {
        viewModelScope.launch {
            val userId = repository.getOrRestoreActiveUserId()
            if (userId.isNotBlank()) {
                // Only check for active live-quiz lobbies — do NOT call refreshQuizzes()
                // here because it triggers syncCloudDataToLocal() (the heavy 15-table batch
                // sync). That batch runs once after login; screens read from Room DB.
                checkActiveSessions()
            }
        }
    }

    fun dismissRecentlyClosedSession() {
        _recentlyClosedLiveSession.value = null
    }

    fun resumeRecentlyClosedSession() {
        val session = _recentlyClosedLiveSession.value ?: return
        _activeLiveSession.value = session
        _recentlyClosedLiveSession.value = null
        if (!session.sessionId.isNullOrBlank()) {
            startPolling(session.sessionId)
            realtimeClient.subscribe(session.sessionId)
        }
    }

    fun checkActiveSessions() {
        viewModelScope.launch {
            try {
                val currentUserId = repository.getOrRestoreActiveUserId()
                // Never hit the network when there is no authenticated user — avoids
                // wasting two `getLiveQuizLobbies` calls on the login / splash screen.
                if (currentUserId.isBlank()) return@launch
                val result = BackendApiService.getLiveQuizLobbies()
                if (result is BackendResult.Success) {
                    val array = result.data
                    val parsed = mutableListOf<LiveLobbyItem>()
                    for (i in 0 until array.length()) {
                        val obj = array.getJSONObject(i)
                        val id = obj.optString("id", "")
                        val pin = obj.optString("join_code", "")
                        val quizId = obj.optString("quiz_id", "")
                        val hostUserId = obj.optString("host_user_id", "")
                        val status = obj.optString("status", "waiting")
                        val quizzesObj = obj.optJSONObject("quizzes")
                        val quizTitle = quizzesObj?.optString("title", "")?.takeIf { it.isNotBlank() }
                        val title = quizTitle ?: quizId.replace("-", " ").capitalize()
                        val isHost = hostUserId.isNotBlank() && currentUserId.isNotBlank() && hostUserId.trim().lowercase() == currentUserId.trim().lowercase()
                        
                        parsed.add(
                            LiveLobbyItem(
                                id = id,
                                pin = pin,
                                topic = title,
                                hostUserId = hostUserId,
                                isHost = isHost,
                                status = status
                            )
                        )
                    }
                    _activeLobbiesFromServer.value = parsed
                }
            } catch (e: Exception) {
                android.util.Log.e("QuizzesViewModel", "Error checking active sessions", e)
            }
        }
    }

    fun endSessionDirect(sessionId: String) {
        viewModelScope.launch {
            _isLoading.value = true
            try {
                val payload = JSONObject().apply {
                    put("action", "end-session")
                    put("session_id", sessionId)
                }
                BackendApiService.executeEdgeFunction("live-quiz", payload)
                _userMessage.value = "Session ended successfully."
                checkActiveSessions()
            } catch (e: Exception) {
                android.util.Log.e("QuizzesViewModel", "Error ending session direct", e)
            } finally {
                _isLoading.value = false
            }
        }
    }

    private val _localState = combine(
        _activeQuiz,
        _activeLiveSession,
        _explorerSession,
        _isLoading,
        _userMessage
    ) { active, live, explorer, loading, msg ->
        LocalState(active, live, explorer, loading, msg)
    }

    val uiState: StateFlow<QuizzesUiState> = combine(
        repository.allQuizzes,
        repository.allAttempts,
        repository.allNotes,
        repository.allRecordings,
        repository.allDocuments,
        _localState
    ) { flows: Array<Any> ->
        @Suppress("UNCHECKED_CAST")
        val quizzes = flows[0] as List<QuizEntity>
        @Suppress("UNCHECKED_CAST")
        val attempts = flows[1] as List<QuizAttemptEntity>
        @Suppress("UNCHECKED_CAST")
        val notes = flows[2] as List<NoteEntity>
        @Suppress("UNCHECKED_CAST")
        val recordings = flows[3] as List<ClassRecordingEntity>
        @Suppress("UNCHECKED_CAST")
        val documents = flows[4] as List<DocumentEntity>
        val local = flows[5] as LocalState

        QuizzesUiState(
            quizzes = quizzes,
            attempts = attempts,
            notes = notes,
            recordings = recordings,
            documents = documents,
            activeQuiz = local.activeQuiz,
            activeLiveSession = local.activeLiveSession,
            explorerSession = local.explorerSession,
            isLoading = local.isLoading,
            userMessage = local.userMessage
        )
    }.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5000),
        initialValue = QuizzesUiState()
    )

    fun startQuiz(quiz: QuizEntity) {
        _activeQuiz.value = quiz
    }

    fun startQuizById(quizId: String) {
        viewModelScope.launch {
            val list = uiState.value.quizzes
            val match = list.find { it.id == quizId }
            if (match != null) {
                _activeQuiz.value = match
            }
        }
    }

    fun deleteQuiz(quizId: String) {
        viewModelScope.launch {
            repository.deleteQuiz(quizId)
            _userMessage.value = "Quiz deleted successfully."
            if (_activeQuiz.value?.id == quizId) {
                _activeQuiz.value = null
            }
        }
    }

    fun finishQuiz(score: Int, total: Int, timeTakenSec: Int) {
        val quiz = _activeQuiz.value
        if (quiz != null) {
            viewModelScope.launch {
                repository.saveQuiz(quiz)
                repository.recordQuizAttempt(quiz.id, score, total, timeTakenSec)
                val xp = score * 25 + 50
                val session = _explorerSession.value
                if (session != null) {
                    repository.recordGameResult(session.gameKey, session.levelIndex, score, total)
                    val stars = starsForPercent(if (total > 0) (score * 100) / total else 0)
                    _userMessage.value = "${session.gameTitle} Level ${session.levelIndex} — $stars stars! +$xp XP 🎉"
                } else {
                    _userMessage.value = "Quiz Completed! You earned $xp XP 🎉"
                }
                _activeQuiz.value = null
                _explorerSession.value = null
            }
        }
    }

    /**
     * Starts an Explorer game level. Questions are ALWAYS generated live by the AI pipeline
     * (backend edge function first, direct Gemini fallback) — the bundled asset banks are muted
     * so a failing backend surfaces its real error instead of silently loading seeded questions.
     * Spelling Bee levels never come here — they run in SpellingBeeScreen directly.
     */
    fun startExplorerLevel(context: Context, gameKey: String, levelIndex: Int, speedRace: Boolean = false) {
        viewModelScope.launch {
            _isLoading.value = true
            try {
                val config = EXPLORER_GAMES[normalizeGameKey(gameKey)]
                val level = config?.levels?.firstOrNull { it.index == levelIndex }
                if (config == null || level == null) {
                    _userMessage.value = "We couldn't find that level. Try again!"
                    return@launch
                }
                val result = generateLiveQuestions(
                    topic = buildExplorerGameTopic(config.key, levelIndex, level.name, level.difficulty),
                    config = QuizConfig(
                        topic = config.title,
                        difficulty = level.difficulty,
                        questionCount = level.questionCount,
                        timeLimitSec = if (speedRace) 15 else level.timeLimitSec
                    ),
                    topicGuidance = gameGuidance(config.key)
                )
                val questions = result.questions ?: emptyList()
                if (questions.isEmpty()) {
                    _userMessage.value = result.errorMessage
                        ?: "Ollie couldn't prepare this level. Check your connection and try again!"
                    return@launch
                }
                _explorerSession.value = ExplorerSession(
                    gameKey = config.key,
                    gameTitle = config.title,
                    levelIndex = levelIndex,
                    questionCount = questions.size
                )
                val newQuiz = QuizEntity(
                    title = "${config.title} — ${level.name}",
                    sourceType = "game",
                    questionsJson = questionsToJson(questions)
                )
                repository.saveQuiz(newQuiz)
                repository.recordQuizStarted()
                _activeQuiz.value = newQuiz
            } catch (e: Exception) {
                android.util.Log.e("QuizzesViewModel", "startExplorerLevel failed: ${e.message}")
                _userMessage.value = "Something went wrong starting that level. Try again!"
            } finally {
                _isLoading.value = false
            }
        }
    }

    fun clearExplorerSession() {
        _explorerSession.value = null
    }

    /** Per-game progress (stars, unlocked level) for the game detail level map. */
    fun gameProgress(gameKey: String): Flow<GameProgressEntity?> = repository.gameProgressFlow(gameKey)

    /** Records a Spelling Bee level result (bypasses the shared quiz runner). */
    fun recordSpellingResult(gameKey: String, gameTitle: String, levelIndex: Int, score: Int, total: Int) {
        viewModelScope.launch {
            repository.recordGameResult(gameKey, levelIndex, score, total)
            repository.recordQuizAttempt("spelling_bee_${gameKey}_$levelIndex", score, total, 60)
            val stars = starsForPercent(if (total > 0) (score * 100) / total else 0)
            _userMessage.value = "$gameTitle Level $levelIndex — $stars stars! 🐝"
        }
    }

    fun exitActiveQuiz() {
        _activeQuiz.value = null
    }

    fun generateNewQuiz(
        topic: String,
        contextText: String,
        config: QuizConfig = QuizConfig()
    ) {
        viewModelScope.launch {
            _isLoading.value = true
            try {
                val quiz = repository.generateCustomQuiz(
                    title = topic.ifBlank { config.topic },
                    sourceContent = contextText.ifBlank { "Generate $topic questions for ${config.difficulty} level." },
                    sourceType = "ai",
                    questionCount = config.questionCount,
                    difficulty = config.difficulty,
                    questionType = config.questionType
                )
                _userMessage.value = "AI Quiz Created! (${config.questionCount} Questions)"
                repository.recordQuizStarted()
                _activeQuiz.value = quiz
            } catch (e: Exception) {
                _userMessage.value = "We couldn't create that quiz. Please try again."
            } finally {
                _isLoading.value = false
            }
        }
    }

    fun generateQuizFromNotes(
        selectedNoteIds: List<String>,
        pastedNotesText: String,
        config: QuizConfig
    ) {
        viewModelScope.launch {
            _isLoading.value = true
            try {
                val notes = uiState.value.notes.filter { it.id in selectedNoteIds }
                val title = if (notes.isNotEmpty()) "Notes: ${notes.first().title}" else "Notes Quiz"
                val combinedContent = buildString {
                    notes.forEach { n ->
                        append("=== ${n.title} (${n.category}) ===\n")
                        append(n.content)
                        if (!n.aiSummary.isNullOrBlank()) {
                            append("\nAI Summary: ${n.aiSummary}\n")
                        }
                        append("\n\n")
                    }
                    if (pastedNotesText.isNotBlank()) {
                        append("=== Additional Notes ===\n")
                        append(pastedNotesText)
                    }
                }

                val quiz = repository.generateCustomQuiz(
                    title = title,
                    sourceContent = combinedContent.ifBlank { "Study notes on ${config.topic}" },
                    sourceType = "notes",
                    questionCount = config.questionCount,
                    difficulty = config.difficulty,
                    questionType = config.questionType
                )
                _userMessage.value = "AI Note Quiz Created! (${config.questionCount} Questions)"
                _activeQuiz.value = quiz
            } catch (e: Exception) {
                _userMessage.value = "We couldn't create a quiz from that note. Please try again."
            } finally {
                _isLoading.value = false
            }
        }
    }

    fun generateQuizFromRecording(
        recordingId: String,
        config: QuizConfig
    ) {
        viewModelScope.launch {
            _isLoading.value = true
            try {
                val rec = uiState.value.recordings.find { it.id == recordingId }
                val title = rec?.let { "Recording: ${it.title}" } ?: "Recording Quiz"
                val content = rec?.let { "Subject: ${it.subject}\n\nSummary: ${it.summary}\n\nTranscript: ${it.transcript}" }
                    ?: "Lecture recording audio transcript."

                val quiz = repository.generateCustomQuiz(
                    title = title,
                    sourceContent = content,
                    sourceType = "recording",
                    questionCount = config.questionCount,
                    difficulty = config.difficulty,
                    questionType = config.questionType
                )
                _userMessage.value = "Class Recording Quiz Created! (${config.questionCount} Questions)"
                _activeQuiz.value = quiz
            } catch (e: Exception) {
                _userMessage.value = "We couldn't create a quiz from that recording. Please try again."
            } finally {
                _isLoading.value = false
            }
        }
    }

    fun generateQuizFromDocument(
        documentId: String,
        config: QuizConfig
    ) {
        viewModelScope.launch {
            _isLoading.value = true
            try {
                val doc = uiState.value.documents.find { it.id == documentId }
                val title = doc?.let { "Document: ${it.title}" } ?: "Document Quiz"
                val content = doc?.let { "File: ${it.fileName}\n\nExtracted Text: ${it.contentExtracted}" }
                    ?: "Document study materials."

                val quiz = repository.generateCustomQuiz(
                    title = title,
                    sourceContent = content,
                    sourceType = "notes",
                    questionCount = config.questionCount,
                    difficulty = config.difficulty,
                    questionType = config.questionType
                )
                _userMessage.value = "Document Quiz Created! (${config.questionCount} Questions)"
                _activeQuiz.value = quiz
            } catch (e: Exception) {
                _userMessage.value = "We couldn't create a quiz from that document. Please try again."
            } finally {
                _isLoading.value = false
            }
        }
    }

    fun generateQuizFromTopic(
        topic: String,
        focusAreas: List<String>,
        config: QuizConfig
    ) {
        viewModelScope.launch {
            _isLoading.value = true
            try {
                val focusStr = if (focusAreas.isNotEmpty()) "\nFocus Areas: ${focusAreas.joinToString(", ")}" else ""
                val quiz = repository.generateCustomQuiz(
                    title = topic.ifBlank { config.topic },
                    sourceContent = "Generate quiz questions for subject '$topic'.$focusStr",
                    sourceType = "ai",
                    questionCount = config.questionCount,
                    difficulty = config.difficulty,
                    questionType = config.questionType
                )
                _userMessage.value = "AI Quiz Created! (${config.questionCount} Questions)"
                _activeQuiz.value = quiz
            } catch (e: Exception) {
                _userMessage.value = "We couldn't create that quiz. Please try again."
            } finally {
                _isLoading.value = false
            }
        }
    }

    fun clearUserMessage() {
        _userMessage.value = null
    }

    /**
     * Generates REAL questions for a live session topic (never hardcoded/dummy questions).
     * Tries the backend `generate-ai-quiz` edge function first (same pipeline as the web), then
     * falls back to the direct Gemini chain. Returns [LiveQuestionResult] carrying the real
     * backend error (HTTP code + message) when every AI source fails, so the caller can surface
     * it instead of silently fabricating or banking questions.
     */
    /**
     * Builds the topic string sent to the AI for an Explorer game level. Each game
     * anchors the topic on its REAL subject so the model can't drift or fixate:
     *   - kente_quiz (SOCIAL STUDIES): levels cover the USER'S COUNTRY's history,
     *     culture, geography and national pride — NOT kente cloth. Passing the game
     *     title ("Kente Quiz Level 1: My Ghana") makes the model fixate on kente and
     *     generate kente-only trivia for every level, so we anchor on the student's
     *     country (from the education profile) and the level's real subject.
     *   - ananse_riddles: logic riddles & puzzles (not random general trivia).
     *   - maths_quest: arithmetic scaled to the level's difficulty (not bead crafts
     *     or general knowledge from the playful level names like "Counting Beads").
     *   - spelling_bee: never comes here (runs its own screen + word generator).
     */
    private suspend fun buildExplorerGameTopic(
        gameKey: String,
        levelIndex: Int,
        levelName: String,
        difficulty: String = "medium"
    ): String = when (gameKey) {
        "kente_quiz" -> {
            val country = repository.educationProfile.first()?.countryName?.takeIf { it.isNotBlank() } ?: "the student's country"
            "$country history, culture, geography and national pride — Level $levelIndex: $levelName"
        }
        "ananse_riddles" -> "Kid-friendly riddles, brain teasers and logic puzzles — Level $levelIndex: $levelName"
        "maths_quest" -> {
            val ops = when (difficulty.lowercase()) {
                "hard" -> "multi-digit multiplication, division and multi-step word problems"
                "medium" -> "multiplication, division, fractions and money word problems"
                else -> "simple addition, subtraction and counting problems"
            }
            "Maths practice ($ops) — Level $levelIndex: $levelName"
        }
        else -> "$levelName"
    }

    /**
     * Per-game prompt guidance for the live-question AI so it stays on the game's real
     * subject. Without this, the game title / playful level name alone can bias the
     * model — e.g. "Kente Quiz" → kente-only trivia, "Counting Beads" → bead crafts
     * instead of arithmetic. Each game gets explicit subject + scope instructions.
     */
    private fun gameGuidance(gameKey: String): String {
        // Base safety guidance for all Explorer child accounts
        val safetyPrefix = "Generate content appropriate for children aged 6-14. " +
            "Do NOT include violent, sexual, political, or otherwise inappropriate content. " +
            "Keep language simple and educational. "

        return safetyPrefix + when (gameKey) {
        "kente_quiz" ->
            "This is a Social Studies quiz about the student's country. Cover its history, " +
                "national heroes, independence, culture, geography, festivals, food, " +
                "symbols and daily life. Do NOT make all or most questions about kente cloth " +
                "— kente is only one small part of the country's heritage."
        "ananse_riddles" ->
            "This is a riddles and brain-teaser game. Every question must be a riddle, " +
                "logic puzzle or pattern puzzle appropriate for a primary school student, " +
                "with one clearly correct answer. Do NOT ask general-knowledge or trivia " +
                "questions about people, places or history."
        "maths_quest" ->
            "This is a maths game. Every question must be a real arithmetic or maths word " +
                "problem with exactly one correct numeric answer, appropriate for the stated " +
                "difficulty. Do NOT ask trivia, history, craft or general-knowledge questions."
        "science_explorer" ->
            "This is a science quiz about plants, animals, energy, weather, the human body, " +
                "and natural phenomena. Every question must be a real science fact with one " +
                "clearly correct answer. Use age-appropriate vocabulary. " +
                "Do NOT ask maths, history or general-knowledge questions."
        "math_asteroid_blaster" ->
            "This is a fast-paced maths shooting game. Every question must be a real " +
                "arithmetic problem (addition, subtraction, multiplication or division) " +
                "with exactly one correct numeric answer. Keep numbers age-appropriate. " +
                "Do NOT ask trivia or word problems — just the equation and answer."
        "spelling_bee" ->
            "This is a spelling game. Generate a word, its definition, and an example " +
                "sentence appropriate for the student's grade level. Words should be " +
                "common English vocabulary — not obscure or overly technical. " +
                "Include a mix of 3-6 letter words scaled to difficulty."
        else -> ""
        }
    }

    private suspend fun generateLiveQuestions(topic: String, config: QuizConfig, topicGuidance: String = ""): LiveQuestionResult {
        val count = config.questionCount.coerceIn(1, 20)
        // 1) Backend edge function (authenticated, personalized, web-parity). If it
        // fails for ANY reason (undeployed → 404, server AI quota → 500, network),
        // we LOG the reason and fall through to the direct AI chain below instead of
        // failing the level — the direct chain is exactly what keeps Spelling Bee
        // working, so games must never hard-fail on a backend hiccup.
        var backendFailure: String? = null
        if (BackendApiService.isConfigured()) {
            try {
                val difficulty = when (config.difficulty.lowercase()) {
                    "easy" -> "easy"
                    "hard" -> "hard"
                    "ollie expert" -> "hard"
                    else -> "intermediate"
                }
                val res = BackendApiService.generateQuizViaBackend(
                    userTopics = listOf(topic),
                    numQuestions = count,
                    difficulty = difficulty
                )
                if (res is BackendResult.Success) {
                    val normalized = BackendApiService.normalizeBackendQuizToMobileJson(res.data)
                    if (normalized.isNotBlank()) {
                        val parsed = parseQuizQuestionsJson(normalized)
                        if (parsed.isNotEmpty()) return LiveQuestionResult(questions = parsed)
                    }
                    backendFailure = "Backend 'generate-ai-quiz' returned no valid questions for \"$topic\"."
                } else if (res is BackendResult.Error) {
                    val code = res.code
                    android.util.Log.e("QuizzesViewModel", "[BACKEND-API] generate-ai-quiz failed (HTTP $code): ${res.message}")
                    backendFailure = if (code != null) {
                        "Edge function 'generate-ai-quiz' returned HTTP $code. ${res.message}"
                    } else {
                        "Edge function 'generate-ai-quiz' failed: ${res.message}"
                    }
                }
            } catch (e: Exception) {
                android.util.Log.w("QuizzesViewModel", "Backend live-question generation failed: ${e.message}")
                backendFailure = "Backend live-question generation failed: ${e.message}"
            }
        }
        // 2) No gemini-chat fallback — backend is the sole generation source.
        val errorMsg = backendFailure ?: "Quiz generation failed. Please check your connection and try again."
        return LiveQuestionResult(errorMessage = errorMsg)
    }

    /**
     * Generates spelling-bee words (word + definition + example sentence) via the DEDICATED
     * `generate-spelling-words` edge function — never the gemini-chat chat pipeline. The real
     * backend error is surfaced so a missing/undeployed function shows its true failure.
     */
    suspend fun generateSpellingWords(levelIndex: Int): SpellingWordsResult {
        val count = when (levelIndex) { 1 -> 5; 2 -> 6; 3 -> 7; else -> 8 }
        if (!BackendApiService.isConfigured()) {
            return SpellingWordsResult(errorMessage = "The word service isn't configured yet. Please try again.")
        }
        try {
            val res = BackendApiService.generateSpellingWords(levelIndex, count)
            if (res is BackendResult.Success) {
                val arr = res.data.optJSONArray("words")
                val words = mutableListOf<SpellingWordItem>()
                if (arr != null) {
                    for (i in 0 until arr.length()) {
                        val obj = arr.optJSONObject(i) ?: continue
                        val w = obj.optString("word", "").trim()
                        if (w.isNotBlank() && w.all { it.isLetter() } && w.length in 2..9) {
                            words.add(
                                SpellingWordItem(
                                    word = w.lowercase(),
                                    definition = obj.optString("definition", "").ifBlank { "A word we can spell!" },
                                    sentence = obj.optString("sentence", "").ifBlank { "Can you spell \"$w\"?" }
                                )
                            )
                        }
                    }
                }
                if (words.isNotEmpty()) {
                    return SpellingWordsResult(words = words)
                }
                return SpellingWordsResult(errorMessage = "The word service returned no valid words. Please try again.")
            } else {
                val code = (res as? BackendResult.Error)?.code
                val msg = (res as? BackendResult.Error)?.message ?: "Unknown error"
                android.util.Log.e("QuizzesViewModel", "[BACKEND-API] generate-spelling-words failed (HTTP $code): $msg")
                return SpellingWordsResult(
                    errorMessage = if (code != null) {
                        "Edge function 'generate-spelling-words' returned HTTP $code. $msg"
                    } else {
                        "Edge function 'generate-spelling-words' failed: $msg"
                    }
                )
            }
        } catch (e: Exception) {
            android.util.Log.w("QuizzesViewModel", "Spelling-word generation failed: ${e.message}")
            return SpellingWordsResult(errorMessage = "AI word generation failed: ${e.message}")
        }
    }

    private var pollingJob: kotlinx.coroutines.Job? = null

    // Speed Race (Explorer) lobby auto-start: the public-lobby host starts the race once
    // 2+ players are in, or after 20s with at least one player. Guarded so it fires once.
    private var speedAutoStartPending = false
    private var speedLobbyStartedAt = 0L

    // Realtime (WebSocket) channel for instant updates — question changes, scores and the
    // server-authoritative deadline arrive the moment the server writes them instead of on
    // the next 2s poll tick. This is the mobile twin of the web's subscribeToSession().
    private val realtimeClient by lazy {
        LiveQuizRealtimeClient { _, _, _ -> onRealtimeChange() }
    }
    private var lastRealtimeRefreshMs = 0L

    private fun onRealtimeChange() {
        val sessionId = _activeLiveSession.value?.sessionId ?: return
        val now = System.currentTimeMillis()
        // Debounce bursts (e.g. all players answering at once) into a single refresh.
        if (now - lastRealtimeRefreshMs < 400) return
        lastRealtimeRefreshMs = now
        viewModelScope.launch { refreshSessionOnce(sessionId) }
    }

    /** Parses an ISO-8601 timestamp (e.g. "2026-08-02T01:58:59.872Z") into epoch millis. */
    private fun parseServerTimeMillis(value: String): Long? {
        if (value.isBlank()) return null
        val patterns = listOf(
            "yyyy-MM-dd'T'HH:mm:ss.SSSXXX",
            "yyyy-MM-dd'T'HH:mm:ssXXX",
            "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",
            "yyyy-MM-dd'T'HH:mm:ss'Z'"
        )
        for (pattern in patterns) {
            try {
                val sdf = java.text.SimpleDateFormat(pattern, java.util.Locale.US).apply {
                    timeZone = java.util.TimeZone.getTimeZone("UTC")
                }
                val date = sdf.parse(value)
                if (date != null) return date.time
            } catch (_: Exception) {
                // try the next pattern
            }
        }
        return null
    }

    private fun startPolling(sessionId: String) {
        pollingJob?.cancel()
        pollingJob = viewModelScope.launch {
            while (isActive) {
                delay(2000)
                val currentSession = _activeLiveSession.value ?: break
                val currentId = currentSession.sessionId ?: break
                if (!refreshSessionOnce(currentId)) break
            }
        }
    }

    /**
     * One authoritative fetch of the session state — called by the poll loop AND on every
     * realtime event, so question changes and scores arrive the instant the server writes
     * them (Kahoot-style) instead of only on the next 2s poll tick.
     *
     * @return false when the session ended/was replaced and the caller should stop polling.
     */
    private suspend fun refreshSessionOnce(sessionId: String): Boolean {
        val latestSession = _activeLiveSession.value ?: return false
        if (latestSession.sessionId != sessionId) return false
        try {
            val payload = JSONObject().apply {
                put("action", "get-session-state")
                put("session_id", sessionId)
            }
            val result = BackendApiService.executeEdgeFunction("live-quiz", payload)
            if (result is BackendResult.Success) {
                val dataObj = result.data
                val sessionObj = dataObj.optJSONObject("session")
                if (sessionObj != null) {
                    // Re-read the freshest session state BEFORE merging server data. A poll that
                    // started before the user tapped an answer must never write back its stale
                    // snapshot — that would wipe the user's answer/score and revert the phase
                    // (the "Answer Locked! Syncing..." freeze, with answered questions showing as
                    // unanswered in the final results). Merging onto the LATEST state instead
                    // means refreshes only update server-derived fields (players, scores, timer,
                    // question progress) and never clobber local answer progress.
                    val latest = _activeLiveSession.value ?: return false
                    if (latest.sessionId != sessionId) return false
                    val status = sessionObj.optString("status", "waiting")
                    val pin = sessionObj.optString("join_code", latest.pin)

                    if (status == "completed" || status == "cancelled") {
                        _activeLiveSession.value = latest.copy(phase = LiveQuizPhase.PODIUM)
                        pollingJob?.cancel()
                        realtimeClient.close()
                        return false
                    }

                    // Parse players
                    val playersJson = dataObj.optJSONArray("players")
                    val parsedPlayers = mutableListOf<LivePlayer>()
                    if (playersJson != null) {
                        for (i in 0 until playersJson.length()) {
                            val pObj = playersJson.getJSONObject(i)
                            // live_quiz_players has a row PK `id` and a `user_id` FK to auth.users.
                            // Identity comparisons must use user_id (the server/auth uid), not the row id.
                            val pId = pObj.optString("user_id", pObj.optString("id", ""))
                            val pName = pObj.optString("display_name", "Player")
                            val score = pObj.optInt("score", 0)
                            val isPlaying = pObj.optBoolean("is_playing", true)
                            val isMediator = pObj.optBoolean("is_mediator", false)
                            val avatarEmoji = if (pId.isNotBlank() && pId == latest.currentUserId) latest.currentUserEmoji else "🚀"
                            parsedPlayers.add(
                                LivePlayer(
                                    id = pId,
                                    name = pName,
                                    avatarEmoji = avatarEmoji,
                                    score = score,
                                    streak = 0,
                                    isPlaying = isPlaying,
                                    isMediator = isMediator
                                )
                            )
                        }
                    }

                    val sortedPlayers = parsedPlayers.sortedByDescending { it.score }

                    // Parse questions
                    val questionsJson = dataObj.optJSONArray("questions")
                    val parsedQuestions = mutableListOf<QuizQuestionItem>()
                    val questionIds = mutableListOf<String>()
                    if (questionsJson != null) {
                        for (i in 0 until questionsJson.length()) {
                            val qObj = questionsJson.getJSONObject(i)
                            val qId = qObj.optString("id", "")
                            questionIds.add(qId)
                            val qText = qObj.optString("question_text", qObj.optString("question", "Question"))
                            val optsJson = qObj.optJSONArray("options")
                            val optionsList = mutableListOf<String>()
                            if (optsJson != null) {
                                for (j in 0 until optsJson.length()) {
                                    optionsList.add(optsJson.getString(j))
                                }
                            }
                            val correctAns = qObj.optInt("correct_answer", 0)
                            val explanation = qObj.optString("explanation", "")
                            parsedQuestions.add(
                                QuizQuestionItem(
                                    question = qText,
                                    options = optionsList,
                                    correctIndex = correctAns,
                                    explanation = explanation
                                )
                            )
                        }
                    }

                    val currentQuestionJson = dataObj.optJSONObject("current_question")
                    var currentQuestionIdx = latest.currentQuestionIndex
                    var currentQuestionId: String? = latest.currentQuestionId
                    var currentQuestionEndTime: Long? = latest.currentQuestionEndTime

                    if (currentQuestionJson != null) {
                        currentQuestionIdx = currentQuestionJson.optInt("question_index", currentQuestionIdx)
                        currentQuestionId = currentQuestionJson.optString("id", currentQuestionId)
                        val endTimeStr = currentQuestionJson.optString("end_time", "")
                        if (endTimeStr.isNotBlank()) {
                            currentQuestionEndTime = parseServerTimeMillis(endTimeStr)
                        }
                    }

                    // A delayed poll response can carry OLDER server data (a request that started
                    // before the previous question advanced). Question indices only ever advance
                    // within a session, so never rewind to an older index — keep the freshest
                    // position (and its id/deadline) when this response is behind.
                    if (currentQuestionIdx < latest.currentQuestionIndex) {
                        currentQuestionIdx = latest.currentQuestionIndex
                        currentQuestionId = latest.currentQuestionId
                        currentQuestionEndTime = latest.currentQuestionEndTime
                    }

                    var newPhase = latest.phase
                    val hostUserId = sessionObj.optString("host_user_id", "")
                    val currentUserId = repository.getOrRestoreActiveUserId()
                    val isUserHost = if (hostUserId.isNotBlank() && hostUserId != "null" && currentUserId.isNotBlank()) {
                        hostUserId.trim().lowercase() == currentUserId.trim().lowercase()
                    } else {
                        latest.isHost
                    }

                    // Keep the local config aligned with the server's (players especially).
                    val serverConfigObj = sessionObj.optJSONObject("config")
                    val serverTimeLimit = serverConfigObj?.optInt("question_time_limit")?.takeIf { it > 0 }
                    var updatedConfig = latest.config
                    if (serverTimeLimit != null && serverTimeLimit != updatedConfig.timeLimitSec) {
                        updatedConfig = updatedConfig.copy(timeLimitSec = serverTimeLimit)
                    }
                    // Adopt the server's host role so the runner can render the mediator (spectate)
                    // host view correctly and keep the host's answers disabled.
                    val serverHostRole = sessionObj.optString("host_role", "")
                    if (serverHostRole.isNotBlank() && serverHostRole != updatedConfig.hostRole) {
                        updatedConfig = updatedConfig.copy(hostRole = serverHostRole)
                    }

                    if (status == "waiting") {
                        if (latest.phase == LiveQuizPhase.LOBBY) {
                            newPhase = LiveQuizPhase.LOBBY
                        }
                    } else if (status == "in_progress") {
                        if (latest.phase == LiveQuizPhase.LOBBY) {
                            newPhase = LiveQuizPhase.QUESTION
                        } else if (currentQuestionIdx != latest.currentQuestionIndex) {
                            // Auto mode: EVERYONE (host included) follows the server's advance, so
                            // the host's leaderboard screen moves on to the next question on its own.
                            // Manual mode: only players follow; the host drives pacing via Next.
                            val serverAdvanceMode = sessionObj.optString("advance_mode", "auto")
                            if (serverAdvanceMode == "auto" || !isUserHost) {
                                newPhase = LiveQuizPhase.QUESTION
                            }
                        }
                    }

                    val updatedSession = latest.copy(
                        pin = pin,
                        players = sortedPlayers,
                        questions = if (parsedQuestions.isNotEmpty()) parsedQuestions else latest.questions,
                        currentQuestionIndex = currentQuestionIdx,
                        currentQuestionId = currentQuestionId ?: (if (questionIds.size > currentQuestionIdx) questionIds[currentQuestionIdx] else null),
                        serverQuestionIds = if (questionIds.isNotEmpty()) questionIds else latest.serverQuestionIds,
                        currentQuestionEndTime = currentQuestionEndTime,
                        phase = newPhase,
                        isHost = isUserHost,
                        config = updatedConfig
                    )
                    _activeLiveSession.value = updatedSession

                    // Speed Race auto-start (host of a public quick race): fire once when 2+ players
                    // are in the lobby. Solo races (no opponent) are not auto-started.
                    // Private Friend Rooms keep the manual host Start button.
                    if (speedAutoStartPending) {
                        val s = updatedSession
                        if (s.isSpeedRace && s.isHost && s.phase == LiveQuizPhase.LOBBY && status == "waiting") {
                            val playingRacers = s.players.count { it.isPlaying && !it.isMediator }
                            if (playingRacers >= 2) {
                                speedAutoStartPending = false
                                startHostLiveSession()
                            }
                        }
                    }
                }
            }
        } catch (e: Exception) {
            android.util.Log.e("QuizzesViewModel", "Error in polling session state", e)
        }
        return true
    }

    fun startLiveSession(
        pin: String,
        isHost: Boolean,
        topicName: String = "AI Kahoot Live",
        config: QuizConfig = QuizConfig(),
        customQuestions: List<QuizQuestionItem>? = null,
        quizId: String? = null,
        playerName: String? = null,
        playerEmoji: String = "🚀",
        speedGameKey: String? = null,
        isPublicLobby: Boolean = false
    ) {
        viewModelScope.launch {
            _isLoading.value = true
            try {
                val profile = repository.getProfileDirect()
                val userName = profile?.fullName?.takeIf { it.isNotBlank() && it != "New Scholar" } ?: "You"

                val selectedTopic = topicName.ifBlank { config.topic }
                val sessionQuestions = if (!customQuestions.isNullOrEmpty()) {
                    customQuestions
                } else if (!quizId.isNullOrBlank()) {
                    // Hosting from the library: use the real quiz questions, not placeholders.
                    val libraryQuiz = uiState.value.quizzes.find { it.id == quizId }
                    val parsed = libraryQuiz?.let { parseQuizQuestionsJson(it.questionsJson) }
                    if (!parsed.isNullOrEmpty()) {
                        parsed
                    } else {
                        // Library quiz has no parseable questions — generate REAL ones from AI
                        // (never fall back to hardcoded placeholders).
                        generateLiveQuestions(selectedTopic, config).let { res ->
                            if (res.questions.isNullOrEmpty()) {
                                _userMessage.value = res.errorMessage
                                    ?: "Couldn't load questions for this quiz. Please pick a quiz with questions or try again."
                                _isLoading.value = false
                                return@launch
                            }
                            res.questions
                        }
                    }
                } else {
                    // Hosting a topic-only session — generate REAL AI questions, never dummy ones.
                    // Speed Race (Explorer games): route the topic through the game-aware builder
                    // so e.g. the Social Studies game asks about the student's country, not kente,
                    // and carries the game's subject guidance. Plain live quizzes keep the raw topic.
                    val genKey = speedGameKey?.let { normalizeGameKey(it) }
                    val genTopic = if (!genKey.isNullOrBlank()) {
                        buildExplorerGameTopic(genKey, 0, "Speed Race", config.difficulty)
                    } else {
                        selectedTopic
                    }
                    generateLiveQuestions(
                        genTopic,
                        config,
                        topicGuidance = gameGuidance(genKey ?: "")
                    ).let { res ->
                        if (res.questions.isNullOrEmpty()) {
                            _userMessage.value = res.errorMessage
                                ?: "Couldn't generate questions for '$selectedTopic'. Please add custom questions or try again."
                            _isLoading.value = false
                            return@launch
                        }
                        res.questions
                    }
                }

                if (isHost) {
                    val payload = JSONObject().apply {
                        put("action", "create-session")
                        // Send the topic title so the server-created quiz row keeps the real
                        // topic name (History shows it after re-login instead of "Live Quiz - Custom").
                        put("title", selectedTopic)
                        if (!speedGameKey.isNullOrBlank()) {
                            put("game_key", speedGameKey)
                            put("is_public", isPublicLobby)
                        }
                        if (!quizId.isNullOrBlank()) {
                            put("quiz_id", quizId)
                        } else {
                            val questionsArr = JSONArray()
                            sessionQuestions.forEach { q ->
                                val qObj = JSONObject().apply {
                                    put("question_text", q.question)
                                    val optsArr = JSONArray()
                                    q.options.forEach { optsArr.put(it) }
                                    put("options", optsArr)
                                    put("correct_answer", q.correctIndex)
                                    put("explanation", q.explanation)
                                    put("time_limit", config.timeLimitSec.coerceIn(5, 120))
                                }
                                questionsArr.put(qObj)
                            }
                            put("questions", questionsArr)
                        }
                        put("host_role", config.hostRole)
                        put("advance_mode", config.advanceMode)
                        put("quiz_mode", config.quizMode)
                        put("question_time_limit", config.timeLimitSec.coerceIn(5, 120))
                        put("allow_late_join", config.allowLateJoin)
                    }

                    logPayload("Creating live session: payload=$payload")
                    val result = BackendApiService.executeEdgeFunction("live-quiz", payload)
                    if (result is BackendResult.Success) {
                        val dataObj = result.data
                        val sessionObj = dataObj.optJSONObject("session")
                        // The server always assigns the join code — never fabricate a dummy PIN.
                        val serverPin = dataObj.optString("join_code", "").ifBlank { pin }
                        val serverSessionId = sessionObj?.optString("id", "")
                        // Real server quiz id (edge function creates a live_custom quiz for custom
                        // questions and returns it here; for library quizzes it echoes the passed id).
                        val serverQuizId = sessionObj?.optString("quiz_id", "")?.takeIf { it.isNotBlank() }

                        // Mirror the live quiz locally so completed sessions appear in History with a
                        // title. Use the real server quiz id when available so the cloud attempt's
                        // quiz_id FK resolves and the same row re-pairs after re-login.
                        val mirrorId = serverQuizId ?: java.util.UUID.randomUUID().toString()
                        runCatching {
                            repository.saveLiveQuizMirror(mirrorId, selectedTopic, buildLiveQuestionsJson(sessionQuestions))
                        }

                        _activeLiveSession.value = LiveQuizSession(
                            pin = serverPin,
                            title = selectedTopic,
                            questions = sessionQuestions,
                            isHost = true,
                            players = emptyList(),
                            currentQuestionIndex = 0,
                            phase = LiveQuizPhase.LOBBY,
                            config = config.copy(topic = selectedTopic),
                            sessionId = serverSessionId,
                            quizId = mirrorId,
                            currentUserId = repository.getOrRestoreActiveUserId(),
                            currentUserEmoji = playerEmoji,
                            isSpeedRace = !speedGameKey.isNullOrBlank(),
                            speedGameKey = speedGameKey
                        )
                        _userMessage.value = "Live session ready! Share PIN $serverPin with your players 🎉"
                        if (!serverSessionId.isNullOrBlank()) {
                            startPolling(serverSessionId)
                            realtimeClient.subscribe(serverSessionId)
                        }
                    } else {
                        val errMsg = (result as? BackendResult.Error)?.message ?: "We couldn't start the live session. Please try again."
                        _userMessage.value = BackendApiService.userFacingErrorMessage(errMsg)
                    }
                } else {
                    // The joiner's chosen display name is sanitized for child safety
                    val rawDisplayName = playerName?.takeIf { it.isNotBlank() } ?: userName
                    val finalDisplayName = com.example.util.ChildSafetyGuard.sanitizeDisplayName(rawDisplayName)
                    val payload = JSONObject().apply {
                        put("action", "join-session")
                        put("join_code", pin.uppercase())
                        put("display_name", finalDisplayName)
                    }

                    logPayload("Joining live session: payload=$payload")
                    val joinResult = BackendApiService.executeEdgeFunction("live-quiz", payload)
                    if (joinResult is BackendResult.Success) {
                        val dataObj = joinResult.data
                        val sessionObj = dataObj.optJSONObject("session")
                        val sessionId = sessionObj?.optString("id", "") ?: ""

                        if (sessionId.isBlank()) {
                            _userMessage.value = "We couldn't find that session. Please check the PIN and try again."
                        } else {
                            val statePayload = JSONObject().apply {
                                put("action", "get-session-state")
                                put("session_id", sessionId)
                            }

                            val stateResult = BackendApiService.executeEdgeFunction("live-quiz", statePayload)
                            if (stateResult is BackendResult.Success) {
                                val stateData = stateResult.data
                                val serverQuestions = stateData.optJSONArray("questions")
                                // Adopt the host's real config (time limit, pacing, late-join) from the server
                                // instead of the local defaults, so the player's timer matches the host's.
                                val serverConfig = stateData.optJSONObject("session")?.optJSONObject("config")
                                    ?: stateData.optJSONObject("config")
                                val serverTimeLimit = serverConfig?.optInt("question_time_limit")?.takeIf { it > 0 }
                                val serverAdvanceMode = serverConfig?.optString("advance_mode")?.takeIf { it.isNotBlank() }
                                val serverQuizMode = serverConfig?.optString("quiz_mode")?.takeIf { it.isNotBlank() }
                                val serverAllowLateJoin = if (serverConfig?.has("allow_late_join") == true) serverConfig.optBoolean("allow_late_join") else null
                                val mergedConfig = config.copy(
                                    topic = selectedTopic,
                                    timeLimitSec = serverTimeLimit ?: config.timeLimitSec,
                                    advanceMode = serverAdvanceMode ?: config.advanceMode,
                                    quizMode = serverQuizMode ?: config.quizMode,
                                    allowLateJoin = serverAllowLateJoin ?: config.allowLateJoin
                                )
                                val parsedQuestions = mutableListOf<QuizQuestionItem>()
                                val parsedQuestionIds = mutableListOf<String>()
                                if (serverQuestions != null) {
                                    for (i in 0 until serverQuestions.length()) {
                                        val qObj = serverQuestions.getJSONObject(i)
                                        parsedQuestionIds.add(qObj.optString("id", ""))
                                        val qText = qObj.optString("question_text", qObj.optString("question", "Question"))
                                        val optsJson = qObj.optJSONArray("options")
                                        val optionsList = mutableListOf<String>()
                                        if (optsJson != null) {
                                            for (j in 0 until optsJson.length()) {
                                                optionsList.add(optsJson.getString(j))
                                            }
                                        }
                                        val correctAns = qObj.optInt("correct_answer", 0)
                                        val explanation = qObj.optString("explanation", "")
                                        parsedQuestions.add(
                                            QuizQuestionItem(
                                                question = qText,
                                                options = optionsList,
                                                correctIndex = correctAns,
                                                explanation = explanation
                                            )
                                        )
                                    }
                                }

                                val finalQuestions = parsedQuestions.ifEmpty { sessionQuestions }

                                val playerObj = dataObj.optJSONObject("player")
                                val isPlayerHost = playerObj?.optBoolean("is_host", false) ?: false
                                val hostUserId = sessionObj?.optString("host_user_id", "") ?: ""
                                val currentUserId = repository.getOrRestoreActiveUserId()
                                val isUserHost = isPlayerHost || (hostUserId.isNotBlank() && hostUserId != "null" && currentUserId.isNotBlank() && hostUserId.trim().lowercase() == currentUserId.trim().lowercase())
                                // Real server quiz id for the session (host's quiz — the same one the
                                // host's cloud attempt references), so the player's attempt FK resolves.
                                val serverQuizId = sessionObj?.optString("quiz_id", "")?.takeIf { it.isNotBlank() }

                                // Mirror the live quiz locally so completed sessions appear in History with a title.
                                val mirrorId = serverQuizId ?: java.util.UUID.randomUUID().toString()
                                runCatching {
                                    repository.saveLiveQuizMirror(mirrorId, selectedTopic, buildLiveQuestionsJson(finalQuestions))
                                }

                                _activeLiveSession.value = LiveQuizSession(
                                    pin = pin,
                                    title = selectedTopic,
                                    questions = finalQuestions,
                                    isHost = isUserHost,
                                    players = emptyList(),
                                    currentQuestionIndex = 0,
                                    phase = LiveQuizPhase.LOBBY,
                                    config = mergedConfig,
                                    sessionId = sessionId,
                                    quizId = mirrorId,
                                    serverQuestionIds = parsedQuestionIds,
                                    currentUserId = repository.getOrRestoreActiveUserId(),
                                    currentUserEmoji = playerEmoji,
                                    isSpeedRace = !speedGameKey.isNullOrBlank(),
                                    speedGameKey = speedGameKey
                                )
                                _userMessage.value = "Joined Live Session! PIN: $pin 🎮"
                                if (sessionId.isNotBlank()) {
                                    startPolling(sessionId)
                                    realtimeClient.subscribe(sessionId)
                                }
                            } else {
                                _userMessage.value = "We couldn't load this session. Please try again."
                            }
                        }
                    } else {
                        val errMsg = (joinResult as? BackendResult.Error)?.message ?: "We couldn't join that live session. Please check the PIN and try again."
                        _userMessage.value = BackendApiService.userFacingErrorMessage(errMsg)
                    }
                }
            } catch (e: Exception) {
                android.util.Log.e("QuizzesViewModel", "Exception in startLiveSession", e)
                _userMessage.value = "Something went wrong. Please try again."
            } finally {
                _isLoading.value = false
            }
        }
    }

    /**
     * Explorer Speed Race: bank-first questions for the game, then either joins an open
     * public lobby (Quick Race) or creates one. Public lobbies auto-start via the poll
     * loop when enough racers are in; Friend Rooms keep the manual host Start button.
     */
    fun startSpeedRace(
        context: Context,
        gameKey: String,
        gameTitle: String,
        isPublicLobby: Boolean = true,
        difficulty: String = "medium",
        timeLimitSec: Int = 20,
        questionCount: Int = 5
    ) {
        viewModelScope.launch {
            _isLoading.value = true
            try {
                val config = EXPLORER_GAMES[normalizeGameKey(gameKey)]
                if (config == null) {
                    _userMessage.value = "We couldn't find that game. Try again!"
                    return@launch
                }
                val safeDiff = difficulty.lowercase().ifBlank { "medium" }
                val safeTime = timeLimitSec.coerceIn(5, 60)
                val safeCount = questionCount.coerceIn(3, 20)

                // Speed Race questions are ALWAYS generated live (asset banks muted) so backend
                // failures surface their real error instead of silently loading seeded questions.
                val raceResult = generateLiveQuestions(
                    topic = buildExplorerGameTopic(config.key, 0, "Speed Race", safeDiff),
                    config = QuizConfig(topic = config.title, difficulty = safeDiff, questionCount = safeCount, timeLimitSec = safeTime),
                    topicGuidance = gameGuidance(config.key)
                )
                val questions = raceResult.questions ?: emptyList()
                if (questions.isEmpty()) {
                    _userMessage.value = raceResult.errorMessage
                        ?: "Ollie couldn't prepare the race. Check your connection and try again!"
                    return@launch
                }

                val speedConfig = QuizConfig(
                    topic = config.title,
                    difficulty = safeDiff,
                    questionCount = questions.size,
                    timeLimitSec = safeTime,
                    advanceMode = if (isPublicLobby) "auto" else "manual",
                    allowLateJoin = false
                )

                if (isPublicLobby) {
                    // Quick Race: hop into an open public lobby if one is waiting.
                    val res = BackendApiService.findPublicLobby(gameKey)
                    if (res is BackendResult.Success && res.data.optBoolean("found", false)) {
                        val joinCode = res.data.optString("join_code", "").ifBlank {
                            res.data.optJSONObject("session")?.optString("join_code", "") ?: ""
                        }
                        if (joinCode.isNotBlank()) {
                            speedAutoStartPending = false // only the lobby host auto-starts
                            startLiveSession(
                                pin = joinCode,
                                isHost = false,
                                topicName = "${config.title} Speed Race",
                                config = speedConfig,
                                customQuestions = questions,
                                speedGameKey = config.key
                            )
                            return@launch
                        }
                    }
                    // No open lobby — we create one and become the (auto-start) host.
                    speedAutoStartPending = true
                    speedLobbyStartedAt = System.currentTimeMillis()
                } else {
                    speedAutoStartPending = false
                }
                startLiveSession(
                    pin = "",
                    isHost = true,
                    topicName = "${config.title} Speed Race",
                    config = speedConfig,
                    customQuestions = questions,
                    speedGameKey = config.key,
                    isPublicLobby = isPublicLobby
                )
            } finally {
                _isLoading.value = false
            }
        }
    }

    fun setLiveSessionPhase(phase: LiveQuizPhase) {
        val current = _activeLiveSession.value ?: return
        _activeLiveSession.value = current.copy(phase = phase)
    }

    fun startHostLiveSession() {
        val current = _activeLiveSession.value ?: return
        val sessionId = current.sessionId ?: return
        // Optimistic server-authoritative deadline for Q1: the real end_time arrives on the
        // first state refresh and replaces this (it is within ~1 network round trip).
        val optimisticEndTime = System.currentTimeMillis() + (current.config.timeLimitSec.coerceIn(5, 120) * 1000L)
        viewModelScope.launch {
            _isLoading.value = true
            try {
                val payload = JSONObject().apply {
                    put("action", "start-session")
                    put("session_id", sessionId)
                }
                val result = BackendApiService.executeEdgeFunction("live-quiz", payload)
                if (result is BackendResult.Success) {
                    _activeLiveSession.value = current.copy(
                        phase = LiveQuizPhase.QUESTION,
                        currentQuestionEndTime = optimisticEndTime
                    )
                    _userMessage.value = "Live Quiz Started! 🎮"
                } else {
                    val errMsg = (result as? BackendResult.Error)?.message ?: "We couldn't start the live session. Please try again."
                    _userMessage.value = BackendApiService.userFacingErrorMessage(errMsg)
                }
            } catch (e: Exception) {
                _userMessage.value = "Something went wrong. Please try again."
            } finally {
                _isLoading.value = false
            }
        }
    }

    fun submitLiveAnswer(isCorrect: Boolean, timeRemainingSec: Int, selectedOptionIndex: Int = -1) {
        val current = _activeLiveSession.value ?: return
        val sessionId = current.sessionId ?: return
        // Resolve the server question id for the question ON SCREEN (questions[currentQuestionIndex]).
        // The index-resolved id is preferred: currentQuestionId can briefly lag after the host taps
        // Next in manual mode (nextLiveQuestion advances the index optimistically), so it may still
        // point at the previous question — submitting against that would be rejected as "closed".
        val questionId = current.serverQuestionIds.getOrNull(current.currentQuestionIndex)
            ?.takeIf { it.isNotBlank() }
            ?: current.currentQuestionId
            ?: ""

        // Mediator hosts don't answer — they moderate (server inserts them with is_playing=false).
        if (current.isHost && current.config.hostRole == "mediator") return

        // Track the player's own results locally so they show in the History tab.
        val timeTaken = (current.config.timeLimitSec - timeRemainingSec).coerceAtLeast(0)
        val updatedUserAnswers = current.userAnswers.toMutableList()
        while (updatedUserAnswers.size <= current.currentQuestionIndex) {
            updatedUserAnswers.add(null)
        }
        updatedUserAnswers[current.currentQuestionIndex] = selectedOptionIndex.takeIf { it != -1 }
        _activeLiveSession.value = current.copy(
            phase = LiveQuizPhase.LEADERBOARD,
            correctAnswers = current.correctAnswers + (if (isCorrect) 1 else 0),
            totalAnswers = current.totalAnswers + 1,
            totalTimeTakenSec = current.totalTimeTakenSec + timeTaken,
            userAnswers = updatedUserAnswers
        )

        viewModelScope.launch {
            try {
                // No resolvable server question id yet (e.g. the host answered Q1 before the first
                // state refresh returned) — keep the local record but don't send a doomed request.
                if (questionId.isBlank()) {
                    android.util.Log.w(
                        "QuizzesViewModel",
                        "Live answer recorded locally only — no server question_id yet for index ${current.currentQuestionIndex}"
                    )
                    return@launch
                }
                val payload = JSONObject().apply {
                    put("action", "submit-answer")
                    put("session_id", sessionId)
                    put("question_id", questionId)
                    // -1 signals a timeout/unanswered (the edge function treats -1 as the timeout
                    // placeholder), so the server records a real timeout instead of a fabricated wrong answer.
                    put("answer_index", selectedOptionIndex)
                    put("time_taken", timeTaken)
                }
                logPayload("Submitting live answer: payload=$payload")
                var result = BackendApiService.executeEdgeFunction("live-quiz", payload)
                if (result is BackendResult.Error) {
                    // Transient network blip — one quick retry so the server still records the
                    // answer (fire-and-forget is not enough on flaky mobile connections). A repeat
                    // of a success that lost its response is harmless (server dedupes via 409).
                    delay(800L)
                    result = BackendApiService.executeEdgeFunction("live-quiz", payload)
                }
                if (result is BackendResult.Success) {
                    android.util.Log.i("QuizzesViewModel", "Successfully submitted answer to edge function")
                } else {
                    val errMsg = (result as? BackendResult.Error)?.message ?: "Error submitting answer"
                    android.util.Log.e("QuizzesViewModel", "Failed to submit answer to edge function: $errMsg")
                }
            } catch (e: Exception) {
                android.util.Log.e("QuizzesViewModel", "Exception submitting answer", e)
            }
        }
    }

    fun nextLiveQuestion() {
        val current = _activeLiveSession.value ?: return
        val sessionId = current.sessionId ?: return
        viewModelScope.launch {
            _isLoading.value = true
            try {
                val payload = JSONObject().apply {
                    put("action", "next-question")
                    put("session_id", sessionId)
                }
                logPayload("Advancing question: payload=$payload")
                val result = BackendApiService.executeEdgeFunction("live-quiz", payload)
                if (result is BackendResult.Success) {
                    val dataObj = result.data
                    val sessionCompleted = dataObj.optBoolean("session_completed", false)
                    if (sessionCompleted) {
                        _activeLiveSession.value = current.copy(phase = LiveQuizPhase.PODIUM)
                    } else {
                        val nextIndex = dataObj.optInt("next_question_index", current.currentQuestionIndex + 1)
                        // The authoritative deadline for the new question comes straight from
                        // the advance RPC, so the host's timer starts correct with no fallback.
                        val endTimeStr = dataObj.optString("end_time", "")
                        val nextEndTime = if (endTimeStr.isNotBlank()) parseServerTimeMillis(endTimeStr) else null
                        _activeLiveSession.value = current.copy(
                            currentQuestionIndex = nextIndex,
                            // Keep the question id in lockstep with the optimistic index advance so a
                            // fast host answer never submits against the previous question's id.
                            currentQuestionId = current.serverQuestionIds.getOrNull(nextIndex) ?: current.currentQuestionId,
                            currentQuestionEndTime = nextEndTime,
                            phase = LiveQuizPhase.QUESTION
                        )
                    }
                } else {
                    val errMsg = (result as? BackendResult.Error)?.message ?: "We couldn't advance to the next question. Please try again."
                    _userMessage.value = BackendApiService.userFacingErrorMessage(errMsg)
                }
            } catch (e: Exception) {
                _userMessage.value = "Something went wrong. Please try again."
            } finally {
                _isLoading.value = false
            }
        }
    }

    fun finishLiveSession() {
        val current = _activeLiveSession.value ?: return
        val sessionId = current.sessionId ?: return
        viewModelScope.launch {
            _isLoading.value = true
            try {
                // 1. Record the attempt locally so it appears in the History tab (works for host AND player).
                //    It is ALSO pushed to the cloud (pushToCloud = true) so it survives logout/login —
                //    previously it was local-only and logout wiped the local DB (clearAllTables).
                val quizIdForAttempt = current.quizId ?: run {
                    val mirrorId = java.util.UUID.randomUUID().toString()
                    runCatching {
                        repository.saveLiveQuizMirror(mirrorId, current.title, buildLiveQuestionsJson(current.questions))
                    }
                    mirrorId
                }
                // Keep the mirrored questions in sync with what was actually played (server may have replaced placeholders).
                if (current.questions.isNotEmpty()) {
                    runCatching {
                        repository.saveLiveQuizMirror(quizIdForAttempt, current.title, buildLiveQuestionsJson(current.questions))
                    }
                }
                // Mediator hosts don't take part in the quiz — no attempt to record (web parity).
                if (!(current.isHost && current.config.hostRole == "mediator")) {
                    val totalQuestions = current.totalAnswers.coerceAtLeast(if (current.questions.isNotEmpty()) current.questions.size else 1)
                    repository.recordQuizAttempt(
                        quizId = quizIdForAttempt,
                        score = current.correctAnswers,
                        total = totalQuestions,
                        timeTakenSec = current.totalTimeTakenSec,
                        pushToCloud = true,
                        liveResultsJson = buildLiveResultsSnapshot(current)
                    )
                }

                // 2. Best-effort end-session on the server (host only; players get a 403 which is fine).
                val payload = JSONObject().apply {
                    put("action", "end-session")
                    put("session_id", sessionId)
                }
                logPayload("Ending session: payload=$payload")
                val result = BackendApiService.executeEdgeFunction("live-quiz", payload)
                if (result is BackendResult.Success) {
                    _userMessage.value = "Session Completed successfully! 🎉"
                } else {
                    _userMessage.value = "Session finished — saved to your History. 🎉"
                }

                // 3. Auto-complete roadmap step if this speed race was tied to a game key
                val gameKey = current.speedGameKey
                if (!gameKey.isNullOrBlank()) {
                    runCatching { repository.completeRoadmapStepForGame(gameKey) }
                }
            } catch (e: Exception) {
                android.util.Log.e("QuizzesViewModel", "Error finishing live session", e)
                _userMessage.value = "Session finished — saved to your History. 🎉"
            } finally {
                _isLoading.value = false
                _activeLiveSession.value = null
                pollingJob?.cancel()
                realtimeClient.close()
                checkActiveSessions()
            }
        }
    }

    /**
     * Snapshots the finished live session so the full-page results view can show real
     * rankings and per-question review (like the web). Includes the real leaderboard
     * (polled from the server) plus the current user's per-question answers.
     */
    private fun buildLiveResultsSnapshot(current: LiveQuizSession): String? {
        return try {
            val root = JSONObject().apply {
                put("title", current.title)
                put("pin", current.pin)
                put("currentUserId", current.currentUserId)

                val playersArr = JSONArray()
                // Only playing participants rank — mediators (is_playing=false) never appear,
                // so the saved leaderboard matches the in-quiz leaderboard.
                val sortedPlayers = current.players.filter { it.isPlaying }.sortedByDescending { it.score }
                sortedPlayers.forEach { p ->
                    val isYou = p.id.isNotBlank() && p.id == current.currentUserId
                    playersArr.put(JSONObject().apply {
                        put("id", p.id)
                        put("name", p.name)
                        put("score", p.score)
                        put("isYou", isYou)
                    })
                }
                put("players", playersArr)

                val questionsArr = JSONArray()
                current.questions.forEachIndexed { idx, q ->
                    val userAnswer = current.userAnswers.getOrNull(idx)
                    questionsArr.put(JSONObject().apply {
                        put("question", q.question)
                        val opts = JSONArray()
                        q.options.forEach { opts.put(it) }
                        put("options", opts)
                        put("correctIndex", q.correctIndex)
                        put("explanation", q.explanation)
                        if (userAnswer != null) put("userAnswerIndex", userAnswer)
                        put("isCorrect", userAnswer == q.correctIndex)
                    })
                }
                put("questions", questionsArr)
            }
            root.toString()
        } catch (e: Exception) {
            null
        }
    }

    private fun buildLiveQuestionsJson(questions: List<QuizQuestionItem>): String {
        val arr = JSONArray()
        questions.forEach { q ->
            val obj = JSONObject().apply {
                put("question", q.question)
                val opts = JSONArray()
                q.options.forEach { opts.put(it) }
                put("options", opts)
                put("correct", q.correctIndex)
                put("explanation", q.explanation)
            }
            arr.put(obj)
        }
        return arr.toString()
    }

    fun exitLiveSession() {
        pollingJob?.cancel()
        realtimeClient.close()
        _recentlyClosedLiveSession.value = _activeLiveSession.value
        _activeLiveSession.value = null
        checkActiveSessions()
    }

    override fun onCleared() {
        super.onCleared()
        pollingJob?.cancel()
        realtimeClient.shutdown()
    }

    fun refreshQuizzes() {
        viewModelScope.launch {
            _isLoading.value = true
            try {
                repository.syncCloudDataToLocal()
                checkActiveSessions()
                _userMessage.value = "Quizzes and decks refreshed"
            } catch (e: Exception) {
                _userMessage.value = "We couldn't refresh your quizzes. Please try again."
            } finally {
                _isLoading.value = false
            }
        }
    }

}
