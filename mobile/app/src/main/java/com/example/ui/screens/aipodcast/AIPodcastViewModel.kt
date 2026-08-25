package com.example.ui.screens.aipodcast

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.data.local.entities.AIPodcastEntity
import com.example.data.repository.StuddyHubRepository
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch

data class AIPodcastUiState(
    val podcasts: List<AIPodcastEntity> = emptyList(),
    val isGenerating: Boolean = false,
    val isPlaying: Boolean = false,
    val playingPodcastId: String? = null,
    val userMessage: String? = null
)

class AIPodcastViewModel(private val repository: StuddyHubRepository) : ViewModel() {

    private val _isGenerating = MutableStateFlow(false)
    private val _isPlaying = MutableStateFlow(false)
    private val _playingPodcastId = MutableStateFlow<String?>(null)
    private val _userMessage = MutableStateFlow<String?>(null)

    val uiState: StateFlow<AIPodcastUiState> = combine(
        repository.allPodcasts,
        _isGenerating,
        _isPlaying,
        _playingPodcastId,
        _userMessage
    ) { podcasts, generating, playing, playingId, msg ->
        AIPodcastUiState(
            podcasts = podcasts,
            isGenerating = generating,
            isPlaying = playing,
            playingPodcastId = playingId,
            userMessage = msg
        )
    }.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5000),
        initialValue = AIPodcastUiState()
    )

    fun generatePodcast(title: String, style: String, sourceText: String) {
        viewModelScope.launch {
            _isGenerating.value = true
            try {
                repository.generateAIPodcast(title, style, sourceText)
                _userMessage.value = "AI Podcast created! Tap to listen."
            } catch (e: Exception) {
                _userMessage.value = "We couldn't create that podcast. Please try again."
            } finally {
                _isGenerating.value = false
            }
        }
    }

    fun togglePlayPodcast(podcastId: String) {
        if (_playingPodcastId.value == podcastId) {
            _isPlaying.value = !_isPlaying.value
        } else {
            _playingPodcastId.value = podcastId
            _isPlaying.value = true
        }
    }

    fun clearUserMessage() {
        _userMessage.value = null
    }

    fun refreshPodcasts() {
        viewModelScope.launch {
            try {
                repository.syncCloudDataToLocal()
                _userMessage.value = "Podcasts refreshed"
            } catch (e: Exception) {
                _userMessage.value = "We couldn't refresh your podcasts. Please try again."
            }
        }
    }
}
