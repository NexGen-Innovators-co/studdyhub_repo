import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { 
  Search, Filter, SortAsc, SortDesc, RefreshCw, Bell, 
  TrendingUp, Users, User 
} from 'lucide-react';

// Import hooks
import { useSocialData } from './hooks/useSocialData';
import { useSocialActions } from './hooks/useSocialActions';
import { useSocialComments } from './hooks/useSocialComments';
import { useSocialNotifications } from './hooks/useSocialNotifications';

// Import components
import { PostCard } from './components/PostCard';
import { CreatePostDialog } from './components/CreatePostDialog';
import { TrendingSidebar } from './components/TrendingSidebar';
import { UserProfile } from './components/UserProfile';

// Import types
import { SocialFeedProps, SortBy, FilterBy, Privacy } from './types/social';

export const SocialFeed: React.FC<SocialFeedProps> = ({ userProfile }) => {
  // State management
  const [activeTab, setActiveTab] = useState<'feed' | 'trending' | 'groups' | 'profile'>('feed');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('newest');
  const [filterBy, setFilterBy] = useState<FilterBy>('all');
  const [showPostDialog, setShowPostDialog] = useState(false);
  
  // Post creation state
  const [newPostContent, setNewPostContent] = useState('');
  const [selectedPrivacy, setSelectedPrivacy] = useState<Privacy>('public');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  // Custom hooks
  const {
    posts,
    setPosts,
    currentUser,
    trendingHashtags,
    suggestedUsers,
    setSuggestedUsers,
    isLoading,
    refetchPosts,
  } = useSocialData(userProfile, sortBy, filterBy);

  const {
    createPost,
    toggleLike,
    toggleBookmark,
    sharePost,
    followUser,
    isUploading,
  } = useSocialActions(currentUser, posts, setPosts, setSuggestedUsers);

  const {
    fetchComments,
    addComment,
    updateNewComment,
    togglePostExpanded,
    isPostExpanded,
    getPostComments,
    isLoadingPostComments,
    getNewCommentContent,
  } = useSocialComments(currentUser, posts);

  const {
    notifications,
    unreadCount,
    markNotificationAsRead,
    markAllNotificationsAsRead,
  } = useSocialNotifications();

  // Handler functions
  const handleCreatePost = async () => {
    const success = await createPost(newPostContent, selectedPrivacy, selectedFiles);
    if (success) {
      setNewPostContent('');
      setSelectedFiles([]);
      setShowPostDialog(false);
    }
  };

  const handleCommentSubmit = (postId: string) => {
    addComment(postId);
  };

  const handleRefresh = () => {
    refetchPosts();
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-8">
            <Tabs value={activeTab} onValueChange={(value: any) => setActiveTab(value)} className="w-full">
              <div className="flex items-center justify-between mb-6">
                <TabsList className="grid w-full max-w-md grid-cols-4">
                  <TabsTrigger value="feed" className="text-xs">Feed</TabsTrigger>
                  <TabsTrigger value="trending" className="text-xs">Trending</TabsTrigger>
                  <TabsTrigger value="groups" className="text-xs">Groups</TabsTrigger>
                  <TabsTrigger value="profile" className="text-xs">Profile</TabsTrigger>
                </TabsList>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRefresh}
                    disabled={isLoading}
                  >
                    <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                  </Button>
                  <Button variant="outline" size="sm" className="relative">
                    <Bell className="h-4 w-4" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </Button>
                </div>
              </div>

              {/* Search and Filters */}
              <div className="flex items-center gap-3 mb-6">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    placeholder="Search posts, users, hashtags..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={sortBy} onValueChange={(value: SortBy) => setSortBy(value)}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">
                      <div className="flex items-center gap-2">
                        <SortDesc className="h-3 w-3" />
                        Newest
                      </div>
                    </SelectItem>
                    <SelectItem value="popular">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-3 w-3" />
                        Popular
                      </div>
                    </SelectItem>
                    <SelectItem value="trending">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-3 w-3" />
                        Trending
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterBy} onValueChange={(value: FilterBy) => setFilterBy(value)}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Posts</SelectItem>
                    <SelectItem value="following">Following</SelectItem>
                    <SelectItem value="groups">Groups</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <TabsContent value="feed" className="mt-0">
                <div className="space-y-6">
                  {/* Create Post */}
                  <CreatePostDialog
                    isOpen={showPostDialog}
                    onClose={() => setShowPostDialog(true)}
                    content={newPostContent}
                    onContentChange={setNewPostContent}
                    privacy={selectedPrivacy}
                    onPrivacyChange={setSelectedPrivacy}
                    selectedFiles={selectedFiles}
                    onFilesChange={setSelectedFiles}
                    onSubmit={handleCreatePost}
                    isUploading={isUploading}
                    currentUser={currentUser}
                  />

                  {/* Posts Feed */}
                  {isLoading ? (
                    <div className="flex justify-center py-8">
                      <RefreshCw className="h-8 w-8 animate-spin" />
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {posts.map((post) => (
                        <PostCard
                          key={post.id}
                          post={post}
                          onLike={toggleLike}
                          onBookmark={toggleBookmark}
                          onShare={sharePost}
                          onComment={() => togglePostExpanded(post.id)}
                          isExpanded={isPostExpanded(post.id)}
                          comments={getPostComments(post.id)}
                          isLoadingComments={isLoadingPostComments(post.id)}
                          newComment={getNewCommentContent(post.id)}
                          onCommentChange={(content) => updateNewComment(post.id, content)}
                          onSubmitComment={() => handleCommentSubmit(post.id)}
                          currentUser={currentUser}
                        />
                      ))}
                      {posts.length === 0 && (
                        <div className="text-center py-8">
                          <p className="text-muted-foreground">No posts to show. Create the first post!</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="trending" className="mt-0">
                <div className="text-center py-8">
                  <TrendingUp className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">Trending content coming soon!</p>
                </div>
              </TabsContent>

              <TabsContent value="groups" className="mt-0">
                <div className="text-center py-8">
                  <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">Groups feature coming soon!</p>
                </div>
              </TabsContent>

              <TabsContent value="profile" className="mt-0">
                <UserProfile
                  user={currentUser}
                  isOwnProfile={true}
                  onEditProfile={() => {}}
                />
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-4">
            <TrendingSidebar
              hashtags={trendingHashtags}
              suggestedUsers={suggestedUsers}
              onFollowUser={followUser}
            />
          </div>
        </div>
      </div>
    </div>
  );
};