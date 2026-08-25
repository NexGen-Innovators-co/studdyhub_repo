package com.example.ui.screens.dashboard

import android.content.Context
import androidx.compose.animation.core.*
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
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
import androidx.compose.runtime.saveable.rememberSaveable
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
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.example.R
import com.example.data.local.StuddyHubDatabase
import com.example.data.local.entities.RoadmapStepEntity
import com.example.data.repository.StuddyHubRepository
import com.example.ui.components.AICompanionFAB
import com.example.ui.components.ConfettiExplosionEffect
import com.example.ui.components.OllieMascot
import com.example.ui.components.OllieMood
import com.example.ui.components.StreakCalendarWidget
import com.example.ui.components.Tactile3DButton
import com.example.ui.components.Tactile3DCard
import com.example.ui.components.TactileSoundSystem
import com.example.ui.components.tactileClick
import com.example.ui.navigation.Screen
import com.example.ui.theme.AcademicTier
import java.util.Calendar
import kotlinx.coroutines.launch

/**
 * 🎒 Modern, Decluttered & Highly Visual Explorer Home Experience.
 * Hierarchy:
 * 1. Streak & Roadmap Quest Launcher
 * 2. Visual Hero Adventure Card (with rich illustration overlay)
 * 3. Daily Quest Progress Strip (Instant 1-tap claim)
 * 4. 2x2 Clean Adventure Gateway Hub (Lessons 📖, Arcade 🎮, Multiplayer ⚔️, Trophies 🏆)
 * 5. Arcade Game Showcase with Rich Visual Art
 */
@Composable
fun ExplorerHomeContent(
    state: DashboardUiState,
    onNavigate: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val repo = remember(context) { StuddyHubRepository.getInstance(StuddyHubDatabase.getDatabase(context.applicationContext)) }
    val roadmap by repo.roadmapStepsFlow.collectAsStateWithLifecycle(initialValue = emptyList())
    val roadmapError by repo.roadmapError.collectAsStateWithLifecycle(initialValue = null)

    LaunchedEffect(roadmap, roadmapError) {
        if (roadmap.isEmpty() && roadmapError == null) {
            repo.bootstrapKidRoadmap()
        }
    }

    val incompleteSteps = remember(roadmap) { roadmap.filterNot { it.isCompleted } }
    val currentMission = incompleteSteps.firstOrNull() ?: roadmap.firstOrNull()

    // Active days for streak calendar display
    var activeDays by remember { mutableStateOf(emptySet<String>()) }
    LaunchedEffect(Unit) {
        activeDays = repo.getActiveDays()
    }

    val allGameProgress by repo.allGameProgressFlow.collectAsStateWithLifecycle(initialValue = emptyList())
    val todayGamesPlayed = remember(allGameProgress) { allGameProgress.count { it.lastPlayedAt > startOfTodayMillis() } }
    val todayDone = remember(roadmap) { roadmap.count { it.isCompleted && isToday(it.completedAt) } }
    val userStats by repo.userStats.collectAsStateWithLifecycle(initialValue = null)
    val todayDateStr = remember { getTodayDateString() }
    val questClaimedToday = userStats?.lastDailyQuestClaimedDate == todayDateStr
    val coroutineScope = rememberCoroutineScope()

    val explorerPrefs = remember { context.getSharedPreferences("studdyhub_explorer_prefs", Context.MODE_PRIVATE) }
    
    val currentUserId = remember(userStats, state.profile) {
        userStats?.userId ?: state.profile?.supabaseUserId?.ifBlank { null } ?: state.profile?.id ?: "default"
    }
    
    // Check cloud stats first, fallback to pref
    val hasCelebratedFirstQuest = remember(userStats, currentUserId) {
        userStats?.badgesEarned?.contains("first_quest") == true ||
        userStats?.hasClaimedFirstQuestBonus == true ||
        explorerPrefs.getBoolean("first_quest_celebrated_$currentUserId", false)
    }

    val hasCompletedAnyQuest = remember(roadmap, allGameProgress, userStats, state.profile) {
        roadmap.any { it.isCompleted } || 
        allGameProgress.any { it.totalXpEarned > 0 || it.unlockedLevel > 1 } ||
        (userStats?.totalXp ?: 0) > 0 ||
        (state.profile?.pointsBalance ?: 0) > 0
    }

    var showRoadmapDialog by remember { mutableStateOf(false) }
    var isTourDismissed by rememberSaveable { mutableStateOf(false) }

    val listState = rememberLazyListState()

    // ── First Quest Celebration Modal ──
    if (hasCompletedAnyQuest && !hasCelebratedFirstQuest) {
        FirstQuestCelebrationDialog(
            onClaimAndDismiss = {
                coroutineScope.launch {
                    repo.claimFirstQuestBadge()
                }
                explorerPrefs.edit().putBoolean("first_quest_celebrated_$currentUserId", true).apply()
            }
        )
    }

    if (showRoadmapDialog) {
        ExplorerRoadmapDialog(
            currentStreak = state.effectiveCurrentStreak,
            totalStars = state.stats?.totalXp ?: state.profile?.pointsBalance ?: 0,
            onDismiss = { showRoadmapDialog = false },
            onNavigate = onNavigate
        )
    }

    Box(modifier = modifier.fillMaxSize()) {
        LazyColumn(
            state = listState,
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
            contentPadding = PaddingValues(bottom = 110.dp, top = 8.dp)
        ) {
            // 0. Interactive First Quest Spotlight Walkthrough (Action-Driven)
            if (!hasCompletedAnyQuest && !isTourDismissed) {
                item(key = "first_quest_walkthrough_banner", contentType = "guided_tour") {
                    Tactile3DCard(
                        onClick = {
                            TactileSoundSystem.playCelebrationBeep()
                            if (currentMission != null) {
                                if (currentMission.stepType == "game" && !currentMission.refId.isNullOrBlank()) {
                                    onNavigate(Screen.GameDetail.createRoute(currentMission.refId))
                                } else {
                                    onNavigate(Screen.LearnIt.createRoute(currentMission.id))
                                }
                            }
                        },
                        containerColor = Color(0xFFEFF6FF),
                        bevelColor = Color(0xFFBFDBFE),
                        cornerRadius = 24.dp,
                        elevationDepth = 4.dp,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(16.dp),
                            verticalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(12.dp)
                            ) {
                                OllieMascot(
                                    tier = AcademicTier.EXPLORER,
                                    mood = OllieMood.GREETING,
                                    size = 56.dp
                                )
                                Column(modifier = Modifier.weight(1f)) {
                                    Surface(
                                        shape = RoundedCornerShape(8.dp),
                                        color = Color(0xFF2563EB)
                                    ) {
                                        Text(
                                            text = "STEP 1: YOUR FIRST MISSION 🚀",
                                            style = MaterialTheme.typography.labelSmall.copy(
                                                fontWeight = FontWeight.ExtraBold,
                                                color = Color.White,
                                                fontSize = 9.sp
                                            ),
                                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                        )
                                    }
                                    Spacer(modifier = Modifier.height(3.dp))
                                    Text(
                                        text = "Start Your 1st Quest!",
                                        style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Black),
                                        color = MaterialTheme.colorScheme.onSurface
                                    )
                                    Text(
                                        text = "Complete your first mission below to earn +50 First-Quest Bonus Stars & ignite your streak!",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                }
                                IconButton(
                                    onClick = {
                                        TactileSoundSystem.playPopSound()
                                        isTourDismissed = true
                                    },
                                    modifier = Modifier.size(28.dp)
                                ) {
                                    Icon(
                                        Icons.Default.Close,
                                        contentDescription = "Dismiss walkthrough",
                                        tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f),
                                        modifier = Modifier.size(16.dp)
                                    )
                                }
                            }

                            Tactile3DButton(
                                text = "LAUNCH FIRST QUEST NOW 🚀",
                                onClick = {
                                    TactileSoundSystem.playCelebrationBeep()
                                    if (currentMission != null) {
                                        if (currentMission.stepType == "game" && !currentMission.refId.isNullOrBlank()) {
                                            onNavigate(Screen.GameDetail.createRoute(currentMission.refId))
                                        } else {
                                            onNavigate(Screen.LearnIt.createRoute(currentMission.id))
                                        }
                                    }
                                },
                                containerColor = Color(0xFF2563EB),
                                bevelColor = Color(0xFF1D4ED8),
                                textColor = Color.White,
                                cornerRadius = 16.dp,
                                elevationDepth = 4.dp,
                                modifier = Modifier.fillMaxWidth()
                            )
                        }
                    }
                }
            }

            // 1. Streak Calendar Banner (Clean & Connected)
            item(key = "streak_widget", contentType = "streak") {
                StreakCalendarWidget(
                    currentStreak = state.effectiveCurrentStreak,
                    streakFreezes = userStats?.streakFreezes ?: 0,
                    activeDays = activeDays,
                    showPeekingMascot = false,
                    onStreakClick = { showRoadmapDialog = true },
                    modifier = Modifier.fillMaxWidth()
                )
            }

            // 2. High-Impact Visual Hero Adventure Card
            if (currentMission != null) {
                item(key = "mission_${currentMission.id}", contentType = "hero_mission") {
                    val missionAccent = subjectColor(currentMission.subjectCode)
                    val infiniteTransition = rememberInfiniteTransition(label = "pulse")
                    val pulseBorderAlpha by infiniteTransition.animateFloat(
                        initialValue = 0.4f,
                        targetValue = 1f,
                        animationSpec = infiniteRepeatable(
                            animation = tween(1000, easing = FastOutSlowInEasing),
                            repeatMode = RepeatMode.Reverse
                        ),
                        label = "alpha"
                    )

                    Card(
                        shape = RoundedCornerShape(24.dp),
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                        elevation = CardDefaults.cardElevation(defaultElevation = if (!hasCompletedAnyQuest) 6.dp else 2.dp),
                        border = if (!hasCompletedAnyQuest) BorderStroke(2.5.dp, Color(0xFF2563EB).copy(alpha = pulseBorderAlpha)) else null,
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable {
                                if (currentMission.stepType == "game" && !currentMission.refId.isNullOrBlank()) {
                                    onNavigate(Screen.GameDetail.createRoute(currentMission.refId))
                                } else {
                                    // Check if the lesson title maps to a known game
                                    val titleLower = currentMission.title.lowercase()
                                    val matchedGameKey = when {
                                        titleLower.contains("oware") || titleLower.contains("maths quest") || titleLower.contains("number quest") -> "maths_quest"
                                        titleLower.contains("ananse") || titleLower.contains("logic") || titleLower.contains("riddle") -> "ananse_riddles"
                                        titleLower.contains("kente") || titleLower.contains("heritage") || titleLower.contains("culture") -> "kente_quiz"
                                        titleLower.contains("spelling") || titleLower.contains("bee") || titleLower.contains("word") -> "spelling_bee"
                                        titleLower.contains("asteroid") || titleLower.contains("laser") || titleLower.contains("space") -> "math_asteroid_blaster"
                                        titleLower.contains("science") || titleLower.contains("nature") || titleLower.contains("plant") -> "science_explorer"
                                        else -> null
                                    }
                                    if (matchedGameKey != null) {
                                        onNavigate(Screen.GameDetail.createRoute(matchedGameKey))
                                    } else {
                                        onNavigate(Screen.LearnIt.createRoute(currentMission.id))
                                    }
                                }
                            }
                    ) {
                        Column(modifier = Modifier.fillMaxWidth()) {
                            // Visual Hero Banner Header
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(130.dp)
                            ) {
                                Image(
                                    painter = painterResource(id = R.drawable.explorer_hero_adventure_1787426427161),
                                    contentDescription = "Today's Quest Adventure",
                                    modifier = Modifier.fillMaxSize(),
                                    contentScale = ContentScale.Crop
                                )
                                // Gradient Overlay for text contrast
                                Box(
                                    modifier = Modifier
                                        .fillMaxSize()
                                        .background(
                                            Brush.verticalGradient(
                                                listOf(
                                                    Color.Black.copy(alpha = 0.2f),
                                                    Color.Black.copy(alpha = 0.75f)
                                                )
                                            )
                                        )
                                )

                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(14.dp)
                                        .align(Alignment.TopStart),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Surface(
                                        shape = RoundedCornerShape(10.dp),
                                        color = if (!hasCompletedAnyQuest) Color(0xFFFF6B00) else missionAccent
                                    ) {
                                        Text(
                                            text = if (!hasCompletedAnyQuest) "START FIRST QUEST 🎯" else "NEXT ADVENTURE 🌟",
                                            style = MaterialTheme.typography.labelSmall.copy(
                                                fontWeight = FontWeight.ExtraBold,
                                                color = Color.White,
                                                fontSize = 10.sp
                                            ),
                                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                                        )
                                    }

                                    Surface(
                                        shape = RoundedCornerShape(10.dp),
                                        color = Color.Black.copy(alpha = 0.6f)
                                    ) {
                                        Text(
                                            text = "+${currentMission.xpReward} XP ⭐",
                                            style = MaterialTheme.typography.labelSmall.copy(
                                                fontWeight = FontWeight.ExtraBold,
                                                color = Color(0xFFFDE68A),
                                                fontSize = 11.sp
                                            ),
                                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                                        )
                                    }
                                }

                                Column(
                                    modifier = Modifier
                                        .padding(14.dp)
                                        .align(Alignment.BottomStart)
                                ) {
                                    Text(
                                        text = currentMission.title.ifBlank { currentMission.subjectName.ifBlank { "Your next lesson" } },
                                        style = MaterialTheme.typography.titleMedium.copy(
                                            fontWeight = FontWeight.Black,
                                            color = Color.White,
                                            fontSize = 17.sp
                                        ),
                                        maxLines = 1
                                    )
                                    Text(
                                        text = "${currentMission.subjectName.ifBlank { "General" }} · Week ${currentMission.week}",
                                        style = MaterialTheme.typography.bodySmall.copy(
                                            color = Color.White.copy(alpha = 0.85f),
                                            fontWeight = FontWeight.SemiBold
                                        )
                                    )
                                }
                            }

                            // Card Action Footer
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(horizontal = 16.dp, vertical = 14.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    Text(if (currentMission.stepType == "game") "🎮" else "📖", fontSize = 20.sp)
                                    Text(
                                        text = if (currentMission.stepType == "game") "Fun Challenge" else "Interactive Audio Lesson",
                                        style = MaterialTheme.typography.bodySmall.copy(fontWeight = FontWeight.Medium),
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                }

                                Button(
                                    onClick = {
                                        if (currentMission.stepType == "game" && !currentMission.refId.isNullOrBlank()) {
                                            onNavigate(Screen.GameDetail.createRoute(currentMission.refId))
                                        } else {
                                            onNavigate(Screen.LearnIt.createRoute(currentMission.id))
                                        }
                                    },
                                    colors = ButtonDefaults.buttonColors(containerColor = missionAccent),
                                    shape = RoundedCornerShape(14.dp),
                                    contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp)
                                ) {
                                    Text(
                                        text = if (!hasCompletedAnyQuest) "Start Now 🚀" else "Start ➜",
                                        style = MaterialTheme.typography.labelLarge.copy(
                                            fontWeight = FontWeight.ExtraBold,
                                            color = Color.White
                                        )
                                    )
                                }
                            }
                        }
                    }
                }
            }

            // 3. Compact Daily Quest Progress Strip
            item(key = "daily_quest_strip", contentType = "quest_strip") {
                val quest = remember { DailyQuestGenerator.forToday() }
                val questProgress = remember(quest, todayDone, todayGamesPlayed) {
                    quest.actions.count { action ->
                        when (action.type) {
                            DailyQuestType.LESSON -> todayDone >= action.target
                            DailyQuestType.GAME -> todayGamesPlayed >= action.target
                        }
                    }
                }
                val questComplete = questProgress >= quest.actions.size

                Surface(
                    shape = RoundedCornerShape(18.dp),
                    color = MaterialTheme.colorScheme.surface,
                    border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f)),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 14.dp, vertical = 12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Surface(
                            shape = CircleShape,
                            color = if (questComplete) Color(0xFF10B981).copy(alpha = 0.15f) else Color(0xFFF59E0B).copy(alpha = 0.15f),
                            modifier = Modifier.size(40.dp)
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                Text(if (questComplete) "🎉" else "🎯", fontSize = 20.sp)
                            }
                        }

                        Column(modifier = Modifier.weight(1f)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = "Daily Goal",
                                    style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold),
                                    color = MaterialTheme.colorScheme.onSurface
                                )
                                Text(
                                    text = if (questClaimedToday) "Claimed (+${quest.totalPoints} 🪙)" else "$questProgress of ${quest.actions.size} Completed",
                                    style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.SemiBold),
                                    color = if (questComplete) Color(0xFF10B981) else MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                            Spacer(modifier = Modifier.height(6.dp))
                            LinearProgressIndicator(
                                progress = { questProgress.toFloat() / quest.actions.size.coerceAtLeast(1) },
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(6.dp)
                                    .clip(CircleShape),
                                color = if (questComplete) Color(0xFF10B981) else Color(0xFF2563EB),
                                trackColor = MaterialTheme.colorScheme.surfaceVariant
                            )
                        }

                        if (questComplete && !questClaimedToday) {
                            Button(
                                onClick = {
                                    coroutineScope.launch { repo.claimDailyQuest(quest.totalPoints) }
                                },
                                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFF59E0B)),
                                shape = RoundedCornerShape(12.dp),
                                contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp)
                            ) {
                                Text("CLAIM", fontWeight = FontWeight.ExtraBold, fontSize = 11.sp, color = Color.White)
                            }
                        }
                    }
                }
            }

            // 4. Clean 2x2 Adventure Hubs (Unified & Uncluttered)
            item(key = "adventure_hubs", contentType = "hub_grid") {
                Column(
                    modifier = Modifier.fillMaxWidth(),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Text(
                        text = "Adventure Hubs 🚀",
                        style = MaterialTheme.typography.titleMedium.copy(
                            fontWeight = FontWeight.ExtraBold,
                            color = MaterialTheme.colorScheme.onSurface,
                            fontSize = 17.sp
                        )
                    )

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        ModernHubCard(
                            title = "Lessons",
                            subtitle = "Audio & Quests",
                            emoji = "📚",
                            badgeText = "LEARN",
                            badgeBg = Color(0xFF2563EB),
                            modifier = Modifier.weight(1f),
                            onClick = { onNavigate(Screen.LearnItLibrary.route) }
                        )

                        ModernHubCard(
                            title = "Arcade",
                            subtitle = "Play & Practice",
                            emoji = "🎮",
                            badgeText = "GAMES",
                            badgeBg = Color(0xFF059669),
                            modifier = Modifier.weight(1f),
                            onClick = { onNavigate(Screen.Quizzes.route) }
                        )
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        ModernHubCard(
                            title = "Battle Arena",
                            subtitle = "Multiplayer Race",
                            emoji = "⚔️",
                            badgeText = "LIVE",
                            badgeBg = Color(0xFFD97706),
                            modifier = Modifier.weight(1f),
                            onClick = { onNavigate(Screen.MultiplayerLobby.route) }
                        )

                        ModernHubCard(
                            title = "Trophies",
                            subtitle = "Ghanaian Lore",
                            emoji = "🏆",
                            badgeText = "AWARDS",
                            badgeBg = Color(0xFF7C3AED),
                            modifier = Modifier.weight(1f),
                            onClick = { onNavigate(Screen.BadgesTrophies.route) }
                        )
                    }
                }
            }

            // 5. Featured Arcade Games Section (with rich visual banners)
            item(key = "arcade_section", contentType = "arcade") {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 4.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "Featured Games 🎯",
                            style = MaterialTheme.typography.titleMedium.copy(
                                fontWeight = FontWeight.ExtraBold,
                                color = MaterialTheme.colorScheme.onSurface,
                                fontSize = 17.sp
                            )
                        )

                        TextButton(
                            onClick = { onNavigate(Screen.ExplorerStore.route) },
                            contentPadding = PaddingValues(horizontal = 8.dp, vertical = 2.dp)
                        ) {
                            Text("🛍️ Ollie Store ➜", fontWeight = FontWeight.Bold, fontSize = 12.sp)
                        }
                    }

                    LazyRow(
                        horizontalArrangement = Arrangement.spacedBy(14.dp),
                        contentPadding = PaddingValues(end = 8.dp)
                    ) {
                        item {
                            FeaturedGameCard(
                                title = "ASTEROID LASER",
                                category = "SPACE MATH 🚀",
                                emoji = "🚀",
                                bannerResId = R.drawable.explorer_arcade_banner_1787426442864,
                                accentColor = Color(0xFFEF4444),
                                onClick = { onNavigate(Screen.MathAsteroidBlaster.route) }
                            )
                        }

                        item {
                            FeaturedGameCard(
                                title = "ANANSE RIDDLES",
                                category = "LOGIC & WISDOM",
                                emoji = "🕸️",
                                bannerResId = R.drawable.img_ananse_riddles_1786717187634,
                                accentColor = Color(0xFF7C3AED),
                                onClick = { onNavigate(Screen.GameDetail.createRoute("ananse_riddles")) }
                            )
                        }

                        item {
                            FeaturedGameCard(
                                title = "OWARE MATH",
                                category = "ARITHMETIC",
                                emoji = "🔢",
                                bannerResId = R.drawable.img_oware_math_1786717198699,
                                accentColor = Color(0xFFD97706),
                                onClick = { onNavigate(Screen.GameDetail.createRoute("maths_quest")) }
                            )
                        }

                        item {
                            FeaturedGameCard(
                                title = "KENTE QUIZ",
                                category = "GHANAIAN HERITAGE",
                                emoji = "🇬🇭",
                                bannerResId = R.drawable.img_kente_quiz_1786717209972,
                                accentColor = Color(0xFF059669),
                                onClick = { onNavigate(Screen.GameDetail.createRoute("kente_quiz")) }
                            )
                        }

                        item {
                            FeaturedGameCard(
                                title = "SPELLING BEE",
                                category = "WORD MASTER",
                                emoji = "🐝",
                                bannerResId = R.drawable.explorer_arcade_banner_1787426442864,
                                accentColor = Color(0xFF2563EB),
                                onClick = { onNavigate(Screen.GameDetail.createRoute("spelling_bee")) }
                            )
                        }
                    }
                }
            }
        }

        // 6. Floating AI Companion FAB
        AICompanionFAB(
            tier = AcademicTier.EXPLORER,
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .padding(end = 18.dp, bottom = 90.dp),
            onOpenCompanion = { onNavigate(Screen.AIChat.route) }
        )
    }
}

@Composable
private fun ModernHubCard(
    title: String,
    subtitle: String,
    emoji: String,
    badgeText: String,
    badgeBg: Color,
    modifier: Modifier = Modifier,
    onClick: () -> Unit
) {
    Card(
        shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.5.dp),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.4f)),
        modifier = modifier.clickable {
            TactileSoundSystem.playPopSound()
            onClick()
        }
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Surface(
                    shape = CircleShape,
                    color = badgeBg.copy(alpha = 0.12f),
                    modifier = Modifier.size(40.dp)
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Text(emoji, fontSize = 20.sp)
                    }
                }

                Surface(
                    shape = RoundedCornerShape(6.dp),
                    color = badgeBg.copy(alpha = 0.15f)
                ) {
                    Text(
                        text = badgeText,
                        style = MaterialTheme.typography.labelSmall.copy(
                            fontWeight = FontWeight.ExtraBold,
                            color = badgeBg,
                            fontSize = 8.5.sp
                        ),
                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                    )
                }
            }

            Column {
                Text(
                    text = title,
                    style = MaterialTheme.typography.titleMedium.copy(
                        fontWeight = FontWeight.ExtraBold,
                        fontSize = 15.sp,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                )
                Text(
                    text = subtitle,
                    style = MaterialTheme.typography.bodySmall.copy(
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        fontSize = 11.sp
                    )
                )
            }
        }
    }
}

@Composable
private fun FeaturedGameCard(
    title: String,
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
            .width(180.dp)
            .clickable {
                TactileSoundSystem.playPopSound()
                onClick()
            }
    ) {
        Column(modifier = Modifier.fillMaxWidth()) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(95.dp)
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
                        .background(
                            Brush.verticalGradient(
                                listOf(Color.Transparent, Color.Black.copy(alpha = 0.65f))
                            )
                        )
                )

                Surface(
                    shape = RoundedCornerShape(8.dp),
                    color = accentColor,
                    modifier = Modifier
                        .padding(8.dp)
                        .align(Alignment.TopStart)
                ) {
                    Text(
                        text = category,
                        style = MaterialTheme.typography.labelSmall.copy(
                            fontWeight = FontWeight.ExtraBold,
                            color = Color.White,
                            fontSize = 8.sp
                        ),
                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                    )
                }

                Row(
                    modifier = Modifier
                        .padding(8.dp)
                        .align(Alignment.BottomStart),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    Text(emoji, fontSize = 16.sp)
                    Text(
                        text = title,
                        style = MaterialTheme.typography.titleSmall.copy(
                            fontWeight = FontWeight.Black,
                            color = Color.White,
                            fontSize = 12.sp
                        ),
                        maxLines = 1
                    )
                }
            }

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 12.dp, vertical = 10.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Play Quest",
                    style = MaterialTheme.typography.labelMedium.copy(
                        fontWeight = FontWeight.Bold,
                        color = accentColor
                    )
                )
                Text("▶", fontSize = 12.sp, color = accentColor)
            }
        }
    }
}

private fun isToday(millis: Long?): Boolean {
    if (millis == null) return false
    val c1 = Calendar.getInstance().apply { timeInMillis = millis }
    val c2 = Calendar.getInstance()
    return c1.get(Calendar.YEAR) == c2.get(Calendar.YEAR) &&
        c1.get(Calendar.DAY_OF_YEAR) == c2.get(Calendar.DAY_OF_YEAR)
}

private fun subjectColor(code: String): Color = when (code.uppercase()) {
    "ENG" -> Color(0xFF2563EB)
    "MATH" -> Color(0xFFD97706)
    "SCI" -> Color(0xFF059669)
    "SST" -> Color(0xFF7C3AED)
    "ICT" -> Color(0xFFDB2777)
    else -> Color(0xFF2563EB)
}

enum class DailyQuestType { LESSON, GAME }

data class DailyQuestAction(
    val type: DailyQuestType,
    val label: String,
    val target: Int,
    val points: Int
)

data class DailyQuest(
    val title: String,
    val actions: List<DailyQuestAction>,
    val totalPoints: Int
)

object DailyQuestGenerator {
    private val easyPool = listOf(
        DailyQuestAction(DailyQuestType.LESSON, "Finish a Learn It lesson 📖", 1, 30),
        DailyQuestAction(DailyQuestType.GAME, "Play a game 🎮", 1, 30),
        DailyQuestAction(DailyQuestType.GAME, "Race in a game level ⚡", 1, 25)
    )
    private val hardPool = listOf(
        DailyQuestAction(DailyQuestType.LESSON, "Complete two lessons ✏️", 2, 40),
        DailyQuestAction(DailyQuestType.GAME, "Play two games 🕹️", 2, 40)
    )

    fun forToday(): DailyQuest {
        val todayMillis = startOfTodayMillis()
        val seed = ((todayMillis / (24L * 3600 * 1000)) % 997L).toInt() + 7
        val rng = java.util.Random(seed.toLong())
        // Pick 1 easy + 1 easy (always achievable in a short session)
        val action1 = easyPool[rng.nextInt(easyPool.size)]
        var action2 = easyPool[rng.nextInt(easyPool.size)]
        // Avoid duplicate types if possible
        if (action2.type == action1.type && easyPool.size > 1) {
            action2 = easyPool.first { it.type != action1.type }
        }
        val actions = listOf(action1, action2)
        return DailyQuest(
            title = "Daily Explorer Missions 🚀",
            actions = actions,
            totalPoints = actions.sumOf { it.points }
        )
    }
}

private fun getTodayDateString(): String {
    val cal = Calendar.getInstance()
    return String.format(java.util.Locale.US, "%04d-%02d-%02d", cal.get(Calendar.YEAR), cal.get(Calendar.MONTH) + 1, cal.get(Calendar.DAY_OF_MONTH))
}

private fun startOfTodayMillis(): Long {
    val cal = Calendar.getInstance()
    cal.set(Calendar.HOUR_OF_DAY, 0)
    cal.set(Calendar.MINUTE, 0)
    cal.set(Calendar.SECOND, 0)
    cal.set(Calendar.MILLISECOND, 0)
    return cal.timeInMillis
}

@Composable
private fun FirstQuestCelebrationDialog(
    onClaimAndDismiss: () -> Unit
) {
    LaunchedEffect(Unit) {
        TactileSoundSystem.playCelebrationBeep()
    }

    AlertDialog(
        onDismissRequest = onClaimAndDismiss,
        confirmButton = {
            Tactile3DButton(
                text = "CLAIM 50 🪙 & EXPLORE! 🚀",
                onClick = {
                    TactileSoundSystem.playCelebrationBeep()
                    onClaimAndDismiss()
                },
                containerColor = Color(0xFFFF6B00),
                bevelColor = Color(0xFFD95000),
                textColor = Color.White,
                cornerRadius = 16.dp,
                elevationDepth = 4.dp,
                modifier = Modifier.fillMaxWidth()
            )
        },
        title = null,
        text = {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .wrapContentHeight()
            ) {
                ConfettiExplosionEffect(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(280.dp),
                    particleCount = 90
                )

                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 8.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    OllieMascot(
                        tier = AcademicTier.EXPLORER,
                        mood = OllieMood.CELEBRATING,
                        size = 80.dp
                    )

                    Surface(
                        shape = RoundedCornerShape(12.dp),
                        color = Color(0xFFFEF3C7)
                    ) {
                        Text(
                            text = "🎉 FIRST MISSION ACCOMPLISHED! 🎉",
                            style = MaterialTheme.typography.labelMedium.copy(
                                fontWeight = FontWeight.Black,
                                color = Color(0xFFD97706),
                                letterSpacing = 1.sp
                            ),
                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                        )
                    }

                    Text(
                        text = "Awesome Job, Explorer!",
                        style = MaterialTheme.typography.titleLarge.copy(
                            fontWeight = FontWeight.Black,
                            fontSize = 20.sp
                        ),
                        textAlign = TextAlign.Center
                    )

                    Text(
                        text = "You finished your very first quest! Your learning adventure has officially begun and your daily streak is now active.",
                        style = MaterialTheme.typography.bodySmall,
                        textAlign = TextAlign.Center,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        Surface(
                            shape = RoundedCornerShape(12.dp),
                            color = Color(0xFFEFF6FF),
                            border = BorderStroke(1.dp, Color(0xFFBFDBFE)),
                            modifier = Modifier.weight(1f)
                        ) {
                            Column(
                                modifier = Modifier.padding(vertical = 8.dp, horizontal = 2.dp),
                                horizontalAlignment = Alignment.CenterHorizontally
                            ) {
                                Text("⭐", fontSize = 18.sp)
                                Text(
                                    text = "+50 Stars",
                                    style = MaterialTheme.typography.labelSmall.copy(
                                        fontWeight = FontWeight.Black,
                                        color = Color(0xFF2563EB),
                                        fontSize = 10.sp
                                    )
                                )
                                Text(
                                    text = "First Quest",
                                    style = MaterialTheme.typography.labelSmall.copy(
                                        fontSize = 8.sp,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                )
                            }
                        }

                        Surface(
                            shape = RoundedCornerShape(12.dp),
                            color = Color(0xFFFEF2F2),
                            border = BorderStroke(1.dp, Color(0xFFFECACA)),
                            modifier = Modifier.weight(1f)
                        ) {
                            Column(
                                modifier = Modifier.padding(vertical = 8.dp, horizontal = 2.dp),
                                horizontalAlignment = Alignment.CenterHorizontally
                            ) {
                                Text("🔥", fontSize = 18.sp)
                                Text(
                                    text = "Day 1",
                                    style = MaterialTheme.typography.labelSmall.copy(
                                        fontWeight = FontWeight.Black,
                                        color = Color(0xFFDC2626),
                                        fontSize = 10.sp
                                    )
                                )
                                Text(
                                    text = "Streak Started",
                                    style = MaterialTheme.typography.labelSmall.copy(
                                        fontSize = 8.sp,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                )
                            }
                        }

                        Surface(
                            shape = RoundedCornerShape(12.dp),
                            color = Color(0xFFFAF5FF),
                            border = BorderStroke(1.dp, Color(0xFFE9D5FF)),
                            modifier = Modifier.weight(1f)
                        ) {
                            Column(
                                modifier = Modifier.padding(vertical = 8.dp, horizontal = 2.dp),
                                horizontalAlignment = Alignment.CenterHorizontally
                            ) {
                                Text("🏅", fontSize = 18.sp)
                                Text(
                                    text = "Pioneer",
                                    style = MaterialTheme.typography.labelSmall.copy(
                                        fontWeight = FontWeight.Black,
                                        color = Color(0xFF7C3AED),
                                        fontSize = 10.sp
                                    )
                                )
                                Text(
                                    text = "Badge Unlocked",
                                    style = MaterialTheme.typography.labelSmall.copy(
                                        fontSize = 8.sp,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                )
                            }
                        }
                    }
                }
            }
        },
        shape = RoundedCornerShape(28.dp),
        containerColor = MaterialTheme.colorScheme.surface
    )
}
