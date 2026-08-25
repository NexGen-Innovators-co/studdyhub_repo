package com.example.ui.screens.recordings

import android.Manifest
import android.content.pm.PackageManager
import android.media.MediaPlayer
import android.media.MediaRecorder
import android.net.Uri
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.*
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.example.R
import com.example.data.local.entities.ClassRecordingEntity
import com.example.ui.components.studdyPressScale
import com.example.ui.theme.tierAccent
import com.example.ui.theme.tierPrimary
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RecordingsScreen(
    viewModel: RecordingsViewModel,
    onBack: () -> Unit = {}
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    var showRecordModal by remember { mutableStateOf(false) }
    var selectedRecording by remember { mutableStateOf<ClassRecordingEntity?>(null) }
    var recordingToDelete by remember { mutableStateOf<ClassRecordingEntity?>(null) }
    var isRefreshing by remember { mutableStateOf(false) }
    val coroutineScope = rememberCoroutineScope()
    val clipboard = LocalClipboardManager.current

    val snackbarHostState = remember { SnackbarHostState() }
    LaunchedEffect(state.userMessage) {
        state.userMessage?.let { msg ->
            snackbarHostState.showSnackbar(msg)
            viewModel.clearUserMessage()
        }
    }

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
                        "Class Audio & Transcripts",
                        fontWeight = FontWeight.Bold,
                        style = MaterialTheme.typography.titleMedium,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                },
                actions = {
                    IconButton(onClick = { showRecordModal = true }) {
                        Icon(Icons.Default.Mic, contentDescription = "Record Lecture")
                    }
                }
            )
        },
        floatingActionButton = {
            ExtendedFloatingActionButton(
                onClick = { showRecordModal = true },
                icon = { Icon(Icons.Default.Mic, contentDescription = null) },
                text = { Text("Record Lecture", fontWeight = FontWeight.Bold) },
                containerColor = MaterialTheme.colorScheme.primary,
                contentColor = Color.White,
                modifier = Modifier.testTag("recordings_fab_record")
            )
        }
    ) { innerPadding ->
        PullToRefreshBox(
            isRefreshing = isRefreshing,
            onRefresh = {
                coroutineScope.launch {
                    isRefreshing = true
                    viewModel.refreshRecordings()
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
            if (state.isLoading || state.isProcessingAudio) {
                LinearProgressIndicator(modifier = Modifier.fillMaxWidth())
                Spacer(modifier = Modifier.height(8.dp))
            }
            if (state.isProcessingAudio && state.processingMessage.isNotBlank()) {
                Text(
                    text = "✨ ${state.processingMessage}",
                    style = MaterialTheme.typography.labelMedium.copy(color = tierPrimary(), fontWeight = FontWeight.SemiBold),
                    modifier = Modifier.padding(bottom = 8.dp)
                )
            }

            if (state.recordings.isEmpty()) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        modifier = Modifier.padding(24.dp)
                    ) {
                        Image(
                            painter = painterResource(id = R.drawable.img_study_mascot),
                            contentDescription = "Empty Recordings Mascot Art",
                            modifier = Modifier
                                .size(160.dp)
                                .clip(RoundedCornerShape(20.dp)),
                            contentScale = ContentScale.Crop
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                        Text(
                            text = "No Lecture Recordings Yet",
                            style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold)
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = "Record live class lectures with your mic, import an audio file, or type a transcript. Ollie AI transcribes and summarizes them automatically!",
                            style = MaterialTheme.typography.bodyMedium.copy(
                                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)
                            ),
                            textAlign = TextAlign.Center
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                        Button(
                            onClick = { showRecordModal = true },
                            colors = ButtonDefaults.buttonColors(containerColor = tierPrimary()),
                            shape = RoundedCornerShape(12.dp)
                        ) {
                            Icon(Icons.Default.Mic, contentDescription = null)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("Record or Import Lecture", fontWeight = FontWeight.Bold)
                        }
                    }
                }
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    items(state.recordings, key = { it.id }) { rec ->
                        RecordingCard(
                            rec = rec,
                            onClick = { selectedRecording = rec },
                            onDelete = { recordingToDelete = rec }
                        )
                    }
                }
            }
        }
        } // end PullToRefreshBox
    }

    if (showRecordModal) {
        NewRecordingDialog(
            viewModel = viewModel,
            isProcessing = state.isProcessingAudio,
            onDismiss = { showRecordModal = false }
        )
    }

    selectedRecording?.let { rec ->
        RecordingDetailDialog(
            rec = rec,
            clipboard = clipboard,
            isQuizGenerating = state.quizGeneratingId == rec.id,
            onGenerateQuiz = { viewModel.generateQuizForRecording(rec.id) },
            onReprocess = { viewModel.reprocessRecording(rec.id) },
            onDelete = { recordingToDelete = rec; selectedRecording = null },
            onDismiss = { selectedRecording = null }
        )
    }

    // Delete confirmation — matches the confirm-first pattern used by quizzes, schedule, and chat.
    recordingToDelete?.let { rec ->
        AlertDialog(
            onDismissRequest = { recordingToDelete = null },
            title = { Text("Delete Recording?") },
            text = { Text("Are you sure you want to delete \"${rec.title}\"? This action cannot be undone.") },
            confirmButton = {
                Button(
                    onClick = {
                        viewModel.deleteRecording(rec.id)
                        recordingToDelete = null
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error)
                ) {
                    Text("Delete")
                }
            },
            dismissButton = {
                TextButton(onClick = { recordingToDelete = null }) {
                    Text("Cancel")
                }
            }
        )
    }
}

// ─── Recording list card ──────────────────────────────────────────────────────────────

@Composable
private fun RecordingCard(
    rec: ClassRecordingEntity,
    onClick: () -> Unit,
    onDelete: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .studdyPressScale()
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Surface(
                        shape = CircleShape,
                        color = tierPrimary().copy(alpha = 0.15f),
                        modifier = Modifier.size(36.dp)
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Icon(
                                imageVector = Icons.Default.GraphicEq,
                                contentDescription = null,
                                tint = tierPrimary(),
                                modifier = Modifier.size(20.dp)
                            )
                        }
                    }
                    Spacer(modifier = Modifier.width(10.dp))
                    Column {
                        Text(
                            text = rec.title,
                            style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                        Text(
                            text = "${rec.subject} • ${formatDuration(rec.durationSeconds)}",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)
                        )
                    }
                }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    ProcessingStatusChip(status = rec.processingStatus)
                    Spacer(modifier = Modifier.width(4.dp))
                    IconButton(
                        onClick = onDelete,
                        modifier = Modifier.size(24.dp)
                    ) {
                        Icon(Icons.Default.Delete, contentDescription = "Delete", tint = MaterialTheme.colorScheme.error)
                    }
                }
            }

            if (rec.summary.isNotBlank()) {
                Spacer(modifier = Modifier.height(12.dp))
                Surface(
                    shape = RoundedCornerShape(8.dp),
                    color = tierAccent().copy(alpha = 0.12f),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(
                        text = rec.summary,
                        modifier = Modifier.padding(10.dp),
                        style = MaterialTheme.typography.bodySmall.copy(color = tierAccent()),
                        maxLines = 3,
                        overflow = TextOverflow.Ellipsis
                    )
                }
            }

            if (rec.transcript.isBlank() && rec.processingStatus.lowercase() != "processing") {
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = "No transcript yet — tap to re-process or add one.",
                    style = MaterialTheme.typography.labelSmall.copy(
                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f)
                    )
                )
            }
        }
    }
}

@Composable
private fun ProcessingStatusChip(status: String) {
    val (label, color) = when (status.lowercase()) {
        "completed" -> "Completed" to tierAccent()
        "processing", "pending" -> if (status.lowercase() == "pending") "Pending" to tierPrimary() else "Processing" to Color(0xFFF59E0B)
        else -> "Failed" to MaterialTheme.colorScheme.error
    }
    Surface(
        color = color.copy(alpha = 0.15f),
        shape = RoundedCornerShape(6.dp)
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall.copy(color = color, fontWeight = FontWeight.Bold),
            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
        )
    }
}

// ─── New recording dialog: record / import / type ─────────────────────────────────────

private enum class NewRecordingMode(val label: String, val icon: ImageVector) {
    RECORD("Record", Icons.Default.Mic),
    IMPORT("Import Audio", Icons.Default.FolderOpen),
    TEXT("Type Transcript", Icons.Default.Edit)
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun NewRecordingDialog(
    viewModel: RecordingsViewModel,
    isProcessing: Boolean,
    onDismiss: () -> Unit
) {
    val context = LocalContext.current
    var mode by remember { mutableStateOf(NewRecordingMode.RECORD) }
    var title by remember { mutableStateOf("") }
    var subject by remember { mutableStateOf("") }
    var transcript by remember { mutableStateOf("") }

    // Recording state
    var isRecording by remember { mutableStateOf(false) }
    var isPaused by remember { mutableStateOf(false) }
    var elapsedSeconds by remember { mutableIntStateOf(0) }
    var recordingFile by remember { mutableStateOf<File?>(null) }
    val mediaRecorder = remember { mutableStateOf<MediaRecorder?>(null) }

    // Playback timer
    LaunchedEffect(isRecording) {
        while (isRecording) {
            delay(1000)
            if (!isPaused) elapsedSeconds++
        }
    }

    val cleanupRecorder: () -> Unit = {
        try { mediaRecorder.value?.release() } catch (_: Exception) {}
        mediaRecorder.value = null
    }

    // Release the recorder if the dialog leaves composition without Stop (activity
    // recreation, back gesture edge cases) so the mic is never left held open.
    DisposableEffect(Unit) {
        onDispose { cleanupRecorder() }
    }

    val startRecording: () -> Unit = {
        try {
            val file = File(context.cacheDir, "rec_${System.currentTimeMillis()}.m4a")
            // No-arg MediaRecorder() works on every API (minSdk 24); the context constructor is API 31+.
            @Suppress("DEPRECATION")
            val recorder = MediaRecorder().apply {
                setAudioSource(MediaRecorder.AudioSource.MIC)
                setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
                setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
                setOutputFile(file.absolutePath)
                prepare()
                start()
            }
            mediaRecorder.value = recorder
            recordingFile = file
            elapsedSeconds = 0
            isRecording = true
            isPaused = false
        } catch (e: Exception) {
            cleanupRecorder()
            Toast.makeText(context, "Couldn't start recording. Please try again.", Toast.LENGTH_SHORT).show()
        }
    }

    val stopRecording: () -> Unit = {
        try { mediaRecorder.value?.stop() } catch (_: Exception) {}
        cleanupRecorder()
        isRecording = false
        isPaused = false
    }

    val saveRecordedAudio: () -> Unit = {
        stopRecording()
        val file = recordingFile
        if (file != null && file.exists() && file.length() > 0L) {
            viewModel.saveRecordingFromAudio(
                title = title,
                subject = subject,
                audioFile = file,
                mimeType = "audio/mp4",
                durationSeconds = elapsedSeconds
            )
            onDismiss()
        } else {
            Toast.makeText(context, "Recording was too short — please try again.", Toast.LENGTH_SHORT).show()
        }
    }

    val requestAudioPermission = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (granted) startRecording()
        else Toast.makeText(context, "Microphone permission is required to record lectures", Toast.LENGTH_SHORT).show()
    }

    val importScope = rememberCoroutineScope()
    val importAudio: (Uri) -> Unit = { uri ->
        // Copying a large audio file off the ContentResolver must never run on the main thread.
        importScope.launch {
            try {
                val mime = context.contentResolver.getType(uri) ?: "audio/mpeg"
                val ext = when {
                    mime.contains("x-m4a") || mime.contains("mp4") -> "m4a"
                    mime.contains("wav") -> "wav"
                    mime.contains("mpeg") || mime.contains("mp3") -> "mp3"
                    mime.contains("ogg") -> "ogg"
                    mime.contains("webm") -> "webm"
                    else -> "bin"
                }
                val file = withContext(kotlinx.coroutines.Dispatchers.IO) {
                    val f = File(context.cacheDir, "import_${System.currentTimeMillis()}.$ext")
                    context.contentResolver.openInputStream(uri)?.use { input ->
                        f.outputStream().use { output -> input.copyTo(output) }
                    }
                    f
                }
                if (file.exists() && file.length() > 0L) {
                    viewModel.saveRecordingFromAudio(title, subject, file, mime, 0)
                    onDismiss()
                } else {
                    Toast.makeText(context, "Couldn't read that audio file.", Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) {
                Toast.makeText(context, "Audio import failed. Please try another file.", Toast.LENGTH_SHORT).show()
            }
        }
    }

    val importLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.GetContent()
    ) { uri -> uri?.let(importAudio) }

    AlertDialog(
        onDismissRequest = { if (!isRecording && !isProcessing) onDismiss() },
        title = { Text("New Class Recording", fontWeight = FontWeight.Bold) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedTextField(
                    value = title,
                    onValueChange = { title = it },
                    label = { Text("Lecture Title") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )
                OutlinedTextField(
                    value = subject,
                    onValueChange = { subject = it },
                    label = { Text("Subject / Course Code") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )

                // Mode picker
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    NewRecordingMode.entries.forEach { m ->
                        FilterChip(
                            selected = mode == m,
                            onClick = { if (!isRecording && !isProcessing) mode = m },
                            label = { Text(m.label, style = MaterialTheme.typography.labelMedium) },
                            leadingIcon = {
                                Icon(
                                    m.icon,
                                    contentDescription = null,
                                    modifier = Modifier.size(16.dp),
                                    tint = if (mode == m) tierPrimary() else MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                        )
                    }
                }

                when (mode) {
                    NewRecordingMode.RECORD -> {
                        Surface(
                            shape = RoundedCornerShape(16.dp),
                            color = if (isRecording) Color(0xFFFEE2E2).copy(alpha = 0.6f) else MaterialTheme.colorScheme.surfaceVariant,
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Column(
                                horizontalAlignment = Alignment.CenterHorizontally,
                                modifier = Modifier.padding(16.dp)
                            ) {
                                Surface(
                                    shape = CircleShape,
                                    color = if (isRecording) Color(0xFFEF4444).copy(alpha = 0.2f) else tierPrimary().copy(alpha = 0.15f),
                                    modifier = Modifier.size(56.dp)
                                ) {
                                    Box(contentAlignment = Alignment.Center) {
                                        if (isRecording) {
                                            // Pulsing red dot
                                            var pulse by remember { mutableStateOf(true) }
                                            LaunchedEffect(isRecording) {
                                                while (isRecording) { pulse = !pulse; delay(500) }
                                            }
                                            Box(
                                                modifier = Modifier
                                                    .size(if (pulse) 18.dp else 12.dp)
                                                    .clip(CircleShape)
                                                    .background(Color(0xFFEF4444))
                                            )
                                        } else {
                                            Icon(Icons.Default.Mic, contentDescription = null, tint = tierPrimary(), modifier = Modifier.size(26.dp))
                                        }
                                    }
                                }
                                Spacer(modifier = Modifier.height(8.dp))
                                Text(
                                    text = formatTimer(elapsedSeconds),
                                    style = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.Bold)
                                )
                                Spacer(modifier = Modifier.height(4.dp))
                                Text(
                                    text = if (isRecording) (if (isPaused) "Paused — tap Resume to continue" else "Recording live lecture...") else "Tap the mic to start recording",
                                    style = MaterialTheme.typography.bodySmall.copy(
                                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
                                    ),
                                    textAlign = TextAlign.Center
                                )
                                Spacer(modifier = Modifier.height(12.dp))
                                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                    if (isRecording) {
                                        Button(
                                            onClick = {
                                                if (isPaused) {
                                                    try { mediaRecorder.value?.resume() } catch (_: Exception) {}
                                                    isPaused = false
                                                } else {
                                                    try { mediaRecorder.value?.pause() } catch (_: Exception) {}
                                                    isPaused = true
                                                }
                                            },
                                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFF59E0B)),
                                            shape = RoundedCornerShape(10.dp)
                                        ) {
                                            Icon(if (isPaused) Icons.Default.PlayArrow else Icons.Default.Pause, contentDescription = null)
                                            Spacer(modifier = Modifier.width(6.dp))
                                            Text(if (isPaused) "Resume" else "Pause")
                                        }
                                        Button(
                                            onClick = saveRecordedAudio,
                                            colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error),
                                            shape = RoundedCornerShape(10.dp)
                                        ) {
                                            Icon(Icons.Default.Stop, contentDescription = null)
                                            Spacer(modifier = Modifier.width(6.dp))
                                            Text("Save")
                                        }
                                    } else {
                                        Button(
                                            onClick = {
                                                val granted = context.checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED
                                                if (granted) startRecording()
                                                else requestAudioPermission.launch(Manifest.permission.RECORD_AUDIO)
                                            },
                                            colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error),
                                            shape = RoundedCornerShape(10.dp)
                                        ) {
                                            Icon(Icons.Default.Mic, contentDescription = null)
                                            Spacer(modifier = Modifier.width(6.dp))
                                            Text("Start Recording")
                                        }
                                    }
                                }
                            }
                        }
                    }

                    NewRecordingMode.IMPORT -> {
                        Surface(
                            shape = RoundedCornerShape(16.dp),
                            color = MaterialTheme.colorScheme.surfaceVariant,
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { importLauncher.launch("audio/*") }
                        ) {
                            Column(
                                horizontalAlignment = Alignment.CenterHorizontally,
                                modifier = Modifier.padding(20.dp)
                            ) {
                                Icon(Icons.Default.FileUpload, contentDescription = null, tint = tierPrimary(), modifier = Modifier.size(34.dp))
                                Spacer(modifier = Modifier.height(8.dp))
                                Text("Tap to choose an audio file", fontWeight = FontWeight.SemiBold)
                                Text(
                                    "Supports MP3, WAV, M4A, OGG — Ollie transcribes and summarizes it automatically.",
                                    style = MaterialTheme.typography.bodySmall.copy(
                                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
                                    ),
                                    textAlign = TextAlign.Center
                                )
                            }
                        }
                    }

                    NewRecordingMode.TEXT -> {
                        OutlinedTextField(
                            value = transcript,
                            onValueChange = { transcript = it },
                            label = { Text("Lecture Audio Transcript / Notes") },
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(150.dp)
                        )
                    }
                }

                if (isProcessing) {
                    LinearProgressIndicator(modifier = Modifier.fillMaxWidth())
                    Text(
                        text = "Processing audio — this can take a minute...",
                        style = MaterialTheme.typography.labelSmall.copy(color = tierPrimary())
                    )
                }
            }
        },
        confirmButton = {
            if (mode == NewRecordingMode.TEXT) {
                Button(
                    onClick = {
                        if (title.isNotBlank() && transcript.isNotBlank()) {
                            viewModel.addClassRecording(title, subject, transcript)
                            onDismiss()
                        }
                    },
                    enabled = title.isNotBlank() && transcript.isNotBlank() && !isProcessing
                ) {
                    Text("Process with AI")
                }
            }
        },
        dismissButton = {
            TextButton(
                onClick = {
                    if (isRecording) stopRecording()
                    onDismiss()
                },
                enabled = !isProcessing
            ) {
                Text("Cancel")
            }
        }
    )
}

// ─── Recording detail dialog: transcript / summary / playback / quiz ──────────────────

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun RecordingDetailDialog(
    rec: ClassRecordingEntity,
    clipboard: androidx.compose.ui.platform.ClipboardManager,
    isQuizGenerating: Boolean,
    onGenerateQuiz: () -> Unit,
    onReprocess: () -> Unit,
    onDelete: () -> Unit,
    onDismiss: () -> Unit
) {
    val context = LocalContext.current
    var activeTab by remember { mutableIntStateOf(0) }
    var isPlaying by remember { mutableStateOf(false) }
    var playbackError by remember { mutableStateOf(false) }

    val mediaPlayer = remember { MediaPlayer() }
    DisposableEffect(Unit) {
        onDispose {
            try { mediaPlayer.release() } catch (_: Exception) {}
        }
    }

    val togglePlayback: () -> Unit = {
        try {
            if (isPlaying) {
                mediaPlayer.pause()
                isPlaying = false
            } else {
                val local = rec.localFilePath
                val source = if (!local.isNullOrBlank() && File(local).exists()) local else rec.audioUrl
                if (source.isBlank()) {
                    playbackError = true
                } else {
                    mediaPlayer.reset()
                    mediaPlayer.setDataSource(source)
                    mediaPlayer.setOnPreparedListener {
                        it.start()
                        isPlaying = true
                        playbackError = false
                    }
                    mediaPlayer.setOnCompletionListener { isPlaying = false }
                    mediaPlayer.prepareAsync()
                }
            }
        } catch (e: Exception) {
            playbackError = true
            isPlaying = false
        }
    }

    Dialog(onDismissRequest = onDismiss) {
        Surface(
            shape = RoundedCornerShape(24.dp),
            color = MaterialTheme.colorScheme.surface,
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(modifier = Modifier.padding(20.dp)) {
                // Header
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.Top
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(rec.title, style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold))
                        Spacer(modifier = Modifier.height(2.dp))
                        Text(
                            "${rec.subject} • ${formatDuration(rec.durationSeconds)}",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
                        )
                    }
                    IconButton(onClick = onDismiss) {
                        Icon(Icons.Default.Close, contentDescription = "Close")
                    }
                }

                // Playback row
                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = MaterialTheme.colorScheme.surfaceVariant,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 12.dp)
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp)
                    ) {
                        IconButton(onClick = togglePlayback, modifier = Modifier.testTag("recording_play_button")) {
                            Icon(
                                imageVector = if (isPlaying) Icons.Default.Pause else Icons.Default.PlayArrow,
                                contentDescription = if (isPlaying) "Pause audio" else "Play audio",
                                tint = tierPrimary()
                            )
                        }
                        Text(
                            text = when {
                                playbackError -> "Audio unavailable"
                                rec.audioUrl.isBlank() && rec.localFilePath.isNullOrBlank() -> "No audio — transcript only"
                                isPlaying -> "Playing..."
                                else -> "Tap to play recording"
                            },
                            style = MaterialTheme.typography.bodySmall.copy(color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f))
                        )
                        Spacer(modifier = Modifier.weight(1f))
                        ProcessingStatusChip(status = rec.processingStatus)
                    }
                }

                // Tabs
                Spacer(modifier = Modifier.height(12.dp))
                TabRow(selectedTabIndex = activeTab) {
                    Tab(selected = activeTab == 0, onClick = { activeTab = 0 }, text = { Text("Transcript") })
                    Tab(selected = activeTab == 1, onClick = { activeTab = 1 }, text = { Text("AI Summary") })
                }
                Spacer(modifier = Modifier.height(8.dp))

                // Content
                val transcriptText = rec.transcript
                val summaryText = rec.summary
                val wordCount = if (transcriptText.isBlank()) 0 else transcriptText.trim().split(Regex("\\s+")).size

                if (activeTab == 0) {
                    if (transcriptText.isNotBlank()) {
                        Text(
                            text = "$wordCount words",
                            style = MaterialTheme.typography.labelSmall.copy(color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f))
                        )
                        Spacer(modifier = Modifier.height(6.dp))
                        Text(
                            text = transcriptText,
                            style = MaterialTheme.typography.bodyMedium,
                            modifier = Modifier
                                .fillMaxWidth()
                                .heightIn(max = 340.dp)
                                .verticalScroll(rememberScrollState())
                        )
                    } else {
                        EmptyDetailContent(
                            icon = Icons.Default.GraphicEq,
                            title = "No transcript yet",
                            subtitle = "Tap \"Re-process\" below to run AI transcription, or record the lecture again."
                        )
                    }
                } else {
                    if (summaryText.isNotBlank()) {
                        Text(
                            text = summaryText,
                            style = MaterialTheme.typography.bodyMedium,
                            modifier = Modifier
                                .fillMaxWidth()
                                .heightIn(max = 340.dp)
                                .verticalScroll(rememberScrollState())
                        )
                    } else {
                        EmptyDetailContent(
                            icon = Icons.Default.AutoAwesome,
                            title = "No summary yet",
                            subtitle = "Summaries are generated right after transcription."
                        )
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Actions
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    OutlinedButton(
                        onClick = {
                            clipboard.setText(AnnotatedString(transcriptText))
                            Toast.makeText(context, "Transcript copied to clipboard", Toast.LENGTH_SHORT).show()
                        },
                        enabled = transcriptText.isNotBlank(),
                        modifier = Modifier.weight(1f)
                    ) {
                        Icon(Icons.Default.ContentCopy, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("Copy")
                    }
                    OutlinedButton(
                        onClick = onReprocess,
                        enabled = !isQuizGenerating,
                        modifier = Modifier.weight(1f)
                    ) {
                        Icon(Icons.Default.Refresh, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("Re-process")
                    }
                }
                Spacer(modifier = Modifier.height(8.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Button(
                        onClick = onGenerateQuiz,
                        enabled = transcriptText.isNotBlank() && !isQuizGenerating,
                        colors = ButtonDefaults.buttonColors(containerColor = tierPrimary()),
                        modifier = Modifier.weight(1f)
                    ) {
                        if (isQuizGenerating) {
                            CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp, color = Color.White)
                        } else {
                            Icon(Icons.Default.Quiz, contentDescription = null, modifier = Modifier.size(16.dp))
                        }
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(if (isQuizGenerating) "Generating..." else "Generate Quiz")
                    }
                    TextButton(
                        onClick = onDelete,
                        colors = ButtonDefaults.textButtonColors(contentColor = MaterialTheme.colorScheme.error)
                    ) {
                        Icon(Icons.Default.Delete, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("Delete")
                    }
                }
            }
        }
    }
}

@Composable
private fun EmptyDetailContent(icon: androidx.compose.ui.graphics.vector.ImageVector, title: String, subtitle: String) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 24.dp)
    ) {
        Icon(icon, contentDescription = null, tint = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.4f), modifier = Modifier.size(36.dp))
        Spacer(modifier = Modifier.height(8.dp))
        Text(title, fontWeight = FontWeight.SemiBold)
        Text(
            subtitle,
            style = MaterialTheme.typography.bodySmall.copy(color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)),
            textAlign = TextAlign.Center
        )
    }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────────────

private fun formatDuration(seconds: Int): String {
    val s = seconds.coerceAtLeast(0)
    val h = s / 3600
    val m = (s % 3600) / 60
    return if (h > 0) "${h}h ${m}m" else "${m}m ${s % 60}s"
}

private fun formatTimer(seconds: Int): String {
    val m = seconds / 60
    val s = seconds % 60
    return String.format(Locale.US, "%02d:%02d", m, s)
}
