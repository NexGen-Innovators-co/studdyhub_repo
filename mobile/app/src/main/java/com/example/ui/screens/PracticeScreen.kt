package com.example.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CalendarToday
import androidx.compose.material.icons.filled.Quiz
import androidx.compose.material.icons.filled.Style
import androidx.compose.material.icons.filled.TaskAlt
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CenterAlignedTopAppBar
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.example.ui.components.StuddyEmptyState
import com.example.ui.components.StuddyListCard
import com.example.ui.components.StuddySectionHeader
import com.example.ui.components.StuddyStatCard
import com.example.ui.theme.AcademicTier
import com.example.ui.theme.tierAccent
import com.example.ui.theme.StuddyHubThemeTokens
import com.example.ui.theme.tierTertiary
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PracticeScreen(
    viewModel: PracticeViewModel,
    onNavigateToQuizzes: () -> Unit,
    onNavigateToFlashcards: () -> Unit,
    onNavigateToSchedule: () -> Unit,
    onNavigateToAddSchedule: () -> Unit
) {
    val tierColors = StuddyHubThemeTokens.colors
    val tier = StuddyHubThemeTokens.tier
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val timeFormatter = remember { SimpleDateFormat("h:mm a", Locale.getDefault()) }

    Scaffold(
        topBar = {
            CenterAlignedTopAppBar(
                title = {
                    Text(
                        text = if (tier == AcademicTier.ACHIEVER) "Exam Practice ⚡" else "Practice",
                        fontWeight = FontWeight.ExtraBold
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
                .padding(horizontal = 16.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(20.dp)
        ) {
            // Data-first "Due now" card — Practice leads with what's actionable
            // today, not a gradient poster.
            val nextBlockLabel = state.nextScheduleStartMillis?.let { timeFormatter.format(Date(it)) }
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(20.dp),
                colors = CardDefaults.cardColors(
                    containerColor = if (state.flashcardCount > 0 || state.nextScheduleTitle != null)
                        tierAccent().copy(alpha = 0.12f)
                    else
                        MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.55f)
                )
            ) {
                Column(modifier = Modifier.padding(18.dp)) {
                    Text(
                        text = "TODAY'S FOCUS",
                        style = MaterialTheme.typography.labelSmall.copy(
                            fontWeight = FontWeight.Bold,
                            letterSpacing = 1.sp,
                            color = if (state.flashcardCount > 0 || state.nextScheduleTitle != null) tierAccent() else MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f)
                        )
                    )
                    Spacer(modifier = Modifier.height(6.dp))
                    Text(
                        text = when {
                            state.flashcardCount > 0 ->
                                "${state.flashcardCount} card${if (state.flashcardCount == 1) " is" else "s are"} due for review"
                            state.nextScheduleTitle != null ->
                                "Next block: ${state.nextScheduleTitle}"
                            else -> "Nothing due yet — plan your next session"
                        },
                        style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold)
                    )
                    if (nextBlockLabel != null) {
                        Spacer(modifier = Modifier.height(2.dp))
                        Text(
                            text = "Starts $nextBlockLabel",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.65f)
                        )
                    }
                    Spacer(modifier = Modifier.height(14.dp))
                    when {
                        state.flashcardCount > 0 -> Button(
                            onClick = onNavigateToFlashcards,
                            colors = ButtonDefaults.buttonColors(containerColor = tierAccent())
                        ) {
                            Icon(Icons.Default.Style, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("Review flashcards", fontWeight = FontWeight.Bold)
                        }
                        state.nextScheduleTitle != null -> Button(
                            onClick = onNavigateToSchedule,
                            colors = ButtonDefaults.buttonColors(containerColor = tierColors.primary)
                        ) {
                            Icon(Icons.Default.CalendarToday, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("View schedule", fontWeight = FontWeight.Bold)
                        }
                        else -> Button(
                            onClick = onNavigateToAddSchedule,
                            colors = ButtonDefaults.buttonColors(containerColor = tierColors.primary)
                        ) {
                            Icon(Icons.Default.TaskAlt, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("Schedule a session", fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                StuddyStatCard(
                    value = "${state.quizCount}",
                    label = "Quizzes",
                    icon = Icons.Default.Quiz,
                    accent = tierColors.primary,
                    modifier = Modifier.weight(1f),
                    onClick = onNavigateToQuizzes
                )
                StuddyStatCard(
                    value = "${state.flashcardCount}",
                    label = "Cards",
                    icon = Icons.Default.Style,
                    accent = tierAccent(),
                    modifier = Modifier.weight(1f),
                    onClick = onNavigateToFlashcards
                )
            }

            if (state.quizCount == 0 && state.flashcardCount == 0 && state.nextScheduleTitle == null) {
                StuddyEmptyState(
                    emoji = "🎯",
                    title = "Nothing to practice yet",
                    message = "Create a quiz, build flashcards, or schedule a study block and it will show up here.",
                    actionLabel = "Schedule a session",
                    onAction = onNavigateToAddSchedule
                )
            } else {
                StuddySectionHeader(
                    title = "Recommended",
                    subtitle = "Based on your workspace"
                )
                if (state.quizCount > 0) {
                    StuddyListCard(
                        title = "Start a practice quiz",
                        subtitle = if (state.quizCount == 1) "1 quiz in your library" else "${state.quizCount} quizzes in your library",
                        icon = Icons.Default.Quiz,
                        accent = tierColors.primary,
                        trailing = "Go",
                        onClick = onNavigateToQuizzes
                    )
                }
                if (state.flashcardCount > 0) {
                    StuddyListCard(
                        title = "Review flashcards",
                        subtitle = if (state.flashcardCount == 1) "1 card ready to review" else "${state.flashcardCount} cards ready to review",
                        icon = Icons.Default.Style,
                        accent = tierAccent(),
                        trailing = "Go",
                        onClick = onNavigateToFlashcards
                    )
                }
                state.nextScheduleTitle?.let { title ->
                    StuddyListCard(
                        title = "Next up: $title",
                        subtitle = state.nextScheduleStartMillis?.let { timeFormatter.format(Date(it)) } ?: "Upcoming study block",
                        icon = Icons.Default.CalendarToday,
                        accent = tierTertiary(),
                        trailing = "Go",
                        onClick = onNavigateToSchedule
                    )
                }
            }

            StuddySectionHeader(
                title = "Plan ahead",
                subtitle = "Stay on track"
            )
            StuddyListCard(
                title = "Add a study session",
                subtitle = "Create a new task or exam study block for your week.",
                icon = Icons.Default.TaskAlt,
                accent = tierColors.primaryVariant,
                trailing = "Add",
                onClick = onNavigateToAddSchedule
            )

            // Clearance so the last card isn't hidden behind the floating pill nav.
            Spacer(modifier = Modifier.height(80.dp))
        }
    }
}
