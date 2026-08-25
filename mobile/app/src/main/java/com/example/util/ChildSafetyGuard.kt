package com.example.util

/**
 * Child-safety & COPPA moderation guard utilities for Explorer (Kids) tier.
 */
object ChildSafetyGuard {

    private val PII_PATTERNS = listOf(
        Regex("""\b\d{3}[-.\s]??\d{3}[-.\s]??\d{4}\b"""), // Phone number
        Regex("""\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b"""), // Email
        Regex("""(?i)\b(my address is|i live at|what's your phone number|where do you live)\b""")
    )

    private val INAPPROPRIATE_KEYWORDS = listOf(
        "porn", "sex", "gambling", "casino", "hack", "bypass", "jailbreak", "kill", "weapon", "drugs", "suicide"
    )

    /**
     * Checks if a child's message contains PII or forbidden content, giving friendly feedback.
     */
    fun evaluateChildMessageSafety(message: String): SafetyEvaluationResult {
        val lower = message.lowercase().trim()

        for (pattern in PII_PATTERNS) {
            if (pattern.containsMatchIn(lower)) {
                return SafetyEvaluationResult(
                    isSafe = false,
                    safeResponse = "🔒 **Safety First with Ollie!** Please remember never to share personal information like phone numbers, emails, or real home addresses online."
                )
            }
        }

        for (kw in INAPPROPRIATE_KEYWORDS) {
            if (lower.split(Regex("""\W+""")).contains(kw)) {
                return SafetyEvaluationResult(
                    isSafe = false,
                    safeResponse = "🦉 **Ollie says:** Let's keep our chats focused on school, science, reading, and fun learning games!"
                )
            }
        }

        return SafetyEvaluationResult(isSafe = true)
    }

    /**
     * Sanitizes kid multiplayer player names and removes inappropriate text.
     */
    fun sanitizeDisplayName(rawName: String): String {
        val cleaned = rawName.trim().filter { it.isLetterOrDigit() || it.isWhitespace() }
        if (cleaned.isBlank() || INAPPROPRIATE_KEYWORDS.any { cleaned.lowercase().contains(it) }) {
            val funNames = listOf("Speedy Cheetah 🐆", "Clever Owl 🦉", "Star Explorer ⭐", "Math Wizard 🧙", "Bright Eagle 🦅")
            return funNames.random()
        }
        return cleaned.take(20)
    }
}

data class SafetyEvaluationResult(
    val isSafe: Boolean,
    val safeResponse: String? = null
)
