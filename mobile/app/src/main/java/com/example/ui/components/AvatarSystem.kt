package com.example.ui.components

import androidx.annotation.DrawableRes
import androidx.compose.animation.core.*
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.R

/**
 * Avatar Rarity tiers with custom gamified border gradients & auras.
 */
enum class AvatarRarity(
    val label: String,
    val primaryColor: Color,
    val secondaryColor: Color,
    val badgeBg: Color
) {
    COMMON("Common", Color(0xFF94A3B8), Color(0xFF64748B), Color(0xFF334155)),
    RARE("Rare", Color(0xFF38BDF8), Color(0xFF0284C7), Color(0xFF0369A1)),
    EPIC("Epic", Color(0xFFA855F7), Color(0xFF7E22CE), Color(0xFF581C87)),
    LEGENDARY("Legendary", Color(0xFFF59E0B), Color(0xFFD97706), Color(0xFF78350F)),
    MYTHIC("Mythic", Color(0xFFEC4899), Color(0xFFE11D48), Color(0xFF831843))
}

/**
 * Full 3D Avatar metadata item definition.
 */
data class AvatarItem(
    val id: String,
    val name: String,
    val title: String,
    val priceStars: Int,
    val emoji: String,
    @DrawableRes val drawableRes: Int?,
    val rarity: AvatarRarity,
    val themeColor: Color,
    val bevelColor: Color,
    val auraName: String = "Starlight",
    val isDefault: Boolean = false
)

/**
 * Equippable accessory / gear item.
 */
data class AccessoryItem(
    val id: String,
    val name: String,
    val category: String, // "head", "face", "aura"
    val iconEmoji: String,
    val priceStars: Int,
    val description: String
)

/**
 * Master Avatar Registry for StuddyHub 3D Avatars.
 */
object AvatarRegistry {
    val AVATARS = listOf(
        AvatarItem(
            id = "avatar_lion",
            name = "Simba Explorer",
            title = "Brave Safari Scout (Starter)",
            priceStars = 0,
            emoji = "🦁",
            drawableRes = R.drawable.img_avatar_lion_1786930325675,
            rarity = AvatarRarity.COMMON,
            themeColor = Color(0xFFFEF3C7),
            bevelColor = Color(0xFFFDE68A),
            auraName = "Golden Sunburst",
            isDefault = true
        ),
        AvatarItem(
            id = "avatar_falcon",
            name = "Aero Falcon",
            title = "Sky Navigator",
            priceStars = 200,
            emoji = "🦅",
            drawableRes = R.drawable.img_avatar_falcon_1786930358285,
            rarity = AvatarRarity.RARE,
            themeColor = Color(0xFFE0F2FE),
            bevelColor = Color(0xFFBAE6FD),
            auraName = "Wind Jetstream"
        ),
        AvatarItem(
            id = "avatar_astro",
            name = "Cosmic Ollie",
            title = "Galactic Pioneer",
            priceStars = 350,
            emoji = "🚀",
            drawableRes = R.drawable.img_avatar_astro_1786930344147,
            rarity = AvatarRarity.EPIC,
            themeColor = Color(0xFFF3E8FF),
            bevelColor = Color(0xFFE9D5FF),
            auraName = "Stardust Orbit"
        ),
        AvatarItem(
            id = "avatar_cheetah",
            name = "Volt Cheetah",
            title = "Fast Track Champion",
            priceStars = 500,
            emoji = "🐆",
            drawableRes = R.drawable.img_avatar_cheetah_1786930372381,
            rarity = AvatarRarity.LEGENDARY,
            themeColor = Color(0xFFFFEDD5),
            bevelColor = Color(0xFFFED7AA),
            auraName = "Lightning Pulse"
        ),
        AvatarItem(
            id = "avatar_dragon",
            name = "Draco Scholar",
            title = "Mystic Grandmaster",
            priceStars = 750,
            emoji = "🐲",
            drawableRes = R.drawable.img_avatar_dragon_1786930385954,
            rarity = AvatarRarity.MYTHIC,
            themeColor = Color(0xFFD1FAE5),
            bevelColor = Color(0xFFA7F3D0),
            auraName = "Emerald Fire"
        ),
        AvatarItem(
            id = "avatar_ollie",
            name = "Professor Ollie",
            title = "Chief Wisdom Owl",
            priceStars = 1000,
            emoji = "🦉",
            drawableRes = R.drawable.img_prof_ollie_1786717163116,
            rarity = AvatarRarity.MYTHIC,
            themeColor = Color(0xFFEFF6FF),
            bevelColor = Color(0xFFDBEAFE),
            auraName = "Genius Beacon"
        )
    )

    val ACCESSORIES = listOf(
        AccessoryItem("acc_crown", "Royal Gold Crown", "head", "👑", 120, "Look like academic royalty!"),
        AccessoryItem("acc_goggles", "Steampunk Goggles", "head", "🥽", 90, "Focus lens for quiz mastery!"),
        AccessoryItem("acc_shades", "Neon Matrix Shades", "face", "🕶️", 80, "Cool swagger during battles!"),
        AccessoryItem("acc_halo", "Star Scholar Halo", "head", "😇", 150, "Radiate pure knowledge!"),
        AccessoryItem("acc_sparkles", "Cosmic Sparkle Aura", "aura", "✨", 100, "Glitter wherever you tap!"),
        AccessoryItem("acc_flame", "Supernova Fire Trail", "aura", "🔥", 200, "For legendary winning streaks!")
    )

    /** Maps legacy emoji values to canonical avatar IDs. */
    private val EMOJI_TO_AVATAR_ID = mapOf(
        "🦁" to "avatar_lion",
        "🦅" to "avatar_falcon",
        "🚀" to "avatar_astro",
        "🐆" to "avatar_cheetah",
        "🐲" to "avatar_dragon",
        "🦉" to "avatar_lion" // Owl emoji should default to Simba (lion), NOT Professor Ollie
    )

    fun findAvatar(avatarId: String?): AvatarItem? {
        if (avatarId.isNullOrBlank()) return null
        val raw = avatarId.trim()
        val clean = raw.lowercase()
        // 1. Try direct ID match
        val direct = AVATARS.firstOrNull { it.id.equals(clean, ignoreCase = true) || clean == it.id.removePrefix("avatar_") }
        if (direct != null) return direct
        // 2. Legacy emoji → canonical avatar ID
        val mappedId = EMOJI_TO_AVATAR_ID[raw]
        if (mappedId != null) return AVATARS.firstOrNull { it.id == mappedId }
        // 3. Name keyword search (for search/display only)
        return AVATARS.firstOrNull {
            (clean.contains("lion") && it.id == "avatar_lion") ||
            (clean.contains("falcon") && it.id == "avatar_falcon") ||
            (clean.contains("astro") && it.id == "avatar_astro") ||
            (clean.contains("cheetah") && it.id == "avatar_cheetah") ||
            (clean.contains("dragon") && it.id == "avatar_dragon") ||
            (clean.contains("professor ollie") && it.id == "avatar_ollie")
        }
    }

    fun defaultAvatarForTier(tier: String? = null): AvatarItem {
        return AVATARS.first { it.id == "avatar_lion" }
    }
}

/**
 * Manages persistent inventory of unlocked avatars and accessories.
 */
object AvatarInventoryManager {
    private const val PREFS_NAME = "studdyhub_avatar_inventory_prefs"

    fun getUnlockedAvatarIds(context: android.content.Context, userId: String, userTier: String? = null): Set<String> {
        val prefs = context.getSharedPreferences(PREFS_NAME, android.content.Context.MODE_PRIVATE)
        val savedSet = prefs.getStringSet("unlocked_avatars_${userId}", emptySet()) ?: emptySet()
        val result = savedSet.toMutableSet()
        // Simba (avatar_lion) is the only free starter avatar for all users across all tiers
        result.add("avatar_lion")
        return result
    }

    fun unlockAvatar(context: android.content.Context, userId: String, avatarId: String) {
        val prefs = context.getSharedPreferences(PREFS_NAME, android.content.Context.MODE_PRIVATE)
        val current = prefs.getStringSet("unlocked_avatars_${userId}", emptySet())?.toMutableSet() ?: mutableSetOf()
        current.add(avatarId)
        prefs.edit().putStringSet("unlocked_avatars_${userId}", current).apply()
    }

    fun getUnlockedAccessoryIds(context: android.content.Context, userId: String): Set<String> {
        val prefs = context.getSharedPreferences(PREFS_NAME, android.content.Context.MODE_PRIVATE)
        return prefs.getStringSet("unlocked_accessories_${userId}", emptySet()) ?: emptySet()
    }

    fun unlockAccessory(context: android.content.Context, userId: String, accessoryId: String) {
        val prefs = context.getSharedPreferences(PREFS_NAME, android.content.Context.MODE_PRIVATE)
        val current = prefs.getStringSet("unlocked_accessories_${userId}", emptySet())?.toMutableSet() ?: mutableSetOf()
        current.add(accessoryId)
        prefs.edit().putStringSet("unlocked_accessories_${userId}", current).apply()
    }
}

/**
 * High-definition 3D Avatar Renderer with ambient rarity aura, floating physics, and custom badge.
 */
@Composable
fun Avatar3DRenderer(
    avatarIdOrEmoji: String?,
    size: Dp = 64.dp,
    showAura: Boolean = true,
    isAnimated: Boolean = true,
    borderWidth: Dp = 2.5.dp,
    accessoryEmoji: String? = null,
    modifier: Modifier = Modifier
) {
    val avatar = remember(avatarIdOrEmoji) { AvatarRegistry.findAvatar(avatarIdOrEmoji) }
    val isNetworkUrl = remember(avatarIdOrEmoji) {
        avatarIdOrEmoji != null && (avatarIdOrEmoji.startsWith("http://", ignoreCase = true) || avatarIdOrEmoji.startsWith("https://", ignoreCase = true))
    }
    val isEmoji = remember(avatarIdOrEmoji) {
        if (avatarIdOrEmoji.isNullOrBlank()) false
        else {
            val trimmed = avatarIdOrEmoji.trim()
            trimmed.length <= 4 && trimmed.any { Character.isSurrogate(it) || Character.getType(it) == Character.OTHER_SYMBOL.toInt() || Character.getType(it) == Character.SURROGATE.toInt() }
        }
    }

    // Floating micro-animation
    val infiniteTransition = rememberInfiniteTransition(label = "avatar_float")
    val floatOffset by if (isAnimated) {
        infiniteTransition.animateFloat(
            initialValue = 0f,
            targetValue = -3.5f,
            animationSpec = infiniteRepeatable(
                animation = tween(1500, easing = FastOutSlowInEasing),
                repeatMode = RepeatMode.Reverse
            ),
            label = "float"
        )
    } else {
        remember { mutableFloatStateOf(0f) }
    }

    val glowAlpha by if (isAnimated && showAura) {
        infiniteTransition.animateFloat(
            initialValue = 0.35f,
            targetValue = 0.75f,
            animationSpec = infiniteRepeatable(
                animation = tween(1800, easing = FastOutSlowInEasing),
                repeatMode = RepeatMode.Reverse
            ),
            label = "glow"
        )
    } else {
        remember { mutableFloatStateOf(0.4f) }
    }

    val rarity = avatar?.rarity ?: AvatarRarity.COMMON

    Box(
        modifier = modifier
            .size(size)
            .offset(y = floatOffset.dp),
        contentAlignment = Alignment.Center
    ) {
        // 1. Ambient Radial Glow (Rarity-themed)
        if (showAura) {
            Box(
                modifier = Modifier
                    .size(size * 1.25f)
                    .background(
                        brush = Brush.radialGradient(
                            colors = listOf(
                                rarity.primaryColor.copy(alpha = glowAlpha),
                                rarity.secondaryColor.copy(alpha = glowAlpha * 0.4f),
                                Color.Transparent
                            )
                        ),
                        shape = CircleShape
                    )
            )
        }

        // 2. Avatar Main Portrait (3D Image or Emoji Fallback)
        Surface(
            shape = CircleShape,
            color = avatar?.themeColor ?: Color(0xFFF1F5F9),
            border = androidx.compose.foundation.BorderStroke(
                width = borderWidth,
                brush = Brush.sweepGradient(
                    listOf(
                        rarity.primaryColor,
                        rarity.secondaryColor,
                        Color.White,
                        rarity.primaryColor
                    )
                )
            ),
            shadowElevation = 6.dp,
            modifier = Modifier.size(size)
        ) {
            Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center
            ) {
                if (isNetworkUrl) {
                    coil.compose.AsyncImage(
                        model = avatarIdOrEmoji,
                        contentDescription = "User Avatar",
                        contentScale = ContentScale.Crop,
                        modifier = Modifier
                            .fillMaxSize()
                            .clip(CircleShape)
                    )
                } else if (avatar?.drawableRes != null) {
                    Image(
                        painter = painterResource(id = avatar.drawableRes),
                        contentDescription = avatar.name,
                        contentScale = ContentScale.Crop,
                        modifier = Modifier
                            .fillMaxSize()
                            .clip(CircleShape)
                    )
                } else if (isEmoji && !avatarIdOrEmoji.isNullOrBlank()) {
                    Text(
                        text = avatarIdOrEmoji.trim(),
                        fontSize = (size.value * 0.52f).sp,
                        textAlign = TextAlign.Center
                    )
                } else {
                    // Default Simba Avatar
                    Image(
                        painter = painterResource(id = R.drawable.img_avatar_lion_1786930325675),
                        contentDescription = "Default Avatar",
                        contentScale = ContentScale.Crop,
                        modifier = Modifier
                            .fillMaxSize()
                            .clip(CircleShape)
                    )
                }
            }
        }

        // 3. Accessory Overlay (e.g. Crown, Glasses, Halo)
        if (!accessoryEmoji.isNullOrBlank()) {
            Box(
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .offset(x = (size.value * 0.12f).dp, y = -(size.value * 0.12f).dp)
                    .background(Color.Black.copy(alpha = 0.6f), shape = CircleShape)
                    .padding(2.dp)
            ) {
                Text(accessoryEmoji, fontSize = (size.value * 0.28f).sp)
            }
        }
    }
}
