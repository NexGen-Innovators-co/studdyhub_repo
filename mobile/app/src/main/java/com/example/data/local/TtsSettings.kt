package com.example.data.local

import android.content.Context
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.speech.tts.Voice
import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.util.Locale

/**
 * Persistent Text-to-Speech preferences & AI Spoken Narration Engine.
 *
 * Provides:
 * 1. AI-Powered Spoken Script Generation (via Gemini API): Rewrites markdown, math formulas,
 *    tables, lists, and technical notes into fluent, natural conversational speech.
 * 2. Instant Local Spoken-Prose Cleaner: Translates LaTeX formulas, code summaries, tables,
 *    and bullet markers into natural spoken English with appropriate pauses.
 * 3. High-Quality Natural Voice Engine: Intelligently locates the highest quality, neural,
 *    or enhanced natural voices installed on the device and applies natural pitch & cadence.
 * 4. Chunked Utterance Progress Flow: Splits long passages seamlessly across sentence boundaries
 *    preventing Android TTS engine cutoff.
 */
object TtsSettings {
    private const val PREFS_NAME = "studdyhub_tts"
    private const val TAG = "TtsSettings"

    const val DEFAULT_SPEED = 1.0f
    const val MIN_SPEED = 0.6f
    const val MAX_SPEED = 1.6f

    const val GENDER_OLLIE = "ollie"
    const val GENDER_FEMALE = "female"
    const val GENDER_MALE = "male"
    const val GENDER_DEFAULT = "default"

    private const val MAX_CHUNK_LEN = 2400

    fun prefs(): android.content.SharedPreferences? =
        StuddyHubDatabase.appContext?.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    var speechRate: Float
        get() = prefs()?.getFloat("speech_rate", DEFAULT_SPEED) ?: DEFAULT_SPEED
        set(value) {
            prefs()?.edit()?.putFloat("speech_rate", value.coerceIn(MIN_SPEED, MAX_SPEED))?.apply()
        }

    var voiceGender: String
        get() = prefs()?.getString("voice_gender", GENDER_OLLIE) ?: GENDER_OLLIE
        set(value) {
            prefs()?.edit()?.putString("voice_gender", value)?.apply()
        }

    var isAiNarrationEnabled: Boolean
        get() = prefs()?.getBoolean("ai_narration_enabled", true) ?: true
        set(value) {
            prefs()?.edit()?.putBoolean("ai_narration_enabled", value)?.apply()
        }

    fun resetToDefaults() {
        prefs()?.edit()
            ?.remove("speech_rate")
            ?.remove("voice_gender")
            ?.remove("ai_narration_enabled")
            ?.apply()
    }

    /**
     * Applies the selected voice persona, pitch, and speed rate to an initialized TTS engine.
     * Searches installed voices for the highest quality natural neural voice on the device.
     */
    fun applyTo(tts: TextToSpeech, gender: String = voiceGender, rate: Float = speechRate) {
        try {
            tts.setSpeechRate(rate.coerceIn(MIN_SPEED, MAX_SPEED))
        } catch (e: Exception) {
            Log.w(TAG, "setSpeechRate failed: ${e.message}")
        }

        try {
            val voices = tts.voices
            if (!voices.isNullOrEmpty()) {
                val englishVoices = voices.filter { it.locale.language.startsWith("en") }
                val targetVoice = when (gender) {
                    GENDER_FEMALE -> {
                        englishVoices.firstOrNull { v ->
                            val name = v.name.lowercase()
                            (name.contains("female") || name.contains("fem") || name.contains("sfg") || name.contains("eva") || name.contains("jenny"))
                                    && (v.quality == Voice.QUALITY_VERY_HIGH || v.quality == Voice.QUALITY_HIGH)
                        } ?: englishVoices.firstOrNull { v ->
                            v.name.lowercase().contains("female") || v.name.lowercase().contains("fem")
                        } ?: englishVoices.firstOrNull { v ->
                            v.quality == Voice.QUALITY_VERY_HIGH || v.quality == Voice.QUALITY_HIGH
                        }
                    }
                    GENDER_MALE -> {
                        englishVoices.firstOrNull { v ->
                            val name = v.name.lowercase()
                            (name.contains("male") || name.contains("guy") || name.contains("rjs") || name.contains("iom"))
                                    && (v.quality == Voice.QUALITY_VERY_HIGH || v.quality == Voice.QUALITY_HIGH)
                        } ?: englishVoices.firstOrNull { v ->
                            v.name.lowercase().contains("male")
                        } ?: englishVoices.firstOrNull { v ->
                            v.quality == Voice.QUALITY_VERY_HIGH || v.quality == Voice.QUALITY_HIGH
                        }
                    }
                    GENDER_OLLIE -> {
                        // Friendly, crisp, high-quality tutor voice
                        englishVoices.firstOrNull { v ->
                            val name = v.name.lowercase()
                            (name.contains("en-us") || name.contains("en-gb"))
                                    && (v.quality == Voice.QUALITY_VERY_HIGH || v.quality == Voice.QUALITY_HIGH)
                                    && !v.isNetworkConnectionRequired
                        } ?: englishVoices.firstOrNull { v ->
                            v.quality == Voice.QUALITY_VERY_HIGH || v.quality == Voice.QUALITY_HIGH
                        } ?: englishVoices.firstOrNull()
                    }
                    else -> {
                        englishVoices.firstOrNull { v ->
                            v.quality == Voice.QUALITY_VERY_HIGH || v.quality == Voice.QUALITY_HIGH
                        } ?: englishVoices.firstOrNull()
                    }
                }

                targetVoice?.let {
                    tts.setVoice(it)
                    Log.d(TAG, "Selected TTS voice: ${it.name} (quality=${it.quality})")
                }
            } else {
                tts.language = Locale.US
            }
        } catch (e: Exception) {
            Log.w(TAG, "Voice selection failed: ${e.message}")
        }

        try {
            when (gender) {
                GENDER_MALE -> tts.setPitch(0.85f)
                GENDER_FEMALE -> tts.setPitch(1.18f)
                GENDER_OLLIE -> tts.setPitch(1.06f) // Upbeat & engaging
                else -> tts.setPitch(1.0f)
            }
        } catch (e: Exception) {
            Log.w(TAG, "setPitch failed: ${e.message}")
        }
    }

    /**
     * Converts raw markdown, formulas, abbreviations, and tables into a clean, spoken-English text.
     * Intended for instant offline transformation without network latency.
     */
    fun markdownToSpeech(text: String): String {
        if (text.isBlank()) return ""
        var s = text.replace(Regex("\r\n?"), "\n")

        // 1. Code blocks: Summarize or read cleanly rather than raw syntax
        s = s.replace(Regex("```(?:[a-zA-Z0-9_+\\-]*)\n([\\s\\S]*?)```")) { match ->
            val code = match.groupValues[1].trim()
            val lineCount = code.lines().size
            if (lineCount > 3) {
                val firstLine = code.lines().firstOrNull()?.trim() ?: ""
                " Here is a code example: ${firstLine}. "
            } else {
                " Code snippet: ${code.replace(Regex("[;{}()]"), " ")}. "
            }
        }
        s = s.replace("```", " ")
        s = s.replace(Regex("`([^`]+)`"), "$1")

        // 2. Mathematical & Scientific Formulas
        s = s.replace(Regex("\\$\\$(.*?)\\$\\$"), " $1 ")
        s = s.replace(Regex("\\$([^$]+)\\$"), " $1 ")
        s = s.replace(Regex("\\\\frac\\{([^}]+)\\}\\{([^}]+)\\}"), "$1 over $2")
        s = s.replace(Regex("\\\\sqrt\\{([^}]+)\\}"), "square root of $1")
        s = s.replace("\\approx", " approximately ")
        s = s.replace("\\le", " less than or equal to ")
        s = s.replace("\\ge", " greater than or equal to ")
        s = s.replace("\\pm", " plus or minus ")
        s = s.replace("\\neq", " is not equal to ")
        s = s.replace("\\times", " times ")
        s = s.replace("\\cdot", " times ")
        s = s.replace("\\pi", " pi ")
        s = s.replace("\\theta", " theta ")
        s = s.replace("\\alpha", " alpha ")
        s = s.replace("\\beta", " beta ")
        s = s.replace("\\Delta", " delta ")
        s = s.replace("\\int", " integral of ")
        s = s.replace("\\sum", " sum of ")
        s = s.replace("\\infty", " infinity ")
        s = s.replace(Regex("([a-zA-Z0-9]+)\\^2"), "$1 squared")
        s = s.replace(Regex("([a-zA-Z0-9]+)\\^3"), "$1 cubed")
        s = s.replace(Regex("([a-zA-Z0-9]+)\\^([a-zA-Z0-9]+)"), "$1 to the power of $2")
        s = s.replace(Regex("\\\\[a-zA-Z]+\\{([^}]+)\\}"), "$1")
        s = s.replace(Regex("\\\\[a-zA-Z]+"), " ")

        // 3. Images and Links: Read descriptive label, drop URL
        s = s.replace(Regex("!\\[(.*?)\\]\\(.*?\\)"), " Illustration: $1. ")
        s = s.replace(Regex("\\[(.*?)\\]\\(.*?\\)"), "$1")
        s = s.replace(Regex("https?://\\S+"), " link ")

        // 4. Tables: Format cleanly
        s = s.lines().map { line ->
            if (line.trim().startsWith("|") && line.trim().endsWith("|")) {
                if (line.contains("---")) {
                    ""
                } else {
                    val cells = line.split("|").map { it.trim() }.filter { it.isNotEmpty() }
                    cells.joinToString(", ") + ". "
                }
            } else line
        }.joinToString("\n")

        // 5. Headings: Add a natural pause
        s = s.replace(Regex("^#{1,6}\\s*(.+)$", RegexOption.MULTILINE), "$1:\n")

        // 6. Lists and Bullets: Smooth conversational markers
        s = s.replace(Regex("^\\s*[-+*]\\s+(\\[\\s*x?\\s*\\]\\s+)?", RegexOption.MULTILINE), " • ")
        s = s.replace(Regex("^\\s*(\\d{1,3})[.)]\\s+", RegexOption.MULTILINE), " Point $1: ")

        // 7. Common abbreviations & STEM symbols for natural pronunciation
        s = s.replace(Regex("\\be\\.g\\.", RegexOption.IGNORE_CASE), "for example,")
        s = s.replace(Regex("\\bi\\.e\\.", RegexOption.IGNORE_CASE), "that is,")
        s = s.replace(Regex("\\betc\\.", RegexOption.IGNORE_CASE), "and so on")
        s = s.replace(Regex("\\bvs\\.", RegexOption.IGNORE_CASE), "versus")
        s = s.replace(Regex("\\bapprox\\.", RegexOption.IGNORE_CASE), "approximately")
        s = s.replace(Regex("\\bw/o\\b", RegexOption.IGNORE_CASE), "without")
        s = s.replace(Regex("\\bw/\\b", RegexOption.IGNORE_CASE), "with")
        s = s.replace(Regex("\\bkm/h\\b", RegexOption.IGNORE_CASE), "kilometers per hour")
        s = s.replace(Regex("\\bm/s\\b", RegexOption.IGNORE_CASE), "meters per second")
        s = s.replace(Regex("\\bCO2\\b"), "C O 2")
        s = s.replace(Regex("\\bH2O\\b"), "H 2 O")
        s = s.replace(Regex("\\bDNA\\b"), "D N A")
        s = s.replace(Regex("\\bRNA\\b"), "R N A")
        s = s.replace(Regex("\\bpH\\b"), "p H")

        // 8. Markdown styling tags (bold, italic, strikethrough, blockquotes)
        s = s.replace("~~", "")
        s = s.replace(Regex("\\*\\*|__"), "")
        s = s.replace("*", "")
        s = s.replace("_", "")
        s = s.replace(Regex("^>\\s*", RegexOption.MULTILINE), "")
        s = s.replace(Regex("<[^>]*>"), " ")

        // 9. Clean excessive spaces & format breathing pauses
        s = s.replace(Regex("[ \t]+"), " ")
        s = s.replace(Regex(" *\n *"), "\n")
        s = s.replace(Regex("\n{2,}"), ". \n")
        s = s.replace(Regex("([.!?])\\s*([.!?])"), "$1")
        return s.trim()
    }

    /**
     * Uses Gemini AI to rewrite study content into a natural spoken script designed for audio read-aloud.
     * Expands formulas, smoothens lists, and writes in engaging conversational English.
     */
    suspend fun generateAiSpokenScript(text: String, isKid: Boolean = false): String = withContext(Dispatchers.IO) {
        if (text.isBlank()) return@withContext ""
        val cleanLocal = markdownToSpeech(text)
        if (!isAiNarrationEnabled || text.length < 90) {
            return@withContext cleanLocal
        }

        try {
            // Use the dedicated tts-narrate edge function — lightweight, no sessions,
            // no conversation history. Just rewrites text for speech and returns.
            val result = com.example.data.remote.BackendApiService.narrateForTts(text, isKid)
            if (result is com.example.data.remote.BackendResult.Success && result.data.isNotBlank()) {
                return@withContext markdownToSpeech(result.data)
            }
        } catch (e: Exception) {
            Log.w(TAG, "AI narration generation fallback to local script: ${e.message}")
        }

        cleanLocal
    }

    /**
     * Speaks text with AI-enhanced spoken narration script preparation and chunked playback.
     */
    suspend fun speakWithAiNarration(
        tts: TextToSpeech,
        rawText: String,
        utterancePrefix: String,
        isKid: Boolean = false,
        onScriptReady: ((String) -> Unit)? = null,
        onAllDone: () -> Unit
    ) {
        applyTo(tts, voiceGender, speechRate)
        // FIX: Always read the EXACT displayed text — skip AI rewrite which changes words.
        // The user expects TTS to match what they see on screen.
        val spokenScript = markdownToSpeech(rawText)

        withContext(Dispatchers.Main) {
            onScriptReady?.invoke(spokenScript)
            speakInChunks(tts, spokenScript, utterancePrefix, onAllDone)
        }
    }

    /**
     * Speaks [text] in chunks so long replies are read in full without truncation.
     */
    fun speakInChunks(tts: TextToSpeech, text: String, utterancePrefix: String, onAllDone: () -> Unit) {
        val clean = if (text.contains("#") || text.contains("*") || text.contains("```")) {
            markdownToSpeech(text)
        } else text.trim()

        if (clean.isEmpty()) {
            onAllDone()
            return
        }

        val chunks = splitChunks(clean)
        if (chunks.isEmpty()) {
            onAllDone()
            return
        }

        tts.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
            override fun onStart(utteranceId: String?) {}
            override fun onError(utteranceId: String?) {
                if (utteranceId == "${utterancePrefix}_${chunks.size - 1}") onAllDone()
            }
            override fun onError(utteranceId: String?, errorCode: Int) {
                if (utteranceId == "${utterancePrefix}_${chunks.size - 1}") onAllDone()
            }
            override fun onDone(utteranceId: String?) {
                if (utteranceId == "${utterancePrefix}_${chunks.size - 1}") onAllDone()
            }
        })

        chunks.forEachIndexed { index, chunk ->
            val queueMode = if (index == 0) TextToSpeech.QUEUE_FLUSH else TextToSpeech.QUEUE_ADD
            val result = tts.speak(chunk, queueMode, null, "${utterancePrefix}_$index")
            if (result == TextToSpeech.ERROR) {
                Log.w(TAG, "speak failed for chunk $index (${chunk.length} chars)")
            }
        }
    }

    private fun splitChunks(text: String): List<String> {
        if (text.length <= MAX_CHUNK_LEN) return listOf(text.trim())
        val chunks = mutableListOf<String>()
        var start = 0
        while (start < text.length) {
            var end = (start + MAX_CHUNK_LEN).coerceAtMost(text.length)
            if (end < text.length) {
                val searchStart = (start + MAX_CHUNK_LEN / 2).coerceAtLeast(start + 1)
                val window = text.substring(searchStart, end)
                val rel = window.lastIndexOfAny(charArrayOf('.', '!', '?', '\n', ';', ','))
                if (rel >= 0) end = searchStart + rel + 1
            }
            val chunk = text.substring(start, end).trim()
            if (chunk.isNotEmpty()) chunks.add(chunk)
            start = end
        }
        return chunks
    }
}

