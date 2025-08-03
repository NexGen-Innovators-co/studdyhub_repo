// TypingAnimation.tsx - New component for typing effect
import React, { useState, useEffect, useCallback } from 'react';

interface TypingAnimationProps {
  text: string;
  speed?: number;
  onComplete?: () => void;
  className?: string;
  isActive?: boolean;
}

export const TypingAnimation: React.FC<TypingAnimationProps> = ({
  text,
  speed = 30,
  onComplete,
  className = '',
  isActive = true
}) => {
  const [displayedText, setDisplayedText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    if (!isActive || !text) {
      setDisplayedText(text);
      return;
    }

    setIsTyping(true);
    setCurrentIndex(0);
    setDisplayedText('');

    const timer = setInterval(() => {
      setCurrentIndex(prevIndex => {
        if (prevIndex >= text.length) {
          clearInterval(timer);
          setIsTyping(false);
          onComplete?.();
          return prevIndex;
        }

        const nextIndex = prevIndex + 1;
        setDisplayedText(text.slice(0, nextIndex));
        return nextIndex;
      });
    }, speed);

    return () => clearInterval(timer);
  }, [text, speed, onComplete, isActive]);

  return (
    <span className={className}>
      {displayedText}
      {isTyping && (
        <span className="inline-block w-0.5 h-4 bg-current ml-0.5 animate-pulse" />
      )}
    </span>
  );
};