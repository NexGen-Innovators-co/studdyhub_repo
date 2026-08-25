package com.example.ui.screens

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.data.repository.StuddyHubRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.launch

data class PracticeUiState(
    val quizCount: Int = 0,
    val flashcardCount: Int = 0,
    val scheduleCount: Int = 0,
    val nextScheduleTitle: String? = null,
    val nextScheduleStartMillis: Long? = null
)

/**
 * Practice hub data source — every number shown on the Practice screen is real
 * user data from the local repository. No hardcoded or mock values.
 */
class PracticeViewModel(private val repository: StuddyHubRepository) : ViewModel() {

    private val _uiState = MutableStateFlow(PracticeUiState())
    val uiState: StateFlow<PracticeUiState> = _uiState.asStateFlow()

    init {
        viewModelScope.launch {
            combine(
                repository.allQuizzes,
                repository.allFlashcards,
                repository.allScheduleItems
            ) { quizzes, cards, items ->
                val now = System.currentTimeMillis()
                val next = items
                    .filter { it.startTimeMillis >= now }
                    .sortedBy { it.startTimeMillis }
                    .firstOrNull()
                PracticeUiState(
                    quizCount = quizzes.size,
                    flashcardCount = cards.size,
                    scheduleCount = items.size,
                    nextScheduleTitle = next?.title,
                    nextScheduleStartMillis = next?.startTimeMillis
                )
            }.collect { _uiState.value = it }
        }
    }
}
