package com.example.ui.screens.flashcards

import android.speech.tts.TextToSpeech
import androidx.compose.animation.*
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import kotlinx.coroutines.launch
import androidx.compose.foundation.Image
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import com.example.R
import com.example.ui.theme.AmberWarm
import com.example.ui.theme.tierFlashcardTitle
import com.example.ui.theme.tierPrimary
import com.example.ui.theme.tierSecondary
import com.example.ui.theme.tierTertiary
import com.example.ui.components.ProfessorOllieLoader
import com.example.ui.components.studdyPressScale
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FlashcardsScreen(
    viewModel: FlashcardsViewModel,
    onNavigateToCreateFlow: () -> Unit = {},
    onBack: () -> Unit = {}
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val isAIGenerating by viewModel.isAIGenerating.collectAsStateWithLifecycle()
    val generationMessage by viewModel.generationMessage.collectAsStateWithLifecycle()

    var ttsEngine by remember { mutableStateOf<TextToSpeech?>(null) }
    var isSpeaking by remember { mutableStateOf(false) }

    DisposableEffect(context) {
        var ttsInstance: TextToSpeech? = null
        ttsInstance = TextToSpeech(context) { status ->
            if (status == TextToSpeech.SUCCESS) {
                ttsInstance?.let { com.example.data.local.TtsSettings.applyTo(it) }
            }
        }
        ttsEngine = ttsInstance
        onDispose {
            ttsInstance.stop()
            ttsInstance.shutdown()
        }
    }

    val snackbarHostState = remember { SnackbarHostState() }
    LaunchedEffect(state.userMessage) {
        state.userMessage?.let { msg ->
            snackbarHostState.showSnackbar(msg)
            viewModel.clearUserMessage()
        }
    }

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
                    Text(
                        tierFlashcardTitle(),
                        fontWeight = FontWeight.Bold,
                        style = MaterialTheme.typography.titleMedium,
                        maxLines = 1,
                        overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis
                    )
                },
                actions = {
                    IconButton(onClick = { viewModel.refreshFlashcards() }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Refresh Decks", tint = MaterialTheme.colorScheme.primary)
                    }
                    IconButton(onClick = onNavigateToCreateFlow) {
                        Icon(Icons.Default.Add, contentDescription = "Add Card")
                    }
                }
            )
        },
        // No FAB — the top-bar "+" is the add entry point, so the add button never
        // overlaps the review controls below the card.
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .padding(20.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.SpaceBetween
        ) {
            if (state.flashcards.isEmpty()) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        modifier = Modifier.padding(24.dp)
                    ) {
                        coil.compose.SubcomposeAsyncImage(
                            model = R.drawable.img_empty_flashcards,
                            contentDescription = "Empty Flashcards Art",
                            modifier = Modifier
                                .size(160.dp)
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
                                        imageVector = Icons.Default.Style,
                                        contentDescription = null,
                                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                                        modifier = Modifier.size(48.dp)
                                    )
                                }
                            }
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                        Text(
                            text = "No Flashcards in Deck Yet",
                            style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold)
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = "Create custom cards or let Ollie AI auto-generate active recall decks from your notes!",
                            style = MaterialTheme.typography.bodyMedium.copy(
                                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)
                            ),
                            textAlign = androidx.compose.ui.text.style.TextAlign.Center
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                        Button(
                            onClick = onNavigateToCreateFlow,
                            colors = ButtonDefaults.buttonColors(containerColor = tierPrimary()),
                            shape = RoundedCornerShape(12.dp)
                        ) {
                            Icon(Icons.Default.Style, contentDescription = null)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("Create First Flashcard Deck", fontWeight = FontWeight.Bold)
                        }
                    }
                }
            } else {
                val card = state.flashcards[state.currentCardIndex]

                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(
                        text = "Card ${state.currentCardIndex + 1} of ${state.flashcards.size}",
                        style = MaterialTheme.typography.labelLarge,
                        color = MaterialTheme.colorScheme.primary
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = "Category: ${card.category}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
                    )

                    Spacer(modifier = Modifier.height(24.dp))

                    // Next-review line — makes the spaced-repetition schedule visible and honest.
                    Text(
                        text = if (card.nextReviewAt <= System.currentTimeMillis())
                            "Due now — review ${card.reviewCount} completed"
                        else
                            "Next review: ${formatNextReview(card.nextReviewAt)} • ${card.reviewCount} reviews done",
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
                    )

                    Spacer(modifier = Modifier.height(12.dp))

                    // Swipeable + 3D-flipping card. Two faces crossfade at the 90°
                    // midpoint so the back never vanishes and never reads mirrored.
                    val rotation by animateFloatAsState(
                        targetValue = if (state.isFlipped) 180f else 0f,
                        animationSpec = tween(durationMillis = 450),
                        label = "cardFlip"
                    )
                    val swipeOffset = remember(card.id) { Animatable(0f) }
                    val scope = rememberCoroutineScope()

                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(300.dp)
                            .graphicsLayer {
                                translationX = swipeOffset.value
                                rotationY = rotation
                                cameraDistance = 12f * density
                            }
                            .pointerInput(card.id) {
                                detectHorizontalDragGestures(
                                    onDragEnd = {
                                        if (swipeOffset.value < -90f) {
                                            viewModel.nextCard()
                                        } else if (swipeOffset.value > 90f) {
                                            viewModel.prevCard()
                                        }
                                        scope.launch { swipeOffset.animateTo(0f, tween(180)) }
                                    },
                                    onDragCancel = {
                                        scope.launch { swipeOffset.animateTo(0f, tween(180)) }
                                    }
                                ) { change, dragAmount ->
                                    change.consume()
                                    scope.launch {
                                        swipeOffset.snapTo((swipeOffset.value + dragAmount).coerceIn(-240f, 240f))
                                    }
                                }
                            }
                    ) {
                        if (rotation <= 90f) {
                            FlashcardFace(
                                isBack = false,
                                label = "QUESTION",
                                body = card.front,
                                hint = card.hint.ifBlank { null },
                                isSpeaking = isSpeaking,
                                onSpeak = {
                                    if (isSpeaking) {
                                        ttsEngine?.stop()
                                        isSpeaking = false
                                    } else {
                                        ttsEngine?.let { engine ->
                                            isSpeaking = true
                                            scope.launch {
                                                com.example.data.local.TtsSettings.speakWithAiNarration(
                                                    tts = engine,
                                                    rawText = card.front,
                                                    utterancePrefix = "flashcard_front_${card.id}",
                                                    isKid = false,
                                                    onAllDone = { isSpeaking = false }
                                                )
                                            }
                                        }
                                    }
                                },
                                onFlip = { viewModel.flipCard() },
                                modifier = Modifier.fillMaxSize()
                            )
                        } else {
                            FlashcardFace(
                                isBack = true,
                                label = "ANSWER",
                                body = card.back,
                                hint = null,
                                isSpeaking = isSpeaking,
                                onSpeak = {
                                    if (isSpeaking) {
                                        ttsEngine?.stop()
                                        isSpeaking = false
                                    } else {
                                        ttsEngine?.let { engine ->
                                            isSpeaking = true
                                            scope.launch {
                                                com.example.data.local.TtsSettings.speakWithAiNarration(
                                                    tts = engine,
                                                    rawText = card.back,
                                                    utterancePrefix = "flashcard_back_${card.id}",
                                                    isKid = false,
                                                    onAllDone = { isSpeaking = false }
                                                )
                                            }
                                        }
                                    }
                                },
                                onFlip = { viewModel.flipCard() },
                                modifier = Modifier
                                    .fillMaxSize()
                                    .graphicsLayer { rotationY = 180f }
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = "Swipe left for the next card • tap to flip",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.45f)
                    )
                }

                // SRS Evaluation Buttons
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    OutlinedButton(
                        onClick = { viewModel.reviewCurrentCard(remembered = false) },
                        modifier = Modifier
                            .weight(1f)
                            .height(52.dp),
                        shape = RoundedCornerShape(14.dp),
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = MaterialTheme.colorScheme.error)
                    ) {
                        Icon(Icons.Default.Refresh, contentDescription = null)
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("Review Again")
                    }

                    Button(
                        onClick = { viewModel.reviewCurrentCard(remembered = true) },
                        modifier = Modifier
                            .weight(1f)
                            .height(52.dp),
                        shape = RoundedCornerShape(14.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = tierSecondary())
                    ) {
                        Icon(Icons.Default.Check, contentDescription = null)
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("Got It (+1 Day)")
                    }
                }
            }
            if (isAIGenerating) {
                ProfessorOllieLoader(message = generationMessage)
            }
        }
    }
    }
}

@Composable
private fun FlashcardFace(
    isBack: Boolean,
    label: String,
    body: String,
    hint: String?,
    isSpeaking: Boolean = false,
    onSpeak: (() -> Unit)? = null,
    onFlip: () -> Unit,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier
            .studdyPressScale()
            .clickable(onClick = onFlip),
        shape = RoundedCornerShape(24.dp),
        colors = CardDefaults.cardColors(
            containerColor = if (isBack)
                tierTertiary().copy(alpha = 0.14f)
            else
                tierPrimary().copy(alpha = 0.10f)
        ),
        border = androidx.compose.foundation.BorderStroke(
            1.dp,
            (if (isBack) tierTertiary() else tierPrimary()).copy(alpha = 0.25f)
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 6.dp)
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(24.dp)
        ) {
            // Top action row (Label pill + optional Speak icon)
            Row(
                modifier = Modifier.fillMaxWidth().align(Alignment.TopCenter),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Surface(
                    shape = RoundedCornerShape(20.dp),
                    color = if (isBack) tierTertiary() else tierPrimary()
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                    ) {
                        Icon(
                            imageVector = if (isBack) Icons.Default.CheckCircle else Icons.Default.Help,
                            contentDescription = null,
                            tint = Color.White,
                            modifier = Modifier.size(12.dp)
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            text = label,
                            style = MaterialTheme.typography.labelSmall.copy(
                                color = Color.White,
                                fontWeight = FontWeight.Bold,
                                letterSpacing = 1.sp
                            )
                        )
                    }
                }

                if (onSpeak != null) {
                    IconButton(
                        onClick = onSpeak,
                        modifier = Modifier.size(36.dp)
                    ) {
                        Icon(
                            imageVector = if (isSpeaking) Icons.Default.VolumeOff else Icons.Default.VolumeUp,
                            contentDescription = "Read aloud",
                            tint = if (isSpeaking) tierTertiary() else (if (isBack) tierTertiary() else tierPrimary()),
                            modifier = Modifier.size(20.dp)
                        )
                    }
                }
            }

            Column(
                modifier = Modifier.align(Alignment.Center).fillMaxWidth(),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(
                    text = body,
                    style = MaterialTheme.typography.headlineSmall.copy(
                        fontWeight = FontWeight.Bold,
                        textAlign = TextAlign.Center
                    ),
                    maxLines = 9,
                    overflow = TextOverflow.Ellipsis
                )

                if (hint != null) {
                    Spacer(modifier = Modifier.height(20.dp))
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            Icons.Default.Lightbulb,
                            contentDescription = null,
                            modifier = Modifier.size(14.dp),
                            tint = AmberWarm
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            text = "Hint: $hint",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)
                        )
                    }
                }
            }
        }
    }
}

/** Formats a next-review timestamp as a human-friendly relative date. */
private fun formatNextReview(timestamp: Long): String {
    val now = System.currentTimeMillis()
    val diffDays = (timestamp - now) / 86_400_000L
    return when {
        timestamp <= now -> "now"
        diffDays <= 0 -> "today"
        diffDays == 1L -> "tomorrow"
        diffDays < 30 -> "in $diffDays days"
        else -> SimpleDateFormat("MMM d", Locale.getDefault()).format(Date(timestamp))
    }
}
