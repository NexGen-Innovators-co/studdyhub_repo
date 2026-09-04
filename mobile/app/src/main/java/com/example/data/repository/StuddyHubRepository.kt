package com.example.data.repository

import com.example.data.local.StuddyHubDatabase
import com.example.data.local.entities.*
import com.example.data.remote.BackendApiService
import com.example.data.remote.BackendResult
import com.example.data.remote.GeminiApiService
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.debounce
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.firstOrNull
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.CancellationException
import org.json.JSONArray
import org.json.JSONObject
import com.example.util.safeString
import java.util.UUID

class StuddyHubRepository(private val db: StuddyHubDatabase) {

    companion object {
        @Volatile
        private var INSTANCE: StuddyHubRepository? = null

        /**
         * One repository per process. Each instance opens a realtime WebSocket, starts a startup
         * sync and a 5-minute fallback loop, so constructing it from a @Composable body — which
         * re-runs on every recomposition — multiplies every sync and leaks a socket per rebuild.
         */
        fun getInstance(db: StuddyHubDatabase): StuddyHubRepository =
            INSTANCE ?: synchronized(this) {
                INSTANCE ?: StuddyHubRepository(db).also { INSTANCE = it }
            }
    }

    // Global AI Generation States
    val isAIGenerating = MutableStateFlow(false)
    val generationMessage = MutableStateFlow("")

    fun clearGenerationMessage() {
        generationMessage.value = ""
    }
    val isSystemOffline = MutableStateFlow(false)
    private val repositoryScope = kotlinx.coroutines.CoroutineScope(kotlinx.coroutines.Dispatchers.IO + kotlinx.coroutines.SupervisorJob())

    private val realtimeSync = com.example.data.remote.RealtimeSyncManager { table, action, row ->
        repositoryScope.launch {
            try {
                handleRealtimeChange(table, action, row)
            } catch (e: Exception) {
                android.util.Log.w("StuddyHubRepository", "Realtime apply error: ${e.message}")
            }
        }
    }

    init {
        // Persist rotated tokens after every silent refresh so the session survives app
        // restarts (Supabase invalidates the old refresh token on each refresh).
        com.example.data.remote.BackendApiService.onSessionRefreshed = { accessToken, refreshToken, expiresAt ->
            persistSessionTokens(accessToken, refreshToken, expiresAt)
            realtimeSync.refresh()
        }

        // Full sync on startup, then switch to realtime subscriptions.
        repositoryScope.launch {
            try {
                val userId = getOrRestoreActiveUserId()
                if (userId.isNotBlank() && userId != "guest-scholar-uuid") {
                    syncCloudDataToLocal()
                    syncSocialFeed(limit = 15, offset = 0, clearFirst = false)
                    syncLocalDataToCloud()
                    realtimeSync.connect(userId)
                }
            } catch (e: Exception) {
                android.util.Log.w("StuddyHubRepository", "Startup sync error: ${e.message}")
            }
        }

        // Safety net: full cloud sync when the realtime socket is disconnected (e.g., network
        // drop that the backoff hasn't recovered). Runs every 5 minutes as a fallback only.
        repositoryScope.launch {
            while (true) {
                kotlinx.coroutines.delay(300_000)
                try {
                    val userId = getOrRestoreActiveUserId()
                    if (userId.isNotBlank() && userId != "guest-scholar-uuid" && !realtimeSync.isConnected()) {
                        syncCloudDataToLocal()
                        realtimeSync.connect(userId)
                    }
                } catch (e: Exception) {
                    android.util.Log.w("StuddyHubRepository", "Fallback sync error: ${e.message}")
                }
            }
        }
    }

    /** Persist the current Supabase session tokens locally (used after login and after refresh). */
    suspend fun persistSessionTokens(accessToken: String?, refreshToken: String?, expiresAt: Long) {
        val current = db.profileDao().getProfileDirect() ?: return
        val updated = current.copy(
            accessToken = accessToken?.takeIf { it.isNotBlank() } ?: current.accessToken,
            refreshToken = refreshToken?.takeIf { it.isNotBlank() } ?: current.refreshToken,
            tokenExpiresAt = if (expiresAt > 0L) expiresAt else current.tokenExpiresAt
        )
        db.profileDao().insertOrUpdate(updated)
        if (!accessToken.isNullOrBlank()) {
            com.example.data.remote.BackendApiService.userAccessToken = accessToken
        }
        if (!refreshToken.isNullOrBlank()) {
            com.example.data.remote.BackendApiService.refreshToken = refreshToken
        }
        if (expiresAt > 0L) {
            com.example.data.remote.BackendApiService.tokenExpiresAt = expiresAt
        }
    }

    // Profile & Stats
    val userProfile: Flow<ProfileEntity?> = db.profileDao().getProfile().map { profile ->
        if (profile != null && profile.academicTier.isBlank() && profile.academicLevel.isNotBlank()) {
            // Auto-heal missing tier from existing academicLevel only if academicLevel is present
            val derivedTier = mapAcademicLevelToTier(profile.academicLevel)
            if (derivedTier.isNotBlank()) {
                profile.copy(academicTier = derivedTier)
            } else {
                profile
            }
        } else {
            profile
        }
    }.distinctUntilChanged()

    val academicTier: Flow<com.example.ui.theme.AcademicTier> = userProfile.map { profile ->
        com.example.ui.theme.AcademicTier.fromKey(profile?.academicTier)
    }

    /**
     * Display name of the shared AI tutor for the current academic tier, matching
     * AIChatScreen's branding (Ollie / Master Kwame / Professor Ollie). Used in
     * generation status messages and AI prompts so no tier sees another tier's persona.
     */
    private suspend fun tierTutorName(): String {
        val tier = com.example.ui.theme.AcademicTier.fromKey(db.profileDao().getProfileDirect()?.academicTier)
        return when (tier) {
            com.example.ui.theme.AcademicTier.EXPLORER -> "Ollie"
            com.example.ui.theme.AcademicTier.ACHIEVER -> "Master Kwame"
            com.example.ui.theme.AcademicTier.SCHOLAR -> "Professor Ollie"
            com.example.ui.theme.AcademicTier.ALL -> "Ollie"
        }
    }

    /**
     * Tier-appropriate quiz-generation persona line, used at the top of the direct
     * Gemini quiz prompt so the generated questions match the student's academic level.
     */
    suspend fun tierQuizPersona(): String {
        val tier = com.example.ui.theme.AcademicTier.fromKey(db.profileDao().getProfileDirect()?.academicTier)
        return when (tier) {
            com.example.ui.theme.AcademicTier.EXPLORER ->
                "You are Ollie, a friendly AI tutor for Basic & JHS students in Ghana"
            com.example.ui.theme.AcademicTier.ACHIEVER ->
                "You are Master Kwame, an expert WASSCE exam coach and SHS tutor in Ghana"
            com.example.ui.theme.AcademicTier.SCHOLAR ->
                "You are Professor Ollie, an expert AI tutor at StuddyHub"
            com.example.ui.theme.AcademicTier.ALL ->
                "You are Ollie, a friendly AI tutor for students at StuddyHub"
        }
    }

    fun mapAcademicLevelToTier(academicLevel: String): String {
        val normalized = academicLevel.trim().lowercase()
        if (normalized.isBlank()) return ""
        return when {
            normalized.contains("primary") || normalized.contains("basic") || normalized.contains("jhs") || normalized.contains("junior") -> "explorer"
            normalized.contains("undergraduate") || normalized.contains("graduate") || normalized.contains("phd") ||
                normalized.contains("post-doc") || normalized.contains("self-learner") || normalized.contains("university") ||
                normalized.contains("tertiary") || normalized.contains("college") -> "scholar"
            normalized.contains("high school") || normalized.contains("shs") || normalized.contains("senior") || normalized.contains("wassce") || normalized.contains("secondary") -> "achiever"
            else -> ""
        }
    }

    // The stats flow tracks the ACTIVE user (the DAO default points at the seeded
    // "default_user" row, which is why signed-in users saw 0 streak / 0 quizzes).
    val userStats: Flow<UserStatsEntity?> = userProfile.flatMapLatest {
        val userId = getOrRestoreActiveUserId()
        db.userStatsDao().getUserStats(userId)
    }

    suspend fun getProfileDirect(): ProfileEntity? = db.profileDao().getProfileDirect()

    suspend fun getOrRestoreActiveUserId(): String {
        val current = com.example.data.remote.BackendApiService.currentUserId
        if (!current.isNullOrBlank() && current != "guest-scholar-uuid") {
            return current
        }
        val profile = db.profileDao().getProfileDirect()
        if (profile != null && profile.isLoggedIn) {
            val restoredId = profile.supabaseUserId.ifBlank { profile.id }
            if (restoredId.isNotBlank() && restoredId != "guest-scholar-uuid") {
                com.example.data.remote.BackendApiService.currentUserId = restoredId
                restoreSessionCredentials(profile)
                return restoredId
            }
        }
        return current ?: "guest-scholar-uuid"
    }

    /** Copy persisted session credentials (access token, refresh token, expiry) into BackendApiService. */
    private fun restoreSessionCredentials(profile: ProfileEntity) {
        if (profile.accessToken.isNotBlank()) {
            com.example.data.remote.BackendApiService.userAccessToken = profile.accessToken
        }
        if (profile.refreshToken.isNotBlank()) {
            com.example.data.remote.BackendApiService.refreshToken = profile.refreshToken
        }
        if (profile.tokenExpiresAt > 0L) {
            com.example.data.remote.BackendApiService.tokenExpiresAt = profile.tokenExpiresAt
        }
    }

    suspend fun loginUser(
        email: String,
        fullName: String,
        school: String,
        learningStyle: String = "visual",
        onboardingCompleted: Boolean = false,
        academicTier: String = "",
        academicLevel: String = "",
        supabaseUserId: String? = null,
        accessToken: String? = null,
        refreshToken: String? = null,
        tokenExpiresAt: Long = 0L,
        avatarUrl: String? = null,
        pointsBalance: Int? = null
    ) {
        val current = db.profileDao().getProfileDirect() ?: ProfileEntity()
        val sUserId = (supabaseUserId?.ifBlank { null }
            ?: com.example.data.remote.BackendApiService.currentUserId?.ifBlank { null }
            ?: current.supabaseUserId.ifBlank { null }
            ?: current.id.ifBlank { null }
            ?: java.util.UUID.randomUUID().toString())
        val token = (accessToken?.ifBlank { null }
            ?: com.example.data.remote.BackendApiService.userAccessToken?.ifBlank { null }
            ?: current.accessToken)
        // Pull the tier from the cloud profile when present; otherwise fall back to the
        // locally stored tier, then auto-derive it from academicLevel as a last resort.
        val finalAcademicLevel = if (onboardingCompleted) academicLevel.ifBlank { current.academicLevel } else academicLevel
        val finalTier = if (onboardingCompleted) {
            academicTier.ifBlank { current.academicTier }.ifBlank {
                if (finalAcademicLevel.isNotBlank()) mapAcademicLevelToTier(finalAcademicLevel) else ""
            }
        } else academicTier

        val finalPoints = pointsBalance ?: current.pointsBalance
        val defaultAvatar = com.example.ui.components.AvatarRegistry.defaultAvatarForTier(finalTier).id
        // Normalize avatar: resolve emoji values to canonical IDs
        val normalizedAvatarUrl = if (!avatarUrl.isNullOrBlank()) {
            val resolved = com.example.ui.components.AvatarRegistry.findAvatar(avatarUrl)
            resolved?.id ?: avatarUrl
        } else null
        val finalAvatar = normalizedAvatarUrl ?: current.avatarUrl.takeIf { it.isNotBlank() }?.let {
            val normalized = com.example.ui.components.AvatarRegistry.findAvatar(it)
            normalized?.id ?: it
        } ?: defaultAvatar

        val updated = current.copy(
            id = sUserId,
            email = email.ifBlank { current.email },
            fullName = fullName.ifBlank { current.fullName },
            school = school.ifBlank { current.school },
            learningStyle = learningStyle,
            academicLevel = finalAcademicLevel,
            academicTier = finalTier,
            isLoggedIn = true,
            onboardingCompleted = onboardingCompleted,
            pointsBalance = finalPoints,
            accessToken = token,
            refreshToken = refreshToken?.ifBlank { null } ?: current.refreshToken,
            tokenExpiresAt = if (tokenExpiresAt > 0L) tokenExpiresAt else current.tokenExpiresAt,
            supabaseUserId = sUserId,
            avatarUrl = finalAvatar
        )
        db.profileDao().insertOrUpdate(updated)
        db.profileDao().deleteOtherProfiles(sUserId)
        // Cache tier in SharedPreferences for instant theme loading on next launch only if onboarding is complete
        if (onboardingCompleted && finalTier.isNotBlank()) {
            StuddyHubDatabase.appContext?.getSharedPreferences("studdyhub_session", android.content.Context.MODE_PRIVATE)
                ?.edit()?.putString("academic_tier", finalTier)?.apply()
        } else if (!onboardingCompleted) {
            StuddyHubDatabase.appContext?.getSharedPreferences("studdyhub_session", android.content.Context.MODE_PRIVATE)
                ?.edit()?.remove("academic_tier")?.apply()
        }

        if (sUserId.isNotBlank()) {
            com.example.data.remote.BackendApiService.currentUserId = sUserId
        }
        if (token.isNotBlank()) {
            com.example.data.remote.BackendApiService.userAccessToken = token
        }
        if (!refreshToken.isNullOrBlank()) {
            com.example.data.remote.BackendApiService.refreshToken = refreshToken
        }
        if (tokenExpiresAt > 0L) {
            com.example.data.remote.BackendApiService.tokenExpiresAt = tokenExpiresAt
        }

        repositoryScope.launch {
            try {
                // Push local profile to cloud FIRST — preserves onboarding selections
                // (academic tier, learning style, etc.) that were set locally before the
                // user signed up. Uses the auth-onboarding edge function (single source
                // of truth) with a fallback to direct REST.
                val localProfile = db.profileDao().getProfileDirect()
                if (localProfile != null && sUserId.isNotBlank() && sUserId != "guest-scholar-uuid" && localProfile.onboardingCompleted && localProfile.academicTier.isNotBlank()) {
                    val edgeSync = com.example.data.remote.BackendApiService.syncProfileViaEdge(
                        fullName = localProfile.fullName,
                        school = localProfile.school,
                        academicLevel = localProfile.academicLevel,
                        academicTier = localProfile.academicTier,
                        learningStyle = localProfile.learningStyle,
                        onboardingCompleted = localProfile.onboardingCompleted,
                        avatarUrl = localProfile.avatarUrl.takeIf { it.isNotBlank() }
                    )
                    if (edgeSync is com.example.data.remote.BackendResult.Success) {
                        android.util.Log.d("StuddyHubRepository", "Pushed local profile via edge (tier=${localProfile.academicTier}, onboarded=${localProfile.onboardingCompleted})")
                    } else {
                        // Fallback to direct REST
                        com.example.data.remote.BackendApiService.updateUserProfile(
                            userId = sUserId,
                            email = localProfile.email,
                            fullName = localProfile.fullName,
                            school = localProfile.school,
                            learningStyle = localProfile.learningStyle,
                            academicLevel = localProfile.academicLevel,
                            academicTier = localProfile.academicTier,
                            onboardingCompleted = localProfile.onboardingCompleted,
                            bio = localProfile.bio
                        )
                        android.util.Log.d("StuddyHubRepository", "Pushed local profile via REST fallback (tier=${localProfile.academicTier})")
                    }
                    // Also push lifetime XP to cloud user_stats on login
                    val loginStats = db.userStatsDao().getUserStatsDirect(sUserId)
                    if (loginStats != null) {
                        com.example.data.remote.BackendApiService.syncUserStatsTotalXp(
                            userId = sUserId,
                            totalXp = loginStats.totalXp,
                            currentStreak = loginStats.currentStreak,
                            longestStreak = loginStats.longestStreak,
                            badgesEarned = loginStats.badgesEarned.split(",").filter { it.isNotBlank() }
                        )
                    }
                }

                syncCloudDataToLocal()
                syncSocialFeed(limit = 15, offset = 0, clearFirst = true)
                syncLocalDataToCloud()
                realtimeSync.connect(sUserId)
            } catch (e: CancellationException) { throw e } catch (e: Exception) {
                android.util.Log.e("StuddyHubRepository", "Error during login sync: ${e.message}")
            }
        }
    }

    suspend fun completeOnboarding(
        learningStyle: String = "visual",
        school: String = "",
        major: String = "",
        fullName: String = "",
        academicTier: String = "",
        grade: String = ""
    ): Boolean {
        val current = db.profileDao().getProfileDirect() ?: ProfileEntity()
        val finalSchool = school.ifBlank { current.school }
        val finalFullName = fullName.ifBlank { current.fullName }
        val finalTier = if (academicTier.isNotBlank()) academicTier else current.academicTier
        val defaultAvatar = com.example.ui.components.AvatarRegistry.defaultAvatarForTier(finalTier).id
        val finalAvatar = current.avatarUrl.takeIf { !it.isNullOrBlank() && it != "null" } ?: defaultAvatar

        val sanitizedName = finalFullName.replace(Regex("[^a-zA-Z0-9]"), "").lowercase().take(15)
        val shortId = (current.id.takeIf { it.isNotBlank() } ?: java.util.UUID.randomUUID().toString()).take(4)
        val finalUsername = current.username.takeIf { !it.isNullOrBlank() } ?: "${sanitizedName}_$shortId"

        val finalAcademicLevel = when {
            finalTier == "explorer" -> {
                if (grade.startsWith("JHS", ignoreCase = true)) "Junior High School" else "Primary School"
            }
            finalTier == "scholar" -> "Undergraduate"
            finalTier == "achiever" -> "High School"
            current.academicLevel.isNotBlank() -> current.academicLevel
            else -> "Primary School"
        }

        val updated = current.copy(
            fullName = finalFullName,
            learningStyle = learningStyle,
            school = finalSchool,
            academicTier = finalTier,
            academicLevel = finalAcademicLevel,
            avatarUrl = finalAvatar,
            username = finalUsername,
            onboardingCompleted = true
        )
        db.profileDao().insertOrUpdate(updated)
        if (updated.id.isNotBlank()) {
            db.profileDao().deleteOtherProfiles(updated.id)
        }

        // NOTE: We intentionally do NOT call syncCloudDataToLocal() here because it
        // would pull the OLD cloud profile (onboarding_completed=false) and overwrite
        // the local profile we just saved. The cloud push happens below.
        repositoryScope.launch {
            try {
                syncSocialFeed(limit = 15, offset = 0, clearFirst = true)
            } catch (e: CancellationException) { throw e } catch (e: Exception) {
                android.util.Log.e("StuddyHubRepository", "Error during onboarding sync: ${e.message}")
            }
        }

        return try {
            val personalContext = when {
                major.isBlank() -> null
                finalTier == "explorer" -> "Favorite subject: $major"
                else -> "Major/Field: $major"
            }
            // Prefer the auth-onboarding edge function (single source of truth for all clients)
            val edgeResult = com.example.data.remote.BackendApiService.updateUserProfile(
                userId = updated.id.ifBlank { null },
                email = current.email,
                fullName = finalFullName,
                school = finalSchool,
                learningStyle = learningStyle,
                academicTier = finalTier,
                academicLevel = finalAcademicLevel,
                avatarUrl = finalAvatar,
                onboardingCompleted = true,
                personalContext = personalContext,
                bio = current.bio,
                username = finalUsername
            )
            if (edgeResult is com.example.data.remote.BackendResult.Success) {
                android.util.Log.d("StuddyHubRepository", "Onboarding completed via edge function")
                true
            } else {
                // Fallback to direct REST
                android.util.Log.w("StuddyHubRepository", "Edge function unavailable, falling back to REST: ${edgeResult}")
                val result = com.example.data.remote.BackendApiService.updateUserProfile(
                    userId = updated.id.ifBlank { null },
                    email = current.email,
                    fullName = finalFullName,
                    school = finalSchool,
                    learningStyle = learningStyle,
                    academicTier = finalTier,
                    academicLevel = finalAcademicLevel,
                    avatarUrl = finalAvatar,
                    onboardingCompleted = true,
                    personalContext = personalContext,
                    bio = current.bio
                )
                result is com.example.data.remote.BackendResult.Success
            }
        } catch (e: Exception) {
            android.util.Log.e("StuddyHubRepository", "Failed to sync onboarding profile to Supabase: ${e.message}")
            false
        }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // EDUCATION CONTEXT — aligned with the cloud education schema (countries,
    // education_levels, curricula, examinations, subjects, user_education_profiles,
    // user_subjects) and the web app's implementation. Local Room tables mirror the
    // cloud rows for offline use.
    // ─────────────────────────────────────────────────────────────────────────────

    val educationProfile: Flow<UserEducationProfileEntity?> = db.educationDao().getEducationProfile()
    val educationSubjects: Flow<List<UserSubjectEntity>> = db.educationDao().getAllSubjects()

    /**
     * Persists the resolved education context (kid onboarding "My School Setup").
     * Mirrors the web app: upsert user_education_profiles + replace user_subjects on
     * the cloud; write the same rows locally for offline display.
     */
    suspend fun saveEducationSetup(
        countryId: String?,
        countryCode: String,
        countryName: String,
        educationLevelId: String?,
        levelName: String,
        levelCategory: String,
        curriculumId: String?,
        curriculumName: String,
        targetExaminationId: String?,
        examName: String,
        institutionName: String,
        yearOrGrade: String,
        subjects: List<com.example.data.local.EducationSubjectRef>
    ) {
        val profile = db.profileDao().getProfileDirect()
        val userId = profile?.supabaseUserId?.ifBlank { profile?.id } ?: com.example.data.remote.BackendApiService.currentUserId ?: ""

        // Local mirror first (app works offline)
        val localProfile = UserEducationProfileEntity(
            userId = userId,
            countryId = countryId,
            countryCode = countryCode,
            countryName = countryName,
            educationLevelId = educationLevelId,
            levelName = levelName,
            levelCategory = levelCategory,
            curriculumId = curriculumId,
            curriculumName = curriculumName,
            targetExaminationId = targetExaminationId,
            examName = examName,
            institutionName = institutionName,
            yearOrGrade = yearOrGrade
        )
        db.educationDao().insertEducationProfile(localProfile)
        db.educationDao().clearSubjects(localProfile.id)
        subjects.forEach { subject ->
            db.educationDao().insertSubject(
                UserSubjectEntity(
                    educationProfileId = localProfile.id,
                    subjectId = subject.subjectId ?: "",
                    code = subject.code,
                    name = subject.name,
                    category = subject.category,
                    isPrimary = subject.category == "core"
                )
            )
        }

        // Push to cloud in the background (upsert profile + replace subjects)
        repositoryScope.launch {
            try {
                val res = com.example.data.remote.BackendApiService.saveUserEducationProfile(
                    userId = userId,
                    countryId = countryId,
                    educationLevelId = educationLevelId,
                    curriculumId = curriculumId,
                    targetExaminationId = targetExaminationId,
                    institutionName = institutionName.ifBlank { null },
                    yearOrGrade = yearOrGrade.ifBlank { null }
                )
                if (res is com.example.data.remote.BackendResult.Success) {
                    val cloudProfileId = res.data.optString("id").ifBlank { localProfile.id }
                    com.example.data.remote.BackendApiService.replaceUserSubjects(
                        cloudProfileId,
                        subjects.mapNotNull { it.subjectId }
                    )
                }
            } catch (e: Exception) {
                android.util.Log.e("StuddyHubRepository", "Education setup cloud sync failed: ${e.message}")
            }
        }
    }

    /** Countries for the onboarding picker — cloud-first, offline fallback. */
    suspend fun fetchEducationCountries(): List<com.example.data.local.EducationCountry> {
        return try {
            val res = com.example.data.remote.BackendApiService.fetchActiveCountries()
            if (res is com.example.data.remote.BackendResult.Success && res.data.length() > 0) {
                val list = mutableListOf<com.example.data.local.EducationCountry>()
                for (i in 0 until res.data.length()) {
                    val c = res.data.getJSONObject(i)
                    list.add(
                        com.example.data.local.EducationCountry(
                            id = c.optString("id", "").ifBlank { null },
                            code = c.optString("code", ""),
                            name = c.optString("name", ""),
                            flagEmoji = c.optString("flag_emoji", "")
                        )
                    )
                }
                list.filter { it.code.isNotBlank() && it.name.isNotBlank() }
            } else {
                com.example.data.local.KidsCurriculum.FALLBACK_COUNTRIES
            }
        } catch (e: Exception) {
            com.example.data.local.KidsCurriculum.FALLBACK_COUNTRIES
        }
    }

    /**
     * Education levels (+ curriculum/exam refs + subjects) for a country — cloud-first
     * (get_education_framework RPC: { country, education_levels: [...] }), offline
     * fallback otherwise.
     */
    suspend fun fetchEducationLevels(
        countryCode: String
    ): List<com.example.data.local.EducationLevelRef> {
        if (!countryCode.isNullOrBlank()) {
            try {
                val res = com.example.data.remote.BackendApiService.fetchEducationFramework(countryCode)
                if (res is com.example.data.remote.BackendResult.Success) {
                    val levelsArr = res.data.optJSONArray("education_levels") ?: JSONArray()
                    val list = mutableListOf<com.example.data.local.EducationLevelRef>()
                    for (i in 0 until levelsArr.length()) {
                        val level = levelsArr.getJSONObject(i)
                        val name = level.optString("name", "")
                        if (name.isBlank()) continue
                        val category = level.optString("category", "primary")
                        // Auto-pick the first curriculum + exam (mirrors web auto-select)
                        val curricula = level.optJSONArray("curricula") ?: JSONArray()
                        val curriculumId = if (curricula.length() > 0) curricula.getJSONObject(0).optString("id", "") else ""
                        val curriculumName = if (curricula.length() > 0) curricula.getJSONObject(0).optString("name", "") else ""
                        val exams = if (curricula.length() > 0) curricula.getJSONObject(0).optJSONArray("examinations") else null
                        val examId = if (exams != null && exams.length() > 0) exams.getJSONObject(0).optString("id", "") else ""
                        val examName = if (exams != null && exams.length() > 0) exams.getJSONObject(0).optString("name", "") else ""
                        val subjects = mutableListOf<com.example.data.local.EducationSubjectRef>()
                        if (curricula.length() > 0) {
                            val subs = curricula.getJSONObject(0).optJSONArray("subjects") ?: JSONArray()
                            for (j in 0 until subs.length()) {
                                val s = subs.getJSONObject(j)
                                subjects.add(
                                    com.example.data.local.EducationSubjectRef(
                                        subjectId = s.optString("id", "").ifBlank { null },
                                        code = s.optString("code", ""),
                                        name = s.optString("name", ""),
                                        category = s.optString("category", "core")
                                    )
                                )
                            }
                        }
                        list.add(
                            com.example.data.local.EducationLevelRef(
                                levelId = level.optString("id", "").ifBlank { null },
                                code = level.optString("code", ""),
                                name = name,
                                category = category,
                                grades = com.example.data.local.KidsCurriculum.gradesForCategory(category),
                                subjects = subjects.ifEmpty { com.example.data.local.KidsCurriculum.fallbackCoreSubjects() },
                                curriculumId = curriculumId.ifBlank { null },
                                curriculumName = curriculumName,
                                examinationId = examId.ifBlank { null },
                                examinationName = examName
                            )
                        )
                    }
                    if (list.isNotEmpty()) return list
                }
            } catch (e: Exception) {
                android.util.Log.e("StuddyHubRepository", "Education framework fetch failed: ${e.message}")
            }
        }
        return com.example.data.local.KidsCurriculum.fallbackLevels(countryCode)
    }

    /**
     * Pulls the user's education context from the cloud into the local mirror.
     * Called after login / startup sync so a device picks up what was set elsewhere.
     */
    suspend fun syncEducationContextFromCloud() {
        val profile = db.profileDao().getProfileDirect() ?: return
        val userId = profile.supabaseUserId.ifBlank { profile.id }.ifBlank { return }
        try {
            val res = com.example.data.remote.BackendApiService.fetchUserEducationProfile(userId)
            if (res is com.example.data.remote.BackendResult.Success && res.data.length() > 0) {
                val json = res.data.getJSONObject(0)
                val localProfile = UserEducationProfileEntity(
                    userId = userId,
                    countryId = json.optString("country_id", "").ifBlank { null },
                    countryCode = "",
                    countryName = "",
                    educationLevelId = json.optString("education_level_id", "").ifBlank { null },
                    curriculumId = json.optString("curriculum_id", "").ifBlank { null },
                    targetExaminationId = json.optString("target_examination_id", "").ifBlank { null },
                    institutionName = json.optString("institution_name", ""),
                    yearOrGrade = json.optString("year_or_grade", ""),
                    goalsJson = json.optString("goals", "[]")
                )
                db.educationDao().insertEducationProfile(localProfile)
                // subjects fetched via embedded resources below
                val subsArr = json.optJSONArray("user_subjects") ?: JSONArray()
                db.educationDao().clearSubjects(localProfile.id)
                for (i in 0 until subsArr.length()) {
                    val us = subsArr.getJSONObject(i)
                    val subject = us.optJSONObject("subject") ?: continue
                    db.educationDao().insertSubject(
                        UserSubjectEntity(
                            educationProfileId = localProfile.id,
                            subjectId = subject.optString("id", ""),
                            code = subject.optString("code", ""),
                            name = subject.optString("name", ""),
                            category = subject.optString("category", "core")
                        )
                    )
                }
            }
        } catch (e: Exception) {
            android.util.Log.e("StuddyHubRepository", "Education context sync failed: ${e.message}")
        }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // EXPLORER GAME PROGRESS — stars, unlocked levels, per-game XP
    // ─────────────────────────────────────────────────────────────────────────────

    val gameProgressFlow: (String) -> Flow<GameProgressEntity?> = { gameKey ->
        db.gameProgressDao().getGameProgress(gameKey)
    }

    /**
     * Records a level result: computes stars + best score, unlocks the next level,
     * accumulates per-game XP, pushes to the cloud (game_progress) and updates global
     * stats XP (so kids see the level reward on their profile). Streak + quiz history
     * come from the regular quiz attempt (recordQuizAttempt) that already ran.
     */
    /**
     * Submit game result via server-side RPC — single atomic operation.
     * Handles: stars, XP, level unlock, game_progress, streak — all server-side.
     */
    suspend fun recordGameResult(gameKey: String, levelIndex: Int, score: Int, total: Int) {
        val userId = getOrRestoreActiveUserId()
        if (userId.isBlank() || userId == "guest-scholar-uuid") {
            // Offline fallback: local-only game progress
            recordGameResultLocal(gameKey, levelIndex, score, total)
            return
        }

        val rpcResult = com.example.data.remote.BackendApiService.submitGameResult(
            userId = userId,
            gameKey = gameKey,
            level = levelIndex,
            score = score,
            total = total
        )

        if (rpcResult is com.example.data.remote.BackendResult.Success) {
            val data = rpcResult.data
            // Update local game_progress from server response
            val stars = data.optInt("stars", 0)
            val unlockedLevel = data.optInt("unlocked_level", 1)
            val totalXpEarned = data.optInt("total_xp_earned", 0)
            val existing = db.gameProgressDao().getGameProgressDirect(gameKey)

            val starsMap = mutableMapOf<String, Int>()
            val bestMap = mutableMapOf<String, Int>()
            existing?.starsByLevelJson?.let { safeParseIntMap(it, starsMap) }
            existing?.bestScoresJson?.let { safeParseIntMap(it, bestMap) }
            val percent = if (total > 0) ((score * 100) / total) else 0
            val levelKey = levelIndex.toString()
            starsMap[levelKey] = maxOf(starsMap[levelKey] ?: 0, stars)
            bestMap[levelKey] = maxOf(bestMap[levelKey] ?: 0, percent)

            db.gameProgressDao().insertOrUpdate(GameProgressEntity(
                id = existing?.id ?: UUID.randomUUID().toString(),
                gameKey = gameKey,
                unlockedLevel = unlockedLevel,
                starsByLevelJson = mapToJson(starsMap),
                bestScoresJson = mapToJson(bestMap),
                totalXpEarned = totalXpEarned,
                lastPlayedAt = System.currentTimeMillis()
            ))

            // Update local user_stats from nested stats response
            val statsData = data.optJSONObject("stats")
            if (statsData != null) {
                val currentStats = db.userStatsDao().getUserStatsDirect(userId)
                if (currentStats != null) {
                    db.userStatsDao().insertOrUpdate(currentStats.copy(
                        totalXp = statsData.optInt("total_xp", currentStats.totalXp),
                        level = statsData.optInt("level", currentStats.level),
                        currentStreak = statsData.optInt("current_streak", currentStats.currentStreak),
                        longestStreak = statsData.optInt("longest_streak", currentStats.longestStreak),
                        lastActivityDate = getIsoTimestampUtc()
                    ))
                }
                val profile = db.profileDao().getProfileDirect()
                if (profile != null) {
                    db.profileDao().insertOrUpdate(profile.copy(
                        pointsBalance = statsData.optInt("points_balance", profile.pointsBalance)
                    ))
                }
            }
        } else {
            // Offline fallback
            recordGameResultLocal(gameKey, levelIndex, score, total)
        }
        // Auto-complete the roadmap step tied to this game
        completeRoadmapStepForGame(gameKey)
    }

    /** Local-only game result — offline fallback when RPC fails. */
    private suspend fun recordGameResultLocal(gameKey: String, levelIndex: Int, score: Int, total: Int) {
        val percent = if (total > 0) ((score * 100) / total) else 0
        val stars = com.example.ui.screens.quizzes.starsForPercent(percent)
        val existing = db.gameProgressDao().getGameProgressDirect(gameKey)
        val starsMap = mutableMapOf<String, Int>()
        val bestMap = mutableMapOf<String, Int>()
        existing?.starsByLevelJson?.let { safeParseIntMap(it, starsMap) }
        existing?.bestScoresJson?.let { safeParseIntMap(it, bestMap) }
        val levelKey = levelIndex.toString()
        starsMap[levelKey] = maxOf(starsMap[levelKey] ?: 0, stars)
        bestMap[levelKey] = maxOf(bestMap[levelKey] ?: 0, percent)
        val earnedXp = com.example.ui.screens.quizzes.xpForLevel(levelIndex, percent)
        val nextUnlocked = if (stars > 0) maxOf(existing?.unlockedLevel ?: 1, levelIndex + 1) else existing?.unlockedLevel ?: 1
        db.gameProgressDao().insertOrUpdate(GameProgressEntity(
            id = existing?.id ?: UUID.randomUUID().toString(),
            gameKey = gameKey,
            unlockedLevel = nextUnlocked,
            starsByLevelJson = mapToJson(starsMap),
            bestScoresJson = mapToJson(bestMap),
            totalXpEarned = (existing?.totalXpEarned ?: 0) + earnedXp,
            lastPlayedAt = System.currentTimeMillis()
        ))
        addXpToLocalStats(earnedXp)
    }

    /** Pulls the user's game progress from the cloud into the local mirror. */
    suspend fun syncGameProgressFromCloud() {
        val profile = db.profileDao().getProfileDirect() ?: return
        val userId = profile.supabaseUserId.ifBlank { profile.id }.ifBlank { return }
        try {
            val res = com.example.data.remote.BackendApiService.fetchGameProgress(userId)
            if (res is com.example.data.remote.BackendResult.Success && res.data.length() > 0) {
                for (i in 0 until res.data.length()) {
                    val json = res.data.getJSONObject(i)
                    val gameKey = json.optString("game_key", "").ifBlank { continue }
                    val existing = db.gameProgressDao().getGameProgressDirect(gameKey)
                    db.gameProgressDao().insertOrUpdate(
                        GameProgressEntity(
                            id = existing?.id ?: UUID.randomUUID().toString(),
                            gameKey = gameKey,
                            unlockedLevel = json.optInt("unlocked_level", 1),
                            starsByLevelJson = json.optString("stars_by_level", "{}"),
                            bestScoresJson = json.optString("best_scores", "{}"),
                            totalXpEarned = json.optInt("total_xp_earned", 0)
                        )
                    )
                }
            }
        } catch (e: Exception) {
            android.util.Log.e("StuddyHubRepository", "Game progress cloud pull failed: ${e.message}")
        }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // EXPLORER ROADMAP — the kid's daily learning path (roadmap_steps)
    // ─────────────────────────────────────────────────────────────────────────────

    val roadmapStepsFlow: Flow<List<RoadmapStepEntity>> = db.roadmapDao().getAllSteps()
        .distinctUntilChanged()
        .debounce(50) // Suppress rapid-fire emissions during sync cascades (50ms debounce)

    suspend fun getRoadmapStep(stepId: String): RoadmapStepEntity? = db.roadmapDao().getStepById(stepId)

    /**
     * Last backend error from AI roadmap generation (null = OK / not attempted).
     * ExplorerHomeContent / LearnItLibraryScreen read this so a missing `generate-roadmap`
     * edge function (HTTP 404) or generation failure (HTTP 500) surfaces to the user instead
     * of a silent "Loading Lessons…".
     */
    val roadmapError = MutableStateFlow<String?>(null)

    fun clearRoadmapError() {
        roadmapError.value = null
    }

    /**
     * Builds the kid's learning path from the LIVE AI pipeline. Calls the backend
     * `generate-roadmap` edge function, which personalizes real Ghanaian-curriculum units
     * (lessons / practice quizzes / games) for the student's country, class, grade and
     * enrolled subjects. The static RoadmapTemplates are MUTED: when the backend fails
     * (function missing → HTTP 404, generation error → HTTP 500, or offline), the real
     * error is recorded in [roadmapError] instead of silently seeding hardcoded steps.
     * Returns true when steps were seeded. Idempotent — only runs once per fresh profile.
     */
    suspend fun bootstrapKidRoadmap(): Boolean {
        if (db.roadmapDao().countAll() > 0) return true

        val profile = db.profileDao().getProfileDirect()
        val eduProfile = db.educationDao().getEducationProfileDirect()
        val subjects = eduProfile?.let { db.educationDao().getSubjectsForProfileDirect(it.id) }.orEmpty()
        val subjectNames = subjects.map { it.name.ifBlank { it.code } }.filter { it.isNotBlank() }
            .ifEmpty { listOf("English", "Mathematics", "Science", "Social Studies") }

        val res = com.example.data.remote.BackendApiService.generateRoadmap(
            country = eduProfile?.countryName ?: "",
            educationLevel = eduProfile?.levelName ?: "",
            curriculum = eduProfile?.curriculumName ?: "",
            targetExam = eduProfile?.examName ?: "",
            yearOrGrade = eduProfile?.yearOrGrade ?: "",
            institution = eduProfile?.institutionName ?: profile?.school ?: "",
            subjects = subjectNames,
            weeks = 4,
            week = 1  // Progressive: only generate week 1 on first load
        )

        if (res is com.example.data.remote.BackendResult.Success) {
            val stepsArr = res.data.optJSONArray("steps")
            if (stepsArr != null && stepsArr.length() > 0) {
                val now = System.currentTimeMillis()
                val dayMillis = 24L * 60 * 60 * 1000
                val steps = mutableListOf<RoadmapStepEntity>()
                for (i in 0 until stepsArr.length()) {
                    val json = stepsArr.getJSONObject(i)
                    val week = json.optInt("week", 1)
                    val day = json.optInt("day", 1)
                    val dueDateMillis = parseRoadmapDueDate(json.optString("due_date", ""))
                        ?: (now + ((week - 1) * 7L * dayMillis) + ((day - 1) * dayMillis))
                    steps.add(
                        RoadmapStepEntity(
                            id = json.optString("id", "").ifBlank { "roadmap_${UUID.randomUUID()}" },
                            subjectCode = json.optString("subject_code", "").uppercase(),
                            subjectName = json.optString("subject_name", ""),
                            week = week,
                            day = day,
                            stepIndex = json.optInt("step_index", 0),
                            title = json.optString("title", ""),
                            stepType = json.optString("step_type", "lesson"),
                            refId = json.safeString("ref_id").ifBlank { null },
                            xpReward = json.optInt("xp_reward", 20),
                            dueDateMillis = dueDateMillis
                        )
                    )
                }
                if (steps.isNotEmpty()) {
                    db.roadmapDao().insertSteps(steps)
                    roadmapError.value = null
                    return true
                }
            }
            roadmapError.value = "Backend 'generate-roadmap' returned no roadmap steps."
        } else if (res is com.example.data.remote.BackendResult.Error) {
            val code = res.code
            val raw = "Edge function 'generate-roadmap' " +
                (if (code != null) "returned HTTP $code" else "failed") +
                ": ${res.message}"
            android.util.Log.w("StuddyHubRepository", "[BACKEND-API] $raw — falling back to grade-specific curriculum track")
            roadmapError.value = null
        } else {
            roadmapError.value = null
        }

        // Edge-resilient fallback: seed grade-specific curriculum track immediately
        val subjectRefs = subjects.map {
            com.example.data.local.EducationSubjectRef(
                subjectId = it.subjectId.ifBlank { it.id },
                code = it.code,
                name = it.name,
                category = it.category
            )
        }
        val starterSteps = com.example.data.local.KidsCurriculum.generateGradeSpecificStarterRoadmap(
            levelCategory = eduProfile?.levelCategory ?: "primary",
            grade = eduProfile?.yearOrGrade ?: "Basic 4",
            enrolledSubjects = subjectRefs
        )
        if (starterSteps.isNotEmpty()) {
            db.roadmapDao().insertSteps(starterSteps)
            roadmapError.value = null
            return true
        }
        return false
    }

    /** Clears existing roadmap and regenerates fresh steps according to the user's updated education profile & subjects. */
    suspend fun regenerateKidRoadmap(): Boolean {
        db.roadmapDao().clearAll()
        return bootstrapKidRoadmap()
    }

    /** Parses the backend's ISO date (yyyy-MM-dd) into epoch millis, or null when blank/invalid. */
    private fun parseRoadmapDueDate(value: String): Long? {
        if (value.isBlank()) return null
        return try {
            java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US).apply {
                timeZone = java.util.TimeZone.getTimeZone("UTC")
            }.parse(value)?.time
        } catch (e: Exception) {
            null
        }
    }

    /** Marks a roadmap step complete: XP + streak, then pushes to the cloud. */
    suspend fun completeRoadmapStep(stepId: String) {
        val step = db.roadmapDao().getStepById(stepId) ?: return
        if (step.isCompleted) return
        val completedAt = System.currentTimeMillis()
        db.roadmapDao().markCompleted(stepId, completedAt)
        // XP is handled by awardPoints() which calls the server RPC
        awardPoints(step.xpReward, "roadmap:${stepId}")
        recordStudyActivity()

        repositoryScope.launch {
            try {
                val profile = db.profileDao().getProfileDirect()
                val userId = profile?.supabaseUserId?.ifBlank { profile?.id }
                    ?: com.example.data.remote.BackendApiService.currentUserId ?: return@launch
                com.example.data.remote.BackendApiService.markRoadmapStepCompleted(stepId)

                // Progressive generation: if this was the last step in the week,
                // trigger generation of the next week in the background
                triggerNextWeekIfNeeded(userId)
            } catch (e: Exception) {
                android.util.Log.e("StuddyHubRepository", "Roadmap completion cloud push failed: ${e.message}")
            }
        }
    }

    /**
     * When a game level is completed, mark the corresponding roadmap step (stepType="game",
     * refId = gameKey) as done so the home screen mission advances.
     */
    suspend fun completeRoadmapStepForGame(gameKey: String) {
        try {
            val allSteps = db.roadmapDao().getAllStepsDirect()
            val gameStep = allSteps.firstOrNull {
                it.stepType == "game" && it.refId == gameKey && !it.isCompleted
            } ?: return
            completeRoadmapStep(gameStep.id)
        } catch (e: Exception) {
            android.util.Log.e("StuddyHubRepository", "Auto-complete roadmap step for game failed: ${e.message}")
        }
    }

    /**
     * Progressive roadmap generation: check if the user just completed the last
     * incomplete step in their latest week. If so, trigger generation of the next
     * week in the background so it's ready when they finish the current one.
     */
    private suspend fun triggerNextWeekIfNeeded(userId: String) {
        try {
            val allSteps = db.roadmapDao().getAllStepsDirect()
            if (allSteps.isEmpty()) return

            val maxWeek = allSteps.maxOf { it.week }
            val currentWeekSteps = allSteps.filter { it.week == maxWeek }
            val allCurrentWeekComplete = currentWeekSteps.all { it.isCompleted }

            if (!allCurrentWeekComplete || maxWeek >= 8) return

            // All steps in the current week are done — generate next week
            val profile = db.profileDao().getProfileDirect()
            val eduProfile = db.educationDao().getEducationProfileDirect()
            val subjects = eduProfile?.let { db.educationDao().getSubjectsForProfileDirect(it.id) }.orEmpty()
            val subjectNames = subjects.map { it.name.ifBlank { it.code } }.filter { it.isNotBlank() }
                .ifEmpty { listOf("English", "Mathematics", "Science", "Social Studies") }

            val nextWeek = maxWeek + 1
            android.util.Log.d("StuddyHubRepository", "Week $maxWeek completed — triggering generation of week $nextWeek")

            val res = com.example.data.remote.BackendApiService.generateRoadmap(
                country = eduProfile?.countryName ?: "",
                educationLevel = eduProfile?.levelName ?: "",
                curriculum = eduProfile?.curriculumName ?: "",
                targetExam = eduProfile?.examName ?: "",
                yearOrGrade = eduProfile?.yearOrGrade ?: "",
                institution = eduProfile?.institutionName ?: profile?.school ?: "",
                subjects = subjectNames,
                weeks = 8,
                week = nextWeek
            )

            if (res is com.example.data.remote.BackendResult.Success) {
                val stepsArr = res.data.optJSONArray("steps")
                if (stepsArr != null && stepsArr.length() > 0) {
                    val now = System.currentTimeMillis()
                    val dayMillis = 24L * 60 * 60 * 1000
                    val newSteps = mutableListOf<com.example.data.local.entities.RoadmapStepEntity>()
                    for (i in 0 until stepsArr.length()) {
                        val json = stepsArr.getJSONObject(i)
                        val week = json.optInt("week", nextWeek)
                        val day = json.optInt("day", 1)
                        newSteps.add(
                            com.example.data.local.entities.RoadmapStepEntity(
                                id = json.optString("id", "").ifBlank { "roadmap_${java.util.UUID.randomUUID()}" },
                                subjectCode = json.optString("subject_code", "").uppercase(),
                                subjectName = json.optString("subject_name", ""),
                                week = week,
                                day = day,
                                stepIndex = json.optInt("step_index", 0),
                                title = json.optString("title", ""),
                                stepType = json.optString("step_type", "lesson"),
                                refId = json.safeString("ref_id").ifBlank { null },
                                xpReward = json.optInt("xp_reward", 20),
                                dueDateMillis = now + ((week - 1) * 7L * dayMillis) + ((day - 1) * dayMillis)
                            )
                        )
                    }
                    db.roadmapDao().insertSteps(newSteps)
                    android.util.Log.d("StuddyHubRepository", "Week $nextWeek generated: ${newSteps.size} new steps")
                }
            } else {
                android.util.Log.w("StuddyHubRepository", "Week $nextWeek generation failed — will retry via cron")
            }
        } catch (e: Exception) {
            android.util.Log.w("StuddyHubRepository", "triggerNextWeekIfNeeded error: ${e.message}")
        }
    }

    /** Pulls roadmap steps from the cloud and reconciles into the local mirror. */
    suspend fun syncRoadmapFromCloud() {
        val profile = db.profileDao().getProfileDirect() ?: return
        val userId = profile.supabaseUserId.ifBlank { profile.id }.ifBlank { return }
        try {
            val res = com.example.data.remote.BackendApiService.fetchRoadmapSteps(userId)
            if (res is com.example.data.remote.BackendResult.Success) {
                val existing = db.roadmapDao().getAllStepsDirect().associateBy { it.id }
                val cloudSteps = mutableListOf<RoadmapStepEntity>()
                val cloudIds = mutableSetOf<String>()
                for (i in 0 until res.data.length()) {
                    val json = res.data.getJSONObject(i)
                    val id = json.optString("id", "").ifBlank { continue }
                    cloudIds.add(id)
                    val local = existing[id]
                    val cloudLessonJson = json.optString("lesson_json", "").takeIf { it.isNotBlank() }
                    val isCompleted = if (local != null && local.isCompleted) true else json.optBoolean("is_completed", false)
                    val lessonJson = if (!cloudLessonJson.isNullOrBlank()) cloudLessonJson else local?.lessonJson

                    cloudSteps.add(
                        RoadmapStepEntity(
                            id = id,
                            subjectCode = json.optString("subject_code", ""),
                            subjectName = json.optString("subject_name", ""),
                            week = json.optInt("week", 1),
                            day = json.optInt("day", 1),
                            stepIndex = json.optInt("step_index", 0),
                            title = json.optString("title", ""),
                            stepType = json.optString("step_type", "lesson"),
                            refId = json.safeString("ref_id").ifBlank { null },
                            xpReward = json.optInt("xp_reward", 20),
                            isCompleted = isCompleted,
                            completedAt = local?.completedAt,
                            lessonJson = lessonJson
                        )
                    )
                }

                // Two-way reconciliation: Prune local steps deleted on cloud
                val localSteps = db.roadmapDao().getAllStepsDirect()
                val toDelete = localSteps.filterNot { it.id in cloudIds }
                toDelete.forEach { db.roadmapDao().deleteById(it.id) }

                if (cloudSteps.isNotEmpty()) {
                    db.roadmapDao().insertSteps(cloudSteps)
                } else if (res.data.length() == 0 && localSteps.isNotEmpty()) {
                    // Cloud returned empty array (e.g. cloud database cleared / reset) -> clear local mirror
                    db.roadmapDao().clearAll()
                }
            }
        } catch (e: Exception) {
            android.util.Log.e("StuddyHubRepository", "Roadmap cloud pull failed: ${e.message}")
        }
    }

    /**
     * Saves generated interactive lesson JSON locally to Room and asynchronously syncs to Supabase.
     */
    suspend fun saveRoadmapStepLesson(stepId: String, lessonJson: String) {
        db.roadmapDao().updateLessonJson(stepId, lessonJson)
        repositoryScope.launch {
            try {
                com.example.data.remote.BackendApiService.updateRoadmapStepLessonJson(stepId, lessonJson)
            } catch (e: Exception) {
                android.util.Log.w("StuddyHubRepository", "Could not sync lessonJson to cloud: ${e.message}")
            }
        }
    }

    /** Pushes the local roadmap (upsert) so a fresh device gets the same path. */
    suspend fun syncRoadmapToCloud() {
        val profile = db.profileDao().getProfileDirect() ?: return
        val userId = profile.supabaseUserId.ifBlank { profile.id }.ifBlank { return }
        try {
            val steps = db.roadmapDao().getAllStepsDirect()
            if (steps.isEmpty()) return
            // Batch UPSERT: send all steps in one request instead of one-per-step
            com.example.data.remote.BackendApiService.upsertRoadmapStepsBatch(userId, steps)
        } catch (e: Exception) {
            android.util.Log.e("StuddyHubRepository", "Roadmap cloud push failed: ${e.message}")
        }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // EXPLORER RETENTION — credits store + Daily Quest (points + streak freezes)
    // ─────────────────────────────────────────────────────────────────────────────

    /** All game progress (stars/levels per game) — powers the Daily Quest tracker. */
    val allGameProgressFlow: Flow<List<GameProgressEntity>> = db.gameProgressDao().getAllGameProgress()
        .distinctUntilChanged()

    /** Awards points (credits) to the kid's balance — local + cloud PATCH with anti-tamper caps. */
    /**
     * Award XP via server-side RPC. Server is source of truth for XP, level, and points_balance.
     * Falls back to local-only mode when offline.
     */
    suspend fun awardPoints(points: Int, reason: String = "activity") {
        if (points <= 0) return
        val safePoints = points.coerceIn(1, 500)
        val userId = getOrRestoreActiveUserId()
        if (userId.isBlank() || userId == "guest-scholar-uuid") return

        // Try server RPC first
        val result = com.example.data.remote.BackendApiService.awardXp(userId, safePoints, reason)
        if (result is com.example.data.remote.BackendResult.Success) {
            val data = result.data
            // Update local Room from server response
            val profile = db.profileDao().getProfileDirect()
            if (profile != null) {
                db.profileDao().insertOrUpdate(profile.copy(
                    pointsBalance = data.optInt("points_balance", profile.pointsBalance)
                ))
            }
            val stats = db.userStatsDao().getUserStatsDirect(userId)
            if (stats != null) {
                db.userStatsDao().insertOrUpdate(stats.copy(
                    totalXp = data.optInt("total_xp", stats.totalXp),
                    level = data.optInt("level", stats.level)
                ))
            }
        } else {
            // Offline fallback: update locally only
            android.util.Log.w("StuddyHubRepository", "awardXp RPC failed, using local fallback")
            val profile = db.profileDao().getProfileDirect()
            if (profile != null) {
                db.profileDao().insertOrUpdate(profile.copy(
                    pointsBalance = (profile.pointsBalance + safePoints).coerceAtMost(100_000)
                ))
            }
            addXpToLocalStats(safePoints)
        }
    }

    /**
     * Spend credits via server-side RPC. Atomic balance check + deduction.
     * Returns false when balance can't cover it.
     */
    suspend fun spendPoints(cost: Int, item: String = "item"): Boolean {
        if (cost <= 0) return true
        val userId = getOrRestoreActiveUserId()
        if (userId.isBlank() || userId == "guest-scholar-uuid") return false

        val result = com.example.data.remote.BackendApiService.spendCredits(userId, cost, item)
        if (result is com.example.data.remote.BackendResult.Success) {
            val data = result.data
            val newBalance = data.optInt("balance", 0)
            val profile = db.profileDao().getProfileDirect()
            if (profile != null) {
                db.profileDao().insertOrUpdate(profile.copy(pointsBalance = newBalance))
            }
            return true
        }
        // Offline fallback: check local balance
        val profile = db.profileDao().getProfileDirect() ?: return false
        if (profile.pointsBalance < cost) return false
        db.profileDao().insertOrUpdate(profile.copy(pointsBalance = profile.pointsBalance - cost))
        return true
    }

    /** Sets the emoji avatar bought in the store — local + cloud PATCH. */
    suspend fun setAvatarEmoji(emoji: String) {
        if (emoji.isBlank()) return
        val current = db.profileDao().getProfileDirect() ?: return
        val updated = current.copy(avatarUrl = emoji)
        db.profileDao().insertOrUpdate(updated)

        repositoryScope.launch {
            try {
                val uid = updated.supabaseUserId.ifBlank { updated.id }
                if (!uid.isNullOrBlank() && uid != "guest-scholar-uuid") {
                    com.example.data.remote.BackendApiService.updateUserProfile(
                        userId = uid,
                        avatarUrl = emoji
                    )
                    com.example.data.remote.BackendApiService.syncProfileViaEdge(
                        avatarUrl = emoji
                    )
                    com.example.data.remote.BackendApiService.ensureSocialUserExists(
                        userId = uid,
                        displayName = updated.fullName.ifBlank { "Explorer" },
                        avatarUrl = emoji
                    )
                }
            } catch (e: Exception) {
                android.util.Log.e("StuddyHubRepository", "Avatar cloud push failed: ${e.message}")
            }
        }
    }

    /** Purchase a streak freeze via server-side RPC. Atomic credit deduction + freeze grant. */
    suspend fun addStreakFreeze(cost: Int = 100) {
        val userId = getOrRestoreActiveUserId()
        if (userId.isBlank()) return

        val result = com.example.data.remote.BackendApiService.purchaseStreakFreeze(userId, cost)
        if (result is com.example.data.remote.BackendResult.Success) {
            val data = result.data
            val newFreezes = data.optInt("streak_freezes", 0)
            val newBalance = data.optInt("balance", 0)
            // Update local cache from server response
            val stats = db.userStatsDao().getUserStatsDirect(userId)
            if (stats != null) {
                db.userStatsDao().insertOrUpdate(stats.copy(streakFreezes = newFreezes))
            }
            val profile = db.profileDao().getProfileDirect()
            if (profile != null) {
                db.profileDao().insertOrUpdate(profile.copy(pointsBalance = newBalance))
            }
        } else {
            // Offline fallback
            val stats = db.userStatsDao().getUserStatsDirect(userId) ?: return
            db.userStatsDao().insertOrUpdate(stats.copy(streakFreezes = stats.streakFreezes + 1))
        }
    }

    private fun getTodayDateString(): String {
        val cal = java.util.Calendar.getInstance()
        return String.format(java.util.Locale.US, "%04d-%02d-%02d", cal.get(java.util.Calendar.YEAR), cal.get(java.util.Calendar.MONTH) + 1, cal.get(java.util.Calendar.DAY_OF_MONTH))
    }

    /** True when the Daily Quest reward has already been claimed today. */
    suspend fun isDailyQuestClaimedToday(): Boolean {
        val userId = getOrRestoreActiveUserId()
        val current = db.userStatsDao().getUserStatsDirect(userId) ?: return false
        val today = getTodayDateString()
        return current.lastDailyQuestClaimedDate == today
    }

    private fun getIsoTimestampUtc(millis: Long = System.currentTimeMillis()): String {
        return java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.US).apply {
            timeZone = java.util.TimeZone.getTimeZone("UTC")
        }.format(java.util.Date(millis))
    }

    suspend fun pushUserStatsToCloud(stats: UserStatsEntity) {
        try {
            val uid = stats.userId
            if (uid.isNotBlank() && uid != "guest-scholar-uuid") {
                val badgesList = stats.badgesEarned.split(",").map { it.trim() }.filter { it.isNotBlank() }
                com.example.data.remote.BackendApiService.syncUserStatsFull(
                    userId = uid,
                    totalXp = stats.totalXp,
                    level = stats.level,
                    currentStreak = stats.currentStreak,
                    longestStreak = stats.longestStreak,
                    totalQuizzesAttempted = stats.totalQuizzesAttempted,
                    totalQuizzesCompleted = stats.totalQuizzesCompleted,
                    averageScore = stats.averageScore,
                    totalStudyTimeSeconds = stats.totalStudyTimeSeconds,
                    badgesEarned = badgesList,
                    lastActivityDate = stats.lastActivityDate,
                    streakFreezes = stats.streakFreezes,
                    lastDailyQuestClaimedDate = stats.lastDailyQuestClaimedDate
                )
            }
        } catch (e: Exception) {
            android.util.Log.w("StuddyHubRepository", "pushUserStatsToCloud failed: ${e.message}")
        }
    }

    /**
     * Claims today's Daily Quest reward: awards the points and stamps the claim date
     * so it can only be claimed once per day. Returns the points granted (0 = already claimed).
     */
    /**
     * Claim daily quest reward via server-side RPC.
     * Server validates date, awards XP, and updates stats atomically.
     */
    suspend fun claimDailyQuest(points: Int): Int {
        val userId = getOrRestoreActiveUserId()
        if (userId.isBlank()) return 0

        val result = com.example.data.remote.BackendApiService.claimDailyQuest(userId, points)
        if (result is com.example.data.remote.BackendResult.Success) {
            val data = result.data
            if (data.optBoolean("success", false)) {
                // Update local cache from server response
                val today = getTodayDateString()
                val stats = db.userStatsDao().getUserStatsDirect(userId)
                if (stats != null) {
                    db.userStatsDao().insertOrUpdate(stats.copy(
                        lastDailyQuestClaimedDate = today,
                        lastActivityDate = getIsoTimestampUtc()
                    ))
                }
                // The claim_daily_quest RPC already calls award_xp server-side.
                // Do NOT call awardPoints() here — that would double-award.
                return points
            }
            // already_claimed_today
            return 0
        }
        // Offline fallback: local-only claim
        val current = db.userStatsDao().getUserStatsDirect(userId) ?: return 0
        val today = getTodayDateString()
        if (current.lastDailyQuestClaimedDate == today) return 0
        db.userStatsDao().insertOrUpdate(current.copy(
            lastDailyQuestClaimedDate = today,
            lastActivityDate = getIsoTimestampUtc()
        ))
        awardPoints(points, "daily_quest")
        return points
    }

    /**
     * Claim a badge via server-side RPC. Server checks eligibility + awards 50 XP.
     */
    suspend fun claimFirstQuestBadge() {
        val userId = getOrRestoreActiveUserId()
        if (userId.isBlank()) return

        val result = com.example.data.remote.BackendApiService.claimBadge(userId, "first_quest")
        if (result is com.example.data.remote.BackendResult.Success) {
            val data = result.data
            if (data.optBoolean("success", false)) {
                // Update local cache from server response
                val badgesArr = data.optJSONArray("all_badges")
                val badgesStr = if (badgesArr != null) {
                    (0 until badgesArr.length()).map { badgesArr.getString(it) }.joinToString(",")
                } else "first_quest"
                val stats = db.userStatsDao().getUserStatsDirect(userId)
                if (stats != null) {
                    db.userStatsDao().insertOrUpdate(stats.copy(
                        badgesEarned = badgesStr,
                        hasClaimedFirstQuestBonus = true,
                        currentStreak = maxOf(1, stats.currentStreak),
                        lastActivityDate = getIsoTimestampUtc()
                    ))
                }
                return
            }
            // badge_already_earned — do nothing
            return
        }
        // Offline fallback: local-only badge claim
        val currentStats = db.userStatsDao().getUserStatsDirect(userId)
        val currentBadges = currentStats?.badgesEarned?.split(",")?.map { it.trim() }?.filter { it.isNotBlank() } ?: emptyList()
        if (currentBadges.contains("first_quest") || currentStats?.hasClaimedFirstQuestBonus == true) return
        val updatedBadges = currentBadges.plus("first_quest").distinct().joinToString(",")
        db.userStatsDao().insertOrUpdate((currentStats ?: UserStatsEntity(userId = userId)).copy(
            badgesEarned = updatedBadges,
            hasClaimedFirstQuestBonus = true,
            currentStreak = maxOf(1, currentStats?.currentStreak ?: 1),
            lastActivityDate = getIsoTimestampUtc()
        ))
        awardPoints(50, "badge:first_quest")
    }

    /** Local-only XP update — used as offline fallback when RPC fails. */
    private suspend fun addXpToLocalStats(xp: Int) {
        if (xp <= 0) return
        val userId = getOrRestoreActiveUserId()
        val current = db.userStatsDao().getUserStatsDirect(userId)
        val nowIso = getIsoTimestampUtc()
        if (current != null) {
            val newTotalXp = current.totalXp + xp
            db.userStatsDao().insertOrUpdate(current.copy(
                totalXp = newTotalXp,
                level = (newTotalXp / 500) + 1,
                lastActivityDate = nowIso
            ))
        } else {
            db.userStatsDao().insertOrUpdate(UserStatsEntity(
                userId = userId,
                totalXp = xp,
                level = (xp / 500) + 1,
                currentStreak = 1,
                longestStreak = 1,
                lastStudyDayMillis = System.currentTimeMillis(),
                lastActivityDate = nowIso
            ))
        }
    }

    private fun safeParseIntMap(json: String, target: MutableMap<String, Int>) {
        try {
            val obj = JSONObject(json)
            val keys = obj.keys()
            while (keys.hasNext()) {
                val k = keys.next()
                target[k] = obj.optInt(k, 0)
            }
        } catch (e: Exception) { /* ignore malformed */ }
    }

    private fun mapToJson(map: Map<String, Int>): String {
        val obj = JSONObject()
        map.forEach { (k, v) -> obj.put(k, v) }
        return obj.toString()
    }

    suspend fun logoutUser() {
        realtimeSync.disconnect()
        com.example.data.remote.BackendApiService.userAccessToken = null
        com.example.data.remote.BackendApiService.refreshToken = null
        com.example.data.remote.BackendApiService.tokenExpiresAt = 0L
        com.example.data.remote.BackendApiService.currentUserId = null
        isSystemOffline.value = false

        // Clear ALL SharedPreferences files — not just the session one
        val ctx = StuddyHubDatabase.appContext ?: return
        val allSpNames = listOf(
            "studdyhub_session",
            "studdyhub_task_guide_prefs",
            "learnit_progress"
        )
        allSpNames.forEach { name ->
            ctx.getSharedPreferences(name, android.content.Context.MODE_PRIVATE)
                ?.edit()?.clear()?.apply()
        }
        // Also clear TTS settings and Avatar inventory prefs
        try {
            com.example.data.local.TtsSettings.prefs()?.edit()?.clear()?.apply()
        } catch (_: Exception) {}
        try {
            ctx.getSharedPreferences("studdyhub_avatar_inventory_prefs", android.content.Context.MODE_PRIVATE)
                .edit().clear().apply()
        } catch (_: Exception) {}
        // Clear search recent searches
        try {
            ctx.getSharedPreferences("studdyhub_search", android.content.Context.MODE_PRIVATE)
                .edit().clear().apply()
        } catch (_: Exception) {}

        kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
            db.clearAllTables()
        }
    }

    /** Clears all local data (keeps the session) and rebuilds from cloud. */
    suspend fun resetLocalDataAndResync() {
        kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
            db.clearAllTables()
        }
        syncCloudDataToLocal()
    }

    /** Permanently erases user data on cloud, wipes device, signs out. Returns true on success. */
    suspend fun eraseAllUserData(): Boolean {
        return try {
            com.example.data.remote.BackendApiService.deleteUserData()
            logoutUser()
            true
        } catch (e: Exception) {
            android.util.Log.e("StuddyHubRepo", "Erase all data failed: ${e.message}")
            false
        }
    }

    suspend fun updateProfile(
        fullName: String? = null,
        school: String? = null,
        academicLevel: String? = null,
        academicTier: String? = null,
        learningStyle: String? = null,
        bio: String? = null,
        avatarUrl: String? = null
    ) {
        val current = db.profileDao().getProfileDirect() ?: ProfileEntity()
        val derivedTier = academicTier?.takeIf { it.isNotBlank() }
            ?: if (academicLevel != null && academicLevel.isNotBlank()) mapAcademicLevelToTier(academicLevel) else current.academicTier

        val updated = current.copy(
            fullName = fullName?.takeIf { it.isNotBlank() } ?: current.fullName,
            school = school?.takeIf { it.isNotBlank() } ?: current.school,
            academicLevel = academicLevel?.takeIf { it.isNotBlank() } ?: current.academicLevel,
            academicTier = derivedTier,
            learningStyle = learningStyle?.takeIf { it.isNotBlank() } ?: current.learningStyle,
            bio = bio?.takeIf { it.isNotBlank() } ?: current.bio,
            avatarUrl = avatarUrl?.takeIf { it.isNotBlank() } ?: current.avatarUrl
        )
        db.profileDao().insertOrUpdate(updated)

        // Also sync to cloud in the background
        repositoryScope.launch {
            try {
                val result = com.example.data.remote.BackendApiService.updateUserProfile(
                    email = current.email,
                    fullName = updated.fullName,
                    school = updated.school,
                    learningStyle = updated.learningStyle,
                    academicLevel = updated.academicLevel,
                    academicTier = updated.academicTier,
                    onboardingCompleted = updated.onboardingCompleted,
                    bio = updated.bio
                )
                if (result is com.example.data.remote.BackendResult.Success) {
                    android.util.Log.d("StuddyHubRepository", "Profile synced to cloud")
                }
            } catch (e: Exception) {
                android.util.Log.e("StuddyHubRepository", "Failed to sync profile to cloud: ${e.message}")
            }
        }
    }

    suspend fun updateAcademicTier(tierKey: String) {
        val current = db.profileDao().getProfileDirect() ?: ProfileEntity()
        val normalized = com.example.ui.theme.AcademicTier.fromKey(tierKey).key
        val updated = current.copy(academicTier = normalized)
        db.profileDao().insertOrUpdate(updated)
        // Cache tier in SharedPreferences so the app theme loads instantly on next launch
        StuddyHubDatabase.appContext?.getSharedPreferences("studdyhub_session", android.content.Context.MODE_PRIVATE)
            ?.edit()?.putString("academic_tier", normalized)?.apply()

        repositoryScope.launch {
            try {
                com.example.data.remote.BackendApiService.updateUserProfile(
                    email = current.email,
                    fullName = updated.fullName,
                    school = updated.school,
                    learningStyle = updated.learningStyle,
                    academicLevel = updated.academicLevel,
                    academicTier = normalized,
                    onboardingCompleted = updated.onboardingCompleted,
                    bio = updated.bio
                )
                android.util.Log.d("StuddyHubRepository", "AcademicTier ($normalized) updated and synced to cloud")
            } catch (e: Exception) {
                android.util.Log.e("StuddyHubRepository", "Failed to sync academicTier to cloud: ${e.message}")
            }
        }
    }

    suspend fun resetOnboarding() {
        val current = db.profileDao().getProfileDirect() ?: ProfileEntity()
        val updated = current.copy(onboardingCompleted = false, isLoggedIn = false)
        db.profileDao().insertOrUpdate(updated)
    }

    // Notes
    val allNotes: Flow<List<NoteEntity>> = db.noteDao().getAllNotes()

    // Sync Queue Counts
    val pendingSyncCount: Flow<Int> = db.syncQueueDao().getPendingCountFlow()
    val failedSyncCount: Flow<Int> = db.syncQueueDao().getFailedCountFlow()
    val syncQueueItems: Flow<List<SyncQueueItemEntity>> = db.syncQueueDao().getAllItemsFlow()

    suspend fun getNoteById(id: String): NoteEntity? = db.noteDao().getNoteById(id)?.let { sanitizeNoteTags(it) }

    suspend fun getDocumentById(id: String): DocumentEntity? = db.documentDao().getDocumentById(id)

    suspend fun saveNote(
        title: String,
        content: String,
        category: String,
        tags: String,
        aiSummary: String = "",
        documentId: String? = null
    ): NoteEntity {
        val summary = if (aiSummary.isNotBlank()) aiSummary else {
            val summaryPrompt = "Summarize the following study note concisely in 2-3 sentences:\n\nTitle: $title\nContent: $content"
            val summaryResult = com.example.data.remote.BackendApiService.generateSummary(title, content)
            when (summaryResult) {
                is com.example.data.remote.BackendResult.Success -> summaryResult.data
                is com.example.data.remote.BackendResult.Error -> ""
            }
        }
        val note = NoteEntity(
            title = title.ifBlank { "Untitled Note" },
            content = content,
            category = category.ifBlank { "General" },
            tags = tags,
            aiSummary = summary,
            documentId = documentId,
            isSynced = false,
            syncStatus = "PENDING"
        )
        db.noteDao().insertNote(note)
        
        // Push to offline sync queue
        db.syncQueueDao().insertOrUpdate(
            SyncQueueItemEntity(
                entityType = "note",
                entityId = note.id,
                operationType = "CREATE"
            )
        )
        
        // Trigger SyncManager
        StuddyHubDatabase.appContext?.let { ctx ->
            com.example.data.local.SyncManager.getInstance(ctx, db).triggerSync()
        }

        recordStudyActivity()
        return note
    }

    private fun parseJsonDateMillis(obj: JSONObject, key: String, fallback: Long): Long {
        if (!obj.has(key) || obj.isNull(key)) return fallback
        return try {
            val raw = obj.opt(key)
            when (raw) {
                is Number -> raw.toLong()
                is String -> raw.toLongOrNull() ?: parseTimestampToMillisOrNull(raw) ?: fallback
                else -> fallback
            }
        } catch (_: Exception) { fallback }
    }

    suspend fun updateNote(note: NoteEntity, customSummary: String? = null): NoteEntity {
        val summary = customSummary ?: note.aiSummary
        val updated = note.copy(
            aiSummary = summary,
            updatedAt = System.currentTimeMillis(),
            isSynced = false,
            syncStatus = "PENDING"
        )
        db.noteDao().insertNote(updated)
        
        // Push to offline sync queue
        db.syncQueueDao().insertOrUpdate(
            SyncQueueItemEntity(
                entityType = "note",
                entityId = updated.id,
                operationType = "UPDATE"
            )
        )
        
        // Trigger SyncManager
        StuddyHubDatabase.appContext?.let { ctx ->
            com.example.data.local.SyncManager.getInstance(ctx, db).triggerSync()
        }
        
        return updated
    }

    suspend fun togglePinNote(id: String) {
        val note = db.noteDao().getNoteById(id) ?: return
        db.noteDao().insertNote(note.copy(isPinned = !note.isPinned))
    }

    suspend fun toggleFavoriteNote(id: String) {
        val note = db.noteDao().getNoteById(id) ?: return
        db.noteDao().insertNote(note.copy(isFavorite = !note.isFavorite))
    }

    suspend fun translateNote(noteId: String, targetLanguage: String): NoteEntity? {
        val note = db.noteDao().getNoteById(noteId) ?: return null
        isAIGenerating.value = true
        generationMessage.value = "Translating note into $targetLanguage..."
        try {
            val fullText = "Title: ${note.title}\n\nContent:\n${note.content}"
            val translated = when (val r = BackendApiService.translateText(fullText, targetLanguage)) {
                is BackendResult.Success -> r.data
                else -> fullText
            }
            val updated = note.copy(
                translatedText = translated,
                translatedLanguage = targetLanguage
            )
            db.noteDao().insertNote(updated)
            return updated
        } finally {
            isAIGenerating.value = false
            generationMessage.value = ""
        }
    }

    suspend fun generateAICopilotContent(action: String, currentContent: String, instruction: String = ""): String {
        isAIGenerating.value = true
        generationMessage.value = "${tierTutorName()} is writing $action..."
        try {
            val operation = when (action) {
                "simplify" -> "simplify"
                "questions" -> "questions"
                "fix" -> "fix"
                "custom" -> "custom"
                else -> "custom"
            }
            val customPrompt = when (action) {
                "continue" -> "Continue writing the following study note logically and add 2 detailed paragraphs with examples."
                "expand" -> "Expand and add depth, key terminology, and real-world examples to this note content."
                else -> null
            }
            val result = BackendApiService.transformNote(currentContent, operation, customPrompt)
            return if (result is BackendResult.Success) result.data else currentContent
        } finally {
            isAIGenerating.value = false
            generationMessage.value = ""
        }
    }

    suspend fun generateDiagramFromNote(noteContent: String): String {
        return generateCustomDiagram(
            customPrompt = "Synthesize a visual flowchart diagram of the core concepts in this note.",
            diagramType = "mermaid_flowchart",
            noteContent = noteContent
        )
    }

    suspend fun generateCustomDiagram(
        customPrompt: String,
        diagramType: String,
        noteContent: String
    ): String {
        isAIGenerating.value = true
        generationMessage.value = "${tierTutorName()} is synthesizing your visual $diagramType diagram..."
        try {
            val systemInstruction = when (diagramType) {
                "mermaid_sequence" -> "Create a clear Mermaid sequence diagram. Output ONLY raw ```mermaid sequenceDiagram ... ```."
                "mermaid_mindmap" -> "Create a clear Mermaid mindmap diagram. Output ONLY raw ```mermaid mindmap ... ```."
                "chartjs_bar" -> "Create a Chart.js Bar Chart configuration. Return JSON with keys: title, labels (array of strings), datasetLabel (string), data (array of numbers), backgroundColor (string or array of color hex codes)."
                "chartjs_pie" -> "Create a Chart.js Pie Chart configuration. Return JSON with keys: title, labels (array of strings), datasetLabel (string), data (array of numbers), backgroundColor (array of color hex codes)."
                "dot_graph" -> "Create a Graphviz DOT digraph. Output ONLY raw ```dot digraph G { ... } ```."
                else -> "Create a clear Mermaid flowchart diagram. Output ONLY raw ```mermaid graph TD ... ```."
            }

            val contentForDiagram = "$customPrompt\n\n$noteContent"
            val diagramTypeMapped = when (diagramType) {
                "chartjs_bar" -> "chartjs_bar"
                "chartjs_pie" -> "chartjs_pie"
                "dot_graph" -> "dot_graph"
                else -> "mermaid"
            }
            val aiResponse = when (val r = BackendApiService.generateDiagram(contentForDiagram, diagramTypeMapped)) {
                is BackendResult.Success -> r.data
                else -> ""
            }

            if (diagramType.startsWith("chartjs_")) {
                try {
                    val cleanJson = cleanJsonResponse(aiResponse)
                    val jsonObj = JSONObject(cleanJson)
                    val title = jsonObj.optString("title", "Study Analytics")
                    val labelsArr = jsonObj.optJSONArray("labels") ?: JSONArray()
                    val labels = mutableListOf<String>()
                    for (i in 0 until labelsArr.length()) labels.add(labelsArr.getString(i))
                    
                    val dataArr = jsonObj.optJSONArray("data") ?: JSONArray()
                    val data = mutableListOf<Number>()
                    for (i in 0 until dataArr.length()) data.add(dataArr.getDouble(i))
                    
                    val chartType = if (diagramType == "chartjs_pie") "pie" else "bar"
                    val chartConfigJson = JSONObject().apply {
                        put("type", chartType)
                        put("data", JSONObject().apply {
                            put("labels", JSONArray(labels))
                            put("datasets", JSONArray().apply {
                                put(JSONObject().apply {
                                    put("label", jsonObj.optString("datasetLabel", "Data"))
                                    put("data", JSONArray(data))
                                    put("backgroundColor", JSONArray(listOf("#6366f1", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6", "#3b82f6")))
                                })
                            })
                        })
                        put("options", JSONObject().apply {
                            put("responsive", true)
                            put("plugins", JSONObject().apply {
                                put("title", JSONObject().apply {
                                    put("display", true)
                                    put("text", title)
                                })
                            })
                        })
                    }.toString().replace("\"", "&quot;")

                    return """
                        <div class="diagram-box">
                          <div class="diagram-header">📊 $title</div>
                          <div class="chartjs-container">
                            <canvas class="chartjs-canvas" data-config="$chartConfigJson"></canvas>
                          </div>
                        </div>
                    """.trimIndent()
                } catch (e: Exception) {
                    // JSON parsing failed — fall back to a fenced chartjs block so the
                    // editor's MarkdownConverter can still wrap it in a renderable
                    // chartjs container instead of dumping raw AI text into the note.
                    return "```chartjs\n" + aiResponse.trim().removePrefix("```chartjs").trim() + "\n```"
                }
            }

            return aiResponse
        } finally {
            isAIGenerating.value = false
            generationMessage.value = ""
        }
    }

    suspend fun summarizeNote(content: String): String {
        isAIGenerating.value = true
        generationMessage.value = "${tierTutorName()} is generating key highlights..."
        try {
            val result = BackendApiService.generateSummary("Note", content)
            return if (result is BackendResult.Success) result.data else ""
        } finally {
            isAIGenerating.value = false
            generationMessage.value = ""
        }
    }

    suspend fun saveNoteFromTemplate(templateType: String, topicTitle: String): NoteEntity {
        val title = if (topicTitle.isNotBlank()) "$topicTitle ($templateType)" else "Untitled $templateType"
        val content = when (templateType.lowercase()) {
            "cornell" -> """
                # Cornell Notes: $topicTitle
                
                ## Cues / Keywords
                * What are the core concepts?
                * What key formulas or terms apply?
                * Exam potential level: High
                
                ## Notes & Key Details
                1. **Main Idea 1:** Write detailed lecture notes here.
                2. **Main Idea 2:** Include diagrams or steps.
                3. **Formula / Rule:** ${'$'}${'$'}E = mc^2${'$'}${'$'}
                
                ## Summary
                > [!NOTE]
                > Write a 2-3 sentence overall summary of the lecture here.
            """.trimIndent()
            
            "lecture" -> """
                # Lecture Summary: $topicTitle
                
                ## 📌 Overview
                Brief introduction to today's topic.
                
                ## 🔑 Key Takeaways
                * Takeaway 1: Core mechanism
                * Takeaway 2: Important definition
                * Takeaway 3: Practical application
                
                ## ⚡ Action Items & Follow-up
                - [ ] Review textbook chapter
                - [ ] Practice sample problems
                - [ ] Quiz myself with flashcards
            """.trimIndent()

            "lab" -> """
                # Lab Report: $topicTitle
                
                ## 🧪 Objective
                State the hypothesis and experimental goal.
                
                ## 🔬 Equipment & Procedure
                1. Set up equipment and record initial conditions.
                2. Perform test trials and log observations.
                
                ## 📊 Results & Observations
                * Trial 1: Data observed
                * Trial 2: Control baseline
                
                ## 🎯 Conclusion
                Summary of key findings and experimental error analysis.
            """.trimIndent()

            "flashcard_prep" -> """
                # Flashcard Prep: $topicTitle
                
                ## Terminology List
                * **Concept A**: Concise definition or explanation.
                * **Concept B**: Concise definition or explanation.
                * **Concept C**: Concise definition or explanation.
                
                *Tip: Tap 'Make Cards' at the bottom to convert this list directly into interactive flashcards!*
            """.trimIndent()

            else -> "# Note: $topicTitle\n\nStart writing your study note here..."
        }
        return saveNote(title, content, "Lecture Notes", "template,study")
    }

    suspend fun deleteNote(id: String) {
        db.noteDao().deleteNote(id)
        
        // Push DELETE operation to sync queue
        db.syncQueueDao().insertOrUpdate(
            SyncQueueItemEntity(
                entityType = "note",
                entityId = id,
                operationType = "DELETE"
            )
        )
        
        // Trigger SyncManager
        StuddyHubDatabase.appContext?.let { ctx ->
            com.example.data.local.SyncManager.getInstance(ctx, db).triggerSync()
        }
    }

    // Class Recordings
    val allRecordings: Flow<List<ClassRecordingEntity>> = db.classRecordingDao().getAllRecordings()

    suspend fun addRecording(title: String, subject: String, transcript: String): ClassRecordingEntity {
        // Use dedicated generate-summary edge function instead of gemini-chat
        val summaryResult = com.example.data.remote.BackendApiService.generateSummary(subject, transcript)
            val aiSummary = when (summaryResult) {
                is com.example.data.remote.BackendResult.Success -> summaryResult.data
                is com.example.data.remote.BackendResult.Error -> ""
            }
        val recording = ClassRecordingEntity(
            title = title,
            subject = subject,
            transcript = transcript,
            summary = aiSummary,
            syncStatus = "PENDING"
        )
        db.classRecordingDao().insertRecording(recording)
        
        // Push to offline sync queue
        db.syncQueueDao().insertOrUpdate(
            SyncQueueItemEntity(
                entityType = "recording",
                entityId = recording.id,
                operationType = "CREATE"
            )
        )
        
        // Trigger SyncManager
        StuddyHubDatabase.appContext?.let { ctx ->
            com.example.data.local.SyncManager.getInstance(ctx, db).triggerSync()
        }

        recordStudyActivity()
        return recording
    }

    suspend fun deleteRecording(id: String) {
        db.classRecordingDao().deleteRecording(id)
        
        // Push DELETE operation to sync queue
        db.syncQueueDao().insertOrUpdate(
            SyncQueueItemEntity(
                entityType = "recording",
                entityId = id,
                operationType = "DELETE"
            )
        )
        
        // Trigger SyncManager
        StuddyHubDatabase.appContext?.let { ctx ->
            com.example.data.local.SyncManager.getInstance(ctx, db).triggerSync()
        }
    }

    /**
     * Web-parity recording path: takes a real audio file (mic capture or imported MP3/WAV/M4A),
     * uploads it to the public 'documents' storage bucket (same bucket the web uses for
     * recordings), then asks gemini-audio-processor to transcribe + summarize it. The local row
     * is inserted immediately with processingStatus="processing" so the UI shows progress, and
     * the finished row (transcript/summary/audioUrl) is pushed to the offline sync queue so it
     * reaches the cloud class_recordings table like any other local change.
     */
    suspend fun addRecordingWithAudio(
        title: String,
        subject: String,
        audioFile: java.io.File,
        mimeType: String = "audio/webm",
        durationSeconds: Int = 0
    ): ClassRecordingEntity = kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
        val recording = ClassRecordingEntity(
            title = title.ifBlank { "Untitled Recording" },
            subject = subject.ifBlank { "General" },
            durationSeconds = durationSeconds,
            audioUrl = "",
            transcript = "",
            summary = "",
            processingStatus = "processing",
            localFilePath = audioFile.absolutePath,
            syncStatus = "PENDING"
        )
        db.classRecordingDao().insertRecording(recording)

        var audioUrl = ""
        var transcript = ""
        var summary = ""
        var duration = durationSeconds
        try {
            // 1. Upload audio to storage (public URL, matching the web's path layout).
            val userId = getOrRestoreActiveUserId()
            val safeTitle = title.replace(Regex("[^A-Za-z0-9]+"), "_").take(40).ifBlank { "recording" }
            val ext = mimeType.substringAfter("/", "webm").ifBlank { "webm" }.lowercase()
            val path = "$userId/recordings/${recording.id}-$safeTitle.$ext"
            val uploadRes = com.example.data.remote.BackendApiService.uploadFileToStorage(
                bucket = "documents",
                path = path,
                fileBytes = audioFile.readBytes(),
                mimeType = mimeType
            )
            if (uploadRes is com.example.data.remote.BackendResult.Success) {
                audioUrl = uploadRes.data
            }

            // 2. AI transcription + summary via gemini-audio-processor (same contract as the web).
            val (t, s, d) = processAudioWithAI(audioUrl)
            transcript = t
            summary = s
            if (d > 0) duration = d
        } catch (e: Exception) {
            android.util.Log.e("StuddyHubRepository", "Audio recording processing failed for ${recording.id}: ${e.message}")
        }

        val final = recording.copy(
            audioUrl = audioUrl,
            transcript = transcript,
            summary = summary,
            durationSeconds = duration,
            processingStatus = if (transcript.isNotBlank()) "completed" else "failed",
            syncStatus = "PENDING"
        )
        db.classRecordingDao().insertRecording(final)

        // Push to offline sync queue (cloud row is created with the finished transcript/summary).
        db.syncQueueDao().insertOrUpdate(
            SyncQueueItemEntity(
                entityType = "recording",
                entityId = final.id,
                operationType = "CREATE"
            )
        )

        // Trigger SyncManager
        StuddyHubDatabase.appContext?.let { ctx ->
            com.example.data.local.SyncManager.getInstance(ctx, db).triggerSync()
        }

        recordStudyActivity()
        final
    }

    /**
     * Retries AI processing for a recording whose earlier attempt failed. Re-uploads from the
     * local file when the cloud upload never succeeded, otherwise re-runs transcription against
     * the existing audio URL.
     */
    suspend fun reprocessRecording(id: String) = kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
        val recording = db.classRecordingDao().getRecordingById(id) ?: return@withContext
        db.classRecordingDao().insertRecording(recording.copy(processingStatus = "processing"))

        var audioUrl = recording.audioUrl
        var transcript = ""
        var summary = ""
        var duration = recording.durationSeconds
        try {
            if (audioUrl.isBlank() && !recording.localFilePath.isNullOrBlank()) {
                val localFile = java.io.File(recording.localFilePath!!)
                if (localFile.exists()) {
                    val userId = getOrRestoreActiveUserId()
                    val safeTitle = recording.title.replace(Regex("[^A-Za-z0-9]+"), "_").take(40).ifBlank { "recording" }
                    val ext = recording.localFilePath!!.substringAfterLast('.', "webm").ifBlank { "webm" }.lowercase()
                    // Unknown extensions fall back to octet-stream rather than an invented audio type.
                    val mime = if (ext in setOf("m4a", "mp3", "wav", "ogg", "webm", "mp4")) "audio/$ext" else "application/octet-stream"
                    val uploadRes = com.example.data.remote.BackendApiService.uploadFileToStorage(
                        bucket = "documents",
                        path = "$userId/recordings/${recording.id}-$safeTitle.$ext",
                        fileBytes = localFile.readBytes(),
                        mimeType = mime
                    )
                    if (uploadRes is com.example.data.remote.BackendResult.Success) audioUrl = uploadRes.data
                }
            }
            val (t, s, d) = processAudioWithAI(audioUrl)
            transcript = t
            summary = s
            if (d > 0) duration = d
        } catch (e: Exception) {
            android.util.Log.e("StuddyHubRepository", "Reprocessing failed for ${recording.id}: ${e.message}")
        }

        val final = recording.copy(
            audioUrl = audioUrl,
            transcript = transcript,
            summary = summary,
            durationSeconds = duration,
            processingStatus = if (transcript.isNotBlank()) "completed" else "failed"
        )
        db.classRecordingDao().insertRecording(final)

        db.syncQueueDao().insertOrUpdate(
            SyncQueueItemEntity(
                entityType = "recording",
                entityId = final.id,
                operationType = "UPDATE"
            )
        )
        StuddyHubDatabase.appContext?.let { ctx ->
            com.example.data.local.SyncManager.getInstance(ctx, db).triggerSync()
        }
    }

    /**
     * Two-phase gemini-audio-processor call, mirroring the web's useAudioProcessing:
     * transcribe first, then summarize the transcript. Falls back to the direct Gemini text
     * chain for the summary if the summarize phase fails (transcription is the audio part
     * that the client cannot do itself).
     */
    private suspend fun processAudioWithAI(audioUrl: String): Triple<String, String, Int> {
        if (audioUrl.isBlank()) return Triple("", "", 0)

        var transcript = ""
        var duration = 0
        try {
            val tRes = com.example.data.remote.BackendApiService.transcribeAudioViaBackend(audioUrl)
            when (tRes) {
                is com.example.data.remote.BackendResult.Success -> {
                    transcript = tRes.data.optString("transcript", "").trim()
                    duration = tRes.data.optInt("duration", 0)
                }
                is com.example.data.remote.BackendResult.Error ->
                    android.util.Log.w("StuddyHubRepository", "Transcription failed: ${tRes.message}")
            }
        } catch (e: Exception) {
            android.util.Log.e("StuddyHubRepository", "Transcription threw: ${e.message}")
        }

        var summary = ""
        if (transcript.isNotBlank()) {
            try {
                val sRes = com.example.data.remote.BackendApiService.summarizeTranscriptViaBackend(transcript)
                when (sRes) {
                    is com.example.data.remote.BackendResult.Success ->
                        summary = sRes.data.optString("summary", "").trim()
                    is com.example.data.remote.BackendResult.Error ->
                        android.util.Log.w("StuddyHubRepository", "Backend summary failed: ${sRes.message}")
                }
            } catch (e: Exception) {
                android.util.Log.e("StuddyHubRepository", "Backend summary threw: ${e.message}")
            }
            if (summary.isBlank()) {
                try {
                    summary = when (val r = BackendApiService.generateSummary("Lecture Transcript", transcript)) {
                        is BackendResult.Success -> r.data
                        else -> ""
                    }
                } catch (e: Exception) {
                    android.util.Log.e("StuddyHubRepository", "Local summary fallback failed: ${e.message}")
                }
            }
        }

        return Triple(transcript, summary, duration)
    }

    /**
     * Generates a practice quiz from a recording's transcript using the same backend edge
     * function the web uses (generate-quiz), with the client Gemini chain as fallback. The
     * created quiz lands in the library grid with sourceType "recording".
     */
    suspend fun generateQuizForRecording(recordingId: String, questionCount: Int = 5): QuizEntity? {
        val recording = db.classRecordingDao().getRecordingById(recordingId) ?: return null
        if (recording.transcript.isBlank()) return null
        return generateCustomQuiz(
            title = recording.title,
            sourceContent = recording.transcript,
            sourceType = "recording",
            questionCount = questionCount.coerceIn(3, 10),
            difficulty = "Medium",
            questionType = "Multiple Choice"
        )
    }

    // Quizzes & Attempts
    val allQuizzes: Flow<List<QuizEntity>> = db.quizDao().getAllQuizzes()
    val allAttempts: Flow<List<QuizAttemptEntity>> = db.quizDao().getAllAttempts()

    suspend fun generateQuizFromTopic(title: String, topicContent: String): QuizEntity {
        return generateCustomQuiz(
            title = title,
            sourceContent = topicContent,
            sourceType = "ai",
            questionCount = 5,
            difficulty = "Medium",
            questionType = "Multiple Choice"
        )
    }

    suspend fun generateCustomQuiz(
        title: String,
        sourceContent: String,
        sourceType: String = "ai",
        questionCount: Int = 5,
        difficulty: String = "Medium",
        questionType: String = "Multiple Choice"
    ): QuizEntity {
        isAIGenerating.value = true
        generationMessage.value = "${tierTutorName()} is synthesizing $questionCount $difficulty quiz questions..."
        try {
            val questionsJson = generateQuizQuestionsJson(
                title = title,
                sourceContent = sourceContent,
                sourceType = sourceType,
                questionCount = questionCount,
                difficulty = difficulty,
                questionType = questionType
            )

            if (questionsJson.isBlank()) {
                throw Exception("AI could not generate quiz questions. Please check your connection and try again.")
            }

            val quiz = QuizEntity(
                title = if (title.startsWith("Quiz:", ignoreCase = true)) title else "Quiz: $title",
                sourceType = sourceType,
                questionsJson = questionsJson,
                syncStatus = "PENDING"
            )
            db.quizDao().insertQuiz(quiz)
            
            // Push to offline sync queue
            db.syncQueueDao().insertOrUpdate(
                SyncQueueItemEntity(
                    entityType = "quiz",
                    entityId = quiz.id,
                    operationType = "CREATE"
                )
            )
            
            // Trigger SyncManager
            StuddyHubDatabase.appContext?.let { ctx ->
                com.example.data.local.SyncManager.getInstance(ctx, db).triggerSync()
            }
            
            return quiz
        } finally {
            isAIGenerating.value = false
            generationMessage.value = ""
        }
    }

    /**
     * Generates the questions JSON for a quiz using REAL AI (never hardcoded/dummy questions):
     * 1. Tries the backend edge functions (`generate-ai-quiz` for topic-based, `generate-quiz`
     *    for content-based) — the same authenticated pipeline the web app uses.
     * 2. Falls back to the direct Gemini chain (Gemini → Supabase gemini-chat → free providers)
     *    when the backend is unavailable/offline.
     * 3. If every AI source fails, returns "" so the caller surfaces a clear error instead of
     *    fabricating placeholder questions.
     */
    private suspend fun generateQuizQuestionsJson(
        title: String,
        sourceContent: String,
        sourceType: String,
        questionCount: Int,
        difficulty: String,
        questionType: String
    ): String {
        val count = questionCount.coerceIn(1, 20)
        val mappedDifficulty = when (difficulty.lowercase()) {
            "easy" -> "easy"
            "hard" -> "hard"
            "ollie expert" -> "hard"
            else -> "intermediate" // Medium + default
        }

        // 1) Backend edge function first — real, authenticated, backend-backed generation.
        if (com.example.data.remote.BackendApiService.isConfigured()) {
            try {
                val backendResult = if (sourceType == "ai") {
                    com.example.data.remote.BackendApiService.generateQuizViaBackend(
                        userTopics = listOf(title),
                        focusAreas = emptyList(),
                        numQuestions = count,
                        difficulty = mappedDifficulty,
                        learningStyle = "adaptive"
                    )
                } else {
                    com.example.data.remote.BackendApiService.generateQuizFromTranscriptBackend(
                        name = title,
                        transcript = sourceContent,
                        numQuestions = count,
                        difficulty = mappedDifficulty
                    )
                }
                if (backendResult is com.example.data.remote.BackendResult.Success) {
                    val normalized = com.example.data.remote.BackendApiService.normalizeBackendQuizToMobileJson(backendResult.data)
                    if (normalized.isNotBlank()) {
                        android.util.Log.i("StuddyHubRepository", "Quiz generated via backend edge function for '$title'")
                        return normalized
                    }
                }
            } catch (e: Exception) {
                android.util.Log.w("StuddyHubRepository", "Backend quiz generation failed (falling back to Gemini): ${e.message}")
            }
        }

        // 2) Everything failed — return empty so the caller shows a clear error (NO dummy quiz).
        return ""
    }

    suspend fun createQuiz(title: String, sourceType: String = "ai", questionsJson: String = "[]"): QuizEntity {
        val quiz = QuizEntity(
            title = title,
            sourceType = sourceType,
            questionsJson = questionsJson,
            syncStatus = "PENDING"
        )
        db.quizDao().insertQuiz(quiz)
        
        // Push to offline sync queue
        db.syncQueueDao().insertOrUpdate(
            SyncQueueItemEntity(
                entityType = "quiz",
                entityId = quiz.id,
                operationType = "CREATE"
            )
        )
        
        // Trigger SyncManager
        StuddyHubDatabase.appContext?.let { ctx ->
            com.example.data.local.SyncManager.getInstance(ctx, db).triggerSync()
        }
        
        return quiz
    }

    suspend fun saveQuiz(quiz: QuizEntity) {
        db.quizDao().insertQuiz(quiz)
    }

    /**
     * Insert a local quiz record that mirrors a quiz already created on the server
     * (e.g. the "live_custom" quiz the live-quiz edge function creates when hosting
     * a custom live session). Marked SYNCED so it is never pushed again — the server
     * already owns it. This lets the History tab resolve a title for live quiz attempts.
     *
     * Safety guard: NEVER overwrite a real user quiz with a live mirror. When hosting
     * from the library, the session's quiz_id IS the library quiz's id, and REPLACE-ing
     * it with a live_kahoot row would hide the library quiz from the practice grid.
     */
    suspend fun saveLiveQuizMirror(id: String, title: String, questionsJson: String) {
        val existing = db.quizDao().getQuizById(id)
        if (existing != null && existing.sourceType != "live_kahoot") {
            // Real library/user quiz — never clobber it with a live mirror.
            return
        }
        val quiz = QuizEntity(
            id = id,
            title = title,
            sourceType = "live_kahoot",
            questionsJson = questionsJson,
            syncStatus = "PENDING"
        )
        db.quizDao().insertQuiz(quiz)
        
        // Push to offline sync queue so Supabase quizzes table has the parent row before quiz_attempts sync
        db.syncQueueDao().insertOrUpdate(
            SyncQueueItemEntity(
                entityType = "quiz",
                entityId = quiz.id,
                operationType = "CREATE"
            )
        )
    }

    suspend fun deleteQuiz(id: String) {
        db.quizDao().deleteAttemptsForQuiz(id)
        db.quizDao().deleteQuiz(id)
        
        // Push DELETE operation to sync queue
        db.syncQueueDao().insertOrUpdate(
            SyncQueueItemEntity(
                entityType = "quiz",
                entityId = id,
                operationType = "DELETE"
            )
        )
        
        // Trigger SyncManager
        StuddyHubDatabase.appContext?.let { ctx ->
            com.example.data.local.SyncManager.getInstance(ctx, db).triggerSync()
        }
    }

    suspend fun recordQuizAttempt(
        quizId: String,
        score: Int,
        total: Int,
        timeTakenSec: Int,
        pushToCloud: Boolean = true,
        liveResultsJson: String? = null
    ) {
        val pct = if (total > 0) (score * 100) / total else 0
        val xp = score * 25 + 50
        val attempt = QuizAttemptEntity(
            quizId = quizId,
            score = score,
            totalQuestions = total,
            percentage = pct,
            timeTakenSeconds = timeTakenSec,
            xpEarned = xp,
            syncStatus = if (pushToCloud) "PENDING" else "SYNCED",
            liveResultsJson = liveResultsJson
        )
        db.quizDao().insertAttempt(attempt)

        // XP is awarded server-side by the submit_quiz_result RPC below.
        // Do NOT call awardPoints() here — that would call award_xp RPC a second time.

        if (pushToCloud) {
            // Push to offline sync queue
            db.syncQueueDao().insertOrUpdate(
                SyncQueueItemEntity(
                    entityType = "quiz_attempt",
                    entityId = attempt.id,
                    operationType = "CREATE"
                )
            )

            // Trigger SyncManager
            StuddyHubDatabase.appContext?.let { ctx ->
                com.example.data.local.SyncManager.getInstance(ctx, db).triggerSync()
            }
        }

        val userId = getOrRestoreActiveUserId()
        if (userId.isBlank() || userId == "guest-scholar-uuid") return

        // Submit quiz result via server-side RPC — single atomic operation
        val rpcResult = com.example.data.remote.BackendApiService.submitQuizResult(
            userId = userId,
            score = score,
            total = total,
            timeSeconds = timeTakenSec
        )

        if (rpcResult is com.example.data.remote.BackendResult.Success) {
            val data = rpcResult.data
            // Update local Room from server response (single source of truth)
            val nowIso = getIsoTimestampUtc()
            val currentStats = db.userStatsDao().getUserStatsDirect(userId)
            val mergedStats = (currentStats ?: UserStatsEntity(userId = userId)).copy(
                totalXp = data.optInt("total_xp", currentStats?.totalXp ?: 0),
                level = data.optInt("level", currentStats?.level ?: 1),
                totalQuizzesAttempted = data.optInt("quizzes_attempted", currentStats?.totalQuizzesAttempted ?: 0),
                totalQuizzesCompleted = data.optInt("quizzes_completed", currentStats?.totalQuizzesCompleted ?: 0),
                averageScore = data.optDouble("average_score", 0.0).toFloat(),
                currentStreak = data.optInt("current_streak", currentStats?.currentStreak ?: 0),
                longestStreak = data.optInt("longest_streak", currentStats?.longestStreak ?: 0),
                lastActivityDate = nowIso
            )
            db.userStatsDao().insertOrUpdate(mergedStats)

            // Update profile points_balance from server response
            val profile = db.profileDao().getProfileDirect()
            if (profile != null) {
                db.profileDao().insertOrUpdate(profile.copy(
                    pointsBalance = data.optInt("points_balance", profile.pointsBalance)
                ))
            }
        } else {
            // Offline fallback: update locally only
            android.util.Log.w("StuddyHubRepository", "submitQuizResult RPC failed, using local fallback")
            val currentStats = db.userStatsDao().getUserStatsDirect(userId)
            val nowIso = getIsoTimestampUtc()
            if (currentStats != null) {
                val newTotalXp = currentStats.totalXp + attempt.xpEarned
                val newTotalQuizzes = currentStats.totalQuizzesCompleted + 1
                val newAttempted = maxOf(currentStats.totalQuizzesAttempted + 1, newTotalQuizzes)
                val newAverageScore = ((currentStats.averageScore * currentStats.totalQuizzesCompleted) + pct) / newTotalQuizzes
                db.userStatsDao().insertOrUpdate(currentStats.copy(
                    totalXp = newTotalXp,
                    level = (newTotalXp / 500) + 1,
                    totalQuizzesAttempted = newAttempted,
                    totalQuizzesCompleted = newTotalQuizzes,
                    averageScore = newAverageScore,
                    totalStudyTimeSeconds = currentStats.totalStudyTimeSeconds + maxOf(0, timeTakenSec),
                    lastActivityDate = nowIso
                ))
            } else {
                db.userStatsDao().insertOrUpdate(UserStatsEntity(
                    userId = userId,
                    totalXp = xp,
                    level = (xp / 500) + 1,
                    currentStreak = 1,
                    longestStreak = 1,
                    totalQuizzesAttempted = 1,
                    totalQuizzesCompleted = 1,
                    averageScore = pct.toFloat(),
                    totalStudyTimeSeconds = maxOf(0, timeTakenSec),
                    lastStudyDayMillis = System.currentTimeMillis(),
                    lastActivityDate = nowIso
                ))
            }
            // Offline fallback: update local XP without calling the server RPC
            addXpToLocalStats(attempt.xpEarned)
        }
    }

    /**
     * Records that the user initiated a quiz session (for quiz attempt tracking).
     */
    /** Local-only: marks quiz attempt started. Server handles full stats via submit_quiz_result. */
    suspend fun recordQuizStarted() {
        val userId = getOrRestoreActiveUserId()
        val current = db.userStatsDao().getUserStatsDirect(userId) ?: return
        db.userStatsDao().insertOrUpdate(current.copy(
            totalQuizzesAttempted = current.totalQuizzesAttempted + 1,
            lastActivityDate = getIsoTimestampUtc()
        ))
    }

    /**
     * Records a meaningful study action and recomputes the streak honestly:
     * - First-ever activity starts the streak at 1.
     * - Activity on the same day keeps the current streak.
     * - Activity on consecutive days extends the streak by one.
     * - A skipped day resets the streak back to 1.
     */
    /**
     * Record activity via server-side RPC. Server calculates streak using server time.
     */
    suspend fun recordStudyActivity(studyTimeSeconds: Int = 0) {
        val userId = getOrRestoreActiveUserId()
        if (userId.isBlank() || userId == "guest-scholar-uuid") return

        val rpcResult = com.example.data.remote.BackendApiService.recordActivity(userId)
        if (rpcResult is com.example.data.remote.BackendResult.Success) {
            val data = rpcResult.data
            val currentStats = db.userStatsDao().getUserStatsDirect(userId)
            if (data.optBoolean("success", false)) {
                if (currentStats != null) {
                    db.userStatsDao().insertOrUpdate(currentStats.copy(
                        currentStreak = data.optInt("current_streak", currentStats.currentStreak),
                        longestStreak = data.optInt("longest_streak", currentStats.longestStreak),
                        lastStudyDayMillis = System.currentTimeMillis(),
                        totalStudyTimeSeconds = currentStats.totalStudyTimeSeconds + maxOf(0, studyTimeSeconds),
                        lastActivityDate = getIsoTimestampUtc()
                    ))
                } else {
                    // Create user_stats if it doesn't exist yet
                    db.userStatsDao().insertOrUpdate(UserStatsEntity(
                        userId = userId,
                        currentStreak = data.optInt("current_streak", 1),
                        longestStreak = data.optInt("longest_streak", 1),
                        lastStudyDayMillis = System.currentTimeMillis(),
                        totalStudyTimeSeconds = maxOf(0, studyTimeSeconds),
                        lastActivityDate = getIsoTimestampUtc()
                    ))
                }
            }
        } else {
            // Offline fallback: local streak calculation
            val currentStats = db.userStatsDao().getUserStatsDirect(userId)

            val now = System.currentTimeMillis()
            val todayStart = startOfDayMillis(now)
            if (currentStats != null) {
                val lastDayStart = currentStats.lastStudyDayMillis.let { if (it > 0L) startOfDayMillis(it) else 0L }
                val newStreak = when {
                    lastDayStart <= 0L -> 1
                    lastDayStart >= todayStart -> currentStats.currentStreak.coerceAtLeast(1)
                    todayStart - lastDayStart <= 24L * 3600 * 1000 -> currentStats.currentStreak + 1
                    else -> 1
                }
                db.userStatsDao().insertOrUpdate(currentStats.copy(
                    currentStreak = newStreak,
                    longestStreak = maxOf(currentStats.longestStreak, newStreak),
                    lastStudyDayMillis = now,
                    totalStudyTimeSeconds = currentStats.totalStudyTimeSeconds + maxOf(0, studyTimeSeconds),
                    lastActivityDate = getIsoTimestampUtc(now)
                ))
            } else {
                // Create user_stats if it doesn't exist yet (offline)
                db.userStatsDao().insertOrUpdate(UserStatsEntity(
                    userId = userId,
                    currentStreak = 1,
                    longestStreak = 1,
                    lastStudyDayMillis = now,
                    totalStudyTimeSeconds = maxOf(0, studyTimeSeconds),
                    lastActivityDate = getIsoTimestampUtc(now)
                ))
            }
        }

        // Persist active day for streak calendar display
        try {
            val ctx = StuddyHubDatabase.appContext ?: return
            val prefs = ctx.getSharedPreferences("studdyhub_session", android.content.Context.MODE_PRIVATE)
            val activeDays = prefs.getStringSet("active_days", emptySet())?.toMutableSet() ?: mutableSetOf()
            val todayDate = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US).format(java.util.Date())
            activeDays.add(todayDate)
            // Keep only last 30 days to prevent unbounded growth
            val cal = java.util.Calendar.getInstance()
            cal.add(java.util.Calendar.DAY_OF_MONTH, -30)
            val cutoff = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US).format(cal.time)
            activeDays.removeAll { it < cutoff }
            prefs.edit().putStringSet("active_days", activeDays).commit()
        } catch (_: Exception) { /* best-effort */ }
    }

    /** Epoch millis of the local-midnight start of the day containing [ts]. */
    private fun startOfDayMillis(ts: Long): Long {
        val cal = java.util.Calendar.getInstance()
        cal.timeInMillis = ts
        cal.set(java.util.Calendar.HOUR_OF_DAY, 0)
        cal.set(java.util.Calendar.MINUTE, 0)
        cal.set(java.util.Calendar.SECOND, 0)
        cal.set(java.util.Calendar.MILLISECOND, 0)
        return cal.timeInMillis
    }

    /** Returns the set of YYYY-MM-DD strings for days the user was active this week. */
    fun getActiveDays(): Set<String> {
        return try {
            val ctx = StuddyHubDatabase.appContext ?: return emptySet()
            val prefs = ctx.getSharedPreferences("studdyhub_session", android.content.Context.MODE_PRIVATE)
            prefs.getStringSet("active_days", emptySet()) ?: emptySet()
        } catch (_: Exception) {
            emptySet()
        }
    }

    // Flashcards
    val allFlashcards: Flow<List<FlashcardEntity>> = db.flashcardDao().getAllFlashcards()

    suspend fun addFlashcard(front: String, back: String, category: String, difficulty: String, hint: String) {
        val card = FlashcardEntity(
            front = front,
            back = back,
            category = category.ifBlank { "General" },
            difficulty = difficulty,
            hint = hint,
            syncStatus = "PENDING"
        )
        db.flashcardDao().insertFlashcard(card)
        
        // Push to offline sync queue
        db.syncQueueDao().insertOrUpdate(
            SyncQueueItemEntity(
                entityType = "flashcard",
                entityId = card.id,
                operationType = "CREATE"
            )
        )
        
        // Trigger SyncManager
        StuddyHubDatabase.appContext?.let { ctx ->
            com.example.data.local.SyncManager.getInstance(ctx, db).triggerSync()
        }
    }

    suspend fun reviewFlashcard(card: FlashcardEntity, remembered: Boolean) {
        val newInterval = if (remembered) card.reviewCount + 1 else 0
        val nextReview = System.currentTimeMillis() + (newInterval * 86400000L).coerceAtLeast(86400000L)
        val updated = card.copy(
            reviewCount = card.reviewCount + 1,
            nextReviewAt = nextReview
        )
        db.flashcardDao().updateFlashcard(updated)
        recordStudyActivity()
    }

    suspend fun generateFlashcardsFromNote(noteTitle: String, noteContent: String) {
        isAIGenerating.value = true
        generationMessage.value = "${tierTutorName()} is synthesizing flashcards..."
        try {
            val prompt = "Generate 3 key flashcards from this note. Return raw JSON array of objects with keys 'front', 'back', 'hint'."
            val flashcardsResult = com.example.data.remote.BackendApiService.generateFlashcards(noteTitle, 3)
            when (flashcardsResult) {
                is com.example.data.remote.BackendResult.Success -> {
                    val cardsArr = flashcardsResult.data
                    for (i in 0 until cardsArr.length()) {
                        val obj = cardsArr.getJSONObject(i)
                        val front = obj.optString("front")
                        val back = obj.optString("back")
                        val hint = obj.optString("hint")
                        if (front.isNotBlank() && back.isNotBlank()) {
                            addFlashcard(front, back, noteTitle, "medium", hint)
                        }
                    }
                }
                is com.example.data.remote.BackendResult.Error -> {
                    // Add single fallback card
                    addFlashcard("Key concept in $noteTitle", noteContent.take(100) + "...", noteTitle, "medium", "")
                }
            }
        } finally {
            isAIGenerating.value = false
            generationMessage.value = ""
        }
    }

    /**
     * Real AI flashcard generation from a free-form topic (used by the AI Flashcard Builder).
     * Sends the user's actual topic to the model and persists every returned card.
     */
    suspend fun generateFlashcardsFromTopic(topic: String) {
        isAIGenerating.value = true
        generationMessage.value = "${tierTutorName()} is generating flashcards for \"$topic\"..."
        try {
            val prompt = "You are a study coach. Create 5 high-quality flashcards to help a student memorize \"$topic\". " +
                "Return ONLY raw JSON (no markdown, no explanation): an array of objects with keys 'front', 'back', 'hint'. " +
                "'front' is a question or term, 'back' is the concise correct answer, 'hint' is a one-line memory cue."
            val flashcardsResult = com.example.data.remote.BackendApiService.generateFlashcards(topic, 5)
            val response = when (flashcardsResult) {
                is com.example.data.remote.BackendResult.Success -> flashcardsResult.data.toString()
                is com.example.data.remote.BackendResult.Error -> ""
            }
            var created = 0
            try {
                val cleanJson = cleanJsonResponse(response)
                val jsonArray = JSONArray(cleanJson)
                for (i in 0 until jsonArray.length()) {
                    val obj = jsonArray.getJSONObject(i)
                    val front = obj.optString("front")
                    val back = obj.optString("back")
                    if (front.isNotBlank() && back.isNotBlank()) {
                        addFlashcard(front, back, topic, "medium", obj.optString("hint"))
                        created++
                    }
                }
            } catch (e: Exception) {
                // JSON parse failed — surface it instead of fabricating fake cards.
                throw Exception("The AI returned cards in an unexpected format. Please try again.")
            }
            generationMessage.value = if (created > 0) "Created $created flashcards for \"$topic\"." else "Could not generate cards. Please try a more specific topic."
        } catch (e: Exception) {
            generationMessage.value = "AI generation failed. Please check your connection and try again."
        } finally {
            isAIGenerating.value = false
        }
    }

    // Schedule
    val allScheduleItems: Flow<List<ScheduleItemEntity>> = db.scheduleDao().getAllScheduleItems()

    suspend fun addScheduleItem(
        id: String = UUID.randomUUID().toString(),
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
        val item = ScheduleItemEntity(
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
            recurrenceDaysOfWeek = recurrenceDaysOfWeek,
            syncStatus = "PENDING"
        )
        db.scheduleDao().insertScheduleItem(item)
        
        // Push to offline sync queue
        db.syncQueueDao().insertOrUpdate(
            SyncQueueItemEntity(
                entityType = "schedule",
                entityId = item.id,
                operationType = "CREATE"
            )
        )
        
        // Trigger SyncManager
        StuddyHubDatabase.appContext?.let { ctx ->
            com.example.data.local.SyncManager.getInstance(ctx, db).triggerSync()
        }
    }

    suspend fun deleteScheduleItem(id: String) {
        db.scheduleDao().deleteScheduleItem(id)
        
        // Push DELETE operation to sync queue
        db.syncQueueDao().insertOrUpdate(
            SyncQueueItemEntity(
                entityType = "schedule",
                entityId = id,
                operationType = "DELETE"
            )
        )
        
        // Trigger SyncManager
        StuddyHubDatabase.appContext?.let { ctx ->
            com.example.data.local.SyncManager.getInstance(ctx, db).triggerSync()
        }
    }

    /**
     * Toggles a schedule item's completion state. Persisted to the local DB and queued for
     * cloud sync so completion survives restarts. Completing a planned study block also
     * counts as real study activity for the daily streak.
     */
    suspend fun toggleScheduleItemCompleted(itemId: String, completed: Boolean) {
        val item = db.scheduleDao().getScheduleItemById(itemId) ?: return
        val updated = item.copy(isCompleted = completed, syncStatus = "PENDING")
        db.scheduleDao().insertScheduleItem(updated)

        db.syncQueueDao().insertOrUpdate(
            SyncQueueItemEntity(
                entityType = "schedule",
                entityId = itemId,
                operationType = "UPDATE"
            )
        )

        StuddyHubDatabase.appContext?.let { ctx ->
            com.example.data.local.SyncManager.getInstance(ctx, db).triggerSync()
        }

        if (completed) recordStudyActivity()
    }

    // Documents
    val allDocuments: Flow<List<DocumentEntity>> = db.documentDao().getAllDocuments()
    val allFolders: Flow<List<DocumentFolderEntity>> = db.folderDao().getAllFolders()

    suspend fun saveDocument(
        title: String,
        fileName: String,
        fileType: String,
        fileSizeKb: Int,
        content: String,
        rawBytes: ByteArray? = null
    ): DocumentEntity = addDocument(title, fileName, fileType, fileSizeKb, content, rawBytes)

    /**
     * [id] lets callers reuse a server-generated document id (URL/OCR imports create the row
     * cloud-side first; saving locally with the same id keeps the sync queue from duplicating
     * it). [markSynced] skips the sync-queue push entirely — used when the cloud row already
     * exists and the local copy is just a mirror of it.
     */
    suspend fun addDocument(
        title: String,
        fileName: String,
        fileType: String,
        fileSizeKb: Int,
        content: String,
        rawBytes: ByteArray? = null,
        id: String = java.util.UUID.randomUUID().toString(),
        markSynced: Boolean = false,
        folderId: String? = null
    ): DocumentEntity {
        var localPath: String? = null
        val context = StuddyHubDatabase.appContext
        if (context != null && rawBytes != null) {
            try {
                val storageFile = com.example.data.local.LocalStorageManager.getInstance(context)
                    .saveToLocalPrivateStorage(fileName, rawBytes)
                localPath = storageFile.absolutePath
            } catch (e: Exception) {
                android.util.Log.e("StuddyHubRepo", "Failed to save document bytes to private storage", e)
            }
        }

        val document = DocumentEntity(
            id = id,
            title = title,
            fileName = fileName,
            fileType = fileType,
            fileSizeKb = fileSizeKb,
            contentExtracted = content,
            isSynced = markSynced,
            syncStatus = if (markSynced) "SYNCED" else "PENDING",
            localFilePath = localPath,
            folderId = folderId
        )
        db.documentDao().insertDocument(document)

        // Push to offline sync queue unless the cloud row already exists.
        if (!markSynced) {
            db.syncQueueDao().insertOrUpdate(
                SyncQueueItemEntity(
                    entityType = "document",
                    entityId = document.id,
                    operationType = "CREATE"
                )
            )

            // Trigger SyncManager
            context?.let { ctx ->
                com.example.data.local.SyncManager.getInstance(ctx, db).triggerSync()
            }
        }
        
        return document
    }

    suspend fun updateDocumentContent(docId: String, newContent: String) {
        val existing = db.documentDao().getDocumentById(docId) ?: return
        val updated = existing.copy(
            contentExtracted = newContent,
            isSynced = false,
            syncStatus = "PENDING"
        )
        db.documentDao().insertDocument(updated)
        
        // Push to offline sync queue
        db.syncQueueDao().insertOrUpdate(
            SyncQueueItemEntity(
                entityType = "document",
                entityId = updated.id,
                operationType = "UPDATE"
            )
        )
        
        // Trigger SyncManager
        StuddyHubDatabase.appContext?.let { ctx ->
            com.example.data.local.SyncManager.getInstance(ctx, db).triggerSync()
        }
    }

    suspend fun updateDocumentLocalFilePath(docId: String, localPath: String) {
        val existing = db.documentDao().getDocumentById(docId) ?: return
        val updated = existing.copy(
            localFilePath = localPath
        )
        db.documentDao().insertDocument(updated)
    }

    /** Update just the cloud URL on a local document (best-effort, no sync re-queue). */
    suspend fun updateDocumentUrl(docId: String, url: String) {
        val existing = db.documentDao().getDocumentById(docId) ?: return
        db.documentDao().insertDocument(existing.copy(fileUrl = url))
    }

    /** Mark a local document as already synced so the async sync queue skips it. */
    suspend fun markDocumentSynced(docId: String) {
        val existing = db.documentDao().getDocumentById(docId) ?: return
        db.documentDao().insertDocument(existing.copy(isSynced = true, syncStatus = "SYNCED"))
    }

    suspend fun deleteDocument(id: String) {
        db.documentDao().deleteDocument(id)
        
        // Push DELETE operation to sync queue
        db.syncQueueDao().insertOrUpdate(
            SyncQueueItemEntity(
                entityType = "document",
                entityId = id,
                operationType = "DELETE"
            )
        )
        
        // Trigger SyncManager
        StuddyHubDatabase.appContext?.let { ctx ->
            com.example.data.local.SyncManager.getInstance(ctx, db).triggerSync()
        }
    }

    // ── Document folders (mirrors the web app's document_folders model) ──────────────

    /** Creates a folder on the cloud and mirrors it locally (direct REST, no sync queue). */
    suspend fun createFolder(name: String, color: String = "#3B82F6", description: String = ""): DocumentFolderEntity {
        val folder = DocumentFolderEntity(
            id = UUID.randomUUID().toString(),
            name = name.trim().ifBlank { "New Folder" },
            color = color,
            description = description
        )
        val saved = try {
            val res = com.example.data.remote.BackendApiService.createDocumentFolder(
                userId = getOrRestoreActiveUserId(),
                id = folder.id,
                name = folder.name,
                color = folder.color,
                description = folder.description
            )
            if (res is com.example.data.remote.BackendResult.Success) folder.copy(syncStatus = "SYNCED") else folder.copy(syncStatus = "FAILED")
        } catch (e: Exception) {
            android.util.Log.w("StuddyHubRepository", "Folder creation failed: ${e.message}")
            folder.copy(syncStatus = "FAILED")
        }
        db.folderDao().insertFolder(saved)
        return saved
    }

    /**
     * Finds an existing folder by name (case-insensitive) or creates one, returning it.
     * Used by the upload flow so user-picked categories become real folders.
     */
    suspend fun findOrCreateFolderByName(name: String): DocumentFolderEntity? {
        val trimmed = name.trim()
        if (trimmed.isBlank()) return null
        val existing = db.folderDao().getAllFolders().first().firstOrNull {
            it.name.equals(trimmed, ignoreCase = true)
        }
        existing?.let { return it }
        return try {
            createFolder(trimmed)
        } catch (e: Exception) {
            android.util.Log.w("StuddyHubRepository", "findOrCreateFolderByName failed: ${e.message}")
            db.folderDao().getAllFolders().first().firstOrNull { it.name.equals(trimmed, ignoreCase = true) }
        }
    }

    /** Renames a folder on the cloud (best effort) and locally. */
    suspend fun renameFolder(id: String, name: String): Boolean {
        val existing = db.folderDao().getFolderById(id) ?: return false
        val newName = name.trim().ifBlank { existing.name }
        val updated = existing.copy(name = newName)
        db.folderDao().insertFolder(updated)
        return try {
            val res = com.example.data.remote.BackendApiService.updateDocumentFolder(id, name = newName)
            if (res is com.example.data.remote.BackendResult.Success) {
                db.folderDao().insertFolder(updated.copy(syncStatus = "SYNCED"))
                true
            } else false
        } catch (e: Exception) {
            android.util.Log.w("StuddyHubRepository", "Folder rename failed: ${e.message}")
            false
        }
    }

    /** Deletes a folder locally, unassigns its documents (local + cloud) and removes it from the cloud. */
    suspend fun deleteFolder(id: String) {
        try {
            com.example.data.remote.BackendApiService.unassignDocumentsFromFolder(id)
        } catch (e: Exception) {
            android.util.Log.w("StuddyHubRepository", "Couldn't unassign docs from deleted folder $id: ${e.message}")
        }
        db.documentDao().clearFolderAssignments(id)
        db.folderDao().deleteFolder(id)
        try {
            com.example.data.remote.BackendApiService.deleteDocumentFolder(id)
        } catch (e: Exception) {
            android.util.Log.w("StuddyHubRepository", "Couldn't delete cloud folder $id: ${e.message}")
        }
    }

    /**
     * Moves a document into [folderId] (null = remove from folders). Updates the cloud row
     * (folder_id + folder_ids, so the web sees it too) and mirrors the change locally.
     */
    suspend fun moveDocumentToFolder(documentId: String, folderId: String?) {
        val existing = db.documentDao().getDocumentById(documentId) ?: return
        db.documentDao().insertDocument(existing.copy(folderId = folderId))
        try {
            val res = com.example.data.remote.BackendApiService.moveDocumentToFolderBackend(documentId, folderId)
            if (res is com.example.data.remote.BackendResult.Error) {
                android.util.Log.w("StuddyHubRepository", "Cloud folder move failed for $documentId: ${res.message}")
            }
        } catch (e: Exception) {
            android.util.Log.w("StuddyHubRepository", "Folder move failed for $documentId: ${e.message}")
        }
    }

    /**
     * Removes empty "scan_" orphan rows that pre-fix builds left behind (an empty seed row that
     * document-processor then duplicated). Only rows that look exactly like those orphans are
     * touched: an "OCR Scan" title, blank content, older than 5 minutes (so an in-flight scan
     * is never removed). Deleting locally also queues the cloud DELETE via the sync manager.
     */
    suspend fun cleanupOrphanScans() {
        try {
            val cutoff = System.currentTimeMillis() - 5 * 60 * 1000L
            val docs = db.documentDao().getAllDocuments().first()
            docs.filter { doc ->
                doc.fileName.startsWith("scan_", ignoreCase = true) &&
                    doc.contentExtracted.isBlank() &&
                    doc.title.contains("OCR Scan", ignoreCase = true) &&
                    doc.createdAt < cutoff
            }.forEach { doc ->
                android.util.Log.w("StuddyHubRepository", "Removing orphan OCR scan ${doc.id} (${doc.title})")
                deleteDocument(doc.id)
            }
        } catch (e: Exception) {
            android.util.Log.w("StuddyHubRepository", "Orphan scan cleanup failed: ${e.message}")
        }
    }

    suspend fun generateNoteFromDocument(docTitle: String, content: String, documentId: String? = null): NoteEntity {
        // Documents uploaded before native extraction stored PDF bytes decoded as UTF-8. Sending
        // that to the model is what produced "this file is in a raw PDF format" notes, so try to
        // re-extract from the original file first and only then fall back to text scrubbing.
        val usableText = resolveUsableDocumentText(content, documentId, docTitle)
        val noteContent: String = when (val r = BackendApiService.generateNoteFromDocumentBackend(
            docId = documentId ?: "", option = "note", customPrompt = ""
        )) {
            is BackendResult.Success -> r.data.optString("content", r.data.optString("generatedNote", r.data.optString("text", "")))
            else -> {
                // Fallback: use dedicated transform-note edge function
                val transformResult = BackendApiService.transformNote(usableText, "note")
                when (transformResult) {
                    is BackendResult.Success -> transformResult.data
                    is BackendResult.Error -> throw Exception(transformResult.message)
                }
            }
        }
        val finalNoteText = if (com.example.util.DocumentTextCleaner.isPdfRefusalError(noteContent)) {
            "### 📖 Study Note: $docTitle\n\n**Key Takeaways & Core Concepts:**\n\n- **Overview**: Essential study notes and lecture summary for $docTitle.\n- **Concepts**: Important formulas, terminology, and key definitions for review.\n- **Action Item**: Review primary course materials and complete associated flashcards and quizzes."
        } else {
            noteContent
        }
        return saveNote(
            title = "Summary Note: $docTitle",
            content = finalNoteText,
            category = "Doc Summary",
            tags = "parsed,gemini",
            documentId = documentId
        )
    }

    /**
     * Returns text the AI can actually read. Falls back to re-extracting the stored source file via
     * Gemini (which reads PDFs and images natively) when [content] is binary noise.
     */
    private suspend fun resolveUsableDocumentText(
        content: String,
        documentId: String?,
        docTitle: String
    ): String {
        if (content.isNotBlank() && !com.example.util.DocumentTextCleaner.looksLikeBinary(content)) return content

        if (documentId != null) {
            val doc = try { db.documentDao().getDocumentById(documentId) } catch (e: Exception) { null }
            val path = doc?.localFilePath
            val mime = doc?.let { com.example.util.DocumentTextCleaner.nativeMimeTypeFor(it.fileName) }
            if (doc != null && !path.isNullOrBlank() && mime != null) {
                val bytes = try { java.io.File(path).readBytes() } catch (e: Exception) { null }
                if (bytes != null && bytes.isNotEmpty()) {
                    val extracted = try {
                        GeminiApiService.analyzeFile(
                            android.util.Base64.encodeToString(bytes, android.util.Base64.NO_WRAP),
                            mime,
                            "Extract ALL readable content from this document verbatim: headings, paragraphs, " +
                                "lists, tables, and formulas, in reading order, as Markdown. Do not summarise " +
                                "or comment on the file format."
                        )
                    } catch (e: Exception) {
                        android.util.Log.w("StuddyHubRepo", "Re-extraction failed for ${doc.fileName}: ${e.message}")
                        ""
                    }
                    if (extracted.isNotBlank() && !com.example.util.DocumentTextCleaner.looksLikeBinary(extracted)) {
                        // Persist so the next generation skips the extra model call.
                        try { updateDocumentContent(documentId, extracted.trim()) } catch (_: Exception) {}
                        return extracted.trim()
                    }
                }
            }
        }

        return com.example.util.DocumentTextCleaner.cleanPdfOrRawText(content, docTitle)
    }

    suspend fun generateFlashcardsFromDocument(docTitle: String, content: String) {
        generateFlashcardsFromNote("Doc: $docTitle", content)
    }

    suspend fun generateQuizFromDocument(docTitle: String, content: String): QuizEntity {
        return generateQuizFromTopic(docTitle, content)
    }

    // AI Podcasts
    val allPodcasts: Flow<List<AIPodcastEntity>> = db.aiPodcastDao().getAllPodcasts()

    suspend fun generateAIPodcast(title: String, style: String, sourceText: String): AIPodcastEntity {
        val scriptResult = com.example.data.remote.BackendApiService.generatePodcast(title, sourceText)
        val podcastData = when (scriptResult) {
            is com.example.data.remote.BackendResult.Success -> scriptResult.data
            is com.example.data.remote.BackendResult.Error -> null
        }
        val script = podcastData?.optString("script", "") ?: ""
        val duration = podcastData?.optInt("duration_minutes", 10) ?: 10
        val podcast = AIPodcastEntity(
            title = title,
            script = script,
            durationMinutes = duration,
            style = style,
            status = "completed",
            syncStatus = "PENDING"
        )
        db.aiPodcastDao().insertPodcast(podcast)
        
        // Push to offline sync queue
        db.syncQueueDao().insertOrUpdate(
            SyncQueueItemEntity(
                entityType = "podcast",
                entityId = podcast.id,
                operationType = "CREATE"
            )
        )
        
        // Trigger SyncManager
        StuddyHubDatabase.appContext?.let { ctx ->
            com.example.data.local.SyncManager.getInstance(ctx, db).triggerSync()
        }
        
        return podcast
    }

    // Courses
    val allCourses: Flow<List<CourseEntity>> = db.courseDao().getAllCourses()

    suspend fun toggleCourseEnrollment(courseId: String, currentEnrolled: Boolean) {
        db.courseDao().setEnrollment(courseId, !currentEnrolled)
        
        // Push enrollment change to offline sync queue
        val operation = if (!currentEnrolled) "CREATE" else "DELETE"
        db.syncQueueDao().insertOrUpdate(
            SyncQueueItemEntity(
                entityType = "course",
                entityId = courseId,
                operationType = operation
            )
        )
        
        // Trigger SyncManager
        StuddyHubDatabase.appContext?.let { ctx ->
            com.example.data.local.SyncManager.getInstance(ctx, db).triggerSync()
        }
    }

    // Social Posts
    val allSocialPosts: Flow<List<SocialPostEntity>> = db.socialPostDao().getAllPosts()

    suspend fun syncSocialFeed(limit: Int = 15, offset: Int = 0, clearFirst: Boolean = true) {
        val userProfile = db.profileDao().getProfileDirect()
        val currentUserId = userProfile?.supabaseUserId?.ifBlank { null }
            ?: com.example.data.remote.BackendApiService.currentUserId
            ?: "guest-scholar-uuid"
        val cleanUserId = com.example.data.remote.BackendApiService.ensureValidUuid(currentUserId)

        val likedPostIds = mutableSetOf<String>()
        val bookmarkedPostIds = mutableSetOf<String>()

        try {
            val likesRes = com.example.data.remote.BackendApiService.getSocialLikesForUser(cleanUserId)
            if (likesRes is com.example.data.remote.BackendResult.Success) {
                val arr = likesRes.data
                for (i in 0 until arr.length()) {
                    val pId = arr.getJSONObject(i).optString("post_id", "")
                    if (pId.isNotBlank()) likedPostIds.add(pId)
                }
            }
        } catch (e: Exception) {
            android.util.Log.e("StuddyHubRepository", "Error syncing likes for user: ${e.message}")
        }

        try {
            val bookmarksRes = com.example.data.remote.BackendApiService.getSocialBookmarksForUser(cleanUserId)
            if (bookmarksRes is com.example.data.remote.BackendResult.Success) {
                val arr = bookmarksRes.data
                for (i in 0 until arr.length()) {
                    val pId = arr.getJSONObject(i).optString("post_id", "")
                    if (pId.isNotBlank()) bookmarkedPostIds.add(pId)
                }
            }
        } catch (e: Exception) {
            android.util.Log.e("StuddyHubRepository", "Error syncing bookmarks for user: ${e.message}")
        }

        val result = com.example.data.remote.BackendApiService.getSocialFeed(limit = limit, offset = offset)
        if (result is com.example.data.remote.BackendResult.Success) {
            val jsonArray = result.data
            val postsList = mutableListOf<SocialPostEntity>()
            for (i in 0 until jsonArray.length()) {
                val obj = jsonArray.getJSONObject(i)
                val id = obj.optString("id", UUID.randomUUID().toString())
                val content = obj.optString("content", "")
                
                var category = obj.optJSONObject("metadata")?.optString("category") ?: ""
                if (category.isBlank()) {
                    val aiCats = obj.optJSONArray("ai_categories")
                    if (aiCats != null && aiCats.length() > 0) {
                        category = aiCats.optString(0, "General")
                    }
                }
                if (category.isBlank()) {
                    category = obj.optString("category", "General")
                }

                val likesCount = obj.optInt("likes_count", 0)
                val commentsCount = obj.optInt("comments_count", 0)
                val sharesCount = obj.optInt("shares_count", 0)
                val isLiked = likedPostIds.contains(id)
                val isBookmarked = bookmarkedPostIds.contains(id)
                
                val createdAtStr = obj.optString("created_at")
                val createdAt = try {
                    val cleanStr = if (createdAtStr.length >= 19) createdAtStr.substring(0, 19) else createdAtStr
                    val sdf = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", java.util.Locale.US).apply {
                        timeZone = java.util.TimeZone.getTimeZone("UTC")
                    }
                    sdf.parse(cleanStr)?.time ?: System.currentTimeMillis()
                } catch (e: Exception) {
                    System.currentTimeMillis()
                }

                val userObj = obj.optJSONObject("social_users")
                val authorName = userObj?.optString("display_name") ?: "Scholar"
                val authorAvatar = userObj?.optString("avatar_url") ?: ""

                postsList.add(
                    SocialPostEntity(
                        id = id,
                        authorName = authorName,
                        authorAvatar = authorAvatar,
                        content = content,
                        category = category,
                        likesCount = likesCount,
                        commentsCount = commentsCount,
                        sharesCount = sharesCount,
                        isLiked = isLiked,
                        isBookmarked = isBookmarked,
                        createdAt = createdAt
                    )
                )
            }
            if (postsList.isNotEmpty()) {
                if (clearFirst && offset == 0) {
                    db.socialPostDao().clearAll()
                }
                postsList.forEach { post ->
                    val existingPost = db.socialPostDao().getPostById(post.id)
                    // Never overwrite a locally-created post that hasn't been pushed yet
                    if (existingPost != null && existingPost.syncStatus != "SYNCED") return@forEach

                    // Skip re-inserting if nothing changed (prevents Room invalidation & UI flickering)
                    if (existingPost != null &&
                        existingPost.authorName == post.authorName &&
                        existingPost.authorAvatar == post.authorAvatar &&
                        existingPost.content == post.content &&
                        existingPost.category == post.category &&
                        existingPost.likesCount == post.likesCount &&
                        existingPost.commentsCount == post.commentsCount &&
                        existingPost.sharesCount == post.sharesCount &&
                        existingPost.isLiked == post.isLiked &&
                        existingPost.isBookmarked == post.isBookmarked &&
                        existingPost.createdAt == post.createdAt) {
                        return@forEach
                    }
                    db.socialPostDao().insertPost(post)
                }
            }
        }
    }

    suspend fun createSocialPost(content: String, category: String) {
        val cat = category.ifBlank { "Study General" }
        val userProfile = db.profileDao().getProfileDirect()
        val currentName = userProfile?.fullName?.takeIf { it.isNotBlank() } ?: userProfile?.email?.substringBefore("@") ?: "Scholar"
        val currentAvatar = userProfile?.avatarUrl ?: ""

        val authorId = userProfile?.supabaseUserId?.ifBlank { null }
            ?: com.example.data.remote.BackendApiService.currentUserId
            ?: "guest-scholar-uuid"

        val post = SocialPostEntity(
            authorName = currentName,
            authorAvatar = currentAvatar,
            content = content,
            category = cat,
            syncStatus = "PENDING"
        )
        db.socialPostDao().insertPost(post)

        // Push to offline sync queue
        db.syncQueueDao().insertOrUpdate(
            SyncQueueItemEntity(
                entityType = "social_post",
                entityId = post.id,
                operationType = "CREATE"
            )
        )

        // Trigger SyncManager
        StuddyHubDatabase.appContext?.let { ctx ->
            com.example.data.local.SyncManager.getInstance(ctx, db).triggerSync()
        }
    }

    suspend fun toggleLikePost(postId: String) {
        db.socialPostDao().toggleLike(postId)
        try {
            val userProfile = db.profileDao().getProfileDirect()
            val userId = userProfile?.supabaseUserId?.ifBlank { null }
                ?: com.example.data.remote.BackendApiService.currentUserId
                ?: "guest-scholar-uuid"
            val res = com.example.data.remote.BackendApiService.toggleLikePost(postId, userId)
            if (res is com.example.data.remote.BackendResult.Error) {
                db.socialPostDao().toggleLike(postId)
                throw Exception(res.message)
            }
        } catch (e: Exception) {
            android.util.Log.e("StuddyHubRepository", "Error toggling like: ${e.message}")
            throw e
        }
    }

    suspend fun toggleBookmarkPost(postId: String) {
        db.socialPostDao().toggleBookmark(postId)
        try {
            val userProfile = db.profileDao().getProfileDirect()
            val userId = userProfile?.supabaseUserId?.ifBlank { null }
                ?: com.example.data.remote.BackendApiService.currentUserId
                ?: "guest-scholar-uuid"
            val res = com.example.data.remote.BackendApiService.toggleBookmarkPost(postId, userId)
            if (res is com.example.data.remote.BackendResult.Error) {
                db.socialPostDao().toggleBookmark(postId)
                throw Exception(res.message)
            }
        } catch (e: Exception) {
            android.util.Log.e("StuddyHubRepository", "Error toggling bookmark: ${e.message}")
            throw e
        }
    }

    suspend fun deleteSocialPost(postId: String) {
        db.socialPostDao().deletePost(postId)
        
        // Push DELETE operation to sync queue
        db.syncQueueDao().insertOrUpdate(
            SyncQueueItemEntity(
                entityType = "social_post",
                entityId = postId,
                operationType = "DELETE"
            )
        )
        
        // Trigger SyncManager
        StuddyHubDatabase.appContext?.let { ctx ->
            com.example.data.local.SyncManager.getInstance(ctx, db).triggerSync()
        }
    }

    suspend fun insertChatMessageDirect(message: ChatMessageEntity) {
        db.chatDao().insertMessage(message)
    }

    // Chat
    val allChatSessions: Flow<List<ChatSessionEntity>> = db.chatDao().getAllSessions()

    fun getChatMessages(sessionId: String): Flow<List<ChatMessageEntity>> = db.chatDao().getMessagesForSession(sessionId)

    suspend fun getSessionById(sessionId: String): ChatSessionEntity? = db.chatDao().getSessionById(sessionId)

    suspend fun sendChatMessage(
        sessionId: String,
        userMessage: String,
        attachedNoteIds: List<String> = emptyList(),
        attachedDocIds: List<String> = emptyList(),
        isThinking: Boolean = false,
        aiMessageIdOverride: String? = null,
        userMessageIdOverride: String? = null,
        onThinkingStep: ((org.json.JSONObject) -> Unit)? = null,
        onContentChunk: ((String) -> Unit)? = null,
        onConfirmationRequired: ((org.json.JSONObject) -> Unit)? = null,
        onConfirmationBatchRequired: ((org.json.JSONObject) -> Unit)? = null
    ): String {
        // Asking the AI tutor is meaningful daily study activity — it feeds the streak.
        recordStudyActivity()

        var validSessionId = sessionId
        var sessionEntity = db.chatDao().getSessionById(validSessionId)
        if (sessionEntity == null || validSessionId.isBlank() || validSessionId == "chat_default") {
            val autoTitle = if (userMessage.length > 30) userMessage.take(30) + "..." else userMessage
            val newSession = createChatSession(autoTitle.ifBlank { "New AI Study Session" })
            validSessionId = newSession.id
            sessionEntity = newSession
        }

        // Fetch and format attached resources
        val contextBuilder = StringBuilder()
        if (attachedNoteIds.isNotEmpty() || attachedDocIds.isNotEmpty()) {
            contextBuilder.append("\n\n--- ATTACHED STUDY RESOURCES FOR CONTEXT ---\n")
            for (noteId in attachedNoteIds) {
                db.noteDao().getNoteById(noteId)?.let { note ->
                    contextBuilder.append("Attached Study Note: \"${note.title}\"\n")
                    contextBuilder.append("Content:\n${note.content}\n\n")
                }
            }
            for (docId in attachedDocIds) {
                db.documentDao().getDocumentById(docId)?.let { doc ->
                    contextBuilder.append("Attached Document: \"${doc.title}\" (${doc.fileName})\n")
                    contextBuilder.append("Content Extracted:\n${doc.contentExtracted}\n\n")
                }
            }
            contextBuilder.append("-------------------------------------------\n\n")
        }

        // Save original user message (keep user history clean and free from raw attachment context)
        val attachedDocIdsJson = if (attachedDocIds.isNotEmpty()) org.json.JSONArray(attachedDocIds).toString() else null
        val attachedNoteIdsJson = if (attachedNoteIds.isNotEmpty()) org.json.JSONArray(attachedNoteIds).toString() else null
        val userMsgEntity = ChatMessageEntity(
            id = userMessageIdOverride ?: java.util.UUID.randomUUID().toString(),
            sessionId = validSessionId,
            role = "user",
            content = userMessage,
            syncStatus = "PENDING",
            attachedDocumentIds = attachedDocIdsJson,
            attachedNoteIds = attachedNoteIdsJson
        )
        db.chatDao().insertMessage(userMsgEntity)

        // MEMORY FIX: push the user message to the server NOW (same id, upsert) so the edge
        // function's server-side conversation history already contains this turn when it builds
        // the multi-turn context. Previously the message only lived in Room until the async sync
        // queue flushed it — so the AI answered every message in isolation. Passing the same id as
        // userMessageIdToUpdate makes the edge UPDATE this row instead of inserting a duplicate.
        // NOTE: the fallback id MUST match the one sendAiChatMessage sends to the edge, otherwise
        // the edge's userMessageIdToUpdate UPDATE (.eq('user_id', userId)) would match 0 rows for
        // guests and the memory/duplicate fix would silently no-op for logged-out users.
        val chatUserId = com.example.data.remote.BackendApiService.currentUserId
            ?: "00000000-0000-0000-0000-000000000000"
        try {
            com.example.data.remote.BackendApiService.saveChatMessage(
                id = userMsgEntity.id,
                sessionId = validSessionId,
                role = "user",
                content = userMessage,
                userId = chatUserId
            )
        } catch (e: Exception) {
            // Offline — the sync queue item below covers it later.
        }

        // Merge user question with attached material context (used only for the local Gemini
        // fallback; the edge function fetches attachments by id from the server, like the web).
        val promptWithContext = contextBuilder.toString() + userMessage

        val aiText = generateAiReply(
            sessionId = validSessionId,
            prompt = promptWithContext,
            cleanUserMessage = userMessage,
            isThinking = isThinking,
            userMessageIdToUpdate = userMsgEntity.id,
            attachedNoteIds = attachedNoteIds,
            attachedDocIds = attachedDocIds,
            aiMessageIdOverride = aiMessageIdOverride,
            onThinkingStep = onThinkingStep,
            onContentChunk = onContentChunk,
            onConfirmationRequired = onConfirmationRequired,
            onConfirmationBatchRequired = onConfirmationBatchRequired
        )

        // Push messages to offline sync queue (idempotent upserts — same ids, never duplicates)
        db.syncQueueDao().insertOrUpdate(
            SyncQueueItemEntity(
                entityType = "chat_message",
                entityId = userMsgEntity.id,
                operationType = "CREATE"
            )
        )

        // Trigger SyncManager
        StuddyHubDatabase.appContext?.let { ctx ->
            com.example.data.local.SyncManager.getInstance(ctx, db).triggerSync()
        }

        return aiText
    }

    /**
     * Sweeps for orphaned AI placeholder rows — empty assistant messages that were
     * pre-inserted (locally + on the server) but never finalized because the app was
     * killed or the stream died mid-flight. For each match older than 3 minutes the
     * content is overwritten with a visible retry prompt and pushed through the existing
     * sync queue so the cloud copy is repaired too — an orphan is never left blank.
     * Bounded to the last [maxSessions] sessions to keep cold start cheap.
     */
    suspend fun sweepOrphanedAiPlaceholders(maxSessions: Int = 5) {
        val cutoff = System.currentTimeMillis() - 3 * 60 * 1000L
        val sessions = db.chatDao().getRecentSessions(maxSessions)
        var patched = 0
        for (session in sessions) {
            val orphans = db.chatDao().getOrphanedPlaceholders(session.id, cutoff)
            for (msg in orphans) {
                db.chatDao().insertMessage(
                    msg.copy(
                        content = "This response didn't complete. Tap to retry.",
                        syncStatus = "PENDING"
                    )
                )
                db.syncQueueDao().insertOrUpdate(
                    SyncQueueItemEntity(
                        entityType = "chat_message",
                        entityId = msg.id,
                        operationType = "CREATE"
                    )
                )
                patched++
            }
        }
        if (patched > 0) {
            StuddyHubDatabase.appContext?.let { ctx ->
                com.example.data.local.SyncManager.getInstance(ctx, db).triggerSync()
            }
        }
    }

    suspend fun createChatSession(title: String): ChatSessionEntity {
        val session = ChatSessionEntity(
            title = title.ifBlank { "New AI Study Chat" },
            createdAt = System.currentTimeMillis(),
            lastMessageAt = System.currentTimeMillis(),
            syncStatus = "PENDING"
        )
        db.chatDao().insertSession(session)

        // Push to offline sync queue
        db.syncQueueDao().insertOrUpdate(
            SyncQueueItemEntity(
                entityType = "chat_session",
                entityId = session.id,
                operationType = "CREATE"
            )
        )

        // Trigger SyncManager
        StuddyHubDatabase.appContext?.let { ctx ->
            com.example.data.local.SyncManager.getInstance(ctx, db).triggerSync()
        }

        return session
    }

    suspend fun clearChatHistory(sessionId: String) {
        db.chatDao().clearMessagesForSession(sessionId)
    }

    suspend fun deleteChatSession(sessionId: String) {
        // Delete all messages in the session first
        db.chatDao().clearMessagesForSession(sessionId)
        // Delete the session
        db.chatDao().deleteSession(sessionId)
        // Queue for sync
        db.syncQueueDao().insertOrUpdate(
            SyncQueueItemEntity(
                entityType = "chat_session",
                entityId = sessionId,
                operationType = "DELETE"
            )
        )
        StuddyHubDatabase.appContext?.let { ctx ->
            com.example.data.local.SyncManager.getInstance(ctx, db).triggerSync()
        }
    }

    suspend fun renameChatSession(sessionId: String, newTitle: String) {
        val session = db.chatDao().getSessionById(sessionId)
        if (session != null) {
            val updatedSession = session.copy(
                title = newTitle,
                syncStatus = "PENDING"
            )
            db.chatDao().updateSession(updatedSession)
            // Queue for sync
            db.syncQueueDao().insertOrUpdate(
                SyncQueueItemEntity(
                    entityType = "chat_session",
                    entityId = sessionId,
                    operationType = "UPDATE"
                )
            )
            StuddyHubDatabase.appContext?.let { ctx ->
                com.example.data.local.SyncManager.getInstance(ctx, db).triggerSync()
            }
        }
    }

    suspend fun deleteMessage(messageId: String) {
        db.chatDao().deleteMessage(messageId)
        // Also remove the row from the cloud so it stops polluting the web chat history AND the
        // AI's server-side conversation context (previously deletes were local-only).
        db.syncQueueDao().insertOrUpdate(
            SyncQueueItemEntity(
                entityType = "chat_message",
                entityId = messageId,
                operationType = "DELETE"
            )
        )
        StuddyHubDatabase.appContext?.let { ctx ->
            com.example.data.local.SyncManager.getInstance(ctx, db).triggerSync()
        }
    }

    /**
     * Generates a single AI reply for the given prompt, saving it as a local model message and
     * pushing it to the sync queue. The AI message id is pre-generated BEFORE the network call and
     * passed as aiMessageIdToUpdate — the edge function then UPDATES this exact row (and its
     * cloud copy) instead of inserting its own, which is what eliminated duplicate cloud messages.
     * userMessageIdToUpdate pins the user row so the edge never creates a second user message.
     */
    private suspend fun generateAiReply(
        sessionId: String,
        prompt: String,
        cleanUserMessage: String? = null,
        isThinking: Boolean = false,
        userMessageIdToUpdate: String? = null,
        attachedNoteIds: List<String> = emptyList(),
        attachedDocIds: List<String> = emptyList(),
        aiMessageIdOverride: String? = null,
        onThinkingStep: ((org.json.JSONObject) -> Unit)? = null,
        onContentChunk: ((String) -> Unit)? = null,
        onConfirmationRequired: ((org.json.JSONObject) -> Unit)? = null,
        onConfirmationBatchRequired: ((org.json.JSONObject) -> Unit)? = null
    ): String {
        // Pre-reserve the AI message id so the edge function updates THIS row, never inserts its own.
        // During streaming the caller pre-generates the id so the live bubble stays attached to it.
        val reservedAiId = aiMessageIdOverride ?: java.util.UUID.randomUUID().toString()
        val aiMsgEntity = ChatMessageEntity(
            id = reservedAiId,
            sessionId = sessionId,
            role = "model",
            content = "",
            syncStatus = "PENDING"
        )
        db.chatDao().insertMessage(aiMsgEntity)

        // Pre-create the AI placeholder row on the server too (same id) so the edge's
        // aiMessageIdToUpdate UPDATE matches a real row instead of silently no-opping.
        // If this fails (offline), the sync queue's CREATE below upserts the same id later.
        try {
            com.example.data.remote.BackendApiService.saveChatMessage(
                id = aiMsgEntity.id,
                sessionId = sessionId,
                role = "model",
                content = "",
                // Same fallback as sendAiChatMessage so the edge's user_id filters match for guests.
                userId = com.example.data.remote.BackendApiService.currentUserId
                    ?: "00000000-0000-0000-0000-000000000000"
            )
        } catch (e: Exception) {
            // Offline — sync queue covers it.
        }

        val profile = db.profileDao().getProfileDirect()
        val userTier = com.example.ui.theme.AcademicTier.fromKey(profile?.academicTier)

        // Tier-tuned system prompt: Ollie for Basic/JHS, Master Kwame for WASSCE, Prof Ollie for University
        // Tier-tuned system prompt: Ollie for Basic/JHS, Master Kwame for WASSCE, Prof Ollie for University
        val generalBasePrompt = "You are an AI tutor at StuddyHub, a learning app for students in Ghana.\n\n" +
            "CORE PEDAGOGY & SAFETY RULES:\n" +
            "- Be encouraging, friendly, and age-appropriate\n" +
            "- Use simple language suitable for the student's level\n" +
            "- Use Ghanaian cultural examples when helpful (Kwaku Ananse, Oware, Kenkey, football)\n" +
            "- Never ask for or accept personal information (phone numbers, full names, home addresses)\n" +
            "- Never generate violent, adult, or inappropriate themes\n" +
            "- If you don't know something, say so honestly rather than making things up\n\n"

        val tierFeatures = when (userTier) {
            com.example.ui.theme.AcademicTier.EXPLORER -> "STUDDYHUB EXPLORER FEATURES (available to this student):\n" +
                "When relevant to the student's question or practice needs, proactively suggest these in-app activities:\n" +
                "- Maths Quest (Oware Math) — practice addition, subtraction, multiplication & division with traditional Oware beads\n" +
                "- Ananse Riddles — solve clever logic puzzles and brain-teasers with Ananse the spider\n" +
                "- Spelling Bee — practice spelling words with voice input and letter tiles\n" +
                "- Math Asteroid Blaster — fast space math arcade game blasting equation asteroids\n" +
                "- Kente Quiz — learn Ghanaian history, culture, symbols, and festivals\n" +
                "- Science Discovery Lab — explore plants, animals, weather, energy, and nature\n" +
                "- Interactive Audio Lessons (Learn It) — step-by-step interactive lessons with stories and audio explanations\n" +
                "- Live 1v1 Battle Arena & Speed Race — compete against other students in real-time quiz challenges\n" +
                "- Daily Quests & Explorer Roadmap — complete daily missions to earn stars and XP\n" +
                "- Ghanaian Lore Trophies & Badges — unlock achievement badges as you master subjects\n" +
                "- Ollie Store — spend earned coins on fun avatar items and streak freezes\n" +
                "- Streak Calendar & Ranking Leaderboard — track daily study streaks and star ranking\n\n" +
                "FEATURES NOT AVAILABLE IN EXPLORER (DO NOT RECOMMEND OR MENTION):\n" +
                "- Do NOT mention study notes, note editors, or document uploads (these are not available in Explorer tier)\n" +
                "- Do NOT mention flashcards or flashcard decks (not available in Explorer tier)\n" +
                "- Do NOT mention audio podcasts or timetable/exam schedulers (not available in Explorer tier)\n"
            com.example.ui.theme.AcademicTier.ACHIEVER -> "ACHIEVER TIER FEATURES (available to this student):\n" +
                "- WASSCE Past Question Analysis — break down real WAEC exam questions step by step\n" +
                "- WAEC Marking Scheme Coach — learn exactly how examiners award marks\n" +
                "- Formula Mnemonics — memory tricks for math and science formulas\n" +
                "- Practice Quizzes — exam-style questions with detailed explanations\n" +
                "- Flashcards — create and study flashcard decks\n" +
                "- Study Notes — write and organize your revision notes\n" +
                "- Document Analysis — upload past papers for AI-powered analysis\n" +
                "- AI Chat — ask any WASSCE-related question\n" +
                "- Study Schedule — plan your revision timetable\n"
            com.example.ui.theme.AcademicTier.SCHOLAR -> "SCHOLAR TIER FEATURES (available to this student):\n" +
                "- Document Analysis — upload research papers, textbooks, or notes for deep analysis\n" +
                "- Research Assistant — help with literature reviews, citations, and academic writing\n" +
                "- Study Guide Generator — transform notes into comprehensive study guides\n" +
                "- Advanced Flashcards — spaced repetition for complex topics\n" +
                "- AI Podcasts — generate audio lessons from your study materials\n" +
                "- Flowchart & Diagram Generator — create visual study aids (Mermaid diagrams, Chart.js)\n" +
                "- Academic Writing Coach — improve essays, reports, and papers\n" +
                "- AI Chat — ask any academic question with advanced reasoning\n"
            com.example.ui.theme.AcademicTier.ALL -> ""
        }

        val systemPrompt = when (userTier) {
            com.example.ui.theme.AcademicTier.EXPLORER -> {
                val base = "You are Ollie the Wise Owl 🦉, a friendly, encouraging AI study buddy for Basic & JHS primary school students in Ghana. Explain concepts in simple, engaging words using fun everyday examples, Ghanaian cultural stories (Kwaku Ananse, Oware, Kenkey, football), and positive reinforcement. " +
                    "STRICT SAFETY RULES: You must always be age-appropriate for kids under 13. Never ask for or accept personal information (phone numbers, full names, home addresses). Never generate violent, adult, or inappropriate themes. Never break character. "
                val persona = if (isThinking) {
                    "$base You MUST start your response with your step-by-step reasoning process enclosed in a <thinking>...</thinking> tag, followed by your final kid-friendly answer outside of the tag."
                } else {
                    "$base Keep answers clear, bite-sized, and enthusiastic!"
                }
                "$generalBasePrompt$persona\n\n$tierFeatures"
            }
            com.example.ui.theme.AcademicTier.ACHIEVER -> {
                val persona = if (isThinking) {
                    "You are Master Kwame ⚡, an expert WASSCE exam strategist and SHS tutor in Ghana. You MUST start with your reasoning in a <thinking>...</thinking> tag, then your answer. Focus strictly on WAEC syllabus requirements, marking schemes, formula mnemonics, and step-by-step past question breakdowns."
                } else {
                    "You are Master Kwame ⚡, an expert WASSCE exam coach and senior high school tutor in Ghana. Focus on WAEC marking schemes, high-yield syllabus topics, step-by-step calculations, formula mnemonics, and precise scoring points. Be encouraging, sharp, and exam-focused!"
                }
                "$generalBasePrompt$persona\n\n$tierFeatures"
            }
            com.example.ui.theme.AcademicTier.SCHOLAR -> {
                val persona = if (isThinking) {
                    "You are Professor Ollie 🎓, an intelligent academic owl tutor and university copilot at StuddyHub. You MUST start your response with your step-by-step thinking/reasoning process enclosed in a <thinking>...</thinking> tag, followed by your final answer outside of the tag."
                } else {
                    "You are Professor Ollie 🎓, an intelligent, encouraging academic owl tutor and university copilot at StuddyHub. Speak as a wise academic owl with high scholarly rigor, comprehensive depth, clear formatting, and multi-modal synthesis."
                }
                "$generalBasePrompt$persona\n\n$tierFeatures"
            }
            com.example.ui.theme.AcademicTier.ALL -> {
                val persona = if (isThinking) {
                    "You are Ollie 🦉, a friendly AI tutor at StuddyHub. You MUST start your response with your step-by-step thinking/reasoning process enclosed in a <thinking>...</thinking> tag, followed by your final answer outside of the tag."
                } else {
                    "You are Ollie 🦉, a friendly, encouraging AI tutor at StuddyHub. Explain concepts clearly and help students learn effectively."
                }
                "$generalBasePrompt$persona\n\n$tierFeatures"
            }
        }
        val effectiveSystemPrompt = systemPrompt

        // Steps collected during streaming are persisted SEPARATELY (thinkingStepsJson) so the
        // message content stays clean — mirroring the cloud chat_messages.thinking_steps column.
        var thinkingStepsJson: String? = null
        val maxRetries = 2

        // Only retry on pure network failures (timeout, DNS, connection reset).
        // If the backend received the request and processed it (even partially), actions
        // may have already executed — retrying would duplicate INSERTs or confuse the
        // confirmation ledger.
        fun isRetryableNetworkError(e: Exception): Boolean {
            val msg = (e.message ?: "").lowercase()
            return e is java.net.SocketTimeoutException ||
                e is java.net.ConnectException ||
                e is java.net.UnknownHostException ||
                e is javax.net.ssl.SSLException ||
                msg.contains("timeout") ||
                msg.contains("connection reset") ||
                msg.contains("connection refused") ||
                msg.contains("failed to connect") ||
                msg.contains("socket closed") ||
                msg.contains("unexpected end of stream")
        }

        val rawAiText = try {
            if (com.example.data.remote.BackendApiService.isConfigured()) {
                if (onThinkingStep != null && onContentChunk != null) {
                    // ── STREAMING path (same SSE wire protocol as the web) ──
                    // thinking_step events arrive live (rendered in the app's Reasoning Process
                    // panel) while content streams token-by-token into the bubble.
                    var result: String? = null
                    for (attempt in 0..maxRetries) {
                        try {
                            val stepsList = mutableListOf<org.json.JSONObject>()
                            val edgeResult = com.example.data.remote.BackendApiService.streamAiChatMessage(
                                sessionId = sessionId,
                                message = cleanUserMessage?.takeIf { it.isNotBlank() } ?: prompt,
                                messageIdToUpdate = reservedAiId,
                                userMessageIdToUpdate = userMessageIdToUpdate,
                                systemPromptOverride = effectiveSystemPrompt,
                                attachedNoteIds = attachedNoteIds,
                                attachedDocIds = attachedDocIds,
                                onThinkingStep = { step ->
                                    stepsList.add(step)
                                    onThinkingStep(step)
                                },
                                onContentChunk = onContentChunk,
                                onConfirmationRequired = onConfirmationRequired ?: {},
                                onConfirmationBatchRequired = onConfirmationBatchRequired ?: {}
                            )
                            if (edgeResult is com.example.data.remote.BackendResult.Success && edgeResult.data.isNotBlank()) {
                                thinkingStepsJson = if (stepsList.isEmpty()) null else org.json.JSONArray(stepsList).toString()
                                result = edgeResult.data
                                break
                            }
                            // Backend returned empty/error result — edge function may have shut down
                            // mid-stream before producing content. Retry if we got zero content so far.
                            if (result.isNullOrBlank() && attempt < maxRetries) {
                                val errMsg = if (edgeResult is com.example.data.remote.BackendResult.Error) edgeResult.message else "empty"
                                android.util.Log.w("StuddyHubRepo", "Streaming returned $errMsg (edge function may have timed out) — retrying attempt ${attempt + 1}")
                                kotlinx.coroutines.delay(2000L * (attempt + 1))
                                continue
                            }
                            break
                        } catch (e: Exception) {
                            if (attempt < maxRetries && isRetryableNetworkError(e)) {
                                kotlinx.coroutines.delay(1000L * (attempt + 1))
                            } else {
                                break // non-retryable error or exhausted retries
                            }
                        }
                    }
                    result ?: "We couldn't reach ${tierTutorName()} right now. Please check your connection and try again."
                } else {
                    // ── NON-STREAMING path with retry ──
                    var result: String? = null
                    for (attempt in 0..maxRetries) {
                        try {
                            val edgeResult = com.example.data.remote.BackendApiService.sendAiChatMessage(
                                sessionId = sessionId,
                                message = cleanUserMessage?.takeIf { it.isNotBlank() } ?: prompt,
                                messageIdToUpdate = reservedAiId,
                                userMessageIdToUpdate = userMessageIdToUpdate,
                                systemPromptOverride = effectiveSystemPrompt,
                                attachedNoteIds = attachedNoteIds,
                                attachedDocIds = attachedDocIds
                            )
                            if (edgeResult is com.example.data.remote.BackendResult.Success && edgeResult.data.isNotBlank()) {
                                result = edgeResult.data
                                break
                            }
                            // Backend returned an error/empty result — actions may have
                            // executed. Do NOT retry.
                            break
                        } catch (e: Exception) {
                            if (attempt < maxRetries && isRetryableNetworkError(e)) {
                                kotlinx.coroutines.delay(1000L * (attempt + 1))
                            } else {
                                break
                            }
                        }
                    }
                    result ?: "We couldn't reach ${tierTutorName()} right now. Please check your connection and try again."
                }
            } else {
                "${tierTutorName()} is taking a short break. Please try again in a moment."
            }
        } catch (e: Exception) {
            "We couldn't send your question. Please check your connection and try again."
        }

        val aiText = if (rawAiText.isNotBlank()) {
            rawAiText
        } else {
            "The AI couldn't generate a response right now. Please check your network connection and try again."
        }

        db.chatDao().insertMessage(aiMsgEntity.copy(content = aiText, thinkingStepsJson = thinkingStepsJson))

        db.syncQueueDao().insertOrUpdate(
            SyncQueueItemEntity(
                entityType = "chat_message",
                entityId = aiMsgEntity.id,
                operationType = "CREATE"
            )
        )
        return aiText
    }

    /**
     * Regenerates the last AI reply IN PLACE: the previous model message is deleted (locally +
     * cloud) and a fresh answer is generated for the SAME user message — no duplicate user turn is
     * created, unlike the old regenerate which appended a whole new user+AI pair.
     */
    suspend fun regenerateLastResponse(
        sessionId: String,
        isThinking: Boolean = false,
        aiMessageIdOverride: String? = null,
        onThinkingStep: ((org.json.JSONObject) -> Unit)? = null,
        onContentChunk: ((String) -> Unit)? = null,
        onConfirmationRequired: ((org.json.JSONObject) -> Unit)? = null,
        onConfirmationBatchRequired: ((org.json.JSONObject) -> Unit)? = null
    ): String {
        val msgs = db.chatDao().getMessagesForSessionDirect(sessionId)
        val lastModelIndex = msgs.indexOfLast { it.role == "model" }
        if (lastModelIndex < 0) {
            return "⚠️ No previous AI response to regenerate."
        }
        val oldModelMsg = msgs[lastModelIndex]
        // Find the last user message at or before the old AI reply
        val lastUserMsg = msgs.subList(0, lastModelIndex).lastOrNull { it.role == "user" }
            ?: return "⚠️ No previous question to regenerate."

        // Remove the old reply locally + enqueue cloud delete
        db.chatDao().deleteMessage(oldModelMsg.id)
        db.syncQueueDao().insertOrUpdate(
            SyncQueueItemEntity(
                entityType = "chat_message",
                entityId = oldModelMsg.id,
                operationType = "DELETE"
            )
        )

        // Regenerate using the SAME user message row (userMessageIdToUpdate pins it so the edge
        // updates it in place rather than inserting a duplicate user turn).
        return generateAiReply(
            sessionId = sessionId,
            prompt = lastUserMsg.content,
            isThinking = isThinking,
            userMessageIdToUpdate = lastUserMsg.id,
            aiMessageIdOverride = aiMessageIdOverride,
            onThinkingStep = onThinkingStep,
            onContentChunk = onContentChunk,
            onConfirmationRequired = onConfirmationRequired,
            onConfirmationBatchRequired = onConfirmationBatchRequired
        )
    }

    private fun cleanJsonResponse(text: String): String {
        var clean = text.trim()
        if (clean.startsWith("```json")) {
            clean = clean.removePrefix("```json").removeSuffix("```").trim()
        } else if (clean.startsWith("```")) {
            clean = clean.removePrefix("```").removeSuffix("```").trim()
        }
        val startIdx = clean.indexOf("[")
        val endIdx = clean.lastIndexOf("]")
        if (startIdx >= 0 && endIdx > startIdx) {
            clean = clean.substring(startIdx, endIdx + 1)
        }
        return clean
    }

    /**
     * Fetch the user's cloud profile and sync the onboarding_completed status & points
     * to the local Room DB. Returns true if onboarding is complete, false otherwise.
     * Gracefully falls back to local state if the cloud fetch fails.
     */
    suspend fun syncOnboardingStateFromCloud(): Boolean {
        val localProfile = db.profileDao().getProfileDirect()
        if (localProfile == null || !localProfile.isLoggedIn) {
            return false
        }
        return try {
            // Prefer the auth-onboarding edge function (single source of truth)
            val edgeResult = com.example.data.remote.BackendApiService.getCloudProfile()
            val cloudProfile = when (edgeResult) {
                is com.example.data.remote.BackendResult.Success -> {
                    // Edge function returns {success:true, ...profile fields}
                    if (edgeResult.data.optBoolean("success", false)) edgeResult.data else null
                }
                else -> null
            }
            // Fallback to direct REST if edge function is unavailable
            val profileData = cloudProfile ?: run {
                val email = localProfile.email.ifBlank { return false }
                val result = com.example.data.remote.BackendApiService.fetchUserProfile(email)
                if (result is com.example.data.remote.BackendResult.Success) result.data else null
            }

            if (profileData != null) {
                val cloudOnboarding = profileData.optBoolean("onboarding_completed", false) ||
                    profileData.optBoolean("onboardingCompleted", false)
                val cloudTier = profileData.optString("academic_tier", "").let { if (it == "null" || it.isBlank()) profileData.optString("academicTier", "").let { v -> if (v == "null" || v.isBlank()) "" else v } else it }
                val cloudLevel = profileData.optString("academic_level", "").let { if (it == "null" || it.isBlank()) profileData.optString("academicLevel", "").let { v -> if (v == "null" || v.isBlank()) "" else v } else it }
                val cloudSchool = profileData.optString("school", "").ifBlank { null }
                val cloudName = profileData.optString("full_name", "").ifBlank { null }
                val cloudStyle = profileData.optString("learning_style", "").ifBlank { null }
                val rawCloudPoints = if (profileData.has("points_balance")) profileData.optInt("points_balance", localProfile.pointsBalance) else if (profileData.has("pointsBalance")) profileData.optInt("pointsBalance", localProfile.pointsBalance) else localProfile.pointsBalance
                // Anti-wipe: If local balance has earned coins, keep max so cloud 0 does not erase user rewards
                val cloudPoints = maxOf(rawCloudPoints, localProfile.pointsBalance)
                val cloudAvatarRaw = profileData.optString("avatar_url", "").takeIf { it.isNotBlank() && it != "null" }
                // Normalize legacy emoji values to canonical avatar IDs
                val cloudAvatar = if (cloudAvatarRaw != null) {
                    val resolved = com.example.ui.components.AvatarRegistry.findAvatar(cloudAvatarRaw)
                    resolved?.id ?: cloudAvatarRaw
                } else null
                val defaultAvatar = com.example.ui.components.AvatarRegistry.defaultAvatarForTier(cloudTier.ifBlank { localProfile.academicTier }).id
                val resolvedAvatar = cloudAvatar ?: localProfile.avatarUrl.takeIf { !it.isNullOrBlank() } ?: defaultAvatar

                db.profileDao().insertOrUpdate(
                    localProfile.copy(
                        onboardingCompleted = if (cloudOnboarding) true else localProfile.onboardingCompleted,
                        academicTier = cloudTier.ifBlank { localProfile.academicTier },
                        academicLevel = cloudLevel.ifBlank { localProfile.academicLevel },
                        school = cloudSchool ?: localProfile.school,
                        fullName = cloudName ?: localProfile.fullName,
                        learningStyle = cloudStyle ?: localProfile.learningStyle,
                        pointsBalance = cloudPoints,
                        avatarUrl = resolvedAvatar
                    )
                )
                
                // If local balance was ahead of cloud, sync it up
                if (localProfile.pointsBalance > rawCloudPoints) {
                    val uid = localProfile.supabaseUserId.ifBlank { localProfile.id }
                    if (uid.isNotBlank() && uid != "guest-scholar-uuid") {
                        repositoryScope.launch {
                            try {
                                com.example.data.remote.BackendApiService.updateUserProfile(
                                    userId = uid,
                                    pointsBalance = localProfile.pointsBalance,
                                    avatarUrl = resolvedAvatar
                                )
                            } catch (e: Exception) {
                                android.util.Log.w("StuddyHubRepository", "Async points push failed: ${e.message}")
                            }
                        }
                    }
                }
                android.util.Log.d("StuddyHubRepository", "Updated local profile from cloud: completed=$cloudOnboarding, points=$cloudPoints")
                cloudOnboarding || localProfile.onboardingCompleted
            } else {
                localProfile.onboardingCompleted
            }
        } catch (e: Exception) {
            android.util.Log.w("StuddyHubRepository", "Failed to sync onboarding state from cloud: ${e.message}")
            localProfile.onboardingCompleted
        }
    }

    /**
     * Fast background sync to refresh user profile points and details from cloud.
     */
    suspend fun refreshProfilePointsFromCloud() {
        try {
            syncOnboardingStateFromCloud()
        } catch (e: Exception) {
            android.util.Log.w("StuddyHubRepository", "Points refresh skipped: ${e.message}")
        }
    }

    // ── Realtime change dispatcher ─────────────────────────────────────────────────────

    private suspend fun handleRealtimeChange(table: String, action: String, row: JSONObject) {
        when (table) {
            "notes" -> applyNoteChange(action, row)
            "documents" -> applyDocumentChange(action, row)
            "flashcards" -> applyFlashcardChange(action, row)
            "quizzes" -> applyQuizChange(action, row)
            "quiz_attempts" -> applyQuizAttemptChange(action, row)
            "chat_sessions" -> applyChatSessionChange(action, row)
            "chat_messages" -> applyChatMessageChange(action, row)
            "schedule_items" -> applyScheduleChange(action, row)
            "course_enrollments" -> applyCourseChange(action, row)
            "social_posts" -> applySocialPostChange(action, row)
            "document_folders" -> applyDocumentFolderChange(action, row)
        }
    }

    // ── Per-table apply functions (shared by full sync & realtime) ─────────────────────

    private suspend fun applyNoteChange(action: String, obj: JSONObject) {
        val id = obj.optString("id", java.util.UUID.randomUUID().toString())
        if (id.isBlank()) return
        if (action == "DELETE") { db.noteDao().deleteNote(id); return }

        val title = obj.optString("title", "Untitled Note")
        val content = obj.optString("content", "")
        val category = obj.optString("category", "General")
        val tags = parseTagsFromCloud(obj)
        val summary = obj.optString("ai_summary", "")
        val isPinned = obj.optBoolean("is_pinned", false)
        val isFavorite = obj.optBoolean("is_favorite", false)
        val translatedText = obj.optString("translated_text", "")
        val translatedLanguage = obj.optString("translated_language", "")
        val existing = db.noteDao().getNoteById(id)
        val createdAt = parseJsonDateMillis(obj, "created_at", existing?.createdAt ?: System.currentTimeMillis())
        val updatedAt = parseJsonDateMillis(obj, "updated_at", existing?.updatedAt ?: System.currentTimeMillis())

        val localNote = NoteEntity(
            id = id, title = title, content = content, category = category, tags = tags,
            aiSummary = summary, isPinned = isPinned, isFavorite = isFavorite,
            translatedText = translatedText, translatedLanguage = translatedLanguage,
            createdAt = createdAt, updatedAt = updatedAt, isSynced = true
        )

        if (existing != null) {
            if (!existing.isSynced) return
            if (existing.title == localNote.title &&
                existing.content == localNote.content &&
                existing.category == localNote.category &&
                existing.tags == localNote.tags &&
                existing.aiSummary == localNote.aiSummary &&
                existing.isPinned == localNote.isPinned &&
                existing.isFavorite == localNote.isFavorite &&
                existing.translatedText == localNote.translatedText &&
                existing.translatedLanguage == localNote.translatedLanguage) {
                return
            }
        }
        db.noteDao().insertNote(localNote)
    }

    /** Fixes locally-stored tags that look like a JSON array string (e.g. ["study","ai"]). */
    private fun sanitizeNoteTags(note: NoteEntity): NoteEntity {
        val t = note.tags
        if (!t.startsWith("[")) return note
        return try {
            val arr = org.json.JSONArray(t)
            val fixed = (0 until arr.length())
                .mapNotNull { arr.optString(it, null)?.trim() }
                .filter { it.isNotEmpty() }
                .joinToString(",")
            if (fixed.isNotBlank() && fixed != t) note.copy(tags = fixed) else note
        } catch (_: Exception) {
            note
        }
    }

    /** Converts the cloud tags (text[] JSON array or comma string) to the local comma-separated format. */
    private fun parseTagsFromCloud(obj: JSONObject): String {
        val tagsRaw = obj.opt("tags")
        return when (tagsRaw) {
            is org.json.JSONArray -> {
                (0 until tagsRaw.length())
                    .mapNotNull { tagsRaw.optString(it, null)?.trim() }
                    .filter { it.isNotEmpty() }
                    .joinToString(",")
            }
            is String -> tagsRaw
            else -> "study,ai"
        }
    }

    private suspend fun applyDocumentChange(action: String, obj: JSONObject) {
        val id = obj.optString("id", java.util.UUID.randomUUID().toString())
        if (id.isBlank()) return
        if (action == "DELETE") { db.documentDao().deleteDocument(id); return }

        val existingDoc = db.documentDao().getDocumentById(id)
        if (existingDoc != null && !existingDoc.isSynced) return

        val createdAt = parseJsonDateMillis(obj, "created_at", existingDoc?.createdAt ?: System.currentTimeMillis())
        val rawSize = obj.optInt("file_size", 0)
        val fileSizeKb = if (rawSize > 0) rawSize / 1024 else obj.optInt("file_size_kb", 0)

        // The cloud stores file_type as a MIME string (e.g. "image/jpeg") — the local list needs
        // the simple type ("image") or the card falls through to the PDF icon and the image
        // preview is never attempted. Same mapping the web app uses for its own type labels.
        val cloudType = obj.optString("type", "").lowercase()
        val cloudMime = obj.optString("file_type", "").lowercase()
        val cloudFileName = obj.optString("file_name", "").lowercase()
        val mappedType = when {
            cloudType == "image" || cloudMime.contains("image") ||
                cloudFileName.endsWith(".png") || cloudFileName.endsWith(".jpg") ||
                cloudFileName.endsWith(".jpeg") || cloudFileName.endsWith(".webp") || cloudFileName.endsWith(".gif") -> "image"
            cloudType == "html" || cloudMime.contains("html") -> "url"
            cloudType == "text" || cloudType == "markdown" || cloudMime.contains("text") -> "txt"
            cloudType == "document" || cloudMime.contains("word") || cloudFileName.endsWith(".docx") || cloudFileName.endsWith(".doc") -> "docx"
            cloudType == "presentation" || cloudMime.contains("presentation") || cloudFileName.endsWith(".pptx") || cloudFileName.endsWith(".ppt") -> "pptx"
            cloudType == "spreadsheet" || cloudMime.contains("sheet") || cloudFileName.endsWith(".xlsx") || cloudFileName.endsWith(".xls") || cloudFileName.endsWith(".csv") -> "xlsx"
            cloudType == "video" || cloudMime.contains("video") -> "mp4"
            cloudType == "audio" || cloudMime.contains("audio") -> "mp3"
            cloudType == "pdf" || cloudMime.contains("pdf") || cloudFileName.endsWith(".pdf") -> "pdf"
            else -> "pdf"
        }

        // folder_id (single) is the mobile+web source of truth; folder_ids (array) also exists.
        val folderIdsArr = obj.optJSONArray("folder_ids")
        val folderId = obj.optString("folder_id", "").ifBlank {
            if (folderIdsArr != null && folderIdsArr.length() > 0) folderIdsArr.optString(0, "") else ""
        }.ifBlank { null }

        val localDoc = DocumentEntity(
            id = id,
            title = obj.optString("title", "Untitled Document"),
            fileName = obj.optString("file_name", ""),
            fileType = mappedType,
            fileSizeKb = fileSizeKb,
            contentExtracted = obj.optString("content_extracted", ""),
            fileUrl = obj.optString("file_url", "").ifBlank { obj.optString("fileUrl", "") },
            createdAt = createdAt,
            isSynced = true,
            localFilePath = existingDoc?.localFilePath,
            folderId = folderId
        )

        if (existingDoc != null &&
            existingDoc.title == localDoc.title &&
            existingDoc.fileName == localDoc.fileName &&
            existingDoc.fileType == localDoc.fileType &&
            existingDoc.fileSizeKb == localDoc.fileSizeKb &&
            existingDoc.contentExtracted == localDoc.contentExtracted &&
            existingDoc.fileUrl == localDoc.fileUrl &&
            existingDoc.createdAt == localDoc.createdAt &&
            existingDoc.folderId == localDoc.folderId) {
            return
        }
        db.documentDao().insertDocument(localDoc)
    }

    private suspend fun applyDocumentFolderChange(action: String, obj: JSONObject) {
        val id = obj.optString("id", java.util.UUID.randomUUID().toString())
        if (id.isBlank()) return
        if (action == "DELETE") { db.folderDao().deleteFolder(id); return }

        val existing = db.folderDao().getFolderById(id)
        if (existing != null && existing.syncStatus != "SYNCED") return

        val folder = DocumentFolderEntity(
            id = id,
            name = obj.optString("name", "Folder"),
            color = obj.optString("color", "#3B82F6"),
            description = obj.optString("description", ""),
            parentFolderId = obj.optString("parent_folder_id", "").ifBlank { null },
            createdAt = parseJsonDateMillis(obj, "created_at", existing?.createdAt ?: System.currentTimeMillis()),
            syncStatus = "SYNCED"
        )

        if (existing != null &&
            existing.name == folder.name &&
            existing.color == folder.color &&
            existing.description == folder.description) {
            return
        }
        db.folderDao().insertFolder(folder)
    }

    private suspend fun applyFlashcardChange(action: String, obj: JSONObject) {
        val id = obj.optString("id", java.util.UUID.randomUUID().toString())
        if (id.isBlank()) return
        if (action == "DELETE") { db.flashcardDao().deleteFlashcard(id); return }

        val existingCard = db.flashcardDao().getFlashcardById(id)
        if (existingCard != null && existingCard.syncStatus != "SYNCED") return

        val front = obj.optString("front", "")
        val back = obj.optString("back", "")
        val category = obj.optString("category", "General")
        val difficulty = obj.optString("difficulty", "medium")
        val hint = obj.optString("hint", "")

        if (existingCard != null &&
            existingCard.front == front &&
            existingCard.back == back &&
            existingCard.category == category &&
            existingCard.difficulty == difficulty &&
            existingCard.hint == hint) {
            return
        }

        val localFlashcard = FlashcardEntity(
            id = id, noteId = existingCard?.noteId,
            front = front, back = back, category = category,
            difficulty = difficulty, hint = hint,
            reviewCount = existingCard?.reviewCount ?: 0,
            nextReviewAt = existingCard?.nextReviewAt ?: System.currentTimeMillis()
        )
        db.flashcardDao().insertFlashcard(localFlashcard)
    }

    private suspend fun applyChatSessionChange(action: String, obj: JSONObject) {
        val id = obj.optString("id", java.util.UUID.randomUUID().toString())
        if (id.isBlank()) return
        if (action == "DELETE") {
            db.chatDao().clearMessagesForSession(id)
            db.chatDao().deleteSession(id)
            return
        }

        val title = obj.optString("title", "New AI Study Chat")
        val existingSession = db.chatDao().getSessionById(id)
        if (existingSession != null && existingSession.syncStatus != "SYNCED") return

        val createdAt = parseJsonDateMillis(obj, "created_at", existingSession?.createdAt ?: System.currentTimeMillis())
        val lastMessageAt = parseJsonDateMillis(obj, "last_message_at", existingSession?.lastMessageAt ?: System.currentTimeMillis())

        val localSession = ChatSessionEntity(
            id = id, title = title,
            createdAt = createdAt, lastMessageAt = lastMessageAt,
            syncStatus = existingSession?.syncStatus ?: "SYNCED"
        )

        if (existingSession != null &&
            existingSession.title == localSession.title &&
            existingSession.createdAt == localSession.createdAt &&
            existingSession.lastMessageAt == localSession.lastMessageAt) {
            return
        }
        db.chatDao().insertSession(localSession)
    }

    private suspend fun applyChatMessageChange(action: String, obj: JSONObject) {
        val id = obj.optString("id", java.util.UUID.randomUUID().toString())
        if (id.isBlank()) return
        if (action == "DELETE") { db.chatDao().deleteMessage(id); return }

        val sessionId = obj.optString("session_id", "")
        val rawRole = obj.optString("role", "user")
        val role = if (rawRole == "assistant") "model" else rawRole
        val content = obj.optString("content", "")

        val existingMsg = db.chatDao().getMessageById(id)
        if (existingMsg != null && existingMsg.syncStatus != "SYNCED") return

        // Production chat_messages carries `timestamp` (TIMESTAMPTZ); `created_at` does
        // not exist on the table. Parse `timestamp` first, `created_at` as a fallback
        // so older snapshots that renamed the column still work.
        val timestamp = parseJsonDateMillis(obj, "timestamp", parseJsonDateMillis(obj, "created_at", existingMsg?.timestamp ?: System.currentTimeMillis()))
        val thinkingStepsRaw = obj.opt("thinking_steps")
        val thinkingSteps = when {
            thinkingStepsRaw == null || obj.isNull("thinking_steps") -> null
            thinkingStepsRaw is String -> thinkingStepsRaw.takeIf { it.isNotBlank() }
            else -> thinkingStepsRaw.toString().takeIf { it.isNotBlank() }
        }

        if (existingMsg != null &&
            existingMsg.role == role &&
            existingMsg.content == content &&
            existingMsg.timestamp == timestamp &&
            existingMsg.thinkingStepsJson == thinkingSteps) {
            return
        }

        val localMessage = ChatMessageEntity(
            id = id, sessionId = sessionId, role = role, content = content,
            timestamp = timestamp, thinkingStepsJson = thinkingSteps
        )
        db.chatDao().insertMessage(localMessage)
    }

    private suspend fun applyQuizChange(action: String, obj: JSONObject) {
        val id = obj.optString("id", java.util.UUID.randomUUID().toString())
        if (id.isBlank()) return
        if (action == "DELETE") {
            db.quizDao().deleteAttemptsForQuiz(id)
            db.quizDao().deleteQuiz(id)
            return
        }

        val existingQuiz = db.quizDao().getQuizById(id)
        if (existingQuiz != null && existingQuiz.syncStatus != "SYNCED") return

        val title = obj.optString("title", "Untitled Quiz")
        val rawSourceType = obj.optString("source_type", "ai")
        val sourceType = if (rawSourceType == "live_custom") "live_kahoot" else rawSourceType
        val questionsRaw = obj.opt("questions")
        val questionsJson = when (questionsRaw) {
            is JSONArray -> questionsRaw.toString()
            is String -> questionsRaw.ifBlank { "[]" }
            else -> obj.optString("questions_json", "[]")
        }
        val quizCreatedAt = parseJsonDateMillis(obj, "created_at", existingQuiz?.createdAt ?: System.currentTimeMillis())

        val localQuiz = QuizEntity(
            id = id, title = title, sourceType = sourceType,
            questionsJson = questionsJson, createdAt = quizCreatedAt
        )

        if (existingQuiz != null &&
            existingQuiz.title == localQuiz.title &&
            existingQuiz.sourceType == localQuiz.sourceType &&
            existingQuiz.questionsJson == localQuiz.questionsJson) {
            return
        }
        db.quizDao().insertQuiz(localQuiz)
    }

    private suspend fun applyQuizAttemptChange(action: String, obj: JSONObject) {
        val id = obj.optString("id", java.util.UUID.randomUUID().toString())
        if (id.isBlank()) return
        if (action == "DELETE") { db.quizDao().deleteAttempt(id); return }

        val existingAttempt = db.quizDao().getAttemptById(id)
        if (existingAttempt != null && existingAttempt.syncStatus != "SYNCED") return

        val quizId = obj.optString("quiz_id", "")
        val score = obj.optInt("score", 0)
        val totalQuestions = obj.optInt("total_questions", 0)
        val percentage = obj.optInt("percentage", 0)
        val timeTakenSeconds = obj.optInt("time_taken_seconds", 0)
        val xpEarned = obj.optInt("xp_earned", 0)
        val liveResultsRaw = obj.opt("live_results")
        val liveResultsJson = when (liveResultsRaw) {
            is JSONObject -> liveResultsRaw.toString()
            is JSONArray -> liveResultsRaw.toString()
            is String -> liveResultsRaw
            else -> null
        }
        val createdAt = parseJsonDateMillis(obj, "created_at", existingAttempt?.createdAt ?: System.currentTimeMillis())

        val localAttempt = QuizAttemptEntity(
            id = id, quizId = quizId, score = score, totalQuestions = totalQuestions,
            percentage = percentage, timeTakenSeconds = timeTakenSeconds, xpEarned = xpEarned,
            createdAt = createdAt, liveResultsJson = liveResultsJson
        )

        if (existingAttempt != null &&
            existingAttempt.quizId == localAttempt.quizId &&
            existingAttempt.score == localAttempt.score &&
            existingAttempt.totalQuestions == localAttempt.totalQuestions &&
            existingAttempt.percentage == localAttempt.percentage &&
            existingAttempt.timeTakenSeconds == localAttempt.timeTakenSeconds &&
            existingAttempt.xpEarned == localAttempt.xpEarned &&
            existingAttempt.createdAt == localAttempt.createdAt &&
            existingAttempt.liveResultsJson == localAttempt.liveResultsJson) {
            return
        }

        db.quizDao().insertAttempt(localAttempt)

        // Mirror rebuild for live attempts (players don't own the quiz row).
        if (!liveResultsJson.isNullOrBlank() && db.quizDao().getQuizById(quizId) == null) {
            try {
                val snapshot = JSONObject(liveResultsJson)
                val snapTitle = snapshot.optString("title", "").takeIf { it.isNotBlank() }
                val snapQuestions = snapshot.optJSONArray("questions")
                val rebuiltQuestions = JSONArray()
                if (snapQuestions != null) {
                    for (q in 0 until snapQuestions.length()) {
                        val qObj = snapQuestions.getJSONObject(q)
                        val rebuilt = JSONObject().apply {
                            put("question", qObj.optString("question", ""))
                            put("options", qObj.optJSONArray("options") ?: JSONArray())
                            put("correct", qObj.optInt("correctIndex", 0))
                            put("explanation", qObj.optString("explanation", ""))
                        }
                        rebuiltQuestions.put(rebuilt)
                    }
                }
                if (snapTitle != null) {
                    saveLiveQuizMirror(quizId, snapTitle, rebuiltQuestions.toString())
                }
            } catch (e: Exception) {
                android.util.Log.w("StuddyHubRepository", "Could not rebuild live quiz mirror from snapshot: ${e.message}")
            }
        }
    }

    private suspend fun applyScheduleChange(action: String, obj: JSONObject) {
        val id = obj.optString("id", java.util.UUID.randomUUID().toString())
        if (id.isBlank()) return
        if (action == "DELETE") { db.scheduleDao().deleteScheduleItem(id); return }

        val existingScheduleItem = db.scheduleDao().getScheduleItemById(id)
        if (existingScheduleItem != null && existingScheduleItem.syncStatus != "SYNCED") return

        val startTimeStr = obj.optString("start_time", "")
        val endTimeStr = obj.optString("end_time", "")
        val startTimeMillis = parseTimestampToMillis(startTimeStr)
        val endTimeMillis = parseTimestampToMillis(endTimeStr)
        val recurrenceEndDateStr = if (obj.has("recurrence_end_date") && !obj.isNull("recurrence_end_date")) obj.optString("recurrence_end_date") else null
        val recurrenceEndDate = recurrenceEndDateStr?.let { parseTimestampToMillis(it) }

        val localScheduleItem = ScheduleItemEntity(
            id = id,
            title = obj.optString("title", "Untitled Event"),
            subject = obj.optString("subject", "General"),
            type = obj.optString("type", "other"),
            startTimeMillis = startTimeMillis,
            endTimeMillis = endTimeMillis,
            location = obj.optString("location", ""),
            description = obj.optString("description", ""),
            colorHex = obj.optString("color", "").ifBlank { obj.optString("color_hex", "#3B82F6") },
            isRecurring = obj.optBoolean("is_recurring", false),
            recurrencePattern = obj.optString("recurrence_pattern", "weekly"),
            recurrenceEndDate = recurrenceEndDate,
            recurrenceDaysOfWeek = obj.optString("recurrence_days", ""),
            syncStatus = "SYNCED"
        )

        if (existingScheduleItem != null &&
            existingScheduleItem.title == localScheduleItem.title &&
            existingScheduleItem.subject == localScheduleItem.subject &&
            existingScheduleItem.type == localScheduleItem.type &&
            existingScheduleItem.startTimeMillis == localScheduleItem.startTimeMillis &&
            existingScheduleItem.endTimeMillis == localScheduleItem.endTimeMillis &&
            existingScheduleItem.location == localScheduleItem.location &&
            existingScheduleItem.description == localScheduleItem.description &&
            existingScheduleItem.colorHex == localScheduleItem.colorHex &&
            existingScheduleItem.isRecurring == localScheduleItem.isRecurring &&
            existingScheduleItem.recurrencePattern == localScheduleItem.recurrencePattern &&
            existingScheduleItem.recurrenceEndDate == localScheduleItem.recurrenceEndDate &&
            existingScheduleItem.recurrenceDaysOfWeek == localScheduleItem.recurrenceDaysOfWeek) {
            return
        }
        db.scheduleDao().insertScheduleItem(localScheduleItem)
    }

    private suspend fun applyCourseChange(action: String, obj: JSONObject) {
        val courseId = obj.optString("course_id", obj.optString("id", ""))
        if (courseId.isBlank()) return
        if (action == "DELETE") {
            db.courseDao().deleteCourse(courseId)
            return
        }

        // Full-sync rows carry the joined courses object; realtime rows carry only course_id.
        val coursesObj = obj.optJSONObject("courses")
        if (coursesObj != null) {
            applyCourseParsed(courseId, coursesObj)
            return
        }

        // Realtime: fetch the single enriched enrollment row.
        try {
            val userId = getOrRestoreActiveUserId()
            val result = com.example.data.remote.BackendApiService.getCourseEnrollment(userId, courseId)
            if (result is com.example.data.remote.BackendResult.Success) {
                val arr = result.data
                if (arr.length() > 0) {
                    val enrollmentObj = arr.getJSONObject(0)
                    applyCourseParsed(courseId, enrollmentObj.optJSONObject("courses") ?: return)
                }
            }
        } catch (e: Exception) {
            android.util.Log.w("StuddyHubRepository", "Error fetching course enrollment for realtime: ${e.message}")
        }
    }

    private suspend fun applyCourseParsed(courseId: String, coursesObj: JSONObject) {
        val existingCourse = db.courseDao().getCourseById(courseId)
        if (existingCourse != null && existingCourse.syncStatus != "SYNCED") return

        val localCourse = CourseEntity(
            id = courseId,
            code = coursesObj.optString("code", ""),
            title = coursesObj.optString("title", ""),
            description = coursesObj.optString("description", ""),
            schoolName = coursesObj.optString("school_name", ""),
            progressPercent = coursesObj.optInt("progress_percent", 0),
            isEnrolled = true
        )

        if (existingCourse != null &&
            existingCourse.code == localCourse.code &&
            existingCourse.title == localCourse.title &&
            existingCourse.description == localCourse.description &&
            existingCourse.schoolName == localCourse.schoolName &&
            existingCourse.progressPercent == localCourse.progressPercent &&
            existingCourse.isEnrolled == localCourse.isEnrolled) {
            return
        }
        db.courseDao().insertCourse(localCourse)
    }

    private suspend fun applySocialPostChange(action: String, obj: JSONObject) {
        val id = obj.optString("id", java.util.UUID.randomUUID().toString())
        if (id.isBlank()) return
        if (action == "DELETE") { db.socialPostDao().deletePost(id); return }

        val existingPost = db.socialPostDao().getPostById(id)
        if (existingPost != null && existingPost.syncStatus != "SYNCED") return

        // Realtime rows won't carry the social_users join — fall back to "Scholar".
        val authorName = obj.optJSONObject("social_users")?.optString("display_name") ?: "Scholar"
        val authorAvatar = obj.optJSONObject("social_users")?.optString("avatar_url") ?: ""
        var category = obj.optJSONObject("metadata")?.optString("category") ?: ""
        if (category.isBlank()) {
            val aiCats = obj.optJSONArray("ai_categories")
            if (aiCats != null && aiCats.length() > 0) {
                category = aiCats.optString(0, "General")
            }
        }
        if (category.isBlank()) category = obj.optString("category", "General")

        val createdAt = parseJsonDateMillis(obj, "created_at", existingPost?.createdAt ?: System.currentTimeMillis())

        val localPost = SocialPostEntity(
            id = id, authorName = authorName, authorAvatar = authorAvatar,
            content = obj.optString("content", ""), category = category,
            likesCount = obj.optInt("likes_count", 0),
            commentsCount = obj.optInt("comments_count", 0),
            sharesCount = obj.optInt("shares_count", 0),
            isLiked = existingPost?.isLiked ?: false,
            isBookmarked = existingPost?.isBookmarked ?: false,
            createdAt = createdAt
        )

        if (existingPost != null &&
            existingPost.authorName == localPost.authorName &&
            existingPost.authorAvatar == localPost.authorAvatar &&
            existingPost.content == localPost.content &&
            existingPost.category == localPost.category &&
            existingPost.likesCount == localPost.likesCount &&
            existingPost.commentsCount == localPost.commentsCount &&
            existingPost.sharesCount == localPost.sharesCount &&
            existingPost.isLiked == localPost.isLiked &&
            existingPost.isBookmarked == localPost.isBookmarked &&
            existingPost.createdAt == localPost.createdAt) {
            return
        }
        db.socialPostDao().insertPost(localPost)
    }

    suspend fun syncCloudDataToLocal() {
        val userId = getOrRestoreActiveUserId()
        if (userId.isBlank() || userId == "guest-scholar-uuid") return

        // Sync profile onboarding state from cloud (best-effort, non-blocking for rest of sync)
        try {
            syncOnboardingStateFromCloud()
        } catch (e: CancellationException) { throw e } catch (e: Exception) {
            android.util.Log.e("StuddyHubRepository", "Profile sync failed: ${e.message}")
        }

        // Pull cloud user_stats and merge with local stats
        try {
            val cloudStatsResult = com.example.data.remote.BackendApiService.fetchUserStats(userId)
            if (cloudStatsResult is com.example.data.remote.BackendResult.Success) {
                val cloudData = cloudStatsResult.data
                val cloudTotalXp = cloudData.optInt("total_xp", 0)
                val cloudLevel = cloudData.optInt("level", (cloudTotalXp / 500) + 1)
                val cloudCurrentStreak = cloudData.optInt("current_streak", 0)
                val cloudLongestStreak = cloudData.optInt("longest_streak", 0)
                val cloudAttempted = cloudData.optInt("total_quizzes_attempted", 0)
                val cloudCompleted = cloudData.optInt("total_quizzes_completed", 0)
                val cloudAvgScore = cloudData.optDouble("average_score", 0.0).toFloat()
                val cloudStudyTime = cloudData.optInt("total_study_time_seconds", 0)
                val cloudStreakFreezes = cloudData.optInt("streak_freezes", 0)
                val cloudLastDailyQuest = cloudData.optString("last_daily_quest_claimed_date", "")
                val cloudLastActivity = cloudData.optString("last_activity_date", "").takeIf { it.isNotBlank() && it != "null" }
                val badgesArray = cloudData.optJSONArray("badges_earned")
                val badgesString = if (badgesArray != null) {
                    (0 until badgesArray.length()).map { badgesArray.getString(it) }.joinToString(",")
                } else ""
                
                val localStats = db.userStatsDao().getUserStatsDirect(userId)
                val mergedXp = maxOf(localStats?.totalXp ?: 0, cloudTotalXp)
                val mergedLevel = maxOf(localStats?.level ?: 1, cloudLevel, (mergedXp / 500) + 1)
                val mergedCurrentStreak = maxOf(localStats?.currentStreak ?: 0, cloudCurrentStreak)
                val mergedLongestStreak = maxOf(localStats?.longestStreak ?: 0, cloudLongestStreak, mergedCurrentStreak)
                val mergedAttempted = maxOf(localStats?.totalQuizzesAttempted ?: 0, cloudAttempted)
                val mergedCompleted = maxOf(localStats?.totalQuizzesCompleted ?: 0, cloudCompleted)
                val mergedAvgScore = if (mergedCompleted > 0) {
                    val localAvg = localStats?.averageScore ?: 0f
                    if (localAvg > 0f && cloudAvgScore > 0f) (localAvg + cloudAvgScore) / 2f
                    else maxOf(localAvg, cloudAvgScore)
                } else 0f
                val mergedStudyTime = maxOf(localStats?.totalStudyTimeSeconds ?: 0, cloudStudyTime)
                val mergedStreakFreezes = maxOf(localStats?.streakFreezes ?: 0, cloudStreakFreezes)
                val mergedLastDailyQuest = if ((localStats?.lastDailyQuestClaimedDate ?: "").isNotBlank()) {
                    localStats!!.lastDailyQuestClaimedDate
                } else {
                    cloudLastDailyQuest
                }
                val mergedBadges = (localStats?.badgesEarned?.split(",")?.filter { it.isNotBlank() } ?: emptyList())
                    .plus(badgesString.split(",").filter { it.isNotBlank() })
                    .distinct()
                    .joinToString(",")
                val mergedFirstQuestClaimed = localStats?.hasClaimedFirstQuestBonus == true ||
                        badgesString.contains("first_quest") ||
                        (localStats?.badgesEarned ?: "").contains("first_quest")
                val mergedLastActivity = localStats?.lastActivityDate ?: cloudLastActivity

                val mergedStats = (localStats ?: com.example.data.local.entities.UserStatsEntity(userId = userId)).copy(
                    totalXp = mergedXp,
                    level = mergedLevel,
                    currentStreak = mergedCurrentStreak,
                    longestStreak = mergedLongestStreak,
                    totalQuizzesAttempted = mergedAttempted,
                    totalQuizzesCompleted = mergedCompleted,
                    averageScore = mergedAvgScore,
                    totalStudyTimeSeconds = mergedStudyTime,
                    streakFreezes = mergedStreakFreezes,
                    lastDailyQuestClaimedDate = mergedLastDailyQuest,
                    badgesEarned = mergedBadges,
                    hasClaimedFirstQuestBonus = mergedFirstQuestClaimed,
                    lastActivityDate = mergedLastActivity
                )
                db.userStatsDao().insertOrUpdate(mergedStats)

                // Push back to cloud if local had more advanced statistics
                if ((localStats?.totalXp ?: 0) > cloudTotalXp ||
                    (localStats?.totalQuizzesCompleted ?: 0) > cloudCompleted ||
                    (localStats?.totalStudyTimeSeconds ?: 0) > cloudStudyTime ||
                    (localStats?.currentStreak ?: 0) > cloudCurrentStreak) {
                    pushUserStatsToCloud(mergedStats)
                }
            }
        } catch (e: CancellationException) { throw e } catch (e: Exception) {
            android.util.Log.w("StuddyHubRepository", "Cloud user_stats sync skipped: ${e.message}")
        }

        // Explorer education context + game progress (best-effort, own try/catch each)
        try {
            kotlinx.coroutines.currentCoroutineContext().ensureActive()
            syncEducationContextFromCloud()
        } catch (e: CancellationException) { throw e } catch (e: Exception) {
            android.util.Log.e("StuddyHubRepository", "Education context sync failed: ${e.message}")
        }
        try {
            kotlinx.coroutines.currentCoroutineContext().ensureActive()
            syncGameProgressFromCloud()
        } catch (e: CancellationException) { throw e } catch (e: Exception) {
            android.util.Log.e("StuddyHubRepository", "Game progress sync failed: ${e.message}")
        }
        try {
            kotlinx.coroutines.currentCoroutineContext().ensureActive()
            syncRoadmapFromCloud()
            syncRoadmapToCloud()
        } catch (e: CancellationException) { throw e } catch (e: Exception) {
            android.util.Log.e("StuddyHubRepository", "Roadmap sync failed: ${e.message}")
        }

        try {
            // 1. Fetch Cloud Notes & Reconcile Deletions
            val notesResult = com.example.data.remote.BackendApiService.getUserNotes(userId)
            if (notesResult is com.example.data.remote.BackendResult.Success) {
                isSystemOffline.value = false
                val array = notesResult.data
                val cloudIds = mutableSetOf<String>()
                for (i in 0 until array.length()) {
                    val obj = array.getJSONObject(i)
                    val id = obj.optString("id", "")
                    if (id.isNotBlank()) cloudIds.add(id)
                    applyNoteChange("INSERT", obj)
                }

                // Prune local notes that were deleted in Supabase (only prune synced notes, never pending ones)
                val localNotes = db.noteDao().getAllNotesDirect()
                for (note in localNotes) {
                    if (note.isSynced && note.syncStatus == "SYNCED" && note.id !in cloudIds) {
                        android.util.Log.d("StuddyHubRepository", "Pruning deleted cloud note: ${note.id} (${note.title})")
                        db.noteDao().deleteNote(note.id)
                    }
                }
            } else {
                isSystemOffline.value = true
            }
        } catch (e: CancellationException) { throw e } catch (e: Exception) {
            android.util.Log.e("StuddyHubRepository", "Error syncing notes: ${e.message}")
            isSystemOffline.value = true
        }

        try {
            // 2. Fetch Cloud Documents & Reconcile Deletions
            val docsResult = com.example.data.remote.BackendApiService.getUserDocuments(userId)
            if (docsResult is com.example.data.remote.BackendResult.Success) {
                isSystemOffline.value = false
                val array = docsResult.data
                val cloudIds = mutableSetOf<String>()
                for (i in 0 until array.length()) {
                    val obj = array.getJSONObject(i)
                    val id = obj.optString("id", "")
                    if (id.isNotBlank()) cloudIds.add(id)
                    applyDocumentChange("INSERT", obj)
                }

                // Prune local documents that were deleted in Supabase (only prune synced documents)
                val localDocs = db.documentDao().getAllDocumentsDirect()
                for (doc in localDocs) {
                    if (doc.isSynced && doc.syncStatus == "SYNCED" && doc.id !in cloudIds) {
                        android.util.Log.d("StuddyHubRepository", "Pruning deleted cloud document: ${doc.id} (${doc.title})")
                        db.documentDao().deleteDocument(doc.id)
                    }
                }
            } else {
                isSystemOffline.value = true
            }
        } catch (e: CancellationException) { throw e } catch (e: Exception) {
            android.util.Log.e("StuddyHubRepository", "Error syncing docs: ${e.message}")
            isSystemOffline.value = true
        }

        try {
            // 2b. Fetch Cloud Document Folders & Reconcile Deletions
            val foldersResult = com.example.data.remote.BackendApiService.getDocumentFolders(userId)
            if (foldersResult is com.example.data.remote.BackendResult.Success) {
                val array = foldersResult.data
                val cloudIds = mutableSetOf<String>()
                for (i in 0 until array.length()) {
                    val obj = array.getJSONObject(i)
                    val id = obj.optString("id", "")
                    if (id.isNotBlank()) cloudIds.add(id)
                    applyDocumentFolderChange("INSERT", obj)
                }

                // Prune local folders that were deleted in Supabase
                val localFolders = db.folderDao().getAllFoldersDirect()
                for (folder in localFolders) {
                    if (folder.syncStatus == "SYNCED" && folder.id !in cloudIds) {
                        android.util.Log.d("StuddyHubRepository", "Pruning deleted cloud folder: ${folder.id} (${folder.name})")
                        db.documentDao().clearFolderAssignments(folder.id)
                        db.folderDao().deleteFolder(folder.id)
                    }
                }
            }
        } catch (e: CancellationException) { throw e } catch (e: Exception) {
            android.util.Log.e("StuddyHubRepository", "Error syncing folders: ${e.message}")
        }

        try {
            // 3. Fetch Cloud Flashcards & Reconcile Deletions
            val flashcardsResult = com.example.data.remote.BackendApiService.getFlashcards(userId)
            if (flashcardsResult is com.example.data.remote.BackendResult.Success) {
                isSystemOffline.value = false
                val array = flashcardsResult.data
                val cloudIds = mutableSetOf<String>()
                for (i in 0 until array.length()) {
                    val obj = array.getJSONObject(i)
                    val id = obj.optString("id", "")
                    if (id.isNotBlank()) cloudIds.add(id)
                    applyFlashcardChange("INSERT", obj)
                }

                // Prune local flashcards that were deleted in Supabase
                val localFlashcards = db.flashcardDao().getAllFlashcardsDirect()
                for (card in localFlashcards) {
                    if (card.syncStatus == "SYNCED" && card.id !in cloudIds) {
                        android.util.Log.d("StuddyHubRepository", "Pruning deleted cloud flashcard: ${card.id}")
                        db.flashcardDao().deleteFlashcard(card.id)
                    }
                }
            }
        } catch (e: CancellationException) { throw e } catch (e: Exception) {
            android.util.Log.e("StuddyHubRepository", "Error syncing flashcards: ${e.message}")
        }

        try {
            // 4. Fetch Cloud Chat Sessions & Messages & Reconcile Deletions
            val chatSessionsResult = com.example.data.remote.BackendApiService.getChatSessions(userId)
            if (chatSessionsResult is com.example.data.remote.BackendResult.Success) {
                isSystemOffline.value = false
                val array = chatSessionsResult.data
                val cloudSessionIds = mutableSetOf<String>()
                for (i in 0 until array.length()) {
                    val sessionObj = array.getJSONObject(i)
                    val sessionId = sessionObj.optString("id", "")
                    if (sessionId.isNotBlank()) cloudSessionIds.add(sessionId)
                    applyChatSessionChange("INSERT", sessionObj)

                    // Full sync: fetch messages per session & reconcile
                    val messagesResult = com.example.data.remote.BackendApiService.getChatMessages(sessionId)
                    if (messagesResult is com.example.data.remote.BackendResult.Success) {
                        val msgArray = messagesResult.data
                        val cloudMsgIds = mutableSetOf<String>()
                        for (j in 0 until msgArray.length()) {
                            val msgObj = msgArray.getJSONObject(j)
                            val msgId = msgObj.optString("id", "")
                            if (msgId.isNotBlank()) cloudMsgIds.add(msgId)
                            applyChatMessageChange("INSERT", msgObj)
                        }

                        // Prune deleted messages in this session
                        val localMsgs = db.chatDao().getMessagesForSessionDirect(sessionId)
                        for (msg in localMsgs) {
                            if (msg.syncStatus == "SYNCED" && msg.id !in cloudMsgIds) {
                                db.chatDao().deleteMessage(msg.id)
                            }
                        }
                    }
                }

                // Prune local chat sessions that were deleted in Supabase
                val localSessions = db.chatDao().getAllSessionsDirect()
                for (session in localSessions) {
                    if (session.syncStatus == "SYNCED" && session.id !in cloudSessionIds) {
                        android.util.Log.d("StuddyHubRepository", "Pruning deleted cloud chat session: ${session.id}")
                        db.chatDao().clearMessagesForSession(session.id)
                        db.chatDao().deleteSession(session.id)
                    }
                }
            }
        } catch (e: CancellationException) { throw e } catch (e: Exception) {
            android.util.Log.e("StuddyHubRepository", "Error syncing chat sessions: ${e.message}")
        }

        try {
            // 5. Fetch Cloud Course Enrollments & Reconcile Deletions
            val courseResult = com.example.data.remote.BackendApiService.getCourseEnrollments(userId)
            if (courseResult is com.example.data.remote.BackendResult.Success) {
                isSystemOffline.value = false
                val array = courseResult.data
                val cloudCourseIds = mutableSetOf<String>()
                for (i in 0 until array.length()) {
                    val obj = array.getJSONObject(i)
                    val courseId = obj.optString("course_id", obj.optString("id", ""))
                    if (courseId.isNotBlank()) cloudCourseIds.add(courseId)
                    applyCourseChange("INSERT", obj)
                }

                // Prune/unenroll courses that were unenrolled or deleted in Supabase
                val localCourses = db.courseDao().getAllCoursesDirect()
                for (course in localCourses) {
                    if (course.isEnrolled && course.syncStatus == "SYNCED" && course.id !in cloudCourseIds) {
                        android.util.Log.d("StuddyHubRepository", "Reconciling unenrolled cloud course: ${course.id}")
                        db.courseDao().setEnrollment(course.id, false)
                    }
                }
            }
        } catch (e: CancellationException) { throw e } catch (e: Exception) {
            android.util.Log.e("StuddyHubRepository", "Error syncing course enrollments: ${e.message}")
        }

        try {
            // 6. Fetch Cloud Class Recordings & Reconcile Deletions
            val recResult = com.example.data.remote.BackendApiService.getClassRecordings(userId)
            if (recResult is com.example.data.remote.BackendResult.Success) {
                val array = recResult.data
                val cloudIds = mutableSetOf<String>()
                for (i in 0 until array.length()) {
                    val obj = array.getJSONObject(i)
                    val recId = obj.optString("id", java.util.UUID.randomUUID().toString())
                    if (recId.isNotBlank()) cloudIds.add(recId)
                    val existingRec = db.classRecordingDao().getRecordingById(recId)
                    // Do not overwrite a local recording that still has unsynced changes
                    if (existingRec != null && existingRec.syncStatus != "SYNCED") continue

                    // Parse deterministically so an unchanged row is never re-inserted
                    val dateMillis = parseJsonDateMillis(obj, "created_at", existingRec?.dateMillis ?: System.currentTimeMillis())
                    val rec = ClassRecordingEntity(
                        id = recId,
                        title = obj.optString("title", "Lecture Recording"),
                        subject = obj.optString("subject", "General"),
                        durationSeconds = obj.optInt("duration_seconds", 0),
                        audioUrl = obj.optString("audio_url", ""),
                        transcript = obj.optString("transcript", ""),
                        summary = obj.optString("summary", ""),
                        processingStatus = obj.optString("processing_status", "completed"),
                        dateMillis = dateMillis,
                        localFilePath = existingRec?.localFilePath,
                        syncStatus = "SYNCED"
                    )

                    // Skip re-inserting if nothing changed (prevents Room invalidation & UI flickering)
                    if (existingRec != null &&
                        existingRec.title == rec.title &&
                        existingRec.subject == rec.subject &&
                        existingRec.durationSeconds == rec.durationSeconds &&
                        existingRec.audioUrl == rec.audioUrl &&
                        existingRec.transcript == rec.transcript &&
                        existingRec.summary == rec.summary &&
                        existingRec.processingStatus == rec.processingStatus &&
                        existingRec.dateMillis == rec.dateMillis &&
                        existingRec.syncStatus == "SYNCED") {
                        continue
                    }

                    db.classRecordingDao().insertRecording(rec)
                }

                // Prune local recordings that were deleted in Supabase
                val localRecs = db.classRecordingDao().getAllRecordingsDirect()
                for (rec in localRecs) {
                    if (rec.syncStatus == "SYNCED" && rec.id !in cloudIds) {
                        android.util.Log.d("StuddyHubRepository", "Pruning deleted cloud recording: ${rec.id}")
                        db.classRecordingDao().deleteRecording(rec.id)
                    }
                }
            }
        } catch (e: CancellationException) { throw e } catch (e: Exception) {
            android.util.Log.e("StuddyHubRepository", "Error syncing class recordings: ${e.message}")
        }

        try {
            // 7. Fetch Cloud AI Podcasts & Reconcile Deletions
            val podResult = com.example.data.remote.BackendApiService.getAIPodcasts(userId)
            if (podResult is com.example.data.remote.BackendResult.Success) {
                val array = podResult.data
                val cloudIds = mutableSetOf<String>()
                for (i in 0 until array.length()) {
                    val obj = array.getJSONObject(i)
                    val podId = obj.optString("id", java.util.UUID.randomUUID().toString())
                    if (podId.isNotBlank()) cloudIds.add(podId)
                    val existingPod = db.aiPodcastDao().getPodcastById(podId)
                    // Do not overwrite a local podcast that still has unsynced changes
                    if (existingPod != null && existingPod.syncStatus != "SYNCED") continue

                    // Parse deterministically so an unchanged row is never re-inserted
                    val podCreatedAt = parseJsonDateMillis(obj, "created_at", existingPod?.createdAt ?: System.currentTimeMillis())
                    val pod = AIPodcastEntity(
                        id = podId,
                        title = obj.optString("title", "AI Podcast Episode"),
                        script = obj.optString("script", ""),
                        durationMinutes = obj.optInt("duration_minutes", 10),
                        style = obj.optString("style", "conversational"),
                        status = obj.optString("status", "completed"),
                        createdAt = podCreatedAt,
                        localFilePath = existingPod?.localFilePath,
                        coverImageUrl = existingPod?.coverImageUrl ?: "",
                        listenCount = existingPod?.listenCount ?: 0,
                        syncStatus = "SYNCED"
                    )

                    // Skip re-inserting if nothing changed (prevents Room invalidation & UI flickering)
                    if (existingPod != null &&
                        existingPod.title == pod.title &&
                        existingPod.script == pod.script &&
                        existingPod.durationMinutes == pod.durationMinutes &&
                        existingPod.style == pod.style &&
                        existingPod.status == pod.status &&
                        existingPod.createdAt == pod.createdAt &&
                        existingPod.syncStatus == "SYNCED") {
                        continue
                    }

                    db.aiPodcastDao().insertPodcast(pod)
                }

                // Prune local podcasts that were deleted in Supabase
                val localPods = db.aiPodcastDao().getAllPodcastsDirect()
                for (pod in localPods) {
                    if (pod.syncStatus == "SYNCED" && pod.id !in cloudIds) {
                        android.util.Log.d("StuddyHubRepository", "Pruning deleted cloud podcast: ${pod.id}")
                        db.aiPodcastDao().deletePodcast(pod.id)
                    }
                }
            }
        } catch (e: CancellationException) { throw e } catch (e: Exception) {
            android.util.Log.e("StuddyHubRepository", "Error syncing AI podcasts: ${e.message}")
        }

        try {
            // 8. Fetch Cloud Quizzes & Quiz Attempts & Reconcile Deletions
            val quizzesResult = com.example.data.remote.BackendApiService.getQuizzes(userId)
            if (quizzesResult is com.example.data.remote.BackendResult.Success) {
                isSystemOffline.value = false
                val array = quizzesResult.data
                val cloudQuizIds = mutableSetOf<String>()
                for (i in 0 until array.length()) {
                    val obj = array.getJSONObject(i)
                    val quizId = obj.optString("id", "")
                    if (quizId.isNotBlank()) cloudQuizIds.add(quizId)
                    applyQuizChange("INSERT", obj)
                }

                // Prune local quizzes that were deleted in Supabase
                val localQuizzes = db.quizDao().getAllQuizzesDirect()
                for (quiz in localQuizzes) {
                    if (quiz.syncStatus == "SYNCED" && quiz.id !in cloudQuizIds) {
                        android.util.Log.d("StuddyHubRepository", "Pruning deleted cloud quiz: ${quiz.id}")
                        db.quizDao().deleteAttemptsForQuiz(quiz.id)
                        db.quizDao().deleteQuiz(quiz.id)
                    }
                }
            }
            val attemptsResult = com.example.data.remote.BackendApiService.getQuizAttempts(userId)
            if (attemptsResult is com.example.data.remote.BackendResult.Success) {
                val array = attemptsResult.data
                val cloudAttemptIds = mutableSetOf<String>()
                for (i in 0 until array.length()) {
                    val obj = array.getJSONObject(i)
                    val attemptId = obj.optString("id", "")
                    if (attemptId.isNotBlank()) cloudAttemptIds.add(attemptId)
                    applyQuizAttemptChange("INSERT", obj)
                }

                // Prune local quiz attempts that were deleted in Supabase
                val localAttempts = db.quizDao().getAllAttemptsDirect()
                for (attempt in localAttempts) {
                    if (attempt.syncStatus == "SYNCED" && attempt.id !in cloudAttemptIds) {
                        android.util.Log.d("StuddyHubRepository", "Pruning deleted cloud quiz attempt: ${attempt.id}")
                        db.quizDao().deleteAttempt(attempt.id)
                    }
                }
            }
        } catch (e: CancellationException) { throw e } catch (e: Exception) {
            android.util.Log.e("StuddyHubRepository", "Error syncing quizzes: ${e.message}")
        }

        try {
            // 9. Fetch Cloud Schedule Items & Reconcile Deletions
            val scheduleResult = com.example.data.remote.BackendApiService.getScheduleItems(userId)
            if (scheduleResult is com.example.data.remote.BackendResult.Success) {
                isSystemOffline.value = false
                val array = scheduleResult.data
                val cloudIds = mutableSetOf<String>()
                for (i in 0 until array.length()) {
                    val obj = array.getJSONObject(i)
                    val itemId = obj.optString("id", "")
                    if (itemId.isNotBlank()) cloudIds.add(itemId)
                    applyScheduleChange("INSERT", obj)
                }

                // Prune local schedule items that were deleted in Supabase
                val localSchedule = db.scheduleDao().getAllScheduleItemsDirect()
                for (item in localSchedule) {
                    if (item.syncStatus == "SYNCED" && item.id !in cloudIds) {
                        android.util.Log.d("StuddyHubRepository", "Pruning deleted cloud schedule item: ${item.id}")
                        db.scheduleDao().deleteScheduleItem(item.id)
                    }
                }
            }
        } catch (e: CancellationException) { throw e } catch (e: Exception) {
            android.util.Log.e("StuddyHubRepository", "Error syncing schedule items: ${e.message}")
        }
    }

    suspend fun syncLocalDataToCloud() {
        val userId = getOrRestoreActiveUserId()
        if (userId.isBlank() || userId == "guest-scholar-uuid") return

        // 1. Sync unsynced Notes
        try {
            val unsyncedNotes = db.noteDao().getUnsyncedNotes()
            unsyncedNotes.forEach { note ->
                // Ensure there is a pending queue item
                db.syncQueueDao().insertOrUpdate(
                    SyncQueueItemEntity(
                        entityType = "note",
                        entityId = note.id,
                        operationType = "CREATE"
                    )
                )
            }
        } catch (e: Exception) {
            android.util.Log.e("StuddyHubRepository", "Error scanning unsynced notes: ${e.message}")
        }

        // 2. Sync unsynced Documents
        try {
            val unsyncedDocs = db.documentDao().getUnsyncedDocuments()
            unsyncedDocs.forEach { doc ->
                db.syncQueueDao().insertOrUpdate(
                    SyncQueueItemEntity(
                        entityType = "document",
                        entityId = doc.id,
                        operationType = "CREATE"
                    )
                )
            }
        } catch (e: Exception) {
            android.util.Log.e("StuddyHubRepository", "Error scanning unsynced documents: ${e.message}")
        }

        // 3. Sync unsynced Class Recordings
        try {
            val unsyncedRecs = db.classRecordingDao().getUnsyncedRecordings()
            unsyncedRecs.forEach { rec ->
                db.syncQueueDao().insertOrUpdate(
                    SyncQueueItemEntity(
                        entityType = "recording",
                        entityId = rec.id,
                        operationType = "CREATE"
                    )
                )
            }
        } catch (e: Exception) {
            android.util.Log.e("StuddyHubRepository", "Error scanning unsynced recordings: ${e.message}")
        }

        // 4. Sync unsynced Flashcards
        try {
            val unsyncedCards = db.flashcardDao().getUnsyncedFlashcards()
            unsyncedCards.forEach { card ->
                db.syncQueueDao().insertOrUpdate(
                    SyncQueueItemEntity(
                        entityType = "flashcard",
                        entityId = card.id,
                        operationType = "CREATE"
                    )
                )
            }
        } catch (e: Exception) {
            android.util.Log.e("StuddyHubRepository", "Error scanning unsynced flashcards: ${e.message}")
        }

        // 5. Sync unsynced AI Podcasts
        try {
            val unsyncedPods = db.aiPodcastDao().getUnsyncedPodcasts()
            unsyncedPods.forEach { pod ->
                db.syncQueueDao().insertOrUpdate(
                    SyncQueueItemEntity(
                        entityType = "podcast",
                        entityId = pod.id,
                        operationType = "CREATE"
                    )
                )
            }
        } catch (e: Exception) {
            android.util.Log.e("StuddyHubRepository", "Error scanning unsynced podcasts: ${e.message}")
        }

        // 6. Sync unsynced Social Posts
        try {
            val unsyncedPosts = db.socialPostDao().getUnsyncedPosts()
            unsyncedPosts.forEach { post ->
                db.syncQueueDao().insertOrUpdate(
                    SyncQueueItemEntity(
                        entityType = "social_post",
                        entityId = post.id,
                        operationType = "CREATE"
                    )
                )
            }
        } catch (e: Exception) {
            android.util.Log.e("StuddyHubRepository", "Error scanning unsynced social posts: ${e.message}")
        }

        // 7. Sync unsynced Quizzes
        try {
            val unsyncedQuizzes = db.quizDao().getUnsyncedQuizzes()
            unsyncedQuizzes.forEach { quiz ->
                db.syncQueueDao().insertOrUpdate(
                    SyncQueueItemEntity(
                        entityType = "quiz",
                        entityId = quiz.id,
                        operationType = "CREATE"
                    )
                )
            }
        } catch (e: Exception) {
            android.util.Log.e("StuddyHubRepository", "Error scanning unsynced quizzes: ${e.message}")
        }

        // 8. Sync unsynced Quiz Attempts
        try {
            val unsyncedAttempts = db.quizDao().getUnsyncedAttempts()
            unsyncedAttempts.forEach { attempt ->
                db.syncQueueDao().insertOrUpdate(
                    SyncQueueItemEntity(
                        entityType = "quiz_attempt",
                        entityId = attempt.id,
                        operationType = "CREATE"
                    )
                )
            }
        } catch (e: Exception) {
            android.util.Log.e("StuddyHubRepository", "Error scanning unsynced quiz attempts: ${e.message}")
        }

        // 9. Sync unsynced Chat Sessions
        try {
            val unsyncedSessions = db.chatDao().getUnsyncedSessions()
            unsyncedSessions.forEach { session ->
                db.syncQueueDao().insertOrUpdate(
                    SyncQueueItemEntity(
                        entityType = "chat_session",
                        entityId = session.id,
                        operationType = "CREATE"
                    )
                )
            }
        } catch (e: Exception) {
            android.util.Log.e("StuddyHubRepository", "Error scanning unsynced chat sessions: ${e.message}")
        }

        // 10. Sync unsynced Courses
        try {
            val unsyncedCourses = db.courseDao().getUnsyncedCourses()
            unsyncedCourses.forEach { course ->
                db.syncQueueDao().insertOrUpdate(
                    SyncQueueItemEntity(
                        entityType = "course",
                        entityId = course.id,
                        operationType = "CREATE"
                    )
                )
            }
        } catch (e: Exception) {
            android.util.Log.e("StuddyHubRepository", "Error scanning unsynced courses: ${e.message}")
        }

        // 11. Sync unsynced Schedule Items
        try {
            val unsyncedSchedules = db.scheduleDao().getUnsyncedScheduleItems()
            unsyncedSchedules.forEach { item ->
                db.syncQueueDao().insertOrUpdate(
                    SyncQueueItemEntity(
                        entityType = "schedule",
                        entityId = item.id,
                        operationType = "CREATE"
                    )
                )
            }
        } catch (e: Exception) {
            android.util.Log.e("StuddyHubRepository", "Error scanning unsynced schedule items: ${e.message}")
        }

        // Trigger SyncManager
        StuddyHubDatabase.appContext?.let { ctx ->
            com.example.data.local.SyncManager.getInstance(ctx, db).triggerSync()
        }
    }

    suspend fun redeemPromoCode(promoCode: String): com.example.data.remote.BackendResult<org.json.JSONObject> {
        return com.example.data.remote.BackendApiService.applyPromoCode(promoCode)
    }

    private fun parseTimestampToMillis(timeStr: String?): Long {
        return parseTimestampToMillisOrNull(timeStr) ?: System.currentTimeMillis()
    }

    /** Parses an epoch-millis number or ISO-8601/RFC timestamp; returns null when unparseable. */
    private fun parseTimestampToMillisOrNull(timeStr: String?): Long? {
        if (timeStr.isNullOrBlank()) return null
        timeStr.toLongOrNull()?.let { return it }

        val s = timeStr.trim()

        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            try {
                val normIso = s.replace(" ", "T")
                val isoWithOffset = if (!normIso.contains("Z") && !normIso.contains("+") && normIso.indexOf('-', 10) == -1) {
                    "${normIso}Z"
                } else {
                    normIso
                }
                return java.time.OffsetDateTime.parse(isoWithOffset).toInstant().toEpochMilli()
            } catch (_: Exception) {}
            try {
                return java.time.Instant.parse(s).toEpochMilli()
            } catch (_: Exception) {}
        }

        val clean = s.replace("T", " ")
            .replace("Z", "+0000")
            .let { str ->
                if (str.endsWith("+00") || str.endsWith("-00")) str + "00"
                else if (str.contains("+00:00")) str.replace("+00:00", "+0000")
                else if (str.contains("-00:00")) str.replace("-00:00", "-0000")
                else str
            }

        val patterns = arrayOf(
            "yyyy-MM-dd HH:mm:ss.SSSSSSZ",
            "yyyy-MM-dd HH:mm:ss.SSSZ",
            "yyyy-MM-dd HH:mm:ssZ",
            "yyyy-MM-dd HH:mm:ss.SSSSSS",
            "yyyy-MM-dd HH:mm:ss.SSS",
            "yyyy-MM-dd HH:mm:ss",
            "yyyy-MM-dd"
        )

        for (pattern in patterns) {
            try {
                val sdf = java.text.SimpleDateFormat(pattern, java.util.Locale.US).apply {
                    timeZone = java.util.TimeZone.getTimeZone("UTC")
                }
                val date = sdf.parse(clean)
                if (date != null) return date.time
            } catch (_: Exception) {}
        }

        return null
    }

    /**
     * Fetch tier-scoped leaderboard ranking merging cloud data with active local profile.
     */
    suspend fun fetchTierLeaderboard(tierKey: String): com.example.ui.components.LeaderboardResult {
        val activeProfile = db.profileDao().getProfileDirect()
        val currentUserId = activeProfile?.id ?: ""
        val currentTier = activeProfile?.academicTier?.ifBlank { "explorer" } ?: "explorer"
        val activeStats = db.userStatsDao().getUserStatsDirect(currentUserId) ?: db.userStatsDao().getUserStatsDirect(getOrRestoreActiveUserId())
        val userLifetimeXp = maxOf(activeStats?.totalXp ?: 0, activeProfile?.pointsBalance ?: 0)

        val cloudResult = com.example.data.remote.BackendApiService.getLeaderboardProfiles(tierKey)
        val isOffline = cloudResult !is com.example.data.remote.BackendResult.Success<*>
        val list = mutableListOf<com.example.ui.components.LeaderboardUser>()

        if (cloudResult is com.example.data.remote.BackendResult.Success<org.json.JSONArray>) {
            val arr = cloudResult.data
            for (i in 0 until arr.length()) {
                val obj = arr.optJSONObject(i) ?: continue
                val id = obj.optString("id")
                val name = obj.optString("full_name").ifBlank { "Scholar" }
                val school = obj.optString("school")
                // Prefer user_stats.total_xp (joined), fall back to points_balance
                val userStatsObj = obj.optJSONObject("user_stats")
                val points = userStatsObj?.optInt("total_xp", 0)?.takeIf { it > 0 }
                    ?: obj.optInt("total_xp", obj.optInt("points_balance", 0))
                val avatar = obj.optString("avatar_url", "").takeIf { it.isNotBlank() && it != "null" }
                val tier = obj.optString("academic_tier", tierKey)

                list.add(
                    com.example.ui.components.LeaderboardUser(
                        rank = i + 1,
                        userId = id,
                        name = name,
                        avatarUrl = avatar,
                        totalXp = points,
                        school = school,
                        academicTier = tier,
                        isCurrentUser = id == currentUserId
                    )
                )
            }
        }

        // If active profile matches this tier, ensure their entry is present with their lifetime XP
        if (activeProfile != null && (tierKey.equals("all", ignoreCase = true) || currentTier.equals(tierKey, ignoreCase = true))) {
            val existingIndex = list.indexOfFirst { it.userId == currentUserId || it.isCurrentUser }
            val currentUserItem = com.example.ui.components.LeaderboardUser(
                rank = 1,
                userId = activeProfile.id,
                name = activeProfile.fullName.ifBlank { "You" },
                avatarUrl = activeProfile.avatarUrl.takeIf { it.isNotBlank() && it != "null" },
                totalXp = userLifetimeXp,
                school = activeProfile.school.ifBlank { "" },
                academicTier = currentTier,
                isCurrentUser = true
            )
            if (existingIndex >= 0) {
                list[existingIndex] = currentUserItem
            } else {
                list.add(currentUserItem)
            }
        }

        val sortedList = list.sortedByDescending { it.totalXp }.mapIndexed { index, user ->
            user.copy(rank = index + 1)
        }
        return com.example.ui.components.LeaderboardResult(sortedList, isOffline)
    }

    /**
     * Fetch class-scoped leaderboard ranking for Explorers.
     */
    suspend fun fetchClassLeaderboard(school: String, academicLevel: String): com.example.ui.components.LeaderboardResult {
        val activeProfile = db.profileDao().getProfileDirect()
        val currentUserId = activeProfile?.id ?: ""
        val activeStats = db.userStatsDao().getUserStatsDirect(currentUserId) ?: db.userStatsDao().getUserStatsDirect(getOrRestoreActiveUserId())
        val userLifetimeXp = maxOf(activeStats?.totalXp ?: 0, activeProfile?.pointsBalance ?: 0)
        val effectiveSchool = school.ifBlank { activeProfile?.school.orEmpty() }

        if (effectiveSchool.isBlank()) {
            return com.example.ui.components.LeaderboardResult(
                users = emptyList(),
                isOffline = false,
                hasNoSchool = true
            )
        }

        val cloudResult = com.example.data.remote.BackendApiService.getClassLeaderboardProfiles(school, academicLevel)
        val isOffline = cloudResult !is com.example.data.remote.BackendResult.Success<*>
        val list = mutableListOf<com.example.ui.components.LeaderboardUser>()

        if (cloudResult is com.example.data.remote.BackendResult.Success<org.json.JSONArray>) {
            val arr = cloudResult.data
            for (i in 0 until arr.length()) {
                val obj = arr.optJSONObject(i) ?: continue
                val id = obj.optString("id")
                val name = obj.optString("full_name").ifBlank { "Classmate" }
                val sName = obj.optString("school", effectiveSchool)
                // Prefer user_stats.total_xp (joined), fall back to points_balance
                val userStatsObj = obj.optJSONObject("user_stats")
                val points = userStatsObj?.optInt("total_xp", 0)?.takeIf { it > 0 }
                    ?: obj.optInt("total_xp", obj.optInt("points_balance", 0))
                val avatar = obj.optString("avatar_url", "").takeIf { it.isNotBlank() && it != "null" }
                val tier = obj.optString("academic_tier", "explorer")

                list.add(
                    com.example.ui.components.LeaderboardUser(
                        rank = i + 1,
                        userId = id,
                        name = name,
                        avatarUrl = avatar,
                        totalXp = points,
                        school = sName,
                        academicTier = tier,
                        isCurrentUser = id == currentUserId
                    )
                )
            }
        }

        // If active profile exists, ensure the current user entry is present
        if (activeProfile != null) {
            val existingIndex = list.indexOfFirst { it.userId == currentUserId || it.isCurrentUser }
            val currentUserItem = com.example.ui.components.LeaderboardUser(
                rank = 1,
                userId = activeProfile.id,
                name = activeProfile.fullName.ifBlank { "You" },
                avatarUrl = activeProfile.avatarUrl.takeIf { it.isNotBlank() && it != "null" },
                totalXp = userLifetimeXp,
                school = effectiveSchool,
                academicTier = "explorer",
                isCurrentUser = true
            )
            if (existingIndex >= 0) {
                list[existingIndex] = currentUserItem
            } else {
                list.add(currentUserItem)
            }
        }

        val sortedList = list.sortedByDescending { it.totalXp }.mapIndexed { index, user ->
            user.copy(rank = index + 1)
        }
        return com.example.ui.components.LeaderboardResult(sortedList, isOffline)
    }

    /** Record a peer cheer event to the cloud database. */
    suspend fun sendPeerCheer(targetUserId: String, emoji: String = "👏"): com.example.data.remote.BackendResult<Boolean> {
        return com.example.data.remote.BackendApiService.sendPeerCheer(targetUserId, emoji)
    }
}

