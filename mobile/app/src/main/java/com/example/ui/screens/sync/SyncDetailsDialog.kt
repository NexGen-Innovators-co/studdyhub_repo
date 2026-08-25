package com.example.ui.screens.sync

import android.content.Intent
import android.widget.Toast
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.example.data.local.entities.SyncQueueItemEntity
import com.example.ui.theme.tierPrimary
import java.text.SimpleDateFormat
import java.util.*

/**
 * Raw queue internals (entity UUIDs, serialized JSON payloads, backend error text) are useful
 * when debugging a sync bug but are noise — and a needless disclosure surface — for real users.
 * They're shown only in debug builds; release builds get plain-language status instead.
 */
private val SHOW_TECHNICAL_DETAILS = com.example.BuildConfig.DEBUG

/** Plain-language reason for a failed queue item, derived from the raw backend error. */
private fun friendlySyncReason(raw: String?): String =
    com.example.data.remote.BackendApiService.userFacingErrorMessage(raw)

/** Human label for an entity type, e.g. "social_post" -> "Post". */
private fun friendlyEntityLabel(entityType: String): String = when (entityType.lowercase()) {
    "note" -> "Note"
    "document" -> "Document"
    "flashcard" -> "Flashcard deck"
    "recording" -> "Recording"
    "podcast" -> "Podcast"
    "social_post" -> "Post"
    "quiz" -> "Quiz"
    "quiz_attempt" -> "Quiz attempt"
    "chat_session", "chat_message" -> "Chat"
    "course" -> "Course"
    else -> entityType.replace("_", " ").replaceFirstChar { it.uppercase() }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SyncDetailsDialog(
    syncQueueItems: List<SyncQueueItemEntity>,
    isSyncing: Boolean,
    onTriggerSync: () -> Unit,
    onRetryFailed: (() -> Unit)? = null,
    onDismiss: () -> Unit
) {
    val context = LocalContext.current
    val clipboardManager = LocalClipboardManager.current

    val pendingItems = syncQueueItems.filter { it.status == "PENDING" || it.status == "PROCESSING" }
    val failedItems = syncQueueItems.filter { it.status == "FAILED" }

    // Tab filter: 0 = ALL, 1 = FAILED (Needs Retry), 2 = PENDING (Waiting)
    var selectedFilterTab by remember { mutableIntStateOf(if (failedItems.isNotEmpty()) 1 else 0) }
    var showDiagnosticsModal by remember { mutableStateOf(false) }

    val displayedItems = remember(syncQueueItems, selectedFilterTab) {
        when (selectedFilterTab) {
            1 -> failedItems
            2 -> pendingItems
            else -> syncQueueItems
        }
    }

    if (showDiagnosticsModal) {
        SyncDiagnosticsReportModal(
            syncQueueItems = syncQueueItems,
            isSyncing = isSyncing,
            onRetryFailed = onRetryFailed,
            onDismiss = { showDiagnosticsModal = false }
        )
    }

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(
            usePlatformDefaultWidth = false
        )
    ) {
        Surface(
            modifier = Modifier
                .fillMaxSize()
                .padding(16.dp),
            shape = RoundedCornerShape(24.dp),
            color = MaterialTheme.colorScheme.background,
            tonalElevation = 6.dp
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(20.dp)
            ) {
                // Header
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = Icons.Default.CloudSync,
                            contentDescription = null,
                            tint = tierPrimary(),
                            modifier = Modifier.size(28.dp)
                        )
                        Spacer(modifier = Modifier.width(12.dp))
                        Text(
                            text = "Cloud Sync",
                            style = MaterialTheme.typography.titleLarge.copy(
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.onBackground
                            )
                        )
                    }

                    Row(verticalAlignment = Alignment.CenterVertically) {
                        FilledTonalButton(
                            onClick = { showDiagnosticsModal = true },
                            colors = ButtonDefaults.filledTonalButtonColors(
                                containerColor = if (failedItems.isNotEmpty()) MaterialTheme.colorScheme.errorContainer else MaterialTheme.colorScheme.surfaceVariant,
                                contentColor = if (failedItems.isNotEmpty()) MaterialTheme.colorScheme.onErrorContainer else MaterialTheme.colorScheme.onSurfaceVariant
                            ),
                            contentPadding = PaddingValues(horizontal = 10.dp, vertical = 6.dp),
                            shape = RoundedCornerShape(10.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Terminal,
                                contentDescription = "Diagnose",
                                modifier = Modifier.size(16.dp)
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = "Dev Log",
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }

                        IconButton(onClick = onDismiss) {
                            Icon(
                                imageVector = Icons.Default.Close,
                                contentDescription = "Close Dialog",
                                tint = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.6f)
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Overview Status Card
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f)
                    )
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column {
                                Text(
                                    text = "Sync status",
                                    style = MaterialTheme.typography.bodySmall.copy(
                                        color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.8f)
                                    )
                                )
                                Spacer(modifier = Modifier.height(4.dp))
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    val statusText = if (isSyncing) "Syncing your work..." else if (failedItems.isNotEmpty()) "Some items need another try" else "Everything is up to date"
                                    val statusColor = if (isSyncing) tierPrimary() else if (failedItems.isNotEmpty()) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary

                                    Box(
                                        modifier = Modifier
                                            .size(8.dp)
                                            .background(statusColor, RoundedCornerShape(50))
                                    )
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Text(
                                        text = statusText,
                                        style = MaterialTheme.typography.bodyMedium.copy(
                                            fontWeight = FontWeight.Bold,
                                            color = statusColor
                                        )
                                    )
                                }
                            }

                            Button(
                                onClick = onTriggerSync,
                                enabled = !isSyncing,
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = tierPrimary()
                                ),
                                contentPadding = PaddingValues(horizontal = 14.dp, vertical = 8.dp),
                                shape = RoundedCornerShape(10.dp)
                            ) {
                                if (isSyncing) {
                                    CircularProgressIndicator(
                                        modifier = Modifier.size(16.dp),
                                        color = Color.White,
                                        strokeWidth = 2.dp
                                    )
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Text("Syncing...", fontSize = 13.sp)
                                } else {
                                    Icon(
                                        imageVector = Icons.Default.Sync,
                                        contentDescription = null,
                                        modifier = Modifier.size(16.dp)
                                    )
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Text("Sync Now", fontSize = 13.sp)
                                }
                            }
                        }

                        Spacer(modifier = Modifier.height(16.dp))

                        // Stats counters (Clickable to switch view filters)
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            SyncStatBadge(
                                count = pendingItems.size,
                                label = "Waiting",
                                icon = Icons.Default.HourglassEmpty,
                                activeColor = tierPrimary(),
                                isSelected = selectedFilterTab == 2,
                                modifier = Modifier
                                    .weight(1f)
                                    .clickable { selectedFilterTab = if (selectedFilterTab == 2) 0 else 2 }
                            )

                            SyncStatBadge(
                                count = failedItems.size,
                                label = "Needs retry",
                                icon = Icons.Default.ErrorOutline,
                                activeColor = MaterialTheme.colorScheme.error,
                                isSelected = selectedFilterTab == 1,
                                modifier = Modifier
                                    .weight(1f)
                                    .clickable { selectedFilterTab = if (selectedFilterTab == 1) 0 else 1 }
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(14.dp))

                // Interactive Filter Chips Row (All / Needs Retry / Waiting)
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    FilterChip(
                        selected = selectedFilterTab == 0,
                        onClick = { selectedFilterTab = 0 },
                        label = { Text("All (${syncQueueItems.size})", fontSize = 12.sp, fontWeight = FontWeight.Bold) }
                    )
                    FilterChip(
                        selected = selectedFilterTab == 1,
                        onClick = { selectedFilterTab = 1 },
                        label = {
                            Text(
                                text = "Failed / Retry (${failedItems.size})",
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                color = if (failedItems.isNotEmpty() && selectedFilterTab != 1) MaterialTheme.colorScheme.error else Color.Unspecified
                            )
                        },
                        leadingIcon = if (failedItems.isNotEmpty()) {
                            { Icon(Icons.Default.Warning, contentDescription = null, modifier = Modifier.size(14.dp), tint = MaterialTheme.colorScheme.error) }
                        } else null
                    )
                    FilterChip(
                        selected = selectedFilterTab == 2,
                        onClick = { selectedFilterTab = 2 },
                        label = { Text("Waiting (${pendingItems.size})", fontSize = 12.sp, fontWeight = FontWeight.Bold) }
                    )
                }

                Spacer(modifier = Modifier.height(8.dp))

                // Queue List Area
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxWidth()
                ) {
                    if (displayedItems.isEmpty()) {
                        // Empty State Visual Panel
                        Column(
                            modifier = Modifier
                                .fillMaxSize()
                                .padding(16.dp),
                            verticalArrangement = Arrangement.Center,
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Icon(
                                imageVector = if (selectedFilterTab == 1) Icons.Default.CheckCircleOutline else Icons.Default.CloudDone,
                                contentDescription = "All Synced",
                                tint = if (selectedFilterTab == 1) Color(0xFF10B981) else tierPrimary().copy(alpha = 0.5f),
                                modifier = Modifier.size(64.dp)
                            )
                            Spacer(modifier = Modifier.height(12.dp))
                            Text(
                                text = when (selectedFilterTab) {
                                    1 -> "No Failed Items 🎉"
                                    2 -> "No Pending Items ⚡"
                                    else -> "Perfect Sync Harmony"
                                },
                                style = MaterialTheme.typography.titleMedium.copy(
                                    fontWeight = FontWeight.Bold,
                                    color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.85f)
                                )
                            )
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = when (selectedFilterTab) {
                                    1 -> "Every queued item was synced successfully without any errors."
                                    2 -> "There are currently no items waiting in the outgoing sync queue."
                                    else -> "All local creations and edits are securely synced to the Cloud."
                                },
                                style = MaterialTheme.typography.bodyMedium.copy(
                                    color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.6f)
                                ),
                                textAlign = androidx.compose.ui.text.style.TextAlign.Center
                            )
                        }
                    } else {
                        LazyColumn(
                            modifier = Modifier.fillMaxSize(),
                            verticalArrangement = Arrangement.spacedBy(12.dp),
                            contentPadding = PaddingValues(bottom = 16.dp)
                        ) {
                            items(displayedItems, key = { it.id }) { item ->
                                SyncQueueItemCard(
                                    item = item,
                                    onCopyItemData = {
                                        clipboardManager.setText(AnnotatedString(item.serializedData))
                                        Toast.makeText(context, "Item details copied", Toast.LENGTH_SHORT).show()
                                    },
                                    onCopyErrorDetails = item.errorMessage?.let { err ->
                                        {
                                            clipboardManager.setText(AnnotatedString(err))
                                            Toast.makeText(context, "Details copied", Toast.LENGTH_SHORT).show()
                                        }
                                    }
                                )
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))

                // Bottom Action buttons
                if (failedItems.isNotEmpty() && onRetryFailed != null) {
                    Button(
                        onClick = onRetryFailed,
                        modifier = Modifier.fillMaxWidth(),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = MaterialTheme.colorScheme.error,
                            contentColor = MaterialTheme.colorScheme.onError
                        ),
                        shape = RoundedCornerShape(12.dp),
                        contentPadding = PaddingValues(vertical = 12.dp)
                    ) {
                        Icon(imageVector = Icons.Default.Refresh, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Retry & Repair Failed Items (${failedItems.size})", fontWeight = FontWeight.Bold, fontSize = 14.sp)
                    }
                    Spacer(modifier = Modifier.height(8.dp))
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    OutlinedButton(
                        onClick = {
                            val report = generateSyncReport(syncQueueItems, isSyncing)
                            clipboardManager.setText(AnnotatedString(report))
                            Toast.makeText(context, "Sync report copied", Toast.LENGTH_LONG).show()
                        },
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(12.dp),
                        contentPadding = PaddingValues(vertical = 12.dp)
                    ) {
                        Icon(imageVector = Icons.Default.ContentCopy, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Copy Report", fontSize = 14.sp)
                    }

                    Button(
                        onClick = {
                            val report = generateSyncReport(syncQueueItems, isSyncing)
                            val intent = Intent(Intent.ACTION_SEND).apply {
                                type = "text/plain"
                                putExtra(Intent.EXTRA_SUBJECT, "StuddyHub sync report")
                                putExtra(Intent.EXTRA_TEXT, report)
                            }
                            context.startActivity(Intent.createChooser(intent, "Share sync report"))
                        },
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = if (failedItems.isNotEmpty()) MaterialTheme.colorScheme.error else tierPrimary()
                        ),
                        shape = RoundedCornerShape(12.dp),
                        contentPadding = PaddingValues(vertical = 12.dp)
                    ) {
                        Icon(imageVector = Icons.Default.BugReport, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Report Issue", fontSize = 14.sp)
                    }
                }
            }
        }
    }
}

@Composable
fun SyncStatBadge(
    count: Int,
    label: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    activeColor: Color,
    isSelected: Boolean = false,
    modifier: Modifier = Modifier
) {
    val containerColor = if (isSelected) activeColor.copy(alpha = 0.22f) else if (count > 0) activeColor.copy(alpha = 0.10f) else MaterialTheme.colorScheme.onSurface.copy(alpha = 0.04f)
    val contentColor = if (count > 0 || isSelected) activeColor else MaterialTheme.colorScheme.onSurface.copy(alpha = 0.4f)

    Row(
        modifier = modifier
            .clip(RoundedCornerShape(14.dp))
            .background(containerColor)
            .then(
                if (isSelected) Modifier.border(1.5.dp, activeColor, RoundedCornerShape(14.dp))
                else Modifier
            )
            .padding(horizontal = 12.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = contentColor,
            modifier = Modifier.size(18.dp)
        )
        Spacer(modifier = Modifier.width(8.dp))
        Column {
            Text(
                text = count.toString(),
                style = MaterialTheme.typography.titleMedium.copy(
                    fontWeight = FontWeight.Bold,
                    color = contentColor
                )
            )
            Text(
                text = label,
                style = MaterialTheme.typography.labelSmall.copy(
                    color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f)
                ),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }
    }
}

@Composable
fun SyncQueueItemCard(
    item: SyncQueueItemEntity,
    onCopyItemData: () -> Unit,
    onCopyErrorDetails: (() -> Unit)?
) {
    var expanded by remember { mutableStateOf(false) }

    val statusColor = when (item.status) {
        "FAILED" -> MaterialTheme.colorScheme.error
        "PROCESSING" -> tierPrimary()
        else -> Color(0xFFEAB308) // Amber/Gold for PENDING
    }

    val typeIcon = when (item.entityType.lowercase()) {
        "note" -> Icons.Default.Description
        "document" -> Icons.Default.CloudUpload
        "flashcard" -> Icons.Default.Style
        "recording" -> Icons.Default.Mic
        "podcast" -> Icons.Default.Campaign
        "social_post" -> Icons.Default.Public
        "quiz", "quiz_attempt" -> Icons.Default.Quiz
        "chat_session", "chat_message" -> Icons.Default.ChatBubbleOutline
        "course" -> Icons.Default.School
        else -> Icons.Default.SettingsSystemDaydream
    }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .border(
                width = 1.dp,
                color = if (item.status == "FAILED") MaterialTheme.colorScheme.error.copy(alpha = 0.3f) else MaterialTheme.colorScheme.onSurface.copy(alpha = 0.08f),
                shape = RoundedCornerShape(14.dp)
            ),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        ),
        shape = RoundedCornerShape(14.dp)
    ) {
        Column(
            modifier = Modifier.padding(14.dp)
        ) {
            // Header Row: Icon + entity details & status badge
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(
                    modifier = Modifier
                        .size(36.dp)
                        .background(statusColor.copy(alpha = 0.12f), RoundedCornerShape(10.dp)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = typeIcon,
                        contentDescription = item.entityType,
                        tint = statusColor,
                        modifier = Modifier.size(20.dp)
                    )
                }

                Spacer(modifier = Modifier.width(12.dp))

                Column(modifier = Modifier.weight(1f)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            text = if (SHOW_TECHNICAL_DETAILS) item.entityType.replace("_", " ").uppercase()
                            else friendlyEntityLabel(item.entityType),
                            style = MaterialTheme.typography.labelSmall.copy(
                                fontWeight = FontWeight.Bold,
                                color = statusColor
                            )
                        )
                        if (SHOW_TECHNICAL_DETAILS) {
                            Spacer(modifier = Modifier.width(6.dp))
                            Box(
                                modifier = Modifier
                                    .size(3.dp)
                                    .background(MaterialTheme.colorScheme.onSurface.copy(alpha = 0.3f), RoundedCornerShape(50))
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = item.operationType,
                                style = MaterialTheme.typography.labelSmall.copy(
                                    fontWeight = FontWeight.Bold,
                                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
                                )
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(2.dp))

                    if (SHOW_TECHNICAL_DETAILS) {
                        Text(
                            text = "ID: ${item.entityId}",
                            style = MaterialTheme.typography.bodySmall.copy(
                                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f),
                                fontFamily = FontFamily.Monospace
                            ),
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    } else {
                        Text(
                            text = when (item.status) {
                                "FAILED" -> "Couldn't sync yet — we'll keep trying"
                                "PROCESSING" -> "Syncing now"
                                else -> "Waiting to sync"
                            },
                            style = MaterialTheme.typography.bodySmall.copy(
                                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f)
                            ),
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                }

                // Status Badge
                Surface(
                    color = statusColor.copy(alpha = 0.15f),
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Text(
                        text = when {
                            SHOW_TECHNICAL_DETAILS && item.status == "FAILED" ->
                                "FAILED (${item.retryCount}/${item.maxRetries})"
                            SHOW_TECHNICAL_DETAILS -> item.status
                            item.status == "FAILED" -> "Retrying"
                            item.status == "PROCESSING" -> "Syncing"
                            else -> "Pending"
                        },
                        style = MaterialTheme.typography.labelSmall.copy(
                            color = statusColor,
                            fontWeight = FontWeight.Bold
                        ),
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                    )
                }
            }

            // Error section
            if (item.status == "FAILED" && !item.errorMessage.isNullOrEmpty()) {
                Spacer(modifier = Modifier.height(10.dp))
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(8.dp))
                        .background(MaterialTheme.colorScheme.error.copy(alpha = 0.08f))
                        .padding(10.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.weight(1f)) {
                            Icon(
                                imageVector = Icons.Default.Warning,
                                contentDescription = "Error",
                                tint = MaterialTheme.colorScheme.error,
                                modifier = Modifier.size(16.dp)
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = "Why it didn't sync",
                                style = MaterialTheme.typography.labelSmall.copy(
                                    fontWeight = FontWeight.Bold,
                                    color = MaterialTheme.colorScheme.error
                                )
                            )
                        }

                        if (SHOW_TECHNICAL_DETAILS && onCopyErrorDetails != null) {
                            Text(
                                text = "Copy Error",
                                style = MaterialTheme.typography.labelSmall.copy(
                                    fontWeight = FontWeight.Bold,
                                    color = tierPrimary()
                                ),
                                modifier = Modifier.clickable { onCopyErrorDetails() }
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(4.dp))

                    Text(
                        text = if (SHOW_TECHNICAL_DETAILS) item.errorMessage
                        else friendlySyncReason(item.errorMessage),
                        style = MaterialTheme.typography.bodySmall.copy(
                            color = MaterialTheme.colorScheme.error.copy(alpha = 0.9f)
                        )
                    )
                }
            }

            Spacer(modifier = Modifier.height(10.dp))

            // Footer info / toggle buttons
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                val formattedTime = SimpleDateFormat("MMM d, h:mm a", Locale.getDefault()).format(Date(item.createdAt))
                Text(
                    text = "Queued: $formattedTime",
                    style = MaterialTheme.typography.bodySmall.copy(
                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.4f)
                    )
                )

                Row(
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    if (SHOW_TECHNICAL_DETAILS) {
                        TextButton(
                            onClick = onCopyItemData,
                            contentPadding = PaddingValues(0.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.ContentCopy,
                                contentDescription = null,
                                modifier = Modifier.size(14.dp)
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("Copy Payload", fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
                        }

                        TextButton(
                            onClick = { expanded = !expanded },
                            contentPadding = PaddingValues(0.dp)
                        ) {
                            Icon(
                                imageVector = if (expanded) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                                contentDescription = null,
                                modifier = Modifier.size(14.dp)
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(if (expanded) "Hide JSON" else "View JSON", fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
                        }
                    }
                }
            }

            // Expanded JSON Payload view
            AnimatedVisibility(
                visible = SHOW_TECHNICAL_DETAILS && expanded,
                enter = fadeIn() + expandVertically(),
                exit = fadeOut() + shrinkVertically()
            ) {
                Spacer(modifier = Modifier.height(8.dp))
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .heightIn(max = 150.dp)
                        .clip(RoundedCornerShape(8.dp))
                        .background(MaterialTheme.colorScheme.onSurface.copy(alpha = 0.05f))
                        .border(1.dp, MaterialTheme.colorScheme.onSurface.copy(alpha = 0.08f), RoundedCornerShape(8.dp))
                        .padding(10.dp)
                ) {
                    val scrollState = rememberScrollState()
                    Text(
                        text = item.serializedData,
                        style = MaterialTheme.typography.bodySmall.copy(
                            fontFamily = FontFamily.Monospace,
                            fontSize = 11.sp,
                            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.8f)
                        ),
                        modifier = Modifier.verticalScroll(scrollState)
                    )
                }
            }
        }
    }
}

/**
 * Builds the shareable diagnostic report.
 *
 * The serialized payload is deliberately omitted outside debug builds: it contains the user's own
 * note/document/message content, and this report gets shared out to arbitrary apps and inboxes.
 * Item counts, timings and a sanitized failure reason are enough to triage a sync problem.
 */
private fun generateSyncReport(items: List<SyncQueueItemEntity>, isSyncing: Boolean): String {
    val timestamp = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault())
    val sb = StringBuilder()
    sb.append("# StuddyHub Sync Report\n")
    sb.append("Generated at: ${timestamp.format(Date())}\n")
    sb.append("Current state: ${if (isSyncing) "Syncing" else "Idle"}\n")

    val pending = items.filter { it.status == "PENDING" || it.status == "PROCESSING" }
    val failed = items.filter { it.status == "FAILED" }

    sb.append("Total items waiting: ${items.size}\n")
    sb.append("- Pending: ${pending.size}\n")
    sb.append("- Needs retry: ${failed.size}\n\n")

    sb.append("## Device\n")
    sb.append("- Android ${android.os.Build.VERSION.RELEASE} (API ${android.os.Build.VERSION.SDK_INT})\n")
    sb.append("- ${android.os.Build.MANUFACTURER} ${android.os.Build.MODEL}\n\n")

    if (failed.isNotEmpty()) {
        sb.append("## Items that couldn't sync\n")
        failed.forEachIndexed { index, item ->
            sb.append("${index + 1}. ${friendlyEntityLabel(item.entityType)}")
            if (SHOW_TECHNICAL_DETAILS) sb.append(" [${item.entityType} ${item.entityId}, ${item.operationType}]")
            sb.append("\n")
            sb.append("   - Attempts: ${item.retryCount}/${item.maxRetries}\n")
            sb.append("   - Reason: ${friendlySyncReason(item.errorMessage)}\n")
            sb.append("   - Queued: ${timestamp.format(Date(item.createdAt))}\n")
            if (SHOW_TECHNICAL_DETAILS) {
                sb.append("   - Raw error: ${item.errorMessage ?: "none"}\n")
                sb.append("   - Payload:\n```json\n${item.serializedData}\n```\n")
            }
            sb.append("\n")
        }
    }

    if (pending.isNotEmpty()) {
        sb.append("## Items still waiting\n")
        pending.forEachIndexed { index, item ->
            sb.append("${index + 1}. ${friendlyEntityLabel(item.entityType)}")
            if (SHOW_TECHNICAL_DETAILS) sb.append(" [${item.entityType} ${item.entityId}, ${item.operationType}]")
            sb.append("\n")
            sb.append("   - Queued: ${timestamp.format(Date(item.createdAt))}\n")
            if (SHOW_TECHNICAL_DETAILS) {
                sb.append("   - Payload:\n```json\n${item.serializedData}\n```\n")
            }
            sb.append("\n")
        }
    }

    return sb.toString()
}

/**
 * Full Diagnostic & Error Inspector Modal for Dev / Troubleshooting.
 * Displays formatted markdown logs, raw stacktraces, device information, and 1-tap copy buttons.
 */
@Composable
fun SyncDiagnosticsReportModal(
    syncQueueItems: List<SyncQueueItemEntity>,
    isSyncing: Boolean,
    onRetryFailed: (() -> Unit)? = null,
    onDismiss: () -> Unit
) {
    val context = LocalContext.current
    val clipboardManager = LocalClipboardManager.current
    var onlyErrors by remember { mutableStateOf(false) }

    val rawReport = remember(syncQueueItems, isSyncing, onlyErrors) {
        generateDevDiagnosticText(syncQueueItems, isSyncing, onlyErrors)
    }

    val failedCount = remember(syncQueueItems) { syncQueueItems.count { it.status == "FAILED" } }
    val pendingCount = remember(syncQueueItems) { syncQueueItems.count { it.status == "PENDING" || it.status == "PROCESSING" } }

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Surface(
            modifier = Modifier
                .fillMaxSize()
                .padding(12.dp),
            shape = RoundedCornerShape(20.dp),
            color = Color(0xFF0F172A), // Dark terminal aesthetic for Dev diagnostics
            tonalElevation = 8.dp
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(16.dp)
            ) {
                // Modal Top Bar
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Surface(
                            shape = CircleShape,
                            color = if (failedCount > 0) Color(0xFFEF4444).copy(alpha = 0.2f) else Color(0xFF10B981).copy(alpha = 0.2f),
                            modifier = Modifier.size(36.dp)
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                Icon(
                                    imageVector = Icons.Default.Terminal,
                                    contentDescription = null,
                                    tint = if (failedCount > 0) Color(0xFFF87171) else Color(0xFF34D399),
                                    modifier = Modifier.size(20.dp)
                                )
                            }
                        }
                        Column {
                            Text(
                                text = "Sync Diagnostic Inspector",
                                style = MaterialTheme.typography.titleMedium.copy(
                                    fontWeight = FontWeight.Bold,
                                    color = Color.White
                                )
                            )
                            Text(
                                text = "Dev Log • Copy & paste directly for diagnosis",
                                style = MaterialTheme.typography.bodySmall.copy(
                                    color = Color(0xFF94A3B8),
                                    fontSize = 11.sp
                                )
                            )
                        }
                    }

                    IconButton(onClick = onDismiss) {
                        Icon(
                            imageVector = Icons.Default.Close,
                            contentDescription = "Close",
                            tint = Color(0xFF94A3B8)
                        )
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))

                // Diagnostic Quick Counters & Filter toggle
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        Surface(
                            shape = RoundedCornerShape(6.dp),
                            color = if (failedCount > 0) Color(0xFF7F1D1D) else Color(0xFF1E293B)
                        ) {
                            Text(
                                text = "ERRORS: $failedCount",
                                color = if (failedCount > 0) Color(0xFFFCA5A5) else Color(0xFF94A3B8),
                                fontWeight = FontWeight.Bold,
                                fontSize = 11.sp,
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                            )
                        }
                        Surface(
                            shape = RoundedCornerShape(6.dp),
                            color = Color(0xFF1E293B)
                        ) {
                            Text(
                                text = "PENDING: $pendingCount",
                                color = Color(0xFF93C5FD),
                                fontWeight = FontWeight.Bold,
                                fontSize = 11.sp,
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                            )
                        }
                    }

                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        Text(
                            text = "Only Errors",
                            color = Color(0xFFCBD5E1),
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Medium
                        )
                        Switch(
                            checked = onlyErrors,
                            onCheckedChange = { onlyErrors = it },
                            colors = SwitchDefaults.colors(
                                checkedThumbColor = Color.White,
                                checkedTrackColor = Color(0xFFEF4444),
                                uncheckedThumbColor = Color(0xFF94A3B8),
                                uncheckedTrackColor = Color(0xFF334155)
                            ),
                            modifier = Modifier.scale(0.8f)
                        )
                    }
                }

                Spacer(modifier = Modifier.height(10.dp))

                // Scrollable Monospace Terminal Log Box
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(Color(0xFF030712))
                        .border(1.dp, Color(0xFF1F2937), RoundedCornerShape(12.dp))
                        .padding(12.dp)
                ) {
                    val scrollState = rememberScrollState()
                    Text(
                        text = rawReport,
                        style = MaterialTheme.typography.bodySmall.copy(
                            fontFamily = FontFamily.Monospace,
                            fontSize = 11.sp,
                            color = Color(0xFFE2E8F0),
                            lineHeight = 16.sp
                        ),
                        modifier = Modifier
                            .fillMaxSize()
                            .verticalScroll(scrollState)
                    )
                }

                Spacer(modifier = Modifier.height(14.dp))

                // Action Buttons (Copy Dev Report & Close)
                if (failedCount > 0 && onRetryFailed != null) {
                    Button(
                        onClick = onRetryFailed,
                        modifier = Modifier.fillMaxWidth(),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = MaterialTheme.colorScheme.error,
                            contentColor = MaterialTheme.colorScheme.onError
                        ),
                        shape = RoundedCornerShape(12.dp),
                        contentPadding = PaddingValues(vertical = 12.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Refresh,
                            contentDescription = null,
                            modifier = Modifier.size(18.dp)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "Retry & Repair All Failed ($failedCount)",
                            fontWeight = FontWeight.Bold,
                            fontSize = 13.sp
                        )
                    }
                    Spacer(modifier = Modifier.height(8.dp))
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Button(
                        onClick = {
                            clipboardManager.setText(AnnotatedString(rawReport))
                            Toast.makeText(context, "📋 Diagnostic dev log copied to clipboard!", Toast.LENGTH_SHORT).show()
                        },
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = Color(0xFF3B82F6),
                            contentColor = Color.White
                        ),
                        shape = RoundedCornerShape(12.dp),
                        contentPadding = PaddingValues(vertical = 12.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.ContentCopy,
                            contentDescription = null,
                            modifier = Modifier.size(18.dp)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "Copy Diagnostic Log",
                            fontWeight = FontWeight.Bold,
                            fontSize = 13.sp
                        )
                    }

                    OutlinedButton(
                        onClick = {
                            val intent = Intent(Intent.ACTION_SEND).apply {
                                type = "text/plain"
                                putExtra(Intent.EXTRA_SUBJECT, "StuddyHub Dev Diagnostic Report")
                                putExtra(Intent.EXTRA_TEXT, rawReport)
                            }
                            context.startActivity(Intent.createChooser(intent, "Share Dev Log"))
                        },
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.outlinedButtonColors(
                            contentColor = Color(0xFFE2E8F0)
                        ),
                        border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFF475569)),
                        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Share,
                            contentDescription = "Share",
                            modifier = Modifier.size(18.dp)
                        )
                    }
                }
            }
        }
    }
}

/**
 * Builds developer-grade diagnostic output with exact error stack traces, JSON payload previews,
 * and device network/runtime metadata.
 */
private fun generateDevDiagnosticText(
    items: List<SyncQueueItemEntity>,
    isSyncing: Boolean,
    onlyErrors: Boolean
): String {
    val timestamp = SimpleDateFormat("yyyy-MM-dd HH:mm:ss.SSS", Locale.getDefault())
    val sb = StringBuilder()
    sb.append("=== STUDDYHUB CLOUD SYNC DIAGNOSTIC REPORT ===\n")
    sb.append("GeneratedAt: ${timestamp.format(Date())}\n")
    sb.append("SyncEngineState: ${if (isSyncing) "ACTIVE_SYNCING" else "IDLE"}\n")
    sb.append("Device: ${android.os.Build.MANUFACTURER} ${android.os.Build.MODEL} (Android ${android.os.Build.VERSION.RELEASE}, API ${android.os.Build.VERSION.SDK_INT})\n")
    sb.append("TotalInQueue: ${items.size}\n")
    sb.append("FailedCount: ${items.count { it.status == "FAILED" }}\n")
    sb.append("PendingCount: ${items.count { it.status == "PENDING" || it.status == "PROCESSING" }}\n")
    sb.append("==============================================\n\n")

    val targetItems = if (onlyErrors) items.filter { it.status == "FAILED" } else items

    if (targetItems.isEmpty()) {
        sb.append(if (onlyErrors) ">> No failed queue items found. All items synced successfully or are waiting.\n" else ">> Queue is empty. No pending or failed records.\n")
        return sb.toString()
    }

    targetItems.forEachIndexed { idx, item ->
        sb.append("[ITEM #${idx + 1}] ID: ${item.id}\n")
        sb.append("  Status:        ${item.status}\n")
        sb.append("  EntityType:    ${item.entityType}\n")
        sb.append("  EntityId:      ${item.entityId}\n")
        sb.append("  Operation:     ${item.operationType}\n")
        sb.append("  Retries:       ${item.retryCount} / ${item.maxRetries}\n")
        sb.append("  CreatedAt:     ${timestamp.format(Date(item.createdAt))}\n")

        if (!item.errorMessage.isNullOrBlank()) {
            sb.append("  >>> ERROR_DETAILS <<<\n")
            sb.append("  RawError:      ${item.errorMessage}\n")
            sb.append("  ParsedReason:  ${friendlySyncReason(item.errorMessage)}\n")
        }

        sb.append("  >>> PAYLOAD_JSON <<<\n")
        sb.append("  ${item.serializedData}\n")
        sb.append("----------------------------------------------\n\n")
    }

    return sb.toString()
}
