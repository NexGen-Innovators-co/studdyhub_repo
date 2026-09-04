package com.example.data.remote

import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.TimeUnit

/**
 * Checks the GitHub Releases API for a newer version of the app.
 *
 * Fixes applied vs original implementation:
 *  1. Uses /releases?per_page=5 instead of /releases/latest — the /latest endpoint
 *     returns HTTP 404 for pre-release (beta) tags, so beta users never saw updates.
 *  2. Adds User-Agent header — GitHub API can reject requests without it (403).
 *  3. Adds releasePageUrl (HTML page) as a fallback when no APK asset is attached.
 *  4. Fixed isNewerVersion() to handle SemVer pre-release precedence correctly:
 *     a release without a pre-release label (1.0.0) is always > one with one (1.0.0-beta.1).
 *
 * Usage:
 *   val result = UpdateChecker.checkForUpdate()
 *   if (result != null && result.isNewer) { show update dialog }
 */
object UpdateChecker {

    private const val TAG = "UpdateChecker"

    // ─── Configure these for your repo ───────────────────────────────────────
    private const val GITHUB_OWNER = "NexGen-Innovators-co"
    private const val GITHUB_REPO  = "studdyhub_repo"
    // Use /releases list (per_page=5) — /releases/latest returns 404 for pre-releases
    private const val RELEASES_URL =
        "https://api.github.com/repos/$GITHUB_OWNER/$GITHUB_REPO/releases?per_page=5"

    private val client = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(10, TimeUnit.SECONDS)
        .build()

    data class UpdateResult(
        val tagName: String,           // e.g. "v1.0-beta.3"
        val versionName: String,       // e.g. "1.0-beta.3" (tag without 'v' prefix)
        val downloadUrl: String?,      // Direct APK asset URL if attached to release
        val releasePageUrl: String,    // GitHub HTML release page — fallback when no APK asset
        val releaseNotes: String?,     // Release body text
        val publishedAt: String?,      // ISO date string
        val isNewer: Boolean           // True if this version is newer than installed
    )

    /**
     * Compare two semantic version strings.
     *
     * Handles:
     *  - Pure numeric versions: "1.0.1" > "1.0.0"
     *  - Pre-release vs release: "1.0.0" > "1.0.0-beta.1" (SemVer §11)
     *  - Beta increments: "1.0-beta.2" > "1.0-beta.1"
     *
     * Returns true if [newer] is a strictly higher version than [current].
     */
    internal fun isNewerVersion(current: String, newer: String): Boolean {
        val cur = current.trimStart('v', 'V')
        val neu = newer.trimStart('v', 'V')

        // Split into numeric core and optional pre-release label
        // e.g. "1.0-beta.2" → core="1.0", pre="beta.2"
        //      "1.0.1"      → core="1.0.1", pre=null
        val corePreRegex = Regex("^([0-9]+(?:\\.[0-9]+)*)(?:[\\-.](.+))?$")
        val curMatch = corePreRegex.find(cur)
        val neuMatch = corePreRegex.find(neu)

        val curCore = curMatch?.groupValues?.getOrNull(1) ?: cur
        val neuCore = neuMatch?.groupValues?.getOrNull(1) ?: neu
        val curPre  = curMatch?.groupValues?.getOrNull(2)?.takeIf { it.isNotEmpty() }
        val neuPre  = neuMatch?.groupValues?.getOrNull(2)?.takeIf { it.isNotEmpty() }

        // 1. Compare numeric core segments
        val curParts = curCore.split(".").map { it.toIntOrNull() ?: 0 }
        val neuParts = neuCore.split(".").map { it.toIntOrNull() ?: 0 }
        val maxLen   = maxOf(curParts.size, neuParts.size)
        for (i in 0 until maxLen) {
            val c = curParts.getOrElse(i) { 0 }
            val n = neuParts.getOrElse(i) { 0 }
            if (n > c) return true
            if (n < c) return false
        }

        // 2. Cores are equal — apply SemVer pre-release precedence:
        //    release (no pre) > pre-release (has pre)
        return when {
            curPre != null && neuPre == null -> true   // newer is a full release, current is pre
            curPre == null && neuPre != null -> false  // current is full release, newer is pre
            curPre == null && neuPre == null -> false  // same full release
            else -> {
                // Both have pre-release labels — compare lexicographically segment by segment
                val cParts = curPre!!.split(Regex("[^a-zA-Z0-9]+"))
                val nParts = neuPre!!.split(Regex("[^a-zA-Z0-9]+"))
                val pLen = maxOf(cParts.size, nParts.size)
                for (i in 0 until pLen) {
                    val c = cParts.getOrElse(i) { "0" }
                    val n = nParts.getOrElse(i) { "0" }
                    val cNum = c.toIntOrNull()
                    val nNum = n.toIntOrNull()
                    if (cNum != null && nNum != null) {
                        if (nNum > cNum) return true
                        if (nNum < cNum) return false
                    } else {
                        val cmp = c.compareTo(n, ignoreCase = true)
                        if (cmp < 0) return true
                        if (cmp > 0) return false
                    }
                }
                false
            }
        }
    }

    /**
     * Fetches the list of recent GitHub releases and returns the first non-draft release
     * that is newer than the currently installed version.
     * Call from a coroutine scope. Returns null on network error or if no update is available.
     */
    suspend fun checkForUpdate(): UpdateResult? = withContext(Dispatchers.IO) {
        try {
            val currentVersion = com.example.BuildConfig.VERSION_NAME
            Log.d(TAG, "Checking for update... current=$currentVersion")

            val request = Request.Builder()
                .url(RELEASES_URL)
                .header("Accept", "application/vnd.github+json")
                .header("X-GitHub-Api-Version", "2022-11-28")
                // Required by GitHub API — without this header requests may be rejected with 403
                .header("User-Agent", "StuddyHub-Android/$currentVersion")
                .build()

            val response = client.newCall(request).execute()
            if (!response.isSuccessful) {
                Log.w(TAG, "GitHub API returned ${response.code}")
                return@withContext null
            }

            val body = response.body?.string() ?: return@withContext null
            val releases = JSONArray(body)

            // Iterate releases to find the first non-draft one (includes pre-releases)
            for (i in 0 until releases.length()) {
                val json: JSONObject = releases.getJSONObject(i)
                val isDraft = json.optBoolean("draft", false)
                if (isDraft) continue  // Skip drafts

                val tagName      = json.optString("tag_name", "")
                val versionName  = tagName.trimStart('v', 'V')
                val releaseNotes = json.optString("body", "")
                val publishedAt  = json.optString("published_at", "")
                val htmlUrl      = json.optString("html_url", "")

                // Find the APK asset
                val assets = json.optJSONArray("assets")
                var apkUrl: String? = null
                if (assets != null) {
                    for (j in 0 until assets.length()) {
                        val asset = assets.getJSONObject(j)
                        if (asset.optString("name", "").endsWith(".apk")) {
                            apkUrl = asset.optString("browser_download_url")
                            break
                        }
                    }
                }

                val newer = isNewerVersion(currentVersion, versionName)
                Log.d(TAG, "Release: $tagName, newer=$newer, hasApk=${apkUrl != null}")

                if (newer) {
                    return@withContext UpdateResult(
                        tagName        = tagName,
                        versionName    = versionName,
                        downloadUrl    = apkUrl,
                        releasePageUrl = htmlUrl,
                        releaseNotes   = releaseNotes.ifBlank { null },
                        publishedAt    = publishedAt.ifBlank { null },
                        isNewer        = true
                    )
                }

                // Only check the most recent non-draft release
                break
            }

            null // Already up to date
        } catch (e: Exception) {
            Log.w(TAG, "Update check failed: ${e.message}")
            null
        }
    }
}
