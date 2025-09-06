import React, { useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader } from '../../ui/card';
import { Button } from '../../ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '../../ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../ui/dialog';
import {
  MoreHorizontal, Award, Target, UsersIcon, Lock, Globe,
  Eye, FileText, Share, Flag
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

export const PostCard: React.FC<PostCardWithViewTrackingProps> = ({
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
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const hasTriggeredView = useRef(false);

  useEffect(() => {
    if (!onPostView || hasTriggeredView.current || !cardRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio > 0.5 && !hasTriggeredView.current) {
            // Post is more than 50% visible - schedule view tracking
            hasTriggeredView.current = true;
            setTimeout(() => {
              if (onPostView && hasTriggeredView.current) {
                onPostView(post.id);
              }
            }, 1000); // 1 second delay to ensure user is actually viewing
          }
        });
      },
      {
        threshold: 0.5, // Trigger when 50% of the post is visible
        rootMargin: '0px 0px -100px 0px' // Only trigger when post is well within viewport
      }
    );

    observer.observe(cardRef.current);

    return () => {
      observer.disconnect();
    };
  }, [post.id, onPostView]);

  return (
    <Card
      ref={cardRef}
      className="mb-6 hover:shadow-lg bg-white dark:bg-gray-900 transition-shadow duration-200"
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Avatar className="ring-2 ring-primary/10">
              <AvatarImage src={post.author?.avatar_url} />
              <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/5">
                {post.author?.display_name?.charAt(0).toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-semibold">{post.author?.display_name}</p>
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
              <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Post Options</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col space-y-2">
                <Button variant="ghost" onClick={() => onShare(post)} className="justify-start">
                  <Share className="h-4 w-4 mr-2" />
                  Share Post
                </Button>
                <Button
                  variant="ghost"
                  className="justify-start text-red-600 hover:bg-red-50 hover:text-red-700"
                  onClick={() => toast.info(`Reporting post ${post.id}. This feature is in development.`)}
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
        <p className="mb-4 whitespace-pre-wrap leading-relaxed">{post.content}</p>

        {/* Media display */}
        {post.media && post.media.length > 0 && (
          <div className="grid grid-cols-2 gap-2 mb-4 rounded-lg overflow-hidden">
            {post.media.slice(0, 4).map((media, index) => (
              <div key={media.id} className="relative group">
                {media.type === 'image' && (
                  <img
                    src={media.url}
                    alt={media.filename}
                    className="w-full h-40 object-cover hover:scale-105 transition-transform cursor-pointer"
                  />
                )}
                {media.type === 'video' && (
                  <video
                    src={media.url}
                    className="w-full h-40 object-cover"
                    controls
                  />
                )}
                {media.type === 'document' && (
                  <div className="w-full h-40 bg-muted flex items-center justify-center">
                    <div className="text-center">
                      <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm truncate px-2">{media.filename}</p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Hashtags */}
        {post.hashtags && post.hashtags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {post.hashtags.map((hashtag, index) => (
              <HashtagBadge
                key={index}
                hashtag={hashtag}
                onClick={() => toast.info(`Filtering by hashtag #${hashtag.name}`)}
              />
            ))}
          </div>
        )}

        {/* Engagement Stats */}
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

        {/* Action Buttons */}
        <PostActions
          post={post}
          onLike={onLike}
          onComment={onComment}
          onShare={onShare}
          onBookmark={onBookmark}
        />

        {/* Comments Section */}
        {isExpanded && (
          <CommentSection
            postId={post.id}
            comments={comments}
            isLoading={isLoadingComments}
            newComment={newComment}
            onCommentChange={onCommentChange}
            onSubmitComment={onSubmitComment}
            currentUser={currentUser}
          />
        )}
      </CardContent>
    </Card>
  );
};