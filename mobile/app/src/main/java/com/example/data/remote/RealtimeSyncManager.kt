package com.example.data.remote

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.TimeUnit

/**
 * Long-lived Supabase Realtime (Phoenix websocket) client that mirrors cloud table
 * changes into Room in real time using the same minimal protocol as the app's existing
 * [LiveQuizRealtimeClient] (no supabase-kt dependency needed).
 *
 * One socket + one channel per logged-in user subscribes to `postgres_changes` on the
 * user-scoped tables (filtered by `user_id`) and the public `social_posts` feed (unfiltered):
 * notes, documents, flashcards, quizzes, quiz_attempts, chat_sessions, chat_messages,
 * schedule_items, course_enrollments, social_posts.
 *
 * Connect/disconnect lifecycle is managed by [StuddyHubRepository] — connect on login
 * and app startup, disconnect on logout, rejoin on token refresh.
 */
class RealtimeSyncManager(
    private val onTableChange: (table: String, action: String, row: JSONObject) -> Unit
) {
    companion object {
        private const val TAG = "RealtimeSync"
        private const val HEARTBEAT_INTERVAL_MS = 25_000L
    }

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val socket: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(0, TimeUnit.MILLISECONDS)  // websocket stays open
        .pingInterval(20, TimeUnit.SECONDS)
        .build()

    @Volatile
    private var webSocket: WebSocket? = null
    @Volatile
    private var refCounter = 0
    @Volatile
    private var reconnectAttempts = 0
    @Volatile
    private var activeUserId: String? = null
    private var heartbeatJob: Job? = null

    /** Tables scoped to a single user (filtered by user_id), plus social_posts (public). */
    private val managedTables = listOf(
        "notes", "documents", "document_folders", "flashcards", "quizzes", "quiz_attempts",
        "chat_sessions", "chat_messages", "schedule_items", "course_enrollments",
        "social_posts"
    )

    // -----------------------------------------------------------------
    // Public API
    // -----------------------------------------------------------------

    /** Connect (or re-join) for the given user. Safe to call repeatedly. */
    @Synchronized
    fun connect(userId: String) {
        if (userId.isBlank()) return
        val previous = activeUserId
        activeUserId = userId
        if (webSocket == null) {
            connectSocket()
        } else if (previous != userId) {
            // User changed — leave the old channel and join the new one
            leaveChannel(previous?.takeIf { it.isNotBlank() })
            joinChannel()
        }
    }

    /** Tear down the socket and clear the user. */
    @Synchronized
    fun disconnect() {
        activeUserId = null
        closeSocket()
    }

    /** Whether the WebSocket has been opened (may be briefly stale on drop). */
    fun isConnected(): Boolean = webSocket != null

    /**
     * Re-join the channel (e.g. after the access token has silently refreshed) so RLS
     * authorisation stays valid. The join carries the current JWT from BackendApiService.
     */
    @Synchronized
    fun refresh() {
        if (webSocket != null && activeUserId != null) {
            joinChannel()
        }
    }

    /** Full teardown — call from the repository when clearing everything. */
    fun shutdown() {
        disconnect()
        scope.cancel()
    }

    // -----------------------------------------------------------------
    // Socket lifecycle
    // -----------------------------------------------------------------

    private fun connectSocket() {
        if (webSocket != null) return
        val url = buildUrl() ?: return
        try {
            webSocket = socket.newWebSocket(
                Request.Builder().url(url).build(),
                listener
            )
        } catch (e: Exception) {
            android.util.Log.e(TAG, "connect failed", e)
        }
    }

    private fun closeSocket() {
        heartbeatJob?.cancel()
        heartbeatJob = null
        val ws = webSocket
        webSocket = null
        reconnectAttempts = 0
        ws?.close(1000, "client shutdown")
    }

    private fun buildUrl(): String? {
        val base = BackendApiService.getSupabaseUrl()
        val anon = BackendApiService.getSupabaseAnonKey()
        if (base.isBlank() || anon.isBlank()) return null
        val host = base.replace("https://", "wss://").replace("http://", "ws://")
        return "$host/realtime/v1/websocket?apikey=$anon&vsn=1.0.0"
    }

    // -----------------------------------------------------------------
    // Phoenix protocol messages
    // -----------------------------------------------------------------

    private fun nextRef(): Int = ++refCounter

    private fun send(topic: String, event: String, payload: JSONObject, ref: Int? = null) {
        try {
            val message = JSONObject().apply {
                put("topic", topic)
                put("event", event)
                put("payload", payload)
                put("ref", ref ?: JSONObject.NULL)
            }
            webSocket?.send(message.toString())
        } catch (e: Exception) {
            android.util.Log.e(TAG, "send failed", e)
        }
    }

    private fun userChannelTopic(userId: String) = "realtime:${userId}"

    /** Build the postgres_changes config for a single table. */
    private fun postgresChange(table: String, filter: String?): JSONObject = JSONObject().apply {
        put("event", "*")
        put("schema", "public")
        put("table", table)
        if (filter != null) put("filter", filter)
    }

    private fun postgresChangesConfig(userId: String): JSONArray = JSONArray().apply {
        // User-scoped tables — note: quiz_attempts, chat_messages, etc. all carry user_id
        put(postgresChange("notes", "user_id=eq.$userId"))
        put(postgresChange("documents", "user_id=eq.$userId"))
        put(postgresChange("document_folders", "user_id=eq.$userId"))
        put(postgresChange("flashcards", "user_id=eq.$userId"))
        put(postgresChange("quizzes", "user_id=eq.$userId"))
        put(postgresChange("quiz_attempts", "user_id=eq.$userId"))
        put(postgresChange("chat_sessions", "user_id=eq.$userId"))
        put(postgresChange("chat_messages", "user_id=eq.$userId"))
        put(postgresChange("schedule_items", "user_id=eq.$userId"))
        put(postgresChange("course_enrollments", "user_id=eq.$userId"))
        // Public feed — no filter; RLS (social_posts_select_auth) allows any authenticated user
        put(postgresChange("social_posts", null))
    }

    private fun joinChannel() {
        val userId = activeUserId ?: return
        val token = BackendApiService.userAccessToken
            ?: BackendApiService.getSupabaseAnonKey()
        val payload = JSONObject().apply {
            put("config", JSONObject().apply {
                put("postgres_changes", postgresChangesConfig(userId))
            })
            put("access_token", token)
        }
        send(userChannelTopic(userId), "phoenix.join", payload, nextRef())
    }

    private fun leaveChannel(userId: String?) {
        userId?.takeIf { it.isNotBlank() }?.let {
            send(userChannelTopic(it), "phoenix.leave", JSONObject(), nextRef())
        }
    }

    // -----------------------------------------------------------------
    // Event handling
    // -----------------------------------------------------------------

    private val listener = object : WebSocketListener() {
        override fun onOpen(webSocket: WebSocket, response: Response) {
            android.util.Log.i(TAG, "Realtime socket open")
            reconnectAttempts = 0
            // Phoenix handshake
            send("phoenix", "phoenix", JSONObject().apply { put("vsn", "1.0.0") })
            // The user may have disconnected between connectSocket() and onOpen; if so, close
            // the socket immediately to avoid a zombie socket that isConnected() reports as
            // alive but never delivers any events (the fallback loop relies on isConnected()).
            if (activeUserId == null) {
                closeSocket()
                return
            }
            joinChannel()
            startHeartbeat()
        }

        override fun onMessage(webSocket: WebSocket, text: String) {
            try {
                val message = JSONObject(text)
                val topic = message.optString("topic", "")
                val event = message.optString("event", "")

                // Phoenix-level events
                if (topic == "phoenix" && event == "heartbeat") {
                    send("phoenix", "heartbeat", JSONObject())
                    return
                }
                if (event == "phoenix.reply") {
                    val status = message.optJSONObject("payload")
                        ?.optString("status")
                    android.util.Log.d(TAG, "Realtime join $topic → $status")
                    return
                }

                // Application event: a row changed in one of our tables
                if (event == "postgres_changes") {
                    val data = message.optJSONObject("payload")
                        ?.optJSONObject("data") ?: return
                    val table = data.optString("table", "")
                    if (table !in managedTables) return
                    val eventType = data.optString("eventType", "") // INSERT, UPDATE, DELETE
                    val new = data.optJSONObject("new")
                    val old = data.optJSONObject("old")
                    val row = new ?: old ?: return
                    onTableChange(table, eventType, row)
                }
            } catch (e: Exception) {
                android.util.Log.e(TAG, "onMessage error", e)
            }
        }

        override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
            android.util.Log.i(TAG, "Realtime closed: $code $reason")
            handleDisconnect()
        }

        override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
            android.util.Log.e(TAG, "Realtime failure", t)
            handleDisconnect()
        }
    }

    @Synchronized
    private fun handleDisconnect() {
        webSocket = null
        heartbeatJob?.cancel()
        heartbeatJob = null
        if (activeUserId != null) {
            val backoffMs = minOf(30_000L, 2_000L * (1 shl reconnectAttempts.coerceAtMost(4)))
            reconnectAttempts++
            scope.launch {
                delay(backoffMs)
                synchronized(this@RealtimeSyncManager) {
                    if (activeUserId != null && webSocket == null) {
                        connectSocket()
                    }
                }
            }
        }
    }

    private fun startHeartbeat() {
        heartbeatJob?.cancel()
        heartbeatJob = scope.launch {
            while (isActive) {
                delay(HEARTBEAT_INTERVAL_MS)
                if (webSocket != null) {
                    send("phoenix", "heartbeat", JSONObject())
                }
            }
        }
    }
}