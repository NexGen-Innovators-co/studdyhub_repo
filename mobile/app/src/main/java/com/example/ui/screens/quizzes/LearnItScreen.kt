package com.example.ui.screens.quizzes

import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.animateIntAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.border
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.VolumeUp
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.data.local.entities.RoadmapStepEntity
import com.example.data.repository.StuddyHubRepository
import com.example.ui.components.DEFAULT_LESSON_GUIDE_STEPS
import com.example.ui.components.OllieMascot
import com.example.ui.components.OllieMood
import com.example.ui.components.Tactile3DButton
import com.example.ui.components.Tactile3DCard
import com.example.ui.components.TactileSoundSystem
import com.example.ui.components.TaskInteractiveGuideOverlay
import com.example.ui.components.tactileClick
import com.example.ui.theme.AcademicTier
import java.util.Locale
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.firstOrNull
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject

/** A short check question for a Learn It lesson (kid-friendly, 4 options). */
data class LessonCheckQuestion(
    val question: String,
    val options: List<String>,
    val correctIndex: Int,
    val explanation: String = "Great job!"
)

/** Dynamic AI-generated lesson content. */
data class DynamicLesson(
    val paragraphs: List<String>,
    val tips: List<String>,
    val vocabWords: List<String>,
    val questions: List<LessonCheckQuestion>
)

/** Parses cached or returned lesson JSON into a typed DynamicLesson model. */
private fun parseDynamicLessonJson(rawJson: String?): DynamicLesson? {
    if (rawJson.isNullOrBlank()) return null
    return try {
        val root = JSONObject(rawJson)
        val jsonObj = root.optJSONObject("data") ?: root
        val paragraphsArr = jsonObj.optJSONArray("paragraphs") ?: JSONArray()
        val tipsArr = jsonObj.optJSONArray("tips") ?: JSONArray()
        val vocabArr = jsonObj.optJSONArray("vocabWords") ?: jsonObj.optJSONArray("vocab_words") ?: JSONArray()
        val questionsArr = jsonObj.optJSONArray("questions") ?: JSONArray()

        val paragraphs = (0 until paragraphsArr.length()).map { paragraphsArr.getString(it) }.filter { it.isNotBlank() }
        val tips = (0 until tipsArr.length()).map { tipsArr.getString(it) }.filter { it.isNotBlank() }
        val vocabWords = (0 until vocabArr.length()).map { vocabArr.getString(it) }.filter { it.isNotBlank() }

        val questions = mutableListOf<LessonCheckQuestion>()
        for (i in 0 until questionsArr.length()) {
            val qObj = questionsArr.optJSONObject(i) ?: continue
            val qText = qObj.optString("question", "")
            val optArr = qObj.optJSONArray("options") ?: JSONArray()
            val options = (0 until optArr.length()).map { optArr.getString(it) }.filter { it.isNotBlank() }
            val correct = qObj.optInt("correct", 0).coerceIn(0, (options.size - 1).coerceAtLeast(0))
            val exp = qObj.optString("explanation", "Great job understanding this lesson!")
            if (qText.isNotBlank() && options.size >= 2) {
                questions.add(LessonCheckQuestion(qText, options, correct, exp))
            }
        }

        if (paragraphs.isNotEmpty() && questions.isNotEmpty()) {
            DynamicLesson(paragraphs, tips, vocabWords, questions)
        } else {
            null
        }
    } catch (e: Exception) {
        null
    }
}

/** Serializes a DynamicLesson model to JSON string for local Room and cloud persistence. */
private fun DynamicLesson.toJsonString(): String {
    val root = JSONObject()
    val paragraphsArr = JSONArray()
    paragraphs.forEach { paragraphsArr.put(it) }
    root.put("paragraphs", paragraphsArr)

    val tipsArr = JSONArray()
    tips.forEach { tipsArr.put(it) }
    root.put("tips", tipsArr)

    val vocabArr = JSONArray()
    vocabWords.forEach { vocabArr.put(it) }
    root.put("vocabWords", vocabArr)

    val questionsArr = JSONArray()
    questions.forEach { q ->
        val qObj = JSONObject()
        qObj.put("question", q.question)
        val optsArr = JSONArray()
        q.options.forEach { optsArr.put(it) }
        qObj.put("options", optsArr)
        qObj.put("correct", q.correctIndex)
        qObj.put("explanation", q.explanation)
        questionsArr.put(qObj)
    }
    root.put("questions", questionsArr)
    return root.toString()
}

private enum class LearnItPhase { LESSON, CHECK, RESULT }

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LearnItScreen(
    stepId: String,
    repository: StuddyHubRepository,
    onBack: () -> Unit = {},
    onOpenGame: (String) -> Unit = {}
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var step by remember { mutableStateOf<RoadmapStepEntity?>(null) }
    var loadedStep by remember { mutableStateOf(false) }

    // Dynamic AI State
    var isGeneratingLesson by remember { mutableStateOf(false) }
    var lessonError by remember { mutableStateOf<String?>(null) }
    var dynamicLesson by remember { mutableStateOf<DynamicLesson?>(null) }

    var phase by remember { mutableStateOf(LearnItPhase.LESSON) }
    var answers by remember { mutableStateOf<List<Int?>>(emptyList()) }
    var resultCorrect by remember { mutableIntStateOf(0) }
    var completed by remember { mutableStateOf(false) }

    // TTS Audio Pronunciation State
    var ttsEngine by remember { mutableStateOf<TextToSpeech?>(null) }
    var isTtsReady by remember { mutableStateOf(false) }
    var isSpeaking by remember { mutableStateOf(false) }
    var activeSpeakingText by remember { mutableStateOf<String?>(null) }
    var isTurtleSpeed by remember { mutableStateOf(false) }

    DisposableEffect(Unit) {
        var tts: TextToSpeech? = null
        tts = TextToSpeech(context) { status ->
            if (status == TextToSpeech.SUCCESS) {
                tts?.let { engine ->
                    com.example.data.local.TtsSettings.applyTo(engine)
                }
                isTtsReady = true
                ttsEngine = tts
            }
        }

        tts?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
            override fun onStart(utteranceId: String?) {
                isSpeaking = true
            }
            override fun onDone(utteranceId: String?) {
                isSpeaking = false
                activeSpeakingText = null
            }
            override fun onError(utteranceId: String?) {
                isSpeaking = false
                activeSpeakingText = null
            }
        })

        onDispose {
            tts?.stop()
            tts?.shutdown()
        }
    }

    fun speakText(text: String) {
        val tts = ttsEngine ?: return
        if (isSpeaking && activeSpeakingText == text) {
            tts.stop()
            isSpeaking = false
            activeSpeakingText = null
            return
        }
        tts.stop()
        val baseRate = com.example.data.local.TtsSettings.speechRate
        val effectiveRate = if (isTurtleSpeed) (baseRate * 0.65f).coerceIn(0.45f, 0.95f) else (baseRate * 0.85f).coerceIn(0.55f, 1.25f)
        com.example.data.local.TtsSettings.applyTo(tts, rate = effectiveRate)
        activeSpeakingText = text
        isSpeaking = true
        tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, "learn_it_utterance")
    }

    fun stopSpeaking() {
        ttsEngine?.stop()
        isSpeaking = false
        activeSpeakingText = null
    }

    fun loadLessonContent(targetStep: RoadmapStepEntity, forceRegenerate: Boolean = false) {
        // 1. Instant cache check: if cached locally in Room, load instantly with zero wait time
        if (!forceRegenerate && !targetStep.lessonJson.isNullOrBlank()) {
            val cached = parseDynamicLessonJson(targetStep.lessonJson)
            if (cached != null) {
                android.util.Log.d("LearnItScreen", "Loaded lesson instantly from local cache for: ${targetStep.title}")
                dynamicLesson = cached
                isGeneratingLesson = false
                lessonError = null
                return
            }
        }

        scope.launch {
            isGeneratingLesson = true
            lessonError = null
            try {
                val eduProfile = repository.educationProfile.firstOrNull()
                val gradeOrYear = eduProfile?.yearOrGrade?.takeIf { it.isNotBlank() } ?: "Primary / Basic School"
                val country = eduProfile?.countryName?.takeIf { it.isNotBlank() } ?: "Ghana"
                val curriculum = eduProfile?.curriculumName ?: ""

                android.util.Log.d("LearnItScreen", "Generating/fetching interactive lesson for: ${targetStep.title} (forceRegenerate=$forceRegenerate)")

                val backendRes = com.example.data.remote.BackendApiService.generateInteractiveLesson(
                    topic = targetStep.title,
                    subjectName = targetStep.subjectName,
                    subjectCode = targetStep.subjectCode,
                    gradeLevel = gradeOrYear,
                    country = country,
                    curriculum = curriculum,
                    stepId = targetStep.id,
                    forceRegenerate = forceRegenerate
                )

                when (backendRes) {
                    is com.example.data.remote.BackendResult.Success<org.json.JSONObject> -> {
                        val jsonObj = backendRes.data.optJSONObject("data") ?: backendRes.data
                        val parsed = parseDynamicLessonJson(jsonObj.toString())

                        if (parsed != null && parsed.paragraphs.isNotEmpty() && parsed.questions.isNotEmpty()) {
                            dynamicLesson = parsed
                            val serialized = parsed.toJsonString()
                            step = targetStep.copy(lessonJson = serialized)
                            // Persist to local Room database and trigger cloud sync
                            repository.saveRoadmapStepLesson(targetStep.id, serialized)
                        } else {
                            lessonError = "Ollie generated an incomplete lesson for \"${targetStep.title}\". Please tap retry."
                        }
                    }
                    is com.example.data.remote.BackendResult.Error -> {
                        lessonError = "Lesson generation failed: ${backendRes.message}"
                    }
                }
            } catch (e: Exception) {
                android.util.Log.e("LearnItScreen", "Error generating lesson: ${e.message}", e)
                lessonError = "Failed to generate lesson: ${e.localizedMessage ?: e.message}"
            } finally {
                isGeneratingLesson = false
            }
        }
    }

    // ── Lesson Progress Persistence (resume interrupted lessons) ──
    val progressPrefs = remember { context.getSharedPreferences("learnit_progress", android.content.Context.MODE_PRIVATE) }
    LaunchedEffect(stepId) {
        val s = repository.getRoadmapStep(stepId)
        step = s
        loadedStep = true
        if (s != null) {
            loadLessonContent(s)
            // Restore saved progress
            val savedPhase = progressPrefs.getString("${stepId}_phase", null)
            val savedAnswers = progressPrefs.getString("${stepId}_answers", null)
            if (savedPhase == "CHECK" && !savedAnswers.isNullOrBlank()) {
                try {
                    val arr = org.json.JSONArray(savedAnswers)
                    answers = (0 until arr.length()).map { if (arr.isNull(it)) null else arr.getInt(it) }
                    phase = LearnItPhase.CHECK
                } catch (_: Exception) { /* ignore corrupt data */ }
            }
        }
    }
    // Persist progress whenever it changes
    LaunchedEffect(phase, answers) {
        if (loadedStep && step != null) {
            progressPrefs.edit().apply {
                putString("${stepId}_phase", phase.name)
                putString("${stepId}_answers", org.json.JSONArray(answers.map { it ?: org.json.JSONObject.NULL }).toString())
                apply()
            }
        }
    }

    val currentStep = step
    if (loadedStep && currentStep == null) {
        Column(
            modifier = Modifier.fillMaxSize().padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Text("📭", fontSize = 48.sp)
            Spacer(modifier = Modifier.height(12.dp))
            Text("This lesson hasn't been generated yet", fontWeight = FontWeight.Bold, textAlign = TextAlign.Center)
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                "Ollie is still preparing this lesson. Try going back and picking another one, or check your dashboard later.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center
            )
            Spacer(modifier = Modifier.height(20.dp))
            OutlinedButton(onClick = onBack) { Text("Back") }
        }
        return
    }

    if (!loadedStep || currentStep == null) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            CircularProgressIndicator()
        }
        return
    }

    // Loading / Error states for dynamic AI lesson
    if (isGeneratingLesson) {
        Box(
            modifier = Modifier.fillMaxSize().padding(24.dp),
            contentAlignment = Alignment.Center
        ) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                OllieMascot(tier = AcademicTier.EXPLORER, mood = OllieMood.THINKING, size = 90.dp)
                Text(
                    text = "Ollie is creating your ${currentStep.subjectName} lesson! 🎓",
                    fontWeight = FontWeight.ExtraBold,
                    fontSize = 18.sp,
                    textAlign = TextAlign.Center,
                    color = Color(0xFF1D4ED8)
                )
                Text(
                    text = "\"${currentStep.title}\"",
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 14.sp,
                    textAlign = TextAlign.Center,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                CircularProgressIndicator(color = Color(0xFF2563EB))
            }
        }
        return
    }

    if (lessonError != null || dynamicLesson == null) {
        Column(
            modifier = Modifier.fillMaxSize().padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            OllieMascot(tier = AcademicTier.EXPLORER, mood = OllieMood.THINKING, size = 80.dp)
            Spacer(modifier = Modifier.height(16.dp))
            Text(
                text = "Lesson Generation Failed",
                fontWeight = FontWeight.ExtraBold,
                fontSize = 20.sp,
                color = Color(0xFFDC2626)
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = lessonError ?: "Ollie couldn't prepare this lesson right now.",
                textAlign = TextAlign.Center,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(modifier = Modifier.height(20.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedButton(onClick = onBack) { Text("Go Back") }
                Button(
                    onClick = { loadLessonContent(currentStep) },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF2563EB))
                ) {
                    Text("Retry Generation 🔄")
                }
            }
        }
        return
    }

    val lesson = dynamicLesson!!
    val questions = lesson.questions
    val paragraphs = lesson.paragraphs
    val tips = lesson.tips
    val vocabWords = lesson.vocabWords

    fun finishCheck() {
        stopSpeaking()
        val correct = answers.filterNotNull().zip(questions).count { (a, q) -> a == q.correctIndex }
        resultCorrect = correct
        if (correct >= 2 && !completed) {
            completed = true
            scope.launch { repository.completeRoadmapStep(currentStep.id) }
            TactileSoundSystem.playCelebrationBeep()
        } else if (correct < 2) {
            TactileSoundSystem.playPopSound()
        }
        phase = LearnItPhase.RESULT
    }

    val guidePrefs = remember { context.getSharedPreferences("studdyhub_task_guide_prefs", android.content.Context.MODE_PRIVATE) }
    var showTaskGuide by remember {
        mutableStateOf(!guidePrefs.getBoolean("has_seen_lesson_guide", false))
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(
                            text = if (phase == LearnItPhase.RESULT) "Lesson Completed! 🎉" else currentStep.title,
                            fontWeight = FontWeight.ExtraBold,
                            fontSize = 18.sp
                        )
                        Text(
                            text = "${currentStep.subjectName} · Week ${currentStep.week}",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                },
                navigationIcon = {
                    IconButton(onClick = {
                        stopSpeaking()
                        onBack()
                    }) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    // Interactive Guide Button
                    IconButton(
                        onClick = {
                            TactileSoundSystem.playPopSound()
                            showTaskGuide = true
                        }
                    ) {
                        Icon(
                            Icons.Default.Lightbulb,
                            contentDescription = "UI Tour Guide",
                            tint = Color(0xFFD97706)
                        )
                    }

                    // Turtle Slow Mode Switch
                    if (phase == LearnItPhase.LESSON) {
                        IconButton(
                            onClick = {
                                stopSpeaking()
                                loadLessonContent(currentStep, forceRegenerate = true)
                            }
                        ) {
                            Icon(
                                Icons.Default.Refresh,
                                contentDescription = "Regenerate Lesson",
                                tint = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }

                        Surface(
                            shape = RoundedCornerShape(12.dp),
                            color = if (isTurtleSpeed) Color(0xFFFEF3C7) else Color(0xFFF1F5F9),
                            border = BorderStroke(1.dp, if (isTurtleSpeed) Color(0xFFD97706) else Color(0xFFCBD5E1)),
                            modifier = Modifier
                                .padding(end = 8.dp)
                                .tactileClick(onClick = {
                                    isTurtleSpeed = !isTurtleSpeed
                                    TactileSoundSystem.playPopSound()
                                })
                        ) {
                            Row(
                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(4.dp)
                            ) {
                                Text(if (isTurtleSpeed) "🐢 Slow" else "🐇 Fast", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            )
        }
    ) { innerPadding ->
        Box(modifier = Modifier.fillMaxSize()) {
            when (phase) {
                LearnItPhase.LESSON -> LessonPhase(
                    paragraphs = paragraphs,
                    tips = tips,
                    vocabWords = vocabWords,
                    subjectName = currentStep.subjectName,
                    xpReward = currentStep.xpReward,
                    isSpeaking = isSpeaking,
                    activeSpeakingText = activeSpeakingText,
                    onSpeak = { speakText(it) },
                    onStopSpeak = { stopSpeaking() },
                    onStart = {
                        stopSpeaking()
                        phase = LearnItPhase.CHECK
                    },
                    innerPadding = innerPadding
                )
                LearnItPhase.CHECK -> CheckPhase(
                    questions = questions,
                    answers = answers,
                    isSpeaking = isSpeaking,
                    activeSpeakingText = activeSpeakingText,
                    onSpeak = { speakText(it) },
                    onAnswer = { qIndex, optIndex ->
                        val copy = answers.toMutableList()
                        while (copy.size <= qIndex) copy.add(null)
                        copy[qIndex] = optIndex
                        answers = copy
                    },
                    onFinish = { finishCheck() },
                    innerPadding = innerPadding
                )
                LearnItPhase.RESULT -> ResultPhase(
                    correct = resultCorrect,
                    total = questions.size,
                    xpReward = currentStep.xpReward,
                    passed = resultCorrect >= 2,
                    onBackToPath = onBack,
                    onRetry = {
                        answers = emptyList()
                        phase = LearnItPhase.CHECK
                    },
                    onOpenGame = {
                        onOpenGame(currentStep.refId ?: "maths_quest")
                    },
                    hasGameRef = !currentStep.refId.isNullOrBlank(),
                    innerPadding = innerPadding
                )
            }

            // Interactive Spotlight Walkthrough with Professor Ollie
            if (showTaskGuide) {
                TaskInteractiveGuideOverlay(
                    steps = DEFAULT_LESSON_GUIDE_STEPS,
                    onDismiss = {
                        showTaskGuide = false
                        guidePrefs.edit().putBoolean("has_seen_lesson_guide", true).apply()
                    }
                )
            }
        }
    }
}

@Composable
private fun LessonPhase(
    paragraphs: List<String>,
    tips: List<String>,
    vocabWords: List<String>,
    subjectName: String,
    xpReward: Int,
    isSpeaking: Boolean,
    activeSpeakingText: String?,
    onSpeak: (String) -> Unit,
    onStopSpeak: () -> Unit,
    onStart: () -> Unit,
    innerPadding: PaddingValues
) {
    val allParagraphsCombined = remember(paragraphs) { paragraphs.joinToString(" ") }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(innerPadding)
            .padding(horizontal = 16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
        contentPadding = PaddingValues(top = 8.dp, bottom = 32.dp)
    ) {
        // Hero Ollie Card with 1-Tap Read Entire Lesson Button
        item {
            Tactile3DCard(
                onClick = {},
                containerColor = Color(0xFFDEF0FD),
                bevelColor = Color(0xFFBAE6FD),
                cornerRadius = 24.dp,
                elevationDepth = 4.dp,
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.fillMaxWidth().padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(14.dp)
                    ) {
                        OllieMascot(tier = AcademicTier.EXPLORER, mood = OllieMood.STUDYING, size = 60.dp)
                        Column(modifier = Modifier.weight(1f)) {
                            Text("Ollie's AI Read-Aloud Lesson 📖", fontWeight = FontWeight.ExtraBold, color = Color(0xFF1D4ED8), fontSize = 15.sp)
                            Text("$subjectName · Tap any text to hear it pronounced!", style = MaterialTheme.typography.bodySmall, color = Color(0xFF475569))
                        }
                    }

                    // 1-Tap Audio Read All Banner
                    Surface(
                        shape = RoundedCornerShape(14.dp),
                        color = if (isSpeaking && activeSpeakingText == allParagraphsCombined) Color(0xFFEF4444) else Color(0xFF2563EB),
                        modifier = Modifier
                            .fillMaxWidth()
                            .tactileClick(onClick = {
                                if (isSpeaking && activeSpeakingText == allParagraphsCombined) {
                                    onStopSpeak()
                                } else {
                                    onSpeak(allParagraphsCombined)
                                }
                            })
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 16.dp, vertical = 10.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.Center
                        ) {
                            Icon(
                                imageVector = if (isSpeaking && activeSpeakingText == allParagraphsCombined) Icons.Default.Pause else Icons.AutoMirrored.Filled.VolumeUp,
                                contentDescription = "Read Aloud",
                                tint = Color.White,
                                modifier = Modifier.size(20.dp)
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = if (isSpeaking && activeSpeakingText == allParagraphsCombined) "Pause Reading ⏸️" else "Read Entire Lesson Aloud 🔊",
                                fontWeight = FontWeight.ExtraBold,
                                color = Color.White,
                                fontSize = 13.sp
                            )
                        }
                    }
                }
            }
        }

        // Tap-to-Hear Vocabulary Pills
        if (vocabWords.isNotEmpty()) {
            item {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        text = "Tap to Pronounce Words 🗣️",
                        style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.ExtraBold, color = Color(0xFF1E293B))
                    )
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        vocabWords.forEach { word ->
                            val isWordSpeaking = isSpeaking && activeSpeakingText == word
                            val chipBg by animateColorAsState(if (isWordSpeaking) Color(0xFFFFD700) else Color(0xFFF1F5F9), label = "word_chip")
                            Surface(
                                shape = RoundedCornerShape(14.dp),
                                color = chipBg,
                                border = BorderStroke(1.dp, if (isWordSpeaking) Color(0xFFD97706) else Color(0xFFCBD5E1)),
                                modifier = Modifier.tactileClick(onClick = { onSpeak(word) })
                            ) {
                                Row(
                                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                                ) {
                                    Text("🔊", fontSize = 11.sp)
                                    Text(
                                        text = word,
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 12.sp,
                                        color = if (isWordSpeaking) Color(0xFF78350F) else Color(0xFF1E293B)
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }

        // Interactive Paragraph Cards with Karaoke Highlighter
        paragraphs.forEachIndexed { idx, para ->
            item {
                val isParaSpeaking = isSpeaking && (activeSpeakingText == para || activeSpeakingText == allParagraphsCombined)
                val cardBg by animateColorAsState(if (isParaSpeaking) Color(0xFFFEF3C7) else Color.White, label = "para_bg")
                val borderColor by animateColorAsState(if (isParaSpeaking) Color(0xFFF59E0B) else Color(0xFFE2E8F0), label = "para_border")

                Tactile3DCard(
                    onClick = { onSpeak(para) },
                    containerColor = cardBg,
                    bevelColor = borderColor,
                    cornerRadius = 20.dp,
                    elevationDepth = if (isParaSpeaking) 5.dp else 3.dp,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        verticalAlignment = Alignment.Top,
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Surface(
                            shape = CircleShape,
                            color = if (isParaSpeaking) Color(0xFFFF7A00) else Color(0xFF1D4ED8).copy(alpha = 0.12f),
                            modifier = Modifier.size(36.dp)
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                Text(
                                    text = if (isParaSpeaking) "🔊" else "${idx + 1}",
                                    fontWeight = FontWeight.ExtraBold,
                                    fontSize = 13.sp,
                                    color = if (isParaSpeaking) Color.White else Color(0xFF1D4ED8)
                                )
                            }
                        }
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = para,
                                style = MaterialTheme.typography.bodyLarge.copy(
                                    lineHeight = 24.sp,
                                    fontWeight = if (isParaSpeaking) FontWeight.SemiBold else FontWeight.Normal
                                ),
                                color = if (isParaSpeaking) Color(0xFF78350F) else Color(0xFF1E293B)
                            )
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = if (isParaSpeaking) "Speaking now... Tap to pause ⏸️" else "Tap paragraph to read aloud 🔊",
                                style = MaterialTheme.typography.labelSmall,
                                color = if (isParaSpeaking) Color(0xFFB45309) else Color(0xFF94A3B8)
                            )
                        }
                    }
                }
            }
        }

        // Ollie's Tips Card
        if (tips.isNotEmpty()) {
            item {
                Tactile3DCard(
                    onClick = {},
                    containerColor = Color(0xFFFEF3C7),
                    bevelColor = Color(0xFFFDE68A),
                    cornerRadius = 20.dp,
                    elevationDepth = 3.dp,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text("Ollie's Smart Tips 💡", fontWeight = FontWeight.ExtraBold, color = Color(0xFFB45309))
                            Surface(
                                shape = RoundedCornerShape(10.dp),
                                color = Color(0xFFF59E0B),
                                modifier = Modifier.tactileClick(onClick = {
                                    onSpeak(tips.joinToString(". "))
                                })
                            ) {
                                Text(
                                    text = "Listen 🔊",
                                    style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.ExtraBold, color = Color.White),
                                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                                )
                            }
                        }
                        tips.forEach { tip ->
                            Row(
                                verticalAlignment = Alignment.Top,
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .tactileClick(onClick = { onSpeak(tip) })
                            ) {
                                Text("•  ", fontWeight = FontWeight.Bold, color = Color(0xFFB45309))
                                Text(tip, style = MaterialTheme.typography.bodyMedium, color = Color(0xFF78350F))
                            }
                        }
                    }
                }
            }
        }

        // Bottom Action Button
        item {
            Tactile3DButton(
                text = "Start Practice Check ✍️ (+${xpReward} XP)",
                onClick = onStart,
                containerColor = Color(0xFF10B981),
                bevelColor = Color(0xFF047857),
                modifier = Modifier.fillMaxWidth().height(56.dp)
            )
            Spacer(modifier = Modifier.height(16.dp))
        }
    }
}

@Composable
private fun CheckPhase(
    questions: List<LessonCheckQuestion>,
    answers: List<Int?>,
    isSpeaking: Boolean,
    activeSpeakingText: String?,
    onSpeak: (String) -> Unit,
    onAnswer: (Int, Int) -> Unit,
    onFinish: () -> Unit,
    innerPadding: PaddingValues
) {
    var currentIndex by remember { mutableIntStateOf(0) }
    var score by remember { mutableIntStateOf(0) }
    var starsEarned by remember { mutableIntStateOf(0) }
    var comboCount by remember { mutableIntStateOf(0) }
    var lives by remember { mutableIntStateOf(3) }
    var hiddenOptions by remember { mutableStateOf(setOf<Int>()) }
    var selectedIndex by remember { mutableStateOf<Int?>(null) }
    var isAnswered by remember { mutableStateOf(false) }
    var isFinished by remember { mutableStateOf(false) }

    val coroutineScope = rememberCoroutineScope()
    val currentQ = questions.getOrNull(currentIndex)

    val multiplier = when {
        comboCount >= 4 -> 4
        comboCount >= 2 -> 2
        else -> 1
    }

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
        if (isAnswered || lives <= 0 || currentQ == null) return
        isAnswered = true
        selectedIndex = idx
        onAnswer(currentIndex, idx)
        val isCorrect = idx == currentQ.correctIndex

        if (isCorrect) {
            score++
            comboCount++
            val pts = 20 * multiplier
            starsEarned += pts
            TactileSoundSystem.playCorrectSound()
        } else {
            comboCount = 0
            lives = (lives - 1).coerceAtLeast(0)
            TactileSoundSystem.playWrongSound()
        }

        coroutineScope.launch {
            delay(if (isCorrect) 800L else 1400L)
            if (lives <= 0 || currentIndex + 1 >= questions.size) {
                isFinished = true
                // Small delay to ensure all answer state propagates
                delay(100L)
                onFinish()
            } else {
                currentIndex++
                isAnswered = false
                selectedIndex = null
                hiddenOptions = emptySet()
            }
        }
    }

    if (isFinished) {
        // Show result via the parent's ResultPhase
        return
    }

    // 🎮 Gamified dark space arena background matching ExplorerQuizRunnerScreen
    Box(
        modifier = Modifier
            .fillMaxSize()
            .padding(innerPadding)
            .background(
                Brush.verticalGradient(
                    listOf(Color(0xFF1E1B4B), Color(0xFF312E81), Color(0xFF1E3A8A))
                )
            )
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 18.dp, vertical = 10.dp),
            verticalArrangement = Arrangement.SpaceBetween
        ) {
            // ── Top HUD: Lives, Combo, Stars ──
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Lives Hearts
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

            // ── Progress Bar ──
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

            // ── 3D Question Card ──
            Tactile3DCard(
                onClick = {
                    if (currentQ != null) {
                        val fullRead = "${currentQ.question}. Options are: " + currentQ.options.joinToString(", ")
                        onSpeak(fullRead)
                    }
                },
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

            // ── Power-Up Bar (50/50 & Read Aloud) ──
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
                Tactile3DButton(
                    text = "🔊 Read",
                    onClick = {
                        if (currentQ != null) {
                            val fullRead = "${currentQ.question}. Options are: " + currentQ.options.joinToString(", ")
                            onSpeak(fullRead)
                        }
                    },
                    containerColor = Color(0xFF2563EB),
                    bevelColor = Color(0xFF1D4ED8),
                    modifier = Modifier.weight(1f)
                )
            }

            // ── Wrong Answer Explanation Banner ──
            if (isAnswered && selectedIndex != currentQ?.correctIndex && currentQ?.explanation?.isNotBlank() == true) {
                Surface(
                    shape = RoundedCornerShape(16.dp),
                    color = Color(0xFFFFF3CD).copy(alpha = 0.15f),
                    border = BorderStroke(1.dp, Color(0xFFFFD700).copy(alpha = 0.4f)),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier.padding(12.dp),
                        verticalAlignment = Alignment.Top,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Text("💡", fontSize = 16.sp)
                        Text(
                            text = currentQ!!.explanation,
                            style = MaterialTheme.typography.bodySmall.copy(
                                color = Color(0xFFFEF3C7),
                                fontWeight = FontWeight.Medium,
                                lineHeight = 18.sp
                            )
                        )
                    }
                }
            }

            // ── 4 Chunky 3D Kahoot-style Answer Buttons ──
            val buttonThemes = listOf(
                Triple(Color(0xFFEF4444), Color(0xFFB91C1C), "▲"),
                Triple(Color(0xFF3B82F6), Color(0xFF1D4ED8), "◆"),
                Triple(Color(0xFFF59E0B), Color(0xFFB45309), "●"),
                Triple(Color(0xFF10B981), Color(0xFF047857), "■")
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
                            val isCorrect = optIndex == (currentQ?.correctIndex ?: -1)

                            val buttonColor = when {
                                isAnswered && isCorrect -> Color(0xFF22C55E)
                                isAnswered && isChosen -> Color(0xFFEF4444)
                                else -> theme.first
                            }
                            val btnBevelColor = when {
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
                                    bevelColor = btnBevelColor,
                                    cornerRadius = 20.dp,
                                    elevationDepth = 6.dp,
                                    enabled = !isAnswered,
                                    modifier = Modifier.weight(1f)
                                ) {
                                    Column(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .padding(horizontal = 12.dp, vertical = 18.dp),
                                        horizontalAlignment = Alignment.CenterHorizontally,
                                        verticalArrangement = Arrangement.Center
                                    ) {
                                        Text(
                                            text = theme.third,
                                            fontSize = 16.sp,
                                            color = Color.White.copy(alpha = 0.7f)
                                        )
                                        Spacer(modifier = Modifier.height(4.dp))
                                        Text(
                                            text = option,
                                            style = MaterialTheme.typography.titleMedium.copy(
                                                fontWeight = FontWeight.ExtraBold,
                                                color = Color.White,
                                                fontSize = 14.sp
                                            ),
                                            textAlign = TextAlign.Center,
                                            maxLines = 2
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(8.dp))
        }
    }
}

@Composable
private fun ResultPhase(
    correct: Int,
    total: Int,
    xpReward: Int,
    passed: Boolean,
    onBackToPath: () -> Unit,
    onRetry: () -> Unit,
    onOpenGame: () -> Unit,
    hasGameRef: Boolean,
    innerPadding: PaddingValues
) {
    val starRating = when {
        total > 0 && (correct * 100) / total >= 80 -> 3
        total > 0 && (correct * 100) / total >= 50 -> 2
        else -> 1
    }

    // 🏆 Gamified Celebration Arena (matches ExplorerQuizRunnerScreen)
    Box(
        modifier = Modifier
            .fillMaxSize()
            .padding(innerPadding)
            .background(
                Brush.verticalGradient(
                    colors = listOf(Color(0xFF1E1B4B), Color(0xFF0F172A), Color(0xFF020617))
                )
            ),
        contentAlignment = Alignment.Center
    ) {
        // Floating celebration particles
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
                // Top Performer Pedestal
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
                    text = if (passed) "🏆 LESSON MASTERED!" else "💪 GOOD TRY!",
                    style = MaterialTheme.typography.headlineSmall.copy(
                        fontWeight = FontWeight.ExtraBold,
                        color = Color.White
                    ),
                    textAlign = TextAlign.Center
                )

                // Stars
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

                // Stats Row
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
                                "$correct / $total",
                                style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.ExtraBold, color = Color.White)
                            )
                            Text("Correct", color = Color.White.copy(alpha = 0.7f), fontSize = 12.sp)
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
                                "+$xpReward 🪙",
                                style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.ExtraBold, color = Color(0xFFFFD700))
                            )
                            Text("Coins Earned", color = Color.White.copy(alpha = 0.7f), fontSize = 12.sp)
                        }
                    }
                }

                Spacer(modifier = Modifier.height(4.dp))

                // Action Buttons
                Column(
                    modifier = Modifier.fillMaxWidth(),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    if (hasGameRef) {
                        Tactile3DButton(
                            text = "Play Practice Game 🎮",
                            onClick = onOpenGame,
                            containerColor = Color(0xFF8B5CF6),
                            bevelColor = Color(0xFF7C3AED),
                            modifier = Modifier.fillMaxWidth().height(52.dp)
                        )
                    }
                    Tactile3DButton(
                        text = "CONTINUE JOURNEY 🚀",
                        onClick = onBackToPath,
                        containerColor = Color(0xFFFF7A00),
                        bevelColor = Color(0xFFC45500),
                        modifier = Modifier.fillMaxWidth().height(52.dp)
                    )
                    if (!passed) {
                        TextButton(
                            onClick = onRetry,
                            modifier = Modifier.fillMaxWidth().height(48.dp)
                        ) {
                            Text("Try Again 🔁", color = Color.White.copy(alpha = 0.85f), fontWeight = FontWeight.Bold, fontSize = 15.sp)
                        }
                    }
                }
            }
        }
    }
}
