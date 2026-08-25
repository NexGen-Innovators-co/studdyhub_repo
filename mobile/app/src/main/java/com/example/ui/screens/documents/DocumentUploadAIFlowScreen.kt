package com.example.ui.screens.documents

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.R
import com.example.ui.theme.tierPrimary

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun DocumentUploadAIFlowScreen(
    viewModel: DocumentsViewModel,
    onBack: () -> Unit
) {
    val uiState by viewModel.uiState.collectAsState()
    var mode by remember { mutableStateOf(0) } // 0 = AI Flow, 1 = Quick Add
    var docTitle by remember { mutableStateOf("") }
    var docType by remember { mutableStateOf("PDF") }
    var docContent by remember { mutableStateOf("") }

    // AI Chat Flow messages
    var chatInput by remember { mutableStateOf("") }
    val messages = remember {
        mutableStateListOf(
            "Hi! I'm Ollie. Paste or describe any syllabus, lecture slide, or textbook chapter, and I'll turn it into structured study notes saved straight to your workspace!",
            "You can type out notes or paste text directly here, or switch to Quick Add above."
        )
    }

    Scaffold(
        topBar = {
            TopAppBar(
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                title = { Text("AI Document Importer", fontWeight = FontWeight.Bold) },
                actions = {
                    SingleChoiceSegmentedButtonRow(modifier = Modifier.padding(end = 12.dp)) {
                        SegmentedButton(
                            selected = mode == 0,
                            onClick = { mode = 0 },
                            shape = SegmentedButtonDefaults.itemShape(index = 0, count = 2)
                        ) {
                            Text("AI Flow", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        }
                        SegmentedButton(
                            selected = mode == 1,
                            onClick = { mode = 1 },
                            shape = SegmentedButtonDefaults.itemShape(index = 1, count = 2)
                        ) {
                            Text("Quick Add", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            )
        }
    ) { innerPadding ->
        if (mode == 0) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding)
            ) {
                LazyColumn(
                    modifier = Modifier
                        .weight(1f)
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    item {
                        Card(
                            colors = CardDefaults.cardColors(containerColor = tierPrimary().copy(alpha = 0.08f)),
                            shape = RoundedCornerShape(16.dp)
                        ) {
                            Row(modifier = Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                                Image(painter = painterResource(id = R.drawable.img_study_mascot), contentDescription = null, modifier = Modifier.size(44.dp).clip(CircleShape))
                                Spacer(modifier = Modifier.width(12.dp))
                                Column {
                                    Text("Real AI Document Processing", style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold, color = tierPrimary()))
                                    Text("StuddyHub will automatically summarize and pull out the key study concepts.", style = MaterialTheme.typography.bodySmall)
                                }
                            }
                        }
                    }

                    items(messages) { msg ->
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Start) {
                            Image(painter = painterResource(id = R.drawable.img_study_mascot), contentDescription = null, modifier = Modifier.size(32.dp).clip(CircleShape))
                            Spacer(modifier = Modifier.width(8.dp))
                            Surface(shape = RoundedCornerShape(16.dp), color = MaterialTheme.colorScheme.surfaceVariant, modifier = Modifier.widthIn(max = 280.dp)) {
                                Text(msg, modifier = Modifier.padding(12.dp), style = MaterialTheme.typography.bodyMedium)
                            }
                        }
                    }

                    if (uiState.isUploading) {
                        item {
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(8.dp)) {
                                CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp, color = tierPrimary())
                                Text("Ollie is analyzing and saving your document...", style = MaterialTheme.typography.bodySmall, color = tierPrimary())
                            }
                        }
                    }
                }

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    OutlinedTextField(
                        value = chatInput,
                        onValueChange = { chatInput = it },
                        placeholder = { Text("Paste document text or topic...") },
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(24.dp),
                        enabled = !uiState.isUploading
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    IconButton(
                        onClick = {
                            if (chatInput.isNotBlank() && !uiState.isUploading) {
                                val userText = chatInput
                                messages.add("User: $userText")
                                chatInput = ""
                                viewModel.processAIFlowDocument(userText) { aiResult ->
                                    messages.add("Ollie: Your document is processed and saved!\n\n${aiResult.take(200)}...")
                                }
                            }
                        },
                        modifier = Modifier.size(48.dp).background(tierPrimary(), CircleShape),
                        enabled = !uiState.isUploading
                    ) {
                        Icon(Icons.AutoMirrored.Filled.Send, contentDescription = "Send", tint = Color.White)
                    }
                }
            }
        } else {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding)
                    .padding(20.dp)
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                Text("Quick Add Document", style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold, color = tierPrimary()))

                OutlinedTextField(
                    value = docTitle,
                    onValueChange = { docTitle = it },
                    label = { Text("Document Title *") },
                    modifier = Modifier.fillMaxWidth()
                )

                Column {
                    Text("File Format", style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(top = 4.dp)) {
                        listOf("PDF", "DOCX", "TXT", "PPTX").forEach { fmt ->
                            FilterChip(
                                selected = docType == fmt,
                                onClick = { docType = fmt },
                                label = { Text(fmt) }
                            )
                        }
                    }
                }

                OutlinedTextField(
                    value = docContent,
                    onValueChange = { docContent = it },
                    label = { Text("Document Content / Notes") },
                    modifier = Modifier.fillMaxWidth().height(140.dp)
                )

                if (uiState.isUploading) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        CircularProgressIndicator(modifier = Modifier.size(24.dp), strokeWidth = 2.dp, color = tierPrimary())
                        Text("Processing and saving...", style = MaterialTheme.typography.bodyMedium, color = tierPrimary())
                    }
                }

                Button(
                    onClick = {
                        if (docTitle.isNotBlank() && !uiState.isUploading) {
                            viewModel.uploadDocumentAndProcess(
                                title = docTitle,
                                fileName = "${docTitle.lowercase().replace(" ", "_")}.${docType.lowercase()}",
                                fileType = docType,
                                fileSizeKb = 250,
                                content = docContent.ifBlank { "Document content for $docTitle" },
                                autoExtractSummary = true,
                                onSuccess = onBack
                            )
                        }
                    },
                    modifier = Modifier.fillMaxWidth().height(50.dp),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = tierPrimary()),
                    enabled = !uiState.isUploading
                ) {
                    Icon(Icons.Default.UploadFile, contentDescription = null)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(if (uiState.isUploading) "Processing Document..." else "Upload Document", fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}
