import React, { useState } from 'react';
import { Card, CardContent } from '../../ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '../../ui/avatar';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { EditProfileModal } from './EditProfileModal';
import { PostCard } from './PostCard';
import { Calendar, MapPin, Link as LinkIcon, Grid, Heart, Bookmark, Users } from 'lucide-react';
import { formatEngagementCount } from '../utils/postUtils';
import { useNavigate } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';

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
  onFollow, // <-- new optional prop
  onStartChat,
  isFollowing,
  onToggleFollow,
}) => {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'posts' | 'likes' | 'saved' | 'groups'>('posts');
  const navigate = useNavigate();

  if (!user) return null;

  // Helpers
  const TabButton = ({ id, icon: Icon, label }: any) => (
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

  return (
    <div className="space-y-4 animate-in fade-in duration-500 max-w-[780px] mx-auto">

      {/* 1. Immersive Header Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm overflow-hidden border border-slate-100 dark:border-slate-800">
        {/* Cover Photo */}
        <div className="h-48 bg-gradient-to-r from-blue-400 via-indigo-500c relative">
          {/* Optional: Add actual cover photo logic here */}
        </div>

        <div className="px-6 pb-6 relative">
          {/* Floating Avatar & Edit Button */}
          <div className="flex justify-between items-end -mt-12 mb-4">
            <Avatar className="w-32 h-32 ring-4 ring-white dark:ring-slate-900 shadow-lg">
              <AvatarImage src={user.avatar_url} className="object-cover" />
              <AvatarFallback className="text-4xl bg-slate-200">{user.display_name?.[0]}</AvatarFallback>
            </Avatar>

            {isOwnProfile && (
              <Button variant="outline" className="rounded-full border-slate-300 shadow-sm" onClick={() => setIsEditModalOpen(true)}>
                Edit Profile
              </Button>
            )}
            {!isOwnProfile && (
              <div className="flex gap-2 flex-1">
                <Button
                  onClick={() => onToggleFollow?.()}
                  variant={isFollowing ? "outline" : "default"}
                  className={`rounded-full font-medium transition-all relative overflow-hidden group ${isFollowing
                      ? "border-slate-300 hover:border-red-300 dark:hover:border-red-800"
                      : "bg-blue-600 hover:bg-blue-700 text-white"
                    }`}
                >
                  <span className={`transition-all ${isFollowing ? "group-hover:opacity-0" : ""}`}>
                    {isFollowing ? "Following" : "Follow"}
                  </span>
                  {isFollowing && (
                    <span className="absolute inset-0 flex items-center justify-center text-red-600 dark:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                      Unfollow
                    </span>
                  )}
                </Button>
                {onStartChat && (
                  <Button
                    onClick={() => onStartChat(user.id)}
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
                {user.display_name}
                {user.is_verified && <Badge variant="secondary" className="bg-blue-100 text-blue-700 h-5 px-1.5 text-[10px]">Verified</Badge>}
              </h1>
              <p className="text-slate-500 dark:text-slate-400 font-medium">@{user.username}</p>
            </div>

            {user.bio && <p className="text-slate-700 dark:text-slate-300 leading-relaxed max-w-2xl">{user.bio}</p>}

            {/* Metadata Row */}
            <div className="flex flex-wrap gap-4 text-sm text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-1"><Calendar className="h-4 w-4" /> Joined {new Date(user.created_at).toLocaleDateString()}</div>
              {/* Add Location/Website if available in data model */}
              {/* <div className="flex items-center gap-1"><MapPin className="h-4 w-4" /> New York, USA</div> */}
            </div>

            {/* Stats Row */}
            <div className="flex gap-6 pt-2">
              <div className="flex items-center gap-1">
                <span className="font-bold text-slate-900 dark:text-white">{formatEngagementCount(user.followers_count || 0)}</span>
                <span className="text-slate-500">Followers</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="font-bold text-slate-900 dark:text-white">{formatEngagementCount(user.following_count || 0)}</span>
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
        <div className="flex mt-2 px-6 border-b border-slate-100 dark:border-slate-800">
          <TabButton id="posts" icon={Grid} label="Posts" />
          {isOwnProfile && (
            <>
              <TabButton id="likes" icon={Heart} label="Liked" />
              <TabButton id="saved" icon={Bookmark} label="Saved" />
            </>
          )}
          <TabButton id="groups" icon={Users} label="Groups" />
        </div>
      </div>

      {/* 2. Content Area */}
      <div className="min-h-[200px]">
        {activeTab === 'posts' && (
          <div className="space-y-4">
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
                onSubmitComment={() => onSubmitComment(post.id)}
                onDeletePost={onDeletePost}
                onEditPost={onEditPost}
              />
            ))}
          </div>
        )}

        {activeTab === 'groups' && (
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

        {/* Placeholders for Likes/Saved */}
        {(activeTab === 'likes' || activeTab === 'saved') && (
          <div className="space-y-4">
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
                onSubmitComment={() => onSubmitComment(post.id)}
                onDeletePost={onDeletePost}
                onEditPost={onEditPost}
              />
            ))}
            {((activeTab === 'likes' && likedPosts.length === 0) || (activeTab === 'saved' && bookmarkedPosts.length === 0)) && (
              <div className="text-center py-12 text-slate-400">No items found here yet.</div>
            )}
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