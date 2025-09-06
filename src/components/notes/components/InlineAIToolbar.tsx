// components/InlineAIToolbar.tsx
import React from 'react';
import { Button } from '../../ui/button';
import { Sparkles, BookOpen, MessageSquare, Repeat, Lightbulb, Plus, Minus } from 'lucide-react';

interface InlineAIToolbarProps {
  onAction: (actionType: string) => void;
  position: { top: number; left: number };
  isVisible: boolean;
  isLoading: boolean;
}

export const InlineAIToolbar: React.FC<InlineAIToolbarProps> = ({
  onAction,
  position,
  isVisible,
  isLoading,
}) => {
  if (!isVisible) return null;

  const actions = [
    { type: 'expand', icon: <Plus className="h-3 w-3" />, label: 'Expand' },
    { type: 'summarize', icon: <Minus className="h-3 w-3" />, label: 'Summarize' },
    { type: 'rephrase', icon: <Repeat className="h-3 w-3" />, label: 'Rephrase' },
    { type: 'explain', icon: <BookOpen className="h-3 w-3" />, label: 'Explain' },
    { type: 'simplify', icon: <Lightbulb className="h-3 w-3" />, label: 'Simplify' },
    { type: 'elaborate', icon: <Sparkles className="h-3 w-3" />, label: 'Elaborate' },
    { type: 'example', icon: <MessageSquare className="h-3 w-3" />, label: 'Example' },
  ];

  return (
    <div
      className="inline-ai-toolbar absolute bg-gray-800 rounded-md shadow-lg p-1 flex flex-col gap-1 z-50 transition-opacity duration-200"
      style={{
        top: position.top,
        left: position.left,
        transform: 'translateX(-50%) translateY(-100%)', // Center horizontally and move up by its own height
      }}
      onMouseDown={(e) => e.preventDefault()} // Prevent default mousedown to keep textarea focused
    >
      {actions.map((action) => (
        <Button
          key={action.type}
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation(); // Stop click event from bubbling up
            onAction(action.type);
          }}
          disabled={isLoading}
          className="h-7 px-2 text-xs text-gray-200 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-start" // Align text to start
        >
          {action.icon}
          <span className="ml-1">{action.label}</span>
        </Button>
      ))}
    </div>
  );
};
