// hooks/useTypingAnimation.ts
import { useState, useEffect, useRef } from 'react';

interface UseTypingAnimationProps {
  text: string;
  messageId: string;
  wordsPerSecond?: number; // words per second instead of characters
  enabled?: boolean;
  onComplete?: (messageId: string) => void;
  isAlreadyComplete?: boolean;
}

export const useTypingAnimation = ({ 
  text, 
  messageId,
  wordsPerSecond = 8, // Default: 8 words per second (quite fast but readable)
  enabled = true, 
  onComplete,
  isAlreadyComplete = false
}: UseTypingAnimationProps) => {
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout>();
  const wordsRef = useRef<string[]>([]);
  const indexRef = useRef(0);

  useEffect(() => {
    if (!enabled || isAlreadyComplete) {
      setDisplayedText(text);
      setIsTyping(false);
      return;
    }

    // Split text into words (preserving spaces and line breaks)
    const words = text.split(/(\s+)/);
    wordsRef.current = words;

    // Reset state when text changes
    setDisplayedText('');
    setIsTyping(true);
    indexRef.current = 0;

    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    const typeNextWord = () => {
      if (indexRef.current < words.length) {
        // Add the next word (or space/newline) to displayed text
        setDisplayedText(prev => prev + words[indexRef.current]);
        indexRef.current++;
        
        // Calculate delay based on words per second
        // Only count actual words (not spaces) for timing
        const isActualWord = words[indexRef.current - 1]?.trim().length > 0;
        const delay = isActualWord ? 1000 / wordsPerSecond : 50; // Fast for spaces/newlines
        
        timeoutRef.current = setTimeout(typeNextWord, delay);
      } else {
        setIsTyping(false);
        onComplete?.(messageId);
      }
    };

    // Start typing after a small delay
    timeoutRef.current = setTimeout(typeNextWord, 200);

    // Cleanup function
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [text, messageId, wordsPerSecond, enabled, onComplete, isAlreadyComplete]);

  // Function to skip animation and show full text
  const skipAnimation = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setDisplayedText(text);
    setIsTyping(false);
    onComplete?.(messageId);
  };

  return {
    displayedText,
    isTyping,
    skipAnimation
  };
};