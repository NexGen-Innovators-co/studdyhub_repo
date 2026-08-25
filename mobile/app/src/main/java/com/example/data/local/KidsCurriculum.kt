package com.example.data.local

/**
 * Education-domain types shared by the mobile onboarding and the education context.
 *
 * SOURCE OF TRUTH: the cloud education schema — `countries`, `education_levels`,
 * `curricula`, `examinations`, `subjects` (+ `user_education_profiles`, `user_subjects`
 * for the user's own setup). These types mirror that schema and match the web app
 * (src/types/Education.ts). The constants in [KidsCurriculum] are **offline fallbacks
 * only** — used when the cloud tables are unreachable (fresh install, no network).
 */
data class EducationCountry(
    val id: String? = null,
    val code: String,
    val name: String,
    val flagEmoji: String = ""
)

data class EducationSubjectRef(
    val subjectId: String? = null,
    val code: String,
    val name: String,
    val category: String = "core" // "core" | "elective"
)

data class EducationLevelRef(
    val levelId: String? = null,
    val code: String = "",
    val name: String,
    val category: String, // "primary" | "lower_secondary" | "upper_secondary" | ...
    val grades: List<String>,
    val subjects: List<EducationSubjectRef> = emptyList(),
    // Auto-picked first curriculum + target exam for the level (mirrors web auto-select)
    val curriculumId: String? = null,
    val curriculumName: String = "",
    val examinationId: String? = null,
    val examinationName: String = ""
)

/** Ghana-focused offline fallbacks (only used when the cloud is unreachable). */
object KidsCurriculum {

    val FALLBACK_COUNTRIES: List<EducationCountry> = listOf(
        EducationCountry(code = "GH", name = "Ghana", flagEmoji = "🇬🇭")
    )

    fun fallbackCoreSubjects(): List<EducationSubjectRef> = listOf(
        EducationSubjectRef(code = "ENG", name = "English Language", category = "core"),
        EducationSubjectRef(code = "MATH", name = "Mathematics", category = "core"),
        EducationSubjectRef(code = "SCI", name = "Science", category = "core"),
        EducationSubjectRef(code = "SST", name = "Social Studies", category = "core"),
        EducationSubjectRef(code = "ICT", name = "ICT", category = "elective"),
        EducationSubjectRef(code = "ART", name = "Creative Arts", category = "elective"),
        EducationSubjectRef(code = "FRENCH", name = "French", category = "elective"),
        EducationSubjectRef(code = "TWI", name = "Twi / Ghanaian Language", category = "elective")
    )

    /**
     * Fallback class bands for a country when education_levels can't be fetched.
     * Mirrors the Ghana NaCCA structure: Primary (Basic 1–6) → JHS (1–3) → SHS (1–3).
     */
    fun fallbackLevels(countryCode: String): List<EducationLevelRef> = listOf(
        EducationLevelRef(
            code = "gh_primary",
            name = "Primary (Basic 1–6)",
            category = "primary",
            grades = (1..6).map { "Basic $it" },
            subjects = fallbackCoreSubjects()
        ),
        EducationLevelRef(
            code = "gh_lower_secondary",
            name = "Lower Secondary (JHS 1–3)",
            category = "lower_secondary",
            grades = (1..3).map { "JHS $it" },
            subjects = fallbackCoreSubjects()
        ),
        EducationLevelRef(
            code = "gh_upper_secondary",
            name = "Upper Secondary (SHS 1–3)",
            category = "upper_secondary",
            grades = (1..3).map { "SHS $it" },
            subjects = fallbackCoreSubjects()
        )
    )

    /** Grade labels for a level category (fallback when the level lacks explicit grades). */
    fun gradesForCategory(category: String): List<String> = when (category) {
        "lower_secondary" -> (1..3).map { "JHS $it" }
        "upper_secondary" -> (1..3).map { "SHS $it" }
        "tertiary" -> listOf("Year 1", "Year 2", "Year 3", "Year 4")
        else -> (1..6).map { "Basic $it" }
    }

    /** Maps an education level category to the question-bank difficulty band. */
    fun difficultyBandForCategory(category: String): String = when (category) {
        "lower_secondary" -> "JHS"
        "upper_secondary" -> "SHS"
        else -> "primary"
    }

    /**
     * Generates a tailored 4-week starter learning path tailored to the student's exact class level,
     * ensuring zero-delay offline readiness without waiting for cloud edge generation.
     */
    fun generateGradeSpecificStarterRoadmap(
        levelCategory: String,
        grade: String,
        enrolledSubjects: List<EducationSubjectRef> = emptyList()
    ): List<com.example.data.local.entities.RoadmapStepEntity> {
        val isLowerPrimary = grade.contains("1") || grade.contains("2") || grade.contains("3") || grade.contains("KG", ignoreCase = true)
        val isJHS = levelCategory.contains("lower_secondary", ignoreCase = true) || grade.contains("JHS", ignoreCase = true)
        val isSHS = levelCategory.contains("upper_secondary", ignoreCase = true) || grade.contains("SHS", ignoreCase = true)
        val isUpperPrimary = !isLowerPrimary && !isJHS && !isSHS

        val subjectList = enrolledSubjects.ifEmpty { fallbackCoreSubjects() }
        val now = System.currentTimeMillis()
        val dayMillis = 24L * 60 * 60 * 1000
        val steps = mutableListOf<com.example.data.local.entities.RoadmapStepEntity>()

        // Curated lesson tracks per subject & age cohort
        val tracks = when {
            isLowerPrimary -> mapOf(
                "ENG" to listOf(
                    "Letter Sounds & Phonics Fun" to "lesson",
                    "Sight Words & Rhyming Adventure" to "lesson",
                    "3-Letter Word Spelling Quest" to "game",
                    "Reading a Picture Story" to "lesson"
                ),
                "MATH" to listOf(
                    "Counting & Number Patterns 1-100" to "lesson",
                    "Shapes & Colors in Daily Life" to "lesson",
                    "Addition Star Hop" to "game",
                    "Simple Subtraction Fun" to "lesson"
                ),
                "SCI" to listOf(
                    "Our 5 Senses & How We See" to "lesson",
                    "Plants in Our Garden" to "lesson",
                    "Animals and Their Homes" to "lesson",
                    "Sun, Rain & the Weather" to "lesson"
                ),
                "SST" to listOf(
                    "My Family & Community Helpers" to "lesson",
                    "Ghanaian Folk Tales & Ananse" to "game",
                    "Good Habits & Keeping Clean" to "lesson",
                    "Our School & Country Flag" to "lesson"
                )
            )
            isUpperPrimary -> mapOf(
                "ENG" to listOf(
                    "Reading Comprehension & Clues" to "lesson",
                    "Nouns, Verbs & Descriptive Words" to "lesson",
                    "Vocabulary Spelling Sprint" to "game",
                    "Creative Story Composition" to "lesson"
                ),
                "MATH" to listOf(
                    "Place Values & Multi-Digit Math" to "lesson",
                    "Fractions & Fun Pizza Slices" to "lesson",
                    "Math Asteroid Laser Blaster" to "game",
                    "Perimeter, Area & Shapes" to "lesson"
                ),
                "SCI" to listOf(
                    "Plant Life Cycles & Photosynthesis" to "lesson",
                    "Human Bones & Muscle Power" to "lesson",
                    "States of Matter: Solid, Liquid, Gas" to "lesson",
                    "Habitats & Living Ecosystems" to "lesson"
                ),
                "SST" to listOf(
                    "Ghana's History & Great Heroes" to "lesson",
                    "Maps, Regions & Landmarks" to "lesson",
                    "Kente & Cultural Heritage" to "game",
                    "Our Environment & Forest Care" to "lesson"
                ),
                "ICT" to listOf(
                    "Computer Hardware & Mouse Skills" to "lesson",
                    "Typing Master & Keyboard Quest" to "game",
                    "Internet Safety & Smart Surfing" to "lesson",
                    "Algorithms: Step-by-Step Thinking" to "lesson"
                ),
                "FRENCH" to listOf(
                    "Salutations et Présentations" to "lesson",
                    "Les Nombres et Les Couleurs" to "lesson",
                    "French Word Match Sprint" to "game",
                    "La Famille et Les Animaux" to "lesson"
                ),
                "ART" to listOf(
                    "Colors, Shapes & Patterns" to "lesson",
                    "Traditional Ghanaian Crafts" to "lesson",
                    "Creative Drawing Studio" to "game",
                    "Music, Rhythm & Percussion" to "lesson"
                )
            )
            isJHS -> mapOf(
                "ENG" to listOf(
                    "Grammar: Clauses & Connectors" to "lesson",
                    "Summary & Critical Reading" to "lesson",
                    "Spelling Bee Champion Challenge" to "game",
                    "Persuasive & Argumentative Essay" to "lesson"
                ),
                "MATH" to listOf(
                    "Algebraic Expressions & Equations" to "lesson",
                    "Fractions, Ratios & Percentages" to "lesson",
                    "Geometry, Angles & Polygons" to "lesson",
                    "Data Handling & Probability" to "game"
                ),
                "SCI" to listOf(
                    "Cell Biology & Organ Systems" to "lesson",
                    "Atoms, Elements & Compounds" to "lesson",
                    "Forces, Friction & Motion" to "lesson",
                    "Electric Circuits & Voltage" to "lesson"
                ),
                "SST" to listOf(
                    "West African Kingdoms & Trade" to "lesson",
                    "Ghana's Constitution & Rights" to "lesson",
                    "Economic Development & Tourism" to "lesson",
                    "African Geography & Natural Wealth" to "game"
                ),
                "ICT" to listOf(
                    "Computer Systems & Architecture" to "lesson",
                    "Data Communication & Networks" to "lesson",
                    "Binary & Logic Gates Quest" to "game",
                    "Intro to Coding & Python Logic" to "lesson"
                ),
                "FRENCH" to listOf(
                    "Grammaire: Verbes et Temps" to "lesson",
                    "Compréhension et Dialogue" to "lesson",
                    "French Vocab Duel" to "game",
                    "Expression Écrite et Culture" to "lesson"
                ),
                "ART" to listOf(
                    "Visual Arts Design Principles" to "lesson",
                    "Performing Arts & Heritage" to "lesson",
                    "Creative Composition Challenge" to "game",
                    "Exhibition & Art Appreciation" to "lesson"
                )
            )
            else -> mapOf( // SHS / Advanced
                "ENG" to listOf(
                    "Rhetorical Analysis & Tone" to "lesson",
                    "Advanced Lexis and Structure" to "lesson",
                    "Expository & Formal Writing" to "lesson",
                    "Literature: Themes & Symbolism" to "lesson"
                ),
                "MATH" to listOf(
                    "Quadratic Functions & Graphs" to "lesson",
                    "Trigonometric Ratios & Vectors" to "lesson",
                    "Calculus & Rates of Change" to "lesson",
                    "Matrix Algebra & Transformations" to "lesson"
                ),
                "SCI" to listOf(
                    "Cellular Metabolism & Genetics" to "lesson",
                    "Chemical Bonding & Reactions" to "lesson",
                    "Newtonian Mechanics & Momentum" to "lesson",
                    "Electromagnetism & Waves" to "lesson"
                ),
                "SST" to listOf(
                    "Regional Integration & ECOWAS" to "lesson",
                    "Global Economy & Trade Policies" to "lesson",
                    "International Law & Peacebuilding" to "lesson",
                    "Sustainable Resource Governance" to "lesson"
                )
            )
        }

        var globalStepIndex = 0
        for (week in 1..4) {
            val weekTrackIndex = week - 1
            subjectList.forEachIndexed { subjIndex, subject ->
                val code = subject.code.uppercase()
                val matchedCode = when {
                    code.contains("ENG") || code.contains("LANG") -> "ENG"
                    code.contains("MATH") -> "MATH"
                    code.contains("SCI") -> "SCI"
                    code.contains("SST") || code.contains("SOC") || code.contains("HIST") -> "SST"
                    code.contains("ICT") || code.contains("COMP") -> "ICT"
                    code.contains("FRENCH") || code.contains("FR") -> "FRENCH"
                    code.contains("ART") || code.contains("CREAT") -> "ART"
                    else -> "ENG"
                }

                val subjectTracks = tracks[matchedCode] ?: tracks["ENG"]!!
                val lessonPair = subjectTracks.getOrNull(weekTrackIndex % subjectTracks.size)
                    ?: ("${subject.name} Quest Week $week" to "lesson")

                val title = lessonPair.first
                val stepType = lessonPair.second
                val refId = when {
                    stepType == "game" && code.contains("MATH") -> "asteroid_blaster"
                    stepType == "game" && code.contains("ENG") -> "spelling_bee"
                    stepType == "game" && code.contains("SST") -> "kente_quiz"
                    else -> null
                }

                val day = (subjIndex % 5) + 1
                val due = now + ((week - 1) * 7L * dayMillis) + ((day - 1) * dayMillis)
                val stepId = "starter_${code.lowercase()}_w${week}_d${day}_${globalStepIndex}"

                steps.add(
                    com.example.data.local.entities.RoadmapStepEntity(
                        id = stepId,
                        subjectCode = subject.code.uppercase(),
                        subjectName = subject.name,
                        week = week,
                        day = day,
                        stepIndex = globalStepIndex++,
                        title = title,
                        stepType = stepType,
                        refId = refId,
                        xpReward = if (stepType == "game") 25 else 20,
                        dueDateMillis = due
                    )
                )
            }
        }

        return steps
    }
}
