import React, { useEffect, useRef, useCallback, memo, useState } from 'react';
import { Card, CardContent, CardHeader } from '../../ui/card';
import { Button } from '../../ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '../../ui/avatar';
import { Textarea } from '../../ui/textarea';
import { Badge } from '../../ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../ui/dropdown-menu';
import {
  MoreHorizontal,
  Award,
  Target,
  UsersIcon,
  Lock,
  Globe,
  Eye,
  FileText,
  Share,
  Flag,
  ExternalLink,
  Edit,
  Trash2,
  Copy,
  Check,
  Loader2,
  AlertCircle,
  X,
  Image as ImageIcon,
  Film,
} from 'lucide-react';
import { toast } from 'sonner';
import { PostCardProps } from '../types/social';
import { PostActions } from './PostActions';
import { CommentSection } from './CommentSection';
import { HashtagBadge } from './HashtagBadge';
import { getTimeAgo, formatEngagementCount } from '../utils/postUtils';

interface PostCardWithViewTrackingProps extends PostCardProps {
  onPostView?: (postId: string) => void;
  onDeletePost?: (postId: string) => Promise<boolean>;
  onEditPost?: (postId: string, content: string) => Promise<boolean>;
}

const MAX_LINES = 6;
const TRUNCATION_LENGTH = 300;
const MAX_CONTENT_LENGTH = 5000;

// Enhanced Media Display Component
const MediaDisplay = memo(({ media, onRemove, isEditing }: { 
  media: any[]; 
  onRemove?: (index: number) => void;
  isEditing?: boolean;
}) => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);

  if (!media || media.length === 0) return null;

  const visibleMedia = media.slice(0, 4);
  let gridClass = 'grid-cols-2';
  if (visibleMedia.length === 1) gridClass = 'grid-cols-1';

  return (
    <>
      <div className={`grid ${gridClass} gap-2 mb-4 rounded-lg overflow-hidden`}>
        {visibleMedia.map((mediaItem, index) => (
          <div key={mediaItem.id || index} className="relative group">
            {/* Remove button for editing mode */}
            {isEditing && onRemove && (
              <button
                onClick={() => onRemove(index)}
                className="absolute top-2 right-2 z-10 p-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full shadow-lg transition-all"
              >
                <X className="h-4 w-4" />
              </button>
            )}

            {mediaItem.type === 'image' && (
              <div className="relative overflow-hidden rounded-lg bg-black">
                <img
                  src={mediaItem.url}
                  alt={mediaItem.filename || 'Post image'}
                  className="w-full h-auto max-h-96 object-cover hover:scale-105 transition-transform duration-300 cursor-pointer"
                  loading="lazy"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!isEditing) setFullscreenImage(mediaItem.url);
                  }}
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors pointer-events-none" />
                <div className="absolute bottom-2 right-2 bg-black/50 backdrop-blur-sm px-2 py-1 rounded text-xs text-white flex items-center gap-1">
                  <ImageIcon className="h-3 w-3" />
                  Image
                </div>
              </div>
            )}

            {mediaItem.type === 'video' && (
              <div className="relative rounded-lg overflow-hidden">
                <video
                  src={mediaItem.url}
                  className="w-full h-auto max-h-96 object-cover rounded-lg"
                  controls
                  preload="metadata"
                  onClick={(e) => e.stopPropagation()}
                />
                <div className="absolute bottom-2 right-2 bg-black/50 backdrop-blur-sm px-2 py-1 rounded text-xs text-white flex items-center gap-1">
                  <Film className="h-3 w-3" />
                  Video
                </div>
              </div>
            )}

            {mediaItem.type === 'document' && (
              <div
                className="w-full h-40 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-gray-800 dark:to-gray-900 rounded-lg flex items-center justify-center hover:from-slate-100 hover:to-slate-200 dark:hover:from-gray-700 dark:hover:to-gray-800 cursor-pointer transition-all group border-2 border-slate-200 dark:border-gray-700"
                onClick={(e) => {
                  e.stopPropagation();
                  if (!isEditing) window.open(mediaItem.url, '_blank', 'noopener,noreferrer');
                }}
              >
                <div className="text-center px-4">
                  <FileText className="h-10 w-10 mx-auto mb-3 text-blue-500 group-hover:scale-110 transition-transform" />
                  <p className="text-sm font-medium truncate max-w-[200px] text-slate-700 dark:text-gray-300">
                    {mediaItem.filename}
                  </p>
                  <div className="flex items-center justify-center gap-1 mt-2 text-xs text-muted-foreground">
                    <ExternalLink className="h-3 w-3" />
                    <span>Open Document</span>
                  </div>
                </div>
              </div>
            )}

            {index === visibleMedia.length - 1 && media.length > 4 && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white font-semibold text-lg backdrop-blur-sm rounded-lg">
                +{media.length - 4} more
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Fullscreen Image Viewer */}
      {fullscreenImage && (
        <Dialog open={!!fullscreenImage} onOpenChange={() => setFullscreenImage(null)}>
          <DialogContent className="max-w-7xl w-full h-[90vh] p-0" onClick={(e) => e.stopPropagation()}>
            <div className="relative w-full h-full flex items-center justify-center bg-black">
              <img
                src={fullscreenImage}
                alt="Full size"
                className="max-w-full max-h-full object-contain"
                onClick={(e) => e.stopPropagation()}
              />
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-4 right-4 bg-black/50 hover:bg-black/70 text-white"
                onClick={(e) => {
                  e.stopPropagation();
                  setFullscreenImage(null);
                }}
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

// Hashtags Display Component
const HashtagDisplay = memo(({ hashtags }: { hashtags: any[] }) => {
  if (!hashtags || hashtags.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {hashtags.map((hashtag, index) => (
        <HashtagBadge
          key={`${hashtag.id}-${index}`}
          hashtag={hashtag}
          onClick={(e) => {
            e.stopPropagation();
            toast.info(`Filtering by hashtag #${hashtag.name}`);
          }}
        />
      ))}
    </div>
  );
});

HashtagDisplay.displayName = 'HashtagDisplay';

// Engagement Stats Component
const EngagementStats = memo(({ post }: { post: any }) => (
  <div className="flex items-center justify-between py-3 border-t border-b border-slate-100 dark:border-gray-700 mb-3">
    <div className="flex items-center space-x-6 text-sm text-muted-foreground">
      <button className="hover:text-red-500 transition-colors cursor-pointer">
        <span className="font-medium">{formatEngagementCount(post.likes_count)}</span> {post.likes_count === 1 ? 'like' : 'likes'}
      </button>
      <button className="hover:text-blue-500 transition-colors cursor-pointer">
        <span className="font-medium">{formatEngagementCount(post.comments_count)}</span> {post.comments_count === 1 ? 'comment' : 'comments'}
      </button>
      <button className="hover:text-green-500 transition-colors cursor-pointer">
        <span className="font-medium">{formatEngagementCount(post.shares_count)}</span> {post.shares_count === 1 ? 'share' : 'shares'}
      </button>
    </div>
    <div className="flex items-center space-x-1 text-xs text-muted-foreground">
      <Eye className="h-3 w-3" />
      <span>{formatEngagementCount(post.views_count)}</span>
    </div>
  </div>
));

EngagementStats.displayName = 'EngagementStats';

// Main PostCard Component
export const PostCard: React.FC<PostCardWithViewTrackingProps> = memo(
  ({
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
    onDeletePost,
    onEditPost,
  }) => {
    const cardRef = useRef<HTMLDivElement>(null);
    const hasTriggeredView = useRef(false);
    const intersectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // State management
    const [isContentExpanded, setIsContentExpanded] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [editContent, setEditContent] = useState(post.content || '');
    const [isEditing, setIsEditing] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [copySuccess, setCopySuccess] = useState(false);

    const isContentLong = post.content && post.content.length > TRUNCATION_LENGTH;
    const isOwnPost = currentUser?.id === post.author_id;
    const isEdited = post.updated_at && post.updated_at !== post.created_at;

    // View tracking with Intersection Observer
    useEffect(() => {
      if (!onPostView || hasTriggeredView.current || !cardRef.current) return;

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (
              entry.isIntersecting &&
              entry.intersectionRatio > 0.5 &&
              !hasTriggeredView.current
            ) {
              if (intersectionTimeoutRef.current) {
                clearTimeout(intersectionTimeoutRef.current);
              }

              intersectionTimeoutRef.current = setTimeout(() => {
                if (entry.isIntersecting && !hasTriggeredView.current) {
                  hasTriggeredView.current = true;
                  onPostView(post.id);
                }
              }, 1000);
            } else if (!entry.isIntersecting && intersectionTimeoutRef.current) {
              clearTimeout(intersectionTimeoutRef.current);
              intersectionTimeoutRef.current = null;
            }
          });
        },
        {
          threshold: 0.5,
          rootMargin: '0px 0px -100px 0px',
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

    // Card click handler
    const handleCardClick = useCallback(
      (e: React.MouseEvent) => {
        const target = e.target as HTMLElement;
        if (target.closest('button, a, input, textarea, [role="menuitem"]')) return;

        if (onClick) {
          onClick(post.id);
        }
      },
      [onClick, post.id]
    );

    // Share handler
    const handleShare = useCallback(() => {
      onShare(post);
    }, [onShare, post]);

    // Copy link handler
    const handleCopyLink = useCallback(async (e: React.MouseEvent) => {
      e.stopPropagation();
      try {
        const url = `${window.location.origin}/social/post/${post.id}`;
        await navigator.clipboard.writeText(url);
        setCopySuccess(true);
        toast.success('Link copied to clipboard!');
        setTimeout(() => setCopySuccess(false), 2000);
      } catch (error) {
        toast.error('Failed to copy link');
      }
    }, [post.id]);

    // Delete handler
    const handleDelete = useCallback(async () => {
      if (!onDeletePost) return;

      setIsDeleting(true);
      try {
        const success = await onDeletePost(post.id);
        if (success) {
          setIsDeleteDialogOpen(false);
        }
      } catch (error) {
        console.error('Delete error:', error);
      } finally {
        setIsDeleting(false);
      }
    }, [onDeletePost, post.id]);

    // Edit handler
    const handleEdit = useCallback(async () => {
      if (!onEditPost || !editContent.trim() || editContent === post.content) return;

      if (editContent.length > MAX_CONTENT_LENGTH) {
        toast.error(`Post content cannot exceed ${MAX_CONTENT_LENGTH} characters`);
        return;
      }

      setIsEditing(true);
      try {
        const success = await onEditPost(post.id, editContent);
        if (success) {
          setIsEditModalOpen(false);
        }
      } catch (error) {
        console.error('Edit error:', error);
      } finally {
        setIsEditing(false);
      }
    }, [onEditPost, post.id, editContent, post.content]);

    // Report handler
    const handleReport = useCallback((e: React.MouseEvent) => {
      e.stopPropagation();
      toast.info('Report feature coming soon');
    }, []);

    // Open edit modal
    const openEditModal = useCallback((e: React.MouseEvent) => {
      e.stopPropagation();
      setEditContent(post.content || '');
      setIsEditModalOpen(true);
    }, [post.content]);

    return (
      <>
        <Card
          ref={cardRef}
          className="mb-6 hover:shadow-xl bg-white dark:bg-gray-900 transition-all duration-300 cursor-pointer group border border-slate-200 dark:border-gray-700 hover:border-slate-300 dark:hover:border-gray-600"
          onClick={handleCardClick}
        >
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              {/* Author Info */}
              <div className="flex items-center space-x-3">
                <Avatar className="ring-2 ring-primary/20 hover:ring-primary/40 transition-all">
                  <AvatarImage src={post.author?.avatar_url} />
                  <AvatarFallback className="bg-gradient-to-br from-blue-500 to-blue-600 text-white font-semibold">
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
                      <Target className="h-4 w-4 text-purple-500"  />
                    )}
                    {isOwnPost && (
                      <Badge variant="secondary" className="text-xs">You</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>@{post.author?.username}</span>
                    <span>•</span>
                    <span>{getTimeAgo(post.created_at)}</span>
                    {isEdited && (
                      <>
                        <span>•</span>
                        <span className="text-xs italic">(edited)</span>
                      </>
                    )}
                    <div className="flex items-center gap-1">
                      {post.privacy === 'followers' && (
                        <UsersIcon className="h-3 w-3"  />
                      )}
                      {post.privacy === 'private' && (
                        <Lock className="h-3 w-3" />
                      )}
                      {post.privacy === 'public' && (
                        <Globe className="h-3 w-3" />
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions Dropdown Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 p-0 hover:bg-slate-100 dark:hover:bg-gray-700"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56" onClick={(e) => e.stopPropagation()}>
                  {/* Copy Link */}
                  <DropdownMenuItem onClick={handleCopyLink} className="cursor-pointer">
                    {copySuccess ? (
                      <>
                        <Check className="h-4 w-4 mr-2 text-green-500" />
                        <span className="text-green-500">Link copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 mr-2" />
                        <span>Copy link to post</span>
                      </>
                    )}
                  </DropdownMenuItem>
                  
                  {/* Share */}
                  <DropdownMenuItem 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleShare();
                    }}
                    className="cursor-pointer"
                  >
                    <Share className="h-4 w-4 mr-2" />
                    <span>Share post</span>
                  </DropdownMenuItem>

                  {/* Owner Actions */}
                  {isOwnPost && (onEditPost || onDeletePost) && (
                    <DropdownMenuSeparator />
                  )}

                  {isOwnPost && onEditPost && (
                    <DropdownMenuItem 
                      onClick={openEditModal}
                      className="cursor-pointer"
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      <span>Edit post</span>
                    </DropdownMenuItem>
                  )}

                  {isOwnPost && onDeletePost && (
                    <DropdownMenuItem 
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsDeleteDialogOpen(true);
                      }}
                      className="cursor-pointer text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400 focus:bg-red-50 dark:focus:bg-red-900/20"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      <span>Delete post</span>
                    </DropdownMenuItem>
                  )}

                  {/* Report (for non-owners) */}
                  {!isOwnPost && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        onClick={handleReport} 
                        className="cursor-pointer text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400"
                      >
                        <Flag className="h-4 w-4 mr-2" />
                        <span>Report post</span>
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardHeader>
  
          <CardContent>
            {/* Post Content */}
            <div className={!isContentExpanded && isContentLong ? 'relative' : ''}>
              <p className={`text-slate-800 dark:text-gray-200 leading-relaxed break-words  mb-4 ${
                !isContentExpanded && isContentLong ? `line-clamp-${MAX_LINES}` : 'whitespace-pre-wrap'
              }`}>
                {post.content}
              </p>

              {isContentLong && (
                <Button
                  variant="link"
                  size="sm"
                  className="px-0 h-auto text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsContentExpanded(!isContentExpanded);
                  }}
                >
                  {isContentExpanded ? '← Show less' : 'View more →'}
                </Button>
              )}
            </div>

            {/* Media Display */}
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

        {/* Edit Modal */}
        <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
          <DialogContent className="sm:max-w-[600px]" onClick={(e) => e.stopPropagation()}>
            <DialogHeader>
              <DialogTitle>Edit Post</DialogTitle>
              <DialogDescription>
                Make changes to your post. Your edits will be visible to everyone who can see this post.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <Textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                placeholder="What's on your mind?"
                className="min-h-[150px] resize-y"
                onClick={(e) => e.stopPropagation()}
                maxLength={MAX_CONTENT_LENGTH}
              />
              <div className="flex items-center justify-between text-sm">
                <span className={`${
                  editContent.length > MAX_CONTENT_LENGTH * 0.9 
                    ? 'text-orange-500 font-medium' 
                    : 'text-muted-foreground'
                }`}>
                  {editContent.length} / {MAX_CONTENT_LENGTH} characters
                </span>
                {editContent !== post.content && (
                  <span className="text-blue-500 text-xs">• Changes detected</span>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditModalOpen(false);
                  setEditContent(post.content || '');
                }}
                disabled={isEditing}
              >
                Cancel
              </Button>
              <Button
                onClick={handleEdit}
                disabled={!editContent.trim() || editContent === post.content || isEditing || editContent.length > MAX_CONTENT_LENGTH}
              >
                {isEditing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save changes'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent onClick={(e) => e.stopPropagation()}>
            <AlertDialogHeader>
              <div className="flex items-center gap-2">
                <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-full">
                  <AlertCircle className="h-5 w-5 text-red-500" />
                </div>
                <AlertDialogTitle>Delete Post</AlertDialogTitle>
              </div>
              <AlertDialogDescription className="space-y-2">
                <p>Are you sure you want to delete this post? This action cannot be undone.</p>
                <div className="mt-3 p-3 bg-slate-50 dark:bg-gray-800 rounded-lg border border-slate-200 dark:border-gray-700">
                  <p className="text-xs text-slate-600 dark:text-gray-400">
                    <strong>What will be deleted:</strong>
                  </p>
                  <ul className="text-xs text-slate-600 dark:text-gray-400 list-disc list-inside mt-1 space-y-1">
                    <li>Post content and media</li>
                    <li>All comments ({post.comments_count})</li>
                    <li>All likes ({post.likes_count})</li>
                    <li>All bookmarks</li>
                  </ul>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={(e) => e.stopPropagation()} disabled={isDeleting}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete();
                }}
                disabled={isDeleting}
                className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Post
                  </>
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  }
);

PostCard.displayName = 'PostCard';