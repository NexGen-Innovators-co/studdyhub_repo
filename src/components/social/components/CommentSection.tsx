import React from 'react';
import { useFeatureAccess } from '../../../hooks/useFeatureAccess';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '../../ui/avatar';
import { Input } from '../../ui/input';
import { Button } from '../../ui/button';
import { Send, RefreshCw } from 'lucide-react';
import { CommentSectionProps } from '../types/social';
import { getTimeAgo, renderContentWithClickableLinks } from '../utils/postUtils';

export const CommentSection: React.FC<CommentSectionProps> = ({
  postId,
  comments,
  isLoading,
  newComment,
  onCommentChange,
  onSubmitComment,
  currentUser,
  isAddingComment,
}) => {
  const { canPostSocials } = useFeatureAccess();
  const canInteract = canPostSocials();
  const handleSubmit = () => {
    if (!canInteract) {
      toast.error('Commenting is available for Scholar and Genius plans', {
        action: {
          label: 'Upgrade',
          onClick: () => window.location.assign('/subscription'),
        },
        duration: 5000,
      });
      return;
    }
    if (newComment.trim()) {
      onSubmitComment();
    }
  };

  return (
    <div className="mt-4 pt-4 border-t">
      {isLoading ? (
        <div className="flex justify-center py-4">
          <RefreshCw className="h-5 w-5 animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {comments.map((comment) => (
            <div key={comment.id} className="flex space-x-3">
              <Avatar className="w-8 h-8">
                <AvatarImage src={comment.author?.avatar_url} />
                <AvatarFallback className="text-xs">
                  {comment.author?.display_name?.charAt(0).toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1  rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-medium text-sm">{comment.author?.display_name}</p>
                  <span className="text-xs text-muted-foreground">
                    {getTimeAgo(comment.created_at)}
                  </span>
                </div>
                <div className="text-sm">{renderContentWithClickableLinks(comment.content)}</div>
              </div>
            </div>
          ))}

          {/* Add comment */}
          <div className="flex space-x-3 mt-4">
            <Avatar className="w-8 h-8">
              <AvatarImage src={currentUser?.avatar_url} />
              <AvatarFallback className="text-xs">
                {currentUser?.display_name?.charAt(0).toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 flex gap-2">
              <Input
                placeholder={canInteract ? 'Write a comment...' : 'Upgrade to comment'}
                value={newComment}
                onChange={(e) => canInteract ? onCommentChange(e.target.value) : toast.error('Commenting is available for Scholar and Genius plans', {
                  action: {
                    label: 'Upgrade',
                    onClick: () => window.location.assign('/subscription'),
                  },
                  duration: 5000,
                })}
                onKeyPress={(e) => e.key === 'Enter' && handleSubmit()}
                className="flex-1"
                disabled={!canInteract}
                title={!canInteract ? 'Upgrade to comment' : 'Write a comment'}
              />
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={!newComment.trim() || !canInteract || isAddingComment}
                title={!canInteract ? 'Upgrade to comment' : 'Send comment'}
              >
                {!canInteract ? <Send className="h-4 w-4 opacity-50" /> : isAddingComment ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};