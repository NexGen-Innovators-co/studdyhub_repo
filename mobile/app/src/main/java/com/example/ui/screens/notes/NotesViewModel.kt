package com.example.ui.screens.notes

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.data.local.entities.NoteEntity
import com.example.data.repository.StuddyHubRepository
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch

data class NotesUiState(
    val notes: List<NoteEntity> = emptyList(),
    val searchQuery: String = "",
    val selectedCategory: String = "All",
    val showFavoritesOnly: Boolean = false,
    val isLoading: Boolean = false,
    val userMessage: String? = null
)

class NotesViewModel(private val repository: StuddyHubRepository) : ViewModel() {

    private val _searchQuery = MutableStateFlow("")
    private val _selectedCategory = MutableStateFlow("All")
    private val _showFavoritesOnly = MutableStateFlow(false)
    private val _isLoading = MutableStateFlow(false)
    private val _userMessage = MutableStateFlow<String?>(null)

    val uiState: StateFlow<NotesUiState> = combine(
        repository.allNotes,
        _searchQuery,
        _selectedCategory,
        _showFavoritesOnly
    ) { notes, query, category, favoritesOnly ->
        val filtered = notes.filter { note ->
            val matchesCategory = category == "All" || note.category.equals(category, ignoreCase = true)
            val matchesQuery = query.isBlank() || note.title.contains(query, ignoreCase = true) ||
                    note.content.contains(query, ignoreCase = true) ||
                    note.tags.contains(query, ignoreCase = true)
            val matchesFavorite = !favoritesOnly || note.isFavorite
            matchesCategory && matchesQuery && matchesFavorite
        }
        NotesUiState(
            notes = filtered,
            searchQuery = query,
            selectedCategory = category,
            showFavoritesOnly = favoritesOnly
        )
    }.combine(_isLoading) { state, loading ->
        state.copy(isLoading = loading)
    }.combine(_userMessage) { state, msg ->
        state.copy(userMessage = msg)
    }.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5000),
        initialValue = NotesUiState()
    )

    fun onSearchQueryChanged(query: String) {
        _searchQuery.value = query
    }

    fun onCategorySelected(category: String) {
        _selectedCategory.value = category
    }

    fun toggleFavoritesFilter() {
        _showFavoritesOnly.value = !_showFavoritesOnly.value
    }

    fun togglePin(id: String) {
        viewModelScope.launch {
            repository.togglePinNote(id)
        }
    }

    fun toggleFavorite(id: String) {
        viewModelScope.launch {
            repository.toggleFavoriteNote(id)
        }
    }

    fun createNote(title: String, content: String, category: String, tags: String) {
        viewModelScope.launch {
            _isLoading.value = true
            try {
                repository.saveNote(title, content, category, tags)
                _userMessage.value = "Note saved with AI summary!"
            } catch (e: Exception) {
                _userMessage.value = "We couldn't save this note. Please try again."
            } finally {
                _isLoading.value = false
            }
        }
    }

    fun createFromTemplate(templateType: String, topic: String) {
        viewModelScope.launch {
            _isLoading.value = true
            try {
                val created = repository.saveNoteFromTemplate(templateType, topic)
                _userMessage.value = "Created '${created.title}' from template!"
            } catch (e: Exception) {
                _userMessage.value = "We couldn't create the template note. Please try again."
            } finally {
                _isLoading.value = false
            }
        }
    }

    fun generateFlashcardsFromNote(note: NoteEntity) {
        viewModelScope.launch {
            _isLoading.value = true
            try {
                repository.generateFlashcardsFromNote(note.title, note.content)
                _userMessage.value = "Generated 3 flashcards from '${note.title}'!"
            } catch (e: Exception) {
                _userMessage.value = "We couldn't create flashcards from this note. Please try again."
            } finally {
                _isLoading.value = false
            }
        }
    }

    fun generateQuizFromNote(note: NoteEntity) {
        viewModelScope.launch {
            _isLoading.value = true
            try {
                repository.generateQuizFromTopic(note.title, note.content)
                _userMessage.value = "Generated Quiz from '${note.title}'!"
            } catch (e: Exception) {
                _userMessage.value = "We couldn't create a quiz from this note. Please try again."
            } finally {
                _isLoading.value = false
            }
        }
    }

    fun deleteNote(id: String) {
        viewModelScope.launch {
            repository.deleteNote(id)
            _userMessage.value = "Note deleted."
        }
    }

    fun clearUserMessage() {
        _userMessage.value = null
    }

    fun refreshNotes() {
        viewModelScope.launch {
            _isLoading.value = true
            try {
                repository.syncCloudDataToLocal()
                _userMessage.value = "Notes refreshed"
            } catch (e: Exception) {
                _userMessage.value = "We couldn't refresh your notes. Please try again."
            } finally {
                _isLoading.value = false
            }
        }
    }
}
