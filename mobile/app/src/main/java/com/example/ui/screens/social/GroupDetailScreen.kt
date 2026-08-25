package com.example.ui.screens.social

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import androidx.compose.animation.*
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.example.ui.theme.tierPrimary
import com.example.ui.theme.tierTertiary

enum class GroupDetailTab(val title: String) {
    DISCUSSIONS("Discussions"),
    RESOURCES("Resources"),
    SESSIONS("Study Sessions"),
    MEMBERS("Members")
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GroupDetailScreen(
    groupId: String,
    viewModel: SocialViewModel,
    onBack: () -> Unit
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val group = state.groups.find { it.id == groupId } ?: SocialGroup(
        id = groupId,
        name = "Study Group",
        description = "Collaborative study circle",
        memberCount = 12,
        category = "General",
        isJoined = true
    )

    var activeTab by remember { mutableStateOf(GroupDetailTab.DISCUSSIONS) }
    var showAddResourceModal by remember { mutableStateOf(false) }
    var showScheduleSessionModal by remember { mutableStateOf(false) }

    val context = LocalContext.current
    val groupMessages = state.groupMessages.filter { it.groupId == groupId }
    val groupResources = state.groupResources.filter { it.groupId == groupId }
    val groupEvents = state.groupEvents.filter { it.groupId == groupId }

    val snackbarHostState = remember { SnackbarHostState() }
    LaunchedEffect(state.userMessage) {
        state.userMessage?.let { msg ->
            snackbarHostState.showSnackbar(msg)
            viewModel.clearUserMessage()
        }
    }

    LaunchedEffect(groupId) {
        viewModel.fetchGroupMessages(groupId)
        viewModel.fetchGroupEvents(groupId)
    }

    val catColor = categoryColor(group.category)

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        group.name,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        fontWeight = FontWeight.Bold
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onBack, modifier = Modifier.testTag("group_detail_back")) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    IconButton(onClick = {
                        val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                        clipboard.setPrimaryClip(ClipData.newPlainText("Group Link", "https://studdyhub.ai/group/${group.id}"))
                    }) {
                        Icon(Icons.Default.Share, contentDescription = "Share Group")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface
                )
            )
        },
        bottomBar = {
            if (activeTab == GroupDetailTab.DISCUSSIONS && group.isJoined) {
                GroupChatInputBar(onSendMessage = { text ->
                    viewModel.sendGroupMessage(groupId, text)
                })
            }
        }
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            // Group Banner Card
            GroupBannerCard(
                group = group,
                catColor = catColor,
                onToggleJoin = { viewModel.toggleJoinGroup(group.id) }
            )

            // Tabs Header
            ScrollableTabRow(
                selectedTabIndex = activeTab.ordinal,
                edgePadding = 16.dp,
                containerColor = MaterialTheme.colorScheme.surface,
                contentColor = tierPrimary()
            ) {
                GroupDetailTab.values().forEach { tab ->
                    Tab(
                        selected = activeTab == tab,
                        onClick = { activeTab = tab },
                        text = {
                            Text(
                                tab.title,
                                fontWeight = if (activeTab == tab) FontWeight.Bold else FontWeight.Medium,
                                fontSize = 13.sp
                            )
                        }
                    )
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Tab Content
            when (activeTab) {
                GroupDetailTab.DISCUSSIONS -> GroupDiscussionsSection(
                    messages = groupMessages,
                    isJoined = group.isJoined,
                    onLikeMessage = { viewModel.toggleLikeGroupMessage(it) }
                )
                GroupDetailTab.RESOURCES -> GroupResourcesSection(
                    resources = groupResources,
                    isJoined = group.isJoined,
                    onAddResource = { showAddResourceModal = true }
                )
                GroupDetailTab.SESSIONS -> GroupSessionsSection(
                    events = groupEvents,
                    isJoined = group.isJoined,
                    onRSVP = { viewModel.toggleRSVPGroupEvent(it) },
                    onScheduleSession = { showScheduleSessionModal = true }
                )
                GroupDetailTab.MEMBERS -> GroupMembersSection(
                    group = group,
                    peers = state.peers,
                    onToggleFollow = { viewModel.toggleFollowPeer(it) }
                )
            }
        }
    }

    if (showAddResourceModal) {
        AddResourceDialog(
            onDismiss = { showAddResourceModal = false },
            onUpload = { title, fileType ->
                viewModel.addGroupResource(groupId, title, fileType)
                showAddResourceModal = false
            }
        )
    }

    if (showScheduleSessionModal) {
        ScheduleSessionDialog(
            onDismiss = { showScheduleSessionModal = false },
            onSchedule = { title, dateTime, location ->
                viewModel.scheduleGroupEvent(groupId, title, dateTime, location)
                showScheduleSessionModal = false
            }
        )
    }
}

@Composable
private fun GroupBannerCard(
    group: SocialGroup,
    catColor: Color,
    onToggleJoin: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.45f))
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Surface(
                    shape = RoundedCornerShape(8.dp),
                    color = catColor.copy(alpha = 0.15f)
                ) {
                    Text(
                        group.category,
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
                        style = MaterialTheme.typography.labelSmall.copy(color = catColor, fontWeight = FontWeight.Bold)
                    )
                }

                Button(
                    onClick = onToggleJoin,
                    colors = ButtonDefaults.buttonColors(
                        containerColor = if (group.isJoined) MaterialTheme.colorScheme.surfaceVariant else tierPrimary(),
                        contentColor = if (group.isJoined) MaterialTheme.colorScheme.onSurface else Color.White
                    ),
                    shape = RoundedCornerShape(12.dp),
                    contentPadding = PaddingValues(horizontal = 16.dp, vertical = 6.dp),
                    modifier = Modifier.height(36.dp)
                ) {
                    Icon(
                        if (group.isJoined) Icons.Default.Check else Icons.Default.GroupAdd,
                        contentDescription = null,
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(if (group.isJoined) "Joined" else "Join Group", fontWeight = FontWeight.Bold, fontSize = 12.sp)
                }
            }

            Spacer(modifier = Modifier.height(10.dp))
            Text(group.name, fontWeight = FontWeight.ExtraBold, style = MaterialTheme.typography.titleLarge)
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                group.description,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)
            )

            Spacer(modifier = Modifier.height(12.dp))
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    Icon(Icons.Default.People, contentDescription = null, modifier = Modifier.size(16.dp), tint = tierPrimary())
                    Text("${group.memberCount} active members", style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold)
                }

                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    Icon(Icons.Default.Forum, contentDescription = null, modifier = Modifier.size(16.dp), tint = tierTertiary())
                    Text("Daily Activity", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f))
                }
            }
        }
    }
}

// ─── Discussions Tab ─────────────────────────────────────────────────────────

@Composable
private fun GroupDiscussionsSection(
    messages: List<GroupMessage>,
    isJoined: Boolean,
    onLikeMessage: (String) -> Unit
) {
    if (messages.isEmpty()) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(32.dp),
            contentAlignment = Alignment.Center
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Icon(Icons.Default.Forum, contentDescription = null, modifier = Modifier.size(48.dp), tint = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.3f))
                Spacer(modifier = Modifier.height(12.dp))
                Text("No discussions yet", fontWeight = FontWeight.Bold)
                Text("Be the first to post a question or greeting!", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f))
            }
        }
    } else {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 8.dp, bottom = 80.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            items(messages, key = { it.id }) { msg ->
                GroupMessageCard(msg = msg, onLike = { onLikeMessage(msg.id) })
            }
        }
    }
}

@Composable
private fun GroupMessageCard(msg: GroupMessage, onLike: () -> Unit) {
    val isMe = msg.authorName == "You" || msg.authorName == "Me"
    Surface(
        shape = RoundedCornerShape(16.dp),
        color = if (isMe) tierPrimary().copy(alpha = 0.08f) else MaterialTheme.colorScheme.surface,
        border = BorderStroke(0.8.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.12f)),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Box(
                        modifier = Modifier
                            .size(32.dp)
                            .clip(CircleShape)
                            .background(if (msg.authorRole == "Admin") tierTertiary() else tierPrimary()),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(msg.authorName.take(1), color = Color.White, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                    }

                    Column {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                            Text(msg.authorName, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                            if (msg.authorRole == "Admin") {
                                Surface(shape = RoundedCornerShape(4.dp), color = tierTertiary().copy(alpha = 0.2f)) {
                                    Text("ADMIN", modifier = Modifier.padding(horizontal = 4.dp, vertical = 1.dp), fontSize = 8.sp, fontWeight = FontWeight.Bold, color = tierTertiary())
                                }
                            }
                        }
                        Text(msg.time, fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f))
                    }
                }

                Row(verticalAlignment = Alignment.CenterVertically) {
                    IconButton(onClick = onLike, modifier = Modifier.size(28.dp)) {
                        Icon(
                            if (msg.isLiked) Icons.Default.Favorite else Icons.Default.FavoriteBorder,
                            contentDescription = "Like",
                            tint = if (msg.isLiked) Color(0xFFE53935) else MaterialTheme.colorScheme.onSurface.copy(alpha = 0.4f),
                            modifier = Modifier.size(16.dp)
                        )
                    }
                    if (msg.likesCount > 0) {
                        Text("${msg.likesCount}", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f))
                    }
                }
            }

            Spacer(modifier = Modifier.height(8.dp))
            Text(msg.text, style = MaterialTheme.typography.bodyMedium)
        }
    }
}

@Composable
private fun GroupChatInputBar(onSendMessage: (String) -> Unit) {
    var text by remember { mutableStateOf("") }

    Surface(
        shadowElevation = 8.dp,
        color = MaterialTheme.colorScheme.surface,
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier
                .padding(horizontal = 12.dp, vertical = 8.dp)
                .navigationBarsPadding(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            OutlinedTextField(
                value = text,
                onValueChange = { text = it },
                placeholder = { Text("Ask a question or post to group...", fontSize = 13.sp) },
                modifier = Modifier.weight(1f),
                shape = RoundedCornerShape(20.dp),
                maxLines = 3,
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = tierPrimary(),
                    unfocusedBorderColor = MaterialTheme.colorScheme.outline.copy(alpha = 0.2f)
                )
            )

            IconButton(
                onClick = {
                    if (text.isNotBlank()) {
                        onSendMessage(text)
                        text = ""
                    }
                },
                enabled = text.isNotBlank(),
                modifier = Modifier
                    .clip(CircleShape)
                    .background(if (text.isNotBlank()) tierPrimary() else MaterialTheme.colorScheme.surfaceVariant)
            ) {
                Icon(
                    Icons.AutoMirrored.Filled.Send,
                    contentDescription = "Send",
                    tint = if (text.isNotBlank()) Color.White else MaterialTheme.colorScheme.onSurface.copy(alpha = 0.4f)
                )
            }
        }
    }
}

// ─── Resources Tab ───────────────────────────────────────────────────────────

@Composable
private fun GroupResourcesSection(
    resources: List<GroupResource>,
    isJoined: Boolean,
    onAddResource: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 16.dp)
        ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text("Shared Documents & Notes", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleMedium)
            Button(
                onClick = onAddResource,
                enabled = isJoined,
                colors = ButtonDefaults.buttonColors(containerColor = tierPrimary()),
                shape = RoundedCornerShape(10.dp),
                contentPadding = PaddingValues(horizontal = 12.dp, vertical = 4.dp)
            ) {
                Icon(Icons.Default.CloudUpload, contentDescription = null, modifier = Modifier.size(16.dp))
                Spacer(modifier = Modifier.width(4.dp))
                Text("Share File", fontSize = 11.sp, fontWeight = FontWeight.Bold)
            }
        }

        Spacer(modifier = Modifier.height(10.dp))

        if (resources.isEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(32.dp),
                contentAlignment = Alignment.Center
            ) {
                Text("No study materials shared yet.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f))
            }
        } else {
            LazyColumn(
                verticalArrangement = Arrangement.spacedBy(10.dp),
                contentPadding = PaddingValues(bottom = 32.dp)
            ) {
                items(resources, key = { it.id }) { res ->
                    GroupResourceCard(res = res)
                }
            }
        }
    }
}

@Composable
private fun GroupResourceCard(res: GroupResource) {
    Card(
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        border = BorderStroke(0.8.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.12f)),
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier.padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Box(
                modifier = Modifier
                    .size(42.dp)
                    .clip(RoundedCornerShape(10.dp))
                    .background(
                        when (res.fileType) {
                            "PDF" -> Color(0xFFE53935).copy(alpha = 0.15f)
                            "Notes" -> tierPrimary().copy(alpha = 0.15f)
                            "Flashcards" -> tierTertiary().copy(alpha = 0.15f)
                            else -> Color(0xFF4CAF50).copy(alpha = 0.15f)
                        }
                    ),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    when (res.fileType) {
                        "PDF" -> Icons.Default.PictureAsPdf
                        "Notes" -> Icons.Default.Description
                        "Flashcards" -> Icons.Default.Style
                        else -> Icons.Default.Code
                    },
                    contentDescription = null,
                    tint = when (res.fileType) {
                        "PDF" -> Color(0xFFE53935)
                        "Notes" -> tierPrimary()
                        "Flashcards" -> tierTertiary()
                        else -> Color(0xFF2E7D32)
                    },
                    modifier = Modifier.size(22.dp)
                )
            }

            Column(modifier = Modifier.weight(1f)) {
                Text(res.title, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.bodyMedium, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text("Uploaded by ${res.uploadedBy} • ${res.fileSize} • ${res.date}", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f))
            }

            IconButton(onClick = { /* Simulated download */ }) {
                Icon(Icons.Default.Download, contentDescription = "Download File", tint = tierPrimary())
            }
        }
    }
}

// ─── Study Sessions Tab ──────────────────────────────────────────────────────

@Composable
private fun GroupSessionsSection(
    events: List<GroupEvent>,
    isJoined: Boolean,
    onRSVP: (String) -> Unit,
    onScheduleSession: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 16.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text("Upcoming Study Sessions", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleMedium)
            Button(
                onClick = onScheduleSession,
                enabled = isJoined,
                colors = ButtonDefaults.buttonColors(containerColor = tierPrimary()),
                shape = RoundedCornerShape(10.dp),
                contentPadding = PaddingValues(horizontal = 12.dp, vertical = 4.dp)
            ) {
                Icon(Icons.Default.Event, contentDescription = null, modifier = Modifier.size(16.dp))
                Spacer(modifier = Modifier.width(4.dp))
                Text("New Session", fontSize = 11.sp, fontWeight = FontWeight.Bold)
            }
        }

        Spacer(modifier = Modifier.height(10.dp))

        if (events.isEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(32.dp),
                contentAlignment = Alignment.Center
            ) {
                Text("No study sessions scheduled yet.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f))
            }
        } else {
            LazyColumn(
                verticalArrangement = Arrangement.spacedBy(12.dp),
                contentPadding = PaddingValues(bottom = 32.dp)
            ) {
                items(events, key = { it.id }) { ev ->
                    GroupEventCard(ev = ev, onRSVP = { onRSVP(ev.id) })
                }
            }
        }
    }
}

@Composable
private fun GroupEventCard(ev: GroupEvent, onRSVP: () -> Unit) {
    Card(
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        border = BorderStroke(0.8.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.12f)),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Text(ev.title, fontWeight = FontWeight.ExtraBold, style = MaterialTheme.typography.titleSmall)
            Spacer(modifier = Modifier.height(6.dp))

            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Icon(Icons.Default.AccessTime, contentDescription = null, modifier = Modifier.size(14.dp), tint = tierPrimary())
                Text(ev.dateTime, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.8f))
            }
            Spacer(modifier = Modifier.height(4.dp))

            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Icon(Icons.Default.LocationOn, contentDescription = null, modifier = Modifier.size(14.dp), tint = tierTertiary())
                Text(ev.location, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.8f))
            }

            Spacer(modifier = Modifier.height(12.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("${ev.attendeesCount} peers attending", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f))

                OutlinedButton(
                    onClick = onRSVP,
                    shape = RoundedCornerShape(10.dp),
                    colors = ButtonDefaults.outlinedButtonColors(
                        containerColor = if (ev.isAttending) tierPrimary().copy(alpha = 0.12f) else Color.Transparent,
                        contentColor = tierPrimary()
                    ),
                    contentPadding = PaddingValues(horizontal = 14.dp, vertical = 4.dp)
                ) {
                    Icon(
                        if (ev.isAttending) Icons.Default.Check else Icons.Default.Add,
                        contentDescription = null,
                        modifier = Modifier.size(14.dp)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(if (ev.isAttending) "Attending" else "RSVP", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

// ─── Members Tab ─────────────────────────────────────────────────────────────

@Composable
private fun GroupMembersSection(
    group: SocialGroup,
    peers: List<PeerUser>,
    onToggleFollow: (String) -> Unit
) {
    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
        contentPadding = PaddingValues(bottom = 32.dp)
    ) {
        item {
            Text("Group Members (${group.memberCount})", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleMedium)
            Spacer(modifier = Modifier.height(4.dp))
        }

        items(peers) { peer ->
            Card(
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f)),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier.padding(12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .size(40.dp)
                            .clip(CircleShape)
                            .background(tierPrimary()),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(peer.name.take(1), color = Color.White, fontWeight = FontWeight.Bold)
                    }

                    Column(modifier = Modifier.weight(1f)) {
                        Text(peer.name, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                        Text(peer.school, fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f))
                    }

                    Button(
                        onClick = { onToggleFollow(peer.id) },
                        colors = ButtonDefaults.buttonColors(
                            containerColor = if (peer.isFollowing) MaterialTheme.colorScheme.surfaceVariant else tierPrimary(),
                            contentColor = if (peer.isFollowing) MaterialTheme.colorScheme.onSurface else Color.White
                        ),
                        shape = RoundedCornerShape(8.dp),
                        contentPadding = PaddingValues(horizontal = 10.dp, vertical = 2.dp),
                        modifier = Modifier.height(30.dp)
                    ) {
                        Text(if (peer.isFollowing) "Following" else "Follow", fontSize = 10.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}

// ─── Dialogs ─────────────────────────────────────────────────────────────────

@Composable
private fun AddResourceDialog(
    onDismiss: () -> Unit,
    onUpload: (title: String, fileType: String) -> Unit
) {
    var title by remember { mutableStateOf("") }
    var fileType by remember { mutableStateOf("PDF") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Share Study Resource", fontWeight = FontWeight.Bold) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedTextField(
                    value = title,
                    onValueChange = { title = it },
                    label = { Text("Resource Title / Description") },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp)
                )

                Text("File Format / Type", style = MaterialTheme.typography.labelMedium)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf("PDF", "Notes", "Flashcards", "Code").forEach { type ->
                        FilterChip(
                            selected = fileType == type,
                            onClick = { fileType = type },
                            label = { Text(type) }
                        )
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = { if (title.isNotBlank()) onUpload(title, fileType) },
                enabled = title.isNotBlank(),
                colors = ButtonDefaults.buttonColors(containerColor = tierPrimary())
            ) {
                Text("Upload & Share")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel") }
        }
    )
}

@Composable
private fun ScheduleSessionDialog(
    onDismiss: () -> Unit,
    onSchedule: (title: String, dateTime: String, location: String) -> Unit
) {
    var title by remember { mutableStateOf("") }
    var dateTime by remember { mutableStateOf("Thursday, 6:00 PM") }
    var location by remember { mutableStateOf("Main Library / Zoom") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Schedule Group Study Session", fontWeight = FontWeight.Bold) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedTextField(
                    value = title,
                    onValueChange = { title = it },
                    label = { Text("Session Title") },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp)
                )

                OutlinedTextField(
                    value = dateTime,
                    onValueChange = { dateTime = it },
                    label = { Text("Date & Time") },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp)
                )

                OutlinedTextField(
                    value = location,
                    onValueChange = { location = it },
                    label = { Text("Location / Video Link") },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp)
                )
            }
        },
        confirmButton = {
            Button(
                onClick = { if (title.isNotBlank()) onSchedule(title, dateTime, location) },
                enabled = title.isNotBlank(),
                colors = ButtonDefaults.buttonColors(containerColor = tierPrimary())
            ) {
                Text("Schedule Session")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel") }
        }
    )
}
