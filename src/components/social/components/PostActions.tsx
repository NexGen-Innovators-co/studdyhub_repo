import React, { useMemo } from 'react';
import { Button } from '../../ui/button';
import { Heart, MessageCircle, Share2, Bookmark, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useFeatureAccess } from '../../../hooks/useFeatureAccess';
import { PostActionsProps } from '../types/social';

export const PostActions: React.FC<PostActionsProps> = ({
  post,
  onLike,
  onComment,
  onShare,
  onBookmark,
}) => {
  const navigate = useNavigate();
  const { canAccessSocial } = useFeatureAccess();

  const socialAccess = useMemo(() => canAccessSocial(), [canAccessSocial]);

  const requireSocialAccess = (action: () => void) => {
    if (!socialAccess) {
      toast.error('Social actions are available for Scholar and Genius plans', {
        action: {
          label: 'Upgrade',
          onClick: () => navigate('/subscription'),
        },
        duration: 5000,
      });
      return;
    }
    action();
  };

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center space-x-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => requireSocialAccess(() => onLike(post.id, post.is_liked || false))}
          disabled={!socialAccess}
          title={!socialAccess ? 'Upgrade to interact with posts' : 'Like post'}
          className={`${post.is_liked ? 'text-red-500 ' : ''} hover:bg-red-50 dark:hover:bg-red-100 dark:text-red-600 dark:hover:text-red-500 transition-colors`}
        >
          {socialAccess ? (
            <Heart className={`h-4 w-4 mr-1 ${post.is_liked ? 'fill-current' : ''}`} />
          ) : (
            <Lock className="h-4 w-4 mr-1" />
          )}
          <span className="hidden sm:inline">Like</span>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => requireSocialAccess(onComment)}
          disabled={!socialAccess}
          title={!socialAccess ? 'Upgrade to comment on posts' : 'Comment on post'}
          className="hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-100 dark:hover:text-blue-500 transition-colors"
        >
          {socialAccess ? (
            <MessageCircle className="h-4 w-4 mr-1" />
          ) : (
            <Lock className="h-4 w-4 mr-1" />
          )}
          <span className="hidden sm:inline">Comment</span>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => requireSocialAccess(() => onShare(post))}
          disabled={!socialAccess}
          title={!socialAccess ? 'Upgrade to share posts' : 'Share post'}
          className="hover:bg-green-50 hover:text-green-600 dark:hover:bg-green-100 dark:hover:text-green-500 transition-colors"
        >
          {socialAccess ? (
            <Share2 className="h-4 w-4 mr-1" />
          ) : (
            <Lock className="h-4 w-4 mr-1" />
          )}
          <span className="hidden sm:inline">Share</span>
        </Button>
      </div>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => requireSocialAccess(() => onBookmark(post.id, post.is_bookmarked || false))}
        disabled={!socialAccess}
        title={!socialAccess ? 'Upgrade to save posts' : 'Save post'}
        className={`${post.is_bookmarked ? 'text-blue-500 bg-blue-50' : ''} hover:bg-blue-50 hover:text-blue-500 transition-colors`}
      >
        {socialAccess ? (
          <Bookmark className={`h-4 w-4 ${post.is_bookmarked ? 'fill-current' : ''}`} />
        ) : (
          <Lock className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
};