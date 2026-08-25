package com.example.ui

import androidx.compose.animation.AnimatedContentTransitionScope
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.MenuBook
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.*
import com.example.R
import com.example.data.local.StuddyHubDatabase
import com.example.data.repository.StuddyHubRepository
import com.example.ui.navigation.Screen
import com.example.ui.navigation.mainNavigationItems
import com.example.ui.components.StuddyFloatingNavBar
import com.example.ui.components.StuddyNavItem
import com.example.ui.screens.aichat.AIChatScreen
import com.example.ui.screens.aichat.ChatSessionsListScreen
import com.example.ui.screens.aichat.AIChatViewModel
import com.example.ui.screens.aipodcast.AIPodcastScreen
import com.example.ui.screens.aipodcast.AIPodcastViewModel
import com.example.ui.screens.auth.AuthScreen
import com.example.ui.screens.auth.AuthViewModel
import com.example.ui.screens.courses.CoursesScreen
import com.example.ui.screens.courses.CoursesViewModel
import com.example.ui.screens.dashboard.DashboardScreen
import com.example.ui.screens.dashboard.DashboardViewModel
import com.example.ui.screens.documents.DocumentsScreen
import com.example.ui.screens.documents.DocumentsViewModel
import com.example.ui.screens.flashcards.FlashcardsScreen
import com.example.ui.screens.flashcards.FlashcardsViewModel
import com.example.ui.screens.notes.NotesScreen
import com.example.ui.screens.notes.NotesViewModel
import com.example.ui.screens.onboarding.OnboardingScreen
import com.example.ui.screens.onboarding.OnboardingViewModel
import com.example.ui.screens.profile.ProfileScreen
import com.example.ui.screens.profile.ProfileViewModel
import com.example.ui.screens.quizzes.QuizzesScreen
import com.example.ui.screens.quizzes.QuizzesViewModel
import com.example.ui.screens.recordings.RecordingsScreen
import com.example.ui.screens.recordings.RecordingsViewModel
import com.example.ui.screens.schedule.ScheduleScreen
import com.example.ui.screens.schedule.ScheduleTasksScreen
import com.example.ui.screens.schedule.ScheduleExamsScreen
import com.example.ui.screens.schedule.ScheduleAIFlowScreen
import com.example.ui.screens.schedule.ScheduleViewModel
import com.example.ui.screens.documents.DocumentUploadAIFlowScreen
import com.example.ui.screens.flashcards.FlashcardsAIFlowScreen
import com.example.ui.screens.search.SearchScreen
import com.example.ui.screens.social.SocialFeedScreen
import com.example.ui.screens.social.SocialViewModel
import com.example.ui.screens.splash.SplashScreen
import com.example.ui.screens.splash.SplashViewModel
import com.example.ui.screens.sync.SyncDetailsDialog
import com.example.ui.screens.LibraryScreen
import com.example.ui.screens.PracticeScreen
import com.example.ui.screens.PracticeViewModel
import com.example.ui.screens.AssistantScreen
import com.example.ui.screens.CommunityScreen
import com.example.ui.theme.AcademicTier
import com.example.ui.theme.EmeraldAccent
import com.example.ui.theme.IndigoPrimary
import com.example.ui.theme.ProvideTierTheme
import kotlinx.coroutines.launch
import kotlinx.coroutines.flow.firstOrNull

/** Greeting name for the shared AI tutor, branded per academic tier (matches AIChatScreen). */
private fun AcademicTier.tutorGreetingName(): String = when (this) {
    AcademicTier.EXPLORER -> "Ollie"
    AcademicTier.ACHIEVER -> "Master Kwame"
    AcademicTier.SCHOLAR -> "Professor Ollie"
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun StuddyHubApp() {
    val context = LocalContext.current
    val database = StuddyHubDatabase.getDatabase(context)
    // Must not be constructed inline: this composable re-runs on every recomposition, and each
    // repository opens its own realtime socket and startup sync. remember + a process-wide
    // singleton keeps exactly one alive.
    val repository = remember(database) { StuddyHubRepository.getInstance(database) }

    // Pre-load tier from SharedPreferences (fast, sync) so the correct theme
    // renders on the very first frame — no flash of the wrong tier on low-end phones.
    val prefs = remember { context.getSharedPreferences("studdyhub_session", android.content.Context.MODE_PRIVATE) }
    val cachedTierKey = remember { prefs.getString("academic_tier", "achiever") ?: "achiever" }

    // Restore persisted SFX preference on startup
    remember { com.example.ui.components.TactileSoundSystem.restoreSoundPreference(context) }
    val currentProfile by repository.userProfile.collectAsStateWithLifecycle(initialValue = null)
    val activeTier = remember(currentProfile?.academicTier, cachedTierKey) {
        AcademicTier.fromKey(currentProfile?.academicTier ?: cachedTierKey)
    }

    val viewModelFactory = remember(repository) { ViewModelFactory(repository, context.applicationContext) }

    val aiChatViewModel: AIChatViewModel = viewModel(factory = viewModelFactory)
    val quizzesViewModel: QuizzesViewModel = viewModel(factory = viewModelFactory)

    val navController = rememberNavController()
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = navBackStackEntry?.destination?.route

    // Repair orphaned AI placeholder rows (empty assistant messages left behind by a
    // killed/aborted stream) — deferred to after the user is authenticated so DB work
    // doesn't slow down the splash / login screens.
    var sweepDone by remember { mutableStateOf(false) }
    LaunchedEffect(currentRoute) {
        if (!sweepDone && currentRoute == Screen.Dashboard.route) {
            sweepDone = true
            repository.sweepOrphanedAiPlaceholders()
        }
    }

    val coroutineScope = rememberCoroutineScope()
    val currentNavigationScreens = remember(activeTier) {
        com.example.ui.navigation.getNavigationScreensForTier(activeTier)
    }
    val mainNavigationRoutes = remember(currentNavigationScreens) {
        currentNavigationScreens.map { it.route }
    }
    val isBottomBarVisible = currentRoute in mainNavigationRoutes

    val syncManager = remember { com.example.data.local.SyncManager.getInstance(context, database) }
    var showSyncDetailsDialog by remember { mutableStateOf(false) }

    val navigateTo: (String) -> Unit = { route ->
        navController.navigate(route) {
            popUpTo(Screen.Dashboard.route) {
                saveState = true
            }
            launchSingleTop = true
            restoreState = true
        }
    }

    // Drawer-era screens now push their own back stack — a back arrow returns
    // to the hub the user came from instead of jumping to Profile/Settings.
    val goBack: () -> Unit = { navController.popBackStack() }

    ProvideTierTheme(tier = activeTier) {
        Box(modifier = Modifier.fillMaxSize()) {
        Scaffold(
            // Every screen manages its own system insets (TopAppBar / statusBarsPadding),
            // so don't double-apply them here — otherwise the status bar gets padded twice
            // and pushes each screen's header down.
            contentWindowInsets = WindowInsets(0, 0, 0, 0)
        ) { innerPadding ->
            Box(modifier = Modifier.padding(innerPadding)) {
                NavHost(
                    navController = navController,
                    startDestination = Screen.Splash.route,
                    enterTransition = {
                        slideIntoContainer(
                            AnimatedContentTransitionScope.SlideDirection.Left,
                            animationSpec = tween(300)
                        )
                    },
                    exitTransition = {
                        slideOutOfContainer(
                            AnimatedContentTransitionScope.SlideDirection.Left,
                            animationSpec = tween(300)
                        )
                    },
                    popEnterTransition = {
                        slideIntoContainer(
                            AnimatedContentTransitionScope.SlideDirection.Right,
                            animationSpec = tween(300)
                        )
                    },
                    popExitTransition = {
                        slideOutOfContainer(
                            AnimatedContentTransitionScope.SlideDirection.Right,
                            animationSpec = tween(300)
                        )
                    }
                ) {
            composable(Screen.Splash.route) {
                val splashVm: SplashViewModel = viewModel(factory = viewModelFactory)
                SplashScreen(
                    viewModel = splashVm,
                    onNavigateToOnboarding = {
                        navController.navigate(Screen.Onboarding.route) {
                            popUpTo(0) { inclusive = true }
                        }
                    },
                    onNavigateToAuth = {
                        navController.navigate(Screen.Auth.route) {
                            popUpTo(0) { inclusive = true }
                        }
                    },
                    onNavigateToDashboard = {
                        navController.navigate(Screen.Dashboard.route) {
                            popUpTo(0) { inclusive = true }
                        }
                    }
                )
            }

            composable(Screen.Search.route) {
                val vm: com.example.ui.screens.search.SearchViewModel = viewModel(factory = viewModelFactory)
                SearchScreen(
                    viewModel = vm,
                    onNavigate = { route -> navController.navigate(route) },
                    onBack = { navController.popBackStack() }
                )
            }

            composable(Screen.Library.route) {
                LibraryScreen(
                    onNavigateToNotes = { navController.navigate(Screen.Notes.route) },
                    onNavigateToDocuments = { navController.navigate(Screen.Documents.route) },
                    onNavigateToRecordings = { navController.navigate(Screen.Recordings.route) },
                    onNavigateToCourses = { navController.navigate(Screen.Courses.route) },
                    onNavigateToUploadDocument = { navController.navigate(Screen.UploadDocument.route) }
                )
            }

            composable(Screen.Practice.route) {
                val vm: PracticeViewModel = viewModel(factory = viewModelFactory)
                PracticeScreen(
                    viewModel = vm,
                    onNavigateToQuizzes = { navController.navigate(Screen.Quizzes.route) },
                    onNavigateToFlashcards = { navController.navigate(Screen.Flashcards.route) },
                    onNavigateToSchedule = { navController.navigate(Screen.Schedule.route) },
                    onNavigateToAddSchedule = { navController.navigate(Screen.AddScheduleEventFlow.route) }
                )
            }

            composable(Screen.Assistant.route) {
                AssistantScreen(
                    onNavigateToAIChat = { navController.navigate(Screen.AIChat.route) },
                    onNavigateToAIPodcast = { navController.navigate(Screen.AIPodcast.route) },
                    onNavigateToAddSchedule = { navController.navigate(Screen.AddScheduleEventFlow.route) },
                    onNavigateToCreateQuiz = { navController.navigate(Screen.CreateQuizFlow.route) },
                    onNavigateToCreateNote = { navController.navigate(Screen.NoteDetail.createRoute("new")) },
                    onNavigateToCreateFlashcards = { navController.navigate(Screen.CreateFlashcardFlow.route) }
                )
            }

            composable(Screen.Community.route) {
                val vm: SocialViewModel = viewModel(factory = viewModelFactory)
                LaunchedEffect(Unit) { vm.onScreenResumed() }
                val socialState by vm.uiState.collectAsStateWithLifecycle()
                CommunityScreen(
                    feedPosts = socialState.posts,
                    onNavigateToFeed = { navController.navigate(Screen.SocialFeed.route) },
                    onNavigateToGroups = { navController.navigate(Screen.SocialGroups.route) },
                    onNavigateToNotifications = { navController.navigate(Screen.SocialNotifications.route) },
                    onNavigateToProfile = { navController.navigate(Screen.Profile.route) }
                )
            }

            composable(Screen.Documents.route) {
                val vm: DocumentsViewModel = viewModel(factory = viewModelFactory)
                DocumentsScreen(
                    viewModel = vm,
                    onNavigateToDocumentDetail = { docId ->
                        navController.navigate(Screen.DocumentDetail.createRoute(docId))
                    },
                    onNavigateToUploadFlow = {
                        navController.navigate(Screen.UploadDocument.route)
                    },
                    onBack = goBack,
                    onDiscussWithOllie = { doc ->
                        aiChatViewModel.sendMessage("Hey ${activeTier.tutorGreetingName()}! I want to study and discuss my document: '${doc.title}'. Here is the content:\n\n${doc.contentExtracted}")
                        navController.navigate(Screen.AIChat.route)
                    }
                )
            }

            composable(Screen.UploadDocument.route) {
                val vm: DocumentsViewModel = viewModel(factory = viewModelFactory)
                com.example.ui.screens.documents.DocumentUploadScreen(
                    viewModel = vm,
                    onNavigateBack = { navController.popBackStack() }
                )
            }

            composable(Screen.Onboarding.route) {
                val vm: OnboardingViewModel = viewModel(factory = viewModelFactory)
                OnboardingScreen(
                    viewModel = vm,
                    onNavigateToAuth = {
                        navController.navigate(Screen.Auth.route) {
                            popUpTo(Screen.Onboarding.route) { inclusive = true }
                        }
                    },
                    onNavigateToMain = {
                        navController.navigate(Screen.Dashboard.route) {
                            popUpTo(Screen.Onboarding.route) { inclusive = true }
                        }
                    }
                )
            }

            composable(Screen.Auth.route) {
                val vm: AuthViewModel = viewModel(factory = viewModelFactory)
                AuthScreen(
                    viewModel = vm,
                    onNavigateToMain = { onboardingCompleted ->
                        val targetRoute = if (!onboardingCompleted) Screen.Onboarding.route else Screen.Dashboard.route
                        navController.navigate(targetRoute) {
                            popUpTo(Screen.Auth.route) { inclusive = true }
                            launchSingleTop = true
                        }
                    }
                )
            }

            composable(Screen.Dashboard.route) {
                val vm: DashboardViewModel = viewModel(factory = viewModelFactory)
                DashboardScreen(
                    viewModel = vm,
                    onNavigate = { route ->
                        if (route in mainNavigationRoutes) {
                            navigateTo(route)
                        } else {
                            navController.navigate(route)
                        }
                    },
                    onNavigateToProfile = { navigateTo(Screen.Profile.route) }
                )
            }

            composable(Screen.Notes.route) {
                val vm: NotesViewModel = viewModel(factory = viewModelFactory)
                NotesScreen(
                    viewModel = vm,
                    onNavigateToNoteDetail = { noteId ->
                        navController.navigate(Screen.NoteDetail.createRoute(noteId))
                    },
                    onNavigateToQuiz = { navController.navigate(Screen.Quizzes.route) },
                    onNavigateToFlashcards = { navController.navigate(Screen.Flashcards.route) },
                    onBack = goBack,
                    onDiscussWithOllie = { note ->
                        aiChatViewModel.sendMessage("Hey ${activeTier.tutorGreetingName()}! Let's review my study note: '${note.title}'. Here is what I wrote:\n\n${note.content}")
                        navController.navigate(Screen.AIChat.route)
                    }
                )
            }

            composable(Screen.Recordings.route) {
                val vm: RecordingsViewModel = viewModel(factory = viewModelFactory)
                RecordingsScreen(viewModel = vm, onBack = goBack)
            }

            composable(Screen.Quizzes.route) {
                // Trigger the deferred network load (cloud sync + lobby check) once the user
                // actually navigates to quizzes — avoids firing API calls on the login screen.
                LaunchedEffect(Unit) { quizzesViewModel.onScreenResumed() }
                QuizzesScreen(
                    viewModel = quizzesViewModel,
                    onBack = goBack,
                    onLaunchGame = { gameKey ->
                        // Math Asteroid Blaster has its own standalone game screen
                        if (gameKey == "math_asteroid_blaster" || gameKey == "asteroid_laser" || gameKey == "asteroid_blaster" || gameKey == "math_laser") {
                            navController.navigate(Screen.MathAsteroidBlaster.route)
                        } else {
                            navController.navigate(Screen.GameDetail.createRoute(gameKey))
                        }
                    },
                    onOpenTrophies = {
                        navController.navigate(Screen.BadgesTrophies.route)
                    }
                )
            }

            composable(Screen.Flashcards.route) {
                val vm: FlashcardsViewModel = viewModel(factory = viewModelFactory)
                FlashcardsScreen(
                    viewModel = vm,
                    onNavigateToCreateFlow = {
                        navController.navigate(Screen.CreateFlashcardFlow.route)
                    },
                    onBack = goBack
                )
            }

            composable(Screen.CreateFlashcardFlow.route) {
                val vm: FlashcardsViewModel = viewModel(factory = viewModelFactory)
                FlashcardsAIFlowScreen(
                    viewModel = vm,
                    onBack = { navController.popBackStack() }
                )
            }

            composable(Screen.Schedule.route) {
                val vm: ScheduleViewModel = viewModel(factory = viewModelFactory)
                ScheduleScreen(
                    viewModel = vm,
                    onNavigateToAdd = { navController.navigate(Screen.AddScheduleEventFlow.route) },
                    onBack = goBack
                )
            }

            composable(Screen.ScheduleTimetable.route) {
                val vm: ScheduleViewModel = viewModel(factory = viewModelFactory)
                ScheduleScreen(
                    viewModel = vm,
                    onNavigateToAdd = { navController.navigate(Screen.AddScheduleEventFlow.route) },
                    onBack = goBack
                )
            }

            composable(Screen.ScheduleTasks.route) {
                val vm: ScheduleViewModel = viewModel(factory = viewModelFactory)
                ScheduleTasksScreen(
                    viewModel = vm,
                    onNavigateToAdd = { navController.navigate(Screen.AddScheduleEventFlow.route) },
                    onBack = goBack
                )
            }

            composable(Screen.ScheduleExams.route) {
                val vm: ScheduleViewModel = viewModel(factory = viewModelFactory)
                ScheduleExamsScreen(
                    viewModel = vm,
                    onNavigateToAdd = { navController.navigate(Screen.AddScheduleEventFlow.route) },
                    onBack = goBack
                )
            }

            composable(Screen.AddScheduleEventFlow.route) {
                val vm: ScheduleViewModel = viewModel(factory = viewModelFactory)
                ScheduleAIFlowScreen(
                    viewModel = vm,
                    onBack = { navController.popBackStack() }
                )
            }

            composable(Screen.AIPodcast.route) {
                val vm: AIPodcastViewModel = viewModel(factory = viewModelFactory)
                AIPodcastScreen(viewModel = vm, onBack = goBack)
            }

            composable(Screen.Courses.route) {
                val vm: CoursesViewModel = viewModel(factory = viewModelFactory)
                CoursesScreen(viewModel = vm, onBack = goBack)
            }

            composable(Screen.SocialFeed.route) {
                val vm: SocialViewModel = viewModel(factory = viewModelFactory)
                LaunchedEffect(Unit) { vm.onScreenResumed() }
                SocialFeedScreen(
                    viewModel = vm,
                    initialTab = com.example.ui.screens.social.SocialTab.FEED,
                    onNavigateToGroupDetail = { groupId -> navController.navigate(Screen.GroupDetail.createRoute(groupId)) },
                    onBack = goBack
                )
            }

            composable(Screen.SocialTrending.route) {
                val vm: SocialViewModel = viewModel(factory = viewModelFactory)
                LaunchedEffect(Unit) { vm.onScreenResumed() }
                SocialFeedScreen(
                    viewModel = vm,
                    initialTab = com.example.ui.screens.social.SocialTab.TRENDING,
                    onNavigateToGroupDetail = { groupId -> navController.navigate(Screen.GroupDetail.createRoute(groupId)) },
                    onBack = goBack
                )
            }

            composable(Screen.SocialGroups.route) {
                val vm: SocialViewModel = viewModel(factory = viewModelFactory)
                LaunchedEffect(Unit) { vm.onScreenResumed() }
                SocialFeedScreen(
                    viewModel = vm,
                    initialTab = com.example.ui.screens.social.SocialTab.GROUPS,
                    onNavigateToGroupDetail = { groupId -> navController.navigate(Screen.GroupDetail.createRoute(groupId)) },
                    onBack = goBack
                )
            }

            composable(Screen.SocialNotifications.route) {
                val vm: SocialViewModel = viewModel(factory = viewModelFactory)
                LaunchedEffect(Unit) { vm.onScreenResumed() }
                SocialFeedScreen(
                    viewModel = vm,
                    initialTab = com.example.ui.screens.social.SocialTab.NOTIFICATIONS,
                    onNavigateToGroupDetail = { groupId -> navController.navigate(Screen.GroupDetail.createRoute(groupId)) },
                    onBack = goBack
                )
            }

            composable(
                route = Screen.GroupDetail.route,
                arguments = listOf(androidx.navigation.navArgument("groupId") { type = androidx.navigation.NavType.StringType })
            ) { backStackEntry ->
                val groupId = backStackEntry.arguments?.getString("groupId") ?: ""
                val vm: SocialViewModel = viewModel(factory = viewModelFactory)
                com.example.ui.screens.social.GroupDetailScreen(
                    groupId = groupId,
                    viewModel = vm,
                    onBack = { navController.popBackStack() }
                )
            }

            composable(Screen.AIChat.route) {
                LaunchedEffect(Unit) { aiChatViewModel.onScreenResumed() }
                AIChatScreen(
                    viewModel = aiChatViewModel,
                    onBack = goBack,
                    onOpenSessions = {
                        navController.navigate(Screen.ChatSessionsList.route)
                    }
                )
            }

            composable(Screen.ChatSessionsList.route) {
                LaunchedEffect(Unit) { aiChatViewModel.onScreenResumed() }
                ChatSessionsListScreen(
                    viewModel = aiChatViewModel,
                    onBack = goBack,
                    onSessionSelected = { sessionId ->
                        navController.popBackStack()
                    }
                )
            }

            composable(Screen.Settings.route) {
                val profileVm: ProfileViewModel = viewModel(factory = viewModelFactory)
                val settingsVm: com.example.ui.screens.settings.SettingsViewModel = viewModel(factory = viewModelFactory)
                val socialVm: SocialViewModel = viewModel(factory = viewModelFactory)
                com.example.ui.screens.profile.ProfileAndSettingsScreen(
                    profileViewModel = profileVm,
                    settingsViewModel = settingsVm,
                    socialViewModel = socialVm,
                    initialTab = 1,
                    onNavigateToAuth = {
                        navController.navigate(Screen.Auth.route) {
                            popUpTo(0) { inclusive = true }
                        }
                    },
                    onNavigateToOnboarding = {
                        navController.navigate(Screen.Onboarding.route) {
                            popUpTo(0) { inclusive = true }
                        }
                    },
                    onBack = {
                        if (!navController.popBackStack()) {
                            navigateTo(Screen.Dashboard.route)
                        }
                    },
                    onTriggerSync = { coroutineScope.launch { syncManager.triggerSync() } },
                    onOpenSyncDetails = { showSyncDetailsDialog = true }
                )
            }

            composable(Screen.Profile.route) {
                val profileVm: ProfileViewModel = viewModel(factory = viewModelFactory)
                val settingsVm: com.example.ui.screens.settings.SettingsViewModel = viewModel(factory = viewModelFactory)
                val socialVm: SocialViewModel = viewModel(factory = viewModelFactory)
                com.example.ui.screens.profile.ProfileAndSettingsScreen(
                    profileViewModel = profileVm,
                    settingsViewModel = settingsVm,
                    socialViewModel = socialVm,
                    initialTab = 0,
                    onNavigateToAuth = {
                        navController.navigate(Screen.Auth.route) {
                            popUpTo(0) { inclusive = true }
                        }
                    },
                    onNavigateToOnboarding = {
                        navController.navigate(Screen.Onboarding.route) {
                            popUpTo(0) { inclusive = true }
                        }
                    },
                    onBack = {
                        if (!navController.popBackStack()) {
                            navigateTo(Screen.Dashboard.route)
                        }
                    },
                    onTriggerSync = { coroutineScope.launch { syncManager.triggerSync() } },
                    onOpenSyncDetails = { showSyncDetailsDialog = true }
                )
            }

            composable(Screen.Ranking.route) {
                com.example.ui.screens.RankingScreen(
                    repository = repository,
                    onNavigateToProfile = { navigateTo(Screen.Profile.route) }
                )
            }

            composable(
                route = Screen.GameDetail.route,
                arguments = listOf(androidx.navigation.navArgument("gameKey") { type = androidx.navigation.NavType.StringType })
            ) { backStackEntry ->
                val gameKey = backStackEntry.arguments?.getString("gameKey") ?: "maths_quest"
                val stats by repository.userStats.collectAsStateWithLifecycle(initialValue = null)
                com.example.ui.screens.quizzes.ExplorerGameDetailScreen(
                    gameKey = gameKey,
                    viewModel = quizzesViewModel,
                    streakCount = stats?.currentStreak ?: 1,
                    onBack = { navController.popBackStack() },
                    onLaunchLevel = {
                        // Math Asteroid Blaster has its own standalone game screen
                        if (gameKey == "math_asteroid_blaster") {
                            navController.navigate(Screen.MathAsteroidBlaster.route)
                        } else {
                            // Explorer solo levels run in the kid-friendly runner v2.
                            navController.navigate(Screen.ExplorerQuizRunner.route)
                        }
                    },
                    onLaunchSpelling = { level ->
                        navController.navigate(Screen.SpellingBee.createRoute(level))
                    },
                    onLaunchSpeedRace = {
                        navController.navigate(Screen.SpeedRace.route)
                    }
                )
            }

            composable(
                route = Screen.SpellingBee.route,
                arguments = listOf(androidx.navigation.navArgument("level") { type = androidx.navigation.NavType.IntType })
            ) { backStackEntry ->
                val level = backStackEntry.arguments?.getInt("level") ?: 1
                com.example.ui.screens.quizzes.SpellingBeeScreen(
                    level = level,
                    viewModel = quizzesViewModel,
                    onBack = { navController.popBackStack() }
                )
            }

            composable(
                route = Screen.LearnIt.route,
                arguments = listOf(androidx.navigation.navArgument("stepId") { type = androidx.navigation.NavType.StringType })
            ) { backStackEntry ->
                val stepId = backStackEntry.arguments?.getString("stepId") ?: ""
                com.example.ui.screens.quizzes.LearnItScreen(
                    stepId = stepId,
                    repository = repository,
                    onBack = { navController.popBackStack() },
                    onOpenGame = { gameKey ->
                        navController.navigate(Screen.GameDetail.createRoute(gameKey))
                    }
                )
            }

            composable(Screen.SpeedRace.route) {
                com.example.ui.screens.quizzes.SpeedRaceScreen(
                    viewModel = quizzesViewModel,
                    onBack = { navController.popBackStack() }
                )
            }

            composable(Screen.ExplorerQuizRunner.route) {
                com.example.ui.screens.quizzes.ExplorerQuizRunnerScreen(
                    viewModel = quizzesViewModel,
                    onBack = { navController.popBackStack() }
                )
            }

            composable(Screen.ExplorerStore.route) {
                com.example.ui.screens.quizzes.ExplorerStoreScreen(
                    onBack = { navController.popBackStack() }
                )
            }

            // Real multiplayer: host/join a live quiz room by PIN (realtime backend).
            // Opens straight into the live-quiz battle arena with custom rooms & quick matchmaking.
            composable(Screen.MultiplayerLobby.route) {
                val vm: QuizzesViewModel = viewModel(factory = viewModelFactory)
                LaunchedEffect(Unit) { vm.onScreenResumed() }
                com.example.ui.screens.quizzes.ExplorerMultiplayerBattleScreen(viewModel = vm, onBack = goBack)
            }

            composable(Screen.BadgesTrophies.route) {
                com.example.ui.screens.quizzes.ExplorerBadgesScreen(
                    onBack = { navController.popBackStack() }
                )
            }

            composable(Screen.LearnItLibrary.route) {
                com.example.ui.screens.quizzes.LearnItLibraryScreen(
                    repository = repository,
                    onBack = { navController.popBackStack() },
                    onOpenStep = { stepId ->
                        navController.navigate(Screen.LearnIt.createRoute(stepId))
                    }
                )
            }

            composable(Screen.MathAsteroidBlaster.route) {
                com.example.ui.screens.quizzes.MathAsteroidBlasterGameScreen(
                    onBack = { navController.popBackStack() },
                    onLevelCompleted = { score, stars ->
                        coroutineScope.launch {
                            repository.claimDailyQuest(stars * 25)
                        }
                    }
                )
            }

            composable(
                route = Screen.NoteDetail.route,
                arguments = listOf(androidx.navigation.navArgument("noteId") { type = androidx.navigation.NavType.StringType }),
                enterTransition = {
                    slideIntoContainer(AnimatedContentTransitionScope.SlideDirection.Left, animationSpec = tween(350)) + fadeIn(animationSpec = tween(350))
                },
                exitTransition = {
                    slideOutOfContainer(AnimatedContentTransitionScope.SlideDirection.Left, animationSpec = tween(350)) + fadeOut(animationSpec = tween(350))
                },
                popEnterTransition = {
                    slideIntoContainer(AnimatedContentTransitionScope.SlideDirection.Right, animationSpec = tween(350)) + fadeIn(animationSpec = tween(350))
                },
                popExitTransition = {
                    slideOutOfContainer(AnimatedContentTransitionScope.SlideDirection.Right, animationSpec = tween(350)) + fadeOut(animationSpec = tween(350))
                }
            ) { backStackEntry ->
                val noteId = backStackEntry.arguments?.getString("noteId") ?: ""
                com.example.ui.screens.notes.NoteDetailScreen(
                    noteId = noteId,
                    repository = repository,
                    onNavigateBack = { navController.popBackStack() },
                    onNavigateToQuiz = { navController.navigate(Screen.Quizzes.route) },
                    onNavigateToCards = { navController.navigate(Screen.Flashcards.route) },
                    onDiscussWithOllie = { note ->
                        aiChatViewModel.sendMessage("Hey ${activeTier.tutorGreetingName()}! Let's review my study note: '${note.title}'. Here is what I wrote:\n\n${note.content}")
                        navController.navigate(Screen.AIChat.route)
                    }
                )
            }

            composable(
                route = Screen.DocumentDetail.route,
                arguments = listOf(androidx.navigation.navArgument("docId") { type = androidx.navigation.NavType.StringType })
            ) { backStackEntry ->
                val docId = backStackEntry.arguments?.getString("docId") ?: ""
                com.example.ui.screens.documents.DocumentDetailScreen(
                    docId = docId,
                    repository = repository,
                    onNavigateBack = { navController.popBackStack() },
                    onNavigateToNotes = { navController.navigate(Screen.Notes.route) },
                    onNavigateToQuiz = { navController.navigate(Screen.Quizzes.route) },
                    onNavigateToCards = { navController.navigate(Screen.Flashcards.route) },
                    onDiscussWithOllie = { doc ->
                        aiChatViewModel.sendMessage("Hey ${activeTier.tutorGreetingName()}! I want to study and discuss my document: '${doc.title}'. Here is the content:\n\n${doc.contentExtracted}")
                        navController.navigate(Screen.AIChat.route)
                    }
                )
            }

            composable(Screen.CreateQuizFlow.route) {
                val vm: QuizzesViewModel = viewModel(factory = viewModelFactory)
                LaunchedEffect(Unit) { vm.onScreenResumed() }
                QuizzesScreen(viewModel = vm, onBack = goBack, initialAction = "ai_quiz")
            }

            composable(Screen.CreateCourseFlow.route) {
                val vm: CoursesViewModel = viewModel(factory = viewModelFactory)
                CoursesScreen(viewModel = vm, onBack = goBack)
            }

            composable(Screen.CreateSocialPostFlow.route) {
                val vm: SocialViewModel = viewModel(factory = viewModelFactory)
                SocialFeedScreen(viewModel = vm, onBack = goBack)
            }
            }
        }
    }

        // Floating pill nav — overlaid on top of the content instead of reserving
        // Scaffold space, so the transparent container around it lets scrolling
        // content show through while only the rounded pill stays visible.
        if (isBottomBarVisible) {
            StuddyFloatingNavBar(
                items = currentNavigationScreens.map { StuddyNavItem(it.title, it.icon, it.route) },
                selectedRoute = currentRoute ?: "",
                onNavigate = navigateTo,
                modifier = Modifier.align(Alignment.BottomCenter)
            )
        }

        if (showSyncDetailsDialog) {
            // Collects the sync-queue flows only while the dialog is open, so sync progress
            // churn never reaches the rest of the app tree.
            SyncDetailsDialogHost(
                repository = repository,
                syncManager = syncManager,
                onDismiss = { showSyncDetailsDialog = false }
            )
        }

    }
}
}

@Composable
private fun SyncDetailsDialogHost(
    repository: StuddyHubRepository,
    syncManager: com.example.data.local.SyncManager,
    onDismiss: () -> Unit
) {
    val coroutineScope = rememberCoroutineScope()
    val syncQueueItems by repository.syncQueueItems.collectAsStateWithLifecycle(initialValue = emptyList())
    val isSyncing by syncManager.isSyncing.collectAsStateWithLifecycle()
    SyncDetailsDialog(
        syncQueueItems = syncQueueItems,
        isSyncing = isSyncing,
        onTriggerSync = { syncManager.triggerSync() },
        onRetryFailed = {
            coroutineScope.launch {
                syncManager.retryAllFailedSyncs()
            }
        },
        onDismiss = onDismiss
    )
}


