// components/AISuggestionsPopup.tsx
import React from 'react';
import { createPortal } from 'react-dom';
import { Lightbulb } from 'lucide-react';
import { AISuggestion } from '../constants/aiSuggestions';

interface AISuggestionsPopupProps {
  isVisible: boolean;
  position: { top: number; left: number };
  suggestions: AISuggestion[];
  onSuggestionClick: (suggestion: AISuggestion) => void;
}

export const AISuggestionsPopup: React.FC<AISuggestionsPopupProps> = ({
  isVisible,
  position,
  suggestions,
  onSuggestionClick,
}) => {
  if (!isVisible) return null;

  return createPortal(
    <div 
      className="fixed z-50 bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 p-2 min-w-[200px]"
      style={{
        top: position.top,
        left: position.left,
        transform: 'translateX(-50%)'
      }}
    >
      <div className="flex items-center space-x-2 px-2 py-1 mb-2 bg-blue-50 dark:from-blue-900 dark:to-purple-900 rounded">
        <Lightbulb className="w-5 h-5 text-yellow-500" />
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">AI Suggestions</span>
      </div>
      {suggestions.map((suggestion) => (
        <button
          key={suggestion.id}
          onClick={() => onSuggestionClick(suggestion)}
          className="w-full text-left px-3 py-2 text-sm rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group flex items-center space-x-3"
        >
          <span className="text-xl">{suggestion.icon}</span>
          <div className="flex-1">
            <div className="font-medium text-gray-900 dark:text-gray-100 text-sm">{suggestion.label}</div>
            <div className="text-gray-600 dark:text-gray-400 text-xs">{suggestion.description}</div>
          </div>
        </button>
      ))}
    </div>,
    document.body
  );
};