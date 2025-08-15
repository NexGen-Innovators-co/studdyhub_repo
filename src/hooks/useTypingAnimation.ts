// hooks/useTypingAnimation.ts
import { useState, useEffect, useRef } from 'react';

interface UseTypingAnimationProps {
  text: string;
  messageId: string;
  wordsPerSecond?: number;
  enabled?: boolean;
  onComplete?: (messageId: string) => void;
  isAlreadyComplete?: boolean;
  onBlockDetected?: (blockType: 'code' | 'mermaid' | 'html', content: string) => void;
}

interface CodeBlock {
  type: 'code' | 'mermaid' | 'html';
  start: number;
  end: number;
  content: string;
  language?: string;
}

export const useTypingAnimation = ({ 
  text, 
  messageId,
  wordsPerSecond = 21,
  enabled = true, 
  onComplete,
  isAlreadyComplete = false,
  onBlockDetected
}: UseTypingAnimationProps) => {
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [currentBlock, setCurrentBlock] = useState<CodeBlock | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout>();
  const wordsRef = useRef<string[]>([]);
  const indexRef = useRef(0);
  const detectedBlocksRef = useRef<Set<string>>(new Set());

  // Detect code blocks, mermaid diagrams, and HTML in text
  const detectBlocks = (text: string): CodeBlock[] => {
    const blocks: CodeBlock[] = [];
    
    // Code blocks ```language\ncontent\n```
    const codeBlockRegex = /```([a-z]*)\n([\s\S]*?)```/gi;
    let match;
    while ((match = codeBlockRegex.exec(text)) !== null) {
      blocks.push({
        type: 'code',
        start: match.index,
        end: match.index + match[0].length,
        content: match[0],
        language: match[1] || 'text'
      });
    }

    // Mermaid diagrams
    const mermaidRegex = /(```mermaid\n[\s\S]*?```|```mmd\n[\s\S]*?```)/gi;
    let mermaidMatch;
    while ((mermaidMatch = mermaidRegex.exec(text)) !== null) {
      blocks.push({
        type: 'mermaid',
        start: mermaidMatch.index,
        end: mermaidMatch.index + mermaidMatch[0].length,
        content: mermaidMatch[0]
      });
    }

    // HTML blocks
    const htmlRegex = /(<[^>]+>[\s\S]*?<\/[^>]+>|<[^>]+\/>)/gi;
    let htmlMatch;
    while ((htmlMatch = htmlRegex.exec(text)) !== null) {
      if (htmlMatch[0].length > 20) { // Only consider substantial HTML
        blocks.push({
          type: 'html',
          start: htmlMatch.index,
          end: htmlMatch.index + htmlMatch[0].length,
          content: htmlMatch[0]
        });
      }
    }

    return blocks.sort((a, b) => a.start - b.start);
  };

  useEffect(() => {
    if (!enabled || isAlreadyComplete) {
      setDisplayedText(text);
      setIsTyping(false);
      return;
    }

    // Detect blocks in the text
    const blocks = detectBlocks(text);
    
    // Split text into words (preserving spaces and line breaks)
    const words = text.split(/(\s+)/);
    wordsRef.current = words;

    // Reset state when text changes
    setDisplayedText('');
    setIsTyping(true);
    indexRef.current = 0;
    setCurrentBlock(null);
    detectedBlocksRef.current.clear();

    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    const typeNextWord = () => {
      if (indexRef.current < words.length) {
        const currentPosition = words.slice(0, indexRef.current + 1).join('').length;
        
        // Check if we're entering a code/mermaid/html block
        const enteringBlock = blocks.find(block => 
          currentPosition >= block.start && 
          currentPosition <= block.end &&
          !detectedBlocksRef.current.has(`${block.start}-${block.end}`)
        );

        if (enteringBlock && onBlockDetected) {
          detectedBlocksRef.current.add(`${enteringBlock.start}-${enteringBlock.end}`);
          setCurrentBlock(enteringBlock);
          onBlockDetected(enteringBlock.type, enteringBlock.content);
        }

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
        setCurrentBlock(null);
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
  }, [text, messageId, wordsPerSecond, enabled, onComplete, isAlreadyComplete, onBlockDetected]);

  return {
    displayedText,
    isTyping,
    currentBlock,
  };
};