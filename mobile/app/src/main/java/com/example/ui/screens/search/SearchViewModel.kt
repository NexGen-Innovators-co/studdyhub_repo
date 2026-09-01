package com.example.ui.screens.search

import android.content.Context
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.MenuBook
import androidx.compose.material.icons.filled.CalendarToday
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.Headphones
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.Quiz
import androidx.compose.material.icons.filled.School
import androidx.compose.material.icons.filled.Style
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.data.local.entities.AIPodcastEntity
import com.example.data.local.entities.ChatSessionEntity
import com.example.data.local.entities.ClassRecordingEntity
import com.example.data.local.entities.CourseEntity
import com.example.data.local.entities.DocumentEntity
import com.example.data.local.entities.FlashcardEntity
import com.example.data.local.entities.NoteEntity
import com.example.data.local.entities.QuizEntity
import com.example.data.local.entities.ScheduleItemEntity
import com.example.data.repository.StuddyHubRepository
import com.example.ui.navigation.Screen
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.debounce
import kotlinx.coroutines.flow.stateIn
import org.json.JSONArray

/**
 * A single searchable row in the workspace index. `haystack` holds every text field that
 * should match a query (title, body, tags, ...) so filtering can stay on one precomputed
 * string instead of re-reading entities on every keystroke.
 */
data class SearchResultItem(
    val id: String,
    val title: String,
    val subtitle: String,
    val category: String,
    val route: String,
    val icon: ImageVector,
    val timestamp: Long,
    val haystack: String = ""
) {
    /** Stable key for LazyColumn item keys — ids are only unique within a type. */
    val key: String get() = "$category:$id"
}

data class SearchUiState(
    /** What the search box shows (raw input, not debounced). */
    val query: String = "",
    val selectedCategory: String = "All",
    val allItems: List<SearchResultItem> = emptyList(),
    val results: List<SearchResultItem> = emptyList(),
    val availableCategories: List<String> = listOf("All"),
    val recents: List<String> = emptyList(),
    /** True while the debounce window is pending (query changed but results not recomputed yet). */
    val isSearching: Boolean = false
)

class SearchViewModel(
    private val repository: StuddyHubRepository,
    private val appContext: Context?
) : ViewModel() {

    private val _query = MutableStateFlow("")
    private val _category = MutableStateFlow("All")

    private val _recents = MutableStateFlow(loadRecents())
    val recents: StateFlow<List<String>> = _recents.asStateFlow()

    /** Full index of every workspace item, rebuilt whenever any local collection changes. */
    private val indexFlow = combine(
        repository.allNotes,
        repository.allDocuments,
        repository.allRecordings,
        repository.allQuizzes,
        repository.allFlashcards,
        repository.allScheduleItems,
        repository.allChatSessions,
        repository.allPodcasts,
        repository.allCourses
    ) { arrays: Array<Any?> ->
        @Suppress("UNCHECKED_CAST")
        buildSearchIndex(
            notes = arrays[0] as List<NoteEntity>,
            documents = arrays[1] as List<DocumentEntity>,
            recordings = arrays[2] as List<ClassRecordingEntity>,
            quizzes = arrays[3] as List<QuizEntity>,
            flashcards = arrays[4] as List<FlashcardEntity>,
            schedule = arrays[5] as List<ScheduleItemEntity>,
            sessions = arrays[6] as List<ChatSessionEntity>,
            podcasts = arrays[7] as List<AIPodcastEntity>,
            courses = arrays[8] as List<CourseEntity>
        )
    }

    val uiState: StateFlow<SearchUiState> = combine(
        indexFlow,
        _query,                 // raw input, drives the visible text field
        _query.debounce(300),   // settled query, drives filtering
        _category,
        _recents
    ) { arrays: Array<Any?> ->
        @Suppress("UNCHECKED_CAST")
        val index = arrays[0] as List<SearchResultItem>
        val displayQuery = arrays[1] as String
        val filterQuery = (arrays[2] as String).trim()
        val category = arrays[3] as String
        val recentList = arrays[4] as List<String>

        val searching = filterQuery != displayQuery.trim() && displayQuery.isNotBlank()

        val categoryCounts = index.groupingBy { it.category }.eachCount()
        val canonical = listOf("Notes", "Documents", "Recordings", "Quizzes", "Flashcards", "Schedule", "Chat", "Podcasts", "Courses")
        val available = listOf("All") + canonical.filter { (categoryCounts[it] ?: 0) > 0 }

        val effectiveCategory = if (category != "All" && category !in available) "All" else category
        val results = filterAndRank(index, filterQuery, effectiveCategory)

        SearchUiState(
            query = displayQuery,
            selectedCategory = effectiveCategory,
            allItems = index,
            results = results,
            availableCategories = available,
            recents = recentList,
            isSearching = searching
        )
    }.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5000),
        initialValue = SearchUiState()
    )

    fun onQueryChanged(value: String) {
        _query.value = value
    }

    fun onCategorySelected(category: String) {
        _category.value = category
    }

    fun clearQuery() {
        _query.value = ""
    }

    /** Records a search the user actually committed (submitted or tapped through to). */
    fun recordRecent(query: String) {
        val trimmed = query.trim()
        if (trimmed.length < 2) return
        val updated = (listOf(trimmed) + _recents.value.filter { it != trimmed }).take(MAX_RECENTS)
        _recents.value = updated
        persistRecents(updated)
    }

    fun clearRecents() {
        _recents.value = emptyList()
        persistRecents(emptyList())
    }

    // ── Index building ───────────────────────────────────────────────────────

    private fun buildSearchIndex(
        notes: List<NoteEntity>,
        documents: List<DocumentEntity>,
        recordings: List<ClassRecordingEntity>,
        quizzes: List<QuizEntity>,
        flashcards: List<FlashcardEntity>,
        schedule: List<ScheduleItemEntity>,
        sessions: List<ChatSessionEntity>,
        podcasts: List<AIPodcastEntity>,
        courses: List<CourseEntity>
    ): List<SearchResultItem> {
        val items = mutableListOf<SearchResultItem>()

        notes.forEach { n ->
            items += SearchResultItem(
                id = n.id,
                title = n.title.ifBlank { "Untitled Note" },
                subtitle = buildList {
                    if (n.category.isNotBlank()) add(n.category)
                    if (n.tags.isNotBlank()) add(n.tags)
                }.joinToString(" • ").ifBlank { "Study note" },
                category = "Notes",
                route = Screen.NoteDetail.createRoute(n.id),
                icon = Icons.AutoMirrored.Filled.MenuBook,
                timestamp = n.updatedAt,
                haystack = listOf(n.title, n.content, n.tags, n.category, n.aiSummary).joinToString(" ")
            )
        }

        documents.forEach { d ->
            items += SearchResultItem(
                id = d.id,
                title = d.title.ifBlank { d.fileName },
                subtitle = listOf(d.fileType, d.fileName).filter { it.isNotBlank() }.joinToString(" • ").ifBlank { "Document" },
                category = "Documents",
                route = Screen.DocumentDetail.createRoute(d.id),
                icon = Icons.Default.Description,
                timestamp = d.createdAt,
                haystack = listOf(d.title, d.fileName, d.contentExtracted).joinToString(" ")
            )
        }

        recordings.forEach { r ->
            items += SearchResultItem(
                id = r.id,
                title = r.title.ifBlank { "Lecture recording" },
                subtitle = listOfNotNull(
                    r.subject.takeIf { it.isNotBlank() },
                    if (r.durationSeconds > 0) formatDuration(r.durationSeconds) else null
                ).joinToString(" • ").ifBlank { "Class recording" },
                category = "Recordings",
                route = Screen.Recordings.route,
                icon = Icons.Default.Mic,
                timestamp = r.dateMillis,
                haystack = listOf(r.title, r.subject, r.transcript, r.summary).joinToString(" ")
            )
        }

        quizzes.forEach { q ->
            if (q.sourceType == "live_kahoot") return@forEach // live mirrors live in history, not the library
            val count = runCatching { JSONArray(q.questionsJson).length() }.getOrDefault(0)
            items += SearchResultItem(
                id = q.id,
                title = q.title.ifBlank { "Untitled quiz" },
                subtitle = if (count > 0) "$count questions" else "Practice quiz",
                category = "Quizzes",
                route = Screen.Quizzes.route,
                icon = Icons.Default.Quiz,
                timestamp = q.createdAt,
                haystack = q.title
            )
        }

        flashcards.forEach { f ->
            items += SearchResultItem(
                id = f.id,
                title = f.front.ifBlank { "Flashcard" },
                subtitle = listOf("Flashcard", f.category).filter { it.isNotBlank() }.joinToString(" • "),
                category = "Flashcards",
                route = Screen.Flashcards.route,
                icon = Icons.Default.Style,
                timestamp = f.nextReviewAt,
                haystack = listOf(f.front, f.back, f.category, f.hint).joinToString(" ")
            )
        }

        schedule.forEach { s ->
            items += SearchResultItem(
                id = s.id,
                title = s.title.ifBlank { "Scheduled item" },
                subtitle = listOf(s.type.replaceFirstChar { it.uppercase() }, s.subject, s.location)
                    .filter { it.isNotBlank() }
                    .joinToString(" • "),
                category = "Schedule",
                route = Screen.Schedule.route,
                icon = Icons.Default.CalendarToday,
                timestamp = s.startTimeMillis,
                haystack = listOf(s.title, s.subject, s.type, s.location, s.description).joinToString(" ")
            )
        }

        sessions.forEach { s ->
            items += SearchResultItem(
                id = s.id,
                title = s.title.ifBlank { "Chat session" },
                subtitle = timeAgo(s.lastMessageAt.let { if (it > 0) it else s.createdAt }),
                category = "Chat",
                route = Screen.AIChat.route,
                icon = Icons.Default.History,
                timestamp = s.lastMessageAt.let { if (it > 0) it else s.createdAt },
                haystack = s.title
            )
        }

        // Podcasts disabled (Coming Soon)
        // podcasts.forEach { p ->
        //     items += SearchResultItem(
        //         id = p.id,
        //         title = p.title.ifBlank { "AI podcast" },
        //         subtitle = listOf(p.style.replaceFirstChar { it.uppercase() }, if (p.durationMinutes > 0) "${p.durationMinutes} min" else null)
        //             .filterNotNull()
        //             .joinToString(" • ").ifBlank { "AI podcast" },
        //         category = "Podcasts",
        //         route = Screen.AIPodcast.route,
        //         icon = Icons.Default.Headphones,
        //         timestamp = p.createdAt,
        //         haystack = listOf(p.title, p.script, p.style).joinToString(" ")
        //     )
        // }

        courses.forEach { c ->
            items += SearchResultItem(
                id = c.id,
                title = c.title.ifBlank { c.code },
                subtitle = listOf(c.code, c.schoolName).filter { it.isNotBlank() }.joinToString(" • ").ifBlank { "Course" },
                category = "Courses",
                route = Screen.Courses.route,
                icon = Icons.Default.School,
                timestamp = 0L,
                haystack = listOf(c.title, c.code, c.description).joinToString(" ")
            )
        }

        return items
    }

    // ── Filtering ────────────────────────────────────────────────────────────

    private fun filterAndRank(index: List<SearchResultItem>, query: String, category: String): List<SearchResultItem> {
        val tokens = query.split(Regex("\\s+")).filter { it.isNotBlank() }
        if (tokens.isEmpty()) {
            return if (category == "All") index.sortedByDescending { it.timestamp }
            else index.filter { it.category == category }.sortedByDescending { it.timestamp }
        }

        return index.asSequence()
            .filter { item -> category == "All" || item.category == category }
            .mapNotNull { item ->
                val hay = item.haystack.ifBlank { "${item.title} ${item.subtitle}" }.lowercase()
                if (tokens.all { hay.contains(it.lowercase()) }) {
                    // Relevance: exact title match < title prefix < title contains < body-only match
                    val rank = when {
                        item.title.equals(query, ignoreCase = true) -> 0
                        item.title.startsWith(query, ignoreCase = true) -> 1
                        item.title.contains(query, ignoreCase = true) -> 2
                        else -> 3
                    }
                    Triple(rank, item.timestamp, item)
                } else {
                    null
                }
            }
            .sortedWith(compareBy({ it.first }, { -it.second }))
            .map { it.third }
            .toList()
    }

    // ── Recent searches persistence (SharedPreferences, ordered list) ────────

    private fun prefs() = appContext?.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    private fun loadRecents(): List<String> =
        prefs()?.getString(KEY_RECENTS, null)
            ?.split("\n")
            ?.filter { it.isNotBlank() }
            ?.take(MAX_RECENTS)
            ?: emptyList()

    private fun persistRecents(recents: List<String>) {
        prefs()?.edit()?.putString(KEY_RECENTS, recents.joinToString("\n"))?.apply()
    }

    companion object {
        private const val PREFS_NAME = "studdyhub_search_recents"
        private const val KEY_RECENTS = "recent_queries"
        private const val MAX_RECENTS = 8
    }
}

private fun formatDuration(totalSeconds: Int): String {
    val s = totalSeconds.coerceAtLeast(0)
    val h = s / 3600
    val m = (s % 3600) / 60
    return if (h > 0) "${h}h ${m}m" else "${m}m"
}

private fun timeAgo(timestamp: Long): String {
    val diff = System.currentTimeMillis() - timestamp
    return when {
        diff < 60_000 -> "just now"
        diff < 3_600_000 -> "${diff / 60_000}m ago"
        diff < 86_400_000 -> "${diff / 3_600_000}h ago"
        diff < 604_800_000 -> "${diff / 86_400_000}d ago"
        else -> {
            val sdf = java.text.SimpleDateFormat("MMM d", java.util.Locale.getDefault())
            sdf.format(java.util.Date(timestamp))
        }
    }
}
