package com.example.ui.screens.onboarding

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.data.repository.StuddyHubRepository
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.firstOrNull
import kotlinx.coroutines.launch
import java.util.UUID
import org.json.JSONObject

data class OnboardingMessage(
    val id: String = UUID.randomUUID().toString(),
    val sender: String, // "ollie" or "user"
    val content: String
)

data class OnboardingState(
    val messages: List<OnboardingMessage> = emptyList(),
    val selectedTier: String = "",
    val selectedMajor: String = "",
    val selectedGrade: String = "",
    val selectedGoalHours: String = "",
    val selectedStyle: String = "",
    val selectedSchool: String = "",
    val currentStep: Int = 0, // 0: Chat Active, 3: Chat Finished (Ready for Tour), 4: Tour 1, 5: Tour 2, 6: Tour 3 (Summary)
    val isOllieTyping: Boolean = false,
    val suggestedOptions: List<String> = emptyList(),
    // True once the learner's tier (Explorer / Achiever / Scholar) has been chosen. The tier is
    // asked FIRST so every later question matches the right academic stage — a kid should never
    // be asked for a university major, and a scholar should never be asked for a favourite subject.
    val tierChosen: Boolean = false,
    val isCompleted: Boolean = false,
    // True while the workspace is being built after onboarding (profile save, education setup,
    // live roadmap generation). Drives the tier-themed "setting up" loader overlay.
    val isSettingUpWorkspace: Boolean = false,
    val setupLoaderMessage: String = "Setting up your workspace…",
    val userName: String = "",
    val useManualForm: Boolean = false,
    val isOfflineMode: Boolean = false,
    val isSyncPending: Boolean = false,
    val showOfflineSyncNotification: Boolean = false,
    val syncErrorMessage: String? = null,
    val isCreatingStarterDeck: Boolean = false,
    val starterDeckCreated: Boolean = false,
    // Explorer (kids) education setup — options are loaded from the cloud education
    // schema (countries → education_levels → curricula → subjects) with offline fallbacks.
    val educationCountries: List<com.example.data.local.EducationCountry> = emptyList(),
    val educationLevels: List<com.example.data.local.EducationLevelRef> = emptyList(),
    val isEducationLoading: Boolean = false,
    val kidSetupComplete: Boolean = false
)

enum class OnboardingField {
    FULL_NAME,
    SCHOOL,
    MAJOR,
    STUDY_GOAL,
    LEARNING_STYLE
}

data class OnboardingQuestion(
    val field: OnboardingField,
    val text: String,
    val suggestions: List<String>,
    val allowSkip: Boolean = true
)

class OnboardingViewModel(private val repository: StuddyHubRepository) : ViewModel() {

    private val _uiState = MutableStateFlow(OnboardingState())
    val uiState: StateFlow<OnboardingState> = _uiState.asStateFlow()

    init {
        loadUserAndStartChat()
    }

    private fun loadUserAndStartChat() {
        viewModelScope.launch {
            val profile = repository.getProfileDirect()
            val name = profile?.fullName?.ifBlank { "" } ?: ""
            val hasRealName = name.isNotBlank() && name != "New Scholar" && name != "Guest Scholar" && name != "Alex Rivera"
            val profileName = if (hasRealName) name else ""
            val profileSchool = profile?.school?.takeIf { it.isNotBlank() && it != "Stanford" && it != "Stanford • CS Major" && it != "Stanford University" && it != "University" && it != "Global University Network" } ?: ""
            val profileStyle = profile?.learningStyle?.takeIf { it.isNotBlank() && it != "visual" } ?: ""
            val onboardingDone = profile?.onboardingCompleted == true && !profile.academicTier.isNullOrBlank()
            val profileTier = if (onboardingDone) (profile?.academicTier ?: "") else ""

            _uiState.value = _uiState.value.copy(
                userName = profileName,
                selectedSchool = profileSchool,
                selectedStyle = profileStyle,
                selectedTier = profileTier,
                tierChosen = onboardingDone && profileTier.isNotBlank(),
                isOllieTyping = false
            )

            if (onboardingDone) {
                // Returning user — pick up where they left off (fields are already populated,
                // so Ollie summarises and wraps up quickly).
                getAiResponse(null)
            } else {
                // TIER-FIRST: a fresh learner answers "who is learning today?" before any profile
                // questions, so a kid never gets asked for a university major (and vice versa).
                val messages = mutableListOf(
                    OnboardingMessage(
                        sender = "ollie",
                        content = "Whoo-t! Welcome to StuddyHub! 🦉 First, who is learning today? Pick your learning stage and I'll set up your workspace just right."
                    )
                )
                _uiState.value = _uiState.value.copy(
                    messages = messages,
                    suggestedOptions = listOf(
                        "Explorer 🎒 (Basic / JHS)",
                        "Achiever ⚡ (SHS / WASSCE)",
                        "Scholar 🎓 (University)"
                    ),
                    isOllieTyping = false,
                    tierChosen = false
                )
            }
        }
    }

    /** The learner picked their stage — remember it, then start the tier-appropriate chat. */
    fun submitTierSelection(tierKey: String) {
        val normalized = when {
            tierKey.lowercase().contains("explorer") -> "explorer"
            tierKey.lowercase().contains("scholar") -> "scholar"
            else -> "achiever"
        }
        val tierLabelText = when (normalized) {
            "explorer" -> "Explorer 🎒 (Basic / JHS)"
            "scholar" -> "Scholar 🎓 (University)"
            else -> "Achiever ⚡ (SHS / WASSCE)"
        }
        val current = _uiState.value
        if (current.tierChosen && current.selectedTier == normalized) return

        val messages = current.messages.toMutableList()
        messages.add(OnboardingMessage(sender = "user", content = tierLabelText))
        messages.add(
            OnboardingMessage(
                sender = "ollie",
                content = "Whoo-t! $tierLabelText it is! I'll shape everything — questions, lessons and goals — around your stage. Let's get your workspace ready."
            )
        )
        _uiState.value = current.copy(
            selectedTier = normalized,
            tierChosen = true,
            messages = messages,
            suggestedOptions = emptyList(),
            isOllieTyping = true
        )
        viewModelScope.launch {
            repository.updateProfile(academicTier = normalized)
            // The next question is tier-appropriate (Explorer → favourite subject, Scholar → major).
            getAiResponse(null)
        }
    }

    private suspend fun getAiResponse(userMessage: String?) {
        val currentState = _uiState.value
        val name = currentState.userName
        val school = currentState.selectedSchool
        val major = currentState.selectedMajor
        val goal = currentState.selectedGoalHours
        val style = currentState.selectedStyle
        val isExplorer = currentState.selectedTier == "explorer"

        // Build prompt with explicit current profile fields. Explorer (kids) mode swaps the
        // university-style "major" question for a favorite-subject question and uses minutes.
        val majorLabel = if (isExplorer) "favoriteSubject" else "major"
        val majorQuestion = if (isExplorer)
            "favoriteSubject: The subject they love most at school (e.g., Maths, English, Science, Social Studies, Games/Riddles, or \"All of them!\")."
        else
            "major: Their primary field of study or major."
        val goalQuestion = if (isExplorer)
            "studyGoal: How many minutes they want to learn each day (e.g., 15 mins, 30 mins, 1 hour). Keep it simple and child-friendly."
        else
            "studyGoal: Their daily study time goal (e.g., 30 mins, 1 hour, 2 hours, etc.)."
        // Explorer school/class setup happens in the dedicated "My School Setup" step AFTER the
        // chat — so Ollie must NOT ask for the school in the chat (it would duplicate the sheet
        // and feel disconnected).
        val schoolQuestion = if (isExplorer)
            "2. school: DO NOT ask about school in this chat. The kid's school, class and subjects are collected in a separate \"My School Setup\" step right after this conversation. Leave school blank (\"\"). If the user volunteers their school name, you may store it."
        else
            "2. school: The school they attend (or \"Independent\" / \"Homeschool\")."
        val finishInstruction = if (isExplorer)
            "Once isFinished is true, write a warm concluding message that says the workspace is almost ready and that the next step is picking their school, class and subjects (\"Set Up My School\")."
        else
            "Once isFinished is true, write a warm concluding welcome message in \"message\"."

        val systemInstruction = """
            You are Professor Ollie, a friendly, warm academic owl guide helping a student customize their study workspace in StuddyHub.
            Your goal is to have an encouraging, warm, conversational interaction with the student to gather or confirm these profile details:
            1. fullName: The student's real name. (Greet them by their name if you know it, otherwise ask naturally).
            $schoolQuestion
            3. $majorQuestion
            4. $goalQuestion
            5. learningStyle: How they learn best (must be exactly one of: Visual & Diagrams, Auditory & Podcasts, Interactive Quizzes, or Text Summaries).
            ${if (isExplorer) "\nYou are talking to a young learner (Basic School / JHS). Keep every message short, warm and playful — no long paragraphs, use simple words, and praise their answers." else ""}

            Guidelines:
            - Act as Professor Ollie: say "Whoo-t!" or make gentle, friendly owl references occasionally.
            - Check the current profile state. If a field is already set (not blank), do not ask for it again.
            - Ask for only ONE missing detail at a time to keep the conversation natural and welcoming.
            - If the user skips or indicates they don't want to provide a specific detail, respect their choice, set that field to "Skipped" or leave it blank, and move on to the next.
            - Always respond in the following JSON format:
            {
              "message": "Your conversational reply to the user. Greet them, comment on their answer, and ask the next natural question (or summarize and conclude if finished). Keep it warm, elegant, and concise.",
              "fullName": "The extracted full name so far, or blank if unknown.",
              "school": "The extracted school name so far, or blank if unknown.",
              "major": "The extracted ${majorLabel} so far, or blank if unknown.",
              "studyGoal": "The extracted daily study goal so far, or blank if unknown.",
              "learningStyle": "The extracted learning style so far (Visual & Diagrams, Auditory & Podcasts, Interactive Quizzes, or Text Summaries), or blank if unknown.",
              "suggestions": ["Option A", "Option B", "Skip ➡️"],
              "isFinished": false // Set to true ONLY when you have successfully collected or skipped all ${if (isExplorer) "applicable" else "5"} fields and you are ready to wrap up. $finishInstruction
            }
            Do not include any markdown styling like ```json or anything. Just return raw JSON.
        """.trimIndent()

        val promptBuilder = StringBuilder()
        promptBuilder.append("Current Profile State:\n")
        promptBuilder.append("- Full Name: $name\n")
        promptBuilder.append("- School: $school\n")
        promptBuilder.append("- Major: $major\n")
        promptBuilder.append("- Study Goal: $goal\n")
        promptBuilder.append("- Learning Style: $style\n\n")

        promptBuilder.append("Conversation History:\n")
        currentState.messages.takeLast(12).forEach { msg ->
            val roleName = if (msg.sender == "ollie") "Professor Ollie" else "Student"
            promptBuilder.append("$roleName: ${msg.content}\n")
        }
        if (userMessage != null) {
            promptBuilder.append("Student: $userMessage\n")
        }
        promptBuilder.append("\nGenerate the JSON response as specified.")

        val prompt = promptBuilder.toString()

        var success = false
        try {
            val onboardingResult = com.example.data.remote.BackendApiService.onboardingChat(prompt, systemInstruction)
            val responseText = when (onboardingResult) {
                is com.example.data.remote.BackendResult.Success -> onboardingResult.data
                is com.example.data.remote.BackendResult.Error -> throw Exception(onboardingResult.message)
            }
            val cleaned = responseText.trim().removeSurrounding("```json", "```").trim()
            if (cleaned.startsWith("{") && cleaned.endsWith("}")) {
                val jsonObject = JSONObject(cleaned)
                val ollieMsg = jsonObject.optString("message", "")
                val extractedName = jsonObject.optString("fullName", "")
                val extractedSchool = jsonObject.optString("school", "")
                val extractedMajor = jsonObject.optString("major", "")
                val extractedGoal = jsonObject.optString("studyGoal", "")
                val extractedStyle = jsonObject.optString("learningStyle", "")
                val isFinished = jsonObject.optBoolean("isFinished", false)

                val jsonSuggestions = jsonObject.optJSONArray("suggestions")
                val suggestionsList = mutableListOf<String>()
                if (jsonSuggestions != null) {
                    for (i in 0 until jsonSuggestions.length()) {
                        suggestionsList.add(jsonSuggestions.getString(i))
                    }
                }

                val updatedMessages = currentState.messages.toMutableList()
                updatedMessages.add(OnboardingMessage(sender = "ollie", content = ollieMsg))

                _uiState.value = _uiState.value.copy(
                    userName = extractedName.takeIf { it.isNotBlank() } ?: currentState.userName,
                    selectedSchool = extractedSchool.takeIf { it.isNotBlank() } ?: currentState.selectedSchool,
                    selectedMajor = extractedMajor.takeIf { it.isNotBlank() } ?: currentState.selectedMajor,
                    selectedGoalHours = extractedGoal.takeIf { it.isNotBlank() } ?: currentState.selectedGoalHours,
                    selectedStyle = extractedStyle.takeIf { it.isNotBlank() } ?: currentState.selectedStyle,
                    messages = updatedMessages,
                    suggestedOptions = suggestionsList,
                    currentStep = if (isFinished) 3 else 0,
                    isOllieTyping = false
                )
                success = true
            }
        } catch (e: Exception) {
            android.util.Log.d("OnboardingViewModel", "AI response offline/fallback engaged: ${e.message}")
        }

        if (!success) {
            // Local fallback rule-based execution with quick natural feel
            delay(150L)
            runLocalFallback(userMessage)
        }
    }

    private fun runLocalFallback(userMessage: String?) {
        val currentState = _uiState.value
        val isExplorer = currentState.selectedTier == "explorer"
        val updatedMessages = currentState.messages.toMutableList()

        // Determine which field to ask next based on what is empty. Explorer mode skips the
        // school question entirely (handled by the "My School Setup" step after the chat) and
        // asks for a favourite subject + study minutes instead of major + study hours.
        val lastMsg = currentState.messages.lastOrNull()?.content ?: ""
        val name = currentState.userName.ifBlank { if (userMessage != null && lastMsg.contains("name", ignoreCase = true)) userMessage else "" }
        val school = currentState.selectedSchool.ifBlank { if (userMessage != null && lastMsg.contains("school", ignoreCase = true)) userMessage else "" }
        val major = currentState.selectedMajor.ifBlank {
            if (userMessage != null && (lastMsg.contains("major", ignoreCase = true) || lastMsg.contains("subject", ignoreCase = true))) userMessage else ""
        }
        val goal = currentState.selectedGoalHours.ifBlank { if (userMessage != null && lastMsg.contains("time", ignoreCase = true)) userMessage else "" }
        val style = currentState.selectedStyle.ifBlank { if (userMessage != null && lastMsg.contains("learn best", ignoreCase = true)) userMessage else "" }

        val updatedName = if (name.contains("Skip", ignoreCase = true)) "" else name
        val updatedSchool = if (school.contains("Skip", ignoreCase = true)) "Independent" else school
        val updatedMajor = if (major.contains("Skip", ignoreCase = true)) "General" else major
        val updatedGoal = if (goal.contains("Skip", ignoreCase = true)) (if (isExplorer) "30 minutes" else "1 hour") else goal
        val updatedStyle = if (style.contains("Skip", ignoreCase = true)) "Visual & Diagrams" else style

        var replyText = ""
        val suggestions = mutableListOf<String>()
        var nextStep = 0

        when {
            updatedName.isBlank() -> {
                replyText = "Whoo-t! Let's get started. First off, what is your full name? Greet me, or type it below!"
                suggestions.addAll(listOf("Guest Scholar", "Skip ➡️"))
            }
            !isExplorer && updatedSchool.isBlank() -> {
                replyText = "Nice to meet you, ${updatedName.substringBefore(" ")}! What school, university, or organization do you study at?"
                suggestions.addAll(listOf("Stanford University", "MIT", "UC Berkeley", "Self-Taught", "Skip ➡️"))
            }
            updatedMajor.isBlank() -> {
                replyText = if (isExplorer)
                    "Awesome! And what subject do you love most at school?"
                else
                    "Got it! And what is your primary field of study or major?"
                suggestions.addAll(
                    if (isExplorer)
                        listOf("Maths", "English", "Science", "Social Studies", "All of them! 🎉")
                    else
                        listOf("Computer Science", "Pre-Med & Bio", "Engineering", "Business", "Skip ➡️")
                )
            }
            updatedGoal.isBlank() -> {
                replyText = if (isExplorer)
                    "Great! How many minutes a day do you want to learn?"
                else
                    "Excellent. What is your daily study goal time?"
                suggestions.addAll(
                    if (isExplorer)
                        listOf("15 minutes", "30 minutes", "1 hour", "Skip ➡️")
                    else
                        listOf("30 min/day", "1 hour/day", "2 hours/day", "Skip ➡️")
                )
            }
            updatedStyle.isBlank() -> {
                replyText = "Almost done! How do you learn best? I'll customize your AI summaries to match your learning style."
                suggestions.addAll(listOf("Visual & Diagrams", "Auditory & Podcasts", "Interactive Quizzes", "Text Summaries"))
            }
            else -> {
                replyText = if (isExplorer)
                    "Whoo-t! I've got your learning style, ${updatedName.substringBefore(" ")}! Next we'll set up your school, class and subjects so I can build the perfect lessons for you."
                else
                    "Whoo-t! I've set up your StuddyHub workspace. Let's take a quick tour so you know where everything lives."
                nextStep = 3
            }
        }

        updatedMessages.add(OnboardingMessage(sender = "ollie", content = replyText))

        _uiState.value = _uiState.value.copy(
            userName = updatedName,
            selectedSchool = updatedSchool,
            selectedMajor = updatedMajor,
            selectedGoalHours = updatedGoal,
            selectedStyle = updatedStyle,
            messages = updatedMessages,
            suggestedOptions = suggestions,
            currentStep = nextStep,
            isOllieTyping = false
        )
    }

    fun submitAnswer(answer: String) {
        val currentState = _uiState.value
        if (currentState.isOllieTyping || currentState.currentStep >= 3) return

        // Tier question comes first — free-text answers are understood ("I am a basic school
        // student" → Explorer) so the learner is never made to re-pick their stage.
        if (!currentState.tierChosen) {
            val matchedTier = detectTierFromText(answer)
            if (matchedTier != null) {
                submitTierSelection(matchedTier)
            } else {
                _uiState.value = currentState.copy(
                    messages = currentState.messages + OnboardingMessage(sender = "user", content = answer),
                    suggestedOptions = listOf(
                        "Explorer 🎒 (Basic / JHS)",
                        "Achiever ⚡ (SHS / WASSCE)",
                        "Scholar 🎓 (University)"
                    ),
                    isOllieTyping = false
                )
            }
            return
        }

        viewModelScope.launch {
            val isExplorer = currentState.selectedTier == "explorer"
            // Local pre-extraction based on Ollie's last question
            val lastOllieMessage = currentState.messages.lastOrNull { it.sender == "ollie" }?.content?.lowercase() ?: ""
            var updatedName = currentState.userName
            var updatedSchool = currentState.selectedSchool
            var updatedMajor = currentState.selectedMajor
            var updatedGoal = currentState.selectedGoalHours
            var updatedStyle = currentState.selectedStyle

            val cleanedAnswer = answer.trim()

            if (lastOllieMessage.contains("name")) {
                if (updatedName.isBlank()) {
                    updatedName = if (cleanedAnswer.lowercase().contains("skip")) "" else cleanedAnswer
                }
            } else if (!isExplorer && (lastOllieMessage.contains("school") || lastOllieMessage.contains("university") || lastOllieMessage.contains("organization") || lastOllieMessage.contains("academy"))) {
                // Explorer mode never asks for school in the chat — the "My School Setup" step handles it.
                if (updatedSchool.isBlank() || updatedSchool == "Independent") {
                    updatedSchool = if (cleanedAnswer.lowercase().contains("skip")) "Independent" else cleanedAnswer
                }
            } else if (lastOllieMessage.contains("major") || lastOllieMessage.contains("field of study") || lastOllieMessage.contains("discipline") || lastOllieMessage.contains("study") || (isExplorer && lastOllieMessage.contains("subject"))) {
                if (updatedMajor.isBlank() || updatedMajor == "General") {
                    updatedMajor = if (cleanedAnswer.lowercase().contains("skip")) "General" else cleanedAnswer
                }
            } else if (lastOllieMessage.contains("goal") || lastOllieMessage.contains("time") || lastOllieMessage.contains("hours") || lastOllieMessage.contains("minutes") || lastOllieMessage.contains("day")) {
                if (updatedGoal.isBlank()) {
                    updatedGoal = if (cleanedAnswer.lowercase().contains("skip")) {
                        if (isExplorer) "30 minutes" else "1 hour/day"
                    } else cleanedAnswer
                }
            } else if (lastOllieMessage.contains("learn") || lastOllieMessage.contains("style") || lastOllieMessage.contains("best")) {
                if (updatedStyle.isBlank()) {
                    updatedStyle = if (cleanedAnswer.lowercase().contains("skip")) "Visual & Diagrams" else cleanedAnswer
                }
            }

            val updatedMessages = currentState.messages.toMutableList()
            updatedMessages.add(OnboardingMessage(sender = "user", content = answer))
            
            _uiState.value = currentState.copy(
                userName = updatedName,
                selectedSchool = updatedSchool,
                selectedMajor = updatedMajor,
                selectedGoalHours = updatedGoal,
                selectedStyle = updatedStyle,
                messages = updatedMessages,
                suggestedOptions = emptyList(),
                isOllieTyping = true
            )

            // Request real or fallback AI response
            getAiResponse(answer)
        }
    }

    fun switchToManualForm() {
        _uiState.value = _uiState.value.copy(
            useManualForm = true,
            isOllieTyping = false
        )
    }

    fun exitManualForm() {
        _uiState.value = _uiState.value.copy(
            useManualForm = false
        )
    }

    fun submitManualForm(
        name: String,
        school: String,
        major: String,
        goal: String,
        style: String,
        grade: String = ""
    ) {
        val currentState = _uiState.value
        val isExplorer = currentState.selectedTier == "explorer"
        val updatedMessages = currentState.messages.toMutableList()
        updatedMessages.add(OnboardingMessage(sender = "user", content = "I completed my customization preferences manually."))
        updatedMessages.add(
            OnboardingMessage(
                sender = "ollie",
                content = if (isExplorer)
                    "Whoo-t! I've saved your details! Next we'll launch your customized workspace."
                else
                    "Whoo-t! I have saved your customized profile details locally. Let's launch your workspace!"
            )
        )

        _uiState.value = currentState.copy(
            userName = name.ifBlank { currentState.userName },
            selectedSchool = school.ifBlank { currentState.selectedSchool },
            selectedMajor = major.ifBlank { currentState.selectedMajor.ifBlank { if (isExplorer) "Maths" else "General Studies" } },
            selectedGrade = grade.ifBlank { currentState.selectedGrade.ifBlank { if (isExplorer) "Primary 4" else "" } },
            selectedGoalHours = goal.ifBlank { currentState.selectedGoalHours.ifBlank { if (isExplorer) "30 min/day" else "1 hour/day" } },
            selectedStyle = style.ifBlank { currentState.selectedStyle.ifBlank { "Visual & Diagrams" } },
            messages = updatedMessages,
            currentStep = 3,
            useManualForm = false
        )
    }

    /**
     * Creates a small starter flashcard deck themed around the user's chosen
     * major, so onboarding ends with a real artifact (not just tour slides).
     * Re-runs are a no-op after the first success.
     */
    fun createStarterDeck() {
        if (_uiState.value.isCreatingStarterDeck || _uiState.value.starterDeckCreated) return
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isCreatingStarterDeck = true)
            val major = _uiState.value.selectedMajor.ifBlank { "General Studies" }
            val cards = listOf(
                Triple(
                    "What is one key concept in $major?",
                    "A core idea you can explain in one clear sentence — write it from your lecture notes.",
                    "Try the 3-2-1 method: 3 facts, 2 examples, 1 question."
                ),
                Triple(
                    "What is an important term or formula in $major?",
                    "Capture the definition in your own words, then verify it against your textbook.",
                    "Explaining it out loud helps it stick."
                ),
                Triple(
                    "What would make a good exam question for this topic?",
                    "Draft a practice question, then check the answer with a study partner or Professor Ollie.",
                    "Turn every mistake into a new card."
                )
            )
            try {
                cards.forEach { (front, back, hint) ->
                    repository.addFlashcard(front, back, category = major, difficulty = "easy", hint = hint)
                }
                _uiState.value = _uiState.value.copy(isCreatingStarterDeck = false, starterDeckCreated = true)
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(isCreatingStarterDeck = false)
            }
        }
    }

    /** Loads the country list for the kid "My School Setup" sheet (Cache-First -> Cloud Refresh). */
    fun loadEducationCountries() {
        viewModelScope.launch {
            // 1. Immediately provide local curriculum countries so UI renders at 0ms latency
            if (_uiState.value.educationCountries.isEmpty()) {
                _uiState.value = _uiState.value.copy(
                    educationCountries = com.example.data.local.KidsCurriculum.FALLBACK_COUNTRIES
                )
            }
            // 2. Fetch fresh active countries from cloud in background without blocking
            val countries = repository.fetchEducationCountries()
            if (countries.isNotEmpty()) {
                _uiState.value = _uiState.value.copy(
                    educationCountries = countries,
                    isEducationLoading = false
                )
            }
        }
    }

    /** Loads education levels (with subjects) for the selected country (Cache-First -> Cloud Refresh). */
    fun loadEducationLevels(countryCode: String) {
        viewModelScope.launch {
            // 1. Immediately provide fallback levels for the country
            val fallback = com.example.data.local.KidsCurriculum.fallbackLevels(countryCode)
            _uiState.value = _uiState.value.copy(
                educationLevels = fallback
            )
            // 2. Fetch cloud framework asynchronously and update seamlessly
            val levels = repository.fetchEducationLevels(countryCode)
            if (levels.isNotEmpty()) {
                _uiState.value = _uiState.value.copy(
                    educationLevels = levels,
                    isEducationLoading = false
                )
            }
        }
    }

    /**
     * Explorer (kids) "My School Setup" — persists the resolved education context
     * (country → level → curriculum → exam → grade → subjects) to Room locally first,
     * then pushes to cloud asynchronously.
     * Note: Does NOT trigger the full-screen loader here to avoid double loader experience;
     * the sheet simply saves instantly, and final workspace setup happens at launch.
     */
    fun saveKidSetup(
        country: com.example.data.local.EducationCountry,
        level: com.example.data.local.EducationLevelRef,
        grade: String,
        subjects: List<com.example.data.local.EducationSubjectRef>
    ) {
        _uiState.value = _uiState.value.copy(
            kidSetupComplete = true
        )
        viewModelScope.launch {
            try {
                // 1. Local Room persistence (instant, survives navigation)
                repository.saveEducationSetup(
                    countryId = country.id,
                    countryCode = country.code,
                    countryName = country.name,
                    educationLevelId = level.levelId,
                    levelName = level.name,
                    levelCategory = level.category,
                    curriculumId = level.curriculumId,
                    curriculumName = level.curriculumName,
                    targetExaminationId = level.examinationId,
                    examName = level.examinationName,
                    institutionName = _uiState.value.selectedSchool,
                    yearOrGrade = grade,
                    subjects = subjects.ifEmpty { level.subjects.filter { it.category == "core" } }
                )
            } catch (e: Exception) {
                android.util.Log.e("OnboardingViewModel", "Kid setup local save failed: ${e.message}")
            }
        }
        // 2. Cloud sync + roadmap generation — fire-and-forget, survives ViewModel cancellation
        kotlinx.coroutines.CoroutineScope(
            kotlinx.coroutines.Dispatchers.IO + kotlinx.coroutines.SupervisorJob()
        ).launch {
            try {
                repository.updateProfile(
                    fullName = _uiState.value.userName.ifBlank { null },
                    school = _uiState.value.selectedSchool.ifBlank { null },
                    academicLevel = if (grade.isNotBlank()) grade else null,
                    academicTier = if (_uiState.value.selectedTier.isNotBlank()) _uiState.value.selectedTier else "explorer"
                )
                repository.bootstrapKidRoadmap()
            } catch (e: Exception) {
                android.util.Log.e("OnboardingViewModel", "Kid setup cloud sync failed: ${e.message}")
            }
        }
    }

    fun startTour() {
        _uiState.value = _uiState.value.copy(currentStep = 4)
    }

    fun nextTourPage() {
        val next = _uiState.value.currentStep + 1
        if (next <= 6) {
            _uiState.value = _uiState.value.copy(currentStep = next)
        }
    }

    fun prevTourPage() {
        val prev = _uiState.value.currentStep - 1
        if (prev >= 4) {
            _uiState.value = _uiState.value.copy(currentStep = prev)
        } else if (prev == 3) {
            _uiState.value = _uiState.value.copy(currentStep = 3)
        }
    }

    /** Undoes the last chat answer — removes the user message and Ollie's response, clears the
     *  corresponding field so Ollie will re-ask it, and re-asks the previous question. */
    fun undoLastChatMessage() {
        val state = _uiState.value
        if (state.currentStep >= 3 || state.messages.size < 2) return
        // Find the last user message and remove it + Ollie's response after it
        val messages = state.messages.toMutableList()
        val lastUserIdx = messages.indexOfLast { it.sender == "user" }
        if (lastUserIdx < 0) return
        // Remove from lastUserIdx onward (user msg + Ollie's reply)
        val removedMessages = messages.subList(lastUserIdx, messages.size).toList()
        while (messages.size > lastUserIdx) messages.removeAt(messages.size - 1)
        // Clear the field that was answered by the removed user message
        val removedText = removedMessages.firstOrNull()?.content?.lowercase() ?: ""
        var clearedName = state.userName
        var clearedSchool = state.selectedSchool
        var clearedMajor = state.selectedMajor
        var clearedGoal = state.selectedGoalHours
        var clearedStyle = state.selectedStyle
        // Heuristic: detect which field was likely set by the removed message
        if (state.selectedStyle.isNotBlank() && removedText.contains("skip") || removedText.contains("visual") || removedText.contains("auditory") || removedText.contains("quiz") || removedText.contains("text")) {
            clearedStyle = ""
        } else if (state.selectedGoalHours.isNotBlank()) {
            clearedGoal = ""
        } else if (state.selectedMajor.isNotBlank() && state.selectedMajor != "General") {
            clearedMajor = ""
        } else if (state.selectedSchool.isNotBlank() && state.selectedSchool != "Independent") {
            clearedSchool = ""
        } else if (state.userName.isNotBlank()) {
            clearedName = ""
        }
        _uiState.value = state.copy(
            messages = messages,
            userName = clearedName,
            selectedSchool = clearedSchool,
            selectedMajor = clearedMajor,
            selectedGoalHours = clearedGoal,
            selectedStyle = clearedStyle,
            suggestedOptions = emptyList(),
            isOllieTyping = false
        )
        // Re-trigger Ollie to ask the previous question
        viewModelScope.launch {
            getAiResponse(null)
        }
    }

    fun selectTier(tierKey: String) {
        val normalized = when {
            tierKey.lowercase().contains("explorer") -> "explorer"
            tierKey.lowercase().contains("scholar") -> "scholar"
            tierKey.lowercase().contains("achiever") -> "achiever"
            else -> tierKey
        }
        val current = _uiState.value
        val tierChanged = current.selectedTier != normalized
        _uiState.value = current.copy(
            selectedTier = normalized,
            tierChosen = true
        )
        viewModelScope.launch {
            repository.updateProfile(academicTier = normalized)
            // Switching stage mid-chat re-syncs the conversation so the next question matches
            // the new stage. Fields that don't carry across stages are reset: a university major
            // isn't a favourite subject (and vice versa), and minutes/hours goals differ — the
            // re-sync message then has Ollie ask for the right details. Name + style carry over.
            if (tierChanged && current.currentStep < 3) {
                val msgs = _uiState.value.messages.toMutableList()
                msgs.add(
                    OnboardingMessage(
                        sender = "ollie",
                        content = "Whoo-t! Switched to ${tierLabel(normalized)} — I'll adapt everything to your stage!"
                    )
                )
                _uiState.value = _uiState.value.copy(
                    messages = msgs,
                    selectedMajor = "",
                    selectedGoalHours = "",
                    selectedSchool = if (normalized == "explorer") "" else _uiState.value.selectedSchool,
                    isOllieTyping = true
                )
                getAiResponse(null)
            }
        }
    }

    /**
     * Maps a free-text answer about academic stage to a tier key. Understands the words real
     * learners use ("basic school", "primary", "JHS", "SHS", "WASSCE", "university"…) so the
     * tier picker never forces a redundant re-selection after the chat already knows the answer.
     */
    private fun detectTierFromText(answer: String): String? {
        val a = answer.lowercase()
        return when {
            a.contains("explorer") || a.contains("basic") || a.contains("primary") || a.contains("jhs") ||
                a.contains("junior high") || a.contains("elementary") || a.contains("kindergarten") ||
                a.contains("basic school") -> "explorer"
            a.contains("achiever") || a.contains("shs") || a.contains("senior high") || a.contains("high school") ||
                a.contains("wassce") || a.contains("secondary") || a.contains("ss1") || a.contains("ss2") || a.contains("ss3") -> "achiever"
            a.contains("scholar") || a.contains("university") || a.contains("undergraduate") ||
                a.contains("graduate") || a.contains("degree") || a.contains("tertiary") || a.contains("college") ||
                a.contains("major") || a.contains("bsc") || a.contains("ba ") || a.contains("med school") -> "scholar"
            else -> null
        }
    }

    /**
     * Used when a user tries to skip onboarding without picking a learning stage — Ollie asks
     * again instead of silently completing with the default Achiever tier (a kid would otherwise
     * land on the SHS/WASSCE workspace).
     */
    fun remindToPickTier() {
        val current = _uiState.value
        if (current.tierChosen) return
        val msgs = current.messages.toMutableList()
        msgs.add(OnboardingMessage(sender = "user", content = "Skip for now"))
        msgs.add(
            OnboardingMessage(
                sender = "ollie",
                content = "Whoo-t! Almost there — just tell me who's learning today (Explorer 🎒, Achiever ⚡ or Scholar 🎓) so I can set up the right workspace for you!"
            )
        )
        _uiState.value = current.copy(
            messages = msgs,
            suggestedOptions = listOf(
                "Explorer 🎒 (Basic / JHS)",
                "Achiever ⚡ (SHS / WASSCE)",
                "Scholar 🎓 (University)"
            ),
            isOllieTyping = false
        )
    }

    private fun tierLabel(tierKey: String): String = when (tierKey) {
        "explorer" -> "Explorer 🎒 (Basic / JHS)"
        "scholar" -> "Scholar 🎓 (University)"
        else -> "Achiever ⚡ (SHS / WASSCE)"
    }

    fun completeOnboarding(onFinish: () -> Unit) {
        if (_uiState.value.isCompleted) return
        _uiState.value = _uiState.value.copy(
            isSettingUpWorkspace = true,
            setupLoaderMessage = when (_uiState.value.selectedTier) {
                "explorer" -> "Building your lessons and quest map…"
                "scholar" -> "Setting up your university workspace…"
                else -> "Setting up your workspace…"
            }
        )
        viewModelScope.launch {
            val style = _uiState.value.selectedStyle.ifBlank { "Visual & Diagrams" }
            val major = _uiState.value.selectedMajor
            val tier = _uiState.value.selectedTier.ifBlank { "achiever" }
            val profile = repository.getProfileDirect()

            val schoolFromOnboarding = _uiState.value.selectedSchool
            val finalSchool = if (schoolFromOnboarding.isNotBlank() && schoolFromOnboarding != "Independent" && schoolFromOnboarding != "Skipped") schoolFromOnboarding else (profile?.school ?: "")

            val fullNameFromOnboarding = _uiState.value.userName
            val finalFullName = fullNameFromOnboarding.ifBlank { profile?.fullName ?: "" }

            // 1. Instantly save locally so the app works offline with zero friction
            repository.completeOnboarding(
                learningStyle = style,
                school = finalSchool,
                major = major,
                fullName = finalFullName,
                academicTier = tier,
                grade = _uiState.value.selectedGrade
            )

            // If Explorer tier, also auto-save education setup with selected grade and school
            if (tier == "explorer") {
                val grade = _uiState.value.selectedGrade.ifBlank { "Primary 4" }
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
                    institutionName = finalSchool,
                    yearOrGrade = grade,
                    subjects = subjects
                )
            }

            _uiState.value = _uiState.value.copy(isCompleted = true, isSettingUpWorkspace = false)
            onFinish()
        }
    }
}
