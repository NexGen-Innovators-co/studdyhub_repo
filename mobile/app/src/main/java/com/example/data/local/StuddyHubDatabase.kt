package com.example.data.local

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase
import com.example.data.local.dao.*
import com.example.data.local.entities.*


@Database(
    entities = [
        ProfileEntity::class,
        NoteEntity::class,
        ClassRecordingEntity::class,
        QuizEntity::class,
        QuizAttemptEntity::class,
        ScheduleItemEntity::class,
        FlashcardEntity::class,
        DocumentEntity::class,
        AIPodcastEntity::class,
        CourseEntity::class,
        SocialPostEntity::class,
        ChatSessionEntity::class,
        ChatMessageEntity::class,
        UserStatsEntity::class,
        SyncQueueItemEntity::class,
        DocumentFolderEntity::class,
        UserEducationProfileEntity::class,
        UserSubjectEntity::class,
        GameProgressEntity::class,
        RoadmapStepEntity::class
    ],
    version = 24,
    exportSchema = false
)
abstract class StuddyHubDatabase : RoomDatabase() {

    abstract fun profileDao(): ProfileDao
    abstract fun noteDao(): NoteDao
    abstract fun classRecordingDao(): ClassRecordingDao
    abstract fun quizDao(): QuizDao
    abstract fun scheduleDao(): ScheduleDao
    abstract fun flashcardDao(): FlashcardDao
    abstract fun documentDao(): DocumentDao
    abstract fun folderDao(): FolderDao
    abstract fun aiPodcastDao(): AIPodcastDao
    abstract fun courseDao(): CourseDao
    abstract fun educationDao(): EducationDao
    abstract fun gameProgressDao(): GameProgressDao
    abstract fun roadmapDao(): RoadmapDao
    abstract fun socialPostDao(): SocialPostDao
    abstract fun chatDao(): ChatDao
    abstract fun userStatsDao(): UserStatsDao
    abstract fun syncQueueDao(): SyncQueueDao

    companion object {
        @Volatile
        private var INSTANCE: StuddyHubDatabase? = null

        val MIGRATION_7_8 = object : Migration(7, 8) {
            override fun migrate(db: SupportSQLiteDatabase) {
                // Create sync_queue table
                db.execSQL("""
                    CREATE TABLE IF NOT EXISTS `sync_queue` (
                        `id` TEXT NOT NULL, 
                        `entityType` TEXT NOT NULL, 
                        `entityId` TEXT NOT NULL, 
                        `operationType` TEXT NOT NULL, 
                        `serializedData` TEXT NOT NULL, 
                        `filePathToUpload` TEXT, 
                        `retryCount` INTEGER NOT NULL, 
                        `maxRetries` INTEGER NOT NULL, 
                        `nextRetryAt` INTEGER NOT NULL, 
                        `status` TEXT NOT NULL, 
                        `errorMessage` TEXT, 
                        `createdAt` INTEGER NOT NULL, 
                        PRIMARY KEY(`id`)
                    )
                """.trimIndent())

                // Add columns to notes
                db.execSQL("ALTER TABLE `notes` ADD COLUMN `localFilePath` TEXT DEFAULT NULL")
                db.execSQL("ALTER TABLE `notes` ADD COLUMN `syncStatus` TEXT NOT NULL DEFAULT 'SYNCED'")

                // Add columns to class_recordings
                db.execSQL("ALTER TABLE `class_recordings` ADD COLUMN `localFilePath` TEXT DEFAULT NULL")
                db.execSQL("ALTER TABLE `class_recordings` ADD COLUMN `syncStatus` TEXT NOT NULL DEFAULT 'SYNCED'")

                // Add columns to flashcards
                db.execSQL("ALTER TABLE `flashcards` ADD COLUMN `localFilePath` TEXT DEFAULT NULL")
                db.execSQL("ALTER TABLE `flashcards` ADD COLUMN `syncStatus` TEXT NOT NULL DEFAULT 'SYNCED'")

                // Add columns to documents
                db.execSQL("ALTER TABLE `documents` ADD COLUMN `localFilePath` TEXT DEFAULT NULL")
                db.execSQL("ALTER TABLE `documents` ADD COLUMN `syncStatus` TEXT NOT NULL DEFAULT 'SYNCED'")

                // Add columns to ai_podcasts
                db.execSQL("ALTER TABLE `ai_podcasts` ADD COLUMN `localFilePath` TEXT DEFAULT NULL")
                db.execSQL("ALTER TABLE `ai_podcasts` ADD COLUMN `syncStatus` TEXT NOT NULL DEFAULT 'SYNCED'")

                // Add columns to social_posts
                db.execSQL("ALTER TABLE `social_posts` ADD COLUMN `localFilePath` TEXT DEFAULT NULL")
                db.execSQL("ALTER TABLE `social_posts` ADD COLUMN `syncStatus` TEXT NOT NULL DEFAULT 'SYNCED'")
            }
        }

        // v8 → v9: no schema change recorded (gap in early dev). Empty migration keeps
        // the chain intact so Room doesn't fall through to destructive migration.
        val MIGRATION_8_9 = object : Migration(8, 9) {
            override fun migrate(db: SupportSQLiteDatabase) { /* no-op */ }
        }

        val MIGRATION_9_10 = object : Migration(9, 10) {
            override fun migrate(db: SupportSQLiteDatabase) {
                // Add live-results snapshot column to quiz_attempts (used by live quiz results page)
                db.execSQL("ALTER TABLE `quiz_attempts` ADD COLUMN `liveResultsJson` TEXT DEFAULT NULL")
            }
        }

        val MIGRATION_10_11 = object : Migration(10, 11) {
            override fun migrate(db: SupportSQLiteDatabase) {
                // Persist the Supabase refresh token + access-token expiry so the session can be
                // silently renewed after the app is closed (access JWTs expire ~1h, refresh tokens rotate).
                db.execSQL("ALTER TABLE `profiles` ADD COLUMN `refreshToken` TEXT NOT NULL DEFAULT ''")
                db.execSQL("ALTER TABLE `profiles` ADD COLUMN `tokenExpiresAt` INTEGER NOT NULL DEFAULT 0")
            }
        }

        val MIGRATION_11_12 = object : Migration(11, 12) {
            override fun migrate(db: SupportSQLiteDatabase) {
                // Store the AI agent's step-by-step reasoning (JSON array) SEPARATELY from the
                // message content, matching the cloud chat_messages.thinking_steps column so the
                // Reasoning Process panel can be replayed from history without polluting content.
                db.execSQL("ALTER TABLE `chat_messages` ADD COLUMN `thinkingStepsJson` TEXT DEFAULT NULL")
            }
        }

        val MIGRATION_12_13 = object : Migration(12, 13) {
            override fun migrate(db: SupportSQLiteDatabase) {
                // Document folders (mirrors the cloud document_folders model the web app uses):
                // a folderId column on documents + the document_folders table.
                db.execSQL("ALTER TABLE `documents` ADD COLUMN `folderId` TEXT DEFAULT NULL")
                db.execSQL("""
                    CREATE TABLE IF NOT EXISTS `document_folders` (
                        `id` TEXT NOT NULL,
                        `name` TEXT NOT NULL,
                        `color` TEXT NOT NULL DEFAULT '#3B82F6',
                        `description` TEXT NOT NULL DEFAULT '',
                        `parentFolderId` TEXT,
                        `createdAt` INTEGER NOT NULL,
                        `syncStatus` TEXT NOT NULL DEFAULT 'SYNCED',
                        PRIMARY KEY(`id`)
                    )
                """.trimIndent())
            }
        }

        val MIGRATION_13_14 = object : Migration(13, 14) {
            override fun migrate(db: SupportSQLiteDatabase) {
                // Track the last day the user studied so the streak can decay honestly when
                // a day is skipped instead of only ever growing with quiz completions.
                db.execSQL("ALTER TABLE `user_stats` ADD COLUMN `lastStudyDayMillis` INTEGER NOT NULL DEFAULT 0")
            }
        }

        val MIGRATION_14_15 = object : Migration(14, 15) {
            override fun migrate(db: SupportSQLiteDatabase) {
                // Persist schedule task completion locally instead of ephemeral UI state.
                db.execSQL("ALTER TABLE `schedule_items` ADD COLUMN `isCompleted` INTEGER NOT NULL DEFAULT 0")
            }
        }

        val MIGRATION_19_20 = object : Migration(19, 20) {
            override fun migrate(db: SupportSQLiteDatabase) {
                // Explorer (kids) retention: streak freezes + last claimed Daily Quest date.
                db.execSQL("ALTER TABLE `user_stats` ADD COLUMN `streakFreezes` INTEGER NOT NULL DEFAULT 0")
                db.execSQL("ALTER TABLE `user_stats` ADD COLUMN `lastDailyQuestClaimedDate` TEXT NOT NULL DEFAULT ''")
            }
        }

        val MIGRATION_20_21 = object : Migration(20, 21) {
            override fun migrate(db: SupportSQLiteDatabase) {
                // Explorer roadmap: caching full generated lesson JSON locally on device.
                db.execSQL("ALTER TABLE `roadmap_steps` ADD COLUMN `lessonJson` TEXT DEFAULT NULL")
            }
        }

        val MIGRATION_21_22 = object : Migration(21, 22) {
            override fun migrate(db: SupportSQLiteDatabase) {
                // Track attached resources on user chat messages so the bubble can show them.
                db.execSQL("ALTER TABLE `chat_messages` ADD COLUMN `attachedDocumentIds` TEXT DEFAULT NULL")
                db.execSQL("ALTER TABLE `chat_messages` ADD COLUMN `attachedNoteIds` TEXT DEFAULT NULL")
            }
        }

        val MIGRATION_22_23 = object : Migration(22, 23) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE `user_stats` ADD COLUMN `badgesEarned` TEXT NOT NULL DEFAULT ''")
            }
        }

        val MIGRATION_23_24 = object : Migration(23, 24) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE `user_stats` ADD COLUMN `totalQuizzesAttempted` INTEGER NOT NULL DEFAULT 0")
                db.execSQL("ALTER TABLE `user_stats` ADD COLUMN `hasClaimedFirstQuestBonus` INTEGER NOT NULL DEFAULT 0")
                db.execSQL("ALTER TABLE `user_stats` ADD COLUMN `lastActivityDate` TEXT DEFAULT NULL")
            }
        }

        val MIGRATION_18_19 = object : Migration(18, 19) {
            override fun migrate(db: SupportSQLiteDatabase) {
                // Explorer (kids) roadmap — the daily learning path per subject.
                db.execSQL("""
                    CREATE TABLE IF NOT EXISTS `roadmap_steps` (
                        `id` TEXT NOT NULL,
                        `subjectCode` TEXT NOT NULL DEFAULT '',
                        `subjectName` TEXT NOT NULL DEFAULT '',
                        `week` INTEGER NOT NULL DEFAULT 1,
                        `day` INTEGER NOT NULL DEFAULT 1,
                        `stepIndex` INTEGER NOT NULL DEFAULT 0,
                        `title` TEXT NOT NULL DEFAULT '',
                        `stepType` TEXT NOT NULL DEFAULT 'lesson',
                        `refId` TEXT,
                        `xpReward` INTEGER NOT NULL DEFAULT 20,
                        `isCompleted` INTEGER NOT NULL DEFAULT 0,
                        `dueDateMillis` INTEGER,
                        `completedAt` INTEGER,
                        `syncStatus` TEXT NOT NULL DEFAULT 'SYNCED',
                        PRIMARY KEY(`id`)
                    )
                """.trimIndent())
            }
        }

        val MIGRATION_17_18 = object : Migration(17, 18) {
            override fun migrate(db: SupportSQLiteDatabase) {
                // Explorer (kids) game progress — stars + unlocked levels per game.
                db.execSQL("""
                    CREATE TABLE IF NOT EXISTS `game_progress` (
                        `id` TEXT NOT NULL,
                        `gameKey` TEXT NOT NULL,
                        `unlockedLevel` INTEGER NOT NULL DEFAULT 1,
                        `starsByLevelJson` TEXT NOT NULL DEFAULT '{}',
                        `bestScoresJson` TEXT NOT NULL DEFAULT '{}',
                        `totalXpEarned` INTEGER NOT NULL DEFAULT 0,
                        `lastPlayedAt` INTEGER NOT NULL DEFAULT 0,
                        `syncStatus` TEXT NOT NULL DEFAULT 'SYNCED',
                        PRIMARY KEY(`id`)
                    )
                """.trimIndent())
            }
        }

        val MIGRATION_16_17 = object : Migration(16, 17) {
            override fun migrate(db: SupportSQLiteDatabase) {
                // Explorer (kids) education context — mirrors the cloud user_education_profiles
                // + user_subjects tables (countries/education_levels/curricula/subjects are the
                // cloud source of truth). Drives Core-Four enrolment and the class-matched roadmap.
                db.execSQL("""
                    CREATE TABLE IF NOT EXISTS `user_education_profiles` (
                        `id` TEXT NOT NULL,
                        `userId` TEXT NOT NULL DEFAULT '',
                        `countryId` TEXT,
                        `countryCode` TEXT NOT NULL DEFAULT '',
                        `countryName` TEXT NOT NULL DEFAULT '',
                        `educationLevelId` TEXT,
                        `levelName` TEXT NOT NULL DEFAULT '',
                        `levelCategory` TEXT NOT NULL DEFAULT '',
                        `curriculumId` TEXT,
                        `curriculumName` TEXT NOT NULL DEFAULT '',
                        `targetExaminationId` TEXT,
                        `examName` TEXT NOT NULL DEFAULT '',
                        `institutionName` TEXT NOT NULL DEFAULT '',
                        `yearOrGrade` TEXT NOT NULL DEFAULT '',
                        `goalsJson` TEXT NOT NULL DEFAULT '[]',
                        `syncStatus` TEXT NOT NULL DEFAULT 'SYNCED',
                        PRIMARY KEY(`id`)
                    )
                """.trimIndent())
                db.execSQL("""
                    CREATE TABLE IF NOT EXISTS `user_subjects` (
                        `id` TEXT NOT NULL,
                        `educationProfileId` TEXT NOT NULL DEFAULT '',
                        `subjectId` TEXT NOT NULL DEFAULT '',
                        `code` TEXT NOT NULL DEFAULT '',
                        `name` TEXT NOT NULL DEFAULT '',
                        `category` TEXT NOT NULL DEFAULT 'core',
                        `isPrimary` INTEGER NOT NULL DEFAULT 0,
                        `syncStatus` TEXT NOT NULL DEFAULT 'SYNCED',
                        PRIMARY KEY(`id`)
                    )
                """.trimIndent())
            }
        }

        val MIGRATION_15_16 = object : Migration(15, 16) {
            override fun migrate(db: SupportSQLiteDatabase) {
                // 1. Add academicTier column to profiles table with safe non-destructive fallback
                db.execSQL("ALTER TABLE `profiles` ADD COLUMN `academicTier` TEXT NOT NULL DEFAULT 'achiever'")

                // 2. Safe Auto-Tier-Mapping for existing profiles per approved decision:
                // - "High School" / "SHS" -> "achiever"
                // - "Undergraduate", "Graduate", "PhD", "Post-Doc", "Self-Learner", "University" -> "scholar"
                // - "Primary", "Basic School", "JHS" -> "explorer"
                db.execSQL("""
                    UPDATE `profiles` SET `academicTier` = CASE
                        WHEN `academicLevel` IN ('Primary', 'Basic School', 'JHS', 'Junior High', 'Basic') THEN 'explorer'
                        WHEN `academicLevel` IN ('High School', 'SHS', 'Senior High', 'WASSCE') THEN 'achiever'
                        WHEN `academicLevel` IN ('Undergraduate', 'Graduate', 'PhD', 'Post-Doc', 'Self-Learner', 'University') THEN 'scholar'
                        ELSE 'achiever'
                    END
                    WHERE `academicTier` IS NULL OR `academicTier` = '' OR `academicTier` = 'achiever'
                """.trimIndent())
            }
        }

        @Volatile
        var appContext: Context? = null

        fun getDatabase(context: Context): StuddyHubDatabase {
            appContext = context.applicationContext
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    StuddyHubDatabase::class.java,
                    "StuddyHub_db"
                )
                .addMigrations(MIGRATION_7_8, MIGRATION_8_9, MIGRATION_9_10, MIGRATION_10_11, MIGRATION_11_12, MIGRATION_12_13, MIGRATION_13_14, MIGRATION_14_15, MIGRATION_15_16, MIGRATION_16_17, MIGRATION_17_18, MIGRATION_18_19, MIGRATION_19_20, MIGRATION_20_21, MIGRATION_21_22, MIGRATION_22_23, MIGRATION_23_24)
                // Safety net for very early dev builds (v1-v6) that have no migrations.
                // Once all users are on v7+, this can be removed.
                .fallbackToDestructiveMigration()

                .build()
                INSTANCE = instance
                instance
            }
        }

        // No seed data needed — Room column defaults in the entity data classes
        // are sufficient. Profiles and stats are created on first real login.
    }
}
