package com.example.ui.screens.courses

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.example.ui.components.StuddyEmptyState
import com.example.ui.components.studdyPressScale
import com.example.ui.theme.tierAccent
import com.example.ui.theme.tierPrimary

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CoursesScreen(
    viewModel: CoursesViewModel,
    onBack: () -> Unit = {}
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()

    val snackbarHostState = remember { SnackbarHostState() }
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
                title = { Text("Academic Courses", fontWeight = FontWeight.Bold) }
            )
        },
        floatingActionButton = {
            ExtendedFloatingActionButton(
                onClick = {
                    val unEnrolled = state.courses.firstOrNull { !it.isEnrolled }
                    if (unEnrolled != null) {
                        viewModel.toggleEnrollment(unEnrolled)
                    }
                },
                icon = { Icon(Icons.Default.School, contentDescription = null) },
                text = { Text("Enroll Next Course", fontWeight = FontWeight.Bold) },
                containerColor = tierPrimary(),
                contentColor = androidx.compose.ui.graphics.Color.White,
                modifier = Modifier.testTag("courses_fab_enroll")
            )
        }
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .padding(horizontal = 16.dp)
        ) {
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                if (state.courses.isEmpty()) {
                    item {
                        StuddyEmptyState(
                            emoji = "📚",
                            title = "No courses yet",
                            message = "Tap “Enroll Next Course” below to add your first subject and start tracking progress."
                        )
                    }
                }
                items(state.courses) { course ->
                    Card(
                        modifier = Modifier
                            .fillMaxWidth()
                            .studdyPressScale(),
                        shape = RoundedCornerShape(20.dp),
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
                    ) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Surface(
                                    shape = RoundedCornerShape(8.dp),
                                    color = tierPrimary().copy(alpha = 0.15f)
                                ) {
                                    Text(
                                        text = course.code,
                                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                                        style = MaterialTheme.typography.titleSmall.copy(
                                            color = tierPrimary(),
                                            fontWeight = FontWeight.Bold
                                        )
                                    )
                                }

                                if (course.isEnrolled) {
                                    Surface(
                                        shape = RoundedCornerShape(10.dp),
                                        color = tierAccent().copy(alpha = 0.15f)
                                    ) {
                                        Text(
                                            text = "✓ Enrolled",
                                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                                            style = MaterialTheme.typography.labelMedium.copy(
                                                fontWeight = FontWeight.Bold,
                                                color = tierAccent()
                                            )
                                        )
                                    }
                                } else {
                                    Button(
                                        onClick = { viewModel.toggleEnrollment(course) },
                                        shape = RoundedCornerShape(10.dp),
                                        colors = ButtonDefaults.buttonColors(containerColor = tierPrimary())
                                    ) {
                                        Text("Enroll", fontWeight = FontWeight.Bold)
                                    }
                                }
                            }

                            Spacer(modifier = Modifier.height(8.dp))

                            Text(
                                text = course.title,
                                style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold)
                            )

                            Spacer(modifier = Modifier.height(4.dp))

                            Text(
                                text = course.description,
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)
                            )

                            if (course.isEnrolled) {
                                Spacer(modifier = Modifier.height(12.dp))
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Surface(
                                        shape = RoundedCornerShape(8.dp),
                                        color = tierAccent().copy(alpha = 0.15f)
                                    ) {
                                        Text(
                                            text = "${course.progressPercent}% complete",
                                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                                            style = MaterialTheme.typography.labelSmall.copy(
                                                fontWeight = FontWeight.Bold,
                                                color = tierAccent()
                                            )
                                        )
                                    }
                                    Spacer(modifier = Modifier.width(10.dp))
                                    LinearProgressIndicator(
                                        progress = { course.progressPercent / 100f },
                                        modifier = Modifier
                                            .weight(1f)
                                            .height(6.dp)
                                            .clip(RoundedCornerShape(3.dp)),
                                        color = tierAccent(),
                                        trackColor = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.1f)
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
