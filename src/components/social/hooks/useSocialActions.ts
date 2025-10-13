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
      console.error('Error uploading file:', error);
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
      // 1. Insert the new group
      const { data: newGroupData, error: groupError } = await supabase
        .from('social_groups')
        .insert({
          created_by: currentUser.id,
          name: groupData.name,
          description: groupData.description,
          privacy: groupData.privacy,
          category: 'general', // Default category
          avatar_url: `https://placehold.co/100x100/1e40af/ffffff?text=${groupData.name.charAt(0)}` // Placeholder avatar
        })
        .select()
        .single();

      if (groupError) throw groupError;

      const newGroup = newGroupData as SocialGroup;

      // 2. Automatically make the creator an admin member
      const { error: memberError } = await supabase
        .from('social_group_members')
        .insert({
          group_id: newGroup.id,
          user_id: currentUser.id,
          role: 'admin',
          });

      if (memberError) throw memberError;

      toast.success(`Group "${newGroup.name}" created successfully!`);

      // 3. Update the local state
      const newGroupWithDetails: SocialGroupWithDetails = {
        ...newGroup,
        creator: currentUser, // Use current user details
        is_member: true,
        member_role: 'admin',
        member_status: 'active'
      };

      setGroups(prev => [newGroupWithDetails, ...prev]);
      return newGroupWithDetails;

    } catch (error) {
      console.error('Error creating group:', error);
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
      console.error('Error joining group:', error);
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
      console.error('Error leaving group:', error);
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
      console.error('Error updating profile:', error);
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
  
      // Step 1: Insert the post
      const { data: newPost, error: postError } = await supabase
        .from('social_posts')
        .insert({
          author_id: user.id,
          content: content,
          privacy: privacy,
          group_id: groupId,
          likes_count: 0,
          comments_count: 0,
          shares_count: 0,
          bookmarks_count: 0,
          views_count: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();
  
      if (postError || !newPost) throw postError || new Error('Failed to create post');
  
      // Step 2: Fetch related data (author, group, media)
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
        groupData = data;
      }
  
      // Step 3: Upload media
      const mediaPromises = selectedFiles.map(async (file) => {
        const url = await uploadFile(file);
        if (url) {
          return supabase.from('social_media').insert({
            post_id: newPost.id,
            type: file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'document',
            url,
            filename: file.name,
            size_bytes: file.size,
            mime_type: file.type,
            created_at: new Date().toISOString(),
          });
        }
      });
  
      await Promise.all(mediaPromises.filter(Boolean));
  
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
  
      // Step 6: Construct the SocialPostWithDetails object
      const transformedPost: SocialPostWithDetails = {
        ...newPost,
        author: authorData,
        group: groupData || undefined,
        media: [], // Media will be empty initially; you can fetch it separately if needed
        hashtags: hashtags.map((name) => ({ id: uuidv4(), name, posts_count: 1, created_at: new Date().toISOString() })),
        tags: [],
        is_liked: false,
        is_bookmarked: false,
        views_count: 0,
      };
  
      setPosts((prev) => [transformedPost, ...prev]);
      toast.success('Post created successfully!');
      return true;
    } catch (error) {
      console.error('Error creating post:', error);
      toast.error('Failed to create post');
      return false;
    } finally {
      setIsUploading(false);
    }
  };

  // const joinGroup = async (groupId: string) => {
  //   try {
  //     const { data: { user } } = await supabase.auth.getUser();
  //     if (!user) throw new Error('Not authenticated');

  //     const { data: newMember, error } = await supabase
  //       .from('social_group_members')
  //       .insert({
  //         group_id: groupId,
  //         user_id: user.id,
  //         role: 'member'
  //       })
  //       .select()
  //       .single();

  //     if (error) throw error;

  //     setGroups(prev => prev.map(group => {
  //       if (group.id === groupId) {
  //         return {
  //           ...group,
  //           is_member: true,
  //           members_count: group.members_count + 1,
  //           members: [...group.members, {
  //             id: newMember.id || uuidv4(),
  //             group_id: groupId,
  //             user_id: user.id,
  //             role: 'member',
  //             joined_at: new Date().toISOString()
  //           }]
  //         };
  //       }
  //       return group;
  //     }));

  //     toast.success('Successfully joined group!');
  //   } catch (error) {
  //     console.error('Error joining group:', error);
  //     toast.error('Failed to join group');
  //   }
  // };

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
            likes_count: isLiked ? post.likes_count - 1 : post.likes_count + 1,
            is_liked: !isLiked
          };
        }
        return post;
      }));
    } catch (error) {
      console.error('Error toggling like:', error);
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
      console.error('Error toggling bookmark:', error);
      toast.error('Failed to update bookmark');
    }
  };

  const sharePost = async (post: SocialPostWithDetails) => {
    try {
      const shareText = generateShareText(post);
      await navigator.clipboard.writeText(shareText);

      await supabase
        .from('social_posts')
        .update({ shares_count: post.shares_count + 1 })
        .eq('id', post.id);

      setPosts(prev => prev.map(p =>
        p.id === post.id ? { ...p, shares_count: p.shares_count + 1 } : p
      ));

      toast.success('Post link copied to clipboard!');
    } catch (error) {
      toast.error('Failed to share post');
    }
  };

  // Enhanced follow user function that updates counts and removes from suggestions
  const followUser = async (userId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Insert the follow relationship
      const { error: followError } = await supabase
        .from('social_follows')
        .insert({
          follower_id: user.id,
          following_id: userId
        });

      if (followError) throw followError;

      // Update follower counts

      // Create notification
      await supabase.from('social_notifications').insert({
        user_id: userId,
        type: 'follow',
        title: 'New follower',
        message: `${currentUser?.display_name} started following you`,
        data: { user_id: user.id },
        actor_id: user.id, // Added
        post_id: null // Added
      });

      // Remove from suggested users list
      setSuggestedUsers(prev => prev.filter(u => u.id !== userId));
      
      // Update current user's following count
      if (currentUser) {
        setCurrentUser(prev => prev ? {
          ...prev,
          following_count: prev.following_count + 1
        } : prev);
      }

      return true;
    } catch (error) {
      console.error('Error following user:', error);
      throw error; // Re-throw so the UI can handle the error
    }
  };

  return {
    createPost,
    updateProfile,
    toggleLike,
    toggleBookmark,
    sharePost,
    followUser,
    isUploading,
    createGroup,
    joinGroup,
    leaveGroup,
    isGroupMember,
  };
};