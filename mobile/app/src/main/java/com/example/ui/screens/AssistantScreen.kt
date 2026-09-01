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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CalendarToday
import androidx.compose.material.icons.filled.Headphones
import androidx.compose.material.icons.filled.MenuBook
import androidx.compose.material.icons.filled.Psychology
import androidx.compose.material.icons.filled.Quiz
import androidx.compose.material.icons.filled.Style
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CenterAlignedTopAppBar
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.platform.LocalContext
import com.example.ui.components.StuddyListCard
import com.example.ui.components.StuddySectionHeader
import com.example.ui.components.StuddyTileCard
import com.example.ui.theme.tierAccent
import com.example.ui.theme.tierPrimary
import com.example.ui.theme.tierSecondary
import com.example.ui.theme.tierTertiary

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AssistantScreen(
    onNavigateToAIChat: () -> Unit,
    onNavigateToAIPodcast: () -> Unit,
    onNavigateToAddSchedule: () -> Unit,
    onNavigateToCreateQuiz: () -> Unit,
    onNavigateToCreateNote: () -> Unit,
    onNavigateToCreateFlashcards: () -> Unit,
    onShowComingSoon: (() -> Unit)? = null
) {
    val context = LocalContext.current
    Scaffold(
        topBar = {
            CenterAlignedTopAppBar(
                title = { Text("Assistant", fontWeight = FontWeight.ExtraBold) }
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
            // Solid-color anchor card (tonal, not gradient) — the one gradient moment
            // in the app stays on the Dashboard greeting.
            Surface(
                shape = RoundedCornerShape(20.dp),
                color = tierTertiary().copy(alpha = 0.12f),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier.padding(18.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Surface(
                        shape = CircleShape,
                        color = tierTertiary(),
                        modifier = Modifier.size(48.dp)
                    ) {
                        androidx.compose.foundation.layout.Box(contentAlignment = Alignment.Center, modifier = Modifier.fillMaxSize()) {
                            Icon(
                                imageVector = Icons.Default.Psychology,
                                contentDescription = null,
                                tint = Color.White,
                                modifier = Modifier.size(24.dp)
                            )
                        }
                    }
                    Spacer(modifier = Modifier.width(14.dp))
                    androidx.compose.foundation.layout.Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = "Meet your AI tutor",
                            style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold)
                        )
                        Text(
                            text = "Homework help, exam prep, or note review — get answers that stick.",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.65f)
                        )
                    }
                }
            }
            Button(
                onClick = onNavigateToAIChat,
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(14.dp),
                colors = ButtonDefaults.buttonColors(containerColor = tierPrimary())
            ) {
                Icon(Icons.Default.Psychology, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(modifier = Modifier.width(6.dp))
                Text("Open AI Tutor", fontWeight = FontWeight.Bold)
            }

            StuddySectionHeader(
                title = "Create tools",
                subtitle = "In seconds"
            )

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                StuddyTileCard(
                    title = "Generate Quiz",
                    subtitle = "Create practice questions",
                    icon = Icons.Default.Quiz,
                    accent = tierTertiary(),
                    modifier = Modifier.weight(1f),
                    onClick = onNavigateToCreateQuiz
                )
                StuddyTileCard(
                    title = "Create Notes",
                    subtitle = "Summarize new ideas",
                    icon = Icons.Default.MenuBook,
                    accent = tierPrimary(),
                    modifier = Modifier.weight(1f),
                    onClick = onNavigateToCreateNote
                )
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                StuddyTileCard(
                    title = "Flashcards",
                    subtitle = "Build study cards",
                    icon = Icons.Default.Style,
                    accent = tierSecondary(),
                    modifier = Modifier.weight(1f),
                    onClick = onNavigateToCreateFlashcards
                )
                StuddyTileCard(
                    title = "AI Podcast",
                    subtitle = "Coming Soon",
                    icon = Icons.Default.Headphones,
                    accent = tierAccent(),
                    modifier = Modifier.weight(1f),
                    onClick = { android.widget.Toast.makeText(context, "AI Podcast coming soon!", android.widget.Toast.LENGTH_SHORT).show() }
                )
            }

            StuddySectionHeader(
                title = "Stay on schedule",
                subtitle = "Planning"
            )
            StuddyListCard(
                title = "Plan your next study session",
                subtitle = "Use AI prompts to schedule your next review block.",
                icon = Icons.Default.CalendarToday,
                accent = tierTertiary(),
                trailing = "Plan",
                onClick = onNavigateToAddSchedule
            )

            // Clearance so the last card isn't hidden behind the floating pill nav.
            Spacer(modifier = Modifier.height(80.dp))
        }
    }
}
