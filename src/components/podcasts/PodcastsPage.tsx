// PodcastsPage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
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
  RefreshCcw
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { PodcastPanel } from '../aiChat/Components/PodcastPanel';
import { PodcastData, PodcastGenerator } from '../aiChat/PodcastGenerator';
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

interface PodcastWithMeta extends PodcastData {
  user_id: string;
  is_public: boolean;
  is_live: boolean;
  listen_count: number;
  share_count: number;
  cover_image_url?: string;
  description?: string;
  tags?: string[];
  user?: {
    full_name: string;
    avatar_url?: string;
  };
  member_count?: number;
  active_listeners?: number;
}

interface PodcastsPageProps {
  searchQuery?: string;
  onGoLive?: () => void;
  onCreatePodcast?: () => void;
  onNavigateToTab?: (tab: string) => void;
}

import { useRef } from 'react';
import { SocialFeedHandle } from '../social/SocialFeed';

export const PodcastsPage: React.FC<PodcastsPageProps & { socialFeedRef?: React.RefObject<SocialFeedHandle> }> = ({
  searchQuery: externalSearchQuery = '',
  onGoLive,
  onCreatePodcast,
  socialFeedRef,
  onNavigateToTab
}) => {
  const [activeTab, setActiveTab] = useState<'discover' | 'my-podcasts' | 'live'>('discover');
  const [podcasts, setPodcasts] = useState<PodcastWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPodcast, setSelectedPodcast] = useState<PodcastData | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
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

  // Use external search query if provided
  useEffect(() => {
    if (externalSearchQuery !== undefined) {
      setSearchQuery(externalSearchQuery);
    }
  }, [externalSearchQuery]);

  // Wire up external handlers
  useEffect(() => {
    if (onGoLive) {
      // Store the handler to be called from Header
      (window as any).__podcastGoLive = () => setShowGoLiveDialog(true);
    }
    if (onCreatePodcast) {
      (window as any).__podcastCreate = () => setShowPodcastGenerator(true);
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
  }, [onGoLive, onCreatePodcast]);

  useEffect(() => {
    fetchCurrentUser();
    // Only fetch podcasts on first mount or when manually refreshed/tab changed
    fetchPodcasts(1, true);

    // Subscribe to real-time podcast updates (optional: can be removed for less refetching)
    const channel = supabase
      .channel('podcast-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'ai_podcasts'
        },
        (payload) => {
          console.log('Podcast updated:', payload);
          // Optionally, only update the changed podcast in state instead of refetching all
          fetchPodcasts(1, true);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const fetchCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUser(user);
  };

  const fetchPodcasts = async (fetchPage = 1, reset = false) => {
    if (reset) setLoading(true);
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
        .range((fetchPage - 1) * 20, fetchPage * 20 - 1);

      if (activeTab === 'discover') {
        query = query.eq('is_public', true);
      } else if (activeTab === 'my-podcasts') {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          query = query.eq('user_id', user.id);
        }
      } else if (activeTab === 'live') {
        query = query.eq('is_live', true).eq('is_public', true);
      }

      const { data, error } = await query;

      if (error) throw error;


      // Fetch member counts for all podcasts
      const podcastIds = (data || []).map((p: any) => p.id);
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

      const userIds = [...new Set((data || []).map((p: any) => p.user_id))];
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

      const transformedPodcasts = (data || []).map((podcast: any) => {
        // Parse audio_segments with robust error handling
        let audioSegments = [];
        if (typeof podcast.audio_segments === 'string') {
          try {
            audioSegments = podcast.audio_segments ? JSON.parse(podcast.audio_segments) : [];
          } catch (e) {
            console.error('Invalid audio_segments JSON:', podcast.audio_segments, e);
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
              console.error('Invalid visual_assets JSON:', podcast.visual_assets, e);
              visualAssets = null;
            }
          } else {
            visualAssets = podcast.visual_assets;
          }
        }

        // Calculate total duration from audio segments (in minutes)
        let totalDuration = podcast.duration_minutes;
        if (audioSegments.length > 0 && audioSegments[0].end_time) {
          // For live podcasts, calculate from last segment's end_time
          const lastSegment = audioSegments[audioSegments.length - 1];
          totalDuration = Math.ceil(lastSegment.end_time / 60); // Convert seconds to minutes
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

      if (reset) {
        setPodcasts(transformedPodcasts);
      } else {
        setPodcasts(prev => [...prev, ...transformedPodcasts]);
      }
      setHasMore((data || []).length === 20);
      setPage(fetchPage);
    } catch (error: any) {
      console.error('Error fetching podcasts:', error);
      toast.error('Failed to load podcasts');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  // Infinite scroll for podcasts
  const podcastsScrollRef = React.useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleScroll = () => {
      if (!podcastsScrollRef.current || loading || !hasMore) return;
      const { scrollTop, scrollHeight, clientHeight } = podcastsScrollRef.current;
      if (scrollTop + clientHeight >= scrollHeight - 10) {
        fetchPodcasts(page + 1);
      }
    };
    const ref = podcastsScrollRef.current;
    if (ref) {
      ref.addEventListener('scroll', handleScroll);
      return () => ref.removeEventListener('scroll', handleScroll);
    }
  }, [loading, hasMore, page]);

  const handlePlayPodcast = (podcast: PodcastWithMeta) => {
    setSelectedPodcast(podcast);
    incrementListenCount(podcast.id);
  };

  const incrementListenCount = async (podcastId: string) => {
    // Check if this podcast has already been counted in this session
    if (listenedPodcasts.has(podcastId)) {
      console.log('Listen count already incremented for this podcast in this session');
      return;
    }

    try {
      // Check if the current user is already a listener in the podcast_listeners table
      if (!currentUser) {
        console.warn('No user found, cannot check podcast_listeners');
        return;
      }
      const { data: existingListener, error: listenerError } = await supabase
        .from('podcast_listeners')
        .select('id')
        .eq('podcast_id', podcastId)
        .eq('user_id', currentUser.id)
        .maybeSingle();

      if (listenerError) {
        console.error('Error checking podcast_listeners:', listenerError);
        return;
      }

      if (existingListener) {
        // User is already a listener in the DB, do not increment
        setListenedPodcasts(prev => new Set(prev).add(podcastId));
        console.log('User already a listener in podcast_listeners table');
        return;
      }

      // Add user as a listener in podcast_listeners table
      const { error: insertError } = await supabase
        .from('podcast_listeners')
        .insert({ podcast_id: podcastId, user_id: currentUser.id });
      if (insertError) {
        console.error('Error adding user to podcast_listeners:', insertError);
        return;
      }

      await supabase.rpc('increment_podcast_listen_count', { podcast_id: podcastId });
      // Mark this podcast as listened to in this session
      setListenedPodcasts(prev => new Set(prev).add(podcastId));
    } catch (error) {
      console.error('Error incrementing listen count:', error);
    }
  };

  const handleDeletePodcast = async () => {
    if (!podcastToDelete) return;

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

      toast.success('Podcast deleted successfully');
      setShowDeleteDialog(false);
      setPodcastToDelete(null);
      fetchPodcasts(); // Refresh the list
    } catch (error: any) {
      console.error('Error deleting podcast:', error);
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

      // Create a social post with podcast reference
      // Note: Store podcast info in content for now since metadata column doesn't exist
      // Build podcast link and cover image
      const podcastUrl = `${window.location.origin}/podcasts/${podcast.id}`;

      // Create the social post (without image attached yet)
      const { data: post, error } = await supabase
        .from('social_posts')
        .insert({
          author_id: currentUser.id,
          content:
            `🎙️ Check out my new podcast: ${podcast.title}\n\nDuration: ${podcast.duration || 0} minutes\n\n` +
            `Listen now on StuddyHub Podcasts: ${podcastUrl}`,
          privacy: 'public',
          metadata: {
            type: 'podcast',
            podcast_id: podcast.id
          }
        })
        .select()
        .single();

      if (error) throw error;

      // Attach the cover image as a file to the post if it exists
      if (post && podcast.cover_image_url) {
        // Use the cover_image_url as the file URL, and guess the mime type as image/jpeg or image/png
        const mimeType = podcast.cover_image_url.endsWith('.png') ? 'image/png' : 'image/jpeg';
        // Use 0 for size_bytes if unknown (required by supabase schema)
        const { error: mediaError } = await supabase.from('social_media').insert({
          post_id: post.id,
          url: podcast.cover_image_url,
          type: 'image',
          mime_type: mimeType,
          filename: podcast.cover_image_url.split('/').pop() || 'cover.jpg',
          size_bytes: 0
        });
        if (mediaError) {
          console.error('Error attaching cover image to social_media:', mediaError);
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
        icon: '✨',
        action: {
          label: 'View',
          onClick: () => window.location.href = '/social'
        }
      });
    } catch (error) {
      console.error('Error sharing to social:', error);
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

      // Optimistically update local state
      setPodcasts(prev => prev.map(p => 
        p.id === podcast.id ? { ...p, is_public: newPublicState } : p
      ));

      toast.success(newPublicState ? 'Podcast is now public' : 'Podcast is now private');
    } catch (error) {
      console.error('Error toggling podcast visibility:', error);
      toast.error('Failed to update podcast visibility');
      // Revert optimistic update on error
      fetchPodcasts();
    }
  };

  const filteredPodcasts = podcasts.filter(podcast =>
    podcast.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    podcast.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    podcast.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const PodcastCard: React.FC<{ podcast: PodcastWithMeta; isOwner: boolean }> = ({ podcast, isOwner }) => {
    const [showActions, setShowActions] = useState(false);
    
    return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="group"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
      onClick={() => setShowActions(!showActions)}
    >
      <Card className="overflow-hidden hover:shadow-2xl transition-all duration-300 border-blue-200/50 dark:border-blue-900/50 h-full flex flex-col relative rounded-2xl cursor-pointer">
        {/* Background Image with Overlay */}
        <div className="relative aspect-[3/4] sm:aspect-[4/5] overflow-hidden">
          {/* Cover Image */}
          <div 
            className="absolute inset-0 bg-gradient-to-br from-blue-500 to-pink-500"
            style={{
              backgroundImage: podcast.cover_image_url ? `url(${podcast.cover_image_url})` : undefined,
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            }}
          >
            {!podcast.cover_image_url && (
              <div className="w-full h-full flex items-center justify-center">
                <Radio className="h-12 w-12 sm:h-16 sm:w-16 text-white opacity-30" />
              </div>
            )}
          </div>
          
          {/* Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent" />
          
          {/* Live Badge */}
          {podcast.is_live && (
            <Badge className="absolute top-2 left-2 bg-red-500 text-white animate-pulse text-xs">
              <Radio className="h-2.5 w-2.5 mr-1" />
              LIVE
            </Badge>
          )}

          {/* Privacy Badge */}
          <Badge 
            variant="secondary" 
            className="absolute top-2 right-2 bg-black/60 text-white backdrop-blur-sm text-xs border-0"
          >
            {podcast.is_public ? <Globe className="h-2.5 w-2.5 mr-1" /> : <Lock className="h-2.5 w-2.5 mr-1" />}
            <span className="hidden sm:inline">{podcast.is_public ? 'Public' : 'Private'}</span>
          </Badge>

          {/* Content Overlay - Always visible on mobile, hover on desktop */}
          <div className="absolute inset-0 flex flex-col justify-end p-3 sm:p-4">
            {/* Title & Author - Always visible */}
            <div className="space-y-1.5 sm:space-y-2 mb-2">
              <h3 className="text-white font-bold text-sm sm:text-base line-clamp-2 leading-tight">
                {podcast.title}
              </h3>
              
              <div className="flex items-center gap-1.5 sm:gap-2">
                <Avatar className="h-5 w-5 sm:h-6 sm:w-6 ring-2 ring-white/20">
                  <AvatarImage src={podcast.user?.avatar_url} />
                  <AvatarFallback className="text-xs bg-blue-500 text-white">
                    {podcast.user?.full_name?.charAt(0) || 'U'}
                  </AvatarFallback>
                </Avatar>
                <span className="text-white/90 text-xs sm:text-sm font-medium truncate">
                  {podcast.user?.full_name || 'Unknown'}
                </span>
              </div>
            </div>

            {/* Stats - Compact */}
            <div className="flex items-center gap-2 sm:gap-3 text-xs text-white/80 mb-2">
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span>{podcast.duration || 0}m</span>
              </div>
              <div className="flex items-center gap-1">
                <Eye className="h-3 w-3" />
                <span>{podcast.listen_count || 0}</span>
              </div>
              <div className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                <span>{podcast.member_count ?? 0}</span>
              </div>
            </div>

            {/* Action Buttons - Toggle visibility */}
            <div className={`transition-all duration-300 ${showActions ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'}`}>
              <div className="flex gap-1.5 sm:gap-2">
                {/* Main Play Button */}
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (podcast.is_live) {
                      setLivePodcastId(podcast.id);
                    } else {
                      handlePlayPodcast(podcast);
                    }
                  }}
                  className="flex-1 border-white/30 bg-white/10 hover:bg-white/20 text-blue-600 font-semibold text-xs sm:text-sm h-8 sm:h-9 backdrop-blur-sm"
                  size="sm"
                >
                  {podcast.is_live ? (
                    <Radio className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                  ) : (
                    <Play className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                  )}
                  <span className="hidden xs:inline">{podcast.is_live ? 'Join' : 'Listen'}</span>
                </Button>
                
                {/* Share Button */}
                <Button
                  variant="outline"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSharePodcast(podcast);
                  }}
                  className="border-white/30 bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm h-8 w-8 sm:h-9 sm:w-9"
                  title="Share"
                >
                  <Share2 className="h-3 w-3 sm:h-4 sm:w-4" />
                </Button>

                {/* More Options Menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={(e) => e.stopPropagation()}
                      className="border-white/30 bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm h-8 w-8 sm:h-9 sm:w-9"
                    >
                      <MoreVertical className="h-3 w-3 sm:h-4 sm:w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className='bg-white dark:bg-slate-800'>
                    {isOwner && (
                      <>
                        <DropdownMenuItem
                          onClick={() => {
                            setSelectedPodcastForManagement(podcast);
                            setShowInviteDialog(true);
                          }}
                        >
                          <UserPlus className="h-4 w-4 mr-2" />
                          Invite Members
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setSelectedPodcastForManagement(podcast);
                            setShowMembersDialog(true);
                          }}
                        >
                          <Users className="h-4 w-4 mr-2" />
                          Manage Members
                        </DropdownMenuItem>
                        {/* <DropdownMenuItem onClick={() => setSelectedPodcastForShare(podcast)}>
                          <Sparkles className="h-4 w-4 mr-2" />
                          Share to Feed
                        </DropdownMenuItem> */}
                        <DropdownMenuItem onClick={() => handleTogglePublic(podcast)}>
                          {podcast.is_public ? <Lock className="h-4 w-4 mr-2" /> : <Globe className="h-4 w-4 mr-2" />}
                          Make {podcast.is_public ? 'Private' : 'Public'}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => {
                            setPodcastToDelete(podcast);
                            setShowDeleteDialog(true);
                          }}
                          className="text-red-600 focus:text-red-600"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete Podcast
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                      </>
                    )}
                    <DropdownMenuItem
                      onClick={() => {
                        setSelectedPodcastForReport(podcast);
                        setShowReportDialog(true);
                      }}
                    >
                      <Flag className="h-4 w-4 mr-2" />
                      Report Podcast
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
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
          {/* <div className="border-b border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 ">
            <div className="max-w-7xl mx-auto px-6">
              <TabsList className="bg-transparent hidden sm:block">
                <TabsTrigger value="discover" className="hidden sm:inline-flex data-[state=active]:bg-blue-100 dark:data-[state=active]:bg-blue-900">
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Discover
                </TabsTrigger>
                <TabsTrigger value="my-podcasts" className="hidden sm:inline-flex data-[state=active]:bg-blue-100 dark:data-[state=active]:bg-blue-900">
                  <Sparkles className="h-4 w-4 mr-2" />
                  My Podcasts
                </TabsTrigger>
                <TabsTrigger value="live" className="hidden sm:inline-flex data-[state=active]:bg-blue-100 dark:data-[state=active]:bg-blue-900">
                  <Globe className="h-4 w-4 mr-2" />
                  Live Now
                </TabsTrigger>
              </TabsList>
            </div>
          </div> */}

          <ScrollArea className="flex-1" ref={podcastsScrollRef}>
            <div className="max-w-7xl mx-auto p-6">
              {loading ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                </div>
              ) : filteredPodcasts.length === 0 ? (
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
                      className="bg-gradient-to-r from-red-500 to-pink-500"
                    >
                      <Radio className="h-4 w-4 mr-2" />
                      Go Live
                    </Button>
                  )}
                  {!searchQuery && activeTab === 'my-podcasts' && (
                    <Button
                      onClick={() => setShowPodcastGenerator(true)}
                      className="bg-gradient-to-r from-blue-500 to-pink-500"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Create Podcast
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  {/* <div className="flex justify-end mb-4">
                    <Button size="sm" variant="outline" onClick={() => { setRefreshing(true); fetchPodcasts(1, true); }} disabled={refreshing || loading}>
                      {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Refresh'}
                    </Button>
                  </div> */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 sm:gap-4 md:gap-6">
                    {filteredPodcasts.map((podcast) => (
                      <PodcastCard
                        key={podcast.id}
                        podcast={podcast}
                        isOwner={podcast.user_id === currentUser?.id}
                      />
                    ))}
                  </div>
                  {hasMore && !loading && (
                    <div className="flex justify-center py-4">
                      <Button size="sm" variant="outline" onClick={() => fetchPodcasts(page + 1)}>
                        Load More
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          </ScrollArea>
        </Tabs>
      </div>

      {/* Podcast Player Panel */}
      {selectedPodcast && (
        <PodcastPanel
          podcast={selectedPodcast}
          onClose={() => setSelectedPodcast(null)}
          isOpen={!!selectedPodcast}
        />
      )}

      {/* Go Live Dialog */}
      <GoLiveDialog
        isOpen={showGoLiveDialog}
        onClose={() => setShowGoLiveDialog(false)}
        onLiveStart={(podcastId) => {
          setHostingPodcastId(podcastId);
          fetchPodcasts();
        }}
      />

      {/* Live Podcast Host */}
      {hostingPodcastId && (
        <LivePodcastHost
          podcastId={hostingPodcastId}
          onEndStream={() => {
            setHostingPodcastId(null);
            fetchPodcasts();
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
          onShareToFeedDraft={({ content, coverUrl }) => {
            // Use the provided onNavigateToTab prop to switch to the social tab, then open modal
            if (onNavigateToTab) {
              onNavigateToTab('social');
              setTimeout(() => {
                if (socialFeedRef?.current) {
                  socialFeedRef.current.openCreatePostDialog({ content, coverUrl });
                }
              }, 300);
            } else {
              // fallback: open modal directly if no tab switch function
              if (socialFeedRef?.current) {
                socialFeedRef.current.openCreatePostDialog({ content, coverUrl });
              }
            }
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
          onPodcastGenerated={(podcast) => {
            setShowPodcastGenerator(false);
            toast.success('Podcast generated successfully!');
            fetchPodcasts(); // Refresh the list
          }}
        />
      )}

      {/* Floating Action Button for Refresh */}
      <button
        aria-label="Refresh Podcasts"
        onClick={() => fetchPodcasts(1, true)}
        className="fixed bottom-32 right-2 z-50 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg p-4 flex items-center justify-center transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-400"
        style={{ boxShadow: '0 4px 24px rgba(59,130,246,0.15)' }}
        disabled={loading || refreshing}
      >
        {loading || refreshing ? (
          <Loader2 className="h-6 w-6 animate-spin" />
        ) : (
          <RefreshCcw className="h-6 w-6" />
        )}
      </button>
    </div>
  );
};
