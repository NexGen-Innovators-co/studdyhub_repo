import React, { useState, useRef, useEffect, memo, useCallback } from 'react';
import { Send, Bot, User, Loader2, FileText, History, X, RefreshCw, AlertTriangle, Copy, Check, Maximize2, Minimize2, Trash2 } from 'lucide-react'; // Added Trash2 for delete icon
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Message } from '../types/Class';
import { UserProfile, Document } from '../types/Document';
import { Note } from '../types/Note';
import { supabase } from '@/integrations/supabase/client';
import { DocumentSelector } from './DocumentSelector';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import Mermaid from './Mermaid';
import { Element } from 'hast';
import { Chart, registerables } from 'chart.js';
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
import { lowlight } from 'lowlight';
import { LanguageFn } from 'highlight.js';

Chart.register(...registerables);

const registerLanguages = () => {
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
    console.warn('Error registering syntax highlighting languages:', error);
  }
};

registerLanguages();

const syntaxColorMap: { [key: string]: string } = {
  'hljs-comment': 'text-gray-500 italic',
  'hljs-quote': 'text-gray-500 italic',
  'hljs-keyword': 'text-purple-600 font-semibold',
  'hljs-selector-tag': 'text-purple-600',
  'hljs-subst': 'text-purple-600',
  'hljs-built_in': 'text-blue-600 font-medium',
  'hljs-type': 'text-teal-600',
  'hljs-class': 'text-amber-600',
  'hljs-string': 'text-green-600',
  'hljs-title': 'text-green-600',
  'hljs-section': 'text-green-600',
  'hljs-number': 'text-orange-600',
  'hljs-literal': 'text-orange-600',
  'hljs-boolean': 'text-orange-600',
  'hljs-variable': 'text-blue-700',
  'hljs-template-variable': 'text-blue-700',
  'hljs-function': 'text-blue-700 font-medium',
  'hljs-name': 'text-blue-700',
  'hljs-params': 'text-amber-700',
  'hljs-attr': 'text-amber-600',
  'hljs-attribute': 'text-amber-600',
  'hljs-tag': 'text-red-600',
  'hljs-selector-id': 'text-red-600',
  'hljs-selector-class': 'text-green-600',
  'hljs-selector-attr': 'text-cyan-600',
  'hljs-selector-pseudo': 'text-pink-600',
  'hljs-operator': 'text-pink-600',
  'hljs-symbol': 'text-red-600',
  'hljs-bullet': 'text-pink-600',
  'hljs-regexp': 'text-pink-700',
  'hljs-meta': 'text-sky-600',
  'hljs-meta-keyword': 'text-sky-600 font-semibold',
  'hljs-meta-string': 'text-sky-700',
  'hljs-addition': 'text-green-700 bg-green-100',
  'hljs-deletion': 'text-red-700 bg-red-100',
  'hljs-emphasis': 'italic',
  'hljs-strong': 'font-bold',
  'hljs-code-text': 'text-gray-800',
};

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
        <div className="my-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2 text-red-700">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm font-medium">Rendering Error</span>
          </div>
          <p className="text-sm text-red-600 mt-1">
            Failed to render this content. Please try refreshing or contact support if the issue persists.
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}

export const useCopyToClipboard = () => {
  const [copied, setCopied] = useState(false);

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('Code copied to clipboard!');
    } catch (err) {
      toast.error('Failed to copy code');
    }
  };

  return { copied, copy };
};

const renderHighlightedCode = (result: any) => {
  const renderNode = (node: any, index: number): React.ReactNode => {
    if (node.type === 'text') {
      return node.value;
    }
    if (node.type === 'element') {
      const { tagName, properties, children } = node;
      const originalClasses = (properties?.className || []);
      const mappedClasses = originalClasses.map((cls: string) => {
        return syntaxColorMap[cls] || '';
      }).filter(Boolean).join(' ');
      const finalClassName = mappedClasses || 'text-gray-800';

      const props = {
        key: index,
        className: finalClassName,
        ...(properties || {}),
      };

      return React.createElement(
        tagName,
        props,
        children?.map((child: any, childIndex: number) => renderNode(child, childIndex))
      );
    }
    return null;
  };

  return result.children.map((node: any, index: number) => renderNode(node, index));
};

interface ChartRendererProps {
  chartConfig: any;
}

const ChartRenderer: React.FC<ChartRendererProps> = ({ chartConfig }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<any>(null);

  useEffect(() => {
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        if (chartInstance.current) {
          chartInstance.current.destroy();
        }
        chartInstance.current = new Chart(ctx, chartConfig);
      }
    }

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
        chartInstance.current = null;
      }
    };
  }, [chartConfig]);

  return (
    <div className="relative w-full h-80 bg-white p-4 rounded-lg shadow-inner">
      <canvas ref={canvasRef}></canvas>
    </div>
  );
};

// New DiagramPanel component
interface DiagramPanelProps {
  diagramContent: string;
  diagramType: 'mermaid' | 'dot' | 'chartjs' | 'unknown'; // Added diagramType
  onClose: () => void;
  onMermaidError: (code: string, errorType: 'syntax' | 'rendering') => void;
  onSuggestAiCorrection: (prompt: string) => void;
  isOpen: boolean; // Added isOpen prop for controlled visibility
}

const DiagramPanel: React.FC<DiagramPanelProps> = ({ diagramContent, diagramType, onClose, onMermaidError, onSuggestAiCorrection, isOpen }) => {
  let panelContent;
  let panelTitle = 'Diagram View';

  if (diagramType === 'mermaid') {
    panelContent = (
      <Mermaid chart={diagramContent} onMermaidError={onMermaidError} onSuggestAiCorrection={onSuggestAiCorrection} />
    );
    panelTitle = 'Mermaid Diagram View';
  } else if (diagramType === 'dot') {
    // Placeholder for DOT graph rendering. You would integrate a library like Viz.js here.
    // For now, it shows the raw code and a suggestion button.
    panelContent = (
      <div className="flex flex-col items-center justify-center h-full p-4">
        <p className="text-slate-600 mb-2">DOT Graph Rendering Coming Soon!</p>
        <pre className="bg-gray-100 p-3 rounded-md text-sm overflow-x-auto max-w-full">
          {diagramContent}
        </pre>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onSuggestAiCorrection(`Can you fix or generate a DOT graph for me? Here's the code: ${diagramContent}`)}
          className="mt-4 bg-blue-500 text-white hover:bg-blue-600"
        >
          Suggest AI Correction
        </Button>
      </div>
    );
    panelTitle = 'DOT Graph View';
  } else if (diagramType === 'chartjs') {
     try {
      const chartConfig = JSON.parse(diagramContent);
      panelContent = <ChartRenderer chartConfig={chartConfig} />;
      panelTitle = 'Chart.js Graph View';
    } catch (e) {
      panelContent = (
        <div className="text-red-700 p-4">
          <p>Invalid Chart.js configuration.</p>
          <pre className="bg-gray-100 p-3 rounded-md text-sm overflow-x-auto max-w-full">
            {diagramContent}
          </pre>
           <Button
            variant="outline"
            size="sm"
            onClick={() => onSuggestAiCorrection(`Can you fix this Chart.js configuration? Here's the code: ${diagramContent}`)}
            className="mt-4 bg-blue-500 text-white hover:bg-blue-600"
          >
            Suggest AI Correction
          </Button>
        </div>
      );
      panelTitle = 'Chart.js Error';
    }
  }
   else {
    panelContent = (
      <div className="flex flex-col items-center justify-center h-full text-slate-500">
        <AlertTriangle className="h-8 w-8 mb-2" />
        <p>Unsupported Diagram Type</p>
        <pre className="bg-gray-100 p-3 rounded-md text-sm overflow-x-auto max-w-full mt-2">
          {diagramContent}
        </pre>
      </div>
    );
    panelTitle = 'Unsupported Diagram';
  }

  return (
    <div className={`
      absolute inset-y-0 right-0 w-full bg-slate-50 border-l border-slate-200 shadow-xl flex flex-col z-40 transition-transform duration-300 ease-in-out
      ${isOpen ? 'translate-x-0' : 'translate-x-full'}
      md:relative md:translate-x-0 md:w-1/2 lg:w-2/5 md:border-t md:rounded-lg md:shadow-md
    `}>
      <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-white">
        <h3 className="text-lg font-semibold text-slate-800">{panelTitle}</h3>
        <Button variant="ghost" size="icon" onClick={onClose} title="Close Diagram">
          <X className="h-5 w-5 text-slate-500 hover:text-slate-700" />
        </Button>
      </div>
      <div className="flex-1 overflow-auto p-4 sm:p-6">
        {panelContent}
      </div>
    </div>
  );
};


const CodeBlock = memo(({ node, inline, className, children, onMermaidError, onSuggestAiCorrection, onViewDiagram, ...props }: any) => {
  const { copied, copy } = useCopyToClipboard();
  const match = /language-(\w+)/.exec(className || '');
  const lang = match && match[1];
  const codeContent = String(children).trim();
  const [showRawCode, setShowRawCode] = useState(false);

  if (showRawCode) {
    return (
      <div className="relative my-4 rounded-lg overflow-hidden shadow-sm border border-gray-200">
        <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200">
          <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">
            Raw Code ({lang})
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowRawCode(false)}
            className="h-6 w-6 p-0 text-gray-500 hover:text-gray-700 hover:bg-gray-100"
            title="Attempt rendering"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
        <div className="p-4 bg-white overflow-x-auto">
          <pre className="font-mono text-sm leading-relaxed">
            <code className="text-gray-800">{codeContent}</code>
          </pre>
        </div>
      </div>
    );
  }

  if (!inline && lang === 'mermaid') {
    // Render a button to view the diagram in the side panel
    return (
      <div className="my-4 p-3 bg-slate-100 border border-slate-200 rounded-lg flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-700">
          <FileText className="h-4 w-4" />
          <span className="text-sm font-medium">Mermaid Diagram</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onViewDiagram && onViewDiagram(codeContent, 'mermaid')}
          className="bg-blue-500 text-white hover:bg-blue-600 shadow-sm"
        >
          <Maximize2 className="h-4 w-4 mr-2" />
          View Diagram
        </Button>
      </div>
    );
  }

  if (!inline && lang === 'chartjs') {
    try {
      const chartConfig = JSON.parse(codeContent);
      return (
        <div className="my-4 p-4 bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Chart.js Graph
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
          <ChartRenderer chartConfig={chartConfig} />
          <div className="flex gap-2 mt-3 justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onViewDiagram && onViewDiagram(codeContent, 'chartjs')}
              className="bg-blue-500 text-white hover:bg-blue-600 shadow-sm"
            >
              <Maximize2 className="h-4 w-4 mr-2" />
              View Full Chart
            </Button>
          </div>
        </div>
      );
    } catch (e) {
      console.error("Error parsing Chart.js config:", e);
      return (
        <div className="my-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2 text-red-700">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm font-medium">Chart.js Error</span>
          </div>
          <p className="text-sm text-red-600 mt-1">
            Invalid Chart.js JSON configuration. Please check the code.
          </p>
          <pre className="text-sm text-gray-600 mt-2 p-2 bg-gray-50 rounded overflow-x-auto">
            {codeContent}
          </pre>
          <div className="flex gap-2 mt-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => copy(codeContent)}
              className="text-slate-600 border-slate-200 hover:bg-slate-50"
            >
              {copied ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
              Copy Code
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onSuggestAiCorrection && onSuggestAiCorrection(`Can you fix this Chart.js configuration? Here's the code: ${codeContent}`)}
              className="bg-blue-500 text-white hover:bg-blue-600"
            >
              Suggest AI Correction
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowRawCode(true)}
              className="text-slate-600 border-slate-200 hover:bg-slate-50"
            >
              Show Raw Code
            </Button>
          </div>
        </div>
      );
    }
  }

  if (!inline && lang === 'dot') {
    // Render a button to view the diagram in the side panel for DOT graphs
    return (
      <div className="my-4 p-3 bg-slate-100 border border-slate-200 rounded-lg flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-700">
          <FileText className="h-4 w-4" />
          <span className="text-sm font-medium">DOT Graph</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onViewDiagram && onViewDiagram(codeContent, 'dot')}
          className="bg-blue-500 text-white hover:bg-blue-600 shadow-sm"
        >
          <Maximize2 className="h-4 w-4 mr-2" />
          View Diagram
        </Button>
      </div>
    );
  }

  if (!inline && lang) {
    return (
      <div className="relative my-4 rounded-lg overflow-hidden shadow-sm border border-gray-200">
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
              className="h-6 w-6 p-0 text-gray-500 hover:text-gray-700 hover:bg-gray-100"
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            </Button>
          </div>
        </div>
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

  return (
    <code className="bg-purple-50 text-purple-700 px-2 py-1 rounded-md font-mono text-sm border border-purple-200" {...props}>
      {children}
    </code>
  );
});

const highlightCode = (code: string, language: string) => {
  try {
    const result = lowlight.highlight(language, code);
    return toHtml(result);
  } catch (error) {
    console.warn('Syntax highlighting failed:', error);
    return escapeHtml(code);
  }
};

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

const toHtml = (result: any) => {
  const nodeToHtml = (node: any): string => {
    if (node.type === 'text') {
      return escapeHtml(node.value);
    }
    if (node.type === 'element') {
      const { tagName, properties, children } = node;
      const classNames = (properties?.className || []).join(' ');
      const styleMap: { [key: string]: string } = {
        'hljs-comment': 'color: #6b7280; font-style: italic;',
        'hljs-keyword': 'color: #7c3aed; font-weight: 600;',
        'hljs-string': 'color: #059669;',
        'hljs-number': 'color: #ea580c;',
        'hljs-built_in': 'color: #2563eb; font-weight: 500;',
        'hljs-function': 'color: #1d4ed8;',
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

const MarkdownRenderer: React.FC<{ content: string; isUserMessage?: boolean; onMermaidError: (code: string, errorType: 'syntax' | 'rendering') => void; onSuggestAiCorrection: (prompt: string) => void; onViewDiagram: (code: string, type: 'mermaid' | 'dot' | 'chartjs' | 'unknown') => void; }> = ({ content, isUserMessage, onMermaidError, onSuggestAiCorrection, onViewDiagram }) => {
  const textColorClass = isUserMessage ? 'text-white' : 'text-slate-700';
  const linkColorClass = isUserMessage ? 'text-blue-200 hover:underline' : 'text-blue-600 hover:underline';
  const listTextColorClass = isUserMessage ? 'text-white' : 'text-slate-700';
  const blockquoteTextColorClass = isUserMessage ? 'text-blue-100' : 'text-slate-600';
  const blockquoteBgClass = isUserMessage ? 'bg-blue-700 border-blue-400' : 'bg-blue-50 border-blue-500';

  return (
    <CodeBlockErrorBoundary>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={{
          code: (props) => <CodeBlock {...props} onMermaidError={onMermaidError} onSuggestAiCorrection={onSuggestAiCorrection} onViewDiagram={onViewDiagram} />,
          h1: ({ node, ...props }) => <h1 className={`text-2xl font-extrabold ${isUserMessage ? 'text-white' : 'text-blue-700'} mt-4 mb-2`} {...props} />,
          h2: ({ node, ...props }) => <h2 className={`text-xl font-bold ${isUserMessage ? 'text-white' : 'text-purple-700'} mt-3 mb-2`} {...props} />,
          h3: ({ node, ...props }) => <h3 className={`text-lg font-semibold ${isUserMessage ? 'text-white' : 'text-green-700'} mt-2 mb-1`} {...props} />,
          h4: ({ node, ...props }) => <h4 className={`text-base font-semibold ${isUserMessage ? 'text-white' : 'text-orange-700'} mt-1 mb-1`} {...props} />,
          p: ({ node, ...props }) => <p className={`mb-2 ${textColorClass} leading-relaxed`} {...props} />,
          a: ({ node, ...props }) => <a className={`${linkColorClass} font-medium`} {...props} />,
          ul: ({ node, ...props }) => <ul className={`list-disc list-inside space-y-1 ${listTextColorClass} mb-2`} {...props} />,
          ol: ({ node, ...props }) => <ol className={`list-decimal list-inside space-y-1 ${listTextColorClass} mb-2`} {...props} />,
          li: ({ node, ...props }) => <li className="mb-1" {...props} />,
          blockquote: ({ node, ...props }) => <blockquote className={`border-l-4 ${blockquoteBgClass} pl-4 py-2 italic ${blockquoteTextColorClass} rounded-r-md my-3`} {...props} />,
          table: ({ node, ...props }) => (
            <div className="overflow-x-auto my-4 rounded-lg shadow-md border border-slate-200">
              <table className="w-full border-collapse" {...props} />
            </div>
          ),
          thead: ({ node, ...props }) => <thead className="bg-gradient-to-r from-blue-100 to-purple-100" {...props} />,
          th: ({ node, ...props }) => (
            <th className="p-3 text-left border-b border-slate-300 font-semibold text-slate-800" {...props} />
          ),
          td: ({ node, ...props }) => (
            <td className="p-3 border-b border-slate-200 group-last:border-b-0 even:bg-slate-50 hover:bg-blue-50 transition-colors" {...props} />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </CodeBlockErrorBoundary>
  );
};

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({ isOpen, onClose, onConfirm, title, message }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="bg-white rounded-lg shadow-xl max-w-sm w-full">
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-3">{title}</h3>
          <p className="text-slate-600 mb-6">{message}</p>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onClose} className="text-slate-600 border-slate-200 hover:bg-slate-50">
              Cancel
            </Button>
            <Button onClick={onConfirm} className="bg-red-600 text-white shadow-md hover:bg-red-700">
              Delete
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

interface ChatSession {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  last_message_at: string;
  document_ids: string[];
  message_count?: number;
}

interface AIChatProps {
  messages: Message[];
  onSendMessage: (message: string) => Promise<void>;
  isLoading: boolean;
  setIsLoading: (isLoading: boolean) => void;
  userProfile: UserProfile | null;
  documents: Document[];
  notes: Note[];
  selectedDocumentIds: string[];
  onSelectionChange: (ids: string[]) => void;
  activeChatSessionId: string | null;
  onNewChatSession: () => Promise<string | null>;
  onDeleteChatSession: (sessionId: string) => void;
  onRenameChatSession: (sessionId: string, newTitle: string) => void;
  onChatSessionSelect: (sessionId: string) => void;
  chatSessions: ChatSession[];
  onNewMessage: (message: Message) => void;
  onDeleteMessage: (messageId: string) => void;
  onRegenerateResponse: (lastUserMessageContent: string) => Promise<void>;
  onRetryFailedMessage: (originalUserMessageContent: string, failedAiMessageId: string) => Promise<void>;
  isSubmittingUserMessage: boolean;
  // New props for message pagination
  hasMoreMessages: boolean;
  onLoadOlderMessages: () => Promise<void>;
}

const AIChatComponent: React.FC<AIChatProps> = ({
  messages,
  onSendMessage,
  isLoading,
  setIsLoading,
  userProfile,
  documents,
  notes,
  selectedDocumentIds,
  onSelectionChange,
  activeChatSessionId,
  onNewChatSession,
  onNewMessage,
  onDeleteMessage,
  onRegenerateResponse,
  onRetryFailedMessage,
  isSubmittingUserMessage,
  hasMoreMessages, // Destructure new prop
  onLoadOlderMessages, // Destructure new prop
}) => {
  const [inputMessage, setInputMessage] = useState('');
  const [showDocumentSelector, setShowDocumentSelector] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevMessagesLengthRef = useRef(messages.length);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // State for the side-out diagram panel
  const [activeDiagram, setActiveDiagram] = useState<{ content: string; type: 'mermaid' | 'dot' | 'chartjs' | 'unknown' } | null>(null);
  const isDiagramPanelOpen = !!activeDiagram; // Derived state

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    // Only scroll to bottom if new messages are added, not when older messages are prepended
    if (messages.length > prevMessagesLengthRef.current && messages[messages.length - 1]?.role !== 'user') { // Check if last message is not user's (i.e., AI response or new chat)
      scrollToBottom();
    } else if (messages.length > prevMessagesLengthRef.current && messages[messages.length - 1]?.role === 'user' && prevMessagesLengthRef.current === 0) {
      // Scroll to bottom on first user message in a new chat
      scrollToBottom();
    }
    prevMessagesLengthRef.current = messages.length;
  }, [messages]);

  useEffect(() => {
    setInputMessage('');
  }, [activeChatSessionId]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [inputMessage]);

  const handleDeleteClick = (messageId: string) => {
    setMessageToDelete(messageId);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = () => {
    if (messageToDelete) {
      onDeleteMessage(messageToDelete);
      setMessageToDelete(null);
      setShowDeleteConfirm(false);
    }
  };

  const handleRegenerateClick = (lastUserMessageContent: string) => {
    onRegenerateResponse(lastUserMessageContent);
  };

  const handleRetryClick = (originalUserMessageContent: string, failedAiMessageId: string) => {
    onRetryFailedMessage(originalUserMessageContent, failedAiMessageId);
  };

  const handleMermaidError = (code: string, errorType: 'syntax' | 'rendering') => {
    toast.info(`Mermaid diagram encountered a ${errorType} error. Click 'AI Fix' to get help.`);
  };

  const handleSuggestMermaidAiCorrection = useCallback((prompt: string) => {
    setInputMessage(prompt);
    textareaRef.current?.focus();
  }, []);

  // New callback to handle viewing a diagram in the side panel
  const handleViewDiagram = useCallback((code: string, type: 'mermaid' | 'dot' | 'chartjs' | 'unknown' = 'unknown') => {
    setActiveDiagram({ content: code, type: type });
  }, []);

  const handleCloseDiagramPanel = useCallback(() => {
    setActiveDiagram(null);
  }, []);

  const displayMessages = messages;
  const lastMessageIsAssistant = displayMessages.length > 0 && displayMessages[displayMessages.length - 1].role === 'assistant';

  return (
    <CodeBlockErrorBoundary>
      <div className="flex flex-col h-full relative bg-slate-50 overflow-hidden md:flex-row">
        {/* Main Chat Area */}
        <div className={`
          flex-1 flex flex-col h-full bg-white rounded-lg shadow-md border border-slate-200 transition-all duration-300 ease-in-out
          ${isDiagramPanelOpen ? 'md:w-1/2 lg:w-3/5' : 'w-full'}
          ${isDiagramPanelOpen ? 'md:mr-4' : ''}
        `}>
          {/* Removed the header section */}
          {/* Adjusted padding: pb-[calc(4rem+2rem)] for mobile, md:pb-6 for desktop */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-slate-50 flex flex-col modern-scrollbar pb-[calc(4rem+2rem)] md:pb-6">
            {(displayMessages ?? []).length === 0 && (activeChatSessionId === null) && (
              <div className="text-center py-8 text-slate-400 flex-grow flex flex-col justify-center items-center">
                <Bot className="h-12 w-12 mx-auto text-slate-300 mb-4" />
                <h3 className="text-lg font-medium text-slate-700 mb-2">Welcome to your AI Study Assistant!</h3>
                <p className="text-sm text-slate-500 max-w-md mx-auto">
                  I can help you with questions about your notes, create study guides, explain concepts,
                  and assist with your academic work. Select some documents and start chatting!
                </p>
              </div>
            )}
            {activeChatSessionId !== null && messages.length === 0 && isLoading && (
              <div className="flex gap-3 justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                <span className="text-slate-500">Loading messages...</span>
              </div>
            )}

            {/* Load Older Messages Button */}
            {hasMoreMessages && !isLoading && messages.length > 0 && (
              <div className="flex justify-center py-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onLoadOlderMessages}
                  className="text-slate-600 border-slate-200 hover:bg-slate-100"
                >
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Load Older Messages
                </Button>
              </div>
            )}

            {(displayMessages ?? []).map((message, index) => {
              let cardClasses = '';
              let contentToRender;

              if (message.role === 'user') {
                cardClasses = 'bg-gradient-to-r from-blue-600 to-purple-600 text-white';
                contentToRender = <p className="text-white leading-relaxed">{message.content}</p>;
              } else { // message.role === 'assistant'
                if (message.isError) {
                  cardClasses = 'bg-red-50 border border-red-200 text-red-800';
                } else {
                  cardClasses = 'bg-white border border-slate-200';
                }
                contentToRender = <MarkdownRenderer content={message.content} isUserMessage={false} onMermaidError={handleMermaidError} onSuggestAiCorrection={handleSuggestMermaidAiCorrection} onViewDiagram={handleViewDiagram} />;
              }

              const isLastAIMessage = message.role === 'assistant' && index === displayMessages.length - 1;

              return (
                <div key={message.id} className="flex justify-center">
                  <div className={`
                    w-full max-w-4xl flex gap-3 group
                    ${message.role === 'user' ? 'justify-end' : 'justify-start'}
                  `}>
                    {message.role === 'assistant' && (
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${message.isError ? 'bg-red-500' : 'bg-gradient-to-r from-blue-600 to-purple-600'
                        }`}>
                        {message.isError ? <AlertTriangle className="h-4 w-4 text-white" /> : <Bot className="h-4 w-4 text-white" />}
                      </div>
                    )}
                    <div className={`flex flex-col ${message.role === 'user' ? 'items-end' : 'items-start'}`}>
                      <Card className={`max-w-xs sm:max-w-md md:max-w-lg p-1 overflow-hidden rounded-lg shadow-sm ${cardClasses}`}>
                        <CardContent className="p-2 prose prose-sm max-w-none leading-relaxed">
                          {contentToRender}
                        </CardContent>
                      </Card>
                      <div className={`flex gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity`}>
                        {message.role === 'assistant' && (
                          <>
                            {isLastAIMessage && !isLoading && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRegenerateClick(messages[index - 1]?.content || '')} // Pass previous user message content
                                className="h-6 w-6 rounded-full text-slate-400 hover:text-blue-500 hover:bg-slate-100"
                                title="Regenerate response"
                              >
                                <RefreshCw className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => useCopyToClipboard().copy(message.content)}
                              className="h-6 w-6 rounded-full text-slate-400 hover:text-green-500 hover:bg-slate-100"
                              title="Copy message"
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteClick(message.id)}
                              className="h-6 w-6 rounded-full text-slate-400 hover:text-red-500 hover:bg-slate-100"
                              title="Delete message"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        {message.role === 'user' && ( // Keep delete for user messages
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteClick(message.id)}
                            className="h-6 w-6 rounded-full text-slate-400 hover:text-red-500 hover:bg-slate-100"
                            title="Delete message"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                        {message.role === 'assistant' && message.isError && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              const prevUserMessage = messages.slice(0, index).reverse().find(msg => msg.role === 'user');
                              if (prevUserMessage) {
                                handleRetryClick(prevUserMessage.content, message.id);
                              }
                            }}
                            className="h-6 w-6 rounded-full text-slate-400 hover:text-green-500 hover:bg-slate-100"
                            title="Retry failed message"
                          >
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                    {message.role === 'user' && (
                      <div className="h-8 w-8 rounded-full bg-gradient-to-r from-green-500 to-blue-500 flex items-center justify-center flex-shrink-0">
                        <User className="h-4 w-4 text-white" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {isLoading && (
              <div className="flex justify-center">
                <div className="w-full max-w-4xl flex gap-3 items-center justify-start">
                  <div className="h-8 w-8 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 flex items-center justify-center">
                    <Bot className="h-4 w-4 text-white" />
                  </div>
                  <div className="w-fit p-3 rounded-lg bg-white shadow-sm border border-slate-200">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-slate-400 rounded-full animate-pulse"></div>
                      <div className="w-2 h-2 bg-slate-400 rounded-full animate-pulse delay-75"></div>
                      <div className="w-2 h-2 bg-slate-400 rounded-full animate-pulse delay-150"></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
          {/* Changed to fixed for mobile, static for md and up. Padding adjusted for desktop. */}
          <div className="fixed bottom-0 left-0 right-0 p-4 sm:p-6 pb-8 bg-slate-50 z-10 md:static md:p-6 md:pb-6">
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (inputMessage.trim()) {
                await onSendMessage(inputMessage);
                setInputMessage('');
              }
            }} className="flex items-end gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200 shadow-sm max-w-4xl mx-auto">
              <textarea
                ref={textareaRef}
                value={inputMessage}
                onChange={(e) => {
                  setInputMessage(e.target.value);
                }}
                placeholder="Ask a question about your notes or study topics..."
                className="flex-1 text-slate-700 focus:outline-none focus:ring-0 resize-none overflow-hidden max-h-40 min-h-[48px] bg-transparent px-2"
                disabled={isLoading || isSubmittingUserMessage}
                rows={1}
              />
              <div className="flex items-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowDocumentSelector(true)}
                  className="text-slate-600 hover:bg-slate-100 h-10 w-10 flex-shrink-0 rounded-lg p-0"
                  title="Select Documents"
                >
                  <FileText className="h-5 w-5" />
                </Button>
                <Button
                  type="submit"
                  disabled={isLoading || isSubmittingUserMessage || !inputMessage.trim()}
                  className="bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 h-10 w-10 flex-shrink-0 rounded-lg p-0"
                  title="Send Message"
                >
                  {isLoading || isSubmittingUserMessage ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </form>
          </div>
          {showDocumentSelector && (
            <DocumentSelector
              documents={documents}
              notes={notes}
              selectedDocumentIds={selectedDocumentIds}
              onSelectionChange={onSelectionChange}
              isOpen={showDocumentSelector}
              onClose={() => {
                setShowDocumentSelector(false);
              }}
            />
          )}
          <ConfirmationModal
            isOpen={showDeleteConfirm}
            onClose={() => {
              setShowDeleteConfirm(false);
            }}
            onConfirm={handleConfirmDelete}
            title="Delete Message"
            message="Are you sure you want to delete this message? This action cannot be undone."
          />
        </div>

        {/* Diagram Panel - Conditionally rendered and responsive */}
        {activeDiagram && (
          <DiagramPanel
            diagramContent={activeDiagram.content}
            diagramType={activeDiagram.type} // Pass the type here
            onClose={handleCloseDiagramPanel}
            onMermaidError={handleMermaidError}
            onSuggestAiCorrection={handleSuggestMermaidAiCorrection}
            isOpen={isDiagramPanelOpen} // Pass isOpen state
          />
        )}
      </div>
    </CodeBlockErrorBoundary>
  );
};

export const AIChat = memo(AIChatComponent);
