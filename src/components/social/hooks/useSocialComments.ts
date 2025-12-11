import { useState } from 'react';
import { supabase } from '../../../integrations/supabase/client';
import { SocialCommentWithDetails, SocialUserWithDetails, SocialPostWithDetails } from '../../../integrations/supabase/socialTypes';
import { toast } from 'sonner';

export const useSocialComments = (
  currentUser: SocialUserWithDetails | null,
  posts: SocialPostWithDetails[]
) => {
  const [comments, setComments] = useState<Record<string, SocialCommentWithDetails[]>>({});
  const [newComment, setNewComment] = useState<Record<string, string>>({});
  const [loadingComments, setLoadingComments] = useState<Set<string>>(new Set());
  const [expandedPosts, setExpandedPosts] = useState<Set<string>>(new Set());

  const fetchComments = async (postId: string) => {
    if (comments[postId]) return;

    try {
      setLoadingComments(prev => new Set([...prev, postId]));

      const { data, error } = await supabase
        .from('social_comments')
        .select(`*, author:social_users(*)`)
        .eq('post_id', postId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      setComments(prev => ({
        ...prev,
        [postId]: data || []
      }));
    } catch (error) {
      ////console.error('Error fetching comments:', error);
    } finally {
      setLoadingComments(prev => {
        const newSet = new Set(prev);
        newSet.delete(postId);
        return newSet;
      });
    }
  };

  const addComment = async (postId: string) => {
    const content = newComment[postId]?.trim();
    if (!content) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Use edge function to add comment with validation
      const { data: response, error: functionError } = await supabase.functions.invoke('comment-on-post', {
        body: {
          postId,
          content
        }
      });

      if (functionError) {
        // Handle subscription limit errors
        if (functionError.message) {
          toast.error(functionError.message);
        } else {
          toast.error('Failed to add comment');
        }
        return;
      }

      if (!response?.success || !response?.comment) {
        throw new Error('Failed to add comment');
      }

      const comment = response.comment;

      // Fetch author data for the comment
      const { data: authorData } = await supabase
        .from('social_users')
        .select('*')
        .eq('id', user.id)
        .single();

      const commentWithAuthor = {
        ...comment,
        author: authorData
      };

      setComments(prev => ({
        ...prev,
        [postId]: [...(prev[postId] || []), commentWithAuthor]
      }));

      setNewComment(prev => ({
        ...prev,
        [postId]: ''
      }));

      // Create notification for post author
      const post = posts.find(p => p.id === postId);
      if (post && post.author_id !== user.id) {
        await supabase.from('social_notifications').insert({
          user_id: post.author_id,
          type: 'comment',
          title: 'New comment on your post',
          message: `${currentUser?.display_name} commented on your post`,
          data: { post_id: postId, comment_id: comment.id },
          actor_id: user.id, // Added
          post_id: postId // Added
        });
      }

      toast.success('Comment added!');
    } catch (error) {
      ////console.error('Error adding comment:', error);
      toast.error('Failed to add comment');
    }
  };

  const updateNewComment = (postId: string, content: string) => {
    setNewComment(prev => ({
      ...prev,
      [postId]: content
    }));
  };

  const togglePostExpanded = (postId: string) => {
    setExpandedPosts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(postId)) {
        newSet.delete(postId);
      } else {
        newSet.add(postId);
        fetchComments(postId);
      }
      return newSet;
    });
  };

  const isPostExpanded = (postId: string) => expandedPosts.has(postId);
  const getPostComments = (postId: string) => comments[postId] || [];
  const isLoadingPostComments = (postId: string) => loadingComments.has(postId);
  const getNewCommentContent = (postId: string) => newComment[postId] || '';

  return {
    fetchComments,
    addComment,
    updateNewComment,
    togglePostExpanded,
    isPostExpanded,
    getPostComments,
    isLoadingPostComments,
    getNewCommentContent,
  };
};