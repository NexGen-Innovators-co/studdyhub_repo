import React, { useRef, useCallback, memo, useState, useEffect } from 'react';
import { useFeatureAccess } from '../../../hooks/useFeatureAccess';
import { Card, CardContent } from '../../ui/card';
import { Button } from '../../ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '../../ui/avatar';
import { Textarea } from '../../ui/textarea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../ui/dropdown-menu';
import {
  MoreHorizontal,
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  Trash2,
  Edit,
  Flag,
  ExternalLink,
  PlayCircle,
  X,
  Copy,
  Check,
  Eye,
  Volume2,
  VolumeX,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  Send,
  Lock
} from 'lucide-react';
import { toast } from 'sonner';
import { PostCardProps } from '../types/social';
import { CommentSection } from './CommentSection';
import { getTimeAgo, removeHashtagsFromContent, renderContentWithClickableLinks } from '../utils/postUtils';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../ui/dialog';
import { SocialPostWithDetails } from '@/integrations/supabase/socialTypes';
import { ReportDialog } from './ReportDialog';
import {
  FaWhatsapp,
  FaFacebook,
  FaTwitter,
  FaLinkedin,
  FaReddit,
  FaTelegram,
  FaEnvelope
} from 'react-icons/fa'; // Import react-icons for social SVGs
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Podcast } from 'lucide-react';
import { MarkdownRenderer } from '../../ui/MarkDownRendererUi';

interface PostCardWithViewTrackingProps extends PostCardProps {
  onPostView?: (postId: string) => void;
  onDeletePost?: (postId: string) => Promise<boolean>;
  onEditPost?: (postId: string, content: string) => Promise<boolean>;
  onShareToChat?: (post: SocialPostWithDetails) => void;
}

// Global state for video playback
let currentPlayingVideo: HTMLVideoElement | null = null;
let globalMuted = true;

// --- IMPROVED MEDIA DISPLAY WITH TIKTOK-STYLE VIDEO PLAYBACK ---
const MediaDisplay = memo(({ media, onOpenFullscreen }: { media: any[]; onOpenFullscreen: (index: number) => void }) => {
  const [videoStates, setVideoStates] = useState<Record<number, {
    isPlaying: boolean;
    isMuted: boolean;
    progress: number;
  }>>({});

  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRefs = useRef<Map<number, HTMLVideoElement>>(new Map());
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    // Setup intersection observer for auto-play
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const videoEl = entry.target as HTMLVideoElement;
          const index = parseInt(videoEl.dataset.index || '0');

          if (entry.isIntersecting && entry.intersectionRatio > 0.7) {
            // Auto-play when 70% visible
            handlePlay(index, videoEl);
          } else if (!entry.isIntersecting || entry.intersectionRatio < 0.3) {
            // Pause when less than 30% visible
            handlePause(index, videoEl);
          }
        });
      },
      { threshold: [0.3, 0.7] }
    );

    // Observe all videos
    videoRefs.current.forEach((video) => {
      observerRef.current?.observe(video);
    });

    return () => {
      observerRef.current?.disconnect();
      // Cleanup playing video
      if (currentPlayingVideo && containerRef.current?.contains(currentPlayingVideo)) {
        currentPlayingVideo.pause();
        currentPlayingVideo = null;
      }
    };
  }, []);

  const handlePlay = async (index: number, videoEl: HTMLVideoElement) => {
    try {
      // Pause currently playing video
      if (currentPlayingVideo && currentPlayingVideo !== videoEl) {
        currentPlayingVideo.pause();
      }

      await videoEl.play();
      currentPlayingVideo = videoEl;
      setVideoStates(prev => ({
        ...prev,
        [index]: { ...prev[index], isPlaying: true }
      }));
    } catch (err) {
      //console.log('Autoplay prevented:', err);
    }
  };

  const handlePause = (index: number, videoEl: HTMLVideoElement) => {
    videoEl.pause();
    if (currentPlayingVideo === videoEl) {
      currentPlayingVideo = null;
    }
    setVideoStates(prev => ({
      ...prev,
      [index]: { ...prev[index], isPlaying: false }
    }));
  };

  const togglePlayPause = (index: number) => {
    const video = videoRefs.current.get(index);
    if (!video) return;

    if (video.paused) {
      handlePlay(index, video);
    } else {
      handlePause(index, video);
    }
  };

  const toggleMute = (index: number) => {
    const video = videoRefs.current.get(index);
    if (!video) return;

    const newMutedState = !video.muted;
    video.muted = newMutedState;
    globalMuted = newMutedState;

    setVideoStates(prev => ({
      ...prev,
      [index]: { ...prev[index], isMuted: newMutedState }
    }));
  };

  const handleVideoProgress = (index: number, video: HTMLVideoElement) => {
    const progress = (video.currentTime / video.duration) * 100;
    setVideoStates(prev => ({
      ...prev,
      [index]: { ...prev[index], progress }
    }));
  };

  if (!media || media.length === 0) return null;

  const displayMedia = media.slice(0, 3);
  const remaining = media.length - 3;

  return (
    <div
      ref={containerRef}
      className={`grid grid-cols-2 gap-1.5 mt-3 overflow-hidden border border-slate-100 dark:border-slate-800`}
    >
      {displayMedia.map((item, index) => {
        const isVideo = item.type === 'video';
        const length = displayMedia.length;
        const isSingle = length === 1;
        const isMulti = length >= 3;
        const state = videoStates[index] || { isPlaying: false, isMuted: globalMuted, progress: 0 };

        let itemClass = `relative bg-slate-100 dark:bg-slate-900 group overflow-hidden`;
        if (isSingle) {
          itemClass += ' col-span-2 max-h-[600px]';
        } else if (isMulti && index === 0) {
          itemClass += ' row-span-2';
        } else {
          itemClass += ' aspect-square';
        }

        const showRemaining = remaining > 0 && index === displayMedia.length - 1;

        return (
          <div
            key={index}
            className={itemClass}
            onClick={() => {
              if (showRemaining) {
                onOpenFullscreen(3);
              } else if (!isVideo) {
                onOpenFullscreen(index);
              }
            }}
          >
            {isVideo ? (
              <div className="relative w-full h-full">
                <video
                  ref={(el) => {
                    if (el) videoRefs.current.set(index, el);
                  }}
                  data-index={index}
                  src={item.url}
                  className="w-full h-full object-contain "
                  playsInline
                  loop
                  muted={globalMuted}
                  preload="metadata"
                  onClick={(e) => {
                    e.stopPropagation();
                    togglePlayPause(index);
                  }}
                  onTimeUpdate={(e) => handleVideoProgress(index, e.currentTarget)}
                  onEnded={(e) => {
                    const v = e.currentTarget;
                    v.currentTime = 0;
                    v.play();
                  }}
                />

                {/* Video Controls Overlay */}
                <div className="absolute inset-0 pointer-events-none">
                  {/* Play/Pause Overlay */}
                  {!state.isPlaying && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                      <div className="pointer-events-auto cursor-pointer bg-white/90 rounded-full p-4 hover:bg-white transition-colors">
                        <Play className="h-8 w-8 text-slate-900" />
                      </div>
                    </div>
                  )}

                  {/* Bottom Controls */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3">
                    {/* Progress Bar */}
                    <div className="w-full h-0.5 bg-white/30 rounded-full mb-2">
                      <div
                        className="h-full bg-white rounded-full transition-all duration-100"
                        style={{ width: `${state.progress}%` }}
                      />
                    </div>

                    {/* Mute Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleMute(index);
                      }}
                      className="pointer-events-auto bg-black/50 hover:bg-black/70 rounded-full p-2 transition-colors"
                    >
                      {state.isMuted ? (
                        <VolumeX className="h-4 w-4 text-white" />
                      ) : (
                        <Volume2 className="h-4 w-4 text-white" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <img
                src={item.url}
                alt="Post content"
                className="w-full h-full object-contain  cursor-pointer"
                loading="lazy"
              />
            )}

            {showRemaining && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white font-bold text-xl backdrop-blur-[2px]">
                +{remaining}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
});
MediaDisplay.displayName = 'MediaDisplay';

// Action Button
const ActionButton = ({ icon: Icon, label, count, active, activeColor, onClick, isLoading, isLikeButton }: any) => {
  const [animate, setAnimate] = React.useState(false);
  const { canPostSocials } = useFeatureAccess();
  const canInteract = canPostSocials();

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isLoading || !canInteract) {
      if (!canInteract) {
        toast.error('Social actions are available for Scholar and Genius plans', {
          action: {
            label: 'Upgrade',
            onClick: () => window.location.assign('/subscription'),
          },
          duration: 5000,
        });
      }
      return;
    }
    if (isLikeButton && !active) {
      setAnimate(true);
      setTimeout(() => setAnimate(false), 600);
    }
    onClick();
  };

  return (
    <button
      onClick={handleClick}
      disabled={isLoading || !canInteract}
      title={!canInteract ? 'Upgrade to use this action' : label}
      className={`flex items-center space-x-1.5 group transition-all duration-200 ripple-effect ${active ? activeColor : 'text-slate-500 dark:text-slate-400 hover:text-blue-500'} ${isLoading || !canInteract ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <div className={`p-2 rounded-full transition-all duration-200 ${active ? 'bg-opacity-10' : 'group-hover:bg-blue-50 dark:group-hover:bg-blue-900/20'} ${active ? activeColor.replace('text-', 'bg-') : ''}`}>
        {isLoading ? (
          <div className="animate-spin h-5 w-5 border-2 border-current border-t-transparent rounded-full" />
        ) : !canInteract ? (
          <Lock className="h-5 w-5" />
        ) : (
          <Icon className={`h-5 w-5 ${active ? 'fill-current' : ''} ${animate ? 'heart-beat' : ''} transition-transform`} />
        )}
      </div>
      <span className={`text-sm font-medium ${active ? '' : 'group-hover:text-blue-500'}`}>
        {count > 0 ? count : label}
      </span>
    </button>
  );
};

// --- MAIN POSTCARD COMPONENT ---
export const PostCard: React.FC<PostCardWithViewTrackingProps> = (
  (props) => {
    const { canPostSocials, isFree } = useFeatureAccess();
    const canInteract = canPostSocials();
    const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
    const {
      post,
      onLike,
      onBookmark,
      onShare,
      onComment,
      isExpanded,
      comments,
      isLoadingComments,
      newComment,
      onCommentChange,
      onSubmitComment,
      isAddingComment,
      currentUser,
      onClick,
      onDeletePost,
      onEditPost,
      onPostView,
      onShareToChat,
    } = props;

    const [isContentExpanded, setIsContentExpanded] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editContent, setEditContent] = useState(post.content || '');
    const [fullscreenIndex, setFullscreenIndex] = useState<number | null>(null);
    const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
    const [isLiking, setIsLiking] = useState(false);
    const [isBookmarking, setIsBookmarking] = useState(false);
    const [isSharing, setIsSharing] = useState(false);
    const [isSubmittingComment, setIsSubmittingComment] = useState(false);
    const isOwnPost = currentUser?.id === post.author_id;
    // Don't use removeHashtagsFromContent as it collapses newlines which breaks markdown
    const cleanedContent = (post.content || '').replace(/#\w+/g, '');
    const isLongContent = cleanedContent.length > 280;


    const handleLike = async () => {
      if (!canInteract) return setShowUpgradePrompt(true);
      if (isLiking) return;
      setIsLiking(true);
      try {
        await Promise.resolve(onLike(post.id, post.is_liked || false));
      } finally {
        setTimeout(() => setIsLiking(false), 300);
      }
    };
    const handleBookmark = async () => {
      if (!canInteract) return setShowUpgradePrompt(true);
      if (isBookmarking) return;
      setIsBookmarking(true);
      try {
        await onBookmark(post.id, post.is_bookmarked || false);
      } finally {
        setTimeout(() => setIsBookmarking(false), 300);
      }
    };
    const handleCopyLink = () => {
      navigator.clipboard.writeText(`${window.location.origin}/social/post/${post.id}`);
      toast.success("Link copied!");
    };

    // Share modal state
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);

    // Share helpers
    const shareUrl = `${window.location.origin}/social/post/${post.id}`;
    const shareText = (post.content || '').slice(0, 300);
    const navigate = useNavigate();
    const shareNative = async () => {
      setIsShareModalOpen(false);
      if ((navigator as any).share) {
        try {
          await (navigator as any).share({ title: post.author?.display_name || 'Post', text: shareText, url: shareUrl });
          toast.success('Shared');
          await onShare?.(post);
          return;
        } catch (err: any) {
          const name = err?.name;
          if (name === 'AbortError' || name === 'NotAllowedError') {
            toast.info('Share cancelled');
            return;
          }
          //console.warn('Native share error', err);
        }
      }
      toast.error('Native share not available');
    };
    const ShareDialog = memo(({ post, onClose }: { post: SocialPostWithDetails; onClose: () => void }) => {
      const [copied, setCopied] = useState(false);
      const shareUrl = `${window.location.origin}/social/post/${post.id}`;
      const shareText = post.content.substring(0, 100) + '...';

      const handleCopyLink = () => {
        navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        toast.success('Link copied to clipboard!');
        onShare?.(post);

      };

      const platforms = [
        {
          name: 'WhatsApp',
          icon: <FaWhatsapp className="h-5 w-5 text-green-600" />,
          url: (() => {
            try {
              return `https://wa.me/?text=${encodeURIComponent(shareUrl)}`;
            } catch (e) {
              console.error('encodeURIComponent error (WhatsApp):', shareUrl, e);
              return 'https://wa.me/?text=';
            }
          })()
        },
        {
          name: 'Facebook',
          icon: <FaFacebook className="h-5 w-5 text-blue-600" />,
          url: (() => {
            try {
              return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
            } catch (e) {
              console.error('encodeURIComponent error (Facebook):', shareUrl, e);
              return 'https://www.facebook.com/sharer/sharer.php?u=';
            }
          })()
        },
        {
          name: 'Twitter',
          icon: <FaTwitter className="h-5 w-5 text-blue-400" />,
          url: (() => {
            try {
              return `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`;
            } catch (e) {
              console.error('encodeURIComponent error (Twitter):', shareUrl, shareText, e);
              return 'https://twitter.com/intent/tweet?url=&text=';
            }
          })()
        },
        {
          name: 'LinkedIn',
          icon: <FaLinkedin className="h-5 w-5 text-blue-700" />,
          url: (() => {
            try {
              return `https://www.linkedin.com/shareArticle?mini=true&url=${encodeURIComponent(shareUrl)}`;
            } catch (e) {
              console.error('encodeURIComponent error (LinkedIn):', shareUrl, e);
              return 'https://www.linkedin.com/shareArticle?mini=true&url=';
            }
          })()
        },
        {
          name: 'Reddit',
          icon: <FaReddit className="h-5 w-5 text-orange-600" />,
          url: (() => {
            try {
              return `https://reddit.com/submit?url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(shareText)}`;
            } catch (e) {
              console.error('encodeURIComponent error (Reddit):', shareUrl, shareText, e);
              return 'https://reddit.com/submit?url=&title=';
            }
          })()
        },
        {
          name: 'Telegram',
          icon: <FaTelegram className="h-5 w-5 text-blue-500" />,
          url: (() => {
            try {
              return `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`;
            } catch (e) {
              console.error('encodeURIComponent error (Telegram):', shareUrl, shareText, e);
              return 'https://t.me/share/url?url=&text=';
            }
          })()
        },
        {
          name: 'Email',
          icon: <FaEnvelope className="h-5 w-5 text-gray-600" />,
          url: (() => {
            try {
              return `mailto:?subject=${encodeURIComponent(shareText)}&body=${encodeURIComponent(shareUrl)}`;
            } catch (e) {
              console.error('encodeURIComponent error (Email):', shareText, shareUrl, e);
              return 'mailto:?subject=&body=';
            }
          })()
        },

      ];

      return (
        <Dialog open={isShareModalOpen} onOpenChange={onClose}>
          <DialogContent>
            <DialogTitle className="text-lg font-semibold mb-4">Share this post</DialogTitle>
            <DialogDescription className="mb-6 text-sm text-slate-500">
              Choose a platform to share this post:
            </DialogDescription>
            <div className="space-y-3">
              {platforms.map((platform) => (
                <Button
                  key={platform.name}
                  variant="outline"
                  className="w-full flex items-center justify-start gap-3 py-6"
                  onClick={() => { window.open(platform.url, '_blank', 'noopener,noreferrer'); onShare(post); }}
                >
                  {platform.icon}
                  <span>{platform.name}</span>
                </Button>
              ))}

              <Button
                onClick={() => {
                  setIsShareModalOpen(false);

                  onShareToChat?.(post);
                }}
                variant="outline"
                className="w-full flex items-center justify-start gap-3 py-6"

              >
                <MessageCircle className="h-5 w-5" /> <span >Share to Chat</span>
              </Button>

              <Button
                variant="outline"
                className="w-full flex items-center justify-start gap-3 py-6"
                onClick={handleCopyLink}
              >
                {copied ? <Check className="h-5 w-5 text-green-600" /> : <Copy className="h-5 w-5" />}
                <span>{copied ? 'Copied!' : 'Copy Link'}</span>
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      );
    });

    const handleShare = (e?: React.MouseEvent) => {
      if (!canInteract) {
        setShowUpgradePrompt(true);
        return;
      }
      e?.stopPropagation();
      setIsShareModalOpen(true);
    };

    const handleSaveEdit = async () => {
      if (onEditPost && editContent.trim()) {
        await onEditPost(post.id, editContent);
        setIsEditing(false);
      }
    }

    const handlePrev = () => {
      setFullscreenIndex((prev) => {
        if (prev === null || post.media.length <= 1) return prev;
        return prev === 0 ? post.media.length - 1 : prev - 1;
      });
    };

    const handleNext = () => {
      setFullscreenIndex((prev) => {
        if (prev === null || post.media.length <= 1) return prev;
        return prev === post.media.length - 1 ? 0 : prev + 1;
      });
    };

    // Upgrade prompt dialog
    const UpgradePrompt = () => (
      <Dialog open={showUpgradePrompt} onOpenChange={setShowUpgradePrompt}>
        <DialogContent className="max-w-xs rounded-xl">
          <DialogHeader>
            <DialogTitle>Upgrade Required</DialogTitle>
            <DialogDescription>
              Social posting and interactions are available for Scholar and Genius plans.
            </DialogDescription>
          </DialogHeader>
          <Button className="w-full bg-blue-600 text-white mt-4" onClick={() => { setShowUpgradePrompt(false); window.location.href = '/subscription'; }}>
            Upgrade Now
          </Button>
        </DialogContent>
      </Dialog>
    );

    const cardRef = React.useRef<HTMLDivElement | null>(null);
    const [hasTrackedView, setHasTrackedView] = useState(false);


    // observe visibility and report view once per mounted Card
    useEffect(() => {
      if (!cardRef.current || !onPostView) return;
      const el = cardRef.current;
      const obs = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting && !hasTrackedView) {
            try {
              onPostView(post.id);
              ////console.log(`👁️ Post ${post.id} viewed`);
            } catch (e) {
              // ignore
            }
            setHasTrackedView(true);

          }
        },
        { threshold: 0.6 }
      );
      obs.observe(el);
      return () => obs.disconnect();
    }, [post.id, onPostView, hasTrackedView]);

    const currentMedia = fullscreenIndex !== null ? post.media[fullscreenIndex] : null;
    const isFullscreenVideo = currentMedia?.type === 'video';

    const isPodcast = post.metadata?.type === 'podcast';
    const podcastMetadata = post.metadata;

    const PodcastPreview = () => {
      if (!isPodcast) return null;

      const podcastId = podcastMetadata.podcastId || podcastMetadata.podcast_id;
      const title = podcastMetadata.title || 'Podcast';
      const description = podcastMetadata.description || 'AI-generated podcast conversation';
      const coverUrl = podcastMetadata.coverUrl || podcastMetadata.cover_image_url;

      return (
        <div 
          className="mt-3 mx-4 p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex items-center gap-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors group"
          onClick={(e) => {
            e.stopPropagation();
            if (podcastId) {
              navigate(`/podcasts/${podcastId}`);
            }
          }}
        >
          <div className="relative h-16 w-16 flex-shrink-0 rounded-lg overflow-hidden bg-slate-200 dark:bg-slate-700">
            {coverUrl ? (
              <img 
                src={coverUrl} 
                alt={title} 
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="h-full w-full flex items-center justify-center text-slate-400">
                <Podcast className="h-8 w-8" />
              </div>
            )}
            <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 flex items-center justify-center transition-colors">
              <Play className="h-6 w-6 text-white fill-white" />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-bold text-slate-900 dark:text-slate-100 truncate">
              {title}
            </h4>
            <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-1">
              {description}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                Podcast
              </span>
              {podcastMetadata.duration_minutes && (
                <span className="text-xs text-slate-400">
                  {podcastMetadata.duration_minutes} min
                </span>
              )}
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20"
          >
            Listen
          </Button>
        </div>
      );
    };

    return (
      <>     
       <Card
        className="border border-slate-100 dark:border-slate-800 animate-in slide-in-from-top-2 fade-in duration-500 bg-white dark:bg-slate-900 overflow-hidden max-w-[780px] mx-auto"
        ref={cardRef}
        onClick={(e) => {
          const target = e.target as HTMLElement;
          if (!target.closest('button, a, input, textarea, video, [role="menuitem"],span') && onClick) {
            onClick(post.id);
          }
        }}
      >
        <CardContent className="p-0">
          <div className="flex gap-3">
            <div className="flex-1 min-w-0 ">
              <div className="p-4 pt-5 flex">
                <div
                  className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/social/profile/${post.author_id}`);
                  }}
                >
                  {/* Avatar Column */}
                  <div className="flex-shrink-0 ">
                    <Avatar className="h-10 w-10 ring-2 ring-white dark:ring-slate-900 shadow-sm cursor-pointer hover:opacity-90">
                      <AvatarImage src={post.author?.avatar_url} />
                      <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
                        {post.author?.display_name?.[0]}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                </div>
                {/* Header */}
                <div className="flex items-start justify-between mb-2 px-3 flex-1">
                  <div className="flex flex-col">
                    <div className="flex items-center" onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/social/profile/${post.author_id}`);
                    }}>
                      <span className="font-bold text-slate-900 dark:text-slate-100 text-base hover:underline cursor-pointer">
                        {post.author?.display_name}
                      </span>
                      {(post.author as any)?.is_verified && <Check className="h-3.5 w-3.5 text-blue-500 ml-1" />}
                    </div>
                    <div className="flex items-center text-slate-500 text-sm gap-1.5">
                      <span>{post.author?.bio} </span>
                    </div>
                    <div className="flex items-center text-slate-500 text-sm gap-1.5">
                      <span>{(post.author as any)?.followers_count || 0} followers</span>
                      <span className="text-slate-300 dark:text-slate-700">•</span>
                      <span className="hover:underline cursor-pointer">{getTimeAgo(post.created_at)}</span>
                    </div>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 -mt-1 -mr-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48 rounded-xl shadow-lg border-slate-100 dark:border-slate-800">
                    <DropdownMenuItem onClick={handleCopyLink}><Copy className="mr-2 h-4 w-4" /> Copy Link</DropdownMenuItem>
                    {isOwnPost && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setIsEditing(true)}><Edit className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onDeletePost?.(post.id)} className="text-red-600"><Trash2 className="mr-2 h-4 w-4" /> Delete</DropdownMenuItem>
                      </>
                    )}
                    {!isOwnPost && (
                      <DropdownMenuItem onClick={() => setIsReportDialogOpen(true)}><Flag className="mr-2 h-4 w-4" /> Report</DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Post Body */}
              {isEditing ? (
                <div className="mb-3 space-y-2 px-4" onClick={e => e.stopPropagation()}>
                  <Textarea
                    value={editContent}
                    onChange={e => setEditContent(e.target.value)}
                    className="min-h-[100px]"
                  />
                  <div className="flex gap-2 justify-end">
                    <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}>Cancel</Button>
                    <Button size="sm" onClick={handleSaveEdit}>Save</Button>
                  </div>
                </div>
              ) : (
                <div className="px-4 text-[15px] leading-relaxed text-slate-800 dark:text-slate-200">
                    <div className={`relative ${!isContentExpanded && isLongContent ? 'max-h-[300px] overflow-hidden' : ''}`}>
                         <MarkdownRenderer content={cleanedContent} className="prose dark:prose-invert max-w-none text-slate-800 dark:text-slate-200" />
                         {!isContentExpanded && isLongContent && (
                            <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-white dark:from-slate-900 to-transparent flex items-end justify-center pb-2">
                                <Button
                                    variant="ghost" 
                                    size="sm"
                                    onClick={(e) => { e.stopPropagation(); setIsContentExpanded(true); }}
                                    className="bg-white/80 dark:bg-slate-900/80 hover:bg-white dark:hover:bg-slate-900 text-blue-600 dark:text-blue-400 font-medium shadow-sm border border-slate-100 dark:border-slate-800 backdrop-blur-sm"
                                >
                                    Show more
                                </Button>
                            </div>
                         )}
                    </div>
                     {isContentExpanded && isLongContent && (
                        <button
                            onClick={(e) => { e.stopPropagation(); setIsContentExpanded(false); }}
                            className="mt-2 text-blue-600 dark:text-blue-400 text-sm font-medium hover:underline flex items-center gap-1"
                        >
                            Show less
                        </button>
                    )}
                </div>
              )}

              {/* Podcast Preview */}
              {isPodcast && <PodcastPreview />}

              {/* Hashtags */}
              {post.hashtags && post.hashtags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2 px-4">
                  {post.hashtags.map((tag: any, i: number) => (
                    <span key={i} className="text-blue-600 dark:text-blue-400 text-sm hover:underline cursor-pointer">#{tag.name}</span>
                  ))}
                </div>
              )}

              {/* Media */}
              <div onClick={e => e.stopPropagation()}>
                <MediaDisplay media={post.media} onOpenFullscreen={setFullscreenIndex} />
              </div>

              {/* Footer Actions */}
              <div className="flex items-center border-t border-slate-200 dark:border-slate-800 mt-2 justify-between pt-2 p-4 -ml-2">
                <ActionButton
                  icon={Heart}
                  count={post.likes_count}
                  active={post.is_liked}
                  activeColor="text-pink-600"
                  onClick={canInteract ? handleLike : () => setShowUpgradePrompt(true)}
                  isLoading={isLiking}
                  isLikeButton={true}
                  disabled={!canInteract}
                />

                <ActionButton
                  icon={MessageCircle}
                  count={post.comments_count}
                  onClick={canInteract ? onComment : () => setShowUpgradePrompt(true)}
                  disabled={!canInteract}
                />

                <ActionButton
                  icon={Share2}
                  label="Share"
                  count={post.shares_count}
                  onClick={canInteract ? handleShare : () => setShowUpgradePrompt(true)}
                  isLoading={isSharing}
                  disabled={!canInteract}
                />

                <ActionButton
                  icon={Bookmark}
                  label=""
                  active={post.is_bookmarked}
                  activeColor="text-blue-600"
                  onClick={canInteract ? handleBookmark : () => setShowUpgradePrompt(true)}
                  isLoading={isBookmarking}
                  disabled={!canInteract}
                />

                {/* Views indicator */}
                <div className="ml-3 flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400">
                  <Eye className="h-4 w-4" />
                  <span className="font-medium text-xs">{post.views_count}</span>
                </div>
              </div>

              {/* Share Modal */}
              {isShareModalOpen && (
                <ShareDialog post={post} onClose={() => setIsShareModalOpen(false)} />
              )}
            </div>
          </div>

          {/* Comments */}
          {isExpanded && (
            <div className="mt-4 p-4 border-t border-slate-100 dark:border-slate-800 animate-in slide-in-from-top-2 fade-in duration-200">
              <CommentSection
                postId={post.id}
                comments={comments}
                isLoading={isLoadingComments}
                newComment={newComment}
                onCommentChange={onCommentChange}
                onSubmitComment={onSubmitComment}
                currentUser={currentUser}
                isAddingComment={isAddingComment}
              />
            </div>
          )}
        </CardContent>

        {/* Fullscreen Media Viewer */}
        <Dialog open={fullscreenIndex !== null} onOpenChange={() => setFullscreenIndex(null)}>
          <DialogContent className="w-[90vw] h-[90vh] max-w-[1200px] max-h-[800px] rounded-2xl p-0 bg-white dark:bg-slate-900 border-none">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-lg overflow-hidden flex flex-col lg:grid lg:grid-cols-5 lg:gap-0 h-full">
              {/* Media Section */}
              <div className="relative bg-black flex items-center  justify-center lg:col-span-3 overflow-hidden flex-1 h-full">
                <DialogHeader>
                  <DialogTitle> </DialogTitle>
                  <DialogDescription>  </DialogDescription>
                </DialogHeader>
                {currentMedia && (
                  <>
                    {isFullscreenVideo ? (
                      <video
                        src={currentMedia.url}
                        className="max-w-full max-h-full object-contain"
                        controls
                        autoPlay
                        loop
                      />
                    ) : (
                      <img
                        src={currentMedia.url}
                        alt="Fullscreen media"
                        className="w-full h-full object-contain"
                      />
                    )}
                  </>
                )}

                {post.media.length > 1 && (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-1/2 left-4 transform -translate-y-1/2 text-white bg-black/50 hover:bg-black/70 rounded-full"
                      onClick={handlePrev}
                    >
                      <ChevronLeft className="h-6 w-6" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-1/2 right-4 transform -translate-y-1/2 text-white bg-black/50 hover:bg-black/70 rounded-full"
                      onClick={handleNext}
                    >
                      <ChevronRight className="h-6 w-6" />
                    </Button>
                  </>
                )}
              </div>

              {/* Content Section */}
              <div className="p-4 lg:col-span-2 lg:overflow-y-auto flex flex-col border border-slate-200 dark:border-slate-800">
                {/* Header */}
                <div className="flex items-center gap-3 mb-4">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={post.author?.avatar_url} />
                    <AvatarFallback>{post.author?.display_name?.[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1">
                      <span className="font-bold text-slate-900 dark:text-slate-100">{post.author?.display_name}</span>
                      {(post.author as any)?.is_verified && <Check className="h-3.5 w-3.5 text-blue-500" />}
                    </div>
                    <div className="text-sm text-slate-500">
                      {(post.author as any)?.followers_count || 0} followers · {getTimeAgo(post.created_at)}
                    </div>
                  </div>
                </div>

                {/* Post Content */}
                <div className="text-[15px] leading-relaxed text-slate-800 dark:text-slate-200 mb-4">
                  {renderContentWithClickableLinks(cleanedContent)}
                </div>

                {/* Podcast Preview in Fullscreen */}
                {isPodcast && <PodcastPreview />}

                {/* Hashtags */}
                {post.hashtags && post.hashtags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {post.hashtags.map((tag: any, i: number) => (
                      <span key={i} className="text-blue-600 dark:text-blue-400 text-sm hover:underline cursor-pointer">#{tag.name}</span>
                    ))}
                  </div>
                )}

                {/* Reposts */}
                {post.shares_count > 0 && (
                  <div className="text-sm text-slate-500 mb-4">
                    {post.shares_count} repost{post.shares_count > 1 ? 's' : ''}
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center justify-between mb-4">
                  <ActionButton
                    icon={Heart}
                    label="Like"
                    active={post.is_liked}
                    activeColor="text-pink-600"
                    onClick={handleLike}
                    isLoading={isLiking}
                    isLikeButton={true}
                  />

                  <ActionButton
                    icon={MessageCircle}
                    label="Comment"
                    onClick={onComment}
                  />

                  <ActionButton
                    icon={Share2}
                    label="Share"
                    onClick={handleShare}
                    isLoading={isSharing}
                  />

                  <ActionButton
                    icon={Bookmark}
                    label="Bookmark"
                    active={post.is_bookmarked}
                    activeColor="text-blue-600"
                    onClick={handleBookmark}
                    isLoading={isBookmarking}
                  />
                </div>

                {/* Comment Input */}
                <div className="flex items-center gap-2 mt-auto">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={currentUser?.avatar_url} />
                    <AvatarFallback>{currentUser?.display_name?.[0]}</AvatarFallback>
                  </Avatar>
                  <Textarea
                    placeholder={canInteract ? "Add a comment..." : "Upgrade to comment"}
                    value={newComment}
                    onChange={(e) => canInteract ? onCommentChange(e.target.value) : setShowUpgradePrompt(true)}
                    className="flex-1 min-h-[40px] resize-none"
                    disabled={isSubmittingComment || !canInteract}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={async () => {
                      if (!canInteract) return setShowUpgradePrompt(true);
                      if (isSubmittingComment || !newComment.trim()) return;
                      setIsSubmittingComment(true);
                      try {
                        await onSubmitComment();
                      } finally {
                        setTimeout(() => setIsSubmittingComment(false), 300);
                      }
                    }}
                    disabled={isSubmittingComment || !newComment.trim() || !canInteract}
                    className={`text-blue-600 transition-all ${isSubmittingComment ? 'pulse-scale' : ''}`}
                  >
                    {isSubmittingComment ? (
                      <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full" />
                    ) : (
                      <Send className="h-5 w-5" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Report Dialog */}
        <ReportDialog
          isOpen={isReportDialogOpen}
          onClose={() => setIsReportDialogOpen(false)}
          postId={post.id}
          reportedUserId={post.author_id}
          reportType="post"
        />

      </Card>
      <UpgradePrompt />
      </>

    );
  }
);
PostCard.displayName = 'PostCard';