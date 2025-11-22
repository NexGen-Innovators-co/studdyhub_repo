// src/components/social/components/MessageInput.tsx
import React, { useState, useRef } from 'react';
import { Button } from '../../ui/button';
import { Textarea } from '../../ui/textarea';
import {
  Send,
  Paperclip,
  Image as ImageIcon,
  Smile,
  StickyNote,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

interface MessageInputProps {
  onSendMessage: (content: string, files?: File[]) => Promise<boolean>;
  onShareNote: () => void;
  isSending: boolean;
}

export const MessageInput: React.FC<MessageInputProps> = ({
  onSendMessage,
  onShareNote,
  isSending,
}) => {
  const [message, setMessage] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSend = async () => {
    if (!message.trim() && selectedFiles.length === 0) {
      return;
    }

    const success = await onSendMessage(message, selectedFiles);
    if (success) {
      setMessage('');
      setSelectedFiles([]);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    // Validate file sizes (max 10MB per file)
    const invalidFiles = files.filter((file) => file.size > 10 * 1024 * 1024);
    if (invalidFiles.length > 0) {
      toast.error('Some files exceed 10MB limit');
      return;
    }

    setSelectedFiles((prev) => [...prev, ...files]);
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="border-t border-slate-200 dark:border-slate-800 p-4">
      {/* File previews */}
      {selectedFiles.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {selectedFiles.map((file, index) => (
            <div
              key={index}
              className="relative group bg-slate-100 dark:bg-slate-800 rounded-lg p-2 pr-8"
            >
              <div className="flex items-center gap-2">
                {file.type.startsWith('image/') ? (
                  <img
                    src={URL.createObjectURL(file)}
                    alt={file.name}
                    className="h-12 w-12 object-cover rounded"
                  />
                ) : (
                  <div className="h-12 w-12 bg-slate-200 dark:bg-slate-700 rounded flex items-center justify-center">
                    <Paperclip className="h-5 w-5 text-slate-400" />
                  </div>
                )}
                <span className="text-xs text-slate-600 dark:text-slate-400 max-w-[100px] truncate">
                  {file.name}
                </span>
              </div>
              <button
                onClick={() => removeFile(index)}
                className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input area */}
      <div className="flex items-end gap-2">
        <div className="flex-1 relative">
          <Textarea
            placeholder="Type a message..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            className="min-h-[44px] max-h-[120px] resize-none pr-12"
            disabled={isSending}
          />
          
          {/* Emoji button (placeholder) */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-2 bottom-2 h-8 w-8"
            disabled={isSending}
          >
            <Smile className="h-5 w-5 text-slate-400" />
          </Button>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1">
          {/* File attachment */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,video/*,.pdf,.doc,.docx"
            onChange={handleFileSelect}
            className="hidden"
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            disabled={isSending}
            title="Attach file"
          >
            <Paperclip className="h-5 w-5" />
          </Button>

          {/* Share note */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onShareNote}
            disabled={isSending}
            title="Share note or document"
          >
            <StickyNote className="h-5 w-5" />
          </Button>

          {/* Send button */}
          <Button
            onClick={handleSend}
            disabled={isSending || (!message.trim() && selectedFiles.length === 0)}
            className="rounded-full h-10 w-10 p-0"
          >
            <Send className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
};