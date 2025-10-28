import React from 'react';
import { Button } from '../../ui/button';
import { Heart, MessageCircle, Share2, Bookmark } from 'lucide-react';
import { PostActionsProps } from '../types/social';

export const PostActions: React.FC<PostActionsProps> = ({
  post,
  onLike,
  onComment,
  onShare,
  onBookmark,
}) => {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center space-x-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onLike(post.id, post.is_liked || false)}
          className={`${post.is_liked ? 'text-red-500 ' : ''} hover:bg-red-50 dark:hover:bg-red-100 dark:text-red-600 dark:hover:text-red-500 transition-colors`}
        >
          <Heart className={`h-4 w-4 mr-1 ${post.is_liked ? 'fill-current' : ''}`} />
          <span className="hidden sm:inline">Like</span>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={onComment}
          className="hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-100 dark:hover:text-blue-500 transition-colors"
        >
          <MessageCircle className="h-4 w-4 mr-1" />
          <span className="hidden sm:inline">Comment</span>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => onShare(post)}
          className="hover:bg-green-50 hover:text-green-600 dark:hover:bg-green-100 dark:hover:text-green-500 transition-colors"
        >
          <Share2 className="h-4 w-4 mr-1" />
          <span className="hidden sm:inline">Share</span>
        </Button>
      </div>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => onBookmark(post.id, post.is_bookmarked || false)}
        className={`${post.is_bookmarked ? 'text-blue-500 bg-blue-50' : ''} hover:bg-blue-50 hover:text-blue-500 transition-colors`}
      >
        <Bookmark className={`h-4 w-4 ${post.is_bookmarked ? 'fill-current' : ''}`} />
      </Button>
    </div>
  );
};