package com.example.ui.screens.aichat.components

import android.content.Intent
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.view.View
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.webkit.WebResourceRequest
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.ClickableText
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ChevronLeft
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.Hub
import androidx.compose.material.icons.filled.Build
import androidx.compose.material.icons.filled.Slideshow
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material.icons.filled.Code
import androidx.compose.material.icons.filled.Functions
import androidx.compose.material.icons.filled.FormatQuote
import androidx.compose.material.icons.filled.ArrowDownward
import androidx.compose.material.icons.filled.OpenInNew
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.text.TextLayoutResult
import coil.compose.SubcomposeAsyncImage
import com.example.util.MarkdownConverter
import com.example.ui.theme.tierPrimary
import com.example.ui.theme.tierTertiary
import com.example.ui.theme.tierAccent
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject

/**
 * Renders an AI chat message the same way the web app does: markdown + LaTeX + tables +
 * links, real Mermaid/Chart.js/DOT/Three.js/HTML renderings (WebView shells that load the
 * exact CDN libraries the web's iframe renderers use), presentation slides, and images.
 *
 * @param streaming when true (live SSE stream in flight) rich blocks show a lightweight
 *   placeholder instead of a WebView — WebViews are expensive to (re)create and the block
 *   content is still incomplete; the final persisted message renders the real thing.
 */
@Composable
fun ChatMarkdownRenderer(
    text: String,
    modifier: Modifier = Modifier,
    streaming: Boolean = false,
    onFixDiagram: ((code: String, language: String, error: String?) -> Unit)? = null,
    onTaskCheckedChange: ((taskIndex: Int, isChecked: Boolean) -> Unit)? = null
) {
    val blocks = remember(text) { parseChatMarkdownBlocks(text) }
    val hasInlineMath = remember(text) { containsInlineMath(text) }
    // Real LaTeX (KaTeX) rendering: when the message contains inline $...$ math,
    // the whole message renders through ONE KaTeX-powered WebView (the same CDN
    // stack the notes editor & diagram shells use) so formulas appear as actual
    // math, never raw source. Messages carrying other rich artifacts
    // (mermaid/charts/3D/html/slides) keep the native renderer — block $$...$$
    // and ```latex formulas are covered by the LaTeX cards there.
    val renderAsMathMessage = !streaming && hasInlineMath && !containsRichArtifactBlock(text)
    if (renderAsMathMessage) {
        MathMessageBlock(text, modifier)
        return
    }
    Column(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        var taskCounter = 0
        blocks.forEach { block ->
            when (block) {
                is ChatBlock.Header -> HeaderBlock(block)
                is ChatBlock.ListBlock -> ListBlock(block)
                is ChatBlock.TaskItem -> {
                    val currentIdx = taskCounter
                    taskCounter++
                    TaskItemBlock(
                        item = block,
                        onCheckedChange = { checked ->
                            onTaskCheckedChange?.invoke(currentIdx, checked)
                        }
                    )
                }
                is ChatBlock.Blockquote -> BlockquoteBlock(block)
                is ChatBlock.CodeBlock -> ChatCodeBlockElement(block)
                is ChatBlock.MermaidDiagram ->
                    if (streaming) DiagramStreamingPlaceholder("Diagram")
                    else ChatMermaidBlock(block, onFixDiagram)
                is ChatBlock.DiagramBlock ->
                    if (streaming) DiagramStreamingPlaceholder(block.language.uppercase())
                    else ChatDiagramWebViewBlock(block, onFixDiagram)
                is ChatBlock.HtmlBlock ->
                    if (streaming) DiagramStreamingPlaceholder("HTML")
                    else ChatHtmlBlock(block, onFixDiagram)
                is ChatBlock.SlidesBlock ->
                    if (streaming) DiagramStreamingPlaceholder("Slides")
                    else ChatSlideDeckBlock(block)
                is ChatBlock.TableBlock -> MarkdownTableBlock(block)
                is ChatBlock.ImageBlock -> MarkdownImageBlock(block)
                is ChatBlock.LaTeXBlock ->
                    if (streaming) DiagramStreamingPlaceholder("Math") else LaTeXMathBlock(block)
                is ChatBlock.Paragraph -> ChatParagraphBlock(block, streaming)
            }
        }
    }
}

// Blocks Definitions
sealed class ChatBlock {
    data class Header(val level: Int, val text: String) : ChatBlock()
    data class ListBlock(val ordered: Boolean, val items: List<String>) : ChatBlock()
    data class TaskItem(val checked: Boolean, val text: String) : ChatBlock()
    data class Blockquote(val text: String) : ChatBlock()
    data class CodeBlock(val language: String, val code: String) : ChatBlock()
    data class MermaidDiagram(val code: String, val type: String) : ChatBlock()
    data class DiagramBlock(val language: String, val code: String) : ChatBlock()
    data class HtmlBlock(val html: String) : ChatBlock()
    data class SlidesBlock(val json: String) : ChatBlock()
    data class TableBlock(val rows: List<List<String>>) : ChatBlock()
    data class ImageBlock(val alt: String, val url: String) : ChatBlock()
    data class LaTeXBlock(val math: String) : ChatBlock()
    data class Paragraph(val text: String) : ChatBlock()
}

// IMAGE REGEX
val IMAGE_REGEX = Regex("!\\[(.*?)\\]\\((.*?)\\)")

// ─────────────────────────────────────────────────────────────────────────────
// Paragraph with clickable links
// ─────────────────────────────────────────────────────────────────────────────

@Composable
private fun ChatParagraphBlock(para: ChatBlock.Paragraph, streaming: Boolean = false) {
    // While streaming, the text is still growing and gets re-parsed on every flushed
    // chunk — skip the inline-annotation regex pass + ClickableText and render plain
    // text. The persisted message re-renders the rich version once the stream ends.
    if (streaming) {
        Text(
            text = para.text,
            style = MaterialTheme.typography.bodyMedium.copy(
                lineHeight = 22.sp,
                color = MaterialTheme.colorScheme.onSurface
            ),
            modifier = Modifier.fillMaxWidth()
        )
        return
    }
    val context = LocalContext.current
    val linkHandler = { url: String ->
        try {
            context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
        } catch (_: Exception) {
            // ignore malformed URLs
        }
    }
    // Render ![alt](url) images embedded inside a paragraph inline (like the web),
    // keeping the surrounding text as normal inline-formatted segments.
    val segments = remember(para.text) { splitInlineSegments(para.text) }
    if (segments.size == 1 && segments[0].image == null) {
        val annotatedText = remember(para.text) { parseChatInlineFormatting(para.text) }
        var layoutResult by remember { mutableStateOf<TextLayoutResult?>(null) }
        Text(
            text = annotatedText,
            style = MaterialTheme.typography.bodyMedium.copy(
                lineHeight = 22.sp,
                color = MaterialTheme.colorScheme.onSurface
            ),
            modifier = Modifier
                .fillMaxWidth()
                .pointerInput(annotatedText) {
                    detectTapGestures { offset ->
                        val result = layoutResult ?: return@detectTapGestures
                        val charOffset = result.getOffsetForPosition(offset)
                        annotatedText.getStringAnnotations("URL", charOffset, charOffset)
                            .firstOrNull()?.let {
                                linkHandler(it.item)
                            }
                    }
                },
            onTextLayout = { layoutResult = it }
        )
    } else {
        Column(
            modifier = Modifier.fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            segments.forEach { seg ->
                val img = seg.image
                if (img != null) {
                    MarkdownImageBlock(ChatBlock.ImageBlock(alt = img.first, url = img.second))
                } else if (seg.text.isNotBlank()) {
                    val annotatedText = remember(seg.text) { parseChatInlineFormatting(seg.text) }
                    var segLayoutResult by remember { mutableStateOf<TextLayoutResult?>(null) }
                    Text(
                        text = annotatedText,
                        style = MaterialTheme.typography.bodyMedium.copy(
                            lineHeight = 22.sp,
                            color = MaterialTheme.colorScheme.onSurface
                        ),
                        modifier = Modifier
                            .fillMaxWidth()
                            .pointerInput(annotatedText) {
                                detectTapGestures { offset ->
                                    val result = segLayoutResult ?: return@detectTapGestures
                                    val charOffset = result.getOffsetForPosition(offset)
                                    annotatedText.getStringAnnotations("URL", charOffset, charOffset)
                                        .firstOrNull()?.let {
                                            linkHandler(it.item)
                                        }
                                }
                            },
                        onTextLayout = { segLayoutResult = it }
                    )
                }
            }
        }
    }
}

private data class InlineSegment(val text: String, val image: Pair<String, String>? = null)

/** Splits a paragraph into alternating text / inline-image segments. */
private fun splitInlineSegments(text: String): List<InlineSegment> {
    val segments = mutableListOf<InlineSegment>()
    var last = 0
    for (m in IMAGE_REGEX.findAll(text)) {
        if (m.range.first > last) {
            segments.add(InlineSegment(text = text.substring(last, m.range.first)))
        }
        segments.add(InlineSegment(text = "", image = m.groupValues[1] to m.groupValues[2]))
        last = m.range.last + 1
    }
    if (last < text.length) {
        segments.add(InlineSegment(text = text.substring(last)))
    }
    return segments.ifEmpty { listOf(InlineSegment(text = text)) }
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared diagram card chrome (icon + title + View Code toggle)
// ─────────────────────────────────────────────────────────────────────────────

@Composable
private fun ArtifactCanvasDialog(
    title: String,
    onClose: () -> Unit,
    content: @Composable () -> Unit
) {
    androidx.compose.ui.window.Dialog(
        onDismissRequest = onClose,
        properties = androidx.compose.ui.window.DialogProperties(
            usePlatformDefaultWidth = false,
            dismissOnBackPress = true,
            dismissOnClickOutside = false
        )
    ) {
        Surface(
            modifier = Modifier.fillMaxSize(),
            color = MaterialTheme.colorScheme.background
        ) {
            Column(modifier = Modifier.fillMaxSize()) {
                // Top header bar of the Artifact Canvas
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(MaterialTheme.colorScheme.surfaceVariant)
                        .padding(horizontal = 16.dp, vertical = 12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        imageVector = Icons.Default.Hub,
                        contentDescription = null,
                        tint = tierPrimary(),
                        modifier = Modifier.size(20.dp)
                    )
                    Spacer(modifier = Modifier.width(10.dp))
                    Text(
                        text = "$title (Artifact Canvas)",
                        style = MaterialTheme.typography.titleMedium.copy(
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        ),
                        modifier = Modifier.weight(1f)
                    )
                    IconButton(onClick = onClose) {
                        Icon(
                            imageVector = Icons.Default.Close,
                            contentDescription = "Close Canvas",
                            tint = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
                
                // Main Canvas Content Area
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f)
                        .background(Color.Black.copy(alpha = 0.03f))
                ) {
                    content()
                }
            }
        }
    }
}

data class HighlightSpan(val start: Int, val end: Int, val style: SpanStyle)

fun highlightCode(code: String, language: String): AnnotatedString {
    val lang = language.lowercase()
    val spans = mutableListOf<HighlightSpan>()

    // 1. Comments
    val commentRegex = when {
        lang == "python" || lang == "yaml" || lang == "bash" || lang == "dockerfile" || lang == "slides" -> Regex("#.*")
        lang == "html" || lang == "xml" -> Regex("<!--[\\s\\S]*?-->")
        else -> Regex("//.*|/\\*[\\s\\S]*?\\*/") // java, kotlin, js, json, css, etc.
    }
    commentRegex.findAll(code).forEach { match ->
        spans.add(HighlightSpan(match.range.first, match.range.last + 1, SpanStyle(color = Color(0xFF7F8C8D), fontStyle = FontStyle.Italic)))
    }

    // 2. Strings
    val stringRegex = Regex("\"\"\"[\\s\\S]*?\"\"\"|'[^']*'|\"[^\"]*\"")
    stringRegex.findAll(code).forEach { match ->
        val start = match.range.first
        val end = match.range.last + 1
        if (spans.none { it.start < end && start < it.end }) {
            spans.add(HighlightSpan(start, end, SpanStyle(color = Color(0xFF27AE60)))) // nice green
        }
    }

    // 3. Keywords
    val keywords = when (lang) {
        "python" -> listOf(
            "False", "None", "True", "and", "as", "assert", "async", "await", "break", "class",
            "continue", "def", "del", "elif", "else", "except", "finally", "for", "from", "global",
            "if", "import", "in", "is", "lambda", "nonlocal", "not", "or", "pass", "raise", "return",
            "try", "while", "with", "yield"
        )
        "json", "slides" -> listOf("true", "false", "null")
        "kotlin", "java" -> listOf(
            "package", "import", "class", "interface", "object", "fun", "val", "var", "if", "else",
            "for", "while", "return", "this", "super", "null", "true", "false", "private", "protected",
            "public", "internal", "companion", "override", "when", "is", "as", "try", "catch", "finally", "throw"
        )
        "js", "javascript", "typescript", "ts" -> listOf(
            "break", "case", "catch", "class", "const", "continue", "debugger", "default", "delete",
            "do", "else", "export", "extends", "finally", "for", "function", "if", "import", "in",
            "instanceof", "new", "return", "super", "switch", "this", "throw", "try", "typeof", "var",
            "void", "while", "with", "yield", "let", "package", "private", "protected", "public",
            "static", "null", "true", "false"
        )
        else -> listOf(
            "import", "export", "class", "function", "fun", "def", "return", "if", "else", "for", "while",
            "var", "let", "const", "val", "true", "false", "null"
        )
    }

    val wordRegex = Regex("\\b[a-zA-Z_][a-zA-Z0-9_]*\\b")
    wordRegex.findAll(code).forEach { match ->
        val word = match.value
        if (keywords.contains(word)) {
            val start = match.range.first
            val end = match.range.last + 1
            if (spans.none { it.start < end && start < it.end }) {
                spans.add(HighlightSpan(start, end, SpanStyle(color = Color(0xFF2980B9), fontWeight = FontWeight.Bold))) // vibrant blue
            }
        }
    }

    // 4. Numbers
    val numberRegex = Regex("\\b\\d+(\\.\\d+)?\\b")
    numberRegex.findAll(code).forEach { match ->
        val start = match.range.first
        val end = match.range.last + 1
        if (spans.none { it.start < end && start < it.end }) {
            spans.add(HighlightSpan(start, end, SpanStyle(color = Color(0xFFD35400)))) // deep orange
        }
    }

    // 5. Types / Decorators / Built-ins
    val annotationsAndTypesRegex = Regex("@[a-zA-Z0-9_]+|\\b(self|print|len|range|int|str|float|list|dict|set|tuple|Array|String|Int|Boolean|Float|Double|Long)\\b")
    annotationsAndTypesRegex.findAll(code).forEach { match ->
        val start = match.range.first
        val end = match.range.last + 1
        if (spans.none { it.start < end && start < it.end }) {
            spans.add(HighlightSpan(start, end, SpanStyle(color = Color(0xFF8E44AD), fontWeight = FontWeight.SemiBold))) // deep purple
        }
    }

    return buildAnnotatedString {
        append(code)
        spans.forEach { span ->
            addStyle(span.style, span.start, span.end)
        }
    }
}

@Composable
private fun DiagramCard(
    title: String,
    code: String,
    language: String,
    onFixDiagram: ((code: String, language: String, error: String?) -> Unit)? = null,
    errorMessage: String? = null,
    defaultHeight: androidx.compose.ui.unit.Dp = 320.dp,
    content: @Composable (modifier: Modifier) -> Unit
) {
    var showCode by remember { mutableStateOf(false) }
    var showArtifactDialog by remember { mutableStateOf(false) }

    Card(
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)),
        modifier = Modifier
            .fillMaxWidth()
            .border(1.dp, tierPrimary().copy(alpha = 0.25f), RoundedCornerShape(14.dp))
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.weight(1f)) {
                    Icon(
                        imageVector = Icons.Default.Hub,
                        contentDescription = null,
                        tint = tierPrimary(),
                        modifier = Modifier.size(18.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = title,
                        style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold, color = tierPrimary())
                    )
                }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    if (onFixDiagram != null) {
                        Button(
                            onClick = { onFixDiagram(code, language, errorMessage) },
                            colors = ButtonDefaults.buttonColors(
                                containerColor = tierPrimary().copy(alpha = 0.12f),
                                contentColor = tierPrimary()
                            ),
                            contentPadding = PaddingValues(horizontal = 10.dp, vertical = 2.dp),
                            modifier = Modifier
                                .height(28.dp)
                                .padding(end = 6.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Build,
                                contentDescription = "Fix Diagram",
                                modifier = Modifier.size(12.dp)
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("Fix Diagram", fontSize = 10.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                    TextButton(
                        onClick = { showCode = !showCode },
                        modifier = Modifier.height(28.dp)
                    ) {
                        Text(if (showCode) "View Visual" else "View Code", fontSize = 11.sp)
                    }
                    IconButton(
                        onClick = { showArtifactDialog = true },
                        modifier = Modifier.size(28.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.OpenInNew,
                            contentDescription = "Open in Canvas",
                            tint = tierPrimary(),
                            modifier = Modifier.size(16.dp)
                        )
                    }
                }
            }
            Spacer(modifier = Modifier.height(8.dp))
            if (showCode) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .horizontalScroll(rememberScrollState())
                        .background(Color.Black.copy(alpha = 0.06f), RoundedCornerShape(8.dp))
                        .padding(10.dp)
                ) {
                    Text(
                        text = highlightCode(code, language),
                        fontFamily = FontFamily.Monospace,
                        fontSize = 11.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            } else {
                content(Modifier.fillMaxWidth().height(defaultHeight))
            }
        }
    }

    if (showArtifactDialog) {
        ArtifactCanvasDialog(
            title = title,
            onClose = { showArtifactDialog = false }
        ) {
            Box(modifier = Modifier.fillMaxSize()) {
                if (showCode) {
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .verticalScroll(rememberScrollState())
                            .background(Color.Black.copy(alpha = 0.08f))
                            .padding(16.dp)
                    ) {
                        Text(
                            text = highlightCode(code, language),
                            fontFamily = FontFamily.Monospace,
                            fontSize = 13.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                } else {
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .background(MaterialTheme.colorScheme.background)
                    ) {
                        content(Modifier.fillMaxSize())
                    }
                }
            }
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// WebView shell (mirrors the web app's iframe renderers)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Hosts a [WebView] that renders a self-contained HTML shell. The shells load the same
 * CDN libraries the web app uses (mermaid.js / chart.js / viz.js / three.js) so diagrams
 * render pixel-identical to the web version, with pinch-zoom enabled.
 */
@Composable
private fun DiagramWebView(
    html: String,
    fallbackCode: String,
    language: String,
    modifier: Modifier = Modifier,
    baseUrl: String? = "https://cdn.jsdelivr.net/",
    onFixDiagram: ((code: String, language: String, error: String?) -> Unit)? = null,
    onRenderError: ((String) -> Unit)? = null
) {
    val mainHandler = remember { Handler(Looper.getMainLooper()) }
    var error by remember { mutableStateOf<String?>(null) }
    val postError = { msg: String ->
        mainHandler.post {
            // Keep enough of the renderer error for the AI to fix the code — Mermaid/DOT errors
            // usually end with the offending line and snippet.
            error = msg.take(600)
            onRenderError?.invoke(msg.take(600))
        }
    }

    if (error != null) {
        DiagramErrorFallback(
            message = error ?: "",
            code = fallbackCode,
            language = language,
            onFixDiagram = onFixDiagram
        )
    } else {
        AndroidView(
            factory = { ctx ->
                WebView(ctx).apply {
                    settings.javaScriptEnabled = true
                    settings.domStorageEnabled = true
                    settings.builtInZoomControls = true
                    settings.displayZoomControls = false
                    settings.useWideViewPort = true
                    settings.loadWithOverviewMode = true
                    setBackgroundColor(android.graphics.Color.TRANSPARENT)
                    overScrollMode = View.OVER_SCROLL_NEVER
                    isVerticalScrollBarEnabled = false
                    isHorizontalScrollBarEnabled = false
                    addJavascriptInterface(
                        object {
                            @JavascriptInterface
                            fun onError(msg: String) {
                                postError(msg)
                            }

                            @JavascriptInterface
                            fun onRendered() {
                                // no-op — reserved for future "rendered" tracking
                            }
                        },
                        "AndroidBridge"
                    )
                    // Block in-WebView navigation: open http(s) links in the system browser
                    // instead (mirrors the web app's HtmlRenderer which blocks external nav).
                    webViewClient = object : android.webkit.WebViewClient() {
                        override fun shouldOverrideUrlLoading(
                            view: android.webkit.WebView?,
                            request: WebResourceRequest?
                        ): Boolean {
                            val url = request?.url?.toString() ?: return false
                            return openUrlExternally(view, url)
                        }

                        @Suppress("DEPRECATION")
                        override fun shouldOverrideUrlLoading(
                            view: android.webkit.WebView?,
                            url: String?
                        ): Boolean {
                            return openUrlExternally(view, url)
                        }
                    }
                    loadDataWithBaseURL(baseUrl, html, "text/html", "utf-8", null)
                }
            },
            modifier = modifier
        )
    }
}

/**
 * Maps a raw WebView/JS renderer error to copy a user can act on. The technical detail is kept
 * for the "Fix Diagram" flow (it helps the AI repair the code) but is not shown on screen.
 */
private fun friendlyDiagramError(raw: String?): String {
    val msg = raw?.lowercase() ?: ""
    return when {
        msg.contains("library not loaded") || msg.contains("cdn") || msg.contains("network") ||
            msg.contains("timed out") || msg.contains("load failed") || msg.contains("fetch") ->
            "This diagram needs an internet connection to render. Please check your connection and try again."
        msg.isNotBlank() ->
            "This diagram couldn't be rendered. You can try fixing it with the button below."
        else ->
            "This diagram couldn't be rendered. Please try again."
    }
}

private fun openUrlExternally(view: WebView?, url: String?): Boolean {
    val u = url ?: return false
    if (!u.startsWith("http://", ignoreCase = true) && !u.startsWith("https://", ignoreCase = true)) return false
    val ctx = view?.context ?: return true
    try {
        ctx.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(u)))
    } catch (_: Exception) {
        // no handler for this URL
    }
    return true
}

@Composable
private fun DiagramErrorFallback(
    message: String,
    code: String,
    language: String,
    onFixDiagram: ((code: String, language: String, error: String?) -> Unit)? = null
) {
    var showCode by remember { mutableStateOf(false) }
    Card(
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.25f)),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    imageVector = Icons.Default.Warning,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.error,
                    modifier = Modifier.size(16.dp)
                )
                Spacer(modifier = Modifier.width(6.dp))
                Text(
                    text = "Couldn't render this diagram",
                    style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.error)
                )
                Spacer(modifier = Modifier.weight(1f))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    if (onFixDiagram != null) {
                        Button(
                            onClick = { onFixDiagram(code, language, message) },
                            colors = ButtonDefaults.buttonColors(
                                containerColor = MaterialTheme.colorScheme.error,
                                contentColor = MaterialTheme.colorScheme.onError
                            ),
                            contentPadding = PaddingValues(horizontal = 8.dp, vertical = 2.dp),
                            modifier = Modifier
                                .height(28.dp)
                                .padding(end = 6.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Build,
                                contentDescription = "Fix Diagram",
                                modifier = Modifier.size(12.dp)
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("Fix Diagram", fontSize = 10.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                    TextButton(onClick = { showCode = !showCode }, modifier = Modifier.height(28.dp)) {
                        Text(if (showCode) "Hide Code" else "View Code", fontSize = 11.sp)
                    }
                }
            }
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = friendlyDiagramError(message),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f),
                maxLines = 4,
                overflow = TextOverflow.Ellipsis
            )
            if (showCode) {
                Spacer(modifier = Modifier.height(6.dp))
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .horizontalScroll(rememberScrollState())
                        .background(Color.Black.copy(alpha = 0.08f), RoundedCornerShape(6.dp))
                        .padding(8.dp)
                ) {
                    Text(
                        text = code,
                        fontFamily = FontFamily.Monospace,
                        fontSize = 11.sp
                    )
                }
            }
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-diagram-type blocks
// ─────────────────────────────────────────────────────────────────────────────

@Composable
private fun ChatMermaidBlock(
    diagram: ChatBlock.MermaidDiagram,
    onFixDiagram: ((code: String, language: String, error: String?) -> Unit)? = null
) {
    var mermaidError by remember { mutableStateOf<String?>(null) }
    DiagramCard(
        title = "Mermaid Diagram · ${diagram.type}",
        code = diagram.code,
        language = "mermaid",
        onFixDiagram = onFixDiagram,
        errorMessage = mermaidError,
        defaultHeight = 320.dp
    ) { fillModifier ->
        DiagramWebView(
            html = buildMermaidHtml(diagram.code),
            fallbackCode = diagram.code,
            language = "mermaid",
            onFixDiagram = onFixDiagram,
            onRenderError = { mermaidError = it },
            modifier = fillModifier
        )
    }
}

@Composable
private fun ChatDiagramWebViewBlock(
    diagram: ChatBlock.DiagramBlock,
    onFixDiagram: ((code: String, language: String, error: String?) -> Unit)? = null
) {
    val lang = diagram.language.lowercase()
    var blockError by remember { mutableStateOf<String?>(null) }
    when (lang) {
        "chartjs", "chart", "chart.js" -> DiagramCard(
            title = "Chart.js Graph",
            code = diagram.code,
            language = lang,
            onFixDiagram = onFixDiagram,
            errorMessage = blockError,
            defaultHeight = 300.dp
        ) { fillModifier ->
            DiagramWebView(
                html = buildChartJsHtml(diagram.code),
                fallbackCode = diagram.code,
                language = lang,
                onFixDiagram = onFixDiagram,
                onRenderError = { blockError = it },
                modifier = fillModifier
            )
        }
        "dot", "graphviz" -> DiagramCard(
            title = "DOT Graph",
            code = diagram.code,
            language = lang,
            onFixDiagram = onFixDiagram,
            errorMessage = blockError,
            defaultHeight = 340.dp
        ) { fillModifier ->
            DiagramWebView(
                html = buildDotHtml(diagram.code),
                fallbackCode = diagram.code,
                language = lang,
                onFixDiagram = onFixDiagram,
                onRenderError = { blockError = it },
                modifier = fillModifier
            )
        }
        "threejs", "three", "3d" -> DiagramCard(
            title = "Three.js 3D Scene",
            code = diagram.code,
            language = lang,
            onFixDiagram = onFixDiagram,
            errorMessage = blockError,
            defaultHeight = 360.dp
        ) { fillModifier ->
            DiagramWebView(
                html = buildThreeJsHtml(diagram.code),
                fallbackCode = diagram.code,
                language = lang,
                onFixDiagram = onFixDiagram,
                onRenderError = { blockError = it },
                modifier = fillModifier
            )
        }
        else -> DiagramCodeCard(language = diagram.language, code = diagram.code)
    }
}

@Composable
private fun ChatHtmlBlock(
    htmlBlock: ChatBlock.HtmlBlock,
    onFixDiagram: ((code: String, language: String, error: String?) -> Unit)? = null
) {
    var blockError by remember { mutableStateOf<String?>(null) }
    DiagramCard(
        title = "Web Page Preview",
        code = htmlBlock.html,
        language = "html",
        onFixDiagram = onFixDiagram,
        errorMessage = blockError,
        defaultHeight = 400.dp
    ) { fillModifier ->
        DiagramWebView(
            html = htmlBlock.html,
            fallbackCode = htmlBlock.html,
            language = "html",
            baseUrl = null,
            onFixDiagram = onFixDiagram,
            onRenderError = { blockError = it },
            modifier = fillModifier
        )
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Presentation slides (native Compose deck, mirrors web SlidesRenderer)
// ─────────────────────────────────────────────────────────────────────────────

data class SlideData(val title: String, val content: String)

private fun JSONObject.toSlide(): SlideData {
    val titleKeys = listOf("title", "Title", "TITLE", "header", "Header", "slide", "Slide")
    val titleKey = titleKeys.firstOrNull { has(it) }
    val titleVal = if (titleKey != null) optString(titleKey) else "Slide"

    val contentKeys = listOf("content", "Content", "CONTENT", "body", "Body", "text", "Text", "description", "bullets")
    val contentKey = contentKeys.firstOrNull { has(it) }
    
    val contentVal = if (contentKey != null) {
        when (val c = opt(contentKey)) {
            is JSONArray -> (0 until c.length()).joinToString("\n") { c.optString(it) }
            else -> optString(contentKey)
        }
    } else {
        var foundVal = ""
        val keys = keys()
        while (keys.hasNext()) {
            val k = keys.next()
            if (k != titleKey) {
                when (val c = opt(k)) {
                    is JSONArray -> {
                        foundVal = (0 until c.length()).joinToString("\n") { c.optString(it) }
                        break
                    }
                    else -> {
                        val s = optString(k)
                        if (s.isNotBlank()) {
                            foundVal = s
                            break
                        }
                    }
                }
            }
        }
        foundVal
    }

    return SlideData(title = titleVal, content = contentVal)
}

private fun JSONArray.toSlides(): List<SlideData> {
    val out = mutableListOf<SlideData>()
    val keysOfInterest = listOf("title", "Title", "TITLE", "header", "Header", "slide", "Slide", "content", "Content", "body", "text")
    for (i in 0 until length()) {
        when (val el = opt(i)) {
            is JSONObject -> {
                if (keysOfInterest.any { el.has(it) }) {
                    out.add(el.toSlide())
                }
            }
            is JSONArray -> out.addAll(el.toSlides())
        }
    }
    return out
}

/** Robustly extracts JSON objects from a text string using balanced brace matching. */
fun extractJsonObjects(text: String): List<String> {
    val results = mutableListOf<String>()
    var braceCount = 0
    var startIndex = -1
    var inString = false
    var escape = false

    for (i in text.indices) {
        val c = text[i]
        if (inString) {
            if (escape) {
                escape = false
            } else if (c == '\\') {
                escape = true
            } else if (c == '"') {
                inString = false
            }
        } else {
            if (c == '"') {
                inString = true
            } else if (c == '{') {
                if (braceCount == 0) {
                    startIndex = i
                }
                braceCount++
            } else if (c == '}') {
                if (braceCount > 0) {
                    braceCount--
                    if (braceCount == 0 && startIndex != -1) {
                        results.add(text.substring(startIndex, i + 1))
                    }
                }
            }
        }
    }
    return results
}

/** Robust slide-JSON parsing mirroring the web app's parseSlides(). */
fun parseSlideJson(raw: String): List<SlideData> {
    var text = raw.trim()
    text = text.replace(Regex("^```[a-zA-Z]*\\s*"), "").replace(Regex("\\s*```$"), "").trim()

    val keysOfInterest = listOf("title", "Title", "TITLE", "header", "Header", "slide", "Slide", "content", "Content", "body", "text")

    // 1: complete JSON array
    if (text.startsWith("[")) {
        try {
            return JSONArray(text).toSlides()
        } catch (_: Exception) { /* continue */ }
    }

    // 2: single slide object or wrapped presentation object
    try {
        val obj = JSONObject(text)
        if (keysOfInterest.any { obj.has(it) }) return listOf(obj.toSlide())
        
        val keys = mutableListOf<String>()
        val iterator = obj.keys()
        while (iterator.hasNext()) {
            keys.add(iterator.next())
        }
        for (k in keys) {
            val lower = k.lowercase()
            if (lower == "slides" || lower == "presentation" || lower == "deck" || lower == "pages" || lower == "slideshow") {
                val arr = obj.optJSONArray(k)
                if (arr != null) {
                    val slides = arr.toSlides()
                    if (slides.isNotEmpty()) return slides
                }
                val nestedObj = obj.optJSONObject(k)
                if (nestedObj != null) {
                    if (keysOfInterest.any { nestedObj.has(it) }) return listOf(nestedObj.toSlide())
                    val nestedKeys = nestedObj.keys()
                    while (nestedKeys.hasNext()) {
                        val nk = nestedKeys.next()
                        val nkl = nk.lowercase()
                        if (nkl == "slides" || nkl == "pages") {
                            val nestedArr = nestedObj.optJSONArray(nk)
                            if (nestedArr != null) {
                                val slides = nestedArr.toSlides()
                                if (slides.isNotEmpty()) return slides
                            }
                        }
                    }
                }
            }
        }
    } catch (_: Exception) { /* continue */ }

    // 3: unwrapped comma-separated objects — wrap in brackets
    try {
        val slides = JSONArray("[$text]").toSlides()
        if (slides.isNotEmpty()) return slides
    } catch (_: Exception) { /* continue */ }

    // 4: extract individual objects using robust brace extraction
    val candidates = extractJsonObjects(text)
    if (candidates.isNotEmpty()) {
        val slides = candidates.mapNotNull { s ->
            runCatching {
                val obj = JSONObject(s)
                if (keysOfInterest.any { obj.has(it) }) obj.toSlide() else null
            }.getOrNull()
        }
        if (slides.isNotEmpty()) return slides
    }

    return emptyList()
}

@Composable
private fun ChatSlideDeckBlock(slides: ChatBlock.SlidesBlock) {
    val deck = remember(slides.json) { parseSlideJson(slides.json) }
    if (deck.isEmpty()) {
        DiagramCodeCard(language = "slides", code = slides.json)
        return
    }

    var currentPage by remember(slides.json) { mutableStateOf(0) }
    var showArtifactDialog by remember { mutableStateOf(false) }

    Card(
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)),
        modifier = Modifier
            .fillMaxWidth()
            .border(1.dp, tierTertiary().copy(alpha = 0.3f), RoundedCornerShape(16.dp))
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    imageVector = Icons.Default.Slideshow,
                    contentDescription = null,
                    tint = tierTertiary(),
                    modifier = Modifier.size(18.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "Presentation Slides",
                    style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold, color = tierTertiary())
                )
                Spacer(modifier = Modifier.weight(1f))
                Text(
                    text = "${currentPage + 1} / ${deck.size}",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f)
                )
                Spacer(modifier = Modifier.width(6.dp))
                IconButton(
                    onClick = { showArtifactDialog = true },
                    modifier = Modifier.size(28.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.OpenInNew,
                        contentDescription = "Open in Canvas",
                        tint = tierTertiary(),
                        modifier = Modifier.size(16.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(10.dp))

            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(360.dp)
            ) {
                SlidePage(deck[currentPage])
            }

            Spacer(modifier = Modifier.height(10.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.Center,
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(
                    onClick = { if (currentPage > 0) currentPage-- },
                    enabled = currentPage > 0,
                    modifier = Modifier.size(32.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.ChevronLeft,
                        contentDescription = "Previous slide",
                        tint = if (currentPage > 0) tierTertiary() else MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.25f),
                        modifier = Modifier.size(20.dp)
                    )
                }
                Spacer(modifier = Modifier.width(10.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                    repeat(deck.size) { i ->
                        Box(
                            modifier = Modifier
                                .size(if (i == currentPage) 8.dp else 6.dp)
                                .clip(CircleShape)
                                .background(
                                    if (i == currentPage) tierTertiary()
                                    else MaterialTheme.colorScheme.outline.copy(alpha = 0.25f)
                                )
                        )
                    }
                }
                Spacer(modifier = Modifier.width(10.dp))
                IconButton(
                    onClick = { if (currentPage < deck.size - 1) currentPage++ },
                    enabled = currentPage < deck.size - 1,
                    modifier = Modifier.size(32.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.ChevronRight,
                        contentDescription = "Next slide",
                        tint = if (currentPage < deck.size - 1) tierTertiary() else MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.25f),
                        modifier = Modifier.size(20.dp)
                    )
                }
            }
        }
    }

    if (showArtifactDialog) {
        ArtifactCanvasDialog(
            title = "Presentation Slides",
            onClose = { showArtifactDialog = false }
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {
                Card(
                    modifier = Modifier
                        .fillMaxWidth(0.95f)
                        .weight(1f)
                        .border(1.dp, tierTertiary().copy(alpha = 0.3f), RoundedCornerShape(24.dp)),
                    shape = RoundedCornerShape(24.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(24.dp)
                    ) {
                        SlidePage(deck[currentPage])
                    }
                }
                Spacer(modifier = Modifier.height(20.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.Center,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    IconButton(
                        onClick = { if (currentPage > 0) currentPage-- },
                        enabled = currentPage > 0,
                        modifier = Modifier.size(48.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.ChevronLeft,
                            contentDescription = "Previous slide",
                            tint = if (currentPage > 0) tierTertiary() else MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.25f),
                            modifier = Modifier.size(32.dp)
                        )
                    }
                    Spacer(modifier = Modifier.width(20.dp))
                    Text(
                        text = "${currentPage + 1} / ${deck.size}",
                        style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                        color = MaterialTheme.colorScheme.onSurface
                    )
                    Spacer(modifier = Modifier.width(20.dp))
                    IconButton(
                        onClick = { if (currentPage < deck.size - 1) currentPage++ },
                        enabled = currentPage < deck.size - 1,
                        modifier = Modifier.size(48.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.ChevronRight,
                            contentDescription = "Next slide",
                            tint = if (currentPage < deck.size - 1) tierTertiary() else MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.25f),
                            modifier = Modifier.size(32.dp)
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun SlidePage(slide: SlideData) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(14.dp)
    ) {
        Text(
            text = slide.title,
            style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.ExtraBold, color = tierTertiary())
        )
        Spacer(modifier = Modifier.height(10.dp))
        val contentBlocks = remember(slide.content) {
            parseChatMarkdownBlocks(slide.content.replace("\\n", "\n"))
        }
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            contentBlocks.forEach { block ->
                when (block) {
                    is ChatBlock.Header -> HeaderBlock(block)
                    is ChatBlock.ListBlock -> ListBlock(block)
                    is ChatBlock.TaskItem -> TaskItemBlock(item = block, onCheckedChange = {})
                    is ChatBlock.Blockquote -> BlockquoteBlock(block)
                    is ChatBlock.CodeBlock -> ChatCodeBlockElement(block)
                    is ChatBlock.LaTeXBlock -> LaTeXMathBlock(block)
                    is ChatBlock.Paragraph -> ChatParagraphBlock(ChatBlock.Paragraph(block.text))
                    else -> {} // tables/images inside slides are rare — skip
                }
            }
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// HTML shells for the WebView renderers (same CDN libs the web app's iframes use)
// ─────────────────────────────────────────────────────────────────────────────

private fun escapeHtml(s: String): String =
    s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

/** JSON-encode as a JS string literal, then neutralize any </script> sequence. */
private fun quoteJs(s: String): String =
    JSONObject.quote(s).replace("</", "<\\/")

private fun buildMermaidHtml(code: String): String {
    val escaped = escapeHtml(code)
    return """
    <!DOCTYPE html><html><head>
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5, user-scalable=yes">
    <script src="https://cdn.jsdelivr.net/npm/mermaid@9.4.3/dist/mermaid.min.js"></script>
    <style>
      html,body{margin:0;padding:0;background:#282c34;width:100%;min-height:100%;}
      #container{width:100%;min-height:100%;display:flex;align-items:flex-start;justify-content:center;padding:10px;box-sizing:border-box;}
      #diagram{width:100%;margin:0;opacity:0;transition:opacity 0.2s ease;}
      #diagram svg{width:100% !important;height:auto !important;max-width:100% !important;}
      #err{display:none;color:#f87171;font-family:monospace;font-size:12px;white-space:pre-wrap;padding:12px;}
      #loading{color:#61dafb;font-family:sans-serif;font-size:13px;padding:12px;}
    </style></head><body>
    <div id="err"></div>
    <div id="container"><div id="loading">Rendering diagram…</div><pre class="mermaid" id="diagram">$escaped</pre></div>
    <script>
    function reportError(e){
      var m=(e&&e.message)?e.message:String(e);
      var el=document.getElementById('err');
      if(el){
        el.style.display='block';
        el.textContent='Mermaid error: '+m;
      }
      var l=document.getElementById('loading');
      if(l){
        l.style.display='none';
      }
      try{AndroidBridge.onError(m);}catch(_){}
    }
    var renderAttempts = 0;
    function renderNow(){
      try{
        if (typeof mermaid === 'undefined') {
          throw new Error('Mermaid library not loaded. Check your connection or the CDN URL.');
        }
        mermaid.parseError = function(err, hash) {
          reportError(err);
        };
        var width = document.body.clientWidth || window.innerWidth;
        if ((!width || width < 10) && renderAttempts < 50) {
          renderAttempts++;
          window.setTimeout(renderNow, 50);
          return;
        }
        mermaid.initialize({
          startOnLoad:false,
          theme:'dark',
          securityLevel:'loose',
          flowchart:{useMaxWidth:true,htmlLabels:true},
          sequence:{useMaxWidth:true},
          parseError: function(err, hash) {
            reportError(err);
          }
        });
        mermaid.init(undefined, document.getElementById('diagram'));
        
        // Ensure SVG generated scales correctly
        var svg = document.querySelector('#diagram svg');
        if (svg) {
          svg.style.width = '100%';
          svg.style.height = 'auto';
          svg.style.maxWidth = '100%';
        }
        
        var l=document.getElementById('loading');
        if(l) l.style.display='none';
        var d=document.getElementById('diagram');
        if(d) d.style.opacity='1';
        try{AndroidBridge.onRendered();}catch(_){}
      }catch(e){
        reportError(e);
      }
    }
    window.setTimeout(renderNow,150);
    window.setTimeout(function(){
      var l=document.getElementById('loading');
      if(l&&l.style.display!=='none'){reportError('Diagram render timed out. Check your connection to cdn.jsdelivr.net and try again.');}
    },30000);
    </script></body></html>
    """.trimIndent()
}

private fun buildChartJsHtml(config: String): String {
    // Embed as a quoted JS string, then parse/repair at runtime — a script-parse error in the
    // raw config would otherwise kill the whole page before our try/catch could report it.
    val safeConfig = quoteJs(config)
    return """
    <!DOCTYPE html><html><head>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js"></script>
    <style>html,body{margin:0;padding:0;width:100%;height:100%;background:#ffffff;}
      #wrap{width:100%;height:100%;padding:8px;box-sizing:border-box;position:relative;}
      #err{display:none;color:#dc2626;font-family:monospace;font-size:12px;padding:8px;white-space:pre-wrap;}</style>
    </head><body>
    <div id="err"></div><div id="wrap"><canvas id="c"></canvas></div>
    <script>
    function fail(e){
      var m=(e&&e.message)?e.message:String(e);
      document.getElementById('err').style.display='block';
      document.getElementById('err').textContent='Chart error: '+m;
      try{AndroidBridge.onError(m);}catch(_){}
    }
    // ── Repair pipeline mirroring the web app's ChartJsRenderer ──
    function detectChartType(obj){
      var s=JSON.stringify(obj).toLowerCase();
      if(s.indexOf('"pie"')>=0||s.indexOf("'pie'")>=0)return 'pie';
      if(s.indexOf('"doughnut"')>=0||s.indexOf("'doughnut'")>=0)return 'doughnut';
      if(s.indexOf('"line"')>=0||s.indexOf("'line'")>=0||s.indexOf('bordercolor')>=0)return 'line';
      if(s.indexOf('"radar"')>=0||s.indexOf("'radar'")>=0)return 'radar';
      if(s.indexOf('"scatter"')>=0||s.indexOf("'scatter'")>=0)return 'scatter';
      if(s.indexOf('"polararea"')>=0||s.indexOf("'polararea'")>=0)return 'polarArea';
      var ds=obj&&obj.datasets&&obj.datasets[0];
      if(Array.isArray(ds&&ds.backgroundColor)&&!ds.borderColor)return 'pie';
      return 'bar';
    }
    function balanceBraces(str){
      var b=0,k=0;
      for(var i=0;i<str.length;i++){var c=str.charAt(i);if(c==='{')b++;else if(c==='}')b--;else if(c==='[')k++;else if(c===']')k--;}
      var r=str;
      while(b<0){r='{'+r;b++}
      while(k<0){r='['+r;k++}
      while(b>0){r+='}';b--}
      while(k>0){r+=']';k--}
      return r;
    }
    function normalizeChart(obj){
      if(!obj||typeof obj!=='object')throw new Error('Invalid chart config');
      if(obj.type&&obj.data)return obj;
      if((obj.labels||obj.datasets)&&obj.options){
        var d=Object.assign({},obj);delete d.options;
        return {type:obj.type||detectChartType(d),data:d,options:obj.options};
      }
      if(obj.labels||obj.datasets)return {type:detectChartType(obj),data:obj,options:{responsive:true}};
      if(obj.data&&!obj.type){obj.type=detectChartType(obj.data);return obj;}
      return obj;
    }
    function parseChartConfig(raw){
      try{return normalizeChart(JSON.parse(raw));}catch(e){}
      try{return normalizeChart(new Function('return '+raw)());}catch(e){}
      var w=raw.trim();
      if(w.charAt(0)!=='{')w='{'+w;
      w=balanceBraces(w);
      try{return normalizeChart(JSON.parse(w));}catch(e){}
      try{return normalizeChart(new Function('return '+w)());}catch(e){}
      throw new Error('Unable to parse chart config');
    }
    try{
      var rawCfg = $safeConfig;
      var cfg = parseChartConfig(rawCfg);
      if(!cfg.type){cfg.type='bar';}
      if(!cfg.data){cfg.data={labels:[],datasets:[{data:[]}]};}
      cfg.options = cfg.options || {};
      cfg.options.responsive = true;
      cfg.options.maintainAspectRatio = false;
      new Chart(document.getElementById('c').getContext('2d'), cfg);
      try{AndroidBridge.onRendered();}catch(_){}
    }catch(e){fail(e);}
    </script></body></html>
    """.trimIndent()
}

private fun buildDotHtml(dot: String): String {
    val safeDot = quoteJs(dot)
    return """
    <!DOCTYPE html><html><head>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <script src="https://cdn.jsdelivr.net/npm/viz.js@2.1.2/viz.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/viz.js@2.1.2/full.render.js"></script>
    <style>html,body{margin:0;padding:0;background:#ffffff;}
      #out{width:100%;padding:8px;box-sizing:border-box;overflow:auto;}
      #out svg{max-width:100%;height:auto;}
      #err{display:none;color:#dc2626;font-family:monospace;font-size:12px;white-space:pre-wrap;}</style>
    </head><body>
    <div id="err"></div><div id="out"></div>
    <script>
    function fail(e){
      var m=(e&&e.message)?e.message:String(e);
      document.getElementById('err').style.display='block';
      document.getElementById('err').textContent='DOT error: '+m;
      try{AndroidBridge.onError(m);}catch(_){}
    }
    try{
      var dotSrc = $safeDot;
      Viz.instance().then(function(viz){
        var svg = viz.renderSVGElement(dotSrc);
        document.getElementById('out').appendChild(svg);
        try{AndroidBridge.onRendered();}catch(_){}
      }).catch(fail);
    }catch(e){fail(e);}
    </script></body></html>
    """.trimIndent()
}

private fun buildThreeJsHtml(code: String): String {
    val safeCode = quoteJs(code)
    return """
    <!DOCTYPE html><html><head>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <script type="importmap">
    {"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"}}
    </script>
    <style>html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:#282c34;}
      #c{width:100%;height:100%;display:block;touch-action:none;}
      #err{position:absolute;left:0;right:0;top:8px;display:none;color:#f87171;font-family:monospace;font-size:12px;padding:8px;white-space:pre-wrap;background:rgba(0,0,0,0.6);}</style>
    </head><body>
    <canvas id="c"></canvas><div id="err"></div>
    <script type="module">
      import * as THREE from 'three';
      import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
      import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
      window.__THREE=THREE; window.__OrbitControls=OrbitControls; window.__GLTFLoader=GLTFLoader;
    </script>
    <script>
    function fail(e){
      var m=(e&&e.message)?e.message:String(e);
      document.getElementById('err').style.display='block';
      document.getElementById('err').textContent='3D error: '+m;
      try{AndroidBridge.onError(m);}catch(_){}
    }
    // Repair pipeline mirroring the web app's ThreeJsRenderer.sanitizeThreeJsCode
    function sanitize(code){
      var fixed=code;
      fixed=fixed.replace(/=\s*=>\s*\{/g,'= () => {');
      fixed=fixed.replace(/\.(dispose|destroy|remove|clear|stop|disconnect|terminate|close)\s*;/g,function(m,p){return '.'+p+'();';});
      fixed=fixed.replace(/new\s+(THREE\.[A-Za-z0-9_]+)\s*;/g,function(m,p){return 'new '+p+'();';});
      var opens=(fixed.match(/\{/g)||[]).length;
      var closes=(fixed.match(/\}/g)||[]).length;
      if(opens>closes){for(var i=0;i<opens-closes;i++){fixed+='\n}';}}
      return fixed;
    }
    function start(){
      if(!window.__THREE){ setTimeout(start,120); return; }
      try{
        var code = sanitize($safeCode);
        var factory = new Function('THREE','OrbitControls','GLTFLoader', code);
        var createScene = factory(window.__THREE, window.__OrbitControls, window.__GLTFLoader);
        if(typeof createScene !== 'function'){ throw new Error('createThreeJSScene is not a function'); }
        var canvas = document.getElementById('c');
        var result = createScene(canvas, window.__THREE, window.__OrbitControls, window.__GLTFLoader);
        var scene=result.scene, renderer=result.renderer, camera=result.camera, controls=result.controls;
        if(!scene||!renderer||!camera||!controls){ throw new Error('createThreeJSScene must return {scene,renderer,camera,controls,cleanup}'); }
        var startTime=Date.now(), last=Date.now();
        function animate(){
          requestAnimationFrame(animate);
          var now=Date.now(), elapsed=(now-startTime)/1000, delta=(now-last)/1000; last=now;
          controls.update();
          scene.traverse(function(obj){
            if(obj.hasOwnProperty('orbitRadius')&&obj.hasOwnProperty('orbitSpeed')){
              var a=elapsed*obj.orbitSpeed;
              var c=obj.orbitCenter||new window.__THREE.Vector3(0,0,0);
              obj.position.x=c.x+Math.cos(a)*obj.orbitRadius;
              obj.position.z=c.z+Math.sin(a)*obj.orbitRadius;
              obj.position.y=c.y+(obj.orbitHeight||0);
            }
            if(obj.hasOwnProperty('rotationSpeed')){
              var r=obj.rotationSpeed;
              if(typeof r==='number'){ obj.rotation.y+=r*delta*60; }
              else if(typeof r==='object'){
                obj.rotation.x+=(r.x||0)*delta*60;
                obj.rotation.y+=(r.y||0)*delta*60;
                obj.rotation.z+=(r.z||0)*delta*60;
              }
            }
            if(obj.hasOwnProperty('scaleAnimation')){
              var s=obj.scaleAnimation;
              if(s.type==='pulse'){ var k=1+Math.sin(elapsed*(s.speed||1))*(s.amplitude||0.1); obj.scale.setScalar(k); }
            }
            if(obj.hasOwnProperty('customUpdate')&&typeof obj.customUpdate==='function'){ obj.customUpdate(elapsed,delta); }
          });
          renderer.render(scene,camera);
        }
        animate();
        try{AndroidBridge.onRendered();}catch(_){}
      }catch(e){ fail(e); }
    }
    setTimeout(start,60);
    </script></body></html>
    """.trimIndent()
}

// ─────────────────────────────────────────────────────────────────────────────
// Streaming placeholder (lightweight card shown while the SSE stream is live)
// ─────────────────────────────────────────────────────────────────────────────

@Composable
private fun DiagramStreamingPlaceholder(label: String) {
    Card(
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)),
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier.padding(14.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            CircularProgressIndicator(
                modifier = Modifier.size(18.dp),
                strokeWidth = 2.dp,
                color = tierPrimary()
            )
            Spacer(modifier = Modifier.width(10.dp))
            Text(
                text = "$label rendering…",
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
            )
        }
    }
}

// Local helper components for Markdown blocks
@Composable
private fun HeaderBlock(header: ChatBlock.Header) {
    val style = when (header.level) {
        1 -> MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.ExtraBold, color = tierPrimary(), fontSize = 22.sp)
        2 -> MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold, color = tierTertiary(), fontSize = 18.sp)
        else -> MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.SemiBold, color = tierAccent(), fontSize = 15.sp)
    }

    Column(modifier = Modifier.padding(top = 8.dp, bottom = 4.dp)) {
        Text(
            text = header.text,
            style = style
        )
        Spacer(modifier = Modifier.height(2.dp))
        if (header.level == 1) {
            Box(
                modifier = Modifier
                    .fillMaxWidth(0.2f)
                    .height(3.dp)
                    .background(tierPrimary(), RoundedCornerShape(1.dp))
            )
        }
    }
}

@Composable
private fun ListBlock(list: ChatBlock.ListBlock) {
    Column(
        modifier = Modifier.padding(start = 8.dp, top = 2.dp, bottom = 2.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        list.items.forEachIndexed { idx, item ->
            Row(
                verticalAlignment = Alignment.Top,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(
                    text = if (list.ordered) "${idx + 1}. " else "• ",
                    style = MaterialTheme.typography.bodyMedium.copy(
                        fontWeight = FontWeight.Bold,
                        color = tierPrimary()
                    ),
                    modifier = Modifier.width(20.dp)
                )
                Text(
                    text = parseChatInlineFormatting(item),
                    style = MaterialTheme.typography.bodyMedium,
                    modifier = Modifier.weight(1f)
                )
            }
        }
    }
}

@Composable
private fun BlockquoteBlock(quote: ChatBlock.Blockquote) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(8.dp))
            .background(Color.Gray.copy(alpha = 0.05f))
            .border(1.dp, Color.Gray.copy(alpha = 0.15f), RoundedCornerShape(8.dp))
            .padding(vertical = 10.dp, horizontal = 12.dp),
        verticalAlignment = Alignment.Top
    ) {
        Icon(
            imageVector = Icons.Default.FormatQuote,
            contentDescription = null,
            tint = tierPrimary(),
            modifier = Modifier
                .size(20.dp)
                .padding(end = 4.dp)
        )
        Text(
            text = parseChatInlineFormatting(quote.text),
            style = MaterialTheme.typography.bodyMedium.copy(
                fontStyle = FontStyle.Italic,
                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.8f)
            ),
            modifier = Modifier.weight(1f)
        )
    }
}

@Composable
private fun ChatCodeBlockElement(codeBlock: ChatBlock.CodeBlock) {
    Card(
        shape = RoundedCornerShape(10.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp)
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = Icons.Default.Code,
                        contentDescription = null,
                        tint = tierPrimary(),
                        modifier = Modifier.size(14.dp)
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = codeBlock.language.ifBlank { "code" }.uppercase(),
                        style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold, color = tierPrimary())
                    )
                }
                
                val context = androidx.compose.ui.platform.LocalContext.current
                TextButton(
                    onClick = {
                        val clipboard = context.getSystemService(android.content.Context.CLIPBOARD_SERVICE) as android.content.ClipboardManager
                        val clip = android.content.ClipData.newPlainText("Copied Code", codeBlock.code)
                        clipboard.setPrimaryClip(clip)
                    },
                    modifier = Modifier.height(28.dp)
                ) {
                    Text("Copy", fontSize = 11.sp, color = tierPrimary())
                }
            }
            Spacer(modifier = Modifier.height(6.dp))
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState())
                    .background(Color.Black.copy(alpha = 0.05f), RoundedCornerShape(6.dp))
                    .padding(8.dp)
            ) {
                Text(
                    text = highlightCode(codeBlock.code, codeBlock.language),
                    fontFamily = FontFamily.Monospace,
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

@Composable
private fun DiagramCodeCard(language: String, code: String) {
    ChatCodeBlockElement(ChatBlock.CodeBlock(language, code))
}

private val INLINE_MATH_REGEX = Regex("\\$\\S[^$\n]{0,60}\\S\\$")

/** True when the text contains inline $...$ math (non-space ends, no newline). */
private fun containsInlineMath(text: String): Boolean = INLINE_MATH_REGEX.containsMatchIn(text)

/** Fenced blocks only the native renderer can display (mermaid/charts/3D/html/slides). */
private val RICH_ARTIFACT_REGEX = Regex(
    "```\\s*(mermaid|diagram|chartjs|chart|chart\\.js|dot|graphviz|threejs|three|3d|html|slides|presentation)\\b",
    RegexOption.IGNORE_CASE
)

private fun containsRichArtifactBlock(text: String): Boolean =
    RICH_ARTIFACT_REGEX.containsMatchIn(text)

/**
 * KaTeX HTML shell for a single block formula ($$...$$ / ```latex blocks). Loads the
 * real KaTeX library from the same CDN the notes editor uses; renders actual math.
 */
private fun buildLatexHtml(math: String, textColorHex: String): String {
    val safeMath = quoteJs(math)
    return """
    <!DOCTYPE html><html><head>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <script src="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.js"></script>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css">
    <style>
      html,body{margin:0;padding:0;background:transparent;overflow:hidden;}
      body{display:flex;align-items:center;justify-content:center;min-height:100%;padding:10px 6px;box-sizing:border-box;}
      #out{color:$textColorHex;max-width:100%;overflow-x:auto;overflow-y:hidden;padding:2px 0;}
      #err{display:none;color:#dc2626;font-family:monospace;font-size:13px;white-space:pre-wrap;padding:6px;max-width:100%;}
    </style></head><body>
    <div id="err"></div><div id="out"></div>
    <script>
    function fail(e){
      var m=(e&&e.message)?e.message:String(e);
      var el=document.getElementById('err');
      el.style.display='block';
      el.textContent='LaTeX error: '+m;
      try{AndroidBridge.onError(m);}catch(_){}
    }
    function renderNow(){
      try{
        if(typeof katex==='undefined'){ throw new Error('KaTeX library not loaded. Check your connection.'); }
        var html=katex.renderToString($safeMath,{throwOnError:false,displayMode:true});
        document.getElementById('out').innerHTML=html;
        var h=Math.ceil(Math.max(document.body.scrollHeight, document.documentElement.scrollHeight, document.body.offsetHeight, document.documentElement.offsetHeight))+32;
        try{AndroidBridge.onHeight(h);}catch(_){}
        try{AndroidBridge.onRendered();}catch(_){}
        setTimeout(function(){ var h2=Math.ceil(Math.max(document.body.scrollHeight, document.documentElement.scrollHeight, document.body.offsetHeight, document.documentElement.offsetHeight))+32; try{AndroidBridge.onHeight(h2);}catch(_){}},300);
        setTimeout(function(){ var h3=Math.ceil(Math.max(document.body.scrollHeight, document.documentElement.scrollHeight, document.body.offsetHeight, document.documentElement.offsetHeight))+32; try{AndroidBridge.onHeight(h3);}catch(_){}},1000);
      }catch(e){ fail(e); }
    }
    window.setTimeout(renderNow,80);
    try {
      var _obs=new MutationObserver(function(){ var h=Math.ceil(Math.max(document.body.scrollHeight, document.documentElement.scrollHeight, document.body.offsetHeight, document.documentElement.offsetHeight))+32; try{AndroidBridge.onHeight(h);}catch(_){} });
      _obs.observe(document.body, {childList:true, subtree:true, attributes:true, characterData:true});
      setTimeout(function(){ _obs.disconnect(); },5000);
    } catch(_){}
    window.setTimeout(function(){
      var o=document.getElementById('out');
      if(o&&!o.innerHTML){ fail('KaTeX render timed out. Check your connection to cdn.jsdelivr.net.'); }
    },25000);
    </script></body></html>
    """.trimIndent()
}

/**
 * Renders a whole markdown message through ONE KaTeX-powered WebView so inline
 * $...$ math (and $$...$$ / ```latex blocks) appear as real math, not source.
 * Uses the exact CDN stack the notes editor & diagram shells use (katex,
 * auto-render, highlight.js, mermaid) and auto-reports its content height.
 */
private fun buildMathMessageHtml(markdown: String, textColorHex: String, isDark: Boolean): String {
    val bodyHtml = MarkdownConverter.markdownToHtml(markdown)
    val mermaidTheme = if (isDark) "'dark'" else "'default'"
    return """
    <!DOCTYPE html><html><head>
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
    <script src="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.js"></script>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css">
    <script src="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/contrib/auto-render.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/highlight.js@11.8.0/highlight.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/mermaid@9.4.3/dist/mermaid.min.js"></script>
    <style>
      html,body{margin:0;padding:0;background:transparent;color:$textColorHex;overflow:auto;-webkit-overflow-scrolling:touch;}
      body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;padding:2px 0;word-break:break-word;}
      h1,h2,h3,h4{margin:14px 0 6px;font-weight:700;line-height:1.3;}
      h1{font-size:22px;} h2{font-size:19px;} h3{font-size:17px;} h4{font-size:16px;}
      p{margin:6px 0;}
      a{color:#4f46e5;}
      blockquote{border-left:3px solid rgba(99,102,241,0.6);margin:8px 0;padding:4px 12px;background:rgba(99,102,241,0.08);border-radius:0 8px 8px 0;}
      pre{background:${if (isDark) "#0f172a" else "#f1f5f9"};color:${if (isDark) "#e2e8f0" else "#1e293b"};border-radius:8px;padding:10px 12px;overflow-x:auto;font-family:'Fira Code',monospace,monospace;font-size:13px;white-space:pre-wrap;word-break:break-word;}
      code{font-family:'Fira Code',monospace,monospace;font-size:13px;background:rgba(99,102,241,0.12);padding:1px 5px;border-radius:4px;}
      pre code{background:transparent;padding:0;}
      ul,ol{padding-left:22px;margin:6px 0;}
      li{margin:3px 0;}
      table{border-collapse:collapse;margin:10px 0;width:100%;}
      th,td{border:1px solid rgba(148,163,184,0.4);padding:6px 10px;text-align:left;font-size:14px;}
      th{background:rgba(99,102,241,0.12);}
      .katex{font-size:1.05em;}
      .katex-display{margin:10px 0;overflow-x:auto;overflow-y:hidden;padding:2px 0;}
      .diagram-box{background:rgba(99,102,241,0.06);border:1px solid rgba(99,102,241,0.3);border-radius:12px;padding:12px;margin:12px 0;overflow-x:auto;}
      .diagram-header{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#6366f1;margin-bottom:8px;}
      .mermaid{display:block;margin:0 auto;text-align:center;background:transparent !important;}
      .mermaid svg{max-width:100% !important;height:auto !important;}
    </style></head><body>
    $bodyHtml
    <script>
    var _lastH=0;
    function notifyHeight(){
      var h=Math.ceil(Math.max(document.body.scrollHeight, document.documentElement.scrollHeight, document.body.offsetHeight, document.documentElement.offsetHeight))+32;
      if(h>_lastH+4 || h<_lastH-4) { _lastH=h; try{AndroidBridge.onHeight(h);}catch(_){} }
    }
    function renderLatexFences(){
      try{
        document.querySelectorAll('pre code.language-latex, pre code.language-math, pre code.language-tex, pre code.language-katex').forEach(function(el){
          var code=el.textContent.trim();
          var out='';
          try{ out=katex.renderToString(code,{throwOnError:false,displayMode:true}); }catch(e){ out='<div style="color:#dc2626;font-family:monospace;font-size:13px;white-space:pre-wrap;padding:6px;">LaTeX error: '+(e&&e.message?e.message:String(e))+'</div>'; }
          var pre=el.closest('pre');
          if(pre){ pre.outerHTML='<div style="overflow-x:auto;overflow-y:hidden;padding:4px 0;">'+out+'</div>'; }
          else { el.outerHTML='<span>'+out+'</span>'; }
        });
      }catch(e){}
    }
    function renderAll(){
      try{
        if(typeof renderMathInElement!=='undefined'){
          renderMathInElement(document.body,{
            delimiters:[
              {left:'$$',right:'$$',display:true},
              {left:'$',right:'$',display:false},
              {left:'\\(',right:'\\)',display:false},
              {left:'\\[',right:'\\]',display:true}
            ],
            throwOnError:false
          });
        }
      }catch(e){}
      renderLatexFences();
      try{
        if(typeof hljs!=='undefined'){
          document.querySelectorAll('pre code').forEach(function(el){
            var cls=el.className||'';
            if(cls.indexOf('language-latex')<0&&cls.indexOf('language-math')<0&&cls.indexOf('language-tex')<0&&cls.indexOf('language-katex')<0&&!el.getAttribute('data-highlighted')){
              hljs.highlightElement(el);
              el.setAttribute('data-highlighted','1');
            }
          });
        }
      }catch(e){}
      try{
        if(typeof mermaid!=='undefined'){
          var els=document.querySelectorAll('.mermaid');
          els.forEach(function(el,idx){
            if(el.getAttribute('data-rendered')==='true') return;
            var raw=el.getAttribute('data-code')||el.textContent||'';
            raw=raw.replace(/&quot;/g,'"').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&').replace(/^```mermaid/i,'').replace(/^```/i,'').replace(/```$/,'').trim();
            if(!raw) return;
            try{
              mermaid.initialize({startOnLoad:false,theme:$mermaidTheme,securityLevel:'loose',flowchart:{useMaxWidth:true,htmlLabels:true}});
              mermaid.render('mermaid-svg-'+Date.now()+'-'+idx, raw, function(svg){ el.innerHTML=svg; el.setAttribute('data-rendered','true'); });
            }catch(e){ el.innerHTML='<div style="color:#6366f1;font-family:monospace;font-size:12px;white-space:pre-wrap;">'+raw+'</div>'; }
          });
        }
      }catch(e){}
      // Measure after KaTeX + mermaid + hljs complete
      setTimeout(notifyHeight,150);
      setTimeout(notifyHeight,500);
      setTimeout(notifyHeight,1500);
      setTimeout(notifyHeight,3000);
    }
    function boot(){ renderAll(); }
    if(document.readyState==='loading'){ document.addEventListener('DOMContentLoaded',boot); } else { setTimeout(boot,40); }
    window.addEventListener('load',function(){
      setTimeout(notifyHeight,100);
      setTimeout(notifyHeight,500);
      setTimeout(notifyHeight,1500);
      setTimeout(notifyHeight,3000);
    });
    // MutationObserver: re-measure whenever KaTeX/mermaid inject DOM changes
    try {
      var _mutedObs=new MutationObserver(function(){ notifyHeight(); });
      _mutedObs.observe(document.body, {childList:true, subtree:true, attributes:true, characterData:true});
    } catch(_){}
    // Safety: keep re-measuring for 10 seconds in case KaTeX/mermaid CDN is slow
    var _rmCount=0;
    var _rmTimer=setInterval(function(){
      notifyHeight();
      if(++_rmCount>=40) { clearInterval(_rmTimer); try{_mutedObs&&_mutedObs.disconnect();}catch(_){} }
    },250);
    </script></body></html>
    """.trimIndent()
}

/** Compact WebView that renders a single formula with real KaTeX + auto-height. */
@Composable
private fun LatexFormulaWebView(
    math: String,
    textColorHex: String,
    onRenderError: (String) -> Unit
) {
    val density = LocalDensity.current
    val mainHandler = remember { Handler(Looper.getMainLooper()) }
    var heightPx by remember(math) { mutableStateOf(0) }
    val html = remember(math, textColorHex) { buildLatexHtml(math, textColorHex) }
    AndroidView(
        factory = { ctx ->
            WebView(ctx).apply {
                settings.javaScriptEnabled = true
                settings.domStorageEnabled = true
                setBackgroundColor(android.graphics.Color.TRANSPARENT)
                overScrollMode = View.OVER_SCROLL_NEVER
                isVerticalScrollBarEnabled = false
                isHorizontalScrollBarEnabled = false
                addJavascriptInterface(
                    object {
                        @JavascriptInterface
                        fun onHeight(px: Int) { mainHandler.post { heightPx = px } }

                        @JavascriptInterface
                        fun onError(msg: String) { mainHandler.post { onRenderError(msg.take(600)) } }

                        @JavascriptInterface
                        fun onRendered() { }
                    },
                    "AndroidBridge"
                )
                webViewClient = object : android.webkit.WebViewClient() {
                    @Suppress("DEPRECATION")
                    override fun shouldOverrideUrlLoading(view: WebView?, url: String?): Boolean =
                        openUrlExternally(view, url)
                }
                loadDataWithBaseURL("https://cdn.jsdelivr.net/", html, "text/html", "utf-8", null)
            }
        },
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = if (heightPx > 0) with(density) { heightPx.toDp() } else 80.dp, max = 4000.dp)
    )
}

/** Renders the full message (markdown) in a single KaTeX WebView with auto-height. */
@Composable
private fun MathMessageBlock(text: String, modifier: Modifier = Modifier) {
    val density = LocalDensity.current
    val mainHandler = remember { Handler(Looper.getMainLooper()) }
    var heightPx by remember(text) { mutableStateOf(0) }
    val onSurfaceColor = MaterialTheme.colorScheme.onSurface
    val surfaceColor = MaterialTheme.colorScheme.surface
    val onSurfaceHex = remember(onSurfaceColor) {
        String.format("#%06X", 0xFFFFFF and onSurfaceColor.toArgb())
    }
    val isDark = remember(surfaceColor) { surfaceColor.luminance() < 0.5f }
    val html = remember(text, onSurfaceHex, isDark) { buildMathMessageHtml(text, onSurfaceHex, isDark) }
    AndroidView(
        factory = { ctx ->
            WebView(ctx).apply {
                settings.javaScriptEnabled = true
                settings.domStorageEnabled = true
                setBackgroundColor(android.graphics.Color.TRANSPARENT)
                overScrollMode = View.OVER_SCROLL_NEVER
                // Keep scrollbar hidden but allow touch-scroll as fallback
                isVerticalScrollBarEnabled = false
                isHorizontalScrollBarEnabled = false
                addJavascriptInterface(
                    object {
                        @JavascriptInterface
                        fun onHeight(px: Int) { mainHandler.post { heightPx = px } }
                    },
                    "AndroidBridge"
                )
                webViewClient = object : android.webkit.WebViewClient() {
                    override fun shouldOverrideUrlLoading(
                        view: WebView?,
                        request: WebResourceRequest?
                    ): Boolean {
                        val url = request?.url?.toString() ?: return false
                        return openUrlExternally(view, url)
                    }

                    @Suppress("DEPRECATION")
                    override fun shouldOverrideUrlLoading(view: WebView?, url: String?): Boolean =
                        openUrlExternally(view, url)
                }
                loadDataWithBaseURL("https://cdn.jsdelivr.net/", html, "text/html", "utf-8", null)
            }
        },
        modifier = modifier
            .fillMaxWidth()
            .heightIn(min = if (heightPx > 0) with(density) { (heightPx + 8).toDp() } else 180.dp, max = 8000.dp)
    )
}

@Composable
private fun LaTeXMathBlock(latex: ChatBlock.LaTeXBlock) {
    var latexError by remember { mutableStateOf<String?>(null) }
    val onSurfaceColor = MaterialTheme.colorScheme.onSurface
    val onSurfaceHex = remember(onSurfaceColor) {
        String.format("#%06X", 0xFFFFFF and onSurfaceColor.toArgb())
    }
    Card(
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = tierTertiary().copy(alpha = 0.06f)),
        modifier = Modifier
            .fillMaxWidth()
            .border(1.dp, tierTertiary().copy(alpha = 0.2f), RoundedCornerShape(12.dp))
            .padding(vertical = 6.dp)
    ) {
        Column(modifier = Modifier.padding(horizontal = 16.dp, vertical = 6.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    imageVector = Icons.Default.Functions,
                    contentDescription = "LaTeX Formula",
                    tint = tierTertiary(),
                    modifier = Modifier.size(18.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "Math formula",
                    style = MaterialTheme.typography.labelSmall.copy(
                        fontWeight = FontWeight.Bold,
                        color = tierTertiary()
                    )
                )
            }
            Spacer(modifier = Modifier.height(4.dp))
            if (latexError != null) {
                Text(
                    text = latexError.orEmpty(),
                    style = MaterialTheme.typography.bodySmall.copy(color = MaterialTheme.colorScheme.error),
                    maxLines = 3,
                    overflow = TextOverflow.Ellipsis
                )
            } else {
                LatexFormulaWebView(
                    math = latex.math,
                    textColorHex = onSurfaceHex,
                    onRenderError = { latexError = it }
                )
            }
        }
    }
}

@Composable
private fun TaskItemBlock(
    item: ChatBlock.TaskItem,
    onCheckedChange: (Boolean) -> Unit
) {
    var checkedState by remember { mutableStateOf(item.checked) }
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .fillMaxWidth()
            .clickable {
                checkedState = !checkedState
                onCheckedChange(checkedState)
            }
            .padding(vertical = 2.dp)
    ) {
        Checkbox(
            checked = checkedState,
            onCheckedChange = {
                checkedState = it
                onCheckedChange(it)
            }
        )
        Spacer(modifier = Modifier.width(4.dp))
        Text(
            text = parseChatInlineFormatting(item.text),
            style = MaterialTheme.typography.bodyMedium.copy(
                textDecoration = if (checkedState) TextDecoration.LineThrough else TextDecoration.None,
                color = if (checkedState) MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f) else MaterialTheme.colorScheme.onSurface
            )
        )
    }
}

@Composable
private fun MarkdownTableBlock(table: ChatBlock.TableBlock) {
    val headerRow = table.rows.firstOrNull()
    val bodyRows = if (table.rows.size > 1) table.rows.drop(1) else emptyList()
    val allRows = listOfNotNull(headerRow) + bodyRows
    val colCount = allRows.maxOfOrNull { it.size }?.coerceAtLeast(1) ?: 1

    // Per-column width derived from the widest cell in that column: keeps columns aligned across
    // rows and lets wide tables scroll horizontally instead of overflowing the message bubble.
    // Fixed widths are required here — `weight` inside a `horizontalScroll` container crashes
    // with "Row children have non-zero weight, but the available max width is infinity".
    val colWidths = (0 until colCount).map { col ->
        val widest = allRows.maxOfOrNull { row -> row.getOrNull(col)?.length ?: 0 } ?: 0
        (widest * 8).dp.coerceIn(96.dp, 260.dp)
    }
    val totalWidth = colWidths.fold(0.dp) { acc, w -> acc + w }

    Card(
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp)
            .border(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.12f), RoundedCornerShape(12.dp))
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState())
        ) {
            // Header row
            if (headerRow != null) {
                Row(
                    modifier = Modifier
                        .width(totalWidth)
                        .background(MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.35f))
                        .padding(vertical = 10.dp, horizontal = 1.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    headerRow.forEachIndexed { colIdx, cell ->
                        Box(
                            modifier = Modifier
                                .width(colWidths.getOrElse(colIdx) { 120.dp })
                                .padding(horizontal = 10.dp, vertical = 2.dp)
                        ) {
                            Text(
                                text = parseChatInlineFormatting(cell),
                                style = MaterialTheme.typography.labelMedium.copy(
                                    fontWeight = FontWeight.ExtraBold,
                                    color = MaterialTheme.colorScheme.primary
                                ),
                                maxLines = 2,
                                overflow = TextOverflow.Ellipsis
                            )
                        }
                    }
                }
                // Header divider
                Box(
                    modifier = Modifier
                        .width(totalWidth)
                        .height(1.5.dp)
                        .background(MaterialTheme.colorScheme.primary.copy(alpha = 0.2f))
                )
            }

            // Body rows
            bodyRows.forEachIndexed { bodyIdx, row ->
                val bgColor = if (bodyIdx % 2 == 0) Color.Transparent
                    else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.18f)
                Row(
                    modifier = Modifier
                        .width(totalWidth)
                        .background(bgColor)
                        .padding(vertical = 8.dp, horizontal = 1.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    row.forEachIndexed { colIdx, cell ->
                        Box(
                            modifier = Modifier
                                .width(colWidths.getOrElse(colIdx) { 120.dp })
                                .padding(horizontal = 10.dp, vertical = 2.dp)
                        ) {
                            Text(
                                text = parseChatInlineFormatting(cell),
                                style = MaterialTheme.typography.bodyMedium,
                                maxLines = 4,
                                overflow = TextOverflow.Ellipsis
                            )
                        }
                    }
                }
                // Row divider
                if (bodyIdx < bodyRows.size - 1) {
                    Box(
                        modifier = Modifier
                            .width(totalWidth)
                            .height(0.5.dp)
                            .background(MaterialTheme.colorScheme.outline.copy(alpha = 0.08f))
                    )
                }
            }
        }
    }
}

@Composable
private fun MarkdownImageBlock(image: ChatBlock.ImageBlock) {
    Card(
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f)),
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp)
            .border(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.1f), RoundedCornerShape(12.dp))
    ) {
        Column(modifier = Modifier.padding(8.dp)) {
            SubcomposeAsyncImage(
                model = image.url,
                contentDescription = image.alt,
                loading = {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(200.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        CircularProgressIndicator(color = tierPrimary())
                    }
                },
                error = {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(200.dp)
                            .background(MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.2f)),
                        contentAlignment = Alignment.Center
                    ) {
                        Text("Couldn't load image", color = MaterialTheme.colorScheme.error)
                    }
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(8.dp))
            )
            if (image.alt.isNotBlank()) {
                Spacer(modifier = Modifier.height(6.dp))
                Text(
                    text = image.alt,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f),
                    modifier = Modifier.align(Alignment.CenterHorizontally)
                )
            }
        }
    }
}

// Inline formatting (bold, italic, inline code, inline latex, links)
// Colors are parameters because this helper runs outside composition (remember { } and
// non-composable callers); composable callers pass the tier colors in.
fun parseChatInlineFormatting(
    text: String,
    linkColor: Color = Color(0xFF4F46E5),
    mathColor: Color = Color(0xFF8B5CF6),
    codeColor: Color = Color(0xFF4F46E5)
): AnnotatedString {
    return buildAnnotatedString {
        var idx = 0
        while (idx < text.length) {
            val remaining = text.substring(idx)

            // 1. Link: [text](url)
            if (remaining.startsWith("[")) {
                val closeBracketIdx = remaining.indexOf("]")
                if (closeBracketIdx != -1 && remaining.substring(closeBracketIdx + 1).startsWith("(")) {
                    val openParenIdx = closeBracketIdx + 1
                    val closeParenIdx = remaining.indexOf(")", openParenIdx)
                    if (closeParenIdx != -1) {
                        val linkText = remaining.substring(1, closeBracketIdx)
                        val url = remaining.substring(openParenIdx + 1, closeParenIdx)
                        
                        pushStringAnnotation(tag = "URL", annotation = url)
                        withStyle(
                            SpanStyle(
                                color = linkColor,
                                textDecoration = TextDecoration.Underline,
                                fontWeight = FontWeight.Medium
                            )
                        ) {
                            append(linkText)
                        }
                        pop()
                        idx += closeParenIdx + 1
                        continue
                    }
                }
            }

            // 2. Inline LaTeX Math: $ ... $
            if (remaining.startsWith("$") && !remaining.startsWith("$$")) {
                val endIdx = remaining.indexOf("$", 1)
                if (endIdx != -1) {
                    val math = remaining.substring(1, endIdx)
                    withStyle(
                        SpanStyle(
                            fontStyle = FontStyle.Italic,
                            fontFamily = FontFamily.Serif,
                            color = mathColor,
                            background = mathColor.copy(alpha = 0.08f),
                            fontWeight = FontWeight.Medium
                        )
                    ) {
                        // Non-persisted / fallback contexts only: messages with
                        // inline math are fully rendered with real KaTeX via
                        // MathMessageBlock, so show the raw source here.
                        append(" $math ")
                    }
                    idx += endIdx + 1
                    continue
                }
            }

            // 3. Bold: ** ... **
            if (remaining.startsWith("**")) {
                val endIdx = remaining.indexOf("**", 2)
                if (endIdx != -1) {
                    val boldText = remaining.substring(2, endIdx)
                    withStyle(SpanStyle(fontWeight = FontWeight.Bold)) {
                        append(boldText)
                    }
                    idx += endIdx + 2
                    continue
                }
            }

            // 4. Italic: * ... *
            if (remaining.startsWith("*")) {
                val endIdx = remaining.indexOf("*", 1)
                if (endIdx != -1) {
                    val italicText = remaining.substring(1, endIdx)
                    withStyle(SpanStyle(fontStyle = FontStyle.Italic)) {
                        append(italicText)
                    }
                    idx += endIdx + 1
                    continue
                }
            }

            // 5. Inline Code: ` ... `
            if (remaining.startsWith("`")) {
                val endIdx = remaining.indexOf("`", 1)
                if (endIdx != -1) {
                    val codeText = remaining.substring(1, endIdx)
                    withStyle(
                        SpanStyle(
                            fontFamily = FontFamily.Monospace,
                            background = Color.LightGray.copy(alpha = 0.3f),
                            color = codeColor,
                            fontSize = 13.sp
                        )
                    ) {
                        append(codeText)
                    }
                    idx += endIdx + 1
                    continue
                }
            }

            append(remaining[0].toString())
            idx++
        }
    }
}

// Parser to split text into distinct ChatBlocks
fun parseChatMarkdownBlocks(text: String): List<ChatBlock> {
    val lines = text.split("\n")
    val blocks = mutableListOf<ChatBlock>()
    var i = 0

    while (i < lines.size) {
        val line = lines[i].trim()

        if (line.isEmpty()) {
            i++
            continue
        }

        // 1. Code Block / Diagrams / Slides / HTML
        if (line.startsWith("```")) {
            val lang = line.removePrefix("```").trim()
            val codeLines = mutableListOf<String>()
            i++
            while (i < lines.size && !lines[i].trim().startsWith("```")) {
                codeLines.add(lines[i])
                i++
            }
            if (i < lines.size) i++ // skip ending ```
            val fullCode = codeLines.joinToString("\n")
            val langLower = lang.lowercase()
            when {
                langLower == "mermaid" || langLower == "diagram" ||
                fullCode.contains("graph ") || fullCode.contains("flowchart ") ||
                fullCode.contains("sequenceDiagram") || fullCode.contains("mindmap") -> {
                    val diagramType = when {
                        fullCode.contains("mindmap") -> "Mindmap"
                        fullCode.contains("sequenceDiagram") -> "Sequence Diagram"
                        else -> "Flowchart"
                    }
                    blocks.add(ChatBlock.MermaidDiagram(fullCode, diagramType))
                }
                langLower == "slides" || langLower == "presentation" ||
                ((langLower == "json" || langLower.isEmpty()) && parseSlideJson(fullCode).isNotEmpty()) -> {
                    blocks.add(ChatBlock.SlidesBlock(fullCode))
                }
                langLower == "chartjs" || langLower == "chart" || langLower == "chart.js" ||
                langLower == "dot" || langLower == "graphviz" ||
                langLower == "threejs" || langLower == "three" || langLower == "3d" -> {
                    blocks.add(ChatBlock.DiagramBlock(lang, fullCode))
                }
                langLower == "html" || fullCode.trim().startsWith("<html>") || fullCode.trim().startsWith("<!DOCTYPE html>") -> {
                    blocks.add(ChatBlock.HtmlBlock(fullCode))
                }
                langLower == "latex" || langLower == "math" || langLower == "tex" || langLower == "katex" -> {
                    // ```latex / ```math fenced blocks — render as a math formula
                    // (readable Unicode) instead of a raw code block.
                    blocks.add(ChatBlock.LaTeXBlock(fullCode.trim()))
                }
                else -> {
                    blocks.add(ChatBlock.CodeBlock(lang, fullCode))
                }
            }
            continue
        }

        // 2. Task Checkbox Item (- [ ] or - [x])
        if (line.startsWith("- [ ]") || line.startsWith("- [x]") || line.startsWith("- [X]")) {
            val isChecked = line.startsWith("- [x]") || line.startsWith("- [X]")
            val taskText = line.drop(5).trim()
            blocks.add(ChatBlock.TaskItem(isChecked, taskText))
            i++
            continue
        }

        // 3. LaTeX Block Math (wrapped in $$)
        if (line.startsWith("$$")) {
            val mathLines = mutableListOf<String>()
            val initialMath = line.removePrefix("$$").trim()
            if (initialMath.isNotEmpty()) {
                if (initialMath.endsWith("$$")) {
                    blocks.add(ChatBlock.LaTeXBlock(initialMath.removeSuffix("$$").trim()))
                    i++
                    continue
                } else {
                    mathLines.add(initialMath)
                }
            }
            i++
            while (i < lines.size && !lines[i].trim().startsWith("$$")) {
                mathLines.add(lines[i])
                i++
            }
            if (i < lines.size) {
                val endLine = lines[i].trim().removeSuffix("$$").trim()
                if (endLine.isNotEmpty()) mathLines.add(endLine)
                i++
            }
            blocks.add(ChatBlock.LaTeXBlock(mathLines.joinToString("\n")))
            continue
        }

        // 4. Image Block
        if (line.startsWith("![") && line.contains("](")) {
            val match = IMAGE_REGEX.find(line)
            if (match != null) {
                blocks.add(ChatBlock.ImageBlock(alt = match.groupValues[1], url = match.groupValues[2]))
                i++
                continue
            }
        }

        // 5. Table parsing
        if (line.startsWith("|")) {
            val tableRows = mutableListOf<List<String>>()
            while (i < lines.size && lines[i].trim().startsWith("|")) {
                val currentLine = lines[i].trim()
                if (!currentLine.contains("[a-zA-Z0-9]".toRegex()) && currentLine.contains("-")) {
                    i++
                    continue
                }
                val cells = currentLine.split("|").map { it.trim() }.filterIndexed { index, _ ->
                    index > 0 && index < currentLine.split("|").size - 1
                }
                if (cells.isNotEmpty()) {
                    tableRows.add(cells)
                }
                i++
            }
            if (tableRows.isNotEmpty()) {
                blocks.add(ChatBlock.TableBlock(tableRows))
                continue
            }
        }

        // 6. Headers
        if (line.startsWith("#")) {
            val level = line.takeWhile { it == '#' }.length
            if (level in 1..6) {
                val headerText = line.drop(level).trim()
                blocks.add(ChatBlock.Header(level, headerText))
                i++
                continue
            }
        }

        // 7. Blockquotes
        if (line.startsWith(">")) {
            val quoteLines = mutableListOf<String>()
            while (i < lines.size && lines[i].trim().startsWith(">")) {
                quoteLines.add(lines[i].trim().removePrefix(">").trim())
                i++
            }
            blocks.add(ChatBlock.Blockquote(quoteLines.joinToString("\n")))
            continue
        }

        // 8. Lists (unordered)
        if (line.startsWith("- ") || line.startsWith("* ")) {
            val listItems = mutableListOf<String>()
            while (i < lines.size && (lines[i].trim().startsWith("- ") || lines[i].trim().startsWith("* "))) {
                listItems.add(lines[i].trim().drop(2).trim())
                i++
            }
            blocks.add(ChatBlock.ListBlock(ordered = false, items = listItems))
            continue
        }

        // 9. Lists (ordered)
        if (Regex("^\\d+\\.\\s").containsMatchIn(line)) {
            val listItems = mutableListOf<String>()
            while (i < lines.size && Regex("^\\d+\\.\\s").containsMatchIn(lines[i].trim())) {
                val dropPrefix = lines[i].trim().replaceFirst(Regex("^\\d+\\.\\s"), "")
                listItems.add(dropPrefix)
                i++
            }
            blocks.add(ChatBlock.ListBlock(ordered = true, items = listItems))
            continue
        }

        // 10. General Paragraph
        blocks.add(ChatBlock.Paragraph(line))
        i++
    }

    return blocks
}

data class DiagramNode(
    val id: String,
    val label: String,
    val targetId: String? = null,
    val stepIndex: Int = 1
)

fun parseDiagramNodes(code: String): List<DiagramNode> {
    val lines = code.split("\n")
    val nodes = mutableListOf<DiagramNode>()
    var step = 1

    lines.forEach { line ->
        val trimmed = line.trim()
        if (trimmed.isBlank() || trimmed.startsWith("graph") || trimmed.startsWith("flowchart") || trimmed.startsWith("sequenceDiagram") || trimmed.startsWith("mindmap") || trimmed.startsWith("subgraph")) {
            return@forEach
        }

        if (trimmed.contains("-->") || trimmed.contains("->")) {
            val parts = trimmed.split(Regex("-->|->"))
            if (parts.size >= 2) {
                val source = parts[0].trim().replace("[", " ").replace("]", "").replace("{", "").replace("}", "")
                val target = parts[1].trim().replace("[", " ").replace("]", "").replace("{", "").replace("}", "")
                if (nodes.none { it.label == source }) {
                    nodes.add(DiagramNode(id = "step_$step", label = source, targetId = target, stepIndex = step))
                    step++
                }
                if (nodes.none { it.label == target }) {
                    nodes.add(DiagramNode(id = "step_$step", label = target, targetId = null, stepIndex = step))
                    step++
                }
            }
        } else if (trimmed.startsWith("-") || trimmed.startsWith("*")) {
            val label = trimmed.drop(1).trim()
            if (label.isNotBlank()) {
                nodes.add(DiagramNode(id = "step_$step", label = label, stepIndex = step))
                step++
            }
        } else if (trimmed.contains(":") && !trimmed.startsWith("%%")) {
            val parts = trimmed.split(":")
            val label = parts.last().trim()
            if (label.isNotBlank()) {
                nodes.add(DiagramNode(id = "step_$step", label = label, stepIndex = step))
                step++
            }
        }
    }

    if (nodes.isEmpty()) {
        lines.filter { it.isNotBlank() && !it.startsWith("```") && !it.startsWith("graph") }.take(5).forEach { l ->
            nodes.add(DiagramNode(id = "step_$step", label = l.trim(), stepIndex = step))
            step++
        }
    }

    return nodes
}

@Composable
fun VisualDiagramGraph(nodes: List<DiagramNode>, diagramType: String) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(8.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        nodes.forEachIndexed { idx, node ->
            Card(
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(
                    containerColor = when (idx % 3) {
                        0 -> tierPrimary().copy(alpha = 0.12f)
                        1 -> tierAccent().copy(alpha = 0.12f)
                        else -> tierTertiary().copy(alpha = 0.12f)
                    }
                ),
                modifier = Modifier
                    .fillMaxWidth(0.95f)
                    .border(
                        1.dp,
                        when (idx % 3) {
                            0 -> tierPrimary().copy(alpha = 0.4f)
                            1 -> tierAccent().copy(alpha = 0.4f)
                            else -> tierTertiary().copy(alpha = 0.4f)
                        },
                        RoundedCornerShape(12.dp)
                    )
            ) {
                Row(
                    modifier = Modifier.padding(12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(
                        modifier = Modifier
                            .size(28.dp)
                            .clip(CircleShape)
                            .background(
                                when (idx % 3) {
                                    0 -> tierPrimary()
                                    1 -> tierAccent()
                                    else -> tierTertiary()
                                }
                            ),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = "${node.stepIndex}",
                            color = Color.White,
                            fontWeight = FontWeight.Bold,
                            fontSize = 12.sp
                        )
                    }
                    Spacer(modifier = Modifier.width(12.dp))
                    Text(
                        text = node.label,
                        style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.SemiBold),
                        modifier = Modifier.weight(1f)
                    )
                }
            }

            if (idx < nodes.size - 1) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.ArrowDownward,
                        contentDescription = "Flow direction",
                        tint = tierPrimary().copy(alpha = 0.6f),
                        modifier = Modifier.size(20.dp)
                    )
                }
            }
        }
    }
}
