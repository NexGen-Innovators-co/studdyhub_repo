package com.example.ui.screens.social

import android.content.ClipboardManager
import android.content.Context
import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.*
import androidx.compose.foundation.shape.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.material3.pulltorefresh.rememberPullToRefreshState
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.example.data.local.entities.SocialPostEntity
import com.example.ui.components.ProfessorOllieLoader
import com.example.ui.theme.tierAccent
import com.example.ui.theme.tierPrimary
import com.example.ui.theme.tierTertiary
import java.text.SimpleDateFormat
import java.util.*
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

// ─── Colour helpers ───────────────────────────────────────────────────────────

private val categoryColors = listOf(
    // Top-level (non-composable) multi-hue palette — categories intentionally stay
    // color-varied for scannability instead of collapsing into one tier accent.
    Color(0xFF4F46E5), Color(0xFF8B5CF6), Color(0xFF10B981),
    Color(0xFFE97E39), Color(0xFF3B82F6), Color(0xFFEC4899)
)

internal fun categoryColor(category: String): Color =
    categoryColors[(category.hashCode() and 0x7FFFFFFF) % categoryColors.size]

internal fun timeAgo(ts: Long): String {
    val diff = System.currentTimeMillis() - ts
    return when {
        diff < 60_000 -> "just now"
        diff < 3_600_000 -> "${diff / 60_000}m ago"
        diff < 86_400_000 -> "${diff / 3_600_000}h ago"
        else -> SimpleDateFormat("MMM d", Locale.getDefault()).format(Date(ts))
    }
}

// ─── Main screen ─────────────────────────────────────────────────────────────

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SocialFeedScreen(
    viewModel: SocialViewModel,
    initialTab: SocialTab? = null,
    onNavigateToGroupDetail: (String) -> Unit = {},
    onBack: () -> Unit = {}
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    var showCreatePost by remember { mutableStateOf(false) }
    var showCreateGroupModal by remember { mutableStateOf(false) }
    var searchActive by remember { mutableStateOf(false) }
    var isRefreshing by remember { mutableStateOf(false) }
    val coroutineScope = rememberCoroutineScope()
    val context = LocalContext.current

    LaunchedEffect(initialTab) {
        if (initialTab != null) {
            viewModel.setTab(initialTab)
        }
    }

    val snackbarHostState = remember { SnackbarHostState() }
    LaunchedEffect(state.userMessage) {
        state.userMessage?.let { msg ->
            snackbarHostState.showSnackbar(msg)
            viewModel.clearUserMessage()
        }
    }

    val currentTabTitle = when (state.activeTab) {
        SocialTab.FEED -> "Activity Feed"
        SocialTab.TRENDING -> "Trending Discussions"
        SocialTab.GROUPS -> "Study Groups"
        SocialTab.PROFILE -> "Student Profile"
        SocialTab.NOTIFICATIONS -> "Notifications"
    }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
        topBar = {
            Column {
                TopAppBar(
                    navigationIcon = {
                    IconButton(
                        onClick = onBack,
                        modifier = Modifier.testTag("back_button")
                    ) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                    },
                    title = {
                        if (searchActive) {
                            OutlinedTextField(
                                value = state.searchQuery,
                                onValueChange = viewModel::setSearchQuery,
                                placeholder = { Text("Search posts, groups, people...") },
                                singleLine = true,
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(24.dp),
                                colors = OutlinedTextFieldDefaults.colors(
                                    focusedBorderColor = tierPrimary(),
                                    unfocusedBorderColor = MaterialTheme.colorScheme.outline.copy(alpha = 0.3f)
                                )
                            )
                        } else {
                            Column {
                                Text(
                                    currentTabTitle,
                                    fontWeight = FontWeight.ExtraBold,
                                    style = MaterialTheme.typography.titleMedium
                                )
                                Text(
                                    "STUDDYHUB SOCIAL HUB",
                                    style = MaterialTheme.typography.labelSmall.copy(
                                        fontSize = 8.sp,
                                        color = tierPrimary(),
                                        fontWeight = FontWeight.ExtraBold,
                                        letterSpacing = 1.sp
                                    )
                                )
                            }
                        }
                    },
                    actions = {
                        IconButton(onClick = {
                            searchActive = !searchActive
                            if (!searchActive) viewModel.setSearchQuery("")
                        }) {
                            Icon(
                                if (searchActive) Icons.Default.Close else Icons.Default.Search,
                                contentDescription = "Search"
                            )
                        }
                        if (!searchActive && !state.isExplorerTier) {
                            IconButton(onClick = { showCreatePost = true }) {
                                Icon(Icons.Default.PostAdd, contentDescription = "Create Post", tint = tierPrimary())
                            }
                        }
                    }
                )
                if (initialTab == null) {
                    SocialTabRow(activeTab = state.activeTab, onTabChange = viewModel::setTab)
                }
            }
        },
        floatingActionButton = {
            // Explorer tier (kids under 13) cannot create social posts — safety restriction
            val canPost = !state.isExplorerTier
            AnimatedVisibility(
                visible = state.activeTab == SocialTab.FEED && !searchActive && canPost,
                enter = scaleIn() + fadeIn(),
                exit = scaleOut() + fadeOut()
            ) {
                ExtendedFloatingActionButton(
                    onClick = { showCreatePost = true },
                    icon = { Icon(Icons.Default.PostAdd, contentDescription = null) },
                    text = { Text("New Post", fontWeight = FontWeight.Bold) },
                    containerColor = tierPrimary(),
                    contentColor = Color.White,
                    modifier = Modifier.testTag("social_fab_post")
                )
            }
        }
    ) { innerPadding ->
        PullToRefreshBox(
            isRefreshing = isRefreshing,
            onRefresh = {
                coroutineScope.launch {
                    isRefreshing = true
                    viewModel.refreshFeed()
                    delay(600)
                    isRefreshing = false
                }
            },
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding),
            state = rememberPullToRefreshState()
        ) {
        Box(modifier = Modifier
            .fillMaxSize()) {

            when (state.activeTab) {
                SocialTab.FEED -> FeedTab(state, viewModel)
                SocialTab.TRENDING -> TrendingTab(state, viewModel)
                SocialTab.GROUPS -> GroupsTab(
                    state = state,
                    viewModel = viewModel,
                    onCreateGroup = { showCreateGroupModal = true },
                    onOpenGroup = onNavigateToGroupDetail
                )
                SocialTab.PROFILE -> ProfileTab(state, viewModel)
                SocialTab.NOTIFICATIONS -> NotificationsTab(state, viewModel)
            }

            if (state.isAiRewriting) {
                ProfessorOllieLoader(message = "Professor Ollie is rewriting your post for clarity and impact...")
            }
        }
        } // end PullToRefreshBox
    }

    if (showCreatePost) {
        CreatePostSheet(
            onDismiss = { showCreatePost = false },
            onPost = { content, category ->
                viewModel.createPost(content, category)
                showCreatePost = false
            }
        )
    }

    if (showCreateGroupModal) {
        CreateGroupModal(
            onDismiss = { showCreateGroupModal = false },
            onCreate = { name, desc, cat ->
                viewModel.createStudyGroup(name, desc, cat)
                showCreateGroupModal = false
            }
        )
    }

    state.activeCommentPost?.let { post ->
        CommentsBottomSheet(
            post = post,
            comments = state.comments.filter { it.postId == post.id },
            onDismiss = { viewModel.openCommentsForPost(null) },
            onAddComment = { text ->
                viewModel.addComment(post.id, text)
            }
        )
    }
}

// ─── Tab row ─────────────────────────────────────────────────────────────────

@Composable
private fun SocialTabRow(activeTab: SocialTab, onTabChange: (SocialTab) -> Unit) {
    val tabs = listOf(
        Triple(SocialTab.FEED, "Feed", Icons.Default.Home),
        Triple(SocialTab.TRENDING, "Trending", Icons.Default.Whatshot),
        Triple(SocialTab.GROUPS, "Groups", Icons.Default.Group),
        Triple(SocialTab.PROFILE, "Profile", Icons.Default.Person),
        Triple(SocialTab.NOTIFICATIONS, "Alerts", Icons.Default.Notifications)
    )
    ScrollableTabRow(
        selectedTabIndex = tabs.indexOfFirst { it.first == activeTab },
        containerColor = MaterialTheme.colorScheme.surface,
        contentColor = tierPrimary(),
        edgePadding = 8.dp,
        divider = {}
    ) {
        tabs.forEach { (tab, label, icon) ->
            val selected = tab == activeTab
            Tab(
                selected = selected,
                onClick = { onTabChange(tab) },
                modifier = Modifier.padding(horizontal = 4.dp)
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.padding(vertical = 12.dp, horizontal = 8.dp),
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    Icon(icon, contentDescription = label, modifier = Modifier.size(16.dp))
                    Text(
                        label,
                        style = MaterialTheme.typography.labelMedium.copy(
                            fontWeight = if (selected) FontWeight.ExtraBold else FontWeight.Normal
                        )
                    )
                }
            }
        }
    }
}

// ─── Feed tab ────────────────────────────────────────────────────────────────

@Composable
private fun FeedTab(state: SocialUiState, viewModel: SocialViewModel) {
    val categories = listOf("All", "General", "Study Group", "Question", "Resource Share", "Computer Science", "Medicine", "Mathematics", "Physics", "Humanities", "Business")

    Column(modifier = Modifier.fillMaxSize()) {
        // Category Filter Chips
        LazyRow(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            items(categories) { category ->
                val isSelected = state.selectedCategoryFilter == category
                FilterChip(
                    selected = isSelected,
                    onClick = { viewModel.setSelectedCategoryFilter(category) },
                    label = { Text(category, fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal, fontSize = 12.sp) },
                    leadingIcon = if (isSelected) {
                        { Icon(Icons.Default.Check, contentDescription = null, modifier = Modifier.size(14.dp)) }
                    } else null,
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = tierPrimary(),
                        selectedLabelColor = Color.White
                    )
                )
            }
        }

        if (state.posts.isEmpty()) {
            EmptyFeedPlaceholder(
                icon = Icons.Default.Forum,
                title = "No Posts Match Your Filter",
                subtitle = "Try selecting a different topic or create the first post in this category!"
            )
        } else {
            val listState = rememberLazyListState()
            val shouldLoadMore = remember {
                derivedStateOf {
                    val totalItemsCount = listState.layoutInfo.totalItemsCount
                    val lastVisibleItemIndex = listState.layoutInfo.visibleItemsInfo.lastOrNull()?.index ?: 0
                    totalItemsCount > 0 && lastVisibleItemIndex >= (totalItemsCount - 3)
                }
            }

            LaunchedEffect(shouldLoadMore.value) {
                if (shouldLoadMore.value && !state.isLoadMoreLoading) {
                    viewModel.loadNextPage()
                }
            }

            LazyColumn(
                state = listState,
                modifier = Modifier
                    .fillMaxSize()
                    .padding(horizontal = 16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
                contentPadding = PaddingValues(top = 4.dp, bottom = 100.dp)
            ) {
                // Quick create bar
                item {
                    QuickCreateRow(onCreatePost = { viewModel.setTab(SocialTab.FEED) })
                }

                items(state.posts, key = { it.id }) { post ->
                    PostCard(
                        post = post,
                        isExpanded = state.expandedPostId == post.id,
                        onLike = { viewModel.toggleLike(post.id) },
                        onBookmark = { viewModel.toggleBookmark(post.id) },
                        onComment = { viewModel.openCommentsForPost(post) },
                        onDelete = { viewModel.deletePost(post.id) },
                        onExpand = { viewModel.toggleExpandPost(post.id) },
                        onAiRewrite = { viewModel.requestAiRewrite(post.id) }
                    )
                }

                if (state.isLoadMoreLoading) {
                    item {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 16.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(24.dp),
                                color = tierPrimary(),
                                strokeWidth = 2.dp
                            )
                        }
                    }
                }
            }
        }
    }
}

// ─── Trending tab ─────────────────────────────────────────────────────────────

@Composable
private fun TrendingTab(state: SocialUiState, viewModel: SocialViewModel) {
    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
        contentPadding = PaddingValues(top = 12.dp, bottom = 80.dp)
    ) {
        item {
            Card(
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(
                    containerColor = tierPrimary().copy(alpha = 0.07f)
                ),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier.padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Icon(
                        Icons.Default.Whatshot,
                        contentDescription = null,
                        tint = tierPrimary(),
                        modifier = Modifier.size(28.dp)
                    )
                    Column {
                        Text("Trending Today", fontWeight = FontWeight.ExtraBold, style = MaterialTheme.typography.titleSmall)
                        Text("Most-liked posts in the last 24 hours", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f))
                    }
                }
            }
        }

        if (state.trendingPosts.isEmpty()) {
            item { EmptyFeedPlaceholder(icon = Icons.Default.Whatshot, title = "Nothing trending yet", subtitle = "Post something and get the community talking!") }
        } else {
            itemsIndexed(state.trendingPosts) { index, post ->
                TrendingPostCard(
                    rank = index + 1,
                    post = post,
                    onLike = { viewModel.toggleLike(post.id) },
                    onBookmark = { viewModel.toggleBookmark(post.id) },
                    onComment = { viewModel.openCommentsForPost(post) }
                )
            }
        }
    }
}

// ─── Groups tab ──────────────────────────────────────────────────────────────

@Composable
private fun GroupsTab(
    state: SocialUiState,
    viewModel: SocialViewModel,
    onCreateGroup: () -> Unit,
    onOpenGroup: (String) -> Unit
) {
    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
        contentPadding = PaddingValues(top = 12.dp, bottom = 80.dp)
    ) {
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        "Discover Study Groups",
                        fontWeight = FontWeight.ExtraBold,
                        style = MaterialTheme.typography.titleMedium
                    )
                    Text(
                        "Join groups that match your courses and interests",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
                    )
                }

                Button(
                    onClick = onCreateGroup,
                    colors = ButtonDefaults.buttonColors(containerColor = tierPrimary()),
                    shape = RoundedCornerShape(12.dp),
                    contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp)
                ) {
                    Icon(Icons.Default.GroupAdd, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("New Group", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                }
            }
        }
        items(state.groups, key = { it.id }) { group ->
            GroupCard(
                group = group,
                onToggleJoin = { viewModel.toggleJoinGroup(group.id) },
                onOpenGroup = { onOpenGroup(group.id) }
            )
        }
    }
}

// ─── Profile tab ─────────────────────────────────────────────────────────────

@Composable
internal fun ProfileTab(state: SocialUiState, viewModel: SocialViewModel) {
    val myName = state.profile?.fullName?.takeIf { it.isNotBlank() } ?: state.profile?.email?.substringBefore("@") ?: "Scholar"
    val myPosts = state.posts.filter { it.authorName == "You" || it.authorName == "Me" || it.authorName == myName }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(bottom = 80.dp)
    ) {
        item { ProfileHeader(profile = state.profile, postCount = myPosts.size, joinedGroups = state.groups.count { it.isJoined }) }

        // Suggested Peers Section
        item {
            Spacer(Modifier.height(16.dp))
            Text(
                "Suggested Peers & Classmates",
                fontWeight = FontWeight.ExtraBold,
                style = MaterialTheme.typography.titleSmall,
                modifier = Modifier.padding(horizontal = 16.dp)
            )
            Spacer(Modifier.height(8.dp))

            LazyRow(
                contentPadding = PaddingValues(horizontal = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                items(state.peers, key = { it.id }) { peer ->
                    PeerCardItem(peer = peer, onToggleFollow = { viewModel.toggleFollowPeer(peer.id) })
                }
            }
        }

        item {
            Spacer(Modifier.height(16.dp))
            Text(
                "My Activity Posts",
                fontWeight = FontWeight.ExtraBold,
                style = MaterialTheme.typography.titleSmall,
                modifier = Modifier.padding(horizontal = 16.dp)
            )
            Spacer(Modifier.height(8.dp))
        }

        if (myPosts.isEmpty()) {
            item {
                EmptyFeedPlaceholder(
                    icon = Icons.Default.EditNote,
                    title = "No posts yet",
                    subtitle = "Share your first study insight with the community!"
                )
            }
        } else {
            items(myPosts, key = { it.id }) { post ->
                PostCard(
                    post = post,
                    isExpanded = false,
                    onLike = { viewModel.toggleLike(post.id) },
                    onBookmark = { viewModel.toggleBookmark(post.id) },
                    onComment = { viewModel.openCommentsForPost(post) },
                    onDelete = { viewModel.deletePost(post.id) },
                    onExpand = {},
                    onAiRewrite = {},
                    modifier = Modifier.padding(horizontal = 16.dp)
                )
                Spacer(Modifier.height(10.dp))
            }
        }
    }
}

// ─── Peer Card Item ──────────────────────────────────────────────────────────

@Composable
internal fun PeerCardItem(peer: PeerUser, onToggleFollow: () -> Unit) {
    Card(
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.45f)),
        modifier = Modifier.width(160.dp)
    ) {
        Column(
            modifier = Modifier.padding(12.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Box(
                modifier = Modifier
                    .size(44.dp)
                    .clip(CircleShape)
                    .background(tierPrimary().copy(alpha = 0.15f)),
                contentAlignment = Alignment.Center
            ) {
                Text(peer.name.take(1), fontWeight = FontWeight.Bold, color = tierPrimary())
            }
            Spacer(modifier = Modifier.height(6.dp))
            Text(peer.name, fontWeight = FontWeight.Bold, fontSize = 12.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(peer.school, fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f), maxLines = 1, overflow = TextOverflow.Ellipsis)
            Spacer(modifier = Modifier.height(10.dp))

            Button(
                onClick = onToggleFollow,
                colors = ButtonDefaults.buttonColors(
                    containerColor = if (peer.isFollowing) MaterialTheme.colorScheme.surfaceVariant else tierPrimary(),
                    contentColor = if (peer.isFollowing) MaterialTheme.colorScheme.onSurface else Color.White
                ),
                shape = RoundedCornerShape(8.dp),
                contentPadding = PaddingValues(horizontal = 8.dp, vertical = 2.dp),
                modifier = Modifier.fillMaxWidth().height(30.dp)
            ) {
                Text(if (peer.isFollowing) "Following" else "Follow", fontSize = 10.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}

// ─── Notifications tab ────────────────────────────────────────────────────────

@Composable
private fun NotificationsTab(state: SocialUiState, viewModel: SocialViewModel) {
    val unread = state.notifications.count { !it.isRead }
    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
        contentPadding = PaddingValues(top = 12.dp, bottom = 80.dp)
    ) {
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text("Notifications", fontWeight = FontWeight.ExtraBold, style = MaterialTheme.typography.titleMedium)
                    if (unread > 0) Text("$unread unread", style = MaterialTheme.typography.labelSmall, color = tierPrimary())
                }
                if (unread > 0) {
                    TextButton(onClick = viewModel::markAllNotificationsRead) {
                        Text("Mark all read", style = MaterialTheme.typography.labelSmall, color = tierPrimary())
                    }
                }
            }
        }

        items(state.notifications, key = { it.id }) { notif ->
            NotificationItem(notif)
        }
    }
}

// ─── Composable components ───────────────────────────────────────────────────

@Composable
private fun QuickCreateRow(onCreatePost: () -> Unit) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        modifier = Modifier
            .fillMaxWidth()
            .padding(bottom = 4.dp)
    ) {
        Surface(
            shape = CircleShape,
            color = tierPrimary(),
            modifier = Modifier.size(40.dp)
        ) {
            Box(contentAlignment = Alignment.Center) {
                Text("M", color = Color.White, fontWeight = FontWeight.Bold)
            }
        }
        Surface(
            shape = RoundedCornerShape(24.dp),
            color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.6f),
            border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.2f)),
            modifier = Modifier
                .weight(1f)
                .clickable(onClick = onCreatePost)
        ) {
            Text(
                "Share a study insight or question...",
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.45f)
            )
        }
    }
}

@Composable
internal fun PostCard(
    post: SocialPostEntity,
    isExpanded: Boolean,
    onLike: () -> Unit,
    onBookmark: () -> Unit,
    onComment: () -> Unit,
    onDelete: () -> Unit,
    onExpand: () -> Unit,
    onAiRewrite: () -> Unit,
    modifier: Modifier = Modifier
) {
    val catColor = categoryColor(post.category)
    val context = LocalContext.current
    val isMyPost = post.authorName == "You" || post.authorName == "Me" || post.authorName.isNotBlank()

    Card(
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        border = BorderStroke(0.8.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.12f)),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
        modifier = modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            // Header
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    // Avatar
                    Box(
                        modifier = Modifier
                            .size(42.dp)
                            .clip(CircleShape)
                            .background(
                                Brush.linearGradient(
                                    listOf(catColor.copy(alpha = 0.8f), catColor)
                                )
                            ),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            post.authorName.take(1).uppercase(),
                            color = Color.White,
                            fontWeight = FontWeight.ExtraBold,
                            style = MaterialTheme.typography.titleSmall
                        )
                    }
                    Column {
                        Text(
                            post.authorName,
                            fontWeight = FontWeight.Bold,
                            style = MaterialTheme.typography.bodyMedium
                        )
                        Text(
                            timeAgo(post.createdAt),
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f)
                        )
                    }
                }

                Row(verticalAlignment = Alignment.CenterVertically) {
                    // Category chip
                    Surface(
                        shape = RoundedCornerShape(8.dp),
                        color = catColor.copy(alpha = 0.13f)
                    ) {
                        Text(
                            post.category,
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp),
                            style = MaterialTheme.typography.labelSmall.copy(color = catColor, fontWeight = FontWeight.Bold)
                        )
                    }

                    if (isMyPost) {
                        IconButton(onClick = onDelete, modifier = Modifier.size(28.dp)) {
                            Icon(Icons.Default.Delete, contentDescription = "Delete Post", tint = MaterialTheme.colorScheme.error.copy(alpha = 0.7f), modifier = Modifier.size(16.dp))
                        }
                    }
                }
            }

            Spacer(Modifier.height(12.dp))

            // Content
            Text(
                text = post.content,
                style = MaterialTheme.typography.bodyMedium.copy(lineHeight = 21.sp),
                maxLines = if (isExpanded) Int.MAX_VALUE else 3,
                overflow = if (isExpanded) TextOverflow.Visible else TextOverflow.Ellipsis
            )
            if (post.content.length > 120) {
                TextButton(
                    onClick = onExpand,
                    contentPadding = PaddingValues(0.dp),
                    modifier = Modifier.height(24.dp)
                ) {
                    Text(
                        if (isExpanded) "Show less" else "Read more",
                        style = MaterialTheme.typography.labelSmall,
                        color = tierPrimary()
                    )
                }
            }

            Spacer(Modifier.height(12.dp))

            HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.1f))
            Spacer(Modifier.height(8.dp))

            // Action row
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Like
                PostActionButton(
                    icon = if (post.isLiked) Icons.Default.Favorite else Icons.Default.FavoriteBorder,
                    label = "${post.likesCount}",
                    tint = if (post.isLiked) Color(0xFFE53935) else MaterialTheme.colorScheme.onSurface.copy(alpha = 0.55f),
                    onClick = onLike
                )
                // Comment
                PostActionButton(
                    icon = Icons.Default.ModeComment,
                    label = "${post.commentsCount}",
                    tint = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.55f),
                    onClick = onComment
                )
                // Share
                PostActionButton(
                    icon = Icons.Default.Share,
                    label = "${post.sharesCount}",
                    tint = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.55f),
                    onClick = {
                        val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                        val clip = android.content.ClipData.newPlainText("StuddyHub Post", post.content)
                        clipboard.setPrimaryClip(clip)
                    }
                )
                // AI Rewrite
                IconButton(onClick = onAiRewrite, modifier = Modifier.size(32.dp)) {
                    Icon(
                        Icons.Default.AutoAwesome,
                        contentDescription = "AI Rewrite",
                        tint = tierTertiary(),
                        modifier = Modifier.size(16.dp)
                    )
                }
                // Bookmark
                IconButton(onClick = onBookmark, modifier = Modifier.size(32.dp)) {
                    Icon(
                        if (post.isBookmarked) Icons.Default.Bookmark else Icons.Default.BookmarkBorder,
                        contentDescription = "Bookmark",
                        tint = if (post.isBookmarked) tierPrimary() else MaterialTheme.colorScheme.onSurface.copy(alpha = 0.55f),
                        modifier = Modifier.size(16.dp)
                    )
                }
            }
        }
    }
}

@Composable
private fun PostActionButton(icon: ImageVector, label: String, tint: Color, onClick: () -> Unit) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier.clickable(onClick = onClick).padding(horizontal = 4.dp, vertical = 4.dp),
        horizontalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        Icon(icon, contentDescription = null, tint = tint, modifier = Modifier.size(16.dp))
        Text(label, style = MaterialTheme.typography.labelSmall, color = tint)
    }
}

@Composable
private fun TrendingPostCard(
    rank: Int,
    post: SocialPostEntity,
    onLike: () -> Unit,
    onBookmark: () -> Unit,
    onComment: () -> Unit
) {
    val catColor = categoryColor(post.category)
    val context = LocalContext.current

    Card(
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        border = BorderStroke(0.8.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.12f)),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(modifier = Modifier.padding(16.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            // Rank badge
            Box(
                modifier = Modifier
                    .size(36.dp)
                    .clip(CircleShape)
                    .background(if (rank <= 3) tierPrimary() else MaterialTheme.colorScheme.surfaceVariant),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    "#$rank",
                    color = if (rank <= 3) Color.White else MaterialTheme.colorScheme.onSurface,
                    fontWeight = FontWeight.ExtraBold,
                    style = MaterialTheme.typography.labelSmall
                )
            }

            Column(modifier = Modifier.weight(1f)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(post.authorName, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.bodySmall)
                    Surface(shape = RoundedCornerShape(6.dp), color = catColor.copy(alpha = 0.13f)) {
                        Text(post.category, modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                            style = MaterialTheme.typography.labelSmall.copy(color = catColor, fontWeight = FontWeight.Bold))
                    }
                }
                Spacer(Modifier.height(6.dp))
                Text(post.content, style = MaterialTheme.typography.bodySmall, maxLines = 2, overflow = TextOverflow.Ellipsis)
                Spacer(Modifier.height(8.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    PostActionButton(
                        icon = if (post.isLiked) Icons.Default.Favorite else Icons.Default.FavoriteBorder,
                        label = "${post.likesCount}",
                        tint = if (post.isLiked) Color(0xFFE53935) else MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f),
                        onClick = onLike
                    )
                    PostActionButton(
                        icon = Icons.Default.ModeComment,
                        label = "${post.commentsCount}",
                        tint = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f),
                        onClick = onComment
                    )
                    IconButton(onClick = onBookmark, modifier = Modifier.size(24.dp)) {
                        Icon(
                            if (post.isBookmarked) Icons.Default.Bookmark else Icons.Default.BookmarkBorder,
                            contentDescription = "Bookmark",
                            tint = tierPrimary(), modifier = Modifier.size(14.dp)
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun GroupCard(
    group: SocialGroup,
    onToggleJoin: () -> Unit,
    onOpenGroup: () -> Unit
) {
    val catColor = categoryColor(group.category)
    Card(
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        border = BorderStroke(0.8.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.12f)),
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onOpenGroup)
    ) {
        Row(
            modifier = Modifier.padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Box(
                modifier = Modifier
                    .size(48.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(Brush.linearGradient(listOf(catColor.copy(alpha = 0.2f), catColor.copy(alpha = 0.4f)))),
                contentAlignment = Alignment.Center
            ) {
                Icon(Icons.Default.Group, contentDescription = null, tint = catColor, modifier = Modifier.size(24.dp))
            }
            Column(modifier = Modifier.weight(1f)) {
                Text(group.name, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.bodyMedium)
                Text(group.description, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f), maxLines = 1, overflow = TextOverflow.Ellipsis)
                Spacer(Modifier.height(4.dp))
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    Icon(Icons.Default.Person, contentDescription = null, modifier = Modifier.size(12.dp), tint = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.4f))
                    Text("${group.memberCount} members", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f))
                    Spacer(Modifier.width(6.dp))
                    Surface(shape = RoundedCornerShape(4.dp), color = catColor.copy(alpha = 0.1f)) {
                        Text(group.category, modifier = Modifier.padding(horizontal = 5.dp, vertical = 1.dp),
                            style = MaterialTheme.typography.labelSmall.copy(color = catColor, fontWeight = FontWeight.Bold, fontSize = 9.sp))
                    }
                }
            }
            Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Button(
                    onClick = onToggleJoin,
                    colors = ButtonDefaults.buttonColors(
                        containerColor = if (group.isJoined) MaterialTheme.colorScheme.surfaceVariant else tierPrimary(),
                        contentColor = if (group.isJoined) MaterialTheme.colorScheme.onSurface else Color.White
                    ),
                    shape = RoundedCornerShape(10.dp),
                    contentPadding = PaddingValues(horizontal = 12.dp, vertical = 4.dp),
                    modifier = Modifier.height(32.dp)
                ) {
                    Text(
                        if (group.isJoined) "Joined" else "Join",
                        style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Bold)
                    )
                }

                if (group.isJoined) {
                    TextButton(
                        onClick = onOpenGroup,
                        contentPadding = PaddingValues(horizontal = 4.dp, vertical = 0.dp),
                        modifier = Modifier.height(24.dp)
                    ) {
                        Text("Open ➔", fontSize = 10.sp, color = tierPrimary(), fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}

@Composable
internal fun ProfileHeader(profile: com.example.data.local.entities.ProfileEntity?, postCount: Int, joinedGroups: Int) {
    val name = profile?.fullName?.takeIf { it.isNotBlank() } ?: profile?.email?.substringBefore("@") ?: "Scholar"
    val initial = name.take(1).uppercase()

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(180.dp)
            .background(tierPrimary())
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(20.dp),
            verticalArrangement = Arrangement.Center,
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Box(
                modifier = Modifier
                    .size(56.dp)
                    .clip(CircleShape)
                    .background(Color.White.copy(alpha = 0.2f))
                    .border(2.dp, Color.White.copy(alpha = 0.5f), CircleShape),
                contentAlignment = Alignment.Center
            ) {
                Text(initial, color = Color.White, fontWeight = FontWeight.ExtraBold, style = MaterialTheme.typography.titleLarge)
            }
            Spacer(Modifier.height(6.dp))
            Text(name, color = Color.White, fontWeight = FontWeight.ExtraBold, style = MaterialTheme.typography.titleMedium)
            Text("STUDENT • ACTIVE LEARNER", color = Color.White.copy(alpha = 0.75f),
                style = MaterialTheme.typography.labelSmall.copy(letterSpacing = 1.sp, fontSize = 9.sp))
            Spacer(Modifier.height(10.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(28.dp)) {
                ProfileStat("$postCount", "Posts")
                ProfileStat("$joinedGroups", "Groups")
                ProfileStat("42", "Followers")
            }
        }
    }
}

@Composable
internal fun ProfileStat(value: String, label: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(value, color = Color.White, fontWeight = FontWeight.ExtraBold, style = MaterialTheme.typography.titleSmall)
        Text(label, color = Color.White.copy(alpha = 0.7f), style = MaterialTheme.typography.labelSmall)
    }
}

@Composable
private fun NotificationItem(notif: SocialNotification) {
    val typeIcon = when (notif.type) {
        "like" -> Icons.Default.Favorite
        "comment" -> Icons.Default.ModeComment
        "follow" -> Icons.Default.PersonAdd
        else -> Icons.Default.AlternateEmail
    }
    val typeColor = when (notif.type) {
        "like" -> Color(0xFFE53935)
        "comment" -> tierPrimary()
        "follow" -> tierAccent()
        else -> tierTertiary()
    }

    Surface(
        shape = RoundedCornerShape(14.dp),
        color = if (!notif.isRead) tierPrimary().copy(alpha = 0.05f) else MaterialTheme.colorScheme.surface,
        border = BorderStroke(0.8.dp, MaterialTheme.colorScheme.outline.copy(alpha = if (!notif.isRead) 0.2f else 0.08f)),
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier.padding(14.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.Top
        ) {
            Box(
                modifier = Modifier
                    .size(36.dp)
                    .clip(CircleShape)
                    .background(typeColor.copy(alpha = 0.12f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(typeIcon, contentDescription = null, tint = typeColor, modifier = Modifier.size(18.dp))
            }
            Column(modifier = Modifier.weight(1f)) {
                Text(notif.text, style = MaterialTheme.typography.bodySmall.copy(
                    fontWeight = if (!notif.isRead) FontWeight.SemiBold else FontWeight.Normal
                ))
                Spacer(Modifier.height(2.dp))
                Text(notif.time, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.45f))
            }
            if (!notif.isRead) {
                Box(modifier = Modifier
                    .size(8.dp)
                    .clip(CircleShape)
                    .background(tierPrimary())
                    .align(Alignment.CenterVertically))
            }
        }
    }
}

@Composable
internal fun EmptyFeedPlaceholder(icon: ImageVector, title: String, subtitle: String) {
    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp),
            modifier = Modifier.padding(32.dp)
        ) {
            Surface(
                shape = CircleShape,
                color = tierPrimary().copy(alpha = 0.08f),
                modifier = Modifier.size(80.dp)
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(icon, contentDescription = null, tint = tierPrimary(), modifier = Modifier.size(36.dp))
                }
            }
            Text(title, fontWeight = FontWeight.ExtraBold, style = MaterialTheme.typography.titleMedium, textAlign = TextAlign.Center)
            Text(subtitle, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f), textAlign = TextAlign.Center)
        }
    }
}

// ─── Create Post Sheet ────────────────────────────────────────────────────────

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun CreatePostSheet(
    onDismiss: () -> Unit,
    onPost: (content: String, category: String) -> Unit
) {
    var content by remember { mutableStateOf("") }
    var category by remember { mutableStateOf("General") }
    val categories = listOf("General", "Study Group", "Question", "Resource Share", "Event", "Tip", "Motivation")
    var showCategoryPicker by remember { mutableStateOf(false) }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        shape = RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp)
                .padding(bottom = 28.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("Create Post", fontWeight = FontWeight.ExtraBold, style = MaterialTheme.typography.titleLarge)
                IconButton(onClick = onDismiss) {
                    Icon(Icons.Default.Close, contentDescription = "Close")
                }
            }

            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Box(
                    modifier = Modifier.size(40.dp).clip(CircleShape).background(tierPrimary()),
                    contentAlignment = Alignment.Center
                ) {
                    Text("M", color = Color.White, fontWeight = FontWeight.Bold)
                }
                Column {
                    Text("Me", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.bodyMedium)
                    Text("Posting to StuddyHub Community", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f))
                }
            }

            Box {
                OutlinedButton(
                    onClick = { showCategoryPicker = true },
                    shape = RoundedCornerShape(10.dp),
                    border = BorderStroke(1.dp, categoryColor(category).copy(alpha = 0.5f)),
                    contentPadding = PaddingValues(horizontal = 12.dp, vertical = 8.dp)
                ) {
                    Surface(shape = RoundedCornerShape(6.dp), color = categoryColor(category).copy(alpha = 0.12f)) {
                        Text(
                            category,
                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                            style = MaterialTheme.typography.labelSmall.copy(color = categoryColor(category), fontWeight = FontWeight.Bold)
                        )
                    }
                    Spacer(Modifier.width(6.dp))
                    Icon(Icons.Default.ArrowDropDown, contentDescription = "Pick category", modifier = Modifier.size(16.dp))
                }
                DropdownMenu(expanded = showCategoryPicker, onDismissRequest = { showCategoryPicker = false }) {
                    categories.forEach { cat ->
                        DropdownMenuItem(
                            text = { Text(cat) },
                            leadingIcon = {
                                Box(modifier = Modifier.size(10.dp).clip(CircleShape).background(categoryColor(cat)))
                            },
                            onClick = {
                                category = cat
                                showCategoryPicker = false
                            }
                        )
                    }
                }
            }

            OutlinedTextField(
                value = content,
                onValueChange = { content = it },
                placeholder = { Text("What's on your study mind? Share insights, ask questions, or motivate your peers...") },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(140.dp),
                shape = RoundedCornerShape(14.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = tierPrimary(),
                    unfocusedBorderColor = MaterialTheme.colorScheme.outline.copy(alpha = 0.25f)
                )
            )

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                TextButton(
                    onClick = {
                        if (content.isNotBlank()) {
                            content = "💡 [Study Note Summary]\n" + content + "\n\nKey takeaways:\n• Focus on core formulas\n• Practice active recall daily!"
                        }
                    }
                ) {
                    Icon(Icons.Default.AutoAwesome, contentDescription = null, tint = tierTertiary(), modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("AI Format 🪄", fontSize = 11.sp, color = tierTertiary(), fontWeight = FontWeight.Bold)
                }

                Text(
                    "${content.length}/500",
                    style = MaterialTheme.typography.labelSmall,
                    color = if (content.length > 480) Color(0xFFE53935) else MaterialTheme.colorScheme.onSurface.copy(alpha = 0.4f)
                )
            }

            Button(
                onClick = { if (content.isNotBlank()) onPost(content, category) },
                enabled = content.isNotBlank() && content.length <= 500,
                modifier = Modifier.fillMaxWidth().height(50.dp),
                shape = RoundedCornerShape(14.dp),
                colors = ButtonDefaults.buttonColors(containerColor = tierPrimary())
            ) {
                Icon(Icons.AutoMirrored.Filled.Send, contentDescription = null, modifier = Modifier.size(16.dp))
                Spacer(Modifier.width(8.dp))
                Text("Post to Community", fontWeight = FontWeight.Bold)
            }
        }
    }
}

// ─── Comments Bottom Sheet ────────────────────────────────────────────────────

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun CommentsBottomSheet(
    post: SocialPostEntity,
    comments: List<SocialComment>,
    onDismiss: () -> Unit,
    onAddComment: (String) -> Unit
) {
    var newCommentText by remember { mutableStateOf("") }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        shape = RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp)
                .padding(bottom = 28.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("Comments (${comments.size})", fontWeight = FontWeight.ExtraBold, style = MaterialTheme.typography.titleMedium)
                IconButton(onClick = onDismiss) {
                    Icon(Icons.Default.Close, contentDescription = "Close")
                }
            }

            if (comments.isEmpty()) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(120.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text("No comments yet. Start the conversation!", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f))
                }
            } else {
                LazyColumn(
                    modifier = Modifier
                        .fillMaxWidth()
                        .heightIn(max = 240.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    items(comments, key = { it.id }) { c ->
                        Surface(
                            shape = RoundedCornerShape(12.dp),
                            color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Column(modifier = Modifier.padding(10.dp)) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Text(c.authorName, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                                    Text(c.time, fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f))
                                }
                                Spacer(modifier = Modifier.height(4.dp))
                                Text(c.text, fontSize = 13.sp)
                            }
                        }
                    }
                }
            }

            OutlinedTextField(
                value = newCommentText,
                onValueChange = { newCommentText = it },
                placeholder = { Text("Write a comment...", fontSize = 13.sp) },
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                trailingIcon = {
                    IconButton(
                        onClick = {
                            if (newCommentText.isNotBlank()) {
                                onAddComment(newCommentText)
                                newCommentText = ""
                            }
                        },
                        enabled = newCommentText.isNotBlank()
                    ) {
                        Icon(Icons.AutoMirrored.Filled.Send, contentDescription = "Send Comment", tint = tierPrimary())
                    }
                }
            )
        }
    }
}

// ─── Create Group Modal ───────────────────────────────────────────────────────

@Composable
private fun CreateGroupModal(
    onDismiss: () -> Unit,
    onCreate: (name: String, description: String, category: String) -> Unit
) {
    var groupName by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }
    var category by remember { mutableStateOf("Computer Science") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Create Study Group", fontWeight = FontWeight.Bold) },
        text = {
            Column(
                verticalArrangement = Arrangement.spacedBy(10.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                OutlinedTextField(
                    value = groupName,
                    onValueChange = { groupName = it },
                    label = { Text("Group Name") },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    singleLine = true
                )

                OutlinedTextField(
                    value = description,
                    onValueChange = { description = it },
                    label = { Text("Description & Goal") },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp)
                )

                OutlinedTextField(
                    value = category,
                    onValueChange = { category = it },
                    label = { Text("Subject / Category") },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    singleLine = true
                )
            }
        },
        confirmButton = {
            Button(
                onClick = { if (groupName.isNotBlank()) onCreate(groupName, description, category) },
                enabled = groupName.isNotBlank(),
                colors = ButtonDefaults.buttonColors(containerColor = tierPrimary())
            ) {
                Text("Create Group")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel") }
        }
    )
}
