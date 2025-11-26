import { useCallback, useRef } from 'react';
import { supabase } from '../../../integrations/supabase/client';
import { SocialPostWithDetails } from '../../../integrations/supabase/socialTypes';

export const useSocialPostViews = (
    setPosts: React.Dispatch<React.SetStateAction<SocialPostWithDetails[]>>,
    setTrendingPosts?: React.Dispatch<React.SetStateAction<SocialPostWithDetails[]>>,
    setUserPosts?: React.Dispatch<React.SetStateAction<SocialPostWithDetails[]>>
  ) => {
    const viewedPosts = useRef<Set<string>>(new Set());
    const viewTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());
  
    const trackPostView = useCallback(async (postId: string) => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
  
        // Check if the user has already viewed this post
        const { data: existingView } = await supabase
          .from('social_post_views')
          .select('id')
          .eq('post_id', postId)
          .eq('user_id', user.id)
          .single();
  
        if (existingView) {
          // User has already viewed this post, skip tracking
          viewedPosts.current.add(postId);
          return;
        }
  
        // Mark as viewed in memory to prevent duplicate tracking in the same session
        viewedPosts.current.add(postId);
  
        // Insert view record
        const { error: viewError } = await supabase
          .from('social_post_views')
          .insert({
            post_id: postId,
            user_id: user.id,
            viewed_at: new Date().toISOString(),
          });
  
        if (viewError) throw viewError;
  
        // Update the view count in the database
        const { data: post } = await supabase
          .from('social_posts')
          .select('views_count')
          .eq('id', postId)
          .single();
  
        if (post) {
          const { error: updateError } = await supabase
            .from('social_posts')
            .update({ views_count: post.views_count + 1 })
            .eq('id', postId);
  
          if (updateError) throw updateError;
        }
  
        // Update local state to reflect the new view count
        const updatePostInState = (posts: SocialPostWithDetails[]) =>
          posts.map(post =>
            post.id === postId
              ? { ...post, views_count: post.views_count + 1 }
              : post
          );
  
        setPosts(updatePostInState);
        if (setTrendingPosts) setTrendingPosts(updatePostInState);
        if (setUserPosts) setUserPosts(updatePostInState);
        console.log(`✅ Tracked view for post ${postId}`);
      } catch (error) {
        console.error('Error tracking post view:', error);
        viewedPosts.current.delete(postId); // Remove from viewedPosts on error to allow retry
      }
    }, [setPosts, setTrendingPosts, setUserPosts]);
  
    const schedulePostView = useCallback((postId: string, delay: number = 2000) => {
      // Clear any existing timeout for this post
      const existingTimeout = viewTimeouts.current.get(postId);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }
  
      // Schedule the view tracking after a delay
      const timeout = setTimeout(() => {
        trackPostView(postId);
        viewTimeouts.current.delete(postId);
      }, delay);
  
      viewTimeouts.current.set(postId, timeout);
    }, [trackPostView]);
  
    const cancelScheduledView = useCallback((postId: string) => {
      const timeout = viewTimeouts.current.get(postId);
      if (timeout) {
        clearTimeout(timeout);
        viewTimeouts.current.delete(postId);
      }
    }, []);
  
    const cleanup = useCallback(() => {
      viewTimeouts.current.forEach((timeout) => clearTimeout(timeout));
      viewTimeouts.current.clear();
    }, []);
  
    return {
      trackPostView,
      schedulePostView,
      cancelScheduledView,
      cleanup,
    };
  };