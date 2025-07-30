// src/components/MarkdownRenderer.tsx
import React, { useState, useEffect, useRef, memo, useCallback } from 'react';
import { AlertTriangle, Copy, Check, Loader2, Maximize2, X, RefreshCw, ChevronDown, ChevronUp, Image, FileText, BookOpen, StickyNote, Sparkles } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';

// Import Chart.js for rendering
import { Chart, registerables } from 'chart.js';
// NEW: Import THREE and OrbitControls from npm packages
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// Import lowlight and language types for syntax highlighting
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

// Import ReactMarkdown and plugins
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';

// Import utility for copying to clipboard
import { useCopyToClipboard } from '../hooks/useCopyToClipboard';

// Register languages for lowlight
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
  lowlight.registerLanguage('html', xml as LanguageFn); // HTML is often highlighted as XML
  lowlight.registerLanguage('bash', bash as LanguageFn);
  lowlight.registerLanguage('shell', bash as LanguageFn);
  lowlight.registerLanguage('json', json as LanguageFn);
  lowlight.registerLanguage('css', css as LanguageFn);
  lowlight.registerLanguage('typescript', typescript as LanguageFn);
  lowlight.registerLanguage('ts', typescript as LanguageFn);
} catch (error) {
  console.warn('Error registering syntax highlighting languages in MarkdownRenderer:', error);
}

// Ensure Chart.js components are registered once
Chart.register(...registerables);

// Error Boundary for Code Blocks
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
        <div className="my-4 p-4 bg-red-50 border border-red-200 rounded-lg dark:bg-red-950 dark:border-red-800 font-sans">
          <div className="flex items-center gap-2 text-red-700 dark:text-red-300">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-base font-medium">Rendering Error</span>
          </div>
          <p className="text-sm md:text-base text-red-600 mt-1 dark:text-red-400">
            Failed to render this content. Please try refreshing or contact support if the issue persists.
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}

interface CodeBlockProps {
  node?: any; // Make node optional
  inline: boolean;
  className: string;
  children: React.ReactNode;
  onMermaidError: (code: string, errorType: 'syntax' | 'rendering') => void;
  onSuggestAiCorrection: (prompt: string) => void;
  onViewDiagram: (type: 'mermaid' | 'dot' | 'chartjs' | 'code' | 'image' | 'unknown' | 'document-text' | 'threejs', content?: string, language?: string, imageUrl?: string) => void;
}

const CodeBlock: React.FC<CodeBlockProps> = memo(({ node, inline, className, children, onMermaidError, onSuggestAiCorrection, onViewDiagram, ...props }) => {
  const { copied, copy } = useCopyToClipboard();
  const match = /language-(\w+)/.exec(className || '');
  const lang = match && match[1];
  const codeContent = String(children).trim();
  const [showRawCode, setShowRawCode] = useState(false);

  // If it's a raw code block (not mermaid, chartjs, dot, or threejs), show a "View Code" button
  if (!inline && lang && !['mermaid', 'chartjs', 'dot', 'threejs'].includes(lang)) {
    return (
      <div className="my-4 p-3 bg-slate-100 border border-slate-200 rounded-lg flex items-center justify-between dark:bg-gray-800 dark:border-gray-700 font-sans">
        <div className="flex items-center gap-2 text-base md:text-lg text-slate-700 dark:text-gray-200">
          <FileText className="h-4 w-4" />
          <span className="text-base md:text-lg font-medium">{lang.toUpperCase()} Code</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onViewDiagram && onViewDiagram('code', codeContent, lang)}
          className="bg-blue-500 text-white hover:bg-blue-600 shadow-sm dark:bg-blue-700 dark:hover:bg-blue-800 font-sans"
        >
          <Maximize2 className="h-4 w-4 mr-2" />
          View Code
        </Button>
      </div>
    );
  }

  if (showRawCode) {
    return (
      <div className="relative my-4 rounded-lg overflow-hidden shadow-sm border border-gray-200 dark:border-gray-700 font-sans">
        <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200 dark:bg-gray-800 dark:border-gray-700">
          <span className="text-sm md:text-base font-medium text-gray-600 uppercase tracking-wide dark:text-gray-300">
            Raw Code ({lang})
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowRawCode(false)}
            className="h-6 w-6 p-0 text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700 font-sans"
            title="Attempt rendering"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
        <div className="p-4 bg-white overflow-x-auto dark:bg-gray-900">
          <pre className="font-mono text-sm md:text-base leading-relaxed">
            <code className="text-gray-800 dark:text-gray-200">{codeContent}</code>
          </pre>
        </div>
      </div>
    );
  }

  if (!inline && lang === 'mermaid') {
    return (
      <div className="my-4 p-3 bg-slate-100 border border-slate-200 rounded-lg flex items-center justify-between dark:bg-gray-800 dark:border-gray-700 font-sans">
        <div className="flex items-center gap-2 text-base md:text-lg text-slate-700 dark:text-gray-200">
          <FileText className="h-4 w-4" />
          <span className="text-base md:text-lg font-medium">Mermaid Diagram</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onViewDiagram && onViewDiagram('mermaid', codeContent)}
          className="bg-blue-500 text-white hover:bg-blue-600 shadow-sm dark:bg-blue-700 dark:hover:bg-blue-800 font-sans"
        >
          <Maximize2 className="h-4 w-4 mr-2" />
          View Diagram
        </Button>
      </div>
    );
  }

  if (!inline && lang === 'chartjs') {
    return (
      <div className="my-4 p-3 bg-slate-100 border border-slate-200 rounded-lg flex items-center justify-between dark:bg-gray-800 dark:border-gray-700 font-sans">
        <div className="flex items-center gap-2 text-base md:text-lg text-slate-700 dark:text-gray-200">
          <FileText className="h-4 w-4" />
          <span className="text-base md:text-lg font-medium">Chart.js Graph</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onViewDiagram && onViewDiagram('chartjs', codeContent)}
          className="bg-blue-500 text-white hover:bg-blue-600 shadow-sm dark:bg-blue-700 dark:hover:bg-blue-800 font-sans"
        >
          <Maximize2 className="h-4 w-4 mr-2" />
          View Diagram
        </Button>
      </div>
    );
  }

  if (!inline && lang === 'threejs') {
    return (
      <div className="my-4 p-3 bg-slate-100 border border-slate-200 rounded-lg flex items-center justify-between dark:bg-gray-800 dark:border-gray-700 font-sans">
        <div className="flex items-center gap-2 text-base md:text-lg text-slate-700 dark:text-gray-200">
          <FileText className="h-4 w-4" />
          <span className="text-base md:text-lg font-medium">Three.js 3D Scene</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onViewDiagram && onViewDiagram('threejs', codeContent)}
          className="bg-blue-500 text-white hover:bg-blue-600 shadow-sm dark:bg-blue-700 dark:hover:bg-blue-800 font-sans"
        >
          <Maximize2 className="h-4 w-4 mr-2" />
          View Diagram
        </Button>
      </div>
    );
  }

  if (!inline && lang === 'dot') {
    return (
      <div className="my-4 p-3 bg-slate-100 border border-slate-200 rounded-lg flex items-center justify-between dark:bg-gray-800 dark:border-gray-700 font-sans">
        <div className="flex items-center gap-2 text-base md:text-lg text-slate-700 dark:text-gray-200">
          <FileText className="h-4 w-4" />
          <span className="text-base md:text-lg font-medium">DOT Graph</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onViewDiagram && onViewDiagram('dot', codeContent)}
          className="bg-blue-500 text-white hover:bg-blue-600 shadow-sm dark:bg-blue-700 dark:hover:bg-blue-800 font-sans"
        >
          <Maximize2 className="h-4 w-4 mr-2" />
          View Diagram
        </Button>
      </div>
    );
  }

  // Fallback for inline code or unhandled languages
  return (
    <code className="bg-purple-50 text-purple-700 px-2 py-1 rounded-md font-mono text-base md:text-lg border border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-700" {...props}>
      {children}
    </code>
  );
});

interface MemoizedMarkdownRendererProps {
  content: string;
  isUserMessage?: boolean;
  onMermaidError: (code: string, errorType: 'syntax' | 'rendering') => void;
  onSuggestAiCorrection: (prompt: string) => void;
  onViewDiagram: (type: 'mermaid' | 'dot' | 'chartjs' | 'code' | 'image' | 'unknown' | 'document-text' | 'threejs', content?: string, language?: string, imageUrl?: string) => void;
  onToggleUserMessageExpansion: (messageId: string) => void;
  expandedMessages: Set<string>;
}

export const MemoizedMarkdownRenderer: React.FC<MemoizedMarkdownRendererProps> = memo(({ content, isUserMessage, onMermaidError, onSuggestAiCorrection, onViewDiagram, onToggleUserMessageExpansion, expandedMessages }) => {
  const textColorClass = isUserMessage ? 'text-white dark:text-gray-100' : 'text-slate-700 dark:text-gray-300';
  const linkColorClass = isUserMessage ? 'text-blue-200 hover:underline dark:text-blue-400' : 'text-blue-600 hover:underline dark:text-blue-400';
  const listTextColorClass = isUserMessage ? 'text-white dark:text-gray-100' : 'text-slate-700 dark:text-gray-300';
  const blockquoteTextColorClass = isUserMessage ? 'text-blue-100 dark:text-blue-300' : 'text-slate-600 dark:text-gray-300';
  const blockquoteBgClass = isUserMessage ? 'bg-blue-700 border-blue-400 dark:bg-blue-900 dark:border-blue-600' : 'bg-blue-50 border-blue-500 dark:bg-blue-950 dark:border-blue-700';
  const MAX_USER_MESSAGE_LENGTH = 200; // Define a threshold for collapsing
  const isExpanded = expandedMessages.has(content); // Use content as key for now, ideally message.id
  const needsExpansion = isUserMessage && content.length > MAX_USER_MESSAGE_LENGTH;
  const displayedContent = needsExpansion && !isExpanded ? content.substring(0, MAX_USER_MESSAGE_LENGTH) + '...' : content;

  return (
    <CodeBlockErrorBoundary>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={{
          code: (props: any) => <CodeBlock {...props} onMermaidError={onMermaidError} onSuggestAiCorrection={onSuggestAiCorrection} onViewDiagram={onViewDiagram} />,
          h1: (props) => <h1 className={`text-2xl md:text-4xl font-extrabold ${isUserMessage ? 'text-white dark:text-gray-100' : 'text-blue-700 dark:text-blue-400'} mt-4 mb-2 font-sans`} {...props} />,
          h2: (props) => <h2 className={`text-xl md:text-3xl font-bold ${isUserMessage ? 'text-white dark:text-gray-100' : 'text-purple-700 dark:text-purple-400'} mt-3 mb-2 font-sans`} {...props} />,
          h3: (props) => <h3 className={`text-lg md:text-2xl font-semibold ${isUserMessage ? 'text-white dark:text-gray-100' : 'text-green-700 dark:text-green-400'} mt-2 mb-1 font-sans`} {...props} />,
          h4: (props) => <h4 className={`text-base md:text-xl font-semibold ${isUserMessage ? 'text-white dark:text-gray-100' : 'text-orange-700 dark:text-orange-400'} mt-1 mb-1 font-sans`} {...props} />,
          p: (props) => <p className={`mb-2 ${textColorClass} leading-relaxed prose-base md:prose-lg lg:prose-xl font-sans`} {...props} />,
          a: (props) => <a className={`${linkColorClass} font-medium font-sans`} {...props} />,
          ul: (props) => <ul className={`list-disc list-inside space-y-1 ${listTextColorClass} mb-2 text-base md:text-lg font-sans`} {...props} />,
          ol: (props) => <ol className={`list-decimal list-inside space-y-1 ${listTextColorClass} mb-2 text-base md:text-lg font-sans`} {...props} />,
          li: (props) => <li className="mb-1 text-base md:text-lg font-sans" {...props} />,
          blockquote: (props) => <blockquote className={`border-l-4 ${blockquoteBgClass} pl-4 py-2 italic ${blockquoteTextColorClass} rounded-r-md my-3 font-sans`} {...props} />,
          table: (props) => (
            <div className="overflow-x-auto my-4 rounded-lg shadow-md border border-slate-200 w-full dark:border-gray-700 font-sans">
              <table className="w-full border-collapse" {...props} />
            </div>
          ),
          thead: (props) => <thead className="bg-gradient-to-r from-blue-100 to-purple-100 dark:from-blue-900 dark:to-purple-900 font-sans" {...props} />,
          th: (props) => (
            <th className="p-3 text-left border-b border-slate-300 font-semibold text-slate-800 dark:border-gray-700 text-base md:text-lg font-sans" {...props} />
          ),
          td: (props) => (
            <td className="p-3 border-b border-slate-200 group-last:border-b-0 even:bg-slate-50 hover:bg-blue-50 transition-colors dark:border-gray-700 dark:even:bg-gray-800 dark:hover:bg-blue-950 dark:text-gray-300 text-base md:text-lg font-sans" {...props} />
          ),
        }}
      >
        {displayedContent}
      </ReactMarkdown>
      {needsExpansion && (
        <Button variant="link" size="sm" onClick={() => onToggleUserMessageExpansion(content)}
          className="text-white text-base md:text-base p-0 h-auto mt-1 flex items-center justify-end font-sans"
        >
          {isExpanded ? (
            <>
              Show Less
              <ChevronUp className="h-3 w-3 ml-1" />
            </>
          ) : (
            <>
              Show More
              <ChevronDown className="h-3 w-3 ml-1" />
            </>
          )}
        </Button>
      )}
    </CodeBlockErrorBoundary>
  );
});