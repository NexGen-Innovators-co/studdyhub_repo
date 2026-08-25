package com.example.ui.components

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext

/**
 * Tracks real network connectivity through ConnectivityManager (not just whether the app's
 * API keys are configured). Recomputes on the current default network becoming available or
 * being lost, so "Connected" actually means connected.
 */
@Composable
fun rememberIsOnline(): Boolean {
    val context = LocalContext.current
    var isOnline by remember { mutableStateOf(isNetworkAvailable(context)) }

    DisposableEffect(Unit) {
        val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
        val callback = if (cm != null) {
            object : ConnectivityManager.NetworkCallback() {
                override fun onAvailable(network: Network) { isOnline = true }
                override fun onLost(network: Network) { isOnline = false }
                override fun onUnavailable() { isOnline = false }
            }
        } else {
            null
        }

        callback?.let { cb ->
            runCatching { cm?.registerDefaultNetworkCallback(cb) }
        }

        onDispose {
            callback?.let { cb -> runCatching { cm?.unregisterNetworkCallback(cb) } }
        }
    }

    return isOnline
}

private fun isNetworkAvailable(context: Context): Boolean {
    val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager ?: return true
    val activeNetwork = cm.activeNetwork ?: return false
    val capabilities = cm.getNetworkCapabilities(activeNetwork) ?: return false
    return capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
        capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
}
