import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Lightbulb } from 'lucide-react';
import { AISuggestion } from '../../../constants/aiSuggestions';

interface AISuggestionsPopupProps {
  isVisible: boolean;
  position: { top: number; left: number };
  suggestions: AISuggestion[];
  onSuggestionClick: (suggestion: AISuggestion) => void;
  onClose: () => void;
}

export const AISuggestionsPopup: React.FC<AISuggestionsPopupProps> = ({
  isVisible,
  position,
  suggestions,
  onSuggestionClick,
  onClose,
}) => {
  const popupRef = useRef<HTMLDivElement>(null);

  // Handle click outside to close the popup
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isVisible) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    };
  }, [isVisible, onClose]);

  // Adjust position to stay within viewport
  useEffect(() => {
    if (!isVisible || !popupRef.current) return;

    const popup = popupRef.current;
    const rect = popup.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let adjustedLeft = position.left;
    if (rect.right > viewportWidth) {
      adjustedLeft = viewportWidth - rect.width - 5; // Reduced padding to 5px
    } else if (rect.left < 0) {
      adjustedLeft = 5; // Reduced padding to 5px
    }

    let adjustedTop = position.top;
    if (rect.bottom > viewportHeight && position.top > rect.height) {
      adjustedTop = position.top - rect.height - 5;
    } else if (rect.top < 0) {
      adjustedTop = 5;
    }

    popup.style.left = `${adjustedLeft}px`;
    popup.style.top = `${adjustedTop}px`;
  }, [isVisible, position]);

  if (!isVisible) return null;

  return createPortal(
    <div
      ref={popupRef}
      className="fixed max-w-20"
      style={{
        top: position.top,
        left: position.left,
      }}
    >
      <div className="flex items-center space-x-1 px-1 py-1 mb-1 bg-blue-50 dark:bg-blue-900/50 rounded">
        <Lightbulb className="w-3 h-3 sm:w-4 sm:h-4 text-yellow-500 dark:text-yellow-400" />
        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">AI Suggestions</span>
      </div>
      {suggestions.map((suggestion) => (
        <button
          key={suggestion.id}
          onClick={() => onSuggestionClick(suggestion)}
          className=""
        >
          <span className="text-base sm:text-lg">{suggestion.icon}</span>
          <div className="flex-1">
            <div className="font-medium text-gray-900 dark:text-gray-100 text-xs">{suggestion.label}</div>
            <div className="text-gray-600 dark:text-gray-400 text-xxs sm:text-xs">{suggestion.description}</div>
          </div>
        </button>
      ))}
    </div>,
    document.body
  );
};