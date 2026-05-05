// Enhanced typing hook with block detection and panel auto-switching
import { useState, useEffect, useRef, useCallback } from 'react';

interface BlockInfo {
  type: 'code' | 'mermaid' | 'html';
  content: string;
  language?: string;
  startPos: number;
  endPos: number;
}

interface UseEnhancedTypingProps {
  text: string;
  messageId: string;
  wordsPerSecond?: number;
  enabled?: boolean;
  onComplete?: (messageId: string) => void;
  isAlreadyComplete?: boolean;
  onBlockEnter?: (block: BlockInfo) => void;
  onBlockExit?: (block: BlockInfo) => void;
}

export const useEnhancedTyping = ({
  text,
  messageId,
  wordsPerSecond = 21,
  enabled = true,
  onComplete,
  isAlreadyComplete = false,
  onBlockEnter,
  onBlockExit
}: UseEnhancedTypingProps) => {
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [currentBlock, setCurrentBlock] = useState<BlockInfo | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout>();
  const wordsRef = useRef<string[]>([]);
  const indexRef = useRef(0);
  const blocksRef = useRef<BlockInfo[]>([]);
  const processedBlocksRef = useRef<Set<string>>(new Set());

  // Detect blocks in text
  const detectBlocks = useCallback((text: string): BlockInfo[] => {
    const blocks: BlockInfo[] = [];
    
    // Code blocks with language
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    let match;
    while ((match = codeBlockRegex.exec(text)) !== null) {
      const language = match[1] || 'text';
      const isMermaid = language.toLowerCase() === 'mermaid' || language.toLowerCase() === 'mmd';
      
      blocks.push({
        type: isMermaid ? 'mermaid' : 'code',
        content: match[0],
        language,
        startPos: match.index,
        endPos: match.index + match[0].length
      });
    }

    // HTML blocks
    const htmlRegex = /<[^>]+[\s\S]*?<\/[^>]+>/g;
    let htmlMatch;
    while ((htmlMatch = htmlRegex.exec(text)) !== null) {
      if (htmlMatch[0].length > 20) { // Only substantial HTML
        blocks.push({
          type: 'html',
          content: htmlMatch[0],
          startPos: htmlMatch.index,
          endPos: htmlMatch.index + htmlMatch[0].length
        });
      }
    }

    return blocks.sort((a, b) => a.startPos - b.startPos);
  }, []);

  useEffect(() => {
    if (!enabled || isAlreadyComplete) {
      setDisplayedText(text);
      setIsTyping(false);
      return;
    }

    // Detect blocks
    const blocks = detectBlocks(text);
    blocksRef.current = blocks;
    
    // Split text into words
    const words = text.split(/(\s+)/);
    wordsRef.current = words;

    // Reset state
    setDisplayedText('');
    setIsTyping(true);
    indexRef.current = 0;
    setCurrentBlock(null);
    processedBlocksRef.current.clear();

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    const typeNextWord = () => {
      if (indexRef.current < words.length) {
        const newText = words.slice(0, indexRef.current + 1).join('');
        const currentPos = newText.length;
        
        // Check for block entrance/exit
        const enteringBlock = blocks.find(block => 
          currentPos >= block.startPos && 
          currentPos < block.endPos &&
          !processedBlocksRef.current.has(`enter-${block.startPos}`)
        );

        const exitingBlock = blocks.find(block => 
          currentPos >= block.endPos &&
          !processedBlocksRef.current.has(`exit-${block.startPos}`) &&
          processedBlocksRef.current.has(`enter-${block.startPos}`)
        );

        if (enteringBlock && onBlockEnter) {
          processedBlocksRef.current.add(`enter-${enteringBlock.startPos}`);
          setCurrentBlock(enteringBlock);
          onBlockEnter(enteringBlock);
        }

        if (exitingBlock && onBlockExit) {
          processedBlocksRef.current.add(`exit-${exitingBlock.startPos}`);
          setCurrentBlock(null);
          onBlockExit(exitingBlock);
        }

        setDisplayedText(newText);
        indexRef.current++;
        
        // Calculate delay
        const isActualWord = words[indexRef.current - 1]?.trim().length > 0;
        const delay = isActualWord ? 1000 / wordsPerSecond : 50;
        
        timeoutRef.current = setTimeout(typeNextWord, delay);
      } else {
        setIsTyping(false);
        setCurrentBlock(null);
        onComplete?.(messageId);
      }
    };

    timeoutRef.current = setTimeout(typeNextWord, 200);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [text, messageId, wordsPerSecond, enabled, onComplete, isAlreadyComplete, detectBlocks, onBlockEnter, onBlockExit]);

  return {
    displayedText,
    isTyping,
    currentBlock,
    blocks: blocksRef.current
  };
};