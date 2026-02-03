// PodcastsPage.tsx - Complete fixed version
import React, { useState, useEffect, useCallback, useRef, useMemo, useDeferredValue } from 'react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { ScrollArea } from '../ui/scroll-area';
// tabs are controlled by the header; no local Tabs import needed
import {
  Podcast,
  Play,
  Pause,
  Radio,
  Users,
  Clock,
  TrendingUp,
  Plus,
  Search,
  Filter,
  Share2,
  UserPlus,
  Download,
  Eye,
  Heart,
  MessageCircle,
  Sparkles,
  Globe,
  Lock,
  Loader2,
  Trash2,
  Flag,
  MoreVertical,
  RefreshCcw,
  Image as ImageIcon,
  Headphones,
  Video,
  Lightbulb
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { offlineStorage, STORES } from '@/utils/offlineStorage';
// import { PodcastPanel } from './PodcastPanel';
import { PodcastData, PodcastGenerator } from './PodcastGenerator';
import { GoLiveDialog } from './GoLiveDialog';
import { InviteMembersDialog } from './InviteMembersDialog';
import { ManageMembersDialog } from './ManageMembersDialog';
import { SharePodcastDialog } from './SharePodcastDialog';
import { ReportPodcastDialog } from './ReportPodcastDialog';
// Live podcast UI is now shown via navigation to a live route instead of modals
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '../ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import { getPodcastPermissions } from '@/services/podcastModerationService';
import { usePodcasts, PodcastWithMeta, fetchFullPodcastData } from '@/hooks/usePodcasts';
import { Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext } from '../ui/carousel';
import { createPodcastNotification } from '@/services/notificationHelpers';
import { useQuery, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { SubscriptionLimitsModal } from '../subscription/SubscriptionLimitsModal';
import { useNavigate } from 'react-router-dom';
import { useGlobalSearch } from '@/hooks/useGlobalSearch';
import { SEARCH_CONFIGS } from '@/services/globalSearchService';
import { PodcastCard } from './PodcastCard';

interface PodcastsPageProps {
  searchQuery?: string;
  podcastId?: string;
  onGoLive?: () => void;
  onCreatePodcast?: () => void;
  onNavigateToTab?: (tab: string) => void;
}

import { SocialFeedHandle } from '../social/SocialFeed';

import { Skeleton } from '../ui/skeleton';

const PodcastCardSkeleton = () => (
  <>
    {/* Grid/card skeleton for sm+ screens */}
    <div className="hidden sm:block animate-pulse">
      <Card className="overflow-hidden border-blue-200/50 dark:border-blue-900/50 h-full flex flex-col relative rounded-2xl">
        <div className="relative aspect-[3/4] sm:aspect-[4/5] overflow-hidden bg-slate-100 dark:bg-slate-800">
          <div className="absolute inset-0 p-4 sm:p-5 flex flex-col justify-end gap-3 text-slate-300 dark:text-slate-700">
            <Skeleton className="h-6 w-3/4 rounded-lg" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-6 w-6 rounded-full" />
              <Skeleton className="h-4 w-1/2 rounded-md" />
            </div>
            <div className="flex gap-4 border-t border-slate-200 dark:border-slate-700 pt-3">
              <Skeleton className="h-3 w-10" />
              <Skeleton className="h-3 w-10" />
              <Skeleton className="h-3 w-10" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-10 flex-1 rounded-xl" />
              <Skeleton className="h-10 w-10 rounded-xl" />
              <Skeleton className="h-10 w-10 rounded-xl" />
            </div>
          </div>
        </div>
      </Card>
    </div>

    {/* List-style skeleton for mobile: matches list layout structure */}
    <div className="block sm:hidden animate-pulse">
      <div className="flex items-center gap-3 p-3 border-b border-slate-200 dark:border-slate-700">
        <div className="w-20 h-20 rounded-md overflow-hidden bg-slate-100">
          <Skeleton className="w-full h-full" />
        </div>
        <div className="flex-1">
          <Skeleton className="h-4 w-2/3 rounded-md mb-2" />
          <Skeleton className="h-3 w-1/2 rounded-md mb-3" />
          <div className="flex items-center gap-3">
            <Skeleton className="h-3 w-12 rounded-md" />
            <Skeleton className="h-3 w-10 rounded-md" />
            <Skeleton className="h-3 w-8 rounded-md" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-10 rounded-md" />
        </div>
      </div>
    </div>
  </>
);


export const PodcastsPage: React.FC<PodcastsPageProps & { socialFeedRef?: React.RefObject<SocialFeedHandle> }> = ({
  searchQuery: externalSearchQuery = '',
  podcastId,
  onGoLive,
  onCreatePodcast,
  onNavigateToTab,
  socialFeedRef,
}) => {
  const isOnline = useOnlineStatus();
  const navigate = useNavigate();
  const [podcastUserId, setPodcastUserId] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  // Initialize global search hook for podcasts
  const { search, results: searchResults, isSearching: isSearchingPodcasts } = useGlobalSearch(
    SEARCH_CONFIGS.podcasts,
    podcastUserId,
    { debounceMs: 500 }
  );

  // Get user ID on mount
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setPodcastUserId(user?.id || null);
    };
    getUser();
  }, []);
  if (!isOnline) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-yellow-50">
        <div className="p-6 bg-white border border-yellow-200 rounded-lg shadow-md flex flex-col items-center">
          <span className="text-yellow-800 text-lg font-semibold mb-2">You're offline</span>
          <span className="text-yellow-700 mb-4">Please check your internet connection to continue browsing podcasts.</span>
          <Button
            variant="outline"
            className="text-yellow-800 border-yellow-300 hover:bg-yellow-100"
            onClick={() => window.location.reload()}
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }
  const [activeTab, setActiveTab] = useState<'discover' | 'my-podcasts' | 'live'>('discover');
  const [selectedFilter, setSelectedFilter] = useState<string | null>(null);
  const [isMobileLayout, setIsMobileLayout] = useState(false);
  const [hasScrolled, setHasScrolled] = useState(false);
  const mixedTopCount = 8; // number of items to keep in grid when mixed mode is active
  const queryClient = useQueryClient();
  const { isFeatureBlocked } = useFeatureAccess();
  const [showLimitsModal, setShowLimitsModal] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [selectedPodcast, setSelectedPodcast] = useState<PodcastWithMeta | null>(null);
  const [showGoLiveDialog, setShowGoLiveDialog] = useState(false);
  const [livePodcastId, setLivePodcastId] = useState<string | null>(null);
  const [hostingPodcastId, setHostingPodcastId] = useState<string | null>(null);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [showMembersDialog, setShowMembersDialog] = useState(false);
  const [selectedPodcastForManagement, setSelectedPodcastForManagement] = useState<PodcastWithMeta | null>(null);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [selectedPodcastForShare, setSelectedPodcastForShare] = useState<PodcastWithMeta | null>(null);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [selectedPodcastForReport, setSelectedPodcastForReport] = useState<PodcastWithMeta | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [podcastToDelete, setPodcastToDelete] = useState<PodcastWithMeta | null>(null);
  const [deletingPodcast, setDeletingPodcast] = useState(false);
  const [listenedPodcasts, setListenedPodcasts] = useState<Set<string>>(new Set());
  const listenedPodcastsRef = useRef<Set<string>>(new Set());
  const [showPodcastGenerator, setShowPodcastGenerator] = useState(false);
  const [isUpdatingCover, setIsUpdatingCover] = useState<string | null>(null);
  const [isGeneratingAiCover, setIsGeneratingAiCover] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Navigate to live pages when hosting/joining — use effects to avoid side-effects during render
  useEffect(() => {
    if (hostingPodcastId) {
      navigate(`/podcast/live/${hostingPodcastId}?host=1`);
      setHostingPodcastId(null);
    }
  }, [hostingPodcastId, navigate]);

  useEffect(() => {
    if (livePodcastId) {
      navigate(`/podcast/live/${livePodcastId}`);
      setLivePodcastId(null);
    }
  }, [livePodcastId, navigate]);

  // Track whether the user has scrolled — used to trigger mixed rendering
  useEffect(() => {
    const onScroll = () => {
      if (window.scrollY > 120) setHasScrolled(true);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Audio control ref
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: loading
  } = usePodcasts(activeTab, { lightweight: activeTab === 'discover' });

  const podcasts = useMemo(() => data?.pages.flat() || [], [data]);

  // Fetch count of own podcasts
  const { data: myPodcastCount = 0 } = useQuery({
    queryKey: ['my-podcast-count', currentUser?.id],
    queryFn: async () => {
      if (!currentUser?.id) return 0;
      const { count, error } = await supabase
        .from('ai_podcasts')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', currentUser.id);
      if (error) {
        //console.error('Error fetching podcast count:', error);
        return 0;
      }
      return count || 0;
    },
    enabled: !!currentUser?.id
  });
  
  const handleGenerateAiCoverForExisting = useCallback(async (podcast: PodcastWithMeta) => {
    setIsGeneratingAiCover(podcast.id);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const prompt = `A professional podcast cover for a show titled "${podcast.title}". Modern, clean, educational style, vibrant colors.`;

      const { data, error } = await supabase.functions.invoke('generate-image-from-text', {
        body: { description: prompt, userId: user.id }
      });

      if (error) throw error;
      if (data?.imageUrl) {
        const { error: updateError } = await supabase
          .from('ai_podcasts')
          .update({ cover_image_url: data.imageUrl })
          .eq('id', podcast.id);

        if (updateError) throw updateError;

        queryClient.invalidateQueries({ queryKey: ['podcasts'] });

        toast.success('AI cover generated and updated');
      }
    } catch (error) {
      //console.error('Error generating AI cover:', error);
      toast.error('Failed to generate AI cover');
    } finally {
      setIsGeneratingAiCover(null);
    }
  }, [queryClient]);

  const handleCreatePodcast = () => {
    if (isFeatureBlocked('maxPodcasts', myPodcastCount)) {
      setShowLimitsModal(true);
    } else {
      setShowPodcastGenerator(true);
    }
  };
   const handleTogglePublic = async (podcast: PodcastWithMeta) => {
    try {
      const newPublicState = !podcast.is_public;

      const { error } = await supabase
        .from('ai_podcasts')
        .update({ is_public: newPublicState })
        .eq('id', podcast.id);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['podcasts'] });

      toast.success(newPublicState ? 'Podcast is now public' : 'Podcast is now private');
    } catch (error) {
      //console.error('Error toggling podcast public status:', error);
      toast.error('Failed to update podcast visibility');
    }
  };

  // Stable wrappers to avoid passing new function references to PodcastCard on every render
  const handleGenerateAiCoverForExistingCb = useCallback((podcast: PodcastWithMeta) => {
    handleGenerateAiCoverForExisting(podcast);
  }, [handleGenerateAiCoverForExisting]);

  const handleTriggerUpdateCover = useCallback((id: string) => {
    setIsUpdatingCover(id);
    fileInputRef.current?.click();
  }, []);

  const handleSharePodcastCb = useCallback((podcast: PodcastWithMeta) => {
    setSelectedPodcastForShare(podcast);
    setShowShareDialog(true);
  }, []);

  const handleTogglePublicCb = useCallback((podcast: PodcastWithMeta) => {
    handleTogglePublic(podcast);
  }, [handleTogglePublic]);

  const handleInviteCb = useCallback((p: PodcastWithMeta) => {
    setSelectedPodcastForManagement(p);
    setShowInviteDialog(true);
  }, []);

  const handleManageMembersCb = useCallback((p: PodcastWithMeta) => {
    setSelectedPodcastForManagement(p);
    setShowMembersDialog(true);
  }, []);

  const handleDeleteCb = useCallback((p: PodcastWithMeta) => {
    setPodcastToDelete(p);
    setShowDeleteDialog(true);
  }, []);

  const handleReportCb = useCallback((p: PodcastWithMeta) => {
    setSelectedPodcastForReport(p);
    setShowReportDialog(true);
  }, []);

  const handleJoinLiveCb = useCallback((id: string, asHost?: boolean) => {
    if (asHost) {
      setHostingPodcastId(id);
    } else {
      setLivePodcastId(id);
    }
  }, []);
// // In PodcastsPage.tsx, add this function
// const loadFullPodcastData = async (podcastId: string) => {
//   const fullData = await fetchFullPodcastData(podcastId);
//   if (fullData) {
//     setSelectedPodcast(fullData);
//     incrementListenCount(podcastId);
//     navigate(`/podcast/${podcastId}`, { state: { podcast: fullData } });
//   } else {
//     toast.error('Failed to load podcast details');
//   }
// };
const incrementListenCount = useCallback(async (podcastId: string) => {
    // Check if this podcast has already been counted in this session (use ref to keep callback stable)
    if (listenedPodcastsRef.current.has(podcastId)) {
      return;
    }

    try {
      if (!currentUser) {
        return;
      }

      if (!navigator.onLine) {
        // mark locally and enqueue for sync
        listenedPodcastsRef.current.add(podcastId);
        setListenedPodcasts(prev => {
          const s = new Set(prev);
          s.add(podcastId);
          return s;
        });
        await offlineStorage.addPendingSync('create', 'podcast_listeners', { podcast_id: podcastId, user_id: currentUser.id });
        return;
      }

      const { data: existingListener, error: listenerError } = await supabase
        .from('podcast_listeners')
        .select('id')
        .eq('podcast_id', podcastId)
        .eq('user_id', currentUser.id)
        .maybeSingle();

      if (listenerError) {
        return;
      }

      if (existingListener) {
        // mark locally to avoid duplicate writes
        listenedPodcastsRef.current.add(podcastId);
        setListenedPodcasts(prev => {
          const s = new Set(prev);
          s.add(podcastId);
          return s;
        });
        return;
      }

      // Add user as a listener in podcast_listeners table
      const { error: insertError } = await supabase
        .from('podcast_listeners')
        .insert({ podcast_id: podcastId, user_id: currentUser.id });
      if (insertError) {
        return;
      }

      // Increment the listen_count in ai_podcasts table
      const { error: rpcError } = await supabase.rpc('increment_podcast_listen_count', { podcast_id: podcastId });
      if (rpcError) {
        // Don't fail silently - log the error but continue
        // console.warn('Failed to increment listen count:', rpcError);
      }

      // Invalidate podcasts query to refresh the listen count in the UI
      queryClient.invalidateQueries({ queryKey: ['podcasts'] });

      // Optimistically mark as listened to avoid duplicate writes in this session
      listenedPodcastsRef.current.add(podcastId);
      setListenedPodcasts(prev => {
        const s = new Set(prev);
        s.add(podcastId);
        return s;
      });
    } catch (err) {
      // ignore errors
    }
  }, [currentUser, queryClient]);
  // Handle podcast selection with audio cleanup
  const handleSelectPodcast = useCallback(async (podcast: PodcastWithMeta) => {
    // Stop any currently playing audio immediately
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.src = '';
      } catch (e) {}
      audioRef.current = null;
    }
    // Increment listen count and navigate to the podcast page with a lightweight preview.
    // Seed react-query cache and prefetch full data once with 5 minute staleTime to avoid refetches on remount.
    incrementListenCount(podcast.id);

    const preview = {
      id: podcast.id,
      title: podcast.title,
      cover_image_url: podcast.cover_image_url,
      user: podcast.user,
      duration: podcast.duration,
      is_live: podcast.is_live,
      is_public: podcast.is_public
    } as Partial<PodcastWithMeta>;

    const cacheKey = ['podcast', podcast.id];
    const existing = queryClient.getQueryData(cacheKey);
    queryClient.setQueryData(cacheKey, preview);
    if (!existing) {
      queryClient.prefetchQuery({ queryKey: cacheKey, queryFn: () => fetchFullPodcastData(podcast.id), staleTime: 1000 * 60 * 5 }).catch(() => {});
    }

    navigate(`/podcast/${podcast.id}`, { state: { podcast: preview } });
  }, [navigate, queryClient, incrementListenCount]);

  // // Handle close podcast panel with audio cleanup
  // const handleClosePodcastPanel = useCallback(() => {
  //   // Stop audio when panel is closed
  //   if (audioRef.current) {
  //     audioRef.current.pause();
  //     audioRef.current = null;
  //   }
  //   setSelectedPodcast(null);
  //   navigate('/podcasts');
  // }, [navigate]);

  const handleUpdateCover = async (podcastId: string, file: File) => {
    setIsUpdatingCover(podcastId);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      const filePath = `covers/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('podcasts')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('podcasts')
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('ai_podcasts')
        .update({ cover_image_url: publicUrl })
        .eq('id', podcastId);

      if (updateError) throw updateError;

      queryClient.invalidateQueries({ queryKey: ['podcasts'] });

      toast.success('Cover image updated');
    } catch (error) {
      //console.error('Error updating cover:', error);
      toast.error('Failed to update cover');
    } finally {
      setIsUpdatingCover(null);
    }
  };


  // Use external search query if provided
  useEffect(() => {
    if (externalSearchQuery !== undefined) {
      setSearchQuery(externalSearchQuery);
    }
  }, [externalSearchQuery]);

  // Handle direct podcast ID navigation
  useEffect(() => {
    if (podcastId) {
      const fetchAndSelectPodcast = async () => {
        try {
          const { data, error } = await supabase
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
            .eq('id', podcastId)
            .single();

          if (error) throw error;
          if (data) {
            // Parse audio_segments
            let audioSegments = [];
            if (typeof data.audio_segments === 'string') {
              try {
                audioSegments = data.audio_segments ? JSON.parse(data.audio_segments) : [];
              } catch (e) {
                audioSegments = [];
              }
            } else {
              audioSegments = data.audio_segments || [];
            }

            // Parse visual_assets
            let visualAssets = null;
            if (data.visual_assets) {
              if (typeof data.visual_assets === 'string') {
                try {
                  visualAssets = JSON.parse(data.visual_assets);
                } catch (e) {
                  visualAssets = null;
                }
              } else {
                visualAssets = data.visual_assets;
              }
            }

            // Fetch user info
            const { data: userData } = await supabase
              .from('social_users')
              .select('id, display_name, username, avatar_url')
              .eq('id', data.user_id)
              .single();

            // Calculate duration
            let totalDuration = data.duration_minutes || 0;
            if (audioSegments.length > 0 && audioSegments[0].end_time !== undefined) {
              const lastSegment = audioSegments[audioSegments.length - 1];
              if (lastSegment && typeof lastSegment.end_time === 'number' && isFinite(lastSegment.end_time)) {
                totalDuration = Math.ceil(lastSegment.end_time / 60);
              }
            }

            const podcastWithMeta: PodcastWithMeta = {
              ...data,
              duration: totalDuration,
              audioSegments,
              visualAssets,
              sources: data.sources || [],
              user: userData ? {
                full_name: userData.display_name || userData.username || 'Anonymous User',
                avatar_url: userData.avatar_url
              } : {
                full_name: 'Anonymous User',
                avatar_url: undefined
              },
              member_count: 0 // Will be updated if needed
            };

            handleSelectPodcast(podcastWithMeta);
          }
        } catch (err) {
          //console.error('Error fetching podcast by ID:', err);
          toast.error('Podcast not found');
        }
      };

      fetchAndSelectPodcast();
    }
  }, [podcastId, handleSelectPodcast]);

  // Wire up external handlers
  useEffect(() => {
    if (onGoLive) {
      // Store the handler to be called from Header
      (window as any).__podcastGoLive = () => setShowGoLiveDialog(true);
    }
    if (onCreatePodcast) {
      (window as any).__podcastCreate = () => handleCreatePodcast();
    }
    return () => {
      delete (window as any).__podcastGoLive;
      delete (window as any).__podcastCreate;
    };
  }, [onGoLive, onCreatePodcast]);

  // Listen for section tab changes from Header
  useEffect(() => {
    const handleTabChange = (event: CustomEvent) => {
      const { section, tab } = event.detail;
      if (section === 'podcasts') {
        // Map header tab IDs to local state: some tabs map to activeTab, others map to quick filters
        const tabMap: Record<string, 'discover' | 'my-podcasts' | 'live'> = {
          'discover': 'discover',
          'my-podcasts': 'my-podcasts',
          'live': 'live'
        };

        if (tabMap[tab]) {
          setActiveTab(tabMap[tab]);
          setSelectedFilter(null);
          return;
        }

        // Podcast-specific quick filters from header
        if (tab === 'audio') {
          setActiveTab('discover');
          setSelectedFilter('Audio');
          return;
        }
        if (tab === 'video') {
          setActiveTab('discover');
          setSelectedFilter('Video');
          return;
        }
        if (tab === 'image-audio') {
          setActiveTab('discover');
          setSelectedFilter('ImageAudio');
          return;
        }
      }
    };

    window.addEventListener('section-tab-change', handleTabChange as EventListener);
    return () => {
      window.removeEventListener('section-tab-change', handleTabChange as EventListener);
    };
  }, []);

  useEffect(() => {
    fetchCurrentUser();

    // Subscribe to all real-time podcast changes (INSERT, UPDATE, DELETE)
    const channel = supabase
      .channel('podcast-all-updates')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all events
          schema: 'public',
          table: 'ai_podcasts'
        },
        () => {
          // Force refetch everything when any change occurs
          queryClient.invalidateQueries({ queryKey: ['podcasts'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeTab, queryClient]);

  const fetchCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUser(user);
  };

  // Infinite scroll for podcasts using IntersectionObserver
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useCallback((node: HTMLDivElement | null) => {
    if (loading) return;
    if (observerRef.current) observerRef.current.disconnect();

    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    });

    if (node) observerRef.current.observe(node);
  }, [loading, hasNextPage, isFetchingNextPage, fetchNextPage]);

  

  

  const handlePlayPodcast = useCallback((podcast: PodcastWithMeta) => {
    // Only increment the listen count and let navigation/selection handle showing the panel.
    incrementListenCount(podcast.id).catch(() => {});
  }, [incrementListenCount]);

  

  // Helper to get all member user IDs for a podcast
  const getPodcastMemberUserIds = async (podcastId: string): Promise<string[]> => {
    const { data, error } = await supabase
      .from('podcast_members')
      .select('user_id')
      .eq('podcast_id', podcastId);
    if (error || !data) return [];
    return data.map((m: any) => m.user_id);
  };

  const handlePodcastCreated = async (podcast) => {
    // Notify all members (including owner)
    const memberIds = await getPodcastMemberUserIds(podcast.id);
    await Promise.all(memberIds.map(uid =>
      createPodcastNotification(
        uid,
        'podcast_created',
        podcast.title,
        podcast.id,
        {
          icon: podcast.user?.avatar_url,
          image: podcast.cover_image_url
        }
      )
    ));
  };

  const handleDeletePodcast = async () => {
    if (!podcastToDelete) return;

    if (!navigator.onLine) {
      await offlineStorage.addPendingSync('delete', STORES.PODCASTS, { id: podcastToDelete.id });
      setPodcastToDelete(null);
      setShowDeleteDialog(false);
      toast.success('Podcast deleted offline');
      return;
    }

    setDeletingPodcast(true);
    try {
      // Delete associated audio file from storage
      if (podcastToDelete.audioSegments && podcastToDelete.audioSegments.length > 0) {
        const audioUrl = podcastToDelete.audioSegments[0].audio_url;
        if (audioUrl) {
          const fileName = audioUrl.split('/').pop();
          if (fileName) {
            await supabase.storage
              .from('podcasts')
              .remove([`live-podcasts/${fileName.split('.')[0]}.webm`]);
          }
        }
      }

      // Delete podcast from database
      const { error } = await supabase
        .from('ai_podcasts')
        .delete()
        .eq('id', podcastToDelete.id);

      if (error) throw error;

      // Send notification to all podcast members
      const memberIds = await getPodcastMemberUserIds(podcastToDelete.id);
      await Promise.all(memberIds.map(uid =>
        createPodcastNotification(
          uid,
          'podcast_deleted',
          podcastToDelete.title,
          podcastToDelete.id,
          {
            icon: podcastToDelete.user?.avatar_url,
            image: podcastToDelete.cover_image_url
          }
        )
      ));

      toast.success('Podcast deleted successfully');
      setShowDeleteDialog(false);
      setPodcastToDelete(null);
      queryClient.invalidateQueries({ queryKey: ['podcasts'] });
    } catch (error: any) {
      //console.error('Error deleting podcast:', error);
      toast.error('Failed to delete podcast: ' + error.message);
    } finally {
      setDeletingPodcast(false);
    }
  };

  // const handleSharePodcast = async (podcast: PodcastWithMeta) => {
  //   setSelectedPodcastForShare(podcast);
  //   setShowShareDialog(true);
  // };

  // const handleShareToSocial = async (podcast: PodcastWithMeta) => {
  //   try {
  //     if (!currentUser) {
  //       toast.error('Please sign in to share to social feed');
  //       return;
  //     }

  //     const podcastUrl = `${window.location.origin}/podcasts/${podcast.id}`;

  //     const { data: post, error } = await supabase
  //       .from('social_posts')
  //       .insert({
  //         author_id: currentUser.id,
  //         content:
  //           `ðŸŽ™ï¸ Check out my new podcast: ${podcast.title}\n\nDuration: ${podcast.duration || 0} minutes\n\n` +
  //           `Listen now on StuddyHub Podcasts: ${podcastUrl}`,
  //         privacy: 'public',
  //         metadata: {
  //           type: 'podcast',
  //           podcastId: podcast.id,
  //           title: podcast.title,
  //           description: podcast.description || '',
  //           coverUrl: podcast.cover_image_url,
  //           authorName: podcast.user?.full_name || 'Anonymous'
  //         }
  //       })
  //       .select()
  //       .single();

  //     if (error) throw error;

  //     // Attach the cover image as a file to the post if it exists
  //     if (post && podcast.cover_image_url) {
  //       const mimeType = podcast.cover_image_url.endsWith('.png') ? 'image/png' : 'image/jpeg';
  //       const { error: mediaError } = await supabase.from('social_media').insert({
  //         post_id: post.id,
  //         url: podcast.cover_image_url,
  //         type: 'image',
  //         mime_type: mimeType,
  //         filename: podcast.cover_image_url.split('/').pop() || 'cover.jpg',
  //         size_bytes: 0
  //       });
  //       if (mediaError) {
  //         //console.error('Media attachment error:', mediaError);
  //         toast.error('Podcast shared, but failed to attach cover image.');
  //       }
  //     }

  //     // Track share
  //     await supabase.from('podcast_shares').insert({
  //       podcast_id: podcast.id,
  //       user_id: currentUser.id,
  //       share_type: 'social_post',
  //       platform: 'studdyhub'
  //     });

  //     await supabase.rpc('increment_podcast_share_count', { podcast_id: podcast.id });

  //     toast.success('Shared to social feed!', {
  //       icon: 'âœ¨',
  //       action: {
  //         label: 'View',
  //         onClick: () => window.location.href = '/social'
  //       }
  //     });
  //   } catch (error) {
  //     //console.error('Error sharing to social feed:', error);
  //     toast.error('Failed to share to social feed');
  //   }
  // };

 

  const filteredPodcasts = useMemo(() => {
    const q = deferredSearchQuery.toLowerCase().trim();
    let list = podcasts.filter(podcast =>
      !q || (
        (podcast.title || '').toLowerCase().includes(q) ||
        (podcast.description || '').toLowerCase().includes(q) ||
        (podcast.tags || []).some((tag: string) => tag.toLowerCase().includes(q))
      )
    );

    // Client-side quick filters
    if (selectedFilter) {
      if (selectedFilter === 'Audio') list = list.filter(p => (p.podcast_type || 'audio') === 'audio');
      if (selectedFilter === 'Video') list = list.filter(p => p.podcast_type === 'video');
      if (selectedFilter === 'Live') list = list.filter(p => p.is_live);
      if (selectedFilter === 'ImageAudio') list = list.filter(p => p.podcast_type === 'image-audio' || (!!p.cover_image_url && ((p.podcast_type || 'audio') === 'audio')));
      if (selectedFilter === 'Most Popular') list = [...list].sort((a, b) => (b.listen_count || 0) - (a.listen_count || 0));
      if (selectedFilter === 'Newest') list = [...list].sort((a, b) => new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime());
    }

    return list;
  }, [podcasts, deferredSearchQuery, selectedFilter]);

  // Mobile detection for categorized rendering
  useEffect(() => {
    const check = () => setIsMobileLayout(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const categoryOf = (p: PodcastWithMeta) => {
    if (p.is_live) return 'Live';
    if (p.podcast_type === 'video') return 'Video';
    if (p.podcast_type === 'image-audio') return 'ImageAudio';
    if (!p.podcast_type || p.podcast_type === 'audio') return 'Audio';
    return 'Other';
  };

  const groupedByCategory = useMemo(() => {
    const order = ['Live','Video','ImageAudio','Audio','Other'];
    const map: Record<string, PodcastWithMeta[]> = { Live: [], Video: [], ImageAudio: [], Audio: [], Other: [] };
    (filteredPodcasts || []).forEach(p => {
      const c = categoryOf(p);
      map[c] = map[c] || [];
      map[c].push(p);
    });
    return order.map(k => ({ key: k, items: map[k] || [] })).filter(s => (s.items || []).length > 0);
  }, [filteredPodcasts]);

  const trendingPodcasts = useMemo(() => {
    if (!podcasts || podcasts.length === 0) return [];
    // prioritize live-streams then by listen_count
    const liveFirst = [...podcasts].sort((a, b) => {
      if (a.is_live && !b.is_live) return -1;
      if (!a.is_live && b.is_live) return 1;
      return (b.listen_count || 0) - (a.listen_count || 0);
    });
    return liveFirst.slice(0, 5);
  }, [podcasts]);

  const renderTypeBadgeFor = (p: PodcastWithMeta) => {
    const t = p.podcast_type ;
    if (t === 'video') return (<Badge className="bg-blue-500 text-white px-2 py-0.5 text-xs flex items-center gap-1"><Video className="h-3 w-3"/> Video</Badge>);
    if (t === 'live-stream') return (<Badge className="bg-red-500 text-white px-2 py-0.5 text-xs flex items-center gap-1 animate-pulse"><Radio className="h-3 w-3"/> Live</Badge>);
    if (t === 'image-audio') return (<Badge className="bg-indigo-600 text-white px-2 py-0.5 text-xs flex items-center gap-1"><ImageIcon className="h-3 w-3"/> <Headphones className="h-3 w-3"/> Mix</Badge>);
    return (<Badge className="bg-emerald-500 text-white px-2 py-0.5 text-xs flex items-center gap-1"><Headphones className="h-3 w-3"/> Audio</Badge>);
  };

  // Keep selectedPodcast metadata in sync with updates to the list
  useEffect(() => {
    if (selectedPodcast) {
      const updatedMatch = podcasts.find(p => p.id === selectedPodcast.id);
      if (updatedMatch) {
        // Check for meaningful changes to avoid unnecessary updates
        const hasChanged =
          updatedMatch.title !== selectedPodcast.title ||
          updatedMatch.cover_image_url !== selectedPodcast.cover_image_url ||
          updatedMatch.is_public !== selectedPodcast.is_public ||
          updatedMatch.is_live !== selectedPodcast.is_live ||
          updatedMatch.listen_count !== selectedPodcast.listen_count;

        if (hasChanged) {
          setSelectedPodcast(prev => prev ? { ...prev, ...updatedMatch } : updatedMatch);
        }
      }
    }
  }, [podcasts, selectedPodcast?.id]);

  // Note: navigation is handled directly in `handleSelectPodcast`; no effect needed here.

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-slate-50 to-blue-50/30 dark:from-slate-950 dark:to-blue-950/20">
      {/* Search Bar - Improved Desktop Layout */}
      <div className="border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto p-4">
          <div className="relative">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-4">
              {/* Search Input */}
              <div className="relative flex-1 min-w-[300px]">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search podcasts by title, description, or tags..."
                  className="pl-10 h-12 bg-white dark:bg-slate-900 w-full"
                />
              </div>

              {/* Filter Chips */}
              <div className="flex flex-wrap gap-2 items-center md:ml-4">
                {['Audio','Video','Live','Most Popular','Newest'].map(chip => (
                  <button
                    key={chip}
                    onClick={() => setSelectedFilter(prev => prev === chip ? null : chip)}
                    className={`flex-shrink-0 text-sm px-3 py-1 rounded-full border transition-all ${selectedFilter===chip ? 'bg-blue-600 text-white border-blue-600' : 'bg-white/60 dark:bg-slate-800 text-slate-700 dark:text-slate-200'}`}
                  >
                    {chip}
                  </button>
                ))}
                {selectedFilter && (
                  <Button variant="ghost" size="sm" onClick={() => setSelectedFilter(null)} className="ml-2 flex-shrink-0">Clear</Button>
                )}
              </div>

              {/* Reset Button */}
              <div className="flex items-center md:ml-4">
                <Button variant="ghost" size="sm" onClick={() => { setSearchQuery(''); setSelectedFilter(null); }} className="hidden md:inline-flex">Reset</Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full flex flex-col">
          <ScrollArea className="flex-1">
            <div className="max-w-7xl mx-auto p-2 pb-12 sm:p-24 lg:p-20">
              {/* Quick filter chips moved into the search bar below */}
              {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <PodcastCardSkeleton key={i} />
                  ))}
                </div>
              ) : filteredPodcasts.length === 0 && !isFetchingNextPage ? (
                <div className="flex flex-col items-center justify-center h-64 text-center">
                  {activeTab === 'live' ? (
                    <Radio className="h-16 w-16 text-slate-300 dark:text-slate-700 mb-4" />
                  ) : (
                    <Podcast className="h-16 w-16 text-slate-300 dark:text-slate-700 mb-4" />
                  )}
                  <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    {searchQuery
                      ? 'No podcasts found'
                      : activeTab === 'live'
                        ? 'No live podcasts'
                        : activeTab === 'my-podcasts'
                          ? 'No podcasts yet'
                          : 'No podcasts available'}
                  </h3>
                  <p className="text-slate-500 dark:text-slate-500 mb-4">
                    {searchQuery
                      ? 'Try adjusting your search'
                      : activeTab === 'live'
                        ? 'No one is streaming live right now. Start your own live podcast!'
                        : activeTab === 'my-podcasts'
                          ? 'Create your first podcast to get started'
                          : 'Check back later for new content'}
                  </p>
                  {!searchQuery && activeTab === 'live' && (
                    <Button
                      onClick={() => setShowGoLiveDialog(true)}
                      className="bg-gradient-to-r from-red-500 to-violet-500"
                    >
                      <Radio className="h-4 w-4 mr-2" />
                      Go Live
                    </Button>
                  )}
                  {!searchQuery && activeTab === 'my-podcasts' && (
                    <Button
                      onClick={handleCreatePodcast}
                      className="bg-gradient-to-r from-blue-500 to-violet-500"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Create Podcast
                    </Button>
                  )}
                  <div className="mt-3">
                    <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ['podcasts'] })} className="mr-2">Retry</Button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Podcast selection now navigates to its own page */}
                  
                  {/* Render Podcast Cards if no podcast is selected */}
                  {!selectedPodcast && (
                    <>
                      {/* Featured Carousel (Discover tab only) */}
                      {activeTab === 'discover' && trendingPodcasts.length > 0 && (
                        <div className="mb-6">
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="text-lg font-semibold">Featured</h3>
                            <div className="flex items-center gap-2">
                              {/* Controls appear on the carousel itself on larger screens */}
                            </div>
                          </div>
                          <Carousel className="w-full relative">
                            <CarouselPrevious className="hidden md:block" />
                            <CarouselContent className="flex gap-4">
                              {trendingPodcasts.map(tp => (
                                <CarouselItem key={tp.id} className="max-w-[420px]">
                                  <div className="relative rounded-xl overflow-hidden shadow-lg">
                                    {tp.cover_image_url ? (
                                      <img src={tp.cover_image_url} alt={tp.title} className="w-full h-56 object-cover" />
                                    ) : (
                                      <div className="w-full h-56 bg-slate-200 flex items-center justify-center"><Radio className="h-12 w-12 text-slate-400"/></div>
                                    )}
                                    {/* Type Badge (top-left) */}
                                    <div className="absolute top-3 left-3 z-10">
                                      {renderTypeBadgeFor(tp)}
                                    </div>
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex items-end p-4">
                                      <div className="w-full">
                                        <h4 className="text-white font-semibold text-lg line-clamp-2">{tp.title}</h4>
                                        <div className="mt-2 flex items-center gap-2">
                                          
                                          {tp.is_live ? (
                                            <Button size="sm" className="bg-red-600 text-white animate-pulse" onClick={() => handleJoinLiveCb(tp.id)}>
                                              <Radio className="h-4 w-4 mr-2" /> Join Live
                                            </Button>
                                          ) : (
                                            <Button size="sm" className="bg-white text-blue-600" onClick={() => { handlePlayPodcast(tp); navigate(`/podcast/${tp.id}`); }}>
                                              <Play className="h-4 w-4 mr-2" /> Play
                                            </Button>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </CarouselItem>
                              ))}
                            </CarouselContent>
                            <CarouselNext className="hidden md:block" />
                          </Carousel>
                        </div>
                      )}
                      {isMobileLayout ? (
                        // Mobile: render grouped category sections stacked vertically
                        <div className="flex flex-col space-y-6">
                          {groupedByCategory.map(section => (
                            <div key={section.key}>
                              <div className="flex items-center justify-between mb-2">
                                <h4 className="font-semibold">{section.key === 'ImageAudio' ? 'Image + Audio' : section.key}</h4>
                                <span className="text-sm text-muted-foreground">{section.items.length} items</span>
                              </div>
                              <div className="flex flex-col gap-3 border-b pb-4">
                                {section.items.map((podcast: PodcastWithMeta) => (
                                  <div
                                    key={podcast.id}
                                    className="flex items-center gap-3 p-3 rounded-xl bg-card border-b border-slate-200 dark:border-slate-700 sm:border-b-0 cursor-pointer"
                                    onClick={() => {
                                      handlePlayPodcast(podcast);
                                      navigate(`/podcast/${podcast.id}`);
                                    }}
                                  >
                                    <div className="w-20 h-20 rounded-md overflow-hidden flex-shrink-0 bg-slate-100">
                                      {podcast.cover_image_url ? (
                                        <img src={podcast.cover_image_url} alt={podcast.title} className="w-full h-full object-cover" />
                                      ) : (
                                        <div className="w-full h-full flex items-center justify-center"><Radio className="h-6 w-6 text-slate-400"/></div>
                                      )}
                                    </div>
                                    <div className="flex-1">
                                      <div className="flex items-center justify-between">
                                          <h5 className="font-medium text-sm line-clamp-2">{podcast.title}</h5>
                                        </div>
                                      <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{podcast.description}</p>
                                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                                        <div className="flex items-center gap-1"><Eye className="h-4 w-4" /> {podcast.listen_count || 0}</div>
                                        <div className="flex items-center gap-1"><Clock className="h-4 w-4" /> {podcast.duration || podcast.duration_minutes || 0}m</div>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <div className="flex flex-col items-center gap-1 pointer-events-none">
                                        {podcast.podcast_type === 'live-stream'
                                          ? <Badge className="bg-red-600 text-white text-[10px] px-2">LIVE</Badge>
                                          : renderTypeBadgeFor(podcast)
                                        }
                                      </div>
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <Button
                                            size="icon"
                                            variant="ghost"
                                            onClick={(e) => e.stopPropagation()}
                                          >
                                            <MoreVertical className="h-4 w-4" />
                                          </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className='bg-white dark:bg-slate-800 rounded-xl border-0 shadow-2xl'>
                                          {podcast.user_id === currentUser?.id && (
                                            <>
                                              <DropdownMenuItem
                                                onClick={() => handleInviteCb(podcast)}
                                                className='hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer'
                                              >
                                                <UserPlus className='h-4 w-4 mr-2' />
                                                Invite Members
                                              </DropdownMenuItem>
                                              <DropdownMenuItem
                                                onClick={() => handleManageMembersCb(podcast)}
                                                className='hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer'
                                              >
                                                <Users className='h-4 w-4 mr-2' />
                                                Manage Members
                                              </DropdownMenuItem>
                                              <DropdownMenuItem
                                                onClick={() => handleTogglePublicCb(podcast)}
                                                className='hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer'
                                              >
                                                {podcast.is_public ? <Lock className='h-4 w-4 mr-2' /> : <Globe className='h-4 w-4 mr-2' />}
                                                Make {podcast.is_public ? 'Private' : 'Public'}
                                              </DropdownMenuItem>
                                              <DropdownMenuSeparator className="bg-slate-100 dark:bg-slate-700" />
                                              <DropdownMenuItem
                                                onClick={() => handleTriggerUpdateCover(podcast.id)}
                                                className='hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer'
                                                disabled={isUpdatingCover === podcast.id}
                                              >
                                                {isUpdatingCover === podcast.id ? (
                                                  <><Loader2 className='h-4 w-4 mr-2 animate-spin' /> Uploading...</>
                                                ) : (
                                                  <><ImageIcon className='h-4 w-4 mr-2' /> Update Cover</>
                                                )}
                                              </DropdownMenuItem>
                                              <DropdownMenuItem
                                                onClick={() => handleGenerateAiCoverForExistingCb(podcast)}
                                                className='hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer'
                                                disabled={isGeneratingAiCover === podcast.id}
                                              >
                                                {isGeneratingAiCover === podcast.id ? (
                                                  <><Loader2 className='h-4 w-4 mr-2 animate-spin' /> Generating...</>
                                                ) : (
                                                  <><Sparkles className='h-4 w-4 mr-2' /> Generate AI Cover</>
                                                )}
                                              </DropdownMenuItem>
                                              <DropdownMenuSeparator className="bg-slate-100 dark:bg-slate-700" />
                                              <DropdownMenuItem
                                                onClick={() => handleDeleteCb(podcast)}
                                                className='hover:bg-red-50 dark:hover:bg-red-950 text-red-600 dark:text-red-400 cursor-pointer'
                                              >
                                                <Trash2 className='h-4 w-4 mr-2' />
                                                Delete Podcast
                                              </DropdownMenuItem>
                                            </>
                                          )}
                                          {podcast.user_id !== currentUser?.id && (
                                            <DropdownMenuItem
                                              onClick={() => handleReportCb(podcast)}
                                              className='hover:bg-red-50 dark:hover:bg-red-950 text-red-600 dark:text-red-400 cursor-pointer'
                                            >
                                              <Flag className='h-4 w-4 mr-2' />
                                              Report
                                            </DropdownMenuItem>
                                          )}
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        (() => {
                          const renderMixed = !selectedFilter && hasScrolled && !isMobileLayout;
                          if (renderMixed) {
                            const top = filteredPodcasts.slice(0, mixedTopCount);
                            const rest = filteredPodcasts.slice(mixedTopCount);
                            return (
                              <>
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
                                  {top.map((podcast) => (
                                    <PodcastCard
                                      key={podcast.id}
                                      podcast={podcast}
                                      isOwner={podcast.user_id === currentUser?.id}
                                      onPlay={handlePlayPodcast}
                                      onShare={handleSharePodcastCb}
                                      onInvite={handleInviteCb}
                                      onManageMembers={handleManageMembersCb}
                                      onTogglePublic={handleTogglePublicCb}
                                      onUpdateCover={handleTriggerUpdateCover}
                                      onGenerateAiCover={handleGenerateAiCoverForExistingCb}
                                      onDelete={handleDeleteCb}
                                      onReport={handleReportCb}
                                      onJoinLive={handleJoinLiveCb}
                                      onSelect={handleSelectPodcast}
                                      isUpdatingCover={isUpdatingCover}
                                      isGeneratingAiCover={isGeneratingAiCover}
                                      fileInputRef={fileInputRef}
                                      navigate={navigate}
                                    />
                                  ))}
                                </div>
                                {rest.length > 0 && (
                                  <div className="flex flex-col divide-y mt-6">
                                      {rest.map(podcast => (
                                        <div
                                          key={podcast.id}
                                          className="flex items-center gap-4 p-3 border-b border-slate-200 dark:border-slate-700 sm:border-b-0 cursor-pointer"
                                          onClick={() => {
                                            handlePlayPodcast(podcast);
                                            navigate(`/podcast/${podcast.id}`);
                                          }}
                                        >
                                        <div className="w-24 h-24 rounded-lg overflow-hidden bg-slate-200 flex-shrink-0">
                                          {podcast.cover_image_url ? (
                                            <img src={podcast.cover_image_url} alt={podcast.title} className="w-full h-full object-cover" />
                                          ) : (
                                            <div className="w-full h-full flex items-center justify-center"><Radio className="h-8 w-8 text-slate-400"/></div>
                                          )}
                                        </div>
                                        <div className="flex-1">
                                          <div className="flex items-center justify-between">
                                            <h4 className="font-semibold text-sm line-clamp-2">{podcast.title}</h4>
                                            <div className="flex items-center gap-2">
                                              {podcast.is_live ? <Badge className="bg-red-600 text-white text-xs px-2">LIVE</Badge> : renderTypeBadgeFor(podcast)}
                                            </div>
                                          </div>
                                          <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{podcast.description}</p>
                                          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                                            <div className="flex items-center gap-1"><Eye className="h-4 w-4" /> {podcast.listen_count || 0}</div>
                                            <div className="flex items-center gap-1"><Clock className="h-4 w-4" /> {podcast.duration || podcast.duration_minutes || 0}m</div>
                                            <div className="flex items-center gap-1"><Users className="h-4 w-4" /> {((podcast as any).member_count ?? 0)}</div>
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                              <Button
                                                size="icon"
                                                variant="ghost"
                                                onClick={(e) => e.stopPropagation()}
                                              >
                                                <MoreVertical className="h-4 w-4" />
                                              </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className='bg-white dark:bg-slate-800 rounded-xl border-0 shadow-2xl'>
                                              <DropdownMenuItem onClick={() => handleSharePodcastCb(podcast)}>Share</DropdownMenuItem>
                                              <DropdownMenuItem onClick={() => handleInviteCb(podcast)}>Invite</DropdownMenuItem>
                                            </DropdownMenuContent>
                                          </DropdownMenu>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </>
                            );
                          }

                          // default: full grid
                          return (
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
                              {filteredPodcasts.map((podcast) => (
                                <PodcastCard
                                  key={podcast.id}
                                  podcast={podcast}
                                  isOwner={podcast.user_id === currentUser?.id}
                                  onPlay={handlePlayPodcast}
                                  onShare={handleSharePodcastCb}
                                  onInvite={handleInviteCb}
                                  onManageMembers={handleManageMembersCb}
                                  onTogglePublic={handleTogglePublicCb}
                                  onUpdateCover={handleTriggerUpdateCover}
                                  onGenerateAiCover={handleGenerateAiCoverForExistingCb}
                                  onDelete={handleDeleteCb}
                                  onReport={handleReportCb}
                                  onJoinLive={handleJoinLiveCb}
                                  onSelect={handleSelectPodcast}
                                  isUpdatingCover={isUpdatingCover}
                                  isGeneratingAiCover={isGeneratingAiCover}
                                  fileInputRef={fileInputRef}
                                  navigate={navigate}
                                />
                              ))}
                            </div>
                          );
                        })()
                      )}

                      {hasNextPage && (
                        <div ref={loadMoreRef} className="flex justify-center py-8">
                          {isFetchingNextPage ? (
                            <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                          ) : (
                            <div className="h-1" />
                          )}
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* Go Live Dialog */}
      <GoLiveDialog
        isOpen={showGoLiveDialog}
        onClose={() => setShowGoLiveDialog(false)}
        onLiveStart={(podcastId) => {
          setHostingPodcastId(podcastId);
          queryClient.invalidateQueries({ queryKey: ['podcasts'] });
        }}
      />

      {/* Navigation for live hosting/viewing is handled via effects (avoid side-effects during render) */}

      {/* Invite Members Dialog */}
      {showInviteDialog && selectedPodcastForManagement && (
        <InviteMembersDialog
          isOpen={showInviteDialog}
          onClose={() => {
            setShowInviteDialog(false);
            setSelectedPodcastForManagement(null);
          }}
          podcastId={selectedPodcastForManagement.id}
          podcastTitle={selectedPodcastForManagement.title}
        />
      )}

      {/* Manage Members Dialog */}
      {showMembersDialog && selectedPodcastForManagement && (
        <ManageMembersDialog
          isOpen={showMembersDialog}
          onClose={() => {
            setShowMembersDialog(false);
            setSelectedPodcastForManagement(null);
          }}
          podcastId={selectedPodcastForManagement.id}
          podcastTitle={selectedPodcastForManagement.title}
          isOwner={selectedPodcastForManagement.user_id === currentUser?.id}
        />
      )}

      {/* Share Podcast Dialog */}
      {showShareDialog && selectedPodcastForShare && (
        <SharePodcastDialog
          open={showShareDialog}
          onClose={() => {
            setShowShareDialog(false);
            setSelectedPodcastForShare(null);
          }}
          podcast={selectedPodcastForShare}
          currentUser={currentUser}
          onShareToFeedDraft={({ content, coverUrl, podcast }) => {
            if (onNavigateToTab) {
              onNavigateToTab('social');

              const payload = {
                content,
                coverUrl,
                metadata: {
                  type: 'podcast',
                  podcastId: podcast.id,
                  title: podcast.title,
                  description: podcast.description || '',
                  coverUrl: podcast.cover_image_url,
                  authorName: podcast.user?.full_name || 'Anonymous'
                }
              };

              let attempts = 0;
              const maxAttempts = 20;
              const checkRef = () => {
                if (socialFeedRef?.current) {
                  socialFeedRef.current.openCreatePostDialog(payload);
                } else if (attempts < maxAttempts) {
                  attempts++;
                  setTimeout(checkRef, 100);
                }
              };

              setTimeout(checkRef, 100);
            } else {
              if (socialFeedRef?.current) {
                socialFeedRef.current.openCreatePostDialog({
                  content,
                  coverUrl,
                  metadata: {
                    type: 'podcast',
                    podcastId: podcast.id,
                    title: podcast.title,
                    description: podcast.description || '',
                    coverUrl: podcast.cover_image_url,
                    authorName: podcast.user?.full_name || 'Anonymous'
                  }
                });
              }
            }
            setShowShareDialog(false);
          }}
        />
      )}

      {/* Report Podcast Dialog */}
      {showReportDialog && selectedPodcastForReport && (
        <ReportPodcastDialog
          isOpen={showReportDialog}
          onClose={() => {
            setShowReportDialog(false);
            setSelectedPodcastForReport(null);
          }}
          podcastId={selectedPodcastForReport.id}
          podcastTitle={selectedPodcastForReport.title}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Podcast</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{podcastToDelete?.title}"? This action cannot be undone.
              All associated data including audio files and transcripts will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingPodcast}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePodcast}
              disabled={deletingPodcast}
              className="bg-red-600 hover:bg-red-700"
            >
              {deletingPodcast ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Podcast
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Podcast Generator */}
      {showPodcastGenerator && (
        <PodcastGenerator
          onClose={() => setShowPodcastGenerator(false)}
          onPodcastGenerated={async (podcast) => {
            setShowPodcastGenerator(false);
            toast.success('Podcast generated successfully!');
            queryClient.invalidateQueries({ queryKey: ['podcasts'] });
            await handlePodcastCreated(podcast);
          }}
        />
      )}

      <SubscriptionLimitsModal
        isOpen={showLimitsModal}
        onClose={() => setShowLimitsModal(false)}
      />

      {/* Floating Action Buttons */}
      <div className="fixed bottom-16 right-2 flex flex-col gap-3 z-50">
        {/* Tips Button */}
        {(window as any).__toggleTips && (
          <button
            onClick={() => (window as any).__toggleTips?.()}
            className="h-11 w-11 rounded-full shadow-lg text-blue-500 dark:text-yellow-400 hover:text-yellow-600 dark:hover:text-yellow-300 transition-all duration-300 hover:scale-110 cursor-pointer bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 backdrop-blur-sm flex items-center justify-center"
            style={{
              filter: 'drop-shadow(0 0 8px rgba(36, 190, 251, 0.6))',
              animation: 'glow 2s ease-in-out infinite'
            }}
            title="Quick Tips"
          >
            <Lightbulb className="w-6 h-6 fill-current" />
          </button>
        )}
        
        {/* Refresh Button */}
        <button
          aria-label="Refresh Podcasts"
          onClick={() => {
            queryClient.resetQueries({ queryKey: ['podcasts'] });
            queryClient.refetchQueries({ queryKey: ['podcasts'] });
            toast.info('Refreshing podcasts...');
          }}
          className="h-11 w-11 rounded-full bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center border border-slate-100 dark:border-slate-800 backdrop-blur-sm"
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
          ) : (
            <RefreshCcw className="h-5 w-5 text-blue-600" />
          )}
        </button>
      </div>

      {/* Hidden File Input for Cover Update */}
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/*"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && isUpdatingCover) {
            handleUpdateCover(isUpdatingCover, file);
          }
          // Reset input
          e.target.value = '';
        }}
      />
    </div>
  );
};