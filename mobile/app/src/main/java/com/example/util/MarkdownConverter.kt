package com.example.util

import com.vladsch.flexmark.ext.autolink.AutolinkExtension
import com.vladsch.flexmark.ext.gfm.strikethrough.StrikethroughExtension
import com.vladsch.flexmark.ext.gfm.tasklist.TaskListExtension
import com.vladsch.flexmark.ext.tables.TablesExtension
import com.vladsch.flexmark.html.HtmlRenderer
import com.vladsch.flexmark.html2md.converter.FlexmarkHtmlConverter
import com.vladsch.flexmark.parser.Parser
import com.vladsch.flexmark.util.data.MutableDataSet

object MarkdownConverter {
    private val options = MutableDataSet().apply {
        set(
            Parser.EXTENSIONS, listOf(
                TablesExtension.create(),
                StrikethroughExtension.create(),
                AutolinkExtension.create(),
                TaskListExtension.create()
            )
        )
        set(HtmlRenderer.SOFT_BREAK, "<br />\n")
    }

    private val parser = Parser.builder(options).build()
    private val renderer = HtmlRenderer.builder(options).build()
    private val htmlToMdConverter = FlexmarkHtmlConverter.builder(options).build()

    fun markdownToHtml(markdown: String): String {
        if (markdown.isBlank()) return ""
        
        // Convert diagram code fences (mermaid/diagram/dot/graphviz/chartjs) into
        // renderable wrapper elements. Fixed 2026-08-16:
        //  1. Accepts code on the SAME line as the fence (```mermaid graph TD ...) —
        //     the old regex required a newline after the fence, so AI output with the
        //     graph on the opening line never matched and rendered as raw code.
        //  2. Handles dot/graphviz and chartjs/chart/chart.js fences, not just mermaid.
        //  3. Newlines inside data-code are emitted as &#10; so the HTML parser does
        //     NOT flatten them to spaces (that made mermaid receive single-line code
        //     and fail, showing the raw code instead of the diagram).
        var processedMarkdown = markdown
        if (processedMarkdown.contains("```")) {
            processedMarkdown = processedMarkdown.replace(
                Regex("```(mermaid|diagram|dot|graphviz|chartjs|chart|chart\\.js)[ \\t]*[\\r\\n]*([\\s\\S]*?)```", RegexOption.IGNORE_CASE)
            ) { matchResult ->
                val lang = matchResult.groupValues[1].trim().lowercase()
                val diagramCode = matchResult.groupValues[2].trim()
                if (diagramCode.isBlank()) return@replace matchResult.value
                when {
                    lang == "dot" || lang == "graphviz" -> {
                        val escapedCode = diagramCode
                            .replace("&", "&amp;").replace("\"", "&quot;")
                            .replace("<", "&lt;").replace(">", "&gt;")
                            .replace("\n", "&#10;")
                        "\n<div class=\"diagram-box\"><div class=\"diagram-header\">🕸️ Graphviz DOT Diagram</div><pre class=\"dot\" data-code=\"$escapedCode\">$diagramCode</pre></div>\n"
                    }
                    lang == "chartjs" || lang == "chart" || lang == "chart.js" -> {
                        val escapedCode = diagramCode
                            .replace("&", "&amp;").replace("\"", "&quot;")
                            .replace("<", "&lt;").replace(">", "&gt;")
                            .replace("\n", "&#10;")
                        "\n<div class=\"diagram-box\"><div class=\"diagram-header\">📊 Chart.js Graph</div><div class=\"chartjs-container\"><canvas class=\"chartjs-canvas\" data-config=\"$escapedCode\"></canvas></div></div>\n"
                    }
                    else -> {
                        val escapedCode = diagramCode
                            .replace("&", "&amp;").replace("\"", "&quot;")
                            .replace("<", "&lt;").replace(">", "&gt;")
                            .replace("\n", "&#10;")
                        "\n<div class=\"diagram-box\"><div class=\"diagram-header\">📊 Mermaid Diagram</div><pre class=\"mermaid\" data-code=\"$escapedCode\">$diagramCode</pre></div>\n"
                    }
                }
            }
        }

        val document = parser.parse(processedMarkdown)
        return renderer.render(document)
    }

    fun htmlToMarkdown(html: String): String {
        if (html.isBlank()) return ""
        
        // Clean up diagram wrappers back to fenced syntax for markdown saving.
        // Handles mermaid, dot/graphviz, and chartjs wrappers (added 2026-08-16 so
        // DOT and chart diagrams survive save/reload instead of being mangled).
        var cleanedHtml = html
        if (cleanedHtml.contains("diagram-box")) {
            // mermaid / dot: <pre class="mermaid|dot" data-code="...">...</pre>
            cleanedHtml = cleanedHtml.replace(
                Regex("<div class=\"diagram-box\">[\\s\\S]*?<pre class=\"(mermaid|dot|graphviz)\"[^>]*data-code=\"([^\"]*)\"[\\s\\S]*?</pre></div>", RegexOption.IGNORE_CASE)
            ) { matchResult ->
                val lang = matchResult.groupValues[1]
                val rawCode = matchResult.groupValues[2]
                val unescapedCode = rawCode
                    .replace("&#10;", "\n")
                    .replace("&quot;", "\"").replace("&lt;", "<").replace("&gt;", ">").replace("&amp;", "&").trim()
                "<pre><code>```$lang\n$unescapedCode\n```</code></pre>"
            }
            cleanedHtml = cleanedHtml.replace(
                Regex("<div class=\"diagram-box\">[\\s\\S]*?<pre class=\"(mermaid|dot|graphviz)\"[^>]*>([\\s\\S]*?)</pre></div>", RegexOption.IGNORE_CASE)
            ) { matchResult ->
                val lang = matchResult.groupValues[1]
                val code = matchResult.groupValues[2].replace(Regex("<[^>]*>"), "").trim()
                "<pre><code>```$lang\n$code\n```</code></pre>"
            }
            // chartjs: <canvas class="chartjs-canvas" data-config="..."></canvas>
            cleanedHtml = cleanedHtml.replace(
                Regex("<div class=\"diagram-box\">[\\s\\S]*?<canvas class=\"chartjs-canvas\"[^>]*data-config=\"([^\"]*)\"[\\s\\S]*?</canvas>[\\s\\S]*?</div>", RegexOption.IGNORE_CASE)
            ) { matchResult ->
                val rawCode = matchResult.groupValues[1]
                val unescapedCode = rawCode
                    .replace("&#10;", "\n")
                    .replace("&quot;", "\"").replace("&lt;", "<").replace("&gt;", ">").replace("&amp;", "&").trim()
                "<pre><code>```chartjs\n$unescapedCode\n```</code></pre>"
            }
        }
        return htmlToMdConverter.convert(cleanedHtml)
    }
}

