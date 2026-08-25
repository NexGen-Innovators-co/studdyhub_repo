package com.example.ui.screens.settings

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.data.local.entities.ProfileEntity
import com.example.data.repository.StuddyHubRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

data class SettingsUiState(
    val profile: ProfileEntity? = null,
    val fullName: String = "",
    val email: String = "",
    val school: String = "",
    val academicLevel: String = "",
    val academicTier: String = "achiever",
    val learningStyle: String = "visual",
    val bio: String = "",
    val avatarUrl: String = "",
    val educationGrade: String = "",  // From user_education_profiles.year_or_grade
    val isSaving: Boolean = false,
    val userMessage: String? = null,
    val pendingSyncCount: Int = 0,
    val failedSyncCount: Int = 0
)

class SettingsViewModel(private val repository: StuddyHubRepository) : ViewModel() {

    private val _isSaving = MutableStateFlow(false)
    private val _userMessage = MutableStateFlow<String?>(null)
    private val _educationGrade = MutableStateFlow("")

    init {
        // Fetch the education profile's grade for Explorer class display
        viewModelScope.launch {
            try {
                repository.educationProfile.first()?.let {
                    _educationGrade.value = it.yearOrGrade ?: ""
                }
            } catch (_: Exception) {}
        }
    }

    val uiState: StateFlow<SettingsUiState> = combine(
        combine(repository.userProfile, _educationGrade) { profile, eduGrade -> profile to eduGrade },
        _isSaving,
        _userMessage,
        repository.pendingSyncCount,
        repository.failedSyncCount
    ) { (profile, eduGrade), saving, msg, pending, failed ->
        SettingsUiState(
            profile = profile,
            fullName = profile?.fullName ?: "",
            email = profile?.email ?: "",
            school = profile?.school ?: "",
            academicLevel = profile?.academicLevel ?: "",
            academicTier = profile?.academicTier ?: "achiever",
            learningStyle = profile?.learningStyle ?: "visual",
            bio = profile?.bio ?: "",
            avatarUrl = profile?.avatarUrl ?: "",
            educationGrade = eduGrade,
            isSaving = saving,
            userMessage = msg,
            pendingSyncCount = pending,
            failedSyncCount = failed
        )
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), SettingsUiState())

    fun saveProfile(
        fullName: String,
        school: String,
        academicLevel: String,
        academicTier: String = "",
        learningStyle: String = "visual",
        bio: String = ""
    ) {
        viewModelScope.launch {
            _isSaving.value = true
            try {
                repository.updateProfile(
                    fullName = fullName,
                    school = school,
                    academicLevel = academicLevel,
                    academicTier = academicTier.takeIf { it.isNotBlank() },
                    learningStyle = learningStyle,
                    bio = bio
                )
                
                val currentTier = academicTier.ifBlank { uiState.value.academicTier }.ifBlank { "achiever" }
                if (currentTier == "explorer" && academicLevel.isNotBlank()) {
                    val grade = academicLevel
                    val isJhs = grade.startsWith("JHS", ignoreCase = true)
                    val levelName = if (isJhs) "Junior High School" else "Primary School"
                    val levelCategory = if (isJhs) "jhs" else "primary"
                    val examName = if (isJhs) "BECE" else "National Assessment"
                    val subjects = listOf(
                        com.example.data.local.EducationSubjectRef(subjectId = null, code = "ENG", name = "English Language", category = "core"),
                        com.example.data.local.EducationSubjectRef(subjectId = null, code = "MATH", name = "Mathematics", category = "core"),
                        com.example.data.local.EducationSubjectRef(subjectId = null, code = "SCI", name = "Integrated Science", category = "core"),
                        com.example.data.local.EducationSubjectRef(subjectId = null, code = "SOC", name = "Social Studies", category = "core"),
                        com.example.data.local.EducationSubjectRef(subjectId = null, code = "ICT", name = "Computing & ICT", category = "elective")
                    )
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
                        institutionName = school.ifBlank { "My School" },
                        yearOrGrade = grade,
                        subjects = subjects
                    )
                }
                
                _userMessage.value = "Profile updated successfully!"
            } catch (e: Exception) {
                Log.e("SettingsVM", "Save profile failed: ${e.message}")
                _userMessage.value = "We couldn't save your profile. Please try again."
            } finally {
                _isSaving.value = false
            }
        }
    }

    fun updateAcademicTier(tier: String) {
        viewModelScope.launch {
            try {
                repository.updateAcademicTier(tier)
                val tierObj = com.example.ui.theme.AcademicTier.fromKey(tier)
                _userMessage.value = "Switched to ${tierObj.displayName} Mode (${tierObj.emoji})"
            } catch (e: Exception) {
                Log.e("SettingsVM", "Update academic tier failed: ${e.message}")
                _userMessage.value = "Could not update learning mode."
            }
        }
    }

    fun signOut() {
        viewModelScope.launch {
            repository.logoutUser()
        }
    }

    /** Clears all local data (keeps the session) and rebuilds the workspace fresh from the cloud. */
    fun resetLocalData() {
        viewModelScope.launch {
            _isSaving.value = true
            try {
                repository.resetLocalDataAndResync()
                _userMessage.value = "Local workspace rebuilt from the cloud — fresh start complete."
            } catch (e: Exception) {
                Log.e("SettingsVM", "Reset local data failed: ${e.message}")
                _userMessage.value = "Could not reset local data. Please try again."
            } finally {
                _isSaving.value = false
            }
        }
    }

    /** Permanently erases the user's data on the cloud, wipes the device and signs out. */
    fun eraseAllData(onDone: () -> Unit) {
        viewModelScope.launch {
            _isSaving.value = true
            try {
                val ok = repository.eraseAllUserData()
                if (ok) {
                    _userMessage.value = "All your StuddyHub data was erased."
                    onDone()
                } else {
                    _userMessage.value = "Could not erase cloud data. Please try again later."
                }
            } catch (e: Exception) {
                Log.e("SettingsVM", "Erase all data failed: ${e.message}")
                _userMessage.value = "Could not erase your data. Please try again."
            } finally {
                _isSaving.value = false
            }
        }
    }

    fun clearUserMessage() {
        _userMessage.value = null
    }
}
