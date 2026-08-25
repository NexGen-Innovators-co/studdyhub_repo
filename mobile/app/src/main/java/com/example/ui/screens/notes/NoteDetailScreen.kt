package com.example.ui.screens.notes

import com.example.util.MarkdownConverter

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.speech.RecognizerIntent
import android.speech.tts.TextToSpeech
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.*
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Redo
import androidx.compose.material.icons.automirrored.filled.Undo
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.TextFieldValue
import androidx.compose.ui.text.TextRange
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.data.local.entities.NoteEntity
import com.example.data.repository.StuddyHubRepository
import com.example.ui.theme.tierAccent
import com.example.ui.theme.tierPrimary
import com.example.ui.theme.tierTertiary
import kotlinx.coroutines.launch
import androidx.lifecycle.lifecycleScope
import java.util.Locale

import androidx.compose.ui.draw.scale
import com.example.data.local.entities.DocumentEntity
import com.example.util.DocumentExporter

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun NoteDetailScreen(
    noteId: String,
    repository: StuddyHubRepository,
    onNavigateBack: () -> Unit,
    onNavigateToQuiz: () -> Unit,
    onNavigateToCards: () -> Unit,
    onDiscussWithOllie: (NoteEntity) -> Unit = {}
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    // Long AI work (upload + extraction + note generation) must not run on the composition
    // scope: rememberCoroutineScope() is cancelled the moment this screen leaves the
    // composition, which killed generation mid-request with
    // LeftCompositionCancellationException. The lifecycle scope survives recomposition and
    // navigation, and is cancelled only when the activity itself goes away.
    val aiScope = androidx.lifecycle.compose.LocalLifecycleOwner.current.lifecycleScope
    val snackbarHostState = remember { SnackbarHostState() }
    
    var note by remember { mutableStateOf<NoteEntity?>(null) }

    // Form states
    var editTitle by remember { mutableStateOf("") }
    var editCategory by remember { mutableStateOf("") }
    var editTags by remember { mutableStateOf("") }
    var editContent by remember { mutableStateOf("") }
    var editAiSummary by remember { mutableStateOf("") }
    var editDocumentId by remember { mutableStateOf<String?>(null) }
    val isAIGenerating by repository.isAIGenerating.collectAsState(initial = false)
    val generationMessage by repository.generationMessage.collectAsState(initial = "")
    var isActionLoading by remember { mutableStateOf(false) }
    var loadingMessage by remember { mutableStateOf("") }
    var isSaving by remember { mutableStateOf(false) }
    var isAutoSaveEnabled by remember { mutableStateOf(true) }

    // Table & Diagram Configuration states
    var showTableConfigDialog by remember { mutableStateOf(false) }
    var tableRows by remember { mutableIntStateOf(3) }
    var tableCols by remember { mutableIntStateOf(3) }
    var tableHeaderRow by remember { mutableStateOf(true) }

    var showDiagramConfigDialog by remember { mutableStateOf(false) }
    var selectedDiagramType by remember { mutableStateOf("mermaid_flowchart") }
    var diagramPromptInstruction by remember { mutableStateOf("") }

    // Document Importer and Generation states
    var showImportDocDialog by remember { mutableStateOf(false) }
    var showCopilotDialog by remember { mutableStateOf(false) }
    var copilotInstruction by remember { mutableStateOf("") }
    var selectedImportDoc by remember { mutableStateOf<DocumentEntity?>(null) }
    var showDocOptionPromptDialog by remember { mutableStateOf(false) }
    var docGenerationOption by remember { mutableStateOf("note") }
    var customDocPromptInstruction by remember { mutableStateOf("") }

    val documentPickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent()
    ) { uri: Uri? ->
        if (uri != null) {
            // aiScope: upload + server-side extraction can take a minute; the composition scope
            // dies on recomposition and would abandon the request halfway.
            aiScope.launch {
                isActionLoading = true
                loadingMessage = "Reading and saving document..."
                try {
                    val contentResolver = context.contentResolver
                    var fileName = "Uploaded_Doc_${System.currentTimeMillis()}"
                    try {
                        contentResolver.query(uri, null, null, null, null)?.use { cursor ->
                            val nameIndex = cursor.getColumnIndex(android.provider.OpenableColumns.DISPLAY_NAME)
                            if (nameIndex != -1 && cursor.moveToFirst()) {
                                fileName = cursor.getString(nameIndex) ?: fileName
                            }
                        }
                    } catch (e: Exception) {
                        // Fallback filename if query failed
                    }
                    val mimeType = contentResolver.getType(uri) ?: "text/plain"
                    val inputStream = contentResolver.openInputStream(uri)
                    val rawBytes = inputStream?.use { it.readBytes() } ?: byteArrayOf()
                    
                    val ext = fileName.substringAfterLast('.', "").lowercase()
                    val isImage = mimeType.startsWith("image/") || ext in listOf("png", "jpg", "jpeg", "webp", "gif", "bmp")
                    
                    val detectedFileType = when {
                        isImage -> "IMAGE"
                        ext == "pdf" || mimeType.contains("pdf") -> "PDF"
                        ext in listOf("docx", "doc") || mimeType.contains("word") -> "DOCX"
                        ext in listOf("pptx", "ppt") || mimeType.contains("presentation") -> "PPTX"
                        else -> if (ext.isNotBlank()) ext.uppercase() else "TXT"
                    }

                    var finalFileName = fileName
                    if (!finalFileName.contains(".") && isImage) {
                        val subExt = if (mimeType.contains("png")) "png" else "jpg"
                        finalFileName = "$finalFileName.$subExt"
                    }

                    // Local-only best effort. Real extraction happens server-side in
                    // document-processor; this is just so plain-text files are readable offline.
                    // It must stay empty for PDFs/DOCX rather than inventing filler, otherwise the
                    // note generator summarises the filler instead of the document.
                    val textContent = if (isImage) {
                        "[Image Document: $finalFileName]"
                    } else if (rawBytes.isNotEmpty() &&
                        com.example.util.DocumentTextCleaner.isTextualFile(finalFileName, mimeType)
                    ) {
                        val rawStr = String(rawBytes, java.nio.charset.StandardCharsets.UTF_8)
                        com.example.util.DocumentTextCleaner.cleanPdfOrRawText(rawStr, finalFileName)
                    } else ""

                    val fileSizeKb = (rawBytes.size / 1024).coerceAtLeast(1)
                    var savedDoc = repository.saveDocument(
                        title = finalFileName,
                        fileName = finalFileName,
                        fileType = detectedFileType,
                        fileSizeKb = fileSizeKb,
                        content = textContent,
                        rawBytes = rawBytes
                    )

                    // Server-side extraction is the source of truth for document text.
                    loadingMessage = "Extracting text from $finalFileName..."
                    var extractionFailure: String? = null
                    try {
                        val currentUserId = repository.getOrRestoreActiveUserId()
                        val createRes = com.example.data.remote.BackendApiService.createDocument(
                            userId = currentUserId,
                            title = finalFileName,
                            fileName = finalFileName,
                            fileType = detectedFileType,
                            fileSizeKb = fileSizeKb,
                            contentExtracted = textContent,
                            id = savedDoc.id,
                            rawBytes = rawBytes
                        )
                        when (createRes) {
                            is com.example.data.remote.BackendResult.Success -> {
                                val serverText = createRes.data.optString("content_extracted", "")
                                if (serverText.isNotBlank() &&
                                    !com.example.util.DocumentTextCleaner.looksLikeBinary(serverText)
                                ) {
                                    repository.updateDocumentContent(savedDoc.id, serverText)
                                    savedDoc = savedDoc.copy(contentExtracted = serverText)
                                } else if (!isImage) {
                                    extractionFailure = "No text could be extracted from $finalFileName."
                                }
                            }
                            is com.example.data.remote.BackendResult.Error -> {
                                extractionFailure = createRes.message
                            }
                        }
                    } catch (e: Exception) {
                        android.util.Log.w("NoteDetailScreen", "document-processor upload failed: ${e.message}")
                        extractionFailure = e.message ?: "Upload failed"
                    }

                    selectedImportDoc = savedDoc
                    showImportDocDialog = false
                    // Only offer generation when there is real text to generate from; otherwise the
                    // model would be asked to summarise nothing.
                    val hasUsableText = isImage || savedDoc.contentExtracted.isNotBlank()
                    showDocOptionPromptDialog = hasUsableText
                    if (hasUsableText) {
                        snackbarHostState.showSnackbar("Document processed & saved successfully!")
                    } else {
                        snackbarHostState.showSnackbar(
                            extractionFailure ?: "Couldn't extract text from $finalFileName. Try a different file."
                        )
                    }
                } catch (e: Exception) {
                    snackbarHostState.showSnackbar("Failed to process document: ${e.message}")
                } finally {
                    isActionLoading = false
                    loadingMessage = ""
                }
            }
        }
    }

    var tfValue by remember { mutableStateOf(TextFieldValue(text = editContent, selection = TextRange(editContent.length))) }

    LaunchedEffect(editContent) {
        if (editContent != tfValue.text) {
            val currentSel = tfValue.selection
            val newSel = TextRange(
                start = currentSel.start.coerceIn(0, editContent.length),
                end = currentSel.end.coerceIn(0, editContent.length)
            )
            tfValue = TextFieldValue(text = editContent, selection = newSel)
        }
    }

    // Dialog states
    val allDocs by repository.allDocuments.collectAsState(initial = emptyList())

    // TTS state
    var ttsEngine by remember { mutableStateOf<TextToSpeech?>(null) }
    var isSpeaking by remember { mutableStateOf(false) }
    var speechRate by remember { mutableFloatStateOf(1.0f) }

    // Translation & AI Copilot states
    var showTranslateDialog by remember { mutableStateOf(false) }
    var showExportDialog by remember { mutableStateOf(false) }
    var selectedLanguage by remember { mutableStateOf("Spanish") }
    var viewTranslated by remember { mutableStateOf(false) }

    // Web Note Features (Clipboard, Search, Reading Controls)
    val clipboardManager = androidx.compose.ui.platform.LocalClipboardManager.current
    var isSearchActive by remember { mutableStateOf(false) }
    var searchNoteQuery by remember { mutableStateOf("") }
    var readerFontSizeSp by remember { mutableIntStateOf(14) }
    var showToolsAndDetails by remember { mutableStateOf(false) }
    var isToolbarUserVisible by remember { mutableStateOf(false) }

    // New tools state
    var showSignatureDialog by remember { mutableStateOf(false) }
    var editorWebView by remember { mutableStateOf<android.webkit.WebView?>(null) }

    // Undo & Redo stacks
    var undoStack by remember { mutableStateOf(listOf<Pair<String, String>>()) }
    var redoStack by remember { mutableStateOf(listOf<Pair<String, String>>()) }

    fun recordUndoState(title: String, content: String) {
        val last = undoStack.lastOrNull()
        if (last == null || last.first != title || last.second != content) {
            undoStack = (undoStack + Pair(title, content)).takeLast(30)
        }
    }

    val imagePickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent()
    ) { uri: Uri? ->
        if (uri != null) {
            coroutineScope.launch {
                try {
                    val resolver = context.contentResolver
                    resolver.openInputStream(uri)?.use { inputStream ->
                        val bytes = inputStream.readBytes()
                        val base64String = android.util.Base64.encodeToString(bytes, android.util.Base64.DEFAULT)
                        val cleanBase64 = base64String.replace("\n", "").replace("\r", "")
                        recordUndoState(editTitle, editContent)
                        if (editorWebView != null) {
                            val imgHtml = "<p><img src=\"data:image/jpeg;base64,$cleanBase64\" style=\"max-width:100%; border-radius:12px; margin:8px 0;\" /></p>"
                            editorWebView?.evaluateJavascript("javascript:insertHtmlSnippet('$imgHtml');", null)
                        } else {
                            val imgTag = "\n\n![Inserted Image](data:image/jpeg;base64,$cleanBase64)\n\n"
                            val updatedText = editContent + imgTag
                            tfValue = TextFieldValue(updatedText, TextRange(updatedText.length))
                            editContent = updatedText
                        }
                        snackbarHostState.showSnackbar("Image inserted successfully!")
                    }
                } catch (e: java.lang.Exception) {
                    snackbarHostState.showSnackbar("Failed to load image: ${e.message}")
                }
            }
        }
    }

    val speechRecognizerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == Activity.RESULT_OK) {
            val spokenText = result.data?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)?.firstOrNull()
            if (!spokenText.isNullOrBlank()) {
                recordUndoState(editTitle, editContent)
                val updatedText = editContent + " " + spokenText
                tfValue = TextFieldValue(updatedText, TextRange(updatedText.length))
                editContent = updatedText
            }
        }
    }

    fun performUndo() {
        if (undoStack.size > 1) {
            val currentState = Pair(editTitle, editContent)
            redoStack = redoStack + currentState
            val previousState = undoStack[undoStack.size - 2]
            undoStack = undoStack.dropLast(1)
            editTitle = previousState.first
            editContent = previousState.second
            tfValue = TextFieldValue(previousState.second, TextRange(previousState.second.length))
        }
    }

    fun performRedo() {
        if (redoStack.isNotEmpty()) {
            val nextState = redoStack.last()
            undoStack = undoStack + nextState
            redoStack = redoStack.dropLast(1)
            editTitle = nextState.first
            editContent = nextState.second
            tfValue = TextFieldValue(nextState.second, TextRange(nextState.second.length))
        }
    }

    // Auto-record history when user pauses typing
    LaunchedEffect(editTitle, editContent) {
        if (editTitle.isNotEmpty() || editContent.isNotEmpty()) {
            kotlinx.coroutines.delay(500)
            recordUndoState(editTitle, editContent)
        }
    }

    // Initialize Text-To-Speech
    DisposableEffect(context) {
        val tts = TextToSpeech(context) { status ->
            if (status == TextToSpeech.SUCCESS) {
                // Initialized
            }
        }
        ttsEngine = tts
        onDispose {
            tts.stop()
            tts.shutdown()
        }
    }

    LaunchedEffect(noteId) {
        if (noteId == "new") {
            val emptyNote = NoteEntity(
                id = java.util.UUID.randomUUID().toString(),
                title = "",
                content = "",
                category = "Computer Science",
                tags = "study"
            )
            note = emptyNote
            editTitle = ""
            editCategory = "Computer Science"
            editTags = "study"
            editContent = ""
            editAiSummary = ""
        } else {
            val fetched = repository.getNoteById(noteId)
            if (fetched != null) {
                note = fetched
                editTitle = fetched.title
                editCategory = fetched.category
                editTags = fetched.tags
                editContent = fetched.content
                tfValue = TextFieldValue(fetched.content, TextRange(fetched.content.length))
                editAiSummary = fetched.aiSummary
                editDocumentId = fetched.documentId
            }
        }
    }

    // In-Note Search Handler
    LaunchedEffect(searchNoteQuery) {
        if (searchNoteQuery.isNotBlank()) {
            editorWebView?.findAllAsync(searchNoteQuery)
            val idx = editContent.indexOf(searchNoteQuery, ignoreCase = true)
            if (idx != -1) {
                tfValue = tfValue.copy(selection = TextRange(idx, idx + searchNoteQuery.length))
            }
        } else {
            editorWebView?.clearMatches()
        }
    }

    // Auto-Save background handler (Debounced 2s)
    LaunchedEffect(editTitle, editContent, editCategory, editTags, editAiSummary, isAutoSaveEnabled) {
        if (isAutoSaveEnabled && editTitle.isNotBlank() && editContent.isNotBlank() && !isSaving) {
            kotlinx.coroutines.delay(2000)
            try {
                val current = note ?: NoteEntity(title = editTitle, content = editContent)
                val updated = current.copy(
                    title = editTitle,
                    content = editContent,
                    category = editCategory.ifBlank { "General" },
                    tags = editTags.ifBlank { "study" },
                    aiSummary = editAiSummary,
                    documentId = editDocumentId
                )
                val saved = repository.updateNote(updated, customSummary = editAiSummary.ifBlank { null })
                note = saved
            } catch (e: Exception) {
                android.util.Log.w("NoteDetailScreen", "Auto-save failed: ${e.message}")
            }
        }
    }

    fun performSaveNote() {
        val finalTitle = editTitle.ifBlank { "Untitled Study Note" }
        coroutineScope.launch {
            isSaving = true
            try {
                val current = note ?: NoteEntity(title = finalTitle, content = editContent)
                val updated = current.copy(
                    title = finalTitle,
                    content = editContent,
                    category = editCategory.ifBlank { "General" },
                    tags = editTags.ifBlank { "study" },
                    aiSummary = editAiSummary,
                    documentId = editDocumentId
                )
                val saved = if (noteId == "new" && note?.title?.isBlank() == true) {
                    repository.saveNote(
                        title = finalTitle,
                        content = editContent,
                        category = editCategory.ifBlank { "General" },
                        tags = editTags.ifBlank { "study" },
                        aiSummary = editAiSummary,
                        documentId = editDocumentId
                    )
                } else {
                    repository.updateNote(updated, customSummary = editAiSummary.ifBlank { null })
                }
                note = saved
                snackbarHostState.showSnackbar("Note saved & synced to cloud! ☁️")
            } catch (e: Exception) {
                snackbarHostState.showSnackbar("We couldn't save this note. Please try again.")
            } finally {
                isSaving = false
            }
        }
    }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
        topBar = {
            TopAppBar(
                navigationIcon = {
                    IconButton(onClick = onNavigateBack, modifier = Modifier.testTag("note_detail_back_button")) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Go back to notes list")
                    }
                },
                title = { },
                actions = {
                    if (note != null) {
                        // Undo action
                        IconButton(
                            onClick = { performUndo() },
                            enabled = undoStack.size > 1
                        ) {
                            Icon(
                                imageVector = Icons.AutoMirrored.Filled.Undo,
                                contentDescription = "Undo",
                                tint = if (undoStack.size > 1) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.onSurface.copy(alpha = 0.38f)
                            )
                        }

                        // Redo action
                        IconButton(
                            onClick = { performRedo() },
                            enabled = redoStack.isNotEmpty()
                        ) {
                            Icon(
                                imageVector = Icons.AutoMirrored.Filled.Redo,
                                contentDescription = "Redo",
                                tint = if (redoStack.isNotEmpty()) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.onSurface.copy(alpha = 0.38f)
                            )
                        }

                        // Save Note Checkmark Button (✓)
                        IconButton(
                            onClick = { performSaveNote() },
                            modifier = Modifier.testTag("note_edit_save_button")
                        ) {
                            Icon(
                                imageVector = Icons.Default.Check,
                                contentDescription = "Save Note",
                                tint = tierAccent(),
                                modifier = Modifier.size(26.dp)
                            )
                        }

                        // Download / Export Note Button
                        IconButton(
                            onClick = { showExportDialog = true },
                            modifier = Modifier.testTag("note_export_button")
                        ) {
                            Icon(Icons.Default.Download, contentDescription = "Export Note", tint = tierTertiary())
                        }

                        // Single Header Toggler for Details & Metadata
                        IconButton(
                            onClick = { showToolsAndDetails = !showToolsAndDetails },
                            modifier = Modifier.testTag("note_detail_toggle_tools")
                        ) {
                            Icon(
                                imageVector = if (showToolsAndDetails) Icons.Default.Tune else Icons.Default.MoreVert,
                                contentDescription = "Toggle Details & Actions",
                                tint = if (showToolsAndDetails) tierPrimary() else MaterialTheme.colorScheme.onSurface
                            )
                        }
                    }
                }
            )
        },
        bottomBar = {}
    ) { innerPadding ->
        val isKeyboardVisible = WindowInsets.isImeVisible
        if (note == null) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator()
            }
        } else {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(
                        start = innerPadding.calculateStartPadding(LayoutDirection.Ltr),
                        end = innerPadding.calculateEndPadding(LayoutDirection.Ltr),
                        top = innerPadding.calculateTopPadding(),
                        bottom = if (isKeyboardVisible) 0.dp else innerPadding.calculateBottomPadding()
                    )
            ) {
                // Blue Progress Bar Loader (Visible during AI operations, document loading, or saving)
                AnimatedVisibility(visible = isActionLoading || isAIGenerating || isSaving) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(tierPrimary().copy(alpha = 0.08f))
                            .padding(vertical = 6.dp, horizontal = 16.dp)
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween,
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(bottom = 4.dp)
                        ) {
                            Text(
                                text = if (loadingMessage.isNotBlank()) loadingMessage else if (isAIGenerating) "AI is generating content..." else if (isSaving) "Saving note..." else "Processing request...",
                                style = MaterialTheme.typography.labelMedium,
                                fontWeight = FontWeight.Bold,
                                color = tierPrimary()
                            )
                            CircularProgressIndicator(
                                modifier = Modifier.size(14.dp),
                                strokeWidth = 2.dp,
                                color = tierPrimary()
                            )
                        }
                        LinearProgressIndicator(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(4.dp)
                                .clip(RoundedCornerShape(2.dp)),
                            color = tierPrimary(),
                            trackColor = tierPrimary().copy(alpha = 0.2f)
                        )
                    }
                }

                // Translated view indicator / toggle
                if (note!!.translatedText.isNotBlank()) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 12.dp, vertical = 4.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "Translation (${note!!.translatedLanguage})",
                            style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold)
                        )
                        TextButton(onClick = { viewTranslated = !viewTranslated }) {
                            Text(if (viewTranslated) "View Original" else "View Translated", fontSize = 12.sp)
                        }
                    }
                }



                val shouldShowToolbar = isKeyboardVisible || isToolbarUserVisible

                // Main Note Editor Container
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f)
                        .padding(horizontal = 12.dp, vertical = 4.dp)
                ) {
                    TiptapStyleEditor(
                        title = editTitle,
                        onTitleChange = { editTitle = it },
                        tfValue = tfValue,
                        onTfValueChange = { newTf ->
                            tfValue = newTf
                            editContent = newTf.text
                        },
                        noteDate = note?.updatedAt ?: note?.createdAt ?: System.currentTimeMillis(),
                        onWebViewCreated = { webView ->
                            editorWebView = webView
                        },
                        modifier = Modifier.fillMaxSize()
                    )

                    // Contextual Floating Action Button to toggle toolbar when keyboard is hidden
                    androidx.compose.animation.AnimatedVisibility(
                        visible = !shouldShowToolbar,
                        enter = fadeIn() + scaleIn(),
                        exit = fadeOut() + scaleOut(),
                        modifier = Modifier
                            .align(Alignment.BottomEnd)
                            .padding(16.dp)
                            .navigationBarsPadding()
                            .imePadding()
                    ) {
                        FloatingActionButton(
                            onClick = { isToolbarUserVisible = true },
                            containerColor = tierPrimary(),
                            contentColor = Color.White,
                            shape = CircleShape,
                            modifier = Modifier.testTag("floating_toolbar_toggler")
                        ) {
                            Icon(
                                imageVector = Icons.Default.Tune,
                                contentDescription = "Format & Tools"
                            )
                        }
                    }
                }

                // Inline Accessory formatting toolbar anchored above the IME keyboard or toggled manually
                AnimatedVisibility(
                    visible = shouldShowToolbar,
                    enter = slideInVertically(initialOffsetY = { it }) + fadeIn(),
                    exit = slideOutVertically(targetOffsetY = { it }) + fadeOut()
                ) {
                    TiptapFormattingToolbar(
                        modifier = Modifier
                            .fillMaxWidth()
                            .navigationBarsPadding()
                            .imePadding(),
                        onUndo = { performUndo() },
                        onRedo = { performRedo() },
                        canUndo = undoStack.size > 1,
                        canRedo = redoStack.isNotEmpty(),
                        onCloseToolbar = { isToolbarUserVisible = false },
                        onInsertTable = {
                            showTableConfigDialog = true
                        },
                        onApplyFormatting = { prefix, suffix ->
                            recordUndoState(editTitle, editContent)
                            val jsCmd = when (prefix) {
                                "**" -> "javascript:toggleFormat('bold');"
                                "*" -> "javascript:toggleFormat('italic');"
                                "__" -> "javascript:toggleFormat('underline');"
                                "~~" -> "javascript:toggleFormat('strike');"
                                "==" -> "javascript:toggleFormat('background', '#fef08a');"
                                else -> null
                            }
                            if (editorWebView != null && jsCmd != null) {
                                editorWebView?.evaluateJavascript(jsCmd, null)
                            } else {
                                val newTf = applyFormattingToTfValue(tfValue, prefix, suffix)
                                tfValue = newTf
                                editContent = newTf.text
                            }
                        },
                        onApplyPrefix = { prefix ->
                            recordUndoState(editTitle, editContent)
                            val jsCmd = when (prefix) {
                                "# " -> "javascript:toggleFormat('header', 1);"
                                "## " -> "javascript:toggleFormat('header', 2);"
                                "### " -> "javascript:toggleFormat('header', 3);"
                                "- " -> "javascript:toggleFormat('list', 'bullet');"
                                "- [ ] " -> "javascript:toggleFormat('list', 'unchecked');"
                                "> " -> "javascript:toggleFormat('blockquote');"
                                "```" -> "javascript:toggleFormat('code-block');"
                                else -> null
                            }
                            if (editorWebView != null && jsCmd != null) {
                                editorWebView?.evaluateJavascript(jsCmd, null)
                            } else {
                                val newTf = applyLinePrefixToTfValue(tfValue, prefix)
                                tfValue = newTf
                                editContent = newTf.text
                            }
                        },
                        onTriggerAICopilot = { showCopilotDialog = true },
                        onGenerateDiagram = {
                            showDiagramConfigDialog = true
                        },
                        onSpeechToText = {
                            try {
                                val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                                    putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                                    putExtra(RecognizerIntent.EXTRA_PROMPT, "Speak to type in your note...")
                                }
                                speechRecognizerLauncher.launch(intent)
                            } catch (e: Exception) {
                                coroutineScope.launch {
                                    snackbarHostState.showSnackbar("Speech recognition is not available: ${e.message}")
                                }
                            }
                        },
                        onImageInsertion = {
                            try {
                                imagePickerLauncher.launch("image/*")
                            } catch (e: Exception) {
                                coroutineScope.launch {
                                    snackbarHostState.showSnackbar("Image picker is not available: ${e.message}")
                                }
                            }
                        },
                        onSigning = {
                            showSignatureDialog = true
                        }
                    )
                }
            }
        }
    }

    // Translation Dialog
    if (showTranslateDialog) {
        val languages = listOf("Spanish", "French", "German", "Chinese", "Japanese", "Korean", "Hindi", "Arabic", "Portuguese")
        AlertDialog(
            onDismissRequest = { showTranslateDialog = false },
            title = { Text("Translate Study Note 🌐", fontWeight = FontWeight.Bold) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Select target language:", style = MaterialTheme.typography.bodyMedium)
                    languages.forEach { lang ->
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { selectedLanguage = lang }
                                .padding(vertical = 4.dp)
                        ) {
                            RadioButton(
                                selected = selectedLanguage == lang,
                                onClick = { selectedLanguage = lang }
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(lang, style = MaterialTheme.typography.bodyMedium)
                        }
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        showTranslateDialog = false
                        coroutineScope.launch {
                            val updated = repository.translateNote(noteId, selectedLanguage)
                            if (updated != null) {
                                note = updated
                                viewTranslated = true
                                snackbarHostState.showSnackbar("Translated to $selectedLanguage!")
                            }
                        }
                    }
                ) {
                    Text("Translate")
                }
            },
            dismissButton = {
                TextButton(onClick = { showTranslateDialog = false }) {
                    Text("Cancel")
                }
            }
        )
    }

    // Table Configuration Popup Dialog
    if (showTableConfigDialog) {
        AlertDialog(
            onDismissRequest = { showTableConfigDialog = false },
            title = { Text("Configure & Insert Table 📊", fontWeight = FontWeight.Bold) },
            text = {
                Column(
                    modifier = Modifier.fillMaxWidth(),
                    verticalArrangement = Arrangement.spacedBy(14.dp)
                ) {
                    Text("Select dimensions for your table:", style = MaterialTheme.typography.bodyMedium)
                    
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("Rows ($tableRows)", fontWeight = FontWeight.SemiBold)
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            IconButton(onClick = { if (tableRows > 1) tableRows-- }) {
                                Icon(Icons.Default.RemoveCircleOutline, contentDescription = "Decrease Rows")
                            }
                            Text("$tableRows", fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 8.dp))
                            IconButton(onClick = { if (tableRows < 12) tableRows++ }) {
                                Icon(Icons.Default.AddCircleOutline, contentDescription = "Increase Rows")
                            }
                        }
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("Columns ($tableCols)", fontWeight = FontWeight.SemiBold)
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            IconButton(onClick = { if (tableCols > 1) tableCols-- }) {
                                Icon(Icons.Default.RemoveCircleOutline, contentDescription = "Decrease Columns")
                            }
                            Text("$tableCols", fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 8.dp))
                            IconButton(onClick = { if (tableCols < 12) tableCols++ }) {
                                Icon(Icons.Default.AddCircleOutline, contentDescription = "Increase Columns")
                            }
                        }
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("Include Header Row", style = MaterialTheme.typography.bodyMedium)
                        Switch(
                            checked = tableHeaderRow,
                            onCheckedChange = { tableHeaderRow = it }
                        )
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        showTableConfigDialog = false
                        recordUndoState(editTitle, editContent)
                        val sb = StringBuilder()
                        sb.append("<table>")
                        if (tableHeaderRow) {
                            sb.append("<thead><tr>")
                            for (c in 1..tableCols) {
                                sb.append("<th>Header $c</th>")
                            }
                            sb.append("</tr></thead>")
                        }
                        sb.append("<tbody>")
                        val startRow = if (tableHeaderRow) 1 else 1
                        val endRow = if (tableHeaderRow) (tableRows - 1).coerceAtLeast(1) else tableRows
                        for (r in 1..endRow) {
                            sb.append("<tr>")
                            for (c in 1..tableCols) {
                                sb.append("<td>Cell $r-$c</td>")
                            }
                            sb.append("</tr>")
                        }
                        sb.append("</tbody></table><p><br></p>")
                        val tableHtml = sb.toString()

                        if (editorWebView != null) {
                            val escapedHtml = tableHtml.replace("\n", "").replace("\r", "")
                            editorWebView?.evaluateJavascript("javascript:insertHtmlSnippet('$escapedHtml');", null)
                        } else {
                            val updatedText = editContent + "\n\n$tableHtml\n\n"
                            tfValue = TextFieldValue(updatedText, TextRange(updatedText.length))
                            editContent = updatedText
                        }
                        coroutineScope.launch {
                            snackbarHostState.showSnackbar("Inserted $tableRows x $tableCols table into note!")
                        }
                    }
                ) {
                    Text("Insert Table")
                }
            },
            dismissButton = {
                TextButton(onClick = { showTableConfigDialog = false }) {
                    Text("Cancel")
                }
            }
        )
    }

    // Diagram Configuration Popup Dialog
    if (showDiagramConfigDialog) {
        val diagramOptions = listOf(
            "mermaid_flowchart" to "🔀 Mermaid Flowchart Diagram",
            "mermaid_sequence" to "🔄 Mermaid Sequence Diagram",
            "mermaid_mindmap" to "🧠 Mermaid Concept Mindmap",
            "chartjs_bar" to "📊 Chart.js Bar Chart Data",
            "chartjs_pie" to "🥧 Chart.js Pie Chart Data",
            "dot_graph" to "🕸️ Graphviz DOT Digraph"
        )

        AlertDialog(
            onDismissRequest = { showDiagramConfigDialog = false },
            title = { Text("Generate Visual Diagram 📈", fontWeight = FontWeight.Bold) },
            text = {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .heightIn(max = 400.dp)
                        .verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Text("Select Diagram Engine & Type:", style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold)
                    diagramOptions.forEach { (typeKey, label) ->
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { selectedDiagramType = typeKey }
                                .padding(vertical = 4.dp)
                        ) {
                            RadioButton(
                                selected = selectedDiagramType == typeKey,
                                onClick = { selectedDiagramType = typeKey }
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(label, style = MaterialTheme.typography.bodyMedium, fontSize = 13.sp)
                        }
                    }

                    Spacer(modifier = Modifier.height(4.dp))
                    OutlinedTextField(
                        value = diagramPromptInstruction,
                        onValueChange = { diagramPromptInstruction = it },
                        placeholder = { Text("e.g. Draw a flowchart showing the CPU instruction cycle...") },
                        label = { Text("Custom Prompt (Optional)") },
                        modifier = Modifier.fillMaxWidth(),
                        maxLines = 3
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        showDiagramConfigDialog = false
                        coroutineScope.launch {
                            try {
                                recordUndoState(editTitle, editContent)
                                val promptToUse = diagramPromptInstruction.ifBlank { "Create a visual summary diagram for this note." }
                                val diagramResult = repository.generateCustomDiagram(promptToUse, selectedDiagramType, editContent)
                                // Direct HTML snippets (chartjs canvas boxes) insert as-is; anything
                                // else (fenced mermaid/dot/chartjs markdown) goes through the converter
                                // so it renders instead of showing raw code.
                                val htmlSnippet = if (diagramResult.trimStart().startsWith("<")) {
                                    diagramResult
                                } else {
                                    MarkdownConverter.markdownToHtml(diagramResult)
                                }

                                if (editorWebView != null) {
                                    val escapedSnippet = htmlSnippet
                                        .replace("\\", "\\\\")
                                        .replace("'", "\\'")
                                        .replace("\"", "\\\"")
                                        .replace("\n", "\\n")
                                        .replace("\r", "\\r")
                                    editorWebView?.evaluateJavascript("javascript:insertHtmlSnippet('$escapedSnippet');", null)
                                } else {
                                    val updatedText = editContent + "\n\n" + diagramResult
                                    tfValue = TextFieldValue(updatedText, TextRange(updatedText.length))
                                    editContent = updatedText
                                }
                                snackbarHostState.showSnackbar("Visual diagram generated & inserted!")
                            } catch (e: Exception) {
                                snackbarHostState.showSnackbar("Diagram generation error: ${e.message}")
                            }
                        }
                    }
                ) {
                    Text("Generate & Insert")
                }
            },
            dismissButton = {
                TextButton(onClick = { showDiagramConfigDialog = false }) {
                    Text("Cancel")
                }
            }
        )
    }

    // Enhanced AI Copilot Dialog (Custom Input + Send to Chat Tutor)
    if (showCopilotDialog) {
        AlertDialog(
            onDismissRequest = { showCopilotDialog = false },
            title = { Text("Professor Ollie Copilot 🤖", fontWeight = FontWeight.Bold) },
            text = {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .heightIn(max = 420.dp)
                        .verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Text("Type custom instruction or choose pre-built action:", style = MaterialTheme.typography.bodyMedium)
                    
                    OutlinedTextField(
                        value = copilotInstruction,
                        onValueChange = { copilotInstruction = it },
                        placeholder = { Text("Ask Ollie anything or instruct what to write...") },
                        label = { Text("Custom Prompt / Instruction") },
                        modifier = Modifier.fillMaxWidth(),
                        maxLines = 3
                    )

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Button(
                            onClick = {
                                if (copilotInstruction.isBlank()) return@Button
                                showCopilotDialog = false
                                coroutineScope.launch {
                                    recordUndoState(editTitle, editContent)
                                    val generated = repository.generateAICopilotContent("custom", "$copilotInstruction\n\nContext:\n$editContent")
                                    editContent += "\n\n" + generated
                                    snackbarHostState.showSnackbar("Ollie added response to workspace!")
                                }
                            },
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(8.dp)
                        ) {
                            Text("✨ Insert Note", fontSize = 11.sp)
                        }

                        OutlinedButton(
                            onClick = {
                                showCopilotDialog = false
                                val noteToSend = note ?: NoteEntity(
                                    title = editTitle.ifBlank { "Study Note" },
                                    content = if (copilotInstruction.isNotBlank()) "User Question: $copilotInstruction\n\nNote Context:\n$editContent" else editContent
                                )
                                onDiscussWithOllie(noteToSend)
                            },
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(8.dp),
                            colors = ButtonDefaults.outlinedButtonColors(contentColor = tierPrimary())
                        ) {
                            Text("💬 Tutor Chat", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                        }
                    }

                    HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.4f))
                    Text("Quick Quick Presets:", style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold)

                    val actions = listOf(
                        "continue" to "✍️ Continue Writing Next Paragraph",
                        "expand" to "📚 Expand & Add Deep Terminology",
                        "simplify" to "💡 Explain Simply with Bullets",
                        "questions" to "❓ Generate Active Recall Questions",
                        "fix" to "✨ Fix Grammar & Polish Layout"
                    )

                    actions.forEach { (actionKey, label) ->
                        OutlinedButton(
                            onClick = {
                                showCopilotDialog = false
                                coroutineScope.launch {
                                    val generated = repository.generateAICopilotContent(actionKey, editContent)
                                    editContent += "\n\n" + generated
                                    snackbarHostState.showSnackbar("AI Copilot added content to workspace!")
                                }
                            },
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(10.dp)
                        ) {
                            Text(label, fontSize = 12.sp, modifier = Modifier.fillMaxWidth())
                        }
                    }
                }
            },
            confirmButton = {},
            dismissButton = {
                TextButton(onClick = { showCopilotDialog = false }) {
                    Text("Close")
                }
            }
        )
    }

    // Document Importer Dialog (Upload + Saved Selection)
    if (showImportDocDialog) {
        AlertDialog(
            onDismissRequest = { showImportDocDialog = false },
            title = { Text("Import & Process Document 📄", fontWeight = FontWeight.Bold) },
            text = {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .heightIn(max = 350.dp)
                        .verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Button(
                        onClick = {
                            try {
                                documentPickerLauncher.launch("*/*")
                            } catch (e: Exception) {
                                coroutineScope.launch {
                                    snackbarHostState.showSnackbar("File picker not supported on this device: ${e.message}")
                                }
                            }
                        },
                        modifier = Modifier.fillMaxWidth(),
                        colors = ButtonDefaults.buttonColors(containerColor = tierPrimary()),
                        shape = RoundedCornerShape(10.dp)
                    ) {
                        Icon(Icons.Default.UploadFile, contentDescription = null)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("📁 Upload / Choose New File", fontWeight = FontWeight.Bold)
                    }

                    HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.4f))

                    if (allDocs.isEmpty()) {
                        Text("No previously saved documents found. Tap above to upload!", style = MaterialTheme.typography.bodyMedium)
                    } else {
                        Text("Or select an existing document:", style = MaterialTheme.typography.labelMedium)
                        allDocs.forEach { doc ->
                            Card(
                                onClick = {
                                    selectedImportDoc = doc
                                    showImportDocDialog = false
                                    showDocOptionPromptDialog = true
                                },
                                shape = RoundedCornerShape(8.dp),
                                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Row(
                                    modifier = Modifier.padding(10.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Icon(Icons.Default.InsertDriveFile, contentDescription = null, tint = tierPrimary(), modifier = Modifier.size(20.dp))
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(doc.title, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                        Text("${doc.fileType.uppercase()} • ${doc.contentExtracted.length} chars", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f))
                                    }
                                }
                            }
                        }
                    }
                }
            },
            confirmButton = {},
            dismissButton = {
                TextButton(onClick = { showImportDocDialog = false }) {
                    Text("Close")
                }
            }
        )
    }

    // Document Generation Options Modal
    if (showDocOptionPromptDialog && selectedImportDoc != null) {
        val doc = selectedImportDoc!!
        AlertDialog(
            onDismissRequest = { showDocOptionPromptDialog = false },
            title = { Text("Process Document: ${doc.title} 🤖", fontWeight = FontWeight.Bold) },
            text = {
                Column(
                    modifier = Modifier.fillMaxWidth(),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Text("What would you like to generate from this document?", style = MaterialTheme.typography.bodyMedium)

                    val options = listOf(
                        "note" to "📝 Structured Full Study Note",
                        "summary" to "💡 Key Highlights & Formulas",
                        "quiz" to "❓ Practice Active Recall Questions",
                        "custom" to "🎯 Custom Generation Prompt"
                    )

                    options.forEach { (optKey, label) ->
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { docGenerationOption = optKey }
                                .padding(vertical = 4.dp)
                        ) {
                            RadioButton(
                                selected = docGenerationOption == optKey,
                                onClick = { docGenerationOption = optKey }
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(label, style = MaterialTheme.typography.bodyMedium)
                        }
                    }

                    if (docGenerationOption == "custom") {
                        OutlinedTextField(
                            value = customDocPromptInstruction,
                            onValueChange = { customDocPromptInstruction = it },
                            placeholder = { Text("e.g. Extract key equations and write example solutions...") },
                            label = { Text("Custom Instructions") },
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        showDocOptionPromptDialog = false
                        // aiScope, not coroutineScope: dismissing this dialog (and any
                        // recomposition/navigation that follows) tears down the composition scope
                        // and cancelled generation mid-request.
                        aiScope.launch {
                            isActionLoading = true
                            loadingMessage = "Professor Ollie is processing ${doc.title}..."
                            try {
                                val ext = doc.fileName.substringAfterLast('.', "").lowercase()
                                val generatedContent = if (ext in listOf("jpg", "png", "jpeg", "webp")) {
                                    val fileBytes = if (doc.localFilePath != null) {
                                        try { java.io.File(doc.localFilePath).readBytes() } catch (e: Exception) { null }
                                    } else null
                                    if (fileBytes != null && fileBytes.isNotEmpty()) {
                                        val base64Img = android.util.Base64.encodeToString(fileBytes, android.util.Base64.DEFAULT)
                                        val mime = when (ext) {
                                            "png" -> "image/png"
                                            "webp" -> "image/webp"
                                            else -> "image/jpeg"
                                        }
                                        val promptText = "Extract all text, formulas, diagrams, and key concepts cleanly from this image into structured study notes."
                                        com.example.data.remote.GeminiApiService.analyzeImage(base64Img, mime, promptText)
                                    } else {
                                        val noteResult = com.example.data.remote.BackendApiService.transformNote(resolveDocumentText(doc), "note")
                                        when (noteResult) {
                                            is com.example.data.remote.BackendResult.Success -> noteResult.data
                                            is com.example.data.remote.BackendResult.Error -> throw Exception(noteResult.message)
                                        }
                                    }
                                } else {
                                    var generatedFromEdge = ""
                                    var edgeError: String? = null
                                    try {
                                        val edgeRes = com.example.data.remote.BackendApiService.generateNoteFromDocumentBackend(
                                            docId = doc.id,
                                            option = docGenerationOption,
                                            customPrompt = customDocPromptInstruction
                                        )
                                        when (edgeRes) {
                                            is com.example.data.remote.BackendResult.Success -> {
                                                val resStr = edgeRes.data.optString("content", edgeRes.data.optString("generatedNote", edgeRes.data.optString("text", "")))
                                                if (!com.example.util.DocumentTextCleaner.isPdfRefusalError(resStr) && resStr.length > 20) {
                                                    generatedFromEdge = resStr
                                                }
                                            }
                                            is com.example.data.remote.BackendResult.Error -> {
                                                // 422 no_content/binary_content means the stored document has no
                                                // usable text. Report it instead of asking the model to write a
                                                // note anyway — that is what produced fabricated notes before.
                                                edgeError = edgeRes.message
                                                android.util.Log.w("NoteDetailScreen", "generate-note-from-document failed (${edgeRes.code}): ${edgeRes.message}")
                                            }
                                        }
                                    } catch (e: Exception) {
                                        android.util.Log.w("NoteDetailScreen", "generate-note-from-document threw: ${e.message}")
                                        edgeError = e.message
                                    }

                                    if (generatedFromEdge.isNotBlank()) {
                                        generatedFromEdge
                                    } else {
                                        val docText = resolveDocumentText(doc)
                                        if (docText.isBlank()) {
                                            // Nothing to summarise: fail loudly rather than inventing a note.
                                            throw IllegalStateException(
                                                edgeError ?: "No readable text could be extracted from ${doc.title}."
                                            )
                                        }
                                        val fallbackResult = com.example.data.remote.BackendApiService.transformNote(docText, docGenerationOption, customDocPromptInstruction)
                                        when (fallbackResult) {
                                            is com.example.data.remote.BackendResult.Success -> fallbackResult.data
                                            is com.example.data.remote.BackendResult.Error -> throw Exception(fallbackResult.message)
                                        }
                                    }
                                }

                                if (editTitle.isBlank()) editTitle = "Note: ${doc.title}"
                                editContent = generatedContent
                                editDocumentId = doc.id
                                snackbarHostState.showSnackbar("Generated study note from document ${doc.title}!")
                            } catch (e: Exception) {
                                // Surface the real reason. Silently pasting raw text here is what let
                                // an empty/unreadable document look like a successful generation.
                                android.util.Log.w("NoteDetailScreen", "Note generation failed for ${doc.title}", e)
                                val usableRaw = doc.contentExtracted.takeIf {
                                    it.isNotBlank() && !com.example.util.DocumentTextCleaner.looksLikeBinary(it)
                                }
                                if (editContent.isBlank() && usableRaw != null) {
                                    editContent = usableRaw
                                    snackbarHostState.showSnackbar("Couldn't generate a note; inserted the document's raw text instead.")
                                } else {
                                    snackbarHostState.showSnackbar(
                                        e.message ?: "Couldn't generate a note from ${doc.title}."
                                    )
                                }
                            } finally {
                                isActionLoading = false
                                loadingMessage = ""
                            }
                        }
                    }
                ) {
                    Text("Generate Note")
                }
            },
            dismissButton = {
                TextButton(onClick = { showDocOptionPromptDialog = false }) {
                    Text("Cancel")
                }
            }
        )
    }

    // Export Note Dialog (PDF, Word, Markdown, HTML, Text)
    if (showExportDialog) {
        AlertDialog(
            onDismissRequest = { showExportDialog = false },
            icon = { Icon(Icons.Default.FileDownload, contentDescription = null, tint = tierPrimary(), modifier = Modifier.size(28.dp)) },
            title = { Text("Export Note 📤", fontWeight = FontWeight.Bold) },
            text = {
                Column(
                    modifier = Modifier.fillMaxWidth(),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Text(
                        text = "Choose format to export \"${editTitle.ifBlank { "Untitled Note" }}\":",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )

                    DocumentExporter.ExportFormat.values().forEach { fmt ->
                        Card(
                            onClick = {
                                showExportDialog = false
                                val exportedFile = DocumentExporter.exportAndShare(
                                    context = context,
                                    title = editTitle,
                                    content = editContent,
                                    aiSummary = editAiSummary,
                                    format = fmt
                                )
                                if (exportedFile != null) {
                                    coroutineScope.launch {
                                        snackbarHostState.showSnackbar("Exporting as ${fmt.displayName}...")
                                    }
                                } else {
                                    coroutineScope.launch {
                                        snackbarHostState.showSnackbar("Export failed. Please try again.")
                                    }
                                }
                            },
                            shape = RoundedCornerShape(12.dp),
                            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Row(
                                modifier = Modifier.padding(14.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Surface(
                                    shape = CircleShape,
                                    color = tierPrimary().copy(alpha = 0.12f),
                                    modifier = Modifier.size(38.dp)
                                ) {
                                    Box(contentAlignment = Alignment.Center) {
                                        val icon = when (fmt) {
                                            DocumentExporter.ExportFormat.PDF -> Icons.Default.PictureAsPdf
                                            DocumentExporter.ExportFormat.WORD -> Icons.Default.Description
                                            DocumentExporter.ExportFormat.MARKDOWN -> Icons.Default.Code
                                            DocumentExporter.ExportFormat.HTML -> Icons.Default.Html
                                            DocumentExporter.ExportFormat.TEXT -> Icons.Default.TextSnippet
                                        }
                                        Icon(icon, contentDescription = null, tint = tierPrimary(), modifier = Modifier.size(20.dp))
                                    }
                                }
                                Spacer(modifier = Modifier.width(12.dp))
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        text = fmt.displayName,
                                        style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Bold)
                                    )
                                    Text(
                                        text = "Format: .${fmt.extension.uppercase()}",
                                        style = MaterialTheme.typography.labelSmall.copy(color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f))
                                    )
                                }
                                Icon(Icons.Default.ChevronRight, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                        }
                    }
                }
            },
            confirmButton = {},
            dismissButton = {
                TextButton(onClick = { showExportDialog = false }) {
                    Text("Cancel")
                }
            }
        )
    }

    if (showToolsAndDetails) {
        ModalBottomSheet(
            onDismissRequest = { showToolsAndDetails = false },
            shape = RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp),
            containerColor = MaterialTheme.colorScheme.surface
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 20.dp, vertical = 12.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // Sheet Header
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Icon(Icons.Default.Tune, contentDescription = null, tint = tierPrimary())
                        Text(
                            text = "Note Details & Settings",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold
                        )
                    }
                    IconButton(onClick = { showToolsAndDetails = false }) {
                        Icon(Icons.Default.Close, contentDescription = "Close details")
                    }
                }

                HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.4f))

                // Title, Category & Tags
                OutlinedTextField(
                    value = editTitle,
                    onValueChange = { editTitle = it },
                    label = { Text("Note Title") },
                    leadingIcon = { Icon(Icons.Default.Title, contentDescription = null) },
                    modifier = Modifier.fillMaxWidth().testTag("note_edit_title"),
                    singleLine = true
                )

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    OutlinedTextField(
                        value = editCategory,
                        onValueChange = { editCategory = it },
                        label = { Text("Category") },
                        leadingIcon = { Icon(Icons.Default.Category, contentDescription = null) },
                        modifier = Modifier.weight(1f).testTag("note_edit_category"),
                        singleLine = true
                    )

                    OutlinedTextField(
                        value = editTags,
                        onValueChange = { editTags = it },
                        label = { Text("Tags (comma separated)") },
                        leadingIcon = { Icon(Icons.Default.Label, contentDescription = null) },
                        modifier = Modifier.weight(1f).testTag("note_edit_tags"),
                        singleLine = true
                    )
                }

                // Auto-Save Workspace Toggle
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.CloudSync, contentDescription = null, tint = tierPrimary(), modifier = Modifier.size(20.dp))
                        Spacer(modifier = Modifier.width(10.dp))
                        Column {
                            Text("Auto-Save Workspace", style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold)
                            Text("Sync changes automatically every 2s", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                    Switch(
                        checked = isAutoSaveEnabled,
                        onCheckedChange = { checked ->
                            isAutoSaveEnabled = checked
                            coroutineScope.launch {
                                snackbarHostState.showSnackbar(if (checked) "⚡ Auto-save enabled" else "Auto-save disabled")
                            }
                        }
                    )
                }

                HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.3f))

                // Quick Note Actions (Pin, Favorite, Copy, Share, Delete)
                Text("Quick Actions", style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    FilterChip(
                        selected = note?.isPinned == true,
                        onClick = {
                            coroutineScope.launch {
                                note?.let { n ->
                                    val updated = n.copy(isPinned = !n.isPinned)
                                    val saved = repository.updateNote(updated)
                                    note = saved
                                    snackbarHostState.showSnackbar(if (saved.isPinned) "📌 Note pinned" else "Note unpinned")
                                }
                            }
                        },
                        label = { Text(if (note?.isPinned == true) "Pinned" else "Pin Note") },
                        leadingIcon = { Icon(Icons.Default.PushPin, contentDescription = null, modifier = Modifier.size(16.dp)) }
                    )

                    FilterChip(
                        selected = note?.isFavorite == true,
                        onClick = {
                            coroutineScope.launch {
                                note?.let { n ->
                                    val updated = n.copy(isFavorite = !n.isFavorite)
                                    val saved = repository.updateNote(updated)
                                    note = saved
                                    snackbarHostState.showSnackbar(if (saved.isFavorite) "⭐ Favorited" else "Removed from favorites")
                                }
                            }
                        },
                        label = { Text(if (note?.isFavorite == true) "Favorited" else "Favorite") },
                        leadingIcon = { Icon(Icons.Default.Star, contentDescription = null, modifier = Modifier.size(16.dp), tint = if (note?.isFavorite == true) Color(0xFFFFB300) else MaterialTheme.colorScheme.onSurfaceVariant) }
                    )

                    FilterChip(
                        selected = false,
                        onClick = {
                            clipboardManager.setText(androidx.compose.ui.text.AnnotatedString(editContent))
                            coroutineScope.launch { snackbarHostState.showSnackbar("Note text copied!") }
                        },
                        label = { Text("Copy") },
                        leadingIcon = { Icon(Icons.Default.ContentCopy, contentDescription = null, modifier = Modifier.size(16.dp)) }
                    )

                    IconButton(
                        onClick = {
                            coroutineScope.launch {
                                note?.let { repository.deleteNote(it.id) }
                                showToolsAndDetails = false
                                onNavigateBack()
                            }
                        }
                    ) {
                        Icon(Icons.Default.Delete, contentDescription = "Delete Note", tint = MaterialTheme.colorScheme.error)
                    }
                }

                // AI Flashcards & AI Quiz Generation Row
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Button(
                        onClick = {
                            showToolsAndDetails = false
                            coroutineScope.launch {
                                onNavigateToCards()
                                repository.generateFlashcardsFromNote(editTitle, editContent)
                            }
                        },
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.buttonColors(containerColor = tierTertiary()),
                        shape = RoundedCornerShape(10.dp)
                    ) {
                        Icon(Icons.Default.Style, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("Flashcards", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    }

                    Button(
                        onClick = {
                            showToolsAndDetails = false
                            coroutineScope.launch {
                                try {
                                    onNavigateToQuiz()
                                    repository.generateQuizFromTopic(editTitle, editContent)
                                } catch (e: Exception) {
                                    snackbarHostState.showSnackbar("Could not generate quiz. Try again.")
                                }
                            }
                        },
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.buttonColors(containerColor = tierAccent()),
                        shape = RoundedCornerShape(10.dp)
                    ) {
                        Icon(Icons.Default.Quiz, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("Quiz", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Color.White)
                    }
                }

                HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.3f))

                // Listen to Note (TTS) Controls
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.VolumeUp, contentDescription = null, tint = tierPrimary(), modifier = Modifier.size(20.dp))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Listen to Note (TTS)", style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold)
                    }
                    IconButton(
                        onClick = {
                            if (isSpeaking) {
                                ttsEngine?.stop()
                                isSpeaking = false
                            } else {
                                val rawNoteText = if (viewTranslated && !note?.translatedText.isNullOrBlank()) note!!.translatedText else "$editTitle.\n\n$editContent"
                                if (rawNoteText.isNotBlank() && ttsEngine != null) {
                                    isSpeaking = true
                                    coroutineScope.launch {
                                        com.example.data.local.TtsSettings.speakWithAiNarration(
                                            tts = ttsEngine!!,
                                            rawText = rawNoteText,
                                            utterancePrefix = "note_narration_${note?.id ?: "temp"}",
                                            isKid = false,
                                            onAllDone = { isSpeaking = false }
                                        )
                                    }
                                }
                            }
                        }
                    ) {
                        Icon(
                            imageVector = if (isSpeaking) Icons.Default.PauseCircle else Icons.Default.PlayCircle,
                            contentDescription = "TTS",
                            tint = tierPrimary(),
                            modifier = Modifier.size(30.dp)
                        )
                    }
                }

                // AI Summary Field & Summarize Action
                OutlinedTextField(
                    value = editAiSummary,
                    onValueChange = { editAiSummary = it },
                    label = { Text("AI Note Summary / Key Highlights") },
                    leadingIcon = { Icon(Icons.Default.AutoAwesome, contentDescription = null, tint = tierAccent()) },
                    trailingIcon = {
                        TextButton(
                            onClick = {
                                coroutineScope.launch {
                                    if (editContent.isBlank()) {
                                        snackbarHostState.showSnackbar("Write note content first!")
                                    } else {
                                        try {
                                            val summary = repository.summarizeNote(editContent)
                                            editAiSummary = summary
                                            snackbarHostState.showSnackbar("AI Summary generated!")
                                        } catch (e: Exception) {
                                            snackbarHostState.showSnackbar("Failed to generate summary.")
                                        }
                                    }
                                }
                            }
                        ) {
                            Text("✨ Summarize", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = tierAccent())
                        }
                    },
                    modifier = Modifier.fillMaxWidth(),
                    maxLines = 3
                )

                // Study Templates & Document Imports
                Card(
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text("Apply Study Template", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                            AssistChip(
                                onClick = {
                                    showToolsAndDetails = false
                                    showImportDocDialog = true
                                },
                                label = { Text("📄 Import Doc", fontSize = 11.sp, fontWeight = FontWeight.Bold) },
                                leadingIcon = { Icon(Icons.Default.UploadFile, contentDescription = null, modifier = Modifier.size(14.dp), tint = tierPrimary()) }
                            )
                        }

                        LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            item {
                                FilterChip(
                                    selected = false,
                                    onClick = {
                                        if (editTitle.isBlank()) editTitle = "Cornell Notes"
                                        editContent = """
                                            # 🎓 Cornell Notes System
                                            **Topic:** ${if (editTitle.isBlank()) "Lecture Title" else editTitle}
                                            **Date:** ${java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.getDefault()).format(java.util.Date())}

                                            ---
                                            ## 💡 Cues & Key Questions
                                            - What is the primary concept?

                                            ---
                                            ## 📝 Lecture Notes
                                            - Key point 1

                                            ---
                                            ## 🎯 Summary
                                            - Main takeaway summary.
                                        """.trimIndent()
                                        showToolsAndDetails = false
                                    },
                                    label = { Text("🎓 Cornell", fontSize = 12.sp) }
                                )
                            }
                            item {
                                FilterChip(
                                    selected = false,
                                    onClick = {
                                        if (editTitle.isBlank()) editTitle = "Lecture Summary"
                                        editContent = """
                                            # 📖 Lecture Summary: ${if (editTitle.isBlank()) "Subject Title" else editTitle}
                                            ## 📌 Core Objectives
                                            1. Key principle 1
                                            ## 🔍 Main Discussion
                                            - Concept detail
                                        """.trimIndent()
                                        showToolsAndDetails = false
                                    },
                                    label = { Text("📖 Lecture", fontSize = 12.sp) }
                                )
                            }
                            item {
                                FilterChip(
                                    selected = false,
                                    onClick = {
                                        if (editTitle.isBlank()) editTitle = "Lab Report"
                                        editCategory = "Science"
                                        editContent = """
                                            # 🧪 Lab Report & Findings
                                            **Experiment Title:** ${if (editTitle.isBlank()) "Lab #1" else editTitle}
                                            ## 🔬 Equipment & Procedure
                                            - Step 1:
                                        """.trimIndent()
                                        showToolsAndDetails = false
                                    },
                                    label = { Text("🧪 Lab Report", fontSize = 12.sp) }
                                )
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))
            }
        }
    }

    if (showSignatureDialog) {
        SignatureDrawingDialog(
            onDismiss = { showSignatureDialog = false },
            onInsertSignature = { base64Png ->
                recordUndoState(editTitle, editContent)
                val cleanBase64 = base64Png.replace("\n", "").replace("\r", "")
                if (editorWebView != null) {
                    val imgHtml = "<p><img src=\"data:image/png;base64,$cleanBase64\" style=\"max-width:100%; border-radius:8.dp; margin:8px 0;\" /></p>"
                    editorWebView?.evaluateJavascript("javascript:insertHtmlSnippet('$imgHtml');", null)
                } else {
                    val imgTag = "\n\n![Signature Drawing](data:image/png;base64,$cleanBase64)\n\n"
                    val updatedText = editContent + imgTag
                    tfValue = TextFieldValue(updatedText, TextRange(updatedText.length))
                    editContent = updatedText
                }
                showSignatureDialog = false
                coroutineScope.launch {
                    snackbarHostState.showSnackbar("Drawing inserted successfully!")
                }
            }
        )
    }
}

/**
 * Returns usable text for a document. Older uploads stored PDF bytes decoded as UTF-8, so their
 * `contentExtracted` is object-stream noise that makes the model answer "this is a raw PDF".
 * When that is detected, re-extract from the original file, which Gemini reads natively.
 */
private suspend fun resolveDocumentText(doc: DocumentEntity): String {
    val stored = doc.contentExtracted
    if (stored.isNotBlank() && !com.example.util.DocumentTextCleaner.looksLikeBinary(stored)) return stored

    val path = doc.localFilePath
    if (!path.isNullOrBlank()) {
        val bytes = try { java.io.File(path).readBytes() } catch (e: Exception) { null }
        val mime = com.example.util.DocumentTextCleaner.nativeMimeTypeFor(doc.fileName)
        if (bytes != null && bytes.isNotEmpty() && mime != null) {
            val extracted = try {
                com.example.data.remote.GeminiApiService.analyzeFile(
                    android.util.Base64.encodeToString(bytes, android.util.Base64.NO_WRAP),
                    mime,
                    "Extract ALL readable content from this document verbatim: headings, paragraphs, " +
                        "lists, tables, and formulas, in reading order, as Markdown. Do not summarise " +
                        "or comment on the file format."
                )
            } catch (e: Exception) {
                android.util.Log.w("NoteDetailScreen", "Re-extraction failed for ${doc.fileName}: ${e.message}")
                ""
            }
            if (extracted.isNotBlank() && !com.example.util.DocumentTextCleaner.looksLikeBinary(extracted)) {
                return extracted.trim()
            }
        }
    }

    return com.example.util.DocumentTextCleaner.cleanPdfOrRawText(stored, doc.title)
}

@Composable
fun SignatureDrawingDialog(
    onDismiss: () -> Unit,
    onInsertSignature: (base64Png: String) -> Unit
) {
    var lines by remember { mutableStateOf(listOf<List<Offset>>()) }
    var currentLine by remember { mutableStateOf(listOf<Offset>()) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Draw Sketch / Signature ✍️", fontWeight = FontWeight.Bold) },
        text = {
            Column(
                modifier = Modifier.fillMaxWidth(),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Text("Draw with your finger on the canvas below:", style = MaterialTheme.typography.bodyMedium)
                
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(220.dp)
                        .background(Color.White, RoundedCornerShape(12.dp))
                        .border(1.dp, MaterialTheme.colorScheme.outlineVariant, RoundedCornerShape(12.dp))
                        .pointerInput(Unit) {
                            detectDragGestures(
                                onDragStart = { offset ->
                                    currentLine = listOf(offset)
                                },
                                onDrag = { change, dragAmount ->
                                    change.consume()
                                    currentLine = currentLine + change.position
                                },
                                onDragEnd = {
                                    if (currentLine.isNotEmpty()) {
                                        lines = lines + listOf(currentLine)
                                    }
                                    currentLine = emptyList()
                                }
                            )
                        }
                ) {
                    Canvas(modifier = Modifier.fillMaxSize()) {
                        lines.forEach { line ->
                            for (i in 0 until line.size - 1) {
                                drawLine(
                                    color = Color.Black,
                                    start = line[i],
                                    end = line[i + 1],
                                    strokeWidth = 6f,
                                    cap = StrokeCap.Round
                                )
                            }
                        }
                        if (currentLine.size > 1) {
                            for (i in 0 until currentLine.size - 1) {
                                drawLine(
                                    color = Color.Black,
                                    start = currentLine[i],
                                    end = currentLine[i + 1],
                                    strokeWidth = 6f,
                                    cap = StrokeCap.Round
                                )
                            }
                        }
                    }
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End
                ) {
                    TextButton(
                        onClick = {
                            lines = emptyList()
                            currentLine = emptyList()
                        }
                    ) {
                        Text("Clear", color = MaterialTheme.colorScheme.error)
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    if (lines.isEmpty()) {
                        onDismiss()
                        return@Button
                    }
                    val bitmap = android.graphics.Bitmap.createBitmap(600, 440, android.graphics.Bitmap.Config.ARGB_8888)
                    val canvas = android.graphics.Canvas(bitmap)
                    canvas.drawColor(android.graphics.Color.WHITE)
                    
                    val paint = android.graphics.Paint().apply {
                        color = android.graphics.Color.BLACK
                        style = android.graphics.Paint.Style.STROKE
                        strokeWidth = 8f
                        strokeCap = android.graphics.Paint.Cap.ROUND
                        strokeJoin = android.graphics.Paint.Join.ROUND
                        isAntiAlias = true
                    }
                    
                    lines.forEach { line ->
                        for (i in 0 until line.size - 1) {
                            canvas.drawLine(line[i].x, line[i].y, line[i+1].x, line[i+1].y, paint)
                        }
                    }
                    
                    val outputStream = java.io.ByteArrayOutputStream()
                    bitmap.compress(android.graphics.Bitmap.CompressFormat.PNG, 100, outputStream)
                    val bytes = outputStream.toByteArray()
                    val base64String = android.util.Base64.encodeToString(bytes, android.util.Base64.DEFAULT)
                    onInsertSignature(base64String)
                }
            ) {
                Text("Insert")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel")
            }
        }
    )
}
