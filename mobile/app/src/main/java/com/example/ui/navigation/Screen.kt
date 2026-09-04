package com.example.ui.navigation

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.MenuBook
import androidx.compose.material.icons.filled.*
import androidx.compose.ui.graphics.vector.ImageVector

sealed class Screen(val route: String, val title: String, val icon: ImageVector) {
    object Splash : Screen("splash", "Splash", Icons.Default.School)
    object Welcome : Screen("welcome", "Welcome", Icons.Default.AutoAwesome)
    object Onboarding : Screen("onboarding", "Welcome", Icons.Default.AutoAwesome)
    object Auth : Screen("auth", "Sign In", Icons.Default.Lock)
    object Dashboard : Screen("dashboard", "Home", Icons.Default.Home)
    object Library : Screen("library", "Library", Icons.AutoMirrored.Filled.MenuBook)
    object Practice : Screen("practice", "Practice", Icons.Default.TaskAlt)
    object Assistant : Screen("assistant", "Assistant", Icons.Default.Psychology)
    object Community : Screen("community", "Community", Icons.Default.People)
    object Search : Screen("search", "Search", Icons.Default.Search)
    object Notes : Screen("notes", "Notes", Icons.AutoMirrored.Filled.MenuBook)
    object Documents : Screen("documents", "Documents", Icons.Default.Description)
    object Recordings : Screen("recordings", "Recordings", Icons.Default.Mic)
    object Quizzes : Screen("quizzes", "Quizzes", Icons.Default.Quiz)
    object Flashcards : Screen("flashcards", "Cards", Icons.Default.Style)
    object Schedule : Screen("schedule", "Schedule", Icons.Default.CalendarToday)
    object AIPodcast : Screen("ai_podcast", "Podcasts", Icons.Default.Headphones)
    object Courses : Screen("courses", "Courses", Icons.Default.School)
    object AIChat : Screen("ai_chat", "AI Tutor", Icons.Default.Psychology)
    object ChatSessionsList : Screen("chat_sessions_list", "Chat Sessions", Icons.Default.History)
    object Profile : Screen("profile", "Profile", Icons.Default.Person)

    object NoteDetail : Screen("note_detail/{noteId}", "Note Details", Icons.AutoMirrored.Filled.MenuBook) {
        fun createRoute(noteId: String) = "note_detail/$noteId"
    }
    object DocumentDetail : Screen("document_detail/{docId}", "Document Details", Icons.Default.Description) {
        fun createRoute(docId: String) = "document_detail/$docId"
    }
    object GroupDetail : Screen("group_detail/{groupId}", "Group Details", Icons.Default.Group) {
        fun createRoute(groupId: String) = "group_detail/$groupId"
    }

    // Full-page AI Guided Creation Flows
    object CreateQuizFlow : Screen("create_quiz_flow", "AI Quiz Generator", Icons.Default.Psychology)
    object AddScheduleEventFlow : Screen("add_schedule_flow", "AI Schedule Assistant", Icons.Default.Event)
    object CreateCourseFlow : Screen("create_course_flow", "Add Course", Icons.Default.AddBusiness)
    object CreateSocialPostFlow : Screen("create_social_flow", "Create Post", Icons.Default.EditNote)
    object CreateFlashcardFlow : Screen("create_flashcard_flow", "AI Flashcard Builder", Icons.Default.Style)

    // Unbundled Schedule Views
    object ScheduleTimetable : Screen("schedule_timetable", "Weekly Timetable", Icons.Default.ViewWeek)
    object ScheduleTasks : Screen("schedule_tasks", "Tasks & Deadlines", Icons.Default.TaskAlt)
    object ScheduleExams : Screen("schedule_exams", "Exam Countdowns", Icons.Default.Timer)

    // Unbundled Social Views
    object SocialFeed : Screen("social_feed", "Feed", Icons.Default.Home)
    object SocialTrending : Screen("social_trending", "Trending", Icons.Default.Whatshot)
    object SocialGroups : Screen("social_groups", "Study Groups", Icons.Default.Group)
    object SocialNotifications : Screen("social_notifications", "Notifications", Icons.Default.Notifications)

    // Document Upload Screen
    object UploadDocument : Screen("upload_document", "Upload Document", Icons.Default.CloudUpload)

    // Settings
    object Settings : Screen("settings", "Settings", Icons.Default.Settings)

    // Dedicated Ranking / Leaderboard Screen (Explorer Tier primary tab)
    object Ranking : Screen("ranking", "Ranking", Icons.Default.EmojiEvents)

    // Explorer Game Detail / Mode Selection Screen
    object GameDetail : Screen("game_detail/{gameKey}", "Game Challenge", Icons.Default.SportsEsports) {
        fun createRoute(gameKey: String) = "game_detail/$gameKey"
    }

    // Explorer Spelling Bee (plays its own screen, not the shared quiz runner)
    object SpellingBee : Screen("spelling_bee/{level}", "Spelling Bee", Icons.Default.EmojiEvents) {
        fun createRoute(level: Int) = "spelling_bee/$level"
    }

    // Explorer Learn It — roadmap lesson/practice screen
    object LearnIt : Screen("learn_it/{stepId}", "Learn It", Icons.Default.AutoStories) {
        fun createRoute(stepId: String) = "learn_it/$stepId"
    }

    // Explorer Speed Race — live quick-match race (renders LiveQuizSessionRunner)
    object SpeedRace : Screen("speed_race", "Speed Race", Icons.Default.Bolt)

    // Explorer quiz runner v2 — full-screen kid-friendly level runner (big colored tiles,
    // mascot reactions, confetti). Reads the active quiz from QuizzesViewModel.
    object ExplorerQuizRunner : Screen("explorer_quiz_runner", "Level Runner", Icons.Default.PlayArrow)

    // Explorer credits store — spend points earned from games on emoji avatars / streak freezes.
    object ExplorerStore : Screen("explorer_store", "Credits Store", Icons.Default.Store)

    // Explorer Multiplayer & Quiz Challenge Lobby
    object MultiplayerLobby : Screen("multiplayer_lobby", "Multiplayer Arena", Icons.Default.SportsEsports)

    // Explorer Ghanaian Curriculum Badges & Trophies Showcase
    object BadgesTrophies : Screen("badges_trophies", "Badges & Trophies", Icons.Default.EmojiEvents)

    // Explorer Full Learn It Lessons Library
    object LearnItLibrary : Screen("learn_it_library", "Lessons Library", Icons.Default.AutoStories)

    // Explorer Math Asteroid Blaster Space Arcade
    object MathAsteroidBlaster : Screen("math_asteroid_blaster", "Asteroid Blaster", Icons.Default.SportsEsports)
}

val mainNavigationItems = listOf(
    Screen.Dashboard,
    Screen.Library,
    Screen.Practice,
    Screen.Assistant,
    Screen.Community
)

fun getNavigationScreensForTier(tier: com.example.ui.theme.AcademicTier): List<Screen> {
    return when (tier) {
        com.example.ui.theme.AcademicTier.EXPLORER -> listOf(
            Screen.Dashboard,
            Screen.Ranking,
            Screen.Profile
        )
        com.example.ui.theme.AcademicTier.ACHIEVER -> listOf(
            Screen.Dashboard,
            Screen.Practice,
            Screen.Community,
            Screen.Profile
        )
        com.example.ui.theme.AcademicTier.SCHOLAR -> listOf(
            Screen.Dashboard,
            Screen.Library,
            Screen.Practice,
            Screen.Assistant,
            Screen.Community
        )
        com.example.ui.theme.AcademicTier.ALL -> listOf(
            Screen.Dashboard,
            Screen.Ranking,
            Screen.Profile
        )
    }
}
