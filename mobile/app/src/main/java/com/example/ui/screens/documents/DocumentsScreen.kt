package com.example.ui.screens.documents

import android.content.ClipboardManager
import android.content.Context
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.*
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.VolumeUp
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
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.example.R
import com.example.data.local.entities.DocumentEntity
import com.example.data.local.entities.DocumentFolderEntity
import com.example.ui.theme.tierAccent
import com.example.ui.theme.tierPrimary
import com.example.ui.theme.tierTertiary
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun DocumentsScreen(
    viewModel: DocumentsViewModel,
    onNavigateToDocumentDetail: (String) -> Unit,
    onNavigateToUploadFlow: () -> Unit = {},
    onBack: () -> Unit = {},
    onDiscussWithOllie: (DocumentEntity) -> Unit = {}
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()

    val snackbarHostState = remember { SnackbarHostState() }
    LaunchedEffect(state.userMessage) {
        state.userMessage?.let { msg ->
            snackbarHostState.showSnackbar(msg)
            viewModel.clearUserMessage()
        }
    }

    val dateFormatter = remember { SimpleDateFormat("MMM dd, yyyy", Locale.getDefault()) }

    // Dialog state controllers
    var showWebImportDialog by remember { mutableStateOf(false) }
    var showOCRScanDialog by remember { mutableStateOf(false) }
    var showNewFolderDialog by remember { mutableStateOf(false) }
    var moveTargetDoc by remember { mutableStateOf<DocumentEntity?>(null) }
    var fullScreenReaderDoc by remember { mutableStateOf<DocumentEntity?>(null) }
    var audioPlayerDoc by remember { mutableStateOf<DocumentEntity?>(null) }

    // File-manager style categories (icon, tint) — tapping one filters the list. Labels MUST
    // match the DocumentsViewModel filter keys exactly ("PDF", "Web & URL"), or the chip falls
    // through to the ViewModel's else-branch and silently shows every document.
    val categoryDefs = listOf(
        "Images" to (Icons.Default.Image to 0xFF8B5CF6),
        "PDF" to (Icons.Default.PictureAsPdf to 0xFFEF4444),
        "Docs" to (Icons.Default.Description to 0xFF3B82F6),
        "Slides" to (Icons.Default.Slideshow to 0xFFF59E0B),
        "Sheets" to (Icons.Default.TableChart to 0xFF10B981),
        "Web & URL" to (Icons.Default.Language to 0xFF06B6D4),
        "Audio" to (Icons.Default.MusicNote to 0xFFEC4899),
        "Video" to (Icons.Default.VideoLibrary to 0xFF6366F1)
    )
    val sortOptions = listOf("Newest", "Oldest", "A-Z", "Size")
    var showSortMenu by remember { mutableStateOf(false) }
    // "All" + every category name, used by the filter chips row below.
    val allCategories = listOf("All") + categoryDefs.map { it.first }
    // Doc counts per folder, for the folder cards (file-manager style).
    val folderCounts = remember(state.documents) {
        state.documents.groupingBy { it.folderId }.eachCount()
    }
    val selectedFolder = remember(state.folders, state.selectedFolderId) {
        state.folders.firstOrNull { it.id == state.selectedFolderId }
    }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(
                            "Course Documents",
                            fontWeight = FontWeight.Bold,
                            style = MaterialTheme.typography.titleMedium,
                            maxLines = 1,
                            overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis
                        )
                        Text(
                            "${state.documents.size} saved files",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f),
                            maxLines = 1,
                            overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis
                        )
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBack, modifier = Modifier.testTag("back_button")) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    IconButton(
                        onClick = { viewModel.refreshDocuments() },
                        modifier = Modifier.testTag("refresh_documents_button")
                    ) {
                        Icon(Icons.Default.Refresh, contentDescription = "Refresh Documents", tint = MaterialTheme.colorScheme.primary)
                    }
                }
            )
        },
        floatingActionButton = {
            ExtendedFloatingActionButton(
                onClick = onNavigateToUploadFlow,
                icon = { Icon(Icons.Default.Add, contentDescription = null) },
                text = { Text("Upload Document", fontWeight = FontWeight.Bold) },
                containerColor = tierPrimary(),
                contentColor = Color.White,
                modifier = Modifier.testTag("fab_upload_document")
            )
        }
    ) { innerPadding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
            contentPadding = PaddingValues(bottom = 80.dp)
        ) {
            // 1. Document Hub Mascot & Quick Importers Banner
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(20.dp),
                    colors = CardDefaults.cardColors(containerColor = tierPrimary().copy(alpha = 0.08f))
                ) {
                    Column(modifier = Modifier.padding(14.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Image(
                                painter = painterResource(id = R.drawable.img_study_mascot),
                                contentDescription = "Mascot",
                                modifier = Modifier
                                    .size(52.dp)
                                    .clip(RoundedCornerShape(14.dp)),
                                contentScale = ContentScale.Crop
                            )
                            Spacer(modifier = Modifier.width(12.dp))
                            Column(modifier = Modifier.weight(1f)) {
                                Text("PDF, Web & OCR AI Parser", style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold))
                                Spacer(modifier = Modifier.height(2.dp))
                                Text("Import web links, scan notes with camera, or upload files to extract notes, flashcards & quizzes.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f))
                            }
                        }

                        Spacer(modifier = Modifier.height(10.dp))

                        // Quick Importers
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            OutlinedButton(
                                onClick = { showWebImportDialog = true },
                                modifier = Modifier.weight(1f).height(36.dp),
                                shape = RoundedCornerShape(10.dp),
                                contentPadding = PaddingValues(horizontal = 8.dp, vertical = 2.dp)
                            ) {
                                Icon(Icons.Default.Language, contentDescription = null, modifier = Modifier.size(14.dp), tint = tierPrimary())
                                Spacer(modifier = Modifier.width(4.dp))
                                Text("Web Import", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = tierPrimary())
                            }

                            OutlinedButton(
                                onClick = { showOCRScanDialog = true },
                                modifier = Modifier.weight(1f).height(36.dp),
                                shape = RoundedCornerShape(10.dp),
                                contentPadding = PaddingValues(horizontal = 8.dp, vertical = 2.dp)
                            ) {
                                Icon(Icons.Default.CameraAlt, contentDescription = null, modifier = Modifier.size(14.dp), tint = tierTertiary())
                                Spacer(modifier = Modifier.width(4.dp))
                                Text("OCR Scan", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = tierTertiary())
                            }
                        }
                    }
                }
            }

            // 2. Search Bar with Sort dropdown
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    OutlinedTextField(
                        value = state.searchQuery,
                        onValueChange = { viewModel.setSearchQuery(it) },
                        placeholder = { Text("Search title, keywords, content...", fontSize = 13.sp) },
                        leadingIcon = { Icon(Icons.Default.Search, contentDescription = "Search") },
                        trailingIcon = {
                            if (state.searchQuery.isNotEmpty()) {
                                IconButton(onClick = { viewModel.setSearchQuery("") }) {
                                    Icon(Icons.Default.Clear, contentDescription = "Clear")
                                }
                            }
                        },
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(16.dp),
                        singleLine = true
                    )

                    Box {
                        IconButton(
                            onClick = { showSortMenu = true },
                            modifier = Modifier.background(MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(12.dp))
                        ) {
                            Icon(Icons.Default.Sort, contentDescription = "Sort Documents")
                        }

                        DropdownMenu(
                            expanded = showSortMenu,
                            onDismissRequest = { showSortMenu = false }
                        ) {
                            sortOptions.forEach { option ->
                                DropdownMenuItem(
                                    text = { Text(option, fontWeight = if (state.sortOrder == option) FontWeight.Bold else FontWeight.Normal) },
                                    onClick = {
                                        viewModel.setSortOrder(option)
                                        showSortMenu = false
                                    },
                                    leadingIcon = {
                                        if (state.sortOrder == option) {
                                            Icon(Icons.Default.Check, contentDescription = null, tint = tierPrimary())
                                        }
                                    }
                                )
                            }
                        }
                    }
                }
            }

            // 3. Folders row — file-manager style: folder cards with counts, tap to browse.
            item {
                Column {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = if (state.selectedFolderId == null) "FOLDERS" else "IN FOLDER",
                            style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold, color = tierPrimary())
                        )
                        TextButton(
                            onClick = { showNewFolderDialog = true },
                            contentPadding = PaddingValues(horizontal = 4.dp)
                        ) {
                            Icon(Icons.Default.CreateNewFolder, contentDescription = null, modifier = Modifier.size(14.dp), tint = tierPrimary())
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("New Folder", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = tierPrimary())
                        }
                    }

                    if (state.selectedFolderId != null && selectedFolder != null) {
                        // Folder breadcrumb: shows where we are; tap the X to go back to root.
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(12.dp))
                                .background(parseColorOrFallback(selectedFolder.color).copy(alpha = 0.12f))
                                .clickable { viewModel.setSelectedFolder(null) }
                                .padding(horizontal = 12.dp, vertical = 8.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(Icons.Default.Folder, contentDescription = null, tint = parseColorOrFallback(selectedFolder.color), modifier = Modifier.size(18.dp))
                            Spacer(modifier = Modifier.width(8.dp))
                            Column(modifier = Modifier.weight(1f)) {
                                Text(selectedFolder.name, fontWeight = FontWeight.Bold, fontSize = 13.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                Text("${folderCounts[selectedFolder.id] ?: 0} files", fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f))
                            }
                            IconButton(onClick = { viewModel.setSelectedFolder(null) }) {
                                Icon(Icons.Default.Close, contentDescription = "Exit folder", modifier = Modifier.size(16.dp))
                            }
                        }
                    } else {
                        LazyRow(
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            items(state.folders, key = { it.id }) { folder ->
                                val color = parseColorOrFallback(folder.color)
                                val count = folderCounts[folder.id] ?: 0
                                Surface(
                                    shape = RoundedCornerShape(14.dp),
                                    color = color.copy(alpha = 0.1f),
                                    border = BorderStroke(1.dp, color.copy(alpha = 0.35f)),
                                    modifier = Modifier.clickable { viewModel.setSelectedFolder(folder.id) }
                                ) {
                                    Row(
                                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Icon(Icons.Default.Folder, contentDescription = null, tint = color, modifier = Modifier.size(20.dp))
                                        Spacer(modifier = Modifier.width(6.dp))
                                        Column {
                                            Text(folder.name, fontWeight = FontWeight.Bold, fontSize = 12.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                            Text("$count files", fontSize = 9.sp, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.55f))
                                        }
                                    }
                                }
                            }
                            item {
                                Surface(
                                    shape = RoundedCornerShape(14.dp),
                                    color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
                                    border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.2f)),
                                    modifier = Modifier.clickable { showNewFolderDialog = true }
                                ) {
                                    Row(
                                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Icon(Icons.Default.Add, contentDescription = null, tint = tierPrimary(), modifier = Modifier.size(20.dp))
                                        Spacer(modifier = Modifier.width(6.dp))
                                        Text("New", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = tierPrimary())
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // 4. Compact filter dropdown (single control instead of nine chips competing
            // with the folders row + search + sort above the fold).
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    var showFilterMenu by remember { mutableStateOf(false) }
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            text = "FILTER",
                            style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold, color = tierPrimary())
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Box {
                            TextButton(
                                onClick = { showFilterMenu = true },
                                contentPadding = PaddingValues(horizontal = 8.dp)
                            ) {
                                Text(
                                    state.selectedFilter,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 12.sp,
                                    color = tierPrimary()
                                )
                                Spacer(modifier = Modifier.width(2.dp))
                                Icon(Icons.Default.ArrowDropDown, contentDescription = null, tint = tierPrimary(), modifier = Modifier.size(16.dp))
                            }
                            DropdownMenu(
                                expanded = showFilterMenu,
                                onDismissRequest = { showFilterMenu = false }
                            ) {
                                allCategories.forEach { category ->
                                    DropdownMenuItem(
                                        text = { Text(category, fontWeight = if (state.selectedFilter == category) FontWeight.Bold else FontWeight.Normal) },
                                        onClick = {
                                            viewModel.setSelectedFilter(category)
                                            showFilterMenu = false
                                        },
                                        leadingIcon = {
                                            if (state.selectedFilter == category) {
                                                Icon(Icons.Default.Check, contentDescription = null, tint = tierPrimary())
                                            }
                                        }
                                    )
                                }
                            }
                        }
                    }
                    if (state.searchQuery.isNotBlank() || state.selectedFilter != "All" || state.selectedFolderId != null) {
                        TextButton(
                            onClick = {
                                viewModel.setSearchQuery("")
                                viewModel.setSelectedFilter("All")
                                viewModel.setSelectedFolder(null)
                            }
                        ) {
                            Text("Reset", fontSize = 11.sp, color = tierPrimary())
                        }
                    }
                }
            }

            // 4. Processing status indicator
            if (state.isUploading || state.isProcessing) {
                item {
                    Column(modifier = Modifier.fillMaxWidth()) {
                        LinearProgressIndicator(modifier = Modifier.fillMaxWidth())
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = if (state.isUploading) "Uploading & parsing web/file document..." else "Ollie AI is generating study aids...",
                            style = MaterialTheme.typography.bodySmall,
                            color = tierPrimary(),
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }

            // 5. Documents List header stats
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "MY DOCUMENTS (${state.filteredDocuments.size})",
                        style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold, color = tierPrimary())
                    )
                }
            }

            // 6. Documents List or Empty State
            if (state.filteredDocuments.isEmpty()) {
                item {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 24.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            modifier = Modifier.padding(16.dp)
                        ) {
                            coil.compose.SubcomposeAsyncImage(
                                model = R.drawable.img_empty_documents,
                                contentDescription = "Empty Documents Art",
                                modifier = Modifier
                                    .size(140.dp)
                                    .clip(RoundedCornerShape(20.dp)),
                                contentScale = ContentScale.Crop,
                                loading = {
                                    Box(
                                        modifier = Modifier.fillMaxSize(),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        CircularProgressIndicator(
                                            color = tierPrimary(),
                                            modifier = Modifier.size(36.dp)
                                        )
                                    }
                                },
                                error = {
                                    Box(
                                        modifier = Modifier
                                            .fillMaxSize()
                                            .background(MaterialTheme.colorScheme.surfaceVariant),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Icon(
                                            imageVector = Icons.Default.CloudQueue,
                                            contentDescription = null,
                                            tint = MaterialTheme.colorScheme.onSurfaceVariant,
                                            modifier = Modifier.size(48.dp)
                                        )
                                    }
                                }
                            )
                            Spacer(modifier = Modifier.height(16.dp))
                            Text(
                                text = if (state.documents.isEmpty()) "No course documents yet!" else "No matching documents found",
                                style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold)
                            )
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = if (state.documents.isEmpty()) "Import web articles, scan notes with camera, or upload PDF files to generate instant study decks." else "Try adjusting your search query or format filters.",
                                textAlign = TextAlign.Center,
                                style = MaterialTheme.typography.bodyMedium.copy(
                                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)
                                )
                            )
                            Spacer(modifier = Modifier.height(16.dp))
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                OutlinedButton(onClick = { showWebImportDialog = true }) {
                                    Icon(Icons.Default.Language, contentDescription = null, modifier = Modifier.size(16.dp))
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Text("Web Import")
                                }
                                Button(
                                    onClick = onNavigateToUploadFlow,
                                    colors = ButtonDefaults.buttonColors(containerColor = tierPrimary())
                                ) {
                                    Icon(Icons.Default.CloudUpload, contentDescription = null, modifier = Modifier.size(16.dp))
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Text("Upload File")
                                }
                            }
                        }
                    }
                }
            } else {
                items(state.filteredDocuments, key = { it.id }) { doc ->
                    DocumentCardItem(
                        doc = doc,
                        dateFormatter = dateFormatter,
                        onOpenDetail = { onNavigateToDocumentDetail(doc.id) },
                        onOpenReader = { fullScreenReaderDoc = doc },
                        onOpenAudio = { audioPlayerDoc = doc },
                        onGenNote = { viewModel.generateNote(doc) },
                        onGenCards = { viewModel.generateFlashcards(doc) },
                        onGenQuiz = { viewModel.generateQuiz(doc) },
                        onRetryAI = { viewModel.retryAIExtraction(doc) },
                        onDownload = { DocumentDownloadHelper.downloadDocument(context, doc) },
                        onDelete = { viewModel.deleteDocument(doc.id) },
                        onMoveToFolder = { moveTargetDoc = doc },
                        onDiscussWithOllie = {
                            if (doc.contentExtracted.isBlank()) {
                                coroutineScope.launch {
                                    snackbarHostState.showSnackbar("This document has no extracted text. Please process it first before discussing with Ollie!")
                                }
                            } else {
                                onDiscussWithOllie(doc)
                            }
                        }
                    )
                }
            }
        }
    }

    // MODAL DIALOGS FOR WEB IMPORT, OCR SCAN, FULL-SCREEN READER & AUDIO NARRATION
    if (showWebImportDialog) {
        WebUrlImporterModal(
            onDismiss = { showWebImportDialog = false },
            onImport = { url, title ->
                viewModel.importWebDocument(url, title)
                showWebImportDialog = false
            }
        )
    }

    if (showNewFolderDialog) {
        NewFolderDialog(
            onDismiss = { showNewFolderDialog = false },
            onCreate = { name, color ->
                viewModel.createFolder(name, color)
                showNewFolderDialog = false
            }
        )
    }

    moveTargetDoc?.let { doc ->
        MoveToFolderDialog(
            doc = doc,
            folders = state.folders,
            onDismiss = { moveTargetDoc = null },
            onMove = { folderId ->
                viewModel.moveDocumentToFolder(doc.id, folderId)
                moveTargetDoc = null
            }
        )
    }

    if (showOCRScanDialog) {
        OCRScanImporterModal(
            onDismiss = {
                // Cancel any in-flight cloud OCR upload so a discarded capture doesn't
                // leave an orphan document behind.
                viewModel.cancelPendingCloudScan()
                showOCRScanDialog = false
            },
            onProcessOCR = { base64, mime, onDone ->
                viewModel.processImageOCR(base64, mime, onDone)
            },
            onSaveScan = { title, content ->
                viewModel.importScannedDocument(title, content)
                showOCRScanDialog = false
            }
        )
    }

    fullScreenReaderDoc?.let { doc ->
        FullScreenDocumentReaderModal(
            doc = doc,
            onDismiss = { fullScreenReaderDoc = null },
            onGenNote = { viewModel.generateNote(doc) },
            onGenCards = { viewModel.generateFlashcards(doc) },
            onGenQuiz = { viewModel.generateQuiz(doc) }
        )
    }

    audioPlayerDoc?.let { doc ->
        DocumentAudioNarrationModal(
            doc = doc,
            onDismiss = { audioPlayerDoc = null }
        )
    }
}

@Composable
private fun DocumentCardItem(
    doc: DocumentEntity,
    dateFormatter: SimpleDateFormat,
    onOpenDetail: () -> Unit,
    onOpenReader: () -> Unit,
    onOpenAudio: () -> Unit,
    onGenNote: () -> Unit,
    onGenCards: () -> Unit,
    onGenQuiz: () -> Unit,
    onRetryAI: () -> Unit,
    onDownload: () -> Unit,
    onDelete: () -> Unit,
    onMoveToFolder: () -> Unit = {},
    onDiscussWithOllie: () -> Unit = {}
) {
    var showOverflowMenu by remember { mutableStateOf(false) }
    var showAIMenu by remember { mutableStateOf(false) }

    val (typeIcon, iconColor, typeLabel) = when (doc.fileType.lowercase()) {
        "url" -> Triple(Icons.Default.Language, tierPrimary(), "WEB LINK")
        "image" -> Triple(Icons.Default.CameraAlt, tierTertiary(), "OCR SCAN")
        "pptx" -> Triple(Icons.Default.Slideshow, Color(0xFFD32F2F), "SLIDES")
        "docx" -> Triple(Icons.Default.Description, Color(0xFF1976D2), "DOCX")
        else -> Triple(Icons.Default.PictureAsPdf, Color(0xFFE53935), "PDF")
    }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .testTag("document_card_${doc.id}"),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.45f))
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { onOpenDetail() },
                verticalAlignment = Alignment.CenterVertically
            ) {
                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = iconColor.copy(alpha = 0.15f),
                    modifier = Modifier.size(46.dp)
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        val localFile = if (!doc.localFilePath.isNullOrBlank()) java.io.File(doc.localFilePath) else null
                        val hasLocalFile = localFile != null && localFile.exists()
                        val isImage = doc.fileType.lowercase() == "image" || doc.fileName.endsWith(".png") || doc.fileName.endsWith(".jpg") || doc.fileName.endsWith(".jpeg")
                        if ((hasLocalFile || doc.fileUrl.isNotBlank()) && isImage) {
                            SubcomposeAsyncImage(
                                model = if (hasLocalFile) localFile else doc.fileUrl,
                                contentDescription = doc.title,
                                contentScale = ContentScale.Crop,
                                modifier = Modifier.fillMaxSize().clip(RoundedCornerShape(12.dp)),
                                error = {
                                    Icon(typeIcon, contentDescription = null, tint = iconColor)
                                }
                            )
                        } else {
                            Icon(typeIcon, contentDescription = null, tint = iconColor)
                        }
                    }
                }

                Spacer(modifier = Modifier.width(12.dp))

                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = doc.title,
                        style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Bold),
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Surface(
                            shape = RoundedCornerShape(4.dp),
                            color = iconColor.copy(alpha = 0.12f)
                        ) {
                            Text(
                                text = typeLabel,
                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 1.dp),
                                style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold, color = iconColor)
                            )
                        }
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("${doc.fileName} • ${doc.fileSizeKb} KB", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f))
                    }
                }

                Box {
                    IconButton(onClick = { showOverflowMenu = true }) {
                        Icon(Icons.Default.MoreVert, contentDescription = "More Options", tint = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f), modifier = Modifier.size(20.dp))
                    }
                    DropdownMenu(
                        expanded = showOverflowMenu,
                        onDismissRequest = { showOverflowMenu = false }
                    ) {
                        DropdownMenuItem(
                            text = { Text("Download File") },
                            leadingIcon = { Icon(Icons.Default.Download, contentDescription = null, tint = tierPrimary()) },
                            onClick = {
                                showOverflowMenu = false
                                onDownload()
                            }
                        )
                        DropdownMenuItem(
                            text = { Text("Open Details") },
                            leadingIcon = { Icon(Icons.Default.Visibility, contentDescription = null, tint = tierPrimary()) },
                            onClick = {
                                showOverflowMenu = false
                                onOpenDetail()
                            }
                        )
                        HorizontalDivider()
                        DropdownMenuItem(
                            text = { Text("Move to folder…") },
                            leadingIcon = { Icon(Icons.Default.DriveFileMove, contentDescription = null, tint = tierPrimary()) },
                            onClick = {
                                showOverflowMenu = false
                                onMoveToFolder()
                            }
                        )
                        HorizontalDivider()
                        DropdownMenuItem(
                            text = { Text("Delete Document", color = MaterialTheme.colorScheme.error) },
                            leadingIcon = { Icon(Icons.Default.Delete, contentDescription = null, tint = MaterialTheme.colorScheme.error) },
                            onClick = {
                                showOverflowMenu = false
                                onDelete()
                            }
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(10.dp))
            HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.1f))
            Spacer(modifier = Modifier.height(8.dp))

            // Simplified Action Bar: Reader + Listen + AI Tools Menu
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    // Full Screen Reader Button
                    OutlinedButton(
                        onClick = onOpenReader,
                        contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp),
                        modifier = Modifier.height(32.dp),
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Icon(Icons.Default.MenuBook, contentDescription = null, modifier = Modifier.size(14.dp), tint = tierPrimary())
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("Reader", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = tierPrimary())
                    }

                    // Audio Narration Button
                    OutlinedButton(
                        onClick = onOpenAudio,
                        contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp),
                        modifier = Modifier.height(32.dp),
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Icon(Icons.AutoMirrored.Filled.VolumeUp, contentDescription = null, modifier = Modifier.size(14.dp), tint = tierTertiary())
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("Listen", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = tierTertiary())
                    }
                }

                // AI Tools Dropdown Button
                Box {
                    FilledTonalButton(
                        onClick = { showAIMenu = true },
                        contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp),
                        modifier = Modifier.height(32.dp),
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Icon(Icons.Default.AutoAwesome, contentDescription = null, modifier = Modifier.size(14.dp), tint = tierPrimary())
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("AI Tools", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                        Icon(Icons.Default.ArrowDropDown, contentDescription = null, modifier = Modifier.size(16.dp))
                    }

                    DropdownMenu(
                        expanded = showAIMenu,
                        onDismissRequest = { showAIMenu = false }
                    ) {
                        DropdownMenuItem(
                            text = { Text("Discuss with Ollie Chat") },
                            leadingIcon = { Icon(Icons.Default.SmartToy, contentDescription = null, tint = tierPrimary()) },
                            onClick = {
                                showAIMenu = false
                                onDiscussWithOllie()
                            }
                        )
                        DropdownMenuItem(
                            text = { Text("Generate Study Note") },
                            leadingIcon = { Icon(Icons.Default.NoteAdd, contentDescription = null, tint = tierPrimary()) },
                            onClick = {
                                showAIMenu = false
                                onGenNote()
                            }
                        )
                        DropdownMenuItem(
                            text = { Text("Generate Flashcard Deck") },
                            leadingIcon = { Icon(Icons.Default.Style, contentDescription = null, tint = tierTertiary()) },
                            onClick = {
                                showAIMenu = false
                                onGenCards()
                            }
                        )
                        DropdownMenuItem(
                            text = { Text("Generate Practice Quiz") },
                            leadingIcon = { Icon(Icons.Default.Quiz, contentDescription = null, tint = tierAccent()) },
                            onClick = {
                                showAIMenu = false
                                onGenQuiz()
                            }
                        )
                        HorizontalDivider()
                        DropdownMenuItem(
                            text = { Text("Retry AI Extraction") },
                            leadingIcon = { Icon(Icons.Default.Refresh, contentDescription = null, tint = tierPrimary()) },
                            onClick = {
                                showAIMenu = false
                                onRetryAI()
                            }
                        )
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FullScreenDocumentReaderModal(
    doc: DocumentEntity,
    onDismiss: () -> Unit,
    onGenNote: () -> Unit,
    onGenCards: () -> Unit,
    onGenQuiz: () -> Unit
) {
    val context = LocalContext.current
    var fontSize by remember { mutableFloatStateOf(16f) }
    var readerTheme by remember { mutableStateOf("Light") } // Light, Sepia, Night
    var searchQuery by remember { mutableStateOf("") }
    var isSearchVisible by remember { mutableStateOf(false) }

    val (bgBgColor, textColor, cardBg) = when (readerTheme) {
        "Sepia" -> Triple(Color(0xFFFBF0D9), Color(0xFF5F4B32), Color(0xFFF4E5C3))
        "Night" -> Triple(Color(0xFF121212), Color(0xFFE0E0E0), Color(0xFF1E1E1E))
        else -> Triple(Color(0xFFFAFAFA), Color(0xFF212121), Color(0xFFF0F0F0)) // Light
    }

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Scaffold(
            topBar = {
                TopAppBar(
                    navigationIcon = {
                        IconButton(onClick = onDismiss) {
                            Icon(Icons.Default.Close, contentDescription = "Close Reader")
                        }
                    },
                    title = {
                        Column {
                            Text(doc.title, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis, style = MaterialTheme.typography.titleMedium)
                            Text("${doc.fileName} • Immersive Reader", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f))
                        }
                    },
                    actions = {
                        IconButton(onClick = { isSearchVisible = !isSearchVisible }) {
                            Icon(Icons.Default.Search, contentDescription = "Search text")
                        }
                        IconButton(
                            onClick = {
                                val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                                val clip = android.content.ClipData.newPlainText("Document Text", doc.contentExtracted)
                                clipboard.setPrimaryClip(clip)
                            }
                        ) {
                            Icon(Icons.Default.ContentCopy, contentDescription = "Copy Text")
                        }
                    }
                )
            },
            bottomBar = {
                Surface(
                    tonalElevation = 8.dp,
                    color = cardBg,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp, vertical = 10.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        // Font Size Controls
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            IconButton(onClick = { if (fontSize > 12f) fontSize -= 2f }) {
                                Text("A-", fontWeight = FontWeight.Bold, fontSize = 14.sp)
                            }
                            Text("${fontSize.toInt()}sp", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                            IconButton(onClick = { if (fontSize < 28f) fontSize += 2f }) {
                                Text("A+", fontWeight = FontWeight.Bold, fontSize = 16.sp)
                            }
                        }

                        // Theme Selector Pills
                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            listOf("Light", "Sepia", "Night").forEach { theme ->
                                val isSelected = readerTheme == theme
                                FilterChip(
                                    selected = isSelected,
                                    onClick = { readerTheme = theme },
                                    label = { Text(theme, fontSize = 11.sp, fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal) }
                                )
                            }
                        }
                    }
                }
            }
        ) { innerPadding ->
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding)
                    .background(bgBgColor)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(20.dp)
                ) {
                    if (isSearchVisible) {
                        OutlinedTextField(
                            value = searchQuery,
                            onValueChange = { searchQuery = it },
                            placeholder = { Text("Search inside document text...", fontSize = 13.sp) },
                            leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
                            trailingIcon = {
                                IconButton(onClick = { searchQuery = ""; isSearchVisible = false }) {
                                    Icon(Icons.Default.Close, contentDescription = null)
                                }
                            },
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(bottom = 12.dp),
                            shape = RoundedCornerShape(12.dp),
                            singleLine = true
                        )
                    }

                    // AI Quick Action Row on Reader Top
                    Card(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(bottom = 16.dp),
                        shape = RoundedCornerShape(16.dp),
                        colors = CardDefaults.cardColors(containerColor = tierPrimary().copy(alpha = 0.1f))
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(12.dp),
                            horizontalArrangement = Arrangement.SpaceAround,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            TextButton(onClick = { onGenNote(); onDismiss() }) {
                                Icon(Icons.Default.NoteAdd, contentDescription = null, modifier = Modifier.size(16.dp), tint = tierPrimary())
                                Spacer(modifier = Modifier.width(4.dp))
                                Text("Create Note", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                            }
                            TextButton(onClick = { onGenCards(); onDismiss() }) {
                                Icon(Icons.Default.Style, contentDescription = null, modifier = Modifier.size(16.dp), tint = tierTertiary())
                                Spacer(modifier = Modifier.width(4.dp))
                                Text("Create Flashcards", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                            }
                            TextButton(onClick = { onGenQuiz(); onDismiss() }) {
                                Icon(Icons.Default.Quiz, contentDescription = null, modifier = Modifier.size(16.dp), tint = tierAccent())
                                Spacer(modifier = Modifier.width(4.dp))
                                Text("Create Quiz", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                    }

                    // Scrollable Extracted Full Content & Media Preview
                    Column(
                        modifier = Modifier
                            .weight(1f)
                            .fillMaxWidth()
                            .verticalScroll(rememberScrollState()),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        val localFile = if (!doc.localFilePath.isNullOrBlank()) java.io.File(doc.localFilePath) else null
                        val hasLocalFile = localFile != null && localFile.exists()
                        val isImage = doc.fileType.lowercase() == "image" || doc.fileName.endsWith(".png") || doc.fileName.endsWith(".jpg") || doc.fileName.endsWith(".jpeg")
                        if ((hasLocalFile || doc.fileUrl.isNotBlank()) && isImage) {
                            Card(
                                shape = RoundedCornerShape(12.dp),
                                colors = CardDefaults.cardColors(containerColor = Color.Black)
                            ) {
                                SubcomposeAsyncImage(
                                    model = if (hasLocalFile) localFile else doc.fileUrl,
                                    contentDescription = doc.title,
                                    contentScale = ContentScale.Fit,
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .heightIn(max = 350.dp)
                                        .padding(8.dp),
                                    loading = {
                                        Box(Modifier.fillMaxWidth().height(180.dp), contentAlignment = Alignment.Center) {
                                            CircularProgressIndicator(color = tierPrimary())
                                        }
                                    }
                                )
                            }
                        }

                        Text(
                            text = doc.contentExtracted,
                            fontSize = fontSize.sp,
                            color = textColor,
                            lineHeight = (fontSize * 1.5f).sp,
                            fontFamily = FontFamily.SansSerif,
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun WebUrlImporterModal(
    onDismiss: () -> Unit,
    onImport: (url: String, title: String) -> Unit
) {
    var selectedTab by remember { mutableIntStateOf(0) } // 0: Paste URL, 1: Search & Discover
    var webUrl by remember { mutableStateOf("") }
    var customTitle by remember { mutableStateOf("") }
    
    // Search discovery state
    var searchQuery by remember { mutableStateOf("") }
    var isSearching by remember { mutableStateOf(false) }
    val coroutineScope = rememberCoroutineScope()
    var searchResults by remember { mutableStateOf<List<Triple<String, String, String>>>(emptyList()) } // title, url, snippet

    AlertDialog(
        onDismissRequest = onDismiss,
        icon = { Icon(Icons.Default.Language, contentDescription = null, tint = tierPrimary(), modifier = Modifier.size(32.dp)) },
        title = { Text("Web Resource Hub", fontWeight = FontWeight.Bold, textAlign = TextAlign.Center) },
        text = {
            Column(
                verticalArrangement = Arrangement.spacedBy(12.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                TabRow(
                    selectedTabIndex = selectedTab,
                    containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
                    modifier = Modifier.clip(RoundedCornerShape(8.dp))
                ) {
                    Tab(
                        selected = selectedTab == 0,
                        onClick = { selectedTab = 0 },
                        text = { Text("Paste Link", fontWeight = FontWeight.Bold, fontSize = 12.sp) },
                        icon = { Icon(Icons.Default.Link, contentDescription = null, modifier = Modifier.size(16.dp)) }
                    )
                    Tab(
                        selected = selectedTab == 1,
                        onClick = { selectedTab = 1 },
                        text = { Text("Discover Online", fontWeight = FontWeight.Bold, fontSize = 12.sp) },
                        icon = { Icon(Icons.Default.Search, contentDescription = null, modifier = Modifier.size(16.dp)) }
                    )
                }

                if (selectedTab == 0) {
                    Text(
                        "Paste a direct link to an online article, PDF, Wikipedia page, or lecture notes. Our AI pipeline downloads and cleans the text into your document library.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)
                    )

                    OutlinedTextField(
                        value = webUrl,
                        onValueChange = { webUrl = it },
                        label = { Text("Web URL / Article Link") },
                        placeholder = { Text("https://en.wikipedia.org/wiki/...") },
                        leadingIcon = { Icon(Icons.Default.Link, contentDescription = null) },
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp),
                        singleLine = true
                    )

                    OutlinedTextField(
                        value = customTitle,
                        onValueChange = { customTitle = it },
                        label = { Text("Document Title (Optional)") },
                        leadingIcon = { Icon(Icons.Default.Title, contentDescription = null) },
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp),
                        singleLine = true
                    )
                } else {
                    Text(
                        "Search academic topics on Wikipedia & the web to ingest educational summaries and study material directly into your courses.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)
                    )

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        OutlinedTextField(
                            value = searchQuery,
                            onValueChange = { searchQuery = it },
                            label = { Text("Search academic topic") },
                            placeholder = { Text("e.g. Operating Systems Paging") },
                            leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(12.dp),
                            singleLine = true
                        )

                        Button(
                            onClick = {
                                if (searchQuery.isNotBlank()) {
                                    isSearching = true
                                    coroutineScope.launch {
                                        try {
                                            val query = searchQuery.trim()
                                            val encoded = java.net.URLEncoder.encode(query, "UTF-8")
                                            val wikiUrl = "https://en.wikipedia.org/w/api.php?action=opensearch&search=$encoded&limit=4&namespace=0&format=json"
                                            val connection = java.net.URL(wikiUrl).openConnection() as java.net.HttpURLConnection
                                            connection.requestMethod = "GET"
                                            connection.setRequestProperty("User-Agent", "StuddyHub-Android/1.0")
                                            connection.connectTimeout = 8000
                                            connection.readTimeout = 8000
                                            val stream = connection.inputStream.bufferedReader().use { it.readText() }
                                            val jsonArray = org.json.JSONArray(stream)
                                            val titles = jsonArray.getJSONArray(1)
                                            val snippets = jsonArray.getJSONArray(2)
                                            val urls = jsonArray.getJSONArray(3)
                                            val list = mutableListOf<Triple<String, String, String>>()
                                            for (i in 0 until titles.length()) {
                                                list.add(Triple(titles.getString(i), urls.getString(i), snippets.getString(i)))
                                            }
                                            searchResults = list
                                        } catch (e: Exception) {
                                            android.util.Log.w("WebUrlImporterModal", "Search error: ${e.message}")
                                        } finally {
                                            isSearching = false
                                        }
                                    }
                                }
                            },
                            enabled = searchQuery.isNotBlank() && !isSearching,
                            shape = RoundedCornerShape(12.dp),
                            contentPadding = PaddingValues(horizontal = 12.dp, vertical = 14.dp)
                        ) {
                            if (isSearching) {
                                CircularProgressIndicator(modifier = Modifier.size(16.dp), color = Color.White, strokeWidth = 2.dp)
                            } else {
                                Text("Find", fontWeight = FontWeight.Bold)
                            }
                        }
                    }

                    if (searchResults.isNotEmpty()) {
                        Column(
                            verticalArrangement = Arrangement.spacedBy(8.dp),
                            modifier = Modifier
                                .fillMaxWidth()
                                .heightIn(max = 200.dp)
                                .verticalScroll(rememberScrollState())
                        ) {
                            searchResults.forEach { (itemTitle, itemUrl, snippet) ->
                                Card(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clickable {
                                            onImport(itemUrl, itemTitle)
                                        },
                                    shape = RoundedCornerShape(10.dp),
                                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.6f))
                                ) {
                                    Column(modifier = Modifier.padding(10.dp)) {
                                        Row(
                                            modifier = Modifier.fillMaxWidth(),
                                            horizontalArrangement = Arrangement.SpaceBetween,
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Text(itemTitle, fontWeight = FontWeight.Bold, fontSize = 13.sp, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
                                            Icon(Icons.Default.Download, contentDescription = "Import", tint = tierPrimary(), modifier = Modifier.size(16.dp))
                                        }
                                        if (snippet.isNotBlank()) {
                                            Spacer(modifier = Modifier.height(2.dp))
                                            Text(snippet, fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f), maxLines = 2, overflow = TextOverflow.Ellipsis)
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        confirmButton = {
            if (selectedTab == 0) {
                Button(
                    onClick = { onImport(webUrl, customTitle) },
                    enabled = webUrl.isNotBlank(),
                    colors = ButtonDefaults.buttonColors(containerColor = tierPrimary()),
                    shape = RoundedCornerShape(10.dp)
                ) {
                    Icon(Icons.Default.Download, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Check, Download & Parse", fontWeight = FontWeight.Bold)
                }
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel") }
        }
    )
}

@Composable
fun OCRScanImporterModal(
    onDismiss: () -> Unit,
    onProcessOCR: (base64Image: String, mimeType: String, onExtracted: (String) -> Unit) -> Unit = { _, _, _ -> },
    onSaveScan: (title: String, content: String) -> Unit
) {
    val context = androidx.compose.ui.platform.LocalContext.current
    var scanTitle by remember { mutableStateOf("Camera OCR Scan") }
    var isCapturing by remember { mutableStateOf(false) }
    var hasCaptured by remember { mutableStateOf(false) }
    // Starts empty: real OCR text comes from the cloud (document-processor vision_analysis)
    // via onProcessOCR. Never pre-fill fake content that could be saved as if it were a real scan.
    var extractedText by remember { mutableStateOf("") }

    val coroutineScope = rememberCoroutineScope()

    val imagePickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent()
    ) { uri: android.net.Uri? ->
        uri?.let { fileUri ->
            try {
                val contentResolver = context.contentResolver
                val inputStream = contentResolver.openInputStream(fileUri)
                val bytes = inputStream?.readBytes()
                if (bytes != null) {
                    val base64 = android.util.Base64.encodeToString(bytes, android.util.Base64.NO_WRAP)
                    val mimeType = contentResolver.getType(fileUri) ?: "image/jpeg"
                    isCapturing = true
                    onProcessOCR(base64, mimeType) { ocrResult ->
                        isCapturing = false
                        hasCaptured = true
                        extractedText = ocrResult
                        scanTitle = "Scanned Note - ${System.currentTimeMillis().toString().takeLast(4)}"
                    }
                }
            } catch (e: Exception) {
                isCapturing = false
                android.util.Log.e("OCRScan", "Error reading image: ${e.message}")
            }
        }
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        icon = { Icon(Icons.Default.CameraAlt, contentDescription = null, tint = tierTertiary(), modifier = Modifier.size(32.dp)) },
        title = { Text("OCR Camera & Image Scanner", fontWeight = FontWeight.Bold, textAlign = TextAlign.Center) },
        text = {
            Column(
                verticalArrangement = Arrangement.spacedBy(12.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                // Viewfinder Container
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(160.dp)
                        .clip(RoundedCornerShape(16.dp))
                        .background(Color.Black)
                        .border(2.dp, if (hasCaptured) tierAccent() else tierTertiary(), RoundedCornerShape(16.dp)),
                    contentAlignment = Alignment.Center
                ) {
                    if (isCapturing) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            CircularProgressIndicator(color = Color.White)
                            Spacer(modifier = Modifier.height(8.dp))
                            Text("Extracting text with Gemini AI OCR...", color = Color.White, fontSize = 11.sp)
                        }
                    } else if (hasCaptured) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.padding(12.dp)) {
                            Icon(Icons.Default.CheckCircle, contentDescription = null, tint = tierAccent(), modifier = Modifier.size(36.dp))
                            Spacer(modifier = Modifier.height(4.dp))
                            Text("OCR Text Extracted Successfully!", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                            Text("${extractedText.split("\\s+".toRegex()).size} words extracted", color = Color.White.copy(alpha = 0.7f), fontSize = 10.sp)
                        }
                    } else {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Icon(Icons.Default.DocumentScanner, contentDescription = null, tint = Color.White, modifier = Modifier.size(36.dp))
                            Spacer(modifier = Modifier.height(4.dp))
                            Text("Select a document image or photo note", color = Color.White.copy(alpha = 0.8f), fontSize = 11.sp)
                            Spacer(modifier = Modifier.height(8.dp))
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                Button(
                                    onClick = { imagePickerLauncher.launch("image/*") },
                                    colors = ButtonDefaults.buttonColors(containerColor = tierTertiary()),
                                    shape = RoundedCornerShape(20.dp)
                                ) {
                                    Icon(Icons.Default.Image, contentDescription = null, modifier = Modifier.size(16.dp))
                                    Spacer(modifier = Modifier.width(4.dp))
                                    Text("Pick Image", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                                }
                            }
                        }
                    }
                }

                OutlinedTextField(
                    value = scanTitle,
                    onValueChange = { scanTitle = it },
                    label = { Text("Scanned Document Title") },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    singleLine = true
                )

                OutlinedTextField(
                    value = extractedText,
                    onValueChange = { extractedText = it },
                    label = { Text("OCR Extracted Text") },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(110.dp),
                    shape = RoundedCornerShape(12.dp)
                )
            }
        },
        confirmButton = {
            // Save only makes sense once a capture produced text (real or Demo) and extraction
            // finished. While isCapturing the cloud OCR row is still being written — saving early
            // would race the extraction and could leave an empty/duplicate document behind.
            val saveEnabled = hasCaptured && !isCapturing
            Button(
                onClick = { onSaveScan(scanTitle, extractedText) },
                enabled = saveEnabled,
                colors = ButtonDefaults.buttonColors(
                    containerColor = tierTertiary(),
                    disabledContainerColor = tierTertiary().copy(alpha = 0.35f),
                    disabledContentColor = Color.White.copy(alpha = 0.7f)
                ),
                shape = RoundedCornerShape(10.dp)
            ) {
                Icon(Icons.Default.Save, contentDescription = null, modifier = Modifier.size(16.dp))
                Spacer(modifier = Modifier.width(6.dp))
                Text(if (isCapturing) "Extracting…" else "Save Document", fontWeight = FontWeight.Bold)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel") }
        }
    )
}

@Composable
/**
 * Parses a "#RRGGBB" folder color to a Compose Color, falling back to indigo.
 */
private fun parseColorOrFallback(hex: String): Color {
    return try {
        Color(android.graphics.Color.parseColor(hex))
    } catch (e: Exception) {
        tierPrimary()
    }
}

@Composable
fun NewFolderDialog(
    onDismiss: () -> Unit,
    onCreate: (name: String, color: String) -> Unit
) {
    var name by remember { mutableStateOf("") }
    var color by remember { mutableStateOf("#3B82F6") }
    val folderColors = listOf(
        "#3B82F6" to tierPrimary(),
        "#10B981" to tierAccent(),
        "#8B5CF6" to tierTertiary(),
        "#F59E0B" to Color(0xFFF59E0B),
        "#EF4444" to Color(0xFFEF4444),
        "#EC4899" to Color(0xFFEC4899)
    )

    AlertDialog(
        onDismissRequest = onDismiss,
        icon = { Icon(Icons.Default.CreateNewFolder, contentDescription = null, tint = tierPrimary(), modifier = Modifier.size(32.dp)) },
        title = { Text("New Folder", fontWeight = FontWeight.Bold, textAlign = TextAlign.Center) },
        text = {
            Column(
                verticalArrangement = Arrangement.spacedBy(14.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Folder name") },
                    placeholder = { Text("e.g. CS101 Lecture Notes") },
                    leadingIcon = { Icon(Icons.Default.Folder, contentDescription = null) },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    singleLine = true
                )

                Text("FOLDER COLOR", style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold, color = tierPrimary())
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceEvenly
                ) {
                    folderColors.forEach { (hex, tint) ->
                        Box(
                            modifier = Modifier
                                .size(34.dp)
                                .clip(CircleShape)
                                .background(tint)
                                .border(
                                    width = if (color == hex) 3.dp else 0.dp,
                                    color = MaterialTheme.colorScheme.onSurface,
                                    shape = CircleShape
                                )
                                .clickable { color = hex },
                            contentAlignment = Alignment.Center
                        ) {
                            if (color == hex) {
                                Icon(Icons.Default.Check, contentDescription = null, tint = Color.White, modifier = Modifier.size(18.dp))
                            }
                        }
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = { onCreate(name.trim().ifBlank { "New Folder" }, color) },
                colors = ButtonDefaults.buttonColors(containerColor = tierPrimary()),
                shape = RoundedCornerShape(10.dp),
                enabled = name.isNotBlank()
            ) {
                Icon(Icons.Default.Check, contentDescription = null, modifier = Modifier.size(16.dp))
                Spacer(modifier = Modifier.width(6.dp))
                Text("Create Folder", fontWeight = FontWeight.Bold)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel") }
        }
    )
}

@Composable
fun MoveToFolderDialog(
    doc: DocumentEntity,
    folders: List<DocumentFolderEntity>,
    onDismiss: () -> Unit,
    onMove: (folderId: String?) -> Unit
) {
    var selectedId by remember { mutableStateOf(doc.folderId) }

    AlertDialog(
        onDismissRequest = onDismiss,
        icon = { Icon(Icons.Default.DriveFileMove, contentDescription = null, tint = tierPrimary(), modifier = Modifier.size(32.dp)) },
        title = { Text("Move to folder", fontWeight = FontWeight.Bold, textAlign = TextAlign.Center) },
        text = {
            Column(
                verticalArrangement = Arrangement.spacedBy(4.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(
                    "'${doc.title}' — pick a folder:",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f),
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )
                Spacer(modifier = Modifier.height(4.dp))

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(10.dp))
                        .clickable { selectedId = null }
                        .padding(horizontal = 10.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    RadioButton(
                        selected = selectedId == null,
                        onClick = { selectedId = null },
                        colors = RadioButtonDefaults.colors(selectedColor = tierPrimary())
                    )
                    Icon(Icons.Default.FolderOff, contentDescription = null, tint = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f), modifier = Modifier.size(18.dp))
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("No folder (root)", fontSize = 13.sp)
                }

                if (folders.isEmpty()) {
                    Text(
                        "No folders yet — create one from the Documents screen.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.55f),
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp)
                    )
                }

                folders.forEach { folder ->
                    val tint = parseColorOrFallback(folder.color)
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(10.dp))
                            .clickable { selectedId = folder.id }
                            .padding(horizontal = 10.dp, vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        RadioButton(
                            selected = selectedId == folder.id,
                            onClick = { selectedId = folder.id },
                            colors = RadioButtonDefaults.colors(selectedColor = tint)
                        )
                        Icon(Icons.Default.Folder, contentDescription = null, tint = tint, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(folder.name, fontSize = 13.sp, fontWeight = if (selectedId == folder.id) FontWeight.Bold else FontWeight.Normal)
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = { onMove(selectedId) },
                colors = ButtonDefaults.buttonColors(containerColor = tierPrimary()),
                shape = RoundedCornerShape(10.dp)
            ) {
                Icon(Icons.Default.DriveFileMove, contentDescription = null, modifier = Modifier.size(16.dp))
                Spacer(modifier = Modifier.width(6.dp))
                Text("Move Here", fontWeight = FontWeight.Bold)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel") }
        }
    )
}

@Composable
fun DocumentAudioNarrationModal(
    doc: DocumentEntity,
    onDismiss: () -> Unit
) {
    var isPlaying by remember { mutableStateOf(true) }
    var audioProgress by remember { mutableFloatStateOf(0.35f) }
    var playbackSpeed by remember { mutableStateOf("1.0x") }

    AlertDialog(
        onDismissRequest = onDismiss,
        icon = { Icon(Icons.AutoMirrored.Filled.VolumeUp, contentDescription = null, tint = tierTertiary(), modifier = Modifier.size(36.dp)) },
        title = { Text("Listen to AI Document Summary", fontWeight = FontWeight.Bold, textAlign = TextAlign.Center) },
        text = {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(12.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(
                    doc.title,
                    fontWeight = FontWeight.Bold,
                    textAlign = TextAlign.Center,
                    style = MaterialTheme.typography.titleMedium,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )

                Surface(
                    shape = RoundedCornerShape(16.dp),
                    color = tierTertiary().copy(alpha = 0.12f),
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 8.dp)
                ) {
                    Row(
                        modifier = Modifier.padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.Center
                    ) {
                        // Animated Equalizer Wave simulation
                        repeat(8) { idx ->
                            val height = if (isPlaying) (16 + (idx % 4) * 8).dp else 8.dp
                            Box(
                                modifier = Modifier
                                    .padding(horizontal = 3.dp)
                                    .width(4.dp)
                                    .height(height)
                                    .background(tierTertiary(), CircleShape)
                            )
                        }
                    }
                }

                Slider(
                    value = audioProgress,
                    onValueChange = { audioProgress = it },
                    modifier = Modifier.fillMaxWidth()
                )

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text("01:14", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f))
                    Text("03:25", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f))
                }

                // Controls Row
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceEvenly,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    FilterChip(
                        selected = false,
                        onClick = {
                            playbackSpeed = when (playbackSpeed) {
                                "1.0x" -> "1.25x"
                                "1.25x" -> "1.5x"
                                "1.5x" -> "2.0x"
                                else -> "1.0x"
                            }
                        },
                        label = { Text(playbackSpeed, fontWeight = FontWeight.Bold) }
                    )

                    IconButton(
                        onClick = { isPlaying = !isPlaying },
                        modifier = Modifier
                            .size(52.dp)
                            .background(tierTertiary(), CircleShape)
                    ) {
                        Icon(
                            imageVector = if (isPlaying) Icons.Default.Pause else Icons.Default.PlayArrow,
                            contentDescription = if (isPlaying) "Pause" else "Play",
                            tint = Color.White,
                            modifier = Modifier.size(28.dp)
                        )
                    }

                    TextButton(onClick = onDismiss) {
                        Text("Done")
                    }
                }
            }
        },
        confirmButton = {}
    )
}
