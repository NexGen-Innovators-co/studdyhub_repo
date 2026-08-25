package com.example.ui.screens.quizzes

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.example.ui.components.TactileSoundSystem
import kotlinx.coroutines.delay

/**
 * Explorer Speed Race — a live race against other kids online, powered by the same
 * live-quiz engine as the adult Kahoot rooms (LiveQuizSessionRunner handles lobby →
 * questions → podium). Includes safe watchdog timer and exit confirmation.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SpeedRaceScreen(
    viewModel: QuizzesViewModel,
    onBack: () -> Unit = {}
) {
    val context = LocalContext.current
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val session = uiState.activeLiveSession

    var showExitDialog by remember { mutableStateOf(false) }
    var matchTimeoutReached by remember { mutableStateOf(false) }

    // Intercept hardware back button to show confirmation
    BackHandler(enabled = true) {
        showExitDialog = true
    }

    // 15-second matchmaking watchdog timer
    LaunchedEffect(uiState.isLoading, session) {
        if (uiState.isLoading && session == null) {
            matchTimeoutReached = false
            delay(15000)
            if (uiState.isLoading && session == null) {
                matchTimeoutReached = true
            }
        } else {
            matchTimeoutReached = false
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = if (session?.isSpeedRace == true) "⚡ ${session.title}" else "⚡ Speed Race",
                        fontWeight = FontWeight.Bold
                    )
                },
                navigationIcon = {
                    IconButton(onClick = { showExitDialog = true }) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Exit race")
                    }
                },
                actions = {
                    IconButton(onClick = { showExitDialog = true }) {
                        Icon(Icons.Default.Close, contentDescription = "Leave Match", tint = MaterialTheme.colorScheme.error)
                    }
                }
            )
        }
    ) { innerPadding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            val activeSession = session
            if (activeSession != null) {
                LiveQuizSessionRunner(
                    session = activeSession,
                    viewModel = viewModel
                )
            } else if (uiState.isLoading) {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center
                ) {
                    CircularProgressIndicator(strokeWidth = 3.dp)
                    Spacer(modifier = Modifier.height(16.dp))
                    Text(
                        text = if (matchTimeoutReached) "Searching is taking longer…" else "Finding online opponents…",
                        fontWeight = FontWeight.Bold,
                        style = MaterialTheme.typography.titleMedium
                    )
                    Spacer(modifier = Modifier.height(6.dp))
                    Text(
                        text = if (matchTimeoutReached)
                            "You can keep waiting or jump into solo practice right away!"
                        else
                            "Professor Ollie is connecting you to live players!",
                        textAlign = TextAlign.Center,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )

                    if (matchTimeoutReached) {
                        Spacer(modifier = Modifier.height(20.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            OutlinedButton(
                                onClick = {
                                    viewModel.exitLiveSession()
                                    onBack()
                                },
                                shape = RoundedCornerShape(12.dp)
                            ) {
                                Text("Cancel")
                            }

                            Button(
                                onClick = {
                                    viewModel.exitLiveSession()
                                    viewModel.startSpeedRace(
                                        context = context,
                                        gameKey = "maths_quest",
                                        gameTitle = "Solo Speed Quest",
                                        isPublicLobby = false,
                                        difficulty = "easy",
                                        timeLimitSec = 15,
                                        questionCount = 5
                                    )
                                },
                                shape = RoundedCornerShape(12.dp)
                            ) {
                                Text("Practice Solo 🎮")
                            }
                        }
                    }
                }
            } else {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center
                ) {
                    Text("🏁", fontSize = 56.sp)
                    Spacer(modifier = Modifier.height(12.dp))
                    Text("No race is running right now.", fontWeight = FontWeight.Bold)
                    Text("Go back and tap Quick Race to find opponents!", textAlign = TextAlign.Center)
                    Spacer(modifier = Modifier.height(16.dp))
                    Button(onClick = onBack) { Text("Back") }
                }
            }
        }
    }

    if (showExitDialog) {
        AlertDialog(
            onDismissRequest = { showExitDialog = false },
            title = {
                Text("Leave Battle Arena?", fontWeight = FontWeight.Bold)
            },
            text = {
                Text("If you leave now, your current match or matchmaking search will be cancelled.")
            },
            confirmButton = {
                Button(
                    onClick = {
                        showExitDialog = false
                        viewModel.exitLiveSession()
                        onBack()
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error)
                ) {
                    Text("Leave Arena", color = Color.White)
                }
            },
            dismissButton = {
                TextButton(onClick = { showExitDialog = false }) {
                    Text("Stay & Play")
                }
            }
        )
    }
}
