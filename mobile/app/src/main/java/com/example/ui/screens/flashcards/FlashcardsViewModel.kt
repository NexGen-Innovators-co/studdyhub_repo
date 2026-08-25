package com.example.ui.screens.flashcards

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.data.local.entities.FlashcardEntity
import com.example.data.repository.StuddyHubRepository
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch

data class FlashcardsUiState(
    val flashcards: List<FlashcardEntity> = emptyList(),
    val currentCardIndex: Int = 0,
    val isFlipped: Boolean = false,
    val userMessage: String? = null
)

class FlashcardsViewModel(private val repository: StuddyHubRepository) : ViewModel() {

    val isAIGenerating: StateFlow<Boolean> = repository.isAIGenerating
    val generationMessage: StateFlow<String> = repository.generationMessage

    private val _currentCardIndex = MutableStateFlow(0)
    private val _isFlipped = MutableStateFlow(false)
    private val _userMessage = MutableStateFlow<String?>(null)

    val uiState: StateFlow<FlashcardsUiState> = combine(
        repository.allFlashcards,
        _currentCardIndex,
        _isFlipped,
        _userMessage
    ) { cards, idx, flipped, msg ->
        val safeIdx = if (cards.isEmpty()) 0 else idx.coerceIn(0, cards.size - 1)
        FlashcardsUiState(
            flashcards = cards,
            currentCardIndex = safeIdx,
            isFlipped = flipped,
            userMessage = msg
        )
    }.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5000),
        initialValue = FlashcardsUiState()
    )

    fun flipCard() {
        _isFlipped.value = !_isFlipped.value
    }

    fun nextCard() {
        val cards = uiState.value.flashcards
        if (cards.isEmpty()) return
        _isFlipped.value = false
        _currentCardIndex.value = if (uiState.value.currentCardIndex + 1 < cards.size) {
            uiState.value.currentCardIndex + 1
        } else {
            0
        }
    }

    fun prevCard() {
        val cards = uiState.value.flashcards
        if (cards.isEmpty()) return
        _isFlipped.value = false
        _currentCardIndex.value = if (uiState.value.currentCardIndex - 1 >= 0) {
            uiState.value.currentCardIndex - 1
        } else {
            cards.size - 1
        }
    }

    fun reviewCurrentCard(remembered: Boolean) {
        val cards = uiState.value.flashcards
        val idx = uiState.value.currentCardIndex
        if (cards.isNotEmpty() && idx in cards.indices) {
            val currentCard = cards[idx]
            viewModelScope.launch {
                repository.reviewFlashcard(currentCard, remembered)
                _isFlipped.value = false
                if (idx + 1 < cards.size) {
                    _currentCardIndex.value = idx + 1
                } else {
                    _currentCardIndex.value = 0
                    _userMessage.value = "Deck completed! SRS schedule updated."
                }
            }
        }
    }

    fun addFlashcard(front: String, back: String, category: String, difficulty: String, hint: String) {
        viewModelScope.launch {
            repository.addFlashcard(front, back, category, difficulty, hint)
            _userMessage.value = "Flashcard added!"
        }
    }

    fun generateFlashcardsFromTopic(topic: String) {
        viewModelScope.launch {
            repository.generateFlashcardsFromTopic(topic)
        }
    }

    fun clearUserMessage() {
        _userMessage.value = null
    }

    fun clearGenerationMessage() {
        repository.clearGenerationMessage()
    }

    fun refreshFlashcards() {
        viewModelScope.launch {
            try {
                repository.syncCloudDataToLocal()
                _userMessage.value = "Flashcards refreshed"
            } catch (e: Exception) {
                _userMessage.value = "We couldn't refresh your flashcards. Please try again."
            }
        }
    }
}
