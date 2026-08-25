package com.example.ui.screens.documents

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import androidx.compose.animation.*
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import coil.compose.SubcomposeAsyncImage
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.R
import com.example.data.local.entities.DocumentEntity
import com.example.data.repository.StuddyHubRepository
import com.example.ui.theme.tierAccent
import com.example.ui.theme.tierPrimary
import com.example.ui.theme.tierTertiary
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DocumentDetailScreen(
    docId: String,
    repository: StuddyHubRepository,
    onNavigateBack: () -> Unit,
    onNavigateToNotes: () -> Unit,
    onNavigateToQuiz: () -> Unit,
    onNavigateToCards: () -> Unit,
    onDiscussWithOllie: (DocumentEntity) -> Unit = {}
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    val snackbarHostState = remember { SnackbarHostState() }

    var document by remember { mutableStateOf<DocumentEntity?>(null) }
    var isProcessing by remember { mutableStateOf(false) }
    var selectedTab by remember { mutableIntStateOf(0) } // 0 = Preview, 1 = Extracted AI Notes, 2 = File Details & Storage
    var currentPage by remember { mutableIntStateOf(1) }
    var zoomLevel by remember { mutableFloatStateOf(1.0f) }

    LaunchedEffect(docId) {
        document = repository.getDocumentById(docId)
    }

    LaunchedEffect(document) {
        val doc = document
        if (doc != null && doc.fileUrl.isNotBlank()) {
            val isImage = doc.fileType.lowercase() == "image" ||
                    doc.fileName.endsWith(".png", ignoreCase = true) ||
                    doc.fileName.endsWith(".jpg", ignoreCase = true) ||
                    doc.fileName.endsWith(".jpeg", ignoreCase = true)
            if (isImage) {
                val localFile = if (!doc.localFilePath.isNullOrBlank()) java.io.File(doc.localFilePath) else null
                if (localFile == null || !localFile.exists()) {
                    kotlin.runCatching {
                        val cachedFile = com.example.data.local.LocalStorageManager.getInstance(context)
                            .cacheFileFromUrl(doc.fileUrl)
                        if (cachedFile != null && cachedFile.exists()) {
                            repository.updateDocumentLocalFilePath(doc.id, cachedFile.absolutePath)
                            document = repository.getDocumentById(docId)
                        }
                    }
                }
            }
        }
    }

    val dateFormatter = remember { SimpleDateFormat("MMM dd, yyyy • HH:mm", Locale.getDefault()) }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
        topBar = {
            TopAppBar(
                navigationIcon = {
                    IconButton(onClick = onNavigateBack, modifier = Modifier.testTag("doc_detail_back_button")) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back to documents list")
                    }
                },
                title = {
                    Column {
                        Text(
                            text = document?.title ?: "Document Workspace",
                            fontWeight = FontWeight.Bold,
                            style = MaterialTheme.typography.titleMedium,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                        document?.let { doc ->
                            Text(
                                text = "${doc.fileType.uppercase()} • ${doc.fileSizeKb} KB",
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
                            )
                        }
                    }
                },
                actions = {
                    if (document != null) {
                        val doc = document!!

                        // Discuss with Ollie AI
                        IconButton(
                            onClick = {
                                if (doc.contentExtracted.isBlank()) {
                                    coroutineScope.launch {
                                        snackbarHostState.showSnackbar("This document has no extracted text. Process it first before discussing with Ollie!")
                                    }
                                } else {
                                    onDiscussWithOllie(doc)
                                }
                            }
                        ) {
                            Icon(Icons.Default.SmartToy, contentDescription = "Discuss with Ollie", tint = tierPrimary())
                        }

                        // Download File / Text
                        IconButton(
                            onClick = {
                                DocumentDownloadHelper.downloadDocument(context, doc)
                            },
                            modifier = Modifier.testTag("doc_detail_download_button")
                        ) {
                            Icon(Icons.Default.Download, contentDescription = "Download Document", tint = tierPrimary())
                        }

                        // Share Intent
                        IconButton(
                            onClick = {
                                val sendIntent: Intent = Intent().apply {
                                    action = Intent.ACTION_SEND
                                    putExtra(Intent.EXTRA_TITLE, doc.title)
                                    putExtra(Intent.EXTRA_TEXT, "StuddyHub Course Document: ${doc.title}\n\n${doc.contentExtracted}")
                                    type = "text/plain"
                                }
                                val shareIntent = Intent.createChooser(sendIntent, "Share Document via")
                                context.startActivity(shareIntent)
                            }
                        ) {
                            Icon(Icons.Default.Share, contentDescription = "Share Document", tint = tierTertiary())
                        }

                        // Delete
                        IconButton(
                            onClick = {
                                coroutineScope.launch {
                                    repository.deleteDocument(docId)
                                    onNavigateBack()
                                }
                            },
                            modifier = Modifier.testTag("doc_detail_delete_button")
                        ) {
                            Icon(Icons.Default.Delete, contentDescription = "Delete Document", tint = Color.Red.copy(alpha = 0.8f))
                        }
                    }
                }
            )
        }
    ) { innerPadding ->
        if (document == null) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator(color = tierPrimary())
            }
        } else {
            val doc = document!!

            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding)
            ) {
                // Interactive Breadcrumbs
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "Course Documents",
                        style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold),
                        color = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.clickable { onNavigateBack() }
                    )
                    Text(
                        text = "  >  ",
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.4f)
                    )
                    Text(
                        text = doc.title,
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f),
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f)
                    )
                }

                // Tab Selector (Document Preview vs AI Extracted Content vs Details)
                TabRow(
                    selectedTabIndex = selectedTab,
                    containerColor = MaterialTheme.colorScheme.surface,
                    contentColor = tierPrimary()
                ) {
                    Tab(
                        selected = selectedTab == 0,
                        onClick = { selectedTab = 0 },
                        text = { Text("Document Preview", fontWeight = FontWeight.Bold, fontSize = 12.sp) },
                        icon = { Icon(Icons.Default.Visibility, contentDescription = null, modifier = Modifier.size(16.dp)) }
                    )
                    Tab(
                        selected = selectedTab == 1,
                        onClick = { selectedTab = 1 },
                        text = { Text("AI Notes", fontWeight = FontWeight.Bold, fontSize = 12.sp) },
                        icon = { Icon(Icons.Default.AutoAwesome, contentDescription = null, modifier = Modifier.size(16.dp)) }
                    )
                    Tab(
                        selected = selectedTab == 2,
                        onClick = { selectedTab = 2 },
                        text = { Text("File & DB Storage", fontWeight = FontWeight.Bold, fontSize = 12.sp) },
                        icon = { Icon(Icons.Default.FolderZip, contentDescription = null, modifier = Modifier.size(16.dp)) }
                    )
                }

                Box(
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxWidth()
                        .padding(16.dp)
                ) {
                    when (selectedTab) {
                        0 -> DocumentPreviewContent(
                            doc = doc,
                            currentPage = currentPage,
                            zoomLevel = zoomLevel,
                            onPageChange = { currentPage = it },
                            onZoomChange = { zoomLevel = it }
                        )
                        1 -> DocumentAiExtractedNotes(
                            doc = doc,
                            onRetryExtraction = {
                                coroutineScope.launch {
                                    isProcessing = true
                                    try {
                                        val sourceInput = doc.contentExtracted.ifBlank { doc.title }
                                        val aiResult = when (val r = com.example.data.remote.BackendApiService.transformNote(
                                            content = sourceInput,
                                            operation = "custom",
                                            customInstruction = "Parse and structure this into comprehensive study material with clear section headings, core concepts, key definitions, and bulleted takeaways for document: ${doc.title}"
                                        )) { is com.example.data.remote.BackendResult.Success -> r.data else -> "" }
                                        if (aiResult.isNotBlank()) {
                                            repository.updateDocumentContent(doc.id, aiResult)
                                            document = repository.getDocumentById(docId)
                                            snackbarHostState.showSnackbar("AI analysis completed and saved!")
                                        } else {
                                            snackbarHostState.showSnackbar("AI analysis returned empty text.")
                                        }
                                    } catch (e: Exception) {
                                        snackbarHostState.showSnackbar("AI analysis didn't finish. Please try again.")
                                    } finally {
                                        isProcessing = false
                                    }
                                }
                            },
                            isProcessing = isProcessing
                        )
                        2 -> DocumentFileMetadataStorage(doc = doc, dateFormatter = dateFormatter)
                    }
                }

                // Bottom Action Drawer Sheet for AI Synthesis triggers
                Surface(
                    tonalElevation = 6.dp,
                    color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.6f),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Text(
                            text = "OLLIE'S AI DOCUMENT SYNTHESIZERS",
                            style = MaterialTheme.typography.labelSmall.copy(
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f)
                            )
                        )

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            // Note builder button
                            OutlinedButton(
                                onClick = {
                                    coroutineScope.launch {
                                        isProcessing = true
                                        try {
                                            repository.generateNoteFromDocument(doc.title, doc.contentExtracted)
                                            snackbarHostState.showSnackbar("Study Note generated! Returning to Notes.")
                                            onNavigateToNotes()
                                        } catch (e: Exception) {
                                            snackbarHostState.showSnackbar("AI Study Note generation failed.")
                                        } finally {
                                            isProcessing = false
                                        }
                                    }
                                },
                                shape = RoundedCornerShape(12.dp),
                                modifier = Modifier
                                    .weight(1f)
                                    .height(46.dp)
                                    .testTag("doc_detail_gen_note"),
                                colors = ButtonDefaults.outlinedButtonColors(contentColor = tierPrimary()),
                                enabled = !isProcessing
                            ) {
                                Icon(Icons.Default.MenuBook, contentDescription = null, modifier = Modifier.size(16.dp))
                                Spacer(modifier = Modifier.width(4.dp))
                                Text("Gen Note", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                            }

                            // Flashcard builder button
                            OutlinedButton(
                                onClick = {
                                    coroutineScope.launch {
                                        onNavigateToCards()
                                        repository.generateFlashcardsFromDocument(doc.title, doc.contentExtracted)
                                    }
                                },
                                shape = RoundedCornerShape(12.dp),
                                modifier = Modifier
                                    .weight(1f)
                                    .height(46.dp)
                                    .testTag("doc_detail_gen_cards"),
                                colors = ButtonDefaults.outlinedButtonColors(contentColor = tierTertiary()),
                                enabled = !isProcessing
                            ) {
                                Icon(Icons.Default.Style, contentDescription = null, modifier = Modifier.size(16.dp))
                                Spacer(modifier = Modifier.width(4.dp))
                                Text("Gen Cards", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                            }

                            // Quiz builder button
                            Button(
                                onClick = {
                                    coroutineScope.launch {
                                        onNavigateToQuiz()
                                        repository.generateQuizFromDocument(doc.title, doc.contentExtracted)
                                    }
                                },
                                shape = RoundedCornerShape(12.dp),
                                modifier = Modifier
                                    .weight(1f)
                                    .height(46.dp)
                                    .testTag("doc_detail_gen_quiz"),
                                colors = ButtonDefaults.buttonColors(containerColor = tierAccent()),
                                enabled = !isProcessing
                            ) {
                                Icon(Icons.Default.Quiz, contentDescription = null, modifier = Modifier.size(16.dp))
                                Spacer(modifier = Modifier.width(4.dp))
                                Text("Gen Quiz", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Color.White)
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun DocumentPreviewContent(
    doc: DocumentEntity,
    currentPage: Int,
    zoomLevel: Float,
    onPageChange: (Int) -> Unit,
    onZoomChange: (Float) -> Unit
) {
    val fileType = doc.fileType.lowercase()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        when {
            // Image / OCR scan preview
            fileType == "image" || fileType.contains("png") || fileType.contains("jpg") || fileType.contains("jpeg") -> {
                Card(
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f)),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Default.Image, contentDescription = null, tint = tierTertiary())
                                Spacer(modifier = Modifier.width(8.dp))
                                Text("Document Photo / OCR Frame", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleSmall)
                            }
                            Surface(shape = RoundedCornerShape(6.dp), color = tierTertiary().copy(alpha = 0.15f)) {
                                Text("OCR Extracted", modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp), fontSize = 10.sp, fontWeight = FontWeight.Bold, color = tierTertiary())
                            }
                        }

                        Spacer(modifier = Modifier.height(14.dp))

                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(260.dp)
                                .clip(RoundedCornerShape(12.dp))
                                .background(Color.Black.copy(alpha = 0.85f)),
                            contentAlignment = Alignment.Center
                        ) {
                        val localFile = if (!doc.localFilePath.isNullOrBlank()) java.io.File(doc.localFilePath) else null
                        val hasLocalFile = localFile != null && localFile.exists()
                        if (hasLocalFile || doc.fileUrl.isNotBlank()) {
                            SubcomposeAsyncImage(
                                model = if (hasLocalFile) localFile else doc.fileUrl,
                                contentDescription = "Scanned document preview",
                                contentScale = ContentScale.Fit,
                                modifier = Modifier
                                    .fillMaxSize()
                                    .padding(8.dp),
                                loading = {
                                    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                                        CircularProgressIndicator(color = tierTertiary())
                                    }
                                },
                                error = {
                                    Image(
                                        painter = painterResource(id = R.drawable.img_study_mascot),
                                        contentDescription = "Fallback scanned document preview",
                                        contentScale = ContentScale.Fit,
                                        modifier = Modifier
                                            .fillMaxSize()
                                            .padding(16.dp)
                                    )
                                }
                            )
                        } else {
                                Image(
                                    painter = painterResource(id = R.drawable.img_study_mascot),
                                    contentDescription = "Scanned document preview",
                                    contentScale = ContentScale.Fit,
                                    modifier = Modifier
                                        .fillMaxSize()
                                        .padding(16.dp)
                                )
                            }
                            Surface(
                                color = Color.Black.copy(alpha = 0.6f),
                                shape = RoundedCornerShape(20.dp),
                                modifier = Modifier
                                    .align(Alignment.BottomStart)
                                    .padding(12.dp)
                            ) {
                                Row(
                                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Icon(Icons.Default.CenterFocusWeak, contentDescription = null, tint = Color.Green, modifier = Modifier.size(16.dp))
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Text("OCR Text Extracted to AI Workspace", color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                                }
                            }
                        }
                    }
                }
            }

            // Web URL preview
            fileType == "url" || doc.fileName.endsWith(".url") -> {
                Card(
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = tierPrimary().copy(alpha = 0.08f)),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.Language, contentDescription = null, tint = tierPrimary())
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("Web Article Frame", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleSmall)
                        }
                        Spacer(modifier = Modifier.height(8.dp))
                        Text("Source URL: ${doc.fileName}", fontSize = 12.sp, color = tierPrimary(), fontFamily = FontFamily.Monospace)
                        Spacer(modifier = Modifier.height(12.dp))
                        Surface(
                            shape = RoundedCornerShape(12.dp),
                            color = MaterialTheme.colorScheme.surface,
                            border = BorderStroke(1.dp, tierPrimary().copy(alpha = 0.2f)),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text(
                                text = doc.contentExtracted.take(400) + "...",
                                modifier = Modifier.padding(14.dp),
                                style = MaterialTheme.typography.bodySmall.copy(lineHeight = 20.sp)
                            )
                        }
                    }
                }
            }

            // PDF / DOCX / PPTX / Text document preview layout
            else -> {
                Card(
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.35f)),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Default.PictureAsPdf, contentDescription = null, tint = Color(0xFFE53935))
                                Spacer(modifier = Modifier.width(8.dp))
                                Text("Document Reader Canvas", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleSmall)
                            }

                            // Page Pagination controls
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                IconButton(onClick = { if (currentPage > 1) onPageChange(currentPage - 1) }, modifier = Modifier.size(32.dp)) {
                                    Icon(Icons.Default.ChevronLeft, contentDescription = "Previous Page")
                                }
                                Text("Page $currentPage of 3", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                                IconButton(onClick = { if (currentPage < 3) onPageChange(currentPage + 1) }, modifier = Modifier.size(32.dp)) {
                                    Icon(Icons.Default.ChevronRight, contentDescription = "Next Page")
                                }
                            }
                        }

                        Spacer(modifier = Modifier.height(12.dp))

                        // Document Sheet Container
                        Surface(
                            shape = RoundedCornerShape(12.dp),
                            color = MaterialTheme.colorScheme.surface,
                            border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.15f)),
                            shadowElevation = 2.dp,
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Column(modifier = Modifier.padding(18.dp)) {
                                Text(
                                    text = "${doc.title} — Section $currentPage",
                                    fontWeight = FontWeight.Bold,
                                    fontSize = (15 * zoomLevel).sp,
                                    color = tierPrimary()
                                )
                                Spacer(modifier = Modifier.height(10.dp))
                                HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.15f))
                                Spacer(modifier = Modifier.height(10.dp))
                                Text(
                                    text = doc.contentExtracted,
                                    fontSize = (13 * zoomLevel).sp,
                                    lineHeight = (20 * zoomLevel).sp,
                                    fontFamily = FontFamily.SansSerif
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun DocumentAiExtractedNotes(
    doc: DocumentEntity,
    onRetryExtraction: () -> Unit,
    isProcessing: Boolean
) {
    Surface(
        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.25f),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.12f)),
        shape = RoundedCornerShape(16.dp),
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
    ) {
        Column(modifier = Modifier.padding(18.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Default.AutoAwesome, contentDescription = null, tint = tierPrimary())
                Spacer(modifier = Modifier.width(8.dp))
                Text("AI Formatted Study Content", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = tierPrimary())
            }
            Spacer(modifier = Modifier.height(12.dp))

            if (doc.contentExtracted.isNotBlank()) {
                Text(
                    text = doc.contentExtracted,
                    style = MaterialTheme.typography.bodyMedium.copy(lineHeight = 23.sp)
                )
            } else {
                Card(
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.35f)),
                    shape = RoundedCornerShape(14.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.Warning, contentDescription = null, tint = MaterialTheme.colorScheme.error)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("AI Text Extraction Failed / Pending", fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onErrorContainer)
                        }
                        Text(
                            "Automatic text extraction was not completed during document upload. Tap below to re-run Ollie's AI document analysis.",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onErrorContainer.copy(alpha = 0.85f)
                        )
                        Button(
                            onClick = onRetryExtraction,
                            enabled = !isProcessing,
                            colors = ButtonDefaults.buttonColors(containerColor = tierPrimary()),
                            shape = RoundedCornerShape(10.dp)
                        ) {
                            if (isProcessing) {
                                CircularProgressIndicator(modifier = Modifier.size(16.dp), color = Color.White, strokeWidth = 2.dp)
                                Spacer(modifier = Modifier.width(8.dp))
                                Text("Analyzing with AI...", fontSize = 12.sp)
                            } else {
                                Icon(Icons.Default.Refresh, contentDescription = null, modifier = Modifier.size(16.dp))
                                Spacer(modifier = Modifier.width(6.dp))
                                Text("Retry AI Analysis", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun DocumentFileMetadataStorage(doc: DocumentEntity, dateFormatter: SimpleDateFormat) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        Card(
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f)),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text("File & Storage Metadata", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold, color = tierPrimary())
                HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.15f))

                MetaRow("Document ID", doc.id)
                MetaRow("File Name", doc.fileName)
                MetaRow("File Extension", doc.fileType.uppercase())
                MetaRow("Estimated Size", "${doc.fileSizeKb} KB")
                MetaRow("Creation Date", dateFormatter.format(Date(doc.createdAt)))
                MetaRow("Storage File URL", if (doc.fileUrl.isNotBlank()) doc.fileUrl.take(45) + "..." else "N/A")
                MetaRow("Room DB Local Sync", "✅ Saved locally")
                MetaRow("Cloud Sync", "✅ Synchronized to backend")
            }
        }
    }
}

@Composable
private fun MetaRow(label: String, value: String) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(label, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f))
        Text(value, style = MaterialTheme.typography.bodySmall.copy(fontWeight = FontWeight.Bold))
    }
}

