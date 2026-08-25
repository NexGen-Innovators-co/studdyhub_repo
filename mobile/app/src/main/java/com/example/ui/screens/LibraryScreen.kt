package com.example.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.MenuBook
import androidx.compose.material.icons.filled.CloudUpload
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.School
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CenterAlignedTopAppBar
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.example.ui.components.StuddyListCard
import com.example.ui.components.StuddySectionHeader
import com.example.ui.components.StuddyTileCard
import com.example.ui.theme.tierAccent
import com.example.ui.theme.tierPrimary
import com.example.ui.theme.tierSecondary
import com.example.ui.theme.tierTertiary

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LibraryScreen(
    onNavigateToNotes: () -> Unit,
    onNavigateToDocuments: () -> Unit,
    onNavigateToRecordings: () -> Unit,
    onNavigateToCourses: () -> Unit,
    onNavigateToUploadDocument: () -> Unit
) {
    Scaffold(
        topBar = {
            CenterAlignedTopAppBar(
                title = { Text("Library", fontWeight = FontWeight.ExtraBold) }
            )
        }
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(20.dp)
        ) {
            // Tonal banner (not a gradient hero) — Library's real content is the
            // collection grid below, so the top is a quiet utility strip, not a poster.
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.55f)
                )
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        imageVector = Icons.AutoMirrored.Filled.MenuBook,
                        contentDescription = null,
                        tint = tierPrimary(),
                        modifier = Modifier.size(28.dp)
                    )
                    Spacer(modifier = Modifier.width(12.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = "Your study library",
                            style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold)
                        )
                        Text(
                            text = "Notes, documents, lectures, and courses in one place.",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.65f)
                        )
                    }
                    TextButton(onClick = onNavigateToUploadDocument) {
                        Icon(
                            imageVector = Icons.Default.CloudUpload,
                            contentDescription = null,
                            modifier = Modifier.size(18.dp)
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("Upload", fontWeight = FontWeight.Bold)
                    }
                }
            }

            StuddySectionHeader(
                title = "Collections",
                subtitle = "Browse"
            )

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                StuddyTileCard(
                    title = "Notes",
                    subtitle = "Organize study notes",
                    icon = Icons.AutoMirrored.Filled.MenuBook,
                    accent = tierPrimary(),
                    modifier = Modifier.weight(1f),
                    onClick = onNavigateToNotes
                )
                StuddyTileCard(
                    title = "Documents",
                    subtitle = "Import PDFs & slides",
                    icon = Icons.Default.Description,
                    accent = tierTertiary(),
                    modifier = Modifier.weight(1f),
                    onClick = onNavigateToDocuments
                )
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                StuddyTileCard(
                    title = "Recordings",
                    subtitle = "Listen to lectures",
                    icon = Icons.Default.Mic,
                    accent = tierAccent(),
                    modifier = Modifier.weight(1f),
                    onClick = onNavigateToRecordings
                )
                StuddyTileCard(
                    title = "Courses",
                    subtitle = "Track your subjects",
                    icon = Icons.Default.School,
                    accent = tierSecondary(),
                    modifier = Modifier.weight(1f),
                    onClick = onNavigateToCourses
                )
            }

            StuddySectionHeader(
                title = "Import",
                subtitle = "Grow your library"
            )
            StuddyListCard(
                title = "Import a new document",
                subtitle = "Upload PDFs or add study material from your lectures.",
                icon = Icons.Default.CloudUpload,
                accent = tierPrimary(),
                trailing = "Import",
                onClick = onNavigateToUploadDocument
            )

            // Clearance so the last card isn't hidden behind the floating pill nav.
            Spacer(modifier = Modifier.height(80.dp))
        }
    }
}
