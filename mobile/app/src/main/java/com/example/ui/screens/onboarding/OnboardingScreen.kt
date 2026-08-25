package com.example.ui.screens.onboarding

import androidx.activity.compose.BackHandler
import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.BorderStroke
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
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.example.R
import com.example.ui.components.OllieMascot
import com.example.ui.components.OllieMood
import com.example.ui.components.PrivacyPolicyModal
import com.example.ui.components.tactileClick
import com.example.ui.theme.AcademicTier
import com.example.ui.theme.tierAccent
import com.example.ui.theme.tierPrimary

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OnboardingScreen(
    viewModel: OnboardingViewModel,
    onNavigateToAuth: () -> Unit,
    onNavigateToMain: () -> Unit
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val focusManager = LocalFocusManager.current
    var currentStep by remember { mutableIntStateOf(1) } // 1: Stage Select, 2: Focus & Customization, 3: Launch Ready

    var selectedTierKey by remember { mutableStateOf(uiState.selectedTier.ifBlank { "achiever" }) }
    var nameInput by remember { mutableStateOf(uiState.userName) }
    var focusInput by remember { mutableStateOf(uiState.selectedMajor) }
    var gradeLevelInput by remember { mutableStateOf(if (uiState.selectedTier == "explorer") "Primary 4" else "") }
    var schoolInput by remember { mutableStateOf(uiState.selectedSchool) }
    var dailyGoalOption by remember { mutableStateOf(uiState.selectedGoalHours.ifBlank { "30 min/day" }) }
    var learningStyleOption by remember { mutableStateOf(uiState.selectedStyle.ifBlank { "Visual & Diagrams" }) }

    var showExitConfirm by remember { mutableStateOf(false) }
    var showPrivacyModal by remember { mutableStateOf(false) }

    BackHandler(enabled = !uiState.isSettingUpWorkspace) {
        if (currentStep > 1) {
            currentStep -= 1
        } else {
            showExitConfirm = true
        }
    }

    Scaffold(
        topBar = {
            CenterAlignedTopAppBar(
                title = {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.Center
                    ) {
                        Image(
                            painter = painterResource(id = R.drawable.img_app_icon),
                            contentDescription = "StuddyHub Logo",
                            modifier = Modifier
                                .size(30.dp)
                                .clip(RoundedCornerShape(8.dp)),
                            contentScale = ContentScale.Crop
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "StuddyHub",
                            style = MaterialTheme.typography.titleMedium.copy(
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.onBackground
                            )
                        )
                    }
                },
                navigationIcon = {
                    if (currentStep > 1) {
                        IconButton(
                            onClick = { currentStep -= 1 },
                            modifier = Modifier.testTag("onboarding_step_back_btn")
                        ) {
                            Icon(
                                imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                                contentDescription = "Back"
                            )
                        }
                    }
                },
                actions = {
                    IconButton(
                        onClick = { showPrivacyModal = true },
                        modifier = Modifier.testTag("onboarding_privacy_btn")
                    ) {
                        Icon(
                            imageVector = Icons.Default.Shield,
                            contentDescription = "Privacy Policy",
                            tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f)
                        )
                    }
                    TextButton(
                        onClick = {
                            viewModel.selectTier(selectedTierKey)
                            viewModel.completeOnboarding { onNavigateToMain() }
                        },
                        modifier = Modifier.testTag("onboarding_skip_top_btn")
                    ) {
                        Text(
                            "Skip",
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.primary
                        )
                    }
                },
                colors = TopAppBarDefaults.centerAlignedTopAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface
                )
            )
        },
        bottomBar = {
            Surface(
                tonalElevation = 6.dp,
                shadowElevation = 8.dp,
                modifier = Modifier
                    .fillMaxWidth()
                    .navigationBarsPadding()
                    .imePadding(),
                color = MaterialTheme.colorScheme.surface
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 20.dp, vertical = 16.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    when (currentStep) {
                        1 -> {
                            Button(
                                onClick = {
                                    viewModel.selectTier(selectedTierKey)
                                    currentStep = 2
                                },
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(54.dp)
                                    .testTag("onboarding_step1_next_btn"),
                                shape = RoundedCornerShape(16.dp),
                                colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary)
                            ) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Text(
                                        "Continue",
                                        fontSize = 16.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = Color.White
                                    )
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Icon(
                                        imageVector = Icons.AutoMirrored.Filled.ArrowForward,
                                        contentDescription = null,
                                        tint = Color.White,
                                        modifier = Modifier.size(18.dp)
                                    )
                                }
                            }
                        }
                        2 -> {
                            Button(
                                onClick = {
                                    focusManager.clearFocus()
                                    viewModel.selectTier(selectedTierKey)
                                    currentStep = 3
                                },
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(54.dp)
                                    .testTag("onboarding_step2_next_btn"),
                                shape = RoundedCornerShape(16.dp),
                                colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary)
                            ) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Text(
                                        "Almost Ready",
                                        fontSize = 16.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = Color.White
                                    )
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Icon(
                                        imageVector = Icons.AutoMirrored.Filled.ArrowForward,
                                        contentDescription = null,
                                        tint = Color.White,
                                        modifier = Modifier.size(18.dp)
                                    )
                                }
                            }
                        }
                        3 -> {
                            Button(
                                onClick = {
                                    val effectiveMajor = focusInput.ifBlank {
                                        if (selectedTierKey == "explorer") "Maths & Science" else "General Studies"
                                    }
                                    val effectiveGrade = if (selectedTierKey == "explorer") gradeLevelInput.ifBlank { "Primary 4" } else ""
                                    viewModel.submitManualForm(
                                        name = nameInput,
                                        school = schoolInput,
                                        major = effectiveMajor,
                                        goal = dailyGoalOption,
                                        style = learningStyleOption,
                                        grade = effectiveGrade
                                    )
                                    viewModel.selectTier(selectedTierKey)
                                    viewModel.completeOnboarding {
                                        onNavigateToMain()
                                    }
                                },
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(54.dp)
                                    .testTag("onboarding_launch_workspace_btn"),
                                shape = RoundedCornerShape(16.dp),
                                colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary)
                            ) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Icon(
                                        imageVector = Icons.Default.RocketLaunch,
                                        contentDescription = null,
                                        tint = Color.White,
                                        modifier = Modifier.size(20.dp)
                                    )
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Text(
                                        "Launch My Workspace",
                                        fontSize = 16.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = Color.White
                                    )
                                }
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(6.dp))

                    TextButton(
                        onClick = onNavigateToAuth,
                        modifier = Modifier.testTag("onboarding_auth_switch_btn")
                    ) {
                        Text(
                            "Have an account? Sign in or register →",
                            style = MaterialTheme.typography.bodySmall.copy(
                                fontWeight = FontWeight.SemiBold,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        )
                    }
                }
            }
        }
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .background(MaterialTheme.colorScheme.background)
        ) {
            // Step Progress Indicator Bar
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 24.dp, vertical = 12.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                (1..3).forEach { stepIndex ->
                    val isCompleteOrCurrent = stepIndex <= currentStep
                    val barColor = if (isCompleteOrCurrent) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surfaceVariant
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .height(4.dp)
                            .clip(RoundedCornerShape(2.dp))
                            .background(barColor)
                    )
                }
            }

            // Step Content Animated Transition
            AnimatedContent(
                targetState = currentStep,
                transitionSpec = {
                    if (targetState > initialState) {
                        slideInHorizontally { width -> width } + fadeIn() togetherWith
                                slideOutHorizontally { width -> -width } + fadeOut()
                    } else {
                        slideInHorizontally { width -> -width } + fadeIn() togetherWith
                                slideOutHorizontally { width -> width } + fadeOut()
                    }
                },
                label = "onboarding_step_animation",
                modifier = Modifier.fillMaxSize()
            ) { step ->
                when (step) {
                    1 -> StageSelectStep(
                        selectedTier = selectedTierKey,
                        onTierSelected = { selectedTierKey = it }
                    )
                    2 -> FocusCustomizationStep(
                        tierKey = selectedTierKey,
                        name = nameInput,
                        onNameChange = { nameInput = it },
                        focusSubject = focusInput,
                        onFocusSubjectChange = { focusInput = it },
                        gradeLevel = gradeLevelInput,
                        onGradeLevelChange = { gradeLevelInput = it },
                        school = schoolInput,
                        onSchoolChange = { schoolInput = it },
                        dailyGoal = dailyGoalOption,
                        onDailyGoalChange = { dailyGoalOption = it },
                        learningStyle = learningStyleOption,
                        onLearningStyleChange = { learningStyleOption = it }
                    )
                    3 -> LaunchReadyStep(
                        tierKey = selectedTierKey,
                        name = nameInput,
                        focusSubject = focusInput,
                        gradeLevel = gradeLevelInput,
                        school = schoolInput,
                        dailyGoal = dailyGoalOption
                    )
                }
            }
        }
    }

    if (showPrivacyModal) {
        PrivacyPolicyModal(onDismiss = { showPrivacyModal = false })
    }

    if (showExitConfirm) {
        AlertDialog(
            onDismissRequest = { showExitConfirm = false },
            title = { Text("Leave Setup?") },
            text = { Text("You can customize your learning stage and goals anytime in settings.") },
            confirmButton = {
                TextButton(
                    onClick = {
                        showExitConfirm = false
                        viewModel.selectTier(selectedTierKey)
                        viewModel.completeOnboarding { onNavigateToMain() }
                    }
                ) {
                    Text("Go to App", fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showExitConfirm = false }) {
                    Text("Continue Setup")
                }
            }
        )
    }

    // Workspace Setup Loader Overlay
    if (uiState.isSettingUpWorkspace) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Color.Black.copy(alpha = 0.65f))
                .clickable(enabled = false) {},
            contentAlignment = Alignment.Center
        ) {
            Card(
                shape = RoundedCornerShape(24.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                elevation = CardDefaults.cardElevation(defaultElevation = 12.dp),
                modifier = Modifier
                    .padding(32.dp)
                    .widthIn(max = 360.dp)
            ) {
                Column(
                    modifier = Modifier.padding(28.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    OllieMascot(
                        mood = OllieMood.CELEBRATING,
                        modifier = Modifier.size(80.dp)
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    CircularProgressIndicator(
                        modifier = Modifier.size(36.dp),
                        strokeWidth = 3.dp,
                        color = MaterialTheme.colorScheme.primary
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    Text(
                        text = uiState.setupLoaderMessage,
                        style = MaterialTheme.typography.bodyLarge.copy(fontWeight = FontWeight.Bold),
                        textAlign = TextAlign.Center
                    )
                }
            }
        }
    }
}

@Composable
private fun StageSelectStep(
    selectedTier: String,
    onTierSelected: (String) -> Unit
) {
    val scrollState = rememberScrollState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(scrollState)
            .padding(horizontal = 24.dp, vertical = 12.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Spacer(modifier = Modifier.height(8.dp))

        OllieMascot(
            mood = OllieMood.GREETING,
            modifier = Modifier.size(72.dp)
        )

        Spacer(modifier = Modifier.height(14.dp))

        Text(
            text = "Who is learning today?",
            style = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.ExtraBold),
            textAlign = TextAlign.Center,
            color = MaterialTheme.colorScheme.onBackground
        )

        Spacer(modifier = Modifier.height(6.dp))

        Text(
            text = "Pick your academic stage so Professor Ollie can tailor notes, quizzes, and difficulty for you.",
            style = MaterialTheme.typography.bodyMedium.copy(color = MaterialTheme.colorScheme.onSurfaceVariant),
            textAlign = TextAlign.Center
        )

        Spacer(modifier = Modifier.height(24.dp))

        // Tier Card 1: Explorer
        StageCard(
            title = "Explorer (Basic & JHS)",
            subtitle = "Primary & Junior High School curriculum, colorful quests, fun badges & interactive flashcards.",
            icon = Icons.Default.Backpack,
            badgeEmoji = "🎒",
            accentColor = Color(0xFF00B0FF),
            isSelected = selectedTier == "explorer",
            onClick = { onTierSelected("explorer") }
        )

        Spacer(modifier = Modifier.height(14.dp))

        // Tier Card 2: Achiever
        StageCard(
            title = "Achiever (SHS & WASSCE)",
            subtitle = "Senior High School exam prep, past questions, timed mock tests, and smart revision notes.",
            icon = Icons.Default.Bolt,
            badgeEmoji = "⚡",
            accentColor = Color(0xFFFF9800),
            isSelected = selectedTier == "achiever",
            onClick = { onTierSelected("achiever") }
        )

        Spacer(modifier = Modifier.height(14.dp))

        // Tier Card 3: Scholar
        StageCard(
            title = "Scholar (University & College)",
            subtitle = "Undergraduate & Graduate research, lecture document processor, podcast summaries, and deep AI tutoring.",
            icon = Icons.Default.School,
            badgeEmoji = "🎓",
            accentColor = Color(0xFF9C27B0),
            isSelected = selectedTier == "scholar",
            onClick = { onTierSelected("scholar") }
        )

        Spacer(modifier = Modifier.height(24.dp))
    }
}

@Composable
private fun StageCard(
    title: String,
    subtitle: String,
    icon: ImageVector,
    badgeEmoji: String,
    accentColor: Color,
    isSelected: Boolean,
    onClick: () -> Unit
) {
    val borderColor = if (isSelected) accentColor else MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f)
    val cardBackground = if (isSelected) accentColor.copy(alpha = 0.08f) else MaterialTheme.colorScheme.surface

    Card(
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = cardBackground),
        border = BorderStroke(if (isSelected) 2.dp else 1.dp, borderColor),
        modifier = Modifier
            .fillMaxWidth()
            .tactileClick(onClick = onClick)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(18.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(48.dp)
                    .clip(RoundedCornerShape(14.dp))
                    .background(accentColor.copy(alpha = 0.15f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    tint = accentColor,
                    modifier = Modifier.size(24.dp)
                )
            }

            Spacer(modifier = Modifier.width(16.dp))

            Column(modifier = Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = title,
                        style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold),
                        color = MaterialTheme.colorScheme.onSurface
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(text = badgeEmoji, fontSize = 14.sp)
                }
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = subtitle,
                    style = MaterialTheme.typography.bodySmall.copy(
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        lineHeight = 16.sp
                    )
                )
            }

            Spacer(modifier = Modifier.width(12.dp))

            RadioButton(
                selected = isSelected,
                onClick = onClick,
                colors = RadioButtonDefaults.colors(selectedColor = accentColor)
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun FocusCustomizationStep(
    tierKey: String,
    name: String,
    onNameChange: (String) -> Unit,
    focusSubject: String,
    onFocusSubjectChange: (String) -> Unit,
    gradeLevel: String,
    onGradeLevelChange: (String) -> Unit,
    school: String,
    onSchoolChange: (String) -> Unit,
    dailyGoal: String,
    onDailyGoalChange: (String) -> Unit,
    learningStyle: String,
    onLearningStyleChange: (String) -> Unit
) {
    val scrollState = rememberScrollState()
    val isExplorer = tierKey == "explorer"

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(scrollState)
            .padding(horizontal = 24.dp, vertical = 12.dp)
    ) {
        Text(
            text = "Personalize your study focus",
            style = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.ExtraBold),
            color = MaterialTheme.colorScheme.onBackground
        )

        Spacer(modifier = Modifier.height(4.dp))

        Text(
            text = "Help Ollie personalize your dashboard and recommendations.",
            style = MaterialTheme.typography.bodyMedium.copy(color = MaterialTheme.colorScheme.onSurfaceVariant)
        )

        Spacer(modifier = Modifier.height(20.dp))

        // 1. Name Field
        Text(
            text = "What should Ollie call you?",
            style = MaterialTheme.typography.labelLarge.copy(fontWeight = FontWeight.Bold)
        )
        Spacer(modifier = Modifier.height(6.dp))
        OutlinedTextField(
            value = name,
            onValueChange = onNameChange,
            placeholder = { Text("Your name (e.g. Alex)") },
            leadingIcon = { Icon(Icons.Default.Person, contentDescription = null) },
            singleLine = true,
            shape = RoundedCornerShape(14.dp),
            modifier = Modifier.fillMaxWidth()
        )

        Spacer(modifier = Modifier.height(18.dp))

        // 2. Explorer Grade Level Selection (Primary 1-6, JHS 1-3)
        if (isExplorer) {
            Text(
                text = "What class / grade are you in?",
                style = MaterialTheme.typography.labelLarge.copy(fontWeight = FontWeight.Bold)
            )
            Spacer(modifier = Modifier.height(8.dp))
            val explorerGrades = listOf(
                "Primary 1", "Primary 2", "Primary 3",
                "Primary 4", "Primary 5", "Primary 6",
                "JHS 1", "JHS 2", "JHS 3"
            )
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                explorerGrades.chunked(3).forEach { rowGrades ->
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        rowGrades.forEach { g ->
                            val isSelected = gradeLevel.equals(g, ignoreCase = true)
                            FilterChip(
                                selected = isSelected,
                                onClick = { onGradeLevelChange(g) },
                                label = {
                                    Text(
                                        text = g,
                                        fontSize = 11.sp,
                                        fontWeight = if (isSelected) FontWeight.ExtraBold else FontWeight.Medium
                                    )
                                },
                                modifier = Modifier.weight(1f)
                            )
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(18.dp))
        }

        // 3. School Name (For Explorer & Scholar)
        Text(
            text = if (isExplorer) "School name (Optional — for Class Leaderboards 🏫)" else "School / University (Optional)",
            style = MaterialTheme.typography.labelLarge.copy(fontWeight = FontWeight.Bold)
        )
        Spacer(modifier = Modifier.height(6.dp))
        OutlinedTextField(
            value = school,
            onValueChange = onSchoolChange,
            placeholder = { Text(if (isExplorer) "e.g. St. Peters Basic School" else "e.g. University of Ghana, KNUST") },
            leadingIcon = { Icon(Icons.Default.School, contentDescription = null) },
            singleLine = true,
            shape = RoundedCornerShape(14.dp),
            modifier = Modifier.fillMaxWidth()
        )

        Spacer(modifier = Modifier.height(18.dp))

        // 4. Focus Subject / Major
        Text(
            text = if (isExplorer) "Favourite subject at school" else "Field of study or major",
            style = MaterialTheme.typography.labelLarge.copy(fontWeight = FontWeight.Bold)
        )
        Spacer(modifier = Modifier.height(6.dp))
        OutlinedTextField(
            value = focusSubject,
            onValueChange = onFocusSubjectChange,
            placeholder = { Text(if (isExplorer) "e.g. Science, Maths, ICT" else "e.g. Computer Science, Medicine, Law") },
            leadingIcon = { Icon(Icons.Default.Book, contentDescription = null) },
            singleLine = true,
            shape = RoundedCornerShape(14.dp),
            modifier = Modifier.fillMaxWidth()
        )

        Spacer(modifier = Modifier.height(18.dp))

        // 5. Daily Study Goal
        Text(
            text = "Daily study goal",
            style = MaterialTheme.typography.labelLarge.copy(fontWeight = FontWeight.Bold)
        )
        Spacer(modifier = Modifier.height(8.dp))
        val goals = if (isExplorer) listOf("15 min/day", "30 min/day", "45 min/day", "1 hr/day") else listOf("30 min/day", "1 hr/day", "2 hrs/day", "3+ hrs/day")
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            goals.forEach { goal ->
                val isSelected = dailyGoal == goal
                FilterChip(
                    selected = isSelected,
                    onClick = { onDailyGoalChange(goal) },
                    label = { Text(goal, fontSize = 12.sp, fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal) },
                    modifier = Modifier.weight(1f)
                )
            }
        }

        Spacer(modifier = Modifier.height(18.dp))

        // 6. Learning Style
        Text(
            text = "How do you learn best?",
            style = MaterialTheme.typography.labelLarge.copy(fontWeight = FontWeight.Bold)
        )
        Spacer(modifier = Modifier.height(8.dp))
        val styles = listOf("Visual & Diagrams", "Quiz & Practice", "Audio & Podcasts", "Summary Notes")
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            styles.chunked(2).forEach { rowStyles ->
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    rowStyles.forEach { styleItem ->
                        val isSelected = learningStyle == styleItem
                        FilterChip(
                            selected = isSelected,
                            onClick = { onLearningStyleChange(styleItem) },
                            label = { Text(styleItem, fontSize = 12.sp, fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal) },
                            modifier = Modifier.weight(1f)
                        )
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(24.dp))
    }
}

@Composable
private fun LaunchReadyStep(
    tierKey: String,
    name: String,
    focusSubject: String,
    gradeLevel: String,
    school: String,
    dailyGoal: String
) {
    val scrollState = rememberScrollState()

    val tierLabel = when (tierKey) {
        "explorer" -> "Explorer (Basic / JHS)"
        "scholar" -> "Scholar (University)"
        else -> "Achiever (SHS / WASSCE)"
    }
    val tierEmoji = when (tierKey) {
        "explorer" -> "🎒"
        "scholar" -> "🎓"
        else -> "⚡"
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(scrollState)
            .padding(horizontal = 24.dp, vertical = 12.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Spacer(modifier = Modifier.height(12.dp))

        OllieMascot(
            mood = OllieMood.CELEBRATING,
            modifier = Modifier.size(88.dp)
        )

        Spacer(modifier = Modifier.height(16.dp))

        Text(
            text = if (name.isNotBlank()) "You're all set, $name!" else "You're all set!",
            style = MaterialTheme.typography.headlineMedium.copy(fontWeight = FontWeight.ExtraBold),
            textAlign = TextAlign.Center,
            color = MaterialTheme.colorScheme.onBackground
        )

        Spacer(modifier = Modifier.height(6.dp))

        Text(
            text = "Your personalized workspace is prepared with smart tools for your studies.",
            style = MaterialTheme.typography.bodyMedium.copy(color = MaterialTheme.colorScheme.onSurfaceVariant),
            textAlign = TextAlign.Center
        )

        Spacer(modifier = Modifier.height(24.dp))

        // Summary Card
        Card(
            shape = RoundedCornerShape(20.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.45f)),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(modifier = Modifier.padding(20.dp)) {
                SummaryItem(icon = Icons.Default.School, label = "Stage", value = "$tierEmoji $tierLabel")
                if (tierKey == "explorer" && gradeLevel.isNotBlank()) {
                    HorizontalDivider(modifier = Modifier.padding(vertical = 10.dp), color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.3f))
                    SummaryItem(icon = Icons.Default.Class, label = "Class", value = gradeLevel)
                }
                if (school.isNotBlank()) {
                    HorizontalDivider(modifier = Modifier.padding(vertical = 10.dp), color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.3f))
                    SummaryItem(icon = Icons.Default.Apartment, label = "School", value = school)
                }
                HorizontalDivider(modifier = Modifier.padding(vertical = 10.dp), color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.3f))
                SummaryItem(icon = Icons.Default.Book, label = "Focus", value = focusSubject.ifBlank { "General Studies" })
                HorizontalDivider(modifier = Modifier.padding(vertical = 10.dp), color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.3f))
                SummaryItem(icon = Icons.Default.Timer, label = "Daily Goal", value = dailyGoal)
            }
        }

        Spacer(modifier = Modifier.height(20.dp))

        // Feature Highlights
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            FeaturePill(icon = Icons.Default.Description, title = "AI Notes", modifier = Modifier.weight(1f))
            FeaturePill(icon = Icons.Default.Quiz, title = "Quiz Engine", modifier = Modifier.weight(1f))
            FeaturePill(icon = Icons.Default.AutoAwesome, title = "Flashcards", modifier = Modifier.weight(1f))
        }

        Spacer(modifier = Modifier.height(24.dp))
    }
}

@Composable
private fun SummaryItem(
    icon: ImageVector,
    label: String,
    value: String
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.primary,
            modifier = Modifier.size(20.dp)
        )
        Spacer(modifier = Modifier.width(12.dp))
        Text(
            text = label,
            style = MaterialTheme.typography.bodyMedium.copy(color = MaterialTheme.colorScheme.onSurfaceVariant),
            modifier = Modifier.width(80.dp)
        )
        Text(
            text = value,
            style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Bold),
            color = MaterialTheme.colorScheme.onSurface
        )
    }
}

@Composable
private fun FeaturePill(
    icon: ImageVector,
    title: String,
    modifier: Modifier = Modifier
) {
    Surface(
        shape = RoundedCornerShape(14.dp),
        color = MaterialTheme.colorScheme.surface,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.4f)),
        modifier = modifier
    ) {
        Column(
            modifier = Modifier.padding(vertical = 12.dp, horizontal = 8.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.primary,
                modifier = Modifier.size(22.dp)
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = title,
                style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold),
                textAlign = TextAlign.Center
            )
        }
    }
}
