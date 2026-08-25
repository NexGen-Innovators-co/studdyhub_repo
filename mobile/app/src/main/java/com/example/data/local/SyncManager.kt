package com.example.data.local

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.util.Log
import com.example.data.local.entities.*
import com.example.data.remote.BackendApiService
import com.example.data.remote.BackendResult
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.io.File
import java.util.concurrent.atomic.AtomicBoolean

class SyncManager private constructor(
    private val context: Context,
    private val db: StuddyHubDatabase
) {

    private val TAG = "SyncManager"
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private val isSyncingInProgress = AtomicBoolean(false)

    private val _isSyncing = MutableStateFlow(false)
    val isSyncing = _isSyncing.asStateFlow()

    companion object {
        @Volatile
        private var INSTANCE: SyncManager? = null

        fun getInstance(context: Context, db: StuddyHubDatabase): SyncManager {
            return INSTANCE ?: synchronized(this) {
                val instance = SyncManager(context.applicationContext, db)
                INSTANCE = instance
                instance
            }
        }
    }

    init {
        registerNetworkCallback()
    }

    /**
     * Listen for network connectivity changes and automatically trigger sync when back online
     */
    private fun registerNetworkCallback() {
        try {
            val connectivityManager = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
            val networkRequest = NetworkRequest.Builder()
                .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                .build()

            connectivityManager.registerNetworkCallback(networkRequest, object : ConnectivityManager.NetworkCallback() {
                override fun onAvailable(network: Network) {
                    Log.d(TAG, "Network is available. Triggering background sync.")
                    triggerSync()
                }

                override fun onLost(network: Network) {
                    Log.d(TAG, "Network connection lost.")
                }
            })
        } catch (e: Exception) {
            Log.e(TAG, "Failed to register network callback", e)
        }
    }

    /**
     * Manually or automatically trigger processing of the sync queue.
     */
    fun triggerSync() {
        scope.launch {
            processQueue()
        }
    }

    /**
     * Main queue processing loop
     */
    private suspend fun processQueue() = withContext(Dispatchers.IO) {
        if (!isNetworkAvailable()) {
            Log.d(TAG, "Network unavailable, skipping sync queue processing.")
            return@withContext
        }

        if (!isSyncingInProgress.compareAndSet(false, true)) {
            Log.d(TAG, "Sync is already in progress.")
            return@withContext
        }

        _isSyncing.value = true
        Log.d(TAG, "Starting sync queue processing...")

        try {
            val activeUserId = getActiveUserId()
            if (activeUserId.isBlank()) {
                Log.d(TAG, "[SYNC] No authenticated user. Skipping sync queue processing.")
                return@withContext
            }

            var hasMoreItems = true
            while (hasMoreItems) {
                val currentTime = System.currentTimeMillis()
                val pendingItems = db.syncQueueDao().getPendingItems(currentTime)
                
                if (pendingItems.isEmpty()) {
                    Log.d(TAG, "No pending sync queue items left.")
                    hasMoreItems = false
                    break
                }

                Log.d(TAG, "Found ${pendingItems.size} items to sync.")
                for (item in pendingItems) {
                    // Double check network
                    if (!isNetworkAvailable()) {
                        Log.d(TAG, "Network lost mid-sync. Aborting.")
                        hasMoreItems = false
                        break
                    }

                    val success = syncItem(item)
                    if (!success) {
                        Log.e(TAG, "Failed to sync item ${item.id} (${item.entityType}). Applied backoff. Continuing with other items.")
                    }
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Unexpected error in processQueue", e)
        } finally {
            isSyncingInProgress.set(false)
            _isSyncing.value = false
            Log.d(TAG, "Sync queue processing completed.")
        }
    }

    /**
     * Process an individual sync queue item.
     * Returns true if successfully synced or discarded, false if retry is needed due to transient error.
     */
    private suspend fun syncItem(item: SyncQueueItemEntity): Boolean {
        Log.d(TAG, "Syncing queue item: ID=${item.id}, Type=${item.entityType}, Op=${item.operationType}")
        
        // Restore session from Room if BackendApiService hasn't been initialized yet
        val activeUserId = getActiveUserId()

        try {
            if (item.operationType == "DELETE") {
                val res = when (item.entityType) {
                    "document" -> BackendApiService.deleteDocument(item.entityId)
                    "note" -> BackendApiService.deleteNote(item.entityId)
                    "recording" -> BackendApiService.deleteClassRecording(item.entityId)
                    "podcast" -> BackendApiService.deleteAIPodcast(item.entityId)
                    "flashcard" -> BackendApiService.deleteFlashcard(item.entityId)
                    "social_post" -> BackendApiService.deleteSocialPost(item.entityId)
                    "quiz" -> BackendApiService.deleteQuiz(item.entityId)
                    "chat_session" -> BackendApiService.deleteChatSession(item.entityId)
                    "chat_message" -> BackendApiService.deleteChatMessage(item.entityId)
                    "course" -> BackendApiService.unenrollFromCourse(activeUserId, item.entityId)
                    "schedule" -> BackendApiService.deleteScheduleItem(item.entityId)
                    else -> BackendResult.Success(true) // Unknown type, discard
                }

                return when (res) {
                    is BackendResult.Success -> {
                        db.syncQueueDao().delete(item.id)
                        Log.d(TAG, "Successfully synced DELETE of ${item.entityType} with ID ${item.entityId}")
                        true
                    }
                    is BackendResult.Error -> {
                        handleFailure(item, res.message)
                    }
                }
            }

            // CREATE or UPDATE operation
            // Fetch single source of truth from local database
            return when (item.entityType) {
                "document" -> {
                    val doc = db.documentDao().getDocumentById(item.entityId)
                    if (doc == null) {
                        db.syncQueueDao().delete(item.id)
                        return true // Item deleted locally, discard queue item
                    }

                    // Check if file bytes are needed for upload
                    var fileBytes: ByteArray? = null
                    if (!doc.localFilePath.isNullOrBlank()) {
                        val file = File(doc.localFilePath!!)
                        if (file.exists()) {
                            fileBytes = file.readBytes()
                        }
                    }

                    val res = BackendApiService.createDocument(
                        userId = activeUserId,
                        title = doc.title,
                        fileName = doc.fileName,
                        fileType = doc.fileType,
                        fileSizeKb = doc.fileSizeKb,
                        contentExtracted = doc.contentExtracted,
                        id = doc.id,
                        rawBytes = fileBytes,
                        folderId = doc.folderId
                    )

                    return when (res) {
                        is BackendResult.Success -> {
                            val returnedUrl = res.data.optString("file_url").ifBlank { res.data.optString("fileUrl") }
                            // Pick up server-extracted content if the local copy was empty
                            // (e.g. binary file uploaded before extraction finished).
                            val cloudContent = res.data.optString("content_extracted", "").ifBlank {
                                res.data.optString("extractedText", "")
                            }
                            val updatedContent = if (doc.contentExtracted.isBlank() && cloudContent.isNotBlank()) cloudContent else doc.contentExtracted
                            // Pick up folder_id from cloud response if local was null
                            val cloudFolderId = res.data.optString("folder_id", "").ifBlank { null } ?: doc.folderId
                            db.documentDao().insertDocument(
                                doc.copy(
                                    isSynced = true,
                                    syncStatus = "SYNCED",
                                    fileUrl = returnedUrl.ifBlank { doc.fileUrl },
                                    contentExtracted = updatedContent,
                                    folderId = cloudFolderId
                                )
                            )
                            db.syncQueueDao().delete(item.id)
                            Log.d(TAG, "Successfully synced CREATE/UPDATE of document ${doc.id}")
                            true
                        }
                        is BackendResult.Error -> {
                            handleFailure(item, res.message)
                        }
                    }
                }

                "note" -> {
                    val note = db.noteDao().getNoteById(item.entityId)
                    if (note == null) {
                        db.syncQueueDao().delete(item.id)
                        return true
                    }

                    val res = BackendApiService.createNote(
                        userId = activeUserId,
                        title = note.title,
                        content = note.content,
                        category = note.category,
                        tags = note.tags,
                        aiSummary = note.aiSummary,
                        isPinned = note.isPinned,
                        isFavorite = note.isFavorite,
                        id = note.id,
                        documentId = note.documentId
                    )

                    return when (res) {
                        is BackendResult.Success -> {
                            db.noteDao().insertNote(
                                note.copy(
                                    isSynced = true,
                                    syncStatus = "SYNCED"
                                )
                            )
                            db.syncQueueDao().delete(item.id)
                            Log.d(TAG, "Successfully synced CREATE/UPDATE of note ${note.id}")
                            true
                        }
                        is BackendResult.Error -> {
                            handleFailure(item, res.message)
                        }
                    }
                }

                "flashcard" -> {
                    val card = db.flashcardDao().getFlashcardById(item.entityId)
                    if (card == null) {
                        db.syncQueueDao().delete(item.id)
                        return true
                    }

                    val res = BackendApiService.createFlashcard(
                        userId = activeUserId,
                        id = card.id,
                        front = card.front,
                        back = card.back,
                        category = card.category,
                        difficulty = card.difficulty,
                        hint = card.hint
                    )

                    return when (res) {
                        is BackendResult.Success -> {
                            db.flashcardDao().insertFlashcard(
                                card.copy(syncStatus = "SYNCED")
                            )
                            db.syncQueueDao().delete(item.id)
                            Log.d(TAG, "Successfully synced CREATE/UPDATE of flashcard ${card.id}")
                            true
                        }
                        is BackendResult.Error -> {
                            handleFailure(item, res.message)
                        }
                    }
                }

                "recording" -> {
                    val recording = db.classRecordingDao().getRecordingById(item.entityId)
                    if (recording == null) {
                        db.syncQueueDao().delete(item.id)
                        return true
                    }

                    val res = BackendApiService.createClassRecording(
                        userId = activeUserId,
                        id = recording.id,
                        title = recording.title,
                        subject = recording.subject,
                        durationSeconds = recording.durationSeconds,
                        audioUrl = recording.audioUrl,
                        transcript = recording.transcript,
                        summary = recording.summary,
                        processingStatus = recording.processingStatus
                    )

                    return when (res) {
                        is BackendResult.Success -> {
                            db.classRecordingDao().insertRecording(
                                recording.copy(syncStatus = "SYNCED")
                            )
                            db.syncQueueDao().delete(item.id)
                            Log.d(TAG, "Successfully synced CREATE/UPDATE of recording ${recording.id}")
                            true
                        }
                        is BackendResult.Error -> {
                            handleFailure(item, res.message)
                        }
                    }
                }

                "podcast" -> {
                    val podcast = db.aiPodcastDao().getPodcastById(item.entityId)
                    if (podcast == null) {
                        db.syncQueueDao().delete(item.id)
                        return true
                    }

                    val res = BackendApiService.createAIPodcast(
                        userId = activeUserId,
                        id = podcast.id,
                        title = podcast.title,
                        script = podcast.script,
                        style = podcast.style,
                        durationMinutes = podcast.durationMinutes,
                        status = podcast.status
                    )

                    return when (res) {
                        is BackendResult.Success -> {
                            db.aiPodcastDao().insertPodcast(
                                podcast.copy(syncStatus = "SYNCED")
                            )
                            db.syncQueueDao().delete(item.id)
                            Log.d(TAG, "Successfully synced CREATE/UPDATE of podcast ${podcast.id}")
                            true
                        }
                        is BackendResult.Error -> {
                            handleFailure(item, res.message)
                        }
                    }
                }

                "social_post" -> {
                    val post = db.socialPostDao().getPostById(item.entityId)
                    if (post == null) {
                        db.syncQueueDao().delete(item.id)
                        return true
                    }

                    val res = BackendApiService.createSocialPost(
                        authorId = activeUserId,
                        content = post.content,
                        category = post.category,
                        privacy = "public"
                    )

                    return when (res) {
                        is BackendResult.Success -> {
                            db.socialPostDao().insertPost(
                                post.copy(syncStatus = "SYNCED")
                            )
                            db.syncQueueDao().delete(item.id)
                            Log.d(TAG, "Successfully synced CREATE/UPDATE of social post ${post.id}")
                            true
                        }
                        is BackendResult.Error -> {
                            handleFailure(item, res.message)
                        }
                    }
                }

                "quiz" -> {
                    val quiz = db.quizDao().getQuizById(item.entityId)
                    if (quiz == null) {
                        db.syncQueueDao().delete(item.id)
                        return true
                    }

                    val res = BackendApiService.createQuiz(
                        userId = activeUserId,
                        id = quiz.id,
                        title = quiz.title,
                        sourceType = quiz.sourceType,
                        questionsJson = quiz.questionsJson
                    )

                    return when (res) {
                        is BackendResult.Success -> {
                            db.quizDao().updateQuizSyncStatus(quiz.id, "SYNCED")
                            db.syncQueueDao().delete(item.id)
                            Log.d(TAG, "Successfully synced CREATE/UPDATE of quiz ${quiz.id}")
                            true
                        }
                        is BackendResult.Error -> {
                            handleFailure(item, res.message)
                        }
                    }
                }

                "quiz_attempt" -> {
                    val attempt = db.quizDao().getAttemptById(item.entityId)
                    if (attempt == null) {
                        db.syncQueueDao().delete(item.id)
                        return true
                    }

                    // Ensure parent quiz exists on backend first to satisfy Supabase foreign key constraint (23503)
                    var parentQuiz = db.quizDao().getQuizById(attempt.quizId)
                    if (parentQuiz == null) {
                        // Create placeholder parent quiz locally so foreign keys work
                        val placeholder = QuizEntity(
                            id = attempt.quizId,
                            title = "Quiz Session",
                            sourceType = "game",
                            questionsJson = "[]"
                        )
                        db.quizDao().insertQuiz(placeholder)
                        parentQuiz = placeholder
                    }

                    if (parentQuiz != null) {
                        val quizUploadRes = BackendApiService.createQuiz(
                            userId = activeUserId,
                            id = parentQuiz.id,
                            title = parentQuiz.title,
                            sourceType = parentQuiz.sourceType,
                            questionsJson = parentQuiz.questionsJson
                        )
                        if (quizUploadRes is BackendResult.Success) {
                            db.quizDao().updateQuizSyncStatus(parentQuiz.id, "SYNCED")
                        } else if (quizUploadRes is BackendResult.Error) {
                            Log.w(TAG, "Parent quiz sync for attempt ${attempt.id} reported: ${quizUploadRes.message}")
                        }
                    }

                    val res = BackendApiService.saveQuizAttempt(
                        userId = activeUserId,
                        id = attempt.id,
                        quizId = attempt.quizId,
                        score = attempt.score,
                        totalQuestions = attempt.totalQuestions,
                        percentage = attempt.percentage,
                        timeTakenSeconds = attempt.timeTakenSeconds,
                        xpEarned = attempt.xpEarned,
                        liveResultsJson = attempt.liveResultsJson
                    )

                    return when (res) {
                        is BackendResult.Success -> {
                            db.quizDao().insertAttempt(attempt.copy(syncStatus = "SYNCED"))
                            db.syncQueueDao().delete(item.id)
                            Log.d(TAG, "Successfully synced quiz attempt ${attempt.id}")
                            true
                        }
                        is BackendResult.Error -> {
                            // If foreign key constraint failed (Postgres 23503), retry parent quiz sync and retry attempt
                            if ((res.message.contains("23503") || res.message.contains("foreign key constraint", ignoreCase = true)) && parentQuiz != null) {
                                Log.w(TAG, "Retrying quiz attempt ${attempt.id} after FK constraint...")
                                val retryQuiz = BackendApiService.createQuiz(
                                    userId = activeUserId,
                                    id = parentQuiz.id,
                                    title = parentQuiz.title,
                                    sourceType = parentQuiz.sourceType,
                                    questionsJson = parentQuiz.questionsJson
                                )
                                if (retryQuiz is BackendResult.Success) {
                                    db.quizDao().updateQuizSyncStatus(parentQuiz.id, "SYNCED")
                                    val retryAttempt = BackendApiService.saveQuizAttempt(
                                        userId = activeUserId,
                                        id = attempt.id,
                                        quizId = attempt.quizId,
                                        score = attempt.score,
                                        totalQuestions = attempt.totalQuestions,
                                        percentage = attempt.percentage,
                                        timeTakenSeconds = attempt.timeTakenSeconds,
                                        xpEarned = attempt.xpEarned,
                                        liveResultsJson = attempt.liveResultsJson
                                    )
                                    if (retryAttempt is BackendResult.Success) {
                                        db.quizDao().insertAttempt(attempt.copy(syncStatus = "SYNCED"))
                                        db.syncQueueDao().delete(item.id)
                                        Log.d(TAG, "Successfully synced quiz attempt ${attempt.id} on FK retry")
                                        return true
                                    }
                                }
                            }
                            handleFailure(item, res.message)
                        }
                    }
                }

                "chat_session" -> {
                    val session = db.chatDao().getSessionById(item.entityId)
                    if (session == null) {
                        db.syncQueueDao().delete(item.id)
                        return true
                    }

                    val res = BackendApiService.createChatSession(
                        userId = activeUserId,
                        id = session.id,
                        title = session.title
                    )

                    return when (res) {
                        is BackendResult.Success -> {
                            db.chatDao().updateSessionSyncStatus(session.id, "SYNCED")
                            db.syncQueueDao().delete(item.id)
                            Log.d(TAG, "Successfully synced chat session ${session.id}")
                            true
                        }
                        is BackendResult.Error -> {
                            handleFailure(item, res.message)
                        }
                    }
                }

                "chat_message" -> {
                    val msg = db.chatDao().getMessageById(item.entityId)
                    if (msg == null) {
                        db.syncQueueDao().delete(item.id)
                        return true
                    }

                    val res = BackendApiService.saveChatMessage(
                        id = msg.id,
                        sessionId = msg.sessionId,
                        role = msg.role,
                        content = msg.content,
                        userId = activeUserId,
                        thinkingStepsJson = msg.thinkingStepsJson
                    )

                    return when (res) {
                        is BackendResult.Success -> {
                            db.chatDao().updateMessageSyncStatus(msg.id, "SYNCED")
                            db.syncQueueDao().delete(item.id)
                            Log.d(TAG, "Successfully synced chat message ${msg.id}")
                            true
                        }
                        is BackendResult.Error -> {
                            handleFailure(item, res.message)
                        }
                    }
                }

                "course" -> {
                    val course = db.courseDao().getCourseById(item.entityId)
                    if (course == null) {
                        db.syncQueueDao().delete(item.id)
                        return true
                    }

                    val res = BackendApiService.enrollInCourse(activeUserId, course.id)

                    return when (res) {
                        is BackendResult.Success -> {
                            db.courseDao().updateCourseSyncStatus(course.id, "SYNCED")
                            db.syncQueueDao().delete(item.id)
                            Log.d(TAG, "Successfully synced course enrollment ${course.id}")
                            true
                        }
                        is BackendResult.Error -> {
                            handleFailure(item, res.message)
                        }
                    }
                }

                "schedule" -> {
                    val scheduleItem = db.scheduleDao().getScheduleItemById(item.entityId)
                    if (scheduleItem == null) {
                        db.syncQueueDao().delete(item.id)
                        return true
                    }

                    val res = BackendApiService.createScheduleItem(activeUserId, scheduleItem)

                    return when (res) {
                        is BackendResult.Success -> {
                            db.scheduleDao().updateScheduleSyncStatus(scheduleItem.id, "SYNCED")
                            db.syncQueueDao().delete(item.id)
                            Log.d(TAG, "Successfully synced schedule item ${scheduleItem.id}")
                            true
                        }
                        is BackendResult.Error -> {
                            handleFailure(item, res.message)
                        }
                    }
                }

                else -> {
                    // Unknown entity type, remove to prevent blocking queue
                    db.syncQueueDao().delete(item.id)
                    true
                }
            }

        } catch (e: Exception) {
            Log.e(TAG, "Exception during sync of item ${item.id}", e)
            return handleFailure(item, e.message ?: "Unknown exception")
        }
    }

    /**
     * Apply exponential backoff and update sync queue item status.
     * Capped retryCount at 5. Marks FAILED once limit is hit.
     */
    private suspend fun handleFailure(item: SyncQueueItemEntity, errorMessage: String?): Boolean {
        val newRetryCount = item.retryCount + 1
        val isFinalFailure = newRetryCount >= item.maxRetries
        
        // Exponential backoff calculation: retry 1 -> 30s, 2 -> 2min, 3 -> 8min, 4 -> 32min, etc.
        val backoffSeconds = 30L * (1 shl (newRetryCount - 1))
        val nextRetryAt = System.currentTimeMillis() + (backoffSeconds * 1000)

        val updatedItem = item.copy(
            retryCount = newRetryCount,
            nextRetryAt = nextRetryAt,
            status = if (isFinalFailure) "FAILED" else "PENDING",
            errorMessage = errorMessage
        )

        db.syncQueueDao().insertOrUpdate(updatedItem)

        // Propagate failure state to the original entity so it is visible to the user
        if (isFinalFailure) {
            markEntityAsFailed(item.entityType, item.entityId)
        }
        return isFinalFailure
    }

    /**
     * Propagates a "FAILED" sync status directly to the entity table
     */
    private suspend fun markEntityAsFailed(entityType: String, entityId: String) {
        try {
            when (entityType) {
                "document" -> {
                    val doc = db.documentDao().getDocumentById(entityId)
                    if (doc != null) db.documentDao().insertDocument(doc.copy(syncStatus = "FAILED"))
                }
                "note" -> {
                    val note = db.noteDao().getNoteById(entityId)
                    if (note != null) db.noteDao().insertNote(note.copy(syncStatus = "FAILED"))
                }
                "flashcard" -> {
                    val card = db.flashcardDao().getFlashcardById(entityId)
                    if (card != null) db.flashcardDao().insertFlashcard(card.copy(syncStatus = "FAILED"))
                }
                "recording" -> {
                    val recording = db.classRecordingDao().getRecordingById(entityId)
                    if (recording != null) db.classRecordingDao().insertRecording(recording.copy(syncStatus = "FAILED"))
                }
                "podcast" -> {
                    val podcast = db.aiPodcastDao().getPodcastById(entityId)
                    if (podcast != null) db.aiPodcastDao().insertPodcast(podcast.copy(syncStatus = "FAILED"))
                }
                "social_post" -> {
                    val post = db.socialPostDao().getPostById(entityId)
                    if (post != null) db.socialPostDao().insertPost(post.copy(syncStatus = "FAILED"))
                }
                "quiz" -> {
                    db.quizDao().updateQuizSyncStatus(entityId, "FAILED")
                }
                "quiz_attempt" -> {
                    // Quiz attempts are immutable; no need to mark as failed
                }
                "chat_session" -> {
                    db.chatDao().updateSessionSyncStatus(entityId, "FAILED")
                }
                "chat_message" -> {
                    db.chatDao().updateMessageSyncStatus(entityId, "FAILED")
                }
                "course" -> {
                    db.courseDao().updateCourseSyncStatus(entityId, "FAILED")
                }
                "schedule" -> {
                    db.scheduleDao().updateScheduleSyncStatus(entityId, "FAILED")
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error marking entity $entityId as FAILED", e)
        }
    }

    /**
     * Get the active user ID, restoring session from Room if BackendApiService
     * hasn't been initialized yet (e.g. sync was triggered before Splash restored the session).
     */
    private suspend fun getActiveUserId(): String {
        val current = BackendApiService.currentUserId
        if (!current.isNullOrBlank()) {
            return current
        }
        // Try to restore from Room
        val profile = db.profileDao().getProfileDirect()
        if (profile != null && profile.isLoggedIn) {
            val restoredId = profile.supabaseUserId.ifBlank { profile.id }
            if (restoredId.isNotBlank()) {
                BackendApiService.currentUserId = restoredId
                if (profile.accessToken.isNotBlank()) {
                    BackendApiService.userAccessToken = profile.accessToken
                }
                if (profile.refreshToken.isNotBlank()) {
                    BackendApiService.refreshToken = profile.refreshToken
                }
                if (profile.tokenExpiresAt > 0L) {
                    BackendApiService.tokenExpiresAt = profile.tokenExpiresAt
                }
                android.util.Log.d(TAG, "Restored user session from Room during sync: $restoredId")
                return restoredId
            }
        }
        return current ?: ""
    }

    /**
     * Resets all FAILED / retry-capped items back to PENDING and triggers an immediate sync pass.
     */
    suspend fun retryAllFailedSyncs() = withContext(Dispatchers.IO) {
        try {
            Log.d(TAG, "Resetting all failed sync items and triggering immediate retry pass.")
            db.syncQueueDao().resetAllFailedItems()
            triggerSync()
        } catch (e: Exception) {
            Log.e(TAG, "Error resetting failed sync items", e)
        }
    }

    /**
     * Simple network check using the ConnectivityManager
     */
    fun isNetworkAvailable(): Boolean {
        return try {
            val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
            val network = cm.activeNetwork ?: return false
            val capabilities = cm.getNetworkCapabilities(network) ?: return false
            capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
        } catch (e: Exception) {
            false
        }
    }
}
