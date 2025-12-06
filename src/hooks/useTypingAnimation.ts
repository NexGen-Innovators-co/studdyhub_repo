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
}

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

  // Store callbacks in refs to prevent re-renders
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
      const blocks: CodeBlock[] = [];
      let blockIndex = 0;

      const codeBlockRegex = /```([a-z]*)\n([\s\S]*?)\n```/gi;
      let match;
      while ((match = codeBlockRegex.exec(text)) !== null) {
        const language = match[1] || 'text';
        const innerContent = match[2];
        const fullContent = match[0];
        blocks.push({
          type: 'code',
          start: match.index,
          end: match.index + fullContent.length,
          content: fullContent,
          innerContent,
          language,
          isFirstBlock: blockIndex === 0,
          blockIndex
        });
        blockIndex++;
      }

      const mermaidRegex = /(```mermaid\n[\s\S]*?\n```|```mmd\n[\s\S]*?\n```)/gi;
      let mermaidMatch;
      while ((mermaidMatch = mermaidRegex.exec(text)) !== null) {
        const fullContent = mermaidMatch[0];
        const innerContent = fullContent.slice(fullContent.indexOf('\n') + 1, fullContent.lastIndexOf('\n```'));
        blocks.push({
          type: 'mermaid',
          start: mermaidMatch.index,
          end: mermaidMatch.index + fullContent.length,
          content: fullContent,
          innerContent,
          isFirstBlock: blockIndex === 0,
          blockIndex
        });
        blockIndex++;
      }

      const htmlRegex = /(<[^>]+>[\s\S]*?<\/[^>]+>|<[^>]+\/>)/gi;
      let htmlMatch;
      while ((htmlMatch = htmlRegex.exec(text)) !== null) {
        if (htmlMatch[0].length > 20) {
          const fullContent = htmlMatch[0];
          blocks.push({
            type: 'html',
            start: htmlMatch.index,
            end: htmlMatch.index + fullContent.length,
            content: fullContent,
            innerContent: fullContent,
            isFirstBlock: blockIndex === 0,
            blockIndex
          });
          blockIndex++;
        }
      }

      return blocks.sort((a, b) => a.start - b.start);
    },
    []
  );

  useEffect(() => {
    if (!enabled || isAlreadyComplete) {
      setDisplayedText(text);
      setIsTyping(false);
      return;
    }

    const blocks = detectBlocks(text);
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

    const typeNextWord = () => {
      {isTyping && (
        `<span className="inline-block w-5 h-3 bg-gray-600 dark:bg-gray-400 ml-0.5 animate-pulse" />`
      )}
      if (indexRef.current >= words.length) {
        //console.log('🏁 [useTypingAnimation] Typing completed for message:', messageId);
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
        // console.log('🚪 [useTypingAnimation] Block detected:', {
        //   type: upcomingBlock.type,
        //   language: upcomingBlock.language,
        //   isFirstBlock: upcomingBlock.isFirstBlock,
        //   autoTypeInPanel
        // });

        detectedBlocksRef.current.add(`${upcomingBlock.start}-${upcomingBlock.end}`);
        setCurrentBlock(upcomingBlock);
        blockStartIndexRef.current = indexRef.current;

        // For first block with autoTypeInPanel
        if (upcomingBlock.isFirstBlock && autoTypeInPanel && onBlockDetectedRef.current) {
          //console.log('🎯 [useTypingAnimation] Initializing panel with empty content');
          isPanelInitializingRef.current = true;

          // CRITICAL FIX: Call onBlockDetected with empty string first
          // The panel will show "Typing..." state
          onBlockDetectedRef.current(
            upcomingBlock.type,
            '', // Start with empty content
            upcomingBlock.language,
            upcomingBlock.isFirstBlock,
            upcomingBlock.blockIndex
          );

          // Wait for panel to initialize
          setTimeout(() => {
            console.log('▶️ [useTypingAnimation] Panel ready - starting content typing');
            isPanelInitializingRef.current = false;
          }, 150);

        }

        // Skip to next iteration
        timeoutRef.current = window.setTimeout(typeNextWord, 50);
        return;
      }

      const isActualWord = nextWord?.trim().length > 0;

      // Check if we're inside a block (must be after block start was detected)
      const isInCodeBlock = currentBlock &&
        blockStartIndexRef.current >= 0 &&
        indexRef.current >= blockStartIndexRef.current &&
        currentPosition < currentBlock.end &&
        autoTypeInPanel;

      if (isInCodeBlock && currentBlock) {
        // CRITICAL: Type in panel - accumulate ALL content including delimiters
        //console.log('📄 [useTypingAnimation] Typing in panel');

        setBlockText(prev => {
          const newText = prev + nextWord;

          // CRITICAL FIX: Always send updates to panel for first block
          // This includes the opening delimiter and all content
          if (onBlockUpdateRef.current && currentBlock.isFirstBlock) {
           
            onBlockUpdateRef.current(
              currentBlock.type,
              newText,
              currentBlock.language,
              currentBlock.isFirstBlock,
              currentBlock.blockIndex
            );
          }
          return newText;
        });

        // Check if we've reached the end of the block
        const newPosition = words.slice(0, indexRef.current + 1).join('').length;
        if (newPosition >= currentBlock.end) {
          //console.log('🏁 [useTypingAnimation] Block complete');
          if (onBlockEndRef.current && currentBlock.isFirstBlock) {
            const finalContent = blockText + nextWord;
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

        // Don't add to displayed text
        //console.log('⏭️ [useTypingAnimation] Skipping main chat display');

      } else {
        // Type in main text area
        //console.log('💬 [useTypingAnimation] Typing in main area');
        setDisplayedText(prev => prev + nextWord);
      }

      indexRef.current++;

      // Calculate delay - FASTER for code blocks, NATURAL for text
      let delay;
      if (isInCodeBlock) {
        // Code blocks type 3x faster than normal text
        delay = isActualWord ? (1000 / (wordsPerSecond * 7)) : 10;
      } else {
        // Normal text at natural speed
        delay = isActualWord ? (wordsPerSecond) : 20;
      }

      timeoutRef.current = window.setTimeout(typeNextWord, delay);
    };

    timeoutRef.current = window.setTimeout(typeNextWord, 100);

    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
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
