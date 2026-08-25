package com.example.ui.screens.profile

import androidx.compose.foundation.layout.*
import androidx.compose.ui.unit.dp
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.example.ui.screens.social.ProfileTab
import com.example.ui.screens.social.SocialViewModel
import com.example.ui.screens.settings.SettingsScreen
import com.example.ui.screens.settings.SettingsViewModel

/**
 * Thin shell that hosts two tabs:
 *   Tab 0 — Workspace Profile (avatar, stats, streak, badges)
 *   Tab 1 — Settings & Sync (learning mode, TTS, sync, help, about, account)
 *
 * All UI logic lives in [ProfileScreen] and [SettingsScreen].
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProfileAndSettingsScreen(
    profileViewModel: ProfileViewModel,
    settingsViewModel: SettingsViewModel,
    socialViewModel: SocialViewModel,
    initialTab: Int = 0,
    onNavigateToAuth: () -> Unit = {},
    onNavigateToOnboarding: () -> Unit = {},
    onBack: () -> Unit = {},
    onTriggerSync: () -> Unit = {},
    onOpenSyncDetails: () -> Unit = {}
) {
    val profileState by profileViewModel.uiState.collectAsStateWithLifecycle()
    val settingsState by settingsViewModel.uiState.collectAsStateWithLifecycle()
    val socialState by socialViewModel.uiState.collectAsStateWithLifecycle()

    var selectedTabIndex by remember(initialTab) { mutableStateOf(initialTab) }

    val tabs = listOf(
        "Workspace Stats" to Icons.Default.WorkspacePremium,
        "Settings & Sync" to Icons.Default.Settings
    )

    Scaffold(
        topBar = {
            TopAppBar(
                navigationIcon = {
                    IconButton(onClick = onBack, modifier = Modifier.testTag("back_button")) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                title = { Text("Profile & Settings", fontWeight = FontWeight.Bold) },
                actions = {
                    // Sync status indicator in top bar
                    IconButton(onClick = onOpenSyncDetails) {
                        BadgedBox(
                            badge = {
                                if (settingsState.failedSyncCount > 0) {
                                    Badge { Text("${settingsState.failedSyncCount}") }
                                } else if (settingsState.pendingSyncCount > 0) {
                                    Badge(containerColor = MaterialTheme.colorScheme.tertiary) {
                                        Text("${settingsState.pendingSyncCount}")
                                    }
                                }
                            }
                        ) {
                            Icon(
                                imageVector = if (settingsState.failedSyncCount > 0) Icons.Default.SyncProblem else Icons.Default.CloudSync,
                                contentDescription = "Cloud Sync",
                                tint = if (settingsState.failedSyncCount > 0) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary
                            )
                        }
                    }
                }
            )
        }
    ) { innerPadding ->
        Column(modifier = Modifier.fillMaxSize().padding(innerPadding)) {
            // Tab Row
            TabRow(
                selectedTabIndex = selectedTabIndex,
                containerColor = MaterialTheme.colorScheme.surface,
                contentColor = MaterialTheme.colorScheme.primary
            ) {
                tabs.forEachIndexed { index, (label, icon) ->
                    Tab(
                        selected = selectedTabIndex == index,
                        onClick = { selectedTabIndex = index },
                        text = {
                            Row(verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                                Icon(icon, contentDescription = null, modifier = Modifier.size(18.dp))
                                Spacer(modifier = Modifier.width(6.dp))
                                Text(label, fontWeight = if (selectedTabIndex == index) FontWeight.Bold else FontWeight.Normal)
                            }
                        }
                    )
                }
            }

            // Tab Content
            when (selectedTabIndex) {
                0 -> {
                    // Tab 0: Workspace Profile
                    ProfileScreen(
                        profileState = profileState,
                        onOpenSyncDetails = onOpenSyncDetails,
                        onUpdateEducationContext = { school, grade, subjects ->
                            profileViewModel.updateEducationContext(school, grade, subjects) {}
                        }
                    )
                }
                1 -> {
                    // Tab 1: Settings & Sync
                    SettingsScreen(
                        settingsState = settingsState,
                        viewModel = settingsViewModel,
                        onNavigateToAuth = onNavigateToAuth,
                        onTriggerSync = onTriggerSync,
                        onOpenSyncDetails = onOpenSyncDetails
                    )
                }
            }
        }
    }
}
