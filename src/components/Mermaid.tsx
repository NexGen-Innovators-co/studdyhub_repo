import React, { useEffect, useState, useRef } from 'react';
import mermaid from 'mermaid';
import { Graphviz } from '@hpcc-js/wasm';
import { AlertCircle, Download, Maximize2, Minimize2, Copy, Check } from 'lucide-react';

interface MermaidProps {
  chart: string;
  format?: 'mermaid' | 'dot';
}

// Initialize Mermaid with modern theme
mermaid.initialize({
  startOnLoad: false,
  theme: 'base',
  themeVariables: {
    primaryColor: '#3b82f6',
    primaryTextColor: '#1e293b',
    primaryBorderColor: '#2563eb',
    lineColor: '#6366f1',
    secondaryColor: '#8b5cf6',
    tertiaryColor: '#f1f5f9',
    background: '#ffffff',
    mainBkg: '#f8fafc',
    secondBkg: '#e2e8f0',
    tertiaryBkg: '#cbd5e1',
    fontFamily: 'ui-sans-serif, system-ui, sans-serif',
    fontSize: '14px',
  },
  securityLevel: 'loose',
  fontFamily: 'ui-sans-serif, system-ui, sans-serif',
  flowchart: {
    htmlLabels: true,
    curve: 'basis',
    padding: 20,
    nodeSpacing: 50,
    rankSpacing: 50,
  },
  sequence: {
    diagramMarginX: 50,
    diagramMarginY: 10,
    actorMargin: 50,
    width: 150,
    height: 65,
    boxMargin: 10,
    boxTextMargin: 5,
    noteMargin: 10,
    messageMargin: 35,
  },
  gantt: {
    titleTopMargin: 25,
    barHeight: 20,
    fontSize: 11,
    gridLineStartPadding: 35,
    leftPadding: 75,
    topPadding: 50,
    rightPadding: 25,
  },
});

const Mermaid: React.FC<MermaidProps> = ({ chart, format = 'mermaid' }) => {
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const diagramRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const renderDiagram = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        if (format === 'dot') {
          // Render Graphviz DOT diagram
          const graphviz = await Graphviz.load();
          const svgOutput = graphviz.dot(chart);
          setSvg(svgOutput);
        } else {
          // Render Mermaid diagram
          const id = `mermaid-diagram-${Math.random().toString(36).slice(2, 11)}`;
          const { svg: renderedSvg } = await mermaid.render(id, chart);
          setSvg(renderedSvg);
        }
      } catch (e: any) {
        console.error(`Rendering error (${format}):`, e);
        setError(`Could not render ${format.toUpperCase()} diagram: ${e.message || 'Invalid syntax'}`);
        setSvg(null);
      } finally {
        setIsLoading(false);
      }
    };

    if (chart.trim()) {
      renderDiagram();
    } else {
      setIsLoading(false);
      setSvg(null);
      setError(null);
    }
  }, [chart, format]);

  const downloadSvg = () => {
    if (!svg) return;
    
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `diagram-${format}-${Date.now()}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const copyToClipboard = async () => {
    if (!chart) return;
    
    try {
      await navigator.clipboard.writeText(chart);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center my-6 p-8 bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl border border-blue-100 shadow-sm">
        <div className="relative">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600"></div>
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-400 to-purple-400 opacity-20 animate-pulse"></div>
        </div>
        <p className="text-slate-600 text-sm mt-4 font-medium">Rendering {format.toUpperCase()} diagram...</p>
        <div className="mt-2 flex space-x-1">
          <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></div>
          <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
          <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="my-6 rounded-xl border border-red-200 bg-gradient-to-br from-red-50 to-pink-50 shadow-sm overflow-hidden">
        <div className="p-4 bg-gradient-to-r from-red-500 to-pink-500 text-white">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            <h4 className="font-semibold">Diagram Rendering Error</h4>
          </div>
        </div>
        <div className="p-4">
          <p className="text-red-800 mb-3 font-medium">{error}</p>
          <div className="bg-red-100 border border-red-200 rounded-lg overflow-hidden">
            <div className="bg-gradient-to-r from-red-200 to-pink-200 px-3 py-2 border-b border-red-300">
              <div className="flex items-center justify-between">
                <span className="text-red-800 font-semibold text-sm uppercase tracking-wide">
                  {format} Code
                </span>
                <button
                  onClick={copyToClipboard}
                  className="flex items-center gap-1 text-red-700 hover:text-red-800 transition-colors"
                  title="Copy to clipboard"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  <span className="text-xs">{copied ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>
            </div>
            <div className="p-3 bg-gradient-to-br from-red-50 to-pink-50 max-h-48 overflow-auto">
              <pre className="text-sm text-red-800 font-mono leading-relaxed">
                <code>{chart}</code>
              </pre>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (svg) {
    return (
      <div className="my-6 rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden">
        {/* Header with controls */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-400"></div>
              <div className="h-2 w-2 rounded-full bg-yellow-400"></div>
              <div className="h-2 w-2 rounded-full bg-red-400"></div>
              <span className="ml-2 font-semibold text-sm uppercase tracking-wide">
                {format} Diagram
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={copyToClipboard}
                className="p-1.5 rounded-md hover:bg-white/10 transition-colors"
                title="Copy source code"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </button>
              <button
                onClick={downloadSvg}
                className="p-1.5 rounded-md hover:bg-white/10 transition-colors"
                title="Download SVG"
              >
                <Download className="h-4 w-4" />
              </button>
              <button
                onClick={toggleExpanded}
                className="p-1.5 rounded-md hover:bg-white/10 transition-colors"
                title={isExpanded ? "Minimize" : "Maximize"}
              >
                {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* Diagram container */}
        <div 
          ref={diagramRef}
          className={`
            bg-gradient-to-br from-slate-50 to-blue-50 p-6 transition-all duration-300
            ${isExpanded ? 'min-h-[600px]' : 'min-h-[200px]'}
            overflow-auto
          `}
        >
          <div 
            className={`
              flex items-center justify-center
              ${isExpanded ? 'min-h-[550px]' : 'min-h-[150px]'}
            `}
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        </div>

        {/* Source code preview */}
        <div className="border-t border-slate-200 bg-gradient-to-r from-slate-50 to-blue-50">
          <details className="group">
            <summary className="cursor-pointer p-3 hover:bg-white/50 transition-colors">
              <span className="text-sm font-medium text-slate-700 group-open:text-blue-600">
                View Source Code
              </span>
            </summary>
            <div className="border-t border-slate-200 bg-gradient-to-br from-slate-100 to-blue-100">
              <div className="p-4 bg-[#0d1117] text-white overflow-x-auto">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-blue-400 font-mono text-xs uppercase tracking-wide">
                    {format} Source
                  </span>
                  <button
                    onClick={copyToClipboard}
                    className="flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    <span className="text-xs">{copied ? 'Copied!' : 'Copy'}</span>
                  </button>
                </div>
                <pre className="text-sm font-mono leading-relaxed">
                  <code className="text-green-400">{chart}</code>
                </pre>
              </div>
            </div>
          </details>
        </div>
      </div>
    );
  }

  
};

export default Mermaid;