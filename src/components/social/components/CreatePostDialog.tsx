import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../ui/dialog';
import { Card, CardContent } from '../../ui/card';
import { Button } from '../../ui/button';
import { Textarea } from '../../ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '../../ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Globe, Users, Lock, RefreshCw } from 'lucide-react';
import { CreatePostDialogProps } from '../types/social';
import { MediaUpload } from './MediaUpload';
import { FILE_CONSTRAINTS } from '../utils/socialConstants';

export const CreatePostDialog: React.FC<CreatePostDialogProps> = ({
  isOpen,
  onClose,
  content,
  onContentChange,
  privacy,
  onPrivacyChange,
  selectedFiles,
  onFilesChange,
  onSubmit,
  isUploading,
  currentUser,
}) => {
  const handleSubmit = () => {
    if (content.trim()) {
      onSubmit();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogTrigger asChild>
        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <Avatar>
                <AvatarImage src={currentUser?.avatar_url} />
                <AvatarFallback>
                  {currentUser?.display_name?.charAt(0).toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 flex items-center">
                <div className="w-full bg-muted rounded-full px-4 py-2 text-muted-foreground">
                  What's on your mind?
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </DialogTrigger>

      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create Post</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Avatar>
              <AvatarImage src={currentUser?.avatar_url} />
              <AvatarFallback>
                {currentUser?.display_name?.charAt(0).toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">{currentUser?.display_name}</p>
              <Select value={privacy} onValueChange={onPrivacyChange}>
                <SelectTrigger className="w-32 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">
                    <div className="flex items-center gap-2">
                      <Globe className="h-3 w-3" />
                      Public
                    </div>
                  </SelectItem>
                  <SelectItem value="followers">
                    <div className="flex items-center gap-2">
                      <Users className="h-3 w-3" />
                      Followers
                    </div>
                  </SelectItem>
                  <SelectItem value="private">
                    <div className="flex items-center gap-2">
                      <Lock className="h-3 w-3" />
                      Private
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Textarea
            placeholder="What's happening? Use #hashtags to join conversations..."
            value={content}
            onChange={(e) => onContentChange(e.target.value)}
            className="min-h-[120px] resize-none text-lg border-0 shadow-none focus:ring-0"
          />

          <MediaUpload
            selectedFiles={selectedFiles}
            onFilesChange={onFilesChange}
            onFileSelect={() => {}}
          />

          {/* Post Actions */}
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Max {FILE_CONSTRAINTS.MAX_FILES_PER_POST} files</span>
            </div>

            <div className="flex items-center gap-2">
              <span className={`text-sm ${content.length > FILE_CONSTRAINTS.MAX_POST_LENGTH ? 'text-red-500' : 'text-muted-foreground'}`}>
                {content.length}/{FILE_CONSTRAINTS.MAX_POST_LENGTH}
              </span>
              <Button
                onClick={handleSubmit}
                disabled={!content.trim() || isUploading || content.length > FILE_CONSTRAINTS.MAX_POST_LENGTH}
                className="bg-primary hover:bg-primary/90"
              >
                {isUploading ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  'Post'
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};