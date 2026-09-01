package com.example.data.remote

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.util.Log
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInClient
import com.google.android.gms.auth.api.signin.GoogleSignInOptions
import com.google.android.gms.common.api.ApiException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import kotlin.coroutines.resume

/**
 * Native Google Sign-In using the legacy GoogleSignInClient API.
 *
 * This shows a SYSTEM-LEVEL Google account picker dialog inside the app
 * on ALL devices with Google Play Services. No browser opens.
 *
 * After the user picks their Google account, we get an ID token and exchange
 * it with Supabase for access/refresh tokens.
 *
 * Requirements:
 * - Google OAuth Client ID (Web application type) configured in Google Cloud Console
 * - Supabase Google provider enabled with the same Client ID
 * - google-services.json in mobile/app/
 */
object GoogleSignInNative {

    private const val TAG = "GoogleSignInNative"

    // Your Google OAuth Client ID (Web application type, NOT Android type)
    // It MUST be the same Client ID configured in Supabase Dashboard → Auth → Providers → Google
    private const val WEB_CLIENT_ID = "948761763712-ludk5jirfica4a8ok0qan0j93ha68ukl.apps.googleusercontent.com"

    /** Request code for the Google Sign-In activity result. */
    const val RC_GOOGLE_SIGN_IN = 9001

    /**
     * Build the GoogleSignInClient for use with startActivityForResult.
     * Returns the client so the caller can launch the sign-in intent.
     */
    fun getGoogleSignInClient(context: Context): GoogleSignInClient {
        val gso = GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
            .requestIdToken(WEB_CLIENT_ID)
            .requestEmail()
            .build()
        return GoogleSignIn.getClient(context, gso)
    }

    /**
     * Get the sign-in Intent for launching via rememberLauncherForActivityResult.
     * Signs out first to force account picker, then returns the intent.
     */
    suspend fun getSignInIntent(activity: Activity): Intent? = withContext(Dispatchers.Main) {
        try {
            val googleSignInClient = getGoogleSignInClient(activity)
            // Sign out first to force the account picker to always appear
            suspendCancellableCoroutine { cont ->
                googleSignInClient.signOut().addOnCompleteListener {
                    if (cont.isActive) cont.resume(googleSignInClient.signInIntent)
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to get sign-in intent: ${e.message}", e)
            null
        }
    }

    /**
     * Handle the activity result from the Google account picker.
     * Call this from the Activity's onActivityResult.
     *
     * @param data The intent data from onActivityResult
     * @param supabaseUrl Supabase project URL
     * @param onSuccess Called with (accessToken, refreshToken) on success
     * @param onError Called with error message on failure
     */
    suspend fun handleSignInResult(
        data: Intent?,
        supabaseUrl: String,
        onSuccess: (String, String) -> Unit,
        onError: (String) -> Unit
    ) {
        Log.d(TAG, "handleSignInResult called, data=${data != null}")
        try {
            val task = GoogleSignIn.getSignedInAccountFromIntent(data)
            val account = task.getResult(ApiException::class.java)
            val idToken = account?.idToken
            Log.d(TAG, "account=${account?.email}, hasIdToken=${idToken != null}")

            if (idToken.isNullOrBlank()) {
                Log.e(TAG, "ID token is null or blank")
                withContext(Dispatchers.Main) { onError("No ID token received from Google") }
                return
            }

            Log.d(TAG, "Google ID token received, exchanging with Supabase at $supabaseUrl")
            exchangeTokenWithSupabase(supabaseUrl, idToken, onSuccess, onError)
        } catch (e: ApiException) {
            Log.e(TAG, "Google Sign-In failed with status code: ${e.statusCode}", e)
            withContext(Dispatchers.Main) {
                when (e.statusCode) {
                    12501 -> {
                        Log.d(TAG, "User cancelled sign-in")
                        onError("Sign-in cancelled")
                    }
                    12500 -> onError("Google Sign-In timed out. Please try again.")
                    12502 -> onError("Sign-in in progress. Please wait.")
                    else -> onError("Google Sign-In failed (code: ${e.statusCode})")
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Google Sign-In error: ${e.message}", e)
            withContext(Dispatchers.Main) { onError("Google Sign-In failed: ${e.message}") }
        }
    }

    /**
     * Exchange a Google ID token with Supabase for access/refresh tokens.
     */
    private suspend fun exchangeTokenWithSupabase(
        supabaseUrl: String,
        idToken: String,
        onSuccess: (String, String) -> Unit,
        onError: (String) -> Unit
    ) = withContext(Dispatchers.IO) {
        try {
            val url = URL("$supabaseUrl/auth/v1/token?grant_type=id_token")
            Log.d(TAG, "POSTing to $url")
            val conn = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                setRequestProperty("Content-Type", "application/json")
                setRequestProperty("apikey", BackendApiService.getSupabaseAnonKey())
                connectTimeout = 15_000
                readTimeout = 15_000
                doOutput = true
            }

            val body = JSONObject().apply {
                put("id_token", idToken)
                put("provider", "google")
                put("client_id", WEB_CLIENT_ID)
            }.toString()
            Log.d(TAG, "Request body: id_token=***, provider=google, client_id=$WEB_CLIENT_ID")

            conn.outputStream.buffered().use { it.write(body.toByteArray()) }

            val responseCode = conn.responseCode
            Log.d(TAG, "Supabase response code: $responseCode")

            if (responseCode == 200) {
                val responseBody = conn.inputStream.bufferedReader().use { it.readText() }
                Log.d(TAG, "Response body: $responseBody")
                val json = JSONObject(responseBody)
                val accessToken = json.optString("access_token")
                val refreshToken = json.optString("refresh_token")

                if (!accessToken.isNullOrBlank() && !refreshToken.isNullOrBlank()) {
                    Log.d(TAG, "Supabase token exchange successful, tokens received")
                    withContext(Dispatchers.Main) { onSuccess(accessToken, refreshToken) }
                } else {
                    Log.e(TAG, "Token exchange returned empty tokens")
                    withContext(Dispatchers.Main) { onError("Token exchange returned empty tokens") }
                }
            } else {
                val error = conn.errorStream?.bufferedReader()?.use { it.readText() } ?: "No error body"
                Log.e(TAG, "Supabase token exchange failed: $responseCode — $error")
                withContext(Dispatchers.Main) { onError("Authentication failed ($responseCode): $error") }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Token exchange error: ${e.message}", e)
            withContext(Dispatchers.Main) { onError("Network error during authentication: ${e.message}") }
        }
    }
}
