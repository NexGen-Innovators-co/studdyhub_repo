package com.example.ui.components

import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioTrack
import android.os.SystemClock
import kotlinx.coroutines.*
import kotlin.math.sin

/**
 * 🎵 Native Android Realtime Sound & Music Synthesizer Engine.
 * Generates clear, lag-free polyphonic 8-bit arcade tones, fanfare celebrations,
 * laser shots, explosions, combo chimes, and background beats without needing external MP3 files!
 */
object GameAudioEngine {
    private const val SAMPLE_RATE = 22050
    private val scope = CoroutineScope(Dispatchers.Default + SupervisorJob())

    private var bgmJob: Job? = null
    var isMuted = false

    /**
     * Synthesize and play raw PCM audio buffer on a background thread.
     */
    private fun playPcm(
        samples: ShortArray,
        sampleRate: Int = SAMPLE_RATE,
        gain: Float = 0.85f
    ) {
        if (isMuted) return
        scope.launch {
            try {
                val bufferSize = samples.size * 2
                val audioTrack = AudioTrack.Builder()
                    .setAudioAttributes(
                        AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_GAME)
                            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                            .build()
                    )
                    .setAudioFormat(
                        AudioFormat.Builder()
                            .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                            .setSampleRate(sampleRate)
                            .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                            .build()
                    )
                    .setBufferSizeInBytes(bufferSize)
                    .setTransferMode(AudioTrack.MODE_STATIC)
                    .build()

                // Apply gain
                if (gain != 1.0f) {
                    val scaled = ShortArray(samples.size) { i ->
                        (samples[i] * gain).toInt().coerceIn(-32768, 32767).toShort()
                    }
                    audioTrack.write(scaled, 0, scaled.size)
                } else {
                    audioTrack.write(samples, 0, samples.size)
                }

                audioTrack.play()
                val durationMs = (samples.size.toFloat() / sampleRate * 1000).toLong() + 50
                delay(durationMs)
                audioTrack.stop()
                audioTrack.release()
            } catch (_: Exception) {}
        }
    }

    /**
     * 🎺 Grand Victory Fanfare (Plays on quiz victory & level complete)
     * Upbeat ascending major arpeggios + triumphal chord fanfare!
     */
    fun playVictoryFanfare() {
        scope.launch {
            // Notes: C5 (523Hz), E5 (659Hz), G5 (784Hz), C6 (1046Hz), rest, G5, C6 sustain
            val notes = listOf(
                Pair(523.25f, 110),
                Pair(659.25f, 110),
                Pair(783.99f, 110),
                Pair(1046.50f, 220),
                Pair(0f, 40),
                Pair(783.99f, 120),
                Pair(1046.50f, 450)
            )
            val totalDurationMs = notes.sumOf { it.second }
            val totalSamples = (SAMPLE_RATE * (totalDurationMs / 1000.0)).toInt()
            val buffer = ShortArray(totalSamples)

            var sampleOffset = 0
            for ((freq, durMs) in notes) {
                val numSamples = (SAMPLE_RATE * (durMs / 1000.0)).toInt()
                for (i in 0 until numSamples) {
                    if (sampleOffset + i < buffer.size) {
                        if (freq > 0) {
                            // Triangle/Sine harmonic combination for brass feel
                            val t = (sampleOffset + i).toDouble() / SAMPLE_RATE
                            val wave = (sin(2.0 * Math.PI * freq * t) * 0.7 + sin(4.0 * Math.PI * freq * t) * 0.3)
                            // Envelope decay
                            val env = (1.0 - (i.toDouble() / numSamples) * 0.35)
                            buffer[sampleOffset + i] = (wave * env * 24000).toInt().toShort()
                        } else {
                            buffer[sampleOffset + i] = 0
                        }
                    }
                }
                sampleOffset += numSamples
            }
            playPcm(buffer, gain = 0.95f)
        }
    }

    /**
     * 🔫 Arcade Laser Shoot sound (Frequency slide down)
     */
    fun playLaserShoot() {
        scope.launch {
            val durMs = 120
            val samples = (SAMPLE_RATE * (durMs / 1000.0)).toInt()
            val buffer = ShortArray(samples)
            for (i in 0 until samples) {
                val progress = i.toDouble() / samples
                val freq = 1200.0 - (progress * 900.0) // 1200Hz down to 300Hz
                val t = i.toDouble() / SAMPLE_RATE
                val wave = sin(2.0 * Math.PI * freq * t)
                val env = 1.0 - progress
                buffer[i] = (wave * env * 22000).toInt().toShort()
            }
            playPcm(buffer, gain = 0.9f)
        }
    }

    /**
     * 💥 Asteroid / Block Explosion Blast sound
     */
    fun playExplosion() {
        scope.launch {
            val durMs = 280
            val samples = (SAMPLE_RATE * (durMs / 1000.0)).toInt()
            val buffer = ShortArray(samples)
            val random = java.util.Random(42)
            for (i in 0 until samples) {
                val progress = i.toDouble() / samples
                val noise = (random.nextDouble() * 2.0 - 1.0)
                val lowFreq = sin(2.0 * Math.PI * (120.0 - progress * 80.0) * (i.toDouble() / SAMPLE_RATE))
                val wave = (noise * 0.65 + lowFreq * 0.35)
                val env = Math.exp(-progress * 5.0) // exponential decay
                buffer[i] = (wave * env * 26000).toInt().toShort()
            }
            playPcm(buffer, gain = 0.95f)
        }
    }

    /**
     * 🍬 Word Crush / Candy Pop Combo Chime
     */
    fun playWordCrushPop(combo: Int = 1) {
        scope.launch {
            val baseFreq = 587.33f + (combo * 70f) // D5 base + pitch scaling
            val notes = listOf(
                Pair(baseFreq, 60),
                Pair(baseFreq * 1.25f, 60),
                Pair(baseFreq * 1.5f, 130)
            )
            val durMs = 250
            val totalSamples = (SAMPLE_RATE * (durMs / 1000.0)).toInt()
            val buffer = ShortArray(totalSamples)

            var offset = 0
            for ((f, d) in notes) {
                val count = (SAMPLE_RATE * (d / 1000.0)).toInt()
                for (i in 0 until count) {
                    if (offset + i < buffer.size) {
                        val t = (offset + i).toDouble() / SAMPLE_RATE
                        val wave = sin(2.0 * Math.PI * f * t)
                        val env = 1.0 - (i.toDouble() / count) * 0.6
                        buffer[offset + i] = (wave * env * 24000).toInt().toShort()
                    }
                }
                offset += count
            }
            playPcm(buffer, gain = 0.9f)
        }
    }

    /**
     * ❌ Wrong / Shield Damage Buzzer
     */
    fun playDamageBuzzer() {
        scope.launch {
            val durMs = 200
            val samples = (SAMPLE_RATE * (durMs / 1000.0)).toInt()
            val buffer = ShortArray(samples)
            for (i in 0 until samples) {
                val t = i.toDouble() / SAMPLE_RATE
                // Harsh square/saw wave at 110Hz (A2)
                val wave = if (sin(2.0 * Math.PI * 110.0 * t) > 0) 0.8 else -0.8
                val env = 1.0 - (i.toDouble() / samples) * 0.4
                buffer[i] = (wave * env * 20000).toInt().toShort()
            }
            playPcm(buffer, gain = 0.8f)
        }
    }

    /**
     * ⭐ Star Collect / Level Step Bell
     */
    fun playStarChime() {
        scope.launch {
            val notes = listOf(Pair(880f, 70), Pair(1174.66f, 150))
            val totalSamples = (SAMPLE_RATE * 0.22).toInt()
            val buffer = ShortArray(totalSamples)
            var offset = 0
            for ((f, d) in notes) {
                val count = (SAMPLE_RATE * (d / 1000.0)).toInt()
                for (i in 0 until count) {
                    if (offset + i < buffer.size) {
                        val t = (offset + i).toDouble() / SAMPLE_RATE
                        val wave = sin(2.0 * Math.PI * f * t)
                        val env = Math.exp(- (i.toDouble() / count) * 2.5)
                        buffer[offset + i] = (wave * env * 25000).toInt().toShort()
                    }
                }
                offset += count
            }
            playPcm(buffer, gain = 0.9f)
        }
    }
}
