// PodcastsPage.tsx - Complete fixed version
import React, { useState, useEffect, useCallback, useRef, useMemo, useDeferredValue, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { ScrollArea } from '../ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
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
  Image as ImageIcon
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { offlineStorage, STORES } from '@/utils/offlineStorage';
import { PodcastPanel } from './PodcastPanel';
import { PodcastData, PodcastGenerator } from './PodcastGenerator';
import { GoLiveDialog } from './GoLiveDialog';
import { LivePodcastViewer } from './LivePodcastViewer';
import { LivePodcastHost } from './LivePodcastHost';
import { InviteMembersDialog } from './InviteMembersDialog';
import { ManageMembersDialog } from './ManageMembersDialog';
import { SharePodcastDialog } from './SharePodcastDialog';
import { ReportPodcastDialog } from './ReportPodcastDialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '../ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import { getPodcastPermissions } from '@/services/podcastModerationService';
import { usePodcasts, PodcastWithMeta, fetchFullPodcastData } from '@/hooks/usePodcasts';
import { createPodcastNotification } from '@/services/notificationHelpers';
import { useQuery, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { SubscriptionLimitsModal } from '../subscription/SubscriptionLimitsModal';
import { useNavigate } from 'react-router-dom';

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
);

const PodcastCard = memo(({
  podcast,
  isOwner,
  onPlay,
  onShare,
  onInvite,
  onManageMembers,
  onTogglePublic,
  onUpdateCover,
  onGenerateAiCover,
  onDelete,
  onReport,
  onJoinLive,
  onSelect,
  isUpdatingCover,
  isGeneratingAiCover,
  navigate,
  fileInputRef
}: {
  podcast: PodcastWithMeta;
  isOwner: boolean;
  onPlay: (p: PodcastWithMeta) => void;
  onShare: (p: PodcastWithMeta) => void;
  onInvite: (p: PodcastWithMeta) => void;
  onManageMembers: (p: PodcastWithMeta) => void;
  onTogglePublic: (p: PodcastWithMeta) => void;
  onUpdateCover: (id: string) => void;
  onGenerateAiCover: (p: PodcastWithMeta) => void;
  onDelete: (p: PodcastWithMeta) => void;
  onReport: (p: PodcastWithMeta) => void;
  onJoinLive: (id: string, asHost?: boolean) => void;
  onSelect: (p: PodcastWithMeta) => void;
  isUpdatingCover: string | null;
  isGeneratingAiCover: string | null;
  navigate: (path: string) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
}) => {
  const [showActions, setShowActions] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      layout
      className="group"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
      onClick={() => setShowActions(!showActions)}
    >
      <Card className="overflow-hidden hover:shadow-2xl transition-all duration-300 border-blue-200/50 dark:border-blue-900/50 h-full flex flex-col relative rounded-2xl cursor-pointer">
        {/* Background Image with Overlay */}
        <div className="relative aspect-[3/4] sm:aspect-[4/5] overflow-hidden">
          {/* Cover Image */}
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-violet-500">
            {podcast.cover_image_url ? (
              <img
                src={podcast.cover_image_url}
                alt={podcast.title}
                loading="lazy"
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Radio className="h-12 w-12 sm:h-16 sm:w-16 text-white opacity-30" />
              </div>
            )}
          </div>

          {/* Gradient Overlay - Hidden until hover */}
          <div className={`absolute inset-0 bg-gradient-to-t from-black/95 via-black/60 to-transparent transition-opacity duration-500 ${showActions ? 'opacity-100' : 'opacity-0'}`} />

          {/* Live Badge - Animated visibility */}
          {podcast.is_live && (
            <div className={`absolute top-3 left-3 z-10 transition-all duration-300 transform ${showActions ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
              <Badge className="bg-red-500 text-white animate-pulse text-[10px] sm:text-xs border-0 shadow-lg px-2">
                <Radio className="h-2.5 w-2.5 mr-1" />
                LIVE
              </Badge>
            </div>
          )}

          {/* Privacy Badge - Animated visibility */}
          <div className={`absolute top-3 right-3 z-10 transition-all duration-300 transform ${showActions ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
            <Badge
              variant="secondary"
              className="bg-black/40 text-white backdrop-blur-md text-[10px] sm:text-xs border-0 shadow-lg px-2"
            >
              {podcast.is_public ? <Globe className="h-2.5 w-2.5 mr-1" /> : <Lock className="h-2.5 w-2.5 mr-1" />}
              <span className="hidden sm:inline ml-1">{podcast.is_public ? 'Public' : 'Private'}</span>
            </Badge>
          </div>

          {/* Content Overlay - Hidden until hover */}
          <div className={`absolute inset-0 flex flex-col justify-end p-4 sm:p-5 transition-all duration-500 ${showActions ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8 pointer-events-none'}`}>
            {/* Title & Author */}
            <div className="space-y-2 mb-3">
              <h3 className="text-white font-bold text-base sm:text-lg line-clamp-2 leading-tight drop-shadow-md">
                {podcast.title}
              </h3>

              <div className="flex items-center gap-2">
                <Avatar className="h-6 w-6 sm:h-7 sm:w-7 ring-2 ring-white/20">
                  <AvatarImage src={podcast.user?.avatar_url} />
                  <AvatarFallback className="text-[10px] bg-blue-500 text-white">
                    {podcast.user?.full_name?.charAt(0) || 'U'}
                  </AvatarFallback>
                </Avatar>
                <span className="text-white/90 text-xs sm:text-sm font-medium truncate drop-shadow-sm">
                  {podcast.user?.full_name || 'Unknown'}
                </span>
              </div>
            </div>

            {/* Stats - Compact Row */}
            <div className="flex items-center gap-4 text-xs text-white/80 mb-4 border-t border-white/10 pt-3">
              <div className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                <span>{podcast.duration || 0}m</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Eye className="h-3.5 w-3.5" />
                <span>{podcast.listen_count || 0}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                <span>{podcast.member_count ?? 0}</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              {/* Main Play Button */}
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  if (podcast.is_live) {
                    // Owners should continue hosting; other users join as listeners
                    onJoinLive(podcast.id, isOwner);
                  } else {
                    onPlay(podcast);
                    onSelect(podcast);
                    navigate(`/podcasts/${podcast.id}`);
                  }
                }}
                className="flex-1 bg-white text-blue-600 hover:bg-white/90 font-bold text-xs sm:text-sm h-9 sm:h-10 rounded-xl shadow-lg border-0"
                size="sm"
              >
                {podcast.is_live ? (
                  <Radio className="h-4 w-4 mr-2 animate-pulse" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                <span>{podcast.is_live ? (isOwner ? 'Continue' : 'Join') : 'Listen'}</span>
              </Button>

              {/* Share Button */}
              <Button
                variant="outline"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  onShare(podcast);
                }}
                className="border-white/20 bg-white/20 hover:bg-white/30 text-white backdrop-blur-md h-9 w-9 sm:h-10 sm:w-10 rounded-xl"
                title="Share"
              >
                <Share2 className="h-4 w-4" />
              </Button>

              {/* More Options Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={(e) => e.stopPropagation()}
                    className="border-white/20 bg-white/20 hover:bg-white/30 text-white backdrop-blur-md h-9 w-9 sm:h-10 sm:w-10 rounded-xl"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className='bg-white dark:bg-slate-800 rounded-xl border-0 shadow-2xl'>
                  {isOwner && (
                    <>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          onInvite(podcast);
                        }}
                        className="rounded-lg m-1"
                      >
                        <UserPlus className="h-4 w-4 mr-2" />
                        Invite Members
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          onManageMembers(podcast);
                        }}
                        className="rounded-lg m-1"
                      >
                        <Users className="h-4 w-4 mr-2" />
                        Manage Members
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          onTogglePublic(podcast);
                        }}
                        className="rounded-lg m-1"
                      >
                        {podcast.is_public ? <Lock className="h-4 w-4 mr-2" /> : <Globe className="h-4 w-4 mr-2" />}
                        Make {podcast.is_public ? 'Private' : 'Public'}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="bg-slate-100 dark:bg-slate-700" />
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          onUpdateCover(podcast.id);
                        }}
                        disabled={isUpdatingCover === podcast.id}
                        className="rounded-lg m-1"
                      >
                        {isUpdatingCover === podcast.id ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <ImageIcon className="h-4 w-4 mr-2" />
                        )}
                        Update Cover
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          onGenerateAiCover(podcast);
                        }}
                        disabled={isGeneratingAiCover === podcast.id}
                        className="rounded-lg m-1"
                      >
                        {isGeneratingAiCover === podcast.id ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Sparkles className="h-4 w-4 mr-2" />
                        )}
                        Generate AI Cover
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="bg-slate-100 dark:bg-slate-700" />
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(podcast);
                        }}
                        className="text-red-600 focus:text-red-600 focus:bg-red-50 rounded-lg m-1 font-semibold"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Podcast
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      onReport(podcast);
                    }}
                    className="rounded-lg m-1"
                  >
                    <Flag className="h-4 w-4 mr-2" />
                    Report Podcast
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
});

PodcastCard.displayName = 'PodcastCard';

export const PodcastsPage: React.FC<PodcastsPageProps & { socialFeedRef?: React.RefObject<SocialFeedHandle> }> = ({
  searchQuery: externalSearchQuery = '',
  podcastId,
  onGoLive,
  onCreatePodcast,
  onNavigateToTab,
  socialFeedRef,
}) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'discover' | 'my-podcasts' | 'live'>('discover');
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
  const [showPodcastGenerator, setShowPodcastGenerator] = useState(false);
  const [isUpdatingCover, setIsUpdatingCover] = useState<string | null>(null);
  const [isGeneratingAiCover, setIsGeneratingAiCover] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Audio control ref
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: loading
  } = usePodcasts(activeTab);

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

  const handleCreatePodcast = () => {
    if (isFeatureBlocked('maxPodcasts', myPodcastCount)) {
      setShowLimitsModal(true);
    } else {
      setShowPodcastGenerator(true);
    }
  };
// In PodcastsPage.tsx, add this function
const loadFullPodcastData = async (podcastId: string) => {
  const fullData = await fetchFullPodcastData(podcastId);
  if (fullData) {
    setSelectedPodcast(fullData);
    incrementListenCount(podcastId);
    navigate(`/podcasts/${podcastId}`);
  } else {
    toast.error('Failed to load podcast details');
  }
};
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

    // Immediately set the selected podcast so the panel can show loading state
    setSelectedPodcast(podcast);
    incrementListenCount(podcast.id);
    navigate(`/podcasts/${podcast.id}`);

    // If we only have minimal data, fetch full data in background and update selection
    if (!podcast.audioSegments || podcast.audioSegments.length === 0) {
      loadFullPodcastData(podcast.id).catch(err => {
        //console.error('Error loading full podcast data:', err);
      });
    }
  }, [navigate]);

  // Handle close podcast panel with audio cleanup
  const handleClosePodcastPanel = useCallback(() => {
    // Stop audio when panel is closed
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setSelectedPodcast(null);
    navigate('/podcasts');
  }, [navigate]);

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

  const handleGenerateAiCoverForExisting = async (podcast: PodcastWithMeta) => {
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
        // Map tab IDs to podcast tabs
        const tabMap: Record<string, 'discover' | 'my-podcasts' | 'live'> = {
          'discover': 'discover',
          'my-podcasts': 'my-podcasts',
          'live': 'live'
        };
        if (tabMap[tab]) {
          setActiveTab(tabMap[tab]);
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

  const handlePlayPodcast = (podcast: PodcastWithMeta) => {
    setSelectedPodcast(podcast);
    incrementListenCount(podcast.id);
  };

  const incrementListenCount = async (podcastId: string) => {
    // Check if this podcast has already been counted in this session
    if (listenedPodcasts.has(podcastId)) {
      return;
    }

    try {
      // Check if the current user is already a listener in the podcast_listeners table
      if (!currentUser) {
        return;
      }

      if (!navigator.onLine) {
        setListenedPodcasts(prev => new Set(prev).add(podcastId));
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
        // User is already a listener in the DB, do not increment
        setListenedPodcasts(prev => new Set(prev).add(podcastId));
        return;
      }

      // Add user as a listener in podcast_listeners table
      const { error: insertError } = await supabase
        .from('podcast_listeners')
        .insert({ podcast_id: podcastId, user_id: currentUser.id });
      if (insertError) {
        return;
      }

      await supabase.rpc('increment_podcast_listen_count', { podcast_id: podcastId });
      // Mark this podcast as listened to in this session
      setListenedPodcasts(prev => new Set(prev).add(podcastId));
    } catch (error) {
      //console.error('Error incrementing listen count:', error);
    }
  };

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

  const handleSharePodcast = async (podcast: PodcastWithMeta) => {
    setSelectedPodcastForShare(podcast);
    setShowShareDialog(true);
  };

  const handleShareToSocial = async (podcast: PodcastWithMeta) => {
    try {
      if (!currentUser) {
        toast.error('Please sign in to share to social feed');
        return;
      }

      const podcastUrl = `${window.location.origin}/podcasts/${podcast.id}`;

      const { data: post, error } = await supabase
        .from('social_posts')
        .insert({
          author_id: currentUser.id,
          content:
            `ðŸŽ™ï¸ Check out my new podcast: ${podcast.title}\n\nDuration: ${podcast.duration || 0} minutes\n\n` +
            `Listen now on StuddyHub Podcasts: ${podcastUrl}`,
          privacy: 'public',
          metadata: {
            type: 'podcast',
            podcastId: podcast.id,
            title: podcast.title,
            description: podcast.description || '',
            coverUrl: podcast.cover_image_url,
            authorName: podcast.user?.full_name || 'Anonymous'
          }
        })
        .select()
        .single();

      if (error) throw error;

      // Attach the cover image as a file to the post if it exists
      if (post && podcast.cover_image_url) {
        const mimeType = podcast.cover_image_url.endsWith('.png') ? 'image/png' : 'image/jpeg';
        const { error: mediaError } = await supabase.from('social_media').insert({
          post_id: post.id,
          url: podcast.cover_image_url,
          type: 'image',
          mime_type: mimeType,
          filename: podcast.cover_image_url.split('/').pop() || 'cover.jpg',
          size_bytes: 0
        });
        if (mediaError) {
          //console.error('Media attachment error:', mediaError);
          toast.error('Podcast shared, but failed to attach cover image.');
        }
      }

      // Track share
      await supabase.from('podcast_shares').insert({
        podcast_id: podcast.id,
        user_id: currentUser.id,
        share_type: 'social_post',
        platform: 'studdyhub'
      });

      await supabase.rpc('increment_podcast_share_count', { podcast_id: podcast.id });

      toast.success('Shared to social feed!', {
        icon: 'âœ¨',
        action: {
          label: 'View',
          onClick: () => window.location.href = '/social'
        }
      });
    } catch (error) {
      //console.error('Error sharing to social feed:', error);
      toast.error('Failed to share to social feed');
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

  const filteredPodcasts = useMemo(() => {
    return podcasts.filter(podcast =>
      podcast.title?.toLowerCase().includes(deferredSearchQuery.toLowerCase()) ||
      podcast.description?.toLowerCase().includes(deferredSearchQuery.toLowerCase()) ||
      podcast.tags?.some(tag => tag.toLowerCase().includes(deferredSearchQuery.toLowerCase()))
    );
  }, [podcasts, deferredSearchQuery]);

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

  // Render podcast panel
  const renderPodcastPanel = () => {
    if (!selectedPodcast) return null;

    // Determine if this is a live podcast or AI-generated
    const isLivePodcast = selectedPodcast.is_live;
    
    // Derive audioSegments: prefer parsed `audioSegments`, then try raw `audio_segments` JSON
    let audioSegments = selectedPodcast.audioSegments || [];
    if ((!audioSegments || audioSegments.length === 0) && selectedPodcast.audio_segments) {
      try {
        audioSegments = typeof selectedPodcast.audio_segments === 'string'
          ? JSON.parse(selectedPodcast.audio_segments)
          : selectedPodcast.audio_segments || [];
      } catch (e) {
        audioSegments = [];
      }
    }

    const podcastData: PodcastData = {
      id: selectedPodcast.id,
      title: selectedPodcast.title,
      description: selectedPodcast.description || null,
      script: selectedPodcast.script || '',
      audioSegments: audioSegments,
      duration: selectedPodcast.duration || 0,
      sources: selectedPodcast.sources || [],
      style: selectedPodcast.style || '',
      created_at: selectedPodcast.created_at || new Date().toISOString(),
      podcast_type: (['audio', 'image-audio', 'video', 'live-stream'].includes(selectedPodcast.podcast_type as string)
        ? (selectedPodcast.podcast_type as 'audio' | 'image-audio' | 'video' | 'live-stream')
        : null),
      visual_assets: selectedPodcast.visualAssets || null,
      cover_image_url: selectedPodcast.cover_image_url || null,
      is_live: selectedPodcast.is_live || false,
      tags: selectedPodcast.tags || null,
      listen_count: selectedPodcast.listen_count || 0,
      share_count: selectedPodcast.share_count || 0,
      user_id: selectedPodcast.user_id,
      user: selectedPodcast.user
        ? {
            id: selectedPodcast.user_id,
            full_name: selectedPodcast.user.full_name || 'Anonymous User',
            avatar_url: selectedPodcast.user.avatar_url || '',
            username: selectedPodcast.user.username || '',
          }
        : undefined,
      is_public: selectedPodcast.is_public || false,
      // audio_url is stored inside audio_segments for recordings; not a top-level column
    };

    return (
      <PodcastPanel
        key={selectedPodcast.id}
        podcast={podcastData}
        onClose={handleClosePodcastPanel}
        isOpen={!!selectedPodcast}
        onPodcastSelect={(podcastId) => {
          // Handle related podcast selection
          const relatedPodcast = podcasts.find(p => p.id === podcastId);
          if (relatedPodcast) {
            handleSelectPodcast(relatedPodcast);
          }
        }}
        ref={(panelRef) => {
          if (panelRef && panelRef.audioRef) {
            audioRef.current = panelRef.audioRef.current;
          }
        }}
      />
    );
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-slate-50 to-blue-50/30 dark:from-slate-950 dark:to-blue-950/20">
      {/* Search Bar */}
      <div className="border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search podcasts by title, description, or tags..."
              className="pl-10 h-12 bg-white dark:bg-slate-900"
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="h-full flex flex-col">
          <ScrollArea className="flex-1">
            <div className="max-w-7xl mx-auto p-2 pb-24 sm:p-24 lg:p-20">
              {loading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 sm:gap-4 md:gap-6">
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
                </div>
              ) : (
                <>
                  {/* Render Podcast Panel if podcast is selected */}
                  {selectedPodcast && renderPodcastPanel()}
                  
                  {/* Render Podcast Cards if no podcast is selected */}
                  {!selectedPodcast && (
                    <>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 sm:gap-4 md:gap-6">
                        {filteredPodcasts.map((podcast) => (
                          <PodcastCard
                            key={podcast.id}
                            podcast={podcast}
                            isOwner={podcast.user_id === currentUser?.id}
                            onPlay={handlePlayPodcast}
                            onShare={handleSharePodcast}
                            onInvite={(p) => {
                              setSelectedPodcastForManagement(p);
                              setShowInviteDialog(true);
                            }}
                            onManageMembers={(p) => {
                              setSelectedPodcastForManagement(p);
                              setShowMembersDialog(true);
                            }}
                            onTogglePublic={handleTogglePublic}
                            onUpdateCover={(id) => {
                              setIsUpdatingCover(id);
                              fileInputRef.current?.click();
                            }}
                            onGenerateAiCover={handleGenerateAiCoverForExisting}
                            onDelete={(p) => {
                              setPodcastToDelete(p);
                              setShowDeleteDialog(true);
                            }}
                            onReport={(p) => {
                              setSelectedPodcastForReport(p);
                              setShowReportDialog(true);
                            }}
                            onJoinLive={(id, asHost) => {
                              if (asHost) {
                                setHostingPodcastId(id);
                              } else {
                                setLivePodcastId(id);
                              }
                            }}
                            onSelect={handleSelectPodcast}
                            isUpdatingCover={isUpdatingCover}
                            isGeneratingAiCover={isGeneratingAiCover}
                            fileInputRef={fileInputRef}
                            navigate={navigate}
                          />
                        ))}
                      </div>

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
        </Tabs>
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

      {/* Live Podcast Host */}
      {hostingPodcastId && (
        <LivePodcastHost
          podcastId={hostingPodcastId}
          onEndStream={() => {
            setHostingPodcastId(null);
            queryClient.invalidateQueries({ queryKey: ['podcasts'] });
          }}
        />
      )}

      {/* Live Podcast Viewer */}
      {livePodcastId && (
        <LivePodcastViewer
          podcastId={livePodcastId}
          onClose={() => setLivePodcastId(null)}
        />
      )}

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

      {/* Floating Action Button for Refresh */}
      <button
        aria-label="Refresh Podcasts"
        onClick={() => {
          queryClient.resetQueries({ queryKey: ['podcasts'] });
          queryClient.refetchQueries({ queryKey: ['podcasts'] });
          toast.info('Refreshing podcasts...');
        }}
        className="fixed bottom-32 right-2 z-50 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg p-4 flex items-center justify-center transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-400"
        style={{ boxShadow: '0 4px 24px rgba(59,130,246,0.15)' }}
        disabled={loading}
      >
        {loading ? (
          <Loader2 className="h-6 w-6 animate-spin" />
        ) : (
          <RefreshCcw className="h-6 w-6" />
        )}
      </button>

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