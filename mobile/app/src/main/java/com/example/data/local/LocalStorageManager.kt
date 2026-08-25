package com.example.data.local

import android.content.Context
import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import java.io.FileOutputStream
import java.util.concurrent.TimeUnit

class LocalStorageManager private constructor(private val context: Context) {

    private val TAG = "LocalStorageManager"

    private val okHttpClient = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .build()

    // 100MB threshold as a named constant
    companion object {
        const val MAX_CACHE_SIZE_BYTES = 100 * 1024 * 1024L // 100MB

        @Volatile
        private var INSTANCE: LocalStorageManager? = null

        fun getInstance(context: Context): LocalStorageManager {
            return INSTANCE ?: synchronized(this) {
                val instance = LocalStorageManager(context.applicationContext)
                INSTANCE = instance
                instance
            }
        }
    }

    /**
     * Directory for transient cache files (subject to LRU eviction)
     */
    val cacheDir: File by lazy {
        File(context.cacheDir, "studdyhub_cache").apply {
            if (!exists()) mkdirs()
        }
    }

    /**
     * Directory for permanent offline user creations (saved until successfully synced)
     */
    val offlineDir: File by lazy {
        File(context.filesDir, "studdyhub_offline").apply {
            if (!exists()) mkdirs()
        }
    }

    /**
     * Caches a remote file from the URL to local private cache storage.
     * Implements LRU cache eviction after a successful download.
     */
    suspend fun cacheFileFromUrl(url: String): File? = withContext(Dispatchers.IO) {
        if (url.isBlank()) return@withContext null
        
        // Use hash of url as a safe unique file name (preserving extension if possible)
        val ext = url.substringAfterLast('.', "").substringBefore('?').substringBefore('#')
        val extensionSuffix = if (ext.isNotEmpty() && ext.length < 5) ".$ext" else ""
        val fileName = "cached_${url.hashCode()}$extensionSuffix"
        val targetFile = File(cacheDir, fileName)

        // If it's already cached, update lastModified to record access (LRU) and return it
        if (targetFile.exists()) {
            targetFile.setLastModified(System.currentTimeMillis())
            Log.d(TAG, "File already cached: ${targetFile.absolutePath}")
            return@withContext targetFile
        }

        Log.d(TAG, "Downloading file to cache from url: $url")
        try {
            val request = Request.Builder().url(url).build()
            val response = okHttpClient.newCall(request).execute()
            if (!response.isSuccessful) {
                Log.e(TAG, "Failed to download file: code=${response.code} url=$url")
                return@withContext null
            }

            val body = response.body ?: return@withContext null
            body.byteStream().use { input ->
                FileOutputStream(targetFile).use { output ->
                    input.copyTo(output)
                }
            }
            
            // Mark file as accessed/updated
            targetFile.setLastModified(System.currentTimeMillis())
            Log.d(TAG, "Successfully cached file: ${targetFile.absolutePath} (${targetFile.length()} bytes)")

            // Run LRU eviction on background
            evictOldCacheFiles()

            return@withContext targetFile
        } catch (e: Exception) {
            Log.e(TAG, "Error caching file from url: $url", e)
            if (targetFile.exists()) {
                targetFile.delete() // Cleanup partial download
            }
            return@withContext null
        }
    }

    /**
     * Saves a user-created local file (like a note attachment, document, recording)
     * to the secure private offline directory.
     */
    suspend fun saveToLocalPrivateStorage(fileName: String, bytes: ByteArray): File = withContext(Dispatchers.IO) {
        val file = File(offlineDir, fileName)
        FileOutputStream(file).use { out ->
            out.write(bytes)
        }
        Log.d(TAG, "Saved user file permanently to private offline storage: ${file.absolutePath} (${file.length()} bytes)")
        file
    }

    /**
     * Triggers LRU eviction on the cache directory.
     * Deletes the oldest-accessed files first until the total cache directory size
     * falls below the MAX_CACHE_SIZE_BYTES threshold.
     */
    fun evictOldCacheFiles() {
        try {
            val files = cacheDir.listFiles() ?: return
            var totalSize = files.sumOf { it.length() }
            
            if (totalSize <= MAX_CACHE_SIZE_BYTES) {
                return
            }

            Log.d(TAG, "Cache limit exceeded: ${totalSize / 1024 / 1024}MB > ${MAX_CACHE_SIZE_BYTES / 1024 / 1024}MB. Initiating LRU eviction.")

            // Sort files by lastModified ascending (oldest first)
            val sortedFiles = files.sortedBy { it.lastModified() }
            for (file in sortedFiles) {
                val fileSize = file.length()
                val deleted = file.delete()
                if (deleted) {
                    totalSize -= fileSize
                    Log.d(TAG, "Evicted cached file: ${file.name} (${fileSize} bytes)")
                }
                if (totalSize <= MAX_CACHE_SIZE_BYTES) {
                    Log.d(TAG, "Cache size reduced under threshold. Current size: ${totalSize / 1024 / 1024}MB.")
                    break
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error in LRU cache eviction", e)
        }
    }

    /**
     * Checks if a local private path exists.
     */
    fun isFilePresent(path: String?): Boolean {
        if (path.isNullOrBlank()) return false
        return try {
            File(path).exists()
        } catch (e: Exception) {
            false
        }
    }
}
