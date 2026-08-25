package com.example.util

import android.content.Context
import android.content.Intent
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Typeface
import android.graphics.pdf.PdfDocument
import android.net.Uri
import android.os.Environment
import android.text.Layout
import android.text.StaticLayout
import android.text.TextPaint
import androidx.core.content.FileProvider
import java.io.File
import java.io.FileOutputStream
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

object DocumentExporter {

    enum class ExportFormat(val displayName: String, val extension: String, val mimeType: String, val iconResName: String) {
        PDF("PDF Document (.pdf)", "pdf", "application/pdf", "picture_as_pdf"),
        WORD("Microsoft Word (.docx)", "docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "description"),
        MARKDOWN("Markdown File (.md)", "md", "text/markdown", "code"),
        HTML("Web Page (.html)", "html", "text/html", "html"),
        TEXT("Plain Text (.txt)", "txt", "text/plain", "text_snippet")
    }

    /**
     * Export note content in requested format and launch share/download chooser intent
     */
    fun exportAndShare(
        context: Context,
        title: String,
        content: String,
        aiSummary: String = "",
        format: ExportFormat
    ): File? {
        val safeTitle = title.ifBlank { "Untitled Note" }
        val cleanFileName = safeTitle.replace(Regex("[^a-zA-Z0-9._-]"), "_")
        val cacheDir = File(context.cacheDir, "exports").apply { mkdirs() }
        val file = File(cacheDir, "${cleanFileName}_${System.currentTimeMillis()}.${format.extension}")

        return try {
            when (format) {
                ExportFormat.PDF -> generatePdf(context, safeTitle, content, aiSummary, file)
                ExportFormat.WORD -> generateDocx(safeTitle, content, aiSummary, file)
                ExportFormat.MARKDOWN -> generateMarkdown(safeTitle, content, aiSummary, file)
                ExportFormat.HTML -> generateHtml(safeTitle, content, aiSummary, file)
                ExportFormat.TEXT -> generateText(safeTitle, content, aiSummary, file)
            }

            // Share/Open File via Intent
            val uri: Uri = FileProvider.getUriForFile(
                context,
                "${context.packageName}.fileprovider",
                file
            )

            val intent = Intent(Intent.ACTION_SEND).apply {
                type = format.mimeType
                putExtra(Intent.EXTRA_SUBJECT, safeTitle)
                putExtra(Intent.EXTRA_TEXT, "Exported Note: $safeTitle")
                putExtra(Intent.EXTRA_STREAM, uri)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }

            val chooser = Intent.createChooser(intent, "Export $safeTitle as ${format.displayName}")
            chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(chooser)

            file
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    private fun generatePdf(context: Context, title: String, content: String, aiSummary: String, targetFile: File) {
        val pdfDocument = PdfDocument()

        // Page Specs: Standard A4 width = 595, height = 842 points
        val pageWidth = 595
        val pageHeight = 842
        val margin = 40
        val contentWidth = pageWidth - (margin * 2)

        var pageNumber = 1
        var pageInfo = PdfDocument.PageInfo.Builder(pageWidth, pageHeight, pageNumber).create()
        var page = pdfDocument.startPage(pageInfo)
        var canvas = page.canvas

        var currentY = margin.toFloat()

        // Header Paints
        val titlePaint = TextPaint().apply {
            isAntiAlias = true
            textSize = 22f
            color = Color.rgb(30, 41, 59) // Dark Slate
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
        }

        val metaPaint = TextPaint().apply {
            isAntiAlias = true
            textSize = 10f
            color = Color.rgb(100, 116, 139) // Slate Gray
        }

        val bodyPaint = TextPaint().apply {
            isAntiAlias = true
            textSize = 12f
            color = Color.rgb(51, 65, 85) // Dark Gray Body
        }

        val linePaint = Paint().apply {
            color = Color.rgb(203, 213, 225)
            strokeWidth = 1.5f
        }

        // Draw Document Header Title
        val titleLayout = StaticLayout.Builder.obtain(title, 0, title.length, titlePaint, contentWidth)
            .setAlignment(Layout.Alignment.ALIGN_NORMAL)
            .setLineSpacing(0f, 1.2f)
            .build()
        
        titleLayout.draw(canvas)
        currentY += titleLayout.height + 10f

        // Metadata Subtitle
        val timestamp = SimpleDateFormat("MMMM dd, yyyy · HH:mm", Locale.getDefault()).format(Date())
        canvas.drawText("Exported from StuddyHub AI Note Editor on $timestamp", margin.toFloat(), currentY, metaPaint)
        currentY += 18f

        // Top Accent Line
        canvas.drawLine(margin.toFloat(), currentY, (pageWidth - margin).toFloat(), currentY, linePaint)
        currentY += 18f

        // Draw AI Summary Callout Box if available
        if (aiSummary.isNotBlank()) {
            val summaryTitlePaint = TextPaint().apply {
                isAntiAlias = true
                textSize = 11f
                color = Color.rgb(79, 70, 229) // Indigo
                typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
            }
            val summaryTextPaint = TextPaint().apply {
                isAntiAlias = true
                textSize = 10.5f
                color = Color.rgb(55, 65, 81)
                typeface = Typeface.create(Typeface.DEFAULT, Typeface.ITALIC)
            }

            canvas.drawText("✨ AI Executive Summary:", margin.toFloat() + 10f, currentY + 14f, summaryTitlePaint)
            currentY += 22f

            val summaryLayout = StaticLayout.Builder.obtain(aiSummary, 0, aiSummary.length, summaryTextPaint, contentWidth - 20)
                .setAlignment(Layout.Alignment.ALIGN_NORMAL)
                .setLineSpacing(0f, 1.15f)
                .build()

            val bgPaint = Paint().apply {
                color = Color.rgb(238, 242, 255) // Soft Indigo Tint
            }
            canvas.drawRect(
                margin.toFloat(),
                currentY - 18f,
                (pageWidth - margin).toFloat(),
                currentY + summaryLayout.height + 12f,
                bgPaint
            )

            canvas.save()
            canvas.translate(margin.toFloat() + 10f, currentY)
            summaryLayout.draw(canvas)
            canvas.restore()

            currentY += summaryLayout.height + 24f
        }

        // Draw Document Body Lines & Handle Embedded Images/Tables
        val lines = content.split("\n")
        var i = 0
        while (i < lines.size) {
            val line = lines[i]

            // 1. Base64 Embedded Image Rendering in PDF
            if (line.contains("data:image/") && line.contains("base64,")) {
                try {
                    val base64Data = line.substringAfter("base64,").substringBefore(")").substringBefore("\"").trim()
                    val imageBytes = android.util.Base64.decode(base64Data, android.util.Base64.DEFAULT)
                    val bitmap = android.graphics.BitmapFactory.decodeByteArray(imageBytes, 0, imageBytes.size)
                    if (bitmap != null) {
                        val maxImgWidth = contentWidth.toFloat()
                        val scale = maxImgWidth / bitmap.width.toFloat()
                        val imgHeight = (bitmap.height * scale).coerceAtMost(300f)
                        val imgWidth = bitmap.width * scale

                        if (currentY + imgHeight > pageHeight - margin - 30) {
                            pdfDocument.finishPage(page)
                            pageNumber++
                            pageInfo = PdfDocument.PageInfo.Builder(pageWidth, pageHeight, pageNumber).create()
                            page = pdfDocument.startPage(pageInfo)
                            canvas = page.canvas
                            currentY = margin.toFloat()
                        }

                        val srcRect = android.graphics.Rect(0, 0, bitmap.width, bitmap.height)
                        val dstRect = android.graphics.RectF(margin.toFloat(), currentY, margin.toFloat() + imgWidth, currentY + imgHeight)
                        canvas.drawBitmap(bitmap, srcRect, dstRect, null)
                        currentY += imgHeight + 12f
                        i++
                        continue
                    }
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }

            // 2. Table row formatting in PDF
            if (line.trim().startsWith("|") && line.trim().endsWith("|")) {
                val cells = line.split("|").map { it.trim() }.filter { it.isNotEmpty() }
                // Ignore divider lines like |---|---|
                if (cells.none { cell -> cell.all { c -> c == '-' || c == ':' || c == ' ' } }) {
                    val colCount = cells.size.coerceAtLeast(1)
                    val colWidth = contentWidth.toFloat() / colCount
                    val rowHeight = 28f

                    if (currentY + rowHeight > pageHeight - margin - 30) {
                        pdfDocument.finishPage(page)
                        pageNumber++
                        pageInfo = PdfDocument.PageInfo.Builder(pageWidth, pageHeight, pageNumber).create()
                        page = pdfDocument.startPage(pageInfo)
                        canvas = page.canvas
                        currentY = margin.toFloat()
                    }

                    val borderPaint = android.graphics.Paint().apply {
                        color = android.graphics.Color.parseColor("#CBD5E1")
                        style = android.graphics.Paint.Style.STROKE
                        strokeWidth = 1f
                    }

                    for (c in 0 until colCount) {
                        val cellLeft = margin.toFloat() + (c * colWidth)
                        val cellRight = cellLeft + colWidth
                        val cellRect = android.graphics.RectF(cellLeft, currentY, cellRight, currentY + rowHeight)
                        canvas.drawRect(cellRect, borderPaint)

                        val cellText = cells.getOrNull(c) ?: ""
                        val textY = currentY + 18f
                        canvas.drawText(cellText.take(25), cellLeft + 6f, textY, bodyPaint)
                    }

                    currentY += rowHeight
                    i++
                    continue
                } else {
                    // Skip divider line
                    i++
                    continue
                }
            }

            // 3. Convert markdown formatting to rich Spanned text using Html.fromHtml
            val htmlLine = MarkdownConverter.markdownToHtml(line)
            val spannedText = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.N) {
                android.text.Html.fromHtml(htmlLine, android.text.Html.FROM_HTML_MODE_COMPACT)
            } else {
                @Suppress("DEPRECATION")
                android.text.Html.fromHtml(htmlLine)
            }

            val paragraphText = if (spannedText.isBlank()) " " else spannedText
            val layout = StaticLayout.Builder.obtain(paragraphText, 0, paragraphText.length, bodyPaint, contentWidth)
                .setAlignment(Layout.Alignment.ALIGN_NORMAL)
                .setLineSpacing(0f, 1.25f)
                .build()

            // Check if adding this paragraph exceeds page height
            if (currentY + layout.height > pageHeight - margin - 30) {
                // Finish current page and start a new one
                pdfDocument.finishPage(page)
                pageNumber++
                pageInfo = PdfDocument.PageInfo.Builder(pageWidth, pageHeight, pageNumber).create()
                page = pdfDocument.startPage(pageInfo)
                canvas = page.canvas
                currentY = margin.toFloat()
            }

            canvas.save()
            canvas.translate(margin.toFloat(), currentY)
            layout.draw(canvas)
            canvas.restore()

            currentY += layout.height + 6f
            i++
        }

        // Footer Page Number
        canvas.drawText("Page $pageNumber", (pageWidth / 2 - 20).toFloat(), (pageHeight - 20).toFloat(), metaPaint)

        pdfDocument.finishPage(page)

        FileOutputStream(targetFile).use { out ->
            pdfDocument.writeTo(out)
        }
        pdfDocument.close()
    }

    private fun generateDocx(title: String, content: String, aiSummary: String, targetFile: File) {
        val convertedBodyHtml = MarkdownConverter.markdownToHtml(content)

        val htmlContent = buildString {
            append("<!DOCTYPE html>\n")
            append("<html xmlns:w=\"urn:schemas-microsoft-com:office:word\">\n")
            append("<head>\n")
            append("<meta charset=\"utf-8\">\n")
            append("<title>${title.replace("<", "&lt;").replace(">", "&gt;")}</title>\n")
            append("<style>\n")
            append("body { font-family: 'Calibri', 'Segoe UI', Arial, sans-serif; font-size: 11pt; color: #1e293b; line-height: 1.6; margin: 40px; }\n")
            append("h1 { font-size: 22pt; color: #312e81; font-weight: bold; margin-bottom: 6px; }\n")
            append("h2 { font-size: 16pt; color: #4338ca; font-weight: bold; margin-top: 18px; margin-bottom: 6px; }\n")
            append("h3 { font-size: 13pt; color: #6366f1; font-weight: bold; margin-top: 14px; margin-bottom: 4px; }\n")
            append(".meta { font-size: 9pt; color: #64748b; border-bottom: 1px solid #cbd5e1; padding-bottom: 8px; margin-bottom: 20px; }\n")
            append(".ai-summary { background-color: #f0fdf4; border-left: 4px solid #10b981; padding: 12px; font-style: italic; margin-bottom: 20px; border-radius: 4px; }\n")
            append("p { margin-bottom: 8px; }\n")
            append("code { font-family: 'Consolas', 'Courier New', monospace; background-color: #f1f5f9; padding: 2px 4px; border-radius: 4px; }\n")
            append("pre { font-family: 'Consolas', 'Courier New', monospace; background-color: #0f172a; color: #f8fafc; padding: 12px; border-radius: 6px; overflow-x: auto; }\n")
            append("blockquote { border-left: 3px solid #6366f1; padding-left: 12px; color: #475569; font-style: italic; margin-left: 0; }\n")
            append("table { border-collapse: collapse; width: 100%; margin: 16px 0; border: 1px solid #cbd5e1; }\n")
            append("th, td { border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left; font-size: 10pt; }\n")
            append("th { background-color: #f1f5f9; font-weight: bold; color: #312e81; }\n")
            append("tr:nth-child(even) { background-color: #f8fafc; }\n")
            append("img { max-width: 100%; height: auto; border-radius: 8px; margin: 12px 0; display: block; }\n")
            append(".diagram-box { background: #eef2ff; border: 1px solid #c7d2fe; padding: 12px; border-radius: 8px; margin: 12px 0; }\n")
            append(".diagram-header { font-weight: bold; color: #4f46e5; margin-bottom: 6px; font-size: 10pt; }\n")
            append("</style>\n")
            append("</head>\n")
            append("<body>\n")
            append("<h1>${title.replace("<", "&lt;").replace(">", "&gt;")}</h1>\n")
            append("<div class=\"meta\">Exported from StuddyHub AI Note Editor</div>\n")

            if (aiSummary.isNotBlank()) {
                append("<div class=\"ai-summary\">\n")
                append("<strong>✨ AI Executive Summary:</strong><br/>\n")
                append(aiSummary.replace("\n", "<br/>"))
                append("\n</div>\n")
            }

            append(convertedBodyHtml)
            append("\n</body>\n</html>")
        }

        targetFile.writeText(htmlContent)
    }

    private fun generateMarkdown(title: String, content: String, aiSummary: String, targetFile: File) {
        val md = buildString {
            append("# $title\n\n")
            if (aiSummary.isNotBlank()) {
                append("> **✨ AI Executive Summary:**\n> $aiSummary\n\n---\n\n")
            }
            append(content)
        }
        targetFile.writeText(md)
    }

    private fun generateHtml(title: String, content: String, aiSummary: String, targetFile: File) {
        generateDocx(title, content, aiSummary, targetFile)
    }

    private fun generateText(title: String, content: String, aiSummary: String, targetFile: File) {
        val txt = buildString {
            append("TITLE: $title\n")
            append("=".repeat(title.length.coerceAtLeast(10)) + "\n\n")
            if (aiSummary.isNotBlank()) {
                append("AI SUMMARY:\n$aiSummary\n\n" + "-".repeat(40) + "\n\n")
            }
            append(content)
        }
        targetFile.writeText(txt)
    }
}
