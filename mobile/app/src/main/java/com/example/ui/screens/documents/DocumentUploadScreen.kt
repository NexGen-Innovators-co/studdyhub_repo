package com.example.ui.screens.documents

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.*
import androidx.compose.foundation.BorderStroke
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.ui.theme.tierAccent
import com.example.ui.theme.tierPrimary
import com.example.ui.theme.tierTertiary
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun DocumentUploadScreen(
    viewModel: DocumentsViewModel,
    onNavigateBack: () -> Unit
) {
    val coroutineScope = rememberCoroutineScope()
    val context = LocalContext.current

    val uiState by viewModel.uiState.collectAsState()

    var selectedType by remember { mutableStateOf("PDF") }
    var documentTitle by remember { mutableStateOf("") }
    var selectedCategory by remember { mutableStateOf("Lecture Notes") }
    var customCategory by remember { mutableStateOf("") }
    var inputFileName by remember { mutableStateOf("") }
    var inputFileSizeKb by remember { mutableStateOf(0) }
    var extractedTextContent by remember { mutableStateOf("") }
    var extractSummaryToggle by remember { mutableStateOf(true) }
    var selectedFileBytes by remember { mutableStateOf<ByteArray?>(null) }

    val filePickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent()
    ) { uri: android.net.Uri? ->
        uri?.let { fileUri ->
            try {
                val contentResolver = context.contentResolver
                var name = "Document_${System.currentTimeMillis()}"
                var sizeBytes = 0L

                contentResolver.query(fileUri, null, null, null, null)?.use { cursor ->
                    if (cursor.moveToFirst()) {
                        val nameIndex = cursor.getColumnIndex(android.provider.OpenableColumns.DISPLAY_NAME)
                        val sizeIndex = cursor.getColumnIndex(android.provider.OpenableColumns.SIZE)
                        if (nameIndex != -1) name = cursor.getString(nameIndex) ?: name
                        if (sizeIndex != -1) sizeBytes = cursor.getLong(sizeIndex)
                    }
                }

                inputFileName = name
                inputFileSizeKb = (sizeBytes / 1024L).toInt().coerceAtLeast(10)
                if (documentTitle.isBlank()) {
                    documentTitle = name.substringBeforeLast(".")
                }

                val ext = name.substringAfterLast(".", "").lowercase()
                selectedType = when (ext) {
                    "pdf" -> "PDF"
                    "docx", "doc" -> "DOCX"
                    "txt", "md" -> "TXT"
                    "pptx", "ppt" -> "PPTX"
                    "png", "jpg", "jpeg", "webp" -> "IMAGE"
                    else -> selectedType
                }

                contentResolver.openInputStream(fileUri)?.use { stream ->
                    val bytes = stream.readBytes()
                    selectedFileBytes = bytes
                    if (ext in listOf("txt", "md", "csv", "json", "html")) {
                        extractedTextContent = String(bytes, Charsets.UTF_8).replace("\u0000", "").trim()
                    } else {
                        // PDFs and Office files are binary: decoding them as UTF-8 yields object
                        // streams and mojibake, which is what made the AI reply "this is a raw PDF".
                        // Hand the real bytes to Gemini, which reads PDFs and images natively.
                        val mime = com.example.util.DocumentTextCleaner.nativeMimeTypeFor(name)
                            ?: contentResolver.getType(fileUri)
                            ?: "application/octet-stream"
                        extractedTextContent = ""
                        val base64 = android.util.Base64.encodeToString(bytes, android.util.Base64.NO_WRAP)
                        coroutineScope.launch {
                            viewModel.extractDocumentText(base64, mime, name) { text ->
                                extractedTextContent = text
                            }
                        }
                    }
                }
            } catch (e: Exception) {
                android.util.Log.e("DocumentUpload", "Error picking file: ${e.message}")
            }
        }
    }

    val fileTypes = listOf("PDF", "DOCX", "TXT", "PPTX", "IMAGE")
    val categories = listOf("Lecture Notes", "Assignment", "Syllabus & Coursework", "Textbook Chapter", "Exam Prep")

    Scaffold(
        topBar = {
            TopAppBar(
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                title = {
                    Text(
                        text = "Upload Study Document",
                        style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold)
                    )
                }
            )
        }
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .verticalScroll(rememberScrollState())
                .padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(20.dp)
        ) {
            // Document Format Chips
            Column {
                Text(
                    text = "SELECT DOCUMENT TYPE",
                    style = MaterialTheme.typography.labelSmall.copy(
                        fontWeight = FontWeight.ExtraBold,
                        color = tierPrimary(),
                        letterSpacing = 1.sp
                    )
                )
                Spacer(modifier = Modifier.height(8.dp))
                FlowRow(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    fileTypes.forEach { type ->
                        val isSelected = selectedType == type
                        FilterChip(
                            selected = isSelected,
                            onClick = {
                                selectedType = type
                            },
                            label = { Text(type, fontWeight = FontWeight.Bold) },
                            leadingIcon = if (isSelected) {
                                { Icon(Icons.Default.Check, contentDescription = null, modifier = Modifier.size(16.dp)) }
                            } else null,
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = tierPrimary(),
                                selectedLabelColor = Color.White
                            )
                        )
                    }
                }
            }

            // File Dropzone / Picker Card
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .border(
                        BorderStroke(1.5.dp, tierPrimary().copy(alpha = 0.4f)),
                        RoundedCornerShape(20.dp)
                    ),
                shape = RoundedCornerShape(20.dp),
                colors = CardDefaults.cardColors(containerColor = tierPrimary().copy(alpha = 0.05f))
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Surface(
                        shape = CircleShape,
                        color = tierPrimary().copy(alpha = 0.12f),
                        modifier = Modifier.size(64.dp)
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Icon(
                                imageVector = when (selectedType) {
                                    "PDF" -> Icons.Default.PictureAsPdf
                                    "DOCX" -> Icons.Default.Description
                                    "TXT" -> Icons.Default.Article
                                    "PPTX" -> Icons.Default.Slideshow
                                    else -> Icons.Default.Image
                                },
                                contentDescription = null,
                                tint = tierPrimary(),
                                modifier = Modifier.size(32.dp)
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(14.dp))

                    Text(
                        text = if (inputFileName.isBlank()) "No file selected yet" else "File Name: $inputFileName",
                        style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold),
                        textAlign = TextAlign.Center
                    )

                    Text(
                        text = if (inputFileSizeKb > 0) "Size: ${String.format("%.1f", inputFileSizeKb / 1024f)} MB • Format: $selectedType" else "Pick a file to auto-detect its type",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f),
                        modifier = Modifier.padding(top = 4.dp)
                    )

                    Spacer(modifier = Modifier.height(16.dp))

                    Row(
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Button(
                            onClick = { filePickerLauncher.launch("*/*") },
                            shape = RoundedCornerShape(12.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = tierPrimary())
                        ) {
                            Icon(Icons.Default.FolderOpen, contentDescription = null, modifier = Modifier.size(18.dp))
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("Browse Device File", fontWeight = FontWeight.Bold)
                        }


                    }
                }
            }

            // Document Details Input Section
            Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
                Text(
                    text = "DOCUMENT METADATA",
                    style = MaterialTheme.typography.labelSmall.copy(
                        fontWeight = FontWeight.ExtraBold,
                        color = tierPrimary(),
                        letterSpacing = 1.sp
                    )
                )

                OutlinedTextField(
                    value = documentTitle,
                    onValueChange = { documentTitle = it },
                    label = { Text("Document Title") },
                    placeholder = { Text("e.g., Organic Chemistry Chapter 4 Notes") },
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("upload_title_field"),
                    shape = RoundedCornerShape(14.dp),
                    singleLine = true
                )

                // Category Tag: quick picks plus a custom field so users aren't locked
                // into the static list. The final category is saved as a document folder.
                Column {
                    Text(
                        text = "Category Tag",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f),
                        modifier = Modifier.padding(bottom = 6.dp)
                    )
                    FlowRow(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        categories.forEach { cat ->
                            val isSelected = selectedCategory == cat && customCategory.isBlank()
                            SuggestionChip(
                                onClick = {
                                    selectedCategory = cat
                                    customCategory = ""
                                },
                                label = { Text(cat, style = MaterialTheme.typography.bodySmall) },
                                colors = SuggestionChipDefaults.suggestionChipColors(
                                    containerColor = if (isSelected) tierTertiary() else MaterialTheme.colorScheme.surfaceVariant,
                                    labelColor = if (isSelected) Color.White else MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            )
                        }
                    }
                    Spacer(modifier = Modifier.height(8.dp))
                    OutlinedTextField(
                        value = customCategory,
                        onValueChange = { customCategory = it.take(40) },
                        placeholder = { Text("Or type your own tag (e.g. Physics Lab)") },
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(14.dp),
                        singleLine = true
                    )
                }

                OutlinedTextField(
                    value = extractedTextContent,
                    onValueChange = { extractedTextContent = it },
                    label = { Text("Document Text / Key Notes Content") },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(14.dp),
                    minLines = 3,
                    maxLines = 6
                )

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(14.dp))
                        .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f))
                        .padding(14.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text("Auto-Extract Concept Summary", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.bodyMedium)
                        Text("Generate AI study notes & flashcards on DB save", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f))
                    }
                    Switch(
                        checked = extractSummaryToggle,
                        onCheckedChange = { extractSummaryToggle = it },
                        colors = SwitchDefaults.colors(checkedThumbColor = tierAccent(), checkedTrackColor = tierAccent().copy(alpha = 0.3f))
                    )
                }
            }

            // Real AI Upload & Processing Indicator
            if (uiState.isUploading) {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
                ) {
                    Row(
                        modifier = Modifier.padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        CircularProgressIndicator(modifier = Modifier.size(28.dp), color = tierPrimary(), strokeWidth = 3.dp)
                        Column {
                            Text(
                                text = "Processing document with Gemini AI...",
                                style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Bold),
                                color = tierPrimary()
                            )
                            Text(
                                text = "Extracting key concepts and saving...",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
                            )
                        }
                    }
                }
            }

            // Action Button
            Button(
                onClick = {
                    val finalTitle = documentTitle.ifBlank { inputFileName.substringBeforeLast(".") }
                    viewModel.uploadDocumentAndProcess(
                        title = finalTitle,
                        fileName = inputFileName,
                        fileType = selectedType,
                        fileSizeKb = inputFileSizeKb,
                        content = extractedTextContent,
                        autoExtractSummary = extractSummaryToggle,
                        rawBytes = selectedFileBytes,
                        category = if (customCategory.isNotBlank()) customCategory else selectedCategory,
                        onSuccess = { onNavigateBack() }
                    )
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(54.dp)
                    .testTag("submit_upload_button"),
                shape = RoundedCornerShape(16.dp),
                colors = ButtonDefaults.buttonColors(containerColor = tierPrimary()),
                enabled = !uiState.isUploading && (inputFileName.isNotBlank() || extractedTextContent.isNotBlank())
            ) {
                Icon(Icons.Default.CloudUpload, contentDescription = null)
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = when {
                        uiState.isUploading && extractedTextContent.isBlank() && selectedFileBytes != null ->
                            "Reading document..."
                        uiState.isUploading -> "AI Processing & Saving..."
                        else -> "Upload Document"
                    },
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold
                )
            }
        }
    }
}
