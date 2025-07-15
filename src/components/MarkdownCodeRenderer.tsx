import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { Copy, Check, AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import Mermaid from './Mermaid';
import { useCopyToClipboard } from '../hooks/useCopyToClipboard';
import { CodeBlockErrorBoundary } from './AIChat'; // Assuming AIChat is in the same directory or accessible

// Import languages for syntax highlighting
import javascript from 'highlight.js/lib/languages/javascript';
import python from 'highlight.js/lib/languages/python';
import java from 'highlight.js/lib/languages/java';
import cpp from 'highlight.js/lib/languages/cpp';
import sql from 'highlight.js/lib/languages/sql';
import xml from 'highlight.js/lib/languages/xml';
import bash from 'highlight.js/lib/languages/bash';

// Create lowlight instance and register languages
import { lowlight } from 'lowlight';
import { LanguageFn } from 'highlight.js';
lowlight.registerLanguage('javascript', javascript as LanguageFn);
lowlight.registerLanguage('python', python as LanguageFn);
lowlight.registerLanguage('java', java as LanguageFn);
lowlight.registerLanguage('cpp', cpp as LanguageFn);
lowlight.registerLanguage('sql', sql as LanguageFn);
lowlight.registerLanguage('xml', xml as LanguageFn);
lowlight.registerLanguage('bash', bash as LanguageFn);

// Import graphviz for DOT rendering - Corrected import
import { Graphviz } from '@hpcc-js/wasm';

// Common interfaces for ReactMarkdown components
interface MarkdownElementProps<T> extends React.HTMLProps<T> {
  node: any; // ReactMarkdown adds a 'node' property
}

type TableProps = MarkdownElementProps<HTMLTableElement>;
type TableSectionProps = MarkdownElementProps<HTMLTableSectionElement>;
type TableCellProps = MarkdownElementProps<HTMLTableHeaderCellElement | HTMLTableDataCellElement>;
type HeadingProps = MarkdownElementProps<HTMLHeadingElement>;
type ListProps = MarkdownElementProps<HTMLUListElement | HTMLOListElement>;
type BlockquoteProps = MarkdownElementProps<HTMLQuoteElement>;
type ParagraphProps = MarkdownElementProps<HTMLParagraphElement>;
type AnchorProps = MarkdownElementProps<HTMLAnchorElement>;


// Define a mapping of highlight.js classes to Tailwind CSS color classes
const syntaxColorMap: { [key: string]: string } = {
  'hljs-comment': 'text-slate-500', // Grey for comments
  'hljs-keyword': 'text-purple-400', // Purple for keywords
  'hljs-built_in': 'text-cyan-400', // Cyan for built-in functions/types
  'hljs-string': 'text-green-400', // Green for strings
  'hljs-variable': 'text-blue-300', // Blue for variables
  'hljs-number': 'text-orange-300', // Orange for numbers
  'hljs-literal': 'text-orange-300', // Orange for literals (true, false, null)
  'hljs-function': 'text-blue-300', // Blue for function names
  'hljs-params': 'text-yellow-300', // Yellow for function parameters
  'hljs-tag': 'text-pink-400', // Pink for HTML/XML tags
  'hljs-attr': 'text-cyan-400', // Cyan for HTML/XML attributes
  'hljs-selector-tag': 'text-purple-400', // Purple for CSS selectors
  'hljs-selector-id': 'text-orange-400', // Orange for CSS IDs
  'hljs-selector-class': 'text-green-400', // Green for CSS classes
  'hljs-regexp': 'text-pink-400', // Pink for regular expressions
  'hljs-meta': 'text-sky-400', // Sky blue for meta information (e.g., #include)
  'hljs-type': 'text-teal-400', // Teal for types
  'hljs-symbol': 'text-red-400', // Red for symbols
  'hljs-operator': 'text-pink-300', // Pink for operators
  // Default text color for code content not specifically highlighted
  'hljs-code-text': 'text-white',
};

// Helper function to escape HTML
const escapeHtml = (text: string) => {
  const map: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
};

// Helper function to convert lowlight result to HTML with inline styles
const toHtml = (result: any) => {
  const nodeToHtml = (node: any): string => {
    if (node.type === 'text') {
      return escapeHtml(node.value);
    }
    if (node.type === 'element') {
      const { tagName, properties, children } = node;
      const classNames = (properties?.className || []).join(' ');

      // Map highlight.js classes to inline styles for guaranteed rendering
      const styleMap: { [key: string]: string } = {
        'hljs-comment': 'color: #6b7280; font-style: italic;',
        'hljs-keyword': 'color: #7c3aed; font-weight: 600;',
        'hljs-string': 'color: #059669;',
        'hljs-number': 'color: #ea580c;',
        'hljs-built_in': 'color: #2563eb; font-weight: 500;',
        'hljs-function': 'color: #1d4ed8; font-weight: 500;',
        'hljs-variable': 'color: #1e40af;',
        'hljs-type': 'color: #0d9488;',
        'hljs-class': 'color: #d97706;',
        'hljs-attr': 'color: #d97706;',
        'hljs-tag': 'color: #dc2626;',
        'hljs-operator': 'color: #db2777;',
        'hljs-literal': 'color: #ea580c;',
        'hljs-meta': 'color: #0284c7;',
        'hljs-title': 'color: #059669;',
        'hljs-selector-tag': 'color: #7c3aed;',
        'hljs-selector-class': 'color: #059669;',
        'hljs-selector-id': 'color: #dc2626;',
        'hljs-regexp': 'color: #be185d;',
        'hljs-symbol': 'color: #dc2626;',
        'hljs-bullet': 'color: #db2777;',
        'hljs-params': 'color: #b45309;',
        'hljs-name': 'color: #1d4ed8;',
        'hljs-attribute': 'color: #d97706;',
        'hljs-selector-attr': 'color: #0891b2;',
        'hljs-selector-pseudo': 'color: #db2777;',
        'hljs-template-variable': 'color: #1e40af;',
        'hljs-quote': 'color: #6b7280; font-style: italic;',
        'hljs-deletion': 'color: #b91c1c; background-color: #fef2f2;',
        'hljs-addition': 'color: #166534; background-color: #f0fdf4;',
        'hljs-meta-keyword': 'color: #0284c7; font-weight: 600;',
        'hljs-meta-string': 'color: #0369a1;',
        'hljs-subst': 'color: #7c3aed;',
        'hljs-section': 'color: #059669;',
        'hljs-boolean': 'color: #ea580c;',
      };

      let style = '';
      classNames.split(' ').forEach(cls => {
        if (styleMap[cls]) {
          style += styleMap[cls] + ' ';
        }
      });

      const childrenHtml = children?.map(nodeToHtml).join('') || '';
      return `<${tagName}${style ? ` style="${style.trim()}"` : ''}>${childrenHtml}</${tagName}>`;
    }
    return '';
  };

  return result.children.map(nodeToHtml).join('');
};

// Enhanced syntax highlighting function
const highlightCode = (code: string, language: string) => {
  try {
    const result = lowlight.highlight(language, code);
    return toHtml(result);
  } catch (error) {
    console.warn('Syntax highlighting failed:', error);
    return escapeHtml(code);
  }
};

interface MarkdownCodeRendererProps {
  inline?: boolean;
  className?: string;
  children: React.ReactNode;
}

export const MarkdownCodeRenderer: React.FC<MarkdownCodeRendererProps> = ({ inline, className, children, ...props }) => {
  const { copied, copy } = useCopyToClipboard();
  const match = /language-(\w+)/.exec(className || '');
  const lang = match && match[1];
  const codeContent = String(children).trim();

  // State for DOT graph rendering
  const [svgContent, setSvgContent] = useState<string | null>(null);
  const [dotError, setDotError] = useState<string | null>(null);
  const [isDotLoading, setIsDotLoading] = useState(false);

  useEffect(() => {
    if (lang === 'dot' && codeContent) {
      setIsDotLoading(true);
      setDotError(null);
      setSvgContent(null);

      const renderDot = async () => {
        try {
          // Use Graphviz directly as an object, not a constructor
            const graphviz = await Graphviz.load(); // Corrected: Use .load()
          const svg = graphviz.layout(codeContent, 'svg', 'dot'); // Corrected: Use .layout()
          setSvgContent(svg);
        } catch (e: any) {
          console.error("DOT rendering error:", e);
          setDotError(`Failed to render DOT graph: ${e.message || 'Invalid DOT syntax.'}`);
        } finally {
          setIsDotLoading(false);
        }
      };
      renderDot();
    }
  }, [codeContent, lang]);

  // Create a ref for the Mermaid component
  const mermaidDiagramRef = useRef<HTMLDivElement>(null);

  // Handle Mermaid diagrams
  if (!inline && lang === 'mermaid') {
    return (
      <CodeBlockErrorBoundary
        fallback={
          <div className="my-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center gap-2 text-yellow-700">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm font-medium">Mermaid Diagram Error</span>
            </div>
            <p className="text-sm text-yellow-600 mt-1">
              Failed to render Mermaid diagram. Raw content:
            </p>
            <pre className="text-sm text-gray-600 mt-2 p-2 bg-gray-50 rounded overflow-x-auto">
              {codeContent}
            </pre>
          </div>
        }
      >
        {/* Pass the mermaidDiagramRef to the Mermaid component */}
        <Mermaid
          chart={codeContent}
          onMermaidError={() => { }} // Provide an empty function or a proper handler
          diagramRef={mermaidDiagramRef}
        // onSuggestAiCorrection is optional, so no need to pass if not needed here
        />
      </CodeBlockErrorBoundary>
    );
  }

  // Handle DOT diagrams
  if (!inline && lang === 'dot') {
    return (
      <div className="my-4 p-4 bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            DOT Graph
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => copy(codeContent)}
            className="h-6 w-6 p-0"
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          </Button>
        </div>
        {isDotLoading && (
          <div className="flex items-center justify-center py-4 text-blue-600">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            <span>Rendering DOT graph...</span>
          </div>
        )}
        {dotError && (
          <div className="my-2 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
            <AlertTriangle className="inline h-4 w-4 mr-2" />
            {dotError}
            <pre className="mt-2 text-xs text-red-600 overflow-x-auto">{codeContent}</pre>
          </div>
        )}
        {svgContent && (
          <div
            className="dot-graph-container overflow-x-auto overflow-y-hidden p-2"
            dangerouslySetInnerHTML={{ __html: svgContent }}
          />
        )}
        {!isDotLoading && !dotError && !svgContent && (
          <p className="text-sm text-gray-500 text-center py-4">No DOT graph content to display or invalid syntax.</p>
        )}
      </div>
    );
  }

  // Handle code blocks with syntax highlighting
  if (!inline && lang) {
    return (
      <div className="relative my-4 rounded-lg overflow-hidden shadow-sm border border-gray-200">
        {/* Header with language badge and copy button */}
        <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-400"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
            <div className="w-3 h-3 rounded-full bg-green-400"></div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">
              {lang}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => copy(codeContent)}
              className="h-6 w-6 p-0"
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            </Button>
          </div>
        </div>

        {/* Code content with enhanced syntax highlighting */}
        <div className="p-4 bg-white overflow-x-auto">
          <pre className="font-mono text-sm leading-relaxed">
            <code
              className="text-gray-800"
              dangerouslySetInnerHTML={{
                __html: highlightCode(codeContent, lang)
              }}
            />
          </pre>
        </div>
      </div>
    );
  }

  // Inline code
  return (
    <code className="bg-purple-50 text-purple-700 px-2 py-1 rounded-md font-mono text-sm border border-purple-200" {...props}>
      {children}
    </code>
  );
};
