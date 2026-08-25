package com.example.ui.screens.schedule

import androidx.compose.animation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Check
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.ui.theme.tierPrimary

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ScheduleAIFlowScreen(
    viewModel: ScheduleViewModel,
    onBack: () -> Unit
) {
    // Quick Add form state
    var title by remember { mutableStateOf("") }
    var subject by remember { mutableStateOf("") }
    var type by remember { mutableStateOf("lecture") }
    var location by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }
    var validationError by remember { mutableStateOf<String?>(null) }

    Scaffold(
        topBar = {
            TopAppBar(
                navigationIcon = {
                    IconButton(onClick = onBack, modifier = Modifier.testTag("ai_schedule_back")) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                title = {
                    Column {
                        Text("Add Schedule Event", fontWeight = FontWeight.Bold)
                        Text("Manually schedule classes and exams", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f))
                    }
                }
            )
        }
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .padding(20.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Text("Event Details", style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold, color = tierPrimary()))

            validationError?.let { err ->
                Surface(color = MaterialTheme.colorScheme.errorContainer, shape = RoundedCornerShape(8.dp)) {
                    Text(err, color = MaterialTheme.colorScheme.onErrorContainer, modifier = Modifier.padding(10.dp), fontWeight = FontWeight.Bold)
                }
            }

            OutlinedTextField(
                value = title,
                onValueChange = { title = it },
                label = { Text("Event Title *") },
                placeholder = { Text("CS 101 Lecture") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true
            )

            OutlinedTextField(
                value = subject,
                onValueChange = { subject = it },
                label = { Text("Subject / Class Code *") },
                placeholder = { Text("CS 101") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true
            )

            Column {
                Text("Type", style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(top = 4.dp)) {
                    listOf("lecture", "exam", "study_session", "office_hours").forEach { t ->
                        FilterChip(
                            selected = type == t,
                            onClick = { type = t },
                            label = { Text(t.replace("_", " ").uppercase(), fontSize = 11.sp) }
                        )
                    }
                }
            }

            OutlinedTextField(
                value = location,
                onValueChange = { location = it },
                label = { Text("Location / Room") },
                placeholder = { Text("Gates Room 104") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true
            )

            OutlinedTextField(
                value = description,
                onValueChange = { description = it },
                label = { Text("Notes / Description") },
                modifier = Modifier.fillMaxWidth()
            )

            Spacer(modifier = Modifier.height(16.dp))

            Button(
                onClick = {
                    if (title.isBlank()) {
                        validationError = "Title is required"
                        return@Button
                    }
                    if (subject.isBlank()) {
                        validationError = "Subject is required"
                        return@Button
                    }
                    val now = System.currentTimeMillis()
                    viewModel.addScheduleItem(
                        title = title,
                        subject = subject,
                        type = type,
                        startTimeMillis = now + 3600000,
                        endTimeMillis = now + 7200000,
                        location = location,
                        description = description,
                        colorHex = "#3B82F6"
                    )
                    onBack()
                },
                modifier = Modifier.fillMaxWidth().height(50.dp),
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(containerColor = tierPrimary())
            ) {
                Icon(Icons.Default.Check, contentDescription = null)
                Spacer(modifier = Modifier.width(8.dp))
                Text("Save Event to Schedule", fontWeight = FontWeight.Bold)
            }
        }
    }
}
