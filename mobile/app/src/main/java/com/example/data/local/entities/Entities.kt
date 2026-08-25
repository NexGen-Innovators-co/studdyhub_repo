package com.example.data.local.entities

import androidx.room.Entity
import androidx.room.PrimaryKey
import java.util.UUID

@Entity(tableName = "profiles")
data class ProfileEntity(
    @PrimaryKey val id: String = UUID.randomUUID().toString(),
    val email: String = "",
    val fullName: String = "",
    val username: String = "",
    val avatarUrl: String = "",
    val learningStyle: String = "visual",
    val school: String = "",
    val academicLevel: String = "",
    val bio: String = "",
    val userRole: String = "student",
    val pointsBalance: Int = 0,
    val bonusAiCredits: Int = 0,
    val onboardingCompleted: Boolean = false,
    val isLoggedIn: Boolean = false,
    val accessToken: String = "",
    // Supabase refresh token + access-token expiry, persisted so the session can be
    // renewed silently after the app is closed/reopened (access JWTs expire ~1h).
    val refreshToken: String = "",
    val tokenExpiresAt: Long = 0L, // epoch millis when accessToken expires; 0 = unknown
    val supabaseUserId: String = "",
    val academicTier: String = ""
)

@Entity(tableName = "notes")
data class NoteEntity(
    @PrimaryKey val id: String = UUID.randomUUID().toString(),
    val title: String,
    val content: String,
    val category: String = "General",
    val tags: String = "study,ai", // Comma separated
    val aiSummary: String = "",
    val isPinned: Boolean = false,
    val isFavorite: Boolean = false,
    val translatedText: String = "",
    val translatedLanguage: String = "",
    val documentId: String? = null,
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis(),
    val isSynced: Boolean = false,
    val localFilePath: String? = null,
    val syncStatus: String = "SYNCED"
)

@Entity(tableName = "class_recordings")
data class ClassRecordingEntity(
    @PrimaryKey val id: String = UUID.randomUUID().toString(),
    val title: String,
    val subject: String,
    val durationSeconds: Int = 1800,
    val audioUrl: String = "",
    val transcript: String = "",
    val summary: String = "",
    val processingStatus: String = "completed",
    val dateMillis: Long = System.currentTimeMillis(),
    val localFilePath: String? = null,
    val syncStatus: String = "SYNCED"
)

@Entity(tableName = "quizzes")
data class QuizEntity(
    @PrimaryKey val id: String = UUID.randomUUID().toString(),
    val title: String,
    val sourceType: String = "ai", // recording, notes, ai
    val questionsJson: String = "[]",
    val createdAt: Long = System.currentTimeMillis(),
    val syncStatus: String = "SYNCED"
)

@Entity(tableName = "quiz_attempts")
data class QuizAttemptEntity(
    @PrimaryKey val id: String = UUID.randomUUID().toString(),
    val quizId: String,
    val score: Int,
    val totalQuestions: Int,
    val percentage: Int,
    val timeTakenSeconds: Int,
    val xpEarned: Int,
    val createdAt: Long = System.currentTimeMillis(),
    val syncStatus: String = "SYNCED",
    // Live-quiz result snapshot (JSON): leaderboard + per-question user answers, so the
    // full-page results view can show real rankings and question review like the web.
    val liveResultsJson: String? = null
)

@Entity(tableName = "schedule_items")
data class ScheduleItemEntity(
    @PrimaryKey val id: String = UUID.randomUUID().toString(),
    val title: String,
    val subject: String,
    val type: String = "lecture", // lecture, exam, study_session, assignment
    val startTimeMillis: Long,
    val endTimeMillis: Long,
    val location: String = "",
    val description: String = "",
    val colorHex: String = "#3B82F6",
    val isRecurring: Boolean = false,
    val recurrencePattern: String = "weekly", // daily, weekly, monthly
    val recurrenceEndDate: Long? = null,
    val recurrenceDaysOfWeek: String = "", // comma-separated days, e.g., "1,3"
    // Whether the user checked this item off. Persisted locally and queued for sync so
    // completion survives restarts (completing a study block also feeds the daily streak).
    val isCompleted: Boolean = false,
    val syncStatus: String = "SYNCED"
)

@Entity(tableName = "flashcards")
data class FlashcardEntity(
    @PrimaryKey val id: String = UUID.randomUUID().toString(),
    val noteId: String? = null,
    val front: String,
    val back: String,
    val category: String = "General",
    val difficulty: String = "medium", // easy, medium, hard
    val hint: String = "",
    val reviewCount: Int = 0,
    val nextReviewAt: Long = System.currentTimeMillis(),
    val localFilePath: String? = null,
    val syncStatus: String = "SYNCED"
)

@Entity(tableName = "documents")
data class DocumentEntity(
    @PrimaryKey val id: String = UUID.randomUUID().toString(),
    val title: String,
    val fileName: String,
    val fileType: String = "PDF",
    val fileSizeKb: Int = 0,
    val contentExtracted: String = "",
    val fileUrl: String = "",
    val createdAt: Long = System.currentTimeMillis(),
    val isSynced: Boolean = false,
    val localFilePath: String? = null,
    val syncStatus: String = "SYNCED",
    // ID of the document_folders row this document lives in (mirrors the cloud
    // documents.folder_id / folder_ids columns used by the web app).
    val folderId: String? = null
)

@Entity(tableName = "document_folders")
data class DocumentFolderEntity(
    @PrimaryKey val id: String = UUID.randomUUID().toString(),
    val name: String,
    val color: String = "#3B82F6",
    val description: String = "",
    val parentFolderId: String? = null,
    val createdAt: Long = System.currentTimeMillis(),
    val syncStatus: String = "SYNCED"
)

@Entity(tableName = "ai_podcasts")
data class AIPodcastEntity(
    @PrimaryKey val id: String = UUID.randomUUID().toString(),
    val title: String,
    val script: String,
    val durationMinutes: Int = 0,
    val style: String = "educational", // casual, educational, deep-dive
    val status: String = "completed",
    val coverImageUrl: String = "",
    val listenCount: Int = 0,
    val createdAt: Long = System.currentTimeMillis(),
    val localFilePath: String? = null,
    val syncStatus: String = "SYNCED"
)

@Entity(tableName = "courses")
data class CourseEntity(
    @PrimaryKey val id: String = UUID.randomUUID().toString(),
    val code: String,
    val title: String,
    val description: String,
    val schoolName: String = "",
    val progressPercent: Int = 0,
    val isEnrolled: Boolean = false,
    val syncStatus: String = "SYNCED"
)

@Entity(tableName = "social_posts")
data class SocialPostEntity(
    @PrimaryKey val id: String = UUID.randomUUID().toString(),
    val authorName: String,
    val authorAvatar: String = "",
    val content: String,
    val category: String = "General",
    val likesCount: Int = 0,
    val commentsCount: Int = 0,
    val sharesCount: Int = 0,
    val isLiked: Boolean = false,
    val isBookmarked: Boolean = false,
    val createdAt: Long = System.currentTimeMillis(),
    val localFilePath: String? = null,
    val syncStatus: String = "SYNCED"
)

@Entity(tableName = "chat_sessions")
data class ChatSessionEntity(
    @PrimaryKey val id: String = UUID.randomUUID().toString(),
    val title: String = "New AI Study Chat",
    val createdAt: Long = System.currentTimeMillis(),
    val lastMessageAt: Long = System.currentTimeMillis(),
    val syncStatus: String = "SYNCED"
)

@Entity(tableName = "chat_messages")
data class ChatMessageEntity(
    @PrimaryKey val id: String = UUID.randomUUID().toString(),
    val sessionId: String,
    val role: String, // user, model
    val content: String,
    val timestamp: Long = System.currentTimeMillis(),
    val syncStatus: String = "SYNCED",
    // JSON array of agent "reasoning process" steps, persisted SEPARATELY from content
    // (mirrors the cloud chat_messages.thinking_steps column). Rendered by the mobile
    // screen's collapsible Reasoning Process panel on history replay.
    val thinkingStepsJson: String? = null,
    // JSON-encoded lists of attached resource IDs for user messages.
    // Rendered as small inline capsules inside the user message bubble.
    val attachedDocumentIds: String? = null,
    val attachedNoteIds: String? = null
)

/**
 * Local mirror of the cloud `user_education_profiles` table — the resolved education
 * context (country → education level → curriculum → exam → school/grade) that powers
 * the kid onboarding, class-matched roadmap and the lifelong tier journey. The cloud
 * tables (countries, education_levels, curricula, examinations, subjects) are the
 * source of truth; display names are cached here for offline use.
 */
@Entity(tableName = "user_education_profiles")
data class UserEducationProfileEntity(
    @PrimaryKey val id: String = UUID.randomUUID().toString(),
    val userId: String = "",
    val countryId: String? = null,
    val countryCode: String = "",
    val countryName: String = "",
    val educationLevelId: String? = null,
    val levelName: String = "",
    val levelCategory: String = "",
    val curriculumId: String? = null,
    val curriculumName: String = "",
    val targetExaminationId: String? = null,
    val examName: String = "",
    val institutionName: String = "",
    val yearOrGrade: String = "",
    val goalsJson: String = "[]",
    val syncStatus: String = "SYNCED"
)

/**
 * Local mirror of the cloud `user_subjects` table — the subjects a student takes
 * (Core Four pre-selected on kid onboarding, stored as subject_id references).
 */
@Entity(tableName = "user_subjects")
data class UserSubjectEntity(
    @PrimaryKey val id: String = UUID.randomUUID().toString(),
    val educationProfileId: String = "",
    val subjectId: String = "",
    val code: String = "",
    val name: String = "",
    val category: String = "core",
    val isPrimary: Boolean = false,
    val syncStatus: String = "SYNCED"
)

/**
 * Explorer (kids) game progress — stars + unlocked levels per game. One row per
 * (user, game). Mirrors the cloud `game_progress` table (upserted on sync).
 */
@Entity(tableName = "game_progress")
data class GameProgressEntity(
    @PrimaryKey val id: String = UUID.randomUUID().toString(),
    val gameKey: String,                // ananse_riddles | maths_quest | kente_quiz | spelling_bee
    val unlockedLevel: Int = 1,         // highest level the kid can play
    val starsByLevelJson: String = "{}",  // {"1": 3, "2": 2, ...}
    val bestScoresJson: String = "{}",    // {"1": 80, "2": 65, ...} percentages
    val totalXpEarned: Int = 0,
    val lastPlayedAt: Long = System.currentTimeMillis(),
    val syncStatus: String = "SYNCED"
)

/**
 * Explorer (kids) roadmap step — one item on the kid's daily learning path
 * (lesson / practice quiz / game / review). Generated per subject after school
 * setup; mirrors the cloud `kid_roadmap_steps` table.
 */
@Entity(tableName = "roadmap_steps")
data class RoadmapStepEntity(
    @PrimaryKey val id: String = UUID.randomUUID().toString(),
    val subjectCode: String = "",      // ENG | MATH | SCI | SST | ICT ...
    val subjectName: String = "",
    val week: Int = 1,                  // 1..4
    val day: Int = 1,                   // 1..7 within the week
    val stepIndex: Int = 0,             // ordering within the day
    val title: String = "",
    val stepType: String = "lesson",    // lesson | quiz | game | review
    val refId: String? = null,          // game key (game steps)
    val xpReward: Int = 20,
    val isCompleted: Boolean = false,
    val dueDateMillis: Long? = null,
    val completedAt: Long? = null,
    val lessonJson: String? = null,     // Cached interactive lesson JSON
    val syncStatus: String = "SYNCED"
)

@Entity(tableName = "user_stats")
data class UserStatsEntity(
    @PrimaryKey val userId: String = "default_user",
    val totalXp: Int = 0,
    val level: Int = 1,
    val currentStreak: Int = 0,
    val longestStreak: Int = 0,
    val totalQuizzesAttempted: Int = 0,
    val totalQuizzesCompleted: Int = 0,
    val averageScore: Float = 0f,
    val totalStudyTimeSeconds: Int = 0,
    // Epoch millis of the most recent day the user studied. Used to decay the streak
    // when a day is skipped (see StuddyHubRepository.recordStudyActivity).
    val lastStudyDayMillis: Long = 0L,
    // Explorer (kids): streak freezes bought from the credits store (streak calendar shows them).
    val streakFreezes: Int = 0,
    // Explorer (kids): ISO date (yyyy-MM-dd) of the last claimed Daily Quest reward.
    val lastDailyQuestClaimedDate: String = "",
    val badgesEarned: String = "",
    val hasClaimedFirstQuestBonus: Boolean = false,
    val lastActivityDate: String? = null
)

@Entity(tableName = "sync_queue")
data class SyncQueueItemEntity(
    @PrimaryKey val id: String = UUID.randomUUID().toString(),
    val entityType: String, // "document", "note", "flashcard", "recording", "podcast", "social_post", "quiz", "quiz_attempt", "chat_session", "chat_message", "course", "schedule"
    val entityId: String,   // ID of the target entity
    val operationType: String, // "CREATE", "UPDATE", "DELETE"
    val serializedData: String = "", // JSON serialization of the data to sync
    val filePathToUpload: String? = null, // If there's a local file that needs uploading
    val retryCount: Int = 0,
    val maxRetries: Int = 5,
    val nextRetryAt: Long = 0L,
    val status: String = "PENDING", // PENDING, PROCESSING, FAILED
    val errorMessage: String? = null,
    val createdAt: Long = System.currentTimeMillis()
)
