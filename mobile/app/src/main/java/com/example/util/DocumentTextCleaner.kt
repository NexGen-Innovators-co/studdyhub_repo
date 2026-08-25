package com.example.util

object DocumentTextCleaner {

    /** Extensions Gemini can read directly as inline data, so no local text scraping is needed. */
    private val NATIVE_MIME = mapOf(
        "pdf" to "application/pdf",
        "png" to "image/png",
        "jpg" to "image/jpeg",
        "jpeg" to "image/jpeg",
        "webp" to "image/webp",
        "gif" to "image/gif",
        "txt" to "text/plain",
        "md" to "text/plain",
        "csv" to "text/plain",
        "html" to "text/plain"
    )

    /** Returns the Gemini-supported MIME type for a file name, or null when it needs conversion. */
    fun nativeMimeTypeFor(fileName: String): String? =
        NATIVE_MIME[fileName.substringAfterLast('.', "").lowercase()]

    /** True when the stored text is binary/container noise rather than readable document text. */
    fun looksLikeBinary(rawText: String): Boolean {
        if (rawText.isBlank()) return false
        val lower = rawText.lowercase()
        if (rawText.contains("%PDF") || rawText.startsWith("PK") || lower.contains("flatedecode")) return true
        if (lower.contains("stream") && lower.contains("endstream")) return true
        if (lower.contains("obj") && lower.contains("endobj") && lower.contains("xref")) return true
        val sample = rawText.take(4000)
        if (sample.isEmpty()) return false
        val unreadable = sample.count { it.code == 0 || (it.code < 32 && it != '\n' && it != '\r' && it != '\t') || it.code == 0xFFFD }
        return unreadable * 100 / sample.length >= 5
    }

    /** File extensions whose bytes are readable as text without any parsing. */
    private val TEXTUAL_EXTENSIONS = setOf(
        "txt", "md", "markdown", "csv", "tsv", "json", "xml", "html", "htm", "log",
        "yml", "yaml", "kt", "java", "py", "js", "ts", "c", "cpp", "cs", "rs", "go", "sql"
    )

    /**
     * True when a file's bytes can be decoded as text directly. PDFs and the ZIP-backed Office
     * formats are compressed containers — decoding them as UTF-8 yields object-stream noise, so
     * they must be extracted server-side instead.
     */
    fun isTextualFile(fileName: String, mimeType: String? = null): Boolean {
        val ext = fileName.substringAfterLast('.', "").lowercase()
        if (ext in TEXTUAL_EXTENSIONS) return true
        if (ext.isNotBlank() && ext !in TEXTUAL_EXTENSIONS) return false
        // No usable extension: fall back to the content resolver's MIME type.
        val m = mimeType?.lowercase() ?: return false
        return m.startsWith("text/") || m == "application/json" || m == "application/xml"
    }

    /**
     * Sanitises text that is already readable. Returns "" when the input is a binary container
     * (PDF, docx, pptx, …) or when nothing readable remains.
     *
     * It must never invent placeholder prose, and never emit scraped binary fragments: both look
     * like real content to the note generator, which then writes a confident note about a document
     * it never actually read. Extracting text from binary formats is document-processor's job.
     */
    fun cleanPdfOrRawText(rawText: String, defaultTitle: String = "Document"): String {
        if (rawText.isBlank()) return ""

        val lower = rawText.lowercase()
        val isPdfOrBinary = rawText.contains("%PDF") ||
                rawText.startsWith("PK") ||
                lower.contains("flatedecode") ||
                (lower.contains("stream") && lower.contains("endstream")) ||
                (lower.contains("/type") && lower.contains("/pages")) ||
                (lower.contains("obj") && lower.contains("endobj") && lower.contains("xref"))

        // Regex-scraping a compressed container yields font names and object-stream fragments —
        // the "random characters" users see in the document list. Report nothing instead.
        if (isPdfOrBinary) return ""

        val sanitized = rawText.replace("\u0000", "").trim()
        // Even without container markers, a high share of control bytes means this was binary.
        return if (sanitized.isBlank() || looksLikeBinary(sanitized)) "" else sanitized
    }

    /**
     * Checks if a string returned from an AI model or edge function is an error/refusal message
     * about raw PDF formatting rather than actual note content.
     */
    fun isPdfRefusalError(response: String): Boolean {
        if (response.isBlank()) return true
        val l = response.lowercase()
        return l.contains("raw pdf") ||
                l.contains("raw format") ||
                l.contains("binary format") ||
                l.contains("unreadable format") ||
                l.contains("cannot process raw pdf") ||
                l.contains("cannot read pdf") ||
                l.contains("appears to be in a raw pdf") ||
                l.contains("file is in a raw pdf") ||
                l.contains("file is a raw pdf") ||
                (l.contains("pdf format") && l.contains("raw")) ||
                (l.contains("unparsed") && l.contains("pdf"))
    }
}
