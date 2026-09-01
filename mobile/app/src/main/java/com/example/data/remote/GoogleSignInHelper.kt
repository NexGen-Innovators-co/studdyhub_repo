package com.example.data.remote

import android.content.Context
import android.net.Uri
import android.util.Log
import androidx.browser.customtabs.CustomTabsIntent
import java.net.URLEncoder

/**
 * Google Sign-In via Supabase OAuth using Chrome Custom Tabs.
 *
 * Chrome Custom Tabs render a Chrome tab INSIDE the app (not the external browser).
 * The user signs in, Supabase redirects to studdyhub://auth-callback, and Android
 * catches it via the intent filter — the app comes back to the foreground automatically.
 *
 * For the fully native "Sign in with Google" bottom-sheet dialog (like modern apps),
 * see the Credential Manager approach in GoogleSignInNative.kt.
 */
object GoogleSignInHelper {

    private const val TAG = "GoogleSignIn"
    private const val REDIRECT_URI = "studdyhub://auth-callback"

    /**
     * Build the Google OAuth URL for Supabase.
     * Uses implicit flow (tokens in fragment) — simplest for mobile apps with custom URL schemes.
     */
    fun buildOAuthUrl(supabaseUrl: String): String {
        val encodedRedirect = URLEncoder.encode(REDIRECT_URI, "UTF-8")
        return "$supabaseUrl/auth/v1/authorize" +
            "?provider=google" +
            "&redirect_to=$encodedRedirect"
    }

    /**
     * Launch Google Sign-In in a Chrome Custom Tab (renders inside the app).
     * After auth, Supabase redirects to studdyhub://auth-callback which Android
     * catches via the intent filter in MainActivity.
     */
    fun launchSignIn(context: Context, supabaseUrl: String) {
        val url = buildOAuthUrl(supabaseUrl)
        Log.d(TAG, "Launching Google OAuth in Custom Tab: $url")

        try {
            val customTabsIntent = CustomTabsIntent.Builder()
                .setShowTitle(false)
                .setUrlBarHidingEnabled(true)
                .build()

            // Package name "com.android.chrome" ensures Chrome Custom Tab is used
            // (not the default browser). If Chrome isn't available, falls back gracefully.
            customTabsIntent.intent.setPackage("com.android.chrome")
            customTabsIntent.intent.addFlags(android.content.Intent.FLAG_ACTIVITY_NO_HISTORY)
            customTabsIntent.launchUrl(context, Uri.parse(url))
        } catch (e: Exception) {
            Log.w(TAG, "Chrome Custom Tab failed, falling back to browser: ${e.message}")
            // Fallback to default browser if Chrome isn't installed
            try {
                val intent = android.content.Intent(android.content.Intent.ACTION_VIEW, Uri.parse(url))
                context.startActivity(intent)
            } catch (e2: Exception) {
                Log.e(TAG, "Failed to launch Google Sign-In: ${e2.message}", e2)
            }
        }
    }

    /**
     * Handle the OAuth callback URI.
     * Supabase redirects to: studdyhub://auth-callback#access_token=...&refresh_token=...
     *
     * @return Pair of (accessToken, refreshToken) or null if parsing failed
     */
    fun handleOAuthCallback(data: Uri?): Pair<String, String>? {
        if (data == null) {
            Log.e(TAG, "OAuth callback received with null data")
            return null
        }

        Log.d(TAG, "OAuth callback URI: $data")

        // ── Case 1: Implicit flow — tokens in the fragment (#) ──
        val fragment = data.fragment
        if (!fragment.isNullOrBlank()) {
            val params = parseQueryString(fragment)
            val accessToken = params["access_token"]
            val refreshToken = params["refresh_token"]

            if (!accessToken.isNullOrBlank() && !refreshToken.isNullOrBlank()) {
                Log.d(TAG, "OAuth tokens received via fragment (implicit flow)")
                return Pair(accessToken, refreshToken)
            }
        }

        // ── Case 2: Error in callback ──
        val error = data.getQueryParameter("error")
        if (!error.isNullOrBlank()) {
            Log.e(TAG, "OAuth error: $error — ${data.getQueryParameter("error_description")}")
        }

        Log.e(TAG, "Could not extract tokens from callback URI")
        return null
    }

    private fun parseQueryString(input: String): Map<String, String> {
        return input.split("&")
            .map { it.split("=", limit = 2) }
            .filter { it.size == 2 }
            .associate { it[0] to Uri.decode(it[1]) }
    }
}
