package com.example.ui.screens.schedule

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.data.local.entities.ScheduleItemEntity
import com.example.data.repository.StuddyHubRepository
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch

data class ScheduleUiState(
    val items: List<ScheduleItemEntity> = emptyList(),
    val isLoading: Boolean = false,
    val userMessage: String? = null
)

class ScheduleViewModel(private val repository: StuddyHubRepository) : ViewModel() {

    private val _isLoading = MutableStateFlow(false)
    private val _userMessage = MutableStateFlow<String?>(null)

    init {
        refresh()
    }

    fun refresh() {
        viewModelScope.launch {
            _isLoading.value = true
            try {
                repository.syncCloudDataToLocal()
            } catch (_: Exception) {
            } finally {
                _isLoading.value = false
            }
        }
    }

    val uiState: StateFlow<ScheduleUiState> = combine(
        repository.allScheduleItems,
        _isLoading,
        _userMessage
    ) { items, loading, msg ->
        ScheduleUiState(items = items, isLoading = loading, userMessage = msg)
    }.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5000),
        initialValue = ScheduleUiState()
    )

    fun addScheduleItem(
        id: String? = null,
        title: String,
        subject: String,
        type: String,
        startTimeMillis: Long,
        endTimeMillis: Long,
        location: String,
        description: String,
        colorHex: String,
        isRecurring: Boolean = false,
        recurrencePattern: String = "weekly",
        recurrenceEndDate: Long? = null,
        recurrenceDaysOfWeek: String = ""
    ) {
        viewModelScope.launch {
            try {
                if (id != null) {
                    repository.addScheduleItem(
                        id = id,
                        title = title,
                        subject = subject,
                        type = type,
                        startTimeMillis = startTimeMillis,
                        endTimeMillis = endTimeMillis,
                        location = location,
                        description = description,
                        colorHex = colorHex,
                        isRecurring = isRecurring,
                        recurrencePattern = recurrencePattern,
                        recurrenceEndDate = recurrenceEndDate,
                        recurrenceDaysOfWeek = recurrenceDaysOfWeek
                    )
                    _userMessage.value = "Schedule event updated!"
                } else {
                    repository.addScheduleItem(
                        title = title,
                        subject = subject,
                        type = type,
                        startTimeMillis = startTimeMillis,
                        endTimeMillis = endTimeMillis,
                        location = location,
                        description = description,
                        colorHex = colorHex,
                        isRecurring = isRecurring,
                        recurrencePattern = recurrencePattern,
                        recurrenceEndDate = recurrenceEndDate,
                        recurrenceDaysOfWeek = recurrenceDaysOfWeek
                    )
                    _userMessage.value = "Event added to schedule!"
                }
            } catch (e: Exception) {
                _userMessage.value = "We couldn't save this event. Please try again."
            }
        }
    }

    fun deleteItem(id: String) {
        viewModelScope.launch {
            try {
                repository.deleteScheduleItem(id)
                _userMessage.value = "Event deleted."
            } catch (e: Exception) {
                _userMessage.value = "We couldn't delete this event. Please try again."
            }
        }
    }

    /** Toggles completion and persists it (DB + sync queue), so it survives restarts. */
    fun toggleCompleted(itemId: String, completed: Boolean) {
        viewModelScope.launch {
            try {
                repository.toggleScheduleItemCompleted(itemId, completed)
            } catch (e: Exception) {
                _userMessage.value = "We couldn't update this event. Please try again."
            }
        }
    }

    fun clearUserMessage() {
        _userMessage.value = null
    }
}
