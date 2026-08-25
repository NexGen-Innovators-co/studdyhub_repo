package com.example.ui.screens.flashcards

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
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.example.R
import com.example.ui.theme.tierPrimary

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun FlashcardsAIFlowScreen(
    viewModel: FlashcardsViewModel,
    onBack: () -> Unit
) {
    var mode by remember { mutableStateOf(0) } // 0 = AI Flow, 1 = Quick Add
    var frontText by remember { mutableStateOf("") }
    var backText by remember { mutableStateOf("") }
    var category by remember { mutableStateOf("General") }
    var hintText by remember { mutableStateOf("") }

    var chatInput by remember { mutableStateOf("") }
    val isGenerating by viewModel.isAIGenerating.collectAsStateWithLifecycle()
    val generationStatus by viewModel.generationMessage.collectAsStateWithLifecycle()
    val messages = remember {
        mutableStateListOf(
            "Hi! I'm Ollie. What topic or concept would you like to build flashcards for?",
            "e.g. 'Generate 5 cards for Object-Oriented Programming principles'."
        )
    }
    var lastUserPrompt by remember { mutableStateOf<String?>(null) }

    // Surface the AI result (success or failure) as an Ollie message.
    LaunchedEffect(generationStatus, isGenerating) {
        if (!isGenerating && generationStatus.isNotBlank()) {
            messages.add(generationStatus)
            viewModel.clearGenerationMessage()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                title = { Text("AI Flashcard Builder", fontWeight = FontWeight.Bold) },
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
                                    Text("Generative Flashcards", style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold, color = tierPrimary()))
                                    Text("Tell Ollie what you want to memorize and cards will be created instantly.", style = MaterialTheme.typography.bodySmall)
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
                    item {
                        lastUserPrompt?.let { prompt ->
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                                Surface(shape = RoundedCornerShape(16.dp), color = tierPrimary()) {
                                    Text(prompt, modifier = Modifier.padding(12.dp), style = MaterialTheme.typography.bodyMedium, color = Color.White)
                                }
                            }
                        }
                    }
                    if (isGenerating) {
                        item {
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Start) {
                                Image(painter = painterResource(id = R.drawable.img_study_mascot), contentDescription = null, modifier = Modifier.size(32.dp).clip(CircleShape))
                                Spacer(modifier = Modifier.width(8.dp))
                                Surface(shape = RoundedCornerShape(16.dp), color = MaterialTheme.colorScheme.surfaceVariant) {
                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        modifier = Modifier.padding(12.dp)
                                    ) {
                                        CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp, color = tierPrimary())
                                        Spacer(modifier = Modifier.width(8.dp))
                                        Text("Generating flashcards…", style = MaterialTheme.typography.bodyMedium)
                                    }
                                }
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
                        placeholder = { Text("Topic or Q&A pair...") },
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(24.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    IconButton(
                        onClick = {
                            if (chatInput.isNotBlank() && !isGenerating) {
                                val prompt = chatInput.trim()
                                messages.add(prompt)
                                lastUserPrompt = prompt
                                chatInput = ""
                                viewModel.generateFlashcardsFromTopic(prompt)
                            }
                        },
                        enabled = !isGenerating,
                        modifier = Modifier.size(48.dp).background(tierPrimary(), CircleShape)
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
                Text("Quick Add Flashcard", style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold, color = tierPrimary()))

                OutlinedTextField(
                    value = frontText,
                    onValueChange = { frontText = it },
                    label = { Text("Front (Question / Term) *") },
                    modifier = Modifier.fillMaxWidth()
                )

                OutlinedTextField(
                    value = backText,
                    onValueChange = { backText = it },
                    label = { Text("Back (Answer / Definition) *") },
                    modifier = Modifier.fillMaxWidth().height(100.dp)
                )

                OutlinedTextField(
                    value = category,
                    onValueChange = { category = it },
                    label = { Text("Category / Tag") },
                    modifier = Modifier.fillMaxWidth()
                )

                OutlinedTextField(
                    value = hintText,
                    onValueChange = { hintText = it },
                    label = { Text("Optional Hint") },
                    modifier = Modifier.fillMaxWidth()
                )

                Button(
                    onClick = {
                        if (frontText.isNotBlank() && backText.isNotBlank()) {
                            viewModel.addFlashcard(
                                front = frontText,
                                back = backText,
                                category = category,
                                difficulty = "medium",
                                hint = hintText
                            )
                            onBack()
                        }
                    },
                    modifier = Modifier.fillMaxWidth().height(50.dp),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = tierPrimary())
                ) {
                    Icon(Icons.Default.AddCard, contentDescription = null)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Add Flashcard", fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}
