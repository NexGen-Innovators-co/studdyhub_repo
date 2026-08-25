package com.example.ui.screens.quizzes

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.example.data.local.entities.RoadmapStepEntity
import com.example.data.repository.StuddyHubRepository
import com.example.ui.components.Tactile3DButton
import com.example.ui.components.Tactile3DCard
import com.example.ui.components.TactileSoundSystem
import com.example.ui.components.tactileClick
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LearnItLibraryScreen(
    repository: StuddyHubRepository,
    onBack: () -> Unit = {},
    onOpenStep: (String) -> Unit = {}
) {
    val roadmap by repository.roadmapStepsFlow.collectAsStateWithLifecycle(initialValue = emptyList())
    val roadmapError by repository.roadmapError.collectAsStateWithLifecycle(initialValue = null)
    val coroutineScope = rememberCoroutineScope()
    var selectedSubjectCode by remember { mutableStateOf("ALL") }

    val subjects = listOf(
        "ALL" to "All Lessons 🌟",
        "ENG" to "English 📖",
        "MATH" to "Mathematics 🧮",
        "SCI" to "Science 🌱",
        "SST" to "Social Studies 🇬🇭",
        "ICT" to "Computing 💻"
    )

    val filteredSteps = remember(roadmap, selectedSubjectCode) {
        if (selectedSubjectCode == "ALL") roadmap
        else roadmap.filter { it.subjectCode.equals(selectedSubjectCode, ignoreCase = true) }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text("Learn It 📖 Library", fontWeight = FontWeight.ExtraBold, fontSize = 18.sp)
                        Text("Curriculum Lessons with Read-Aloud Audio", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                }
            )
        }
    ) { innerPadding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
            contentPadding = PaddingValues(top = 8.dp, bottom = 32.dp)
        ) {
            // Subject Filter Bar
            item {
                LazyRow(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    items(subjects) { (code, label) ->
                        val isSelected = selectedSubjectCode == code
                        Surface(
                            shape = RoundedCornerShape(16.dp),
                            color = if (isSelected) Color(0xFF1D4ED8) else Color(0xFFF1F5F9),
                            border = BorderStroke(1.dp, if (isSelected) Color(0xFF1E40AF) else Color(0xFFCBD5E1)),
                            modifier = Modifier.tactileClick(onClick = {
                                selectedSubjectCode = code
                                TactileSoundSystem.playPopSound()
                            })
                        ) {
                            Text(
                                text = label,
                                style = MaterialTheme.typography.labelMedium.copy(
                                    fontWeight = FontWeight.ExtraBold,
                                    color = if (isSelected) Color.White else Color(0xFF334155)
                                ),
                                modifier = Modifier.padding(horizontal = 14.dp, vertical = 8.dp)
                            )
                        }
                    }
                }
            }

            // Lessons List
            if (filteredSteps.isEmpty()) {
                item {
                    // The roadmap is generated live by the backend — when it fails, show the real
                    // response (e.g. edge function missing → HTTP 404) instead of loading forever.
                    if (roadmapError != null && roadmap.isEmpty()) {
                        Column(
                            modifier = Modifier.fillMaxWidth().padding(24.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.Center
                        ) {
                            Text("📚", fontSize = 48.sp)
                            Spacer(modifier = Modifier.height(8.dp))
                            Text("Ollie couldn't build your lessons", fontWeight = FontWeight.Bold, color = Color(0xFF991B1B))
                            Spacer(modifier = Modifier.height(8.dp))
                            Text(
                                text = roadmapError ?: "Please try again.",
                                style = MaterialTheme.typography.bodySmall,
                                color = Color(0xFF7F1D1D),
                                textAlign = TextAlign.Center
                            )
                            Spacer(modifier = Modifier.height(12.dp))
                            OutlinedButton(
                                onClick = {
                                    repository.clearRoadmapError()
                                    coroutineScope.launch { repository.bootstrapKidRoadmap() }
                                },
                                shape = RoundedCornerShape(14.dp)
                            ) { Text("Try Again 🔄", fontWeight = FontWeight.Bold) }
                        }
                    } else {
                        Column(
                            modifier = Modifier.fillMaxWidth().padding(32.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.Center
                        ) {
                            Text("📚", fontSize = 48.sp)
                            Spacer(modifier = Modifier.height(8.dp))
                            Text("Loading Lessons...", fontWeight = FontWeight.Bold, color = Color(0xFF64748B))
                        }
                    }
                }
            } else {
                items(filteredSteps) { step ->
                    val accent = when (step.subjectCode.uppercase()) {
                        "ENG" -> Color(0xFF1D4ED8)
                        "MATH" -> Color(0xFFD97706)
                        "SCI" -> Color(0xFF047857)
                        "SST" -> Color(0xFF6B46C1)
                        "ICT" -> Color(0xFFDB2777)
                        else -> Color(0xFF64748B)
                    }

                    Tactile3DCard(
                        onClick = { onOpenStep(step.id) },
                        containerColor = Color.White,
                        bevelColor = accent.copy(alpha = 0.35f),
                        cornerRadius = 20.dp,
                        elevationDepth = 4.dp,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(16.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(14.dp)
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(48.dp)
                                    .clip(CircleShape)
                                    .background(accent.copy(alpha = 0.15f)),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = if (step.isCompleted) "✅" else "📖",
                                    fontSize = 22.sp
                                )
                            }

                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = step.title,
                                    style = MaterialTheme.typography.titleMedium.copy(
                                        fontWeight = FontWeight.ExtraBold,
                                        color = Color(0xFF0F172A),
                                        fontSize = 15.sp
                                    )
                                )
                                Text(
                                    text = "${step.subjectName} · Week ${step.week} · +${step.xpReward} XP",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = Color(0xFF64748B)
                                )
                            }

                            Surface(
                                shape = RoundedCornerShape(12.dp),
                                color = if (step.isCompleted) Color(0xFF10B981) else accent
                            ) {
                                Text(
                                    text = if (step.isCompleted) "REVIEW 🔄" else "START 🔊",
                                    style = MaterialTheme.typography.labelSmall.copy(
                                        fontWeight = FontWeight.ExtraBold,
                                        color = Color.White,
                                        fontSize = 11.sp
                                    ),
                                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}
