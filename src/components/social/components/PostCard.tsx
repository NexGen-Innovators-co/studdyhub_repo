import React, { useEffect, useRef, useCallback, memo, useState } from 'react';
import { Card, CardContent, CardHeader } from '../../ui/card';
import { Button } from '../../ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '../../ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../ui/dialog';
import {
  MoreHorizontal, Award, Target, UsersIcon, Lock, Globe,
  Eye, FileText, Share, Flag, ExternalLink
} from 'lucide-react';
import { toast } from 'sonner';
import { PostCardProps } from '../types/social';
import { PostActions } from './PostActions';
import { CommentSection } from './CommentSection';
import { HashtagBadge } from './HashtagBadge';
import { getTimeAgo, formatEngagementCount } from '../utils/postUtils';

interface PostCardWithViewTrackingProps extends PostCardProps {
  onPostView?: (postId: string) => void;
}

// Memoized media component for better performance
const MediaDisplay = memo(({ media }: { media: any[] }) => {
  if (!media || media.length === 0) return null;

  // Determine grid-cols based on the number of visible items (max 4)
  const visibleMedia = media.slice(0, 4);
  let gridClass = 'grid-cols-2'; // Default for 2, 3, or 4 items
  if (visibleMedia.length === 1) {
    gridClass = 'grid-cols-1'; // Use full width for a single item
  } else if (visibleMedia.length === 2) {
    gridClass = 'grid-cols-2';
  } else if (visibleMedia.length === 3 || visibleMedia.length === 4) {
    gridClass = 'grid-cols-2';
  }

  return (
    <div className={`grid ${gridClass} gap-2 mb-4 rounded-lg overflow-hidden`}>
      {visibleMedia.map((mediaItem, index) => (
        <div key={mediaItem.id} className="relative group">
          {mediaItem.type === 'image' && (
            <img
              // Adjust h-40 to h-auto and a max-height for single image to be more flexible
              src={mediaItem.url}
              alt={mediaItem.filename}
              className="w-full h-auto max-h-96 object-contain hover:scale-105 transition-transform cursor-pointer bg-black" // Added bg-black for better visibility of object-contain
              loading="lazy"
              onClick={() => {
                window.open(mediaItem.url, '_blank', 'noopener,noreferrer');
              }}
            />
          )}
          {mediaItem.type === 'video' && (
            <video
              src={mediaItem.url}
              className="w-full h-auto max-h-96 object-contain bg-black"
              controls
              preload="metadata"
            />
          )}
          {mediaItem.type === 'document' && (
            <div className="w-full h-40 bg-muted flex items-center justify-center hover:bg-muted/80 cursor-pointer transition-colors"
              onClick={() => window.open(mediaItem.url, '_blank', 'noopener,noreferrer')}
            >
              <div className="text-center">
                <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm truncate px-2">{mediaItem.filename}</p>
                <ExternalLink className="h-3 w-3 mx-auto mt-1 text-muted-foreground" />
              </div>
            </div>
          )}

          {/* Overlay for additional media - now only appears on the last visible grid item if there's more */}
          {index === visibleMedia.length - 1 && media.length > 4 && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white font-semibold">
              +{media.length - 4} more
            </div>
          )}
        </div>
      ))}
    </div>
  );
});

MediaDisplay.displayName = 'MediaDisplay';

// Memoized hashtags component
const HashtagDisplay = memo(({ hashtags }: { hashtags: any[] }) => {
  if (!hashtags || hashtags.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {hashtags.map((hashtag, index) => (
        <HashtagBadge
          key={`${hashtag.id}-${index}`}
          hashtag={hashtag}
          onClick={() => toast.info(`Filtering by hashtag #${hashtag.name}`)}
        />
      ))}
    </div>
  );
});

HashtagDisplay.displayName = 'HashtagDisplay';

// Memoized engagement stats component
const EngagementStats = memo(({ post }: { post: any }) => (
  <div className="flex items-center justify-between py-2 border-t border-b mb-3">
    <div className="flex items-center space-x-6 text-sm text-muted-foreground">
      <span>{formatEngagementCount(post.likes_count)} likes</span>
      <span>{formatEngagementCount(post.comments_count)} comments</span>
      <span>{formatEngagementCount(post.shares_count)} shares</span>
    </div>
    <div className="flex items-center space-x-1 text-xs text-muted-foreground">
      <Eye className="h-3 w-3" />
      <span>{formatEngagementCount(post.views_count)} views</span>
    </div>
  </div>
));

EngagementStats.displayName = 'EngagementStats';

// Define a constant for max lines before truncation
const MAX_LINES = 6;
// Simple heuristic to estimate if content will exceed max lines (adjust as needed)
const TRUNCATION_LENGTH = 300; 

export const PostCard: React.FC<PostCardWithViewTrackingProps> = memo(({
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
  onPostView,
  onClick,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const hasTriggeredView = useRef(false);
  const intersectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // State to manage the "View More" functionality
  const [isContentExpanded, setIsContentExpanded] = useState(false);
  
  // Check if content is long enough to require "View More"
  const isContentLong = post.content && post.content.length > TRUNCATION_LENGTH;
  
  // Class for truncation logic: line-clamp uses the plugin, whitespace-pre-wrap respects newlines.
  const contentClass = isContentExpanded 
    ? 'whitespace-pre-wrap' 
    : `line-clamp-${MAX_LINES}`; 

  // Base classes for text styling and crucial break-words for mobile safety
  const baseTextClasses = "text-slate-800 dark:text-gray-200 leading-relaxed break-words"; 


  // Optimized intersection observer with debouncing
  useEffect(() => {
    if (!onPostView || hasTriggeredView.current || !cardRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio > 0.5 && !hasTriggeredView.current) {
            // Clear any existing timeout
            if (intersectionTimeoutRef.current) {
              clearTimeout(intersectionTimeoutRef.current);
            }

            // Schedule view tracking with debouncing
            intersectionTimeoutRef.current = setTimeout(() => {
              if (entry.isIntersecting && !hasTriggeredView.current) {
                hasTriggeredView.current = true;
                onPostView(post.id);
              }
            }, 1000); // 1 second delay
          } else if (!entry.isIntersecting && intersectionTimeoutRef.current) {
            // Cancel view tracking if user scrolls away quickly
            clearTimeout(intersectionTimeoutRef.current);
            intersectionTimeoutRef.current = null;
          }
        });
      },
      {
        threshold: 0.5,
        rootMargin: '0px 0px -100px 0px'
      }
    );

    observer.observe(cardRef.current);

    return () => {
      observer.disconnect();
      if (intersectionTimeoutRef.current) {
        clearTimeout(intersectionTimeoutRef.current);
      }
    };
  }, [post.id, onPostView]);

  // Memoized click handler
  const handleCardClick = useCallback((e: React.MouseEvent) => {
    // Don't trigger click if user is clicking on interactive elements
    const target = e.target as HTMLElement;
    if (target.closest('button, a, input, textarea')) return;

    if (onClick) {
      onClick(post.id);
    }
  }, [onClick, post.id]);

  // Memoized share handler
  const handleShare = useCallback(() => {
    onShare(post);
  }, [onShare, post]);

  return (
    <Card
      ref={cardRef}
      className="mb-6 hover:shadow-lg bg-white dark:bg-gray-900 transition-shadow duration-200 cursor-pointer group"
      onClick={handleCardClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Avatar className="ring-2 ring-primary/10 hover:ring-primary/20 transition-all">
              <AvatarImage src={post.author?.avatar_url} />
              <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/5">
                {post.author?.display_name?.charAt(0).toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-semibold text-slate-800 dark:text-gray-200">
                  {post.author?.display_name}
                </p>
                {post.author?.is_verified && (
                  <Award className="h-4 w-4 text-blue-500" />
                )}
                {post.author?.is_contributor && (
                  <Target className="h-4 w-4 text-purple-500" />
                )}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>@{post.author?.username}</span>
                <span>•</span>
                <span>{getTimeAgo(post.created_at)}</span>
                {post.privacy === 'followers' && <UsersIcon className="h-3 w-3" />}
                {post.privacy === 'private' && <Lock className="h-3 w-3" />}
                {post.privacy === 'public' && <Globe className="h-3 w-3" />}
              </div>
            </div>
          </div>
          <Dialog>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Post Options</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col space-y-2">
                <Button
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleShare();
                  }}
                  className="justify-start"
                >
                  <Share className="h-4 w-4 mr-2" />
                  Share Post
                </Button>
                <Button
                  variant="ghost"
                  className="justify-start text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950 dark:hover:text-red-400"
                  onClick={(e) => {
                    e.stopPropagation();
                    toast.info(`Reporting post ${post.id}. This feature is in development.`);
                  }}
                >
                  <Flag className="h-4 w-4 mr-2" />
                  Report Post
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>

      <CardContent>
        {/* Post Content - Added break-words and conditional overflow-hidden for mobile safety */}
        <div className={`mb-4 ${!isContentExpanded && isContentLong ? 'h-full overflow-hidden' : ''}`}> 
          <p className={`${baseTextClasses} ${contentClass}`}>
            {post.content}
          </p>
          
          {/* View More/Show Less buttons */}
          {isContentLong && !isContentExpanded && (
            <Button
              variant="link"
              size="sm"
              className="px-0 h-auto text-primary"
              onClick={(e) => {
                e.stopPropagation();
                setIsContentExpanded(true);
              }}
            >
              View More
            </Button>
          )}
          {isContentLong && isContentExpanded && (
            <Button
              variant="link"
              size="sm"
              className="px-0 h-auto text-primary"
              onClick={(e) => {
                e.stopPropagation();
                setIsContentExpanded(false);
              }}
            >
              Show Less
            </Button>
          )}
        </div>

        {/* Media display */}
        <MediaDisplay media={post.media} />

        {/* Hashtags */}
        <HashtagDisplay hashtags={post.hashtags} />

        {/* Engagement Stats */}
        <EngagementStats post={post} />

        {/* Action Buttons */}
        <div onClick={(e) => e.stopPropagation()}>
          <PostActions
            post={post}
            onLike={onLike}
            onComment={onComment}
            onShare={handleShare}
            onBookmark={onBookmark}
          />
        </div>

        {/* Comments Section */}
        {isExpanded && (
          <div onClick={(e) => e.stopPropagation()}>
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
});

PostCard.displayName = 'PostCard';