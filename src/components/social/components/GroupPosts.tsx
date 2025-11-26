// GroupPosts.tsx - Updated to use PostCard and hooks
import React, { useState, useEffect } from 'react';
import { supabase } from '../../../integrations/supabase/client';
import { Button } from '../../ui/button';
import { Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { PostCard } from './PostCard';
import { CreatePostDialog } from './CreatePostDialog';
import { SocialPostWithDetails } from '../../../integrations/supabase/socialTypes';
import { useSocialActions } from '../hooks/useSocialActions';
import { SharePostToChatModal } from './SharePostToChatModal';
import { useChatData } from '../hooks/useChatData';
import { useChatActions } from '../hooks/useChatActions';
import { useSocialPostViews } from '../hooks/useSocialPostViews';
interface GroupPostsProps {
  groupId: string;
  currentUser: any;
}

export const GroupPosts: React.FC<GroupPostsProps> = ({ groupId, currentUser }) => {
  const [posts, setPosts] = useState<SocialPostWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);
  const [postComments, setPostComments] = useState<Record<string, any[]>>({});
  const [isLoadingComments, setIsLoadingComments] = useState<Record<string, boolean>>({});
  const [newComments, setNewComments] = useState<Record<string, string>>({});
  const [postToShare, setPostToShare] = useState<SocialPostWithDetails | null>(null);
  const [newPostContent, setNewPostContent] = useState('');
  const [newPostPrivacy, setNewPostPrivacy] = useState<'public' | 'followers' | 'private'>('public');
  const [newPostFiles, setNewPostFiles] = useState<File[]>([]);
  const [showSharePostModal, setShowSharePostModal] = useState(false);

  const { trackPostView, cleanup } = useSocialPostViews(setPosts);

  // Use the social actions hook
  const {
    toggleLike,
    toggleBookmark,
    sharePost,
    deletePost,
    editPost,
    isUploading,
    createPost,
  } = useSocialActions(
    currentUser,
    posts,
    setPosts,
    () => {}, // setSuggestedUsers - not needed here
    [], // groups
    () => {}, // setGroups
    () => {}  // setCurrentUser
  );

  // Chat hooks
  const {
    chatSessions,
    isLoadingSessions,
  } = useChatData(currentUser?.id || null);

  const {
    sendMessageWithResource,
    isSending: isSendingMessage,
  } = useChatActions(currentUser?.id || null);

  const handleSharePostMessage = async (sessionId: string, message: string): Promise<boolean> => {
    if (!postToShare) return false;
    const result = await sendMessageWithResource(sessionId, message, postToShare.id, 'post');
    sharePost(postToShare); // Increment share count
    // No addOptimisticMessage here as it's not the main chat window
    if (result) {
      setPostToShare(null);
      setShowSharePostModal(false);
    }
    return !!result;
  };

  useEffect(() => {
    if (groupId) {
      fetchGroupPosts();
    }
  }, [groupId]);

  const fetchGroupPosts = async () => {
    try {
      setIsLoading(true);
      const { data: postsData, error } = await supabase
        .from('social_posts')
        .select(`
          *,
          author:social_users(*),
          group:social_groups(*),
          media:social_media(*)
        `)
        .eq('group_id', groupId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (!postsData || postsData.length === 0) {
        setPosts([]);
        return;
      }

      const postIds = postsData.map(post => post.id);

      const [hashtagResult, tagResult, likeResult, bookmarkResult] = await Promise.all([
        supabase
          .from('social_post_hashtags')
          .select(`post_id, hashtag:social_hashtags(*)`)
          .in('post_id', postIds),
        supabase
          .from('social_post_tags')
          .select(`post_id, tag:social_tags(*)`)
          .in('post_id', postIds),
        currentUser ? supabase
          .from('social_likes')
          .select('post_id')
          .eq('user_id', currentUser.id)
          .in('post_id', postIds) : { data: [] },
        currentUser ? supabase
          .from('social_bookmarks')
          .select('post_id')
          .eq('user_id', currentUser.id)
          .in('post_id', postIds) : { data: [] }
      ]);

      const transformedPosts = postsData.map(post => {
        const postHashtags = hashtagResult.data?.filter(ph => ph.post_id === post.id)?.map(ph => ph.hashtag)?.filter(Boolean) || [];
        const postTags = tagResult.data?.filter(pt => pt.post_id === post.id)?.map(pt => pt.tag)?.filter(Boolean) || [];
        const isLiked = likeResult.data?.some(like => like.post_id === post.id) || false;
        const isBookmarked = bookmarkResult.data?.some(bookmark => bookmark.post_id === post.id) || false;

        return {
          ...post,
          privacy: post.privacy as "public" | "followers" | "private",
          media: (post.media || []).map((m: any) => ({
            ...m,
            type: m.type as "image" | "video" | "document"
          })),
          group: post.group ? { ...post.group, privacy: post.group.privacy as "public" | "private" } : undefined,
          hashtags: postHashtags,
          tags: postTags,
          is_liked: isLiked,
          is_bookmarked: isBookmarked,
          views_count: post.views_count || 0,
        };
      });

      setPosts(transformedPosts);
    } catch (error) {
      console.error('Error fetching group posts:', error);
      toast.error('Failed to load posts');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePostView = async (postId: string) => {
    await trackPostView(postId);
  };

  const fetchComments = async (postId: string) => {
    try {
      setIsLoadingComments(prev => ({ ...prev, [postId]: true }));
      
      const { data, error } = await supabase
        .from('social_comments')
        .select('*, author:social_users(*)')
        .eq('post_id', postId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setPostComments(prev => ({ ...prev, [postId]: data || [] }));
    } catch (error) {
      console.error('Error fetching comments:', error);
      toast.error('Failed to load comments');
    } finally {
      setIsLoadingComments(prev => ({ ...prev, [postId]: false }));
    }
  };

  const handleComment = (postId: string) => {
    if (expandedPostId === postId) {
      setExpandedPostId(null);
    } else {
      setExpandedPostId(postId);
      if (!postComments[postId]) {
        fetchComments(postId);
      }
    }
  };

  const handleSubmitComment = async (postId: string) => {
    const content = newComments[postId]?.trim();
    if (!content || !currentUser) return;

    try {
      const { data, error } = await supabase
        .from('social_comments')
        .insert({
          post_id: postId,
          author_id: currentUser.id,
          content,
        })
        .select('*, author:social_users(*)')
        .single();

      if (error) throw error;

      setPostComments(prev => ({
        ...prev,
        [postId]: [data, ...(prev[postId] || [])]
      }));

      setNewComments(prev => ({ ...prev, [postId]: '' }));

      // Update comments count
      setPosts(prev => prev.map(p =>
        p.id === postId ? { ...p, comments_count: p.comments_count + 1 } : p
      ));

      toast.success('Comment added');
    } catch (error) {
      console.error('Error submitting comment:', error);
      toast.error('Failed to add comment');
    }
  };

  const handlePostCreated = () => {
    setIsCreateDialogOpen(false);
    setNewPostContent('');
    setNewPostPrivacy('public');
    setNewPostFiles([]);
    fetchGroupPosts();
  };

  const handleCreatePost = async () => {
    if (!newPostContent.trim()) {
      toast.error('Please enter some content');
      return;
    }

    const success = await createPost(
      newPostContent,
      newPostPrivacy,
      newPostFiles,
      groupId
    );

    if (success) {
      handlePostCreated();
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Create Post Button */}
      <div className="flex justify-end px-4 pt-4">
        <Button
          onClick={() => setIsCreateDialogOpen(true)}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          Create Post
        </Button>
      </div>

      {/* Posts List */}
      {posts.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-slate-500">No posts yet</p>
          <Button
            onClick={() => setIsCreateDialogOpen(true)}
            className="mt-4"
          >
            Create First Post
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              currentUser={currentUser}
              onLike={toggleLike}
              onBookmark={toggleBookmark}
              onShare={sharePost}
              onComment={() => handleComment(post.id)}
              onDeletePost={deletePost}
              onEditPost={editPost}
              onPostView={handlePostView}
              onShareToChat={(post) => {
                setPostToShare(post);
                setShowSharePostModal(true);
              }}
              isExpanded={expandedPostId === post.id}
              comments={postComments[post.id] || []}
              isLoadingComments={isLoadingComments[post.id] || false}
              newComment={newComments[post.id] || ''}
              onCommentChange={(value) =>
                setNewComments(prev => ({ ...prev, [post.id]: value }))
              }
              onSubmitComment={() => handleSubmitComment(post.id)}
            />
          ))}
        </div>
      )}

      {/* Create Post Dialog */}
      <CreatePostDialog
        isOpen={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        content={newPostContent}
        onContentChange={setNewPostContent}
        privacy={newPostPrivacy}
        onPrivacyChange={setNewPostPrivacy}
        selectedFiles={newPostFiles}
        onFilesChange={setNewPostFiles}
        onSubmit={handleCreatePost}
        isUploading={isUploading}
        currentUser={currentUser}
        groupId={groupId}
      />

      {/* Share to Chat Dialog */}
      {postToShare && (
        <SharePostToChatModal
        isOpen={showSharePostModal}
        onClose={() => {
          setShowSharePostModal(false);
          setPostToShare(null);
        }}
        post={postToShare}
        chatSessions={chatSessions}
        currentUserId={currentUser?.id || ''}
        onShare={handleSharePostMessage}
        isSharing={isSendingMessage}

        />
      )}
    </div>
  );
};