package com.example.ui.screens.quizzes

import androidx.compose.ui.graphics.Color
import com.example.R
import org.json.JSONArray
import org.json.JSONObject

data class WrongAnswerItem(
    val question: String,
    val userAnswer: String,
    val correctAnswer: String,
    val explanation: String = ""
)

/** A spelling-bee word (word + definition + example sentence). */
data class SpellingWordItem(
    val word: String,
    val definition: String,
    val sentence: String
)

/** Serializes quiz questions to the same JSON shape parseQuizQuestionsJson reads. */
fun questionsToJson(questions: List<QuizQuestionItem>): String {
    val arr = JSONArray()
    questions.forEach { q ->
        val obj = JSONObject()
        obj.put("question", q.question)
        obj.put("options", JSONArray(q.options))
        obj.put("correct", q.correctIndex)
        obj.put("explanation", q.explanation)
        arr.put(obj)
    }
    return arr.toString()
}

/**
 * Explorer (kids) game system v2.
 *
 * Four hero games, each with a level ladder (1..N) the kid climbs by earning stars:
 *   - ananse_riddles  → logic riddles & puzzles
 *   - maths_quest     → arithmetic (merges the old oware_math + chaskele_speed)
 *   - kente_quiz      → Ghanaian culture / history / heritage
 *   - spelling_bee    → spelling with letter tiles + TTS (NEW)
 *
 * Every level maps to a difficulty band. Questions are generated live by the AI
 * (backend generate-ai-quiz with a direct-Gemini fallback) — no bundled question
 * banks. Star thresholds are percentages: >= thresholds[0] = 1 star,
 * >= thresholds[1] = 2 stars, >= thresholds[2] = 3 stars.
 */
data class ExplorerGameLevel(
    val index: Int,               // 1-based
    val name: String,
    val difficulty: String,       // "easy" | "medium" | "hard"
    val xpReward: Int,            // base XP for a perfect run
    val questionCount: Int = 5,
    val starThresholds: List<Int> = listOf(40, 70, 90),
    val timeLimitSec: Int = 0     // >0 = timed level (speed race)
)

data class ExplorerGameConfig(
    val key: String,
    val title: String,
    val subtitle: String,
    val drawableId: Int,
    val badge: String,
    val primaryColor: Color,
    val bgLightColor: Color,
    val description: String,
    val emoji: String,
    val levels: List<ExplorerGameLevel>,
    val isSpelling: Boolean = false
) {
    val totalLevels: Int get() = levels.size
}

private val STAR_THRESHOLDS = listOf(40, 70, 90)

fun starsForPercent(percent: Int): Int = when {
    percent >= STAR_THRESHOLDS[2] -> 3
    percent >= STAR_THRESHOLDS[1] -> 2
    percent >= STAR_THRESHOLDS[0] -> 1
    else -> 0
}

fun xpForLevel(levelIndex: Int, percent: Int): Int {
    val base = when (levelIndex) {
        1 -> 20
        2 -> 25
        3 -> 40
        4 -> 50
        else -> 80
    }
    return (base * percent) / 100
}

private fun levelList(
    base: Int,
    nameFn: (Int) -> String,
    diffs: List<String>,
    counts: List<Int>,
    xp: List<Int>,
    timeLimit: Int = 0
): List<ExplorerGameLevel> = (1..5).map { i ->
    ExplorerGameLevel(
        index = i,
        name = nameFn(i),
        difficulty = diffs.getOrElse(i - 1) { "medium" },
        xpReward = xp.getOrElse(i - 1) { base },
        questionCount = counts.getOrElse(i - 1) { 5 },
        starThresholds = STAR_THRESHOLDS,
        timeLimitSec = timeLimit
    )
}

private val HEROES: Map<String, ExplorerGameConfig> = mapOf(
    "ananse_riddles" to ExplorerGameConfig(
        key = "ananse_riddles",
        title = "Ananse Riddles",
        subtitle = "Logic & Riddle Quest",
        drawableId = R.drawable.img_ananse_riddles_1786717187634,
        badge = "LOGIC QUEST",
        primaryColor = Color(0xFF6B46C1),
        bgLightColor = Color(0xFFEAE6FD),
        description = "Test your wit against Ananse the wise spider with tricky riddles, patterns and puzzles!",
        emoji = "🕷️",
        levels = levelList(
            base = 20,
            nameFn = { listOf("Starter Riddles", "Clever Clues", "Brain Teasers", "Ananse's Trap", "Spider's Mastery")[it - 1] },
            diffs = listOf("easy", "easy", "medium", "medium", "hard"),
            counts = listOf(5, 5, 6, 6, 6),
            xp = listOf(20, 25, 40, 50, 80)
        )
    ),
    "maths_quest" to ExplorerGameConfig(
        key = "maths_quest",
        title = "Maths Quest",
        subtitle = "Numbers, Beads & Speed",
        drawableId = R.drawable.img_oware_math_1786717198699,
        badge = "NUMBER QUEST",
        primaryColor = Color(0xFFD97706),
        bgLightColor = Color(0xFFFEF3C7),
        description = "Add, subtract, multiply and divide your way up the ladder — Oware style!",
        emoji = "🔢",
        levels = levelList(
            base = 20,
            nameFn = { listOf("Counting Beads", "Speedy Sums", "Times Table Clash", "Division Duel", "Grand Number Master")[it - 1] },
            diffs = listOf("easy", "easy", "medium", "medium", "hard"),
            counts = listOf(5, 5, 6, 6, 6),
            xp = listOf(20, 25, 40, 50, 80)
        )
    ),
    "kente_quiz" to ExplorerGameConfig(
        key = "kente_quiz",
        title = "Kente Quiz",
        subtitle = "Heritage & Culture Quest",
        drawableId = R.drawable.img_kente_quiz_1786717209972,
        badge = "HERITAGE BOWL",
        primaryColor = Color(0xFF047857),
        bgLightColor = Color(0xFFE8F8E8),
        description = "Climb the levels of Ghanaian history, culture, geography and national pride!",
        emoji = "🧶",
        levels = levelList(
            base = 20,
            nameFn = { listOf("My Ghana", "National Pride", "Festivals & Food", "History Heroes", "Kente Master Weaver")[it - 1] },
            diffs = listOf("easy", "easy", "medium", "medium", "hard"),
            counts = listOf(5, 5, 6, 6, 6),
            xp = listOf(20, 25, 40, 50, 80)
        )
    ),
    "spelling_bee" to ExplorerGameConfig(
        key = "spelling_bee",
        title = "Spelling Bee",
        subtitle = "Letters, Sounds & Words",
        drawableId = R.drawable.img_ghana_student_1786717174359,
        badge = "WORD BEE",
        primaryColor = Color(0xFF1D4ED8),
        bgLightColor = Color(0xFFDEF0FD),
        description = "Listen to Ollie say a word, then build it with the letter tiles. Buzz through the levels!",
        emoji = "🐝",
        levels = levelList(
            base = 20,
            nameFn = { listOf("Honey Words", "Busy Bee Words", "Hive Climbers", "Queen Bee", "Grand Champion Bee")[it - 1] },
            diffs = listOf("easy", "easy", "medium", "medium", "hard"),
            counts = listOf(5, 6, 7, 8, 8),
            xp = listOf(20, 25, 40, 50, 80)
        ),
        isSpelling = true
    ),
    "math_asteroid_blaster" to ExplorerGameConfig(
        key = "math_asteroid_blaster",
        title = "Math Asteroid Blaster",
        subtitle = "Space Arithmetic & Laser Defense",
        drawableId = R.drawable.explorer_arcade_banner_1787426442864,
        badge = "SPACE ARCADE",
        primaryColor = Color(0xFFEF4444),
        bgLightColor = Color(0xFFFEE2E2),
        description = "Shoot descending asteroids with your laser cannons by solving fast math equations!",
        emoji = "🚀",
        levels = levelList(
            base = 25,
            nameFn = { listOf("Orbital Addition", "Shield Subtraction", "Meteor Multiplication", "Asteroid Storm", "Galactic Math Commander")[it - 1] },
            diffs = listOf("easy", "easy", "medium", "medium", "hard"),
            counts = listOf(6, 6, 8, 8, 10),
            xp = listOf(25, 35, 50, 65, 100)
        )
    ),
    "science_explorer" to ExplorerGameConfig(
        key = "science_explorer",
        title = "Science Discovery Lab",
        subtitle = "Plants, Energy & Nature",
        drawableId = R.drawable.explorer_science_arcade_1787430264662,
        badge = "NATURE LAB",
        primaryColor = Color(0xFF059669),
        bgLightColor = Color(0xFFD1FAE5),
        description = "Explore living things, forces, space, and the wonders of scientific discovery!",
        emoji = "🧪",
        levels = levelList(
            base = 20,
            nameFn = { listOf("Curious Sprouts", "Energy & Light", "Weather & Water", "Ecosystem Explorers", "Master Scientist")[it - 1] },
            diffs = listOf("easy", "easy", "medium", "medium", "hard"),
            counts = listOf(5, 5, 6, 6, 6),
            xp = listOf(20, 25, 40, 50, 80)
        )
    )
)

val EXPLORER_GAMES: Map<String, ExplorerGameConfig> = buildMap {
    putAll(HEROES)
    // Backwards-compatible aliases (older saved game keys keep working).
    put("asteroid_laser", HEROES["math_asteroid_blaster"]!!.copy(key = "math_asteroid_blaster"))
    put("asteroid_blaster", HEROES["math_asteroid_blaster"]!!.copy(key = "math_asteroid_blaster"))
    put("math_laser", HEROES["math_asteroid_blaster"]!!.copy(key = "math_asteroid_blaster"))
    put("oware_math", HEROES["maths_quest"]!!.copy(key = "maths_quest"))
    put("chaskele_speed", HEROES["maths_quest"]!!.copy(key = "maths_quest"))
    put("number_ninja", HEROES["maths_quest"]!!.copy(key = "maths_quest"))
    put("maths_challenge", HEROES["maths_quest"]!!.copy(key = "maths_quest"))
    put("codi", HEROES["ananse_riddles"]!!.copy(key = "ananse_riddles"))
    put("coasted_quiz", HEROES["kente_quiz"]!!.copy(key = "kente_quiz"))
}

/** Normalizes any stored/legacy key to the canonical hero key. */
fun normalizeGameKey(key: String): String = EXPLORER_GAMES[key]?.key ?: key
