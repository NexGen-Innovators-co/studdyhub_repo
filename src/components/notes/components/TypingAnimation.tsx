// hooks/useTypingAnimation.ts
import { useCallback, useRef, useState } from 'react';
import { getTextareaCaretCoordinates } from '../utils/textareaUtils';

interface UseTypingAnimationProps {
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  setContent: (content: string) => void;
  onTypingComplete?: () => void;
}

export const useTypingAnimation = ({ textareaRef, setContent, onTypingComplete }: UseTypingAnimationProps) => {
  const typingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [currentTypingPosition, setCurrentTypingPosition] = useState<number>(0);
  const [isTypingActive, setIsTypingActive] = useState<boolean>(false);
  const typingStartPositionRef = useRef<number>(0);
  const totalContentLengthRef = useRef<number>(0);

  // Enhanced typing animation with smooth cursor positioning (now in word chunks)
  const startTypingAnimation = useCallback((generatedContent: string, startPosition: number) => {
    // //console.log('Starting typing animation:', { contentLength: generatedContent.length, startPosition });

    // Validate inputs
    if (!generatedContent || generatedContent.length === 0) {
      //console.warn('No content to type');
      onTypingComplete?.();
      return;
    }

    // Split content into words, keeping spaces for accurate insertion
    const words = generatedContent.match(/\S+|\s+/g) || [];
    let wordIndex = 0;
    let currentContentLength = startPosition;

    setCurrentTypingPosition(startPosition);
    setIsTypingActive(true);
    typingStartPositionRef.current = startPosition;
    totalContentLengthRef.current = generatedContent.length;

    // Clear any existing interval
    if (typingIntervalRef.current) {
      clearInterval(typingIntervalRef.current);
    }

    typingIntervalRef.current = setInterval(() => {
      if (wordIndex < words.length && textareaRef.current) {
        let chunkToType = '';
        const wordsPerChunk = 2; // Number of words to type per interval for a "chunk" effect

        // Append a chunk of words
        for (let i = 0; i < wordsPerChunk && wordIndex < words.length; i++) {
          chunkToType += words[wordIndex];
          wordIndex++;
        }

        const currentContentValue = textareaRef.current.value || '';
        const newContent =
          currentContentValue.substring(0, currentContentLength) +
          chunkToType +
          currentContentValue.substring(currentContentLength);

        setContent(newContent);
        currentContentLength += chunkToType.length; // Update for next insertion
        setCurrentTypingPosition(currentContentLength);

        // Update cursor position in textarea
        textareaRef.current.setSelectionRange(currentContentLength, currentContentLength);

        // Smart scroll to keep cursor visible
        try {
          const textarea = textareaRef.current;
          const coords = getTextareaCaretCoordinates(textarea, currentContentLength);
          const textareaRect = textarea.getBoundingClientRect();

          if (coords.top < textarea.scrollTop + 50) {
            textarea.scrollTop = coords.top - 50;
          } else if (coords.top > textarea.scrollTop + textareaRect.height - 100) {
            textarea.scrollTop = coords.top - textareaRect.height + 100;
          }
        } catch (error) {
          // Ignore scrolling errors
        }

        // //console.log(`Typed ${chunkToType.length} chars, progress: ${wordIndex}/${words.length} words`);
      } else {
        // Typing complete
        // //console.log('Typing animation completed');
        setIsTypingActive(false);

        if (typingIntervalRef.current) {
          clearInterval(typingIntervalRef.current);
          typingIntervalRef.current = null;
        }

        // Call completion callback
        onTypingComplete?.();
      }
    }, 50); // Adjusted timing for better visibility (50ms per chunk)
  }, [setContent, textareaRef, onTypingComplete]);

  const stopTypingAnimation = useCallback(() => {
    // //console.log('Stopping typing animation');

    if (typingIntervalRef.current) {
      clearInterval(typingIntervalRef.current);
      typingIntervalRef.current = null;
    }

    setIsTypingActive(false);
  }, []);

  // Get the progress of typing animation
  const getTypingProgress = useCallback(() => {
    if (!isTypingActive || totalContentLengthRef.current === 0) {
      return { progress: 0, isComplete: true };
    }

    const typedLength = currentTypingPosition - typingStartPositionRef.current;
    const progress = Math.min(typedLength / totalContentLengthRef.current, 1);
    const isComplete = progress >= 1;

    return { progress, isComplete };
  }, [currentTypingPosition, isTypingActive]);

  return {
    startTypingAnimation,
    stopTypingAnimation,
    currentTypingPosition,
    isTypingActive,
    getTypingProgress,
    typingIntervalRef
  };
};