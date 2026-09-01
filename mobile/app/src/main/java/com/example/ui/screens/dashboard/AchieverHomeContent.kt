package com.example.ui.screens.dashboard

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.ui.components.AICompanionFAB
import com.example.ui.components.studdyPressScale
import com.example.ui.navigation.Screen
import com.example.ui.theme.AcademicTier
import com.example.ui.theme.tierPrimary
import com.example.ui.theme.WarningAmber

/**
 * ⚡ Achiever (Senior High / WASSCE Prep) Home Layout.
 * Contains:
 * 1. Target Exam & Sprint Header
 * 2. WASSCE Exam Countdown Banner & Daily Question Target Bar
 * 3. High-Yield Subject Shortcuts Grid (Core Maths, Science, English, Social Studies)
 * 4. Error Bank & Timed Drill Launchers
 * 5. Revision Summary Quick Resume
 * 6. Master Kwame / WASSCE Coach AI Companion FAB
 */
@Composable
fun AchieverHomeContent(
    state: DashboardUiState,
    onNavigate: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    Box(modifier = modifier.fillMaxSize()) {
        val listState = rememberLazyListState()

        LazyColumn(
            state = listState,
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 18.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // 1. WASSCE Countdown & Daily Sprint Card
            item(key = "wassce_countdown") {
                Card(
                    modifier = Modifier
                        .fillMaxWidth(),
                    shape = RoundedCornerShape(22.dp),
                    colors = CardDefaults.cardColors(containerColor = tierPrimary())
                ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(20.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            Surface(
                                shape = RoundedCornerShape(12.dp),
                                color = Color.White.copy(alpha = 0.2f),
                                modifier = Modifier.size(40.dp)
                            ) {
                                Box(contentAlignment = Alignment.Center) {
                                    Icon(
                                        imageVector = Icons.Default.Bolt,
                                        contentDescription = null,
                                        tint = Color.White,
                                        modifier = Modifier.size(24.dp)
                                    )
                                }
                            }
                            Column {
                                Text(
                                    text = "WASSCE 2026 Sprint",
                                    style = MaterialTheme.typography.titleMedium.copy(
                                        fontWeight = FontWeight.ExtraBold,
                                        color = Color.White
                                    )
                                )
                                Text(
                                    text = "High-Yield Mastery Mode",
                                    style = MaterialTheme.typography.labelSmall.copy(
                                        color = Color.White.copy(alpha = 0.8f)
                                    )
                                )
                            }
                        }

                        // Countdown Pill — compute days until next WASSCE exam (typically late May)
                        val examDate = remember {
                            val cal = java.util.Calendar.getInstance()
                            val now = java.util.Calendar.getInstance()
                            // Target late May of the current or next year
                            cal.set(java.util.Calendar.MONTH, java.util.Calendar.MAY)
                            cal.set(java.util.Calendar.DAY_OF_MONTH, 31)
                            cal.set(java.util.Calendar.HOUR_OF_DAY, 23)
                            cal.set(java.util.Calendar.MINUTE, 59)
                            if (cal.before(now)) {
                                cal.add(java.util.Calendar.YEAR, 1)
                            }
                            val diff = cal.timeInMillis - now.timeInMillis
                            (diff / (1000L * 60 * 60 * 24)).toInt().coerceAtLeast(0)
                        }
                        Surface(
                            shape = RoundedCornerShape(12.dp),
                            color = WarningAmber
                        ) {
                            Text(
                                text = "⏳ $examDate DAYS",
                                style = MaterialTheme.typography.labelSmall.copy(
                                    fontWeight = FontWeight.ExtraBold,
                                    color = Color.Black,
                                    fontSize = 11.sp
                                ),
                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                            )
                        }
                    }

                    // Daily Target Bar
                    Surface(
                        shape = RoundedCornerShape(14.dp),
                        color = Color.White.copy(alpha = 0.12f),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(
                            modifier = Modifier.padding(12.dp),
                            verticalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Text(
                                    text = "Today's Target: 7 / 10 Questions",
                                    style = MaterialTheme.typography.labelSmall.copy(
                                        fontWeight = FontWeight.Bold,
                                        color = Color.White
                                    )
                                )
                                Text(
                                    text = "70%",
                                    style = MaterialTheme.typography.labelSmall.copy(
                                        fontWeight = FontWeight.ExtraBold,
                                        color = WarningAmber
                                    )
                                )
                            }
                            LinearProgressIndicator(
                                progress = { 0.7f },
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(8.dp)
                                    .clip(RoundedCornerShape(4.dp)),
                                color = WarningAmber,
                                trackColor = Color.White.copy(alpha = 0.2f),
                            )
                        }
                    }
                }
            }
        }

        // 2. High-Yield Practice Shortcuts
        item(key = "high_yield_practice") {
            Row(
                modifier = Modifier
                    .fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Core Subject Drills",
                    style = MaterialTheme.typography.titleMedium.copy(
                        fontWeight = FontWeight.ExtraBold,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                )
                TextButton(onClick = { onNavigate(Screen.Quizzes.route) }) {
                    Text("Past Questions", fontWeight = FontWeight.Bold)
                }
            }
            Spacer(modifier = Modifier.height(6.dp))

            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    SubjectDrillCard(
                        title = "Core Maths",
                        tag = "2024 Past Paper",
                        color = Color(0xFF3B82F6),
                        icon = Icons.Default.Calculate,
                        modifier = Modifier.weight(1f),
                        onClick = { onNavigate(Screen.Quizzes.route) }
                    )
                    SubjectDrillCard(
                        title = "Int. Science",
                        tag = "High-Yield Obj",
                        color = Color(0xFF10B981),
                        icon = Icons.Default.Biotech,
                        modifier = Modifier.weight(1f),
                        onClick = { onNavigate(Screen.Quizzes.route) }
                    )
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    SubjectDrillCard(
                        title = "English Lang",
                        tag = "Comprehension",
                        color = Color(0xFF8B5CF6),
                        icon = Icons.Default.MenuBook,
                        modifier = Modifier.weight(1f),
                        onClick = { onNavigate(Screen.Quizzes.route) }
                    )
                    SubjectDrillCard(
                        title = "Social Studies",
                        tag = "Section B Theory",
                        color = Color(0xFFF59E0B),
                        icon = Icons.Default.Public,
                        modifier = Modifier.weight(1f),
                        onClick = { onNavigate(Screen.Quizzes.route) }
                    )
                }
            }
        }

        // 3. Quick Action Launchers (Timed Mock & Error Bank)
        item(key = "exam_tools") {
            Column(
                modifier = Modifier
            ) {
                Text(
                    text = "Exam Tools",
                    style = MaterialTheme.typography.titleMedium.copy(
                        fontWeight = FontWeight.ExtraBold,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                )
                Spacer(modifier = Modifier.height(8.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Card(
                        modifier = Modifier
                            .weight(1f)
                            .studdyPressScale()
                            .clickable { onNavigate(Screen.Quizzes.route) },
                        shape = RoundedCornerShape(16.dp),
                        colors = CardDefaults.cardColors(containerColor = Color(0xFFFEF2F2)),
                        border = BorderStroke(1.dp, Color(0xFFFECACA))
                    ) {
                        Row(
                            modifier = Modifier.padding(14.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            Surface(
                                shape = CircleShape,
                                color = Color(0xFFEF4444).copy(alpha = 0.15f),
                                modifier = Modifier.size(36.dp)
                            ) {
                                Box(contentAlignment = Alignment.Center) {
                                    Icon(Icons.Default.ErrorOutline, contentDescription = null, tint = Color(0xFFEF4444), modifier = Modifier.size(20.dp))
                                }
                            }
                            Column {
                                Text("Missed Bank", fontWeight = FontWeight.Bold, fontSize = 13.sp, color = Color(0xFF991B1B))
                                Text("14 questions", fontSize = 11.sp, color = Color(0xFFB91C1C))
                            }
                        }
                    }

                    Card(
                        modifier = Modifier
                            .weight(1f)
                            .studdyPressScale()
                            .clickable { onNavigate(Screen.Flashcards.route) },
                        shape = RoundedCornerShape(16.dp),
                        colors = CardDefaults.cardColors(containerColor = Color(0xFFF0FDF4)),
                        border = BorderStroke(1.dp, Color(0xFFBBF7D0))
                    ) {
                        Row(
                            modifier = Modifier.padding(14.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            Surface(
                                shape = CircleShape,
                                color = Color(0xFF10B981).copy(alpha = 0.15f),
                                modifier = Modifier.size(36.dp)
                            ) {
                                Box(contentAlignment = Alignment.Center) {
                                    Icon(Icons.Default.Style, contentDescription = null, tint = Color(0xFF10B981), modifier = Modifier.size(20.dp))
                                }
                            }
                            Column {
                                Text("Formula Vault", fontWeight = FontWeight.Bold, fontSize = 13.sp, color = Color(0xFF065F46))
                                Text("Active Recall", fontSize = 11.sp, color = Color(0xFF047857))
                            }
                        }
                    }
                }
            }
        }

        // 4. Continue Revision Note (if available)
        val lastNote = state.lastActiveNote ?: state.notes.firstOrNull()
        if (lastNote != null) {
            item(key = "revision_note_${lastNote.id}") {
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { onNavigate(Screen.NoteDetail.createRoute(lastNote.id)) },
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)),
                    border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f))
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(14.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Surface(
                            shape = RoundedCornerShape(10.dp),
                            color = tierPrimary().copy(alpha = 0.15f),
                            modifier = Modifier.size(40.dp)
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                Icon(Icons.Default.EditNote, contentDescription = null, tint = tierPrimary())
                            }
                        }
                        Column(modifier = Modifier.weight(1f)) {
                            Text("Resume Revision Summary", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            Text(lastNote.title, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.bodyMedium, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        }
                        Icon(Icons.Default.ChevronRight, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }
        }

        item(key = "bottom_spacer") {
            Spacer(modifier = Modifier.height(80.dp))
        }
    }

    // Floating AI WASSCE Coach FAB — opens the shared, tier-branded AI Tutor screen
    AICompanionFAB(
        tier = AcademicTier.ACHIEVER,
        modifier = Modifier
            .align(Alignment.BottomEnd)
            .padding(end = 20.dp, bottom = 20.dp),
        onOpenCompanion = { onNavigate(Screen.AIChat.route) }
    )
}
}

@Composable
private fun SubjectDrillCard(
    title: String,
    tag: String,
    color: Color,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    modifier: Modifier = Modifier,
    onClick: () -> Unit
) {
    Surface(
        shape = RoundedCornerShape(16.dp),
        color = color.copy(alpha = 0.1f),
        border = BorderStroke(1.dp, color.copy(alpha = 0.3f)),
        modifier = modifier
            .studdyPressScale()
            .clickable(onClick = onClick)
    ) {
        Column(
            modifier = Modifier.padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            Icon(icon, contentDescription = null, tint = color, modifier = Modifier.size(24.dp))
            Text(title, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleSmall, color = MaterialTheme.colorScheme.onSurface)
            Text(tag, fontSize = 11.sp, color = color, fontWeight = FontWeight.SemiBold)
        }
    }
}
