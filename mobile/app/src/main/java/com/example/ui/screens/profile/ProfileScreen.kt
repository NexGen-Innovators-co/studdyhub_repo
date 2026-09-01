package com.example.ui.screens.profile

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
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
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.R
import com.example.ui.components.OllieMascot
import com.example.ui.components.OllieMood
import com.example.ui.components.StreakCalendarWidget
import com.example.ui.theme.AcademicTier
import com.example.ui.theme.Radius
import com.example.ui.theme.Spacing
import com.example.ui.theme.StuddyHubThemeTokens
import com.example.ui.theme.tierAccent
import com.example.ui.theme.tierPrimary
import com.example.ui.theme.tierTertiary

private data class BadgeItem(
    val name: String,
    val desc: String,
    val icon: androidx.compose.ui.graphics.vector.ImageVector,
    val color: Color
)

@Composable
fun ProfileScreen(
    profileState: ProfileUiState,
    onOpenSyncDetails: () -> Unit = {},
    onUpdateEducationContext: ((school: String, grade: String, subjects: List<com.example.data.local.EducationSubjectRef>) -> Unit)? = null
) {
    val userTier = AcademicTier.fromKey(profileState.profile?.academicTier)
    val tierColors = StuddyHubThemeTokens.colors
    var showEditEducationDialog by remember { mutableStateOf(false) }

    val badges = listOf(
        BadgeItem(
            name = "Streak Scholar",
            desc = "${profileState.stats?.currentStreak ?: 0} Day Streak",
            icon = Icons.Default.LocalFireDepartment,
            color = Color(0xFFF97316)
        ),
        BadgeItem(
            name = "Quiz Champion",
            desc = "${profileState.stats?.totalQuizzesCompleted ?: 0} Quizzes Passed",
            icon = Icons.Default.EmojiEvents,
            color = tierAccent()
        ),
        BadgeItem(
            name = "AI Master",
            desc = "${profileState.notesCount} Notes • ${profileState.flashcardsCount} Cards",
            icon = Icons.Default.AutoAwesome,
            color = tierTertiary()
        ),
        BadgeItem(
            name = "Audio Scholar",
            desc = "${profileState.recordingsCount} Lectures • Podcasts Coming Soon",
            icon = Icons.Default.Headphones,
            color = tierPrimary()
        )
    )

    if (showEditEducationDialog && onUpdateEducationContext != null) {
        val currentGrade = profileState.educationProfile?.yearOrGrade?.takeIf { it.isNotBlank() } ?: "Basic 4"
        val currentSchool = profileState.educationProfile?.institutionName?.takeIf { it.isNotBlank() }
            ?: profileState.profile?.school?.takeIf { it.isNotBlank() } ?: "School"
        val currentEnrolledCodes = remember(profileState.enrolledSubjects) {
            profileState.enrolledSubjects.map { it.code.uppercase() }.toSet()
                .ifEmpty { setOf("ENG", "MATH", "SCI", "SST") }
        }

        var editSchool by remember { mutableStateOf(currentSchool) }
        var editGrade by remember { mutableStateOf(currentGrade) }
        val availableGrades = remember {
            listOf("Basic 1", "Basic 2", "Basic 3", "Basic 4", "Basic 5", "Basic 6", "JHS 1", "JHS 2", "JHS 3", "SHS 1", "SHS 2", "SHS 3")
        }
        val allAvailableSubjects = remember {
            com.example.data.local.KidsCurriculum.fallbackCoreSubjects()
        }
        var selectedSubjectCodes by remember {
            mutableStateOf(currentEnrolledCodes)
        }

        AlertDialog(
            onDismissRequest = { showEditEducationDialog = false },
            title = {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.School, contentDescription = null, tint = tierColors.primary)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("My Class & Subjects", fontWeight = FontWeight.Bold)
                }
            },
            text = {
                Column(
                    modifier = Modifier.fillMaxWidth(),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    OutlinedTextField(
                        value = editSchool,
                        onValueChange = { editSchool = it },
                        label = { Text("School Name") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )

                    Text("Class / Grade Level:", style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold)
                    androidx.compose.foundation.lazy.LazyRow(
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        items(availableGrades.size) { idx ->
                            val g = availableGrades[idx]
                            val isSelected = editGrade.equals(g, ignoreCase = true)
                            FilterChip(
                                selected = isSelected,
                                onClick = { editGrade = g },
                                label = { Text(g) }
                            )
                        }
                    }

                    Text("Active Subjects & Electives:", style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold)
                    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        allAvailableSubjects.forEach { subj ->
                            val isChecked = selectedSubjectCodes.contains(subj.code.uppercase())
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(8.dp))
                                    .clickable {
                                        selectedSubjectCodes = if (isChecked) {
                                            if (selectedSubjectCodes.size > 1) selectedSubjectCodes - subj.code.uppercase() else selectedSubjectCodes
                                        } else {
                                            selectedSubjectCodes + subj.code.uppercase()
                                        }
                                    }
                                    .padding(vertical = 4.dp, horizontal = 6.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Checkbox(
                                    checked = isChecked,
                                    onCheckedChange = { checked ->
                                        selectedSubjectCodes = if (checked) {
                                            selectedSubjectCodes + subj.code.uppercase()
                                        } else {
                                            if (selectedSubjectCodes.size > 1) selectedSubjectCodes - subj.code.uppercase() else selectedSubjectCodes
                                        }
                                    }
                                )
                                Spacer(modifier = Modifier.width(6.dp))
                                Text(subj.name, style = MaterialTheme.typography.bodyMedium)
                            }
                        }
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        val chosenRefs = allAvailableSubjects.filter { selectedSubjectCodes.contains(it.code.uppercase()) }
                        onUpdateEducationContext(editSchool, editGrade, chosenRefs)
                        showEditEducationDialog = false
                    }
                ) {
                    Text("Save & Regenerate Roadmap 🚀")
                }
            },
            dismissButton = {
                TextButton(onClick = { showEditEducationDialog = false }) {
                    Text("Cancel")
                }
            }
        )
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
        contentPadding = PaddingValues(vertical = 16.dp)
    ) {
        // Ollie Mascot greeting
        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(Radius.lg),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.35f)),
                border = BorderStroke(1.dp, tierColors.cardBorder.copy(alpha = 0.5f))
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(Spacing.cardPadding),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(Spacing.md)
                ) {
                    OllieMascot(
                        mood = OllieMood.GREETING,
                        tier = userTier,
                        size = 64.dp,
                        showSpeechBubble = false
                    )
                    Column(modifier = Modifier.weight(1f)) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            Text(
                                text = userTier.mascotRole,
                                style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                                color = tierColors.primary
                            )
                            Text(userTier.emoji, fontSize = 16.sp)
                        }
                        Text(
                            text = when (userTier) {
                                AcademicTier.EXPLORER -> "Ready for today's fun study adventure? Let's explore together!"
                                AcademicTier.ACHIEVER -> "Locked in for high scores! What topic are we mastering today?"
                                AcademicTier.SCHOLAR -> "Welcome back, Scholar. Ready for deep analysis and research?"
                                AcademicTier.ALL -> "Ready to learn today? Let's explore together!"
                            },
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.75f)
                        )
                    }
                }
            }
        }

        // Profile Card — Avatar, Name, Email, Tier Badge, School
        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(20.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f)),
                border = BorderStroke(1.dp, tierColors.cardBorder.copy(alpha = 0.4f))
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(20.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    val avatarUrl = profileState.profile?.avatarUrl
                    val is3DAvatar = com.example.ui.components.AvatarRegistry.findAvatar(avatarUrl) != null

                    if (is3DAvatar) {
                        com.example.ui.components.Avatar3DRenderer(
                            avatarIdOrEmoji = avatarUrl,
                            size = 84.dp,
                            showAura = true,
                            isAnimated = true
                        )
                    } else {
                        Surface(
                            shape = CircleShape,
                            color = tierColors.primary,
                            modifier = Modifier.size(72.dp)
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                if (!avatarUrl.isNullOrBlank()) {
                                    coil.compose.AsyncImage(
                                        model = avatarUrl,
                                        contentDescription = "Profile picture",
                                        modifier = Modifier
                                            .fillMaxSize()
                                            .clip(CircleShape),
                                        contentScale = ContentScale.Crop
                                    )
                                } else {
                                    Text(
                                        text = (profileState.profile?.fullName?.takeIf { it.isNotBlank() } ?: "Scholar").take(1).uppercase(),
                                        style = MaterialTheme.typography.headlineMedium.copy(
                                            color = Color.White,
                                            fontWeight = FontWeight.Bold
                                        )
                                    )
                                }
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(12.dp))

                    Text(
                        text = profileState.profile?.fullName?.takeIf { it.isNotBlank() } ?: "Scholar",
                        style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold)
                    )

                    Text(
                        text = profileState.profile?.email?.takeIf { it.isNotBlank() } ?: "No Email Address",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)
                    )

                    Spacer(modifier = Modifier.height(10.dp))

                    Row(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Surface(
                            shape = RoundedCornerShape(Radius.pill),
                            color = tierColors.pillBackground,
                            border = BorderStroke(1.dp, tierColors.primary.copy(alpha = 0.4f))
                        ) {
                            Text(
                                text = "${userTier.emoji} ${userTier.displayName} Mode",
                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp),
                                style = MaterialTheme.typography.labelMedium.copy(
                                    color = tierColors.primary,
                                    fontWeight = FontWeight.Bold
                                )
                            )
                        }

                        val schoolText = profileState.profile?.school?.takeIf { it.isNotBlank() } ?: "Academic Workspace"
                        Surface(
                            shape = RoundedCornerShape(Radius.pill),
                            color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.6f)
                        ) {
                            Text(
                                text = schoolText,
                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp),
                                style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Medium)
                            )
                        }
                    }
                }
            }
        }

        // 7-Day Streak Calendar
        item {
            StreakCalendarWidget(
                currentStreak = profileState.stats?.currentStreak ?: 0,
                streakFreezes = 0
            )
        }

        // Points & AI Credits Balance
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Card(
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f))
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.MonetizationOn, contentDescription = null, tint = tierAccent())
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("Points Balance", style = MaterialTheme.typography.labelMedium)
                        }
                        Spacer(modifier = Modifier.height(6.dp))
                        Text(
                            text = "${profileState.profile?.pointsBalance ?: 0} pts",
                            style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold)
                        )
                    }
                }

                Card(
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f))
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.AutoAwesome, contentDescription = null, tint = tierPrimary())
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("AI Credits", style = MaterialTheme.typography.labelMedium)
                        }
                        Spacer(modifier = Modifier.height(6.dp))
                        Text(
                            text = "${profileState.profile?.bonusAiCredits ?: 0} AI",
                            style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold)
                        )
                    }
                }
            }
        }


        // Gamification Badges
        item {
            Text(
                text = "Earned Badges & Activity",
                style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold)
            )
        }

        item {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                badges.chunked(2).forEach { rowBadges ->
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        rowBadges.forEach { badge ->
                            Card(
                                modifier = Modifier.weight(1f),
                                shape = RoundedCornerShape(12.dp),
                                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.25f))
                            ) {
                                Row(
                                    modifier = Modifier.padding(12.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Icon(
                                        imageVector = badge.icon,
                                        contentDescription = badge.name,
                                        tint = badge.color,
                                        modifier = Modifier.size(28.dp)
                                    )
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Column {
                                        Text(
                                            text = badge.name,
                                            style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold)
                                        )
                                        Text(
                                            text = badge.desc,
                                            style = MaterialTheme.typography.labelSmall,
                                            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // App Branding
        item {
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 8.dp),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f))
            ) {
                Row(
                    modifier = Modifier.padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Image(
                        painter = painterResource(id = R.drawable.img_app_icon),
                        contentDescription = "StuddyHub App Icon",
                        modifier = Modifier
                            .size(48.dp)
                            .clip(RoundedCornerShape(12.dp)),
                        contentScale = ContentScale.Crop
                    )
                    Spacer(modifier = Modifier.width(14.dp))
                    Column {
                        Text("StuddyHub Workspace", style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold))
                        Text("Version 2.5.0 • Powered by AI", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f))
                    }
                }
            }
        }
    }
}
