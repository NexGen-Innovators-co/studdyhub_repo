package com.example.ui.components

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.MenuBook
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.GraphicEq
import androidx.compose.material.icons.filled.PanTool
import androidx.compose.material.icons.filled.Psychology
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import com.example.ui.theme.AmberWarm
import com.example.ui.theme.EmeraldAccent
import com.example.ui.theme.IndigoPrimary
import com.example.ui.theme.VioletTertiary

/**
 * Shared icon + accent mapping for learning-style selectors. Replaces the emoji
 * that used to carry meaning in these controls (👁️ 🎧 📖 ✋ 🔄) with real,
 * screen-reader-friendly vector icons. One mapping, reused across Settings and
 * Profile so the two screens can never disagree.
 */
data class LearningStyleVisual(
    val label: String,
    val icon: ImageVector,
    val accent: Color
)

fun learningStyleVisual(style: String): LearningStyleVisual = when (style) {
    "visual" -> LearningStyleVisual("Visual", Icons.Default.Visibility, IndigoPrimary)
    "auditory" -> LearningStyleVisual("Auditory", Icons.Default.GraphicEq, VioletTertiary)
    "reading" -> LearningStyleVisual("Reading", Icons.AutoMirrored.Filled.MenuBook, EmeraldAccent)
    "kinesthetic" -> LearningStyleVisual("Kinesthetic", Icons.Default.PanTool, AmberWarm)
    else -> LearningStyleVisual("Mixed", Icons.Default.Psychology, IndigoPrimary)
}
