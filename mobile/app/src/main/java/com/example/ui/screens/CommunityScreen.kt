package com.example.ui.screens

import androidx.compose.foundation.clickable
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
import androidx.compose.material.icons.filled.Group
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.People
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.ThumbUp
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CenterAlignedTopAppBar
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.data.local.entities.SocialPostEntity
import com.example.ui.components.StuddyHeroCard
import com.example.ui.components.StuddyListCard
import com.example.ui.theme.AcademicTier
import com.example.ui.theme.tierAccent
import com.example.ui.theme.StuddyHubThemeTokens
import com.example.ui.theme.tierTertiary
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CommunityScreen(
    feedPosts: List<SocialPostEntity>,
    onNavigateToFeed: () -> Unit,
    onNavigateToGroups: () -> Unit,
    onNavigateToNotifications: () -> Unit,
    onNavigateToProfile: () -> Unit
) {
    val tierColors = StuddyHubThemeTokens.colors
    val tier = StuddyHubThemeTokens.tier
    Scaffold(
        topBar = {
            CenterAlignedTopAppBar(
                title = {
                    Text(
                        text = if (tier == AcademicTier.ACHIEVER) "Community ⚡" else "Community",
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
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Tier-branded hero copy: Achiever gets an exam-squad spin, others keep the general message
            val heroTitle = if (tier == AcademicTier.ACHIEVER) "Your WASSCE squad is here" else "You're not studying alone"
            val heroSubtitle = if (tier == AcademicTier.ACHIEVER)
                "Past-question tips, study groups, and reminders that keep you exam-ready."
            else
                "Activity, groups, and reminders that keep you motivated — right where you are."
            StuddyHeroCard(
                title = heroTitle,
                subtitle = heroSubtitle,
                icon = Icons.Default.People,
                colors = listOf(tierColors.primary, tierColors.primaryVariant),
                actionLabel = "Feed",
                onAction = onNavigateToFeed
            )

            // ── Live activity — the tab opens on real posts, not a menu ──
            if (feedPosts.isNotEmpty()) {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(20.dp),
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.45f)
                    )
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "Recent Activity",
                                style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold),
                                modifier = Modifier.weight(1f)
                            )
                            TextButton(onClick = onNavigateToFeed) {
                                Text("See all", color = tierColors.primary, fontWeight = FontWeight.Bold)
                            }
                        }
                        feedPosts.take(5).forEach { post ->
                            FeedPreviewRow(post = post, onClick = onNavigateToFeed)
                        }
                    }
                }
            } else {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(20.dp),
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.45f)
                    )
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(20.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Icon(
                            Icons.Default.People,
                            contentDescription = null,
                            tint = tierColors.primary,
                            modifier = Modifier.size(32.dp)
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = "No activity yet",
                            style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold)
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = "Be the first to share a study update with the community.",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        TextButton(onClick = onNavigateToFeed) {
                            Text("Open the Feed", color = tierColors.primary, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }

            Text(
                text = "Explore",
                style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold)
            )

            StuddyListCard(
                title = "Activity Feed",
                subtitle = "See the latest posts and collaboration",
                icon = Icons.Default.Home,
                accent = tierColors.primary,
                onClick = onNavigateToFeed
            )
            StuddyListCard(
                title = "Study Groups",
                subtitle = "Join communities and collaborate",
                icon = Icons.Default.Group,
                accent = tierTertiary(),
                onClick = onNavigateToGroups
            )
            StuddyListCard(
                title = "Notifications",
                subtitle = "Review alerts and study reminders",
                icon = Icons.Default.Notifications,
                accent = tierAccent(),
                onClick = onNavigateToNotifications
            )
            StuddyListCard(
                title = "Profile",
                subtitle = "Update your student workspace",
                icon = Icons.Default.Person,
                accent = tierColors.primaryVariant,
                onClick = onNavigateToProfile
            )

            // Clearance so the last card isn't hidden behind the floating pill nav.
            Spacer(modifier = Modifier.height(80.dp))
        }
    }
}

@Composable
private fun FeedPreviewRow(post: SocialPostEntity, onClick: () -> Unit) {        Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .padding(vertical = 6.dp)
            .clickable(onClick = onClick),
        verticalAlignment = Alignment.Top
    ) {
        // Letter avatar — consistent with the social feed.
        androidx.compose.material3.Surface(
            shape = CircleShape,
            color = StuddyHubThemeTokens.colors.primary.copy(alpha = 0.15f),
            modifier = Modifier.size(36.dp)
        ) {
            androidx.compose.foundation.layout.Box(
                contentAlignment = Alignment.Center,
                modifier = Modifier.fillMaxSize()
            ) {
                Text(
                    text = post.authorName.take(1).uppercase(),
                    style = MaterialTheme.typography.labelMedium.copy(
                        fontWeight = FontWeight.Bold,
                        color = StuddyHubThemeTokens.colors.primary
                    )
                )
            }
        }
        Spacer(modifier = Modifier.width(10.dp))
        androidx.compose.foundation.layout.Column(modifier = Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = post.authorName,
                    style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f, fill = false)
                )
                Spacer(modifier = Modifier.width(6.dp))
                Text(
                    text = timeAgoLabel(post.createdAt),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f)
                )
            }
            Spacer(modifier = Modifier.height(2.dp))
            Text(
                text = post.content,
                style = MaterialTheme.typography.bodySmall,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.8f)
            )
            Spacer(modifier = Modifier.height(4.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    Icons.Default.ThumbUp,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.4f),
                    modifier = Modifier.size(12.dp)
                )
                Spacer(modifier = Modifier.width(3.dp))
                Text(
                    text = "${post.likesCount}",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f)
                )
            }
        }
    }
}

private fun timeAgoLabel(ts: Long): String {
    val diff = System.currentTimeMillis() - ts
    return when {
        diff < 60_000 -> "now"
        diff < 3_600_000 -> "${diff / 60_000}m"
        diff < 86_400_000 -> "${diff / 3_600_000}h"
        else -> SimpleDateFormat("MMM d", Locale.getDefault()).format(Date(ts))
    }
}
