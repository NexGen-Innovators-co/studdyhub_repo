package com.example.ui.screens.profile

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.data.local.EducationSubjectRef
import com.example.data.local.entities.ProfileEntity
import com.example.data.local.entities.UserEducationProfileEntity
import com.example.data.local.entities.UserStatsEntity
import com.example.data.local.entities.UserSubjectEntity
import com.example.data.repository.StuddyHubRepository
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch

data class ProfileUiState(
    val profile: ProfileEntity? = null,
    val stats: UserStatsEntity? = null,
    val educationProfile: UserEducationProfileEntity? = null,
    val enrolledSubjects: List<UserSubjectEntity> = emptyList(),
    val notesCount: Int = 0,
    val flashcardsCount: Int = 0,
    val recordingsCount: Int = 0,
    val podcastsCount: Int = 0
)

class ProfileViewModel(private val repository: StuddyHubRepository) : ViewModel() {

    init {
        refresh()
    }

    fun refresh() {
        viewModelScope.launch {
            try {
                repository.syncOnboardingStateFromCloud()
                repository.syncCloudDataToLocal()
            } catch (_: Exception) {}
        }
    }

    private val countsFlow = combine(
        repository.allNotes,
        repository.allFlashcards,
        repository.allRecordings,
        repository.allPodcasts
    ) { notes, flashcards, recordings, podcasts ->
        listOf(notes.size, flashcards.size, recordings.size, podcasts.size)
    }

    val uiState: StateFlow<ProfileUiState> = combine(
        repository.userProfile,
        repository.userStats,
        repository.educationProfile,
        repository.educationSubjects,
        countsFlow
    ) { profile, stats, eduProfile, subjects, counts ->
        ProfileUiState(
            profile = profile,
            stats = stats,
            educationProfile = eduProfile,
            enrolledSubjects = subjects,
            notesCount = counts[0],
            flashcardsCount = counts[1],
            recordingsCount = counts[2],
            podcastsCount = counts[3]
        )
    }.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5000),
        initialValue = ProfileUiState()
    )

    fun updateEducationContext(
        school: String,
        grade: String,
        selectedSubjectRefs: List<EducationSubjectRef>,
        onSuccess: () -> Unit
    ) {
        viewModelScope.launch {
            val isJhs = grade.startsWith("JHS", ignoreCase = true)
            val levelName = if (isJhs) "Junior High School" else "Primary School"
            val levelCategory = if (isJhs) "jhs" else "primary"
            val examName = if (isJhs) "BECE" else "National Assessment"

            repository.saveEducationSetup(
                countryId = null,
                countryCode = "GH",
                countryName = "Ghana",
                educationLevelId = null,
                levelName = levelName,
                levelCategory = levelCategory,
                curriculumId = null,
                curriculumName = "NaCCA Standards-Based Curriculum",
                targetExaminationId = null,
                examName = examName,
                institutionName = school,
                yearOrGrade = grade,
                subjects = selectedSubjectRefs
            )
            repository.regenerateKidRoadmap()
            onSuccess()
        }
    }

    fun logout(onLogout: () -> Unit) {
        viewModelScope.launch {
            repository.logoutUser()
            onLogout()
        }
    }

    private val _promoStatus = MutableStateFlow<String?>(null)
    val promoStatus: StateFlow<String?> = _promoStatus.asStateFlow()

    private val _isRedeeming = MutableStateFlow(false)
    val isRedeeming: StateFlow<Boolean> = _isRedeeming.asStateFlow()

    fun redeemPromoCode(promoCode: String, onSuccess: () -> Unit) {
        if (promoCode.trim().isBlank()) {
            _promoStatus.value = "Please enter a promo code."
            return
        }
        viewModelScope.launch {
            _isRedeeming.value = true
            _promoStatus.value = "Checking your code..."
            val result = repository.redeemPromoCode(promoCode.trim())
            _isRedeeming.value = false
            when (result) {
                is com.example.data.remote.BackendResult.Success -> {
                    _promoStatus.value = "✨ You're on the Genius plan — enjoy your free month!"
                    onSuccess()
                }
                is com.example.data.remote.BackendResult.Error -> {
                    _promoStatus.value = "That code didn't work. " +
                        com.example.data.remote.BackendApiService.userFacingErrorMessage(result.message)
                }
            }
        }
    }

    fun clearPromoStatus() {
        _promoStatus.value = null
    }
}
