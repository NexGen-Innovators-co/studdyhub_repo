package com.example.ui.screens.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.data.repository.StuddyHubRepository
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class AuthUiState(
    val selectedTab: Int = 0, // 0: Sign In, 1: Sign Up
    val emailInput: String = "",
    val passwordInput: String = "",
    val confirmPasswordInput: String = "",
    val fullNameInput: String = "",
    val schoolInput: String = "",
    val phoneNumberInput: String = "",
    val dateOfBirth: String = "", // Display string for DOB
    val dateOfBirthMillis: Long? = null, // Epoch millis for COPPA age check
    val isPasswordVisible: Boolean = false,
    val isConfirmPasswordVisible: Boolean = false,
    val isLoading: Boolean = false,
    val errorMessage: String? = null,
    val infoMessage: String? = null,
    val isSuccess: Boolean = false,
    val onboardingCompleted: Boolean = false,
    val agreedToTerms: Boolean = false,
    // Email verification (OTP) state
    val showVerificationScreen: Boolean = false,
    val verificationCode: String = "",
    val verificationEmail: String = "",
    val isVerifying: Boolean = false,
    val verificationError: String? = null,
    val verificationSuccess: Boolean = false,
    val resendCooldownSec: Int = 0,
    // Password reset dialog state
    val resetEmailInput: String = "",
    val isResettingPassword: Boolean = false,
    val resetMessage: String? = null,
    val resetError: String? = null
)

class AuthViewModel(private val repository: StuddyHubRepository) : ViewModel() {

    private val _uiState = MutableStateFlow(AuthUiState())
    val uiState: StateFlow<AuthUiState> = _uiState.asStateFlow()

    fun selectTab(tabIndex: Int) {
        _uiState.value = _uiState.value.copy(
            selectedTab = tabIndex,
            errorMessage = null,
            infoMessage = null
        )
    }

    fun onEmailChanged(email: String) {
        _uiState.value = _uiState.value.copy(emailInput = email, errorMessage = null, infoMessage = null)
    }

    fun onPasswordChanged(password: String) {
        _uiState.value = _uiState.value.copy(passwordInput = password, errorMessage = null, infoMessage = null)
    }

    fun onFullNameChanged(name: String) {
        _uiState.value = _uiState.value.copy(fullNameInput = name, errorMessage = null, infoMessage = null)
    }

    fun onSchoolChanged(school: String) {
        _uiState.value = _uiState.value.copy(schoolInput = school, errorMessage = null, infoMessage = null)
    }

    fun onConfirmPasswordChanged(password: String) {
        _uiState.value = _uiState.value.copy(confirmPasswordInput = password, errorMessage = null, infoMessage = null)
    }

    fun onPhoneNumberChanged(phone: String) {
        // Strip spaces and dashes for storage
        val cleaned = phone.filter { it.isDigit() || it == '+' }
        _uiState.value = _uiState.value.copy(phoneNumberInput = cleaned, errorMessage = null, infoMessage = null)
    }

    fun onDateOfBirthChanged(dob: String) {
        _uiState.value = _uiState.value.copy(dateOfBirth = dob, errorMessage = null, infoMessage = null)
    }

    fun onDateOfBirthMillisChanged(millis: Long?) {
        _uiState.value = _uiState.value.copy(dateOfBirthMillis = millis, errorMessage = null, infoMessage = null)
    }

    fun onTermsAgreed(agreed: Boolean) {
        _uiState.value = _uiState.value.copy(agreedToTerms = agreed, errorMessage = null)
    }

    fun togglePasswordVisibility() {
        _uiState.value = _uiState.value.copy(isPasswordVisible = !_uiState.value.isPasswordVisible)
    }

    fun toggleConfirmPasswordVisibility() {
        _uiState.value = _uiState.value.copy(isConfirmPasswordVisible = !_uiState.value.isConfirmPasswordVisible)
    }

    fun onResetEmailChanged(email: String) {
        _uiState.value = _uiState.value.copy(
            resetEmailInput = email,
            resetMessage = null,
            resetError = null
        )
    }

    /** Clears any pending reset state and re-seeds the email field from the sign-in field. */
    fun openResetDialog() {
        _uiState.value = _uiState.value.copy(
            resetEmailInput = _uiState.value.emailInput,
            resetMessage = null,
            resetError = null,
            isResettingPassword = false
        )
    }

    fun clearResetState() {
        _uiState.value = _uiState.value.copy(
            resetEmailInput = "",
            isResettingPassword = false,
            resetMessage = null,
            resetError = null
        )
    }

    /** Sends the password-recovery request through the real Supabase GoTrue endpoint. */
    fun requestPasswordReset(onDone: () -> Unit) {
        val email = _uiState.value.resetEmailInput.trim()
        if (email.isBlank() || !email.contains("@")) {
            _uiState.value = _uiState.value.copy(resetError = "Please enter a valid email address.")
            return
        }

        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isResettingPassword = true, resetMessage = null, resetError = null)
            val result = com.example.data.remote.BackendApiService.supabaseResetPassword(email)
            _uiState.value = _uiState.value.copy(isResettingPassword = false)

            when (result) {
                is com.example.data.remote.BackendResult.Success -> {
                    _uiState.value = _uiState.value.copy(
                        resetMessage = "If an account exists for $email, a password reset link is on its way. Check your inbox (and spam folder)."
                    )
                    onDone()
                }
                is com.example.data.remote.BackendResult.Error -> {
                    _uiState.value = _uiState.value.copy(
                        resetError = com.example.data.remote.BackendApiService
                            .userFacingErrorMessage(result.message)
                    )
                }
            }
        }
    }

    fun signIn(onSuccess: (Boolean) -> Unit = {}) {
        val email = _uiState.value.emailInput.trim()
        val password = _uiState.value.passwordInput

        if (email.isBlank() || !email.contains("@")) {
            _uiState.value = _uiState.value.copy(errorMessage = "Please enter a valid email address.")
            return
        }
        if (password.length < 6) {
            _uiState.value = _uiState.value.copy(errorMessage = "Password must be at least 6 characters.")
            return
        }

        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null, infoMessage = null)
            val name = _uiState.value.fullNameInput.trim()
            val school = _uiState.value.schoolInput.trim()

            // Call real Supabase Auth Sign In endpoint
            val authResult = com.example.data.remote.BackendApiService.supabaseSignIn(email, password)

            when (authResult) {
                is com.example.data.remote.BackendResult.Success -> {
                    val resJson = authResult.data
                    val token = resJson.optString("access_token")
                    val refreshToken = resJson.optString("refresh_token")
                    val tokenExpiresAt = parseTokenExpiry(resJson)
                    val userObj = resJson.optJSONObject("user")
                    val subUserId = userObj?.optString("id") ?: resJson.optString("id")

                    if (!subUserId.isNullOrBlank()) {
                        com.example.data.remote.BackendApiService.currentUserId = subUserId
                    }
                    if (!token.isNullOrBlank()) {
                        com.example.data.remote.BackendApiService.userAccessToken = token
                    }
                    if (!refreshToken.isNullOrBlank()) {
                        com.example.data.remote.BackendApiService.refreshToken = refreshToken
                    }
                    if (tokenExpiresAt > 0L) {
                        com.example.data.remote.BackendApiService.tokenExpiresAt = tokenExpiresAt
                    }

                    // Fetch existing profile — prefer auth-onboarding edge function (single source of truth)
                    var finalName = name
                    var finalSchool = school
                    var finalStyle = "visual"
                    var finalTier = ""
                    var finalLevel = ""
                    var onboardingCompleted = false
                    var finalPoints: Int? = null
                    var finalAvatar: String? = null

                    val edgeProfile = com.example.data.remote.BackendApiService.getCloudProfile()
                    val profileFetched = when (edgeProfile) {
                        is com.example.data.remote.BackendResult.Success -> {
                            val d = edgeProfile.data
                            if (d.optBoolean("success", false)) d else null
                        }
                        else -> null
                    }
                    // Fallback to direct REST if edge function is unavailable
                    val profileData = profileFetched ?: run {
                        val res = com.example.data.remote.BackendApiService.fetchUserProfile(email, subUserId.ifBlank { null })
                        if (res is com.example.data.remote.BackendResult.Success) res.data else null
                    }

                    if (profileData != null) {
                        finalName = profileData.optString("full_name", name).takeIf { it.isNotBlank() } ?: name
                        finalSchool = profileData.optString("school", school).takeIf { it.isNotBlank() } ?: school
                        finalStyle = profileData.optString("learning_style", "visual").takeIf { it.isNotBlank() } ?: "visual"
                        onboardingCompleted = profileData.optBoolean("onboarding_completed", false) || profileData.optBoolean("onboardingCompleted", false)
                        finalTier = if (onboardingCompleted) {
                            profileData.optString("academic_tier", "").let { if (it == "null" || it.isBlank()) profileData.optString("academicTier", "").let { v -> if (v == "null" || v.isBlank()) "" else v } else it }
                        } else ""
                        finalLevel = if (onboardingCompleted) {
                            profileData.optString("academic_level", "").let { if (it == "null" || it.isBlank()) profileData.optString("academicLevel", "").let { v -> if (v == "null" || v.isBlank()) "" else v } else it }
                        } else ""
                        if (profileData.has("points_balance")) finalPoints = profileData.optInt("points_balance", 0)
                        else if (profileData.has("pointsBalance")) finalPoints = profileData.optInt("pointsBalance", 0)
                        finalAvatar = profileData.optString("avatar_url", "").takeIf { it.isNotBlank() }
                    } else {
                        val authUserRes = com.example.data.remote.BackendApiService.authenticateUser(email, name, school, "email")
                        if (authUserRes is com.example.data.remote.BackendResult.Success) {
                            val profileJson = authUserRes.data
                            finalName = profileJson.optString("full_name", name).takeIf { it.isNotBlank() } ?: name
                            finalSchool = profileJson.optString("school", school).takeIf { it.isNotBlank() } ?: school
                            finalStyle = profileJson.optString("learning_style", "visual").takeIf { it.isNotBlank() } ?: "visual"
                            onboardingCompleted = profileJson.optBoolean("onboarding_completed", false) || profileJson.optBoolean("onboardingCompleted", false)
                            finalTier = if (onboardingCompleted) {
                                profileJson.optString("academic_tier", "").let { if (it == "null" || it.isBlank()) profileJson.optString("academicTier", "").let { v -> if (v == "null" || v.isBlank()) "" else v } else it }
                            } else ""
                            finalLevel = if (onboardingCompleted) {
                                profileJson.optString("academic_level", "").let { if (it == "null" || it.isBlank()) profileJson.optString("academicLevel", "").let { v -> if (v == "null" || v.isBlank()) "" else v } else it }
                            } else ""
                            if (profileJson.has("points_balance")) finalPoints = profileJson.optInt("points_balance", 0)
                            else if (profileJson.has("pointsBalance")) finalPoints = profileJson.optInt("pointsBalance", 0)
                            finalAvatar = profileJson.optString("avatar_url", "").takeIf { it.isNotBlank() }
                        } else {
                            onboardingCompleted = false
                            finalTier = ""
                            finalLevel = ""
                        }
                    }

                    // Also check if education profile exists in cloud
                    // NOTE: profiles.onboarding_completed is the single source of truth.
                    // We do NOT override it based on user_education_profiles existence.

                    repository.loginUser(
                        email = email,
                        fullName = finalName,
                        school = finalSchool,
                        learningStyle = finalStyle,
                        onboardingCompleted = onboardingCompleted,
                        academicTier = finalTier,
                        academicLevel = finalLevel,
                        supabaseUserId = subUserId.ifBlank { null },
                        accessToken = token.ifBlank { null },
                        refreshToken = refreshToken.ifBlank { null },
                        tokenExpiresAt = tokenExpiresAt,
                        avatarUrl = finalAvatar,
                        pointsBalance = finalPoints
                    )

                    if (!subUserId.isNullOrBlank()) {
                        repository.syncEducationContextFromCloud()
                    }

                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        isSuccess = true,
                        onboardingCompleted = onboardingCompleted
                    )
                    onSuccess(onboardingCompleted)
                }
                is com.example.data.remote.BackendResult.Error -> {
                    android.util.Log.e("AuthViewModel", "Sign-in failed: ${authResult.message}")

                    // Detect "email not confirmed" — user exists but hasn't verified email.
                    // Supabase sends magic links (not numeric OTP) for existing users, so show
                    // a screen that supports BOTH: enter code OR confirm via email link.
                    val rawMsg = authResult.message ?: ""
                    if (rawMsg.contains("email not confirmed", ignoreCase = true)) {
                        _uiState.value = _uiState.value.copy(
                            isLoading = false,
                            showVerificationScreen = true,
                            verificationEmail = email,
                            verificationCode = "",
                            verificationError = null,
                            verificationSuccess = false,
                            resendCooldownSec = 60,
                            infoMessage = null
                        )
                        startResendCooldown()
                    } else {
                        _uiState.value = _uiState.value.copy(
                            isLoading = false,
                            errorMessage = com.example.data.remote.BackendApiService
                                .userFacingErrorMessage(authResult.message)
                        )
                    }
                }
            }
        }
    }

    fun signUp(onSuccess: (Boolean) -> Unit = {}) {
        val email = _uiState.value.emailInput.trim()
        val password = _uiState.value.passwordInput
        val name = _uiState.value.fullNameInput.trim()

        if (name.isBlank()) {
            _uiState.value = _uiState.value.copy(errorMessage = "Please enter your full name.")
            return
        }
        if (email.isBlank() || !email.contains("@")) {
            _uiState.value = _uiState.value.copy(errorMessage = "Please enter a valid email address.")
            return
        }
        if (password.length < 6) {
            _uiState.value = _uiState.value.copy(errorMessage = "Password must be at least 6 characters long.")
            return
        }
        if (password != _uiState.value.confirmPasswordInput) {
            _uiState.value = _uiState.value.copy(errorMessage = "Passwords do not match.")
            return
        }
        // COPPA: require date of birth and verify user is 13+
        val dobMillis = _uiState.value.dateOfBirthMillis
        if (dobMillis == null) {
            _uiState.value = _uiState.value.copy(errorMessage = "Please select your date of birth.")
            return
        }
        val age = calculateAge(dobMillis)
        if (age < 13) {
            _uiState.value = _uiState.value.copy(errorMessage = "You must be at least 13 years old to create an account.")
            return
        }
        if (!_uiState.value.agreedToTerms) {
            _uiState.value = _uiState.value.copy(errorMessage = "Please agree to the Terms of Service to continue.")
            return
        }
        // Optional phone validation: if entered, must be at least 8 digits
        val phone = _uiState.value.phoneNumberInput.trim()
        if (phone.isNotEmpty() && phone.filter { it.isDigit() }.length < 8) {
            _uiState.value = _uiState.value.copy(errorMessage = "Phone number must be at least 8 digits.")
            return
        }

        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null, infoMessage = null)
            val school = _uiState.value.schoolInput.trim()

            // Call real Supabase Auth Sign Up endpoint
            val signUpResult = com.example.data.remote.BackendApiService.supabaseSignUp(email, password, name, school)

            when (signUpResult) {
                is com.example.data.remote.BackendResult.Success -> {
                    val responseJson = signUpResult.data
                    val accessToken = responseJson.optString("access_token")
                    val userObj = responseJson.optJSONObject("user")
                    val confirmationSentAt = responseJson.optString("confirmation_sent_at", userObj?.optString("confirmation_sent_at", ""))

                    val refreshToken = responseJson.optString("refresh_token")
                    val tokenExpiresAt = parseTokenExpiry(responseJson)

                    if (accessToken.isBlank()) {
                        // Supabase has email confirmation enabled — send OTP for in-app verification
                        val otpResult = com.example.data.remote.BackendApiService.sendOtpCode(email, createUser = false)
                        when (otpResult) {
                            is com.example.data.remote.BackendResult.Success -> {
                                _uiState.value = _uiState.value.copy(
                                    isLoading = false,
                                    showVerificationScreen = true,
                                    verificationEmail = email,
                                    verificationCode = "",
                                    verificationError = null,
                                    verificationSuccess = false,
                                    resendCooldownSec = 60
                                )
                                startResendCooldown()
                            }
                            is com.example.data.remote.BackendResult.Error -> {
                                // OTP send failed — show verification screen with fallback to email link
                                _uiState.value = _uiState.value.copy(
                                    isLoading = false,
                                    showVerificationScreen = true,
                                    verificationEmail = email,
                                    verificationCode = "",
                                    verificationError = "Could not send code. Check your email for the confirmation link instead.",
                                    verificationSuccess = false,
                                    resendCooldownSec = 60
                                )
                                startResendCooldown()
                            }
                        }
                    } else {
                        // Immediate session granted
                        val subUserId = userObj?.optString("id") ?: responseJson.optString("id")
                        if (!subUserId.isNullOrBlank()) {
                            com.example.data.remote.BackendApiService.currentUserId = subUserId
                        }
                        if (!accessToken.isNullOrBlank()) {
                            com.example.data.remote.BackendApiService.userAccessToken = accessToken
                        }
                        if (!refreshToken.isNullOrBlank()) {
                            com.example.data.remote.BackendApiService.refreshToken = refreshToken
                        }
                        if (tokenExpiresAt > 0L) {
                            com.example.data.remote.BackendApiService.tokenExpiresAt = tokenExpiresAt
                        }

                        com.example.data.remote.BackendApiService.authenticateUser(email, name, school, "email")
                        repository.loginUser(
                            email = email,
                            fullName = name,
                            school = school,
                            onboardingCompleted = false,
                            supabaseUserId = subUserId.ifBlank { null },
                            accessToken = accessToken.ifBlank { null },
                            refreshToken = refreshToken.ifBlank { null },
                            tokenExpiresAt = tokenExpiresAt
                        )

                        _uiState.value = _uiState.value.copy(isLoading = false, isSuccess = true, onboardingCompleted = false)
                        onSuccess(false)
                    }
                }
                is com.example.data.remote.BackendResult.Error -> {
                    android.util.Log.e("AuthViewModel", "Sign-up failed: ${signUpResult.message}")
                    val rawMsg = signUpResult.message ?: ""

                    // "Already registered" — this account exists and is confirmed.
                    // Do NOT send OTP (Supabase sends magic links, not numeric codes for existing users).
                    // Instead, tell the user to sign in.
                    if (rawMsg.contains("already registered", ignoreCase = true) ||
                        rawMsg.contains("user already", ignoreCase = true)) {
                        _uiState.value = _uiState.value.copy(
                            isLoading = false,
                            selectedTab = 0,
                            errorMessage = "This email is already registered. Please sign in instead.",
                            emailInput = email
                        )
                    } else {
                        _uiState.value = _uiState.value.copy(
                            isLoading = false,
                            errorMessage = com.example.data.remote.BackendApiService
                                .userFacingErrorMessage(signUpResult.message)
                        )
                    }
                }
            }
        }
    }

    /** Calculate age from birthday millis for COPPA compliance. */
    private fun calculateAge(birthdayMillis: Long): Int {
        val cal = java.util.Calendar.getInstance()
        val now = cal.apply { timeInMillis = System.currentTimeMillis() }
        val birth = java.util.Calendar.getInstance().apply { timeInMillis = birthdayMillis }
        var age = now.get(java.util.Calendar.YEAR) - birth.get(java.util.Calendar.YEAR)
        if (now.get(java.util.Calendar.DAY_OF_YEAR) < birth.get(java.util.Calendar.DAY_OF_YEAR)) {
            age--
        }
        return age
    }

    /** Extract the access-token expiry (epoch millis) from a GoTrue session response. */
    private fun parseTokenExpiry(json: org.json.JSONObject): Long {
        val expiresAtSec = json.optLong("expires_at", 0L)
        if (expiresAtSec > 0L) return expiresAtSec * 1000L
        val expiresInSec = json.optLong("expires_in", 0L)
        if (expiresInSec > 0L) return System.currentTimeMillis() + expiresInSec * 1000L
        return 0L
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // IN-APP EMAIL VERIFICATION (OTP)
    // ─────────────────────────────────────────────────────────────────────────────

    fun onVerificationCodeChanged(code: String) {
        _uiState.value = _uiState.value.copy(
            verificationCode = code,
            verificationError = null
        )
        // Auto-submit when 8 digits are entered
        if (code.length == 8) {
            verifyOtp()
        }
    }

    private fun verifyOtp() {
        val state = _uiState.value
        val email = state.verificationEmail
        val code = state.verificationCode.trim()

        if (code.length != 8) {
            _uiState.value = state.copy(verificationError = "Please enter the 8-digit code.")
            return
        }

        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isVerifying = true, verificationError = null)
            val result = com.example.data.remote.BackendApiService.verifyOtpCode(email, code, "signup")

            when (result) {
                is com.example.data.remote.BackendResult.Success -> {
                    val json = result.data
                    val accessToken = json.optString("access_token")
                    val refreshToken = json.optString("refresh_token")
                    val tokenExpiresAt = parseTokenExpiry(json)
                    val userObj = json.optJSONObject("user")
                    val subUserId = userObj?.optString("id") ?: json.optString("id")

                    if (!subUserId.isNullOrBlank()) {
                        com.example.data.remote.BackendApiService.currentUserId = subUserId
                    }
                    if (!accessToken.isNullOrBlank()) {
                        com.example.data.remote.BackendApiService.userAccessToken = accessToken
                    }
                    if (!refreshToken.isNullOrBlank()) {
                        com.example.data.remote.BackendApiService.refreshToken = refreshToken
                    }
                    if (tokenExpiresAt > 0L) {
                        com.example.data.remote.BackendApiService.tokenExpiresAt = tokenExpiresAt
                    }

                    val name = _uiState.value.fullNameInput.trim()
                    val school = _uiState.value.schoolInput.trim()
                    
                    // Fetch existing profile — prefer auth-onboarding edge function (single source of truth)
                    var finalName = name
                    var finalSchool = school
                    var finalStyle = "visual"
                    var finalTier = ""
                    var finalLevel = ""
                    var finalAvatar: String? = null
                    var finalPoints = 0
                    var onboardingCompleted = false

                    val edgeProfile = com.example.data.remote.BackendApiService.getCloudProfile()
                    val profileFetched = when (edgeProfile) {
                        is com.example.data.remote.BackendResult.Success -> {
                            val d = edgeProfile.data
                            if (d.optBoolean("success", false)) d else null
                        }
                        else -> null
                    }
                    // Fallback to direct REST if edge function is unavailable
                    val profileData = profileFetched ?: run {
                        val res = com.example.data.remote.BackendApiService.fetchUserProfile(email, subUserId.ifBlank { null })
                        if (res is com.example.data.remote.BackendResult.Success) res.data else null
                    }

                    if (profileData != null) {
                        finalName = profileData.optString("full_name", name).takeIf { it.isNotBlank() } ?: name
                        finalSchool = profileData.optString("school", school).takeIf { it.isNotBlank() } ?: school
                        finalStyle = profileData.optString("learning_style", "visual").takeIf { it.isNotBlank() } ?: "visual"
                        onboardingCompleted = profileData.optBoolean("onboarding_completed", false) || profileData.optBoolean("onboardingCompleted", false)
                        finalTier = if (onboardingCompleted) {
                            profileData.optString("academic_tier", "").let { if (it == "null" || it.isBlank()) profileData.optString("academicTier", "").let { v -> if (v == "null" || v.isBlank()) "" else v } else it }
                        } else ""
                        finalLevel = if (onboardingCompleted) {
                            profileData.optString("academic_level", "").let { if (it == "null" || it.isBlank()) profileData.optString("academicLevel", "").let { v -> if (v == "null" || v.isBlank()) "" else v } else it }
                        } else ""
                        if (profileData.has("points_balance")) finalPoints = profileData.optInt("points_balance", 0)
                        else if (profileData.has("pointsBalance")) finalPoints = profileData.optInt("pointsBalance", 0)
                        finalAvatar = profileData.optString("avatar_url", "").takeIf { it.isNotBlank() && it != "null" }
                    } else {
                        com.example.data.remote.BackendApiService.authenticateUser(email, name, school, "email")
                        onboardingCompleted = false
                        finalTier = ""
                        finalLevel = ""
                    }

                    // NOTE: profiles.onboarding_completed is the single source of truth.
                    // We do NOT override it based on user_education_profiles existence.

                    repository.loginUser(
                        email = email,
                        fullName = finalName,
                        school = finalSchool,
                        learningStyle = finalStyle,
                        onboardingCompleted = onboardingCompleted,
                        academicTier = finalTier,
                        academicLevel = finalLevel,
                        supabaseUserId = subUserId.ifBlank { null },
                        accessToken = accessToken.ifBlank { null },
                        refreshToken = refreshToken.ifBlank { null },
                        tokenExpiresAt = tokenExpiresAt,
                        avatarUrl = finalAvatar,
                        pointsBalance = finalPoints
                    )

                    if (!subUserId.isNullOrBlank()) {
                        repository.syncEducationContextFromCloud()
                    }

                    _uiState.value = _uiState.value.copy(
                        isVerifying = false,
                        verificationSuccess = true,
                        onboardingCompleted = onboardingCompleted
                    )
                    // Signal success after brief delay for UX feedback
                    kotlinx.coroutines.delay(800)
                    _uiState.value = _uiState.value.copy(isSuccess = true, showVerificationScreen = false)
                }
                is com.example.data.remote.BackendResult.Error -> {
                    _uiState.value = _uiState.value.copy(
                        isVerifying = false,
                        verificationError = result.message ?: "Invalid code. Please try again."
                    )
                }
            }
        }
    }

    fun resendOtp() {
        val email = _uiState.value.verificationEmail
        if (email.isBlank()) return

        viewModelScope.launch {
            val result = com.example.data.remote.BackendApiService.sendOtpCode(email, createUser = false)
            when (result) {
                is com.example.data.remote.BackendResult.Success -> {
                    _uiState.value = _uiState.value.copy(
                        resendCooldownSec = 60,
                        verificationError = null
                    )
                    startResendCooldown()
                }
                is com.example.data.remote.BackendResult.Error -> {
                    _uiState.value = _uiState.value.copy(
                        verificationError = result.message ?: "Failed to resend code."
                    )
                }
            }
        }
    }

    private fun startResendCooldown() {
        viewModelScope.launch {
            for (i in 60 downTo 0) {
                _uiState.value = _uiState.value.copy(resendCooldownSec = i)
                kotlinx.coroutines.delay(1000L)
            }
        }
    }

    fun dismissVerification() {
        _uiState.value = _uiState.value.copy(
            showVerificationScreen = false,
            verificationCode = "",
            verificationError = null,
            verificationSuccess = false
        )
    }

    /**
     * Called when the user taps "I confirmed via link" on the verification screen.
     * Retries sign-in — if the email is now confirmed, the session will be granted.
     */
    fun retrySignInAfterConfirmation(onSuccess: (Boolean) -> Unit = {}) {
        val email = _uiState.value.verificationEmail
        val password = _uiState.value.passwordInput
        if (email.isBlank() || password.isBlank()) {
            _uiState.value = _uiState.value.copy(
                showVerificationScreen = false,
                errorMessage = "Please enter your password to sign in."
            )
            return
        }

        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isVerifying = true, verificationError = null)
            val authResult = com.example.data.remote.BackendApiService.supabaseSignIn(email, password)

            when (authResult) {
                is com.example.data.remote.BackendResult.Success -> {
                    val resJson = authResult.data
                    val token = resJson.optString("access_token")
                    val refreshToken = resJson.optString("refresh_token")
                    val tokenExpiresAt = parseTokenExpiry(resJson)
                    val userObj = resJson.optJSONObject("user")
                    val subUserId = userObj?.optString("id") ?: resJson.optString("id")

                    if (!subUserId.isNullOrBlank()) {
                        com.example.data.remote.BackendApiService.currentUserId = subUserId
                    }
                    if (!token.isNullOrBlank()) {
                        com.example.data.remote.BackendApiService.userAccessToken = token
                    }
                    if (!refreshToken.isNullOrBlank()) {
                        com.example.data.remote.BackendApiService.refreshToken = refreshToken
                    }
                    if (tokenExpiresAt > 0L) {
                        com.example.data.remote.BackendApiService.tokenExpiresAt = tokenExpiresAt
                    }

                    // Fetch profile — prefer auth-onboarding edge function (single source of truth)
                    var finalName = ""
                    var finalSchool = ""
                    var finalStyle = "visual"
                    var finalTier = ""
                    var finalLevel = ""
                    var finalAvatar: String? = null
                    var finalPoints = 0
                    var onboardingCompleted = false

                    val edgeProfile = com.example.data.remote.BackendApiService.getCloudProfile()
                    val profileFetched = when (edgeProfile) {
                        is com.example.data.remote.BackendResult.Success -> {
                            val d = edgeProfile.data
                            if (d.optBoolean("success", false)) d else null
                        }
                        else -> null
                    }
                    val profileData = profileFetched ?: run {
                        val res = com.example.data.remote.BackendApiService.fetchUserProfile(email, subUserId.ifBlank { null })
                        if (res is com.example.data.remote.BackendResult.Success) res.data else null
                    }

                    if (profileData != null) {
                        finalName = profileData.optString("full_name", "").takeIf { it.isNotBlank() } ?: ""
                        finalSchool = profileData.optString("school", "").takeIf { it.isNotBlank() } ?: ""
                        finalStyle = profileData.optString("learning_style", "visual").takeIf { it.isNotBlank() } ?: "visual"
                        finalTier = profileData.optString("academic_tier", "").let { if (it == "null" || it.isBlank()) profileData.optString("academicTier", "").let { v -> if (v == "null" || v.isBlank()) "" else v } else it }
                        finalLevel = profileData.optString("academic_level", "").let { if (it == "null" || it.isBlank()) profileData.optString("academicLevel", "").let { v -> if (v == "null" || v.isBlank()) "" else v } else it }
                        if (profileData.has("points_balance")) finalPoints = profileData.optInt("points_balance", 0)
                        else if (profileData.has("pointsBalance")) finalPoints = profileData.optInt("pointsBalance", 0)
                        finalAvatar = profileData.optString("avatar_url", "").takeIf { it.isNotBlank() && it != "null" }
                        onboardingCompleted = profileData.optBoolean("onboarding_completed", false) || profileData.optBoolean("onboardingCompleted", false)
                    }

                    // NOTE: profiles.onboarding_completed is the single source of truth.
                    // We do NOT override it based on user_education_profiles existence.

                    repository.loginUser(
                        email = email,
                        fullName = finalName,
                        school = finalSchool,
                        learningStyle = finalStyle,
                        onboardingCompleted = onboardingCompleted,
                        academicTier = finalTier,
                        academicLevel = finalLevel,
                        supabaseUserId = subUserId.ifBlank { null },
                        accessToken = token.ifBlank { null },
                        refreshToken = refreshToken.ifBlank { null },
                        tokenExpiresAt = tokenExpiresAt,
                        avatarUrl = finalAvatar,
                        pointsBalance = finalPoints
                    )

                    if (!subUserId.isNullOrBlank()) {
                        repository.syncEducationContextFromCloud()
                    }

                    _uiState.value = _uiState.value.copy(
                        isVerifying = false,
                        verificationSuccess = true,
                        onboardingCompleted = onboardingCompleted
                    )
                    kotlinx.coroutines.delay(800)
                    _uiState.value = _uiState.value.copy(
                        isSuccess = true,
                        showVerificationScreen = false
                    )
                    onSuccess(onboardingCompleted)
                }
                is com.example.data.remote.BackendResult.Error -> {
                    val errMsg = authResult.message ?: ""
                    if (errMsg.contains("email not confirmed", ignoreCase = true)) {
                        _uiState.value = _uiState.value.copy(
                            isVerifying = false,
                            verificationError = "Email is still not confirmed. Check your inbox and tap the confirmation link, then try again."
                        )
                    } else {
                        _uiState.value = _uiState.value.copy(
                            isVerifying = false,
                            verificationError = com.example.data.remote.BackendApiService
                                .userFacingErrorMessage(authResult.message)
                        )
                    }
                }
            }
        }
    }

    /**
     * Resend the confirmation email / magic link.
     * This calls the Supabase signup endpoint again to trigger a new confirmation email.
     */
    fun resendConfirmationEmail() {
        val email = _uiState.value.verificationEmail
        if (email.isBlank()) return

        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(resendCooldownSec = 60, verificationError = null)
            // Re-trigger signup to resend confirmation — Supabase returns 200 for existing users
            val name = _uiState.value.fullNameInput.trim()
            val password = _uiState.value.passwordInput
            com.example.data.remote.BackendApiService.supabaseSignUp(email, password, name, "")
            startResendCooldown()
        }
    }

    /**
     * Handle Google Sign-In result from the browser OAuth flow.
     * The browser redirects to studdyhub://auth-callback with tokens in the fragment.
     * This method processes those tokens the same way as email/password sign-in.
     *
     * For NEW users: extracts email/name from the JWT, creates a minimal profile,
     * and navigates to onboarding so they can complete setup.
     * For EXISTING users: fetches the profile from cloud and logs them in directly.
     */
    fun handleGoogleSignInResult(accessToken: String, refreshToken: String, onSuccess: (Boolean) -> Unit = {}) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, errorMessage = null, infoMessage = null)

            // Decode the JWT to extract user info (sub, email, name)
            val jwtClaims = try {
                val parts = accessToken.split(".")
                if (parts.size >= 2) {
                    val payload = parts[1]
                    val decoded = android.util.Base64.decode(
                        payload.replace('-', '+').replace('_', '/'),
                        android.util.Base64.NO_WRAP
                    )
                    org.json.JSONObject(String(decoded, Charsets.UTF_8))
                } else null
            } catch (e: Exception) {
                android.util.Log.w("AuthViewModel", "Could not decode JWT: ${e.message}")
                null
            }

            val subUserId = jwtClaims?.optString("sub")
            val jwtEmail = jwtClaims?.optString("email") ?: ""
            // Supabase puts Google user data in user_metadata, not at top level
            val userMeta = jwtClaims?.optJSONObject("user_metadata")
            val jwtFullName = jwtClaims?.optString("name")
                ?: userMeta?.optString("full_name")
                ?: userMeta?.optString("name")
                ?: ""
            val jwtAvatarUrl = jwtClaims?.optString("picture")
                ?: userMeta?.optString("picture")
                ?: userMeta?.optString("avatar_url")
                ?: ""

            android.util.Log.d("AuthViewModel", "Google Sign-In JWT: sub=$subUserId, email=$jwtEmail, name=$jwtFullName, hasAvatar=${jwtAvatarUrl.isNotBlank()}")

            // Set tokens on the BackendApiService (same as email/password flow)
            if (!subUserId.isNullOrBlank()) {
                com.example.data.remote.BackendApiService.currentUserId = subUserId
            }
            com.example.data.remote.BackendApiService.userAccessToken = accessToken
            com.example.data.remote.BackendApiService.refreshToken = refreshToken
            // Extract token expiry from JWT 'exp' claim (same as email/password flow)
            val expClaim = jwtClaims?.optLong("exp", 0L) ?: 0L
            if (expClaim > 0L) {
                com.example.data.remote.BackendApiService.tokenExpiresAt = expClaim * 1000
            }

            // Try to fetch existing profile from cloud
            var profileFetched = false
            try {
                val profileResult = com.example.data.remote.BackendApiService.executeEdgeFunction(
                    "auth-onboarding",
                    org.json.JSONObject().apply {
                        put("action", "get-profile")
                    }
                )

                if (profileResult is com.example.data.remote.BackendResult.Success) {
                    val profileJson = profileResult.data
                    // Check if the RPC returned actual profile data (not just an error object)
                    if (profileJson.has("id") || profileJson.has("full_name")) {
                        val userId = profileJson.optString("id", subUserId ?: "")
                        val fullName = profileJson.optString("full_name", jwtFullName)
                        val email = profileJson.optString("email", jwtEmail)
                        val onboardingComplete = profileJson.optBoolean("onboarding_completed", false)
                        val school = profileJson.optString("school", "")
                        val learningStyle = profileJson.optString("learning_style", "visual").takeIf { it.isNotBlank() } ?: "visual"
                        val academicTier = profileJson.optString("academic_tier", "").let { if (it == "null" || it.isBlank()) "" else it }
                        val academicLevel = profileJson.optString("academic_level", "").let { if (it == "null" || it.isBlank()) "" else it }
                        val avatarUrl = profileJson.optString("avatar_url", "").takeIf { it.isNotBlank() }
                            ?: jwtAvatarUrl.takeIf { it.isNotBlank() }
                        val pointsBalance = if (profileJson.has("points_balance")) profileJson.optInt("points_balance", 0) else null

                        repository.loginUser(
                            email = email,
                            fullName = fullName,
                            school = school,
                            learningStyle = learningStyle,
                            academicTier = academicTier,
                            academicLevel = academicLevel,
                            onboardingCompleted = onboardingComplete,
                            supabaseUserId = userId,
                            accessToken = accessToken,
                            refreshToken = refreshToken,
                            pointsBalance = pointsBalance,
                            avatarUrl = avatarUrl
                        )

                        _uiState.value = _uiState.value.copy(
                            isLoading = false,
                            isSuccess = true,
                            onboardingCompleted = onboardingComplete
                        )
                        profileFetched = true
                        onSuccess(onboardingComplete)
                    }
                }
            } catch (e: Exception) {
                android.util.Log.w("AuthViewModel", "get-profile failed: ${e.message}")
            }

            // Profile not found — this is a NEW user. Create a minimal profile and
            // log them in so they land on the onboarding flow.
            if (!profileFetched) {
                android.util.Log.d("AuthViewModel", "New Google user — creating minimal profile")

                val userId = subUserId ?: ""
                if (userId.isNotBlank()) {
                    repository.loginUser(
                        email = jwtEmail,
                        fullName = jwtFullName,
                        school = "",
                        onboardingCompleted = false,
                        supabaseUserId = userId,
                        accessToken = accessToken,
                        refreshToken = refreshToken,
                        avatarUrl = jwtAvatarUrl.takeIf { it.isNotBlank() }
                    )
                }

                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    isSuccess = true,
                    onboardingCompleted = false
                )
                // Navigate to onboarding (onboardingCompleted = false)
                onSuccess(false)
            }
        }
    }
}
