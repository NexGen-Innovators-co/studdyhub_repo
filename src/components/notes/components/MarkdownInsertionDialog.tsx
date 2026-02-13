import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../../ui/dialog';
import { Button } from '../../ui/button';
import { Textarea } from '../../ui/textarea';
import { FilePlus, Sparkles } from 'lucide-react';

interface MarkdownInsertionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (markdown: string) => void;
}

export const MarkdownInsertionDialog: React.FC<MarkdownInsertionDialogProps> = ({
  isOpen,
  onClose,
  onInsert,
}) => {
  const [markdown, setMarkdown] = useState('');

  const handleInsert = () => {
    if (markdown.trim()) {
      onInsert(markdown);
      setMarkdown('');
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
            <FilePlus className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            Insert Markdown Code
          </DialogTitle>
        </DialogHeader>
        
        <div className="py-4">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Paste your Markdown formatted text below. It will be automatically converted to rich text.
          </p>
          <Textarea
            value={markdown}
            onChange={(e) => setMarkdown(e.target.value)}
            placeholder="# Heading 1\n\n- List item 1\n- List item 2\n\n**Bold text**"
            className="min-h-[300px] font-mono text-sm bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 focus:ring-orange-500"
          />
        </div>

        <DialogFooter className="flex gap-2">
          <Button
            variant="ghost"
            onClick={onClose}
            className="text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            Cancel
          </Button>
          <Button
            onClick={handleInsert}
            disabled={!markdown.trim()}
            className="bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-700 hover:to-orange-600 text-white shadow-md"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Insert & Format
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
