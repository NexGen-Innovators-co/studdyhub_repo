package com.example.ui.screens.aichat

import androidx.compose.animation.*
import androidx.compose.foundation.*
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.example.data.local.entities.ChatSessionEntity
import com.example.ui.theme.tierAccent
import com.example.ui.theme.tierPrimary
import java.text.SimpleDateFormat
import java.util.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChatSessionsListScreen(
    viewModel: AIChatViewModel,
    onBack: () -> Unit,
    onSessionSelected: (sessionId: String) -> Unit
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    
    var searchQuery by remember { mutableStateOf("") }
    var sessionToDelete by remember { mutableStateOf<ChatSessionEntity?>(null) }
    var sessionToRename by remember { mutableStateOf<ChatSessionEntity?>(null) }
    var renameText by remember { mutableStateOf("") }
    var showRenameDialog by remember { mutableStateOf(false) }
    
    // Filter sessions based on search query
    val filteredSessions = remember(uiState.allSessions, searchQuery) {
        if (searchQuery.isEmpty()) {
            uiState.allSessions.sortedByDescending { it.createdAt }
        } else {
            uiState.allSessions
                .filter { it.title.contains(searchQuery, ignoreCase = true) }
                .sortedByDescending { it.createdAt }
        }
    }
    
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Chat Conversations", fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back")
                    }
                },
                actions = {
                    // Starts a draft chat and immediately opens it. The session is only
                    // persisted once the first message is sent (auto-titled from it).
                    IconButton(onClick = {
                        viewModel.createSession("")
                        onSessionSelected("")
                    }) {
                        Icon(Icons.Default.Add, "New Chat")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface
                )
            )
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            // Search Bar
            OutlinedTextField(
                value = searchQuery,
                onValueChange = { searchQuery = it },
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 12.dp)
                    .height(48.dp),
                placeholder = { Text("Search conversations...") },
                leadingIcon = { Icon(Icons.Default.Search, "Search") },
                trailingIcon = {
                    if (searchQuery.isNotEmpty()) {
                        IconButton(onClick = { searchQuery = "" }) {
                            Icon(Icons.Default.Clear, "Clear")
                        }
                    }
                },
                shape = RoundedCornerShape(12.dp),
                singleLine = true
            )
            
            // Sessions List
            if (filteredSessions.isEmpty()) {
                EmptySessionsState(
                    onCreateClick = {
                        viewModel.createSession("")
                        onSessionSelected("")
                    }
                )
            } else {
                LazyColumn(
                    modifier = Modifier
                        .fillMaxSize()
                        .weight(1f),
                    contentPadding = PaddingValues(horizontal = 8.dp, vertical = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    items(
                        items = filteredSessions,
                        key = { it.id }
                    ) { session ->
                        SessionListItem(
                            session = session,
                            isActive = session.id == uiState.currentSessionId,
                            onSelect = {
                                onSessionSelected(session.id)
                                viewModel.selectSession(session.id)
                            },
                            onDelete = { sessionToDelete = session },
                            onRename = {
                                sessionToRename = session
                                renameText = session.title
                                showRenameDialog = true
                            }
                        )
                    }
                }
            }
        }
    }
    
    // Delete Confirmation Dialog
    if (sessionToDelete != null) {
        DeleteSessionDialog(
            sessionTitle = sessionToDelete!!.title,
            onDismiss = { sessionToDelete = null },
            onConfirm = {
                viewModel.deleteSession(sessionToDelete!!.id)
                sessionToDelete = null
            }
        )
    }
    
    // Rename Session Dialog
    if (showRenameDialog && sessionToRename != null) {
        RenameSessionDialog(
            initialTitle = renameText,
            onDismiss = { 
                showRenameDialog = false
                sessionToRename = null
            },
            onConfirm = { newTitle ->
                viewModel.renameSession(sessionToRename!!.id, newTitle)
                showRenameDialog = false
                sessionToRename = null
            }
        )
    }
}

@Composable
fun SessionListItem(
    session: ChatSessionEntity,
    isActive: Boolean,
    onSelect: () -> Unit,
    onDelete: () -> Unit,
    onRename: () -> Unit
) {
    var showActions by remember { mutableStateOf(false) }
    
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .clickable(
                indication = ripple(),
                interactionSource = remember { MutableInteractionSource() }
            ) { onSelect() }
            .border(
                width = if (isActive) 2.dp else 0.dp,
                color = if (isActive) tierAccent() else Color.Transparent,
                shape = RoundedCornerShape(12.dp)
            ),
        color = if (isActive) 
            MaterialTheme.colorScheme.primaryContainer 
        else 
            MaterialTheme.colorScheme.surfaceVariant,
        shadowElevation = 4.dp
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Session Info
            Column(
                modifier = Modifier
                    .weight(1f)
                    .padding(end = 12.dp)
            ) {
                Text(
                    text = session.title,
                    fontSize = 16.sp,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    color = MaterialTheme.colorScheme.onSurface
                )
                
                Spacer(modifier = Modifier.height(4.dp))
                
                Text(
                    text = formatTimeAgo(session.lastMessageAt ?: session.createdAt),
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            
            // Action Menu
            Box {
                IconButton(
                    onClick = { showActions = !showActions },
                    modifier = Modifier.size(32.dp)
                ) {
                    Icon(
                        Icons.Default.MoreVert,
                        "Options",
                        tint = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                
                DropdownMenu(
                    expanded = showActions,
                    onDismissRequest = { showActions = false },
                    modifier = Modifier.width(160.dp)
                ) {
                    DropdownMenuItem(
                        text = { Text("Rename") },
                        onClick = {
                            onRename()
                            showActions = false
                        },
                        leadingIcon = { Icon(Icons.Default.Edit, null) }
                    )
                    
                    DropdownMenuItem(
                        text = { Text("Delete", color = MaterialTheme.colorScheme.error) },
                        onClick = {
                            onDelete()
                            showActions = false
                        },
                        leadingIcon = { Icon(Icons.Default.Delete, null, tint = MaterialTheme.colorScheme.error) }
                    )
                }
            }
        }
    }
}

@Composable
fun EmptySessionsState(onCreateClick: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Icon(
            Icons.Default.ChatBubble,
            "No conversations",
            modifier = Modifier.size(64.dp),
            tint = MaterialTheme.colorScheme.surfaceVariant
        )
        
        Spacer(modifier = Modifier.height(16.dp))
        
        Text(
            text = "No conversations yet",
            fontSize = 18.sp,
            fontWeight = FontWeight.SemiBold,
            color = MaterialTheme.colorScheme.onSurface
        )
        
        Spacer(modifier = Modifier.height(8.dp))
        
        Text(
            text = "Start a new chat to begin",
            fontSize = 14.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = androidx.compose.ui.text.style.TextAlign.Center
        )
        
        Spacer(modifier = Modifier.height(24.dp))
        
        Button(
            onClick = onCreateClick,
            modifier = Modifier
                .height(44.dp)
                .fillMaxWidth(0.6f),
            colors = ButtonDefaults.buttonColors(
                containerColor = tierPrimary()
            )
        ) {
            Icon(Icons.Default.Add, null, modifier = Modifier.size(18.dp))
            Spacer(modifier = Modifier.width(8.dp))
            Text("New Chat")
        }
    }
}

@Composable
fun DeleteSessionDialog(
    sessionTitle: String,
    onDismiss: () -> Unit,
    onConfirm: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Delete Chat?") },
        text = { 
            Text("Are you sure you want to delete \"$sessionTitle\"? This action cannot be undone.") 
        },
        confirmButton = {
            Button(
                onClick = onConfirm,
                colors = ButtonDefaults.buttonColors(
                    containerColor = MaterialTheme.colorScheme.error
                )
            ) {
                Text("Delete")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel")
            }
        }
    )
}

@Composable
fun RenameSessionDialog(
    initialTitle: String,
    onDismiss: () -> Unit,
    onConfirm: (String) -> Unit
) {
    var titleInput by remember { mutableStateOf(initialTitle) }
    
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Rename Chat") },
        text = {
            OutlinedTextField(
                value = titleInput,
                onValueChange = { titleInput = it },
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(8.dp),
                singleLine = true
            )
        },
        confirmButton = {
            Button(
                onClick = { onConfirm(titleInput) },
                enabled = titleInput.isNotEmpty()
            ) {
                Text("Rename")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel")
            }
        }
    )
}

fun formatTimeAgo(date: Long): String {
    val now = System.currentTimeMillis()
    val diff = now - date
    
    return when {
        diff < 60000 -> "Just now"
        diff < 3600000 -> "${diff / 60000}m ago"
        diff < 86400000 -> "${diff / 3600000}h ago"
        diff < 604800000 -> "${diff / 86400000}d ago"
        else -> {
            val sdf = SimpleDateFormat("MMM d", Locale.getDefault())
            sdf.format(Date(date))
        }
    }
}
