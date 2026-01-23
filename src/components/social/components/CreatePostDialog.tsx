// Fixed CreatePostDialog.tsx
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../ui/dialog';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Textarea } from '../../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { X, Loader2, Lock, Sparkles } from 'lucide-react';
import { generateInlineContent } from '../../../services/aiServices';
import { SocialUserWithDetails } from '../../../integrations/supabase/socialTypes';
import { Privacy } from '../types/social';
import { useFeatureAccess } from '../../../hooks/useFeatureAccess';
import { Alert, AlertDescription } from '../../ui/alert';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

interface CreatePostDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  content: string;
  onContentChange: (content: string) => void;
  privacy: Privacy;
  onPrivacyChange: (privacy: Privacy) => void;
  selectedFiles: File[];
  onFilesChange: (files: File[]) => void;
  onSubmit: () => void;
  isUploading: boolean;
  currentUser: SocialUserWithDetails | null;
  groupId?: string; // Optional since not always in group context
  metadata?: any;
  disabled?: boolean;
  upgradeMessage?: string;
}

export const CreatePostDialog: React.FC<CreatePostDialogProps> = ({
  isOpen,
  onOpenChange,
  content,
  onContentChange,
  privacy,
  onPrivacyChange,
  selectedFiles,
  onFilesChange,
  onSubmit,
  isUploading,
  currentUser,
  groupId,
  metadata,
  disabled,
  upgradeMessage
}) => {
  const { canPostSocials: canPostSocialsAccess, tier } = useFeatureAccess();
  const navigate = useNavigate();
  const [isRewriting, setIsRewriting] = useState(false);

  const canPostSocials = disabled !== undefined ? !disabled : canPostSocialsAccess;
  const displayUpgradeMessage = upgradeMessage || 'Social posting requires Scholar plan or higher';

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      onFilesChange(Array.from(e.target.files));
    }
  };

  const handleSubmit = () => {
    // Check subscription access
    if (!canPostSocials) {
      toast.error(displayUpgradeMessage, {
        action: {
          label: 'Upgrade',
          onClick: () => navigate('/subscription')
        },
        duration: 5000
      });
      return;
    }

    onSubmit();
  };

  const handleAiRewrite = async () => {
    if (!content.trim() || !currentUser) return;

    setIsRewriting(true);
    toast.info('AI is rewriting your post...');

    try {
      // Construct a minimal UserProfile for the AI service
      const minimalProfile = {
        id: currentUser.id,
        full_name: currentUser.display_name,
        avatar_url: currentUser.avatar_url || null,
      } as any;

      const response = await generateInlineContent(
        content,
        content,
        minimalProfile,
        'rewrite',
        'Rewrite this social media post to be more engaging, professional, and clear. Maintain the original core message and any hashtags. Keep the tone suitable for a student community.'
      );

      onContentChange(response);
      toast.success('Post rewritten!');
    } catch (error: any) {
      //console.error('Rewrite error:', error);
      toast.error(error.message || 'Failed to rewrite post');
    } finally {
      setIsRewriting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 max-h-screen overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-slate-800 dark:text-gray-200">Create Post</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {!canPostSocials && (
            <Alert className="bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800">
              <Lock className="h-4 w-4 text-orange-600 dark:text-orange-400" />
              <AlertDescription className="text-orange-800 dark:text-orange-200">
                {displayUpgradeMessage}
                <Button
                  variant="link"
                  className="text-orange-600 dark:text-orange-400 p-0 h-auto"
                  onClick={() => navigate('/subscription')}
                >
                  Upgrade now
                </Button>
              </AlertDescription>
            </Alert>
          )}
          <div className="relative">
            <Textarea
              value={content}
              onChange={(e) => onContentChange(e.target.value)}
              placeholder="What's on your mind?"
              disabled={!canPostSocials || isUploading || isRewriting}
              className="bg-white dark:bg-gray-700 text-slate-800 dark:text-gray-200 border-slate-200 dark:border-gray-600 disabled:opacity-50 pr-10 min-h-[150px]"
              rows={5}
            />
            <Button
              size="icon"
              variant="ghost"
              type="button"
              className="absolute top-2 right-2 h-8 w-8 text-blue-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30"
              onClick={handleAiRewrite}
              disabled={!canPostSocials || isUploading || !content.trim() || isRewriting}
              title="Rewrite with AI"
            >
              {isRewriting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            </Button>
          </div>

          {metadata?.type === 'podcast' && (
            <div className="p-3 border border-slate-200 dark:border-gray-700 rounded-lg bg-slate-50 dark:bg-gray-900/50 flex gap-3 max-w-full" style={{ maxWidth: '400px' }}>
              {metadata.coverUrl && (
                <img
                  src={metadata.coverUrl}
                  alt={metadata.title}
                  className="w-16 h-16 rounded object-cover flex-shrink-0"
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 dark:text-gray-100 truncate  overflow-hidden max-w-full">
                  {metadata.title}
                </p>
                <p className="text-xs text-slate-500 dark:text-gray-400 line-clamp-2">
                  {metadata.description}
                </p>
                <div className="mt-1 flex items-center gap-1 text-[10px] text-blue-600 dark:text-blue-400 font-semibold uppercase tracking-wider">
                  <span>Podcast Attachment</span>
                </div>
              </div>
            </div>
          )}

          <Select value={privacy} onValueChange={onPrivacyChange} disabled={!canPostSocials}>
            <SelectTrigger className="bg-white dark:bg-gray-700 text-slate-800 dark:text-gray-200 border-slate-200 dark:border-gray-600 disabled:opacity-50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-white dark:bg-gray-800 border-slate-200 dark:border-gray-700">
              <SelectItem value="public">Public</SelectItem>
              <SelectItem value="followers">Followers</SelectItem>
              <SelectItem value="private">Private</SelectItem>
            </SelectContent>
          </Select>
          <Input
            type="file"
            accept="image/*,video/*"
            multiple
            onChange={handleFileChange}
            disabled={!canPostSocials || isUploading}
            className="bg-white dark:bg-gray-700 text-slate-800 dark:text-gray-300 border-slate-200 dark:border-gray-600 disabled:opacity-50"
          />
          {selectedFiles.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedFiles.map((file, index) => (
                <span
                  key={index}
                  className="text-xs bg-slate-100 dark:bg-gray-700 text-slate-600 dark:text-gray-300 px-2 py-1 rounded-full"
                >
                  {file.name}
                </span>
              ))}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="text-slate-600 border-slate-200 hover:bg-slate-50 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-700"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!canPostSocials || isUploading || !content.trim()}
              className="bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-700 dark:hover:bg-blue-800"
            >
              {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Post'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};