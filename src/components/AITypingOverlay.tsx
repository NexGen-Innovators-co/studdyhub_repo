// components/AITypingOverlay.tsx
import React from 'react';
import { Sparkles, Check, X } from 'lucide-react';
import { Button } from './ui/button';

interface AITypingOverlayProps {
  isTypingAI: boolean;
  typingComplete: boolean;
  isGeneratingAIInline: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

export const AITypingOverlay: React.FC<AITypingOverlayProps> = ({
  isTypingAI,
  typingComplete,
  isGeneratingAIInline,
  onAccept,
  onDecline,
}) => {
  if (!isTypingAI) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-2xl border border-gray-200 dark:border-gray-700 max-w-md w-full mx-4">
        <div className="flex items-center space-x-3 mb-4">
          <Sparkles className="w-7 h-7 text-blue-500 animate-pulse" />
          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">AI is typing...</h3>
        </div>
        <p className="text-gray-600 dark:text-gray-400 mb-6 text-base">
          {typingComplete ? 'Generation complete!' : 'Generating AI content for your note...'}
        </p>
        <div className="flex space-x-3">
          <Button
            onClick={onAccept}
            disabled={!typingComplete && !isGeneratingAIInline}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white"
          >
            <Check className="w-4 h-4 mr-2" />
            Accept
          </Button>
          <Button
            onClick={onDecline}
            variant="outline"
            className="flex-1 border-red-300 text-red-600 hover:bg-red-50 dark:border-red-600 dark:text-red-400 dark:hover:bg-red-950"
          >
            <X className="w-4 h-4 mr-2" />
            Decline
          </Button>
        </div>
      </div>
    </div>
  );
};