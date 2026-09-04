package com.example.ui

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import com.example.data.repository.StuddyHubRepository
import com.example.ui.screens.aichat.AIChatViewModel
import com.example.ui.screens.aipodcast.AIPodcastViewModel
import com.example.ui.screens.auth.AuthViewModel
import com.example.ui.screens.courses.CoursesViewModel
import com.example.ui.screens.dashboard.DashboardViewModel
import com.example.ui.screens.flashcards.FlashcardsViewModel
import com.example.ui.screens.notes.NotesViewModel
import com.example.ui.screens.onboarding.OnboardingViewModel
import com.example.ui.screens.documents.DocumentsViewModel
import com.example.ui.screens.profile.ProfileViewModel
import com.example.ui.screens.quizzes.QuizzesViewModel
import com.example.ui.screens.recordings.RecordingsViewModel
import com.example.ui.screens.schedule.ScheduleViewModel
import com.example.ui.screens.social.SocialViewModel

class ViewModelFactory(
    private val repository: StuddyHubRepository,
    private val appContext: Context? = null
) : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        return when {
            modelClass.isAssignableFrom(OnboardingViewModel::class.java) -> OnboardingViewModel(repository) as T
            modelClass.isAssignableFrom(AuthViewModel::class.java) -> AuthViewModel(repository) as T
            modelClass.isAssignableFrom(DashboardViewModel::class.java) -> DashboardViewModel(repository) as T
            modelClass.isAssignableFrom(NotesViewModel::class.java) -> NotesViewModel(repository) as T
            modelClass.isAssignableFrom(RecordingsViewModel::class.java) -> RecordingsViewModel(repository) as T
            modelClass.isAssignableFrom(QuizzesViewModel::class.java) -> QuizzesViewModel(repository) as T
            modelClass.isAssignableFrom(FlashcardsViewModel::class.java) -> FlashcardsViewModel(repository) as T
            modelClass.isAssignableFrom(ScheduleViewModel::class.java) -> ScheduleViewModel(repository) as T
            modelClass.isAssignableFrom(com.example.ui.screens.PracticeViewModel::class.java) -> com.example.ui.screens.PracticeViewModel(repository) as T
            modelClass.isAssignableFrom(AIPodcastViewModel::class.java) -> AIPodcastViewModel(repository) as T
            modelClass.isAssignableFrom(CoursesViewModel::class.java) -> CoursesViewModel(repository) as T
            modelClass.isAssignableFrom(SocialViewModel::class.java) -> SocialViewModel(repository) as T
            modelClass.isAssignableFrom(AIChatViewModel::class.java) -> AIChatViewModel(repository) as T
            modelClass.isAssignableFrom(ProfileViewModel::class.java) -> ProfileViewModel(repository) as T
            modelClass.isAssignableFrom(DocumentsViewModel::class.java) -> DocumentsViewModel(repository) as T
            modelClass.isAssignableFrom(com.example.ui.screens.splash.SplashViewModel::class.java) -> com.example.ui.screens.splash.SplashViewModel(repository, appContext) as T
            modelClass.isAssignableFrom(com.example.ui.screens.settings.SettingsViewModel::class.java) -> com.example.ui.screens.settings.SettingsViewModel(repository) as T
            modelClass.isAssignableFrom(com.example.ui.screens.search.SearchViewModel::class.java) -> com.example.ui.screens.search.SearchViewModel(repository, appContext) as T
            else -> throw IllegalArgumentException("Unknown ViewModel class: ${modelClass.name}")
        }
    }
}
