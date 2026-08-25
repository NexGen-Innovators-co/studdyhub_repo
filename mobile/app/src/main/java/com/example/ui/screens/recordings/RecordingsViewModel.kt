package com.example.ui.screens.recordings

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.data.local.entities.ClassRecordingEntity
import com.example.data.repository.StuddyHubRepository
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import java.io.File

data class RecordingsUiState(
    val recordings: List<ClassRecordingEntity> = emptyList(),
    val isLoading: Boolean = false,
    // True while audio is being uploaded / transcribed / summarized (mirrors the web's
    // "Processing Audio..." overlay in the class-recordings module).
    val isProcessingAudio: Boolean = false,
    val processingMessage: String = "",
    // ID of the recording a quiz is being generated for (drives per-card progress).
    val quizGeneratingId: String? = null,
    val userMessage: String? = null
)

class RecordingsViewModel(private val repository: StuddyHubRepository) : ViewModel() {

    private val _isLoading = MutableStateFlow(false)
    private val _isProcessingAudio = MutableStateFlow(false)
    private val _processingMessage = MutableStateFlow("")
    private val _quizGeneratingId = MutableStateFlow<String?>(null)
    private val _userMessage = MutableStateFlow<String?>(null)

    val uiState: StateFlow<RecordingsUiState> = combine(
        repository.allRecordings,
        _isLoading,
        _isProcessingAudio,
        _processingMessage,
        _quizGeneratingId,
        _userMessage
    ) { values ->
        RecordingsUiState(
            recordings = values[0] as List<ClassRecordingEntity>,
            isLoading = values[1] as Boolean,
            isProcessingAudio = values[2] as Boolean,
            processingMessage = values[3] as String,
            quizGeneratingId = values[4] as String?,
            userMessage = values[5] as String?
        )
    }.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5000),
        initialValue = RecordingsUiState()
    )

    /** Legacy text-only path: type a transcript and Ollie summarizes it. */
    fun addClassRecording(title: String, subject: String, transcript: String) {
        viewModelScope.launch {
            _isProcessingAudio.value = true
            _processingMessage.value = "Summarizing transcript..."
            try {
                repository.addRecording(title, subject, transcript)
                _userMessage.value = "Class recording processed with AI summary!"
            } catch (e: Exception) {
                _userMessage.value = "We couldn't process that recording. Please try again."
            } finally {
                _isProcessingAudio.value = false
                _processingMessage.value = ""
            }
        }
    }

    /**
     * Real audio path (mic capture or imported file): uploads the audio, then runs
     * transcription + summarization via gemini-audio-processor — the web's exact flow.
     */
    fun saveRecordingFromAudio(
        title: String,
        subject: String,
        audioFile: File,
        mimeType: String = "audio/webm",
        durationSeconds: Int = 0
    ) {
        viewModelScope.launch {
            _isProcessingAudio.value = true
            _processingMessage.value = "Uploading audio and transcribing..."
            try {
                repository.addRecordingWithAudio(title, subject, audioFile, mimeType, durationSeconds)
                _userMessage.value = "Recording saved — AI transcript ready!"
            } catch (e: Exception) {
                _userMessage.value = "We couldn't process that recording. Please try again."
            } finally {
                _isProcessingAudio.value = false
                _processingMessage.value = ""
            }
        }
    }

    /** Retries AI transcription/summarization for a recording that failed. */
    fun reprocessRecording(id: String) {
        viewModelScope.launch {
            _isProcessingAudio.value = true
            _processingMessage.value = "Re-processing audio..."
            try {
                repository.reprocessRecording(id)
                _userMessage.value = "Recording re-processed."
            } catch (e: Exception) {
                _userMessage.value = "We couldn't re-process that recording. Please try again."
            } finally {
                _isProcessingAudio.value = false
                _processingMessage.value = ""
            }
        }
    }

    /** Generates a practice quiz from the recording's transcript. */
    fun generateQuizForRecording(id: String) {
        viewModelScope.launch {
            _quizGeneratingId.value = id
            try {
                val quiz = repository.generateQuizForRecording(id)
                _userMessage.value = if (quiz != null) {
                    "Quiz '${quiz.title}' created! Find it in Quizzes."
                } else {
                    "Add a transcript to this recording before generating a quiz."
                }
            } catch (e: Exception) {
                _userMessage.value = "We couldn't generate that quiz. Please try again."
            } finally {
                _quizGeneratingId.value = null
            }
        }
    }

    fun deleteRecording(id: String) {
        viewModelScope.launch {
            try {
                repository.deleteRecording(id)
                _userMessage.value = "Recording deleted."
            } catch (e: Exception) {
                _userMessage.value = "We couldn't delete this recording. Please try again."
            }
        }
    }

    fun clearUserMessage() {
        _userMessage.value = null
    }

    fun refreshRecordings() {
        viewModelScope.launch {
            _isLoading.value = true
            try {
                repository.syncCloudDataToLocal()
                _userMessage.value = "Recordings refreshed"
            } catch (e: Exception) {
                _userMessage.value = "We couldn't refresh your recordings. Please try again."
            } finally {
                _isLoading.value = false
            }
        }
    }
}
