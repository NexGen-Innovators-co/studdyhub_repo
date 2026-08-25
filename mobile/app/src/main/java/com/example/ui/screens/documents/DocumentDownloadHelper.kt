package com.example.ui.screens.documents

import android.app.DownloadManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Environment
import android.widget.Toast
import com.example.data.local.entities.DocumentEntity
import java.io.File

object DocumentDownloadHelper {
    fun downloadDocument(context: Context, doc: DocumentEntity) {
        val fileUrl = doc.fileUrl.trim()
        val rawFileName = doc.fileName.ifBlank { doc.title }
        val ext = doc.fileType.lowercase().ifBlank { "pdf" }
        val fileName = if (rawFileName.contains(".")) rawFileName else "$rawFileName.$ext"

        if (fileUrl.isNotBlank() && (fileUrl.startsWith("http://") || fileUrl.startsWith("https://"))) {
            try {
                val request = DownloadManager.Request(Uri.parse(fileUrl))
                    .setTitle(doc.title)
                    .setDescription("Downloading $fileName")
                    .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                    .setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, fileName)
                    .setAllowedOverMetered(true)
                    .setAllowedOverRoaming(true)

                val downloadManager = context.getSystemService(Context.DOWNLOAD_SERVICE) as? DownloadManager
                if (downloadManager != null) {
                    downloadManager.enqueue(request)
                    Toast.makeText(context, "Download started: $fileName", Toast.LENGTH_SHORT).show()
                } else {
                    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(fileUrl))
                    context.startActivity(intent)
                }
            } catch (e: Exception) {
                try {
                    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(fileUrl))
                    context.startActivity(intent)
                } catch (ex: Exception) {
                    Toast.makeText(context, "We couldn't open this file. Please try again.", Toast.LENGTH_SHORT).show()
                }
            }
        } else if (doc.contentExtracted.isNotBlank()) {
            try {
                val cleanName = rawFileName.replace("[^a-zA-Z0-9_.-]".toRegex(), "_")
                val textFileName = if (cleanName.endsWith(".txt")) cleanName else "$cleanName.txt"
                
                // Copy text content to Clipboard for convenience
                val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as? android.content.ClipboardManager
                if (clipboard != null) {
                    val clip = android.content.ClipData.newPlainText("Document Content", "${doc.title}\n\n${doc.contentExtracted}")
                    clipboard.setPrimaryClip(clip)
                }

                val publicDownloads = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
                val targetDir = if (publicDownloads.exists() || publicDownloads.mkdirs()) publicDownloads else (context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS) ?: context.filesDir)
                val file = File(targetDir, textFileName)
                file.writeText(doc.contentExtracted)
                
                Toast.makeText(context, "Saved to Downloads: ${file.name} (Text copied to clipboard)", Toast.LENGTH_LONG).show()
            } catch (e: Exception) {
                Toast.makeText(context, "Text copied to clipboard — we couldn't save the file. Please try again.", Toast.LENGTH_SHORT).show()
            }
        } else {
            Toast.makeText(context, "No file URL or text content available to download", Toast.LENGTH_SHORT).show()
        }
    }
}
