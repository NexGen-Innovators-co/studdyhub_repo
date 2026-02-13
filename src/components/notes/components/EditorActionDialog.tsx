import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../../ui/dialog';
import { Button } from '../../ui/button';
import { Textarea } from '../../ui/textarea';
import { Input } from '../../ui/input';
import { FilePlus, Link as LinkIcon, Image as ImageIcon, Sparkles, Sigma } from 'lucide-react';

export type EditorActionMode = 'markdown' | 'link' | 'image' | 'latex';

interface EditorActionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (value: string) => void;
  mode: EditorActionMode;
}

export const EditorActionDialog: React.FC<EditorActionDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  mode,
}) => {
  const [value, setValue] = useState('');

  // Reset value when dialog opens or mode changes
  useEffect(() => {
    if (isOpen) {
      setValue('');
    }
  }, [isOpen, mode]);

  const handleConfirm = () => {
    if (value.trim()) {
      onConfirm(value);
      onClose();
    }
  };

  const getDialogConfig = () => {
    switch (mode) {
      case 'markdown':
        return {
          title: 'Insert Markdown Code',
          icon: <FilePlus className="w-5 h-5 text-orange-600 dark:text-orange-400" />,
          description: 'Paste your Markdown formatted text below. It will be automatically converted to rich text.',
          placeholder: '# Heading 1\n\n- List item 1\n- List item 2\n\n**Bold text**',
          confirmText: 'Insert & Format',
          confirmIcon: <Sparkles className="w-4 h-4 mr-2" />,
          isTextArea: true
        };
      case 'link':
        return {
          title: 'Insert Link',
          icon: <LinkIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />,
          description: 'Enter the URL for the link.',
          placeholder: 'https://example.com',
          confirmText: 'Insert Link',
          confirmIcon: <LinkIcon className="w-4 h-4 mr-2" />,
          isTextArea: false
        };
      case 'image':
        return {
          title: 'Insert Image',
          icon: <ImageIcon className="w-5 h-5 text-green-600 dark:text-green-400" />,
          description: 'Enter the URL of the image you want to insert.',
          placeholder: 'https://example.com/image.jpg',
          confirmText: 'Insert Image',
          confirmIcon: <ImageIcon className="w-4 h-4 mr-2" />,
          isTextArea: false
        };
      case 'latex':
        return {
          title: 'Insert LaTeX Math',
          icon: <Sigma className="w-5 h-5 text-purple-600 dark:text-purple-400" />,
          description: 'Enter LaTeX code for mathematical equations.',
          placeholder: 'E = mc^2',
          confirmText: 'Insert Formula',
          confirmIcon: <Sigma className="w-4 h-4 mr-2" />,
          isTextArea: false
        };
      default:
        return {
          title: 'Input',
          icon: null,
          description: '',
          placeholder: '',
          confirmText: 'Submit',
          confirmIcon: null,
          isTextArea: false
        };
    }
  };

  const config = getDialogConfig();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
            {config.icon}
            {config.title}
          </DialogTitle>
        </DialogHeader>
        
        <div className="py-4">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            {config.description}
          </p>
          
          {config.isTextArea ? (
            <Textarea
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={config.placeholder}
              className="min-h-[300px] font-mono text-sm bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 focus:ring-orange-500"
              autoFocus
            />
          ) : (
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={config.placeholder}
              className="font-mono text-sm bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 focus:ring-blue-500"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleConfirm();
                }
              }}
            />
          )}
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
            onClick={handleConfirm}
            disabled={!value.trim()}
            className="bg-primary text-primary-foreground shadow-md"
          >
            {config.confirmIcon}
            {config.confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
