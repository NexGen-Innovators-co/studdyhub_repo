package com.example.ui.screens.dashboard

import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.example.R
import com.example.ui.components.Tactile3DButton
import com.example.ui.components.Tactile3DCard
import com.example.ui.components.TactileSoundSystem
import com.example.ui.navigation.Screen

data class RoadmapNode(
    val id: String,
    val title: String,
    val subtitle: String,
    val iconEmoji: String,
    val stepType: String, // "lesson", "game", "chest", "boss"
    val refId: String? = null,
    val levelNumber: Int,
    val stars: Int = 0,
    val isCompleted: Boolean = false,
    val isCurrent: Boolean = false,
    val isLocked: Boolean = false,
    val rewardText: String? = null,
    val biome: String = "FOREST" // "FOREST", "COAST", "SAVANNAH", "CITADEL"
)

val ADVENTURE_MAP_NODES = listOf(
    RoadmapNode(
        id = "node_1",
        title = "Living World",
        subtitle = "Science Lesson 1",
        iconEmoji = "🌱",
        stepType = "lesson",
        refId = "sci",
        levelNumber = 1,
        stars = 3,
        isCompleted = true,
        biome = "FOREST"
    ),
    RoadmapNode(
        id = "node_2",
        title = "Ananse's Web",
        subtitle = "Logic Riddles",
        iconEmoji = "🕷️",
        stepType = "game",
        refId = "ananse_riddles",
        levelNumber = 2,
        stars = 3,
        isCompleted = true,
        biome = "FOREST"
    ),
    RoadmapNode(
        id = "node_3",
        title = "Oware Math",
        subtitle = "Number Quest",
        iconEmoji = "🧮",
        stepType = "game",
        refId = "maths_quest",
        levelNumber = 3,
        stars = 2,
        isCompleted = true,
        biome = "FOREST"
    ),
    RoadmapNode(
        id = "node_chest_1",
        title = "Forest Treasure Chest",
        subtitle = "Milestone Vault",
        iconEmoji = "🎁",
        stepType = "chest",
        levelNumber = 4,
        isCompleted = true,
        rewardText = "+50 Stars ⭐ Claimed!",
        biome = "COAST"
    ),
    RoadmapNode(
        id = "node_5",
        title = "Kente Heritage",
        subtitle = "Culture & History",
        iconEmoji = "👑",
        stepType = "game",
        refId = "kente_quiz",
        levelNumber = 5,
        stars = 0,
        isCurrent = true,
        biome = "COAST"
    ),
    RoadmapNode(
        id = "node_6",
        title = "National Spelling Bee",
        subtitle = "Word Master Race",
        iconEmoji = "🐝",
        stepType = "game",
        refId = "spelling_bee",
        levelNumber = 6,
        isLocked = true,
        biome = "SAVANNAH"
    ),
    RoadmapNode(
        id = "node_7",
        title = "Ghana Heroes & Freedom",
        subtitle = "Social Studies Lesson",
        iconEmoji = "🇬🇭",
        stepType = "lesson",
        refId = "sst",
        levelNumber = 7,
        isLocked = true,
        biome = "SAVANNAH"
    ),
    RoadmapNode(
        id = "node_8_blaster",
        title = "Math Asteroid Blaster",
        subtitle = "Space Laser Defense",
        iconEmoji = "🚀",
        stepType = "game",
        refId = "math_asteroid_blaster",
        levelNumber = 8,
        isLocked = false,
        biome = "SAVANNAH"
    ),
    RoadmapNode(
        id = "node_chest_2",
        title = "Savannah Gold Vault",
        subtitle = "Mystery Avatar Key",
        iconEmoji = "🗝️",
        stepType = "chest",
        levelNumber = 9,
        isLocked = true,
        rewardText = "100 Stars + Cheetah Avatar",
        biome = "CITADEL"
    ),
    RoadmapNode(
        id = "node_9",
        title = "Digital Safe & ICT",
        subtitle = "Computing Skills",
        iconEmoji = "💻",
        stepType = "lesson",
        refId = "ict",
        levelNumber = 9,
        isLocked = true,
        biome = "CITADEL"
    ),
    RoadmapNode(
        id = "node_10",
        title = "Black Star Citadel Boss",
        subtitle = "Ultimate Grand Championship",
        iconEmoji = "🏆",
        stepType = "boss",
        refId = "maths_quest",
        levelNumber = 10,
        isLocked = true,
        biome = "CITADEL"
    )
)

/**
 * 🗺️ Connected-Chain Adventure Quest Map for Explorers.
 * Shows winding chain-connected stages with biome zones, floating island nodes,
 * pulsing current stage, and milestone treasure chests!
 */
@Composable
fun ExplorerRoadmapDialog(
    currentStreak: Int,
    totalStars: Int,
    onDismiss: () -> Unit,
    onNavigate: (String) -> Unit
) {
    val nodes = remember { ADVENTURE_MAP_NODES }

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    Brush.verticalGradient(
                        colors = listOf(
                            Color(0xFF0F172A),
                            Color(0xFF1E1B4B),
                            Color(0xFF14532D),
                            Color(0xFF0F766E)
                        )
                    )
                )
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .statusBarsPadding()
            ) {
                // Top Header Bar
                Surface(
                    color = Color.Black.copy(alpha = 0.5f),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp, vertical = 12.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            IconButton(
                                onClick = onDismiss,
                                colors = IconButtonDefaults.iconButtonColors(containerColor = Color.White.copy(alpha = 0.2f))
                            ) {
                                Icon(Icons.Default.Close, contentDescription = "Close", tint = Color.White)
                            }
                            Column {
                                Text(
                                    text = "Adventure Quest Map 🗺️",
                                    style = MaterialTheme.typography.titleMedium.copy(
                                        fontWeight = FontWeight.ExtraBold,
                                        color = Color.White
                                    )
                                )
                                Text(
                                    text = "$currentStreak Days Streak · Stage 5 of 10",
                                    style = MaterialTheme.typography.labelSmall.copy(
                                        color = Color(0xFFFDE68A),
                                        fontWeight = FontWeight.Bold
                                    )
                                )
                            }
                        }

                        // Star Vault Pill
                        Surface(
                            shape = RoundedCornerShape(16.dp),
                            color = Color(0xFFFFD700),
                            border = BorderStroke(2.dp, Color(0xFFB45309))
                        ) {
                            Row(
                                modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(4.dp)
                            ) {
                                Text("⭐", fontSize = 14.sp)
                                Text(
                                    text = "$totalStars",
                                    style = MaterialTheme.typography.labelMedium.copy(
                                        fontWeight = FontWeight.ExtraBold,
                                        color = Color(0xFF78350F)
                                    )
                                )
                            }
                        }
                    }
                }

                // Winding Connected Chain List
                LazyColumn(
                    modifier = Modifier
                        .fillMaxSize()
                        .weight(1f),
                    contentPadding = PaddingValues(horizontal = 24.dp, vertical = 24.dp),
                    verticalArrangement = Arrangement.spacedBy(0.dp)
                ) {
                    itemsIndexed(nodes.reversed()) { index, node ->
                        // Zig-zag offset: Center, Left, Center, Right...
                        val alignment = when (index % 4) {
                            0 -> Alignment.CenterHorizontally
                            1 -> Alignment.Start
                            2 -> Alignment.CenterHorizontally
                            else -> Alignment.End
                        }

                        Column(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalAlignment = alignment
                        ) {
                            // Render Chain Link to previous node if not first item
                            if (index > 0) {
                                ConnectedChainLink(isLocked = node.isLocked)
                            }

                            RoadmapChainNodeItem(
                                node = node,
                                onNodeClick = {
                                    if (!node.isLocked) {
                                        TactileSoundSystem.playPopSound()
                                        onDismiss()
                                        if (node.stepType == "game" && !node.refId.isNullOrBlank()) {
                                            if (node.refId == "math_asteroid_blaster") {
                                                onNavigate(Screen.MathAsteroidBlaster.route)
                                            } else {
                                                onNavigate(Screen.GameDetail.createRoute(node.refId))
                                            }
                                        } else if (node.stepType == "lesson" && !node.refId.isNullOrBlank()) {
                                            onNavigate(Screen.LearnIt.createRoute(node.refId))
                                        } else if (node.stepType == "chest") {
                                            onNavigate(Screen.ExplorerStore.route)
                                        }
                                    } else {
                                        TactileSoundSystem.playWrongSound()
                                    }
                                }
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ConnectedChainLink(isLocked: Boolean) {
    Column(
        modifier = Modifier.padding(vertical = 4.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(3.dp)
    ) {
        repeat(3) {
            Box(
                modifier = Modifier
                    .size(width = 8.dp, height = 12.dp)
                    .clip(RoundedCornerShape(4.dp))
                    .background(if (isLocked) Color(0xFF475569) else Color(0xFFFFD700))
                    .then(
                        if (!isLocked) Modifier.background(
                            Brush.verticalGradient(listOf(Color(0xFFFFE57F), Color(0xFFF59E0B)))
                        ) else Modifier
                    )
            )
        }
    }
}

@Composable
fun RoadmapChainNodeItem(
    node: RoadmapNode,
    onNodeClick: () -> Unit
) {
    val infiniteTransition = rememberInfiniteTransition(label = "pulse_node")
    val pulseScale by infiniteTransition.animateFloat(
        initialValue = 1f,
        targetValue = if (node.isCurrent) 1.15f else 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(850, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "pulse"
    )

    val biomeBorderColor = when (node.biome) {
        "FOREST" -> Color(0xFF22C55E)
        "COAST" -> Color(0xFF38BDF8)
        "SAVANNAH" -> Color(0xFFF59E0B)
        else -> Color(0xFFA855F7)
    }

    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(6.dp),
        modifier = Modifier.padding(vertical = 4.dp)
    ) {
        if (node.isCurrent) {
            Surface(
                shape = RoundedCornerShape(12.dp),
                color = Color(0xFFFF7A00),
                border = BorderStroke(1.5.dp, Color.White),
                shadowElevation = 8.dp
            ) {
                Text(
                    text = "🚀 ACTIVE QUEST",
                    style = MaterialTheme.typography.labelSmall.copy(
                        fontWeight = FontWeight.ExtraBold,
                        color = Color.White,
                        fontSize = 10.sp
                    ),
                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                )
            }
        }

        // 3D Circular Node Bubble with Glowing Chain Ring
        Box(
            modifier = Modifier
                .scale(pulseScale)
                .size(if (node.isCurrent) 86.dp else 74.dp),
            contentAlignment = Alignment.Center
        ) {
            Tactile3DCard(
                onClick = onNodeClick,
                containerColor = when {
                    node.isCompleted -> Color(0xFF22C55E)
                    node.isCurrent -> Color(0xFFFF7A00)
                    node.stepType == "chest" -> Color(0xFFF59E0B)
                    node.stepType == "boss" -> Color(0xFFDC2626)
                    else -> Color(0xFF334155)
                },
                bevelColor = when {
                    node.isCompleted -> Color(0xFF15803D)
                    node.isCurrent -> Color(0xFFC45500)
                    node.stepType == "chest" -> Color(0xFFB45309)
                    node.stepType == "boss" -> Color(0xFF991B1B)
                    else -> Color(0xFF1E293B)
                },
                cornerRadius = 40.dp,
                elevationDepth = if (node.isLocked) 2.dp else 6.dp,
                enabled = !node.isLocked,
                modifier = Modifier.fillMaxSize()
            ) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center
                ) {
                    if (node.isLocked) {
                        Icon(
                            imageVector = Icons.Default.Lock,
                            contentDescription = "Locked",
                            tint = Color(0xFF94A3B8),
                            modifier = Modifier.size(26.dp)
                        )
                    } else {
                        Text(
                            text = node.iconEmoji,
                            fontSize = if (node.isCurrent) 32.sp else 28.sp
                        )
                    }
                }
            }
        }

        // Title and Star Badges
        Surface(
            shape = RoundedCornerShape(12.dp),
            color = Color.Black.copy(alpha = 0.7f),
            border = BorderStroke(1.dp, biomeBorderColor.copy(alpha = 0.6f)),
            modifier = Modifier.padding(top = 2.dp)
        ) {
            Column(
                modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(
                    text = "${node.levelNumber}. ${node.title}",
                    style = MaterialTheme.typography.labelMedium.copy(
                        fontWeight = FontWeight.Bold,
                        color = Color.White,
                        fontSize = 11.sp
                    )
                )
                if (node.isCompleted && node.stars > 0) {
                    Row(horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                        repeat(3) { i ->
                            Text(
                                text = if (i < node.stars) "⭐" else "☆",
                                fontSize = 11.sp
                            )
                        }
                    }
                } else if (node.rewardText != null) {
                    Text(
                        text = node.rewardText,
                        style = MaterialTheme.typography.labelSmall.copy(
                            color = Color(0xFFFDE68A),
                            fontWeight = FontWeight.Bold,
                            fontSize = 9.sp
                        )
                    )
                }
            }
        }
    }
}
