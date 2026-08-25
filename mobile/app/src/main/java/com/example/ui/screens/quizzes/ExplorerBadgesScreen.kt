package com.example.ui.screens.quizzes

import androidx.compose.animation.*
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
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
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import com.example.R
import com.example.ui.components.Tactile3DButton
import com.example.ui.components.Tactile3DCard
import com.example.ui.components.TactileSoundSystem
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.example.ui.components.tactileClick

data class ExplorerTrophyBadge(
    val id: String,
    val title: String,
    val subtitle: String,
    val iconEmoji: String,
    val adinkraMeaning: String,
    val requirement: String,
    val isUnlocked: Boolean,
    val progress: Float,
    val rewardXp: Int,
    val category: String,
    val themeColor: Color,
    val bevelColor: Color,
    @androidx.annotation.DrawableRes val drawableRes: Int? = null
)

/**
 * Badge unlock data computed from live user progress (game progress, streaks, lesson completions, speed quizzes).
 * Passed into [buildExplorerBadges] to replace the previously hardcoded isUnlocked flags.
 */
data class BadgeProgress(
    val currentStreak: Int = 0,
    val kenteQuizStars: Int = 0,    // Best star rating for kente_quiz
    val mathsQuestCount: Int = 0,    // Total maths_quest games completed
    val spellingBeeCount: Int = 0,   // Total spelling_bee games completed
    val scienceLessonsCompleted: Int = 0,
    val sstLessonsCompleted: Int = 0,
    val totalLessonsCompleted: Int = 0,
    val hasCompletedSpeedRound: Boolean = false,
    val speedChallengeBestSeconds: Int = 0
)

/**
 * Builds the badge list with unlock status derived from [progress] instead of hardcoded values.
 * This replaces the previous static [GHANAIAN_BADGES] so badges reflect real user activity.
 */
fun buildExplorerBadges(progress: BadgeProgress): List<ExplorerTrophyBadge> {
    val streakUnlocked = progress.currentStreak >= 3
    val kenteUnlocked = progress.kenteQuizStars >= 3
    val mathsUnlocked = progress.mathsQuestCount >= 20
    val spellingUnlocked = progress.spellingBeeCount >= 15
    val scientistUnlocked = progress.scienceLessonsCompleted >= 3
    val blackStarUnlocked = progress.sstLessonsCompleted >= 5
    val speedUnlocked = progress.hasCompletedSpeedRound || (progress.speedChallengeBestSeconds in 1..45)
    val allRoundUnlocked = streakUnlocked && kenteUnlocked && mathsUnlocked &&
            spellingUnlocked && scientistUnlocked && blackStarUnlocked && speedUnlocked

    return listOf(
    ExplorerTrophyBadge(
        id = "badge_adinkra",
        title = "Adinkra Sage",
        subtitle = "Cultural Wisdom 👑",
        iconEmoji = "🏛️",
        adinkraMeaning = "'Gye Nyame' — Symbol of deep wisdom, supreme knowledge and heritage.",
        requirement = "Score 3 stars in the Kente Quiz",
        isUnlocked = kenteUnlocked,
        progress = (progress.kenteQuizStars / 3f).coerceIn(0f, 1f),
        rewardXp = 150,
        category = "CULTURE",
        themeColor = Color(0xFFFEF3C7),
        bevelColor = Color(0xFFFDE68A),
        drawableRes = R.drawable.img_badge_adinkra_1787333607984
    ),
    ExplorerTrophyBadge(
        id = "badge_oware",
        title = "Oware Grandmaster",
        subtitle = "Number Wizard 🧮",
        iconEmoji = "🧮",
        adinkraMeaning = "'Akoma Ntoaso' — Harmony of mind and agile calculation.",
        requirement = "Solve 20 quick addition and subtraction math quests",
        isUnlocked = mathsUnlocked,
        progress = (progress.mathsQuestCount / 20f).coerceIn(0f, 1f),
        rewardXp = 200,
        category = "MATH",
        themeColor = Color(0xFFFFEDD5),
        bevelColor = Color(0xFFFED7AA),
        drawableRes = R.drawable.img_badge_oware_1787333621590
    ),
    ExplorerTrophyBadge(
        id = "badge_spelling",
        title = "Spelling Bee Ace",
        subtitle = "Vocabulary Champion 🐝",
        iconEmoji = "🐝",
        adinkraMeaning = "'Nea Onnim No Sua A, Ohu' — One who reads and learns discovers all truth.",
        requirement = "Spell 15 words accurately in the National Word Bee",
        isUnlocked = spellingUnlocked,
        progress = (progress.spellingBeeCount / 15f).coerceIn(0f, 1f),
        rewardXp = 120,
        category = "ENGLISH",
        themeColor = Color(0xFFDEF0FD),
        bevelColor = Color(0xFFBAE6FD),
        drawableRes = R.drawable.img_badge_spelling_1787333633448
    ),
    ExplorerTrophyBadge(
        id = "badge_black_star",
        title = "Black Star Legend",
        subtitle = "Ghanaian Hero 🇬🇭",
        iconEmoji = "⭐",
        adinkraMeaning = "'Fawohodie' — Independence, freedom and pride in our Ghanaian homeland.",
        requirement = "Complete all Social Studies (SST) independence lessons",
        isUnlocked = blackStarUnlocked,
        progress = (progress.sstLessonsCompleted / 5f).coerceIn(0f, 1f),
        rewardXp = 250,
        category = "HERITAGE",
        themeColor = Color(0xFFE8F8E8),
        bevelColor = Color(0xFFA7F3D0),
        drawableRes = R.drawable.img_badge_black_star_1787333645565
    ),
    ExplorerTrophyBadge(
        id = "badge_scientist",
        title = "Junior Scientist",
        subtitle = "Curious Explorer 🔬",
        iconEmoji = "🌱",
        adinkraMeaning = "'Nyansapo' — Wisdom knot; investigating how living nature thrives.",
        requirement = "Complete 3 Science lessons and identify living things",
        isUnlocked = scientistUnlocked,
        progress = (progress.scienceLessonsCompleted / 3f).coerceIn(0f, 1f),
        rewardXp = 100,
        category = "SCIENCE",
        themeColor = Color(0xFFDEF0FD),
        bevelColor = Color(0xFF93C5FD),
        drawableRes = R.drawable.img_badge_scientist_1787333657585
    ),
    ExplorerTrophyBadge(
        id = "badge_streak",
        title = "Streak Guardian",
        subtitle = "Daily Dedication 🛡️",
        iconEmoji = "🔥",
        adinkraMeaning = "'Boa Me Na Me Mmoa Wo' — Cooperation and steady daily discipline.",
        requirement = "Maintain a 3-day active learning streak",
        isUnlocked = streakUnlocked,
        progress = (progress.currentStreak / 3f).coerceIn(0f, 1f),
        rewardXp = 180,
        category = "STREAK",
        themeColor = Color(0xFFFFEDD5),
        bevelColor = Color(0xFFFDBA74),
        drawableRes = R.drawable.img_trophy_showcase_1786761343079
    ),
    ExplorerTrophyBadge(
        id = "badge_speed",
        title = "Chaskele Speedster",
        subtitle = "Lightning Reflexes ⚡",
        iconEmoji = "⚡",
        adinkraMeaning = "'Sankofa' — Fast reflexes and learning from past experience.",
        requirement = "Complete a speed quiz round or battle in under 45 seconds",
        isUnlocked = speedUnlocked,
        progress = if (speedUnlocked) 1f else 0f,
        rewardXp = 150,
        category = "SPEED",
        themeColor = Color(0xFFFEE2E2),
        bevelColor = Color(0xFFFECACA),
        drawableRes = R.drawable.img_badge_adinkra_1787333607984
    ),
    ExplorerTrophyBadge(
        id = "badge_all_round",
        title = "Black Star Trophy",
        subtitle = "Supreme All-Rounder 🏆",
        iconEmoji = "👑",
        adinkraMeaning = "'Mpatapo' — The knot of reconciliation and supreme mastery.",
        requirement = "Unlock all 7 primary Explorer milestone badges",
        isUnlocked = allRoundUnlocked,
        progress = listOf(streakUnlocked, kenteUnlocked, mathsUnlocked, spellingUnlocked,
            scientistUnlocked, blackStarUnlocked, speedUnlocked).count { it } / 7f,
        rewardXp = 500,
        category = "TROPHY",
        themeColor = Color(0xFFEAE6FD),
        bevelColor = Color(0xFFC4B5FD),
        drawableRes = R.drawable.img_trophy_showcase_1786761343079
    )
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ExplorerBadgesScreen(
    onBack: () -> Unit = {}
) {
    var selectedBadge by remember { mutableStateOf<ExplorerTrophyBadge?>(null) }
    var pinnedBadgeId by remember { mutableStateOf("badge_adinkra") }

    // ── Live badge progress from database ──
    val context = androidx.compose.ui.platform.LocalContext.current
    val repo = remember(context) { com.example.data.repository.StuddyHubRepository.getInstance(
        com.example.data.local.StuddyHubDatabase.getDatabase(context.applicationContext)
    ) }
    val allGameProgress by repo.allGameProgressFlow.collectAsStateWithLifecycle(initialValue = emptyList())
    val allAttempts by repo.allAttempts.collectAsStateWithLifecycle(initialValue = emptyList())
    val userStats by repo.userStats.collectAsStateWithLifecycle(initialValue = null)
    val roadmapSteps by repo.roadmapStepsFlow.collectAsStateWithLifecycle(initialValue = emptyList())

    val badgeProgress = remember(allGameProgress, allAttempts, userStats, roadmapSteps) {
        // Parse starsByLevelJson to find best star rating across all levels for each game
        fun bestStarsForGame(gameKey: String): Int {
            val gp = allGameProgress.filter { it.gameKey == gameKey }
            var best = 0
            gp.forEach { entry ->
                try {
                    val obj = org.json.JSONObject(entry.starsByLevelJson)
                    for (key in obj.keys()) {
                        val stars = obj.optInt(key, 0)
                        if (stars > best) best = stars
                    }
                } catch (_: Exception) {}
            }
            return best
        }
        fun totalPlaysForGame(gameKey: String): Int {
            return allGameProgress.filter { it.gameKey == gameKey }
                .sumOf { entry ->
                    try {
                        org.json.JSONObject(entry.starsByLevelJson).length()
                    } catch (_: Exception) { 0 }
                }
        }
        val kenteStars = bestStarsForGame("kente_quiz")
        val mathsCount = totalPlaysForGame("maths_quest")
        val spellingCount = totalPlaysForGame("spelling_bee")
        val scienceLessons = roadmapSteps.count { it.subjectCode == "SCI" && it.isCompleted }
        val sstLessons = roadmapSteps.count { it.subjectCode == "SST" && it.isCompleted }

        val speedAttempts = allAttempts.filter { it.percentage >= 60 && it.timeTakenSeconds in 1..45 }
        val bestSpeedSec = speedAttempts.minOfOrNull { it.timeTakenSeconds } ?: 0
        val hasSpeed = speedAttempts.isNotEmpty() || allGameProgress.any { it.totalXpEarned >= 100 }

        BadgeProgress(
            currentStreak = userStats?.currentStreak ?: 0,
            kenteQuizStars = kenteStars,
            mathsQuestCount = mathsCount,
            spellingBeeCount = spellingCount,
            scienceLessonsCompleted = scienceLessons,
            sstLessonsCompleted = sstLessons,
            totalLessonsCompleted = roadmapSteps.count { it.isCompleted },
            hasCompletedSpeedRound = hasSpeed,
            speedChallengeBestSeconds = bestSpeedSec
        )
    }
    val ghanaianBadges = remember(badgeProgress) { buildExplorerBadges(badgeProgress) }

    val unlockedCount = remember(ghanaianBadges) { ghanaianBadges.count { it.isUnlocked } }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text("Badges & Trophies 🏆", fontWeight = FontWeight.ExtraBold, fontSize = 18.sp)
                        Text("$unlockedCount of ${ghanaianBadges.size} Trophies Unlocked", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
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
        LazyVerticalGrid(
            columns = GridCells.Fixed(2),
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .padding(horizontal = 16.dp),
            contentPadding = PaddingValues(top = 8.dp, bottom = 32.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            // Hero Banner spanning full width
            item(span = { androidx.compose.foundation.lazy.grid.GridItemSpan(2) }) {
                Tactile3DCard(
                    onClick = {},
                    containerColor = Color(0xFF1E1B4B),
                    bevelColor = Color(0xFF312E81),
                    cornerRadius = 24.dp,
                    elevationDepth = 5.dp,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.fillMaxWidth()) {
                        Image(
                            painter = painterResource(id = R.drawable.img_trophy_showcase_1786761343079),
                            contentDescription = "Trophies Showcase",
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(140.dp)
                                .clip(RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp)),
                            contentScale = ContentScale.Crop
                        )
                        Column(modifier = Modifier.padding(16.dp)) {
                            Text(
                                text = "Ghanaian Curriculum Hall of Fame 🇬🇭",
                                style = MaterialTheme.typography.titleMedium.copy(
                                    fontWeight = FontWeight.ExtraBold,
                                    color = Color.White
                                )                            )
                            Text(
                                text = "Earn Adinkra symbols & trophies by conquering daily quests, lessons and mini-games!",
                                style = MaterialTheme.typography.bodySmall,
                                color = Color(0xFFC7D2FE)
                            )
                        }
                    }
                }
            }

            // Grid of Badges
            items(ghanaianBadges) { badge ->
                val isPinned = badge.id == pinnedBadgeId
                Tactile3DCard(
                    onClick = {
                        TactileSoundSystem.playPopSound()
                        selectedBadge = badge
                    },
                    containerColor = if (badge.isUnlocked) {
                        badge.themeColor
                    } else {
                        MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f)
                    },
                    bevelColor = if (badge.isUnlocked) badge.bevelColor else MaterialTheme.colorScheme.outlineVariant,
                    cornerRadius = 22.dp,
                    elevationDepth = if (badge.isUnlocked) 5.dp else 2.dp,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(14.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(64.dp)
                                .clip(CircleShape)
                                .background(if (badge.isUnlocked) Color.White else MaterialTheme.colorScheme.surfaceVariant)
                                .border(
                                    width = 2.5.dp,
                                    brush = if (badge.isUnlocked) {
                                        Brush.sweepGradient(
                                            listOf(
                                                badge.bevelColor,
                                                Color(0xFFFFD700),
                                                badge.bevelColor
                                            )
                                        )
                                    } else {
                                        Brush.linearGradient(
                                            listOf(
                                                MaterialTheme.colorScheme.outlineVariant,
                                                MaterialTheme.colorScheme.outlineVariant
                                            )
                                        )
                                    },
                                    shape = CircleShape
                                ),
                            contentAlignment = Alignment.Center
                        ) {
                            if (badge.drawableRes != null) {
                                Image(
                                    painter = painterResource(id = badge.drawableRes),
                                    contentDescription = badge.title,
                                    modifier = Modifier
                                        .fillMaxSize()
                                        .clip(CircleShape),
                                    contentScale = ContentScale.Crop,
                                    alpha = if (badge.isUnlocked) 1f else 0.4f
                                )
                                if (!badge.isUnlocked) {
                                    Box(
                                        modifier = Modifier
                                            .fillMaxSize()
                                            .background(Color.Black.copy(alpha = 0.45f)),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Icon(
                                            Icons.Default.Lock,
                                            contentDescription = "Locked",
                                            tint = Color.White,
                                            modifier = Modifier.size(22.dp)
                                        )
                                    }
                                }
                            } else {
                                if (badge.isUnlocked) {
                                    Text(badge.iconEmoji, fontSize = 28.sp)
                                } else {
                                    Icon(Icons.Default.Lock, contentDescription = "Locked", tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(24.dp))
                                }
                            }
                        }

                        Text(
                            text = badge.title,
                            style = MaterialTheme.typography.titleSmall.copy(
                                fontWeight = FontWeight.ExtraBold,
                                color = if (badge.isUnlocked) Color(0xFF1E293B) else MaterialTheme.colorScheme.onSurfaceVariant,
                                fontSize = 13.sp
                            ),
                            textAlign = TextAlign.Center,
                            maxLines = 1
                        )

                        if (badge.isUnlocked) {
                            Surface(
                                shape = RoundedCornerShape(8.dp),
                                color = if (isPinned) Color(0xFF6366F1) else Color(0xFF10B981)
                            ) {
                                Text(
                                    text = if (isPinned) "📌 PINNED" else "UNLOCKED ✨",
                                    style = MaterialTheme.typography.labelSmall.copy(
                                        fontWeight = FontWeight.ExtraBold,
                                        color = Color.White,
                                        fontSize = 9.sp
                                    ),
                                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp)
                                )
                            }
                        } else {
                            LinearProgressIndicator(
                                progress = { badge.progress },
                                modifier = Modifier.fillMaxWidth().height(6.dp).clip(CircleShape),
                                color = Color(0xFFFF7A00),
                                trackColor = MaterialTheme.colorScheme.surfaceVariant
                            )
                        }
                    }
                }
            }
        }
    }

    // Badge Details Dialog
    val badge = selectedBadge
    if (badge != null) {
        Dialog(onDismissRequest = { selectedBadge = null }) {
            Surface(
                shape = RoundedCornerShape(28.dp),
                color = MaterialTheme.colorScheme.surface,
                tonalElevation = 8.dp,
                border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f)),
                modifier = Modifier.fillMaxWidth().padding(16.dp)
            ) {
                Column(
                    modifier = Modifier.padding(20.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(14.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .size(88.dp)
                            .clip(CircleShape)
                            .background(badge.themeColor)
                            .border(3.dp, badge.bevelColor, CircleShape),
                        contentAlignment = Alignment.Center
                    ) {
                        if (badge.drawableRes != null) {
                            Image(
                                painter = painterResource(id = badge.drawableRes),
                                contentDescription = badge.title,
                                modifier = Modifier
                                    .fillMaxSize()
                                    .clip(CircleShape),
                                contentScale = ContentScale.Crop
                            )
                        } else {
                            Text(badge.iconEmoji, fontSize = 36.sp)
                        }
                    }

                    Text(
                        text = badge.title,
                        style = MaterialTheme.typography.titleLarge.copy(
                            fontWeight = FontWeight.ExtraBold,
                            color = MaterialTheme.colorScheme.onSurface
                        )
                    )

                    Surface(
                        shape = RoundedCornerShape(12.dp),
                        color = Color(0xFF3B82F6).copy(alpha = 0.15f)
                    ) {
                        Text(
                            text = badge.category,
                            style = MaterialTheme.typography.labelSmall.copy(
                                fontWeight = FontWeight.ExtraBold,
                                color = Color(0xFF2563EB)
                            ),
                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                        )
                    }

                    Card(
                        colors = CardDefaults.cardColors(containerColor = Color(0xFFFEF3C7)),
                        shape = RoundedCornerShape(16.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(modifier = Modifier.padding(14.dp)) {
                            Text("Adinkra Lore & Meaning 👑", fontWeight = FontWeight.Bold, color = Color(0xFFB45309), fontSize = 12.sp)
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(badge.adinkraMeaning, style = MaterialTheme.typography.bodySmall, color = Color(0xFF78350F))
                        }
                    }

                    Column(modifier = Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text("Requirement:", fontWeight = FontWeight.Bold, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Text(badge.requirement, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurface)
                    }

                    if (badge.isUnlocked) {
                        Tactile3DButton(
                            text = if (pinnedBadgeId == badge.id) "Pinned to Profile 📌" else "Pin to Profile 📌",
                            onClick = {
                                pinnedBadgeId = badge.id
                                TactileSoundSystem.playCorrectSound()
                                selectedBadge = null
                            },
                            containerColor = Color(0xFF10B981),
                            bevelColor = Color(0xFF047857),
                            modifier = Modifier.fillMaxWidth().height(48.dp)
                        )
                    } else {
                        Text(
                            text = "Reward: +${badge.rewardXp} XP & Golden Stars ⭐",
                            style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold, color = Color(0xFFD97706))
                        )
                    }

                    OutlinedButton(
                        onClick = { selectedBadge = null },
                        modifier = Modifier.fillMaxWidth().height(48.dp),
                        shape = RoundedCornerShape(14.dp)
                    ) { Text("Close") }
                }
            }
        }
    }
}
