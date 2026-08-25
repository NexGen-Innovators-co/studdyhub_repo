package com.example.ui.screens.quizzes

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.*
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.R
import com.example.ui.components.OllieMascot
import com.example.ui.components.OllieMood
import com.example.ui.components.Tactile3DButton
import com.example.ui.components.Tactile3DCard
import com.example.ui.components.TactileSoundSystem
import com.example.ui.theme.AcademicTier

/**
 * 🎮 Explorer Kid-Friendly Arcade & Subject Quiz Center.
 * Designed specifically for young learners:
 * - High-contrast visual game and topic cards with rich illustrations
 * - 1-Tap custom subject challenge launcher
 * - Tactile sound effects and feedback
 * - Direct access to 1v1 Battles and Spelling Bee
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ExplorerArcadeHub(
    state: QuizzesUiState,
    viewModel: QuizzesViewModel,
    onBack: () -> Unit,
    onLaunchGame: (gameKey: String) -> Unit,
    onOpenMultiplayer: () -> Unit,
    onOpenTrophies: () -> Unit
) {
    val context = LocalContext.current
    var showCustomQuizSheet by remember { mutableStateOf(false) }
    var selectedSubject by remember { mutableStateOf(EXPLORER_SUBJECTS.first()) }
    var selectedDifficulty by remember { mutableStateOf("easy") }
    var selectedQuestionCount by remember { mutableIntStateOf(5) }

    Scaffold(
        topBar = {
            TopAppBar(
                navigationIcon = {
                    IconButton(onClick = {
                        TactileSoundSystem.playPopSound()
                        onBack()
                    }) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                title = {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Text("🎮 Quiz Quest & Arcade", fontWeight = FontWeight.Black)
                    }
                },
                actions = {
                    Surface(
                        shape = RoundedCornerShape(12.dp),
                        color = Color(0xFFFEF3C7),
                        modifier = Modifier.padding(end = 12.dp)
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            Text("⭐", fontSize = 14.sp)
                            Text(
                                text = "Fun Arcade",
                                style = MaterialTheme.typography.labelSmall.copy(
                                    fontWeight = FontWeight.ExtraBold,
                                    color = Color(0xFFB45309)
                                )
                            )
                        }
                    }
                }
            )
        },
        containerColor = MaterialTheme.colorScheme.background
    ) { innerPadding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
            contentPadding = PaddingValues(top = 8.dp, bottom = 90.dp)
        ) {
            // 1. Hero Arcade Banner
            item {
                Card(
                    shape = RoundedCornerShape(24.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(140.dp)
                    ) {
                        Image(
                            painter = painterResource(id = R.drawable.explorer_arcade_banner_1787426442864),
                            contentDescription = "Arcade Banner",
                            modifier = Modifier.fillMaxSize(),
                            contentScale = ContentScale.Crop
                        )
                        Box(
                            modifier = Modifier
                                .fillMaxSize()
                                .background(
                                    Brush.verticalGradient(
                                        listOf(Color.Transparent, Color.Black.copy(alpha = 0.8f))
                                    )
                                )
                        )

                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(16.dp)
                                .align(Alignment.BottomStart),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            OllieMascot(
                                tier = AcademicTier.EXPLORER,
                                mood = OllieMood.CELEBRATING,
                                size = 48.dp
                            )
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = "Ready to Play & Win?",
                                    style = MaterialTheme.typography.titleMedium.copy(
                                        fontWeight = FontWeight.Black,
                                        color = Color.White
                                    )
                                )
                                Text(
                                    text = "Pick a subject game or start a custom quest!",
                                    style = MaterialTheme.typography.bodySmall.copy(
                                        color = Color.White.copy(alpha = 0.9f)
                                    )
                                )
                            }
                        }
                    }
                }
            }

            // 2. Primary 1-Tap CTA: Custom Subject Challenge Generator
            item {
                Tactile3DCard(
                    onClick = {
                        TactileSoundSystem.playPopSound()
                        showCustomQuizSheet = true
                    },
                    containerColor = Color(0xFF2563EB),
                    bevelColor = Color(0xFF1D4ED8),
                    cornerRadius = 20.dp,
                    elevationDepth = 5.dp,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(14.dp)
                    ) {
                        Surface(
                            shape = CircleShape,
                            color = Color.White.copy(alpha = 0.25f),
                            modifier = Modifier.size(48.dp)
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                Text("⚡", fontSize = 24.sp)
                            }
                        }
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = "Start Subject Challenge",
                                style = MaterialTheme.typography.titleMedium.copy(
                                    fontWeight = FontWeight.ExtraBold,
                                    color = Color.White
                                )
                            )
                            Text(
                                text = "Pick Maths, English, or Science & test your skills!",
                                style = MaterialTheme.typography.bodySmall.copy(
                                    color = Color.White.copy(alpha = 0.9f)
                                )
                            )
                        }
                        Icon(
                            imageVector = Icons.Default.PlayArrow,
                            contentDescription = "Start",
                            tint = Color.White,
                            modifier = Modifier.size(28.dp)
                        )
                    }
                }
            }

            // 3. Featured Educational Games
            item {
                Text(
                    text = "Featured Explorer Games 🎮",
                    style = MaterialTheme.typography.titleMedium.copy(
                        fontWeight = FontWeight.ExtraBold,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                )
            }

            item {
                Column(
                    modifier = Modifier.fillMaxWidth(),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    // Math Asteroid Blaster
                    ArcadeGameRow(
                        title = "Math Asteroid Blaster",
                        subtitle = "Shoot asteroids with laser math!",
                        category = "SPACE ARCADE",
                        emoji = "🚀",
                        bannerResId = R.drawable.explorer_arcade_banner_1787426442864,
                        accentColor = Color(0xFFEF4444),
                        onClick = { onLaunchGame("math_asteroid_blaster") }
                    )

                    // Oware Math
                    ArcadeGameRow(
                        title = "Oware Math Challenge",
                        subtitle = "Fast arithmetic, counting & mental math",
                        category = "MATHEMATICS",
                        emoji = "🔢",
                        bannerResId = R.drawable.img_oware_math_1786717198699,
                        accentColor = Color(0xFFD97706),
                        onClick = { onLaunchGame("maths_quest") }
                    )

                    // Spelling Bee
                    ArcadeGameRow(
                        title = "Spelling Bee Champion",
                        subtitle = "Listen to words, assemble letters & build vocabulary",
                        category = "ENGLISH",
                        emoji = "🐝",
                        bannerResId = R.drawable.explorer_arcade_banner_1787426442864,
                        accentColor = Color(0xFF2563EB),
                        onClick = { onLaunchGame("spelling_bee") }
                    )

                    // Science Explorer
                    ArcadeGameRow(
                        title = "Science Discovery Lab",
                        subtitle = "Plants, energy, weather & natural wonders",
                        category = "SCIENCE",
                        emoji = "🧪",
                        bannerResId = R.drawable.explorer_science_arcade_1787430264662,
                        accentColor = Color(0xFF059669),
                        onClick = { onLaunchGame("science_explorer") }
                    )

                    // Ananse Riddles
                    ArcadeGameRow(
                        title = "Ananse Wisdom Riddles",
                        subtitle = "Solve traditional Ghanaian folktale riddles",
                        category = "LOGIC & WISDOM",
                        emoji = "🕸️",
                        bannerResId = R.drawable.img_ananse_riddles_1786717187634,
                        accentColor = Color(0xFF7C3AED),
                        onClick = { onLaunchGame("ananse_riddles") }
                    )

                    // Kente Heritage Quiz
                    ArcadeGameRow(
                        title = "Kente & Heritage Lore",
                        subtitle = "Adinkra symbols, history & national culture",
                        category = "HERITAGE",
                        emoji = "🇬🇭",
                        bannerResId = R.drawable.img_kente_quiz_1786717209972,
                        accentColor = Color(0xFFDB2777),
                        onClick = { onLaunchGame("kente_quiz") }
                    )
                }
            }

            // 4. Multiplayer Battle & Trophies Hub Cards
            item {
                Text(
                    text = "Battle & Achievements 🏆",
                    style = MaterialTheme.typography.titleMedium.copy(
                        fontWeight = FontWeight.ExtraBold,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                )
            }

            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Tactile3DCard(
                        onClick = {
                            TactileSoundSystem.playPopSound()
                            onOpenMultiplayer()
                        },
                        containerColor = Color(0xFFFF6B00),
                        bevelColor = Color(0xFFD95000),
                        cornerRadius = 18.dp,
                        elevationDepth = 4.dp,
                        modifier = Modifier.weight(1f)
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(14.dp),
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Text("⚔️", fontSize = 24.sp)
                            Text(
                                text = "1v1 Battle Arena",
                                style = MaterialTheme.typography.titleSmall.copy(
                                    fontWeight = FontWeight.Black,
                                    color = Color.White
                                )
                            )
                            Text(
                                text = "Race against friends live!",
                                style = MaterialTheme.typography.bodySmall.copy(
                                    color = Color.White.copy(alpha = 0.9f),
                                    fontSize = 11.sp
                                )
                            )
                        }
                    }

                    Tactile3DCard(
                        onClick = {
                            TactileSoundSystem.playPopSound()
                            onOpenTrophies()
                        },
                        containerColor = Color(0xFF7C3AED),
                        bevelColor = Color(0xFF5B21B6),
                        cornerRadius = 18.dp,
                        elevationDepth = 4.dp,
                        modifier = Modifier.weight(1f)
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(14.dp),
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Text("🏅", fontSize = 24.sp)
                            Text(
                                text = "Star Trophies",
                                style = MaterialTheme.typography.titleSmall.copy(
                                    fontWeight = FontWeight.Black,
                                    color = Color.White
                                )
                            )
                            Text(
                                text = "View badges & rewards",
                                style = MaterialTheme.typography.bodySmall.copy(
                                    color = Color.White.copy(alpha = 0.9f),
                                    fontSize = 11.sp
                                )
                            )
                        }
                    }
                }
            }
        }
    }

    // ── Kid-Friendly Custom Quiz Builder Dialog ──
    if (showCustomQuizSheet) {
        AlertDialog(
            onDismissRequest = { showCustomQuizSheet = false },
            title = {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text("🚀 New Subject Challenge", fontWeight = FontWeight.Black)
                }
            },
            text = {
                Column(
                    modifier = Modifier.fillMaxWidth(),
                    verticalArrangement = Arrangement.spacedBy(14.dp)
                ) {
                    Text(
                        text = "1. Pick your Subject:",
                        style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold)
                    )

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        EXPLORER_SUBJECTS.forEach { subject ->
                            val isSelected = selectedSubject.code == subject.code
                            Surface(
                                shape = RoundedCornerShape(12.dp),
                                color = if (isSelected) subject.color else MaterialTheme.colorScheme.surfaceVariant,
                                modifier = Modifier
                                    .weight(1f)
                                    .clickable {
                                        TactileSoundSystem.playPopSound()
                                        selectedSubject = subject
                                    }
                            ) {
                                Column(
                                    modifier = Modifier.padding(vertical = 10.dp, horizontal = 4.dp),
                                    horizontalAlignment = Alignment.CenterHorizontally
                                ) {
                                    Text(subject.emoji, fontSize = 20.sp)
                                    Text(
                                        text = subject.name,
                                        style = MaterialTheme.typography.labelSmall.copy(
                                            fontWeight = FontWeight.ExtraBold,
                                            color = if (isSelected) Color.White else MaterialTheme.colorScheme.onSurface,
                                            fontSize = 9.5.sp
                                        ),
                                        maxLines = 1
                                    )
                                }
                            }
                        }
                    }

                    Text(
                        text = "2. Pick Difficulty:",
                        style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold)
                    )

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        listOf(
                            Triple("easy", "🟢 Explorer (Easy)", Color(0xFF10B981)),
                            Triple("medium", "🟡 Hero (Medium)", Color(0xFFF59E0B)),
                            Triple("hard", "🔴 Champion (Hard)", Color(0xFFEF4444))
                        ).forEach { (diffKey, label, color) ->
                            val isSelected = selectedDifficulty == diffKey
                            Surface(
                                shape = RoundedCornerShape(10.dp),
                                color = if (isSelected) color.copy(alpha = 0.2f) else MaterialTheme.colorScheme.surfaceVariant,
                                border = BorderStroke(if (isSelected) 1.5.dp else 0.dp, if (isSelected) color else Color.Transparent),
                                modifier = Modifier
                                    .weight(1f)
                                    .clickable {
                                        TactileSoundSystem.playPopSound()
                                        selectedDifficulty = diffKey
                                    }
                            ) {
                                Box(
                                    modifier = Modifier.padding(vertical = 8.dp),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text(
                                        text = label,
                                        style = MaterialTheme.typography.labelSmall.copy(
                                            fontWeight = FontWeight.ExtraBold,
                                            color = if (isSelected) color else MaterialTheme.colorScheme.onSurface,
                                            fontSize = 9.sp
                                        )
                                    )
                                }
                            }
                        }
                    }

                    Text(
                        text = "3. How many questions?",
                        style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold)
                    )

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        listOf(5 to "5 Questions ⚡", 10 to "10 Questions 🎯").forEach { (count, label) ->
                            val isSelected = selectedQuestionCount == count
                            Surface(
                                shape = RoundedCornerShape(10.dp),
                                color = if (isSelected) Color(0xFF2563EB) else MaterialTheme.colorScheme.surfaceVariant,
                                modifier = Modifier
                                    .weight(1f)
                                    .clickable {
                                        TactileSoundSystem.playPopSound()
                                        selectedQuestionCount = count
                                    }
                            ) {
                                Box(
                                    modifier = Modifier.padding(vertical = 8.dp),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text(
                                        text = label,
                                        style = MaterialTheme.typography.labelSmall.copy(
                                            fontWeight = FontWeight.ExtraBold,
                                            color = if (isSelected) Color.White else MaterialTheme.colorScheme.onSurface
                                        )
                                    )
                                }
                            }
                        }
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        TactileSoundSystem.playCelebrationBeep()
                        showCustomQuizSheet = false
                        viewModel.generateQuizFromTopic(
                            topic = "${selectedSubject.name} Explorer Challenge",
                            focusAreas = listOf(selectedSubject.name),
                            config = QuizConfig(
                                topic = "${selectedSubject.name} Quest",
                                difficulty = selectedDifficulty,
                                questionCount = selectedQuestionCount,
                                timeLimitSec = 20
                            )
                        )
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = selectedSubject.color),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Text("START QUEST 🚀", fontWeight = FontWeight.Black, color = Color.White)
                }
            },
            dismissButton = {
                TextButton(onClick = { showCustomQuizSheet = false }) {
                    Text("Cancel")
                }
            }
        )
    }
}

@Composable
private fun ArcadeGameRow(
    title: String,
    subtitle: String,
    category: String,
    emoji: String,
    bannerResId: Int,
    accentColor: Color,
    onClick: () -> Unit
) {
    Card(
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
        modifier = Modifier
            .fillMaxWidth()
            .clickable {
                TactileSoundSystem.playPopSound()
                onClick()
            }
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            Box(
                modifier = Modifier
                    .size(68.dp)
                    .clip(RoundedCornerShape(16.dp))
            ) {
                Image(
                    painter = painterResource(id = bannerResId),
                    contentDescription = title,
                    modifier = Modifier.fillMaxSize(),
                    contentScale = ContentScale.Crop
                )
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(Color.Black.copy(alpha = 0.35f))
                )
                Text(
                    text = emoji,
                    fontSize = 26.sp,
                    modifier = Modifier.align(Alignment.Center)
                )
            }

            Column(modifier = Modifier.weight(1f)) {
                Surface(
                    shape = RoundedCornerShape(6.dp),
                    color = accentColor.copy(alpha = 0.15f)
                ) {
                    Text(
                        text = category,
                        style = MaterialTheme.typography.labelSmall.copy(
                            fontWeight = FontWeight.ExtraBold,
                            color = accentColor,
                            fontSize = 8.5.sp
                        ),
                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                    )
                }
                Spacer(modifier = Modifier.height(2.dp))
                Text(
                    text = title,
                    style = MaterialTheme.typography.titleSmall.copy(
                        fontWeight = FontWeight.ExtraBold,
                        color = MaterialTheme.colorScheme.onSurface
                    ),
                    maxLines = 1
                )
                Text(
                    text = subtitle,
                    style = MaterialTheme.typography.bodySmall.copy(
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        fontSize = 11.sp
                    ),
                    maxLines = 1
                )
            }

            Surface(
                shape = CircleShape,
                color = accentColor,
                modifier = Modifier.size(36.dp)
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(
                        imageVector = Icons.Default.PlayArrow,
                        contentDescription = "Play",
                        tint = Color.White,
                        modifier = Modifier.size(20.dp)
                    )
                }
            }
        }
    }
}

data class ExplorerSubject(
    val code: String,
    val name: String,
    val emoji: String,
    val color: Color
)

val EXPLORER_SUBJECTS = listOf(
    ExplorerSubject("MATH", "Maths", "🔢", Color(0xFFD97706)),
    ExplorerSubject("ENG", "English", "📖", Color(0xFF2563EB)),
    ExplorerSubject("SCI", "Science", "🧪", Color(0xFF059669)),
    ExplorerSubject("SST", "Ghana Lore", "🇬🇭", Color(0xFF7C3AED)),
    ExplorerSubject("ICT", "Tech & ICT", "💻", Color(0xFFDB2777))
)
