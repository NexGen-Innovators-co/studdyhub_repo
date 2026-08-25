package com.example.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowForward
import androidx.compose.material.icons.filled.LocalFireDepartment
import androidx.compose.material.icons.filled.Map
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.ui.theme.AcademicTier
import com.example.ui.theme.StuddyHubThemeTokens
import java.util.Calendar
import java.util.Locale

data class DayActivity(
    val dayOfWeek: String, // e.g. "Mo", "Tu"
    val dayOfMonth: Int,
    val isCompleted: Boolean,
    val isToday: Boolean,
    val isFrozen: Boolean = false,
    val isPastActive: Boolean = false // active on a past day (distinct from today)
)

/**
 * Modern 3D Tactile Day-Pill Streak Calendar Widget.
 * Tapping it animates and launches the Candy Crush style Journey Quest Map!
 */
@Composable
fun StreakCalendarWidget(
    currentStreak: Int,
    longestStreak: Int = currentStreak,
    streakFreezes: Int = 0,
    activeDays: Set<String> = emptySet(),
    showPeekingMascot: Boolean = false,
    onStreakClick: (() -> Unit)? = null,
    modifier: Modifier = Modifier
) {
    val tierColors = StuddyHubThemeTokens.colors
    val activeTier = StuddyHubThemeTokens.tier
    val haptic = LocalHapticFeedback.current
    val view = LocalView.current

    val daysOfWeek = remember(activeDays) {
        val cal = Calendar.getInstance()
        val todayDayOfYear = cal.get(Calendar.DAY_OF_YEAR)
        val todayYear = cal.get(Calendar.YEAR)
        val shortDayNames = arrayOf("Su", "Mo", "Tu", "We", "Th", "Fr", "Sa")
        val dateFormat = java.text.SimpleDateFormat("yyyy-MM-dd", Locale.US)
        
        // Generate last 30 days ending today (or ending at the end of the current week)
        // Actually, just generating the last 30 days up to today is fine, but to keep the 
        // "Mon-Sun" feel, let's generate from 28 days ago up to the coming Sunday.
        val dayOfWeekIndex = (cal.get(Calendar.DAY_OF_WEEK) + 5) % 7 // 0=Mon, 1=Tue, ..., 6=Sun
        val daysToGenerate = 28 + (6 - dayOfWeekIndex) // 4 weeks + days until Sunday
        
        val startCal = Calendar.getInstance().apply {
            add(Calendar.DAY_OF_MONTH, - (daysToGenerate - (6 - dayOfWeekIndex)))
        }
        
        (0..daysToGenerate).map { offset ->
            val dayCal = (startCal.clone() as Calendar).apply {
                add(Calendar.DAY_OF_MONTH, offset)
            }
            val isToday = dayCal.get(Calendar.DAY_OF_YEAR) == todayDayOfYear && dayCal.get(Calendar.YEAR) == todayYear
            val isPast = dayCal.timeInMillis < cal.timeInMillis
            val dateKey = dateFormat.format(dayCal.time)
            
            // Use activeDays set if provided; fall back to streak-based heuristic
            val isActive = if (activeDays.isNotEmpty()) {
                dateKey in activeDays
            } else {
                // Fallback heuristic: assume past active if within current streak
                // This is less accurate for scrolling back but works if activeDays is missing
                isPast && (isToday || (currentStreak > (daysToGenerate - offset)))
            }
            
            DayActivity(
                dayOfWeek = shortDayNames[dayCal.get(Calendar.DAY_OF_WEEK) - 1],
                dayOfMonth = dayCal.get(Calendar.DAY_OF_MONTH),
                isCompleted = isActive,
                isToday = isToday,
                isPastActive = isActive && !isToday
            )
        }
    }

    val listState = androidx.compose.foundation.lazy.rememberLazyListState(
        initialFirstVisibleItemIndex = maxOf(0, daysOfWeek.size - 7)
    )

    Tactile3DCard(
        onClick = {
            onStreakClick?.invoke()
        },
        containerColor = MaterialTheme.colorScheme.surface,
        bevelColor = MaterialTheme.colorScheme.surfaceVariant,
        cornerRadius = 24.dp,
        elevationDepth = 5.dp,
        modifier = modifier.fillMaxWidth()
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            // Header: Streak + Journey Badge
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text(
                        text = "${maxOf(currentStreak, 1)} Days Streak",
                        style = MaterialTheme.typography.titleMedium.copy(
                            fontWeight = FontWeight.ExtraBold,
                            color = MaterialTheme.colorScheme.onSurface
                        )
                    )
                    Text("🔥", fontSize = 18.sp)
                }

                Row(
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    if (streakFreezes > 0) {
                        Surface(
                            shape = RoundedCornerShape(12.dp),
                            color = Color(0xFFE0F2FE)
                        ) {
                            Row(
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(4.dp)
                            ) {
                                Icon(
                                    Icons.Default.Shield,
                                    contentDescription = "Freeze",
                                    tint = Color(0xFF0284C7),
                                    modifier = Modifier.size(12.dp)
                                )
                                Text(
                                    text = "$streakFreezes",
                                    style = MaterialTheme.typography.labelSmall.copy(
                                        fontWeight = FontWeight.Bold,
                                        color = Color(0xFF0284C7)
                                    )
                                )
                            }
                        }
                    }

                    if (activeTier == AcademicTier.EXPLORER) {
                        Surface(
                            shape = RoundedCornerShape(12.dp),
                            color = Color(0xFFFEF3C7),
                            border = BorderStroke(1.dp, Color(0xFFF59E0B))
                        ) {
                            Row(
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(4.dp)
                            ) {
                                Text("🗺️ Quest Map", fontSize = 11.sp, fontWeight = FontWeight.ExtraBold, color = Color(0xFFB45309))
                                Icon(Icons.Default.ArrowForward, contentDescription = null, tint = Color(0xFFB45309), modifier = Modifier.size(12.dp))
                            }
                        }
                    }
                }
            }

            // 30-Day Scrollable Row
            androidx.compose.foundation.lazy.LazyRow(
                modifier = Modifier.fillMaxWidth(),
                state = listState,
                horizontalArrangement = Arrangement.spacedBy(16.dp, Alignment.End),
                verticalAlignment = Alignment.CenterVertically
            ) {
                items(daysOfWeek.size) { index ->
                    DayStreakPill(day = daysOfWeek[index])
                }
            }
        }
    }
}

@Composable
private fun DayStreakPill(day: DayActivity) {
    val orangeAccent = Color(0xFFFF7A00)
    val greenAccent = Color(0xFF22C55E)

    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        Text(
            text = day.dayOfWeek,
            style = MaterialTheme.typography.labelSmall.copy(
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                color = when {
                    day.isToday -> orangeAccent
                    day.isPastActive -> greenAccent
                    else -> Color(0xFF94A3B8)
                }
            )
        )

        Box(
            modifier = Modifier
                .size(34.dp)
                .clip(CircleShape)
                .background(
                    when {
                        day.isToday -> orangeAccent.copy(alpha = 0.2f)
                        day.isPastActive -> greenAccent.copy(alpha = 0.15f)
                        day.isCompleted -> orangeAccent.copy(alpha = 0.12f) // fallback
                        else -> Color.Transparent
                    }
                )
                .border(
                    width = when {
                        day.isToday -> 2.dp
                        day.isPastActive -> 2.dp
                        day.isCompleted -> 1.dp
                        else -> 1.dp
                    },
                    color = when {
                        day.isToday -> orangeAccent
                        day.isPastActive -> greenAccent
                        day.isCompleted -> orangeAccent.copy(alpha = 0.6f) // fallback
                        else -> Color(0xFFE2E8F0)
                    },
                    shape = CircleShape
                ),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = day.dayOfMonth.toString(),
                style = MaterialTheme.typography.labelMedium.copy(
                    fontWeight = when {
                        day.isToday -> FontWeight.ExtraBold
                        day.isPastActive -> FontWeight.Bold
                        else -> FontWeight.SemiBold
                    },
                    color = when {
                        day.isToday -> orangeAccent
                        day.isPastActive -> greenAccent
                        day.isCompleted -> Color(0xFFEA580C) // fallback
                        else -> Color(0xFF64748B)
                    },
                    fontSize = 12.sp
                )
            )
        }
    }
}
