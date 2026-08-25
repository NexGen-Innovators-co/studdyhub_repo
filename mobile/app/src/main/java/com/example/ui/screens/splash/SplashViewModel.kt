package com.example.ui.screens.splash

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.data.repository.StuddyHubRepository
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.firstOrNull
import kotlinx.coroutines.launch

sealed interface SplashNavigationState {
    object Loading : SplashNavigationState
    object NavigateToOnboarding : SplashNavigationState
    object NavigateToAuth : SplashNavigationState
    object NavigateToDashboard : SplashNavigationState
}

class SplashViewModel(private val repository: StuddyHubRepository) : ViewModel() {

    private val _navigationState = MutableStateFlow<SplashNavigationState>(SplashNavigationState.Loading)
    val navigationState: StateFlow<SplashNavigationState> = _navigationState.asStateFlow()

    init {
        checkSessionAndNavigate()
    }

    private fun checkSessionAndNavigate() {
        viewModelScope.launch {
            // Brief brand moment before navigating. Kept short: the session restore + token
            // refresh below already take real time on cold start, and a long forced floor
            // reads as lag on low-end devices.
            val startTime = System.currentTimeMillis()

            // Fetch the user profile directly from the database bypass any flow cache
            val profile = repository.getProfileDirect()

            val elapsed = System.currentTimeMillis() - startTime
            val remainingDelay = 600L - elapsed
            if (remainingDelay > 0) {
                delay(remainingDelay)
            }

            if (profile == null || !profile.isLoggedIn) {
                // User is not logged in -> must authenticate first
                _navigationState.value = SplashNavigationState.NavigateToAuth
            } else {
                // Restore session credentials in BackendApiService (access token, refresh token, expiry)
                com.example.data.remote.BackendApiService.currentUserId = profile.supabaseUserId.ifBlank { profile.id }
                com.example.data.remote.BackendApiService.userAccessToken = profile.accessToken.ifBlank { null }
                com.example.data.remote.BackendApiService.refreshToken = profile.refreshToken.ifBlank { null }
                com.example.data.remote.BackendApiService.tokenExpiresAt = profile.tokenExpiresAt

                android.util.Log.d("SplashViewModel", "Restored session for: ${profile.email} (ID: ${com.example.data.remote.BackendApiService.currentUserId})")

                // 1. Navigate IMMEDIATELY from local DB state — zero network block on startup!
                if (!profile.onboardingCompleted) {
                    _navigationState.value = SplashNavigationState.NavigateToOnboarding
                } else {
                    _navigationState.value = SplashNavigationState.NavigateToDashboard
                }

                // 2. Perform silent session token refresh and background cloud sync asynchronously
                val hasRefreshToken = !profile.refreshToken.isNullOrBlank()
                val hasExpiredAccessToken = com.example.data.remote.BackendApiService.isAccessTokenExpired()

                viewModelScope.launch {
                    if (hasRefreshToken && hasExpiredAccessToken) {
                        try {
                            val refreshRes = com.example.data.remote.BackendApiService.refreshSession()
                            if (refreshRes is com.example.data.remote.BackendResult.Success) {
                                repository.persistSessionTokens(
                                    com.example.data.remote.BackendApiService.userAccessToken,
                                    com.example.data.remote.BackendApiService.refreshToken,
                                    com.example.data.remote.BackendApiService.tokenExpiresAt
                                )
                                android.util.Log.d("SplashViewModel", "Renewed expired session in background for: ${profile.email}")
                            }
                        } catch (e: Exception) {
                            android.util.Log.w("SplashViewModel", "Background session renewal notice: ${e.message}")
                        }
                    }

                    try {
                        repository.syncCloudDataToLocal()
                    } catch (e: Exception) {
                        android.util.Log.e("SplashViewModel", "Background sync failed (will retry later): ${e.message}")
                    }

                    try {
                        repository.syncOnboardingStateFromCloud()
                    } catch (e: Exception) {
                        android.util.Log.e("SplashViewModel", "Onboarding sync failed: ${e.message}")
                    }
                }
            }
        }
    }
}
