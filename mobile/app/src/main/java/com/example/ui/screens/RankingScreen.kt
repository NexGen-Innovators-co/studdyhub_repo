package com.example.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountCircle
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.*
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.material3.pulltorefresh.rememberPullToRefreshState
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.example.data.repository.StuddyHubRepository
import com.example.ui.components.LeaderboardUser
import com.example.ui.components.PodiumLeaderboard
import com.example.ui.components.tactileClick
import com.example.ui.theme.AcademicTier
import com.example.ui.theme.StuddyHubThemeTokens
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RankingScreen(
    repository: StuddyHubRepository,
    onNavigateToProfile: () -> Unit = {}
) {
    val currentProfile by repository.userProfile.collectAsStateWithLifecycle(initialValue = null)
    val activeTier = remember(currentProfile?.academicTier) {
        AcademicTier.fromKey(currentProfile?.academicTier)
    }
    var selectedTier by remember { mutableStateOf(AcademicTier.ALL) }
    var showClassOnly by remember { mutableStateOf(false) }
    var users by remember { mutableStateOf<List<LeaderboardUser>>(emptyList()) }
    var isOffline by remember { mutableStateOf(false) }
    var hasNoSchool by remember { mutableStateOf(false) }
    var isRefreshing by remember { mutableStateOf(false) }
    var lastUpdatedText by remember { mutableStateOf("Updated just now") }
    val coroutineScope = rememberCoroutineScope()
    val context = androidx.compose.ui.platform.LocalContext.current

    val refreshLeaderboard: () -> Unit = {
        coroutineScope.launch {
            isRefreshing = true
            val result = if (showClassOnly) {
                // Explorer "My Class" — same school + academic level, ranked by points.
                val profile = repository.getProfileDirect()
                repository.fetchClassLeaderboard(
                    school = profile?.school.orEmpty(),
                    academicLevel = profile?.academicLevel.orEmpty()
                )
            } else {
                repository.fetchTierLeaderboard(selectedTier.key)
            }
            users = result.users
            isOffline = result.isOffline
            hasNoSchool = result.hasNoSchool
            lastUpdatedText = if (result.isOffline) {
                "Offline fallback mode"
            } else if (result.hasNoSchool) {
                "School not set"
            } else {
                "Updated ${java.text.SimpleDateFormat("h:mm a", java.util.Locale.getDefault()).format(java.util.Date())}"
            }
            isRefreshing = false
        }
    }

    LaunchedEffect(selectedTier, showClassOnly) {
        refreshLeaderboard()
    }

    val royalBlueBrush = Brush.verticalGradient(
        listOf(
            Color(0xFF1E60FF),
            Color(0xFF0F4CD9),
            Color(0xFF0A369D)
        )
    )

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(royalBlueBrush)
    ) {
        Scaffold(
            containerColor = Color.Transparent,
            topBar = {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .statusBarsPadding()
                        .padding(horizontal = 20.dp, vertical = 12.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "Leaderboard",
                        style = MaterialTheme.typography.headlineMedium.copy(
                            fontWeight = FontWeight.ExtraBold,
                            color = Color.White
                        )
                    )

                    Row(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        // Refresh button (white/translucent rounded square)
                        IconButton(
                            onClick = refreshLeaderboard,
                            modifier = Modifier
                                .size(40.dp)
                                .clip(RoundedCornerShape(12.dp))
                                .background(Color.White.copy(alpha = 0.2f))
                                .testTag("ranking_refresh_button")
                        ) {
                            Icon(
                                imageVector = Icons.Default.Refresh,
                                contentDescription = "Refresh Leaderboard",
                                tint = Color.White
                            )
                        }

                        // Profile button
                        IconButton(
                            onClick = onNavigateToProfile,
                            modifier = Modifier
                                .size(40.dp)
                                .clip(RoundedCornerShape(12.dp))
                                .background(Color.White.copy(alpha = 0.2f))
                                .testTag("ranking_profile_button")
                        ) {
                            Icon(
                                imageVector = Icons.Default.AccountCircle,
                                contentDescription = "Profile",
                                tint = Color.White
                            )
                        }
                    }
                }
            }
        ) { innerPadding ->
            PullToRefreshBox(
                isRefreshing = isRefreshing,
                onRefresh = refreshLeaderboard,
                state = rememberPullToRefreshState(),
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .verticalScroll(rememberScrollState())
                ) {
                    // Tier Selector Pill (Translucent over blue)
                    Surface(
                        shape = RoundedCornerShape(16.dp),
                        color = Color.White.copy(alpha = 0.15f),
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 20.dp, vertical = 6.dp)
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(4.dp),
                            horizontalArrangement = Arrangement.SpaceEvenly
                        ) {
                            AcademicTier.values().forEach { tier ->
                                val isSelected = selectedTier == tier
                                Surface(
                                    shape = RoundedCornerShape(12.dp),
                                    color = if (isSelected) Color.White else Color.Transparent,
                                    modifier = Modifier
                                        .weight(1f)
                                        .clip(RoundedCornerShape(12.dp))
                                        .clickable {
                                            selectedTier = tier
                                            showClassOnly = false
                                        }
                                ) {
                                    Box(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .padding(vertical = 8.dp),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Text(
                                            text = "${tier.emoji} ${tier.displayName}",
                                            style = MaterialTheme.typography.labelSmall.copy(
                                                fontWeight = if (isSelected) FontWeight.ExtraBold else FontWeight.Medium,
                                                color = if (isSelected) Color(0xFF1E60FF) else Color.White.copy(alpha = 0.9f)
                                            )
                                        )
                                    }
                                }
                            }
                        }
                    }

                    // Explorer-only scope toggle: Global vs My Class 🏫
                    if (selectedTier == AcademicTier.EXPLORER) {
                        Spacer(modifier = Modifier.height(8.dp))
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 20.dp),
                            horizontalArrangement = Arrangement.Center,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            listOf(
                                false to "🌍 Global",
                                true to "🏫 My Class"
                            ).forEach { (isClass, label) ->
                                val isSelected = showClassOnly == isClass
                                Surface(
                                    shape = RoundedCornerShape(12.dp),
                                    color = if (isSelected) Color(0xFF1E60FF) else Color.White.copy(alpha = 0.15f),
                                    modifier = Modifier.tactileClick(onClick = { showClassOnly = isClass })
                                ) {
                                    Text(
                                        text = label,
                                        style = MaterialTheme.typography.labelMedium.copy(
                                            fontWeight = if (isSelected) FontWeight.ExtraBold else FontWeight.Medium,
                                            color = Color.White
                                        ),
                                        modifier = Modifier.padding(horizontal = 14.dp, vertical = 7.dp)
                                    )
                                }
                            }
                        }
                    }

                    if (isOffline) {
                        Spacer(modifier = Modifier.height(8.dp))
                        Surface(
                            shape = RoundedCornerShape(12.dp),
                            color = Color(0xFFFEF2F2),
                            border = BorderStroke(1.dp, Color(0xFFFCA5A5)),
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 20.dp)
                                .clickable { refreshLeaderboard() }
                        ) {
                            Row(
                                modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(10.dp)
                            ) {
                                Text("⚡", fontSize = 16.sp)
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        text = "Offline Mode — Local Fallback",
                                        style = MaterialTheme.typography.labelMedium.copy(
                                            fontWeight = FontWeight.Bold,
                                            color = Color(0xFF991B1B)
                                        )
                                    )
                                    Text(
                                        text = "Could not connect to live cloud server. Tap to retry.",
                                        style = MaterialTheme.typography.bodySmall.copy(
                                            color = Color(0xFFB91C1C),
                                            fontSize = 11.sp
                                        )
                                    )
                                }
                                Text(
                                    text = "Retry 🔄",
                                    style = MaterialTheme.typography.labelSmall.copy(
                                        fontWeight = FontWeight.ExtraBold,
                                        color = Color(0xFF991B1B)
                                    )
                                )
                            }
                        }
                    }

                    if (hasNoSchool) {
                        Spacer(modifier = Modifier.height(12.dp))
                        Surface(
                            shape = RoundedCornerShape(20.dp),
                            color = Color.White.copy(alpha = 0.15f),
                            border = BorderStroke(1.dp, Color.White.copy(alpha = 0.3f)),
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 20.dp)
                        ) {
                            Column(
                                modifier = Modifier.padding(20.dp),
                                horizontalAlignment = Alignment.CenterHorizontally
                            ) {
                                Text("🏫", fontSize = 40.sp)
                                Spacer(modifier = Modifier.height(8.dp))
                                Text(
                                    text = "Join Your Class Leaderboard!",
                                    style = MaterialTheme.typography.titleMedium.copy(
                                        fontWeight = FontWeight.ExtraBold,
                                        color = Color.White
                                    )
                                )
                                Spacer(modifier = Modifier.height(4.dp))
                                Text(
                                    text = "Add your School Name in your Profile to see how you rank among your classmates.",
                                    style = MaterialTheme.typography.bodySmall.copy(
                                        color = Color.White.copy(alpha = 0.85f),
                                        textAlign = TextAlign.Center
                                    )
                                )
                                Spacer(modifier = Modifier.height(14.dp))
                                Button(
                                    onClick = onNavigateToProfile,
                                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFFF7A00))
                                ) {
                                    Text("Set School in Profile 👤", fontWeight = FontWeight.Bold)
                                }
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(10.dp))

                    // 3D Podium & Runner-up list
                    PodiumLeaderboard(
                        users = users,
                        tier = selectedTier,
                        lastSyncedText = lastUpdatedText,
                        isOffline = isOffline,
                        onRefresh = refreshLeaderboard,
                        onSendCheer = { peer, emoji ->
                            coroutineScope.launch {
                                val res = repository.sendPeerCheer(peer.userId, emoji)
                                if (res is com.example.data.remote.BackendResult.Success) {
                                    android.widget.Toast.makeText(context, "Sent $emoji to ${peer.name}! 🎉", android.widget.Toast.LENGTH_SHORT).show()
                                } else {
                                    android.widget.Toast.makeText(context, "Cheered ${peer.name} locally! 👏", android.widget.Toast.LENGTH_SHORT).show()
                                }
                            }
                        },
                        modifier = Modifier.fillMaxWidth()
                    )

                    Spacer(modifier = Modifier.height(80.dp))
                }
            }
        }
    }
}
