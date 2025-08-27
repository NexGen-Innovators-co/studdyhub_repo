import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '../../ui/avatar';
import { Input } from '../../ui/input';
import { Button } from '../../ui/button';
import { Send, RefreshCw } from 'lucide-react';
import { CommentSectionProps } from '../types/social';
import { getTimeAgo } from '../utils/postUtils';

export const CommentSection: React.FC<CommentSectionProps> = ({
  postId,
  comments,
  isLoading,
  newComment,
  onCommentChange,
  onSubmitComment,
  currentUser,
}) => {
  const handleSubmit = () => {
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
              <div className="flex-1 bg-muted rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-medium text-sm">{comment.author?.display_name}</p>
                  <span className="text-xs text-muted-foreground">
                    {getTimeAgo(comment.created_at)}
                  </span>
                </div>
                <p className="text-sm">{comment.content}</p>
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
                placeholder="Write a comment..."
                value={newComment}
                onChange={(e) => onCommentChange(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSubmit()}
                className="flex-1"
              />
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={!newComment.trim()}
              >
                <Send className="h-4 w-4 " />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};