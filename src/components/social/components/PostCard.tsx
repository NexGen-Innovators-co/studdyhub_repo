import React, { useRef, useCallback, memo, useState, useEffect } from 'react';
import { Card, CardContent } from '../../ui/card';
import { Button } from '../../ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '../../ui/avatar';
import { Textarea } from '../../ui/textarea';
import { Badge } from '../../ui/badge';
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
  Pause
} from 'lucide-react';
import { toast } from 'sonner';
import { PostCardProps } from '../types/social';
import { CommentSection } from './CommentSection';
import { getTimeAgo } from '../utils/postUtils';
import { Dialog, DialogContent } from '../../ui/dialog';

interface PostCardWithViewTrackingProps extends PostCardProps {
  onPostView?: (postId: string) => void;
  onDeletePost?: (postId: string) => Promise<boolean>;
  onEditPost?: (postId: string, content: string) => Promise<boolean>;
}

// Global state for video playback
let currentPlayingVideo: HTMLVideoElement | null = null;
let globalMuted = true;

// --- IMPROVED MEDIA DISPLAY WITH TIKTOK-STYLE VIDEO PLAYBACK ---
const MediaDisplay = memo(({ media }: { media: any[] }) => {
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
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
      console.log('Autoplay prevented:', err);
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

  const displayMedia = media.slice(0, 4);
  const remaining = media.length - 4;

  const gridConfig = {
    1: 'grid-cols-1',
    2: 'grid-cols-2',
    3: 'grid-cols-2',
    4: 'grid-cols-2',
  }[displayMedia.length] || 'grid-cols-2';

  return (
    <>
      <div
        ref={containerRef}
        className={`grid ${gridConfig} gap-1.5 mt-3 rounded-xl overflow-hidden border border-slate-100 dark:border-slate-800`}
      >
        {displayMedia.map((item, index) => {
          const isVideo = item.type === 'video';
          const isThirdOfThree = displayMedia.length === 3 && index === 2;
          const state = videoStates[index] || { isPlaying: false, isMuted: globalMuted, progress: 0 };

          return (
            <div
              key={index}
              className={`relative bg-slate-100 dark:bg-slate-900 group overflow-hidden
                ${isThirdOfThree ? 'col-span-2' : ''} 
                ${displayMedia.length === 1 ? 'max-h-[600px]' : 'aspect-square'}
              `}
              onClick={() => !isVideo && setFullscreenImage(item.url)}
            >
              {isVideo ? (
                <div className="relative w-full h-full">
                  <video
                    ref={(el) => {
                      if (el) videoRefs.current.set(index, el);
                    }}
                    data-index={index}
                    src={item.url}
                    className="w-full h-full object-cover"
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
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 cursor-pointer"
                  loading="lazy"
                />
              )}

              {index === 3 && remaining > 0 && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white font-bold text-xl backdrop-blur-[2px]">
                  +{remaining}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Lightbox */}
      {fullscreenImage && (
        <Dialog open={!!fullscreenImage} onOpenChange={() => setFullscreenImage(null)}>
          <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 bg-black/95 border-none">
            <div className="relative w-full h-full flex items-center justify-center p-4">
              <img
                src={fullscreenImage}
                alt="Fullscreen"
                className="max-w-full max-h-[90vh] object-contain"
              />
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-4 right-4 text-white bg-black/50 hover:bg-black/70 rounded-full"
                onClick={() => setFullscreenImage(null)}
              >
                <X className="h-6 w-6" />
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
});
MediaDisplay.displayName = 'MediaDisplay';

// Action Button
const ActionButton = ({ icon: Icon, label, count, active, activeColor, onClick }: any) => (
  <button
    onClick={(e) => { e.stopPropagation(); onClick(); }}
    className={`flex items-center space-x-1.5 group transition-colors duration-200 ${active ? activeColor : 'text-slate-500 dark:text-slate-400 hover:text-blue-500'
      }`}
  >
    <div className={`p-2 rounded-full transition-colors ${active ? 'bg-opacity-10' : 'group-hover:bg-blue-50 dark:group-hover:bg-blue-900/20'
      } ${active ? activeColor.replace('text-', 'bg-') : ''}`}>
      <Icon className={`h-5 w-5 ${active ? 'fill-current' : ''}`} />
    </div>
    <span className={`text-sm font-medium ${active ? '' : 'group-hover:text-blue-500'}`}>
      {count > 0 ? count : label}
    </span>
  </button>
);

// --- MAIN POSTCARD COMPONENT ---
export const PostCard: React.FC<PostCardWithViewTrackingProps> = memo(
  (props) => {
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
      currentUser,
      onClick,
      onDeletePost,
      onEditPost,
      onPostView,
    } = props;

    const [isContentExpanded, setIsContentExpanded] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editContent, setEditContent] = useState(post.content || '');
    const isOwnPost = currentUser?.id === post.author_id;
    const isLongContent = post.content && post.content.length > 280;

    const handleLike = () => onLike(post.id, post.is_liked || false);
    const handleBookmark = () => onBookmark(post.id, post.is_bookmarked || false);
    const handleCopyLink = () => {
      navigator.clipboard.writeText(`${window.location.origin}/social/post/${post.id}`);
      toast.success("Link copied!");
    };

    // Share modal state
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);

    // Share helpers
    const shareUrl = `${window.location.origin}/social/post/${post.id}`;
    const shareText = (post.content || '').slice(0, 300);

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
          console.warn('Native share error', err);
        }
      }
      toast.error('Native share not available');
    };

    const shareWhatsApp = async () => {
      setIsShareModalOpen(false);
      const encoded = encodeURIComponent(`${shareText}\n\n${shareUrl}`);
      const ua = navigator.userAgent || '';
      const isMobile = /Android|iPhone|iPad|iPod|Windows Phone/i.test(ua);
      const waUrl = isMobile ? `whatsapp://send?text=${encoded}` : `https://wa.me/?text=${encoded}`;
      window.open(waUrl, '_blank');
      await onShare?.(post);
    };

    const shareFacebook = async () => {
      setIsShareModalOpen(false);
      const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(shareText)}`;
      window.open(fbUrl, '_blank');
      await onShare?.(post);
    };

    const shareTwitter = async () => {
      setIsShareModalOpen(false);
      const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
      window.open(twitterUrl, '_blank');
      await onShare?.(post);
    };

    const shareCopyLink = async () => {
      setIsShareModalOpen(false);
      try {
        await navigator.clipboard.writeText(shareUrl);
        toast.success('Link copied to clipboard');
        await onShare?.(post);
      } catch {
        toast.error('Unable to copy link');
      }
    };

    const handleShare = (e?: React.MouseEvent) => {
      e?.stopPropagation();
      setIsShareModalOpen(true);
    };

    const handleSaveEdit = async () => {
      if (onEditPost && editContent.trim()) {
        await onEditPost(post.id, editContent);
        setIsEditing(false);
      }
    }

    // ref + local view tracking
    const cardRef = React.useRef<HTMLDivElement | null>(null);
    const [hasTrackedView, setHasTrackedView] = useState(false);
    const [localViews, setLocalViews] = useState<number>(post.views_count ?? 0);

    // observe visibility and report view once per mounted Card
    React.useEffect(() => {
      if (!cardRef.current || !onPostView) return;
      const el = cardRef.current;
      const obs = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting && !hasTrackedView) {
            try {
              onPostView(post.id);
            } catch (e) {
              // ignore
            }
            setHasTrackedView(true);
            setLocalViews((v) => v + 1);
          }
        },
        { threshold: 0.6 }
      );
      obs.observe(el);
      return () => obs.disconnect();
    }, [post.id, onPostView, hasTrackedView]);

    return ( 
      <Card
        className="mb-4 border-none shadow-sm hover:shadow-md transition-shadow duration-300 bg-white dark:bg-slate-900 rounded-2xl overflow-hidden max-w-[680px] mx-auto"
        ref={cardRef}
        onClick={(e) => {
          const target = e.target as HTMLElement;
          if (!target.closest('button, a, input, textarea, video, [role="menuitem"]') && onClick) {
            onClick(post.id);
          }
        }}
      >
        <CardContent className="p-4">
          <div className="flex gap-3">
            {/* Avatar Column */}
            <div className="flex-shrink-0">
              <Avatar className="h-10 w-10 ring-2 ring-white dark:ring-slate-900 shadow-sm cursor-pointer hover:opacity-90">
                <AvatarImage src={post.author?.avatar_url} />
                <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
                  {post.author?.display_name?.[0]}
                </AvatarFallback>
              </Avatar>
            </div>

            {/* Content Column */}
            <div className="flex-1 min-w-0">
              {/* Header */}
              <div className="flex items-start justify-between mb-1">
                <div className="flex flex-col sm:flex-row sm:items-center gap-0 sm:gap-2">
                  <span className="font-bold text-slate-900 dark:text-slate-100 text-base hover:underline cursor-pointer">
                    {post.author?.display_name}
                  </span>
                  <div className="flex items-center text-slate-500 text-sm gap-2">
                    <span>@{post.author?.username}</span>
                    <span className="text-slate-300 dark:text-slate-700">•</span>
                    <span className="hover:underline cursor-pointer">{getTimeAgo(post.created_at)}</span>
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
                      <DropdownMenuItem onClick={() => toast.info("Reported")}><Flag className="mr-2 h-4 w-4" /> Report</DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Post Body */}
              {isEditing ? (
                <div className="mb-3 space-y-2" onClick={e => e.stopPropagation()}>
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
                <div className="text-[15px] leading-relaxed text-slate-800 dark:text-slate-200 whitespace-pre-wrap break-words">
                  {isLongContent && !isContentExpanded ? (
                    <>
                      {post.content.slice(0, 280)}...
                      <button
                        onClick={(e) => { e.stopPropagation(); setIsContentExpanded(true); }}
                        className="text-blue-600 hover:underline ml-1 font-medium"
                      >
                        Show more
                      </button>
                    </>
                  ) : (
                    post.content
                  )}
                </div>
              )}

              {/* Hashtags */}
              {post.hashtags && post.hashtags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {post.hashtags.map((tag: any, i: number) => (
                    <span key={i} className="text-blue-600 dark:text-blue-400 text-sm hover:underline cursor-pointer">#{tag.name}</span>
                  ))}
                </div>
              )}

              {/* Media */}
              <div onClick={e => e.stopPropagation()}>
                <MediaDisplay media={post.media} />
              </div>

              {/* Footer Actions */}
              <div className="flex items-center justify-between mt-4 pt-2 -ml-2">
                <ActionButton
                  icon={Heart}
                  count={post.likes_count}
                  active={post.is_liked}
                  activeColor="text-pink-600"
                  onClick={handleLike}
                />

                <ActionButton
                  icon={MessageCircle}
                  count={post.comments_count}
                  onClick={onComment}
                />

                <ActionButton
                  icon={Share2}
                  label="Share"
                  count={post.shares_count}
                  onClick={handleShare}
                />

                <ActionButton
                  icon={Bookmark}
                  label=""
                  active={post.is_bookmarked}
                  activeColor="text-blue-600"
                  onClick={handleBookmark}
                />

                {/* Views indicator */}
                <div className="ml-3 flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400">
                  <Eye className="h-4 w-4" />
                  <span className="font-medium text-xs">{localViews}</span>
                </div>
              </div>

              {/* Share Modal */}
              <Dialog open={isShareModalOpen} onOpenChange={setIsShareModalOpen} >
                <DialogContent className="max-w-sm w-[95vw] p-0 bg-transparent border-none">
                  <div className="bg-white dark:bg-slate-900 rounded-xl shadow-lg p-4 space-y-3">
                    <h3 className="text-lg font-semibold">Share post</h3>
                    <p className="text-sm text-slate-500">Choose where you'd like to share this post</p>
                    <div className="grid grid-cols-1 gap-2">
                      {(navigator as any).share && (
                        <Button onClick={shareNative} className="justify-start">🔤 Share via device</Button>
                      )}
                      <Button onClick={shareWhatsApp} className="justify-start">📱 WhatsApp</Button>
                      <Button onClick={shareFacebook} className="justify-start">👍 Facebook</Button>
                      <Button onClick={shareTwitter} className="justify-start">🦅 Twitter</Button>
                      <Button variant="outline" onClick={shareCopyLink} className="justify-start">🔗 Copy link</Button>
                      <div className="flex justify-end pt-2">
                        <Button variant="ghost" onClick={() => setIsShareModalOpen(false)}>Cancel</Button>
                      </div>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Comments */}
          {isExpanded && (
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 animate-in slide-in-from-top-2 fade-in duration-200">
              <CommentSection
                postId={post.id}
                comments={comments}
                isLoading={isLoadingComments}
                newComment={newComment}
                onCommentChange={onCommentChange}
                onSubmitComment={onSubmitComment}
                currentUser={currentUser}
              />
            </div>
          )}
        </CardContent>
      </Card>
    );
  }
);
PostCard.displayName = 'PostCard';