package com.example.ui.screens.quizzes

import android.speech.tts.TextToSpeech
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.filled.VolumeUp
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.ui.components.OllieMascot
import com.example.ui.components.OllieMood
import com.example.ui.components.Tactile3DButton
import com.example.ui.components.Tactile3DCard
import com.example.ui.components.TactileSoundSystem
import com.example.ui.components.tactileClick
import com.example.ui.theme.AcademicTier
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.util.Locale
import java.util.UUID

private const val SECONDS_PER_WORD = 30

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun SpellingBeeScreen(
    level: Int,
    viewModel: QuizzesViewModel,
    onBack: () -> Unit = {}
) {
    val context = LocalContext.current
    val view = LocalView.current
    val game = EXPLORER_GAMES["spelling_bee"]!!
    // Words are generated LIVE from the AI pipeline — the bundled spelling bank is muted so a
    // failing backend surfaces its real error instead of silently loading seeded words.
    var wordsState by remember(level) { mutableStateOf<List<SpellingWordItem>?>(null) }
    var wordsError by remember(level) { mutableStateOf<String?>(null) }
    var retryKey by remember(level) { mutableIntStateOf(0) }
    LaunchedEffect(level, retryKey) {
        wordsState = null
        wordsError = null
        val result = viewModel.generateSpellingWords(level)
        wordsState = result.words
        wordsError = result.errorMessage
    }
    val words = wordsState.orEmpty()
    val coroutineScope = rememberCoroutineScope()

    var currentIndex by remember { mutableStateOf(0) }
    var built by remember { mutableStateOf<List<Char>>(emptyList()) }
    var tiles by remember { mutableStateOf<List<Char>>(emptyList()) }
    var status by remember { mutableStateOf<SpellingStatus>(SpellingStatus.PLAYING) } // playing / correct / wrong
    var secondsLeft by remember { mutableIntStateOf(SECONDS_PER_WORD) }
    var correctCount by remember { mutableStateOf(0) }
    var finished by remember { mutableStateOf(false) }
    var recorded by remember { mutableStateOf(false) }
    var repeatHint by remember { mutableStateOf(false) }

    // TTS instance (Ollie's voice). Initialised once, shut down with the screen.
    val tts = remember {
        object {
            var ready = false
            var engine: TextToSpeech? = null
        }
    }
    DisposableEffect(context) {
        var created: TextToSpeech? = null
        val engine = TextToSpeech(context) { status ->
            if (status == TextToSpeech.SUCCESS) {
                val e = created
                if (e != null) {
                    tts.engine = e
                    tts.ready = e.setLanguage(Locale.US) != TextToSpeech.LANG_MISSING_DATA
                    com.example.data.local.TtsSettings.applyTo(e)
                }
            }
        }
        created = engine
        tts.engine = engine
        onDispose {
            engine.stop()
            engine.shutdown()
        }
    }

    fun speak(text: String, slow: Boolean = false) {
        val engine = tts.engine ?: return
        if (tts.ready) {
            // Apply speed from Settings; for spelling clarity, apply a measured cadence
            val baseRate = com.example.data.local.TtsSettings.speechRate
            val effectiveRate = if (slow) {
                (baseRate * 0.65f).coerceIn(0.45f, 0.95f)
            } else {
                (baseRate * 0.85f).coerceIn(0.55f, 1.25f)
            }
            com.example.data.local.TtsSettings.applyTo(engine, rate = effectiveRate)
            engine.speak(text, TextToSpeech.QUEUE_FLUSH, null, "bee_" + UUID.randomUUID())
        }
    }

    val currentWord = words.getOrNull(currentIndex)?.word ?: ""

    // Reset the round when a new word appears.
    LaunchedEffect(currentIndex, words.size) {
        val word = words.getOrNull(currentIndex)?.word
        if (word != null && word.isNotBlank()) {
            built = emptyList()
            tiles = word.toList().shuffled()
            status = SpellingStatus.PLAYING
            secondsLeft = SECONDS_PER_WORD
            repeatHint = false
        }
    }

    // Auto-speak each new word once with clear sentence prompt.
    LaunchedEffect(currentIndex, words.size) {
        val wordItem = words.getOrNull(currentIndex)
        if (wordItem != null && wordItem.word.isNotBlank()) {
            delay(350)
            val prompt = if (wordItem.sentence.isNotBlank()) {
                "${wordItem.word}. ${wordItem.sentence}. Spell ${wordItem.word}."
            } else {
                "${wordItem.word}. Spell ${wordItem.word}."
            }
            speak(prompt)
        }
    }

    // Per-word countdown.
    LaunchedEffect(currentIndex, status) {
        while (status == SpellingStatus.PLAYING && secondsLeft > 0) {
            delay(1000)
            if (status == SpellingStatus.PLAYING) secondsLeft--
        }
        if (status == SpellingStatus.PLAYING && secondsLeft == 0) {
            status = SpellingStatus.WRONG
            TactileSoundSystem.playWrongSound()
            // Auto-reset after timeout so user can retry the same word
            coroutineScope.launch {
                delay(2500)
                if (status == SpellingStatus.WRONG) {
                    built = emptyList()
                    status = SpellingStatus.PLAYING
                    secondsLeft = SECONDS_PER_WORD
                }
            }
        }
    }

    fun markCorrect() {
        correctCount++
        status = SpellingStatus.CORRECT
        TactileSoundSystem.playCorrectSound()
        TactileSoundSystem.playCoinSound()
        coroutineScope.launch {
            delay(1200)
            if (currentIndex + 1 < words.size) {
                currentIndex++
            } else {
                finished = true
            }
        }
    }

    fun markWrong() {
        status = SpellingStatus.WRONG
        TactileSoundSystem.playWrongSound()
        // Auto-reset after 2.5s so the user can try again without getting stuck
        coroutineScope.launch {
            delay(2500)
            if (status == SpellingStatus.WRONG) {
                built = emptyList()
                status = SpellingStatus.PLAYING
                secondsLeft = (secondsLeft).coerceAtLeast(5) // give at least 5s back
            }
        }
    }

    fun checkAnswer() {
        if (status != SpellingStatus.PLAYING) return
        if (built.isEmpty()) return
        if (built.joinToString("") == currentWord.lowercase()) {
            markCorrect()
        } else {
            markWrong()
        }
    }

    // Record the level result exactly once when the level completes.
    LaunchedEffect(finished) {
        if (finished && !recorded) {
            recorded = true
            viewModel.recordSpellingResult(game.key, game.title, level, correctCount, words.size)
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("🐝 Spelling Bee", fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                }
            )
        }
    ) { innerPadding ->
        // Loading — Ollie is asking the AI for the level's words.
        if (wordsState == null && wordsError == null) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding)
                    .padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {
                Text("🐝", fontSize = 48.sp)
                Spacer(modifier = Modifier.height(12.dp))
                CircularProgressIndicator()
                Spacer(modifier = Modifier.height(12.dp))
                Text("Ollie is picking words for this level…", fontWeight = FontWeight.Bold, textAlign = TextAlign.Center)
            }
            return@Scaffold
        }

        // Backend/AI failure — surface the real error instead of silently using seeded words.
        if (wordsError != null) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding)
                    .padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {
                Text("🐝", fontSize = 48.sp)
                Spacer(modifier = Modifier.height(12.dp))
                Text("Ollie couldn't prepare this level", fontWeight = FontWeight.Bold, textAlign = TextAlign.Center)
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = wordsError ?: "Please try again.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = TextAlign.Center
                )
                Spacer(modifier = Modifier.height(16.dp))
                Button(
                    onClick = { retryKey++ },
                    shape = RoundedCornerShape(14.dp)
                ) { Text("Try Again 🔄", fontWeight = FontWeight.Bold) }
                Spacer(modifier = Modifier.height(8.dp))
                OutlinedButton(onClick = onBack, shape = RoundedCornerShape(14.dp)) { Text("Back") }
            }
            return@Scaffold
        }

        if (words.isEmpty()) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding)
                    .padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {
                Text("🐝", fontSize = 48.sp)
                Spacer(modifier = Modifier.height(12.dp))
                Text("No words for this level yet!", fontWeight = FontWeight.Bold)
                Text("Ollie is adding more words. Try another level.", textAlign = TextAlign.Center)
                Spacer(modifier = Modifier.height(16.dp))
                Button(onClick = onBack) { Text("Back") }
            }
            return@Scaffold
        }

        if (finished) {
            SpellingBeeResult(
                correct = correctCount,
                total = words.size,
                level = level,
                gameTitle = game.title,
                onBack = onBack,
                onReplay = {
                    recorded = false
                    finished = false
                    currentIndex = 0
                    correctCount = 0
                }
            )
            return@Scaffold
        }

        val word = words[currentIndex]

        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .padding(horizontal = 20.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            item {
                // Progress + timer row
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "Word ${currentIndex + 1} of ${words.size}",
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Surface(
                        shape = RoundedCornerShape(12.dp),
                        color = if (secondsLeft <= 10) Color(0xFFFEE2E2) else Color(0xFFFEF3C7)
                    ) {
                        Text(
                            text = "⏱ $secondsLeft",
                            fontWeight = FontWeight.Bold,
                            color = if (secondsLeft <= 10) Color(0xFFDC2626) else Color(0xFFB45309),
                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                        )
                    }
                }
            }

            item {
                // Ollie + Listen
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(24.dp),
                    colors = CardDefaults.cardColors(containerColor = game.bgLightColor),
                    border = BorderStroke(1.5.dp, game.primaryColor.copy(alpha = 0.3f))
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
                            mood = when (status) {
                                SpellingStatus.CORRECT -> OllieMood.CELEBRATING
                                SpellingStatus.WRONG -> OllieMood.THINKING
                                else -> OllieMood.GREETING
                            },
                            size = 64.dp
                        )
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = when (status) {
                                    SpellingStatus.CORRECT -> "Brilliant! 🎉"
                                    SpellingStatus.WRONG -> "Not quite — try again!"
                                    else -> if (repeatHint) "Tap the speaker to hear it again" else "Listen to the word"
                                },
                                fontWeight = FontWeight.Bold,
                                color = game.primaryColor
                            )
                            Text(
                                text = if (status == SpellingStatus.WRONG) "Correct spelling: ${word.word.uppercase()}" else word.definition,
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)
                            )
                        }
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                            // Slow pronunciation button
                            Surface(
                                shape = RoundedCornerShape(14.dp),
                                color = game.primaryColor.copy(alpha = 0.15f),
                                modifier = Modifier
                                    .size(48.dp)
                                    .tactileClick(onClick = {
                                        speak(word.word, slow = true)
                                    })
                            ) {
                                Box(contentAlignment = Alignment.Center) {
                                    Text("🐢", fontSize = 20.sp)
                                }
                            }
                            // Regular pronunciation & sentence button
                            Surface(
                                shape = RoundedCornerShape(14.dp),
                                color = game.primaryColor,
                                modifier = Modifier
                                    .size(48.dp)
                                    .tactileClick(onClick = {
                                        val phrase = if (word.sentence.isNotBlank()) "${word.word}. ${word.sentence}" else word.word
                                        speak(phrase, slow = false)
                                    })
                            ) {
                                Box(contentAlignment = Alignment.Center) {
                                    Icon(Icons.Default.VolumeUp, contentDescription = "Listen", tint = Color.White)
                                }
                            }
                        }
                    }
                }
            }

            item {
                // Built word tiles / Slot boxes with clear placeholders
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.Center,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    (0 until maxOf(word.word.length, built.size.coerceAtLeast(1))).forEach { i ->
                        val char = built.getOrNull(i)
                        val isFilled = char != null
                        Box(
                            modifier = Modifier
                                .padding(3.dp)
                                .size(44.dp)
                                .clip(RoundedCornerShape(12.dp))
                                .background(
                                    when {
                                        isFilled && status == SpellingStatus.CORRECT -> Color(0xFFD1FAE5)
                                        status == SpellingStatus.WRONG -> Color(0xFFFEE2E2)
                                        isFilled -> MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.6f)
                                        else -> MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.35f)
                                    },
                                    RoundedCornerShape(12.dp)
                                )
                                .border(
                                    width = if (isFilled) 2.dp else 1.5.dp,
                                    color = when {
                                        isFilled && status == SpellingStatus.CORRECT -> Color(0xFF10B981)
                                        status == SpellingStatus.WRONG -> Color(0xFFEF4444)
                                        isFilled -> game.primaryColor
                                        else -> game.primaryColor.copy(alpha = 0.35f)
                                    },
                                    shape = RoundedCornerShape(12.dp)
                                )
                                .clickable(enabled = isFilled && status == SpellingStatus.PLAYING) {
                                    built = built.dropLast(built.size - i)
                                    TactileSoundSystem.playPopSound(view)
                                },
                            contentAlignment = Alignment.Center
                        ) {
                            if (isFilled) {
                                Text(
                                    text = char!!.uppercase(),
                                    style = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.Black),
                                    color = if (status == SpellingStatus.CORRECT) Color(0xFF065F46) else if (status == SpellingStatus.WRONG) Color(0xFF991B1B) else MaterialTheme.colorScheme.onPrimaryContainer
                                )
                            } else {
                                // Dashed placeholder to show expected word length
                                Box(
                                    modifier = Modifier
                                        .size(20.dp)
                                        .border(
                                            width = 2.dp,
                                            color = game.primaryColor.copy(alpha = 0.3f),
                                            shape = RoundedCornerShape(4.dp)
                                        )
                                )
                            }
                        }
                    }
                }
            }

            item {
                // Letter tiles
                FlowRow(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.Center
                ) {
                    tiles.forEach { letter ->
                        val used = built.count { it == letter }
                        val available = tiles.count { it == letter }
                        val disabled = used >= available || status != SpellingStatus.PLAYING
                        val tileModifier = if (disabled) {
                            Modifier.padding(4.dp).size(52.dp)
                        } else {
                            Modifier.padding(4.dp).size(52.dp).tactileClick(onClick = {
                                built = built + letter
                                TactileSoundSystem.playPopSound(view)
                            })
                        }
                        Surface(
                            shape = RoundedCornerShape(14.dp),
                            color = game.primaryColor.copy(alpha = if (disabled) 0.25f else 0.9f),
                            modifier = tileModifier
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                Text(
                                    text = letter.uppercase(),
                                    style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.ExtraBold),
                                    color = Color.White
                                )
                            }
                        }
                    }
                }
            }

            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    OutlinedButton(
                        onClick = {
                            built = emptyList()
                            repeatHint = true
                        },
                        modifier = Modifier.weight(1f).height(52.dp),
                        shape = RoundedCornerShape(14.dp)
                    ) { Text("Clear", fontWeight = FontWeight.Bold) }

                    Button(
                        onClick = { checkAnswer() },
                        enabled = status == SpellingStatus.PLAYING && built.isNotEmpty(),
                        modifier = Modifier.weight(2f).height(52.dp),
                        shape = RoundedCornerShape(14.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = game.primaryColor)
                    ) { Text("Check ✍️", fontWeight = FontWeight.Bold, fontSize = 16.sp) }
                }
            }

            item {
                Text(
                    text = "★ $correctCount correct so far",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f),
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth()
                )
                Spacer(modifier = Modifier.height(32.dp))
            }
        }
    }
}

private enum class SpellingStatus { PLAYING, CORRECT, WRONG }

@Composable
private fun SpellingBeeResult(
    correct: Int,
    total: Int,
    level: Int,
    gameTitle: String,
    onBack: () -> Unit,
    onReplay: () -> Unit
) {
    val percent = if (total > 0) (correct * 100) / total else 0
    val stars = starsForPercent(percent)

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
                // 3D Gold Trophy Pedestal
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
                    Text("🐝", fontSize = 48.sp)
                }

                Text(
                    text = "Level $level Complete!",
                    style = MaterialTheme.typography.headlineSmall.copy(
                        fontWeight = FontWeight.ExtraBold,
                        color = Color.White
                    ),
                    textAlign = TextAlign.Center
                )

                Text(
                    text = "$correct of $total words spelled correctly",
                    style = MaterialTheme.typography.bodyMedium,
                    color = Color.White.copy(alpha = 0.8f)
                )

                // 3 Big Stars
                Row(horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                    (1..3).forEach { s ->
                        Icon(
                            Icons.Default.Star,
                            contentDescription = null,
                            tint = if (s <= stars) Color(0xFFFFD700) else Color.White.copy(alpha = 0.2f),
                            modifier = Modifier.size(44.dp)
                        )
                    }
                }

                // XP Reward Card
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
                            text = "+${xpForLevel(level, percent)} 🪙",
                            style = MaterialTheme.typography.titleLarge.copy(
                                fontWeight = FontWeight.ExtraBold,
                                color = Color(0xFFFFD700)
                            )
                        )
                    }
                }

                Spacer(modifier = Modifier.height(8.dp))

                Tactile3DButton(
                    text = "PLAY AGAIN 🔄",
                    onClick = onReplay,
                    containerColor = Color(0xFFFF7A00),
                    bevelColor = Color(0xFFC45500),
                    modifier = Modifier.fillMaxWidth().height(52.dp)
                )

                TextButton(
                    onClick = onBack,
                    modifier = Modifier.height(48.dp)
                ) {
                    Text(
                        text = "Back to $gameTitle",
                        color = Color.White.copy(alpha = 0.85f),
                        fontWeight = FontWeight.Bold,
                        fontSize = 15.sp
                    )
                }
            }
        }
    }
}
