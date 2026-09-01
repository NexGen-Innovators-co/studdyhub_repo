package com.example.ui.screens.aichat

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.data.local.entities.AIPodcastEntity
import com.example.data.local.entities.ChatMessageEntity
import com.example.data.local.entities.DocumentEntity
import com.example.data.local.entities.NoteEntity
import com.example.data.local.entities.ChatSessionEntity
import com.example.data.repository.StuddyHubRepository
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import kotlinx.coroutines.ExperimentalCoroutinesApi

/** Live agent-streaming state: steps + partial content for the message currently being generated. */
data class AIChatStreamingState(
    val messageId: String? = null,
    val steps: List<org.json.JSONObject> = emptyList(),
    val content: String = "",
    val active: Boolean = false
)

/** A write-action the backend blocked pending the user's explicit confirmation (Accept / Decline / Custom). */
data class AIChatConfirmation(
    val actionType: String = "DB_ACTION",
    val table: String = "",
    val operation: String = "MODIFY",
    val rowCount: Int = 1,
    val targetLabel: String? = null,
    val summary: String = "",
    val customPrompt: String = "Anything to change first?",
    val confirmLabel: String = "Yes, proceed",
    val declineLabel: String = "No, cancel"
)

private fun org.json.JSONObject.toChatConfirmation(): AIChatConfirmation = AIChatConfirmation(
    actionType = optString("actionType", "DB_ACTION"),
    table = optString("table", ""),
    operation = optString("operation", "MODIFY"),
    rowCount = optInt("rowCount", 1),
    targetLabel = optString("targetLabel").takeIf { it.isNotBlank() },
    summary = optString("summary", ""),
    customPrompt = optString("customPrompt", "Anything to change first?"),
    confirmLabel = optString("confirmLabel", "Yes, proceed"),
    declineLabel = optString("declineLabel", "No, cancel")
)

/**
 * The batched confirmation state shown while the user decides on N pending actions.
 * One ask represents ALL pending actions; a single reply resolves the whole batch.
 * A legacy per-action `confirmation_required` event is wrapped as a batch of 1.
 */
data class PendingConfirmationBatch(
    val count: Int = 1,
    val summary: String = "",
    val items: List<AIChatConfirmation> = emptyList(),
    val confirmLabel: String = "Yes, proceed",
    val declineLabel: String = "No, cancel"
)

private fun org.json.JSONObject.toPendingConfirmationBatch(): PendingConfirmationBatch {
    val items = mutableListOf<AIChatConfirmation>()
    optJSONArray("items")?.let { arr ->
        for (i in 0 until arr.length()) {
            arr.optJSONObject(i)?.let { items.add(it.toChatConfirmation()) }
        }
    }
    return PendingConfirmationBatch(
        count = optInt("count", items.size),
        summary = optString("summary", ""),
        items = items,
        confirmLabel = optString("confirmLabel", "Yes, proceed"),
        declineLabel = optString("declineLabel", "No, cancel")
    )
}

/** Wraps a legacy per-action confirmation_required payload as a batch of one. */
private fun org.json.JSONObject.toSinglePendingConfirmationBatch(): PendingConfirmationBatch =
    PendingConfirmationBatch(
        count = 1,
        summary = optString("summary", ""),
        items = listOf(toChatConfirmation()),
        confirmLabel = optString("confirmLabel", "Yes, proceed"),
        declineLabel = optString("declineLabel", "No, cancel")
    )

/**
 * A raw file the user picked in the chat composer. It is parsed (text files are decoded
 * locally, PDFs/images/Office files go through Gemini), then mirrored as a cloud document
 * so the AI edge function can resolve it by id — "ready" means it will be sent with the
 * next message, exactly like attaching one of your existing documents.
 */
data class ChatAttachedFile(
    val key: String,                // local uuid for this pick
    val fileName: String,
    val sizeKb: Int,
    val fileType: String,           // pdf | image | docx | pptx | xlsx | txt
    val status: String,             // parsing | ready | failed | processing
    val docId: String? = null,      // cloud document id once parsed+uploaded
    val statusMessage: String? = null // optional user-facing message (e.g. "processing in background")
)

data class AIChatUiState(
    val messages: List<ChatMessageEntity> = emptyList(),
    val isSending: Boolean = false,
    val userMessage: String? = null,
    val attachedNoteIds: Set<String> = emptySet(),
    val attachedDocIds: Set<String> = emptySet(),
    val allNotes: List<NoteEntity> = emptyList(),
    val allDocuments: List<DocumentEntity> = emptyList(),
    val isThinkingMode: Boolean = false,
    val isPodcastGenerating: Boolean = false,
    val lastGeneratedPodcast: AIPodcastEntity? = null,
    val allPodcasts: List<AIPodcastEntity> = emptyList(),
    val currentSessionId: String = "chat_default",
    val allSessions: List<ChatSessionEntity> = emptyList(),
    val pendingConfirmation: PendingConfirmationBatch? = null,
    val lastScrollIndex: Int = 0
)

@OptIn(ExperimentalCoroutinesApi::class)
class AIChatViewModel(private val repository: StuddyHubRepository) : ViewModel() {

    init {
        // Auto-select the latest session if the current selected session is invalid or the default placeholder
        repository.allChatSessions
            .onEach { sessions ->
                if (sessions.isNotEmpty()) {
                    val currentId = _currentSessionId.value
                    val hasCurrentSession = sessions.any { it.id == currentId }
                    val isDefaultPlaceholder = currentId == "chat_default"
                    val isDraft = currentId == "chat_default"
                    val realSessions = sessions.filter { it.id != "chat_default" }
                    // Never clobber an active draft ("chat_default"): it becomes a real
                    // session only when the user sends the first message.
                    if ((!hasCurrentSession && !isDraft) || (isDefaultPlaceholder && realSessions.isNotEmpty())) {
                        _currentSessionId.value = realSessions.firstOrNull()?.id ?: sessions.first().id
                    }
                }
            }
            .launchIn(viewModelScope)
    }

    /**
     * Called when the user navigates to the AI Chat screen. Gates the cloud sync behind
     * an authentication check so the login screen never triggers unnecessary API calls.
     */
    fun onScreenResumed() {
        // Chat data is synced once after login and updated via realtime.
        // No need to fire syncCloudDataToLocal() on every screen visit.
    }

    fun updateScrollPosition(index: Int) {
        _lastScrollIndex.value = index
    }

    private val _currentSessionId = MutableStateFlow("chat_default")
    val currentSessionId: StateFlow<String> = _currentSessionId.asStateFlow()

    val allSessions: StateFlow<List<ChatSessionEntity>> = repository.allChatSessions
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5000),
            initialValue = emptyList()
        )

    private val _isSending = MutableStateFlow(false)
    // Optimistic messages: user + AI placeholder inserted instantly into the UI before Room
    // emits. Cleared once Room catches up, preventing the flash of an empty chat list when
    // the session ID switches from "chat_default" to the newly created real session.
    private val _optimisticMessages = MutableStateFlow<List<ChatMessageEntity>>(emptyList())
    private val _streamingState = MutableStateFlow(AIChatStreamingState())
    val streamingState: StateFlow<AIChatStreamingState> = _streamingState.asStateFlow()

    // Coalesces streamed content: SSE tokens can arrive many times per second, and every
    // emission recomposes the chat list + re-parses the growing markdown. Flushing at most
    // every ~50ms keeps the reply feeling live without hammering low-end devices.
    private var streamingFlushJob: kotlinx.coroutines.Job? = null
    // Generation counter: incremented on each new stream. Prevents stale flush coroutines
    // from overwriting the streaming state after the stream has ended and been reset.
    @Volatile private var streamingGeneration: Long = 0L
    // Lock protects contentBuilder.toString() from racing with append() on IO thread.
    private val contentLock = Any()

    private fun flushStreamingContent(contentBuilder: StringBuilder, generation: Long) {
        if (streamingFlushJob?.isActive != true) {
            streamingFlushJob = viewModelScope.launch {
                delay(50)
                // Only update if this stream is still the active one
                if (generation == streamingGeneration) {
                    val snapshot = synchronized(contentLock) { contentBuilder.toString() }
                    _streamingState.value = _streamingState.value.copy(content = snapshot)
                }
            }
        }
    }
    private val _userMessage = MutableStateFlow<String?>(null)
    private val _attachedNoteIds = MutableStateFlow<Set<String>>(emptySet())
    private val _attachedDocIds = MutableStateFlow<Set<String>>(emptySet())
    private val _attachedFiles = MutableStateFlow<Map<String, ChatAttachedFile>>(emptyMap())
    private val _parsingJobs = java.util.concurrent.ConcurrentHashMap<String, kotlinx.coroutines.Job>()

    val attachedFiles: StateFlow<List<ChatAttachedFile>> = _attachedFiles
        .map { it.values.sortedByDescending { f -> f.status } }
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5000),
            initialValue = emptyList()
        )
    // Default ON so the agent's step-by-step reasoning (rendered via <thinking> blocks
    // from the edge function) is visible by default, like Claude/agent UIs. The user can
    // toggle it off with the 🧠 button in the chat input bar.
    private val _isThinkingMode = MutableStateFlow(true)
    private val _isPodcastGenerating = MutableStateFlow(false)
    private val _lastGeneratedPodcast = MutableStateFlow<AIPodcastEntity?>(null)
    private val _pendingConfirmation = MutableStateFlow<PendingConfirmationBatch?>(null)
    private val _lastScrollIndex = MutableStateFlow(0)

    private val localState = combine(
        _isSending,
        _userMessage,
        _attachedNoteIds,
        _attachedDocIds,
        _isThinkingMode,
        _isPodcastGenerating,
        _lastGeneratedPodcast,
        _currentSessionId,
        _pendingConfirmation
    ) { flowsArray ->
        LocalChatState(
            sending = flowsArray[0] as Boolean,
            userMsg = flowsArray[1] as String?,
            notes = flowsArray[2] as Set<String>,
            docs = flowsArray[3] as Set<String>,
            isThinkingMode = flowsArray[4] as Boolean,
            isPodcastGenerating = flowsArray[5] as Boolean,
            lastPodcast = flowsArray[6] as AIPodcastEntity?,
            currentSessionId = flowsArray[7] as String,
            pendingConfirmation = flowsArray[8] as PendingConfirmationBatch?
        )
    }

    val uiState: StateFlow<AIChatUiState> = combine(
        _currentSessionId.flatMapLatest { repository.getChatMessages(it) },
        localState,
        repository.allNotes,
        repository.allDocuments,
        repository.allPodcasts,
        repository.allChatSessions,
        _optimisticMessages,
        _lastScrollIndex
    ) { flowsArray ->
        val msgs = flowsArray[0] as List<ChatMessageEntity>
        val local = flowsArray[1] as LocalChatState
        val repoNotes = flowsArray[2] as List<NoteEntity>
        val repoDocs = flowsArray[3] as List<DocumentEntity>
        val repoPodcasts = flowsArray[4] as List<AIPodcastEntity>
        val repoSessions = flowsArray[5] as List<ChatSessionEntity>
        val optimistic = flowsArray[6] as List<ChatMessageEntity>
        val scrollIdx = flowsArray[7] as Int

        // Merge optimistic messages with Room messages, deduped by id.
        // Optimistic entries are superseded once Room emits the real version.
        val mergedMsgs = if (optimistic.isNotEmpty()) {
            val roomIds = msgs.map { it.id }.toSet()
            val orphanedOptimistic = optimistic.filter { it.id !in roomIds }
            orphanedOptimistic + msgs
        } else {
            msgs
        }

        AIChatUiState(
            messages = mergedMsgs,
            isSending = local.sending,
            userMessage = local.userMsg,
            attachedNoteIds = local.notes,
            attachedDocIds = local.docs,
            allNotes = repoNotes,
            allDocuments = repoDocs,
            isThinkingMode = local.isThinkingMode,
            isPodcastGenerating = local.isPodcastGenerating,
            lastGeneratedPodcast = local.lastPodcast,
            allPodcasts = repoPodcasts,
            currentSessionId = local.currentSessionId,
            allSessions = repoSessions,
            pendingConfirmation = local.pendingConfirmation,
            lastScrollIndex = scrollIdx
        )
    }.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5000),
        initialValue = AIChatUiState()
    )

    fun toggleThinkingMode() {
        _isThinkingMode.value = !_isThinkingMode.value
    }

    fun toggleNoteAttachment(noteId: String) {
        val current = _attachedNoteIds.value
        _attachedNoteIds.value = if (current.contains(noteId)) {
            current - noteId
        } else {
            current + noteId
        }
    }

    fun toggleDocumentAttachment(docId: String) {
        val current = _attachedDocIds.value
        _attachedDocIds.value = if (current.contains(docId)) {
            current - docId
        } else {
            current + docId
        }
    }

    fun removeNoteAttachment(noteId: String) {
        _attachedNoteIds.value = _attachedNoteIds.value - noteId
    }

    fun removeDocumentAttachment(docId: String) {
        _attachedDocIds.value = _attachedDocIds.value - docId
    }

    /**
     * Picks + parses a raw file for the next chat message. Text-based formats are decoded
     * locally; binary formats (PDF, images, Office) go through Gemini for verbatim text
     * extraction. On success the file becomes a cloud document (same id locally + remotely)
     * and is attached like any existing document.
     */
    fun attachLocalFile(fileName: String, sizeBytes: Long, bytes: ByteArray) {
        val key = java.util.UUID.randomUUID().toString()
        val ext = fileName.substringAfterLast(".", "").lowercase()
        val fileType = when (ext) {
            "pdf" -> "pdf"
            "png", "jpg", "jpeg", "webp", "gif", "bmp" -> "image"
            "docx", "doc" -> "docx"
            "pptx", "ppt" -> "pptx"
            "xlsx", "xls", "csv" -> "xlsx"
            else -> "txt"
        }
        val textLike = setOf("txt", "md", "csv", "json", "html", "xml", "log", "text", "rtf")

        // Edge Case 1: Pre-validate file size (max 12MB limit for in-memory base64 processing)
        val maxSizeBytes = 12 * 1024 * 1024L
        if (sizeBytes > maxSizeBytes) {
            android.util.Log.w("AIChatViewModel", "File $fileName exceeds 12MB limit ($sizeBytes bytes)")
            _attachedFiles.value = _attachedFiles.value + (key to ChatAttachedFile(
                key = key,
                fileName = fileName,
                sizeKb = (sizeBytes / 1024L).toInt().coerceAtLeast(1),
                fileType = fileType,
                status = "failed"
            ))
            return
        }

        _attachedFiles.value = _attachedFiles.value + (key to ChatAttachedFile(
            key = key,
            fileName = fileName,
            sizeKb = (sizeBytes / 1024L).toInt().coerceAtLeast(1),
            fileType = fileType,
            status = "parsing"
        ))

        // Edge Case 2: Store parsing Job reference so it can be canceled if user removes attachment mid-parsing
        val job = viewModelScope.launch {
            try {
                val parsedText = if (ext in textLike) {
                    String(bytes, Charsets.UTF_8).replace("\u0000", "").trim()
                } else {
                    val mime = com.example.util.DocumentTextCleaner.nativeMimeTypeFor(fileName)
                        ?: "application/octet-stream"
                    val base64 = android.util.Base64.encodeToString(bytes, android.util.Base64.NO_WRAP)
                    val prompt = "Extract ALL readable content from this document verbatim: every heading, " +
                        "paragraph, list, table, formula, and caption, in reading order. Preserve structure as " +
                        "Markdown. Do not summarise, paraphrase, or add commentary about the file format."
                    com.example.data.remote.GeminiApiService.analyzeFile(base64, mime, prompt)
                }

                val extractionFailed = parsedText.isBlank() || com.example.util.DocumentTextCleaner.looksLikeBinary(parsedText)

                // Even if client-side extraction failed (e.g. Gemini 429), proceed to
                // createDocument — the edge function's model fallback chain may succeed
                // server-side.  The document is saved with processing_status="failed" only
                // as a last resort after ALL providers are exhausted.
                val userId = repository.getOrRestoreActiveUserId()
                val docId = java.util.UUID.randomUUID().toString()
                val baseTitle = fileName.substringBeforeLast(".").ifBlank { fileName }
                val res = com.example.data.remote.BackendApiService.createDocument(
                    userId = userId,
                    title = baseTitle,
                    fileName = fileName,
                    fileType = fileType,
                    fileSizeKb = (bytes.size / 1024L).toInt().coerceAtLeast(1),
                    contentExtracted = parsedText,
                    id = docId,
                    rawBytes = bytes
                )
                val cloudId = (res as? com.example.data.remote.BackendResult.Success)
                    ?.data?.optString("id")?.takeIf { it.isNotBlank() }
                    ?: docId

                repository.addDocument(
                    title = baseTitle,
                    fileName = fileName,
                    fileType = fileType,
                    fileSizeKb = (bytes.size / 1024L).toInt().coerceAtLeast(1),
                    content = parsedText,
                    id = cloudId,
                    markSynced = res is com.example.data.remote.BackendResult.Success,
                    rawBytes = bytes
                )

                // If client extraction failed but the document was saved to the cloud,
                // show a non-blocking message instead of "failed" — the server may be
                // processing it, or the cron watchdog will retry.
                val finalStatus = if (extractionFailed && res is com.example.data.remote.BackendResult.Success) {
                    "processing"
                } else if (extractionFailed) {
                    "failed"
                } else {
                    "ready"
                }
                val statusMessage = if (finalStatus == "processing") {
                    "Your file is being processed in the background — it will be ready shortly."
                } else null

                _attachedFiles.value = _attachedFiles.value + (key to _attachedFiles.value.getValue(key).copy(status = finalStatus, docId = cloudId, statusMessage = statusMessage))
                _attachedDocIds.value = _attachedDocIds.value + cloudId
            } catch (e: kotlinx.coroutines.CancellationException) {
                android.util.Log.d("AIChatViewModel", "Attachment parsing canceled for $key")
                throw e
            } catch (e: Exception) {
                android.util.Log.w("AIChatViewModel", "File attach failed: ${e.message}")
                _attachedFiles.value = _attachedFiles.value + (key to _attachedFiles.value.getValue(key).copy(status = "failed"))
            } finally {
                _parsingJobs.remove(key)
            }
        }
        _parsingJobs[key] = job
    }

    fun removeAttachedFile(key: String) {
        _parsingJobs.remove(key)?.cancel()
        val removed = _attachedFiles.value[key]
        removed?.docId?.let { _attachedDocIds.value = _attachedDocIds.value - it }
        _attachedFiles.value = _attachedFiles.value - key
    }

    fun deleteMessage(messageId: String) {
        viewModelScope.launch {
            repository.deleteMessage(messageId)
        }
    }

    fun clearLastGeneratedPodcast() {
        _lastGeneratedPodcast.value = null
    }

    fun generatePodcastFromAttached(title: String, style: String) {
        val notes = _attachedNoteIds.value.toList()
        val docs = _attachedDocIds.value.toList()
        if (notes.isEmpty() && docs.isEmpty()) return

        viewModelScope.launch {
            _isPodcastGenerating.value = true
            try {
                val sourceTextBuilder = StringBuilder()
                for (noteId in notes) {
                    repository.getNoteById(noteId)?.let { note ->
                        sourceTextBuilder.append("Note: ${note.title}\nContent:\n${note.content}\n\n")
                    }
                }
                for (docId in docs) {
                    repository.getDocumentById(docId)?.let { doc ->
                        sourceTextBuilder.append("Document: ${doc.title}\nContent:\n${doc.contentExtracted}\n\n")
                    }
                }
                val result = repository.generateAIPodcast(
                    title = title.ifBlank { "Study Session: ${if (notes.isNotEmpty()) "Notes" else "Docs"}" },
                    style = style,
                    sourceText = sourceTextBuilder.toString()
                )
                _lastGeneratedPodcast.value = result
            } catch (e: Exception) {
                _userMessage.value = "We couldn't create that podcast. Please try again."
            } finally {
                _isPodcastGenerating.value = false
            }
        }
    }

    fun selectSession(id: String) {
        _currentSessionId.value = id
    }

    fun createSession(title: String) {
        // Draft-only: don't persist an empty session. The first message sent will
        // materialize the real session (auto-titled from the message) via sendMessage.
        _currentSessionId.value = "chat_default"
    }

    fun startNoteSession(noteId: String, title: String) {
        viewModelScope.launch {
            val newSession = repository.createChatSession("Discuss Note: $title")
            _currentSessionId.value = newSession.id
            _attachedNoteIds.value = setOf(noteId)
            _attachedDocIds.value = emptySet()
        }
    }

    fun startDocumentSession(docId: String, title: String) {
        viewModelScope.launch {
            val newSession = repository.createChatSession("Discuss Doc: $title")
            _currentSessionId.value = newSession.id
            _attachedDocIds.value = setOf(docId)
            _attachedNoteIds.value = emptySet()
        }
    }

    fun sendMessage(text: String) {
        val thinking = _isThinkingMode.value

        // Child safety guard & message dispatcher
        viewModelScope.launch {
            _isSending.value = true
            // If any attached files are currently in 'parsing' status (e.g. image OCR in progress),
            // await their completion (up to 15 seconds) so attachedDocIds includes the parsed document context.
            val startTime = System.currentTimeMillis()
            while (_attachedFiles.value.values.any { it.status == "parsing" } && (System.currentTimeMillis() - startTime) < 15000L) {
                if (_attachedFiles.value.values.any { it.status == "failed" }) {
                    break
                }
                kotlinx.coroutines.delay(200L)
            }

            val readyFiles = _attachedFiles.value.values.filter { it.status == "ready" }
            val effectiveText = text.ifBlank {
                if (readyFiles.isEmpty() && _attachedDocIds.value.isEmpty() && _attachedNoteIds.value.isEmpty()) {
                    ""
                } else {
                    "Analyze the attached file/document and explain its key points."
                }
            }
            if (effectiveText.isBlank()) {
                _isSending.value = false
                return@launch
            }

            val notesToAttach = _attachedNoteIds.value.toList()
            val docsToAttach = _attachedDocIds.value.toList()

            val activeTier = com.example.ui.theme.AcademicTier.fromKey(repository.getProfileDirect()?.academicTier)
            if (activeTier == com.example.ui.theme.AcademicTier.EXPLORER) {
                val eval = com.example.util.ChildSafetyGuard.evaluateChildMessageSafety(effectiveText)
                if (!eval.isSafe) {
                    var activeSessionId = _currentSessionId.value
                    val existingSession = repository.getSessionById(activeSessionId)
                    if (existingSession == null || activeSessionId == "chat_default" || activeSessionId.isBlank()) {
                        val sessionTitle = if (effectiveText.length > 25) effectiveText.take(25) + "..." else effectiveText
                        val newSession = repository.createChatSession(sessionTitle.ifBlank { "Ask Ollie 🦉" })
                        activeSessionId = newSession.id
                        _currentSessionId.value = activeSessionId
                    }
                    // Insert local user message and safe Ollie reply without sending unsafe payload out
                    val userMsg = com.example.data.local.entities.ChatMessageEntity(
                        id = java.util.UUID.randomUUID().toString(),
                        sessionId = activeSessionId,
                        role = "user",
                        content = effectiveText,
                        timestamp = System.currentTimeMillis()
                    )
                    val aiMsg = com.example.data.local.entities.ChatMessageEntity(
                        id = java.util.UUID.randomUUID().toString(),
                        sessionId = activeSessionId,
                        role = "model",
                        content = eval.safeResponse ?: "🔒 Ollie wants to keep our learning fun and safe!",
                        timestamp = System.currentTimeMillis() + 10
                    )
                    repository.insertChatMessageDirect(userMsg)
                    repository.insertChatMessageDirect(aiMsg)
                    _isSending.value = false
                    return@launch
                }
            }

            // Pre-reserve the AI message id so the live streaming bubble stays attached to the
            // exact Room row the repository inserts (aiMessageIdOverride).
            val pendingAiId = java.util.UUID.randomUUID().toString()
            val steps = mutableListOf<org.json.JSONObject>()
            val contentBuilder = StringBuilder()
            val myGeneration = ++streamingGeneration
            _streamingState.value = AIChatStreamingState(messageId = pendingAiId, active = true)

            // Optimistic message: show the user's message immediately in the UI before Room
            // emits. This prevents the flash of an empty chat list when the session switches
            // from "chat_default" to the newly created real session.
            val optimisticUserId = java.util.UUID.randomUUID().toString()
            val optimisticUserMsg = com.example.data.local.entities.ChatMessageEntity(
                id = optimisticUserId,
                sessionId = _currentSessionId.value,
                role = "user",
                content = effectiveText,
                timestamp = System.currentTimeMillis()
            )
            val optimisticAiMsg = com.example.data.local.entities.ChatMessageEntity(
                id = pendingAiId,
                sessionId = _currentSessionId.value,
                role = "model",
                content = "",
                timestamp = System.currentTimeMillis() + 1
            )
            _optimisticMessages.value = listOf(optimisticUserMsg, optimisticAiMsg)

            try {
                var activeSessionId = _currentSessionId.value
                val existingSession = repository.getSessionById(activeSessionId)
                if (existingSession == null || activeSessionId == "chat_default" || activeSessionId.isBlank()) {
                    val sessionTitle = if (effectiveText.length > 25) effectiveText.take(25) + "..." else effectiveText
                    val newSession = repository.createChatSession(sessionTitle.ifBlank { "File Discussion" })
                    activeSessionId = newSession.id
                    _currentSessionId.value = activeSessionId
                }

                // Streaming path: steps + content are emitted in real time via the callbacks
                // (same SSE wire protocol the web uses) and mirrored into _streamingState.
                val responseText = repository.sendChatMessage(
                    activeSessionId, effectiveText, notesToAttach, docsToAttach,
                    isThinking = thinking,
                    aiMessageIdOverride = pendingAiId,
                    userMessageIdOverride = optimisticUserId,
                    onThinkingStep = { step ->
                        if (myGeneration == streamingGeneration) {
                            steps.add(step)
                            _streamingState.value = _streamingState.value.copy(steps = steps.toList())
                        }
                    },
                    onContentChunk = { chunk ->
                        if (myGeneration == streamingGeneration) {
                            synchronized(contentLock) { contentBuilder.append(chunk) }
                            flushStreamingContent(contentBuilder, myGeneration)
                        }
                    },
                    onConfirmationBatchRequired = { data ->
                        _pendingConfirmation.value = data.toPendingConfirmationBatch()
                    },
                    onConfirmationRequired = { data ->
                        // Legacy per-action event (older backend): wrap as a batch of 1 so
                        // the rest of the code has one code path.
                        _pendingConfirmation.value = data.toSinglePendingConfirmationBatch()
                    }
                )
                if (responseText.isBlank() || responseText.startsWith("⚠️")) {
                    _userMessage.value = "The AI couldn't finish that reply. Please check your connection and try again."
                }
                _attachedNoteIds.value = emptySet()
                _attachedDocIds.value = emptySet()
                _attachedFiles.value = emptyMap()
            } catch (e: Exception) {
                _userMessage.value = "We couldn't get a response from the AI. Please check your connection and try again."
            } finally {
                // Invalidate any pending flush coroutine BEFORE resetting state
                streamingGeneration++
                streamingFlushJob?.cancel()
                streamingFlushJob = null
                _streamingState.value = AIChatStreamingState()
                _isSending.value = false
                // Clear optimistic messages after Room has had time to emit the real ones.
                kotlinx.coroutines.delay(500)
                _optimisticMessages.value = emptyList()
            }
        }
    }

    fun clearUserMessage() {
        _userMessage.value = null
    }

    /**
     * Regenerates the last AI reply in place (same question, fresh answer) instead of appending
     * a duplicate user+AI pair like the old flow did.
     */
    fun regenerateLastReply() {
        val sessionId = _currentSessionId.value
        val thinking = _isThinkingMode.value
        viewModelScope.launch {
            _isSending.value = true
            val pendingAiId = java.util.UUID.randomUUID().toString()
            val steps = mutableListOf<org.json.JSONObject>()
            val contentBuilder = StringBuilder()
            val myGeneration = ++streamingGeneration
            _streamingState.value = AIChatStreamingState(messageId = pendingAiId, active = true)
            try {
                val responseText = repository.regenerateLastResponse(
                    sessionId, thinking,
                    aiMessageIdOverride = pendingAiId,
                    onThinkingStep = { step ->
                        if (myGeneration == streamingGeneration) {
                            steps.add(step)
                            _streamingState.value = _streamingState.value.copy(steps = steps.toList())
                        }
                    },
                    onContentChunk = { chunk ->
                        if (myGeneration == streamingGeneration) {
                            synchronized(contentLock) { contentBuilder.append(chunk) }
                            flushStreamingContent(contentBuilder, myGeneration)
                        }
                    },
                    onConfirmationBatchRequired = { data ->
                        _pendingConfirmation.value = data.toPendingConfirmationBatch()
                    },
                    onConfirmationRequired = { data ->
                        // Legacy per-action event (older backend): wrap as a batch of 1 so
                        // the rest of the code has one code path.
                        _pendingConfirmation.value = data.toSinglePendingConfirmationBatch()
                    }
                )
                if (responseText.isBlank() || responseText.startsWith("⚠️")) {
                    _userMessage.value = "The AI couldn't finish that reply. Please check your connection and try again."
                }
            } catch (e: Exception) {
                _userMessage.value = "We couldn't get a response from the AI. Please check your connection and try again."
            } finally {
                streamingGeneration++ // invalidate any in-flight streaming callbacks
                streamingFlushJob?.cancel()
                streamingFlushJob = null
                _streamingState.value = AIChatStreamingState()
                _isSending.value = false
            }
        }
    }

    /**
     * Sends the user's decision on a pending action back through the chat. The existing
     * two-stage confirmation flow (prompt-engine) recognizes the confirm/decline phrasing
     * and either re-runs the action with `confirmed: true` or cancels it.
     */
    fun respondToConfirmation(accepted: Boolean, customText: String? = null) {
        val pending = _pendingConfirmation.value ?: return
        _pendingConfirmation.value = null
        val message = when {
            // Keep the confirmation phrase in front so the planner still runs the action with
            // `confirmed: true` while incorporating the user's custom instruction.
            accepted && !customText.isNullOrBlank() -> "Yes, go ahead. ${customText.trim()}"
            !customText.isNullOrBlank() -> customText.trim()
            accepted -> "Yes, go ahead."
            else -> "No, cancel the ${pending.count} pending item(s)."
        }
        sendMessage(message)
    }

    /** Dismisses the confirmation dialog without sending any reply (action stays unexecuted). */
    fun dismissConfirmation() {
        _pendingConfirmation.value = null
    }

    fun deleteSession(sessionId: String) {
        viewModelScope.launch {
            repository.deleteChatSession(sessionId)
            // If the deleted session was the current one, switch to the latest session
            if (_currentSessionId.value == sessionId) {
                val allSessions = allSessions.value
                val remainingSessions = allSessions.filter { it.id != sessionId }
                if (remainingSessions.isNotEmpty()) {
                    _currentSessionId.value = remainingSessions.first().id
                } else {
                    // No sessions left — fall back to a draft. The first sent message
                    // creates the real session automatically.
                    _currentSessionId.value = "chat_default"
                }
            }
        }
    }

    fun renameSession(sessionId: String, newTitle: String) {
        viewModelScope.launch {
            if (newTitle.isNotBlank()) {
                repository.renameChatSession(sessionId, newTitle)
            }
        }
    }

    fun clearChatSession() {
        viewModelScope.launch {
            repository.clearChatHistory(_currentSessionId.value)
            _attachedNoteIds.value = emptySet()
            _attachedDocIds.value = emptySet()
        }
    }
}

private data class LocalChatState(
    val sending: Boolean,
    val userMsg: String?,
    val notes: Set<String>,
    val docs: Set<String>,
    val isThinkingMode: Boolean,
    val isPodcastGenerating: Boolean,
    val lastPodcast: AIPodcastEntity?,
    val currentSessionId: String,
    val pendingConfirmation: PendingConfirmationBatch?
)
