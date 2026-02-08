import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '../../ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '../../ui/avatar';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { EditProfileModal } from './EditProfileModal';
import { PostCard } from './PostCard';
import { Calendar, MapPin, Link as LinkIcon, Grid, Heart, Bookmark, Users, Loader2, UserPlus, Users2, UsersRound, Sparkles, User2Icon } from 'lucide-react';
import { formatEngagementCount } from '../utils/postUtils';
import { useNavigate } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import { supabase } from '../../../integrations/supabase/client';
import { SuggestedUsers } from './SuggestedUsers';
export const UserProfile: React.FC<any> = ({
  user,
  isOwnProfile,
  onEditProfile,
  posts,
  isLoadingPosts,
  onLike,
  onBookmark,
  onShare,
  onComment,
  isPostExpanded,
  getPostComments,
  isLoadingPostComments,
  getNewCommentContent,
  onCommentChange,
  onSubmitComment,
  isAddingComment,
  currentUser,
  onPostView,
  onClick,
  likedPosts = [],
  bookmarkedPosts = [],
  onRefreshLikedPosts,
  onRefreshBookmarkedPosts,
  userGroups = [],
  onDeletePost,
  onEditPost,
  onFollow,
  onStartChat,
  isFollowing: initialIsFollowing, // Rename prop to avoid conflict
  onToggleFollow,
  searchQuery = '',
}) => {
  // Update local state when prop changes
  useEffect(() => {
    setIsFollowing(initialIsFollowing || false);
  }, [initialIsFollowing]);

  // All hooks must be at the top and in the same order every render
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'posts' | 'likes' | 'saved' | 'groups' | 'followers' | 'following' | 'suggestions'>('posts');
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing || false);
  const [isFollowLoading, setIsFollowLoading] = useState(false);
  const [followers, setFollowers] = useState<any[]>([]);
  const [following, setFollowing] = useState<any[]>([]);
  const [suggested, setSuggested] = useState<any[]>([]);
  const [isLoadingFollowers, setIsLoadingFollowers] = useState(false);
  const [isLoadingFollowing, setIsLoadingFollowing] = useState(false);
  const [isLoadingSuggested, setIsLoadingSuggested] = useState(false);
  const [hasMoreFollowers, setHasMoreFollowers] = useState(true);
  const [hasMoreFollowing, setHasMoreFollowing] = useState(true);
  const [hasMoreSuggested, setHasMoreSuggested] = useState(true);
  const followersObserver = React.useRef<HTMLDivElement>(null);
  const followingObserver = React.useRef<HTMLDivElement>(null);
  const followersPage = React.useRef(0);
  const followingPage = React.useRef(0);
  const suggestedPage = React.useRef(0);
  const PAGE_SIZE = 20;
  const navigate = useNavigate();
  // Fetch followers (two-step: get IDs, then user details)
  const fetchFollowers = async () => {
    const profileUser = user || currentUser;
    if (!profileUser) return;
    setIsLoadingFollowers(true);
    const page = followersPage.current;
    // Step 1: Get follower IDs
    const { data: followRows, error: followError } = await supabase
      .from('social_follows')
      .select('follower_id')
      .eq('following_id', profileUser.id)
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    if (followError || !followRows || followRows.length === 0) {
      setHasMoreFollowers(false);
      setIsLoadingFollowers(false);
      return;
    }
    const followerIds = followRows.map((f: any) => f.follower_id);
    // Step 2: Get user details
    const { data: users, error: userError } = await supabase
      .from('social_users')
      .select('*')
      .in('id', followerIds);
    if (!userError && users) {
      setFollowers(prev => {
        const existingIds = new Set(prev.map((u: any) => u.id));
        const newUsers = users.filter((u: any) => !existingIds.has(u.id));
        return [...prev, ...newUsers];
      });
      setHasMoreFollowers(followRows.length === PAGE_SIZE);
      followersPage.current += 1;
    } else {
      setHasMoreFollowers(false);
    }
    setIsLoadingFollowers(false);
  };

  // Fetch following (two-step: get IDs, then user details)
  const fetchFollowing = async () => {
    const profileUser = user || currentUser;
    if (!profileUser) return;
    setIsLoadingFollowing(true);
    const page = followingPage.current;
    // Step 1: Get following IDs
    const { data: followRows, error: followError } = await supabase
      .from('social_follows')
      .select('following_id')
      .eq('follower_id', profileUser.id)
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    if (followError || !followRows || followRows.length === 0) {
      setHasMoreFollowing(false);
      setIsLoadingFollowing(false);
      return;
    }
    const followingIds = followRows.map((f: any) => f.following_id);
    // Step 2: Get user details
    const { data: users, error: userError } = await supabase
      .from('social_users')
      .select('*')
      .in('id', followingIds);
    if (!userError && users) {
      setFollowing(prev => {
        const existingIds = new Set(prev.map((u: any) => u.id));
        const newUsers = users.filter((u: any) => !existingIds.has(u.id));
        return [...prev, ...newUsers];
      });
      setHasMoreFollowing(followRows.length === PAGE_SIZE);
      followingPage.current += 1;
    } else {
      setHasMoreFollowing(false);
    }
    setIsLoadingFollowing(false);
  };

  // Fetch suggestions (users not followed by current user, not self)
  const fetchSuggestions = async () => {
    const profileUser = user || currentUser;
    if (!profileUser) return;
    
    setIsLoadingSuggested(true);
    const page = suggestedPage.current;

    try {
      const { data: response, error } = await supabase.functions.invoke('get-suggested-users', {
        body: { offset: page * PAGE_SIZE, limit: PAGE_SIZE },
      });

      if (error) throw error;

      const paginatedUsers = response?.users || [];

      if (paginatedUsers.length === 0) {
        setHasMoreSuggested(false);
      } else {
        setSuggested(prev => {
          const existingIds = new Set(prev.map((u: any) => u.id));
          const newUsers = paginatedUsers.filter((u: any) => !existingIds.has(u.id));
          return [...prev, ...newUsers];
        });
        setHasMoreSuggested(response?.hasMore ?? paginatedUsers.length === PAGE_SIZE);
        suggestedPage.current += 1;
      }
    } catch (error) {
      setHasMoreSuggested(false);
    } finally {
      setIsLoadingSuggested(false);
    }
  };

  // Infinite scroll observers
  useEffect(() => {
    if (activeTab === 'followers' && hasMoreFollowers && followersObserver.current) {
      const observer = new window.IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && !isLoadingFollowers) fetchFollowers();
      }, { threshold: 0.1 });
      observer.observe(followersObserver.current);
      return () => observer.disconnect();
    }
  }, [activeTab, hasMoreFollowers, isLoadingFollowers, followersObserver.current]);

  useEffect(() => {
    if (activeTab === 'following' && hasMoreFollowing && followingObserver.current) {
      const observer = new window.IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && !isLoadingFollowing) fetchFollowing();
      }, { threshold: 0.1 });
      observer.observe(followingObserver.current);
      return () => observer.disconnect();
    }
  }, [activeTab, hasMoreFollowing, isLoadingFollowing, followingObserver.current]);

  // Reset lists when switching tabs, but only when user/currentUser is loaded
  useEffect(() => {
    const profileUser = user || currentUser;
    if (!profileUser) return;
    if (activeTab === 'followers') {
      setFollowers([]); followersPage.current = 0; setHasMoreFollowers(true); fetchFollowers();
    } else if (activeTab === 'following') {
      setFollowing([]); followingPage.current = 0; setHasMoreFollowing(true); fetchFollowing();
    } else if (activeTab === 'suggestions') {
      setSuggested([]); suggestedPage.current = 0; setHasMoreSuggested(true); fetchSuggestions();
    }
    // eslint-disable-next-line
  }, [activeTab, user?.id, currentUser?.id]);

  const handleFollowSuggestedUser = async (userId: string) => {
    try {
      if (onFollow) {
        await onFollow(userId);
      } else if (onToggleFollow) {
        // This is a bit of a hack if onFollow isn't provided but onToggleFollow is
        // Usually onFollow is toggleFollow from useSocialActions
        await onToggleFollow();
      }
      
      // Remove from local suggested list on success
      const followedUser = suggested.find(u => u.id === userId);
      setSuggested(prev => prev.filter(u => u.id !== userId));

      // If we are on our own profile and the following list is loaded, add them there
      if (isOwnProfile && followedUser) {
        setFollowing(prev => {
          if (prev.some(u => u.id === userId)) return prev;
          return [followedUser, ...prev];
        });
      }
    } catch (error) {
      // Error handled by toast in the action
    }
  };

  const handleFollowToggle = async () => {
    if (isFollowLoading) return;

    setIsFollowLoading(true);
    try {
      // Optimistically update UI
      setIsFollowing(!isFollowing);

      // Call the actual follow function
      if (onToggleFollow) {
        await onToggleFollow();
      } else if (onFollow) {
        await onFollow(user.id);
      }

      // If we just followed them and the followers list is loaded, add current user to it
      if (!isOwnProfile && !isFollowing && currentUser) {
        setFollowers(prev => {
          if (prev.some(u => u.id === currentUser.id)) return prev;
          return [currentUser, ...prev];
        });
      } else if (!isOwnProfile && isFollowing && currentUser) {
        // If we unfollowed, remove current user from followers list
        setFollowers(prev => prev.filter(u => u.id !== currentUser.id));
      }
    } catch (error) {
      // Revert on error
      setIsFollowing(isFollowing);
      // Error handling for follow toggle is handled by UI toast
    } finally {
      setIsFollowLoading(false);
    }
  };

  // ✅ FIXED: Proper component function
  const TabButton = ({ id, icon: Icon, label }: any) => {
    return (
      <button
        onClick={() => {
          setActiveTab(id);
          if (id === 'likes') onRefreshLikedPosts?.();
          if (id === 'saved') onRefreshBookmarkedPosts?.();
        }}
        className={`flex items-center justify-center gap-2 flex-1 pb-4 border-b-2 transition-colors font-medium text-sm ${activeTab === id
          ? 'border-blue-600 text-blue-600'
          : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
      >
        <Icon className="h-4 w-4" />
        <span className="hidden sm:inline">{label}</span>
      </button>
    );
  };

  const LoadingSpinner = () => (
    <div className="flex flex-col items-center justify-center py-12">
      <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
    </div>
  );

  // Show loading spinner if user/currentUser is not loaded
  const profileUser = user || currentUser;

  // Filter lists based on searchQuery
  const filteredFollowers = React.useMemo(() => {
    if (!searchQuery) return followers;
    const term = searchQuery.toLowerCase();
    return followers.filter(u => 
      u.display_name?.toLowerCase().includes(term) || 
      u.username?.toLowerCase().includes(term)
    );
  }, [followers, searchQuery]);

  const filteredFollowing = React.useMemo(() => {
    if (!searchQuery) return following;
    const term = searchQuery.toLowerCase();
    return following.filter(u => 
      u.display_name?.toLowerCase().includes(term) || 
      u.username?.toLowerCase().includes(term)
    );
  }, [following, searchQuery]);

  const filteredSuggested = React.useMemo(() => {
    if (!searchQuery) return suggested;
    const term = searchQuery.toLowerCase();
    return suggested.filter(u => 
      u.display_name?.toLowerCase().includes(term) || 
      u.username?.toLowerCase().includes(term)
    );
  }, [suggested, searchQuery]);

  if (!profileUser) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600 mb-4" />
        <div className="text-slate-500 dark:text-slate-300 text-lg font-medium">Loading profile...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-500 max-w-[780px] lg:mx-auto">

      {/* 1. Immersive Header Card */}
      <div className="bg-white dark:bg-slate-900 shadow-sm overflow-hidden border border-slate-100 dark:border-slate-800">
        {/* Cover Photo */}
        <div className="h-48 bg-gradient-to-r from-blue-400 via-indigo-500 to-indigo-700 relative">
          {/* Optional: Add actual cover photo logic here */}
        </div>

        <div className="px-6 pb-6 relative">
          {/* Floating Avatar & Edit Button */}
          <div className="flex justify-between items-end -mt-12 mb-4">
            <Avatar className="w-32 h-32 ring-4 ring-white dark:ring-slate-900 shadow-lg">
              <AvatarImage src={profileUser.avatar_url} className="object-cover" />
              <AvatarFallback className="text-4xl bg-slate-200">{profileUser.display_name?.[0]}</AvatarFallback>
            </Avatar>

            {isOwnProfile && (
              <Button variant="outline" className="rounded-full border-slate-300 shadow-sm" onClick={() => setIsEditModalOpen(true)}>
                Edit Profile
              </Button>
            )}
            {!isOwnProfile && (
              <div className="flex gap-2 flex-1">
                <Button
                  onClick={onToggleFollow}
                  variant={isFollowing ? "outline" : "default"}
                  disabled={isFollowLoading}
                  className={`rounded-full font-medium transition-all relative overflow-hidden group ${isFollowing
                    ? "border-slate-300 hover:border-red-300 dark:hover:border-red-800"
                    : "bg-blue-600 hover:bg-blue-700 text-white"
                    } ${isFollowLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {isFollowLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <span className={`transition-all ${isFollowing ? "group-hover:opacity-0" : ""}`}>
                        {isFollowing ? "Following" : "Follow"}
                      </span>
                      {isFollowing && (
                        <span className="absolute inset-0 flex items-center justify-center text-red-600 dark:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                          Unfollow
                        </span>
                      )}
                    </>
                  )}
                </Button>
                {onStartChat && (
                  <Button
                    onClick={() => onStartChat(profileUser.id)}
                    variant="outline"
                    className="flex-1 rounded-full"
                  >
                    <MessageCircle className="h-4 w-4 mr-2" />
                    Message
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* User Info */}
          <div className="space-y-3">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                {profileUser.display_name}
                {profileUser.is_verified && <Badge variant="secondary" className="bg-blue-100 text-blue-700 h-5 px-1.5 text-[10px]">Verified</Badge>}
              </h1>
              <p className="text-slate-500 dark:text-slate-400 font-medium">@{profileUser.username}</p>
            </div>

            {profileUser.bio && <p className="text-slate-700 dark:text-slate-300 leading-relaxed max-w-2xl">{profileUser.bio}</p>}

            {/* Metadata Row */}
            <div className="flex flex-wrap gap-4 text-sm text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                Joined {new Date(profileUser.created_at).toLocaleDateString()}
              </div>
            </div>

            {/* Stats Row */}
            <div className="flex gap-6 pt-2">
              <div className="flex items-center gap-1">
                <span className="font-bold text-slate-900 dark:text-white">{formatEngagementCount(profileUser.followers_count || 0)}</span>
                <span className="text-slate-500">Followers</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="font-bold text-slate-900 dark:text-white">{formatEngagementCount(profileUser.following_count || 0)}</span>
                <span className="text-slate-500">Following</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="font-bold text-slate-900 dark:text-white">{formatEngagementCount(posts.length)}</span>
                <span className="text-slate-500">Posts</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex mt-2 px-6 border-b border-slate-100 dark:border-slate-800 overflow-x-auto">
          <TabButton id="posts" icon={Grid} label="Posts" />
          {isOwnProfile && <TabButton id="likes" icon={Heart} label="Liked" />}
          {isOwnProfile && <TabButton id="saved" icon={Bookmark} label="Saved" />}
          <TabButton id="groups" icon={UsersRound} label="Groups" />
          <TabButton id="followers" icon={User2Icon} label="Followers" />
          <TabButton id="following" icon={UserPlus} label="Following" />
          <TabButton id="suggestions" icon={Sparkles} label="Suggestions" />
        </div>
      </div>

      {/* 2. Content Area */}
      <div className="min-h-[200px]">
        {/* Posts Tab */}
        {activeTab === 'posts' && (
          <div className="lg:space-y-4 space-y-2">
            {posts.length === 0 && !isLoadingPosts ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                  <Grid className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">No posts yet</h3>
                <p className="text-slate-600 dark:text-slate-400 max-w-sm">
                  {isOwnProfile 
                    ? "You haven't created any posts yet. Share your thoughts and knowledge with the community!"
                    : "This user hasn't posted anything yet."}
                </p>
              </div>
            ) : (
              <>
                {posts.map((post: any) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    currentUser={currentUser}
                    onLike={onLike}
                    onBookmark={onBookmark}
                    onShare={onShare}
                    onComment={() => onComment(post.id)}
                    isExpanded={isPostExpanded(post.id)}
                    comments={getPostComments(post.id)}
                    isLoadingComments={isLoadingPostComments(post.id)}
                    newComment={getNewCommentContent(post.id)}
                    onCommentChange={(c) => onCommentChange(post.id, c)}
                    isAddingComment={isAddingComment?.(post.id)}
                    onSubmitComment={() => onSubmitComment(post.id)}
                    onDeletePost={onDeletePost}
                    onEditPost={onEditPost}
                  />
                ))}
              </>
            )}
            {isLoadingPosts && <LoadingSpinner />}
          </div>
        )}

        {activeTab === 'groups' && (
          <>
            {userGroups.length === 0 && !isLoadingPosts ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                  <Users className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">No groups</h3>
                <p className="text-slate-600 dark:text-slate-400 max-w-sm">
                  {isOwnProfile 
                    ? "You haven't joined any groups yet. Explore communities to connect with others!"
                    : "This user hasn't joined any groups yet."}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {userGroups.map((group: any) => (
                  <Card key={group.id} className="hover:shadow-md transition-all cursor-pointer border-none shadow-sm bg-white dark:bg-slate-900" onClick={() => navigate(`/social/group/${group.id}`)}>
                    <CardContent className="p-4 flex items-center gap-4">
                      <Avatar className="h-12 w-12 rounded-lg">
                        <AvatarImage src={group.avatar_url} />
                        <AvatarFallback className="rounded-lg">{group.name[0]}</AvatarFallback>
                      </Avatar>
                      <div>
                        <h3 className="font-bold text-slate-900 dark:text-white">{group.name}</h3>
                        <p className="text-xs text-slate-500">{group.members_count} members</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}

        {/* Likes/Saved Tabs */}
        {(activeTab === 'likes' || activeTab === 'saved') && (
          <div className="space-y-4">
            {(activeTab === 'likes' ? likedPosts : bookmarkedPosts).length === 0 && !isLoadingPosts ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                  {activeTab === 'likes' ? (
                    <Heart className="w-8 h-8 text-slate-400" />
                  ) : (
                    <Bookmark className="w-8 h-8 text-slate-400" />
                  )}
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                  {activeTab === 'likes' ? 'No liked posts' : 'No saved posts'}
                </h3>
                <p className="text-slate-600 dark:text-slate-400 max-w-sm">
                  {activeTab === 'likes' 
                    ? "Posts you like will appear here. Start exploring and showing some love!"
                    : "Posts you save will appear here. Bookmark content you want to revisit later."}
                </p>
              </div>
            ) : (
              <>
                {(activeTab === 'likes' ? likedPosts : bookmarkedPosts).map((post: any) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    currentUser={currentUser}
                    onLike={onLike}
                    onBookmark={onBookmark}
                    onShare={onShare}
                    onComment={() => onComment(post.id)}
                    isExpanded={isPostExpanded(post.id)}
                    comments={getPostComments(post.id)}
                    isLoadingComments={isLoadingPostComments(post.id)}
                    newComment={getNewCommentContent(post.id)}
                    onCommentChange={(c) => onCommentChange(post.id, c)}
                    isAddingComment={isAddingComment?.(post.id)}
                    onSubmitComment={() => onSubmitComment(post.id)}
                    onDeletePost={onDeletePost}
                    onEditPost={onEditPost}
                  />
                ))}
              </>
            )}
            {(isLoadingPostComments || isLoadingPosts) && <LoadingSpinner />}
          </div>
        )}

        {/* Followers Tab */}
        {activeTab === 'followers' && (
          <div>
            <h3 className="text-lg font-semibold mb-4">Followers</h3>
            <div>
              {filteredFollowers.map((f: any, idx: number) => (
                <div key={`follower-${f.id}-${idx}`} className="flex items-center gap-3 py-2 border-b">
                  <div 
                    className="flex items-center gap-3 flex-1 cursor-pointer group"
                    onClick={() => navigate(`/social/profile/${f.id}`)}
                  >
                    <Avatar className="h-8 w-8 group-hover:ring-2 group-hover:ring-blue-500/20 transition-all">
                      <AvatarImage src={f.avatar_url} />
                      <AvatarFallback>{f.display_name?.[0]}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="font-medium group-hover:text-blue-600 transition-colors">{f.display_name}</div>
                      <div className="text-xs text-slate-500">@{f.username}</div>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => navigate(`/social/profile/${f.id}`)}>View</Button>
                </div>
              ))}
              {isLoadingFollowers && <LoadingSpinner />}
              <div ref={followersObserver} />
              {!hasMoreFollowers && filteredFollowers.length === 0 && !isLoadingFollowers && <div className="text-center text-slate-400 py-8">No followers found.</div>}
            </div>
          </div>
        )}

        {/* Following Tab */}
        {activeTab === 'following' && (
          <div>
            <h3 className="text-lg font-semibold mb-4">Following</h3>
            {/* TODO: Render following list with infinite scroll */}
            <div>
              {filteredFollowing.map((f: any, idx: number) => (
                <div key={`following-${f.id}-${idx}`} className="flex items-center gap-3 py-2 border-b">
                  <div 
                    className="flex items-center gap-3 flex-1 cursor-pointer group"
                    onClick={() => navigate(`/social/profile/${f.id}`)}
                  >
                    <Avatar className="h-8 w-8 group-hover:ring-2 group-hover:ring-blue-500/20 transition-all">
                      <AvatarImage src={f.avatar_url} />
                      <AvatarFallback>{f.display_name?.[0]}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="font-medium group-hover:text-blue-600 transition-colors">{f.display_name}</div>
                      <div className="text-xs text-slate-500">@{f.username}</div>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => navigate(`/social/profile/${f.id}`)}>View</Button>
                </div>
              ))}
              {isLoadingFollowing && <LoadingSpinner />}
              <div ref={followingObserver} />
              {!hasMoreFollowing && filteredFollowing.length === 0 && !isLoadingFollowing && <div className="text-center text-slate-400 py-8">No following found.</div>}
            </div>
          </div>
        )}

        {/* Suggestions Tab */}
        {activeTab === 'suggestions' && (
          <div>
            <h3 className="text-lg font-semibold mb-4">Suggestions</h3>
            <SuggestedUsers
              users={filteredSuggested}
              onFollowUser={handleFollowSuggestedUser}
              isLoading={isLoadingSuggested}
              hasMore={hasMoreSuggested}
              onLoadMore={fetchSuggestions}
              hideHeader={true}
            />
          </div>
        )}
      </div>

      <EditProfileModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onConfirm={onEditProfile}
        user={user}
        isUploading={isLoadingPosts}
      />
    </div>
  );
};