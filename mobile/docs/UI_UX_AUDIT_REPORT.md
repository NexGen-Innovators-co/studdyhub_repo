# UI/UX & Design System Audit Report: StuddyHub Codebase

**Audit Target:** StuddyHub Kotlin/Jetpack Compose Android Mobile Codebase (`app/src/main/java/com/example/**`)  
**Context:** Prepared for automated specification and design synthesis.

---

## 1. Design tokens / theme

### 1.1 Color Tokens Configuration
- **File Path:** `app/src/main/java/com/example/ui/theme/Color.kt`
- **Defined Color Tokens & Values:**
```kotlin
// Primary Brand Palette
val IndigoPrimary = Color(0xFF4F46E5)       // #4F46E5 (RGB: 79, 70, 229)
val IndigoSecondary = Color(0xFF6366F1)     // #6366F1 (RGB: 99, 102, 241)
val VioletTertiary = Color(0xFF8B5CF6)      // #8B5CF6 (RGB: 139, 92, 246)
val EmeraldAccent = Color(0xFF10B981)       // #10B981 (RGB: 16, 185, 129)
val AmberAlert = Color(0xFFF59E0B)          // #F59E0B (RGB: 245, 158, 11)
val RoseError = Color(0xFFEF4444)           // #EF4444 (RGB: 239, 68, 68)

// Surface & Neutral Colors
val SurfaceLight = Color(0xFFFFFFFF)        // #FFFFFF (RGB: 255, 255, 255)
val SurfaceDark = Color(0xFF0F172A)         // #0F172A (RGB: 15, 23, 42)
val BackgroundLight = Color(0xFFF8FAFC)     // #F8FAFC (RGB: 248, 250, 252)
val BackgroundDark = Color(0xFF020617)      // #020617 (RGB: 2, 6, 23)
val CardBackgroundLight = Color(0xFFFFFFFF) // #FFFFFF (RGB: 255, 255, 255)
val CardBackgroundDark = Color(0xFF1E293B)  // #1E293B (RGB: 30, 41, 59)
val TextPrimaryLight = Color(0xFF0F172A)    // #0F172A (RGB: 15, 23, 42)
val TextPrimaryDark = Color(0xFFF8FAFC)     // #F8FAFC (RGB: 248, 250, 252)
val TextSecondaryLight = Color(0xFF64748B)  // #64748B (RGB: 100, 116, 139)
val TextSecondaryDark = Color(0xFF94A3B8)   // #94A3B8 (RGB: 148, 163, 184)
val BorderLight = Color(0xFFE2E8F0)         // #E2E8F0 (RGB: 226, 232, 240)
val BorderDark = Color(0xFF334155)          // #334155 (RGB: 51, 65, 85)

// Semantic Utility Tokens
val AmberWarm = Color(0xFFD97706)           // #D97706 (RGB: 217, 119, 6)
val GrayMuted = Color(0xFF6B7280)           // #6B7280 (RGB: 107, 114, 128)
```

- **Material 3 Scheme Mapping (`app/src/main/java/com/example/ui/theme/Theme.kt`):**
```kotlin
private val LightColorScheme = lightColorScheme(
    primary = IndigoPrimary,
    onPrimary = Color.White,
    primaryContainer = Color(0xFFE0E7FF),
    onPrimaryContainer = Color(0xFF312E81),
    secondary = EmeraldAccent,
    onSecondary = Color.White,
    secondaryContainer = Color(0xFFD1FAE5),
    onSecondaryContainer = Color(0xFF064E3B),
    tertiary = VioletTertiary,
    onTertiary = Color.White,
    tertiaryContainer = Color(0xFFEDE9FE),
    onTertiaryContainer = Color(0xFF4C1D95),
    background = BackgroundLight,
    onBackground = TextPrimaryLight,
    surface = SurfaceLight,
    onSurface = TextPrimaryLight,
    surfaceVariant = Color(0xFFF1F5F9),
    onSurfaceVariant = TextSecondaryLight,
    outline = BorderLight,
    error = RoseError,
    onError = Color.White
)
```

### 1.2 Hardcoded Inline Colors Inventory (96+ instances)
Multiple screens bypass `MaterialTheme.colorScheme` and tokens in `Color.kt`, specifying hardcoded hex colors inline:
- `app/src/main/java/com/example/ui/screens/dashboard/DashboardScreen.kt`:
  - `Color(0xFF1E1B4B)` (Splash & hero background deep indigo)
  - `Color(0xFF0F172A)` (Gradient end dark slate)
  - `Color(0xFFFEF3C7)` / `Color(0xFFFDE68A)` (XP and streak pill backgrounds)
  - `Color(0xFFD97706)` (Amber text override)
  - `Color(0xFF3B82F6)` (Info badge blue)
  - `Color(0xFF8B5CF6)` (Secondary accent gradient)
- `app/src/main/java/com/example/ui/screens/notes/NoteDetailScreen.kt`:
  - Reader mode themes: `Color(0xFFFBF0D9)` (Sepia background), `Color(0xFF5F4B32)` (Sepia text), `Color(0xFF1E1E1E)` (Dark reader background), `Color(0xFFD4D4D4)` (Dark reader text).
  - Highlighting palettes: `Color(0xFFFFEB3B)` (Yellow), `Color(0xFF80D8FF)` (Blue), `Color(0xFFA7FFEB)` (Mint), `Color(0xFFFFD180)` (Orange), `Color(0xFFFF80AB)` (Pink).
- `app/src/main/java/com/example/ui/screens/quizzes/QuizResultsScreen.kt`:
  - Leaderboard medal colors: `Color(0xFFFFD700)` (Gold), `Color(0xFFC0C0C0)` (Silver), `Color(0xFFCD7F32)` (Bronze).
  - Accuracy badges: `Color(0xFF10B981)` (Green), `Color(0xFFEF4444)` (Red), `Color(0xFFF59E0B)` (Amber).
- `app/src/main/java/com/example/ui/screens/social/SocialFeedScreen.kt`:
  - `Color(0xFFEC4899)` (Like pink/red override), `Color(0xFF6366F1)` (Repost indigo), `Color(0xFF10B981)` (Bookmark emerald).
- `app/src/main/java/com/example/ui/screens/schedule/ScheduleScreen.kt`:
  - Category tags: `Color(0xFF60A5FA)` (Blue), `Color(0xFF34D399)` (Green), `Color(0xFFF472B6)` (Pink), `Color(0xFFA78BFA)` (Purple).

### 1.3 Type Scale
- **Definition File:** `app/src/main/java/com/example/ui/theme/Type.kt`
- **Scale Definition:**
```kotlin
val Typography = Typography(
    bodyLarge = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.Normal,
        fontSize = 16.sp,
        lineHeight = 24.sp,
        letterSpacing = 0.5.sp
    )
)
```
- **Type Scale Status:** Incomplete. Only `bodyLarge` is defined in `Typography`. All other headings and labels fall back to default Material 3 styling or are styled ad-hoc with inline `fontSize` and `fontWeight`:
  - `DashboardScreen.kt`: `28.sp` (Hero greeting), `20.sp` (Section titles), `14.sp` (Card descriptions), `11.sp` (Badge text).
  - `SocialFeedScreen.kt`: `15.sp` (Post body), `8.sp` / `9.sp` ("STUDDYHUB SOCIAL HUB" micro caps header), `12.sp` (Timestamp).
  - `AIChatScreen.kt`: `15.sp` (Chat message body), `11.sp` (Attachment metadata), `12.sp` (Thinking step detail).
  - `FlashcardsScreen.kt`: `22.sp` (Card front question), `16.sp` (Card back answer), `12.sp` (SRS mastery indicator).
  - `SettingsScreen.kt`: `18.sp` (Category headers), `11.sp` (Filter chips), `13.sp` (Status summary).

### 1.4 Spacing Scale
- There is **no centralized spacing scale file** or dimens token system (e.g. `Spacing.small`, `Spacing.medium`).
- Margins and paddings are specified ad-hoc per composable, predominantly using values of `4.dp`, `8.dp`, `12.dp`, `16.dp`, `20.dp`, and `24.dp`.

### 1.5 UI Library & Framework Architecture
- **Framework:** Native Android with **Jetpack Compose** (Kotlin 2.2.10, Jetpack Compose Compiler / BOM 2025.02.00).
- **Component Library:** **Material 3 (`androidx.compose.material3`)** augmented with a custom app library in `app/src/main/java/com/example/ui/components/StuddyHubComponents.kt` (`StuddyCard`, `StuddyHeroCard`, `StuddyFloatingNavBar`, `StuddySectionHeader`, `StuddyBadge`).

---

## 2. Navigation

### 2.1 Bottom Navigation Component
- **File Path:** `app/src/main/java/com/example/ui/components/StuddyHubComponents.kt` (lines 530–642)
- **Component Code:**
```kotlin
@Composable
fun StuddyFloatingNavBar(
    currentRoute: String,
    onNavigate: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    val navItems = listOf(
        NavItem(Screen.Dashboard.route, "Home", Icons.Default.Home, Icons.Outlined.Home),
        NavItem(Screen.Library.route, "Library", Icons.Default.Folder, Icons.Outlined.Folder),
        NavItem(Screen.Practice.route, "Practice", Icons.Default.FitnessCenter, Icons.Outlined.FitnessCenter),
        NavItem(Screen.Assistant.route, "Assistant", Icons.Default.AutoAwesome, Icons.Outlined.AutoAwesome),
        NavItem(Screen.Community.route, "Community", Icons.Default.Groups, Icons.Outlined.Groups)
    )

    Surface(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp)
            .height(68.dp),
        shape = RoundedCornerShape(24.dp),
        color = MaterialTheme.colorScheme.surface.copy(alpha = 0.95f),
        tonalElevation = 8.dp,
        shadowElevation = 12.dp,
        border = BorderStroke(
            1.dp,
            MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f)
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 8.dp),
            horizontalArrangement = Arrangement.SpaceAround,
            verticalAlignment = Alignment.CenterVertically
        ) {
            navItems.forEach { item ->
                val isSelected = currentRoute == item.route
                val animatedAlpha by animateFloatAsState(
                    targetValue = if (isSelected) 1f else 0.6f,
                    label = "nav_item_alpha"
                )

                Surface(
                    onClick = { onNavigate(item.route) },
                    shape = RoundedCornerShape(16.dp),
                    color = if (isSelected) {
                        IndigoPrimary.copy(alpha = 0.12f)
                    } else {
                        Color.Transparent
                    },
                    modifier = Modifier
                        .weight(1f)
                        .padding(vertical = 4.dp)
                        .testTag("nav_item_${item.label.lowercase()}")
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(vertical = 4.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center
                    ) {
                        Icon(
                            imageVector = if (isSelected) item.selectedIcon else item.unselectedIcon,
                            contentDescription = item.label,
                            tint = if (isSelected) {
                                IndigoPrimary
                            } else {
                                MaterialTheme.colorScheme.onSurface.copy(alpha = animatedAlpha)
                            },
                            modifier = Modifier.size(22.dp)
                        )
                        Spacer(modifier = Modifier.height(2.dp))
                        Text(
                            text = item.label,
                            style = MaterialTheme.typography.labelSmall.copy(
                                fontSize = 10.sp,
                                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium
                            ),
                            color = if (isSelected) {
                                IndigoPrimary
                            } else {
                                MaterialTheme.colorScheme.onSurface.copy(alpha = animatedAlpha)
                            },
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                }
            }
        }
    }
}
```
- **Label Sizing & Overflow Analysis:**
  - Label text is hardcoded to `10.sp` with `maxLines = 1` and `TextOverflow.Ellipsis`.
  - Each item container uses `.weight(1f)` inside a `Row(horizontalArrangement = Arrangement.SpaceAround)`.
  - The entire bar has fixed height `68.dp` with an active pill background `IndigoPrimary.copy(alpha = 0.12f)`.
  - When Android system font scaling is increased (accessibility font size > 1.15x), 5 items inside a 360dp phone viewport truncate or push text below the container boundary because the vertical column has fixed height padding.

### 2.2 Floating Action Buttons (FAB) Positioning & Scroll Behavior
1. **"Ask AI Tutor" FAB on Dashboard:**
   - **Location:** `app/src/main/java/com/example/ui/screens/dashboard/DashboardScreen.kt` (lines 140–165)
   - **Positioning:** Positioned via `Scaffold(floatingActionButton = { ... })` with `FloatingActionButton` anchored bottom-end.
   - **Scroll Handling:** `DashboardScreen` uses `LazyColumn`. The Scaffold pins the FAB to the bottom-end above the bottom bar. A bottom `Spacer(modifier = Modifier.height(96.dp))` is placed inside the `LazyColumn` to prevent the floating bar and FAB from covering the last list items.
2. **"New Note" FAB on NotesScreen:**
   - **Location:** `app/src/main/java/com/example/ui/screens/notes/NotesScreen.kt` (lines 110–130)
   - **Positioning:** Scaffold FAB slot with `ExtendedFloatingActionButton`.
   - **Scroll Handling:** Includes 80dp content bottom padding inside `LazyColumn`.
3. **Social Feed "New Post" & "Ask AI Tutor" Multi-FAB:**
   - **Location:** `src/modules/social/components/feed/FloatingActionButtons.tsx` (in React/Web codebase context) / `SocialFeedScreen.kt`
   - **Positioning:** Fixed overlay container `bottom-20 right-4 z-40` with `flex flex-col items-end space-y-3`.

---

## 3. Flashcard component

### 3.1 Flashcard Component Code
- **File Path:** `app/src/main/java/com/example/ui/screens/flashcards/FlashcardsScreen.kt` (lines 201–330)
```kotlin
@Composable
fun FlashcardStudyCard(
    card: FlashcardEntity,
    isFlipped: Boolean,
    onFlip: () -> Unit,
    modifier: Modifier = Modifier
) {
    val rotation by animateFloatAsState(
        targetValue = if (isFlipped) 180f else 0f,
        animationSpec = tween(durationMillis = 400, easing = FastOutSlowInEasing),
        label = "card_flip_rotation"
    )

    Card(
        modifier = modifier
            .fillMaxWidth()
            .height(340.dp)
            .graphicsLayer {
                rotationY = rotation
                cameraDistance = 12f * density
            }
            .clickable { onFlip() }
            .testTag("flashcard_flip_target"),
        shape = RoundedCornerShape(24.dp),
        colors = CardDefaults.cardColors(
            containerColor = if (rotation <= 90f) {
                MaterialTheme.colorScheme.surface
            } else {
                IndigoPrimary.copy(alpha = 0.05f)
            }
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 6.dp),
        border = BorderStroke(
            1.dp,
            if (rotation <= 90f) {
                MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.6f)
            } else {
                IndigoPrimary.copy(alpha = 0.3f)
            }
        )
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(24.dp)
        ) {
            if (rotation <= 90f) {
                // Front of Card (Question)
                Column(
                    modifier = Modifier.fillMaxSize(),
                    verticalArrangement = Arrangement.SpaceBetween
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Surface(
                            shape = RoundedCornerShape(8.dp),
                            color = IndigoPrimary.copy(alpha = 0.1f)
                        ) {
                            Text(
                                text = "QUESTION",
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                                style = MaterialTheme.typography.labelSmall.copy(
                                    fontWeight = FontWeight.Bold,
                                    color = IndigoPrimary
                                )
                            )
                        }
                        Text(
                            text = "Tap to flip 🔄",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f)
                        )
                    }

                    Text(
                        text = card.question,
                        style = MaterialTheme.typography.headlineSmall.copy(
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 20.sp
                        ),
                        color = MaterialTheme.colorScheme.onSurface,
                        textAlign = TextAlign.Center,
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 16.dp)
                    )

                    if (card.hint.isNotBlank()) {
                        Text(
                            text = "💡 Hint: ${card.hint}",
                            style = MaterialTheme.typography.bodySmall,
                            color = AmberWarm,
                            maxLines = 2,
                            overflow = TextOverflow.Ellipsis
                        )
                    } else {
                        Spacer(modifier = Modifier.height(16.dp))
                    }
                }
            } else {
                // Back of Card (Answer) - Must invert rotation to avoid mirroring text
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .graphicsLayer { rotationY = 180f },
                    verticalArrangement = Arrangement.SpaceBetween
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Surface(
                            shape = RoundedCornerShape(8.dp),
                            color = EmeraldAccent.copy(alpha = 0.15f)
                        ) {
                            Text(
                                text = "ANSWER",
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                                style = MaterialTheme.typography.labelSmall.copy(
                                    fontWeight = FontWeight.Bold,
                                    color = EmeraldAccent
                                )
                            )
                        }
                        Text(
                            text = "Review",
                            style = MaterialTheme.typography.labelSmall,
                            color = EmeraldAccent
                        )
                    }

                    Text(
                        text = card.answer,
                        style = MaterialTheme.typography.bodyLarge.copy(
                            fontWeight = FontWeight.Normal,
                            fontSize = 16.sp,
                            lineHeight = 24.sp
                        ),
                        color = MaterialTheme.colorScheme.onSurface,
                        textAlign = TextAlign.Start,
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 16.dp)
                    )

                    if (card.explanation.isNotBlank()) {
                        Text(
                            text = "Note: ${card.explanation}",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f),
                            maxLines = 3,
                            overflow = TextOverflow.Ellipsis
                        )
                    } else {
                        Spacer(modifier = Modifier.height(16.dp))
                    }
                }
            }
        }
    }
}
```

### 3.2 Flip Implementation & Back Face Rendering
- **Mechanism:** `animateFloatAsState(targetValue = if (isFlipped) 180f else 0f)` applied to `Modifier.graphicsLayer { rotationY = rotation; cameraDistance = 12f * density }`.
- **Conditional Split:** At `rotation <= 90f`, the front content renders. At `rotation > 90f`, the back content is conditionally rendered.
- **Mirroring Correction:** The back layout requires `.graphicsLayer { rotationY = 180f }` to prevent text from rendering backwards. If omitted in older variants, the back face appears horizontally flipped.

### 3.3 Text Sizing & Markdown Handling
- Question and Answer text are rendered as raw strings in standard Compose `Text(...)` composables.
- **No markdown parsing or syntax highlighting is applied** to flashcard questions or answers. Markdown formatting characters (e.g. `**bold**`, `` `code` ``, `$$LaTeX$$`) appear as plain literal text.

### 3.4 Swipe Gesture Handling
- Swipe gestures are handled via `Modifier.pointerInput` using `detectHorizontalDragGestures` inside `FlashcardsScreen.kt`:
```kotlin
Modifier.pointerInput(Unit) {
    detectHorizontalDragGestures { _, dragAmount ->
        if (dragAmount > 50) {
            viewModel.reviewCurrentCard(isCorrect = true)
        } else if (dragAmount < -50) {
            viewModel.reviewCurrentCard(isCorrect = false)
        }
    }
}
```
- Available in dependency tree: Compose Foundation gesture detectors (`detectDragGestures`, `detectHorizontalDragGestures`, `anchoredDraggable`).

### 3.5 Flashcard Data Flow & Fallback Check
1. **User Action:** User taps "Generate Flashcards" in `FlashcardsAIFlowScreen` or asks AI in `AIChatScreen`.
2. **ViewModel:** `FlashcardsViewModel.generateDeck(topic, count, difficulty)` calls `StuddyHubRepository.generateFlashcardsFromTopic()`.
3. **Service Layer:** `GeminiApiService.generateFlashcards(topic, count)` calls Gemini with structured JSON output schema.
4. **Local Persistence:** Parsed flashcards are inserted into Room DB via `FlashcardDao.insertAll()`.
5. **Sync Engine:** `RealtimeSyncManager` / `BackendApiService.createFlashcard()` syncs records to Supabase table `flashcards`.
6. **Hardcoded Fallbacks:** If Gemini API key is missing or network fails, `StuddyHubRepository` provides a default starter deck (5 cards on "Active Recall & Spaced Repetition").

---

## 4. Home/dashboard stats (streak, credits, quiz stats)

### 4.1 AI Credits Data Source
- **Location:** `app/src/main/java/com/example/ui/screens/dashboard/DashboardScreen.kt` & `ProfileAndSettingsScreen.kt`
- **Data Path:**
  - Room entity: `ProfileEntity` (fields: `bonusAiCredits: Int`, `pointsBalance: Int`).
  - Remote DB table: `profiles` (columns: `bonus_ai_credits`, `points_balance`).
  - Repository: `StuddyHubRepository.observeProfile()` reads the profile from Room and refreshes from `BackendApiService.getProfile()`.
- **Snippet (`DashboardScreen.kt`):**
```kotlin
val profile by viewModel.profile.collectAsStateWithLifecycle()
val aiCredits = profile?.bonusAiCredits ?: 50
Text(text = "$aiCredits AI Credits", style = MaterialTheme.typography.labelMedium)
```

### 4.2 Streak Tracking & Calculation
- **Database Entity:** `UserStatsEntity` (`app/src/main/java/com/example/data/local/entities/Entities.kt`):
```kotlin
@Entity(tableName = "user_stats")
data class UserStatsEntity(
    @PrimaryKey val id: String = "user_stats_default",
    val currentStreak: Int = 0,
    val bestStreak: Int = 0,
    val quizzesCompleted: Int = 0,
    val flashcardsMastered: Int = 0,
    val studyMinutes: Int = 0,
    val totalXp: Int = 0,
    val lastActiveDate: String = "", // Format: "YYYY-MM-DD"
    val updatedAt: Long = System.currentTimeMillis()
)
```
- **Streak Calculation Logic (`StuddyHubRepository.kt` lines 750–820):**
```kotlin
suspend fun recordStudyActivity(activityType: String, xpEarned: Int = 10) {
    val todayStr = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US).format(java.util.Date())
    val stats = userStatsDao.getUserStatsDirect() ?: UserStatsEntity()
    
    val newStreak = when {
        stats.lastActiveDate == todayStr -> stats.currentStreak // Already logged today
        isYesterday(stats.lastActiveDate) -> stats.currentStreak + 1
        else -> 1 // Streak broken or new user
    }
    val newBest = maxOf(stats.bestStreak, newStreak)

    userStatsDao.insertOrUpdate(
        stats.copy(
            currentStreak = newStreak,
            bestStreak = newBest,
            totalXp = stats.totalXp + xpEarned,
            lastActiveDate = todayStr,
            updatedAt = System.currentTimeMillis()
        )
    )
}
```
- **Root Cause of 0-Day Streak Display:**
  - When `stats.lastActiveDate` is empty (new install), `DashboardScreen.kt` displays `"0-Day Streak"`.
  - In `finishQuiz`, the code previously incremented `currentStreak` directly without evaluating day boundaries. This was normalized to `recordStudyActivity` with ISO date checking.

### 4.3 Quiz Stats Persistence
- **Entity:** `QuizAttemptEntity` (`quiz_attempts` table) and `user_stats.quizzesCompleted`.
- **Persistence Path:** `QuizzesViewModel.submitQuiz()` -> `StuddyHubRepository.recordQuizAttempt()` writes to Room `quiz_attempts` and posts to backend `quiz_attempts` table.

---

## 5. Social/post interactions (likes, comments, share)

### 5.1 "Like" Post Mutation & API Endpoint
- **File Path:** `app/src/main/java/com/example/data/remote/BackendApiService.kt` (lines 1780–1835)
- **Code:**
```kotlin
suspend fun toggleLikePost(userId: String, postId: String): BackendResult<JSONObject> {
    // 1. First attempt: Supabase Edge Function
    val edgePayload = JSONObject().apply {
        put("postId", postId)
        put("userId", userId)
    }
    val edgeResult = callEdgeFunction("toggle-like", edgePayload)
    if (edgeResult is BackendResult.Success) {
        return edgeResult
    }

    // 2. Direct PostgREST Fallback
    return try {
        val existing = get("social_likes?user_id=eq.$userId&post_id=eq.$postId&select=id")
        if (existing is BackendResult.Success && existing.data.getJSONArray("data").length() > 0) {
            val likeId = existing.data.getJSONArray("data").getJSONObject(0).getString("id")
            delete("social_likes?id=eq.$likeId")
            BackendResult.Success(JSONObject().put("liked", false))
        } else {
            val insertPayload = JSONObject().apply {
                put("id", UUID.randomUUID().toString())
                put("user_id", userId)
                put("post_id", postId)
                put("created_at", ISO_DATE_FORMAT.format(Date()))
            }
            post("social_likes", insertPayload)
            BackendResult.Success(JSONObject().put("liked", true))
        }
    } catch (e: Exception) {
        BackendResult.Error("Like action failed: ${e.message}", e)
    }
}
```

### 5.2 Database Schema (Posts & Likes)
- **Local Room Entities (`Entities.kt`):**
```kotlin
@Entity(tableName = "social_posts")
data class SocialPostEntity(
    @PrimaryKey val id: String,
    val userId: String,
    val authorName: String,
    val authorAvatarUrl: String = "",
    val content: String,
    val mediaUrl: String = "",
    val likesCount: Int = 0,
    val commentsCount: Int = 0,
    val isLikedByMe: Boolean = false,
    val isBookmarkedByMe: Boolean = false,
    val createdAt: String,
    val isSynced: Boolean = true
)

@Entity(
    tableName = "social_likes",
    foreignKeys = [
        ForeignKey(
            entity = SocialPostEntity::class,
            parentColumns = ["id"],
            childColumns = ["postId"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [Index(value = ["userId", "postId"], unique = true)]
)
data class SocialLikeEntity(
    @PrimaryKey val id: String,
    val userId: String,
    val postId: String,
    val createdAt: Long = System.currentTimeMillis()
)
```

### 5.3 Error Analysis & Request/Response Shape
- **Edge Function vs Direct PostgREST Mismatch:**
  - The edge function `toggle-like` expects `{ "postId": "<uuid>", "userId": "<uuid>" }` and returns `{ "liked": true, "likesCount": 12 }`.
  - Direct PostgREST fallback maps to `social_likes` table with snake_case column names (`user_id`, `post_id`).
  - If a client sends camelCase `userId` to the raw PostgREST table, PostgREST returns HTTP 400 Bad Request (`column "userId" does not exist`). The Kotlin client explicitly maps camelCase properties to snake_case in `BackendApiService.kt`.

---

## 6. AI chat / assistant

### 6.1 Chat Input Area Code
- **File Path:** `app/src/main/java/com/example/ui/screens/aichat/AIChatScreen.kt` (lines 873–1052)
```kotlin
// Composer pill
val canSend = (inputText.isNotBlank() || attachedFileList.any { it.status == "ready" }) && !state.isSending

Surface(
    color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.45f),
    shape = RoundedCornerShape(28.dp),
    border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.15f)),
    modifier = Modifier
        .fillMaxWidth()
        .padding(horizontal = 12.dp, vertical = 8.dp)
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(start = 4.dp, end = 4.dp, top = 2.dp, bottom = 2.dp),
        verticalAlignment = Alignment.Bottom
    ) {
        // Attachment dropdown anchor
        Box(modifier = Modifier.align(Alignment.CenterVertically)) {
            IconButton(
                onClick = { isOptionsMenuOpen = true },
                modifier = Modifier.testTag("ai_chat_attach_button").requiredSize(48.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.AddCircleOutline,
                    contentDescription = "Add attachment options",
                    tint = if (state.attachedNoteIds.isNotEmpty() || state.attachedDocIds.isNotEmpty()) EmeraldAccent else IndigoPrimary
                )
            }
        }

        // Auto-growing Text Input
        BasicTextField(
            value = inputText,
            onValueChange = { inputText = it },
            modifier = Modifier
                .weight(1f)
                .testTag("ai_chat_input_field")
                .padding(horizontal = 8.dp, vertical = 10.dp),
            textStyle = MaterialTheme.typography.bodyLarge.copy(
                color = MaterialTheme.colorScheme.onSurface
            ),
            cursorBrush = SolidColor(IndigoPrimary),
            maxLines = 4,
            decorationBox = { innerTextField ->
                Box {
                    if (inputText.isEmpty()) {
                        Text(
                            "Ask Professor Ollie...",
                            style = MaterialTheme.typography.bodyLarge,
                            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.4f)
                        )
                    }
                    innerTextField()
                }
            }
        )

        // Attach File Button
        IconButton(
            onClick = { filePickerLauncher.launch(arrayOf("*/*")) },
            modifier = Modifier.align(Alignment.CenterVertically).requiredSize(44.dp)
        ) {
            Icon(
                imageVector = Icons.Default.AttachFile,
                contentDescription = "Attach File",
                tint = if (attachedFileList.any { it.status == "ready" }) EmeraldAccent else MaterialTheme.colorScheme.onSurface.copy(alpha = 0.55f),
                modifier = Modifier.size(20.dp)
            )
        }

        // Thinking Mode Toggle
        IconButton(
            onClick = { viewModel.toggleThinkingMode() },
            modifier = Modifier.align(Alignment.CenterVertically).requiredSize(44.dp)
        ) {
            Icon(
                imageVector = Icons.Default.Psychology,
                contentDescription = "Toggle Thinking Process Mode",
                tint = if (state.isThinkingMode) IndigoPrimary else MaterialTheme.colorScheme.onSurface.copy(alpha = 0.45f)
            )
        }

        // Voice Dictation Button
        IconButton(
            onClick = { /* Speech recognition toggle */ },
            modifier = Modifier.align(Alignment.CenterVertically).requiredSize(44.dp)
        ) {
            Icon(
                imageVector = if (isListeningForSpeech) Icons.Default.MicOff else Icons.Default.Mic,
                contentDescription = "Voice dictation",
                tint = if (isListeningForSpeech) EmeraldAccent else MaterialTheme.colorScheme.onSurface.copy(alpha = 0.55f),
                modifier = Modifier.size(20.dp)
            )
        }

        // Send Button
        IconButton(
            onClick = {
                if (canSend) {
                    val textToSend = inputText
                    inputText = ""
                    viewModel.sendMessage(textToSend)
                }
            },
            enabled = canSend,
            modifier = Modifier
                .align(Alignment.CenterVertically)
                .background(if (canSend) IndigoPrimary else IndigoPrimary.copy(alpha = 0.35f), CircleShape)
                .requiredSize(40.dp)
                .testTag("ai_chat_send_button")
        ) {
            Icon(
                imageVector = Icons.AutoMirrored.Filled.Send,
                contentDescription = "Send Message",
                tint = Color.White,
                modifier = Modifier.size(18.dp)
            )
        }
    }
}
```

### 6.2 Suggestions Generation
- **Dynamic Content Derivation (`AIChatScreen.kt` lines 212–222):**
```kotlin
val contextualSuggestions = remember(state.allNotes, state.allDocuments) {
    buildList {
        state.allNotes.take(2).forEach { note ->
            add("Summarize my note: ${note.title}")
            add("Quiz me on ${note.title}")
        }
        state.allDocuments.take(2).forEach { doc ->
            add("Explain key ideas from ${doc.title}")
        }
    }.distinct().take(4)
}
```
Suggestions are **dynamically generated from the user's actual notes and documents titles**.

### 6.3 Chat Session Creation Timing
- **Draft-on-Open Policy (`AIChatViewModel.kt` lines 390–443):**
  - When opening the chat screen, a draft session ID `"chat_default"` is held in state.
  - **No database row is inserted** when the screen opens.
  - A real session row is inserted into Room and Supabase **only upon sending the first message** (`sendMessage`):
```kotlin
var activeSessionId = _currentSessionId.value
val existingSession = repository.getSessionById(activeSessionId)
if (existingSession == null || activeSessionId == "chat_default" || activeSessionId.isBlank()) {
    val sessionTitle = if (effectiveText.length > 25) effectiveText.take(25) + "..." else effectiveText
    val newSession = repository.createChatSession(sessionTitle.ifBlank { "File Discussion" })
    activeSessionId = newSession.id
    _currentSessionId.value = activeSessionId
}
```

### 6.4 Hardcoded "Welcome Message" Strings
Occurrences of `"Whoo-t!"` and canned greetings:
1. `app/src/main/java/com/example/ui/screens/onboarding/OnboardingViewModel.kt`:
   - Line 105: `- Act as Professor Ollie: say "Whoo-t!" or make gentle, friendly owl references occasionally.`
   - Line 214: `replyText = "Whoo-t! Let's get started. First off, what is your full name? Greet me, or type it below!"`
   - Line 234: `replyText = "Whoo-t! I've set up your StuddyHub workspace. Let's take a quick tour so you know where everything lives."`
2. `app/src/main/java/com/example/ui/screens/dashboard/DashboardScreen.kt`:
   - Line 180: `"Good morning, Scholar 👋"` (Hero header fallback).
3. `app/src/main/java/com/example/ui/screens/aichat/AIChatScreen.kt`:
   - Line 275: `"Professor Ollie AI Tutor"`

---

## 7. Documents screen

### 7.1 Documents Organization & Rendering
- **File Path:** `app/src/main/java/com/example/ui/screens/documents/DocumentsScreen.kt`
- **Layout & Structure:**
  - Search bar and category filter chips at top (`All`, `PDF`, `DOCX`, `TXT`, `Images`, `Spreadsheets`).
  - Rendered in a `LazyColumn` with pinned items placed in a "Pinned Documents" section and remaining items sorted chronologically by `createdAt` descending.
  - Each item card shows file type badge icon (`Icons.Default.PictureAsPdf`, `Description`, `Image`), document title, extracted text preview, file size in KB, and relative timestamp.

### 7.2 Upload Flow & Tags Source
- **File Path:** `app/src/main/java/com/example/ui/screens/documents/DocumentUploadScreen.kt`
- **Tags Origin:**
  - Pre-defined subject tags list: `listOf("Lecture Notes", "Textbook", "Syllabus", "Assignment", "Research Paper", "Exam Prep")`.
  - Custom tag input field allows user-entered custom strings.
  - Extracted document text is processed by `GeminiApiService.extractDocumentKeyConcepts(content)` which dynamically appends 3–5 auto-generated topic tags.

---

## 8. Settings screen

### 8.1 Complete Settings Screen Layout Code
- **File Path:** `app/src/main/java/com/example/ui/screens/settings/SettingsScreen.kt`
```kotlin
package com.example.ui.screens.settings

import androidx.compose.animation.*
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.example.ui.components.learningStyleVisual
import com.example.ui.theme.AmberWarm
import com.example.ui.theme.EmeraldAccent
import com.example.ui.theme.IndigoPrimary
import com.example.ui.theme.VioletTertiary

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    viewModel: SettingsViewModel,
    onNavigateToAuth: () -> Unit = {},
    onBack: () -> Unit = {},
    onTriggerSync: () -> Unit = {}
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val snackbarHostState = remember { SnackbarHostState() }
    var showSignOutDialog by remember { mutableStateOf(false) }

    var editName by remember(state.profile) { mutableStateOf(state.fullName) }
    var editSchool by remember(state.profile) { mutableStateOf(state.school) }
    var editAcademicLevel by remember(state.profile) { mutableStateOf(state.academicLevel) }
    var editLearningStyle by remember(state.profile) { mutableStateOf(state.learningStyle) }
    var editBio by remember(state.profile) { mutableStateOf(state.bio) }
    var hasChanges by remember { mutableStateOf(false) }

    LaunchedEffect(state.userMessage) {
        state.userMessage?.let { msg ->
            snackbarHostState.showSnackbar(msg)
            viewModel.clearUserMessage()
        }
    }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
        topBar = {
            TopAppBar(
                navigationIcon = {
                    IconButton(
                        onClick = onBack,
                        modifier = Modifier.testTag("back_button")
                    ) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                title = {
                    Text("Settings", fontWeight = FontWeight.Bold)
                },
                actions = {
                    if (hasChanges) {
                        TextButton(
                            onClick = {
                                viewModel.saveProfile(editName, editSchool, editAcademicLevel, editLearningStyle, editBio)
                                hasChanges = false
                            },
                            enabled = !state.isSaving
                        ) {
                            if (state.isSaving) {
                                CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
                            } else {
                                Text("Save", fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            )
        }
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Spacer(modifier = Modifier.height(4.dp))

            // Profile Picture Section
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(20.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f))
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(20.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Box(
                        modifier = Modifier
                            .size(80.dp)
                            .clip(CircleShape)
                            .background(IndigoPrimary.copy(alpha = 0.15f)),
                        contentAlignment = Alignment.Center
                    ) {
                        if (state.avatarUrl.isNotBlank()) {
                            coil.compose.AsyncImage(
                                model = state.avatarUrl,
                                contentDescription = "Profile picture of ${state.fullName.ifBlank { "the scholar" }}",
                                modifier = Modifier.fillMaxSize().clip(CircleShape),
                                contentScale = ContentScale.Crop
                            )
                        } else {
                            Text(
                                text = state.fullName.take(1).uppercase().ifBlank { "?" },
                                style = MaterialTheme.typography.headlineLarge.copy(
                                    fontWeight = FontWeight.Bold,
                                    color = IndigoPrimary
                                )
                            )
                        }
                    }
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = state.fullName.ifBlank { "Scholar" },
                        style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold)
                    )
                    Text(
                        text = state.email,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
                    )
                }
            }

            // Profile Details Section
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
            ) {
                Column(
                    modifier = Modifier.fillMaxWidth().padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Text(
                        "Profile Details",
                        style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                        color = IndigoPrimary
                    )

                    OutlinedTextField(
                        value = editName,
                        onValueChange = { editName = it; hasChanges = true },
                        label = { Text("Full Name") },
                        leadingIcon = { Icon(Icons.Default.Person, contentDescription = null) },
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp),
                        singleLine = true
                    )

                    OutlinedTextField(
                        value = editSchool,
                        onValueChange = { editSchool = it; hasChanges = true },
                        label = { Text("University / School") },
                        leadingIcon = { Icon(Icons.Default.AccountBalance, contentDescription = null) },
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp),
                        singleLine = true
                    )

                    OutlinedTextField(
                        value = editBio,
                        onValueChange = { editBio = it; hasChanges = true },
                        label = { Text("Bio / About") },
                        leadingIcon = { Icon(Icons.Default.Info, contentDescription = null) },
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp),
                        minLines = 2,
                        maxLines = 3
                    )
                }
            }

            // Education Context Section
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
            ) {
                Column(
                    modifier = Modifier.fillMaxWidth().padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Text(
                        "Education Context",
                        style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                        color = VioletTertiary
                    )

                    Text("Academic Level", style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold))
                    val levels = listOf("High School", "Undergraduate", "Graduate", "PhD", "Post-Doc", "Self-Learner")
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        levels.take(3).forEach { level ->
                            FilterChip(
                                selected = editAcademicLevel == level,
                                onClick = { editAcademicLevel = level; hasChanges = true },
                                label = { Text(level, fontSize = 11.sp) },
                                colors = FilterChipDefaults.filterChipColors(
                                    selectedContainerColor = VioletTertiary,
                                    selectedLabelColor = Color.White
                                )
                            )
                        }
                    }
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        levels.drop(3).forEach { level ->
                            FilterChip(
                                selected = editAcademicLevel == level,
                                onClick = { editAcademicLevel = level; hasChanges = true },
                                label = { Text(level, fontSize = 11.sp) },
                                colors = FilterChipDefaults.filterChipColors(
                                    selectedContainerColor = VioletTertiary,
                                    selectedLabelColor = Color.White
                                )
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(4.dp))

                    Text("Learning Style", style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold))
                    val styleKeys = listOf("visual", "auditory", "reading", "kinesthetic", "mixed")
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        styleKeys.take(3).forEach { key ->
                            val visual = learningStyleVisual(key)
                            FilterChip(
                                selected = editLearningStyle == key,
                                onClick = { editLearningStyle = key; hasChanges = true },
                                label = { Text(visual.label, fontSize = 11.sp) },
                                leadingIcon = {
                                    Icon(
                                        imageVector = visual.icon,
                                        contentDescription = null,
                                        modifier = Modifier.size(14.dp),
                                        tint = if (editLearningStyle == key) Color.White else visual.accent
                                    )
                                },
                                colors = FilterChipDefaults.filterChipColors(
                                    selectedContainerColor = EmeraldAccent,
                                    selectedLabelColor = Color.White
                                )
                            )
                        }
                    }
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        styleKeys.drop(3).forEach { key ->
                            val visual = learningStyleVisual(key)
                            FilterChip(
                                selected = editLearningStyle == key,
                                onClick = { editLearningStyle = key; hasChanges = true },
                                label = { Text(visual.label, fontSize = 11.sp) },
                                leadingIcon = {
                                    Icon(
                                        imageVector = visual.icon,
                                        contentDescription = null,
                                        modifier = Modifier.size(14.dp),
                                        tint = if (editLearningStyle == key) Color.White else visual.accent
                                    )
                                },
                                colors = FilterChipDefaults.filterChipColors(
                                    selectedContainerColor = EmeraldAccent,
                                    selectedLabelColor = Color.White
                                )
                            )
                        }
                    }
                }
            }

            // Sync Status Section
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
            ) {
                Column(
                    modifier = Modifier.fillMaxWidth().padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.Cloud, contentDescription = null, tint = IndigoPrimary, modifier = Modifier.size(20.dp))
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("Data Sync", style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold))
                        }
                        TextButton(onClick = onTriggerSync) {
                            Icon(Icons.Default.Refresh, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("Sync Now", fontWeight = FontWeight.Bold)
                        }
                    }
                    if (state.pendingSyncCount > 0 || state.failedSyncCount > 0) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            if (state.pendingSyncCount > 0) {
                                Surface(shape = RoundedCornerShape(8.dp), color = IndigoPrimary.copy(alpha = 0.12f)) {
                                    Text(
                                        text = "${state.pendingSyncCount} pending",
                                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                                        style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold, color = IndigoPrimary)
                                    )
                                }
                            }
                            if (state.failedSyncCount > 0) {
                                Surface(shape = RoundedCornerShape(8.dp), color = MaterialTheme.colorScheme.error.copy(alpha = 0.12f)) {
                                    Text(
                                        text = "${state.failedSyncCount} failed",
                                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                                        style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.error)
                                    )
                                }
                            }
                        }
                    } else {
                        Text(
                            text = "All data is in sync",
                            style = MaterialTheme.typography.bodySmall.copy(color = EmeraldAccent),
                            fontWeight = FontWeight.Medium
                        )
                    }
                }
            }

            // Connection Status Section
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
            ) {
                val isConfigured = remember { com.example.data.remote.BackendApiService.isConfigured() }
                val isOnline = com.example.ui.components.rememberIsOnline()
                val isConnected = isConfigured && isOnline
                val statusTint = when {
                    isConnected -> EmeraldAccent
                    isConfigured -> MaterialTheme.colorScheme.error
                    else -> AmberWarm
                }

                Column(
                    modifier = Modifier.fillMaxWidth().padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = when {
                                isConnected -> Icons.Default.CloudDone
                                isConfigured -> Icons.Default.CloudOff
                                else -> Icons.Default.CloudQueue
                            },
                            contentDescription = null,
                            tint = statusTint,
                            modifier = Modifier.size(20.dp)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Connection Status", style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold))
                        Spacer(modifier = Modifier.weight(1f))
                        Surface(shape = RoundedCornerShape(8.dp), color = statusTint.copy(alpha = 0.12f)) {
                            Text(
                                text = when {
                                    isConnected -> "Connected"
                                    isConfigured -> "Offline"
                                    else -> "Not Set Up"
                                },
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp),
                                style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold, color = statusTint)
                            )
                        }
                    }
                    Text(
                        text = when {
                            isConnected -> "Your workspace is connected. Sync keeps your notes, quizzes, and documents up to date across devices."
                            isConfigured -> "You're offline right now. Your work is saved on this device and will sync when you're back online."
                            else -> "Cloud sync isn't configured on this build. Your work is saved on this device."
                        },
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)
                    )
                }
            }

            // Danger Zone
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.3f))
            ) {
                Column(
                    modifier = Modifier.fillMaxWidth().padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.Warning, contentDescription = null, tint = MaterialTheme.colorScheme.error, modifier = Modifier.size(20.dp))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Account", style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold), color = MaterialTheme.colorScheme.error)
                    }

                    OutlinedButton(
                        onClick = { showSignOutDialog = true },
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = MaterialTheme.colorScheme.error)
                    ) {
                        Icon(Icons.Default.Logout, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Sign Out", fontWeight = FontWeight.Bold)
                    }
                }
            }

            Spacer(modifier = Modifier.height(32.dp))
        }
    }

    if (showSignOutDialog) {
        AlertDialog(
            onDismissRequest = { showSignOutDialog = false },
            title = {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.Logout, contentDescription = null, tint = MaterialTheme.colorScheme.error)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Sign Out?")
                }
            },
            text = { Text("Your local data will remain on this device. You can sign back in anytime.") },
            confirmButton = {
                Button(
                    onClick = {
                        showSignOutDialog = false
                        viewModel.signOut()
                        onNavigateToAuth()
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error)
                ) {
                    Text("Sign Out", fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showSignOutDialog = false }) {
                    Text("Cancel")
                }
            }
        )
    }
}
```

---

## 9. General

### 9.1 Top 5 Screens by File Size & Complexity
1. **`app/src/main/java/com/example/ui/screens/aichat/AIChatScreen.kt`** (1,811 lines / 94.9 KB)
   - *Complexity:* Live SSE token stream coalescence, reasoning drop-down blocks, file/document attachments with status chips, STT/TTS audio recognition, inline markdown rendering, and confirmation modal actions.
2. **`app/src/main/java/com/example/ui/screens/onboarding/OnboardingScreen.kt`** (1,342 lines / 63.1 KB)
   - *Complexity:* Dual-mode interaction (conversational AI chat loop with Professor Ollie vs. manual multi-step form), animated step transitions, tour slides with interactive animations, and starter deck generation.
3. **`app/src/main/java/com/example/ui/screens/dashboard/DashboardScreen.kt`** (1,256 lines / 59.9 KB)
   - *Complexity:* Aggregated dashboard with greeting hero, quest progress cards, release changelog banner, focus actions carousel, upcoming schedule blocks, recent notes list, and multiple AI entry points.
4. **`app/src/main/java/com/example/ui/screens/profile/ProfileAndSettingsScreen.kt`** (1,080 lines / 66.3 KB)
   - *Complexity:* Multi-tab container combining Workspace Analytics/XP charts, Social Profile editor, Sync diagnostics, Promo-code redemption engine, and Badge rewards.
5. **`app/src/main/java/com/example/ui/screens/quizzes/QuizzesScreen.kt`** (942 lines / 48.2 KB)
   - *Complexity:* Live Kahoot-style room PIN joiner, multi-filter quiz catalog, SRS review readiness tracker, and quiz generation modal.

### 9.2 Component Library Primitives Usage
- **Material 3 Component Primitives:**
  - `Scaffold`, `TopAppBar`, `CenterAlignedTopAppBar`, `Card`, `ElevatedCard`, `OutlinedCard`, `Button`, `OutlinedButton`, `TextButton`, `IconButton`, `FilterChip`, `SuggestionChip`, `AssistChip`, `Switch`, `LinearProgressIndicator`, `CircularProgressIndicator`, `AlertDialog`, `ModalBottomSheet`, `DropdownMenu`, `DropdownMenuItem`, `SnackbarHost`.
- **Custom / Hand-Rolled Components in Use:**
  - `StuddyFloatingNavBar` (Custom floating navigation pill with animated alpha and glow border).
  - `StuddyHeroCard` (Custom linear gradient container with decorative background glow).
  - `FlashcardStudyCard` (Hand-rolled 3D rotation transform via `graphicsLayer`).
  - `RichNoteWebView` (Hand-rolled Android `WebView` integration with JavaScript bridge for Quill editor).
  - `SyncStatusDialog` (Custom diagnostic sheet with animated sync state indicators).
