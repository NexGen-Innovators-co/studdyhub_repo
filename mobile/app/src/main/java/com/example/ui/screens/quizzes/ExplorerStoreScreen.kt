package com.example.ui.screens.quizzes

import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
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
import com.example.data.repository.StuddyHubRepository
import com.example.ui.components.*
import kotlinx.coroutines.launch

data class StoreBoosterItem(
    val id: String,
    val name: String,
    val description: String,
    val priceStars: Int,
    val iconEmoji: String,
    val badge: String
)

private enum class StoreTab(val label: String, val iconEmoji: String) {
    AVATARS("3D Avatars", "🎭"),
    ACCESSORIES("Gear & Hats", "👑"),
    BOOSTERS("Power-Ups", "⚡")
}

/**
 * 🛍️ 3D Gamified Explorer Avatar & Gear Arcade Store.
 * Features high-fidelity Pixar/Claymation 3D avatars, equippable accessories, rarity auras, and star power-ups!
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ExplorerStoreScreen(
    onBack: () -> Unit = {}
) {
    val context = LocalContext.current
    val repo = remember(context) { StuddyHubRepository.getInstance(StuddyHubDatabase.getDatabase(context.applicationContext)) }
    val profile by repo.userProfile.collectAsStateWithLifecycle(initialValue = null)
    val stats by repo.userStats.collectAsStateWithLifecycle(initialValue = null)
    val coroutineScope = rememberCoroutineScope()

    LaunchedEffect(Unit) {
        repo.refreshProfilePointsFromCloud()
    }

    var activeTab by remember { mutableStateOf(StoreTab.AVATARS) }
    var selectedAvatarForInspect by remember { mutableStateOf<AvatarItem?>(null) }
    var busyMessage by remember { mutableStateOf<String?>(null) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    val userId = profile?.id.orEmpty()
    val userTier = profile?.academicTier
    var unlockedAvatars by remember(userId, userTier) {
        mutableStateOf(AvatarInventoryManager.getUnlockedAvatarIds(context, userId, userTier))
    }
    var unlockedAccessories by remember(userId) {
        mutableStateOf(AvatarInventoryManager.getUnlockedAccessoryIds(context, userId))
    }

    // Equipped accessories state
    var equippedAccessory by remember { mutableStateOf<String?>(null) }

    val points = profile?.pointsBalance ?: 0
    val streakFreezes = stats?.streakFreezes ?: 0
    val currentAvatarId = profile?.avatarUrl.orEmpty()
    val equippedAvatar = remember(currentAvatarId) {
        AvatarRegistry.findAvatar(currentAvatarId) ?: AvatarRegistry.AVATARS.first()
    }

    val boosterCatalog = remember {
        listOf(
            StoreBoosterItem(
                id = "freeze",
                name = "Streak Shield 🛡️",
                description = "Protects your daily learning streak if you miss a day!",
                priceStars = 80,
                iconEmoji = "🛡️",
                badge = "$streakFreezes Active"
            ),
            StoreBoosterItem(
                id = "double_xp",
                name = "Double Star Potion 🧪",
                description = "Doubles all XP earned from quizzes for 24 hours!",
                priceStars = 120,
                iconEmoji = "🧪",
                badge = "2X Boost"
            ),
            StoreBoosterItem(
                id = "fifty_fifty",
                name = "50/50 Power Vault ⚡",
                description = "Instantly removes 2 wrong answers during any quiz battle!",
                priceStars = 60,
                iconEmoji = "⚡",
                badge = "Battle Item"
            )
        )
    }

    fun purchase(cost: Int, block: suspend () -> Unit, successText: String) {
        if (points < cost) {
            errorMessage = "Not enough Coins! 🪙 Play more to earn $cost coins."
            TactileSoundSystem.playWrongSound()
            return
        }
        coroutineScope.launch {
            val ok = repo.spendPoints(cost)
            if (ok) {
                block()
                TactileSoundSystem.playCelebrationBeep()
                busyMessage = successText
            } else {
                errorMessage = "Could not complete purchase."
            }
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(
                            "3D Avatar & Gear Store 🛍️",
                            fontWeight = FontWeight.ExtraBold,
                            color = Color.White,
                            fontSize = 18.sp
                        )
                        Text(
                            "Customize your 3D scholar identity",
                            style = MaterialTheme.typography.labelSmall.copy(color = Color.White.copy(alpha = 0.8f))
                        )
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(
                            Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Back",
                            tint = Color.White
                        )
                    }
                },
                actions = {
                    // Current Coins Pill
                    Surface(
                        shape = RoundedCornerShape(16.dp),
                        color = Color.Black.copy(alpha = 0.35f),
                        border = BorderStroke(1.5.dp, Color(0xFF10B981)),
                        modifier = Modifier.padding(end = 12.dp)
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Text("🪙", fontSize = 16.sp)
                            Text(
                                text = "$points Coins",
                                style = MaterialTheme.typography.labelLarge.copy(
                                    fontWeight = FontWeight.ExtraBold,
                                    color = Color(0xFF10B981)
                                )
                            )
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Color(0xFF1E1B4B))
            )
        },
        containerColor = Color(0xFF0F172A)
    ) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .background(
                    Brush.verticalGradient(
                        colors = listOf(Color(0xFF1E1B4B), Color(0xFF0F172A), Color(0xFF020617))
                    )
                )
        ) {
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(horizontal = 16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp),
                contentPadding = PaddingValues(top = 14.dp, bottom = 48.dp)
            ) {
                // 1. Interactive 3D Showcase Stage
                item {
                    val displayedAvatar = selectedAvatarForInspect ?: equippedAvatar
                    val isCurrentlyEquipped = currentAvatarId.equals(displayedAvatar.id, ignoreCase = true)

                    Tactile3DCard(
                        onClick = {},
                        containerColor = displayedAvatar.rarity.badgeBg,
                        bevelColor = Color(0xFF0F172A),
                        cornerRadius = 24.dp,
                        elevationDepth = 6.dp,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .background(
                                    Brush.radialGradient(
                                        colors = listOf(
                                            displayedAvatar.rarity.primaryColor.copy(alpha = 0.35f),
                                            Color.Transparent
                                        )
                                    )
                                )
                                .padding(18.dp)
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(16.dp)
                            ) {
                                // 3D Character Renderer Stage
                                Avatar3DRenderer(
                                    avatarIdOrEmoji = displayedAvatar.id,
                                    size = 96.dp,
                                    showAura = true,
                                    isAnimated = true,
                                    borderWidth = 3.dp,
                                    accessoryEmoji = equippedAccessory
                                )

                                Column(modifier = Modifier.weight(1f)) {
                                    val isDisplayedOwned = isCurrentlyEquipped || unlockedAvatars.contains(displayedAvatar.id) || displayedAvatar.priceStars == 0 || displayedAvatar.isDefault

                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                                    ) {
                                        Surface(
                                            shape = RoundedCornerShape(8.dp),
                                            color = displayedAvatar.rarity.primaryColor
                                        ) {
                                            Text(
                                                text = displayedAvatar.rarity.label.uppercase(),
                                                style = MaterialTheme.typography.labelSmall.copy(
                                                    fontWeight = FontWeight.Black,
                                                    color = Color.White,
                                                    fontSize = 10.sp
                                                ),
                                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp)
                                            )
                                        }

                                        if (isCurrentlyEquipped) {
                                            Surface(
                                                shape = RoundedCornerShape(8.dp),
                                                color = Color(0xFF10B981)
                                            ) {
                                                Text(
                                                    text = "CURRENTLY EQUIPPED",
                                                    style = MaterialTheme.typography.labelSmall.copy(
                                                        fontWeight = FontWeight.Black,
                                                        color = Color.White,
                                                        fontSize = 10.sp
                                                    ),
                                                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp)
                                                )
                                            }
                                        } else if (isDisplayedOwned) {
                                            Surface(
                                                shape = RoundedCornerShape(8.dp),
                                                color = Color(0xFF8B5CF6)
                                            ) {
                                                Text(
                                                    text = "OWNED",
                                                    style = MaterialTheme.typography.labelSmall.copy(
                                                        fontWeight = FontWeight.Black,
                                                        color = Color.White,
                                                        fontSize = 10.sp
                                                    ),
                                                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp)
                                                )
                                            }
                                        }
                                    }

                                    Spacer(modifier = Modifier.height(4.dp))
                                    Text(
                                        text = displayedAvatar.name,
                                        style = MaterialTheme.typography.titleLarge.copy(
                                            fontWeight = FontWeight.ExtraBold,
                                            color = Color.White
                                        )
                                    )
                                    Text(
                                        text = "${displayedAvatar.title} • ${displayedAvatar.auraName}",
                                        style = MaterialTheme.typography.bodySmall.copy(
                                            color = Color.White.copy(alpha = 0.8f)
                                        )
                                    )

                                    Spacer(modifier = Modifier.height(10.dp))
                                    if (!isCurrentlyEquipped) {
                                        if (isDisplayedOwned) {
                                            Tactile3DButton(
                                                text = "Equip Avatar (Free)",
                                                onClick = {
                                                    coroutineScope.launch {
                                                        repo.setAvatarEmoji(displayedAvatar.id)
                                                        selectedAvatarForInspect = displayedAvatar
                                                        TactileSoundSystem.playCelebrationBeep()
                                                        busyMessage = "Equipped ${displayedAvatar.name}! 🎉"
                                                    }
                                                },
                                                containerColor = Color(0xFF6366F1),
                                                bevelColor = Color(0xFF4F46E5),
                                                modifier = Modifier.fillMaxWidth()
                                            )
                                        } else {
                                            Tactile3DButton(
                                                text = "Unlock & Equip 🪙 ${displayedAvatar.priceStars}",
                                                onClick = {
                                                    purchase(
                                                        cost = displayedAvatar.priceStars,
                                                        block = {
                                                            AvatarInventoryManager.unlockAvatar(context, userId, displayedAvatar.id)
                                                            unlockedAvatars = AvatarInventoryManager.getUnlockedAvatarIds(context, userId, userTier)
                                                            repo.setAvatarEmoji(displayedAvatar.id)
                                                            selectedAvatarForInspect = displayedAvatar
                                                        },
                                                        successText = "Unlocked & Equipped ${displayedAvatar.name}! 🎉"
                                                    )
                                                },
                                                containerColor = Color(0xFFFF7A00),
                                                bevelColor = Color(0xFFD96300),
                                                modifier = Modifier.fillMaxWidth()
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                // 2. Navigation Category Tabs (Avatars, Accessories, Boosters)
                item {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(Color(0xFF1E293B), RoundedCornerShape(16.dp))
                            .padding(4.dp),
                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        StoreTab.values().forEach { tab ->
                            val isSelected = activeTab == tab
                            Box(
                                modifier = Modifier
                                    .weight(1f)
                                    .clip(RoundedCornerShape(12.dp))
                                    .background(if (isSelected) Color(0xFF4F46E5) else Color.Transparent)
                                    .clickable {
                                        activeTab = tab
                                        TactileSoundSystem.playPopSound()
                                    }
                                    .padding(vertical = 10.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                                ) {
                                    Text(tab.iconEmoji, fontSize = 14.sp)
                                    Text(
                                        text = tab.label,
                                        style = MaterialTheme.typography.labelMedium.copy(
                                            fontWeight = if (isSelected) FontWeight.ExtraBold else FontWeight.Medium,
                                            color = if (isSelected) Color.White else Color(0xFF94A3B8)
                                        )
                                    )
                                }
                            }
                        }
                    }
                }

                // 3. Tab Contents
                when (activeTab) {
                    StoreTab.AVATARS -> {
                        item {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    "3D Claymation Roster 🎭",
                                    style = MaterialTheme.typography.titleMedium.copy(
                                        fontWeight = FontWeight.ExtraBold,
                                        color = Color.White
                                    )
                                )
                                Text(
                                    "Tap to inspect",
                                    style = MaterialTheme.typography.labelSmall.copy(color = Color(0xFF94A3B8))
                                )
                            }
                        }

                        items(AvatarRegistry.AVATARS.chunked(2)) { pair ->
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(12.dp)
                            ) {
                                pair.forEach { avatar ->
                                    val isEquipped = currentAvatarId.equals(avatar.id, ignoreCase = true)
                                    val isOwned = isEquipped || unlockedAvatars.contains(avatar.id) || avatar.priceStars == 0 || avatar.isDefault
                                    val isInspecting = selectedAvatarForInspect?.id == avatar.id

                                    Tactile3DCard(
                                        onClick = {
                                            selectedAvatarForInspect = avatar
                                            TactileSoundSystem.playPopSound()
                                        },
                                        containerColor = if (isInspecting) avatar.rarity.badgeBg else Color(0xFF1E293B),
                                        bevelColor = Color(0xFF0F172A),
                                        cornerRadius = 20.dp,
                                        elevationDepth = if (isInspecting) 6.dp else 4.dp,
                                        modifier = Modifier
                                            .weight(1f)
                                            .then(
                                                if (isEquipped) Modifier.border(2.dp, Color(0xFF10B981), RoundedCornerShape(20.dp))
                                                else Modifier
                                            )
                                    ) {
                                        Column(
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .padding(12.dp),
                                            horizontalAlignment = Alignment.CenterHorizontally,
                                            verticalArrangement = Arrangement.spacedBy(8.dp)
                                        ) {
                                            // Rarity Pill
                                            Surface(
                                                shape = RoundedCornerShape(6.dp),
                                                color = avatar.rarity.primaryColor.copy(alpha = 0.2f),
                                                border = BorderStroke(1.dp, avatar.rarity.primaryColor)
                                            ) {
                                                Text(
                                                    text = avatar.rarity.label,
                                                    style = MaterialTheme.typography.labelSmall.copy(
                                                        color = avatar.rarity.primaryColor,
                                                        fontWeight = FontWeight.Bold,
                                                        fontSize = 9.sp
                                                    ),
                                                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                                )
                                            }

                                            // 3D Avatar Image
                                            Avatar3DRenderer(
                                                avatarIdOrEmoji = avatar.id,
                                                size = 72.dp,
                                                showAura = isInspecting,
                                                isAnimated = isInspecting,
                                                borderWidth = 2.dp
                                            )

                                            Text(
                                                text = avatar.name,
                                                style = MaterialTheme.typography.titleSmall.copy(
                                                    fontWeight = FontWeight.ExtraBold,
                                                    color = Color.White
                                                ),
                                                maxLines = 1,
                                                textAlign = TextAlign.Center
                                            )

                                            // Price / Status Pill
                                            Surface(
                                                shape = RoundedCornerShape(10.dp),
                                                color = when {
                                                    isEquipped -> Color(0xFF10B981)
                                                    isOwned -> Color(0xFF8B5CF6)
                                                    else -> Color(0xFFFF7A00)
                                                }
                                            ) {
                                                Row(
                                                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp),
                                                    verticalAlignment = Alignment.CenterVertically,
                                                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                                                ) {
                                                    if (isEquipped) {
                                                        Icon(Icons.Default.Check, contentDescription = null, tint = Color.White, modifier = Modifier.size(11.dp))
                                                        Text("EQUIPPED", color = Color.White, fontWeight = FontWeight.Black, fontSize = 9.sp)
                                                    } else if (isOwned) {
                                                        Text("OWNED", color = Color.White, fontWeight = FontWeight.Black, fontSize = 9.sp)
                                                    } else {
                                                        Text("🪙 ${avatar.priceStars}", color = Color.White, fontWeight = FontWeight.ExtraBold, fontSize = 11.sp)
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                                if (pair.size == 1) {
                                    Spacer(modifier = Modifier.weight(1f))
                                }
                            }
                        }
                    }

                    StoreTab.ACCESSORIES -> {
                        item {
                            Text(
                                "Equippable Hats & Accessories 👑",
                                style = MaterialTheme.typography.titleMedium.copy(
                                    fontWeight = FontWeight.ExtraBold,
                                    color = Color.White
                                )
                            )
                        }

                        items(AvatarRegistry.ACCESSORIES) { acc ->
                            val isEquipped = equippedAccessory == acc.iconEmoji
                            val isOwned = isEquipped || unlockedAccessories.contains(acc.id)
                            Tactile3DCard(
                                onClick = {
                                    if (isEquipped) {
                                        equippedAccessory = null
                                        busyMessage = "Unequipped ${acc.name}"
                                        TactileSoundSystem.playPopSound()
                                    } else if (isOwned) {
                                        equippedAccessory = acc.iconEmoji
                                        busyMessage = "Equipped ${acc.name}! ${acc.iconEmoji}"
                                        TactileSoundSystem.playCelebrationBeep()
                                    } else {
                                        purchase(
                                            cost = acc.priceStars,
                                            block = {
                                                AvatarInventoryManager.unlockAccessory(context, userId, acc.id)
                                                unlockedAccessories = AvatarInventoryManager.getUnlockedAccessoryIds(context, userId)
                                                equippedAccessory = acc.iconEmoji
                                            },
                                            successText = "Unlocked & Equipped ${acc.name}! ${acc.iconEmoji}"
                                        )
                                    }
                                },
                                containerColor = Color(0xFF1E293B),
                                bevelColor = Color(0xFF0F172A),
                                cornerRadius = 18.dp,
                                elevationDepth = 4.dp,
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .then(
                                        if (isEquipped) Modifier.border(2.dp, Color(0xFF10B981), RoundedCornerShape(18.dp))
                                        else Modifier
                                    )
                            ) {
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(14.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(14.dp)
                                ) {
                                    Box(
                                        modifier = Modifier
                                            .size(54.dp)
                                            .clip(CircleShape)
                                            .background(Color(0xFF334155)),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Text(acc.iconEmoji, fontSize = 28.sp)
                                    }

                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(
                                            acc.name,
                                            style = MaterialTheme.typography.titleSmall.copy(
                                                fontWeight = FontWeight.ExtraBold,
                                                color = Color.White
                                            )
                                        )
                                        Text(
                                            acc.description,
                                            style = MaterialTheme.typography.bodySmall.copy(
                                                color = Color(0xFF94A3B8)
                                            )
                                        )
                                    }

                                    Surface(
                                        shape = RoundedCornerShape(12.dp),
                                        color = when {
                                            isEquipped -> Color(0xFF10B981)
                                            isOwned -> Color(0xFF8B5CF6)
                                            else -> Color(0xFF4F46E5)
                                        }
                                    ) {
                                        Row(
                                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                                            verticalAlignment = Alignment.CenterVertically,
                                            horizontalArrangement = Arrangement.spacedBy(4.dp)
                                        ) {
                                            if (isEquipped) {
                                                Icon(Icons.Default.Check, contentDescription = null, tint = Color.White, modifier = Modifier.size(12.dp))
                                                Text("EQUIPPED", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 10.sp)
                                            } else if (isOwned) {
                                                Text("OWNED", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 10.sp)
                                            } else {
                                                Text("🪙 ${acc.priceStars}", color = Color.White, fontWeight = FontWeight.ExtraBold, fontSize = 11.sp)
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }

                    StoreTab.BOOSTERS -> {
                        item {
                            Text(
                                "Power-Ups & Potions ⚡",
                                style = MaterialTheme.typography.titleMedium.copy(
                                    fontWeight = FontWeight.ExtraBold,
                                    color = Color.White
                                )
                            )
                        }

                        items(boosterCatalog) { booster ->
                            Tactile3DCard(
                                onClick = {
                                    when (booster.id) {
                                        "freeze" -> purchase(
                                            cost = booster.priceStars,
                                            block = { repo.addStreakFreeze() },
                                            successText = "Streak Shield activated! 🛡️"
                                        )
                                        else -> purchase(
                                            cost = booster.priceStars,
                                            block = {},
                                            successText = "${booster.name} ready for quiz battles!"
                                        )
                                    }
                                },
                                containerColor = Color(0xFF1E293B),
                                bevelColor = Color(0xFF0F172A),
                                cornerRadius = 18.dp,
                                elevationDepth = 4.dp,
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(14.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(14.dp)
                                ) {
                                    Box(
                                        modifier = Modifier
                                            .size(54.dp)
                                            .clip(CircleShape)
                                            .background(Color(0xFF334155)),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Text(booster.iconEmoji, fontSize = 28.sp)
                                    }

                                    Column(modifier = Modifier.weight(1f)) {
                                        Row(
                                            verticalAlignment = Alignment.CenterVertically,
                                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                                        ) {
                                            Text(
                                                booster.name,
                                                style = MaterialTheme.typography.titleSmall.copy(
                                                    fontWeight = FontWeight.ExtraBold,
                                                    color = Color.White
                                                )
                                            )
                                            Surface(
                                                shape = RoundedCornerShape(6.dp),
                                                color = Color(0xFF10B981).copy(alpha = 0.2f)
                                            ) {
                                                Text(
                                                    text = booster.badge,
                                                    style = MaterialTheme.typography.labelSmall.copy(
                                                        color = Color(0xFF34D399),
                                                        fontWeight = FontWeight.Bold,
                                                        fontSize = 9.sp
                                                    ),
                                                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                                )
                                            }
                                        }
                                        Text(
                                            booster.description,
                                            style = MaterialTheme.typography.bodySmall.copy(
                                                color = Color(0xFF94A3B8)
                                            )
                                        )
                                    }

                                    Surface(
                                        shape = RoundedCornerShape(12.dp),
                                        color = Color(0xFFFF7A00)
                                    ) {
                                        Row(
                                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                                            verticalAlignment = Alignment.CenterVertically,
                                            horizontalArrangement = Arrangement.spacedBy(4.dp)
                                        ) {
                                            Text("🪙 ${booster.priceStars}", color = Color.White, fontWeight = FontWeight.ExtraBold, fontSize = 11.sp)
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // Snackbar Notification / Feedback
            busyMessage?.let { msg ->
                Snackbar(
                    modifier = Modifier
                        .align(Alignment.BottomCenter)
                        .padding(16.dp),
                    action = {
                        TextButton(onClick = { busyMessage = null }) {
                            Text("OK", color = Color(0xFFFFD700), fontWeight = FontWeight.Bold)
                        }
                    },
                    containerColor = Color(0xFF1E293B),
                    contentColor = Color.White
                ) {
                    Text(msg, fontWeight = FontWeight.Bold)
                }
            }

            errorMessage?.let { err ->
                Snackbar(
                    modifier = Modifier
                        .align(Alignment.BottomCenter)
                        .padding(16.dp),
                    action = {
                        TextButton(onClick = { errorMessage = null }) {
                            Text("DISMISS", color = Color(0xFFF87171), fontWeight = FontWeight.Bold)
                        }
                    },
                    containerColor = Color(0xFF7F1D1D),
                    contentColor = Color.White
                ) {
                    Text(err, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}
