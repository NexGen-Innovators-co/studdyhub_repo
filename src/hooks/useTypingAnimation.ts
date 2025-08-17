import { useState, useEffect, useRef } from 'react';

interface UseTypingAnimationProps {
  text: string;
  messageId: string;
  wordsPerSecond?: number;
  enabled?: boolean;
  onComplete?: (messageId: string) => void;
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
  content: string; // Full block including fences
  innerContent: string; // Content without fences
  language?: string;
  isFirstBlock: boolean;
  blockIndex: number; // New property to track block index
}

export const useTypingAnimation = ({
  text,
  messageId,
  wordsPerSecond = 21,
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
  const timeoutRef = useRef<NodeJS.Timeout>();
  const wordsRef = useRef<string[]>([]);
  const indexRef = useRef(0);
  const detectedBlocksRef = useRef<Set<string>>(new Set());

  const detectBlocks = (text: string): CodeBlock[] => {
    const blocks: CodeBlock[] = [];
    let blockIndex = 0;
    
    const codeBlockRegex = /```([a-z]*)\n([\s\S]*?)\n```/gi;
    let match;
    while ((match = codeBlockRegex.exec(text)) !== null) {
      const language = match[1] || 'text';
      const innerContent = match[2]; // Content between ```language and ```
      const fullContent = match[0]; // Full block including fences
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
  };

  useEffect(() => {
    if (!enabled || isAlreadyComplete) {
      setDisplayedText(text);
      setIsTyping(false);
      return;
    }

    const blocks = detectBlocks(text);
    const words = text.split(/(\s+)/);
    wordsRef.current = words;

    setDisplayedText('');
    setBlockText('');
    setIsTyping(true);
    indexRef.current = 0;
    setCurrentBlock(null);
    detectedBlocksRef.current.clear();

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    const typeNextWord = () => {
      if (indexRef.current >= words.length) {
        setIsTyping(false);
        setCurrentBlock(null);
        setBlockText('');
        onComplete?.(messageId);
        return;
      }

      const currentPosition = words.slice(0, indexRef.current).join('').length;
      const enteringBlock = blocks.find(block =>
        currentPosition >= block.start &&
        currentPosition < block.end &&
        !detectedBlocksRef.current.has(`${block.start}-${block.end}`)
      );

      if (enteringBlock) {
        detectedBlocksRef.current.add(`${enteringBlock.start}-${enteringBlock.end}`);
        setCurrentBlock(enteringBlock);
        
        // Only call onBlockDetected if autoTypeInPanel is true and it's the first block
        if (enteringBlock.isFirstBlock && autoTypeInPanel && onBlockDetected) {
            onBlockDetected(enteringBlock.type, enteringBlock.innerContent, enteringBlock.language, enteringBlock.isFirstBlock, enteringBlock.blockIndex);
        }

        // Always display placeholder in main text area for all blocks IF autoTypeInPanel is true
        if (autoTypeInPanel) {
          setDisplayedText(prev => prev + '\n[Code block displayed in panel...]\n');
        }
        
        if (enteringBlock.isFirstBlock && autoTypeInPanel) {
          // Send entire block content to panel at once for first block
          if (onBlockUpdate) {
            onBlockUpdate(enteringBlock.type, enteringBlock.innerContent, enteringBlock.language, enteringBlock.isFirstBlock, enteringBlock.blockIndex);
          }
          if (onBlockEnd) {
            onBlockEnd(enteringBlock.type, enteringBlock.innerContent, enteringBlock.language, enteringBlock.isFirstBlock, enteringBlock.blockIndex);
          }
          // Skip to the end of the block
          const blockEndPosition = enteringBlock.end;
          let charsSoFar = words.slice(0, indexRef.current).join('').length; // Re-calculate current position
          let i = indexRef.current;
          while (i < words.length && charsSoFar < blockEndPosition) {
            charsSoFar += words[i].length;
            i++;
          }
          indexRef.current = i;
          setCurrentBlock(null); // Clear current block after processing
          setBlockText(''); // Clear blockText
          timeoutRef.current = setTimeout(typeNextWord, 50); // Move quickly past the block
          return; // Skip remaining word processing for this iteration
        }
      }

      const nextWord = words[indexRef.current];

      // Determine where the typing should happen
      if (currentBlock && !autoTypeInPanel) {
        // Type block content in main text area if not in panel
        setBlockText(prev => {
          const newText = prev + nextWord;
          // Only call onBlockUpdate if autoTypeInPanel is false
          if (onBlockUpdate) {
            onBlockUpdate(currentBlock.type, newText, currentBlock.language, currentBlock.isFirstBlock, currentBlock.blockIndex);
          }
          return newText;
        });
        const newPosition = words.slice(0, indexRef.current + 1).join('').length;
        if (newPosition >= (currentBlock?.end || 0)) {
          // Only call onBlockEnd if autoTypeInPanel is false
          if (onBlockEnd) {
            onBlockEnd(currentBlock.type, blockText + nextWord, currentBlock.language, currentBlock.isFirstBlock, currentBlock.blockIndex);
          }
          setCurrentBlock(null);
          setBlockText('');
        }
      } else {
        // Type non-block content in main text area, or if it's a block but autoTypeInPanel is true (handled by the if-block above)
        setDisplayedText(prev => prev + nextWord);
      }

      indexRef.current++;

      const isActualWord = nextWord?.trim().length > 0;
      const delay = isActualWord ? 1000 / wordsPerSecond : 50;

      timeoutRef.current = setTimeout(typeNextWord, delay);
    };

    timeoutRef.current = setTimeout(typeNextWord, 200);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [text, messageId, wordsPerSecond, enabled, onComplete, isAlreadyComplete, onBlockDetected, onBlockUpdate, onBlockEnd, autoTypeInPanel]);

  return {
    displayedText,
    isTyping,
    currentBlock,
    blockText
  };
};
