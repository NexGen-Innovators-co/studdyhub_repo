package com.example.util

import android.app.ActivityManager
import android.content.Context

/**
 * One-time, cached detection of low-end devices so heavy UI effects (infinite animations,
 * glow/aura brushes, elevation shadows) can be disabled where they cause the most jank.
 *
 * A device is considered low-end when it has a small ART heap (memoryClass <= 128MB,
 * typical of budget/entry devices) or very few CPU cores (<= 4). Everything is computed
 * once and cached for the process lifetime.
 */
object DevicePerf {

    @Volatile
    private var cached: Boolean? = null

    /** True when the current device should skip expensive animations/effects. */
    val isLowEndDevice: Boolean
        get() {
            cached?.let { return it }
            val result = detectLowEnd()
            cached = result
            return result
        }

    private fun detectLowEnd(): Boolean {
        val lowRam = try {
            val am = com.example.data.local.StuddyHubDatabase.appContext
                ?.getSystemService(Context.ACTIVITY_SERVICE) as? ActivityManager
            (am?.memoryClass ?: 256) <= 128
        } catch (_: Exception) {
            false
        }
        val lowCores = try {
            Runtime.getRuntime().availableProcessors() <= 4
        } catch (_: Exception) {
            false
        }
        return lowRam || lowCores
    }
}
