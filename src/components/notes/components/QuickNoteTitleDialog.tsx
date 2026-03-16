import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../../ui/dialog';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Badge } from '../../ui/badge';
import { NoteCategory } from '../../../types/Note';
import { Sparkles } from 'lucide-react';

interface QuickNoteTitleDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (title: string, category: NoteCategory) => void;
  templateName?: string; // If coming from template picker
}

const SUGGESTED_CATEGORIES = [
  'General',
  'Math',
  'Science',
  'History',
  'Language',
  'Biology',
  'Chemistry',
  'Physics',
  'Literature',
  'Philosophy',
];

export const QuickNoteTitleDialog: React.FC<QuickNoteTitleDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  templateName,
}) => {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('General');

  const handleConfirm = () => {
    if (title.trim() && category.trim()) {
      onConfirm(title, category);
      setTitle('');
      setCategory('General');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && title.trim() && category.trim()) {
      handleConfirm();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        onClose();
      }
    }}>
      <DialogContent className="sm:max-w-md bg-white dark:bg-gray-900">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            {templateName ? `Create ${templateName}` : 'Create New Note'}
          </DialogTitle>
          <DialogDescription>
            {templateName
              ? `Set a title for your ${templateName.toLowerCase()}`
              : 'Give your note a meaningful title'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="note-title">Note Title *</Label>
            <Input
              id="note-title"
              placeholder={
                templateName || 'e.g., Biology Lecture - Chapter 3'
              }
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyPress={handleKeyPress}
              autoFocus
              className="bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 focus:ring-blue-500"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Category *</Label>
            <Input
              id="category"
              placeholder="e.g., Biology, Physics, or create your own..."
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              onKeyPress={handleKeyPress}
              className="bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 focus:ring-blue-500"
            />
            <div className="pt-2">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Suggested categories:</p>
              <div className="flex flex-wrap gap-2">
                {SUGGESTED_CATEGORIES.map((cat) => (
                  <Badge
                    key={cat}
                    onClick={() => setCategory(cat)}
                    className="cursor-pointer hover:opacity-80 transition-opacity bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300"
                  >
                    {cat}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose} className="text-gray-600 dark:text-gray-400">
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!title.trim() || !category.trim()}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            Create Note
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
