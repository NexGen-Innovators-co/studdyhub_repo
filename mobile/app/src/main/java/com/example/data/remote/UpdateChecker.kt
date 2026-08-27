package com.example.data.remote

import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import java.util.concurrent.TimeUnit

/**
 * Checks the GitHub Releases API for a newer version of the app.
 *
 * Usage:
 *   val result = UpdateChecker.checkForUpdate()
 *   if (result != null && result.isNewer) { show update dialog }
 */
object UpdateChecker {

    private const val TAG = "UpdateChecker"

    // ─── Configure these for your repo ───────────────────────────────────
    private const val GITHUB_OWNER = "NexGen-Innovators-co"  // GitHub org/user
    private const val GITHUB_REPO = "studdyhub_repo"          // GitHub repo name
    private const val RELEASE_URL = "https://api.github.com/repos/$GITHUB_OWNER/$GITHUB_REPO/releases/latest"

    private val client = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(10, TimeUnit.SECONDS)
        .build()

    data class UpdateResult(
        val tagName: String,          // e.g. "v1.0-beta.2"
        val versionName: String,      // e.g. "1.0-beta.2" (tag without 'v' prefix)
        val downloadUrl: String?,     // Direct APK download URL
        val releaseNotes: String?,    // Release body text
        val publishedAt: String?,     // ISO date string
        val isNewer: Boolean          // True if this version is newer than installed
    )

    /**
     * Compare two semantic version strings like "1.0-beta.1" vs "1.0-beta.2".
     * Returns true if [newer] is a higher version than [current].
     */
    private fun isNewerVersion(current: String, newer: String): Boolean {
        // Strip common prefixes
        val cur = current.trimStart('v', 'V')
        val neu = newer.trimStart('v', 'V')

        // Split on non-alphanumeric to compare segments
        val curParts = cur.split(Regex("[^a-zA-Z0-9]+"))
        val neuParts = neu.split(Regex("[^a-zA-Z0-9]+"))

        val maxLen = maxOf(curParts.size, neuParts.size)
        for (i in 0 until maxLen) {
            val c = curParts.getOrElse(i) { "0" }
            val n = neuParts.getOrElse(i) { "0" }

            val cNum = c.toIntOrNull()
            val nNum = n.toIntOrNull()

            if (cNum != null && nNum != null) {
                if (nNum > cNum) return true
                if (nNum < cNum) return false
            } else {
                // String comparison for pre-release labels
                val cmp = c.compareTo(n, ignoreCase = true)
                if (cmp < 0) return true
                if (cmp > 0) return false
            }
        }
        return false
    }

    /**
     * Call from a coroutine scope. Returns null on network error or if no update is available.
     */
    suspend fun checkForUpdate(): UpdateResult? = withContext(Dispatchers.IO) {
        try {
            val currentVersion = com.example.BuildConfig.VERSION_NAME
            Log.d(TAG, "Checking for update... current=$currentVersion")

            val request = Request.Builder()
                .url(RELEASE_URL)
                .header("Accept", "application/vnd.github+json")
                .header("X-GitHub-Api-Version", "2022-11-28")
                .build()

            val response = client.newCall(request).execute()
            if (!response.isSuccessful) {
                Log.w(TAG, "GitHub API returned ${response.code}")
                return@withContext null
            }

            val body = response.body?.string() ?: return@withContext null
            val json = JSONObject(body)

            val tagName = json.optString("tag_name", "")
            val versionName = tagName.trimStart('v', 'V')
            val releaseNotes = json.optString("body", "")
            val publishedAt = json.optString("published_at", "")

            // Find the APK asset
            val assets = json.optJSONArray("assets")
            var apkUrl: String? = null
            if (assets != null) {
                for (i in 0 until assets.length()) {
                    val asset = assets.getJSONObject(i)
                    val name = asset.optString("name", "")
                    if (name.endsWith(".apk")) {
                        apkUrl = asset.optString("browser_download_url")
                        break
                    }
                }
            }

            val newer = isNewerVersion(currentVersion, versionName)
            Log.d(TAG, "Latest release: $tagName, newer=$newer")

            if (newer) {
                UpdateResult(
                    tagName = tagName,
                    versionName = versionName,
                    downloadUrl = apkUrl,
                    releaseNotes = releaseNotes.ifBlank { null },
                    publishedAt = publishedAt.ifBlank { null },
                    isNewer = true
                )
            } else {
                null // Already up to date
            }
        } catch (e: Exception) {
            Log.w(TAG, "Update check failed: ${e.message}")
            null
        }
    }
}
