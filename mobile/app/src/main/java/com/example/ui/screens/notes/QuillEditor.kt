package com.example.ui.screens.notes

import android.annotation.SuppressLint
import android.util.Log
import android.webkit.ConsoleMessage
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.compose.foundation.background
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import com.example.ui.theme.tierPrimary
import com.example.util.MarkdownConverter
import kotlinx.coroutines.delay

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

@SuppressLint("SetJavaScriptEnabled")
@Composable
fun QuillEditor(
    initialMarkdown: String,
    onMarkdownChanged: (String) -> Unit,
    modifier: Modifier = Modifier,
    onWebViewCreated: ((WebView) -> Unit)? = null
) {
    val coroutineScope = rememberCoroutineScope()

    // Keep track of the current markdown in the editor
    var currentEditorMarkdown by remember { mutableStateOf(initialMarkdown) }
    var lastJsMarkdown by remember { mutableStateOf<String?>(null) }

    // Keep current initialMarkdown in sync
    LaunchedEffect(initialMarkdown) {
        if (initialMarkdown != currentEditorMarkdown && initialMarkdown != lastJsMarkdown) {
            currentEditorMarkdown = initialMarkdown
        }
    }

    // JS Bridge & Loading State
    var isJsReady by remember { mutableStateOf(false) }
    var isLoading by remember { mutableStateOf(true) }
    var isError by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf("") }

    // Keep track of WebView instance to call evaluateJavascript
    var webViewRef by remember { mutableStateOf<WebView?>(null) }

    // Dynamic Theme parameters
    val isDark = isSystemInDarkTheme()
    val textColor = MaterialTheme.colorScheme.onBackground
    val textColorHex = remember(textColor) {
        val r = (textColor.red * 255f).toInt().coerceIn(0, 255)
        val g = (textColor.green * 255f).toInt().coerceIn(0, 255)
        val b = (textColor.blue * 255f).toInt().coerceIn(0, 255)
        String.format("#%02X%02X%02X", r, g, b)
    }

    // Helper function to escape JavaScript strings safely
    fun escapeJavaScriptString(str: String): String {
        return str
            .replace("\\", "\\\\")
            .replace("'", "\\'")
            .replace("\"", "\\\"")
            .replace("\n", "\\n")
            .replace("\r", "\\r")
    }

    // Timeout guard: If editor takes > 5 seconds to load, set error state and log
    LaunchedEffect(Unit) {
        delay(5000)
        if (!isJsReady && isLoading) {
            isLoading = false
            isError = true
            errorMessage = "Canvas initialization timed out after 5s."
            Log.e("QuillEditor", "Timeout: Editor WebView did not respond within 5000ms")
        }
    }

    // Sync initial content & theme as soon as JS bridge is ready
    LaunchedEffect(isJsReady) {
        if (isJsReady) {
            val html = if (currentEditorMarkdown.trimStart().startsWith("<")) currentEditorMarkdown else MarkdownConverter.markdownToHtml(currentEditorMarkdown)
            val escapedHtml = escapeJavaScriptString(html)
            webViewRef?.evaluateJavascript("javascript:setHtmlContent('$escapedHtml', true);", null)
            webViewRef?.evaluateJavascript("javascript:setTheme($isDark, '$textColorHex');", null)
            lastJsMarkdown = currentEditorMarkdown
            Log.d("QuillEditor", "Pushed initial content & theme to JS editor")
        }
    }

    // Trigger updates to the WebView whenever external markdown changes (e.g., Undo/Redo, AI Copilot, or Templates)
    LaunchedEffect(initialMarkdown) {
        if (isJsReady) {
            if (initialMarkdown != lastJsMarkdown) {
                lastJsMarkdown = initialMarkdown
                currentEditorMarkdown = initialMarkdown
                val html = if (initialMarkdown.trimStart().startsWith("<")) initialMarkdown else MarkdownConverter.markdownToHtml(initialMarkdown)
                val escapedHtml = escapeJavaScriptString(html)
                webViewRef?.evaluateJavascript("javascript:setHtmlContent('$escapedHtml', true);", null)
            }
        }
    }

    // Dynamic theme changes
    LaunchedEffect(isDark, textColorHex, isJsReady) {
        if (isJsReady) {
            webViewRef?.evaluateJavascript("javascript:setTheme($isDark, '$textColorHex');", null)
        }
    }

    Box(modifier = modifier.fillMaxSize()) {
        AndroidView(
            factory = { ctx ->
                WebView(ctx).apply {
                    layoutParams = android.view.ViewGroup.LayoutParams(
                        android.view.ViewGroup.LayoutParams.MATCH_PARENT,
                        android.view.ViewGroup.LayoutParams.MATCH_PARENT
                    )
                    webViewRef = this
                    onWebViewCreated?.invoke(this)
                    setBackgroundColor(android.graphics.Color.TRANSPARENT)
                    isFocusable = true
                    isFocusableInTouchMode = true
                    isClickable = true

                    setOnTouchListener { v, event ->
                        when (event.action) {
                            android.view.MotionEvent.ACTION_DOWN -> {
                                v.requestFocus()
                                v.parent?.requestDisallowInterceptTouchEvent(true)
                            }
                            android.view.MotionEvent.ACTION_MOVE -> {
                                v.parent?.requestDisallowInterceptTouchEvent(true)
                            }
                            android.view.MotionEvent.ACTION_UP, android.view.MotionEvent.ACTION_CANCEL -> {
                                v.parent?.requestDisallowInterceptTouchEvent(false)
                            }
                        }
                        false
                    }

                    settings.apply {
                        javaScriptEnabled = true
                        domStorageEnabled = true
                        allowFileAccess = true
                        allowContentAccess = true
                        allowFileAccessFromFileURLs = true
                        allowUniversalAccessFromFileURLs = true
                        mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
                        databaseEnabled = true
                    }

                    webChromeClient = object : WebChromeClient() {
                        override fun onConsoleMessage(consoleMessage: ConsoleMessage?): Boolean {
                            consoleMessage?.let {
                                Log.d("QuillEditorJS", "${it.message()} -- From line ${it.lineNumber()} of ${it.sourceId()}")
                            }
                            return true
                        }
                    }

                    webViewClient = object : WebViewClient() {
                        override fun onPageFinished(view: WebView?, url: String?) {
                            super.onPageFinished(view, url)
                            Log.d("QuillEditor", "WebView page loaded: $url")
                            postDelayed({
                                if (!isJsReady) {
                                    Log.d("QuillEditor", "Fallback triggering isJsReady")
                                    isJsReady = true
                                    isLoading = false
                                }
                            }, 150)
                        }

                        override fun onReceivedError(
                            view: WebView?,
                            request: WebResourceRequest?,
                            error: WebResourceError?
                        ) {
                            super.onReceivedError(view, request, error)
                            val description = error?.description?.toString() ?: "Unknown WebView Error"
                            Log.e("QuillEditor", "WebView Error: $description (Code: ${error?.errorCode})")
                            isLoading = false
                            isError = true
                            errorMessage = "Error loading canvas: $description"
                        }
                    }

                    addJavascriptInterface(object {
                        @JavascriptInterface
                        fun onContentChanged(html: String) {
                            coroutineScope.launch(Dispatchers.Default) {
                                val markdown = MarkdownConverter.htmlToMarkdown(html)
                                withContext(Dispatchers.Main) {
                                    if (markdown != currentEditorMarkdown) {
                                        lastJsMarkdown = markdown
                                        currentEditorMarkdown = markdown
                                        onMarkdownChanged(markdown)
                                    }
                                }
                            }
                        }

                        @JavascriptInterface
                        fun convertMarkdownToHtml(markdown: String): String {
                            return MarkdownConverter.markdownToHtml(markdown)
                        }

                        @JavascriptInterface
                        fun onEditorReady() {
                            post {
                                Log.d("QuillEditor", "JS Bridge reported Editor is ready!")
                                isJsReady = true
                                isLoading = false
                            }
                        }
                    }, "AndroidBridge")

                    loadUrl("file:///android_asset/quill_editor.html")
                }
            },
            update = { /* Updates handled via LaunchedEffect */ },
            modifier = Modifier.fillMaxSize()
        )

        // Loading Overlay Spinner
        if (isLoading) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(MaterialTheme.colorScheme.surface),
                contentAlignment = Alignment.Center
            ) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    CircularProgressIndicator(
                        color = tierPrimary(),
                        strokeWidth = 3.dp,
                        modifier = Modifier.size(36.dp)
                    )
                    Text(
                        text = "Initializing Document Canvas...",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        fontSize = 13.sp
                    )
                }
            }
        }

        // Error Fallback UI
        if (isError) {
            Card(
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer),
                modifier = Modifier
                    .fillMaxWidth()
                    .align(Alignment.TopCenter)
                    .padding(12.dp)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        text = "Canvas Loading Issue",
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onErrorContainer
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = errorMessage.ifBlank { "Failed to load document canvas." },
                        fontSize = 12.sp,
                        color = MaterialTheme.colorScheme.onErrorContainer
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    Button(
                        onClick = {
                            isLoading = true
                            isError = false
                            isJsReady = false
                            webViewRef?.reload()
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = tierPrimary())
                    ) {
                        Text("Retry Canvas Loading", fontSize = 12.sp)
                    }
                }
            }
        }
    }
}
