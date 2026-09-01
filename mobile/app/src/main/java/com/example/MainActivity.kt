package com.example

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import com.example.data.remote.GoogleSignInHelper
import com.example.ui.StuddyHubApp
import com.example.ui.theme.StuddyHubTheme

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        enableEdgeToEdge()

        // Handle OAuth callback if the app was launched from a deep link
        handleOAuthIntent(intent)

        setContent {
            StuddyHubTheme {
                StuddyHubApp()
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleOAuthIntent(intent)
    }

    private fun handleOAuthIntent(intent: Intent?) {
        val data = intent?.data ?: return
        if (data.scheme == "studdyhub" && data.host == "auth-callback") {
            val tokens = GoogleSignInHelper.handleOAuthCallback(data)
            if (tokens != null) {
                pendingGoogleTokens = tokens
            }
        }
    }

    companion object {
        @Volatile
        var pendingGoogleTokens: Pair<String, String>? = null
            private set

        fun consumePendingGoogleTokens(): Pair<String, String>? {
            val tokens = pendingGoogleTokens
            pendingGoogleTokens = null
            return tokens
        }
    }
}
