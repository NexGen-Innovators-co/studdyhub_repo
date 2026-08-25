package com.example.ui.components

import android.widget.Toast
import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.filled.WifiOff
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.ui.theme.AcademicTier
import com.example.ui.theme.Radius
import com.example.ui.theme.Spacing
import com.example.ui.theme.StuddyHubThemeTokens

data class LeaderboardUser(
    val rank: Int,
    val userId: String,
    val name: String,
    val avatarUrl: String? = null,
    val totalXp: Int,
    val school: String = "",
    val academicTier: String = "explorer",
    val isCurrentUser: Boolean = false
)

data class LeaderboardResult(
    val users: List<LeaderboardUser>,
    val isOffline: Boolean = false,
    val hasNoSchool: Boolean = false
)


/**
 * Animated rotating studio lights / celebratory sunburst rays background.
 */
@Composable
fun RotatingStudioLightsCanvas(
    modifier: Modifier = Modifier,
    rayColor: Color = Color(0xFFFFD700),
    rayCount: Int = 16
) {
    val infiniteTransition = rememberInfiniteTransition(label = "studio_lights")
    val rotationAngle by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = 360f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 26000, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "rotation"
    )

    Canvas(modifier = modifier) {
        val centerX = size.width / 2f
        val centerY = size.height * 0.42f
        val radius = maxOf(size.width, size.height) * 1.5f
        val sweepAngle = 360f / rayCount

        rotate(rotationAngle, pivot = androidx.compose.ui.geometry.Offset(centerX, centerY)) {
            for (i in 0 until rayCount step 2) {
                val startAngle = i * sweepAngle
                val path = androidx.compose.ui.graphics.Path().apply {
                    moveTo(centerX, centerY)
                    arcTo(
                        rect = androidx.compose.ui.geometry.Rect(
                            left = centerX - radius,
                            top = centerY - radius,
                            right = centerX + radius,
                            bottom = centerY + radius
                        ),
                        startAngleDegrees = startAngle,
                        sweepAngleDegrees = sweepAngle * 0.52f,
                        forceMoveTo = false
                    )
                    close()
                }
                drawPath(
                    path = path,
                    brush = Brush.radialGradient(
                        colors = listOf(
                            rayColor.copy(alpha = 0.28f),
                            Color(0xFF60A5FA).copy(alpha = 0.12f),
                            Color.Transparent
                        ),
                        center = androidx.compose.ui.geometry.Offset(centerX, centerY),
                        radius = radius * 0.75f
                    )
                )
            }
        }
    }
}

/**
 * Tier-Scoped 3D Podium Leaderboard Component.
 * Supports Royal Blue 3D Podium Hero with Studio Light Rays + Curved Container with Runner-Up list,
 * Peer High-Fives / Cheers, and House Clan Teams!
 */
@Composable
fun PodiumLeaderboard(
    users: List<LeaderboardUser>,
    tier: AcademicTier = StuddyHubThemeTokens.tier,
    lastSyncedText: String = "Updated recently",
    isOffline: Boolean = false,
    onRefresh: () -> Unit = {},
    onSendCheer: (LeaderboardUser, String) -> Unit = { _, _ -> },
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val sortedUsers = users.sortedByDescending { it.totalXp }.mapIndexed { index, user ->
        user.copy(rank = index + 1)
    }

    val top1 = sortedUsers.getOrNull(0)
    val top2 = sortedUsers.getOrNull(1)
    val top3 = sortedUsers.getOrNull(2)
    val rest = if (sortedUsers.size > 3) sortedUsers.drop(3) else emptyList()
    val currentUser = sortedUsers.find { it.isCurrentUser }

    Column(
        modifier = modifier.fillMaxWidth()
    ) {
        // ── Top 3 3D Podium Section (Over Royal Blue with Studio Lights) ──
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 4.dp),
            contentAlignment = Alignment.BottomCenter
        ) {
            // Rotating Studio Lights in background
            RotatingStudioLightsCanvas(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(290.dp)
                    .align(Alignment.TopCenter)
            )

            if (sortedUsers.isEmpty()) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(220.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("🏆", fontSize = 44.sp)
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = "No rankings recorded yet",
                            style = MaterialTheme.typography.titleMedium.copy(
                                fontWeight = FontWeight.Bold,
                                color = Color.White
                            )
                        )
                        Text(
                            text = "Play quizzes and complete lessons to claim #1!",
                            style = MaterialTheme.typography.bodySmall.copy(
                                color = Color.White.copy(alpha = 0.8f)
                            )
                        )
                    }
                }
            } else {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 6.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(top = 4.dp),
                        horizontalArrangement = Arrangement.SpaceEvenly,
                        verticalAlignment = Alignment.Bottom
                    ) {
                        // 2nd Place (Silver - Left)
                        if (top2 != null) {
                            PodiumColumn3D(
                                user = top2,
                                rank = 2,
                                pedestalHeight = 110.dp,
                                accentColor = Color(0xFFCBD5E1),
                                topBevelColor = Color(0xFFF1F5F9),
                                pedestalBrush = Brush.verticalGradient(
                                    listOf(Color(0xFFE2E8F0), Color(0xFF94A3B8), Color(0xFF64748B))
                                ),
                                modifier = Modifier.weight(1f)
                            )
                        } else {
                            Spacer(modifier = Modifier.weight(1f))
                        }

                        // 1st Place (Gold - Center)
                        if (top1 != null) {
                            PodiumColumn3D(
                                user = top1,
                                rank = 1,
                                pedestalHeight = 155.dp,
                                accentColor = Color(0xFFFBBF24),
                                topBevelColor = Color(0xFFFEF08A),
                                pedestalBrush = Brush.verticalGradient(
                                    listOf(Color(0xFFFDE047), Color(0xFFF59E0B), Color(0xFFD97706))
                                ),
                                modifier = Modifier.weight(1.15f)
                            )
                        } else {
                            Spacer(modifier = Modifier.weight(1.15f))
                        }

                        // 3rd Place (Bronze - Right)
                        if (top3 != null) {
                            PodiumColumn3D(
                                user = top3,
                                rank = 3,
                                pedestalHeight = 85.dp,
                                accentColor = Color(0xFFF97316),
                                topBevelColor = Color(0xFFFFEDD5),
                                pedestalBrush = Brush.verticalGradient(
                                    listOf(Color(0xFFFDBA74), Color(0xFFEA580C), Color(0xFF9A3412))
                                ),
                                modifier = Modifier.weight(1f)
                            )
                        } else {
                            Spacer(modifier = Modifier.weight(1f))
                        }
                    }
                }
            }
        }

        // ── White Curved Container with Runner-Up list & Sticky User Card ──
        Surface(
            shape = RoundedCornerShape(topStart = 32.dp, topEnd = 32.dp),
            color = MaterialTheme.colorScheme.surface,
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 10.dp)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp, vertical = 20.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                // Header with Peer Cheer hint
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "Hall of Fame 🌟",
                        style = MaterialTheme.typography.titleMedium.copy(
                            fontWeight = FontWeight.ExtraBold,
                            color = MaterialTheme.colorScheme.onSurface
                        )
                    )
                    Text(
                        text = "Tap 👏 to cheer peers!",
                        style = MaterialTheme.typography.labelSmall.copy(
                            color = Color(0xFF64748B),
                            fontWeight = FontWeight.Bold
                        )
                    )
                }

                // Sticky Current User Rank Card
                if (currentUser != null) {
                    StickyUserRankCard(user = currentUser, isOffline = isOffline)
                    HorizontalDivider(color = Color(0xFFE2E8F0))
                }

                // Runner-Up List (Rank 4+)
                if (rest.isNotEmpty()) {
                    Column(
                        verticalArrangement = Arrangement.spacedBy(10.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        rest.forEach { runnerUp ->
                            LeaderboardListRowItem(
                                user = runnerUp,
                                onCheer = { emoji ->
                                    TactileSoundSystem.playCelebrationBeep()
                                    onSendCheer(runnerUp, emoji)
                                }
                            )
                        }
                    }
                } else if (users.isEmpty()) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 24.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = "Loading champions...",
                            style = MaterialTheme.typography.bodyMedium,
                            color = Color(0xFF64748B)
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun PodiumColumn3D(
    user: LeaderboardUser,
    rank: Int,
    pedestalHeight: Dp,
    accentColor: Color,
    topBevelColor: Color,
    pedestalBrush: Brush,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier.padding(horizontal = 4.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        // Crown / Rank badge for top 3
        if (rank == 1) {
            Text("👑", fontSize = 26.sp, modifier = Modifier.padding(bottom = 2.dp))
        } else {
            Spacer(modifier = Modifier.height(10.dp))
        }

        // Avatar
        Avatar3DRenderer(
            avatarIdOrEmoji = user.avatarUrl?.takeIf { it.isNotBlank() } ?: com.example.ui.components.AvatarRegistry.defaultAvatarForTier(user.academicTier).id,
            size = if (rank == 1) 68.dp else 56.dp,
            showAura = rank == 1,
            isAnimated = false,
            borderWidth = if (rank == 1) 3.dp else 2.dp
        )

        Spacer(modifier = Modifier.height(4.dp))

        Text(
            text = user.name.ifBlank { "Explorer" },
            style = MaterialTheme.typography.labelMedium.copy(
                fontWeight = FontWeight.ExtraBold,
                color = Color.White,
                fontSize = if (rank == 1) 13.sp else 11.sp
            ),
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            textAlign = TextAlign.Center
        )

        // XP Pill
        Surface(
            shape = RoundedCornerShape(10.dp),
            color = Color.Black.copy(alpha = 0.4f),
            modifier = Modifier.padding(top = 2.dp, bottom = 6.dp)
        ) {
            Row(
                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(2.dp)
            ) {
                Text("⭐", fontSize = 10.sp)
                Text(
                    text = "${user.totalXp}",
                    style = MaterialTheme.typography.labelSmall.copy(
                        fontWeight = FontWeight.ExtraBold,
                        color = Color(0xFFFFD700),
                        fontSize = 10.sp
                    )
                )
            }
        }

        // 3D Pedestal Block with Top Isometric Bevel
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .height(pedestalHeight),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // 3D Top Bevel Lip (Isometric depth)
            Surface(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(10.dp),
                shape = RoundedCornerShape(topStart = 16.dp, topEnd = 16.dp),
                color = topBevelColor
            ) {}

            // Front Column Face
            Surface(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f),
                shape = RoundedCornerShape(bottomStart = 8.dp, bottomEnd = 8.dp),
                color = Color.Transparent
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(pedestalBrush),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = rank.toString(),
                        style = MaterialTheme.typography.headlineLarge.copy(
                            fontWeight = FontWeight.ExtraBold,
                            color = Color.White.copy(alpha = 0.95f),
                            fontSize = 32.sp
                        )
                    )
                }
            }
        }
    }
}

@Composable
private fun LeaderboardListRowItem(
    user: LeaderboardUser,
    onCheer: (String) -> Unit
) {
    val formattedRank = if (user.rank < 10) "0${user.rank}" else user.rank.toString()

    Tactile3DCard(
        onClick = { onCheer("👏") },
        containerColor = Color.White,
        bevelColor = Color(0xFFE2E8F0),
        cornerRadius = 18.dp,
        elevationDepth = 3.dp,
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 14.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            // Rank Number
            Text(
                text = formattedRank,
                style = MaterialTheme.typography.titleMedium.copy(
                    fontWeight = FontWeight.ExtraBold,
                    color = Color(0xFF64748B),
                    fontSize = 14.sp
                ),
                modifier = Modifier.width(24.dp)
            )

            // Avatar
            Avatar3DRenderer(
                avatarIdOrEmoji = user.avatarUrl?.takeIf { it.isNotBlank() } ?: com.example.ui.components.AvatarRegistry.defaultAvatarForTier(user.academicTier).id,
                size = 38.dp,
                showAura = false,
                isAnimated = false,
                borderWidth = 1.5.dp
            )

            // Name & School
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = user.name.ifBlank { "Explorer" },
                    style = MaterialTheme.typography.titleSmall.copy(
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFF1E293B)
                    ),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Text(
                    text = if (user.school.isNotBlank()) user.school else "Explorer Cadet",
                    style = MaterialTheme.typography.labelSmall.copy(
                        color = Color(0xFF64748B),
                        fontSize = 10.sp
                    ),
                    maxLines = 1
                )
            }

            // High-Five Peer Cheer Button
            Surface(
                shape = RoundedCornerShape(10.dp),
                color = Color(0xFFFEF3C7),
                border = BorderStroke(1.dp, Color(0xFFFDE68A)),
                modifier = Modifier.tactileClick(onClick = { onCheer("👏") })
            ) {
                Text("👏 Cheer", modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp), fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Color(0xFFB45309))
            }

            // Star XP Pill
            Surface(
                shape = RoundedCornerShape(12.dp),
                color = Color(0xFFF8FAFC),
                border = BorderStroke(1.dp, Color(0xFFE2E8F0))
            ) {
                Row(
                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    Text("⭐", fontSize = 11.sp)
                    Text(
                        text = "${user.totalXp}",
                        style = MaterialTheme.typography.labelMedium.copy(
                            fontWeight = FontWeight.ExtraBold,
                            color = Color(0xFF0F172A)
                        )
                    )
                }
            }
        }
    }
}

@Composable
private fun StickyUserRankCard(user: LeaderboardUser, isOffline: Boolean = false) {
    Tactile3DCard(
        onClick = {},
        containerColor = if (isOffline) Color(0xFF334155) else Color(0xFF1E293B),
        bevelColor = Color(0xFF0F172A),
        cornerRadius = 20.dp,
        elevationDepth = 4.dp,
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = if (isOffline) "Your Local Score (Offline)" else "Your Rank #${user.rank}",
                    style = MaterialTheme.typography.titleMedium.copy(
                        fontWeight = FontWeight.ExtraBold,
                        color = Color.White
                    )
                )
                Text(
                    text = if (isOffline) "Connect to internet to sync live cloud rank ⚡" else "Keep playing to climb higher! 🚀",
                    style = MaterialTheme.typography.labelSmall.copy(
                        color = Color(0xFF94A3B8),
                        fontSize = 11.sp
                    )
                )
            }

            Surface(
                shape = RoundedCornerShape(14.dp),
                color = Color(0xFFFF7A00)
            ) {
                Row(
                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    Text("⭐", fontSize = 13.sp)
                    Text(
                        text = "${user.totalXp} Stars",
                        style = MaterialTheme.typography.labelMedium.copy(
                            fontWeight = FontWeight.ExtraBold,
                            color = Color.White
                        )
                    )
                }
            }
        }
    }
}

