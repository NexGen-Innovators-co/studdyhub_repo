package com.example.ui.screens.courses

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.data.local.entities.CourseEntity
import com.example.data.repository.StuddyHubRepository
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch

data class CoursesUiState(
    val courses: List<CourseEntity> = emptyList(),
    val userMessage: String? = null
)

class CoursesViewModel(private val repository: StuddyHubRepository) : ViewModel() {

    private val _userMessage = MutableStateFlow<String?>(null)

    init {
        refresh()
    }

    fun refresh() {
        viewModelScope.launch {
            try {
                repository.syncCloudDataToLocal()
            } catch (_: Exception) {}
        }
    }

    val uiState: StateFlow<CoursesUiState> = combine(
        repository.allCourses,
        _userMessage
    ) { courses, msg ->
        CoursesUiState(courses = courses, userMessage = msg)
    }.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5000),
        initialValue = CoursesUiState()
    )

    fun toggleEnrollment(course: CourseEntity) {
        viewModelScope.launch {
            repository.toggleCourseEnrollment(course.id, course.isEnrolled)
            _userMessage.value = if (!course.isEnrolled) "Enrolled in ${course.code}!" else "Unenrolled from ${course.code}."
        }
    }

    fun clearUserMessage() {
        _userMessage.value = null
    }
}
