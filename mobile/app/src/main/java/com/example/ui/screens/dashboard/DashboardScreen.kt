package com.example.ui.screens.dashboard

import androidx.compose.animation.togetherWith
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.material3.pulltorefresh.rememberPullToRefreshState
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.example.R
import com.example.ui.components.Avatar3DRenderer
import com.example.ui.navigation.Screen
import com.example.ui.theme.AcademicTier
import com.example.ui.theme.tierPrimary
import com.example.ui.theme.StreakDeepOrange
import com.example.ui.theme.StuddyHubThemeTokens
import com.example.ui.theme.WarningAmber
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * Main Entry Coordinator for the Home / Workspace Screen.
 * Strictly dispatches to [ExplorerHomeContent], [AchieverHomeContent], or [ScholarHomeContent]
 * based on the active [AcademicTier].
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DashboardScreen(
    viewModel: DashboardViewModel,
    onNavigate: (String) -> Unit,
    onNavigateToProfile: () -> Unit = {}
) {
    val activeTier = StuddyHubThemeTokens.tier
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    var isRefreshing by remember { mutableStateOf(false) }
    val coroutineScope = rememberCoroutineScope()

    Scaffold(
        topBar = {
            when (activeTier) {
                AcademicTier.EXPLORER -> {
                    // Explorer Playful TopBar: Avatar + Hi Name + Coins (spendable) + Stars (ranking)
                    val currentCoins = state.profile?.pointsBalance ?: 0
                    val currentStars = state.stats?.totalXp ?: 0
                    val animatedStars by androidx.compose.animation.core.animateIntAsState(
                        targetValue = currentStars,
                        animationSpec = androidx.compose.animation.core.tween(durationMillis = 900, easing = androidx.compose.animation.core.FastOutSlowInEasing),
                        label = "animated_stars"
                    )

                    val pillScale by androidx.compose.animation.core.animateFloatAsState(
                        targetValue = 1f,
                        animationSpec = androidx.compose.animation.core.spring(dampingRatio = androidx.compose.animation.core.Spring.DampingRatioMediumBouncy),
                        label = "pill_scale"
                    )

                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .statusBarsPadding()
                            .padding(horizontal = 20.dp, vertical = 12.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            Box(
                                modifier = Modifier
                                    .clickable { onNavigate(Screen.Profile.route) },
                                contentAlignment = Alignment.Center
                            ) {
                                Avatar3DRenderer(
                                    avatarIdOrEmoji = state.profile?.avatarUrl,
                                    size = 46.dp,
                                    showAura = false,
                                    isAnimated = false,
                                    borderWidth = 2.dp
                                )
                            }

                            Column(modifier = Modifier.weight(1f, fill = false)) {
                                val userName = state.profile?.fullName?.split(" ")?.firstOrNull()?.takeIf { it.isNotBlank() } ?: "Young Explorer"
                                Text(
                                    text = "Hi, $userName 👋",
                                    style = MaterialTheme.typography.titleLarge.copy(
                                        fontWeight = FontWeight.ExtraBold,
                                        color = MaterialTheme.colorScheme.onSurface
                                    ),
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis
                                )
                                Text(
                                    text = "Ready to learn today?",
                                    style = MaterialTheme.typography.bodySmall.copy(
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                        fontWeight = FontWeight.Medium
                                    )
                                )
                            }
                        }

                    // Alternating Single Currency Pill (Stars <-> Coins taking turns smoothly or on tap)
                    var showStars by remember { mutableStateOf(true) }
                    LaunchedEffect(Unit) {
                        while (true) {
                            delay(4000L)
                            showStars = !showStars
                        }
                    }

                    Surface(
                        shape = RoundedCornerShape(18.dp),
                        color = if (showStars) Color(0xFFFFFBEB) else Color(0xFFECFDF5),
                        border = BorderStroke(1.5.dp, if (showStars) Color(0xFFF59E0B) else Color(0xFF10B981)),
                        modifier = Modifier
                            .clickable {
                                if (showStars) onNavigate(Screen.Ranking.route) else onNavigate(Screen.ExplorerStore.route)
                            }
                    ) {
                        androidx.compose.animation.AnimatedContent(
                            targetState = showStars,
                            transitionSpec = {
                                androidx.compose.animation.slideInVertically { height -> height } + androidx.compose.animation.fadeIn() togetherWith
                                        androidx.compose.animation.slideOutVertically { height -> -height } + androidx.compose.animation.fadeOut()
                            },
                            label = "currency_pill_toggle"
                        ) { isStar ->
                            if (isStar) {
                                Row(
                                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(5.dp)
                                ) {
                                    Text("⭐", fontSize = 14.sp)
                                    Text(
                                        text = "$animatedStars",
                                        style = MaterialTheme.typography.labelMedium.copy(
                                            fontWeight = FontWeight.ExtraBold,
                                            color = Color(0xFFB45309),
                                            fontSize = 13.sp
                                        )
                                    )
                                }
                            } else {
                                Row(
                                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(5.dp)
                                ) {
                                    Text("🪙", fontSize = 13.sp)
                                    Text(
                                        text = "$currentCoins",
                                        style = MaterialTheme.typography.labelMedium.copy(
                                            fontWeight = FontWeight.ExtraBold,
                                            color = Color(0xFF047857),
                                            fontSize = 13.sp
                                        )
                                    )
                                }
                            }
                        }
                    }
                    }
                }
                AcademicTier.ACHIEVER -> {
                    // Achiever High-Yield TopBar: WASSCE Prep Focus + Streak Badge
                    TopAppBar(
                        title = {
                            Column {
                                Text(
                                    text = "⚡ WASSCE Prep",
                                    style = MaterialTheme.typography.titleLarge.copy(
                                        fontWeight = FontWeight.ExtraBold,
                                        color = MaterialTheme.colorScheme.onSurface
                                    )
                                )
                                Text(
                                    text = "Exam Readiness Hub",
                                    style = MaterialTheme.typography.labelSmall.copy(
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                )
                            }
                        },
                        actions = {
                            Surface(
                                shape = RoundedCornerShape(16.dp),
                                color = WarningAmber.copy(alpha = 0.15f),
                                modifier = Modifier.padding(end = 4.dp)
                            ) {
                                Row(
                                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.LocalFireDepartment,
                                        contentDescription = "Streak",
                                        tint = WarningAmber,
                                        modifier = Modifier.size(16.dp)
                                    )
                                    Spacer(modifier = Modifier.width(3.dp))
                                    Text(
                                        text = "${state.effectiveCurrentStreak}d",
                                        style = MaterialTheme.typography.labelMedium.copy(
                                            fontWeight = FontWeight.Bold,
                                            color = StreakDeepOrange
                                        )
                                    )
                                }
                            }
                            IconButton(
                                onClick = { onNavigate(Screen.Search.route) },
                                modifier = Modifier.testTag("global_search_button")
                            ) {
                                Icon(Icons.Default.Search, contentDescription = "Search Workspace")
                            }
                            IconButton(
                                onClick = { onNavigate(Screen.Profile.route) },
                                modifier = Modifier.testTag("dashboard_profile_button")
                            ) {
                                Icon(Icons.Default.AccountCircle, contentDescription = "Profile")
                            }
                        }
                    )
                }
                AcademicTier.SCHOLAR -> {
                    // Scholar Academic Workspace TopBar: Clean, minimal
                    TopAppBar(
                        title = {
                            Text(
                                text = "Workspace",
                                style = MaterialTheme.typography.titleLarge.copy(
                                    fontWeight = FontWeight.Bold,
                                    color = MaterialTheme.colorScheme.onSurface
                                )
                            )
                        },
                        actions = {
                            IconButton(
                                onClick = { onNavigate(Screen.Search.route) },
                                modifier = Modifier.testTag("global_search_button")
                            ) {
                                Icon(Icons.Default.Search, contentDescription = "Search Workspace")
                            }
                            IconButton(
                                onClick = { onNavigate(Screen.Profile.route) },
                                modifier = Modifier.testTag("dashboard_profile_button")
                            ) {
                                Icon(Icons.Default.AccountCircle, contentDescription = "Profile")
                            }
                        }
                    )
                }
            }
        },
        floatingActionButton = {
            if (activeTier == AcademicTier.SCHOLAR) {
                ExtendedFloatingActionButton(
                    onClick = { onNavigate(Screen.AIChat.route) },
                    icon = { Icon(Icons.Default.Psychology, contentDescription = null) },
                    text = { Text("Research AI", fontWeight = FontWeight.Bold) },
                    containerColor = tierPrimary(),
                    contentColor = Color.White,
                    modifier = Modifier
                        .testTag("dashboard_fab_ai")
                        // Keep clear of the floating pill nav, which now overlays content.
                        .padding(bottom = 84.dp)
                )
            }
        }
    ) { innerPadding ->
        PullToRefreshBox(
            isRefreshing = isRefreshing,
            onRefresh = {
                coroutineScope.launch {
                    isRefreshing = true
                    viewModel.refreshDashboard()
                    delay(600)
                    isRefreshing = false
                }
            },
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding),
            state = rememberPullToRefreshState()
        ) {
            when (activeTier) {
                AcademicTier.EXPLORER -> {
                    ExplorerHomeContent(
                        state = state,
                        onNavigate = onNavigate
                    )
                }
                AcademicTier.ACHIEVER -> {
                    AchieverHomeContent(
                        state = state,
                        onNavigate = onNavigate
                    )
                }
                AcademicTier.SCHOLAR -> {
                    ScholarHomeContent(
                        state = state,
                        onNavigate = onNavigate
                    )
                }
            }
        }
    }
}
