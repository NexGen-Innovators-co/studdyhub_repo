import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '../../ui/avatar';
import { Button } from '../../ui/button';
import { SocialUserWithDetails, SocialPostWithDetails } from '../../../integrations/supabase/socialTypes';
import { EditProfileModal } from './EditProfileModal';
import { SocialCommentWithDetails } from '../../../integrations/supabase/socialTypes';
import { PostCard } from './PostCard';
import { RefreshCw } from 'lucide-react';

export interface UserProfileProps {
  user: SocialUserWithDetails | null;
  isOwnProfile: boolean;
  onEditProfile: (updates: {
    display_name?: string;
    username?: string;
    bio?: string;
    avatar_file?: File;
    interests?: string[];
  }) => Promise<boolean>;
  posts: SocialPostWithDetails[];
  isLoadingPosts: boolean;
  onLike: (postId: string, isLiked: boolean) => Promise<void>;
  onBookmark: (postId: string, isBookmarked: boolean) => Promise<void>;
  onShare: (post: SocialPostWithDetails) => Promise<void>;
  onComment: (postId: string) => void;
  isPostExpanded: (postId: string) => boolean;
  getPostComments: (postId: string) => SocialCommentWithDetails[];
  isLoadingPostComments: (postId: string) => boolean;
  getNewCommentContent: (postId: string) => string;
  onCommentChange: (postId: string, content: string) => void;
  onSubmitComment: (postId: string) => void;
  currentUser: SocialUserWithDetails | null;
  refetchPosts: () => Promise<void>;
  onPostView: (postId: string) => Promise<void>; // Add this line
}

export const UserProfile: React.FC<UserProfileProps> = ({
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
  refetchPosts,
  onPostView,
}) => {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  if (!user) {
    return (
      <Card className="bg-white dark:bg-gray-800 shadow-md">
        <CardContent className="p-6 text-center">
          <p className="text-slate-600 dark:text-gray-300">User not found</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="bg-white dark:bg-gray-800 shadow-md">
        <CardHeader className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-slate-800 dark:text-gray-200">
            {isOwnProfile ? 'My Profile' : `${user.display_name}'s Profile`}
          </CardTitle>
          {isOwnProfile && (
            <Button
              onClick={() => setIsEditModalOpen(true)}
              className="bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800"
            >
              Edit Profile
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-6">
          <div className="flex items-center gap-4 mb-4">
            <Avatar className="w-16 h-16">
              <AvatarImage src={user.avatar_url} />
              <AvatarFallback className="bg-slate-200 dark:bg-gray-700 text-slate-600 dark:text-gray-300">
                {user.display_name?.charAt(0).toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            <div>
              <h2 className="text-xl font-semibold text-slate-800 dark:text-gray-200">{user.display_name}</h2>
              <p className="text-sm text-slate-500 dark:text-gray-400">@{user.username}</p>
            </div>
          </div>
          <p className="text-slate-600 dark:text-gray-300 mb-4">{user.bio || 'No bio provided'}</p>
          <div className="mb-4">
            <h3 className="text-sm font-medium text-slate-600 dark:text-gray-300">Interests</h3>
            <div className="flex flex-wrap gap-2 mt-1">
              {user.interests?.length ? (
                user.interests.map((interest, index) => (
                  <span
                    key={index}
                    className="px-2 py-1 text-xs bg-slate-100 dark:bg-gray-700 text-slate-600 dark:text-gray-300 rounded-full"
                  >
                    {interest}
                  </span>
                ))
              ) : (
                <p className="text-sm text-slate-500 dark:text-gray-400">No interests specified</p>
              )}
            </div>
          </div>
          <div className="flex gap-4">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-gray-300">Posts</p>
              <p className="text-lg font-semibold text-slate-800 dark:text-gray-200">{posts.length}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-gray-300">Followers</p>
              <p className="text-lg font-semibold text-slate-800 dark:text-gray-200">{user.followers_count || 0}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-gray-300">Following</p>
              <p className="text-lg font-semibold text-slate-800 dark:text-gray-200">{user.following_count || 0}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white dark:bg-gray-800 shadow-md">
        <CardHeader className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-slate-800 dark:text-gray-200">
            {isOwnProfile ? 'My Posts' : `${user.display_name}'s Posts`}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          {isLoadingPosts ? (
            <div className="flex justify-center py-8">
              <RefreshCw className="h-8 w-8 animate-spin text-blue-600 dark:text-blue-400" />
            </div>
          ) : posts.length === 0 ? (
            <p className="text-center text-slate-600 dark:text-gray-300">No posts yet</p>
          ) : (
            <div className="space-y-6">
              {posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  onLike={onLike}
                  onBookmark={onBookmark}
                  onShare={onShare}
                  onComment={() => onComment(post.id)}
                  isExpanded={isPostExpanded(post.id)}
                  comments={getPostComments(post.id)}
                  isLoadingComments={isLoadingPostComments(post.id)}
                  newComment={getNewCommentContent(post.id)}
                  onCommentChange={(content) => onCommentChange(post.id, content)}
                  onSubmitComment={() => onSubmitComment(post.id)}
                  currentUser={currentUser}
                  onPostView={onPostView} // Pass the prop to PostCard
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

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