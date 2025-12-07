import { useState, useEffect, useRef, useCallback } from 'react';

interface UseTypingAnimationProps {
  text: string;
  messageId: string;
  wordsPerSecond?: number;
  enabled?: boolean;
  onComplete?: (messageId: string, duration: number, actualWPS: number) => void;
  isAlreadyComplete?: boolean;
  onBlockDetected?: (blockType: 'code' | 'mermaid' | 'html', content: string, language?: string, isFirstBlock?: boolean, blockIndex?: number) => void;
  onBlockUpdate?: (blockType: 'code' | 'mermaid' | 'html', content: string, language?: string, isFirstBlock?: boolean, blockIndex?: number) => void;
  onBlockEnd?: (blockType: 'code' | 'mermaid' | 'html', content: string, language?: string, isFirstBlock?: boolean, blockIndex?: number) => void;
  autoTypeInPanel?: boolean;
}

interface CodeBlock {
  type: 'code' | 'mermaid' | 'html';
  start: number;
  end: number;
  content: string;
  innerContent: string;
  language?: string;
  isFirstBlock: boolean;
  blockIndex: number;
  lastUpdate?: number; // Added for batch updates
}

// Memoized block detection function
const memoizedDetectBlocks = (() => {
  let lastText = '';
  let lastResult: CodeBlock[] = [];

  return (text: string): CodeBlock[] => {
    if (text === lastText) return lastResult;

    // Quick check for potential blocks
    const hasPotentialBlocks = /```|<[^>]+>[\s\S]*<\/[^>]+>|<[^>]+\/>/.test(text);
    if (!hasPotentialBlocks) {
      lastText = text;
      lastResult = [];
      return [];
    }

    const blocks: CodeBlock[] = [];
    let blockIndex = 0;

    // Combined regex for all block types
    const combinedRegex = /```(\w*)\n([\s\S]*?)\n```|(<[^>]+>[\s\S]*?<\/[^>]+>|<[^>]+\/>)/gi;
    let match;

    while ((match = combinedRegex.exec(text)) !== null) {
      const fullContent = match[0];
      const start = match.index;
      const end = start + fullContent.length;

      if (fullContent.startsWith('```')) {
        const language = match[1] || 'text';
        const innerContent = match[2];

        if (language === 'mermaid' || language === 'mmd') {
          blocks.push({
            type: 'mermaid',
            start,
            end,
            content: fullContent,
            innerContent,
            isFirstBlock: blockIndex === 0,
            blockIndex
          });
        } else {
          blocks.push({
            type: 'code',
            start,
            end,
            content: fullContent,
            innerContent,
            language,
            isFirstBlock: blockIndex === 0,
            blockIndex
          });
        }
        blockIndex++;
      } else if (fullContent.length > 20 && /^<[^>]+>[\s\S]*<\/[^>]+>|<[^>]+\/>$/.test(fullContent)) {
        blocks.push({
          type: 'html',
          start,
          end,
          content: fullContent,
          innerContent: fullContent,
          isFirstBlock: blockIndex === 0,
          blockIndex
        });
        blockIndex++;
      }
    }

    lastText = text;
    lastResult = blocks.sort((a, b) => a.start - b.start);
    return lastResult;
  };
})();

export const useTypingAnimation = ({
  text,
  messageId,
  wordsPerSecond = 5,
  enabled = true,
  onComplete,
  isAlreadyComplete = false,
  onBlockDetected,
  onBlockUpdate,
  onBlockEnd,
  autoTypeInPanel = false
}: UseTypingAnimationProps) => {
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [currentBlock, setCurrentBlock] = useState<CodeBlock | null>(null);
  const [blockText, setBlockText] = useState('');
  const timeoutRef = useRef<number>();
  const wordsRef = useRef<string[]>([]);
  const indexRef = useRef(0);
  const detectedBlocksRef = useRef<Set<string>>(new Set());
  const blocksRef = useRef<CodeBlock[]>([]);
  const typingStartTimeRef = useRef<number | null>(null);
  const durationRef = useRef<number>(0);
  const isPanelInitializingRef = useRef(false);
  const blockStartIndexRef = useRef<number>(-1);
  const blockUpdateTimerRef = useRef<number>();

  const onBlockDetectedRef = useRef(onBlockDetected);
  const onBlockUpdateRef = useRef(onBlockUpdate);
  const onBlockEndRef = useRef(onBlockEnd);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onBlockDetectedRef.current = onBlockDetected;
    onBlockUpdateRef.current = onBlockUpdate;
    onBlockEndRef.current = onBlockEnd;
    onCompleteRef.current = onComplete;
  }, [onBlockDetected, onBlockUpdate, onBlockEnd, onComplete]);

  const detectBlocks = useCallback(
    (text: string): CodeBlock[] => {
      return memoizedDetectBlocks(text);
    },
    []
  );

  useEffect(() => {
    if (!enabled || isAlreadyComplete) {
      setDisplayedText(text);
      setIsTyping(false);
      return;
    }

    // Skip expensive operations if possible
    const shouldSkipDetection = text.length < 100 || (!text.includes('```') && !text.includes('<'));

    const blocks = shouldSkipDetection ? [] : detectBlocks(text);
    blocksRef.current = blocks;

    const words = text.split(/(\s+)/);
    wordsRef.current = words;

    setDisplayedText('');
    setBlockText('');
    setIsTyping(true);
    indexRef.current = 0;
    setCurrentBlock(null);
    detectedBlocksRef.current.clear();
    typingStartTimeRef.current = performance.now();
    durationRef.current = 0;
    isPanelInitializingRef.current = false;
    blockStartIndexRef.current = -1;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (blockUpdateTimerRef.current) {
      clearTimeout(blockUpdateTimerRef.current);
    }

    const typeNextWord = () => {
      if (indexRef.current >= words.length) {
        setIsTyping(false);
        setCurrentBlock(null);
        setBlockText('');
        const endTime = performance.now();
        durationRef.current = endTime - (typingStartTimeRef.current || endTime);
        const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
        const actualWPS = wordCount / (durationRef.current / 1000);
        onCompleteRef.current?.(messageId, durationRef.current, actualWPS);
        return;
      }

      const currentPosition = words.slice(0, indexRef.current).join('').length;
      const nextWord = words[indexRef.current];
      const nextPosition = currentPosition + (nextWord?.length || 0);

      // Check if we're about to enter a block
      const upcomingBlock = blocksRef.current.find(block =>
        currentPosition < block.start &&
        nextPosition >= block.start &&
        !detectedBlocksRef.current.has(`${block.start}-${block.end}`)
      );

      if (upcomingBlock) {
        detectedBlocksRef.current.add(`${upcomingBlock.start}-${upcomingBlock.end}`);
        setCurrentBlock(upcomingBlock);
        blockStartIndexRef.current = indexRef.current;

        if (upcomingBlock.isFirstBlock && autoTypeInPanel && onBlockDetectedRef.current) {
          isPanelInitializingRef.current = true;
          onBlockDetectedRef.current(
            upcomingBlock.type,
            '',
            upcomingBlock.language,
            upcomingBlock.isFirstBlock,
            upcomingBlock.blockIndex
          );

          setTimeout(() => {
            isPanelInitializingRef.current = false;
          }, 100); // Reduced from 150ms
        }

        timeoutRef.current = window.setTimeout(typeNextWord, 30);
        return;
      }

      const isActualWord = nextWord?.trim().length > 0;

      // Check if we're inside a block
      const isInCodeBlock = currentBlock &&
        blockStartIndexRef.current >= 0 &&
        indexRef.current >= blockStartIndexRef.current &&
        currentPosition < currentBlock.end &&
        autoTypeInPanel;

      // FAST PATH FOR CODE BLOCKS
      if (isInCodeBlock && currentBlock) {
        // Process multiple words at once for faster typing
        const remainingWordsInBlock = Math.min(
          autoTypeInPanel ? 10 : 3, // More words for panel typing
          words.length - indexRef.current
        );

        let wordsToAdd = '';
        for (let i = 0; i < remainingWordsInBlock; i++) {
          if (indexRef.current + i >= words.length) break;
          wordsToAdd += words[indexRef.current + i];
        }

        setBlockText(prev => {
          const newText = prev + wordsToAdd;

          // Batch updates - only send updates every 30ms
          const now = Date.now();
          if (!currentBlock.lastUpdate || now - currentBlock.lastUpdate > 30) {
            if (blockUpdateTimerRef.current) {
              clearTimeout(blockUpdateTimerRef.current);
            }

            blockUpdateTimerRef.current = window.setTimeout(() => {
              if (onBlockUpdateRef.current && currentBlock.isFirstBlock) {
                onBlockUpdateRef.current(
                  currentBlock.type,
                  newText,
                  currentBlock.language,
                  currentBlock.isFirstBlock,
                  currentBlock.blockIndex
                );
              }
            }, 30);
          }

          return newText;
        });

        indexRef.current += remainingWordsInBlock;

        // Check if we've reached the end of the block
        const newPosition = words.slice(0, indexRef.current).join('').length;
        if (newPosition >= currentBlock.end) {
          if (onBlockEndRef.current && currentBlock.isFirstBlock) {
            const finalContent = blockText + wordsToAdd;
            onBlockEndRef.current(
              currentBlock.type,
              finalContent,
              currentBlock.language,
              currentBlock.isFirstBlock,
              currentBlock.blockIndex
            );
          }
          setCurrentBlock(null);
          setBlockText('');
          blockStartIndexRef.current = -1;
        }

        // ULTRA-FAST TYPING for code blocks
        timeoutRef.current = window.setTimeout(typeNextWord, autoTypeInPanel ? 2 : 10);
        return;
      }

      // Normal text typing (not in code block)
      setDisplayedText(prev => prev + nextWord);
      indexRef.current++;

      // Calculate delay - optimized for performance
      let delay;
      if (isInCodeBlock) {
        // Code blocks type extremely fast
        delay = 2;
      } else {
        // Normal text
        delay = isActualWord ? (500 / (wordsPerSecond * 3)) : 5;
      }

      timeoutRef.current = window.setTimeout(typeNextWord, delay);
    };

    // Start faster
    timeoutRef.current = window.setTimeout(typeNextWord, 50);

    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
      if (blockUpdateTimerRef.current) {
        clearTimeout(blockUpdateTimerRef.current);
      }
    };
  }, [text, messageId, wordsPerSecond, enabled, isAlreadyComplete, autoTypeInPanel, detectBlocks]);

  return {
    displayedText,
    isTyping,
    currentBlock,
    blockText
  };
};