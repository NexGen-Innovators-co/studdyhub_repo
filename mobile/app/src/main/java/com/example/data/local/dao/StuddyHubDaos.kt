package com.example.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import com.example.data.local.entities.*
import kotlinx.coroutines.flow.Flow

@Dao
interface ProfileDao {
    @Query("SELECT * FROM profiles ORDER BY isLoggedIn DESC LIMIT 1")
    fun getProfile(): Flow<ProfileEntity?>

    @Query("SELECT * FROM profiles ORDER BY isLoggedIn DESC LIMIT 1")
    suspend fun getProfileDirect(): ProfileEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertOrUpdate(profile: ProfileEntity)

    @Query("DELETE FROM profiles WHERE id != :profileId")
    suspend fun deleteOtherProfiles(profileId: String)
}

@Dao
interface NoteDao {
    @Query("SELECT * FROM notes ORDER BY isPinned DESC, updatedAt DESC")
    fun getAllNotes(): Flow<List<NoteEntity>>

    @Query("SELECT * FROM notes")
    suspend fun getAllNotesDirect(): List<NoteEntity>

    @Query("SELECT * FROM notes WHERE id = :id")
    suspend fun getNoteById(id: String): NoteEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertNote(note: NoteEntity)

    @Query("DELETE FROM notes WHERE id = :id")
    suspend fun deleteNote(id: String)

    @Query("SELECT * FROM notes WHERE isSynced = 0")
    suspend fun getUnsyncedNotes(): List<NoteEntity>

    @Query("UPDATE notes SET isSynced = 1 WHERE id = :id")
    suspend fun markSynced(id: String)
}

@Dao
interface ClassRecordingDao {
    @Query("SELECT * FROM class_recordings ORDER BY dateMillis DESC")
    fun getAllRecordings(): Flow<List<ClassRecordingEntity>>

    @Query("SELECT * FROM class_recordings")
    suspend fun getAllRecordingsDirect(): List<ClassRecordingEntity>

    @Query("SELECT * FROM class_recordings WHERE id = :id")
    suspend fun getRecordingById(id: String): ClassRecordingEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertRecording(recording: ClassRecordingEntity)

    @Query("DELETE FROM class_recordings WHERE id = :id")
    suspend fun deleteRecording(id: String)

    @Query("SELECT * FROM class_recordings WHERE syncStatus != 'SYNCED'")
    suspend fun getUnsyncedRecordings(): List<ClassRecordingEntity>
}

@Dao
interface QuizDao {
    @Query("SELECT * FROM quizzes ORDER BY createdAt DESC")
    fun getAllQuizzes(): Flow<List<QuizEntity>>

    @Query("SELECT * FROM quizzes")
    suspend fun getAllQuizzesDirect(): List<QuizEntity>

    @Query("SELECT * FROM quizzes WHERE id = :id")
    suspend fun getQuizById(id: String): QuizEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertQuiz(quiz: QuizEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAttempt(attempt: QuizAttemptEntity)

    @Query("UPDATE quizzes SET syncStatus = :status WHERE id = :id")
    suspend fun updateQuizSyncStatus(id: String, status: String)

    @Query("DELETE FROM quizzes WHERE id = :id")
    suspend fun deleteQuiz(id: String)

    @Query("DELETE FROM quiz_attempts WHERE quizId = :quizId")
    suspend fun deleteAttemptsForQuiz(quizId: String)

    @Query("DELETE FROM quiz_attempts WHERE id = :id")
    suspend fun deleteAttempt(id: String)

    @Query("SELECT * FROM quiz_attempts WHERE id = :id")
    suspend fun getAttemptById(id: String): QuizAttemptEntity?

    @Query("SELECT * FROM quiz_attempts ORDER BY createdAt DESC")
    fun getAllAttempts(): Flow<List<QuizAttemptEntity>>

    @Query("SELECT * FROM quiz_attempts")
    suspend fun getAllAttemptsDirect(): List<QuizAttemptEntity>

    @Query("SELECT * FROM quizzes WHERE syncStatus != 'SYNCED'")
    suspend fun getUnsyncedQuizzes(): List<QuizEntity>

    @Query("SELECT * FROM quiz_attempts WHERE syncStatus != 'SYNCED'")
    suspend fun getUnsyncedAttempts(): List<QuizAttemptEntity>
}

@Dao
interface ScheduleDao {
    @Query("SELECT * FROM schedule_items ORDER BY startTimeMillis ASC")
    fun getAllScheduleItems(): Flow<List<ScheduleItemEntity>>

    @Query("SELECT * FROM schedule_items")
    suspend fun getAllScheduleItemsDirect(): List<ScheduleItemEntity>

    @Query("SELECT * FROM schedule_items WHERE id = :id")
    suspend fun getScheduleItemById(id: String): ScheduleItemEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertScheduleItem(item: ScheduleItemEntity)

    @Query("DELETE FROM schedule_items WHERE id = :id")
    suspend fun deleteScheduleItem(id: String)

    @Query("SELECT * FROM schedule_items WHERE syncStatus != 'SYNCED'")
    suspend fun getUnsyncedScheduleItems(): List<ScheduleItemEntity>

    @Query("UPDATE schedule_items SET syncStatus = :status WHERE id = :id")
    suspend fun updateScheduleSyncStatus(id: String, status: String)
}

@Dao
interface FlashcardDao {
    @Query("SELECT * FROM flashcards ORDER BY nextReviewAt ASC")
    fun getAllFlashcards(): Flow<List<FlashcardEntity>>

    @Query("SELECT * FROM flashcards")
    suspend fun getAllFlashcardsDirect(): List<FlashcardEntity>

    @Query("SELECT * FROM flashcards WHERE id = :id")
    suspend fun getFlashcardById(id: String): FlashcardEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertFlashcard(flashcard: FlashcardEntity)

    @Update
    suspend fun updateFlashcard(flashcard: FlashcardEntity)

    @Query("DELETE FROM flashcards WHERE id = :id")
    suspend fun deleteFlashcard(id: String)

    @Query("SELECT * FROM flashcards WHERE syncStatus != 'SYNCED'")
    suspend fun getUnsyncedFlashcards(): List<FlashcardEntity>
}

@Dao
interface DocumentDao {
    @Query("SELECT * FROM documents ORDER BY createdAt DESC")
    fun getAllDocuments(): Flow<List<DocumentEntity>>

    @Query("SELECT * FROM documents")
    suspend fun getAllDocumentsDirect(): List<DocumentEntity>

    @Query("SELECT * FROM documents WHERE id = :id")
    suspend fun getDocumentById(id: String): DocumentEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertDocument(document: DocumentEntity)

    @Query("DELETE FROM documents WHERE id = :id")
    suspend fun deleteDocument(id: String)

    @Query("SELECT * FROM documents WHERE isSynced = 0")
    suspend fun getUnsyncedDocuments(): List<DocumentEntity>

    @Query("UPDATE documents SET isSynced = 1 WHERE id = :id")
    suspend fun markSynced(id: String)

    @Query("SELECT * FROM documents WHERE folderId = :folderId ORDER BY createdAt DESC")
    fun getDocumentsByFolder(folderId: String): Flow<List<DocumentEntity>>

    @Query("UPDATE documents SET folderId = NULL WHERE folderId = :folderId")
    suspend fun clearFolderAssignments(folderId: String)
}

@Dao
interface FolderDao {
    @Query("SELECT * FROM document_folders ORDER BY name COLLATE NOCASE ASC")
    fun getAllFolders(): Flow<List<DocumentFolderEntity>>

    @Query("SELECT * FROM document_folders")
    suspend fun getAllFoldersDirect(): List<DocumentFolderEntity>

    @Query("SELECT * FROM document_folders WHERE id = :id")
    suspend fun getFolderById(id: String): DocumentFolderEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertFolder(folder: DocumentFolderEntity)

    @Query("DELETE FROM document_folders WHERE id = :id")
    suspend fun deleteFolder(id: String)

    @Query("SELECT * FROM document_folders WHERE syncStatus != 'SYNCED'")
    suspend fun getUnsyncedFolders(): List<DocumentFolderEntity>
}

@Dao
interface AIPodcastDao {
    @Query("SELECT * FROM ai_podcasts ORDER BY createdAt DESC")
    fun getAllPodcasts(): Flow<List<AIPodcastEntity>>

    @Query("SELECT * FROM ai_podcasts")
    suspend fun getAllPodcastsDirect(): List<AIPodcastEntity>

    @Query("SELECT * FROM ai_podcasts WHERE id = :id")
    suspend fun getPodcastById(id: String): AIPodcastEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertPodcast(podcast: AIPodcastEntity)

    @Query("DELETE FROM ai_podcasts WHERE id = :id")
    suspend fun deletePodcast(id: String)

    @Query("SELECT * FROM ai_podcasts WHERE syncStatus != 'SYNCED'")
    suspend fun getUnsyncedPodcasts(): List<AIPodcastEntity>
}

@Dao
interface CourseDao {
    @Query("SELECT * FROM courses ORDER BY code ASC")
    fun getAllCourses(): Flow<List<CourseEntity>>

    @Query("SELECT * FROM courses")
    suspend fun getAllCoursesDirect(): List<CourseEntity>

    @Query("SELECT * FROM courses WHERE id = :id")
    suspend fun getCourseById(id: String): CourseEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertCourse(course: CourseEntity)

    @Query("UPDATE courses SET isEnrolled = :enrolled WHERE id = :id")
    suspend fun setEnrollment(id: String, enrolled: Boolean)

    @Query("UPDATE courses SET syncStatus = :status WHERE id = :id")
    suspend fun updateCourseSyncStatus(id: String, status: String)

    @Query("SELECT * FROM courses WHERE syncStatus != 'SYNCED'")
    suspend fun getUnsyncedCourses(): List<CourseEntity>

    @Query("DELETE FROM courses WHERE id = :id")
    suspend fun deleteCourse(id: String)
}

@Dao
interface EducationDao {
    @Query("SELECT * FROM user_education_profiles LIMIT 1")
    fun getEducationProfile(): Flow<UserEducationProfileEntity?>

    @Query("SELECT * FROM user_education_profiles LIMIT 1")
    suspend fun getEducationProfileDirect(): UserEducationProfileEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertEducationProfile(profile: UserEducationProfileEntity)

    @Query("SELECT * FROM user_subjects ORDER BY category ASC, name ASC")
    fun getAllSubjects(): Flow<List<UserSubjectEntity>>

    @Query("SELECT * FROM user_subjects WHERE educationProfileId = :profileId ORDER BY category ASC, name ASC")
    fun getSubjectsForProfile(profileId: String): Flow<List<UserSubjectEntity>>

    @Query("SELECT * FROM user_subjects WHERE educationProfileId = :profileId")
    suspend fun getSubjectsForProfileDirect(profileId: String): List<UserSubjectEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertSubject(subject: UserSubjectEntity)

    @Query("DELETE FROM user_subjects WHERE educationProfileId = :profileId")
    suspend fun clearSubjects(profileId: String)
}

@Dao
interface RoadmapDao {
    @Query("SELECT * FROM roadmap_steps ORDER BY week ASC, day ASC, stepIndex ASC")
    fun getAllSteps(): Flow<List<RoadmapStepEntity>>

    @Query("SELECT * FROM roadmap_steps ORDER BY week ASC, day ASC, stepIndex ASC")
    suspend fun getAllStepsDirect(): List<RoadmapStepEntity>

    @Query("SELECT * FROM roadmap_steps WHERE id = :stepId LIMIT 1")
    suspend fun getStepById(stepId: String): RoadmapStepEntity?

    @Query("UPDATE roadmap_steps SET isCompleted = 1, completedAt = :completedAt WHERE id = :stepId")
    suspend fun markCompleted(stepId: String, completedAt: Long)

    @Query("UPDATE roadmap_steps SET lessonJson = :lessonJson WHERE id = :stepId")
    suspend fun updateLessonJson(stepId: String, lessonJson: String?)

    @Query("SELECT COUNT(*) FROM roadmap_steps")
    suspend fun countAll(): Int

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertStep(step: RoadmapStepEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertSteps(steps: List<RoadmapStepEntity>)

    @Query("DELETE FROM roadmap_steps")
    suspend fun clearAll()

    @Query("DELETE FROM roadmap_steps WHERE id = :id")
    suspend fun deleteById(id: String)
}

@Dao
interface GameProgressDao {
    @Query("SELECT * FROM game_progress WHERE gameKey = :gameKey LIMIT 1")
    fun getGameProgress(gameKey: String): Flow<GameProgressEntity?>

    @Query("SELECT * FROM game_progress WHERE gameKey = :gameKey LIMIT 1")
    suspend fun getGameProgressDirect(gameKey: String): GameProgressEntity?

    @Query("SELECT * FROM game_progress ORDER BY lastPlayedAt DESC")
    fun getAllGameProgress(): Flow<List<GameProgressEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertOrUpdate(progress: GameProgressEntity)

    @Query("DELETE FROM game_progress")
    suspend fun clearAll()
}

@Dao
interface SocialPostDao {
    @Query("SELECT * FROM social_posts ORDER BY createdAt DESC")
    fun getAllPosts(): Flow<List<SocialPostEntity>>

    @Query("SELECT * FROM social_posts")
    suspend fun getAllPostsDirect(): List<SocialPostEntity>

    @Query("SELECT * FROM social_posts WHERE id = :id")
    suspend fun getPostById(id: String): SocialPostEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertPost(post: SocialPostEntity)

    @Query("UPDATE social_posts SET likesCount = likesCount + (CASE WHEN isLiked = 1 THEN -1 ELSE 1 END), isLiked = NOT isLiked WHERE id = :id")
    suspend fun toggleLike(id: String)

    @Query("UPDATE social_posts SET isBookmarked = NOT isBookmarked WHERE id = :id")
    suspend fun toggleBookmark(id: String)

    @Query("DELETE FROM social_posts")
    suspend fun clearAll()

    @Query("DELETE FROM social_posts WHERE id = :id")
    suspend fun deletePost(id: String)

    @Query("SELECT * FROM social_posts WHERE syncStatus != 'SYNCED'")
    suspend fun getUnsyncedPosts(): List<SocialPostEntity>
}

@Dao
interface ChatDao {
    @Query("SELECT * FROM chat_sessions ORDER BY lastMessageAt DESC")
    fun getAllSessions(): Flow<List<ChatSessionEntity>>

    @Query("SELECT * FROM chat_sessions")
    suspend fun getAllSessionsDirect(): List<ChatSessionEntity>

    @Query("SELECT * FROM chat_sessions ORDER BY lastMessageAt DESC LIMIT :limit")
    suspend fun getRecentSessions(limit: Int): List<ChatSessionEntity>

    @Query("SELECT * FROM chat_sessions WHERE id = :id LIMIT 1")
    suspend fun getSessionById(id: String): ChatSessionEntity?

    /**
     * Orphaned AI placeholder rows: an assistant/model message pre-inserted with empty
     * content and never finalized (e.g. the app was killed mid-stream). Only rows older
     * than [olderThanMillis] are returned so a live in-flight placeholder is never swept.
     */
    @Query("SELECT * FROM chat_messages WHERE sessionId = :sessionId AND role IN ('model', 'assistant') AND content = '' AND syncStatus IN ('PENDING', 'FAILED') AND timestamp <= :olderThanMillis ORDER BY timestamp ASC")
    suspend fun getOrphanedPlaceholders(sessionId: String, olderThanMillis: Long): List<ChatMessageEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertSession(session: ChatSessionEntity)

    @Update
    suspend fun updateSession(session: ChatSessionEntity)

    @Query("SELECT * FROM chat_messages WHERE id = :id LIMIT 1")
    suspend fun getMessageById(id: String): ChatMessageEntity?

    @Query("SELECT * FROM chat_messages WHERE sessionId = :sessionId ORDER BY timestamp ASC")
    fun getMessagesForSession(sessionId: String): Flow<List<ChatMessageEntity>>

    @Query("SELECT * FROM chat_messages WHERE sessionId = :sessionId ORDER BY timestamp ASC")
    suspend fun getMessagesForSessionDirect(sessionId: String): List<ChatMessageEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertMessage(message: ChatMessageEntity)

    @Query("DELETE FROM chat_messages WHERE id = :id")
    suspend fun deleteMessage(id: String)

    @Query("DELETE FROM chat_messages WHERE sessionId = :sessionId")
    suspend fun clearMessagesForSession(sessionId: String)

    @Query("SELECT * FROM chat_sessions WHERE syncStatus != 'SYNCED'")
    suspend fun getUnsyncedSessions(): List<ChatSessionEntity>

    @Query("UPDATE chat_sessions SET syncStatus = :status WHERE id = :id")
    suspend fun updateSessionSyncStatus(id: String, status: String)

    @Query("UPDATE chat_messages SET syncStatus = :status WHERE id = :id")
    suspend fun updateMessageSyncStatus(id: String, status: String)

    @Query("DELETE FROM chat_sessions WHERE id = :id")
    suspend fun deleteSession(id: String)
}

@Dao
interface UserStatsDao {
    @Query("SELECT * FROM user_stats WHERE userId = :userId LIMIT 1")
    fun getUserStats(userId: String = "default_user"): Flow<UserStatsEntity?>

    @Query("SELECT * FROM user_stats WHERE userId = :userId LIMIT 1")
    suspend fun getUserStatsDirect(userId: String): UserStatsEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertOrUpdate(stats: UserStatsEntity)
}

@Dao
interface SyncQueueDao {
    @Query("SELECT * FROM sync_queue WHERE (status = 'PENDING' AND nextRetryAt <= :currentTime) OR (status = 'FAILED' AND retryCount < maxRetries AND nextRetryAt <= :currentTime) ORDER BY createdAt ASC")
    suspend fun getPendingItems(currentTime: Long): List<SyncQueueItemEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertOrUpdate(item: SyncQueueItemEntity)

    @Query("DELETE FROM sync_queue WHERE id = :id")
    suspend fun delete(id: String)

    @Query("SELECT * FROM sync_queue ORDER BY createdAt DESC")
    fun getAllItemsFlow(): Flow<List<SyncQueueItemEntity>>

    @Query("SELECT COUNT(*) FROM sync_queue WHERE status = 'PENDING' OR status = 'PROCESSING'")
    fun getPendingCountFlow(): Flow<Int>

    @Query("SELECT COUNT(*) FROM sync_queue WHERE status = 'FAILED'")
    fun getFailedCountFlow(): Flow<Int>

    @Query("UPDATE sync_queue SET status = 'PENDING', retryCount = 0, nextRetryAt = 0 WHERE status = 'FAILED' OR retryCount >= maxRetries")
    suspend fun resetAllFailedItems()
}
