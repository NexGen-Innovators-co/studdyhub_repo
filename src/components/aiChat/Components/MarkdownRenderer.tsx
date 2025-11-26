import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import { AlertTriangle, Copy, Check, Loader2, Maximize2, X, RefreshCw, ChevronDown, ChevronUp, Image, FileText, BookOpen, StickyNote, Sparkles } from 'lucide-react';
import { Button } from '../../ui/button';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { useCopyToClipboard } from '../../../hooks/useCopyToClipboard';
import { useTypingAnimation } from '../../../hooks/useTypingAnimation';
import { CodeBlock, CodeBlockErrorBoundary } from './CodeBlock';

interface MemoizedMarkdownRendererProps {
  content: string;
  messageId: string;
  isUserMessage?: boolean;
  onMermaidError: (code: string, errorType: 'syntax' | 'rendering' | 'timeout' | 'network') => void;
  onSuggestAiCorrection: (prompt: string) => void;
  onViewDiagram: (type: 'mermaid' | 'dot' | 'chartjs' | 'code' | 'image' | 'unknown' | 'document-text' | 'threejs' | 'html' | 'slides', content?: string, language?: string, imageUrl?: string) => void;
  onToggleUserMessageExpansion: (messageContent: string) => void;
  expandedMessages: Set<string>;
  enableTyping?: boolean;
  isLastMessage?: boolean;
  onTypingComplete?: (messageId: string) => void;
  isAlreadyTyped?: boolean;
  autoTypeInPanel?: boolean;
  onBlockDetected?: (blockType: 'code' | 'mermaid' | 'html' | 'slides', content: string, language?: string, isFirstBlock?: boolean) => void;
  onBlockUpdate?: (blockType: 'code' | 'mermaid' | 'html' | 'slides', content: string, language?: string, isFirstBlock?: boolean) => void;
  onBlockEnd?: (blockType: 'code' | 'mermaid' | 'html' | 'slides', content: string, language?: string, isFirstBlock?: boolean) => void;
  isDiagramPanelOpen: boolean;
  onDiagramCodeUpdate: (messageId: string, newCode: string) => Promise<void>;
}

// Define a separate memoized component for ReactMarkdown
const MemoizedReactMarkdown = memo(
  ({ content, components }: { content: string; components: any }) => {
    return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    );
  }
);

export const MemoizedMarkdownRenderer: React.FC<MemoizedMarkdownRendererProps> = memo(({
  content,
  messageId,
  isUserMessage,
  onMermaidError,
  onSuggestAiCorrection,
  onViewDiagram,
  onToggleUserMessageExpansion,
  expandedMessages,
  enableTyping = false,
  isLastMessage = false,
  onTypingComplete,
  isAlreadyTyped = false,
  autoTypeInPanel,
  onBlockDetected,
  onBlockUpdate,
  onBlockEnd,
  isDiagramPanelOpen,
  onDiagramCodeUpdate

}) => {
  const { displayedText, isTyping } = useTypingAnimation({
    text: content,
    messageId,
    wordsPerSecond: 10,
    enabled: enableTyping && !isUserMessage && isLastMessage,
    onComplete: onTypingComplete,
    isAlreadyComplete: isAlreadyTyped,
    onBlockDetected,
    onBlockUpdate,
    onBlockEnd,
    autoTypeInPanel,
  });

  const contentToRender = (enableTyping && !isUserMessage && isLastMessage && !isAlreadyTyped) ? displayedText : content;

  const textColorClass = isUserMessage
    ? 'text-white dark:text-gray-100'
    : 'text-gray-900 dark:text-gray-100';

  const linkColorClass = isUserMessage
    ? 'text-blue-200 hover:text-blue-100 hover:underline dark:text-blue-300'
    : 'text-blue-600 hover:text-blue-800 hover:underline dark:text-blue-400 dark:hover:text-blue-300';

  const headingColorClass = isUserMessage
    ? 'text-white dark:text-gray-100'
    : 'text-gray-900 dark:text-gray-100';

  const blockquoteTextColorClass = isUserMessage
    ? 'text-blue-100 dark:text-blue-200'
    : 'text-gray-700 dark:text-gray-300';

  const blockquoteBgClass = isUserMessage
    ? 'bg-blue-700/20 border-blue-400 dark:bg-blue-900/30 dark:border-blue-500'
    : 'bg-gray-50 border-gray-300 dark:bg-gray-800 dark:border-gray-600';

  const MAX_USER_MESSAGE_LENGTH = 200;
  const isExpanded = expandedMessages.has(content);
  const needsExpansion = isUserMessage && content.length > MAX_USER_MESSAGE_LENGTH;

  // Use a ref to track block index to avoid closure issues
  const blockIndexRef = useRef(0);

  // // Reset block index when content changes
  // useEffect(() => {
  //   blockIndexRef.current = 0;
  // }, [content]);

  // Memoize the components object
  const components = useMemo(() => ({
    code: (props: any) => {
      const isFirstBlockLocal = blockIndexRef.current === 0;
      blockIndexRef.current++;
      return (
        <CodeBlock
          {...props}
          onMermaidError={onMermaidError}
          onSuggestAiCorrection={onSuggestAiCorrection}
          onViewDiagram={onViewDiagram}
          isFirstBlock={isFirstBlockLocal}
          autoTypeInPanel={autoTypeInPanel}
          isDiagramPanelOpen={isDiagramPanelOpen}
          onDiagramCodeUpdate={(newCode) => onDiagramCodeUpdate(messageId, newCode)}
          isTyping={enableTyping && !isUserMessage && isLastMessage && !isAlreadyTyped}
        />
      );
    },
    h1: (props) => (
      <h1 className={`text-xl sm:text-2xl font-semibold ${headingColorClass} mt-6 sm:mt-8 mb-3 sm:mb-4 leading-tight font-claude`} {...props} />
    ),
    h2: (props) => (
      <h2 className={`text-lg sm:text-xl font-semibold ${headingColorClass} mt-5 sm:mt-6 mb-2 sm:mb-3 leading-tight font-claude`} {...props} />
    ),
    h3: (props) => (
      <h3 className={`text-base sm:text-lg font-semibold ${headingColorClass} mt-4 sm:mt-5 mb-2 leading-tight font-claude`} {...props} />
    ),
    h4: (props) => (
      <h4 className={`text-sm sm:text-base font-semibold ${headingColorClass} mt-3 sm:mt-4 mb-1 sm:mb-2 leading-tight font-claude`} {...props} />
    ),
    h5: (props) => (
      <h5 className={`text-sm font-semibold ${headingColorClass} mt-3 mb-1 leading-tight font-claude`} {...props} />
    ),
    h6: (props) => (
      <h6 className={`text-sm font-medium ${headingColorClass} mt-2 mb-1 leading-tight font-claude`} {...props} />
    ),
    p: (props) => (
      <p className={`${textColorClass} leading-relaxed mb-3 sm:mb-4 last:mb-0 font-claude text-sm sm:text-base`} {...props} />
    ),
    a: (props) => (
      <a className={`${linkColorClass} transition-colors font-claude break-words`} {...props} />
    ),
    ul: (props) => (
      <ul className={`list-disc ml-4 sm:ml-6 mb-3 sm:mb-4 space-y-1 ${textColorClass} font-claude text-sm sm:text-base`} {...props} />
    ),
    ol: (props) => (
      <ol className={`list-decimal ml-4 sm:ml-6 mb-3 sm:mb-4 space-y-1 ${textColorClass} font-claude text-sm sm:text-base`} {...props} />
    ),
    li: (props) => (
      <li className="leading-relaxed font-claude" {...props} />
    ),
    blockquote: (props) => (
      <blockquote className={`border-l-4 ${blockquoteBgClass} pl-3 sm:pl-4 py-2 my-3 sm:my-4 ${blockquoteTextColorClass} rounded-r font-claude text-sm sm:text-base`} {...props} />
    ),
    table: (props) => (
      <div className="my-4 sm:my-6 -mx-2 sm:-mx-0">
        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
          <table className="w-full min-w-full border-collapse bg-white dark:bg-gray-900 font-claude text-sm sm:text-base" {...props} />
        </div>
      </div>
    ),
    thead: (props) => (
      <thead className="bg-gray-50 dark:bg-gray-800" {...props} />
    ),
    th: (props) => (
      <th className="px-2 sm:px-4 py-2 sm:py-3 text-left border-b border-gray-200 dark:border-gray-700 font-semibold text-gray-900 dark:text-gray-100 font-claude text-xs sm:text-sm" {...props} />
    ),
    tbody: (props) => (
      <tbody className="divide-y divide-gray-200 dark:divide-gray-700" {...props} />
    ),
    tr: (props) => (
      <tr className="hover:bg-gray-50 dark:hover:bg-gray-800/50" {...props} />
    ),
    td: (props) => (
      <td className="px-2 sm:px-4 py-2 sm:py-3 text-gray-900 dark:text-gray-100 font-claude text-xs sm:text-sm break-words" {...props} />
    ),
    hr: (props) => (
      <hr className="my-6 sm:my-8 border-t border-gray-200 dark:border-gray-700" {...props} />
    ),
    strong: (props) => (
      <strong className={`font-semibold ${textColorClass} font-claude`} {...props} />
    ),
    em: (props) => (
      <em className={`italic ${textColorClass} font-claude`} {...props} />
    ),
  }), [
    textColorClass, 
    linkColorClass, 
    headingColorClass, 
    blockquoteTextColorClass, 
    blockquoteBgClass, 
    onMermaidError, 
    onSuggestAiCorrection, 
    onViewDiagram, 
    autoTypeInPanel, 
    isDiagramPanelOpen, 
    onDiagramCodeUpdate, 
    messageId,
    enableTyping, 
    isUserMessage, 
    isLastMessage, 
    isAlreadyTyped
  ]);

  // Debug logging to check if typing is working
  useEffect(() => {
    if (enableTyping && !isUserMessage && isLastMessage && !isAlreadyTyped) {
      console.log('Typing animation:', {
        isTyping,
        displayedTextLength: displayedText.length,
        contentLength: content.length,
        contentToRenderLength: contentToRender.length
      });
    }
  }, [isTyping, displayedText, content, contentToRender, enableTyping, isUserMessage, isLastMessage, isAlreadyTyped]);

  return (
    <CodeBlockErrorBoundary>
      <div className={`relative ${isUserMessage ? 'sm:max-w-[50%] max-w-2xl' : 'max-w-[100vw] sm:max-w-full'}`}>
        <div className="font-claude">
          <MemoizedReactMarkdown
            content={contentToRender}
            components={components}
          />
        </div>

        {isTyping && (
          <span className="inline-block w-0.5 h-4 sm:h-5 bg-gray-600 dark:bg-gray-400 ml-0.5 animate-pulse" />
        )}

        {needsExpansion && (
          <Button
            variant="link"
            size="sm"
            onClick={() => onToggleUserMessageExpansion(content)}
            className="text-white/80 hover:text-white p-0 h-auto mt-2 flex items-center gap-1 text-xs sm:text-sm font-claude"
          >
            {isExpanded ? (
              <>
                Show Less
                <ChevronUp className="h-3 w-3" />
              </>
            ) : (
              <>
                Show More
                <ChevronDown className="h-3 w-3" />
              </>
            )}
          </Button>
        )}
      </div>
    </CodeBlockErrorBoundary>
  );
});