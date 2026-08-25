package com.example.ui.screens.dashboard

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.data.local.entities.DocumentEntity
import com.example.data.local.entities.NoteEntity
import com.example.data.local.entities.ProfileEntity
import com.example.data.local.entities.QuizEntity
import com.example.data.local.entities.ScheduleItemEntity
import com.example.data.local.entities.UserStatsEntity
import com.example.data.repository.StuddyHubRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

data class DashboardUiState(
    val profile: ProfileEntity? = null,
    val stats: UserStatsEntity? = null,
    val notes: List<NoteEntity> = emptyList(),
    val documents: List<DocumentEntity> = emptyList(),
    val quizzes: List<QuizEntity> = emptyList(),
    val scheduleItems: List<ScheduleItemEntity> = emptyList(),
    val manualCompletedTasks: Set<String> = emptySet()
) {
    val completedTaskIds: Set<String>
        get() {
            val set = manualCompletedTasks.toMutableSet()
            if (documents.isNotEmpty()) set.add("doc_upload")
            if (notes.isNotEmpty()) set.add("ai_chat")
            if (quizzes.isNotEmpty()) set.add("flashcard_quiz")
            if (scheduleItems.isNotEmpty()) set.add("schedule_setup")
            return set
        }

    /**
     * The streak as it should be displayed right now: once a full day has been skipped it is
     * broken (0), even though the stored counter hasn't been recomputed yet. A brand-new user
     * with no activity also shows 0 ("start today") instead of a fabricated "0-day streak".
     */
    val effectiveCurrentStreak: Int
        get() {
            val s = stats ?: return 0
            if (s.lastStudyDayMillis <= 0L) return 0
            val nowStart = startOfDayMillis(System.currentTimeMillis())
            val lastStart = startOfDayMillis(s.lastStudyDayMillis)
            // Intact only when the last study day was today or yesterday.
            return if (nowStart - lastStart <= 24L * 3600 * 1000) s.currentStreak else 0
        }

    /** Most recently touched note, used for the "Continue Notes" deep link. */
    val lastActiveNote: NoteEntity?
        get() = notes.maxByOrNull { it.updatedAt }
}

private fun startOfDayMillis(ts: Long): Long {
    val cal = java.util.Calendar.getInstance()
    cal.timeInMillis = ts
    cal.set(java.util.Calendar.HOUR_OF_DAY, 0)
    cal.set(java.util.Calendar.MINUTE, 0)
    cal.set(java.util.Calendar.SECOND, 0)
    cal.set(java.util.Calendar.MILLISECOND, 0)
    return cal.timeInMillis
}

class DashboardViewModel(private val repository: StuddyHubRepository) : ViewModel() {

    private val _manualTasks = MutableStateFlow<Set<String>>(setOf("profile_complete"))

    init {
        viewModelScope.launch {
            try {
                repository.refreshProfilePointsFromCloud()
            } catch (_: Exception) {}
        }
    }

    val uiState: StateFlow<DashboardUiState> = combine(
        repository.userProfile,
        repository.userStats,
        repository.allNotes,
        repository.allDocuments,
        repository.allQuizzes,
        repository.allScheduleItems,
        _manualTasks
    ) { args: Array<Any?> ->
        @Suppress("UNCHECKED_CAST")
        DashboardUiState(
            profile = args[0] as ProfileEntity?,
            stats = args[1] as UserStatsEntity?,
            notes = args[2] as List<NoteEntity>,
            documents = args[3] as List<DocumentEntity>,
            quizzes = args[4] as List<QuizEntity>,
            scheduleItems = args[5] as List<ScheduleItemEntity>,
            manualCompletedTasks = args[6] as Set<String>
        )
    }.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5000),
        initialValue = DashboardUiState()
    )

    fun onScreenResumed() {
        viewModelScope.launch {
            try {
                repository.refreshProfilePointsFromCloud()
            } catch (_: Exception) {}
        }
    }

    fun toggleTaskCompletion(taskId: String) {
        val current = _manualTasks.value.toMutableSet()
        if (current.contains(taskId)) {
            current.remove(taskId)
        } else {
            current.add(taskId)
        }
        _manualTasks.value = current
    }

    fun refreshDashboard() {
        viewModelScope.launch {
            try {
                repository.syncCloudDataToLocal()
                repository.syncSocialFeed(limit = 15, offset = 0, clearFirst = true)
            } catch (e: Exception) {
                // Ignore errors
            }
        }
    }
}
