
import { useState } from 'react';
import { supabase } from '../../../integrations/supabase/client';
import { SocialPostWithDetails, SocialUserWithDetails, SocialGroupWithDetails, SocialGroup, CreateGroupData, GroupPrivacy } from '../../../integrations/supabase/socialTypes';
import { toast } from 'sonner';
import { extractHashtags } from '../utils/postUtils';
import { Privacy } from '../types/social';
import { v4 as uuidv4 } from 'uuid';
import { offlineStorage, STORES } from '../../../utils/offlineStorage';
import { createNotification } from '../../../services/notificationHelpers';

export const useSocialActions = (
  currentUser: SocialUserWithDetails | null,
  posts: SocialPostWithDetails[],
  setPosts: React.Dispatch<React.SetStateAction<SocialPostWithDetails[]>>,
  setSuggestedUsers: React.Dispatch<React.SetStateAction<SocialUserWithDetails[]>>,
  groups: SocialGroupWithDetails[],
  setGroups: React.Dispatch<React.SetStateAction<SocialGroupWithDetails[]>>,
  setCurrentUser: React.Dispatch<React.SetStateAction<SocialUserWithDetails | null>>,
  refetchCurrentUser?: () => Promise<void>
) => {
  const [isUploading, setIsUploading] = useState(false);

  const uploadFile = async (file: File): Promise<string | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from('social-media')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) throw error;

      // Construct public URL
      const { data: { publicUrl } } = supabase.storage
        .from('social-media')
        .getPublicUrl(fileName);

      return publicUrl;
    } catch (error) {

      toast.error('File upload failed.');
      return null;
    }
  };

  // --- Group Actions ---

  const createGroup = async (groupData: CreateGroupData): Promise<SocialGroupWithDetails | null> => {
    if (!currentUser) {
      toast.error('You must be logged in to create a group.');
      return null;
    }

    try {
      if (!navigator.onLine) {
        const offlineId = `offline-${uuidv4()}`;
        const optimisticGroup: SocialGroupWithDetails = {
          id: offlineId,
          name: groupData.name,
          description: groupData.description || '',
          avatar_url: groupData.avatar_url || null,
          cover_image_url: groupData.cover_image_url || null,
          category: groupData.category || 'general',
          privacy: groupData.privacy as any,
          members_count: 1,
          posts_count: 0,
          created_by: currentUser.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          is_member: true,
          member_role: 'admin',
          member_status: 'active',
          creator: currentUser as any
        };

        setGroups(prev => [optimisticGroup, ...prev]);
        await offlineStorage.save(STORES.SOCIAL_GROUPS, optimisticGroup);
        await offlineStorage.addPendingSync('create', STORES.SOCIAL_GROUPS, {
          name: groupData.name,
          description: groupData.description,
          privacy: groupData.privacy,
          created_by: currentUser.id
        });

        toast.success('Group created offline');
        return optimisticGroup;
      }

      // Use edge function to create group with validation
      const { data: response, error: functionError } = await supabase.functions.invoke('create-study-group', {
        body: {
          name: groupData.name,
          description: groupData.description,
          subject: groupData.category || 'general',
          privacy: groupData.privacy,
          max_members: 50,
          cover_image_url: `https://placehold.co/100x100/1e40af/ffffff?text=${groupData.name.charAt(0)}`
        }
      });

      if (functionError) {
        // Handle subscription limit errors
        if (functionError.message) {
          toast.error(functionError.message);
        } else {
          toast.error('Failed to create group');
        }
        return null;
      }

      if (!response?.success || !response?.group) {
        throw new Error('Failed to create group');
      }

      const newGroup = response.group as SocialGroup;

      // The edge function already adds the creator as a member, so skip client insert

      // Optionally, you can fetch the latest members_count if needed, or trust the backend
      toast.success(`Group "${newGroup.name}" created successfully!`);

      const newGroupWithDetails: SocialGroupWithDetails = {
        ...newGroup,
        creator: currentUser,
        is_member: true,
        member_role: 'admin',
        member_status: 'active'
      };
      setGroups(prev => [newGroupWithDetails, ...prev]);
      return newGroupWithDetails;

    } catch (error) {
      toast.error('Failed to create group. Please try again.');
      return null;
    }
  };

  const joinGroup = async (groupId: string, privacy: GroupPrivacy): Promise<boolean> => {
    if (!currentUser) {
      toast.error('You must be logged in to join a group.');
      return false;
    }

    try {
      const status = privacy === 'public' ? 'active' : 'pending';

      // For private groups, still need client insert with pending status
      if (privacy !== 'public') {
        const { error } = await supabase
          .from('social_group_members')
          .insert({
            group_id: groupId,
            user_id: currentUser.id,
            role: 'member',
            status: 'pending'
          });
        if (error) throw error;

        setGroups(prev => prev.map(g => g.id === groupId ? {
          ...g,
          is_member: false,
          member_status: 'pending',
          member_role: 'member',
        } : g));

        toast.info('Request to join sent. Waiting for admin approval.');
        return true;
      }

      // Use edge function for public groups (handles insert + count update)
      const { data: response, error } = await supabase.functions.invoke('join-leave-group', {
        body: { group_id: groupId, action: 'join' },
      });

      if (error || !response?.success) {
        toast.error('Failed to join group. You might already have a pending request.');
        return false;
      }

      setGroups(prev => prev.map(g => g.id === groupId ? {
        ...g,
        is_member: true,
        member_status: 'active',
        member_role: 'member',
        members_count: response.members_count ?? g.members_count,
      } : g));

      toast.success('Successfully joined the group!');
      return true;

    } catch (error) {
      toast.error('Failed to join group. You might already have a pending request.');
      return false;
    }
  };

  const leaveGroup = async (groupId: string): Promise<boolean> => {
    if (!currentUser) {
      toast.error('You must be logged in to leave a group.');
      return false;
    }

    try {
      const { data: response, error } = await supabase.functions.invoke('join-leave-group', {
        body: { group_id: groupId, action: 'leave' },
      });

      if (error || !response?.success) {
        toast.error('Failed to leave group. Please try again.');
        return false;
      }

      setGroups(prev => prev.map(g => g.id === groupId ? {
        ...g,
        is_member: false,
        member_status: null,
        member_role: null,
        members_count: response.members_count ?? g.members_count,
      } : g));

      toast.info('You have left the group.');
      return true;

    } catch (error) {
      toast.error('Failed to leave group. Please try again.');
      return false;
    }
  };

  const isGroupMember = (groupId: string): boolean => {
    const group = groups.find(g => g.id === groupId);
    return group?.is_member ?? false;
  }
  const updateProfile = async (
    updates: {
      display_name?: string;
      username?: string;
      bio?: string;
      avatar_file?: File;
      interests?: string[];
    }
  ) => {
    try {
      setIsUploading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      let avatar_url = currentUser?.avatar_url;
      if (updates.avatar_file) {
        avatar_url = await uploadFile(updates.avatar_file);
        if (!avatar_url) throw new Error('Failed to upload avatar');
      }

      const { data: updatedUser, error } = await supabase
        .from('social_users')
        .update({
          display_name: updates.display_name || currentUser?.display_name,
          username: updates.username || currentUser?.username,
          bio: updates.bio || currentUser?.bio,
          avatar_url: avatar_url || currentUser?.avatar_url,
          interests: updates.interests || currentUser?.interests,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)
        .select()
        .single();

      if (error) throw error;

      setCurrentUser(updatedUser);
      toast.success('Profile updated successfully!');
      return true;
    } catch (error) {
      ////console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
      return false;
    } finally {
      setIsUploading(false);
    }
  };

  const createPost = async (content: string, privacy: Privacy, selectedFiles: File[], groupId?: string, metadata?: any) => {
    if (!content.trim()) return;

    try {
      setIsUploading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      if (!navigator.onLine) {
        const offlineId = `offline-${uuidv4()}`;
        const optimisticPost: SocialPostWithDetails = {
          id: offlineId,
          content,
          privacy: privacy as any,
          author_id: user.id,
          group_id: groupId || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          likes_count: 0,
          comments_count: 0,
          shares_count: 0,
          bookmarks_count: 0,
          is_liked: false,
          is_bookmarked: false,
          author: currentUser as any,
          media: [],
          hashtags: extractHashtags(content).map(h => ({ 
            id: `offline-tag-${uuidv4()}`,
            name: h,
            posts_count: 0,
            created_at: new Date().toISOString()
          })),
          tags: []
        };

        // Save to local state
        setPosts(prev => [optimisticPost, ...prev]);
        
        // Save to IndexedDB
        await offlineStorage.save(STORES.SOCIAL_POSTS, optimisticPost);
        
        // Add to pending sync
        await offlineStorage.addPendingSync('create', STORES.SOCIAL_POSTS, {
          content,
          privacy,
          group_id: groupId,
          metadata,
          author_id: user.id
        });

        toast.success('Post saved offline. It will be published when you are back online.');
        return true;
      }

      // Upload media files first and create media objects
      const media: Array<{
        type: string;
        url: string;
        filename: string;
        size_bytes: number;
        mime_type: string;
        thumbnail_url?: string;
      }> = [];

      for (const file of selectedFiles) {
        const url = await uploadFile(file);
        if (url) {
          media.push({
            type: file.type.startsWith('image/') ? 'image' 
                  : file.type.startsWith('video/') ? 'video' 
                  : 'document',
            url: url,
            filename: file.name,
            size_bytes: file.size,
            mime_type: file.type,
            thumbnail_url: null
          });
        }
      }

      // Use edge function to create post with validation
      const { data: response, error: functionError } = await supabase.functions.invoke('create-social-post', {
        body: {
          content,
          privacy,
          media: media,
          group_id: groupId,
          metadata: metadata
        }
      });

      if (functionError) {
        // Handle subscription limit errors
        if (functionError.message) {
          toast.error(functionError.message);
        } else {
          toast.error('Failed to create post. Please try again.');
        }
        return false;
      }

      // Handle content moderation rejection
      if (!response?.success && response?.moderation) {
        // Show a friendly toast notification
        toast.error('Post needs revision', {
          description: response.moderation.reason || 'Content does not meet educational guidelines',
          duration: 5000,
        });
        
        return {
          success: false,
          moderation: response.moderation
        };
      }

      if (!response?.success || !response?.post) {
        toast.error('Failed to create post. Please try again.');
        throw new Error('Failed to create post');
      }

      // Hashtags, author data fetch, and posts_count update are now handled server-side
      // by the create-social-post edge function

      toast.success('Post created successfully!');
      return true;
    } catch (error) {
      ////console.error('Error creating post:', error);
      toast.error('Failed to create post');
      return false;
    } finally {
      setIsUploading(false);

    }
  };
  const toggleLike = async (postId: string, isLiked: boolean) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        toast.error('You must be logged in to like posts');
        return;
      }

      const userId = session.user.id;

      if (!navigator.onLine) {
        setPosts(prev => prev.map(p => {
          if (p.id === postId) {
            const updatedPost = structuredClone(p);
            updatedPost.is_liked = !isLiked;
            updatedPost.likes_count = p.likes_count + (isLiked ? -1 : 1);
            return updatedPost;
          }
          return p;
        }));

        await offlineStorage.addPendingSync(isLiked ? 'delete' : 'create', 'social_likes', { post_id: postId, user_id: userId });
        toast.info(isLiked ? 'Unliked offline' : 'Liked offline');
        return;
      }

      // Optimistic update
      setPosts(prev => prev.map(post => {
        if (post.id === postId) {
          const updatedPost = structuredClone(post);
          updatedPost.is_liked = !isLiked;
          updatedPost.likes_count = isLiked ? post.likes_count - 1 : post.likes_count + 1;
          return updatedPost;
        }
        return post;
      }));

      const { data: response, error } = await supabase.functions.invoke('toggle-like', {
        body: { post_id: postId, is_liked: isLiked },
      });

      if (error || !response?.success) {
        // Revert optimistic update
        setPosts(prev => prev.map(post => {
          if (post.id === postId) {
            const revertedPost = structuredClone(post);
            revertedPost.is_liked = isLiked;
            revertedPost.likes_count = isLiked ? post.likes_count + 1 : post.likes_count - 1;
            return revertedPost;
          }
          return post;
        }));
        toast.error(isLiked ? 'Failed to unlike post' : 'Failed to like post');
        return;
      }

      // Send push notification for new likes (client-side push only)
      if (!isLiked) {
        const post = posts.find(p => p.id === postId);
        if (post && post.author_id !== userId) {
          const actorName = response.actor_name || currentUser?.display_name || 'Someone';
          await createNotification({
            userId: post.author_id,
            type: 'social_like',
            title: 'New like on your post',
            message: `${actorName} liked your post`,
            data: { post_id: postId, actor_id: userId },
            icon: currentUser?.avatar_url,
            image: post?.media?.[0]?.url,
            saveToDb: false
          });
        }
      }
    } catch (error) {
      setPosts(prev => prev.map(post => {
        if (post.id === postId) {
          const revertedPost = structuredClone(post);
          revertedPost.is_liked = isLiked;
          revertedPost.likes_count = isLiked ? post.likes_count + 1 : post.likes_count - 1;
          return revertedPost;
        }
        return post;
      }));
      toast.error('Failed to update like');
    }
  };

  const toggleBookmark = async (postId: string, isBookmarked: boolean) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (!navigator.onLine) {
        // Optimistic update
        setPosts(prev => prev.map(post => {
          if (post.id === postId) {
            const updatedPost = structuredClone(post);
            updatedPost.bookmarks_count = isBookmarked ? post.bookmarks_count - 1 : post.bookmarks_count + 1;
            updatedPost.is_bookmarked = !isBookmarked;
            return updatedPost;
          }
          return post;
        }));

        await offlineStorage.addPendingSync(isBookmarked ? 'delete' : 'create', 'social_bookmarks', { post_id: postId, user_id: user.id });

        toast.info(isBookmarked ? 'Removed from bookmarks offline' : 'Bookmarked offline');
        return;
      }

      // Optimistic update first
      setPosts(prev => prev.map(post => {
        if (post.id === postId) {
          const updatedPost = structuredClone(post);
          updatedPost.bookmarks_count = isBookmarked ? post.bookmarks_count - 1 : post.bookmarks_count + 1;
          updatedPost.is_bookmarked = !isBookmarked;
          return updatedPost;
        }
        return post;
      }));

      const { data: response, error } = await supabase.functions.invoke('toggle-bookmark', {
        body: { post_id: postId, is_bookmarked: isBookmarked },
      });

      if (error || !response?.success) {
        // Revert optimistic update on error
        setPosts(prev => prev.map(post => {
          if (post.id === postId) {
            const revertedPost = structuredClone(post);
            revertedPost.bookmarks_count = isBookmarked ? post.bookmarks_count + 1 : post.bookmarks_count - 1;
            revertedPost.is_bookmarked = isBookmarked;
            return revertedPost;
          }
          return post;
        }));
        toast.error(isBookmarked ? 'Failed to remove bookmark' : 'Failed to bookmark post');
      }
    } catch (error) {
      // Revert optimistic update on error
      setPosts(prev => prev.map(post => {
        if (post.id === postId) {
          const revertedPost = structuredClone(post);
          revertedPost.bookmarks_count = isBookmarked ? post.bookmarks_count + 1 : post.bookmarks_count - 1;
          revertedPost.is_bookmarked = isBookmarked;
          return revertedPost;
        }
        return post;
      }));
      toast.error('Failed to update bookmark');
    }
  };

  const sharePost = async (post: SocialPostWithDetails) => {
    try {
      await supabase
        .from('social_posts')
        .update({ shares_count: (post.shares_count || 0) + 1 })
        .eq('id', post.id);

      setPosts(prev => prev.map(p =>
        p.id === post.id ? { ...p, shares_count: (p.shares_count || 0) + 1 } : p
      ));

      toast.success('Share recorded');
      return true;
    } catch (error) {
      toast.error('Failed to record share');
      ////console.error('Error recording share:', error);
      return false;
    }
  };

  // Enhanced follow user function that updates counts and removes from suggestions
  const toggleFollow = async (userId: string): Promise<{ isNowFollowing: boolean }> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: response, error } = await supabase.functions.invoke('toggle-follow', {
        body: { target_user_id: userId },
      });

      if (error || !response?.success) {
        throw new Error('Failed to update follow status');
      }

      const isNowFollowing = response.is_now_following;

      // Optimistically update current user's following count
      setCurrentUser(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          following_count: isNowFollowing
            ? (prev.following_count || 0) + 1
            : Math.max(0, (prev.following_count || 0) - 1)
        };
      });

      // Refetch user profile for correct counts
      if (typeof refetchCurrentUser === 'function') {
        await refetchCurrentUser();
      }

      if (isNowFollowing) {
        // Send client-side push notification
        const actorName = response.actor_name || currentUser?.display_name || 'Someone';
        await createNotification({
          userId: userId,
          type: 'social_follow',
          title: 'New follower',
          message: `${actorName} started following you`,
          data: { actor_id: user.id },
          icon: currentUser?.avatar_url,
          saveToDb: false
        });

        // Remove from suggested users list
        setSuggestedUsers(prev => prev.filter(u => u.id !== userId));
        toast.success('Followed user');
      } else {
        toast.success('Unfollowed user');
      }

      return { isNowFollowing };
    } catch (error) {
      toast.error('Failed to update follow status');
      throw error;
    }
  };
  // Add these functions to useSocialActions.ts

  // Add to the existing useSocialActions hook

  const deletePost = async (postId: string): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      if (!navigator.onLine) {
        // Optimistic update
        setPosts(prev => prev.filter(p => p.id !== postId));
        
        await offlineStorage.addPendingSync('delete', STORES.SOCIAL_POSTS, { id: postId });

        toast.success('Post deleted offline');
        return true;
      }

      // Optimistic update
      const previousPosts = [...posts];
      setPosts(prev => prev.filter(p => p.id !== postId));

      const { data: response, error } = await supabase.functions.invoke('delete-social-post', {
        body: { post_id: postId },
      });

      if (error || !response?.success) {
        // Revert optimistic update
        setPosts(previousPosts);
        toast.error(error?.message || 'Failed to delete post');
        return false;
      }

      // Update local user posts count
      if (currentUser) {
        setCurrentUser(prev => prev ? {
          ...prev,
          posts_count: Math.max(0, prev.posts_count - 1)
        } : prev);
      }

      toast.success('Post deleted successfully');
      return true;
    } catch (error) {
      toast.error('Failed to delete post');
      return false;
    }
  };

  const editPost = async (postId: string, newContent: string): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      if (!newContent.trim()) {
        toast.error('Post content cannot be empty');
        return false;
      }

      const { data: response, error } = await supabase.functions.invoke('edit-social-post', {
        body: { post_id: postId, content: newContent },
      });

      if (error || !response?.success) {
        toast.error(error?.message || 'Failed to update post');
        return false;
      }

      // Update local state
      setPosts(prev => prev.map(p =>
        p.id === postId
          ? { ...p, content: response.content, updated_at: new Date().toISOString() }
          : p
      ));

      toast.success('Post updated successfully');
      return true;
    } catch (error) {
      toast.error('Failed to update post');
      return false;
    }
  };

  // Add these to the return statement:
  return {
    createPost,
    updateProfile,
    toggleLike,
    toggleBookmark,
    sharePost,
    toggleFollow,
    isUploading,
    createGroup,
    joinGroup,
    leaveGroup,
    isGroupMember,
    deletePost, // ADD THIS
    editPost,   // ADD THIS
  }
}
