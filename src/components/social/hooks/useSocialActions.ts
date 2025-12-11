
import { useState } from 'react';
import { supabase } from '../../../integrations/supabase/client';
import { SocialPostWithDetails, SocialUserWithDetails, SocialGroupWithDetails, SocialGroup, CreateGroupData, GroupPrivacy } from '../../../integrations/supabase/socialTypes';
import { toast } from 'sonner';
import { extractHashtags, generateShareText } from '../utils/postUtils';
import { Privacy } from '../types/social';
import { v4 as uuidv4 } from 'uuid';


export const useSocialActions = (
  currentUser: SocialUserWithDetails | null,
  posts: SocialPostWithDetails[],
  setPosts: React.Dispatch<React.SetStateAction<SocialPostWithDetails[]>>,
  setSuggestedUsers: React.Dispatch<React.SetStateAction<SocialUserWithDetails[]>>,
  groups: SocialGroupWithDetails[],
  setGroups: React.Dispatch<React.SetStateAction<SocialGroupWithDetails[]>>,
  setCurrentUser: React.Dispatch<React.SetStateAction<SocialUserWithDetails | null>>
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
      ////console.error('Error uploading file:', error);
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

      // 2. Automatically make the creator an admin member
      const { error: memberError } = await supabase
        .from('social_group_members')
        .insert({
          group_id: newGroup.id,
          user_id: currentUser.id,
          role: 'admin',
        });

      if (memberError) throw memberError;

      // Update members_count on server
      const { count, error: countError } = await supabase
        .from('social_group_members')
        .select('count', { count: 'exact' })
        .eq('group_id', newGroup.id);

      await supabase
        .from('social_groups')
        .update({ members_count: count })
        .eq('id', newGroup.id);

      toast.success(`Group "${newGroup.name}" created successfully!`);

      // Update local state with members_count
      const newGroupWithDetails: SocialGroupWithDetails = {
        ...newGroup,
        members_count: count,  // Set the accurate count
        creator: currentUser,
        is_member: true,
        member_role: 'admin',
        member_status: 'active'
      };

      setGroups(prev => [newGroupWithDetails, ...prev]);
      return newGroupWithDetails;

    } catch (error) {
      ////console.error('Error creating group:', error);
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
      const status = privacy === 'public' ? 'active' : 'pending'; // Auto-join public, request for private

      const { error } = await supabase
        .from('social_group_members')
        .insert({
          group_id: groupId,
          user_id: currentUser.id,
          role: 'member',
          status: status
        });

      if (error) throw error;

      // If active, update members_count on server
      if (status === 'active') {
        const { count, error: countError } = await supabase
          .from('social_group_members')
          .select('count', { count: 'exact' })
          .eq('group_id', groupId);

        if (countError) throw countError;

        await supabase
          .from('social_groups')
          .update({ members_count: count })
          .eq('id', groupId);
      }

      // Update the local state for the specific group
      setGroups(prev => prev.map(g => g.id === groupId ? {
        ...g,
        is_member: status === 'active',
        member_status: status,
        member_role: 'member',
        members_count: status === 'active' ? g.members_count + 1 : g.members_count,
      } : g));

      if (status === 'active') {
        toast.success('Successfully joined the group!');
      } else {
        toast.info('Request to join sent. Waiting for admin approval.');
      }
      return true;

    } catch (error) {
      ////console.error('Error joining group:', error);
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
      // Delete the membership record
      const { error } = await supabase
        .from('social_group_members')
        .delete()
        .eq('group_id', groupId)
        .eq('user_id', currentUser.id);

      if (error) throw error;

      // If was active, update members_count on server
      const group = groups.find(group => group.id === groupId);
      if (group?.member_status === 'active') {  // Ensure group is fetched and check member_status
        const { count, error: countError } = await supabase
          .from('social_group_members')
          .select('count', { count: 'exact' })
          .eq('group_id', groupId);

        if (countError) throw countError;

        await supabase
          .from('social_groups')
          .update({ members_count: count })
          .eq('id', groupId);
      }
      // Update the local state for the specific group
      setGroups(prev => prev.map(g => g.id === groupId ? {
        ...g,
        is_member: false,
        member_status: null,
        member_role: null,
        members_count: g.member_status === 'active' ? g.members_count - 1 : g.members_count,
      } : g));

      toast.info('You have left the group.');
      return true;

    } catch (error) {
      ////console.error('Error leaving group:', error);
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

  const createPost = async (content: string, privacy: Privacy, selectedFiles: File[], groupId?: string) => {
    if (!content.trim()) return;

    try {
      setIsUploading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

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
          group_id: groupId
        }
      });

      if (functionError) {
        // Handle subscription limit errors
        if (functionError.message) {
          toast.error(functionError.message);
        } else {
          toast.error('Failed to create post');
        }
        return false;
      }

      if (!response?.success || !response?.post) {
        throw new Error('Failed to create post');
      }

      const newPost = response.post;

      // Step 2: Fetch related data (author, group)
      const { data: authorData, error: authorError } = await supabase
        .from('social_users')
        .select('*')
        .eq('id', user.id)
        .single();

      if (authorError || !authorData) throw authorError || new Error('Failed to fetch author');

      let groupData: SocialGroup | null = null;
      if (groupId) {
        const { data, error } = await supabase
          .from('social_groups')
          .select('*')
          .eq('id', groupId)
          .single();
        if (error) throw error;
        groupData = { ...data, privacy: data.privacy as "public" | "private" };
      }

      // Step 4: Handle hashtags
      const hashtags = extractHashtags(content);
      for (const tag of hashtags) {
        const { data: hashtag, error: hashtagError } = await supabase
          .from('social_hashtags')
          .upsert({ name: tag }, { onConflict: 'name' })
          .select()
          .single();

        if (!hashtagError && hashtag) {
          await supabase.from('social_post_hashtags').insert({
            post_id: newPost.id,
            hashtag_id: hashtag.id,
            created_at: new Date().toISOString(),
          });
        }
      }

      // Step 5: Update user's posts count
      await supabase
        .from('social_users')
        .update({ posts_count: (currentUser?.posts_count || 0) + 1 })
        .eq('id', user.id);

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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (isLiked) {
        await supabase.from('social_likes').delete().eq('post_id', postId).eq('user_id', user.id);
      } else {
        await supabase.from('social_likes').insert({ post_id: postId, user_id: user.id });

        const post = posts.find(p => p.id === postId);
        if (post && post.author_id !== user.id) {
          await supabase.from('social_notifications').insert({
            user_id: post.author_id,
            type: 'like',
            title: 'New like on your post',
            message: `${currentUser?.display_name} liked your post`,
            data: { post_id: postId, user_id: user.id },
            actor_id: user.id, // Added
            post_id: postId // Added
          });
        }
      }

      setPosts(prev => prev.map(post => {
        if (post.id === postId) {
          return {
            ...post,
            is_liked: !isLiked
          };
        }
        return post;
      }));
    } catch (error) {
      ////console.error('Error toggling like:', error);
      toast.error('Failed to update like');
    }
  };

  const toggleBookmark = async (postId: string, isBookmarked: boolean) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (isBookmarked) {
        await supabase.from('social_bookmarks').delete().eq('post_id', postId).eq('user_id', user.id);
      } else {
        await supabase.from('social_bookmarks').insert({ post_id: postId, user_id: user.id });
      }

      setPosts(prev => prev.map(post => {
        if (post.id === postId) {
          return {
            ...post,
            bookmarks_count: isBookmarked ? post.bookmarks_count - 1 : post.bookmarks_count + 1,
            is_bookmarked: !isBookmarked
          };
        }
        return post;
      }));
    } catch (error) {
      ////console.error('Error toggling bookmark:', error);
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

      // Check if already following
      const { data: existingFollow, error: checkError } = await supabase
        .from('social_follows')
        .select('id')
        .eq('follower_id', user.id)
        .eq('following_id', userId)
        .maybeSingle();

      if (checkError && checkError.code !== 'PGRST116') throw checkError;

      const isCurrentlyFollowing = !!existingFollow;

      if (isCurrentlyFollowing) {
        // Unfollow
        const { error: deleteError } = await supabase
          .from('social_follows')
          .delete()
          .eq('follower_id', user.id)
          .eq('following_id', userId);

        if (deleteError) throw deleteError;

        // Update target's followers_count
        const { data: targetUser, error: targetError } = await supabase
          .from('social_users')
          .select('followers_count')
          .eq('id', userId)
          .single();

        if (targetError) throw targetError;

        await supabase
          .from('social_users')
          .update({ followers_count: Math.max(0, (targetUser.followers_count || 0) - 1) })
          .eq('id', userId);

        // Update current user's following_count
        if (currentUser) {
          const newCount = Math.max(0, (currentUser.following_count || 0) - 1);
          setCurrentUser(prev => prev ? { ...prev, following_count: newCount } : prev);
          await supabase
            .from('social_users')
            .update({ following_count: newCount })
            .eq('id', user.id);
        }

        toast.success('Unfollowed user');
        return { isNowFollowing: false };
      } else {
        // Follow
        const { error: followError } = await supabase
          .from('social_follows')
          .insert({
            follower_id: user.id,
            following_id: userId
          });

        if (followError) throw followError;

        // Update target's followers_count
        const { data: targetUser, error: targetError } = await supabase
          .from('social_users')
          .select('followers_count')
          .eq('id', userId)
          .single();

        if (targetError) throw targetError;

        await supabase
          .from('social_users')
          .update({ followers_count: (targetUser.followers_count || 0) + 1 })
          .eq('id', userId);

        // Update current user's following_count
        if (currentUser) {
          const newCount = (currentUser.following_count || 0) + 1;
          setCurrentUser(prev => prev ? { ...prev, following_count: newCount } : prev);
          await supabase
            .from('social_users')
            .update({ following_count: newCount })
            .eq('id', user.id);
        }

        // Create notification
        await supabase.from('social_notifications').insert({
          user_id: userId,
          type: 'follow',
          title: 'New follower',
          message: `${currentUser?.display_name} started following you`,
          data: { user_id: user.id },
          actor_id: user.id,
          post_id: null
        });

        // Remove from suggested users list
        setSuggestedUsers(prev => prev.filter(u => u.id !== userId));

        toast.success('Followed user');
        return { isNowFollowing: true };
      }
    } catch (error) {
      ////console.error('Error toggling follow:', error);
      toast.error('Failed to update follow status');
      throw error; // Re-throw so the UI can handle the error
    }
  };
  // Add these functions to useSocialActions.ts

  // Add to the existing useSocialActions hook

  const deletePost = async (postId: string): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Get the post to verify ownership
      const { data: post, error: fetchError } = await supabase
        .from('social_posts')
        .select('author_id')
        .eq('id', postId)
        .single();

      if (fetchError) throw fetchError;
      if (post.author_id !== user.id) {
        toast.error('You can only delete your own posts');
        return false;
      }

      // Delete associated data first
      await Promise.all([
        supabase.from('social_likes').delete().eq('post_id', postId),
        supabase.from('social_comments').delete().eq('post_id', postId),
        supabase.from('social_bookmarks').delete().eq('post_id', postId),
        supabase.from('social_media').delete().eq('post_id', postId),
        supabase.from('social_post_hashtags').delete().eq('post_id', postId),
        supabase.from('social_post_tags').delete().eq('post_id', postId),
        supabase.from('social_notifications').delete().eq('post_id', postId),
      ]);

      // Delete the post
      const { error: deleteError } = await supabase
        .from('social_posts')
        .delete()
        .eq('id', postId);

      if (deleteError) throw deleteError;

      // Update local state
      setPosts(prev => prev.filter(p => p.id !== postId));

      // Update user's posts count
      if (currentUser) {
        await supabase
          .from('social_users')
          .update({ posts_count: Math.max(0, (currentUser.posts_count || 0) - 1) })
          .eq('id', user.id);

        setCurrentUser(prev => prev ? {
          ...prev,
          posts_count: Math.max(0, prev.posts_count - 1)
        } : prev);
      }

      toast.success('Post deleted successfully');
      return true;
    } catch (error) {
      ////console.error('Error deleting post:', error);
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

      // Get the post to verify ownership
      const { data: post, error: fetchError } = await supabase
        .from('social_posts')
        .select('author_id, content')
        .eq('id', postId)
        .single();

      if (fetchError) throw fetchError;
      if (post.author_id !== user.id) {
        toast.error('You can only edit your own posts');
        return false;
      }

      // Update the post
      const { error: updateError } = await supabase
        .from('social_posts')
        .update({
          content: newContent.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', postId);

      if (updateError) throw updateError;

      // Update local state
      setPosts(prev => prev.map(p =>
        p.id === postId
          ? { ...p, content: newContent.trim(), updated_at: new Date().toISOString() }
          : p
      ));

      // Handle hashtags
      const oldHashtags = extractHashtags(post.content);
      const newHashtags = extractHashtags(newContent);

      // Remove old hashtag associations
      if (oldHashtags.length > 0) {
        await supabase
          .from('social_post_hashtags')
          .delete()
          .eq('post_id', postId);
      }

      // Add new hashtag associations
      for (const tag of newHashtags) {
        const { data: hashtag, error: hashtagError } = await supabase
          .from('social_hashtags')
          .upsert({ name: tag }, { onConflict: 'name' })
          .select()
          .single();

        if (!hashtagError && hashtag) {
          await supabase.from('social_post_hashtags').insert({
            post_id: postId,
            hashtag_id: hashtag.id,
            created_at: new Date().toISOString(),
          });
        }
      }

      toast.success('Post updated successfully');
      return true;
    } catch (error) {
      ////console.error('Error editing post:', error);
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