// hooks/useTypingAnimation.ts
import { useCallback, useRef, useState } from 'react';
import { getTextareaCaretCoordinates } from '../utils/textareaUtils';

interface UseTypingAnimationProps {
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  setContent: (content: string) => void;
}

export const useTypingAnimation = ({ textareaRef, setContent }: UseTypingAnimationProps) => {
  const typingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [currentTypingPosition, setCurrentTypingPosition] = useState<number>(0);

  // Enhanced typing animation with smooth cursor positioning (now in word chunks)
  const startTypingAnimation = useCallback((generatedContent: string, startPosition: number) => {
    // Split content into words, keeping spaces for accurate insertion
    const words = generatedContent.match(/\S+|\s+/g) || [];
    let wordIndex = 0;
    let currentContentLength = startPosition;

    setCurrentTypingPosition(startPosition);

    // Clear any existing interval
    if (typingIntervalRef.current) {
      clearInterval(typingIntervalRef.current);
    }

    typingIntervalRef.current = setInterval(() => {
      if (wordIndex < words.length) {
        let chunkToType = '';
        const wordsPerChunk = 2; // Number of words to type per interval for a "chunk" effect

        // Append a chunk of words
        for (let i = 0; i < wordsPerChunk && wordIndex < words.length; i++) {
          chunkToType += words[wordIndex];
          wordIndex++;
        }

        const currentContentValue = textareaRef.current?.value || '';
        const newContent = currentContentValue.substring(0, currentContentLength) + chunkToType + currentContentValue.substring(currentContentLength);
        
        setContent(newContent);
        currentContentLength += chunkToType.length; // Update for next insertion
        setCurrentTypingPosition(currentContentLength);

        // Update cursor position in textarea
        if (textareaRef.current) {
          textareaRef.current.setSelectionRange(currentContentLength, currentContentLength);
          
          // Smart scroll to keep cursor visible
          const textarea = textareaRef.current;
          const coords = getTextareaCaretCoordinates(textarea, currentContentLength);
          const textareaRect = textarea.getBoundingClientRect();
          
          if (coords.top < textarea.scrollTop + 50) {
            textarea.scrollTop = coords.top - 50;
          } else if (coords.top > textarea.scrollTop + textareaRect.height - 100) {
            textarea.scrollTop = coords.top - textareaRect.height + 100;
          }
        }
      } else {
        // Typing complete
        if (typingIntervalRef.current) {
          clearInterval(typingIntervalRef.current);
          typingIntervalRef.current = null;
        }
      }
    }, 5); // Slightly increased delay to make word chunks more noticeable, still very fast
  }, [setContent, textareaRef]);

  const stopTypingAnimation = useCallback(() => {
    if (typingIntervalRef.current) {
      clearInterval(typingIntervalRef.current);
      typingIntervalRef.current = null;
    }
  }, []);

  return {
    startTypingAnimation,
    stopTypingAnimation,
    currentTypingPosition,
    typingIntervalRef
  };
};