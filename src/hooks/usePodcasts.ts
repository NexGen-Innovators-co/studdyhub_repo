import { useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { offlineStorage, STORES } from '@/utils/offlineStorage';
import { toast } from 'sonner';

export interface PodcastWithMeta {
  id: string;
  user_id: string;
  title: string;
  sources: any[];
  script: any;
  audio_segments: any;
  duration_minutes: number;
  style: string;
  podcast_type: string;
  status: string;
  is_public: boolean;
  is_live: boolean;
  created_at: string;
  updated_at: string;
  cover_image_url?: string;
  description?: string;
  tags?: string[];
  listen_count: number;
  share_count: number;
  visual_assets: any;
  duration: number;
  audioSegments: any[];
  visualAssets: any;
  user: {
    full_name: string;
    avatar_url?: string;
  };
  member_count: number;
}

type PodcastTab = 'discover' | 'my-podcasts' | 'live';

const PAGE_SIZE = 20;

export const usePodcasts = (activeTab: PodcastTab) => {
  return useInfiniteQuery({
    queryKey: ['podcasts', activeTab],
    staleTime: 1000 * 60 * 30, // 30 mins - Data stays "fresh" (no background refetch)
    gcTime: 1000 * 60 * 60, // 1 hour - Keep in cache even if component unmounts
    refetchOnMount: false, // Don't refetch when mounting
    refetchOnWindowFocus: false, // Don't refetch on window focus
    queryFn: async ({ pageParam = 1 }) => {
      try {
        let query = supabase
          .from('ai_podcasts')
          .select(`
            id,
            user_id,
            title,
            sources,
            script,
            audio_segments,
            duration_minutes,
            style,
            podcast_type,
            status,
            is_public,
            is_live,
            created_at,
            updated_at,
            cover_image_url,
            description,
            tags,
            listen_count,
            share_count,
            visual_assets
          `)
          .eq('status', 'completed')
          .order('created_at', { ascending: false })
          .range((pageParam - 1) * PAGE_SIZE, pageParam * PAGE_SIZE - 1);

        if (activeTab === 'discover') {
          query = query.eq('is_public', true);
        } else if (activeTab === 'my-podcasts') {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            query = query.eq('user_id', user.id);
          } else {
             // If no user, return empty for my-podcasts
             return [];
          }
        } else if (activeTab === 'live') {
          query = query.eq('is_live', true).eq('is_public', true);
        }

        const { data, error } = await query;

        if (error) {
          if (!navigator.onLine) {
            const offlinePodcasts = await offlineStorage.getAll<any>(STORES.PODCASTS);
            if (offlinePodcasts.length > 0) {
              // Note: Offline storage might return all podcasts, not paginated/filtered correctly
              // For simplicity, we return what we have. 
              // Ideally we should filter offline data too.
              return offlinePodcasts; 
            }
          }
          throw error;
        }

        if (!data || data.length === 0) {
            return [];
        }

        // Fetch member counts for all podcasts
        const podcastIds = data.map((p: any) => p.id);
        let memberCounts: Record<string, number> = {};
        if (podcastIds.length > 0) {
          const { data: memberData, error: memberError } = await supabase
            .from('podcast_members')
            .select('podcast_id, id', { count: 'exact', head: false })
            .in('podcast_id', podcastIds);
          if (!memberError && memberData) {
            // Count members per podcast
            memberCounts = memberData.reduce((acc: Record<string, number>, row: any) => {
              acc[row.podcast_id] = (acc[row.podcast_id] || 0) + 1;
              return acc;
            }, {});
          }
        }

        const userIds = [...new Set(data.map((p: any) => p.user_id))];
        const { data: usersData } = await supabase
          .from('social_users')
          .select('id, display_name, username, avatar_url')
          .in('id', userIds);

        const usersMap = new Map(
          (usersData || []).map((u: any) => [
            u.id,
            {
              full_name: u.display_name || u.username || 'Anonymous User',
              avatar_url: u.avatar_url
            }
          ])
        );

        const transformedPodcasts: PodcastWithMeta[] = data.map((podcast: any) => {
          // Parse audio_segments with robust error handling
          let audioSegments = [];
          if (typeof podcast.audio_segments === 'string') {
            try {
              audioSegments = podcast.audio_segments ? JSON.parse(podcast.audio_segments) : [];
            } catch (e) {
              audioSegments = [];
            }
          } else {
            audioSegments = podcast.audio_segments || [];
          }

          // Parse visual_assets with robust error handling
          let visualAssets = null;
          if (podcast.visual_assets) {
            if (typeof podcast.visual_assets === 'string') {
              try {
                visualAssets = JSON.parse(podcast.visual_assets);
              } catch (e) {
                visualAssets = null;
              }
            } else {
              visualAssets = podcast.visual_assets;
            }
          }

          // Calculate total duration from audio segments (in minutes)
          let totalDuration = podcast.duration_minutes || 0;
          if (audioSegments.length > 0 && audioSegments[0].end_time !== undefined) {
            // For live podcasts, calculate from last segment's end_time
            const lastSegment = audioSegments[audioSegments.length - 1];
            if (lastSegment && typeof lastSegment.end_time === 'number' && isFinite(lastSegment.end_time)) {
              totalDuration = Math.ceil(lastSegment.end_time / 60); // Convert seconds to minutes
            }
          }

          // Ensure duration is a valid number and not Infinity
          if (!isFinite(totalDuration) || isNaN(totalDuration)) {
            totalDuration = podcast.duration_minutes || 0;
          }

          return {
            ...podcast,
            duration: totalDuration,
            audioSegments,
            visualAssets,
            sources: podcast.sources || [],
            user: usersMap.get(podcast.user_id) || {
              full_name: 'Anonymous User',
              avatar_url: undefined
            },
            member_count: memberCounts[podcast.id] || 0,
          };
        });

        // Save to offline storage
        if (transformedPodcasts.length > 0) {
          await offlineStorage.save(STORES.PODCASTS, transformedPodcasts);
        }

        return transformedPodcasts;

      } catch (error: any) {
        console.error('Error fetching podcasts:', error);
        toast.error('Failed to load podcasts');
        throw error;
      }
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      return lastPage.length === PAGE_SIZE ? allPages.length + 1 : undefined;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes
  });
};
