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
    wordsPerSecond: 5,
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
  // Enhanced version with better styling integration
// Add these updated component definitions to your existing code

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
  // Enhanced H1 with gradient and underline
  h1: (props) => (
    <h1 
      className={`text-xl sm:text-2xl font-bold ${headingColorClass} mt-6 sm:mt-8 mb-3 sm:mb-4 leading-tight font-claude`} 
      {...props} 
    />
  ),
  // Enhanced H2 with border bottom
  h2: (props) => (
    <h2 
      className={`text-lg sm:text-xl font-semibold ${headingColorClass} mt-5 sm:mt-6 mb-2 sm:mb-3 leading-tight font-claude border-b-2 pb-2`} 
      {...props} 
    />
  ),
  // Enhanced H3 with left accent
  h3: (props) => (
    <h3 
      className={`text-base sm:text-lg font-semibold ${headingColorClass} mt-4 sm:mt-5 mb-2 leading-tight font-claude pl-4 relative`} 
      {...props} 
    />
  ),
  h4: (props) => (
    <h4 
      className={`text-sm sm:text-base font-semibold ${headingColorClass} mt-3 sm:mt-4 mb-1 sm:mb-2 leading-tight font-claude`} 
      {...props} 
    />
  ),
  h5: (props) => (
    <h5 
      className={`text-sm font-semibold ${headingColorClass} mt-3 mb-1 leading-tight font-claude`} 
      {...props} 
    />
  ),
  h6: (props) => (
    <h6 
      className={`text-sm font-medium ${headingColorClass} mt-2 mb-1 leading-tight font-claude`} 
      {...props} 
    />
  ),
  // Enhanced paragraphs
  p: (props) => (
    <p 
      className={`${textColorClass} leading-relaxed mb-3 sm:mb-4 last:mb-0 font-claude text-sm sm:text-base`} 
      {...props} 
    />
  ),
  // Enhanced links with smooth hover
  a: (props) => (
    <a 
      className={`${linkColorClass} transition-all duration-200 font-claude break-words relative inline-block font-medium`} 
      {...props} 
    />
  ),
  // Enhanced unordered lists
  ul: (props) => (
    <ul 
      className={`ml-4 sm:ml-6 mb-3 sm:mb-4 space-y-2 ${textColorClass} font-claude text-sm sm:text-base`} 
      {...props} 
    />
  ),
  // Enhanced ordered lists
  ol: (props) => (
    <ol 
      className={`ml-4 sm:ml-6 mb-3 sm:mb-4 space-y-2 ${textColorClass} font-claude text-sm sm:text-base`} 
      {...props} 
    />
  ),
  // Enhanced list items
  li: (props) => (
    <li 
      className="leading-relaxed font-claude transition-all duration-200" 
      {...props} 
    />
  ),
  // Enhanced blockquotes with gradient and hover effect
  blockquote: (props) => (
    <blockquote 
      className={`border-l-4 ${blockquoteBgClass} pl-3 sm:pl-4 py-3 my-3 sm:my-4 ${blockquoteTextColorClass} rounded-r font-claude text-sm sm:text-base shadow-md hover:shadow-lg transition-all duration-300 relative`} 
      {...props} 
    />
  ),
  // Enhanced table container
  table: (props) => (
    <div className="my-4 sm:my-6 -mx-2 sm:-mx-0">
      <div className="overflow-x-auto rounded-lg shadow-lg">
        <table 
          className="w-full min-w-full border-collapse bg-white dark:bg-gray-900 font-claude text-sm sm:text-base" 
          {...props} 
        />
      </div>
    </div>
  ),
  // Enhanced table head with gradient
  thead: (props) => (
    <thead 
      className="bg-gradient-to-r from-blue-600 to-blue-500 dark:from-blue-900 dark:to-blue-800" 
      {...props} 
    />
  ),
  // Enhanced table headers
  th: (props) => (
    <th 
      className="px-2 sm:px-4 py-2 sm:py-3 text-left font-semibold text-white font-claude text-xs sm:text-sm uppercase tracking-wide" 
      {...props} 
    />
  ),
  tbody: (props) => (
    <tbody 
      className="divide-y divide-gray-200 dark:divide-gray-700" 
      {...props} 
    />
  ),
  // Enhanced table rows with hover effect
  tr: (props) => (
    <tr 
      className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-all duration-150" 
      {...props} 
    />
  ),
  // Enhanced table cells
  td: (props) => (
    <td 
      className="px-2 sm:px-4 py-2 sm:py-3 text-gray-900 dark:text-gray-100 font-claude text-xs sm:text-sm break-words border-b border-gray-200 dark:border-gray-700" 
      {...props} 
    />
  ),
  // Enhanced horizontal rule with gradient
  hr: (props) => (
    <hr 
      className="my-6 sm:my-8 border-none h-0.5 bg-gradient-to-r from-transparent via-gray-300 dark:via-gray-600 to-transparent" 
      {...props} 
    />
  ),
  // Enhanced strong tags
  strong: (props) => (
    <strong 
      className={`font-bold ${textColorClass} font-claude`} 
      {...props} 
    />
  ),
  // Enhanced emphasis
  em: (props) => (
    <em 
      className={`italic ${textColorClass} font-claude`} 
      {...props} 
    />
  ),
  // Add del for strikethrough
  del: (props) => (
    <del 
      className={`line-through opacity-75 ${textColorClass} font-claude`} 
      {...props} 
    />
  ),
  // Add inline code styling
  inlineCode: (props) => (
    <code 
      className="bg-blue-50 dark:bg-blue-900/20 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded text-sm font-mono border border-blue-100 dark:border-blue-800" 
      {...props} 
    />
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
      <style>{`
        /* Enhanced Markdown Styling for Chat Messages */

/* Base Typography Improvements */
.font-claude {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Helvetica Neue', sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* Headings - Enhanced with better spacing and visual hierarchy */
.font-claude h1 {
  font-size: clamp(1.5rem, 4vw, 2rem);
  font-weight: 700;
  margin-top: 2rem;
  margin-bottom: 1rem;
  line-height: 1.2;
  letter-spacing: -0.02em;
  background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  position: relative;
  padding-bottom: 0.5rem;
}

.font-claude h1::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  width: 60px;
  height: 3px;
  background: linear-gradient(90deg, #3b82f6, #8b5cf6);
  border-radius: 2px;
}

.dark .font-claude h1 {
  background: linear-gradient(135deg, #60a5fa 0%, #a78bfa 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.font-claude h2 {
  font-size: clamp(1.25rem, 3.5vw, 1.75rem);
  font-weight: 600;
  margin-top: 1.75rem;
  margin-bottom: 0.875rem;
  line-height: 1.3;
  letter-spacing: -0.015em;
  color: #1f2937;
  border-bottom: 2px solid #e5e7eb;
  padding-bottom: 0.5rem;
}

.dark .font-claude h2 {
  color: #f3f4f6;
  border-bottom-color: #374151;
}

.font-claude h3 {
  font-size: clamp(1.125rem, 3vw, 1.5rem);
  font-weight: 600;
  margin-top: 1.5rem;
  margin-bottom: 0.75rem;
  line-height: 1.4;
  color: #374151;
  position: relative;
  padding-left: 1rem;
}

.font-claude h3::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0.4em;
  width: 4px;
  height: 1em;
  background: #3b82f6;
  border-radius: 2px;
}

.dark .font-claude h3 {
  color: #e5e7eb;
}

.dark .font-claude h3::before {
  background: #60a5fa;
}

.font-claude h4 {
  font-size: clamp(1rem, 2.5vw, 1.25rem);
  font-weight: 600;
  margin-top: 1.25rem;
  margin-bottom: 0.625rem;
  line-height: 1.5;
  color: #4b5563;
}

.dark .font-claude h4 {
  color: #d1d5db;
}

/* Paragraphs - Better spacing and readability */
.font-claude p {
  line-height: 1.75;
  margin-bottom: 1rem;
  color: #374151;
  word-wrap: break-word;
  hyphens: auto;
}

.dark .font-claude p {
  color: #d1d5db;
}

.font-claude p:last-child {
  margin-bottom: 0;
}

/* Links - Enhanced hover effects */
.font-claude a {
  position: relative;
  text-decoration: none;
  font-weight: 500;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.font-claude a::after {
  content: '';
  position: absolute;
  bottom: -2px;
  left: 0;
  width: 0;
  height: 2px;
  background: currentColor;
  transition: width 0.3s ease;
}

.font-claude a:hover::after {
  width: 100%;
}

/* User message links */
.font-claude a.text-blue-200 {
  color: #bfdbfe;
}

.font-claude a.text-blue-200:hover {
  color: #dbeafe;
  text-shadow: 0 0 8px rgba(191, 219, 254, 0.4);
}

/* Assistant message links */
.font-claude a.text-blue-600 {
  color: #2563eb;
}

.font-claude a.text-blue-600:hover {
  color: #1d4ed8;
}

.dark .font-claude a.text-blue-400 {
  color: #60a5fa;
}

.dark .font-claude a.text-blue-400:hover {
  color: #93c5fd;
}

/* Lists - Enhanced styling with custom markers */
.font-claude ul {
  list-style: none;
  padding-left: 1.5rem;
  margin-bottom: 1rem;
}

.font-claude ul li {
  position: relative;
  padding-left: 0.5rem;
  margin-bottom: 0.5rem;
  line-height: 1.7;
}

.font-claude ul li::before {
  content: '';
  position: absolute;
  left: -1.25rem;
  top: 0.65em;
  width: 6px;
  height: 6px;
  background: #3b82f6;
  border-radius: 50%;
  transition: transform 0.2s ease;
}

.font-claude ul li:hover::before {
  transform: scale(1.3);
}

.dark .font-claude ul li::before {
  background: #60a5fa;
}

/* Nested lists */
.font-claude ul ul li::before {
  width: 5px;
  height: 5px;
  background: #6366f1;
}

.dark .font-claude ul ul li::before {
  background: #818cf8;
}

.font-claude ul ul ul li::before {
  width: 4px;
  height: 4px;
  background: #8b5cf6;
}

.dark .font-claude ul ul ul li::before {
  background: #a78bfa;
}

/* Ordered lists */
.font-claude ol {
  counter-reset: item;
  list-style: none;
  padding-left: 1.5rem;
  margin-bottom: 1rem;
}

.font-claude ol li {
  position: relative;
  padding-left: 0.75rem;
  margin-bottom: 0.5rem;
  line-height: 1.7;
  counter-increment: item;
}

.font-claude ol li::before {
  content: counter(item) ".";
  position: absolute;
  left: -1.5rem;
  font-weight: 600;
  color: #3b82f6;
  font-size: 0.9em;
}

.dark .font-claude ol li::before {
  color: #60a5fa;
}

/* Blockquotes - Beautiful card-style design */
.font-claude blockquote {
  position: relative;
  margin: 1.5rem 0;
  padding: 1rem 1.25rem;
  border-left: 4px solid #3b82f6;
  background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
  border-radius: 0 0.75rem 0.75rem 0;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.1);
  font-style: italic;
  transition: all 0.3s ease;
}

.font-claude blockquote:hover {
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.2);
  transform: translateX(4px);
}

.font-claude blockquote::before {
  content: '"';
  position: absolute;
  top: -0.5rem;
  left: 0.75rem;
  font-size: 3rem;
  color: #3b82f6;
  opacity: 0.2;
  font-family: Georgia, serif;
  line-height: 1;
}

.dark .font-claude blockquote {
  background: linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%);
  border-left-color: #60a5fa;
  box-shadow: 0 2px 8px rgba(96, 165, 250, 0.1);
}

.dark .font-claude blockquote:hover {
  box-shadow: 0 4px 12px rgba(96, 165, 250, 0.2);
}

.dark .font-claude blockquote::before {
  color: #60a5fa;
}

/* User message blockquotes */
.font-claude blockquote.bg-blue-700\/20 {
  background: rgba(29, 78, 216, 0.2);
  border-left-color: #60a5fa;
}

/* Tables - Modern card design */
.font-claude table {
  border-collapse: separate;
  border-spacing: 0;
  width: 100%;
  border-radius: 0.75rem;
  overflow: hidden;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
}

.font-claude thead {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
}

.dark .font-claude thead {
  background: linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%);
}

.font-claude th {
  padding: 1rem;
  text-align: left;
  font-weight: 600;
  color: white;
  font-size: 0.875rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.font-claude td {
  padding: 0.875rem 1rem;
  border-bottom: 1px solid #e5e7eb;
  transition: background-color 0.15s ease;
}

.dark .font-claude td {
  border-bottom-color: #374151;
}

.font-claude tbody tr:last-child td {
  border-bottom: none;
}

.font-claude tbody tr {
  transition: all 0.15s ease;
}

.font-claude tbody tr:hover {
  background-color: #f9fafb;
  transform: scale(1.01);
}

.dark .font-claude tbody tr:hover {
  background-color: rgba(55, 65, 81, 0.5);
}

/* Horizontal Rule */
.font-claude hr {
  border: none;
  height: 2px;
  background: linear-gradient(90deg, transparent, #e5e7eb, transparent);
  margin: 2rem 0;
}

.dark .font-claude hr {
  background: linear-gradient(90deg, transparent, #374151, transparent);
}

/* Strong and Emphasis */
.font-claude strong {
  font-weight: 700;
  color: #111827;
  text-shadow: 0 0 1px rgba(0, 0, 0, 0.1);
}

.dark .font-claude strong {
  color: #f9fafb;
  text-shadow: 0 0 1px rgba(255, 255, 255, 0.1);
}

.font-claude em {
  font-style: italic;
  color: #374151;
}

.dark .font-claude em {
  color: #d1d5db;
}

/* Code elements are handled by CodeBlock component */
/* But we can add some inline code styling if needed */
.font-claude code:not([class*="language-"]) {
  background-color: rgba(59, 130, 246, 0.1);
  color: #dc2626;
  padding: 0.2rem 0.4rem;
  border-radius: 0.375rem;
  font-family: 'Monaco', 'Consolas', 'Courier New', monospace;
  font-size: 0.875em;
  font-weight: 500;
  border: 1px solid rgba(59, 130, 246, 0.2);
}

.dark .font-claude code:not([class*="language-"]) {
  background-color: rgba(96, 165, 250, 0.1);
  color: #f87171;
  border-color: rgba(96, 165, 250, 0.2);
}

/* Typing cursor animation */
@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.animate-pulse {
  animation: pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

/* Smooth transitions for all interactive elements */
.font-claude * {
  transition-property: color, background-color, border-color, text-decoration-color, fill, stroke, opacity, box-shadow, transform;
  transition-duration: 150ms;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
}

/* Selection styling */
.font-claude ::selection {
  background-color: rgba(59, 130, 246, 0.2);
  color: inherit;
}

.dark .font-claude ::selection {
  background-color: rgba(96, 165, 250, 0.3);
}

/* Responsive spacing adjustments */
@media (max-width: 640px) {
  .font-claude h1 {
    margin-top: 1.5rem;
    margin-bottom: 0.75rem;
  }

  .font-claude h2 {
    margin-top: 1.25rem;
    margin-bottom: 0.625rem;
  }

  .font-claude h3 {
    margin-top: 1rem;
    margin-bottom: 0.5rem;
  }

  .font-claude ul,
  .font-claude ol {
    padding-left: 1.25rem;
  }

  .font-claude blockquote {
    padding: 0.75rem 1rem;
    margin: 1rem 0;
  }

  .font-claude table {
    font-size: 0.875rem;
  }

  .font-claude th,
  .font-claude td {
    padding: 0.625rem 0.75rem;
  }
}

/* Accessibility improvements */
@media (prefers-reduced-motion: reduce) {
  .font-claude * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }

  .font-claude blockquote:hover {
    transform: none;
  }

  .font-claude tbody tr:hover {
    transform: none;
  }
}

/* Focus states for accessibility */
.font-claude a:focus-visible {
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
  border-radius: 2px;
}

.dark .font-claude a:focus-visible {
  outline-color: #60a5fa;
}

/* Print styles */
@media print {
  .font-claude {
    color: black;
  }

  .font-claude a {
    color: #0000ee;
    text-decoration: underline;
  }

  .font-claude blockquote {
    border-left-color: #000;
    background: #f5f5f5;
  }

  .font-claude table {
    border: 1px solid #000;
  }

  .font-claude thead {
    background: #e0e0e0;
  }

  .font-claude th {
    color: #000;
  }
}
      `}</style>
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