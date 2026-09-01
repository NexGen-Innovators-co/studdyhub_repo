package com.example.data.remote

import android.util.Log
import com.example.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.TimeUnit

sealed class BackendResult<out T> {
    data class Success<out T>(val data: T) : BackendResult<T>()
    data class Error(val message: String, val code: Int? = null) : BackendResult<Nothing>()

    fun getOrNull(): T? = when (this) {
        is Success -> data
        is Error -> null
    }

    fun isSuccess(): Boolean = this is Success
}

object BackendApiService {

    private const val TAG = "BackendApiService"

    // Strict backend diagnostic logging tag — every outgoing Supabase / edge-function call and its
    // response status code is written under this tag so Logcat filters can trace the whole request
    // lifecycle ([BACKEND-API] <METHOD> <url> → HTTP <code>). Headers and payload bodies stay
    // debug-only (they can contain tokens and user content).
    private const val BACKEND_API_TAG = "BACKEND-API"

    // document-processor refuses to inline base64 above ~7MB (it needs a storage URL and resumable
    // extraction instead). Stay under that with headroom for base64's 33% expansion.
    private const val INLINE_BASE64_MAX_BYTES = 5 * 1024 * 1024
    // Each resume-processing call extracts one chunk; cap the loop so a stuck document can't spin.
    private const val MAX_RESUME_CALLS = 12

    @Volatile var userAccessToken: String? = null
    // Supabase refresh token (rotates on every refresh) + epoch-millis expiry of the access token.
    @Volatile var refreshToken: String? = null
    @Volatile var tokenExpiresAt: Long = 0L
    @Volatile var currentUserId: String? = null

    // Invoked after a successful token refresh so the rotated refresh token can be persisted
    // locally (the old one is invalidated server-side, so without persistence the next app
    // restart would fail to renew and force a logout). Registered by StuddyHubRepository.
    @Volatile var onSessionRefreshed: (suspend (accessToken: String?, refreshToken: String?, expiresAt: Long) -> Unit)? = null

    fun isGuestUser(): Boolean {
        return currentUserId.isNullOrBlank()
    }

    private val client = OkHttpClient.Builder()
        .connectTimeout(8, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .writeTimeout(15, TimeUnit.SECONDS)
        .build()

    /**
     * Extraction and generation functions run Gemini over a whole document, which routinely takes
     * well over a minute — the 20s default cancels them mid-flight and the client then falls back
     * as if the backend were unreachable. Uploads also need a generous write timeout because the
     * request body carries the file's base64 bytes.
     */
    private val longRunningClient = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(240, TimeUnit.SECONDS)
        .writeTimeout(120, TimeUnit.SECONDS)
        .build()

    private val LONG_RUNNING_FUNCTIONS = setOf(
        "document-processor",
        "resume-processing",
        "fetch-web-url",
        "generate-note-from-document",
        "analyze-document-structure",
        "document-extractor",
        "gemini-document-extractor",
        "generate-ai-quiz",
        "generate-quiz",
        "generate-flashcards",
        "generate-summary",
        "generate-roadmap",
        "gemini-audio-processor",
        "gemini-chat",
        "generate-podcast",
        "live-quiz",
        "generate-spelling-words",
        "generate-interactive-lesson"
    )

    /**
     * Verbose request/response logging is debug-only. Release builds must not write URLs,
     * payload shapes or backend error bodies to Logcat, where any app with read access
     * (or a bug report) could pick them up.
     */
    private val VERBOSE = BuildConfig.DEBUG

    private fun logd(message: String) {
        if (VERBOSE) Log.d(TAG, message)
    }

    /**
     * Strict [BACKEND-API] diagnostic log. Always logs the HTTP call + response status code so
     * missing/dead edge functions (404) or backend failures (500) surface in Logcat immediately.
     * Request payload/headers are only dumped in debug builds — they may carry tokens or content.
     */
    private fun logBackendApi(
        method: String,
        url: String,
        status: Int? = null,
        detail: String? = null
    ) {
        val statusPart = status?.let { " → HTTP $it" } ?: ""
        Log.d(BACKEND_API_TAG, "$method $url$statusPart")
        if (VERBOSE && !detail.isNullOrBlank()) {
            Log.d(BACKEND_API_TAG, "$method $url  $detail")
        }
    }

    /**
     * Logs a failure. In debug builds the full detail (URL, backend body) is written so the issue
     * can be diagnosed; in release only the terse [summary] is kept, so response bodies and query
     * strings never land in Logcat.
     */
    private fun loge(summary: String, detail: String? = null, t: Throwable? = null) {
        val line = if (VERBOSE && !detail.isNullOrBlank()) "$summary: $detail" else summary
        if (VERBOSE && t != null) Log.e(TAG, line, t) else Log.e(TAG, line)
    }

    fun getSupabaseUrl(): String {
        return try {
            val url = BuildConfig.VITE_SUPABASE_URL
            if (url.isNotBlank() && url != "VITE_SUPABASE_URL" && url.startsWith("http") && !url.contains("your-project")) {
                url.trimEnd('/')
            } else {
                Log.e(TAG, "Supabase URL is not configured. Check .env / build config.")
                ""
            }
        } catch (e: Exception) {
            Log.e(TAG, "Unable to read Supabase URL from build config.", e)
            ""
        }
    }

    fun getSupabaseAnonKey(): String {
        return try {
            val key = BuildConfig.VITE_SUPABASE_ANON_KEY
            if (key.isNotBlank() && key != "VITE_SUPABASE_ANON_KEY" && !key.contains("your_supabase_anon_key")) {
                key.trim()
            } else {
                Log.e(TAG, "Supabase anon key is not configured. Check .env / build config.")
                ""
            }
        } catch (e: Exception) {
            Log.e(TAG, "Unable to read Supabase anon key from build config.", e)
            ""
        }
    }

    fun isConfigured(): Boolean {
        return getSupabaseUrl().isNotBlank() && getSupabaseAnonKey().isNotBlank()
    }

    /** Current time as a UTC ISO-8601 string (used as a safe default when no date is supplied). */
    private fun currentUtcIso(): String =
        java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.US)
            .apply { timeZone = java.util.TimeZone.getTimeZone("UTC") }
            .format(java.util.Date())

    // ═══════════════════════════════════════════════════════════════════════════════
    // CLEAN TABLE CRUD HELPERS — map table names to REST endpoints
    // ═══════════════════════════════════════════════════════════════════════════════

    /** Map internal table names to REST endpoint paths. */
    private fun restPath(table: String): String = when (table) {
        "document_folders" -> "document-folders"
        "social_users" -> "social-users"
        "social_posts" -> "social/posts"
        "social_likes" -> "social/likes"
        "social_bookmarks" -> "social/bookmarks"
        "social_comments" -> "social/comments"
        "social_groups" -> "social/groups"
        "social_group_members" -> "social/group-members"
        "social_events" -> "social/events"
        "social_follows" -> "social/follows"
        "social_chat_messages" -> "social/chat-messages"
        "peer_cheers" -> "peer-cheers"
        "live_quiz_sessions" -> "live-quiz-sessions"
        "class_recordings" -> "class-recordings"
        "ai_podcasts" -> "ai-podcasts"
        "course_enrollments" -> "course-enrollments"
        "course_materials" -> "course-materials"
        "user_education_profiles" -> "user-education-profiles"
        "user_subjects" -> "user-subjects"
        "game_progress" -> "game-progress"
        "kid_roadmap_steps" -> "roadmap-steps"
        "quiz_attempts" -> "quiz-attempts"
        "user_stats" -> "user-stats"
        "chat_sessions" -> "chat/sessions"
        "chat_messages" -> "chat/messages"
        else -> table // notes, documents, flashcards, quizzes, schedule stay as-is
    }

    /** Build a query string from a map of params. */
    private fun buildQuery(params: Map<String, String>): String {
        if (params.isEmpty()) return ""
        return params.entries.joinToString("&") { "${it.key}=${java.net.URLEncoder.encode(it.value, "UTF-8")}" }
    }

    /**
     * Clean table GET via explicit REST endpoints.
     * Example: tableGet("notes", mapOf("folder_id" to folderId), order="updated_at.desc", limit=50)
     */
    suspend fun tableGet(
        table: String,
        filters: Map<String, String> = emptyMap(),
        order: String? = null,
        limit: Int? = null,
        offset: Int? = null
    ): BackendResult<JSONArray> {
        val params = mutableMapOf<String, String>()
        filters.forEach { (k, v) -> params[k] = v }
        if (order != null) params["order"] = order
        if (limit != null) params["limit"] = limit.toString()
        if (offset != null) params["offset"] = offset.toString()
        val endpoint = restPath(table) + if (params.isNotEmpty()) "?${buildQuery(params)}" else ""
        val result = executeApiGateway(endpoint, "GET")
        return when (result) {
            is BackendResult.Success -> BackendResult.Success(result.data.optJSONArray("data") ?: JSONArray())
            is BackendResult.Error -> BackendResult.Error(result.message, result.code)
        }
    }

    /**
     * Clean table POST via explicit REST endpoints.
     * Example: tablePost("notes", body)
     */
    suspend fun tablePost(
        table: String,
        body: JSONObject,
        onConflict: String? = null
    ): BackendResult<JSONObject> {
        // Gateway handles upsert automatically based on body content
        val result = executeApiGateway(restPath(table), "POST", body)
        return when (result) {
            is BackendResult.Success -> BackendResult.Success(result.data.optJSONObject("data") ?: result.data)
            is BackendResult.Error -> result
        }
    }

    /**
     * Clean table PATCH via explicit REST endpoints.
     * Example: tablePatch("documents", body, mapOf("id" to docId))
     */
    suspend fun tablePatch(
        table: String,
        body: JSONObject,
        filters: Map<String, String>
    ): BackendResult<JSONObject> {
        // Use ID-based path for single-item PATCH
        val id = filters["id"]
        val endpoint = if (id != null) "${restPath(table)}/$id" else restPath(table)
        val result = executeApiGateway(endpoint, "PATCH", body)
        return when (result) {
            is BackendResult.Success -> BackendResult.Success(result.data.optJSONObject("data") ?: result.data)
            is BackendResult.Error -> result
        }
    }

    /**
     * Clean table DELETE via explicit REST endpoints.
     * Example: tableDelete("social_likes", mapOf("post_id" to postId))
     */
    suspend fun tableDelete(
        table: String,
        filters: Map<String, String>
    ): BackendResult<Boolean> {
        val id = filters["id"]
        val endpoint = if (id != null) "${restPath(table)}/$id" else restPath(table)
        // For non-ID deletes, pass filters as query params
        val finalEndpoint = if (id == null && filters.isNotEmpty()) {
            "$endpoint?${buildQuery(filters)}"
        } else endpoint
        val result = executeApiGateway(finalEndpoint, "DELETE")
        return when (result) {
            is BackendResult.Success -> BackendResult.Success(true)
            is BackendResult.Error -> BackendResult.Error(result.message, result.code)
        }
    }

    suspend fun deleteDocument(documentId: String): BackendResult<Boolean> {
        return tableDelete("documents", mapOf("id" to documentId))
    }

    private fun parseSupabaseError(bodyStr: String, statusCode: Int): String {
        return try {
            if (bodyStr.isBlank()) {
                return when (statusCode) {
                    400 -> UserMessages.AUTH_INVALID_CREDENTIALS
                    401 -> "Authentication failed. Please sign in again."
                    403 -> UserMessages.NO_PERMISSION
                    404 -> UserMessages.NOT_FOUND
                    409 -> UserMessages.DUPLICATE
                    422 -> UserMessages.AUTH_WEAK_PASSWORD
                    429 -> UserMessages.AUTH_RATE_LIMIT
                    in 500..599 -> UserMessages.SERVER
                    else -> "Request failed (HTTP $statusCode)."
                }
            }
            val json = JSONObject(bodyStr)
            when {
                json.has("error_description") && json.getString("error_description").isNotBlank() ->
                    json.getString("error_description")
                json.has("message") && json.getString("message").isNotBlank() ->
                    json.getString("message")
                json.has("msg") && json.getString("msg").isNotBlank() ->
                    json.getString("msg")
                json.has("error_code") && json.getString("error_code").isNotBlank() ->
                    json.getString("error_code")
                json.has("error") -> {
                    val err = json.opt("error")
                    if (err is JSONObject) {
                        err.optString("message", err.optString("description", err.toString()))
                    } else if (err is String && err.isNotBlank()) {
                        err
                    } else {
                        bodyStr
                    }
                }
                json.has("details") && json.getString("details").isNotBlank() ->
                    json.getString("details")
                json.has("hint") && json.getString("hint").isNotBlank() ->
                    json.getString("hint")
                json.has("description") && json.getString("description").isNotBlank() ->
                    json.getString("description")
                else -> bodyStr
            }
        } catch (e: Exception) {
            when (statusCode) {
                400 -> UserMessages.AUTH_INVALID_CREDENTIALS
                401 -> "Authentication required. Please sign in."
                403 -> UserMessages.NO_PERMISSION
                404 -> UserMessages.NOT_FOUND
                409 -> UserMessages.DUPLICATE
                422 -> UserMessages.AUTH_WEAK_PASSWORD
                429 -> UserMessages.AUTH_RATE_LIMIT
                in 500..599 -> UserMessages.SERVER
                else -> "HTTP $statusCode: $bodyStr"
            }
        }
    }

    /**
     * Canonical, user-facing copy. Everything the user can read comes from here so the wording
     * stays consistent and so [userFacingErrorMessage] can recognise its own output and pass it
     * through unchanged (the sanitizer is idempotent).
     */
    object UserMessages {
        const val GENERIC = "Something went wrong. Please try again."
        const val SERVER = "We're having trouble reaching StuddyHub right now. Please try again in a moment."
        const val OFFLINE = "You appear to be offline. Please check your internet connection and try again."
        const val NOT_READY = "StuddyHub's services aren't ready yet. Please try again shortly."
        const val SESSION_EXPIRED = "Your session has expired. Please sign in again."
        const val SIGNED_OUT = "Please sign in to continue."
        const val NO_PERMISSION = "You don't have permission to do this."
        const val DUPLICATE = "This already exists — no need to add it again."
        const val NOT_FOUND = "We couldn't find that. It may have been removed."
        const val AI_NO_RESPONSE = "The AI couldn't finish that request. Please try again."
        const val UPLOAD_FAILED = "We couldn't upload that file. Please try again."
        const val QUIZ_GENERATION_FAILED = "Ollie couldn't make those questions right now. Let's try again!"
        const val SPELLING_FAILED = "Ollie couldn't generate those words. Please try again!"
        const val LESSON_FAILED = "Ollie couldn't prepare this lesson. Please try again!"
        const val QUESTIONS_FAILED = "Something went wrong loading the questions. Let's try again!"
        const val LIVE_QUIZ_FAILED = "The live quiz ran into a problem. Please try rejoining!"

        const val AUTH_INVALID_CREDENTIALS = "That email or password doesn't look right. Please try again."
        const val AUTH_EMAIL_NOT_CONFIRMED = "Your email hasn't been confirmed yet. We're sending you a new verification code now."
        const val AUTH_ACCOUNT_EXISTS = "An account with this email already exists. Try signing in instead."
        const val AUTH_WEAK_PASSWORD = "Please choose a stronger password (at least 6 characters)."
        const val AUTH_INVALID_EMAIL = "Please enter a valid email address."
        const val AUTH_RATE_LIMIT = "Too many attempts. Please wait a moment and try again."
        const val AUTH_INVALID_OTP = "Verification code is invalid or has expired. Please try again."

        /** Messages this class authored — safe to show again without re-sanitising. */
        val known: Set<String> = setOf(
            GENERIC, SERVER, OFFLINE, NOT_READY, SESSION_EXPIRED, SIGNED_OUT,
            NO_PERMISSION, DUPLICATE, NOT_FOUND, AI_NO_RESPONSE, UPLOAD_FAILED,
            QUIZ_GENERATION_FAILED, SPELLING_FAILED, LESSON_FAILED, QUESTIONS_FAILED, LIVE_QUIZ_FAILED,
            AUTH_INVALID_CREDENTIALS, AUTH_EMAIL_NOT_CONFIRMED, AUTH_ACCOUNT_EXISTS,
            AUTH_WEAK_PASSWORD, AUTH_INVALID_EMAIL, AUTH_RATE_LIMIT, AUTH_INVALID_OTP
        )
    }

    /**
     * Converts raw backend/database/network error text into short, friendly copy that is safe to
     * show a user.
     *
     * This is deny-by-default on purpose: anything not recognised as either our own copy or a
     * known-friendly auth validation message collapses to a generic line. Backend errors are
     * open-ended (Postgres, PostgREST, GoTrue, edge functions, OkHttp), so an allowlist is the
     * only way to guarantee that stack traces, SQL text, URLs, tokens or config names never
     * reach the screen. The full raw message is still written to Logcat by callers for debugging.
     */
    fun userFacingErrorMessage(raw: String?): String {
        val msg = raw?.trim().orEmpty()
        if (msg.isBlank()) return UserMessages.GENERIC

        // Already our own copy (sanitizer may run more than once across layers).
        if (msg in UserMessages.known) return msg

        val lower = msg.lowercase()

        // Connectivity — worth telling the user, they can act on it.
        if (lower.contains("network") || lower.contains("timeout") || lower.contains("timed out") ||
            lower.contains("failed to connect") || lower.contains("unable to resolve host") ||
            lower.contains("eofexception") || lower.contains("socket") ||
            lower.contains("connection refused") || lower.contains("unreachable") ||
            lower.contains("no address associated") || lower.contains("unknownhost") ||
            lower.contains("connectexception") || lower.contains("sslhandshake") ||
            lower.contains("no internet")
        ) return UserMessages.OFFLINE

        // Auth/session — actionable, and phrased for humans rather than echoing GoTrue.
        if (lower.contains("invalid login credentials") || lower.contains("invalid email or password") ||
            lower.contains("invalid_grant") || lower.contains("invalid credentials") ||
            lower.contains("invalid_credentials") || lower.contains("wrong password") ||
            lower.contains("incorrect password") || lower.contains("invalid password") ||
            lower.contains("bad credentials") || lower.contains("login credentials are invalid") ||
            lower.contains("no user found") || lower.contains("user not found") ||
            lower.contains("user_not_found") || lower.contains("profile not found") ||
            lower.contains("that email or password doesn't look right")
        ) {
            return UserMessages.AUTH_INVALID_CREDENTIALS
        }

        // Email confirmation
        if (lower.contains("email not confirmed") || lower.contains("email_not_confirmed") ||
            lower.contains("unconfirmed") || lower.contains("email_address_not_authorized")
        ) {
            return UserMessages.AUTH_EMAIL_NOT_CONFIRMED
        }

        // Account already exists
        if (lower.contains("already registered") || lower.contains("user already") ||
            lower.contains("user_already_exists") || lower.contains("already in use") ||
            lower.contains("already taken") || lower.contains("email already exists") ||
            lower.contains("account with this email already exists")
        ) {
            return UserMessages.AUTH_ACCOUNT_EXISTS
        }

        // Rate limiting
        if (lower.contains("rate limit") || lower.contains("too many attempts") ||
            lower.contains("too many requests") || lower.contains("over email send rate limit") ||
            lower.contains("over_email_send_rate_limit") || lower.contains("security purposes") ||
            lower.contains("slow down") || lower.contains("http 429")
        ) {
            return UserMessages.AUTH_RATE_LIMIT
        }

        // OTP / Token validation
        if (lower.contains("otp expired") || lower.contains("otp_expired") ||
            lower.contains("invalid otp") || lower.contains("token has expired or is invalid") ||
            lower.contains("verification code is invalid") || lower.contains("token is invalid") ||
            lower.contains("token expired") || lower.contains("invalid token")
        ) {
            return UserMessages.AUTH_INVALID_OTP
        }

        // Password strength
        if (lower.contains("password should") || lower.contains("password must") ||
            lower.contains("weak password") || lower.contains("password is too short") ||
            lower.contains("at least 6 characters")
        ) {
            return UserMessages.AUTH_WEAK_PASSWORD
        }

        // Email format
        if (lower.contains("invalid email") || lower.contains("unable to validate email") ||
            lower.contains("valid email")
        ) {
            return UserMessages.AUTH_INVALID_EMAIL
        }

        // Session / Tokens
        if (lower.contains("jwt") || lower.contains("token has expired") ||
            lower.contains("session expired") || lower.contains("unauthorized") ||
            lower.contains("refresh_token_not_found") || lower.contains("bad_jwt") ||
            lower.contains("http 401")
        ) {
            return UserMessages.SESSION_EXPIRED
        }

        // Permission.
        if (lower.contains("permission denied") || lower.contains("row-level security") ||
            lower.contains("new row violates") || lower.contains("forbidden") ||
            lower.contains("not allowed") || lower.contains("http 403")
        ) return UserMessages.NO_PERMISSION

        // Conflicts.
        if (lower.contains("duplicate key") || lower.contains("already exists") ||
            lower.contains("http 409")
        ) return UserMessages.DUPLICATE

        // Not found.
        if (lower.contains("not found") || lower.contains("could not find") ||
            lower.contains("pgrst116") || lower.contains("http 404")
        ) return UserMessages.NOT_FOUND

        // AI failures
        if (lower.contains("ai error") || lower.contains("gemini") ||
            lower.contains("couldn't finish that request")
        ) return UserMessages.AI_NO_RESPONSE

        // Upload failures
        if (lower.contains("upload failed") || lower.contains("failed to upload")) {
            return UserMessages.UPLOAD_FAILED
        }

        // Clean user-friendly message passthrough (if it's not a database query or stack trace)
        val isTechnical = lower.contains("org.postgresql") || lower.contains("java.") ||
                lower.contains("fatal:") || lower.contains("select ") || lower.contains("insert into") ||
                lower.contains("update ") || lower.contains("delete from") || lower.contains("syntax error") ||
                lower.contains("nullpointer") || lower.contains("exception:") || lower.contains("http 5")

        if (!isTechnical && msg.length in 5..120 && !msg.startsWith("{") && !msg.startsWith("[")) {
            return msg
        }

        // Everything else — server-side faults get the softer "our end" wording.
        return UserMessages.SERVER
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // AUTHENTICATION (SUPABASE GOTRUE API)
    // ─────────────────────────────────────────────────────────────────────────────
    suspend fun supabaseSignUp(
        email: String,
        password: String,
        fullName: String,
        school: String
    ): BackendResult<JSONObject> = withContext(Dispatchers.IO) {
        val baseUrl = getSupabaseUrl()
        val anonKey = getSupabaseAnonKey()

        logd("[AUTH] supabaseSignUp called")

        if (baseUrl.isBlank() || anonKey.isBlank()) {
            Log.e(TAG, "[AUTH] Sign-up blocked: Supabase credentials not configured")
            return@withContext BackendResult.Error(UserMessages.NOT_READY)
        }

        val url = "$baseUrl/auth/v1/signup"
        Log.d(TAG, "[AUTH] POST $url")
        val payload = JSONObject().apply {
            put("email", email)
            put("password", password)
            put("data", JSONObject().apply {
                put("full_name", fullName)
                put("school", school)
            })
        }

        val mediaType = "application/json".toMediaType()
        val requestBody = payload.toString().toRequestBody(mediaType)

        val request = Request.Builder()
            .url(url)
            .addHeader("apikey", anonKey)
            .addHeader("Authorization", "Bearer $anonKey")
            .addHeader("Content-Type", "application/json")
            .post(requestBody)
            .build()

        try {
            val response = client.newCall(request).execute()
            val responseCode = response.code
            val responseString = response.body?.string() ?: ""

            if (response.isSuccessful && responseString.isNotBlank()) {
                val json = JSONObject(responseString)
                // Capture access token, refresh token, expiry, and user id from the session response
                // (refresh token + expiry are required for silent session renewal on later launches).
                captureSession(json)
                val userId = currentUserId

                // Try upserting user profile into public.profiles database table if token available or fallback
                if (!userId.isNullOrBlank()) {
                    val profilePayload = JSONObject().apply {
                        put("id", userId)
                        put("email", email)
                        put("full_name", fullName)
                        put("school", school)
                        put("user_role", "student")
                    }
                    val profileRes = tablePost("profiles", profilePayload)
                    if (profileRes is BackendResult.Error) {
                        Log.w(TAG, "Profile client-side upsert note (database trigger may handle this): ${profileRes.message}")
                    }

                    // ✅ Also ensure social_users profile exists immediately on signup
                    val socialRes = ensureSocialUserExists(userId, fullName)
                    if (socialRes is BackendResult.Error) {
                        Log.w(TAG, "Social user creation note: ${socialRes.message}")
                    }
                }

                return@withContext BackendResult.Success(json)
            } else {
                val errMsg = parseSupabaseError(responseString, responseCode)
                return@withContext BackendResult.Error(userFacingErrorMessage(errMsg), responseCode)
            }
        } catch (e: Exception) {
            val err = "Network error signing up with Supabase: ${e.localizedMessage ?: e.message}"
            Log.e(TAG, err, e)
            return@withContext BackendResult.Error(userFacingErrorMessage(err))
        }
    }

    suspend fun supabaseSignIn(
        email: String,
        password: String
    ): BackendResult<JSONObject> = withContext(Dispatchers.IO) {
        val baseUrl = getSupabaseUrl()
        val anonKey = getSupabaseAnonKey()

        logd("[AUTH] supabaseSignIn called")

        if (baseUrl.isBlank() || anonKey.isBlank()) {
            Log.e(TAG, "[AUTH] Sign-in blocked: Supabase credentials not configured")
            return@withContext BackendResult.Error(UserMessages.NOT_READY)
        }

        val url = "$baseUrl/auth/v1/token?grant_type=password"
        Log.d(TAG, "[AUTH] POST $url")
        val payload = JSONObject().apply {
            put("email", email)
            put("password", password)
        }

        val mediaType = "application/json".toMediaType()
        val requestBody = payload.toString().toRequestBody(mediaType)

        val request = Request.Builder()
            .url(url)
            .addHeader("apikey", anonKey)
            .addHeader("Authorization", "Bearer $anonKey")
            .addHeader("Content-Type", "application/json")
            .post(requestBody)
            .build()

        try {
            val response = client.newCall(request).execute()
            val responseCode = response.code
            val responseString = response.body?.string() ?: ""

            if (response.isSuccessful && responseString.isNotBlank()) {
                val json = JSONObject(responseString)
                // Capture access token, refresh token, expiry, and user id from the session response
                // (refresh token + expiry are required for silent session renewal on later launches).
                captureSession(json)
                return@withContext BackendResult.Success(json)
            } else {
                val errMsg = parseSupabaseError(responseString, responseCode)
                return@withContext BackendResult.Error(userFacingErrorMessage(errMsg), responseCode)
            }
        } catch (e: Exception) {
            val err = "Network error signing in with Supabase: ${e.localizedMessage ?: e.message}"
            Log.e(TAG, err, e)
            return@withContext BackendResult.Error(userFacingErrorMessage(err))
        }
    }

    /**
     * Requests a password-recovery email via GoTrue's recover endpoint. Supabase sends the
     * reset link to the address if an account exists (and returns 200 regardless, so this
     * never leaks whether an account exists). A 2xx is treated as success even though the
     * response body is empty.
     */
    suspend fun supabaseResetPassword(email: String): BackendResult<JSONObject> = withContext(Dispatchers.IO) {
        val baseUrl = getSupabaseUrl()
        val anonKey = getSupabaseAnonKey()

        logd("[AUTH] supabaseResetPassword called")

        if (baseUrl.isBlank() || anonKey.isBlank()) {
            Log.e(TAG, "[AUTH] Password reset blocked: Supabase credentials not configured")
            return@withContext BackendResult.Error(UserMessages.NOT_READY)
        }

        val url = "$baseUrl/auth/v1/recover"
        Log.d(TAG, "[AUTH] POST $url")
        val payload = JSONObject().apply { put("email", email) }

        val mediaType = "application/json".toMediaType()
        val requestBody = payload.toString().toRequestBody(mediaType)

        val request = Request.Builder()
            .url(url)
            .addHeader("apikey", anonKey)
            .addHeader("Authorization", "Bearer $anonKey")
            .addHeader("Content-Type", "application/json")
            .post(requestBody)
            .build()

        try {
            val response = client.newCall(request).execute()
            val responseCode = response.code
            val responseString = response.body?.string() ?: ""

            if (response.isSuccessful) {
                val json = if (responseString.isNotBlank()) JSONObject(responseString) else JSONObject()
                return@withContext BackendResult.Success(json)
            } else {
                val errMsg = parseSupabaseError(responseString, responseCode)
                return@withContext BackendResult.Error(userFacingErrorMessage(errMsg), responseCode)
            }
        } catch (e: Exception) {
            val err = "Network error requesting password reset: ${e.localizedMessage ?: e.message}"
            Log.e(TAG, err, e)
            return@withContext BackendResult.Error(userFacingErrorMessage(err))
        }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // IN-APP EMAIL VERIFICATION (OTP)
    // ─────────────────────────────────────────────────────────────────────────────

    /**
     * Send an OTP code to the user's email for in-app verification.
     * Uses Supabase's /auth/v1/otp endpoint. The user does NOT need to leave the app.
     * @param createUser if true, creates the user (first call after signup);
     *                   if false, the user already exists (resend / password reset).
     */
    suspend fun sendOtpCode(
        email: String,
        createUser: Boolean = false
    ): BackendResult<JSONObject> = withContext(Dispatchers.IO) {
        val baseUrl = getSupabaseUrl()
        val anonKey = getSupabaseAnonKey()

        logd("[AUTH] sendOtpCode called for $email (createUser=$createUser)")

        if (baseUrl.isBlank() || anonKey.isBlank()) {
            return@withContext BackendResult.Error(UserMessages.NOT_READY)
        }

        val url = "$baseUrl/auth/v1/otp"
        val payload = JSONObject().apply {
            put("email", email)
            put("shouldCreateUser", createUser)
            put("type", "signup")
        }

        val mediaType = "application/json".toMediaType()
        val requestBody = payload.toString().toRequestBody(mediaType)

        val request = Request.Builder()
            .url(url)
            .addHeader("apikey", anonKey)
            .addHeader("Authorization", "Bearer $anonKey")
            .addHeader("Content-Type", "application/json")
            .post(requestBody)
            .build()

        try {
            val response = client.newCall(request).execute()
            val responseString = response.body?.string() ?: ""
            Log.d(TAG, "[AUTH] sendOtpCode response: ${response.code}")

            if (response.isSuccessful) {
                val json = if (responseString.isNotBlank()) JSONObject(responseString) else JSONObject()
                return@withContext BackendResult.Success(json)
            } else {
                val errMsg = parseSupabaseError(responseString, response.code)
                return@withContext BackendResult.Error(userFacingErrorMessage(errMsg), response.code)
            }
        } catch (e: Exception) {
            val err = "Network error sending OTP: ${e.localizedMessage ?: e.message}"
            Log.e(TAG, err, e)
            return@withContext BackendResult.Error(userFacingErrorMessage(err))
        }
    }

    /**
     * Verify the OTP code and obtain a full session (access + refresh tokens).
     * @param type "email" for email OTP, "signup" for email confirmation link token.
     */
    suspend fun verifyOtpCode(
        email: String,
        token: String,
        type: String = "email"
    ): BackendResult<JSONObject> = withContext(Dispatchers.IO) {
        val baseUrl = getSupabaseUrl()
        val anonKey = getSupabaseAnonKey()

        logd("[AUTH] verifyOtpCode called for $email (type=$type)")

        if (baseUrl.isBlank() || anonKey.isBlank()) {
            return@withContext BackendResult.Error(UserMessages.NOT_READY)
        }

        val url = "$baseUrl/auth/v1/verify"
        val payload = JSONObject().apply {
            put("email", email)
            put("token", token)
            put("type", type)
        }

        val mediaType = "application/json".toMediaType()
        val requestBody = payload.toString().toRequestBody(mediaType)

        val request = Request.Builder()
            .url(url)
            .addHeader("apikey", anonKey)
            .addHeader("Authorization", "Bearer $anonKey")
            .addHeader("Content-Type", "application/json")
            .post(requestBody)
            .build()

        try {
            val response = client.newCall(request).execute()
            val responseString = response.body?.string() ?: ""
            Log.d(TAG, "[AUTH] verifyOtpCode response: ${response.code}")

            if (response.isSuccessful) {
                val json = if (responseString.isNotBlank()) JSONObject(responseString) else JSONObject()
                return@withContext BackendResult.Success(json)
            } else {
                val errMsg = parseSupabaseError(responseString, response.code)
                return@withContext BackendResult.Error(userFacingErrorMessage(errMsg), response.code)
            }
        } catch (e: Exception) {
            val err = "Network error verifying OTP: ${e.localizedMessage ?: e.message}"
            Log.e(TAG, err, e)
            return@withContext BackendResult.Error(userFacingErrorMessage(err))
        }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // SESSION PERSISTENCE & TOKEN REFRESH (GOTRUE)
    // ─────────────────────────────────────────────────────────────────────────────

    /** True when the current access token is missing or has (nearly) expired. */
    fun isAccessTokenExpired(): Boolean {
        val token = userAccessToken
        if (token.isNullOrBlank()) return true
        if (tokenExpiresAt <= 0L) return false // unknown expiry — assume valid; 401 retry covers it
        // 30s safety margin so requests never ride right up against the expiry edge
        return System.currentTimeMillis() >= tokenExpiresAt - 30_000L
    }

    // ── Circuit breaker for token refresh ───────────────────────────────────────
    // When a refresh fails (offline, DNS, rate limit), stop hammering Supabase on
    // every single API call. Wait at least [REFRESH_COOLDOWN_MS] before trying again.
    @Volatile private var lastRefreshFailedAt: Long = 0L
    private const val REFRESH_COOLDOWN_MS = 15_000L // 15 seconds between retries

    /**
     * Best-effort silent renewal: refreshes the access token if it expired and a refresh
     * token is available. Returns true when a usable access token is in place afterwards.
     * Safe to call before every API request — it short-circuits when the token is fresh.
     * Uses a circuit breaker so failed refreshes don't get hammered by 15+ parallel requests.
     */
    suspend fun ensureFreshAccessToken(): Boolean {
        val rt = refreshToken
        if (rt.isNullOrBlank()) return !isAccessTokenExpired() // anon/demo accounts have nothing to refresh
        if (!isAccessTokenExpired()) return true

        // Circuit breaker: if a refresh failed recently, don't retry yet
        val now = System.currentTimeMillis()
        if (now - lastRefreshFailedAt < REFRESH_COOLDOWN_MS) {
            Log.d(TAG, "[AUTH] Skipping token refresh (circuit breaker: retry in ${REFRESH_COOLDOWN_MS - (now - lastRefreshFailedAt)}ms)")
            return false
        }

        val res = refreshSession()
        if (res is BackendResult.Success) {
            lastRefreshFailedAt = 0L // Reset on success
            Log.d(TAG, "[AUTH] Access token refreshed successfully")
            return true
        }
        lastRefreshFailedAt = now // Record failure timestamp
        val errMsg = (res as? BackendResult.Error)?.message ?: "Unknown error"
        Log.w(TAG, "[AUTH] Access token refresh failed: $errMsg (circuit breaker engaged for ${REFRESH_COOLDOWN_MS}ms)")
        return false
    }

    /** Returns true only if the access token was actually refreshed (used to retry a 401). */
    private suspend fun refreshSessionIfPossible(): Boolean {
        if (refreshToken.isNullOrBlank()) return false
        // Respect the same circuit breaker
        val now = System.currentTimeMillis()
        if (now - lastRefreshFailedAt < REFRESH_COOLDOWN_MS) return false
        return try {
            val res = refreshSession()
            if (res is BackendResult.Success) {
                lastRefreshFailedAt = 0L
                true
            } else {
                lastRefreshFailedAt = now
                false
            }
        } catch (e: Exception) {
            lastRefreshFailedAt = now
            Log.e(TAG, "[AUTH] Exception during 401 token refresh: ${e.message}")
            false
        }
    }

    /**
     * Exchange the stored refresh token for a fresh access token + a rotated refresh token
     * (Supabase rotates refresh tokens on every use, so the new one MUST be persisted — the
     * old one is immediately invalidated server-side). Updates in-memory credentials and
     * fires [onSessionRefreshed] so the caller can persist the rotated tokens locally.
     */
    suspend fun refreshSession(): BackendResult<JSONObject> = withContext(Dispatchers.IO) {
        val baseUrl = getSupabaseUrl()
        val anonKey = getSupabaseAnonKey()
        val rt = refreshToken

        if (baseUrl.isBlank() || anonKey.isBlank()) {
            return@withContext BackendResult.Error(UserMessages.NOT_READY)
        }
        if (rt.isNullOrBlank()) {
            return@withContext BackendResult.Error(UserMessages.SESSION_EXPIRED)
        }

        val url = "$baseUrl/auth/v1/token?grant_type=refresh_token"
        val mediaType = "application/json".toMediaType()
        val requestBody = JSONObject().apply { put("refresh_token", rt) }.toString().toRequestBody(mediaType)

        val request = Request.Builder()
            .url(url)
            .addHeader("apikey", anonKey)
            .addHeader("Authorization", "Bearer $anonKey")
            .addHeader("Content-Type", "application/json")
            .post(requestBody)
            .build()

        try {
            val response = client.newCall(request).execute()
            val responseCode = response.code
            val responseString = response.body?.string() ?: ""

            if (response.isSuccessful && responseString.isNotBlank()) {
                val json = JSONObject(responseString)
                captureSession(json)
                // Persist the rotated tokens so the session survives app restarts.
                onSessionRefreshed?.let { cb ->
                    try {
                        cb(userAccessToken, refreshToken, tokenExpiresAt)
                    } catch (e: Exception) {
                        Log.e(TAG, "[AUTH] Session persistence callback failed: ${e.message}")
                    }
                }
                return@withContext BackendResult.Success(json)
            }
            val errMsg = parseSupabaseError(responseString, responseCode)
            loge("[AUTH] Token refresh failed (HTTP $responseCode)", errMsg)
            return@withContext BackendResult.Error(userFacingErrorMessage(errMsg), responseCode)
        } catch (e: Exception) {
            val err = "Network error refreshing Supabase session: ${e.localizedMessage ?: e.message}"
            Log.e(TAG, "[AUTH] $err", e)
            return@withContext BackendResult.Error(userFacingErrorMessage(err))
        }
    }

    /**
     * Capture the full session from a GoTrue auth response (sign-in, sign-up, refresh):
     * access_token, refresh_token, expires_at / expires_in, and the user id.
     */
    private fun captureSession(json: JSONObject) {
        val token = json.optString("access_token")
        if (!token.isNullOrBlank()) {
            userAccessToken = token
        }
        val newRefreshToken = json.optString("refresh_token")
        if (!newRefreshToken.isNullOrBlank()) {
            refreshToken = newRefreshToken
        }
        val expiresAtSec = json.optLong("expires_at", 0L)
        if (expiresAtSec > 0L) {
            tokenExpiresAt = expiresAtSec * 1000L
        } else {
            val expiresInSec = json.optLong("expires_in", 0L)
            if (expiresInSec > 0L) {
                tokenExpiresAt = System.currentTimeMillis() + expiresInSec * 1000L
            }
        }
        val userObj = json.optJSONObject("user")
        val userId = userObj?.optString("id") ?: json.optString("id")
        if (!userId.isNullOrBlank()) {
            currentUserId = userId
        }
    }

    suspend fun updateUserProfile(
        userId: String? = null,
        email: String? = null,
        fullName: String? = null,
        school: String? = null,
        learningStyle: String? = null,
        academicLevel: String? = null,
        academicTier: String? = null,
        onboardingCompleted: Boolean? = null,
        personalContext: String? = null,
        bio: String? = null,
        pointsBalance: Int? = null,
        avatarUrl: String? = null,
        username: String? = null
    ): BackendResult<JSONObject> {
        val targetId = userId.takeIf { !it.isNullOrBlank() } ?: currentUserId
        val targetEmail = email.takeIf { !it.isNullOrBlank() }

        val payload = JSONObject().apply {
            // Strip literal "null" strings from JSONObject.optString() null value handling
            if (!fullName.isNullOrBlank() && fullName != "null") put("full_name", fullName)
            if (!school.isNullOrBlank() && school != "null") put("school", school)
            if (!learningStyle.isNullOrBlank() && learningStyle != "null") put("learning_style", learningStyle)
            if (!academicLevel.isNullOrBlank() && academicLevel != "null") put("academic_level", academicLevel)
            if (!academicTier.isNullOrBlank() && academicTier != "null") put("academic_tier", academicTier)
            if (!bio.isNullOrBlank() && bio != "null") put("bio", bio)
            if (onboardingCompleted != null) put("onboarding_completed", onboardingCompleted)
            if (!personalContext.isNullOrBlank() && personalContext != "null") {
                put("personal_context", personalContext)
            }
            // Explorer credits store: points (credits) balance + emoji avatar.
            if (pointsBalance != null) put("points_balance", pointsBalance)
            if (!avatarUrl.isNullOrBlank()) put("avatar_url", avatarUrl)
            if (!username.isNullOrBlank()) put("username", username)
        }

        return callAuthOnboarding("sync-profile", payload)
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // EDUCATION CONTEXT — mirrors the web app's education onboarding (see
    // src/modules/onboarding/hooks/useEducationContext.ts + EducationContextStep.tsx).
    // Cloud source of truth: countries, education_levels, curricula, examinations,
    // subjects, user_education_profiles, user_subjects.
    // ─────────────────────────────────────────────────────────────────────────────

    /**
     * Active countries (id, code, name, flag_emoji), ordered for pickers.
     * Goes through the get_active_countries RPC exactly like the web app — the
     * reference tables are only reachable via these RPCs.
     */
    suspend fun fetchActiveCountries(): BackendResult<JSONArray> = executeRpcArray("get_active_countries")

    /**
     * Cascading education framework for a country: education levels, each with its
     * curricula, examinations and subjects. Uses the get_education_framework RPC
     * (returns { country, education_levels: [...] }) — same call the web makes.
     */
    suspend fun fetchEducationFramework(countryCode: String): BackendResult<JSONObject> {
        return callRpc("get_education_framework", JSONObject().put("p_country_code", countryCode))
    }

    /**
     * Calls an RPC via the API Gateway and returns its raw jsonb array payload. Used for
     * RPCs that return jsonb arrays (e.g. get_active_countries).
     */
    private suspend fun executeRpcArray(functionName: String, args: JSONObject = JSONObject()): BackendResult<JSONArray> =
        withContext(Dispatchers.IO) {
            val baseUrl = getSupabaseUrl()
            val anonKey = getSupabaseAnonKey()
            if (baseUrl.isBlank() || anonKey.isBlank()) {
                loge("[API] RPC blocked - backend not configured", functionName)
                return@withContext BackendResult.Error(UserMessages.NOT_READY)
            }
            try { ensureFreshAccessToken() } catch (e: Exception) { Log.w(TAG, "[AUTH] Token freshness check failed: ${e.message}") }

            val url = "$baseUrl/functions/v1/api/v1/rpc/$functionName"
            val requestBody = args.toString().toRequestBody("application/json".toMediaType())
            fun buildRpcRequest(): Request = Request.Builder()
                .url(url)
                .addHeader("apikey", anonKey)
                .addHeader("Authorization", if (!userAccessToken.isNullOrBlank()) "Bearer $userAccessToken" else "Bearer $anonKey")
                .addHeader("Content-Type", "application/json")
                .post(requestBody)
                .build()

            try {
                var response = client.newCall(buildRpcRequest()).execute()
                var code = response.code
                var bodyStr = response.body?.string() ?: ""
                if (code == 401 && refreshSessionIfPossible()) {
                    response = client.newCall(buildRpcRequest()).execute()
                    code = response.code
                    bodyStr = response.body?.string() ?: ""
                }
                if (response.isSuccessful) {
                    logd("[API] ✅ RPC $functionName → HTTP $code (${bodyStr.length} bytes)")
                    val trimmed = bodyStr.trim()
                    val arr = try {
                        if (trimmed.startsWith("{")) {
                            val obj = JSONObject(trimmed)
                            if (obj.has("data") && obj.opt("data") is JSONArray) {
                                obj.getJSONArray("data")
                            } else {
                                JSONArray().put(obj)
                            }
                        } else if (trimmed.startsWith("[")) {
                            JSONArray(trimmed)
                        } else {
                            JSONArray()
                        }
                    } catch (e: Exception) { JSONArray() }
                    BackendResult.Success(arr)
                } else {
                    val err = parseSupabaseError(bodyStr, code)
                    loge("[API] RPC failed (HTTP $code)", "$functionName -> $err")
                    BackendResult.Error(userFacingErrorMessage(err), code)
                }
            } catch (e: Exception) {
                val err = "Network error calling RPC $functionName: ${e.localizedMessage ?: e.message}"
                loge("[API] RPC threw", "$functionName -> ${e.message}", e)
                BackendResult.Error(userFacingErrorMessage(err))
            }
        }

    /** Upsert the user's education profile (one row per user, like the web app). */
    suspend fun saveUserEducationProfile(
        userId: String,
        countryId: String?,
        educationLevelId: String?,
        curriculumId: String?,
        targetExaminationId: String?,
        institutionName: String?,
        yearOrGrade: String?
    ): BackendResult<JSONObject> {
        val payload = JSONObject().apply {
            put("user_id", userId)
            if (!countryId.isNullOrBlank()) put("country_id", countryId)
            if (!educationLevelId.isNullOrBlank()) put("education_level_id", educationLevelId)
            if (!curriculumId.isNullOrBlank()) put("curriculum_id", curriculumId)
            if (!targetExaminationId.isNullOrBlank()) put("target_examination_id", targetExaminationId)
            if (!institutionName.isNullOrBlank()) put("institution_name", institutionName)
            if (!yearOrGrade.isNullOrBlank()) put("year_or_grade", yearOrGrade)
        }
        return tablePost("user_education_profiles", payload, onConflict = "user_id")
    }

    /**
     * Fetch the user's education profile with enrolled subjects embedded, mirroring
     * the web app's useEducationContext single-query shape.
     */
    suspend fun fetchUserEducationProfile(userId: String): BackendResult<JSONArray> {
        val result = executeApiGateway("user-education-profiles?user_id=$userId&limit=1", "GET")
        return when (result) {
            is BackendResult.Success -> BackendResult.Success(result.data.optJSONArray("data") ?: JSONArray())
            is BackendResult.Error -> BackendResult.Error(result.message, result.code)
        }
    }

    /** Replace the user's enrolled subjects (delete + insert, like the web app). */
    suspend fun replaceUserSubjects(profileId: String, subjectIds: List<String>): Boolean {
        try {
            tableDelete("user_subjects", mapOf("user_education_profile_id" to profileId))
            if (subjectIds.isEmpty()) return true
            var allOk = true
            subjectIds.forEach { subjectId ->
                val payload = JSONObject().apply {
                    put("user_education_profile_id", profileId)
                    put("subject_id", subjectId)
                }
                val res = tablePost("user_subjects", payload)
                if (res !is BackendResult.Success) allOk = false
            }
            return allOk
        } catch (e: Exception) {
            android.util.Log.e(TAG, "replaceUserSubjects failed: ${e.message}")
            return false
        }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // EXPLORER GAME PROGRESS — stars / unlocked levels per game (game_progress).
    // ─────────────────────────────────────────────────────────────────────────────

    /** Fetch the user's game progress rows (one per game). */
    suspend fun fetchGameProgress(userId: String): BackendResult<JSONArray> {
        val result = executeApiGateway("game-progress", "GET")
        return when (result) {
            is BackendResult.Success -> BackendResult.Success(result.data.optJSONArray("data") ?: JSONArray())
            is BackendResult.Error -> BackendResult.Error(result.message, result.code)
        }
    }

    /** Upsert a game-progress row (unique on user_id + game_key). */
    suspend fun upsertGameProgress(
        userId: String,
        gameKey: String,
        unlockedLevel: Int,
        starsByLevelJson: String,
        bestScoresJson: String,
        totalXpEarned: Int
    ): BackendResult<JSONObject> {
        val payload = JSONObject().apply {
            put("user_id", userId)
            put("game_key", gameKey)
            put("unlocked_level", unlockedLevel)
            put("stars_by_level", JSONObject(starsByLevelJson))
            put("best_scores", JSONObject(bestScoresJson))
            put("total_xp_earned", totalXpEarned)
        }
        val result = executeApiGateway("game-progress", "POST", payload)
        return when (result) {
            is BackendResult.Success -> BackendResult.Success(result.data.optJSONObject("data") ?: result.data)
            is BackendResult.Error -> result
        }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // EXPLORER ROADMAP — daily learning path steps (kid_roadmap_steps)
    // ─────────────────────────────────────────────────────────────────────────────

    /** Fetch the kid's roadmap steps (ordered by week/day/step). */
    suspend fun fetchRoadmapSteps(userId: String): BackendResult<JSONArray> {
        val result = executeApiGateway("roadmap-steps?order=week.asc,day.asc,step_index.asc", "GET")
        return when (result) {
            is BackendResult.Success -> BackendResult.Success(result.data.optJSONArray("data") ?: JSONArray())
            is BackendResult.Error -> BackendResult.Error(result.message, result.code)
        }
    }

    /** Upsert a roadmap step (id is client-generated so sync is 1:1). */
    suspend fun upsertRoadmapStep(
        userId: String,
        step: com.example.data.local.entities.RoadmapStepEntity
    ): BackendResult<JSONObject> {
        val payload = JSONObject().apply {
            put("id", step.id)
            put("user_id", userId)
            put("subject_code", step.subjectCode)
            put("subject_name", step.subjectName)
            put("week", step.week)
            put("day", step.day)
            put("step_index", step.stepIndex)
            put("title", step.title)
            put("step_type", step.stepType)
            put("ref_id", step.refId ?: JSONObject.NULL)
            put("xp_reward", step.xpReward)
            put("is_completed", step.isCompleted)
            put("completed_at", if (step.completedAt != null) currentUtcIso() else JSONObject.NULL)
            put("lesson_json", step.lessonJson ?: JSONObject.NULL)
        }
        return tablePost("kid_roadmap_steps", payload, onConflict = "id")
    }

    /** Batch UPSERT roadmap steps (single request instead of one-per-step). */
    suspend fun upsertRoadmapStepsBatch(
        userId: String,
        steps: List<com.example.data.local.entities.RoadmapStepEntity>
    ): BackendResult<JSONObject> {
        val arr = JSONArray()
        for (step in steps) {
            arr.put(JSONObject().apply {
                put("id", step.id)
                put("user_id", userId)
                put("subject_code", step.subjectCode)
                put("subject_name", step.subjectName)
                put("week", step.week)
                put("day", step.day)
                put("step_index", step.stepIndex)
                put("title", step.title)
                put("step_type", step.stepType)
                put("ref_id", step.refId ?: JSONObject.NULL)
                put("xp_reward", step.xpReward)
                put("is_completed", step.isCompleted)
                put("completed_at", if (step.completedAt != null) currentUtcIso() else JSONObject.NULL)
                put("lesson_json", step.lessonJson ?: JSONObject.NULL)
            })
        }
        // Use batch upsert endpoint (Supabase accepts JSON array body with on_conflict)
        val result = executeApiGateway("roadmap-steps", "POST", JSONObject().put("steps", arr))
        return when (result) {
            is BackendResult.Success -> BackendResult.Success(result.data.optJSONObject("data") ?: result.data)
            is BackendResult.Error -> result
        }
    }

    /** Save or update the cached interactive lesson JSON for a roadmap step on the cloud. */
    suspend fun updateRoadmapStepLessonJson(stepId: String, lessonJson: String): BackendResult<JSONObject> = tablePatch(
        "kid_roadmap_steps",
        JSONObject().apply {
            put("lesson_json", lessonJson)
            put("updated_at", currentUtcIso())
        },
        mapOf("id" to stepId)
    )

    /** Mark a roadmap step complete on the cloud (lightweight PATCH). */
    suspend fun markRoadmapStepCompleted(stepId: String): BackendResult<JSONObject> = tablePatch(
        "kid_roadmap_steps",
        JSONObject().apply {
            put("is_completed", true)
            put("completed_at", currentUtcIso())
        },
        mapOf("id" to stepId)
    )

    // ─────────────────────────────────────────────────────────────────────────────
    // EXPLORER SPELLING BEE — kid-friendly words (generate-spelling-words edge fn)
    // ─────────────────────────────────────────────────────────────────────────────

    /**
     * Generates Spelling Bee words for a level via the dedicated `generate-spelling-words`
     * edge function (kid-friendly words + definitions + example sentences, scaled to the
     * level). Returns `{ words: [{word, definition, sentence}] }`. This is the ONLY word
     * source — the app no longer routes spelling generation through gemini-chat.
     */
    suspend fun generateSpellingWords(levelIndex: Int, count: Int): BackendResult<JSONObject> {
        val payload = JSONObject().apply {
            put("level", levelIndex.coerceIn(1, 8))
            put("count", count.coerceIn(1, 12))
        }
        return executeEdgeFunction("generate-spelling-words", payload)
    }

    /**
     * Permanently erases the signed-in user's data on the cloud (study data + social
     * activity) via the delete-user-data edge function. The account itself is kept.
     */
    suspend fun deleteUserData(): BackendResult<JSONObject> =
        executeEdgeFunction("delete-user-data", JSONObject())

    // ─────────────────────────────────────────────────────────────────────────────
    // EXPLORER SPEED RACE — public quick-match lobbies (live-quiz edge function)
    // ─────────────────────────────────────────────────────────────────────────────

    /**
     * Finds an open public Speed Race lobby for a game. Returns
     * `{ found: true, session: {...}, join_code: "ABC123" }` or `{ found: false }`.
     */
    suspend fun findPublicLobby(gameKey: String): BackendResult<JSONObject> {
        val payload = JSONObject().apply {
            put("action", "find-public-lobby")
            put("game_key", gameKey)
        }
        return executeEdgeFunction("live-quiz", payload)
    }

    suspend fun authenticateUser(email: String, fullName: String, school: String, provider: String = "email"): BackendResult<JSONObject> {
        // Prefer the auth-onboarding edge function (single source of truth for all clients)
        // Ensure new user accounts are initialized with onboarding_completed = false
        val edgeResult = callAuthOnboarding("sync-profile", JSONObject().apply {
            put("full_name", fullName)
            put("school", school)
            put("onboarding_completed", false)
        })
        if (edgeResult is BackendResult.Success) {
            val uid = currentUserId
            if (!uid.isNullOrBlank()) {
                ensureSocialUserExists(uid, fullName)
            }
            return edgeResult
        }

        // Fallback to direct REST if edge function is unavailable
        val payload = JSONObject().apply {
            put("email", email)
            put("full_name", fullName)
            put("school", school)
            put("onboarding_completed", false)
            val uid = currentUserId
            if (!uid.isNullOrBlank()) {
                put("id", uid)
            }
        }
        val profileResult = tablePost("profiles", payload)

        val uid = currentUserId
        if (!uid.isNullOrBlank()) {
            ensureSocialUserExists(uid, fullName)
        }

        return profileResult
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // AUTH-ONBOARDING EDGE FUNCTION — single source of truth for all clients
    // ─────────────────────────────────────────────────────────────────────────────

    /**
     * Call the auth-onboarding edge function with the given action.
     * This is the single source of truth for profile + onboarding across all clients.
     */
    suspend fun callAuthOnboarding(action: String, data: JSONObject = JSONObject()): BackendResult<JSONObject> {
        val payload = JSONObject().apply {
            put("action", action)
            // Merge the data fields into the payload
            val keys = data.names()
            if (keys != null) {
                for (i in 0 until keys.length()) {
                    val key = keys.getString(i)
                    put(key, data.get(key))
                }
            }
        }
        return executeEdgeFunction("auth-onboarding", payload)
    }

    /** Get the user's full profile from cloud via the edge function. */
    suspend fun getCloudProfile(): BackendResult<JSONObject> {
        return callAuthOnboarding("get-profile")
    }

    /**
     * Complete onboarding atomically via the edge function.
     * This is the ONLY way to set onboarding_completed = true on the server.
     */
    suspend fun completeOnboardingViaEdge(
        fullName: String? = null,
        school: String? = null,
        academicLevel: String? = null,
        academicTier: String? = null,
        learningStyle: String? = null,
        learningPreferences: JSONObject? = null,
        quizPreferences: JSONObject? = null,
        personalContext: String? = null,
        avatarUrl: String? = null
    ): BackendResult<JSONObject> {
        val data = JSONObject()
        // Strip literal "null" strings from JSONObject.optString() null value handling
        if (!fullName.isNullOrBlank() && fullName != "null") data.put("full_name", fullName)
        if (!school.isNullOrBlank() && school != "null") data.put("school", school)
        if (!academicLevel.isNullOrBlank() && academicLevel != "null") data.put("academic_level", academicLevel)
        if (!academicTier.isNullOrBlank() && academicTier != "null") data.put("academic_tier", academicTier)
        if (!learningStyle.isNullOrBlank() && learningStyle != "null") data.put("learning_style", learningStyle)
        if (learningPreferences != null) data.put("learning_preferences", learningPreferences)
        if (quizPreferences != null) data.put("quiz_preferences", quizPreferences)
        if (!personalContext.isNullOrBlank() && personalContext != "null") data.put("personal_context", personalContext)
        if (!avatarUrl.isNullOrBlank() && avatarUrl != "null") data.put("avatar_url", avatarUrl)
        data.put("onboarding_completed", true)
        return callAuthOnboarding("sync-profile", data)
    }

    /**
     * Sync local profile data to cloud via the edge function.
     * Only overwrites fields the client explicitly sends.
     */
    suspend fun syncProfileViaEdge(
        fullName: String? = null,
        school: String? = null,
        academicLevel: String? = null,
        academicTier: String? = null,
        learningStyle: String? = null,
        personalContext: String? = null,
        onboardingCompleted: Boolean? = null,
        avatarUrl: String? = null
    ): BackendResult<JSONObject> {
        val data = JSONObject()
        // Strip the literal string "null" that JSONObject.optString() returns for JSON null values
        if (!fullName.isNullOrBlank() && fullName != "null") data.put("full_name", fullName)
        if (!school.isNullOrBlank() && school != "null") data.put("school", school)
        if (!academicLevel.isNullOrBlank() && academicLevel != "null") data.put("academic_level", academicLevel)
        if (!academicTier.isNullOrBlank() && academicTier != "null") data.put("academic_tier", academicTier)
        if (!learningStyle.isNullOrBlank() && learningStyle != "null") data.put("learning_style", learningStyle)
        if (!personalContext.isNullOrBlank() && personalContext != "null") data.put("personal_context", personalContext)
        if (onboardingCompleted != null) data.put("onboarding_completed", onboardingCompleted)
        if (!avatarUrl.isNullOrBlank() && avatarUrl != "null") data.put("avatar_url", avatarUrl)
        return callAuthOnboarding("sync-profile", data)
    }

    suspend fun fetchUserProfile(email: String, userId: String? = null): BackendResult<JSONObject> {
        val uid = userId ?: currentUserId
        val filters = mutableMapOf<String, String>()
        if (!uid.isNullOrBlank()) filters["id"] = uid else filters["email"] = email
        return when (val result = tableGet("profiles", filters)) {
            is BackendResult.Success -> {
                val array = result.data
                if (array.length() > 0) {
                    val obj = array.getJSONObject(0)
                    val rawBio = obj.optString("bio", "")
                    
                    // Prioritize reading from the actual table columns "onboarding_completed" and "personal_context"
                    var onboardingCompleted = obj.optBoolean("onboarding_completed", false) || obj.optBoolean("onboardingCompleted", false)
                    var personalContext = obj.optString("personal_context", "")
                    var cleanBio = rawBio

                    // Fallback to legacy encoded bio fields if the above columns were false/empty
                    if (rawBio.contains("[ONBOARDED]")) {
                        onboardingCompleted = true
                        cleanBio = cleanBio.replace("[ONBOARDED]", "")
                    }
                    if (rawBio.contains("[CONTEXT:")) {
                        val start = rawBio.indexOf("[CONTEXT:") + 9
                        val end = rawBio.indexOf("]", start)
                        if (end > start) {
                            val parsedContext = rawBio.substring(start, end)
                            if (personalContext.isBlank()) {
                                personalContext = parsedContext
                            }
                            cleanBio = cleanBio.replace("[CONTEXT:$parsedContext]", "")
                        }
                    }

                    obj.put("onboarding_completed", onboardingCompleted)
                    obj.put("onboardingCompleted", onboardingCompleted)
                    if (personalContext.isNotBlank()) {
                        obj.put("personal_context", personalContext)
                    }
                    obj.put("bio", cleanBio.trim())

                    BackendResult.Success(obj)
                } else if (!uid.isNullOrBlank() && email.isNotBlank()) {
                    // Fallback to query by email if query by id returned 0 rows
                    val emailRes = tableGet("profiles", mapOf("email" to email))
                    if (emailRes is BackendResult.Success && emailRes.data.length() > 0) {
                        val obj = emailRes.data.getJSONObject(0)
                        val rawBio = obj.optString("bio", "")
                        var onboardingCompleted = obj.optBoolean("onboarding_completed", false) || obj.optBoolean("onboardingCompleted", false)
                        var personalContext = obj.optString("personal_context", "")
                        var cleanBio = rawBio

                        if (rawBio.contains("[ONBOARDED]")) {
                            onboardingCompleted = true
                            cleanBio = cleanBio.replace("[ONBOARDED]", "")
                        }
                        if (rawBio.contains("[CONTEXT:")) {
                            val start = rawBio.indexOf("[CONTEXT:") + 9
                            val end = rawBio.indexOf("]", start)
                            if (end > start) {
                                val parsedContext = rawBio.substring(start, end)
                                if (personalContext.isBlank()) {
                                    personalContext = parsedContext
                                }
                                cleanBio = cleanBio.replace("[CONTEXT:$parsedContext]", "")
                            }
                        }

                        obj.put("onboarding_completed", onboardingCompleted)
                        obj.put("onboardingCompleted", onboardingCompleted)
                        if (personalContext.isNotBlank()) {
                            obj.put("personal_context", personalContext)
                        }
                        obj.put("bio", cleanBio.trim())
                        BackendResult.Success(obj)
                    } else {
                        BackendResult.Error(UserMessages.NOT_FOUND)
                    }
                } else {
                    BackendResult.Error(UserMessages.NOT_FOUND)
                }
            }
            is BackendResult.Error -> {
                if (!uid.isNullOrBlank() && email.isNotBlank()) {
                    // Try email fallback if id query failed
                    val emailRes = tableGet("profiles", mapOf("email" to email))
                    if (emailRes is BackendResult.Success && emailRes.data.length() > 0) {
                        val obj = emailRes.data.getJSONObject(0)
                        val rawBio = obj.optString("bio", "")
                        var onboardingCompleted = obj.optBoolean("onboarding_completed", false) || obj.optBoolean("onboardingCompleted", false)
                        var personalContext = obj.optString("personal_context", "")
                        var cleanBio = rawBio

                        if (rawBio.contains("[ONBOARDED]")) {
                            onboardingCompleted = true
                            cleanBio = cleanBio.replace("[ONBOARDED]", "")
                        }
                        if (rawBio.contains("[CONTEXT:")) {
                            val start = rawBio.indexOf("[CONTEXT:") + 9
                            val end = rawBio.indexOf("]", start)
                            if (end > start) {
                                val parsedContext = rawBio.substring(start, end)
                                if (personalContext.isBlank()) {
                                    personalContext = parsedContext
                                }
                                cleanBio = cleanBio.replace("[CONTEXT:$parsedContext]", "")
                            }
                        }

                        obj.put("onboarding_completed", onboardingCompleted)
                        obj.put("onboardingCompleted", onboardingCompleted)
                        if (personalContext.isNotBlank()) {
                            obj.put("personal_context", personalContext)
                        }
                        obj.put("bio", cleanBio.trim())
                        return BackendResult.Success(obj)
                    }
                }
                BackendResult.Error(result.message, result.code)
            }
        }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // SOCIAL FEED, POSTS, GROUPS (POSTGREST DATABASE TABLES)
    // ─────────────────────────────────────────────────────────────────────────────
    fun ensureValidUuid(id: String?): String {
        if (id.isNullOrBlank()) return "00000000-0000-0000-0000-000000000000"
        return try {
            java.util.UUID.fromString(id)
            id
        } catch (e: Exception) {
            java.util.UUID.nameUUIDFromBytes(id.toByteArray()).toString()
        }
    }

    // Per-session guard so ensureSocialUserExists only fires once per user.
    @Volatile var lastSocialUserEnsuredId: String? = null

    suspend fun ensureSocialUserExists(userId: String, displayName: String, avatarUrl: String = ""): BackendResult<JSONObject> {
        if (userId.isNullOrBlank()) {
            return BackendResult.Error(UserMessages.GENERIC)
        }
        // Skip if we already ensured this exact user this session
        if (userId == lastSocialUserEnsuredId) {
            return BackendResult.Success(JSONObject())
        }
        val cleanId = ensureValidUuid(userId)
        val cleanName = displayName.filter { it.isLetterOrDigit() }.lowercase()
        val suffix = if (cleanId.length >= 4) cleanId.takeLast(4) else "user"
        val usernameVal = if (cleanName.isNotBlank() && cleanName.length >= 2) "${cleanName}_$suffix" else "scholar_$suffix"
        val displayNameVal = displayName.ifBlank { "Scholar" }

        val payload = JSONObject().apply {
            put("id", cleanId)
            put("username", usernameVal)
            put("display_name", displayNameVal)
            put("avatar_url", avatarUrl)
            put("bio", "New to the community!")
            put("interests", JSONArray(listOf("learning", "technology")))
        }
        Log.d(TAG, "Ensuring social user exists: userId=$cleanId, username=$usernameVal")
        val result = tablePost("social_users", payload, onConflict = "id")
        if (result is BackendResult.Success) {
            lastSocialUserEnsuredId = userId
        }
        return result
    }

    suspend fun getSocialFeed(
        mode: String = "feed",
        sortBy: String = "newest",
        feedMode: String = "all",
        cursor: String? = null,
        limit: Int = 15,
        offset: Int = 0
    ): BackendResult<JSONArray> {
        val result = executeApiGateway("social/feed?limit=$limit&offset=$offset", "GET")
        return when (result) {
            is BackendResult.Success -> BackendResult.Success(result.data.optJSONArray("data") ?: JSONArray())
            is BackendResult.Error -> BackendResult.Error(result.message, result.code)
        }
    }

    suspend fun createSocialPost(authorId: String, content: String, category: String = "General", privacy: String = "public"): BackendResult<JSONObject> {
        val cleanAuthorId = ensureValidUuid(authorId)
        val payload = JSONObject().apply {
            put("author_id", cleanAuthorId)
            put("content", content)
            put("privacy", privacy)
            val catArray = JSONArray().apply { put(category) }
            put("ai_categories", catArray)
            put("metadata", JSONObject().apply { put("category", category) })
        }
        val fnRes = executeEdgeFunction("create-social-post", payload)
        if (fnRes is BackendResult.Success) {
            val postObj = fnRes.data.optJSONObject("post")
            if (postObj != null) return BackendResult.Success(postObj)
            return fnRes
        }
        return tablePost("social_posts", payload)
    }

    suspend fun deleteSocialPost(postId: String): BackendResult<Boolean> {
        return tableDelete("social_posts", mapOf("id" to postId))
    }

    suspend fun getSocialLikesForUser(userId: String): BackendResult<JSONArray> {
        val uid = ensureValidUuid(userId)
        return tableGet("social_likes", mapOf("user_id" to uid))
    }

    suspend fun getSocialBookmarksForUser(userId: String): BackendResult<JSONArray> {
        val uid = ensureValidUuid(userId)
        return tableGet("social_bookmarks", mapOf("user_id" to uid))
    }

    suspend fun toggleLikePost(postId: String, userId: String = ""): BackendResult<Boolean> {
        val uid = ensureValidUuid(userId.ifBlank { currentUserId })

        // Let the toggle-like edge function handle everything — it checks
        // existence, ensures social_users row, inserts/deletes, and sends
        // notifications. No need for a separate pre-check that can 406.
        val fnPayload = JSONObject().apply {
            put("post_id", postId)
        }
        val fnRes = executeEdgeFunction("toggle-like", fnPayload)
        if (fnRes is BackendResult.Success) {
            val data = fnRes.data
            val isLikedResult = data.optBoolean("is_liked", false)
            return BackendResult.Success(isLikedResult)
        }

        // Fallback to direct REST
        val checkRes = tableGet("social_likes", mapOf("post_id" to postId, "user_id" to uid))
        val isCurrentlyLiked = checkRes is BackendResult.Success && checkRes.data.length() > 0

        if (isCurrentlyLiked) {
            val delRes = tableDelete("social_likes", mapOf("post_id" to postId, "user_id" to uid))
            return when (delRes) {
                is BackendResult.Success -> BackendResult.Success(false)
                is BackendResult.Error -> delRes
            }
        } else {
            val payload = JSONObject().apply {
                put("post_id", postId)
                put("user_id", uid)
            }
            val insRes = tablePost("social_likes", payload)
            return when (insRes) {
                is BackendResult.Success -> BackendResult.Success(true)
                is BackendResult.Error -> {
                    if (insRes.message.contains("23505") || insRes.message.contains("unique") || insRes.message.contains("409")) {
                        BackendResult.Success(true)
                    } else insRes
                }
            }
        }
    }

    /** Record a peer cheer event to the cloud database. */
    suspend fun sendPeerCheer(targetUserId: String, emoji: String = "👏"): BackendResult<Boolean> {
        val uid = ensureValidUuid(currentUserId)
        val targetId = ensureValidUuid(targetUserId)
        if (uid.isBlank() || targetId.isBlank()) return BackendResult.Success(true)

        val isoTimestamp = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.US).apply {
            timeZone = java.util.TimeZone.getTimeZone("UTC")
        }.format(java.util.Date())

        val payload = JSONObject().apply {
            put("sender_id", uid)
            put("recipient_id", targetId)
            put("emoji", emoji)
            put("created_at", isoTimestamp)
        }
        return try {
            val res = tablePost("peer_cheers", payload)
            if (res is BackendResult.Success) BackendResult.Success(true) else BackendResult.Success(true)
        } catch (_: Exception) {
            BackendResult.Success(true)
        }
    }

    suspend fun toggleBookmarkPost(postId: String, userId: String = ""): BackendResult<Boolean> {
        val uid = ensureValidUuid(userId.ifBlank { currentUserId })
        val checkRes = tableGet("social_bookmarks", mapOf("post_id" to postId, "user_id" to uid))
        val isCurrentlyBookmarked = checkRes is BackendResult.Success && checkRes.data.length() > 0

        val fnPayload = JSONObject().apply {
            put("post_id", postId)
            put("is_bookmarked", isCurrentlyBookmarked)
        }
        val fnRes = executeEdgeFunction("toggle-bookmark", fnPayload)
        if (fnRes is BackendResult.Success) {
            val isBookmarkedResult = fnRes.data.optBoolean("is_bookmarked", !isCurrentlyBookmarked)
            return BackendResult.Success(isBookmarkedResult)
        }

        // Fallback to direct REST
        if (isCurrentlyBookmarked) {
            val delRes = tableDelete("social_bookmarks", mapOf("post_id" to postId, "user_id" to uid))
            return when (delRes) {
                is BackendResult.Success -> BackendResult.Success(false)
                is BackendResult.Error -> delRes
            }
        } else {
            val payload = JSONObject().apply {
                put("post_id", postId)
                put("user_id", uid)
            }
            // Idempotent upsert — mirror the social_likes fix above.
            val insRes = tablePost("social_bookmarks", payload, onConflict = "post_id,user_id")
            return when (insRes) {
                is BackendResult.Success -> BackendResult.Success(true)
                is BackendResult.Error -> insRes
            }
        }
    }

    suspend fun getSocialComments(postId: String): BackendResult<JSONArray> {
        val result = executeApiGateway("social/comments?post_id=$postId&order=created_at.asc", "GET")
        return when (result) {
            is BackendResult.Success -> BackendResult.Success(result.data.optJSONArray("data") ?: JSONArray())
            is BackendResult.Error -> BackendResult.Error(result.message, result.code)
        }
    }

    suspend fun addSocialComment(postId: String, userId: String, content: String): BackendResult<JSONObject> {
        val fnPayload = JSONObject().apply {
            put("postId", postId)
            put("content", content)
        }
        val fnRes = executeEdgeFunction("comment-on-post", fnPayload)
        if (fnRes is BackendResult.Success) {
            val commentObj = fnRes.data.optJSONObject("comment")
            if (commentObj != null) return BackendResult.Success(commentObj)
            return fnRes
        }

        val payload = JSONObject().apply {
            put("post_id", postId)
            put("author_id", ensureValidUuid(userId))
            put("content", content)
        }
        return tablePost("social_comments", payload)
    }

    suspend fun getSocialGroups(offset: Int = 0, limit: Int = 20): BackendResult<JSONArray> {
        val result = executeApiGateway("social/groups?order=created_at.desc&limit=$limit", "GET")
        return when (result) {
            is BackendResult.Success -> BackendResult.Success(result.data.optJSONArray("data") ?: JSONArray())
            is BackendResult.Error -> BackendResult.Error(result.message, result.code)
        }
    }

    suspend fun createStudyGroup(name: String, description: String, category: String, creatorId: String): BackendResult<JSONObject> {
        val payload = JSONObject().apply {
            put("name", name)
            put("description", description)
            put("category", category)
            put("privacy", "public")
            put("created_by", ensureValidUuid(creatorId))
        }
        return tablePost("social_groups", payload)
    }

    suspend fun getJoinedGroupsForUser(userId: String): BackendResult<JSONArray> {
        val uid = ensureValidUuid(userId)
        return tableGet("social_group_members", mapOf("user_id" to uid))
    }

    suspend fun getFollowsForUser(userId: String): BackendResult<JSONArray> {
        val uid = ensureValidUuid(userId)
        return tableGet("social_follows", mapOf("follower_id" to uid))
    }

    suspend fun toggleJoinGroup(groupId: String, userId: String, isJoining: Boolean): BackendResult<Boolean> {
        val uid = ensureValidUuid(userId)
        val actionVal = if (isJoining) "join" else "leave"
        val fnPayload = JSONObject().apply {
            put("group_id", groupId)
            put("action", actionVal)
        }
        val fnRes = executeEdgeFunction("join-leave-group", fnPayload)
        if (fnRes is BackendResult.Success) {
            val act = fnRes.data.optString("action", "")
            if (act == "joined" || act == "already_member") return BackendResult.Success(true)
            if (act == "left") return BackendResult.Success(false)
            return BackendResult.Success(isJoining)
        }

        // Fallback
        if (isJoining) {
            val payload = JSONObject().apply {
                put("group_id", groupId)
                put("user_id", uid)
            }
            val res = tablePost("social_group_members", payload)
            return when (res) {
                is BackendResult.Success -> BackendResult.Success(true)
                is BackendResult.Error -> res
            }
        } else {
            return tableDelete("social_group_members", mapOf("group_id" to groupId, "user_id" to uid))
        }
    }

    suspend fun getGroupMessages(groupId: String): BackendResult<JSONArray> {
        val result = executeApiGateway("social/chat-messages?group_id=$groupId&order=created_at.asc", "GET")
        return when (result) {
            is BackendResult.Success -> BackendResult.Success(result.data.optJSONArray("data") ?: JSONArray())
            is BackendResult.Error -> BackendResult.Error(result.message, result.code)
        }
    }

    suspend fun sendGroupMessage(groupId: String, userId: String, content: String): BackendResult<JSONObject> {
        val payload = JSONObject().apply {
            put("group_id", groupId)
            put("sender_id", ensureValidUuid(userId))
            put("content", content)
        }
        return tablePost("social_chat_messages", payload)
    }

    suspend fun getGroupResources(groupId: String): BackendResult<JSONArray> {
        val result = executeApiGateway("course-materials?course_id=$groupId&order=created_at.desc", "GET")
        return when (result) {
            is BackendResult.Success -> BackendResult.Success(result.data.optJSONArray("data") ?: JSONArray())
            is BackendResult.Error -> BackendResult.Error(result.message, result.code)
        }
    }

    suspend fun addGroupResource(groupId: String, uploadedBy: String, title: String, fileType: String, fileSize: String): BackendResult<JSONObject> {
        // Note: Direct insert into course_materials requires admin privileges (RLS is_admin()).
        // This function will attempt an edge function call for non-admin users first.
        val fnPayload = JSONObject().apply {
            put("groupId", groupId)
            put("title", title)
            put("fileType", fileType)
            put("fileSize", fileSize)
            put("uploadedBy", uploadedBy)
        }
        val fnRes = executeEdgeFunction("add-group-resource", fnPayload)
        if (fnRes is BackendResult.Success) {
            val resourceObj = fnRes.data.optJSONObject("resource")
            if (resourceObj != null) return BackendResult.Success(resourceObj)
            return fnRes
        }

        // Fallback to direct REST (will fail for non-admin users due to RLS, logged gracefully)
        val payload = JSONObject().apply {
            put("course_id", groupId)
            put("title", title)
            put("description", "Uploaded by $uploadedBy")
            put("category", "other")
        }
        val result = tablePost("course_materials", payload)
        if (result is BackendResult.Error) {
            Log.w(TAG, "addGroupResource course_materials insert failed (RLS restriction for non-admin): ${result.message}")
        }
        return result
    }

    suspend fun getGroupEvents(groupId: String): BackendResult<JSONArray> {
        val result = executeApiGateway("social/events?group_id=$groupId&order=created_at.desc", "GET")
        return when (result) {
            is BackendResult.Success -> BackendResult.Success(result.data.optJSONArray("data") ?: JSONArray())
            is BackendResult.Error -> BackendResult.Error(result.message, result.code)
        }
    }

    suspend fun scheduleGroupEvent(groupId: String, createdBy: String, title: String, dateTime: String, location: String): BackendResult<JSONObject> {
        val isoTime = if (dateTime.contains("T")) dateTime else currentUtcIso()
        val payload = JSONObject().apply {
            put("group_id", groupId)
            put("title", title)
            put("description", "Scheduled study session")
            put("organizer_id", ensureValidUuid(createdBy))
            put("start_date", isoTime)
            put("end_date", isoTime)
            put("location", location)
        }
        return tablePost("social_events", payload)
    }

    suspend fun getSuggestedUsers(offset: Int = 0, limit: Int = 10): BackendResult<JSONArray> {
        val result = executeApiGateway("social-users?limit=$limit", "GET")
        return when (result) {
            is BackendResult.Success -> BackendResult.Success(result.data.optJSONArray("data") ?: JSONArray())
            is BackendResult.Error -> BackendResult.Error(result.message, result.code)
        }
    }

    suspend fun toggleFollowUser(followerId: String, followingId: String, isFollowing: Boolean): BackendResult<Boolean> {
        val fid = ensureValidUuid(followerId)
        val fwingId = ensureValidUuid(followingId)

        val fnPayload = JSONObject().apply {
            put("target_user_id", fwingId)
        }
        val fnRes = executeEdgeFunction("toggle-follow", fnPayload)
        if (fnRes is BackendResult.Success) {
            val isNowFollowing = fnRes.data.optBoolean("is_now_following", isFollowing)
            return BackendResult.Success(isNowFollowing)
        }

        // Fallback
        if (isFollowing) {
            val payload = JSONObject().apply {
                put("follower_id", fid)
                put("following_id", fwingId)
            }
            val res = tablePost("social_follows", payload)
            return when (res) {
                is BackendResult.Success -> BackendResult.Success(true)
                is BackendResult.Error -> res
            }
        } else {
            return tableDelete("social_follows", mapOf("follower_id" to fid, "following_id" to fwingId))
        }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // NOTES & DOCUMENTS (POSTGREST DATABASE TABLES)
    // ─────────────────────────────────────────────────────────────────────────────
    suspend fun getUserNotes(userId: String): BackendResult<JSONArray> {
        return tableGet("notes", order = "updated_at.desc")
    }

    suspend fun createNote(
        userId: String,
        title: String,
        content: String,
        category: String = "General",
        tags: String = "",
        aiSummary: String = "",
        isPinned: Boolean = false,
        isFavorite: Boolean = false,
        id: String = "",
        documentId: String? = null
    ): BackendResult<JSONObject> {
        val noteId = ensureValidUuid(if (id.isNotBlank()) id else java.util.UUID.randomUUID().toString())
        val cleanUserId = ensureValidUuid(userId)
        val payload = JSONObject().apply {
            put("id", noteId)
            put("user_id", cleanUserId)
            put("title", title)
            put("content", content)
            put("category", category)
            // Verified against the real schema: notes HAS tags (text[]), ai_summary and
            // document_id (the old comment was based on a stale fulldb.sql). Sync them so
            // cloud notes keep their tags/AI summary and document linkage. tags is a text[]
            // column, so the comma-separated local value is split into a JSON array — sending
            // a plain string would fail with a malformed-array-literal error.
            if (tags.isNotBlank()) {
                put("tags", JSONArray(tags.split(",").map { it.trim() }.filter { it.isNotEmpty() }))
            }
            if (aiSummary.isNotBlank()) put("ai_summary", aiSummary)
            if (!documentId.isNullOrBlank()) put("document_id", documentId)
        }
        return executeApiGateway("notes", "POST", payload).let { if (it is BackendResult.Success) BackendResult.Success(it.data.optJSONObject("data") ?: it.data) else BackendResult.Error((it as BackendResult.Error).message, it.code) }
    }

    suspend fun deleteNote(id: String): BackendResult<Boolean> {
        val cleanId = ensureValidUuid(id)
        return executeApiGateway("notes/$cleanId", "DELETE").let { if (it is BackendResult.Success) BackendResult.Success(true) else BackendResult.Error((it as BackendResult.Error).message, it.code) }
    }

    suspend fun getUserDocuments(userId: String): BackendResult<JSONArray> {
        return tableGet("documents", order = "created_at.desc")
    }

    suspend fun uploadFileToStorage(
        bucket: String = "documents",
        path: String,
        fileBytes: ByteArray,
        mimeType: String = "application/octet-stream"
    ): BackendResult<String> = withContext(Dispatchers.IO) {
        val baseUrl = getSupabaseUrl()
        val anonKey = getSupabaseAnonKey()

        if (baseUrl.isBlank() || anonKey.isBlank()) {
            return@withContext BackendResult.Error(UserMessages.NOT_READY)
        }

        val url = "$baseUrl/storage/v1/object/$bucket/$path"
        val bearerToken = if (!userAccessToken.isNullOrBlank()) "Bearer $userAccessToken" else "Bearer $anonKey"
        val requestBody = fileBytes.toRequestBody(mimeType.toMediaType())

        val request = Request.Builder()
            .url(url)
            .addHeader("apikey", anonKey)
            .addHeader("Authorization", bearerToken)
            .addHeader("x-upsert", "true")
            .post(requestBody)
            .build()

        try {
            val response = client.newCall(request).execute()
            val publicUrl = "$baseUrl/storage/v1/object/public/$bucket/$path"
            if (response.isSuccessful) {
                Log.d(TAG, "File uploaded successfully to Supabase Storage: $publicUrl")
                BackendResult.Success(publicUrl)
            } else {
                val errBody = response.body?.string() ?: ""
                Log.w(TAG, "Storage upload response code ${response.code}: $errBody")
                BackendResult.Error(UserMessages.UPLOAD_FAILED, response.code)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Storage upload exception: ${e.message}", e)
            BackendResult.Error(UserMessages.UPLOAD_FAILED)
        }
    }

    /**
     * Resolves a MIME type that document-processor's ENHANCED_FILE_TYPES map recognises.
     * An unrecognised MIME makes the edge function drop the file silently during intake,
     * so unknown extensions fall back to text/plain rather than an invented type.
     */
    private fun mimeTypeForDocument(fileName: String, fileType: String): String {
        val ext = fileName.substringAfterLast('.', "").lowercase()
        val byExt = when (ext) {
            "pdf" -> "application/pdf"
            "doc" -> "application/msword"
            "docx" -> "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            "ppt" -> "application/vnd.ms-powerpoint"
            "pptx" -> "application/vnd.openxmlformats-officedocument.presentationml.presentation"
            "xls" -> "application/vnd.ms-excel"
            "xlsx" -> "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            "rtf" -> "application/rtf"
            "odt" -> "application/vnd.oasis.opendocument.text"
            "ods" -> "application/vnd.oasis.opendocument.spreadsheet"
            "odp" -> "application/vnd.oasis.opendocument.presentation"
            "csv" -> "text/csv"
            "md", "markdown" -> "text/markdown"
            "html", "htm" -> "text/html"
            "json" -> "application/json"
            "xml" -> "text/xml"
            "txt", "log" -> "text/plain"
            "png" -> "image/png"
            "jpg", "jpeg" -> "image/jpeg"
            "webp" -> "image/webp"
            "gif" -> "image/gif"
            "bmp" -> "image/bmp"
            "heic" -> "image/heic"
            "heif" -> "image/heif"
            "tif", "tiff" -> "image/tiff"
            else -> null
        }
        if (byExt != null) return byExt

        return when {
            fileType.contains("pdf", ignoreCase = true) -> "application/pdf"
            fileType.contains("docx", ignoreCase = true) || fileType.contains("word", ignoreCase = true) ->
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            fileType.contains("pptx", ignoreCase = true) || fileType.contains("presentation", ignoreCase = true) ->
                "application/vnd.openxmlformats-officedocument.presentationml.presentation"
            fileType.contains("xlsx", ignoreCase = true) || fileType.contains("sheet", ignoreCase = true) ->
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            fileType.contains("png", ignoreCase = true) -> "image/png"
            fileType.contains("jpg", ignoreCase = true) || fileType.contains("jpeg", ignoreCase = true) -> "image/jpeg"
            fileType.contains("image", ignoreCase = true) -> "image/png"
            fileType.contains("url", ignoreCase = true) -> "text/uri-list"
            else -> "text/plain"
        }
    }

    /**
     * Drives resume-processing until the document reports complete, then returns the finished row.
     * The function extracts one chunk per call and answers with status only (never the document),
     * so the row is re-read from REST once extraction finishes. Returns null when the document
     * cannot be completed, letting the caller fall back.
     */
    private suspend fun resumeDocumentProcessing(userId: String, documentId: String): JSONObject? {
        repeat(MAX_RESUME_CALLS) { attempt ->
            val payload = JSONObject().apply {
                put("userId", userId)
                put("documentId", documentId)
            }
            val res = executeEdgeFunction("resume-processing", payload)
            if (res !is BackendResult.Success) {
                android.util.Log.w(TAG, "resume-processing call ${attempt + 1} failed for $documentId")
                return null
            }
            val status = res.data.optJSONArray("documents")?.optJSONObject(0)
            if (status == null) {
                android.util.Log.w(TAG, "resume-processing returned no status for $documentId")
                return null
            }
            if (status.optString("status") == "failed") {
                android.util.Log.w(TAG, "resume-processing failed for $documentId: ${status.optString("error")}")
                return null
            }
            if (status.optBoolean("isComplete") || !status.optBoolean("canResumeAgain", false)) {
                val rows = tableGet("documents", mapOf("id" to documentId)).getOrNull()
                return rows?.optJSONObject(0)
            }
        }
        android.util.Log.w(TAG, "resume-processing hit the $MAX_RESUME_CALLS-call cap for $documentId")
        return null
    }

    suspend fun createDocument(
        userId: String,
        title: String,
        fileName: String,
        fileType: String,
        fileSizeKb: Int,
        contentExtracted: String,
        id: String? = null,
        rawBytes: ByteArray? = null,
        folderId: String? = null
    ): BackendResult<JSONObject> {
        val cleanUserId = ensureValidUuid(userId)
        val cleanId = id?.let { ensureValidUuid(it) }
        val storagePath = "$cleanUserId/${System.currentTimeMillis()}_$fileName"

        // Never substitute extracted text for the file's bytes. The sync queue calls this without
        // rawBytes when the local copy is gone, and uploading contentExtracted under the original
        // MIME type produced "PDFs" that were really a few hundred bytes of AI prose — which the
        // next extraction then read back as if it were the document.
        if (rawBytes == null || rawBytes.isEmpty()) {
            val existing = if (cleanId != null) {
                tableGet("documents", mapOf("id" to cleanId)).getOrNull()?.optJSONObject(0)
            } else null
            if (existing != null) {
                android.util.Log.w(TAG, "createDocument called without file bytes for $cleanId; keeping the stored row as-is")
                return BackendResult.Success(existing)
            }
            android.util.Log.w(TAG, "createDocument called without file bytes and no stored row; metadata-only insert")
            val metaPayload = JSONObject().apply {
                if (cleanId != null) put("id", cleanId)
                put("user_id", cleanUserId)
                put("title", title.ifBlank { fileName.ifBlank { "Untitled Document" } })
                put("file_name", fileName.ifBlank { "document" })
                put("file_type", fileType.ifBlank { "pdf" })
                put("file_size", fileSizeKb * 1024)
                put("content_extracted", contentExtracted)
                put("type", fileType.ifBlank { "pdf" })
                put("processing_status", if (contentExtracted.isBlank()) "failed" else "completed")
                put("is_public", false)
                if (folderId != null) {
                    put("folder_id", folderId)
                    put("folder_ids", JSONArray().apply { put(folderId) })
                }
            }
            return tablePost("documents", metaPayload, onConflict = "id")
        }

        // Upload the real file bytes to Supabase Storage ('documents' bucket).
        val bytesToUpload = rawBytes
        // Must be a key of the edge function's ENHANCED_FILE_TYPES map, otherwise document-processor
        // drops the file during intake. Resolve from the file extension first (most reliable), then
        // fall back to the coarse fileType label.
        val mime = mimeTypeForDocument(fileName, fileType)

        val storageResult = uploadFileToStorage(
            bucket = "documents",
            path = storagePath,
            fileBytes = bytesToUpload,
            mimeType = mime
        )

        val publicFileUrl = storageResult.getOrNull() ?: "${getSupabaseUrl()}/storage/v1/object/public/documents/$storagePath"

        val hasContent = contentExtracted.isNotBlank()
        val status = if (hasContent) "completed" else "failed"
        val errorMsg = if (hasContent) JSONObject.NULL else "Document content is empty or extraction failed"
        val nowIso = currentUtcIso()

        // Rest payload for documents table matching exact database schema
        val restPayload = JSONObject().apply {
            if (cleanId != null) put("id", cleanId)
            put("user_id", cleanUserId)
            put("title", title.ifBlank { fileName.ifBlank { "Untitled Document" } })
            put("file_name", fileName.ifBlank { "document" })
            put("file_url", publicFileUrl)
            put("file_type", fileType.ifBlank { "pdf" })
            put("file_size", fileSizeKb * 1024)
            put("content_extracted", contentExtracted)
            put("type", fileType.ifBlank { "pdf" })
            put("processing_status", status)
            put("processing_error", errorMsg)
            put("processing_started_at", nowIso)
            put("processing_completed_at", nowIso)
            put("processing_metadata", JSONObject().apply {
                put("file_name", fileName)
                put("file_size_bytes", fileSizeKb * 1024)
                put("content_length", contentExtracted.length)
            })
            // No fake processing metadata: extraction is performed by the document-processor edge
            // function (or not at all), so extraction_model_used / total_processing_time_ms must
            // not be fabricated client-side.
            if (folderId != null) {
                put("folder_id", folderId)
                put("folder_ids", JSONArray().apply { put(folderId) })
            } else {
                put("folder_ids", JSONArray())
            }
            put("extraction_progress", if (hasContent) 100 else 0)
            put("continuation_attempt", 0)
            put("current_chunk", 1)
            put("total_chunks", 1)
            put("extraction_warning", JSONObject.NULL)
            put("is_public", false)
            if (folderId == null) put("folder_id", JSONObject.NULL)
        }

        // Edge function payload. Field names must match document-processor's processBase64File:
        // it requires `name` + `mimeType`, reads bytes from `data` (base64) or fetches `file_url`,
        // and ignores any client-supplied extracted text. Small files inline their bytes; larger
        // ones are handed over as a storage URL so the function can stream/resume instead of
        // holding a multi-megabyte base64 string in memory.
        val actualBytes = bytesToUpload.size
        val inlineBase64 = actualBytes in 1..INLINE_BASE64_MAX_BYTES
        val fnPayload = JSONObject().apply {
            put("userId", cleanUserId)
            put("files", JSONArray().apply {
                put(JSONObject().apply {
                    put("name", fileName)
                    put("mimeType", mime)
                    put("size", actualBytes)
                    put("title", title)
                    // Always hand over the public 'documents'-bucket URL. When file_url is present,
                    // document-processor keeps it instead of re-uploading the bytes to the private
                    // 'chat-documents' bucket — that URL is what the mobile list/reader use to show
                    // image thumbnails, so it must be publicly readable.
                    put("file_url", publicFileUrl)
                    if (inlineBase64) {
                        put("data", android.util.Base64.encodeToString(bytesToUpload, android.util.Base64.NO_WRAP))
                    }
                    if (cleanId != null) put("idToUpdate", cleanId)
                })
            })
        }

        // The row must exist before document-processor runs: with `idToUpdate` set, the function
        // UPDATEs that id and reports "Failed to save to database" when it matches nothing. Insert
        // first (content_extracted empty), then let the function fill in the extracted text.
        // Only seed when a caller-supplied id exists: an id-less seed INSERTs a second, empty
        // orphan row that document-processor never touches (it inserts its own row when no
        // idToUpdate is set) — that duplicated every id-less upload (e.g. the OCR scan flow).
        if (cleanId != null) {
            val seededRes = tablePost("documents", restPayload, onConflict = "id")
            if (seededRes is BackendResult.Error) {
                android.util.Log.w(TAG, "Seeding document row failed: ${seededRes.message}")
            }
        }

        // Try document-processor Edge function first: server-side extraction is the only source of
        // real document text, so its result takes precedence over anything the client guessed.
        val fnRes = executeEdgeFunction("document-processor", fnPayload)
        if (fnRes is BackendResult.Success) {
            val docsArr = fnRes.data.optJSONArray("documents")
                ?: fnRes.data.optJSONArray("savedDocuments")
            if (docsArr != null && docsArr.length() > 0) {
                val docObj = docsArr.getJSONObject(0)
                if (!docObj.has("file_url") || docObj.optString("file_url").isBlank()) {
                    docObj.put("file_url", publicFileUrl)
                }
                val docId = docObj.optString("id")
                val procStatus = docObj.optString("processing_status")
                if (docId.isNotBlank()) {
                    // Large files come back as 'partial': resume-processing continues extraction in
                    // chunks. Ask it to finish so callers get the whole document, not the first slice.
                    if (procStatus == "partial") {
                        val resumed = resumeDocumentProcessing(cleanUserId, docId)
                        if (resumed != null) return BackendResult.Success(resumed)
                    }
                    if (procStatus == "failed") {
                        // Document was saved but extraction failed (e.g. Gemini 429).
                        // Return Success so the client knows the document exists.
                        // The cron watchdog will retry extraction automatically.
                        android.util.Log.w(TAG, "Document extraction failed but doc saved: ${docObj.optString("processing_error")}")
                        return BackendResult.Success(docObj)
                    }
                    return BackendResult.Success(docObj)
                }
            }
            android.util.Log.w(
                TAG,
                "document-processor returned no documents (count=${fnRes.data.optInt("filesProcessedCount", -1)}, " +
                    "mime=$mime); falling back to REST insert without server extraction"
            )
        } else if (fnRes is BackendResult.Error) {
            android.util.Log.w(TAG, "document-processor failed (${fnRes.code}): ${fnRes.message}")
        }

        // The row was already seeded above. Re-read it rather than re-POSTing: a second upsert with
        // the original (empty) content_extracted would overwrite text the function just extracted.
        if (cleanId != null) {
            val rows = tableGet("documents", mapOf("id" to cleanId)).getOrNull()
            val row = rows?.optJSONObject(0)
            if (row != null) {
                if (!row.has("file_url") || row.optString("file_url").isBlank()) {
                    row.put("file_url", publicFileUrl)
                }
                return BackendResult.Success(row)
            }
        }

        // No id to read back (or the row vanished): fall back to a direct insert.
        val restRes = tablePost("documents", restPayload, onConflict = "id")
        if (restRes is BackendResult.Success) {
            val resObj = restRes.data
            if (!resObj.has("file_url") || resObj.optString("file_url").isBlank()) {
                resObj.put("file_url", publicFileUrl)
            }
            return BackendResult.Success(resObj)
        }

        // Return error if remote insert failed so repository can handle/log it
        return restRes
    }

    /**
     * Imports a pasted link (PDF, image, video, Office file or webpage) through the
     * fetch-web-url edge function, which validates accessibility, safety (SSRF/private-IP
     * checks, allowed file types) and size, downloads the content and runs it through the
     * same document-processor pipeline as a normal upload. Returns the finished document row
     * (with content_extracted); large PDFs are driven through resume-processing to completion.
     */
    suspend fun importWebUrl(
        userId: String,
        url: String,
        title: String? = null
    ): BackendResult<JSONObject> {
        val cleanUserId = ensureValidUuid(userId)
        val payload = JSONObject().apply {
            put("userId", cleanUserId)
            put("url", url.trim())
            if (!title.isNullOrBlank()) put("title", title.trim())
        }

        val fnRes = executeEdgeFunction("fetch-web-url", payload)
        if (fnRes !is BackendResult.Success) return fnRes

        val docsArr = fnRes.data.optJSONArray("documents")
        if (docsArr == null || docsArr.length() == 0) {
            val reason = fnRes.data.optString("error").ifBlank { "The link could not be imported." }
            return BackendResult.Error(reason)
        }

        val doc = docsArr.getJSONObject(0)
        val docId = doc.optString("id")
        val procStatus = doc.optString("processing_status")

        if (docId.isNotBlank() && procStatus == "partial") {
            // Large PDF: continue extraction chunk-by-chunk via resume-processing.
            val resumed = resumeDocumentProcessing(cleanUserId, docId)
            if (resumed != null) return BackendResult.Success(resumed)
            android.util.Log.w(TAG, "fetch-web-url returned partial and resume couldn't finish $docId")
        }

        if (procStatus == "failed") {
            val reason = doc.optString("processing_error").ifBlank { "extraction failed" }
            return BackendResult.Error("Document extraction failed: $reason")
        }

        return BackendResult.Success(doc)
    }

    /**
     * Pushes user-edited OCR text / title back to the cloud row created by the OCR import,
     * so the server copy matches what the user kept after reviewing the extracted text.
     */
    suspend fun updateDocumentContentBackend(
        documentId: String,
        title: String,
        content: String
    ): BackendResult<JSONObject> {
        val cleanId = ensureValidUuid(documentId)
        val payload = JSONObject().apply {
            put("title", title)
            put("content_extracted", content)
        }
        return tablePatch("documents", payload, mapOf("id" to cleanId))
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // DOCUMENT FOLDERS (mirrors the web app's document_folders model)
    // ─────────────────────────────────────────────────────────────────────────────

    suspend fun getDocumentFolders(userId: String): BackendResult<JSONArray> {
        val cleanUserId = ensureValidUuid(userId)
        return tableGet("document_folders", mapOf("user_id" to cleanUserId), order = "created_at.asc")
    }

    suspend fun createDocumentFolder(
        userId: String,
        id: String,
        name: String,
        color: String = "#3B82F6",
        description: String = ""
    ): BackendResult<JSONObject> {
        val cleanUserId = ensureValidUuid(userId)
        val payload = JSONObject().apply {
            put("id", id)
            put("user_id", cleanUserId)
            put("name", name)
            put("color", color.ifBlank { "#3B82F6" })
            put("description", description)
            put("parent_folder_id", JSONObject.NULL)
        }
        return tablePost("document_folders", payload, onConflict = "id")
    }

    suspend fun updateDocumentFolder(id: String, name: String? = null, color: String? = null): BackendResult<JSONObject> {
        val cleanId = ensureValidUuid(id)
        val payload = JSONObject()
        if (name != null) payload.put("name", name)
        if (color != null) payload.put("color", color)
        if (payload.length() == 0) return BackendResult.Success(JSONObject())
        return tablePatch("document_folders", payload, mapOf("id" to cleanId))
    }

    suspend fun deleteDocumentFolder(id: String): BackendResult<Boolean> {
        return tableDelete("document_folders", mapOf("id" to id))
    }

    /** Unassigns every document currently in [folderId] — used when the folder is deleted. */
    suspend fun unassignDocumentsFromFolder(folderId: String): BackendResult<Boolean> {
        val res = tablePatch(
            "documents",
            JSONObject().apply {
                put("folder_id", JSONObject.NULL)
                put("folder_ids", JSONArray())
            },
            mapOf("folder_id" to folderId)
        )
        return if (res is BackendResult.Success) BackendResult.Success(true) else BackendResult.Error("Could not unassign documents from folder")
    }

    /**
     * Moves a document into [folderId] (or out of any folder when null). Writes BOTH the
     * single folder_id column (used by the mobile app) and the folder_ids array (used by the
     * web app), so folders stay consistent across platforms.
     */
    suspend fun moveDocumentToFolderBackend(documentId: String, folderId: String?): BackendResult<JSONObject> {
        val cleanDocId = ensureValidUuid(documentId)
        val payload = JSONObject().apply {
            if (folderId != null) {
                put("folder_id", folderId)
                put("folder_ids", JSONArray().apply { put(folderId) })
            } else {
                put("folder_id", JSONObject.NULL)
                put("folder_ids", JSONArray())
            }
        }
        return tablePatch("documents", payload, mapOf("id" to cleanDocId))
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // AI INTEGRATIONS (Gemini API Direct Service)
    // ─────────────────────────────────────────────────────────────────────────────
    /**
     * Calls the gemini-chat edge function in NON-streaming mode. The mobile client has no SSE
     * reader, and the function defaults enableStreaming=true — without this flag the app would
     * store the raw "data: {...}" event text as the AI message. aiMessageIdToUpdate makes the
     * server update the SAME chat_messages row the app reserved locally, so the offline sync
     * queue's later upsert (same id) can never create a duplicate cloud row.
     *
     * userMessageIdToUpdate pins the user-message row the edge function writes (memory fix + no
     * duplicate user rows), and systemPromptOverride carries the thinking-mode instruction the
     * edge function prepends to its own generated system prompt.
     */
    suspend fun sendAiChatMessage(
        sessionId: String,
        message: String,
        messageIdToUpdate: String? = null,
        userMessageIdToUpdate: String? = null,
        systemPromptOverride: String? = null,
        attachedNoteIds: List<String> = emptyList(),
        attachedDocIds: List<String> = emptyList()
    ): BackendResult<String> = withContext(Dispatchers.IO) {
        val baseUrl = getSupabaseUrl()
        val anonKey = getSupabaseAnonKey()

        if (baseUrl.isBlank() || anonKey.isBlank()) {
            return@withContext BackendResult.Error(UserMessages.NOT_READY)
        }

        val url = "$baseUrl/functions/v1/gemini-chat"
        val mediaType = "application/json".toMediaType()

        val jsonBody = JSONObject().apply {
            put("message", message)
            put("sessionId", sessionId)
            put("userId", currentUserId ?: "00000000-0000-0000-0000-000000000000")
            put("enableStreaming", false)
            if (!messageIdToUpdate.isNullOrBlank()) {
                put("aiMessageIdToUpdate", messageIdToUpdate)
            }
            if (!userMessageIdToUpdate.isNullOrBlank()) {
                put("userMessageIdToUpdate", userMessageIdToUpdate)
            }
            if (!systemPromptOverride.isNullOrBlank()) {
                put("systemPromptOverride", systemPromptOverride)
            }
            if (attachedNoteIds.isNotEmpty()) {
                put("attachedNoteIds", JSONArray(attachedNoteIds))
            }
            if (attachedDocIds.isNotEmpty()) {
                put("attachedDocumentIds", JSONArray(attachedDocIds))
            }
        }

        val requestBody = jsonBody.toString().toRequestBody(mediaType)
        val bearerToken = if (!userAccessToken.isNullOrBlank()) "Bearer $userAccessToken" else "Bearer $anonKey"

        val request = Request.Builder()
            .url(url)
            .addHeader("apikey", anonKey)
            .addHeader("Authorization", bearerToken)
            .addHeader("Content-Type", "application/json")
            .post(requestBody)
            .build()

        try {
            val response = longRunningClient.newCall(request).execute()
            val code = response.code
            val bodyStr = response.body?.string() ?: ""

            if (response.isSuccessful) {
                val responseObj = JSONObject(bodyStr)
                val responseText = responseObj.optString("response", "").ifBlank {
                    responseObj.optString("reply", "")
                }
                if (responseText.isNotBlank()) {
                    BackendResult.Success(responseText)
                } else {
                    BackendResult.Success(bodyStr)
                }
            } else {
                loge("[AI] gemini-chat failed (HTTP $code)", bodyStr)
                BackendResult.Error(userFacingErrorMessage("Edge function error: $bodyStr"), code)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Exception calling gemini-chat Edge Function: ${e.localizedMessage ?: e.message}", e)
            BackendResult.Error(userFacingErrorMessage("Network error: ${e.localizedMessage ?: e.message}"))
        }
    }

    /**
     * The batched confirmation payload carried by the `confirmation_batch_required` SSE
     * event. Replaces N per-action `confirmation_required` events with ONE event covering
     * all pending actions, so the UI shows an honest "N items" ask and one reply resolves
     * the whole batch. Items reuse the per-action shape of the legacy event.
     */
    data class ConfirmationBatchRequired(
        val count: Int,
        val summary: String,
        val items: List<JSONObject>,
        val confirmLabel: String,
        val declineLabel: String
    ) {
        companion object {
            fun fromJson(obj: JSONObject): ConfirmationBatchRequired {
                val items = mutableListOf<JSONObject>()
                obj.optJSONArray("items")?.let { arr ->
                    for (i in 0 until arr.length()) {
                        arr.optJSONObject(i)?.let { items.add(it) }
                    }
                }
                return ConfirmationBatchRequired(
                    count = obj.optInt("count", items.size),
                    summary = obj.optString("summary", ""),
                    items = items,
                    confirmLabel = obj.optString("confirmLabel", "Yes, proceed"),
                    declineLabel = obj.optString("declineLabel", "No, cancel")
                )
            }
        }
    }

    /**
     * Streams a chat reply from the gemini-chat edge function over SSE — the SAME wire
     * protocol the web app uses. thinking_step events arrive in real time through
     * onThinkingStep (agent reasoning, rendered in the app's live panel), content arrives
     * token-by-token through onContentChunk, and the final text (plus the server-assigned
     * message ids) is returned once the 'done' event lands.
     *
     * The edge function embeds the event type inside each `data: {type, data}` JSON line;
     * this reader also tolerates the classic `event:`/`data:` split format. Falls back to
     * the plain JSON response when the function replies with non-SSE content.
     */
    suspend fun streamAiChatMessage(
        sessionId: String,
        message: String,
        messageIdToUpdate: String? = null,
        userMessageIdToUpdate: String? = null,
        systemPromptOverride: String? = null,
        attachedNoteIds: List<String> = emptyList(),
        attachedDocIds: List<String> = emptyList(),
        onThinkingStep: (JSONObject) -> Unit,
        onContentChunk: (String) -> Unit,
        onConfirmationRequired: (JSONObject) -> Unit = {},
        onConfirmationBatchRequired: (JSONObject) -> Unit = {}
    ): BackendResult<String> = withContext(Dispatchers.IO) {
        val baseUrl = getSupabaseUrl()
        val anonKey = getSupabaseAnonKey()

        if (baseUrl.isBlank() || anonKey.isBlank()) {
            return@withContext BackendResult.Error(UserMessages.NOT_READY)
        }

        // Silently renew the access token if it expired while the app was closed or idle.
        try { ensureFreshAccessToken() } catch (e: Exception) { Log.w(TAG, "[AUTH] Token freshness check failed: ${e.message}") }

        val url = "$baseUrl/functions/v1/gemini-chat"
        val mediaType = "application/json".toMediaType()

        val jsonBody = JSONObject().apply {
            put("message", message)
            put("sessionId", sessionId)
            put("userId", currentUserId ?: "00000000-0000-0000-0000-000000000000")
            put("enableStreaming", true)
            if (!messageIdToUpdate.isNullOrBlank()) put("aiMessageIdToUpdate", messageIdToUpdate)
            if (!userMessageIdToUpdate.isNullOrBlank()) put("userMessageIdToUpdate", userMessageIdToUpdate)
            if (!systemPromptOverride.isNullOrBlank()) put("systemPromptOverride", systemPromptOverride)
            if (attachedNoteIds.isNotEmpty()) put("attachedNoteIds", JSONArray(attachedNoteIds))
            if (attachedDocIds.isNotEmpty()) put("attachedDocumentIds", JSONArray(attachedDocIds))
        }

        val requestBody = jsonBody.toString().toRequestBody(mediaType)
        val bearerToken = if (!userAccessToken.isNullOrBlank()) "Bearer $userAccessToken" else "Bearer $anonKey"

        val request = Request.Builder()
            .url(url)
            .addHeader("apikey", anonKey)
            .addHeader("Authorization", bearerToken)
            .addHeader("Content-Type", "application/json")
            .post(requestBody)
            .build()

        // SSE streams can idle for many seconds between events (model calls, 15s heartbeats), so
        // the shared 20s read timeout could kill a slow generation. Use a dedicated long-timeout
        // client for the stream (3 min read, same as the web's 180s streaming timeout) PLUS an
        // absolute call deadline: a backend that keeps heartbeating but never sends `done`/`error`
        // can no longer block the client forever. 240s sits safely above the realistic
        // model-chain worst case while still guaranteeing a finite ceiling.
        val streamClient = client.newBuilder()
            .readTimeout(180, TimeUnit.SECONDS)
            .callTimeout(240, TimeUnit.SECONDS)
            .build()

        try {
            val response = streamClient.newCall(request).execute()
            val code = response.code
            val contentType = response.header("Content-Type") ?: ""

            if (!response.isSuccessful) {
                val errBody = response.body?.string() ?: ""
                loge("[AI] gemini-chat stream failed (HTTP $code)", errBody)
                return@withContext BackendResult.Error(userFacingErrorMessage("Edge function error: $errBody"), code)
            }

            // Non-SSE fallback (the function replied with plain JSON, e.g. an error path).
            if (!contentType.contains("text/event-stream")) {
                val bodyStr = response.body?.string() ?: ""
                val responseObj = try { JSONObject(bodyStr) } catch (e: Exception) { null }
                val responseText = responseObj?.optString("response", "")?.takeIf { it.isNotBlank() }
                    ?: responseObj?.optString("reply", "")
                // Surface any steps included in a JSON fallback as synthetic events.
                responseObj?.optJSONArray("steps")?.let { steps ->
                    for (i in 0 until steps.length()) {
                        steps.optJSONObject(i)?.let { onThinkingStep(it) }
                    }
                }
                if (responseText != null && responseText.isNotBlank()) {
                    onContentChunk(responseText)
                    BackendResult.Success(responseText)
                } else {
                    BackendResult.Success(bodyStr)
                }
            } else {
                // ── SSE stream parsing (blocks until 'done' or the stream ends) ──
                val reader = response.body?.let { java.io.BufferedReader(it.charStream()) }
                if (reader == null) return@withContext BackendResult.Error(UserMessages.AI_NO_RESPONSE)

                val contentBuilder = StringBuilder()
                var doneData: JSONObject? = null
                var streamError: String? = null
                var dataLine = ""
                var line: String? = reader.readLine()

                while (line != null) {
                    val l = line
                    if (l.isBlank()) {
                        // Blank line = end of one SSE event — dispatch it.
                        if (dataLine.isNotBlank()) {
                            val eventJson = try { JSONObject(dataLine) } catch (e: Exception) { null }
                            if (eventJson != null) {
                                when (eventJson.optString("type")) {
                                    "thinking_step" -> eventJson.optJSONObject("data")?.let { onThinkingStep(it) }
                                    "content_chunk" -> {
                                        val chunkData = eventJson.optJSONObject("data")
                                        val chunk = chunkData?.optString("content") ?: chunkData?.optString("chunk") ?: ""
                                        if (chunk.isNotBlank()) {
                                            contentBuilder.append(chunk)
                                            onContentChunk(chunk)
                                        }
                                    }
                                    "done" -> doneData = eventJson.optJSONObject("data")
                                    "confirmation_required" ->
                                        eventJson.optJSONObject("data")?.let { onConfirmationRequired(it) }
                                    "confirmation_batch_required" ->
                                        eventJson.optJSONObject("data")?.let { onConfirmationBatchRequired(it) }
                                    "error" -> streamError =
                                        eventJson.optJSONObject("data")?.optString("error")
                                            ?: eventJson.optString("data")
                                }
                            }
                        }
                        dataLine = ""
                    } else if (l.startsWith("data: ")) {
                        dataLine = l.substring(6).trim()
                    }
                    line = reader.readLine()
                }

                if (streamError != null) {
                    BackendResult.Error(streamError!!)
                } else {
                    val finalText = doneData?.optString("response", "")?.takeIf { it.isNotBlank() }
                        ?: contentBuilder.toString()
                    if (finalText.isNotBlank()) BackendResult.Success(finalText)
                    else BackendResult.Error(UserMessages.AI_NO_RESPONSE)
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Exception streaming from gemini-chat Edge Function: ${e.localizedMessage ?: e.message}", e)
            BackendResult.Error(userFacingErrorMessage("Network error: ${e.localizedMessage ?: e.message}"))
        }
    }

    suspend fun getLiveQuizLobbies(): BackendResult<JSONArray> {
        // Include allow_late_join so the client can hide private sessions from the public lobby list
        // (privacy toggle on the setup screen maps to allow_late_join, matching the web).
        val result = executeApiGateway("live-quiz-sessions?status=waiting&order=created_at.desc&limit=15", "GET")
        return when (result) {
            is BackendResult.Success -> BackendResult.Success(result.data.optJSONArray("data") ?: JSONArray())
            is BackendResult.Error -> BackendResult.Error(result.message, result.code)
        }
    }

    suspend fun createLiveQuizSession(
        userId: String,
        quizId: String,
        joinCode: String,
        status: String = "waiting"
    ): BackendResult<JSONObject> {
        val payload = JSONObject().apply {
            put("host_user_id", ensureValidUuid(userId))
            put("quiz_id", ensureValidUuid(quizId))
            put("join_code", joinCode)
            put("status", status)
        }
        return tablePost("live_quiz_sessions", payload)
    }

    suspend fun getClassRecordings(userId: String): BackendResult<JSONArray> {
        return tableGet("class_recordings", order = "created_at.desc")
    }

    suspend fun createClassRecording(
        userId: String,
        id: String,
        title: String,
        subject: String,
        durationSeconds: Int,
        audioUrl: String,
        transcript: String,
        summary: String,
        processingStatus: String
    ): BackendResult<JSONObject> {
        val payload = JSONObject().apply {
            put("id", id)
            put("user_id", userId)
            put("title", title)
            put("subject", subject)
            // Verified against the real schema: the class_recordings column is 'duration'
            // (NOT 'duration_seconds' — sending that key fails with HTTP 400 and the
            // recording never syncs to the cloud).
            put("duration", durationSeconds)
            put("audio_url", audioUrl)               // snake_case to match DB schema
            put("transcript", transcript)
            put("summary", summary)
            put("processing_status", processingStatus)
        }
        Log.d(TAG, "Creating class recording: title=$title, duration=$durationSeconds")
        return tablePost("class_recordings", payload)
    }

    suspend fun deleteClassRecording(id: String): BackendResult<Boolean> {
        return tableDelete("class_recordings", mapOf("id" to id))
    }

    // ── Audio processing (mirrors the web's useAudioProcessing → gemini-audio-processor flow) ──

    /**
     * Phase 1 of recording processing: transcribe audio at a public storage URL. The function
     * fetches the file server-side, so the URL must be a publicly readable storage object
     * (the 'documents' bucket is public, matching the web's upload path for recordings).
     */
    suspend fun transcribeAudioViaBackend(
        fileUrl: String,
        targetLanguage: String = "en"
    ): BackendResult<JSONObject> {
        val payload = JSONObject().apply {
            put("file_url", fileUrl)
            put("target_language", targetLanguage)
            put("mode", "transcribe")
        }
        return executeEdgeFunction("gemini-audio-processor", payload)
    }

    /**
     * Phase 2 of recording processing: generate a summary from an existing transcript
     * (no audio round-trip — fast, and mirrors the web's two-phase call).
     */
    suspend fun summarizeTranscriptViaBackend(transcript: String): BackendResult<JSONObject> {
        val payload = JSONObject().apply {
            put("mode", "summarize")
            put("transcript", transcript)
        }
        return executeEdgeFunction("gemini-audio-processor", payload)
    }

    suspend fun getAIPodcasts(userId: String): BackendResult<JSONArray> {
        return tableGet("ai_podcasts", order = "created_at.desc")
    }

    suspend fun createAIPodcast(
        userId: String,
        id: String,
        title: String,
        script: String,
        style: String,
        durationMinutes: Int,
        status: String
    ): BackendResult<JSONObject> {
        // Verified against the real schema: ai_podcasts has id, user_id, title, script,
        // style, duration_minutes, status, cover_image_url, description, tags, is_public,
        // is_live, listen_count, share_count, podcast_type... (there is NO 'topic' column —
        // the old comment was based on a stale fulldb.sql and would 400 on every sync).
        val payload = JSONObject().apply {
            put("id", id)
            put("user_id", userId)
            put("title", title)
            put("script", script)
            put("style", style)
            put("duration_minutes", durationMinutes)
            put("status", status)
            put("sources", JSONArray()) // Cloud column NOT NULL — empty array is valid
            put("audio_segments", JSONArray()) // Cloud column NOT NULL — empty array is valid
        }
        return tablePost("ai_podcasts", payload)
    }

    suspend fun deleteAIPodcast(id: String): BackendResult<Boolean> {
        return tableDelete("ai_podcasts", mapOf("id" to id))
    }

    suspend fun getCourseEnrollments(userId: String): BackendResult<JSONArray> {
        // Note: 'status' column does NOT exist in course_enrollments DB schema (fulldb.sql).
        // Removal of &status=eq.active filter prevents spurious 400 errors.
        return tableGet("course_enrollments")
    }

    /** Fetches a single enrollment (with the joined course row) — used to enrich realtime events. */
    suspend fun getCourseEnrollment(userId: String, courseId: String): BackendResult<JSONArray> {
        val cleanUserId = ensureValidUuid(userId)
        val cleanCourseId = ensureValidUuid(courseId)
        return tableGet("course_enrollments", mapOf("course_id" to cleanCourseId))
    }

    suspend fun enrollInCourse(userId: String, courseId: String): BackendResult<JSONObject> {
        val payload = JSONObject().apply {
            put("user_id", userId)
            put("course_id", courseId)
            // Note: 'status' column does NOT exist in course_enrollments DB schema (fulldb.sql)
        }
        return tablePost("course_enrollments", payload)
    }

    suspend fun unenrollFromCourse(userId: String, courseId: String): BackendResult<Boolean> {
        return tableDelete("course_enrollments", mapOf("user_id" to userId, "course_id" to courseId))
    }

    suspend fun getChatSessions(userId: String): BackendResult<JSONArray> {
        return tableGet("chat_sessions", order = "created_at.desc")
    }

    suspend fun createChatSession(userId: String, id: String, title: String): BackendResult<JSONObject> {
        val payload = JSONObject().apply {
            put("id", ensureValidUuid(id))
            put("user_id", ensureValidUuid(userId))
            put("title", title)
        }
        return tablePost("chat_sessions", payload)
    }

    suspend fun deleteChatSession(id: String): BackendResult<Boolean> {
        return tableDelete("chat_sessions", mapOf("id" to ensureValidUuid(id)))
    }

    suspend fun deleteChatMessage(id: String): BackendResult<Boolean> {
        return tableDelete("chat_messages", mapOf("id" to ensureValidUuid(id)))
    }

    suspend fun saveChatMessage(
        id: String,
        sessionId: String,
        role: String,
        content: String,
        userId: String = currentUserId ?: "",
        thinkingStepsJson: String? = null
    ): BackendResult<JSONObject> {
        val mappedRole = if (role == "model" || role == "assistant") "assistant" else "user"
        val payload = JSONObject().apply {
            put("id", ensureValidUuid(id))
            put("user_id", ensureValidUuid(userId))
            put("session_id", ensureValidUuid(sessionId))
            put("role", mappedRole)
            put("content", content)
            // Persist the agent's reasoning steps in their own column (never in content).
            if (!thinkingStepsJson.isNullOrBlank()) {
                put("thinking_steps", parseJsonValue(thinkingStepsJson))
            }
        }
        return tablePost("chat_messages", payload)
    }

    /** Parses a JSON-encoded array (or object) string into an org.json value, or null. */
    private fun parseJsonValue(text: String): Any? {
        return try {
            JSONArray(text)
        } catch (e: Exception) {
            try {
                JSONObject(text)
            } catch (e2: Exception) {
                null
            }
        }
    }

    suspend fun getChatMessages(sessionId: String): BackendResult<JSONArray> {
        val cleanSessionId = ensureValidUuid(sessionId)
        // The table's timestamp column is 'timestamp' (TIMESTAMPTZ); ordering by 'timestamp'
        // now aligns with the database schema of the chat_messages table.
        val result = executeApiGateway("chat/messages?session_id=$cleanSessionId&order=timestamp.asc", "GET")
        return when (result) {
            is BackendResult.Success -> BackendResult.Success(result.data.optJSONArray("data") ?: JSONArray())
            is BackendResult.Error -> BackendResult.Error(result.message, result.code)
        }
    }

    suspend fun createScheduleItem(userId: String, item: com.example.data.local.entities.ScheduleItemEntity): BackendResult<JSONObject> {
        val sdf = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.US).apply {
            timeZone = java.util.TimeZone.getTimeZone("UTC")
        }
        val startTimeIso = sdf.format(java.util.Date(item.startTimeMillis))
        val endTimeIso = sdf.format(java.util.Date(item.endTimeMillis))
        val mappedType = when (item.type.lowercase(java.util.Locale.US)) {
            "lecture", "class" -> "class"
            "study_session", "study" -> "study"
            "assignment" -> "assignment"
            "exam" -> "exam"
            else -> "other"
        }

        val payload = JSONObject().apply {
            put("id", ensureValidUuid(item.id))
            put("user_id", ensureValidUuid(userId))
            put("title", item.title)
            put("subject", item.subject)
            put("type", mappedType)
            put("start_time", startTimeIso)
            put("end_time", endTimeIso)
            put("location", item.location)
            put("description", item.description)
            // Verified against the real schema: schedule_items stores the color in 'color'
            // (there is no 'color_hex' column — sending it fails the whole INSERT).
            put("color", item.colorHex)
            put("is_recurring", item.isRecurring)
            if (item.recurrencePattern.isNotBlank()) put("recurrence_pattern", item.recurrencePattern)
            if (item.recurrenceEndDate != null) {
                put("recurrence_end_date", sdf.format(java.util.Date(item.recurrenceEndDate!!)))
            }
            if (item.recurrenceDaysOfWeek.isNotBlank()) put("recurrence_days", item.recurrenceDaysOfWeek)
        }
        return tablePost("schedule_items", payload, onConflict = "id")
    }

    suspend fun getScheduleItems(userId: String): BackendResult<JSONArray> {
        val cleanUserId = ensureValidUuid(userId)
        return tableGet("schedule_items", order = "start_time.asc")
    }

    suspend fun deleteScheduleItem(id: String): BackendResult<Boolean> {
        return tableDelete("schedule_items", mapOf("id" to ensureValidUuid(id)))
    }

    suspend fun createQuiz(
        userId: String,
        id: String,
        title: String,
        sourceType: String,
        questionsJson: String
    ): BackendResult<JSONObject> {
        val validSourceType = when(sourceType.lowercase()) {
            "recording", "notes", "ai", "live_custom" -> sourceType.lowercase()
            "doc", "document" -> "notes"
            "custom", "manual", "live_kahoot" -> "live_custom"
            else -> "ai"
        }
        val questionsArray = try {
            JSONArray(questionsJson)
        } catch (e: Exception) {
            JSONArray()
        }
        val payload = JSONObject().apply {
            put("id", ensureValidUuid(id))
            put("user_id", ensureValidUuid(userId))
            put("title", title)
            put("source_type", validSourceType)
            put("questions", questionsArray)
        }
        return executeApiGateway("quizzes", "POST", payload).let { if (it is BackendResult.Success) BackendResult.Success(it.data.optJSONObject("data") ?: it.data) else BackendResult.Error((it as BackendResult.Error).message, it.code) }
    }

    suspend fun getQuizzes(userId: String): BackendResult<JSONArray> {
        val cleanUserId = ensureValidUuid(userId)
        return tableGet("quizzes")
    }

    suspend fun deleteQuiz(id: String): BackendResult<Boolean> {
        val cleanId = ensureValidUuid(id)
        val attemptRes = tableDelete("quiz_attempts", mapOf("quiz_id" to cleanId))
        if (attemptRes is BackendResult.Error) {
            Log.w(TAG, "Error or RLS policy restriction deleting quiz attempts: ${attemptRes.message}. Continuing to delete quiz.")
        }
        return executeApiGateway("quizzes/$cleanId", "DELETE").let { if (it is BackendResult.Success) BackendResult.Success(true) else BackendResult.Error((it as BackendResult.Error).message, it.code) }
    }

    suspend fun saveQuizAttempt(
        userId: String,
        id: String,
        quizId: String,
        score: Int,
        totalQuestions: Int,
        percentage: Int,
        timeTakenSeconds: Int,
        xpEarned: Int,
        answersJson: String = "[]",
        liveResultsJson: String? = null
    ): BackendResult<JSONObject> {
        val answersArray = try { JSONArray(answersJson) } catch (e: Exception) { JSONArray() }
        val liveResults = liveResultsJson?.takeIf { it.isNotBlank() }?.let {
            try { JSONObject(it) } catch (e: Exception) { null }
        }
        val payload = JSONObject().apply {
            put("id", ensureValidUuid(id))
            put("user_id", ensureValidUuid(userId))
            put("quiz_id", ensureValidUuid(quizId))
            put("score", score)
            put("total_questions", totalQuestions)
            put("percentage", percentage)
            put("time_taken_seconds", timeTakenSeconds)
            put("answers", answersArray)
            put("xp_earned", xpEarned)
            if (liveResults != null) put("live_results", liveResults)
        }
        return executeApiGateway("quizzes/${quizId}/submit", "POST", payload).let { if (it is BackendResult.Success) BackendResult.Success(it.data.optJSONObject("data") ?: it.data) else BackendResult.Error((it as BackendResult.Error).message, it.code) }
    }

    suspend fun getQuizAttempts(userId: String): BackendResult<JSONArray> {
        val cleanUserId = ensureValidUuid(userId)
        return tableGet("quiz_attempts")
    }

    suspend fun createFlashcard(
        userId: String,
        id: String,
        front: String,
        back: String,
        category: String,
        difficulty: String,
        hint: String
    ): BackendResult<JSONObject> {
        val payload = JSONObject().apply {
            put("id", id)
            put("user_id", userId)
            // Verified against the deployed schema: the flashcards table uses front/back
            // (NOT question/answer — sending those columns fails with HTTP 400 and the card
            // never syncs to the cloud). difficulty & hint exist too.
            put("front", front)
            put("back", back)
            put("category", category)
            put("difficulty", difficulty)
            put("hint", hint)
        }
        return executeApiGateway("flashcards/cards", "POST", payload).let { if (it is BackendResult.Success) BackendResult.Success(it.data.optJSONObject("data") ?: it.data) else BackendResult.Error((it as BackendResult.Error).message, it.code) }
    }

    suspend fun getFlashcards(userId: String): BackendResult<JSONArray> {
        return tableGet("flashcards")
    }

    suspend fun deleteFlashcard(id: String): BackendResult<Boolean> {
        return executeApiGateway("flashcards/cards/$id", "DELETE").let { if (it is BackendResult.Success) BackendResult.Success(true) else BackendResult.Error((it as BackendResult.Error).message, it.code) }
    }

    suspend fun generateSummary(title: String, content: String): BackendResult<String> {
        return try {
            val payload = JSONObject().apply {
                put("title", title)
                put("content", content)
                put("type", "detailed")
            }
            val edgeRes = executeEdgeFunction("generate-summary", payload)
            if (edgeRes is BackendResult.Success) {
                val summaryText = edgeRes.data.optString("summary", "")
                    .ifBlank { edgeRes.data.optString("text", "") }
                    .ifBlank { edgeRes.data.optString("response", "") }
                if (summaryText.isNotBlank()) {
                    return BackendResult.Success(summaryText)
                }
            }

            BackendResult.Error("Failed to generate summary")
        } catch (e: Exception) {
            BackendResult.Error(userFacingErrorMessage("Summary generation error: ${e.localizedMessage ?: e.message}"))
        }
    }

    /**
     * Backend-backed AI quiz generation via the `generate-ai-quiz` edge function (the same one
     * the web app calls). Generates a personalized adaptive quiz from the user's topics, focus
     * areas, question count and difficulty, and returns the raw `{title, questions:[...]}` object
     * (questions use the backend's `correctAnswer` field — see [normalizeBackendQuizToMobileJson]).
     */
    suspend fun generateQuizViaBackend(
        userTopics: List<String>,
        focusAreas: List<String> = emptyList(),
        numQuestions: Int = 8,
        difficulty: String = "auto",
        learningStyle: String = "adaptive"
    ): BackendResult<JSONObject> {
        val topicsArr = JSONArray()
        userTopics.filter { it.isNotBlank() }.forEach { topicsArr.put(it) }
        if (topicsArr.length() == 0) topicsArr.put("General Knowledge")
        val focusArr = JSONArray()
        focusAreas.filter { it.isNotBlank() }.forEach { focusArr.put(it) }
        val payload = JSONObject().apply {
            put("user_topics", topicsArr)
            put("focus_areas", focusArr)
            put("num_questions", numQuestions.coerceIn(1, 20))
            put("difficulty", difficulty)
            put("recent_performance", JSONArray())
            put("learning_style", learningStyle)
        }
        return executeEdgeFunction("generate-ai-quiz", payload)
    }

    /**
     * Backend-backed quiz generation from user study content (notes, recordings, documents) via
     * the `generate-quiz` edge function — the same one the web uses for recording/notes quizzes.
     * Requires the content transcript (min 100 chars) and returns `{title, questions:[...]}`.
     */
    suspend fun generateQuizFromTranscriptBackend(
        name: String,
        transcript: String,
        numQuestions: Int = 5,
        difficulty: String = "intermediate"
    ): BackendResult<JSONObject> {
        val payload = JSONObject().apply {
            put("name", name.ifBlank { "Study Quiz" })
            put("transcript", transcript)
            put("num_questions", numQuestions.coerceIn(1, 20))
            put("difficulty", difficulty)
        }
        return executeEdgeFunction("generate-quiz", payload)
    }

    /**
     * Backend-backed personalized roadmap generation via the `generate-roadmap` edge function.
     * The function reads the user's education context server-side (or the explicit fields passed
     * here) and asks the AI for a week-by-week Ghanaian-curriculum learning path — lessons, practice
     * quizzes and games per enrolled subject. Returns `{ steps: [...] }` where each step mirrors a
     * `kid_roadmap_steps` row (id, subject_code, subject_name, week, day, step_index, title,
     * step_type, ref_id, xp_reward, due_date).
     */
    suspend fun generateRoadmap(
        country: String = "",
        educationLevel: String = "",
        curriculum: String = "",
        targetExam: String = "",
        yearOrGrade: String = "",
        institution: String = "",
        subjects: List<String> = emptyList(),
        weeks: Int = 4,
        week: Int = 0  // 0 = auto-detect next needed week; >0 = generate specific week
    ): BackendResult<JSONObject> {
        val subjectsArr = JSONArray()
        subjects.filter { it.isNotBlank() }.forEach { subjectsArr.put(it) }
        val payload = JSONObject().apply {
            put("country", country)
            put("education_level", educationLevel)
            put("curriculum", curriculum)
            put("target_exam", targetExam)
            put("year_or_grade", yearOrGrade)
            put("institution", institution)
            put("subjects", subjectsArr)
            put("weeks", weeks.coerceIn(1, 8))
            if (week > 0) put("week", week.coerceIn(1, 8))
        }
        return executeEdgeFunction("generate-roadmap", payload)
    }

    /**
     * Dedicated function for generating structured interactive lessons ("Today's Mission" / "Learn It").
     * Calls the dedicated `generate-interactive-lesson` Edge Function directly, bypassing conversational chat.
     */
    suspend fun generateInteractiveLesson(
        topic: String,
        subjectName: String = "",
        subjectCode: String = "",
        gradeLevel: String = "",
        country: String = "",
        curriculum: String = "",
        learningStyle: String = "",
        stepId: String = "",
        forceRegenerate: Boolean = false
    ): BackendResult<JSONObject> {
        val payload = JSONObject().apply {
            put("topic", topic)
            put("subject_name", subjectName)
            put("subject_code", subjectCode)
            put("grade_level", gradeLevel)
            put("country", country)
            put("curriculum", curriculum)
            put("learning_style", learningStyle)
            if (stepId.isNotBlank()) put("step_id", stepId)
            if (forceRegenerate) put("force_regenerate", true)
        }
        return executeEdgeFunction("generate-interactive-lesson", payload)
    }

    /**
     * Converts a backend `generate-ai-quiz` / `generate-quiz` response (`{title, questions:[...]}`
     * where each question uses `correctAnswer`) into the mobile app's question JSON array format
     * (`[{question, options, correct, explanation}]`). Returns an empty string when no valid
     * questions survive so callers can fall back to the direct Gemini chain (never dummy data).
     */
    fun normalizeBackendQuizToMobileJson(response: JSONObject): String {
        return try {
            val questions = response.optJSONArray("questions") ?: return ""
            val out = JSONArray()
            for (i in 0 until questions.length()) {
                val q = questions.getJSONObject(i)
                val question = q.optString("question", "").ifBlank { q.optString("question_text", "") }
                val optsArr = q.optJSONArray("options")
                if (question.isBlank() || optsArr == null || optsArr.length() < 2) continue
                val options = JSONArray()
                for (j in 0 until optsArr.length()) options.put(optsArr.getString(j))
                val correct = q.optInt("correctAnswer", q.optInt("correct", q.optInt("correct_answer", 0)))
                val explanation = q.optString("explanation", "")
                out.put(JSONObject().apply {
                    put("question", question)
                    put("options", options)
                    put("correct", correct)
                    put("explanation", explanation)
                })
            }
            if (out.length() == 0) "" else out.toString()
        } catch (e: Exception) {
            ""
        }
    }

    /** Calls the dedicated tts-narrate edge function to rewrite text for speech. */
    suspend fun narrateForTts(text: String, isKid: Boolean = false): BackendResult<String> {
        return try {
            val payload = JSONObject().apply {
                put("text", text)
                put("isKid", isKid)
            }
            val edgeRes = executeEdgeFunction("tts-narrate", payload)
            if (edgeRes is BackendResult.Success) {
                val rewritten = edgeRes.data.optString("rewritten", "")
                if (rewritten.isNotBlank()) return BackendResult.Success(rewritten)
            }
            BackendResult.Error("TTS narration failed")
        } catch (e: Exception) {            Log.e("BACKEND-API", "narrateForTts error: ${e.message}")
            BackendResult.Error("TTS narration error: ${e.message}")
        }
    }

    /** Calls the dedicated translate-text edge function. */
    suspend fun translateText(text: String, targetLanguage: String): BackendResult<String> {
        return try {
            val payload = JSONObject().apply { put("text", text); put("targetLanguage", targetLanguage) }
            val edgeRes = executeEdgeFunction("translate-text", payload)
            if (edgeRes is BackendResult.Success) {
                val translated = edgeRes.data.optString("translated", "")
                if (translated.isNotBlank()) return BackendResult.Success(translated)
            }
            BackendResult.Error("Translation failed")
        } catch (e: Exception) {
            BackendResult.Error("Translation error: ${e.message}")
        }
    }

    /** Calls the dedicated transform-note edge function (simplify/questions/fix/custom). */
    suspend fun transformNote(content: String, operation: String, customInstruction: String? = null): BackendResult<String> {
        return try {
            val payload = JSONObject().apply {
                put("content", content)
                put("operation", operation)
                if (customInstruction != null) put("customInstruction", customInstruction)
            }
            val edgeRes = executeEdgeFunction("transform-note", payload)
            if (edgeRes is BackendResult.Success) {
                val result = edgeRes.data.optString("result", "")
                if (result.isNotBlank()) return BackendResult.Success(result)
            }
            BackendResult.Error("Note transform failed")
        } catch (e: Exception) {
            BackendResult.Error("Note transform error: ${e.message}")
        }
    }

    /** Calls the dedicated generate-diagram edge function. */
    suspend fun generateDiagram(content: String, diagramType: String = "mermaid"): BackendResult<String> {
        return try {
            val payload = JSONObject().apply { put("content", content); put("diagramType", diagramType) }
            val edgeRes = executeEdgeFunction("generate-diagram", payload)
            if (edgeRes is BackendResult.Success) {
                val diagram = edgeRes.data.optString("diagram", "")
                if (diagram.isNotBlank()) return BackendResult.Success(diagram)
            }
            BackendResult.Error("Diagram generation failed")
        } catch (e: Exception) {
            BackendResult.Error("Diagram error: ${e.message}")
        }
    }

    /** Calls the dedicated rewrite-text edge function. */
    suspend fun rewriteText(text: String, style: String = "general"): BackendResult<String> {
        return try {
            val payload = JSONObject().apply { put("text", text); put("style", style) }
            val edgeRes = executeEdgeFunction("rewrite-text", payload)
            if (edgeRes is BackendResult.Success) {
                val rewritten = edgeRes.data.optString("rewritten", "")
                if (rewritten.isNotBlank()) return BackendResult.Success(rewritten)
            }
            BackendResult.Error("Rewrite failed")
        } catch (e: Exception) {
            BackendResult.Error("Rewrite error: ${e.message}")
        }
    }

    /** Calls the dedicated onboarding-assistant edge function (one-shot Gemini with system instruction). */
    suspend fun onboardingChat(prompt: String, systemInstruction: String): BackendResult<String> {
        return try {
            val payload = JSONObject().apply {
                put("prompt", prompt)
                put("systemInstruction", systemInstruction)
            }
            val edgeRes = executeEdgeFunction("onboarding-assistant", payload)
            if (edgeRes is BackendResult.Success) {
                val response = edgeRes.data.optString("response", "")
                if (response.isNotBlank()) return BackendResult.Success(response)
            }
            BackendResult.Error("Onboarding chat failed")
        } catch (e: Exception) {
            BackendResult.Error("Onboarding chat error: ${e.message}")
        }
    }

    suspend fun generateFlashcards(topic: String, count: Int = 6): BackendResult<JSONArray> {
        return try {
            val payload = JSONObject().apply {
                put("topic", topic)
                put("count", count)
                put("cardCount", count)
            }
            val edgeRes = executeEdgeFunction("generate-flashcards", payload)
            if (edgeRes is BackendResult.Success) {
                val cardsArr = edgeRes.data.optJSONArray("flashcards")
                    ?: edgeRes.data.optJSONArray("cards")
                    ?: edgeRes.data.optJSONArray("items")
                if (cardsArr != null && cardsArr.length() > 0) {
                    return BackendResult.Success(cardsArr)
                }
            }

            // Dedicated edge function is the sole path — return error if it fails.
            BackendResult.Error(userFacingErrorMessage("Flashcard generation failed. Please try again."))
        } catch (e: Exception) {
            BackendResult.Error(userFacingErrorMessage("Flashcard generation error: ${e.localizedMessage ?: e.message}"))
        }
    }

    suspend fun generatePodcast(title: String, textContent: String): BackendResult<JSONObject> {
        return try {
            val payload = JSONObject().apply {
                put("title", title)
                put("textContent", textContent)
            }
            val edgeRes = executeEdgeFunction("generate-podcast", payload)
            if (edgeRes is BackendResult.Success) {
                // Response format: { "success": true, "podcast": { "id", "script", "audio_segments", "duration_minutes", ... } }
                val podcastObj = edgeRes.data.optJSONObject("podcast")
                if (podcastObj != null) {
                    val script = podcastObj.optString("script", "")
                    if (script.isNotBlank()) return BackendResult.Success(podcastObj)
                }
                // Fallback: check top-level script (older format)
                val script = edgeRes.data.optString("script", "")
                if (script.isNotBlank()) {
                    return BackendResult.Success(JSONObject().apply {
                        put("script", script)
                        put("duration_minutes", 10)
                    })
                }
            }
            BackendResult.Error(userFacingErrorMessage("Podcast generation failed. Please try again."))
        } catch (e: Exception) {
            BackendResult.Error(userFacingErrorMessage("Podcast generation error: ${e.localizedMessage ?: e.message}"))
        }
    }

    suspend fun applyPromoCode(promoCode: String): BackendResult<JSONObject> {
        val userId = currentUserId
        if (userId.isNullOrBlank()) {
            return BackendResult.Error(UserMessages.SIGNED_OUT)
        }
        val body = JSONObject().apply {
            put("p_user_id", userId)
            put("p_promo_code", promoCode.trim())
        }
        return callRpc("apply_code_night_promo", body)
    }

    /**
     * Document Edge Function: Analyze Document Structure
     * Endpoint: /functions/v1/analyze-document-structure
     */
    suspend fun analyzeDocumentStructure(content: String, fileName: String = ""): BackendResult<JSONObject> {
        val payload = JSONObject().apply {
            put("content", content)
            put("fileName", fileName)
        }
        return executeEdgeFunction("analyze-document-structure", payload)
    }

    /**
     * Document Edge Function: Document Parser
     * Endpoint: /functions/v1/document-parser
     */
    suspend fun parseDocumentBackend(fileUrl: String, fileType: String, fileName: String = ""): BackendResult<JSONObject> {
        val payload = JSONObject().apply {
            put("fileUrl", fileUrl)
            put("fileType", fileType)
            put("fileName", fileName)
        }
        return executeEdgeFunction("document-parser", payload)
    }

    /**
     * Document Edge Function: Generate Note From Document
     * Endpoint: /functions/v1/generate-note-from-document
     *
     * The function requires `userProfile` with a nested `learning_preferences` object — omitting it
     * makes the function 400, and a missing/expired bearer token makes it 401.
     */
    suspend fun generateNoteFromDocumentBackend(
        docId: String,
        option: String = "summary",
        customPrompt: String = "",
        learningStyle: String = "visual",
        personalContext: String = "",
        preview: Boolean = true
    ): BackendResult<JSONObject> {
        val explanationStyle = when (option) {
            "summary" -> "concise and highlight-focused"
            "quiz" -> "active-recall and question-driven"
            "custom" -> customPrompt.ifBlank { "detailed and comprehensive" }
            else -> "detailed and comprehensive"
        }
        val payload = JSONObject().apply {
            put("documentId", docId)
            put("option", option)
            put("customPrompt", customPrompt)
            // The editor saves the note itself; ask the function not to persist a second copy.
            put("preview", preview)
            put("userProfile", JSONObject().apply {
                put("learning_style", learningStyle.ifBlank { "visual" })
                put("learning_preferences", JSONObject().apply {
                    put("explanation_style", explanationStyle)
                    put("examples", true)
                    put("difficulty", "intermediate")
                })
                if (personalContext.isNotBlank()) put("personal_context", personalContext)
            })
        }
        return executeEdgeFunction("generate-note-from-document", payload)
    }

    /**
     * Fetch tier-scoped leaderboard profiles ranked by total_xp.
     * Uses the server-side API Gateway leaderboard endpoint for a single efficient join.
     */
    suspend fun getLeaderboardProfiles(tier: String? = null, limit: Int = 25): BackendResult<JSONArray> {
        val tierParam = if (!tier.isNullOrBlank() && tier != "all") tier else "all"
        val result = executeApiGateway("leaderboard?tier=$tierParam&limit=$limit", "GET")
        return when (result) {
            is BackendResult.Success -> BackendResult.Success(result.data.optJSONArray("data") ?: JSONArray())
            is BackendResult.Error -> BackendResult.Error(result.message, result.code)
        }
    }

    /** Explorer class leaderboard — same school + academic level, ranked by total_xp. */
    suspend fun getClassLeaderboardProfiles(school: String, academicLevel: String, limit: Int = 50): BackendResult<JSONArray> {
        val encodedSchool = java.net.URLEncoder.encode(school, "UTF-8")
        val encodedLevel = java.net.URLEncoder.encode(academicLevel, "UTF-8")
        val result = executeApiGateway("leaderboard?school=$encodedSchool&academic_level=$encodedLevel&limit=$limit", "GET")
        return when (result) {
            is BackendResult.Success -> BackendResult.Success(result.data.optJSONArray("data") ?: JSONArray())
            is BackendResult.Error -> BackendResult.Error(result.message, result.code)
        }
    }

    /**
     * Upsert complete user_stats to the cloud for full lifetime tracking & leaderboard ranking.
     * Uses the on_conflict=user_id upsert so the row is created on first call.
     */
    suspend fun syncUserStatsFull(
        userId: String,
        totalXp: Int,
        level: Int = 1,
        currentStreak: Int = 0,
        longestStreak: Int = 0,
        totalQuizzesAttempted: Int = 0,
        totalQuizzesCompleted: Int = 0,
        averageScore: Float = 0f,
        totalStudyTimeSeconds: Int = 0,
        badgesEarned: List<String> = emptyList(),
        lastActivityDate: String? = null,
        streakFreezes: Int = 0,
        lastDailyQuestClaimedDate: String = ""
    ) {
        val obj = JSONObject().apply {
            put("user_id", userId)
            put("total_xp", totalXp)
            put("level", maxOf(1, level))
            put("current_streak", maxOf(0, currentStreak))
            put("longest_streak", maxOf(0, longestStreak))
            put("total_quizzes_attempted", maxOf(0, totalQuizzesAttempted))
            put("total_quizzes_completed", maxOf(0, totalQuizzesCompleted))
            put("average_score", averageScore.toDouble())
            put("total_study_time_seconds", maxOf(0, totalStudyTimeSeconds))
            put("streak_freezes", maxOf(0, streakFreezes))
            if (lastDailyQuestClaimedDate.isNotBlank()) {
                put("last_daily_quest_claimed_date", lastDailyQuestClaimedDate)
            }
            if (!lastActivityDate.isNullOrBlank()) {
                put("last_activity_date", lastActivityDate)
            }
            if (badgesEarned.isNotEmpty()) {
                val array = JSONArray()
                badgesEarned.forEach { array.put(it) }
                put("badges_earned", array)
            }
        }
        val body = JSONArray().put(obj)
        try {
            executeApiGateway("user_stats?on_conflict=user_id", "POST", body.getJSONObject(0))
        } catch (e: Exception) { /* best-effort */ }
    }

    suspend fun syncUserStatsTotalXp(
        userId: String,
        totalXp: Int,
        currentStreak: Int = 0,
        longestStreak: Int = 0,
        badgesEarned: List<String> = emptyList()
    ) {
        syncUserStatsFull(
            userId = userId,
            totalXp = totalXp,
            level = (totalXp / 500) + 1,
            currentStreak = currentStreak,
            longestStreak = longestStreak,
            badgesEarned = badgesEarned
        )
    }

    /**
     * Fetch cloud user_stats for a user (for reading total_xp, streaks, etc.)
     */
    suspend fun fetchUserStats(userId: String): BackendResult<org.json.JSONObject> {
        val result = executeApiGateway("user-stats?user_id=$userId", "GET")
        return when (result) {
            is BackendResult.Success -> {
                val rpcData = result.data.optJSONObject("data") ?: result.data
                BackendResult.Success(rpcData)
            }
            is BackendResult.Error -> BackendResult.Error(result.message, result.code)
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // SERVER-SIDE RPC CLIENT METHODS — single source of truth for all mutations
    // ═══════════════════════════════════════════════════════════════════════════════

    /** Call any server-side RPC via the API Gateway. */
    private suspend fun callRpc(functionName: String, params: org.json.JSONObject = org.json.JSONObject()): BackendResult<org.json.JSONObject> {
        val result = executeApiGateway("rpc/$functionName", "POST", params)
        return when (result) {
            is BackendResult.Success -> {
                val data = result.data
                val rpcData = data.optJSONObject("data") ?: data
                BackendResult.Success(rpcData)
            }
            is BackendResult.Error -> result
        }
    }

    /** Server-side: Award XP, update level, update points_balance. */
    suspend fun awardXp(userId: String, xpAmount: Int, reason: String = "activity"): BackendResult<org.json.JSONObject> {
        return callRpc("award_xp", org.json.JSONObject().apply {
            put("p_user_id", ensureValidUuid(userId))
            put("p_xp_amount", xpAmount)
            put("p_reason", reason)
        })
    }

    /** Server-side: Submit quiz result — updates quiz stats, XP, streak atomically. */
    suspend fun submitQuizResult(userId: String, score: Int, total: Int, timeSeconds: Int = 0): BackendResult<org.json.JSONObject> {
        return callRpc("submit_quiz_result", org.json.JSONObject().apply {
            put("p_user_id", ensureValidUuid(userId))
            put("p_score", score)
            put("p_total", total)
            put("p_time_seconds", timeSeconds)
        })
    }

    /** Server-side: Spend credits atomically (balance check + deduction). */
    suspend fun spendCredits(userId: String, cost: Int, item: String = "item"): BackendResult<org.json.JSONObject> {
        return callRpc("spend_credits", org.json.JSONObject().apply {
            put("p_user_id", ensureValidUuid(userId))
            put("p_cost", cost)
            put("p_item", item)
        })
    }

    /** Server-side: Record activity for streak update. */
    suspend fun recordActivity(userId: String): BackendResult<org.json.JSONObject> {
        return callRpc("record_activity", org.json.JSONObject().apply {
            put("p_user_id", ensureValidUuid(userId))
        })
    }

    /** Server-side: Claim daily quest reward. */
    suspend fun claimDailyQuest(userId: String, points: Int): BackendResult<org.json.JSONObject> {
        return callRpc("claim_daily_quest", org.json.JSONObject().apply {
            put("p_user_id", ensureValidUuid(userId))
            put("p_points", points)
        })
    }

    /** Server-side: Claim a badge with eligibility check + XP award. */
    suspend fun claimBadge(userId: String, badgeName: String): BackendResult<org.json.JSONObject> {
        return callRpc("claim_badge", org.json.JSONObject().apply {
            put("p_user_id", ensureValidUuid(userId))
            put("p_badge_name", badgeName)
        })
    }

    /** Server-side: Submit game result — updates game progress, XP, streak atomically. */
    suspend fun submitGameResult(userId: String, gameKey: String, level: Int, score: Int, total: Int): BackendResult<org.json.JSONObject> {
        return callRpc("submit_game_result", org.json.JSONObject().apply {
            put("p_user_id", ensureValidUuid(userId))
            put("p_game_key", gameKey)
            put("p_level", level)
            put("p_score", score)
            put("p_total", total)
        })
    }

    /** Server-side: Purchase streak freeze (atomic credit deduction + freeze grant). */
    suspend fun purchaseStreakFreeze(userId: String, cost: Int = 100): BackendResult<org.json.JSONObject> {
        return callRpc("purchase_streak_freeze", org.json.JSONObject().apply {
            put("p_user_id", ensureValidUuid(userId))
            put("p_cost", cost)
        })
    }

    // UNIFIED SERVER-SIDE API GATEWAY CLIENT METHODS

    /**
     * Generic execution wrapper for the server-side API Gateway.
     */
    suspend fun executeApiGateway(
        subPath: String,
        method: String = "GET",
        bodyJson: org.json.JSONObject? = null
    ): BackendResult<org.json.JSONObject> = withContext(Dispatchers.IO) {
        val baseUrl = getSupabaseUrl()
        val anonKey = getSupabaseAnonKey()
        val url = "$baseUrl/functions/v1/api/v1/$subPath"
        val sessionToken = userAccessToken

        val reqBuilder = Request.Builder().url(url)
        reqBuilder.addHeader("apikey", anonKey)
        if (!sessionToken.isNullOrBlank()) {
            reqBuilder.addHeader("Authorization", "Bearer $sessionToken")
        }

        val requestBody = if (bodyJson != null && (method == "POST" || method == "PUT" || method == "PATCH")) {
            bodyJson.toString().toRequestBody("application/json; charset=utf-8".toMediaType())
        } else if (method == "POST") {
            "{}".toRequestBody("application/json; charset=utf-8".toMediaType())
        } else null

        when (method.uppercase()) {
            "GET" -> reqBuilder.get()
            "POST" -> reqBuilder.post(requestBody ?: "".toRequestBody(null))
            "PUT" -> reqBuilder.put(requestBody ?: "".toRequestBody(null))
            "DELETE" -> reqBuilder.delete()
            else -> reqBuilder.get()
        }

        val request = reqBuilder.build()
        try {
            var response = client.newCall(request).execute()
            var rawBody = response.body?.string() ?: ""
            // Retry on transient failures (5xx, network errors) up to 2 times with backoff
            var retries = 0
            val maxRetries = 2
            while (retries < maxRetries && (response.code >= 500 || response.code == 0)) {
                retries++
                val backoffMs = retries * 1500L
                Log.w(TAG, "[RETRY] API $subPath failed (HTTP ${response.code}), retry $retries/$maxRetries in ${backoffMs}ms")
                kotlinx.coroutines.delay(backoffMs)
                try {
                    response = client.newCall(request).execute()
                    rawBody = response.body?.string() ?: ""
                } catch (retryE: Exception) {
                    Log.w(TAG, "[RETRY] API $subPath retry $retries failed: ${retryE.message}")
                    rawBody = ""
                }
            }
            if (!response.isSuccessful) {
                return@withContext BackendResult.Error("API Gateway HTTP ${response.code}: $rawBody", response.code)
            }
            val json = if (rawBody.isNotBlank()) org.json.JSONObject(rawBody) else org.json.JSONObject()
            if (json.optBoolean("success", false)) {
                return@withContext BackendResult.Success(json)
            } else {
                return@withContext BackendResult.Error(json.optString("error", "Unknown API error"), response.code)
            }
        } catch (e: Exception) {
            Log.e(TAG, "API Gateway network error: ${e.message}", e)
            return@withContext BackendResult.Error("Network error calling API Gateway: ${e.message}")
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // EDGE FUNCTION CLIENT — calls Supabase Edge Functions directly
    // ═══════════════════════════════════════════════════════════════════════════════

    internal suspend fun executeEdgeFunction(
        functionName: String,
        body: JSONObject = JSONObject()
    ): BackendResult<JSONObject> = withContext(Dispatchers.IO) {
        val baseUrl = getSupabaseUrl()
        val anonKey = getSupabaseAnonKey()
        if (baseUrl.isBlank() || anonKey.isBlank()) {
            return@withContext BackendResult.Error(UserMessages.NOT_READY)
        }
        try { ensureFreshAccessToken() } catch (e: Exception) { Log.w(TAG, "[AUTH] Token freshness check failed: ${e.message}") }

        val url = "$baseUrl/functions/v1/$functionName"
        val mediaType = "application/json".toMediaType()
        val requestBody = body.toString().toRequestBody(mediaType)
        val bearerToken = if (!userAccessToken.isNullOrBlank()) "Bearer $userAccessToken" else "Bearer $anonKey"

        fun buildRequest(): Request = Request.Builder()
            .url(url)
            .addHeader("apikey", anonKey)
            .addHeader("Authorization", bearerToken)
            .addHeader("Content-Type", "application/json")
            .post(requestBody)
            .build()

        try {
            // Route long-running edge functions through the generous-timeout client so they
            // don't get killed mid-flight by the 15 s default (the function may need >60 s
            // for document processing, podcast generation, etc.).
            val callClient = if (functionName in LONG_RUNNING_FUNCTIONS) longRunningClient else client
            var response = callClient.newCall(buildRequest()).execute()
            var code = response.code
            var bodyStr = response.body?.string() ?: ""
            // Retry on transient failures (5xx, network errors) up to 2 times with backoff
            var retries = 0
            val maxRetries = 2
            while (retries < maxRetries && (code >= 500 || code == 0)) {
                retries++
                val backoffMs = retries * 1500L
                Log.w(TAG, "[RETRY] $functionName failed (HTTP $code), retry $retries/$maxRetries in ${backoffMs}ms")
                kotlinx.coroutines.delay(backoffMs)
                try {
                    response = callClient.newCall(buildRequest()).execute()
                    code = response.code
                    bodyStr = response.body?.string() ?: ""
                } catch (retryE: Exception) {
                    Log.w(TAG, "[RETRY] $functionName retry $retries failed: ${retryE.message}")
                    bodyStr = ""
                    code = 0
                }
            }
            if (code == 401 && refreshSessionIfPossible()) {
                response = callClient.newCall(buildRequest()).execute()
                code = response.code
                bodyStr = response.body?.string() ?: ""
            }
            if (response.isSuccessful) {
                val json = try { JSONObject(bodyStr) } catch (e: Exception) { JSONObject() }
                BackendResult.Success(json)
            } else {
                val err = parseSupabaseError(bodyStr, code)
                BackendResult.Error(userFacingErrorMessage(err), code)
            }
        } catch (e: Exception) {
            BackendResult.Error(userFacingErrorMessage("Network error calling $functionName: ${e.localizedMessage ?: e.message}"))
        }
    }

    suspend fun apiGetNotes(folderId: String? = null, search: String? = null): BackendResult<org.json.JSONArray> {
        val query = buildString {
            append("notes?")
            if (!folderId.isNullOrBlank()) append("folder_id=$folderId&")
            if (!search.isNullOrBlank()) append("search=${java.net.URLEncoder.encode(search, "UTF-8")}&")
        }
        val res = executeApiGateway(query, "GET")
        return when (res) {
            is BackendResult.Success -> BackendResult.Success(res.data.optJSONArray("data") ?: org.json.JSONArray())
            is BackendResult.Error -> BackendResult.Error(res.message, res.code)
        }
    }

    suspend fun apiCreateNote(title: String, content: String, tags: List<String> = emptyList(), folderId: String? = null): BackendResult<org.json.JSONObject> {
        val payload = org.json.JSONObject().apply {
            put("title", title)
            put("content", content)
            if (folderId != null) put("folder_id", folderId)
            val tagsArr = org.json.JSONArray()
            tags.forEach { tagsArr.put(it) }
            put("tags", tagsArr)
        }
        val res = executeApiGateway("notes", "POST", payload)
        return when (res) {
            is BackendResult.Success -> BackendResult.Success(res.data.optJSONObject("data") ?: org.json.JSONObject())
            is BackendResult.Error -> BackendResult.Error(res.message, res.code)
        }
    }

    suspend fun apiGetFlashcardDecks(): BackendResult<org.json.JSONArray> {
        val res = executeApiGateway("flashcards/decks", "GET")
        return when (res) {
            is BackendResult.Success -> BackendResult.Success(res.data.optJSONArray("data") ?: org.json.JSONArray())
            is BackendResult.Error -> BackendResult.Error(res.message, res.code)
        }
    }

    suspend fun apiSubmitFlashcardReview(cardId: String, rating: Int): BackendResult<org.json.JSONObject> {
        val payload = org.json.JSONObject().apply {
            put("card_id", cardId)
            put("rating", rating)
        }
        val res = executeApiGateway("flashcards/review", "POST", payload)
        return when (res) {
            is BackendResult.Success -> BackendResult.Success(res.data.optJSONObject("data") ?: org.json.JSONObject())
            is BackendResult.Error -> BackendResult.Error(res.message, res.code)
        }
    }

    suspend fun apiIngestWebResource(url: String, title: String? = null): BackendResult<org.json.JSONObject> {
        val payload = org.json.JSONObject().apply {
            put("url", url)
            if (!title.isNullOrBlank()) put("title", title)
        }
        val res = executeApiGateway("documents/ingest-web", "POST", payload)
        return when (res) {
            is BackendResult.Success -> BackendResult.Success(res.data.optJSONObject("data") ?: org.json.JSONObject())
            is BackendResult.Error -> BackendResult.Error(res.message, res.code)
        }
    }
}
