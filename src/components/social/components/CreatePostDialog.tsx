// Fixed CreatePostDialog.tsx
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../ui/dialog';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Textarea } from '../../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { X, Loader2 } from 'lucide-react';
import { SocialUserWithDetails } from '../../../integrations/supabase/socialTypes';
import { Privacy } from '../types/social';

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
  groupId
}) => {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      onFilesChange(Array.from(e.target.files));
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-slate-800 dark:text-gray-200">Create Post</DialogTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="absolute right-4 top-4 text-slate-600 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-gray-700"
          >
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>
        <div className="space-y-4 p-6">
          <Textarea
            value={content}
            onChange={(e) => onContentChange(e.target.value)}
            placeholder="What's on your mind?"
            className="bg-white dark:bg-gray-700 text-slate-800 dark:text-gray-200 border-slate-200 dark:border-gray-600"
            rows={5}
          />
          <Select value={privacy} onValueChange={onPrivacyChange}>
            <SelectTrigger className="bg-white dark:bg-gray-700 text-slate-800 dark:text-gray-200 border-slate-200 dark:border-gray-600">
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
            className="bg-white dark:bg-gray-700 text-slate-800 dark:text-gray-300 border-slate-200 dark:border-gray-600"
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
              onClick={onSubmit}
              disabled={isUploading || !content.trim()}
              className="bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800"
            >
              {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Post'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};