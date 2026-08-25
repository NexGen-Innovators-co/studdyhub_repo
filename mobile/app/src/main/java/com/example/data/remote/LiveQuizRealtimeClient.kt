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
import org.json.JSONObject
import java.util.Collections
import java.util.concurrent.TimeUnit

/**
 * Minimal Supabase Realtime client (Phoenix websocket protocol) built on the existing
 * OkHttp dependency — the mobile app has no @supabase/supabase-js, so we speak just
 * enough of the protocol to subscribe to `postgres_changes` on the live-quiz tables,
 * the same channel the web client uses.
 *
 * Kahoot-style fairness: players learn about question changes the instant the server
 * writes them (no more 2s poll-latency spread where some players see a question early
 * and others late), and the countdown is driven by the server-authoritative end_time
 * delivered in the session state.
 */
class LiveQuizRealtimeClient(
    private val onPostgresChange: (topic: String, eventType: String, data: JSONObject) -> Unit
) {
    companion object {
        private const val TAG = "LiveQuizRealtime"
        private const val HEARTBEAT_INTERVAL_MS = 25_000L
        private const val CHANNEL_TOPIC = "realtime:live_quiz_sessions"
    }

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val socket: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(0, TimeUnit.MILLISECONDS) // websockets stay open
        .pingInterval(20, TimeUnit.SECONDS)
        .build()

    @Volatile
    private var webSocket: WebSocket? = null
    @Volatile
    private var refCounter = 0
    @Volatile
    private var reconnectAttempts = 0
    private val sessionIds = Collections.synchronizedSet(mutableSetOf<String>())
    private var heartbeatJob: Job? = null

    private fun nextRef(): Int = ++refCounter

    private fun buildUrl(): String {
        val base = BackendApiService.getSupabaseUrl()
        val anon = BackendApiService.getSupabaseAnonKey()
        if (base.isBlank() || anon.isBlank()) return ""
        val host = base.replace("https://", "wss://").replace("http://", "ws://")
        return "$host/realtime/v1/websocket?apikey=$anon&vsn=1.0.0"
    }

    /** Start tracking a session and (re)connect if needed. Safe to call repeatedly. */
    @Synchronized
    fun subscribe(sessionId: String) {
        if (sessionId.isBlank()) return
        sessionIds.add(sessionId)
        if (webSocket == null) {
            connect()
        } else {
            joinChannel(sessionId)
        }
    }

    /** Stop tracking a session; closes the socket once no sessions remain. */
    @Synchronized
    fun unsubscribe(sessionId: String) {
        sessionIds.remove(sessionId)
        if (sessionIds.isEmpty()) {
            closeSocket()
        }
    }

    /** Stop tracking everything and close the socket (kept on session exit). */
    @Synchronized
    fun close() {
        sessionIds.clear()
        closeSocket()
    }

    /** Full teardown — call from ViewModel.onCleared(). */
    fun shutdown() {
        close()
        scope.cancel()
    }

    private fun closeSocket() {
        heartbeatJob?.cancel()
        heartbeatJob = null
        val ws = webSocket
        webSocket = null
        ws?.close(1000, "client shutdown")
    }

    @Synchronized
    private fun connect() {
        if (webSocket != null) return
        val url = buildUrl()
        if (url.isBlank()) return
        try {
            webSocket = socket.newWebSocket(Request.Builder().url(url).build(), listener)
        } catch (e: Exception) {
            android.util.Log.e(TAG, "connect failed", e)
        }
    }

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

    private fun joinChannel(sessionId: String) {
        val payload = JSONObject().apply {
            put("config", JSONObject().apply {
                put("postgres_changes", org.json.JSONArray().apply {
                    put(postgresChange("live_quiz_sessions", "id=eq.$sessionId"))
                    put(postgresChange("live_quiz_questions", "session_id=eq.$sessionId"))
                    put(postgresChange("live_quiz_players", "session_id=eq.$sessionId"))
                    put(postgresChange("live_quiz_answers", "session_id=eq.$sessionId"))
                })
            })
            put("access_token", BackendApiService.userAccessToken ?: BackendApiService.getSupabaseAnonKey())
        }
        send(CHANNEL_TOPIC, "phoenix.join", payload, nextRef())
    }

    private fun postgresChange(table: String, filter: String): JSONObject = JSONObject().apply {
        put("event", "*")
        put("schema", "public")
        put("table", table)
        put("filter", filter)
    }

    private val listener = object : WebSocketListener() {
        override fun onOpen(webSocket: WebSocket, response: Response) {
            android.util.Log.i(TAG, "Realtime socket open")
            reconnectAttempts = 0
            // Phoenix handshake
            send("phoenix", "phoenix", JSONObject().apply { put("vsn", "1.0.0") })
            // Join every tracked session (re-join after reconnect)
            sessionIds.toList().forEach { joinChannel(it) }
            startHeartbeat()
        }

        override fun onMessage(webSocket: WebSocket, text: String) {
            try {
                val message = JSONObject(text)
                val topic = message.optString("topic", "")
                val event = message.optString("event", "")

                if (topic == "phoenix" && event == "heartbeat") {
                    // Server ping → respond to keep the socket alive
                    send("phoenix", "heartbeat", JSONObject())
                    return
                }
                if (event == "phoenix.reply") {
                    val status = message.optJSONObject("payload")?.optString("status")
                    if (status == "ok") {
                        android.util.Log.i(TAG, "Joined realtime channel: $topic")
                    } else {
                        android.util.Log.w(TAG, "Realtime join refused: $topic ($status)")
                    }
                    return
                }
                if (event == "postgres_changes") {
                    val data = message.optJSONObject("payload")?.optJSONObject("data")
                    if (data != null) {
                        val eventType = data.optString("eventType", "")
                        android.util.Log.d(
                            TAG,
                            "postgres_changes: table=${data.optString("table", "")} event=$eventType"
                        )
                        onPostgresChange(topic, eventType, data)
                    }
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
        if (sessionIds.isNotEmpty()) {
            // Reconnect with exponential backoff (2s → 30s cap) so transient drops don't kill
            // a live quiz, but an offline device doesn't spin a new socket every 2s forever.
            val backoffMs = minOf(30_000L, 2_000L * (1 shl reconnectAttempts.coerceAtMost(4)))
            reconnectAttempts++
            scope.launch {
                delay(backoffMs)
                synchronized(this@LiveQuizRealtimeClient) {
                    if (sessionIds.isNotEmpty() && webSocket == null) {
                        connect()
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
