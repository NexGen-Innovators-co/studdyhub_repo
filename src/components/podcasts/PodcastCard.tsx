import React, { useEffect, useRef, useState, memo } from 'react';
import { motion } from 'framer-motion';
import { PodcastWithMeta } from '@/hooks/usePodcasts';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '../ui/dropdown-menu';
import {
  Clock,
  Eye,
  Flag,
  Globe,
  Headphones,
  Image as ImageIcon,
  Loader2,
  Lock,
  MoreVertical,
  Play,
  Radio,
  Share2,
  Sparkles,
  Trash2,
  UserPlus,
  Users,
  Video
} from 'lucide-react';

export interface PodcastCardProps {
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
}

const PodcastCardComponent: React.FC<PodcastCardProps> = ({
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
}) => {
  const [showActions, setShowActions] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const preventCardClickRef = useRef(false);
  const dropdownClickTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Hide overlay with delay on mouse leave
  const handleMouseLeave = () => {
    hideTimeoutRef.current = setTimeout(() => {
      setShowActions(false);
    }, 600); // 600ms delay
  };

  // Clear timeout if mouse re-enters before timeout
  const handleMouseEnter = () => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
    setShowActions(true);
  };

  const handleCardClick = (e: React.MouseEvent) => {
    if (dropdownOpen || preventCardClickRef.current) {
      e.stopPropagation();
      return;
    }
    setShowActions(!showActions);
  };

  // Helper to block card clicks after dropdown actions
  const handleDropdownItemClick = (callback: () => void) => {
    return (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      preventCardClickRef.current = true;
      
      // Close the dropdown
      setDropdownOpen(false);
      
      if (dropdownClickTimeoutRef.current) {
        clearTimeout(dropdownClickTimeoutRef.current);
      }
      
      // Extended timeout to prevent any cascading navigation
      dropdownClickTimeoutRef.current = setTimeout(() => {
        preventCardClickRef.current = false;
        dropdownClickTimeoutRef.current = null;
      }, 500);
      
      callback();
    };
  };

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
      if (dropdownClickTimeoutRef.current) {
        clearTimeout(dropdownClickTimeoutRef.current);
      }
    };
  }, []);

  // Improved: Show correct type for live podcasts
  const renderTypeBadge = () => {
    const t = podcast.podcast_type || 'audio';
    if (podcast.is_live) {
      if (t === 'video') {
        return (
          <Badge className="bg-blue-600 text-white px-2 py-0.5 text-xs flex items-center gap-1 animate-pulse"><Video className="h-3 w-3"/> Live Video</Badge>
        );
      } else if (t === 'audio') {
        return (
          <Badge className="bg-emerald-600 text-white px-2 py-0.5 text-xs flex items-center gap-1 animate-pulse"><Headphones className="h-3 w-3"/> Live Audio</Badge>
        );
      }
    }
    if (t === 'video') return (
      <Badge className="bg-blue-500 text-white px-2 py-0.5 text-xs flex items-center gap-1"><Video className="h-3 w-3"/> Video</Badge>
    );
    if (t === 'live-stream') return (
      <Badge className="bg-red-500 text-white px-2 py-0.5 text-xs flex items-center gap-1 animate-pulse"><Radio className="h-3 w-3"/> Live</Badge>
    );
    if (t === 'image-audio') return (
      <Badge className="bg-indigo-600 text-white px-2 py-0.5 text-xs flex items-center gap-1"><ImageIcon className="h-3 w-3"/> <Headphones className="h-3 w-3"/> Mix</Badge>
    );
    return (
      <Badge className="bg-emerald-500 text-white px-2 py-0.5 text-xs flex items-center gap-1"><Headphones className="h-3 w-3"/> Audio</Badge>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      layout
      className="group"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleCardClick}
    >
      <Card className="overflow-hidden hover:shadow-2xl transition-all duration-300 border-b border-slate-200 dark:border-slate-800 sm:border-b-0 sm:border sm:border-blue-200/50 sm:dark:border-blue-900/50 h-full flex flex-col relative rounded-lg sm:rounded-2xl cursor-pointer bg-white/90 dark:bg-slate-900/70 dark:hover:border-blue-700/50 dark:hover:shadow-blue-900/20">
        {/* Background Image with Overlay */}
        <div className="relative aspect-[3/4] sm:aspect-[4/5] overflow-hidden bg-slate-200 dark:bg-slate-900">
          {/* Cover Image */}
          <div className="absolute inset-0 ">
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
            <div className="absolute top-3 left-3 z-10">
              <Badge className="bg-red-600 text-white animate-pulse text-[10px] sm:text-xs border-0 shadow-lg px-2">
                <Radio className="h-2.5 w-2.5 mr-1" />
                LIVE
              </Badge>
            </div>
          )}

          {/* Type Badge (desktop: top-right) */}
          <div className="absolute top-3 right-3 z-10 hidden sm:block">
            {renderTypeBadge()}
          </div>

          {/* Small live indicator in top-right corner (for grid view) */}
          {podcast.is_live && (
            <div className="absolute top-3 right-16 z-20">
              <div className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse border border-white/30 shadow-sm" />
            </div>
          )}

          {/* Privacy Badge - Animated visibility (moved down to avoid overlapping type badge) */}
          <div className={`absolute top-12 right-3 z-10 transition-all duration-300 transform ${showActions ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
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
            </div>
          </div>

          {/* Centered Play Overlay on hover (clickable) */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <div className="sm:hidden pointer-events-none">
                {renderTypeBadge()}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (podcast.is_live) {
                    onJoinLive(podcast.id, isOwner);
                  } else {
                    onPlay(podcast);
                    onSelect(podcast);
                    navigate(`/podcast/${podcast.id}`);
                  }
                }}
                className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 transform group-hover:scale-105 bg-black/60 rounded-full p-6 md:p-8 flex items-center justify-center shadow-2xl"
              >
                {podcast.is_live ? <Radio className="h-8 w-8 text-white animate-pulse" /> : <Play className="h-8 w-8 text-white" />}
              </button>
            </div>
          </div>
        </div>

        {/* Footer stats + controls (responsive) */}
        <div className="p-3 flex flex-wrap items-center justify-between text-sm text-slate-700 dark:text-slate-200 gap-2 bg-white/80 dark:bg-slate-900/70 border-t border-slate-200/70 dark:border-slate-800/80">
          <div className="flex items-center gap-3 flex-wrap w-full sm:w-auto">
            <div className="flex items-center gap-1 text-xs text-muted-foreground"><Eye className="h-4 w-4" /> {podcast.listen_count || 0}</div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-4 w-4" /> {podcast.duration || podcast.duration_minutes || 0}m</div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground"><Users className="h-4 w-4" /> {((podcast as any).member_count ?? 0)}</div>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto sm:justify-end mt-2 sm:mt-0">
           <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (podcast.user_id) navigate(`/social/profile/${podcast.user_id}`);
                  }}
                  className="rounded-full focus:outline-none"
                  title={podcast.user?.full_name || podcast.user?.username || 'Profile'}
                >
                  <Avatar className="h-6 w-6 sm:h-7 sm:w-7 ring-2 ring-white/20">
                    <AvatarImage src={podcast.user?.avatar_url} />
                    <AvatarFallback className="text-[10px] bg-blue-500 text-white">
                      {podcast.user?.full_name?.charAt(0) || 'U'}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button
                variant="outline"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  onShare(podcast);
                }}
                className="h-8 w-8 rounded-md border-slate-200 dark:border-slate-700 dark:bg-slate-900/60 dark:hover:bg-slate-800/80"
                title="Share"
              >
                <Share2 className="h-4 w-4" />
              </Button>

              <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                    }}
                    className="h-8 w-8 rounded-md border-slate-200 dark:border-slate-700 dark:bg-slate-900/60 dark:hover:bg-slate-800/80"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent 
                  align="end" 
                  className='bg-white dark:bg-slate-900/95 rounded-xl border border-slate-100 dark:border-slate-800 shadow-2xl'
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                  }}
                >
                  {isOwner && (
                    <>
                      <DropdownMenuItem
                        onClick={handleDropdownItemClick(() => onInvite(podcast))}
                        className="rounded-lg m-1"
                      >
                        <UserPlus className="h-4 w-4 mr-2" />
                        Invite Members
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={handleDropdownItemClick(() => onManageMembers(podcast))}
                        className="rounded-lg m-1"
                      >
                        <Users className="h-4 w-4 mr-2" />
                        Manage Members
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={handleDropdownItemClick(() => onTogglePublic(podcast))}
                        className="rounded-lg m-1"
                      >
                        {podcast.is_public ? <Lock className="h-4 w-4 mr-2" /> : <Globe className="h-4 w-4 mr-2" />}
                        Make {podcast.is_public ? 'Private' : 'Public'}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="bg-slate-100 dark:bg-slate-700" />
                      <DropdownMenuItem
                        onClick={handleDropdownItemClick(() => onUpdateCover(podcast.id))}
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
                        onClick={handleDropdownItemClick(() => onGenerateAiCover(podcast))}
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
                        onClick={handleDropdownItemClick(() => onDelete(podcast))}
                        className="text-red-600 focus:text-red-600 focus:bg-red-50 rounded-lg m-1 font-semibold"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Podcast
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuItem
                    onClick={handleDropdownItemClick(() => onReport(podcast))}
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
};

export const PodcastCard = memo(PodcastCardComponent);

PodcastCard.displayName = 'PodcastCard';
