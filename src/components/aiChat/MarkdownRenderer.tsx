import React, { useState, useEffect, useRef, memo, useCallback } from 'react';
import { AlertTriangle, Copy, Check, Loader2, Maximize2, X, RefreshCw, ChevronDown, ChevronUp, Image, FileText, BookOpen, StickyNote, Sparkles } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Chart, registerables } from 'chart.js';
import { lowlight } from 'lowlight';
import { LanguageFn } from 'highlight.js';
import javascript from 'highlight.js/lib/languages/javascript';
import python from 'highlight.js/lib/languages/python';
import java from 'highlight.js/lib/languages/java';
import cpp from 'highlight.js/lib/languages/cpp';
import sql from 'highlight.js/lib/languages/sql';
import xml from 'highlight.js/lib/languages/xml';
import bash from 'highlight.js/lib/languages/bash';
import json from 'highlight.js/lib/languages/json';
import css from 'highlight.js/lib/languages/css';
import typescript from 'highlight.js/lib/languages/typescript';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { useCopyToClipboard } from '../../hooks/useCopyToClipboard';
import { useTypingAnimation } from '../../hooks/useTypingAnimation';

import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'; // Use vscDarkPlus for dark mode

try {
  lowlight.registerLanguage('javascript', javascript as LanguageFn);
  lowlight.registerLanguage('js', javascript as LanguageFn);
  lowlight.registerLanguage('python', python as LanguageFn);
  lowlight.registerLanguage('py', python as LanguageFn);
  lowlight.registerLanguage('java', java as LanguageFn);
  lowlight.registerLanguage('cpp', cpp as LanguageFn);
  lowlight.registerLanguage('c++', cpp as LanguageFn);
  lowlight.registerLanguage('sql', sql as LanguageFn);
  lowlight.registerLanguage('xml', xml as LanguageFn);
  lowlight.registerLanguage('html', xml as LanguageFn);
  lowlight.registerLanguage('bash', bash as LanguageFn);
  lowlight.registerLanguage('shell', bash as LanguageFn);
  lowlight.registerLanguage('json', json as LanguageFn);
  lowlight.registerLanguage('css', css as LanguageFn);
  lowlight.registerLanguage('typescript', typescript as LanguageFn);
  lowlight.registerLanguage('ts', typescript as LanguageFn);
} catch (error) {
  console.warn('Error registering syntax highlighting languages in MarkdownRenderer:', error);
}

Chart.register(...registerables);

export class CodeBlockErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode; fallback?: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('CodeBlock error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="my-4 sm:my-6 p-3 sm:p-4 bg-red-50 border border-red-200 rounded-lg dark:bg-red-950 dark:border-red-800">
          <div className="flex items-center gap-2 text-red-700 dark:text-red-300">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            <span className="font-medium text-sm sm:text-base">Rendering Error</span>
          </div>
          <p className="text-xs sm:text-sm text-red-600 mt-1 dark:text-red-400">
            Failed to render this content. Please try refreshing or contact support if the issue persists.
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}

interface CodeBlockProps {
  node?: any;
  inline: boolean;
  className: string;
  children: React.ReactNode;
  onMermaidError: (code: string, errorType: 'syntax' | 'rendering' | 'timeout' | 'network') => void;
  onSuggestAiCorrection: (prompt: string) => void;
  onViewDiagram: (type: 'mermaid' | 'dot' | 'chartjs' | 'code' | 'image' | 'unknown' | 'document-text' | 'threejs' | 'html', content?: string, language?: string, imageUrl?: string) => void;
  isFirstBlock?: boolean;
  autoTypeInPanel?: boolean;
  isDiagramPanelOpen: boolean;
}
const CodeBlock: React.FC<CodeBlockProps> = memo(({
  node, inline, className, children, onMermaidError, onSuggestAiCorrection, onViewDiagram, isFirstBlock, autoTypeInPanel = true, isDiagramPanelOpen, ...props
}) => {
  const { copied, copy } = useCopyToClipboard();
  const match = /language-(\w+)/.exec(className || '');
  const lang = match && match[1];
  const codeContent = String(children).trim();

  // Determine if it's a code block (has a language specified)
  const isCodeBlock = !!lang;

  // Initial state: Show raw code only if it's a code block, autoTypeInPanel is true, and DiagramPanel is off
  const [showRawCode, setShowRawCode] = useState(
    (isCodeBlock && autoTypeInPanel && !isDiagramPanelOpen) ? true : !autoTypeInPanel
  );

  useEffect(() => {
    // Update showRawCode based on the conditions
    setShowRawCode((isCodeBlock && autoTypeInPanel && !isDiagramPanelOpen) ? true : false);
  }, [autoTypeInPanel, isDiagramPanelOpen, isCodeBlock]);

  const handleCopyCode = async () => {
    await copy(codeContent);
  };
  // Render raw code with syntax highlighting using react-syntax-highlighter
  if (!inline && (showRawCode || !autoTypeInPanel)) {
    return (
      <div className="relative my-4 sm:my-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600 w-full">
        <div className="flex items-center justify-between px-3 sm:px-4 py-2 sm:py-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-600">
          <span className="text-xs sm:text-sm font-medium text-gray-600 uppercase tracking-wide dark:text-gray-300">
            Raw Code ({lang || 'text'})
          </span>
          <div className="flex">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopyCode}
              className="h-5 w-5 sm:h-6 sm:w-6 p-0 text-gray-500 hover:text-green-400 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-green-400 dark:hover:bg-gray-700"
              title="Copy code"
              aria-label="Copy code to clipboard"
            >
              {copied ? <Check className="h-3 w-3 sm:h-4 sm:w-4" /> : <Copy className="h-3 w-3 sm:h-4 sm:w-4" />}
            </Button>
            {autoTypeInPanel && ( // Only show toggle button if autoTypeInPanel is true
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowRawCode(false)}
                className="h-5 w-5 sm:h-6 sm:w-6 p-0 text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-gray-200 dark:hover:bg-gray-700"
                title="Hide raw code"
                aria-label="Hide raw code"
              >
                <X className="h-3 w-3 sm:h-4 sm:w-4" />
              </Button>
            )}
          </div>
        </div>
        <div className="relative bg-white dark:bg-gray-900 w-full box-border">
          <div className="overflow-x-auto max-w-[100vw] sm:max-w-full">
            <SyntaxHighlighter
              language={lang || 'text'}
              style={vscDarkPlus}
              showLineNumbers={true}
              customStyle={{
                margin: 0,
                padding: '0.75rem 1rem',
                fontSize: '0.875rem',
                lineHeight: '1.5',
                background: 'transparent',
                borderRadius: '0 0 0.375rem 0.375rem',
              }}
              codeTagProps={{
                className: 'font-mono text-gray-800 dark:text-gray-100',
              }}
              wrapLongLines
            >
              {codeContent}
            </SyntaxHighlighter>
          </div>
        </div>
      </div>
    );
  }

  // Handle special cases like HTML, Mermaid, Chart.js, Three.js, and DOT
  if (!inline && lang === 'html') {
    return (
      <div className="my-4 sm:my-6 p-3 sm:p-4 bg-slate-50 border border-slate-200 rounded-lg dark:bg-gray-800 dark:border-gray-600">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-3 text-slate-700 dark:text-gray-200">
            <FileText className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
            <span className="font-medium text-sm sm:text-base">Web Page</span>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onViewDiagram && onViewDiagram('html', codeContent, lang)}
              className="bg-blue-500 text-white hover:bg-blue-600 shadow-sm dark:bg-blue-700 dark:hover:bg-blue-800 text-xs sm:text-sm flex-1 sm:flex-initial"
            >
              <Maximize2 className="h-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
              <span className="hidden xs:inline">View Web Page</span>
              <span className="xs:hidden">View</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopyCode}
              className="text-gray-500 hover:text-green-400 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-green-400 dark:hover:bg-gray-700"
              title="Copy code"
              aria-label="Copy code to clipboard"
            >
              {copied ? <Check className="h-3 w-3 sm:h-4 sm:w-4" /> : <Copy className="h-3 w-3 sm:h-4 sm:w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowRawCode(!showRawCode)}
              className="text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-gray-200 dark:hover:bg-gray-700"
              title={showRawCode ? 'Hide Raw Code' : 'Show Raw Code'}
              aria-label={showRawCode ? 'Hide raw code' : 'Show raw code'}
            >
              {showRawCode ? <X className="h-3 w-3 sm:h-4 sm:w-4" /> : <FileText className="h-3 w-3 sm:h-4 sm:w-4" />}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Handle diagram blocks (mermaid, chartjs, threejs, dot)
  const createDiagramBlock = (title: string, type: any) => (
    <div className="my-4 sm:my-6 p-3 sm:p-4 bg-slate-50 border border-slate-200 rounded-lg dark:bg-gray-800 dark:border-gray-600">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2 sm:gap-3 text-slate-700 dark:text-gray-200">
          <FileText className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
          <span className="font-medium text-sm sm:text-base">{title}</span>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onViewDiagram && onViewDiagram(type, codeContent, lang)}
            className="bg-blue-500 text-white hover:bg-blue-600 shadow-sm dark:bg-blue-700 dark:hover:bg-blue-800 text-xs sm:text-sm flex-1 sm:flex-initial"
          >
            <Maximize2 className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
            <span className="hidden xs:inline">View Diagram</span>
            <span className="xs:hidden">View</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopyCode}
            className="text-gray-500 hover:text-green-400 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-green-400 dark:hover:bg-gray-700"
            title="Copy code"
            aria-label="Copy code to clipboard"
          >
            {copied ? <Check className="h-3 w-3 sm:h-4 sm:w-4" /> : <Copy className="h-3 w-3 sm:h-4 sm:w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowRawCode(!showRawCode)}
            className="text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-gray-200 dark:hover:bg-gray-700"
            title={showRawCode ? 'Hide Raw Code' : 'Show Raw Code'}
            aria-label={showRawCode ? 'Hide raw code' : 'Show raw code'}
          >
            {showRawCode ? <X className="h-3 w-3 sm:h-4 sm:w-4" /> : <FileText className="h-3 w-3 sm:h-4 sm:w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );

  if (!inline && lang === 'mermaid') {
    return createDiagramBlock('Mermaid Diagram', 'mermaid');
  }

  if (!inline && lang === 'chartjs') {
    return createDiagramBlock('Chart.js Graph', 'chartjs');
  }

  if (!inline && lang === 'threejs') {
    return createDiagramBlock('Three.js 3D Scene', 'threejs');
  }

  if (!inline && lang === 'dot') {
    return createDiagramBlock('DOT Graph', 'dot');
  }

  // Handle generic code blocks
  if (!inline && lang) {
    return (
      <div className="my-4 sm:my-6 p-3 sm:p-4 bg-slate-50 border border-slate-200 rounded-lg dark:bg-gray-800 dark:border-gray-600">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-3 text-slate-700 dark:text-gray-200">
            <FileText className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
            <span className="font-medium text-sm sm:text-base">{lang.toUpperCase()} Code</span>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onViewDiagram && onViewDiagram('code', codeContent, lang)}
              className="bg-blue-500 text-white hover:bg-blue-600 shadow-sm dark:bg-blue-700 dark:hover:bg-blue-800 text-xs sm:text-sm flex-1 sm:flex-initial"
            >
              <Maximize2 className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
              <span className="hidden xs:inline">View Code</span>
              <span className="xs:hidden">View</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopyCode}
              className="text-gray-500 hover:text-green-400 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-green-400 dark:hover:bg-gray-700"
              title="Copy code"
              aria-label="Copy code to clipboard"
            >
              {copied ? <Check className="h-3 w-3 sm:h-4 sm:w-4" /> : <Copy className="h-3 w-3 sm:h-4 sm:w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowRawCode(!showRawCode)}
              className="text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-gray-200 dark:hover:bg-gray-700"
              title={showRawCode ? 'Hide Raw Code' : 'Show Raw Code'}
              aria-label={showRawCode ? 'Hide raw code' : 'Show raw code'}
            >
              {showRawCode ? <X className="h-3 w-3 sm:h-4 sm:w-4" /> : <FileText className="h-3 w-3 sm:h-4 sm:w-4" />}
            </Button>
          </div>
        </div>
      </div>
    );
  }
  // Inline code
  return (
    <code
      className="bg-gray-100 text-gray-900 px-1 sm:px-1.5 py-0.5 rounded font-mono text-xs sm:text-sm dark:bg-gray-800 dark:text-gray-100"
      {...props}
    >
      {children}
    </code>
  );
}
);
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
  isDiagramPanelOpen: boolean
}

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
  isDiagramPanelOpen

}) => {
  const { displayedText, isTyping } = useTypingAnimation({
    text: content,
    messageId,
    wordsPerSecond: 12,
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

  let blockIndex = 0;

  return (
    <CodeBlockErrorBoundary>
      <div className={`relative ${isUserMessage ? 'sm:max-w-[50%] max-w-2xl' : 'max-w-[100vw] sm:max-w-full'}`}>
        <div className="font-claude">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeRaw]}
            components={{
              code: (props: any) => {
                const isFirstBlockLocal = blockIndex === 0;
                blockIndex++;
                return (
                  <CodeBlock
                    {...props}
                    onMermaidError={onMermaidError}
                    onSuggestAiCorrection={onSuggestAiCorrection}
                    onViewDiagram={onViewDiagram}
                    isFirstBlock={isFirstBlockLocal}
                    isDiagramPanelOpen={isDiagramPanelOpen}

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
            }}
          >
            {contentToRender}
          </ReactMarkdown>
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
export { CodeBlock };
