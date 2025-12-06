import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import { AlertTriangle, Copy, Check, Loader2, Maximize2, X, RefreshCw, ChevronDown, ChevronUp, Image, FileText, BookOpen, StickyNote, Sparkles } from 'lucide-react';
import { Button } from '../../ui/button';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { useCopyToClipboard } from '../../../hooks/useCopyToClipboard';
import { useTypingAnimation } from '../../../hooks/useTypingAnimation';
import { CodeBlock, CodeBlockErrorBoundary } from './CodeBlock';
import { calculateTypingSpeed } from '@/utils/calculateTypyingSpeed';
import remarkEmoji from 'remark-emoji';

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

const MemoizedReactMarkdown = memo(
  ({ content, components }: { content: string; components: any }) => {
    return (
      <ReactMarkdown
        rehypePlugins={[rehypeRaw]}
        remarkPlugins={[remarkGfm, remarkEmoji]}
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
  const wordsPerSecond = useMemo(() => {
    if (!enableTyping || isUserMessage || !isLastMessage || isAlreadyTyped) return 15;
    return calculateTypingSpeed(content);
  }, [content, enableTyping, isUserMessage, isLastMessage, isAlreadyTyped]);

  const { displayedText, isTyping } = useTypingAnimation({
    text: content,
    messageId,
    wordsPerSecond,
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
    : 'text-back dark:text-gray-100';

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

  const blockIndexRef = useRef(0);

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
    // Modern heading styles
    h1: (props) => (
      <h1
        className={`text-2xl sm:text-3xl font-display font-semibold ${headingColorClass} mb-4 leading-tight tracking-tight`}
        {...props}
      />
    ),
    h2: (props) => (
      <h2
        className={`text-xl sm:text-2xl font-display font-semibold ${headingColorClass} mb-3 leading-tight tracking-tight`}
        {...props}
      />
    ),
    h3: (props) => (
      <h3
        className={`text-lg sm:text-xl font-display font-semibold ${headingColorClass} mb-3 leading-tight`}
        {...props}
      />
    ),
    h4: (props) => (
      <h4
        className={`text-base font-claude sm:text-lg font-display font-semibold ${headingColorClass} mb-2 leading-tight`}
        {...props}
      />
    ),
    h5: (props) => (
      <h5
        className={`text-base  font-claude font-display font-semibold ${headingColorClass} mb-2 leading-tight`}
        {...props}
      />
    ),
    h6: (props) => (
      <h6
        className={`text-sm font-display font-medium ${headingColorClass} mb-2 leading-tight opacity-80`}
        {...props}
      />
    ),
    // Modern paragraph styles
    p: (props) => (
      <p
        className={`${textColorClass} leading-relaxed mb-4 last:mb-0 text-xl lg:text-xl font-claude`}
        {...props}
      />
    ),
    a: (props) => (
      <a
        className={`${linkColorClass} font-serif break-words inline-block font-medium text-lg `}
        {...props}
      />
    ),
    ul: (props) => (
      <ul className="list-disc ml-5 text-gray-700 dark:text-gray-300" {...props} />
    ),
    ol: (props) => (
      <ol className="list-decimal ml-5 text-gray-700 dark:text-gray-300" {...props} />
    ),
    li: (props) => (
      <li
        className="font-claude text-lg lg:text-lg"
        {...props}
      />
    ),
    blockquote: (props) => (
      <blockquote
        className={`border-l-2 ${blockquoteBgClass} pl-2 py-1 ${blockquoteTextColorClass} font-serif text-lg sm:text-base italic`}
        {...props}
      />
    ),
    table: (props) => (
      <div className="overflow-x-auto border border-gray-200 dark:border-gray-700">
        <table
          className="w-full min-w-full border-collapse bg-white dark:bg-gray-900 font-serif text-xl"
          {...props}
        />
      </div>
    ),
    thead: (props) => (
      <thead
        className="bg-gray-100 dark:bg-gray-800"
        {...props}
      />
    ),
    th: (props) => (
      <th
        className="px-2 py-1 text-left font-semibold text-gray-900 dark:text-gray-100 font-serif text-xl uppercase"
        {...props}
      />
    ),
    tbody: (props) => (
      <tbody
        className="divide-y divide-gray-200 dark:divide-gray-700"
        {...props}
      />
    ),
    tr: (props) => (
      <tr
        className="hover:bg-gray-50 dark:hover:bg-gray-800/50"
        {...props}
      />
    ),
    td: (props) => (
      <td
        className="px-2 py-1 text-gray-900 dark:text-gray-100 font-serif text-lg break-words"
        {...props}
      />
    ),
    hr: (props) => (
      <hr
        className="border-gray-300 dark:border-gray-600"
        {...props}
      />
    ),
    strong: (props) => (
      <strong
        className={`font-bold ${textColorClass} font-serif`}
        {...props}
      />
    ),
    em: (props) => (
      <em
        className={`italic ${textColorClass} font-serif`}
        {...props}
      />
    ),
    del: (props) => (
      <del
        className={`line-through opacity-75 ${textColorClass} font-serif`}
        {...props}
      />
    ),
    inlineCode: (props) => (
      <code className="bg-gray-100 dark:bg-gray-800 text-red-600 dark:text-red-400 px-2 py-1 rounded border border-gray-300 dark:border-gray-700 font-mono text-sm" {...props} />
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

  return (
    <CodeBlockErrorBoundary>
      <div className={`relative ${isUserMessage ? 'sm:max-w-[50%] max-w-2xl' : 'max-w-[100vw] sm:max-w-full'}`}>
        <div className="font-sans">
          <MemoizedReactMarkdown
            content={contentToRender}
            components={components}
          />
        </div>

        {needsExpansion && (
          <Button
            variant="link"
            size="sm"
            onClick={() => onToggleUserMessageExpansion(content)}
            className="text-white/80 hover:text-white p-0 h-auto flex items-center gap-1 text-xs font-serif"
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