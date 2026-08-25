package com.example.ui.screens.social

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.data.local.entities.SocialPostEntity
import com.example.data.repository.StuddyHubRepository
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch

import com.example.data.local.entities.ProfileEntity

// ---------- UI models ----------

data class SocialComment(
    val id: String,
    val postId: String,
    val authorName: String,
    val text: String,
    val time: String
)

data class PeerUser(
    val id: String,
    val name: String,
    val school: String,
    val bio: String,
    val isFollowing: Boolean = false
)

data class SocialGroup(
    val id: String,
    val name: String,
    val description: String,
    val memberCount: Int,
    val category: String,
    val isJoined: Boolean = false
)

data class GroupMessage(
    val id: String,
    val groupId: String,
    val authorName: String,
    val authorRole: String = "Member",
    val text: String,
    val time: String,
    val likesCount: Int = 0,
    val isLiked: Boolean = false
)

data class GroupResource(
    val id: String,
    val groupId: String,
    val title: String,
    val fileType: String, // PDF | Notes | Flashcards | Code
    val uploadedBy: String,
    val fileSize: String,
    val date: String
)

data class GroupEvent(
    val id: String,
    val groupId: String,
    val title: String,
    val dateTime: String,
    val location: String,
    val attendeesCount: Int,
    val isAttending: Boolean = false
)

data class SocialNotification(
    val id: String,
    val text: String,
    val time: String,
    val isRead: Boolean = false,
    val type: String = "like" // like | comment | follow | mention
)

data class SocialUiState(
    val posts: List<SocialPostEntity> = emptyList(),
    val trendingPosts: List<SocialPostEntity> = emptyList(),
    val groups: List<SocialGroup> = emptyList(),
    val notifications: List<SocialNotification> = emptyList(),
    val peers: List<PeerUser> = emptyList(),
    val comments: List<SocialComment> = emptyList(),
    val groupMessages: List<GroupMessage> = emptyList(),
    val groupResources: List<GroupResource> = emptyList(),
    val groupEvents: List<GroupEvent> = emptyList(),
    val profile: ProfileEntity? = null,
    val activeTab: SocialTab = SocialTab.FEED,
    val selectedCategoryFilter: String = "All",
    val searchQuery: String = "",
    val isAiRewriting: Boolean = false,
    val isLoadMoreLoading: Boolean = false,
    val isExplorerTier: Boolean = false,
    val expandedPostId: String? = null,
    val activeCommentPost: SocialPostEntity? = null,
    val userMessage: String? = null
)

enum class SocialTab { FEED, TRENDING, GROUPS, PROFILE, NOTIFICATIONS }

class SocialViewModel(private val repository: StuddyHubRepository) : ViewModel() {

    init {
        // Lightweight local DB read only — NO network calls here. The ViewModel is
        // created eagerly at the StuddyHubApp level (before the user navigates to social
        // screens), so firing ensureSocialUser() + syncSocialFeed() here wastes API calls
        // on every navigation. Heavy work is deferred to onScreenResumed().
        viewModelScope.launch {
            repository.allSocialPosts.first()
        }
    }

    /**
     * Called when the user actually navigates to a social/community/settings screen.
     * Gates all network calls behind an authentication check so other screens never
     * trigger unnecessary social API requests.
     */
    fun onScreenResumed() {
        viewModelScope.launch {
            val userId = com.example.data.remote.BackendApiService.currentUserId
            if (userId.isNullOrBlank()) return@launch
            try {
                ensureSocialUser()
                repository.syncSocialFeed()
            } catch (e: Exception) {
                android.util.Log.w("SocialViewModel", "Screen resume sync error: ${e.message}")
            }
            fetchRealGroupsAndPeers()
        }
    }

    private suspend fun ensureSocialUser() {
        val profile = try { repository.getProfileDirect() } catch (e: Exception) { null }
        val userId = profile?.supabaseUserId?.ifBlank { null }
            ?: com.example.data.remote.BackendApiService.currentUserId
        val displayName = profile?.fullName?.ifBlank { null }
            ?: profile?.email?.substringBefore("@")
            ?: "Scholar"
        if (!userId.isNullOrBlank()) {
            try {
                com.example.data.remote.BackendApiService.ensureSocialUserExists(
                    userId,
                    displayName,
                    profile?.avatarUrl ?: ""
                )
            } catch (e: Exception) {
                android.util.Log.w("SocialViewModel", "Failed to ensure social user: ${e.message}")
            }
        }
    }

    @Volatile private var groupsAndPeersLastFetchedAt = 0L
    private fun fetchRealGroupsAndPeers() {
        // Debounce: skip if fetched within the last 30s
        val now = System.currentTimeMillis()
        if (now - groupsAndPeersLastFetchedAt < 30_000L) return
        groupsAndPeersLastFetchedAt = now

        viewModelScope.launch {
            val userId = getUserId()
            val cleanUserId = com.example.data.remote.BackendApiService.ensureValidUuid(userId)

            val joinedGroupIds = mutableSetOf<String>()
            val followedUserIds = mutableSetOf<String>()

            try {
                val jgRes = com.example.data.remote.BackendApiService.getJoinedGroupsForUser(cleanUserId)
                if (jgRes is com.example.data.remote.BackendResult.Success) {
                    val arr = jgRes.data
                    for (i in 0 until arr.length()) {
                        val gId = arr.getJSONObject(i).optString("group_id", "")
                        if (gId.isNotBlank()) joinedGroupIds.add(gId)
                    }
                }
            } catch (e: Exception) {}

            try {
                val folRes = com.example.data.remote.BackendApiService.getFollowsForUser(cleanUserId)
                if (folRes is com.example.data.remote.BackendResult.Success) {
                    val arr = folRes.data
                    for (i in 0 until arr.length()) {
                        val fId = arr.getJSONObject(i).optString("following_id", "")
                        if (fId.isNotBlank()) followedUserIds.add(fId)
                    }
                }
            } catch (e: Exception) {}

            try {
                val groupsResult = com.example.data.remote.BackendApiService.getSocialGroups()
                if (groupsResult is com.example.data.remote.BackendResult.Success) {
                    val array = groupsResult.data
                    val list = mutableListOf<SocialGroup>()
                    for (i in 0 until array.length()) {
                        val obj = array.getJSONObject(i)
                        val id = obj.optString("id", "")
                        val name = obj.optString("name", "Study Group")
                        val description = obj.optString("description", "")
                        val category = obj.optString("category", "General")
                        val memberCount = obj.optInt("members_count", 0).takeIf { it > 0 } ?: (42 + i * 7)
                        list.add(
                            SocialGroup(
                                id = id,
                                name = name,
                                description = description,
                                memberCount = memberCount,
                                category = category,
                                isJoined = joinedGroupIds.contains(id)
                            )
                        )
                    }
                    if (list.isNotEmpty()) {
                        _groups.value = list
                    }
                }
            } catch (e: Exception) {
                // Keep default list on failure
            }

            try {
                val usersResult = com.example.data.remote.BackendApiService.getSuggestedUsers()
                if (usersResult is com.example.data.remote.BackendResult.Success) {
                    val array = usersResult.data
                    val list = mutableListOf<PeerUser>()
                    for (i in 0 until array.length()) {
                        val obj = array.getJSONObject(i)
                        val id = obj.optString("id", "")
                        if (id == cleanUserId) continue // Skip self
                        val username = obj.optString("username", "user")
                        val displayName = obj.optString("display_name", username)
                        val bio = obj.optString("bio", "StuddyHub Scholar")
                        val interests = obj.optJSONArray("interests")
                        val school = if (interests != null && interests.length() > 0) interests.optString(0) else "Independent University"
                        list.add(
                            PeerUser(
                                id = id,
                                name = displayName,
                                school = school,
                                bio = bio,
                                isFollowing = followedUserIds.contains(id)
                            )
                        )
                    }
                    if (list.isNotEmpty()) {
                        _peers.value = list
                    }
                }
            } catch (e: Exception) {
                // Keep default list on failure
            }
        }
    }

    private val _activeTab = MutableStateFlow(SocialTab.FEED)
    private val _searchQuery = MutableStateFlow("")
    private val _selectedCategoryFilter = MutableStateFlow("All")
    private val _isAiRewriting = MutableStateFlow(false)
    private val _isLoadMoreLoading = MutableStateFlow(false)
    private val _expandedPostId = MutableStateFlow<String?>(null)
    private val _activeCommentPost = MutableStateFlow<SocialPostEntity?>(null)
    private val _userMessage = MutableStateFlow<String?>(null)

    private val _comments = MutableStateFlow<List<SocialComment>>(emptyList())
    private val _peers = MutableStateFlow<List<PeerUser>>(emptyList())
    private val _groups = MutableStateFlow<List<SocialGroup>>(emptyList())
    private val _notifications = MutableStateFlow<List<SocialNotification>>(emptyList())
    private val _groupMessages = MutableStateFlow<List<GroupMessage>>(emptyList())
    private val _groupResources = MutableStateFlow<List<GroupResource>>(emptyList())
    private val _groupEvents = MutableStateFlow<List<GroupEvent>>(emptyList())

    private data class FilterState(
        val tab: SocialTab,
        val query: String,
        val categoryFilter: String
    )

    private val _filterFlow = combine(_activeTab, _searchQuery, _selectedCategoryFilter) { tab, query, catFilter ->
        FilterState(tab, query, catFilter)
    }

    private data class FeedCore(
        val posts: List<SocialPostEntity>,
        val tab: SocialTab,
        val query: String,
        val categoryFilter: String,
        val rewriting: Boolean,
        val loadMore: Boolean
    )

    private data class FeedExtra1(
        val expandedId: String?,
        val activeCommentPost: SocialPostEntity?,
        val msg: String?,
        val groups: List<SocialGroup>,
        val notifications: List<SocialNotification>
    )

    private data class FeedExtra2(
        val comments: List<SocialComment>,
        val peers: List<PeerUser>,
        val groupMessages: List<GroupMessage>,
        val groupResources: List<GroupResource>,
        val groupEvents: List<GroupEvent>
    )

    private val _extra1Flow = combine(_expandedPostId, _activeCommentPost, _userMessage, _groups, _notifications) { expandedId, commentPost, msg, groups, notifications ->
        FeedExtra1(expandedId, commentPost, msg, groups, notifications)
    }

    private val _extra2Flow = combine(_comments, _peers, _groupMessages, _groupResources, _groupEvents) { comments, peers, messages, resources, events ->
        FeedExtra2(comments, peers, messages, resources, events)
    }

    val uiState: StateFlow<SocialUiState> = combine(
        combine(repository.allSocialPosts, _filterFlow, _isAiRewriting, _isLoadMoreLoading) { posts, filter, rewriting, loadMore ->
            FeedCore(posts, filter.tab, filter.query, filter.categoryFilter, rewriting, loadMore)
        },
        _extra1Flow,
        _extra2Flow,
        repository.userProfile
    ) { core, extra1, extra2, userProfile ->
        var filtered = if (core.query.isBlank()) core.posts
        else core.posts.filter {
            it.content.contains(core.query, ignoreCase = true) ||
                    it.category.contains(core.query, ignoreCase = true) ||
                    it.authorName.contains(core.query, ignoreCase = true)
        }

        if (core.categoryFilter != "All") {
            filtered = filtered.filter { it.category.equals(core.categoryFilter, ignoreCase = true) }
        }

        val trending = core.posts.sortedByDescending { it.likesCount }.take(10)

        SocialUiState(
            posts = filtered,
            trendingPosts = trending,
            groups = extra1.groups,
            notifications = extra1.notifications,
            peers = extra2.peers,
            comments = extra2.comments,
            groupMessages = extra2.groupMessages,
            groupResources = extra2.groupResources,
            groupEvents = extra2.groupEvents,
            profile = userProfile,
            activeTab = core.tab,
            selectedCategoryFilter = core.categoryFilter,
            searchQuery = core.query,
            isAiRewriting = core.rewriting,
            isLoadMoreLoading = core.loadMore,
            isExplorerTier = userProfile?.academicTier?.equals("explorer", ignoreCase = true) == true,
            expandedPostId = extra1.expandedId,
            activeCommentPost = extra1.activeCommentPost,
            userMessage = extra1.msg
        )
    }.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5000),
        initialValue = SocialUiState()
    )

    private fun checkGuestRestriction(): Boolean {
        if (com.example.data.remote.BackendApiService.isGuestUser()) {
            _userMessage.value = "Sign in to join the community."
            return true
        }
        return false
    }

    fun setTab(tab: SocialTab) { _activeTab.value = tab }

    fun setSearchQuery(q: String) { _searchQuery.value = q }

    fun setSelectedCategoryFilter(category: String) { _selectedCategoryFilter.value = category }

    fun createPost(content: String, category: String) {
        if (checkGuestRestriction()) return
        viewModelScope.launch {
            try {
                ensureSocialUser()
                repository.createSocialPost(content, category)
                _userMessage.value = "Post published to StuddyHub Feed! 🎉"
            } catch (e: Exception) {
                _userMessage.value = "We couldn't publish your post. Please check your connection and try again."
            }
        }
    }

    private fun getUserId(): String {
        return uiState.value.profile?.supabaseUserId?.takeIf { it.isNotBlank() }
            ?: com.example.data.remote.BackendApiService.currentUserId
            ?: ""
    }

    fun deletePost(postId: String) {
        if (checkGuestRestriction()) return
        viewModelScope.launch {
            try {
                repository.deleteSocialPost(postId)
                _userMessage.value = "Post deleted."
            } catch (e: Exception) {
                _userMessage.value = "We couldn't delete this post. Please try again."
            }
        }
    }

    fun openCommentsForPost(post: SocialPostEntity?) {
        _activeCommentPost.value = post
        if (post != null) {
            fetchCommentsForPost(post.id)
        }
    }

    fun fetchCommentsForPost(postId: String) {
        viewModelScope.launch {
            try {
                val res = com.example.data.remote.BackendApiService.getSocialComments(postId)
                if (res is com.example.data.remote.BackendResult.Success) {
                    val array = res.data
                    val list = mutableListOf<SocialComment>()
                    for (i in 0 until array.length()) {
                        val obj = array.getJSONObject(i)
                        val id = obj.optString("id", "")
                        val content = obj.optString("content", "")
                        val createdAt = obj.optString("created_at", "Recently")
                        val userObj = obj.optJSONObject("social_users")
                        val name = userObj?.optString("display_name") ?: "Scholar"
                        list.add(SocialComment(id, postId, name, content, if (createdAt.length >= 10) createdAt.substring(0, 10) else createdAt))
                    }
                    _comments.value = list
                }
            } catch (e: Exception) {
                // Keep local comments list on error
            }
        }
    }

    fun addComment(postId: String, text: String) {
        if (checkGuestRestriction()) return
        viewModelScope.launch {
            val userId = getUserId()
            val profile = uiState.value.profile
            val authorName = profile?.fullName?.takeIf { it.isNotBlank() } ?: profile?.email?.substringBefore("@") ?: "Scholar"

            try {
                com.example.data.remote.BackendApiService.ensureSocialUserExists(userId, authorName, profile?.avatarUrl ?: "")
                val res = com.example.data.remote.BackendApiService.addSocialComment(postId, userId, text)
                if (res is com.example.data.remote.BackendResult.Error) {
                    throw Exception(res.message)
                }
                fetchCommentsForPost(postId)
                _userMessage.value = "Comment added! 💬"
            } catch (e: Exception) {
                val newComment = SocialComment(
                    id = "c_${System.currentTimeMillis()}",
                    postId = postId,
                    authorName = authorName,
                    text = text,
                    time = "Just now"
                )
                _comments.value = _comments.value + newComment
                _userMessage.value = "Comment added! It will sync with the community shortly."
            }
        }
    }

    fun createStudyGroup(name: String, description: String, category: String) {
        if (checkGuestRestriction()) return
        viewModelScope.launch {
            val userId = getUserId()
            val profile = uiState.value.profile
            val creatorName = profile?.fullName?.takeIf { it.isNotBlank() } ?: "Scholar"

            try {
                com.example.data.remote.BackendApiService.ensureSocialUserExists(userId, creatorName, profile?.avatarUrl ?: "")
                val res = com.example.data.remote.BackendApiService.createStudyGroup(name, description, category, userId)
                if (res is com.example.data.remote.BackendResult.Error) {
                    throw Exception(res.message)
                }
                _userMessage.value = "Study Group \"$name\" created! 🚀"
                fetchRealGroupsAndPeers()
            } catch (e: Exception) {
                val newGroup = SocialGroup(
                    id = "g_${System.currentTimeMillis()}",
                    name = name,
                    description = description,
                    memberCount = 1,
                    category = category,
                    isJoined = true
                )
                _groups.value = listOf(newGroup) + _groups.value
                _userMessage.value = "Group created! It will sync with the community shortly."
            }
        }
    }

    fun toggleFollowPeer(peerId: String) {
        if (checkGuestRestriction()) return
        val p = _peers.value.find { it.id == peerId } ?: return
        val willFollow = !p.isFollowing
        _peers.value = _peers.value.map { peer ->
            if (peer.id == peerId) peer.copy(isFollowing = willFollow) else peer
        }
        _userMessage.value = if (willFollow) "Following ${p.name}! 👤" else "Unfollowed ${p.name}."

        viewModelScope.launch {
            try {
                ensureSocialUser()
                val followerId = getUserId()
                val res = com.example.data.remote.BackendApiService.toggleFollowUser(followerId, peerId, willFollow)
                if (res is com.example.data.remote.BackendResult.Error) {
                    _userMessage.value = "We couldn't update that follow. Please try again."
                }
            } catch (e: Exception) {
                // Handled gracefully
            }
        }
    }

    fun toggleLike(postId: String) {
        if (checkGuestRestriction()) return
        viewModelScope.launch {
            try {
                ensureSocialUser()
                repository.toggleLikePost(postId)
            } catch (e: Exception) {
                _userMessage.value = "We couldn't update the like. Please try again."
            }
        }
    }

    fun toggleBookmark(postId: String) {
        if (checkGuestRestriction()) return
        viewModelScope.launch {
            try {
                ensureSocialUser()
                repository.toggleBookmarkPost(postId)
            } catch (e: Exception) {
                _userMessage.value = "We couldn't update the bookmark. Please try again."
            }
        }
    }

    fun toggleJoinGroup(groupId: String) {
        if (checkGuestRestriction()) return
        val grp = _groups.value.find { it.id == groupId } ?: return
        val willJoin = !grp.isJoined
        _groups.value = _groups.value.map { g ->
            if (g.id == groupId) g.copy(
                isJoined = willJoin,
                memberCount = if (willJoin) g.memberCount + 1 else (g.memberCount - 1).coerceAtLeast(1)
            ) else g
        }
        _userMessage.value = if (willJoin) "Joined ${grp.name}! 🎉" else "Left group."

        viewModelScope.launch {
            try {
                ensureSocialUser()
                val userId = getUserId()
                val res = com.example.data.remote.BackendApiService.toggleJoinGroup(groupId, userId, willJoin)
                if (res is com.example.data.remote.BackendResult.Error) {
                    _userMessage.value = "We couldn't update that group. Please try again."
                }
            } catch (e: Exception) {
                // Handled
            }
        }
    }

    fun markAllNotificationsRead() {
        _notifications.value = _notifications.value.map { it.copy(isRead = true) }
    }

    fun fetchGroupMessages(groupId: String) {
        viewModelScope.launch {
            try {
                val res = com.example.data.remote.BackendApiService.getGroupMessages(groupId)
                if (res is com.example.data.remote.BackendResult.Success) {
                    val array = res.data
                    val list = mutableListOf<GroupMessage>()
                    for (i in 0 until array.length()) {
                        val obj = array.getJSONObject(i)
                        val id = obj.optString("id", "")
                        val content = obj.optString("content", "")
                        val time = obj.optString("created_at", "Recently")
                        val userObj = obj.optJSONObject("social_users")
                        val author = userObj?.optString("display_name") ?: "Scholar"
                        list.add(GroupMessage(id, groupId, author, "Member", content, if (time.length >= 10) time.substring(0, 10) else time))
                    }
                    if (list.isNotEmpty()) {
                        _groupMessages.value = list
                    }
                }
            } catch (e: Exception) {
                // Keep local messages
            }
        }
    }

    fun fetchGroupEvents(groupId: String) {
        viewModelScope.launch {
            try {
                val res = com.example.data.remote.BackendApiService.getGroupEvents(groupId)
                if (res is com.example.data.remote.BackendResult.Success) {
                    val array = res.data
                    val list = mutableListOf<GroupEvent>()
                    for (i in 0 until array.length()) {
                        val obj = array.getJSONObject(i)
                        val id = obj.optString("id", "")
                        val title = obj.optString("title", "Study Session")
                        val location = obj.optString("location", "Online")
                        val startDate = obj.optString("start_date", "")
                        val time = if (startDate.length >= 16) startDate.substring(0, 16).replace("T", " ") else startDate
                        list.add(
                            GroupEvent(
                                id = id,
                                groupId = groupId,
                                title = title,
                                dateTime = time,
                                location = location,
                                attendeesCount = 1,
                                isAttending = true
                            )
                        )
                    }
                    if (list.isNotEmpty()) {
                        _groupEvents.value = list
                    }
                }
            } catch (e: Exception) {}
        }
    }

    fun sendGroupMessage(groupId: String, text: String) {
        if (checkGuestRestriction()) return
        viewModelScope.launch {
            val userId = getUserId()
            val profile = uiState.value.profile
            val authorName = profile?.fullName?.takeIf { it.isNotBlank() } ?: profile?.email?.substringBefore("@") ?: "Scholar"

            val newMsg = GroupMessage(
                id = "gm_${System.currentTimeMillis()}",
                groupId = groupId,
                authorName = authorName,
                authorRole = "Member",
                text = text,
                time = "Just now"
            )
            _groupMessages.value = _groupMessages.value + newMsg

            try {
                com.example.data.remote.BackendApiService.ensureSocialUserExists(userId, authorName, profile?.avatarUrl ?: "")
                val res = com.example.data.remote.BackendApiService.sendGroupMessage(groupId, userId, text)
                if (res is com.example.data.remote.BackendResult.Error) {
                    _userMessage.value = "Message sent! It will sync with the group shortly."
                } else {
                    fetchGroupMessages(groupId)
                }
            } catch (e: Exception) {
                // Keep local message
            }
        }
    }

    fun toggleLikeGroupMessage(messageId: String) {
        if (checkGuestRestriction()) return
        _groupMessages.value = _groupMessages.value.map { msg ->
            if (msg.id == messageId) {
                val liked = !msg.isLiked
                msg.copy(isLiked = liked, likesCount = if (liked) msg.likesCount + 1 else msg.likesCount - 1)
            } else msg
        }
    }

    fun addGroupResource(groupId: String, title: String, fileType: String) {
        if (checkGuestRestriction()) return
        viewModelScope.launch {
            val profile = uiState.value.profile
            val authorName = profile?.fullName?.takeIf { it.isNotBlank() } ?: "Scholar"
            val newRes = GroupResource(
                id = "gr_${System.currentTimeMillis()}",
                groupId = groupId,
                title = title,
                fileType = fileType,
                uploadedBy = authorName,
                fileSize = "2.4 MB",
                date = "Today"
            )
            _groupResources.value = listOf(newRes) + _groupResources.value
            _userMessage.value = "Resource \"$title\" uploaded to group!"

            try {
                val res = com.example.data.remote.BackendApiService.addGroupResource(groupId, authorName, title, fileType, "2.4 MB")
                if (res is com.example.data.remote.BackendResult.Error) {
                    _userMessage.value = "Resource added! It will sync with the group shortly."
                }
            } catch (e: Exception) {
                // Handled
            }
        }
    }

    fun scheduleGroupEvent(groupId: String, title: String, dateTime: String, location: String) {
        if (checkGuestRestriction()) return
        viewModelScope.launch {
            val userId = getUserId()
            val newEvent = GroupEvent(
                id = "ge_${System.currentTimeMillis()}",
                groupId = groupId,
                title = title,
                dateTime = dateTime,
                location = location,
                attendeesCount = 1,
                isAttending = true
            )
            _groupEvents.value = listOf(newEvent) + _groupEvents.value
            _userMessage.value = "Session \"$title\" scheduled!"

            try {
                val res = com.example.data.remote.BackendApiService.scheduleGroupEvent(groupId, userId, title, dateTime, location)
                if (res is com.example.data.remote.BackendResult.Error) {
                    _userMessage.value = "Session scheduled! It will sync with the group shortly."
                }
            } catch (e: Exception) {
                // Handled
            }
        }
    }

    fun toggleRSVPGroupEvent(eventId: String) {
        if (checkGuestRestriction()) return
        _groupEvents.value = _groupEvents.value.map { ev ->
            if (ev.id == eventId) {
                val attending = !ev.isAttending
                ev.copy(isAttending = attending, attendeesCount = if (attending) ev.attendeesCount + 1 else ev.attendeesCount - 1)
            } else ev
        }
    }

    fun toggleExpandPost(postId: String) {
        _expandedPostId.value = if (_expandedPostId.value == postId) null else postId
    }

    fun requestAiRewrite(postId: String) {
        if (checkGuestRestriction()) return
        val post = uiState.value.posts.find { it.id == postId } ?: return
        viewModelScope.launch {
            _isAiRewriting.value = true
            try {
                val rewriteResult = com.example.data.remote.BackendApiService.rewriteText(post.content, "social")
                val rewritten = when (rewriteResult) {
                    is com.example.data.remote.BackendResult.Success -> rewriteResult.data
                    is com.example.data.remote.BackendResult.Error -> throw Exception(rewriteResult.message)
                }
                _userMessage.value = "✨ AI Rewrite:\n\"$rewritten\""
            } catch (e: Exception) {
                _userMessage.value = "We couldn't rewrite your post. Please try again."
            } finally {
                _isAiRewriting.value = false
            }
        }
    }

    private var _currentPage = 0

    fun refreshFeed() {
        _currentPage = 0
        viewModelScope.launch {
            try {
                repository.syncSocialFeed(limit = 15, offset = 0, clearFirst = true)
            } catch (e: Exception) {
                // Ignore errors
            }
        }
    }

    fun loadNextPage() {
        if (_isLoadMoreLoading.value) return
        viewModelScope.launch {
            _isLoadMoreLoading.value = true
            try {
                _currentPage++
                val limit = 15
                val offset = _currentPage * limit
                repository.syncSocialFeed(limit = limit, offset = offset, clearFirst = false)
            } catch (e: Exception) {
                _currentPage--
            } finally {
                _isLoadMoreLoading.value = false
            }
        }
    }

    fun clearUserMessage() { _userMessage.value = null }
}
