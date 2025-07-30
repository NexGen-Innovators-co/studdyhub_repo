// components/CodeRenderer.tsx
import React, { useEffect, useRef, memo } from 'react';
import { useCopyToClipboard } from '../hooks/useCopyToClipboard';
import { AlertTriangle, Check, Copy, Loader2 } from 'lucide-react';
import { Button } from './ui/button';

// Import languages for syntax highlighting
import javascript from 'highlight.js/lib/languages/javascript';
import python from 'highlight.js/lib/languages/python';
import java from 'highlight.js/lib/languages/java';
import cpp from 'highlight.js/lib/languages/cpp';
import sql from 'highlight.js/lib/languages/sql';
import xml from 'highlight.js/lib/languages/xml';
import bash from 'highlight.js/lib/languages/bash';
import json from 'highlight.js/lib/languages/typescript'; // Using typescript for JSON highlighting

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
lowlight.registerLanguage('json', json as LanguageFn);

// Direct import for Graphviz
import { Graphviz } from '@hpcc-js/wasm';

// Direct import for Chart.js
import { Chart, registerables } from 'chart.js';
import { CodeBlockErrorBoundary } from './MarkdownRenderer';
import Mermaid from './Mermaid';
Chart.register(...registerables); // Register Chart.js components globally

// Define a mapping of highlight.js classes to Tailwind CSS color classes for dark theme
const syntaxColorMap: { [key: string]: string } = {
  'hljs-comment': 'text-gray-400', // Lighter grey for comments in dark mode
  'hljs-keyword': 'text-purple-300', // Lighter purple for keywords
  'hljs-built_in': 'text-cyan-300', // Lighter cyan for built-in functions/types
  'hljs-string': 'text-green-300', // Lighter green for strings
  'hljs-variable': 'text-blue-200', // Lighter blue for variables
  'hljs-number': 'text-orange-200', // Lighter orange for numbers
  'hljs-literal': 'text-orange-200', // Lighter orange for literals (true, false, null)
  'hljs-function': 'text-blue-200', // Lighter blue for function names
  'hljs-params': 'text-yellow-200', // Lighter yellow for function parameters
  'hljs-tag': 'text-pink-300', // Lighter pink for HTML/XML tags
  'hljs-attr': 'text-cyan-300', // Lighter cyan for HTML/XML attributes
  'hljs-selector-tag': 'text-purple-300', // Lighter purple for CSS selectors
  'hljs-selector-id': 'text-orange-300', // Lighter orange for CSS IDs
  'hljs-selector-class': 'text-green-300', // Lighter green for CSS classes
  'hljs-regexp': 'text-pink-300', // Lighter pink for regular expressions
  'hljs-meta': 'text-sky-300', // Lighter sky blue for meta information (e.g., #include)
  'hljs-type': 'text-teal-300', // Lighter teal for types
  'hljs-symbol': 'text-red-300', // Lighter red for symbols
  'hljs-operator': 'text-pink-200', // Lighter pink for operators
  // Default text color for code content not specifically highlighted
  'hljs-code-text': 'text-gray-100', // White-ish for general code text
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
        'hljs-comment': 'color: #9ca3af; font-style: italic;', // gray-400
        'hljs-keyword': 'color: #c084fc; font-weight: 600;', // purple-300
        'hljs-string': 'color: #86efac;', // green-300
        'hljs-number': 'color: #fdba74;', // orange-200
        'hljs-built_in': 'color: #93c5fd; font-weight: 500;', // blue-300
        'hljs-function': 'color: #93c5fd; font-weight: 500;', // blue-300
        'hljs-variable': 'color: #bfdbfe;', // blue-200
        'hljs-type': 'color: #5eead4;', // teal-300
        'hljs-class': 'color: #fcd34d;', // amber-300
        'hljs-attr': 'color: #93c5fd;', // blue-300
        'hljs-tag': 'color: #f472b6;', // pink-300
        'hljs-operator': 'color: #fbcfe8;', // pink-200
        'hljs-literal': 'color: #fdba74;', // orange-200
        'hljs-meta': 'color: #7dd3fc;', // sky-300
        'hljs-title': 'color: #86efac;', // green-300
        'hljs-selector-tag': 'color: #c084fc;', // purple-300
        'hljs-selector-class': 'color: #86efac;', // green-300
        'hljs-selector-id': 'color: #fca5a5;', // red-300
        'hljs-regexp': 'color: #f472b6;', // pink-300
        'hljs-symbol': 'color: #fca5a5;', // red-300
        'hljs-bullet': 'color: #fbcfe8;', // pink-200
        'hljs-params': 'color: #fde68a;', // yellow-200
        'hljs-name': 'color: #93c5fd;', // blue-300
        'hljs-attribute': 'color: #fcd34d;', // amber-300
        'hljs-selector-attr': 'color: #67e8f9;', // cyan-300
        'hljs-selector-pseudo': 'color: #fbcfe8;', // pink-200
        'hljs-template-variable': 'color: #bfdbfe;', // blue-200
        'hljs-quote': 'color: #9ca3af; font-style: italic;', // gray-400
        'hljs-deletion': 'color: #f87171; background-color: #450a0a;', // red-400, bg-red-950
        'hljs-addition': 'color: #4ade80; background-color: #064e3b;', // green-400, bg-green-950
        'hljs-meta-keyword': 'color: #7dd3fc; font-weight: 600;', // sky-300
        'hljs-meta-string': 'color: #38bdf8;', // sky-400
        'hljs-subst': 'color: #c084fc;', // purple-300
        'hljs-section': 'color: #86efac;', // green-300
        'hljs-boolean': 'color: #fdba74;', // orange-200
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

interface CodeRendererProps {
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export const CodeRenderer: React.FC<CodeRendererProps> = memo(({ inline, className, children }) => {
  const { copied, copy } = useCopyToClipboard();
  const match = /language-(\w+)/.exec(className || '');
  const lang = match && match[1];
  const codeContent = String(children).trim();

  const [dotSvgContent, setDotSvgContent] = React.useState<string | null>(null);
  const [dotError, setDotError] = React.useState<string | null>(null);
  const [isDotLoading, setIsDotLoading] = React.useState(false);
  const dotContainerRef = useRef<HTMLDivElement>(null);

  const chartCanvasRef = useRef<HTMLCanvasElement>(null);
  const chartInstanceRef = useRef<Chart | null>(null);
  const [chartJsError, setChartJsError] = React.useState<string | null>(null);
  const [isChartJsLoading, setIsChartJsLoading] = React.useState(false);
  const chartContainerRef = useRef<HTMLDivElement>(null);


  useEffect(() => {
    if (lang === 'dot' && codeContent) {
      setIsDotLoading(true);
      setDotError(null);
      setDotSvgContent(null);

      const renderDot = async () => {
        try {
          const gv = await Graphviz.load();
          const svg = gv.layout(codeContent, 'svg', 'dot');
          setDotSvgContent(svg);
        } catch (e: any) {
          console.error("DOT rendering error:", e);
          setDotError(`Failed to render DOT graph: ${e.message || 'Invalid DOT syntax.'}`);
        } finally {
          setIsDotLoading(false);
        }
      };
      renderDot();
    } else if (lang === 'dot' && !codeContent) {
      setDotSvgContent(null);
      setDotError(null);
      setIsDotLoading(false);
    }
  }, [codeContent, lang]);

  useEffect(() => {
    if (lang === 'chartjs' && codeContent) {
      setIsChartJsLoading(true);
      setChartJsError(null);

      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      }

      try {
        const cleanedCodeContent = codeContent.replace(/\/\/.*|\/\*[\s\S]*?\*\//g, '');
        const chartConfig = JSON.parse(cleanedCodeContent);
        if (chartCanvasRef.current) {
          const ctx = chartCanvasRef.current.getContext('2d');
          if (ctx) {
            chartInstanceRef.current = new Chart(ctx, chartConfig);

            if (chartContainerRef.current) {
              const resizeObserver = new ResizeObserver(() => {
                if (chartInstanceRef.current) {
                  chartInstanceRef.current.resize();
                }
              });
              resizeObserver.observe(chartContainerRef.current);

              return () => {
                resizeObserver.disconnect();
                if (chartInstanceRef.current) {
                  chartInstanceRef.current.destroy();
                  chartInstanceRef.current = null;
                }
              };
            }
          }
        }
      } catch (e: any) {
        console.error("Chart.js rendering error:", e);
        setChartJsError(`Failed to render Chart.js graph: ${e.message || 'Invalid JSON configuration.'}`);
      } finally {
        setIsChartJsLoading(false);
      }
    } else if (lang === 'chartjs' && !codeContent) {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      }
      setChartJsError(null);
      setIsChartJsLoading(false);
    }
    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      }
    };
  }, [codeContent, lang]);

  const mermaidDiagramRef = useRef<HTMLDivElement>(null);

  if (!inline && lang === 'mermaid') {
    return (
      <CodeBlockErrorBoundary
        fallback={
          <div className="my-4 p-4 bg-yellow-900 border border-yellow-700 rounded-lg">
            <div className="flex items-center gap-2 text-yellow-300">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm font-medium">Mermaid Diagram Error</span>
            </div>
            <p className="text-sm text-yellow-400 mt-1">
              Failed to render Mermaid diagram. Raw content:
            </p>
            <pre className="text-sm text-gray-300 mt-2 p-2 bg-gray-800 rounded overflow-x-auto">
              {codeContent}
            </pre>
          </div>
        }
      >
        <Mermaid
          chart={codeContent}
          onMermaidError={() => {}} // Placeholder for error handling
          diagramRef={mermaidDiagramRef}
          onSuggestAiCorrection={() => {}} // Placeholder for AI correction
        />
      </CodeBlockErrorBoundary>
    );
  }

  if (!inline && lang === 'dot') {
    return (
      <div className="my-4 p-3 sm:p-4 bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg shadow-sm border border-gray-700">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
              DOT Graph
            </span>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => copy(codeContent)}
              className="h-7 px-2 text-xs hover:bg-gray-700 whitespace-nowrap text-gray-300"
              title="Copy source code"
            >
              {copied ? <Check className="h-3 w-3 sm:mr-1 text-green-500" /> : <Copy className="h-3 w-3 sm:mr-1 text-gray-300" />}
              <span className="hidden sm:inline">Copy</span>
            </Button>
          </div>
        </div>

        {dotError && (
          <div className="my-2 p-3 bg-red-900 border border-red-700 rounded-md text-red-300 text-sm">
            <AlertTriangle className="inline h-4 w-4 mr-2" />
            {dotError}
            <pre className="mt-2 text-xs text-red-400 overflow-x-auto">{codeContent}</pre>
          </div>
        )}

        <div ref={dotContainerRef} className="relative w-full h-80 bg-gray-700 p-4 rounded-lg shadow-inner flex items-center justify-center">
          {isDotLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-700 bg-opacity-75 z-10">
              <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
            </div>
          )}
          {dotSvgContent && (
            <div
              className="dot-graph-container overflow-x-auto overflow-y-hidden p-2 w-full h-full"
              dangerouslySetInnerHTML={{ __html: dotSvgContent }}
            />
          )}
          {!isDotLoading && !dotError && !dotSvgContent && (
            <p className="text-sm text-gray-400">Enter DOT graph code to render.</p>
          )}
        </div>
      </div>
    );
  }

  if (!inline && lang === 'chartjs') {
    return (
      <div className="my-4 p-3 sm:p-4 bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg shadow-sm border border-gray-700">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
              Chart.js Graph
            </span>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => copy(codeContent)}
              className="h-7 px-2 text-xs hover:bg-gray-700 whitespace-nowrap text-gray-300"
              title="Copy source code"
            >
              {copied ? <Check className="h-3 w-3 sm:mr-1 text-green-500" /> : <Copy className="h-3 w-3 sm:mr-1 text-gray-300" />}
              <span className="hidden sm:inline">Copy</span>
            </Button>
          </div>
        </div>

        {chartJsError && (
          <div className="my-2 p-3 bg-red-900 border border-red-700 rounded-md text-red-300 text-sm">
            <AlertTriangle className="inline h-4 w-4 mr-2" />
            {chartJsError}
            <pre className="mt-2 text-xs text-red-400 overflow-x-auto">{codeContent}</pre>
          </div>
        )}

        <div ref={chartContainerRef} className="relative w-full h-80 bg-gray-700 p-4 rounded-lg shadow-inner flex items-center justify-center">
          {isChartJsLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-700 bg-opacity-75 z-10">
              <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
            </div>
          )}
          <canvas ref={chartCanvasRef}></canvas>
          {!isChartJsLoading && !chartJsError && !codeContent && (
            <p className="text-sm text-gray-400">Enter Chart.js configuration to render.</p>
          )}
        </div>
      </div>
    );
  }

  if (!inline && lang) {
    const isPlainText = lang === 'text' || lang === 'plaintext';
    const renderedCode = isPlainText ? escapeHtml(codeContent) : highlightCode(codeContent, lang);

    return (
      <div className="relative my-4 rounded-lg overflow-hidden shadow-sm border border-gray-700">
        <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-300 uppercase tracking-wide">
              {lang}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => copy(codeContent)}
              className="h-6 w-6 p-0 text-gray-400 hover:text-gray-100 hover:bg-gray-700"
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            </Button>
          </div>
        </div>

        <div className="p-4 bg-gray-900 overflow-x-auto">
          <pre className="font-mono text-sm leading-relaxed">
            <code
              className="text-gray-100"
              dangerouslySetInnerHTML={{
                __html: renderedCode
              }}
            />
          </pre>
        </div>
      </div>
    );
  }

  return (
    <code className="bg-purple-900 text-purple-300 px-2 py-1 rounded-md font-mono text-sm border border-purple-700">
      {children}
    </code>
  );
});
