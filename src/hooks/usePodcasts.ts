// hooks/usePodcasts.ts - Fixed with optimized queries
import { useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { offlineStorage, STORES } from '@/utils/offlineStorage';
import { toast } from 'sonner';

// Match database schema exactly
export interface AudioSegment {
  speaker: string;
  text: string;
  audioContent?: string;
  audio_url?: string;
  index: number;
  start_time?: number;
  end_time?: number;
}

export interface PodcastWithMeta {
  id: string;
  user_id: string;
  title: string;
  sources: any[];
  script: string;
  audio_segments: any;
  audioSegments: AudioSegment[]; // Parsed version
  duration_minutes: number;
  duration: number; // Calculated version
  style: string;
  podcast_type: string | null;
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
  visualAssets: any; // Parsed version
  user: {
    full_name: string;
    avatar_url?: string;
    username?: string; // Add username field
  };
  member_count: number;
  audio_url?: string | null; // Add audio_url field
}
type PodcastTab = 'discover' | 'my-podcasts' | 'live';

const PAGE_SIZE = 12; // Reduced from 20 for better performance

export const usePodcasts = (activeTab: PodcastTab, options?: { lightweight?: boolean }) => {
  const useLight = typeof options?.lightweight === 'boolean' ? options!.lightweight : activeTab === 'discover';
  return useInfiniteQuery({
    queryKey: ['podcasts', activeTab, useLight ? 'light' : 'full'],
    staleTime: useLight ? 1000 * 60 * 5 : 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    refetchOnMount: useLight ? false : true,
    refetchOnWindowFocus: useLight ? false : true,
    queryFn: async ({ pageParam = 1 }) => {
      try {
        // First, get current user (if needed)
        const { data: { user } } = await supabase.auth.getUser();
        
        // Build base query
        // Use a lighter select when in lightweight mode to reduce payload size
        const selectLight = `
          id,
          user_id,
          title,
          cover_image_url,
          duration_minutes,
          is_public,
          is_live,
          created_at,
          listen_count,
          podcast_type
        `;

        const selectFull = `
          id,
          user_id,
          title,
          description,
          cover_image_url,
          duration_minutes,
          is_public,
          is_live,
          created_at,
          listen_count,
          share_count,
          tags,
          podcast_type
        `;

        let query = supabase
          .from('ai_podcasts')
          .select(useLight ? selectLight : selectFull, { count: 'exact' })
          .eq('status', 'completed')
          .order('created_at', { ascending: false })
          .range((pageParam - 1) * PAGE_SIZE, pageParam * PAGE_SIZE - 1);

        // Apply tab-specific filters
        if (activeTab === 'discover') {
          query = query.eq('is_public', true);
        } else if (activeTab === 'my-podcasts') {
          if (user) {
            query = query.eq('user_id', user.id);
          } else {
            return [];
          }
        } else if (activeTab === 'live') {
          query = query.eq('is_live', true).eq('is_public', true);
        }

        const { data, error, count } = await query;

        if (error) {
          if (!navigator.onLine) {
            const offlinePodcasts = await offlineStorage.getAll<any>(STORES.PODCASTS);
            return offlinePodcasts;
          }
          throw error;
        }

        if (!data || data.length === 0) {
          return [];
        }

        // FIX: Fetch user data from social_users table instead of profiles
        const userIds = [...new Set(data.map((p: any) => p.user_id))];
        const { data: usersData } = await supabase
          .from('social_users')
          .select('id, display_name, avatar_url, username')
          .in('id', userIds);

        const usersMap = new Map(
          (usersData || []).map((u: any) => [
            u.id,
            {
              full_name: u.display_name || 'Anonymous User',
              avatar_url: u.avatar_url,
              username: u.username || ''
            }
          ])
        );

        // OPTIMIZATION: Batch fetch member counts only for full mode
        const podcastIds = data.map((p: any) => p.id);
        const memberCounts = new Map<string, number>();
        if (!useLight) {
          const { data: memberData, error: memberError } = await supabase
            .from('podcast_members')
            .select('podcast_id')
            .in('podcast_id', podcastIds);

          if (!memberError && memberData) {
            memberData.forEach((row: any) => {
              memberCounts.set(row.podcast_id, (memberCounts.get(row.podcast_id) || 0) + 1);
            });
          }
        }

        // Transform podcasts with minimal data
        const transformedPodcasts: PodcastWithMeta[] = data.map((podcast: any) => {
          // Parse audio_segments and visual_assets only when needed
          let audioSegments: AudioSegment[] = [];
          let visualAssets = null;

          // Calculate duration
          let totalDuration = podcast.duration_minutes || 0;

          return {
            ...podcast,
            id: podcast.id,
            user_id: podcast.user_id,
            title: podcast.title,
            description: podcast.description || '',
            cover_image_url: podcast.cover_image_url || null,
            duration: totalDuration,
            audioSegments, // Empty - will be fetched on demand
            visualAssets, // Empty - will be fetched on demand
            audio_segments: null, // Don't store raw data
            visual_assets: null, // Don't store raw data
            sources: [], // Will be fetched on demand
            script: '', // Will be fetched on demand
            style: '', // Will be fetched on demand
            podcast_type: podcast.podcast_type ?? null, // Pass through from DB
            status: 'completed',
            user: usersMap.get(podcast.user_id) || {
              full_name: 'Anonymous User',
              avatar_url: undefined,
              username: ''
            },
            member_count: memberCounts.get(podcast.id) || 0,
            is_public: podcast.is_public || false,
            is_live: podcast.is_live || false,
            listen_count: podcast.listen_count || 0,
            share_count: podcast.share_count || 0,
            tags: podcast.tags || [],
            created_at: podcast.created_at,
            updated_at: podcast.created_at // Use created_at as fallback
          };
        });

        // Save to offline storage only for full mode
        if (!useLight && transformedPodcasts.length > 0) {
          await offlineStorage.save(STORES.PODCASTS, transformedPodcasts);
        }

        return transformedPodcasts;

      } catch (error: any) {
        // console.error('Error fetching podcasts:', error);
        
        // If offline, try to get from local storage
        if (!navigator.onLine) {
          try {
            const offlinePodcasts = await offlineStorage.getAll<any>(STORES.PODCASTS);
            return offlinePodcasts;
          } catch (offlineError) {
            //console.error('Offline storage error:', offlineError);
          }
        }
        
        toast.error('Failed to load podcasts');
        return []; // Return empty array instead of throwing to prevent UI crash
      }
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      return lastPage.length === PAGE_SIZE ? allPages.length + 1 : undefined;
    },
  });
};

// Also update the fetchFullPodcastData function to use social_users
export const fetchFullPodcastData = async (podcastId: string): Promise<PodcastWithMeta | null> => {
  try {
    // First, get the basic podcast data
    const { data: podcastData, error: podcastError } = await supabase
      .from('ai_podcasts')
      .select('*')
      .eq('id', podcastId)
      .single();

    if (podcastError || !podcastData) {
      throw new Error(podcastError?.message || 'Podcast not found');
    }

    // FIX: Fetch user data from social_users table
    const { data: userData, error: userError } = await supabase
      .from('social_users')
      .select('id, display_name, avatar_url, username')
      .eq('id', podcastData.user_id)
      .single();

    if (userError) {
      //console.warn('Error fetching social user:', userError);
    }

    // Prefer normalized `audio_segments` table rows if present
    let audioSegments: AudioSegment[] = [];
    try {
      const { data: rows, error: rowsErr } = await supabase
        .from('audio_segments')
        .select('*')
        .eq('podcast_id', podcastId)
        .order('segment_index', { ascending: true });
      if (!rowsErr && Array.isArray(rows) && rows.length > 0) {
        audioSegments = rows.map((r: any) => ({
          speaker: r.speaker || '',
          text: r.transcript || r.summary || '',
          audioContent: null,
          audio_url: r.audio_url || null,
          index: typeof r.segment_index === 'number' ? r.segment_index : 0,
          start_time: r.start_time || undefined,
          end_time: r.end_time || undefined,
        }));
      } else {
        // Fallback to legacy JSONB field on ai_podcasts
        if (typeof podcastData.audio_segments === 'string') {
          try {
            audioSegments = JSON.parse(podcastData.audio_segments);
          } catch (e) {
            //console.error('Error parsing audio_segments:', e);
            audioSegments = [];
          }
        } else {
          audioSegments = podcastData.audio_segments || [];
        }
      }
    } catch (e) {
      //console.error('Error fetching audio_segments table:', e);
      // Fallback to legacy JSONB field on ai_podcasts
      if (typeof podcastData.audio_segments === 'string') {
        try {
          audioSegments = JSON.parse(podcastData.audio_segments);
        } catch (e) {
          //console.error('Error parsing audio_segments fallback:', e);
          audioSegments = [];
        }
      } else {
        audioSegments = podcastData.audio_segments || [];
      }
    }

    // Parse visual_assets
    let visualAssets = null;
    if (podcastData.visual_assets) {
      if (typeof podcastData.visual_assets === 'string') {
        try {
          visualAssets = JSON.parse(podcastData.visual_assets);
        } catch (e) {
          //console.error('Error parsing visual_assets:', e);
          visualAssets = null;
        }
      } else {
        visualAssets = podcastData.visual_assets;
      }
    }

    // Calculate duration
    let totalDuration = podcastData.duration_minutes || 0;
    if (audioSegments.length > 0 && audioSegments[0].end_time !== undefined) {
      const lastSegment = audioSegments[audioSegments.length - 1];
      if (lastSegment && typeof lastSegment.end_time === 'number' && isFinite(lastSegment.end_time)) {
        totalDuration = Math.ceil(lastSegment.end_time / 60);
      }
    }

    // Get member count
    const { count: memberCount } = await supabase
      .from('podcast_members')
      .select('id', { count: 'exact', head: true })
      .eq('podcast_id', podcastId);

    // Get sources safely
    const sources = Array.isArray(podcastData.sources) ? podcastData.sources : [];

    // Get script safely
    const script = typeof podcastData.script === 'string' ? podcastData.script : '';

    return {
      ...podcastData,
      id: podcastData.id,
      user_id: podcastData.user_id,
      title: podcastData.title || 'Untitled Podcast',
      description: podcastData.description || '',
      cover_image_url: podcastData.cover_image_url || null,
      duration: totalDuration,
      audioSegments,
      visualAssets,
      sources,
      script,
      style: podcastData.style || '',
      podcast_type: podcastData.podcast_type || null,
      status: podcastData.status || 'completed',
      user: {
        full_name: userData?.display_name || 'Anonymous User',
        avatar_url: userData?.avatar_url,
        username: userData?.username || ''
      },
      member_count: memberCount || 0,
      is_public: podcastData.is_public || false,
      is_live: podcastData.is_live || false,
      listen_count: podcastData.listen_count || 0,
      share_count: podcastData.share_count || 0,
      tags: podcastData.tags || [],
      created_at: podcastData.created_at,
      updated_at: podcastData.updated_at || podcastData.created_at,
      audio_segments: podcastData.audio_segments,
      visual_assets: podcastData.visual_assets,
    } as PodcastWithMeta;

  } catch (error) {
    //console.error('Error fetching full podcast data:', error);
    return null;
  }
};

// Lightweight fetch for initial render: returns minimal fields useful for list/detail previews.
export const fetchLightPodcastData = async (podcastId: string): Promise<Partial<PodcastWithMeta> | null> => {
  try {
    const { data: podcastData, error: podcastError } = await supabase
      .from('ai_podcasts')
      .select('id, user_id, title, description, cover_image_url, duration_minutes, is_public, is_live, tags, listen_count, share_count')
      .eq('id', podcastId)
      .single();

    if (podcastError || !podcastData) {
      //console.warn('Light fetch: podcast not found', podcastError);
      return null;
    }

    const { data: userData } = await supabase
      .from('social_users')
      .select('id, display_name, avatar_url, username')
      .eq('id', podcastData.user_id)
      .single();

    return {
      id: podcastData.id,
      user_id: podcastData.user_id,
      title: podcastData.title || 'Untitled Podcast',
      description: podcastData.description || '',
      cover_image_url: podcastData.cover_image_url || null,
      duration: podcastData.duration_minutes || 0,
      is_public: podcastData.is_public || false,
      is_live: podcastData.is_live || false,
      tags: podcastData.tags || [],
      listen_count: podcastData.listen_count || 0,
      share_count: podcastData.share_count || 0,
      user: userData ? {
        full_name: userData.display_name || 'Anonymous User',
        avatar_url: userData.avatar_url,
        username: userData.username || ''
      } : { full_name: 'Anonymous User', avatar_url: undefined, username: '' }
    };

  } catch (e) {
    //console.error('Error fetching light podcast data:', e);
    return null;
  }
};