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
  Lock
} from 'lucide-react';
import { toast } from 'sonner';
import { useFeatureAccess } from '../../../hooks/useFeatureAccess';
import { useNavigate } from 'react-router-dom';
import { Alert, AlertDescription } from '../../ui/alert';

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
  const { canChat } = useFeatureAccess();
  const canChatAccess = canChat();
  const navigate = useNavigate();

  const handleSend = async () => {
    if (!canChatAccess) {
      toast.error('Messaging requires Scholar plan or higher', {
        action: {
          label: 'Upgrade',
          onClick: () => navigate('/subscription')
        },
        duration: 5000
      });
      return;
    }

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
      {!canChatAccess && (
        <Alert className="mb-3 bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800">
          <Lock className="h-4 w-4 text-orange-600 dark:text-orange-400" />
          <AlertDescription className="text-orange-800 dark:text-orange-200">
            Messaging requires Scholar or Genius plan. 
            <Button 
              variant="link" 
              className="text-orange-600 dark:text-orange-400 p-0 h-auto ml-1"
              onClick={() => navigate('/subscription')}
            >
              Upgrade now
            </Button>
          </AlertDescription>
        </Alert>
      )}
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
                className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
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
            placeholder={canChatAccess ? "Type a message..." : "Messaging is available with Scholar+ plan"}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            className="min-h-[44px] max-h-[120px] resize-none pr-12 disabled:opacity-50"
            disabled={!canChatAccess || isSending}
          />
          
          {/* Emoji button (placeholder) */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-2 bottom-2 h-8 w-8"
            disabled={!canChatAccess || isSending}
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
            disabled={!canChatAccess}
            className="hidden"
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            disabled={!canChatAccess || isSending}
            title="Attach file"
          >
            <Paperclip className="h-5 w-5" />
          </Button>

          {/* Share resources */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onShareNote}
            disabled={!canChatAccess || isSending}
            title="Share resources (notes, documents, recordings)"
          >
            <StickyNote className="h-5 w-5" />
          </Button>

          {/* Send button */}
          <Button
            onClick={handleSend}
            disabled={!canChatAccess || isSending || (!message.trim() && selectedFiles.length === 0)}
            className="rounded-full h-10 w-10 p-0"
          >
            <Send className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
};