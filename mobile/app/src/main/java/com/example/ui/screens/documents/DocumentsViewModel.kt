package com.example.ui.screens.documents

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.data.local.entities.DocumentEntity
import com.example.data.local.entities.DocumentFolderEntity
import com.example.data.repository.StuddyHubRepository
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch

data class DocumentsUiState(
    val documents: List<DocumentEntity> = emptyList(),
    val filteredDocuments: List<DocumentEntity> = emptyList(),
    val folders: List<DocumentFolderEntity> = emptyList(),
    val searchQuery: String = "",
    val selectedFilter: String = "All",
    val selectedFolderId: String? = null,
    val sortOrder: String = "Newest",
    val isUploading: Boolean = false,
    val isProcessing: Boolean = false,
    val userMessage: String? = null
)

private data class FilterParams(val query: String, val filter: String, val sort: String, val folderId: String?)
private data class StatusParams(val uploading: Boolean, val processing: Boolean, val userMessage: String?)

class DocumentsViewModel(private val repository: StuddyHubRepository) : ViewModel() {

    companion object {
        // One-shot guard: orphan cleanup is only safe to run once per process. Re-running it on
        // every ViewModel creation could delete a GENUINE in-flight scan (blank content, "OCR
        // Scan" title, newer than the 5-min cutoff) if the user navigates away and back while
        // the cloud OCR is still processing.
        private val orphanCleanupRan = java.util.concurrent.atomic.AtomicBoolean(false)
    }

    private val _isUploading = MutableStateFlow(false)
    private val _isProcessing = MutableStateFlow(false)
    private val _userMessage = MutableStateFlow<String?>(null)
    private val _searchQuery = MutableStateFlow("")
    private val _selectedFilter = MutableStateFlow("All")
    private val _selectedFolder = MutableStateFlow<String?>(null)
    private val _sortOrder = MutableStateFlow("Newest")

    init {
        // Remove the empty orphan "scan_" documents that pre-fix builds left behind (each was a
        // duplicate of a real OCR scan). Runs ONCE per process — repeated runs could delete a
        // genuine in-flight scan (see companion guard above).
        if (orphanCleanupRan.compareAndSet(false, true)) {
            viewModelScope.launch {
                try {
                    repository.cleanupOrphanScans()
                } catch (e: Exception) {
                    android.util.Log.w("DocumentsViewModel", "Orphan scan cleanup failed: ${e.message}")
                }
            }
        }
    }

    private val _filterParams = combine(_searchQuery, _selectedFilter, _sortOrder, _selectedFolder) { q, f, s, fol ->
        FilterParams(q, f, s, fol)
    }

    private val _statusParams = combine(_isUploading, _isProcessing, _userMessage) { u, p, m ->
        StatusParams(u, p, m)
    }

    val uiState: StateFlow<DocumentsUiState> = combine(
        repository.allDocuments,
        repository.allFolders,
        _filterParams,
        _statusParams
    ) { docs, folders, filters, status ->
        val query = filters.query
        val filter = filters.filter
        val sort = filters.sort
        val folderId = filters.folderId

        val filtered = docs.filter { doc ->
            val matchesSearch = query.isBlank() ||
                doc.title.contains(query, ignoreCase = true) ||
                doc.fileName.contains(query, ignoreCase = true) ||
                doc.contentExtracted.contains(query, ignoreCase = true)

            val matchesFilter = when (filter) {
                "PDF" -> doc.fileType.equals("pdf", ignoreCase = true)
                "Images" -> doc.fileType.contains("image", ignoreCase = true)
                "Docs" -> doc.fileType.lowercase() in setOf("docx", "doc", "txt")
                "Slides" -> doc.fileType.lowercase() in setOf("pptx", "ppt")
                "Sheets" -> doc.fileType.lowercase() in setOf("xlsx", "xls", "csv")
                "Web & URL" -> doc.fileType.equals("url", ignoreCase = true) || doc.fileName.startsWith("http")
                "Audio" -> doc.fileType.equals("mp3", ignoreCase = true) || doc.fileType.contains("audio", ignoreCase = true)
                "Video" -> doc.fileType.equals("mp4", ignoreCase = true) || doc.fileType.contains("video", ignoreCase = true)
                "Syllabus" -> doc.title.contains("syllabus", ignoreCase = true) || doc.fileName.contains("syllabus", ignoreCase = true)
                else -> true
            }
            val matchesFolder = folderId == null || doc.folderId == folderId
            matchesSearch && matchesFilter && matchesFolder
        }.let { list ->
            when (sort) {
                "Oldest" -> list.sortedBy { it.createdAt }
                "A-Z" -> list.sortedBy { it.title.lowercase() }
                "Size" -> list.sortedByDescending { it.fileSizeKb }
                else -> list.sortedByDescending { it.createdAt } // Newest
            }
        }

        DocumentsUiState(
            documents = docs,
            filteredDocuments = filtered,
            folders = folders,
            searchQuery = query,
            selectedFilter = filter,
            selectedFolderId = folderId,
            sortOrder = sort,
            isUploading = status.uploading,
            isProcessing = status.processing,
            userMessage = status.userMessage
        )
    }.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5000),
        initialValue = DocumentsUiState()
    )

    fun setSearchQuery(query: String) {
        _searchQuery.value = query
    }

    fun setSelectedFilter(filter: String) {
        _selectedFilter.value = filter
    }

    fun setSortOrder(sort: String) {
        _sortOrder.value = sort
    }

    fun setSelectedFolder(folderId: String?) {
        _selectedFolder.value = folderId
    }

    fun createFolder(name: String, color: String) {
        viewModelScope.launch {
            _isProcessing.value = true
            try {
                val folder = repository.createFolder(name, color)
                _userMessage.value = if (folder.syncStatus == "SYNCED") {
                    "Folder '${folder.name}' created!"
                } else {
                    "Folder created locally (will sync when you're online)."
                }
            } catch (e: Exception) {
                _userMessage.value = "We couldn't create that folder. Please try again."
            } finally {
                _isProcessing.value = false
            }
        }
    }

    fun deleteFolder(folderId: String) {
        viewModelScope.launch {
            _isProcessing.value = true
            try {
                repository.deleteFolder(folderId)
                if (_selectedFolder.value == folderId) _selectedFolder.value = null
                _userMessage.value = "Folder deleted."
            } catch (e: Exception) {
                _userMessage.value = "We couldn't delete that folder. Please try again."
            } finally {
                _isProcessing.value = false
            }
        }
    }

    fun moveDocumentToFolder(documentId: String, folderId: String?) {
        viewModelScope.launch {
            try {
                repository.moveDocumentToFolder(documentId, folderId)
            } catch (e: Exception) {
                android.util.Log.w("DocumentsViewModel", "Move to folder failed: ${e.message}")
            }
        }
    }

    /**
     * Imports a pasted link (PDF, image, video, Office file or webpage) through the cloud:
     * fetch-web-url validates accessibility + safety, downloads the content server-side and
     * pushes it through the same document-processor pipeline as a normal upload. The finished
     * row (with content_extracted) is then mirrored locally under the same cloud id.
     */
    fun importWebDocument(url: String, customTitle: String) {
        viewModelScope.launch {
            _isUploading.value = true
            try {
                val title = customTitle.ifBlank { "Web Article: ${url.substringAfter("://").take(30)}" }
                val userId = repository.getOrRestoreActiveUserId()

                val res = com.example.data.remote.BackendApiService.importWebUrl(
                    userId = userId,
                    url = url,
                    title = title
                )
                val success = res as? com.example.data.remote.BackendResult.Success
                if (success == null) {
                    _userMessage.value = (res as? com.example.data.remote.BackendResult.Error)?.message
                        ?: "The link could not be imported."
                    return@launch
                }

                val doc = success.data
                val cloudId = doc.optString("id")
                val fileName = doc.optString("file_name").ifBlank { "web_article_${System.currentTimeMillis()}.url" }
                val parsedContent = doc.optString("content_extracted", "")
                val fileSizeBytes = doc.optLong("file_size", 0L)
                val fileType = mapCloudTypeToLocalType(
                    doc.optString("type", ""),
                    doc.optString("file_type", ""),
                    fileName
                )

                val createdDoc = repository.addDocument(
                    title = title,
                    fileName = fileName,
                    fileType = fileType,
                    fileSizeKb = (fileSizeBytes / 1024L).toInt().coerceAtLeast(1),
                    content = parsedContent,
                    id = cloudId.ifBlank { java.util.UUID.randomUUID().toString() },
                    markSynced = cloudId.isNotBlank()
                )

                if (parsedContent.isNotBlank()) {
                    try {
                        repository.generateNoteFromDocument(title, parsedContent, documentId = createdDoc.id)
                        repository.generateFlashcardsFromDocument(title, parsedContent)
                    } catch (e: Exception) {
                        android.util.Log.w("DocumentsViewModel", "Auto summary error: ${e.message}")
                    }
                }

                _userMessage.value = "Imported '$title' to your documents."
            } catch (e: Exception) {
                android.util.Log.w("DocumentsViewModel", "Web import failed: ${e.message}")
                _userMessage.value = "We couldn't import that link. Please check it and try again."
            } finally {
                _isUploading.value = false
            }
        }
    }

    /**
     * Maps the pipeline's type label (and MIME) to the simple fileType used by the local
     * documents UI (pdf / image / url / txt / docx / pptx / xlsx / mp4 / mp3).
     */
    private fun mapCloudTypeToLocalType(type: String, mime: String, fileName: String): String {
        val t = type.lowercase()
        return when {
            t == "html" -> "url"
            t == "image" -> "image"
            t == "text" || t == "markdown" -> "txt"
            t == "document" -> "docx"
            t == "spreadsheet" -> "xlsx"
            t == "presentation" -> "pptx"
            t == "video" -> "mp4"
            t == "audio" -> "mp3"
            t == "pdf" -> "pdf"
            mime.contains("pdf", ignoreCase = true) -> "pdf"
            mime.contains("image", ignoreCase = true) -> "image"
            mime.contains("html", ignoreCase = true) -> "url"
            fileName.endsWith(".pdf", ignoreCase = true) -> "pdf"
            fileName.endsWith(".png", ignoreCase = true) || fileName.endsWith(".jpg", ignoreCase = true) ||
                fileName.endsWith(".jpeg", ignoreCase = true) -> "image"
            else -> "pdf"
        }
    }

    /**
     * Extracts readable text from a binary document (PDF, image, Office file) by sending the file
     * itself to Gemini. Never scrape text out of the bytes locally — that produces PDF object
     * streams the model then refuses as "raw PDF format".
     */
    fun extractDocumentText(
        base64Data: String,
        mimeType: String,
        fileName: String,
        onResult: (String) -> Unit
    ) {
        viewModelScope.launch {
            _isUploading.value = true
            try {
                val prompt = "Extract ALL readable content from this document verbatim: every heading, " +
                    "paragraph, list, table, formula, and caption, in reading order. Preserve structure as " +
                    "Markdown. Do not summarise, paraphrase, or add commentary about the file format."
                val extracted = com.example.data.remote.GeminiApiService.analyzeFile(base64Data, mimeType, prompt)
                if (extracted.isNotBlank() && !com.example.util.DocumentTextCleaner.looksLikeBinary(extracted)) {
                    onResult(extracted.trim())
                } else {
                    onResult("")
                    _userMessage.value = "We couldn't read text from '$fileName'. You can still upload it and add notes manually."
                }
            } catch (e: Exception) {
                android.util.Log.w("DocumentsViewModel", "Document extraction failed: ${e.message}")
                onResult("")
                _userMessage.value = "We couldn't read text from '$fileName'. Please try again."
            } finally {
                _isUploading.value = false
            }
        }
    }

    // Cloud-side OCR: the picked image is uploaded through document-processor (vision_analysis)
    // and the extracted text comes back from the server. This doc id is remembered so that when
    // the user confirms the scan, the local row reuses it instead of creating a duplicate. The
    // original image bytes are kept too so the saved document gets a real local thumbnail.
    private var pendingCloudScanDocId: String? = null
    private var pendingCloudScanBytes: ByteArray? = null
    private var pendingCloudScanFileName: String? = null

    /**
     * Runs OCR on an image through the cloud pipeline (document-processor vision_analysis)
     * instead of on-device Gemini. The extracted text is delivered via [onResult]; the cloud
     * document id is kept in [pendingCloudScanDocId] for [importScannedDocument].
     */
    fun processImageOCR(base64Image: String, mimeType: String = "image/jpeg", onResult: (String) -> Unit) {
        viewModelScope.launch {
            _isUploading.value = true
            pendingCloudScanDocId = null
            try {
                val bytes = try {
                    android.util.Base64.decode(base64Image, android.util.Base64.NO_WRAP)
                } catch (e: Exception) {
                    ByteArray(0)
                }
                if (bytes.isEmpty()) {
                    onResult("")
                    _userMessage.value = "We couldn't read that image. Please try again."
                    return@launch
                }

                val userId = repository.getOrRestoreActiveUserId()
                val ext = when {
                    mimeType.contains("png", ignoreCase = true) -> "png"
                    mimeType.contains("webp", ignoreCase = true) -> "webp"
                    else -> "jpg"
                }
                val scanTitle = "OCR Scan ${System.currentTimeMillis().toString().takeLast(6)}"
                val scanFileName = "scan_${System.currentTimeMillis()}.$ext"
                // Keep the original bytes + name so the saved document gets a real local image
                // thumbnail (the cloud file_url alone may not be publicly readable everywhere).
                pendingCloudScanBytes = bytes
                pendingCloudScanFileName = scanFileName
                // One stable id for the whole scan lifecycle. createDocument seeds the cloud row
                // under this id and document-processor updates that same row in place (idToUpdate),
                // so extraction, the realtime-synced copy, the save mirror and the cancel cleanup
                // all reference ONE document. Without an id the seed insert created an empty orphan
                // row AND document-processor inserted a second row — every OCR import appeared
                // twice in the documents list.
                val scanDocId = java.util.UUID.randomUUID().toString()
                pendingCloudScanDocId = scanDocId
                val res = com.example.data.remote.BackendApiService.createDocument(
                    userId = userId,
                    title = scanTitle,
                    fileName = scanFileName,
                    fileType = "image",
                    fileSizeKb = (bytes.size / 1024).coerceAtLeast(1),
                    contentExtracted = "",
                    id = scanDocId,
                    rawBytes = bytes
                )

                if (res is com.example.data.remote.BackendResult.Success) {
                    val cloudId = res.data.optString("id").ifBlank { scanDocId }
                    pendingCloudScanDocId = cloudId
                    val serverText = res.data.optString("content_extracted", "")
                    if (serverText.isNotBlank() &&
                        !com.example.util.DocumentTextCleaner.looksLikeBinary(serverText)
                    ) {
                        onResult(serverText.trim())
                    } else {
                        onResult("")
                        _userMessage.value = "No text could be read from that image."
                    }
                } else {
                    // The cloud row was not created (upload/storage failure) — drop the id so a
                    // later Save falls back to the normal local-create + sync path instead of
                    // mirroring a non-existent row as SYNCED.
                    pendingCloudScanDocId = null
                    onResult("")
                    _userMessage.value = (res as? com.example.data.remote.BackendResult.Error)?.message
                        ?: "We couldn't read the text from this image."
                }
            } catch (e: Exception) {
                android.util.Log.w("DocumentsViewModel", "Cloud OCR failed: ${e.message}")
                // Keep pendingCloudScanDocId here (unlike the Error branch): an exception can strike
                // after the row was already seeded, so cancel must still be able to delete it. The
                // rare "exception before the row existed" case only risks an empty SYNCED mirror.
                onResult("")
                _userMessage.value = "We couldn't read the text from this image. Please try again."
            } finally {
                _isUploading.value = false
            }
        }
    }

    /**
     * Drops the pending cloud OCR document if the user cancels the scan dialog, so a discarded
     * capture doesn't leave an orphan row in the cloud.
     */
    fun cancelPendingCloudScan() {
        val cloudId = pendingCloudScanDocId
        pendingCloudScanDocId = null
        pendingCloudScanBytes = null
        pendingCloudScanFileName = null
        if (cloudId != null) {
            viewModelScope.launch {
                try {
                    com.example.data.remote.BackendApiService.deleteDocument(cloudId)
                } catch (e: Exception) {
                    android.util.Log.w("DocumentsViewModel", "Couldn't delete cancelled scan $cloudId: ${e.message}")
                }
            }
        }
    }

    /**
     * Saves the confirmed scan. When the OCR image was already uploaded through the cloud
     * ([pendingCloudScanDocId] set), the local row mirrors that same id (markSynced) and the
     * user's edited title/text are pushed back to the cloud row.
     */
    fun importScannedDocument(title: String, extractedText: String) {
        viewModelScope.launch {
            _isUploading.value = true
            try {
                val docTitle = title.ifBlank { "OCR Scan Document" }
                val cloudId = pendingCloudScanDocId
                val imageBytes = pendingCloudScanBytes
                val imageFileName = pendingCloudScanFileName
                pendingCloudScanDocId = null
                pendingCloudScanBytes = null
                pendingCloudScanFileName = null

                val content = if (extractedText.isNotBlank()) extractedText else {
                    when (val r = com.example.data.remote.BackendApiService.transformNote(
                        content = "Topic: $docTitle",
                        operation = "custom",
                        customInstruction = "Generate highly detailed study notes and key points on this topic."
                    )) { is com.example.data.remote.BackendResult.Success -> r.data else -> "" }
                }

                val createdDoc = repository.addDocument(
                    title = docTitle,
                    fileName = imageFileName ?: "scan_${System.currentTimeMillis()}.png",
                    fileType = "image",
                    fileSizeKb = (content.length / 10).coerceAtLeast(100),
                    content = content,
                    id = cloudId ?: java.util.UUID.randomUUID().toString(),
                    markSynced = cloudId != null,
                    rawBytes = imageBytes
                )

                // Keep the cloud copy in sync with what the user kept after review.
                if (cloudId != null) {
                    try {
                        com.example.data.remote.BackendApiService.updateDocumentContentBackend(
                            documentId = cloudId,
                            title = docTitle,
                            content = content
                        )
                    } catch (e: Exception) {
                        android.util.Log.w("DocumentsViewModel", "Cloud scan title/content update failed: ${e.message}")
                    }
                }

                try {
                    repository.generateNoteFromDocument(docTitle, content, documentId = createdDoc.id)
                    repository.generateFlashcardsFromDocument(docTitle, content)
                } catch (e: Exception) {
                    android.util.Log.w("DocumentsViewModel", "Auto summary error: ${e.message}")
                }

                _userMessage.value = "Scan saved as '$docTitle'."
            } catch (e: Exception) {
                _userMessage.value = "We couldn't save that scan. Please try again."
            } finally {
                _isUploading.value = false
            }
        }
    }

    fun uploadDocument(title: String, fileName: String, fileType: String, fileSizeKb: Int, content: String, rawBytes: ByteArray? = null) {
        uploadDocumentAndProcess(title, fileName, fileType, fileSizeKb, content, autoExtractSummary = false, rawBytes = rawBytes)
    }

    fun uploadDocumentAndProcess(
        title: String,
        fileName: String,
        fileType: String,
        fileSizeKb: Int,
        content: String,
        autoExtractSummary: Boolean = true,
        rawBytes: ByteArray? = null,
        category: String? = null,
        onSuccess: () -> Unit = {}
    ) {
        viewModelScope.launch {
            _isUploading.value = true
            try {
                val finalTitle = title.ifBlank { fileName.substringBeforeLast(".") }
                
                // 1. Process document content via Gemini AI if content is provided
                var aiSuccess = false
                val safeContent = if (com.example.util.DocumentTextCleaner.looksLikeBinary(content)) "" else content
                val processedText = if (safeContent.isNotBlank() && safeContent.length > 20) {
                    try {
                        val result = when (val r = com.example.data.remote.BackendApiService.transformNote(
                            content = safeContent,
                            operation = "custom",
                            customInstruction = "Parse and structure this into comprehensive study material with clear section headings, core concepts, key definitions, and bulleted takeaways for document: $finalTitle"
                        )) { is com.example.data.remote.BackendResult.Success -> r.data else -> "" }
                        if (result.isNotBlank()) {
                            aiSuccess = true
                            result
                        } else {
                            safeContent
                        }
                    } catch (e: Exception) {
                        safeContent
                    }
                } else {
                    safeContent
                }

                // 1b. Resolve the chosen category into a document folder so the upload
                // lands organized (create-or-reuse a folder with that name).
                val resolvedFolderId = if (!category.isNullOrBlank()) {
                    val trimmed = category.trim()
                    repository.findOrCreateFolderByName(trimmed)?.id
                } else {
                    null
                }

                // 2. Persist to local Room DB AND push to Supabase DB immediately
                val createdDoc = repository.addDocument(
                    title = finalTitle,
                    fileName = fileName,
                    fileType = fileType.lowercase(),
                    fileSizeKb = fileSizeKb.coerceAtLeast(10),
                    content = processedText,
                    rawBytes = rawBytes,
                    folderId = resolvedFolderId
                )

                // 2b. Push to cloud right away so the folder_id is preserved and the
                // document-processor edge function can extract content server-side.
                // Without this, the async sync would lose the folder assignment and
                // return empty content until the next pull cycle.
                try {
                    val userId = com.example.data.remote.BackendApiService.currentUserId ?: ""
                    if (userId.isNotBlank()) {
                        val cloudResult = com.example.data.remote.BackendApiService.createDocument(
                            userId = userId,
                            title = finalTitle,
                            fileName = fileName,
                            fileType = fileType.lowercase(),
                            fileSizeKb = fileSizeKb.coerceAtLeast(10),
                            contentExtracted = processedText,
                            id = createdDoc.id,
                            rawBytes = rawBytes,
                            folderId = resolvedFolderId
                        )
                        if (cloudResult is com.example.data.remote.BackendResult.Success) {
                            val cloudContent = cloudResult.data.optString("content_extracted", "").ifBlank {
                                cloudResult.data.optString("extractedText", "")
                            }
                            val cloudUrl = cloudResult.data.optString("file_url", "").ifBlank {
                                cloudResult.data.optString("fileUrl", "")
                            }
                            // Update local doc with cloud-extracted content if richer than local
                            if (cloudContent.isNotBlank() && (processedText.isBlank() || cloudContent.length > processedText.length)) {
                                repository.updateDocumentContent(createdDoc.id, cloudContent)
                            }
                            if (cloudUrl.isNotBlank()) {
                                repository.updateDocumentUrl(createdDoc.id, cloudUrl)
                            }
                            // Mark synced so the async sync queue skips it
                            repository.markDocumentSynced(createdDoc.id)
                        }
                    }
                } catch (e: Exception) {
                    android.util.Log.w("DocumentsViewModel", "Cloud push failed, async sync will retry: ${e.message}")
                }

                // 3. Auto-extract summary note and flashcards if requested
                if (autoExtractSummary && aiSuccess) {
                    try {
                        repository.generateNoteFromDocument(finalTitle, processedText, documentId = createdDoc.id)
                        repository.generateFlashcardsFromDocument(finalTitle, processedText)
                    } catch (e: Exception) {
                        android.util.Log.w("DocumentsViewModel", "Error generating auto summary/cards: ${e.message}")
                    }
                }

                _userMessage.value = if (aiSuccess) {
                    "Document '$finalTitle' uploaded & AI study notes extracted!"
                } else {
                    "'$finalTitle' was saved, but the AI analysis didn't finish — tap 'Retry AI' to try again."
                }
                onSuccess()
            } catch (e: Exception) {
                _userMessage.value = "We couldn't upload this document. Please check your connection and try again."
            } finally {
                _isUploading.value = false
            }
        }
    }

    fun processAIFlowDocument(
        inputPromptOrText: String,
        onSuccess: (String) -> Unit = {}
    ) {
        viewModelScope.launch {
            _isUploading.value = true
            try {
                val sysPrompt = "You are Ollie, an expert academic document parsing assistant. Process the user's document text or topic. Extract a concise Document Title on the first line formatted as 'Title: <Title>', followed by comprehensive structured study notes, key terms, and summary points."
                val aiResponse = when (val r = com.example.data.remote.BackendApiService.transformNote(
                    content = inputPromptOrText,
                    operation = "custom",
                    customInstruction = sysPrompt
                )) { is com.example.data.remote.BackendResult.Success -> r.data else -> "" }

                val titleMatch = Regex("Title:\\s*(.+)").find(aiResponse)
                val extractedTitle = titleMatch?.groupValues?.get(1)?.trim() ?: inputPromptOrText.take(30).trim().ifBlank { "AI Document" }

                val cleanFileName = "${extractedTitle.lowercase().replace("[^a-z0-9]".toRegex(), "_")}.txt"

                val createdDoc = repository.addDocument(
                    title = extractedTitle,
                    fileName = cleanFileName,
                    fileType = "txt",
                    fileSizeKb = (aiResponse.length / 10).coerceAtLeast(25),
                    content = aiResponse
                )

                repository.generateNoteFromDocument(extractedTitle, aiResponse, documentId = createdDoc.id)

                _userMessage.value = "'$extractedTitle' is ready in your documents."
                onSuccess(aiResponse)
            } catch (e: Exception) {
                _userMessage.value = "We couldn't process that document. Please try again."
            } finally {
                _isUploading.value = false
            }
        }
    }

    fun deleteDocument(id: String) {
        viewModelScope.launch {
            try {
                repository.deleteDocument(id)
                _userMessage.value = "Document deleted."
            } catch (e: Exception) {
                _userMessage.value = "We couldn't delete this document. Please try again."
            }
        }
    }

    fun generateNote(doc: DocumentEntity) {
        viewModelScope.launch {
            _isProcessing.value = true
            try {
                repository.generateNoteFromDocument(doc.title, doc.contentExtracted, documentId = doc.id)
                _userMessage.value = "Summary Note generated! View it in the Notes tab."
            } catch (e: Exception) {
                _userMessage.value = "We couldn't create a note from this document. Please try again."
            } finally {
                _isProcessing.value = false
            }
        }
    }

    fun generateFlashcards(doc: DocumentEntity) {
        viewModelScope.launch {
            _isProcessing.value = true
            try {
                repository.generateFlashcardsFromDocument(doc.title, doc.contentExtracted)
                _userMessage.value = "Flashcard deck generated! View it in the Flashcards tab."
            } catch (e: Exception) {
                _userMessage.value = "We couldn't create flashcards from this document. Please try again."
            } finally {
                _isProcessing.value = false
            }
        }
    }

    fun generateQuiz(doc: DocumentEntity) {
        viewModelScope.launch {
            _isProcessing.value = true
            try {
                repository.generateQuizFromDocument(doc.title, doc.contentExtracted)
                _userMessage.value = "Practice Quiz generated! View it in the Quizzes tab."
            } catch (e: Exception) {
                _userMessage.value = "We couldn't create a quiz from this document. Please try again."
            } finally {
                _isProcessing.value = false
            }
        }
    }

    fun retryAIExtraction(doc: DocumentEntity) {
        viewModelScope.launch {
            _isProcessing.value = true
            try {
                val input = doc.contentExtracted.ifBlank { doc.title }
                val prompt = "You are StuddyHub's AI Academic Processor. Parse and structure the following raw text/document content into comprehensive study material with clear section headings, core concepts, key definitions, and bulleted takeaways.\n\nDocument Title: ${doc.title}\nContent:\n$input"
                val aiExtracted = when (val r = com.example.data.remote.BackendApiService.transformNote(
                    content = input,
                    operation = "custom",
                    customInstruction = "Parse and structure this raw text into comprehensive study material with clear section headings, core concepts, key definitions, and bulleted takeaways for document: ${doc.title}"
                )) { is com.example.data.remote.BackendResult.Success -> r.data else -> "" }
                if (aiExtracted.isNotBlank()) {
                    repository.updateDocumentContent(doc.id, aiExtracted)
                    _userMessage.value = "Document updated with AI insights."
                } else {
                    _userMessage.value = "The AI couldn't pull anything from this document. Please try again."
                }
            } catch (e: Exception) {
                _userMessage.value = "AI analysis didn't finish. Please try again in a moment."
            } finally {
                _isProcessing.value = false
            }
        }
    }

    fun clearUserMessage() {
        _userMessage.value = null
    }

    fun refreshDocuments() {
        viewModelScope.launch {
            _isProcessing.value = true
            try {
                repository.syncCloudDataToLocal()
                _userMessage.value = "Documents refreshed"
            } catch (e: Exception) {
                _userMessage.value = "We couldn't refresh your documents. Please try again."
            } finally {
                _isProcessing.value = false
            }
        }
    }
}
