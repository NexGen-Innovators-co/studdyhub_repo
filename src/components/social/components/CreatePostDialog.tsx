// Fixed CreatePostDialog.tsx
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../ui/dialog';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Textarea } from '../../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { X, Loader2, Lock } from 'lucide-react';
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

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-slate-800 dark:text-gray-200">Create Post</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 p-6">
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
          <Textarea
            value={content}
            onChange={(e) => onContentChange(e.target.value)}
            placeholder="What's on your mind?"
            disabled={!canPostSocials || isUploading}
            className="bg-white dark:bg-gray-700 text-slate-800 dark:text-gray-200 border-slate-200 dark:border-gray-600 disabled:opacity-50"
            rows={5}
          />

          {metadata?.type === 'podcast' && (
            <div className="p-3 border border-slate-200 dark:border-gray-700 rounded-lg bg-slate-50 dark:bg-gray-900/50 flex gap-3">
              {metadata.coverUrl && (
                <img 
                  src={metadata.coverUrl} 
                  alt={metadata.title} 
                  className="w-16 h-16 rounded object-cover flex-shrink-0"
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 dark:text-gray-100 truncate">
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