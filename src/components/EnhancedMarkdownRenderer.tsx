import React, { memo, useCallback, useState, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import rehypeHighlight from 'rehype-highlight';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { X, RefreshCw } from 'lucide-react';
import { useEnhancedTyping } from '../hooks/useEnhancedTyping';
import { toast } from 'sonner';
import Mermaid from './Mermaid';
import { MemoizedMarkdownRenderer } from './aiChat/MarkdownRenderer';
import 'highlight.js/styles/github-dark.css';

interface EnhancedMarkdownRendererProps {
  content: string;
  messageId: string;
  isUserMessage?: boolean;
  onMermaidError?: (code: string, errorType: 'syntax' | 'rendering') => void;
  onSuggestAiCorrection?: (prompt: string) => void;
  onViewDiagram?: (type: 'mermaid' | 'dot' | 'chartjs' | 'code' | 'image' | 'threejs' | 'unknown' | 'document-text' | 'html', content?: string, language?: string, imageUrl?: string) => void;
  onToggleUserMessageExpansion?: (messageContent: string) => void;
  expandedMessages?: Set<string>;
  enableTyping?: boolean;
  isLastMessage?: boolean;
  onTypingComplete?: (messageId: string) => void;
  isAlreadyTyped?: boolean;
}

export const EnhancedMarkdownRenderer = memo(({
  content,
  messageId,
  isUserMessage = false,
  onMermaidError,
  onSuggestAiCorrection,
  onViewDiagram,
  onToggleUserMessageExpansion,
  expandedMessages,
  enableTyping = false,
  isLastMessage = false,
  onTypingComplete,
  isAlreadyTyped = false
}: EnhancedMarkdownRendererProps) => {
  const [errorBounds, setErrorBounds] = useState<Set<string>>(new Set());
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const hasProcessedTypingRef = useRef(false);

  const handleBlockEnter = useCallback((block: any) => {
    // console.log('Entering block:', block.type);
    if (onViewDiagram) {
      // Auto-toggle to panel when typing code/mermaid/html blocks
      onViewDiagram(block.type === 'code' ? 'code' : block.type, block.content, block.language);
    }
  }, [onViewDiagram]);

  const handleBlockExit = useCallback((block: any) => {
    // console.log('Exiting block:', block.type);
    // Could auto-switch back to main content here if needed
  }, []);

  const { displayedText, isTyping, currentBlock } = useEnhancedTyping({
    text: content,
    messageId,
    enabled: enableTyping && isLastMessage && !isAlreadyTyped && !hasProcessedTypingRef.current,
    onComplete: (id) => {
      hasProcessedTypingRef.current = true;
      onTypingComplete?.(id);
    },
    isAlreadyComplete: isAlreadyTyped || hasProcessedTypingRef.current,
    onBlockEnter: handleBlockEnter,
    onBlockExit: handleBlockExit
  });

  const contentToRender = enableTyping && isLastMessage && !isAlreadyTyped ? displayedText : content;

  const handleMermaidClick = useCallback((mermaidCode: string) => {
    if (onViewDiagram) {
      onViewDiagram('mermaid', mermaidCode);
    }
  }, [onViewDiagram]);

  const components = {
    code({ node, inline, className, children, ...props }: any) {
      const match = /language-(\w+)/.exec(className || '');
      const language = match ? match[1] : '';
      const codeString = String(children).replace(/\n$/, '');

      if (!inline && language) {
        // Handle mermaid diagrams
        if (language === 'mermaid' || language === 'mmd') {
          return (
            <div className="my-4 cursor-pointer" onClick={() => handleMermaidClick(codeString)}>
              <Mermaid
                chart={codeString}
                onMermaidError={(code, errorType) => onMermaidError?.(code, errorType)}
                diagramRef={React.createRef<HTMLDivElement>()}
              />
            </div>
          );
        }

        // Handle other code blocks - use standard markdown for now
        return (
          <pre className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg overflow-x-auto">
            <code className={className} {...props}>
              {children}
            </code>
          </pre>
        );
      }

      return (
        <code className={className} {...props}>
          {children}
        </code>
      );
    },

    // Enhanced HTML rendering with better error handling
    html({ node, ...props }: any) {
      try {
        return <div {...props} />;
      } catch (error) {
        console.warn('HTML rendering error:', error);
        return (
          <div className="bg-red-50 border border-red-200 rounded p-3 my-2 dark:bg-red-900/20 dark:border-red-800">
            <p className="text-red-600 dark:text-red-400 text-sm">
              HTML content could not be rendered safely.
            </p>
          </div>
        );
      }
    }
  };

  return (
    <div className="markdown-renderer w-full max-w-none prose prose-slate dark:prose-invert">
      {currentBlock && (
        <div className="mb-2 text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded">
          Currently typing: {currentBlock.type} block
        </div>
      )}

      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[
          rehypeRaw,
          [rehypeSanitize, {
            allowedTags: ['iframe', 'div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'strong', 'em', 'code', 'pre', 'blockquote', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'img', 'a', 'br'],
            allowedAttributes: {
              '*': ['class', 'id', 'style'],
              'a': ['href', 'title', 'target'],
              'img': ['src', 'alt', 'title', 'width', 'height'],
              'iframe': ['src', 'width', 'height', 'frameborder', 'allowfullscreen']
            }
          }],
          rehypeHighlight
        ]}
        components={components}
      >
        {contentToRender}
      </ReactMarkdown>

      {isTyping && (
        <div className="flex items-center gap-2 mt-2 text-sm text-slate-500 dark:text-slate-400">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
          <span>AI is typing...</span>
        </div>
      )}
    </div>
  );
});

EnhancedMarkdownRenderer.displayName = 'EnhancedMarkdownRenderer';