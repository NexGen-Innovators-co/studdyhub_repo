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

      // Check in-memory set first (avoids even the edge function call)
      if (viewedPosts.current.has(postId)) return;
      viewedPosts.current.add(postId);

      // Use edge function to check + insert + update count server-side
      const { data: response, error } = await supabase.functions.invoke('track-post-view', {
        body: { post_id: postId },
      });

      if (error || !response?.success) {
        viewedPosts.current.delete(postId);
        return;
      }

      if (!response.already_viewed) {
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
      }
    } catch (error) {
      viewedPosts.current.delete(postId);
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