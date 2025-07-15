// AIChat.tsx
import React, { useState, useEffect, useRef, memo, useCallback } from 'react';
import { Send, Bot, User, Loader2, FileText, History, X, RefreshCw, AlertTriangle, Copy, Check, Maximize2, Minimize2, Trash2, Download, ChevronDown, ChevronUp } from 'lucide-react';
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

// Import Graphviz from @hpcc-js/wasm
import { Graphviz } from '@hpcc-js/wasm';
import { useCopyToClipboard } from '../hooks/useCopyToClipboard'; // Import the hook from its new location

// Declare global types for libraries loaded via CDN
declare global {
  interface Window {
    jspdf: any; // jsPDF library
    html2canvas: any; // html2canvas library
  }
}

// Load Chart.js components
Chart.register(...registerables);

// Register syntax highlighting languages
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

// Syntax highlighting color map (for rendering code blocks)
const syntaxColorMap: { [key: string]: string } = {
  'hljs-comment': 'color: #6b7280; font-style: italic;',
  'hljs-quote': 'color: #6b7280; font-style: italic;',
  'hljs-keyword': 'color: #7c3aed; font-weight: 600;',
  'hljs-selector-tag': 'color: #7c3aed;',
  'hljs-subst': 'color: #7c3aed;',
  'hljs-built_in': 'color: #2563eb; font-weight: 500;',
  'hljs-type': 'color: #0d9488;',
  'hljs-class': 'color: #d97706;',
  'hljs-string': 'color: #059669;',
  'hljs-title': 'color: #059669;',
  'hljs-section': 'color: #059669;',
  'hljs-number': 'color: #ea580c;',
  'hljs-literal': 'color: #ea580c;',
  'hljs-boolean': 'color: #ea580c;',
  'hljs-variable': 'color: #1e40af;',
  'hljs-template-variable': 'color: #1e40af;',
  'hljs-function': 'color: #1d4ed8; font-weight: 500;',
  'hljs-name': 'color: #1d4ed8;',
  'hljs-params': 'color: #b45309;',
  'hljs-attr': 'color: #d97706;',
  'hljs-attribute': 'color: #d97706;',
  'hljs-tag': 'color: #dc2626;',
  'hljs-selector-id': 'color: #dc2626;',
  'hljs-selector-class': 'color: #059669;',
  'hljs-selector-attr': 'color: #0891b2;',
  'hljs-selector-pseudo': 'color: #db2777;',
  'hljs-operator': 'color: #db2777;',
  'hljs-symbol': 'color: #dc2626;',
  'hljs-bullet': 'color: #db2777;',
  'hljs-regexp': 'color: #be185d;',
  'hljs-meta': 'color: #0284c7;',
  'hljs-meta-keyword': 'color: #0284c7; font-weight: 600;',
  'hljs-meta-string': 'color: #0369a1;',
  'hljs-addition': 'color: #166534; background-color: #f0fdf4;',
  'hljs-deletion': 'color: #b91c1c; background-color: #fef2f2;',
  'hljs-emphasis': 'italic;',
  'hljs-strong': 'font-bold;',
  'hljs-code-text': 'color: #gray-800;',
};

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

// Chart.js Renderer Component
interface ChartRendererProps {
  chartConfig: any;
  chartRef: React.RefObject<HTMLCanvasElement>; // Added ref for Chart.js canvas
}

const ChartRenderer: React.FC<ChartRendererProps> = ({ chartConfig, chartRef }) => {
  const chartInstance = useRef<any>(null);
  const [chartFontSize, setChartFontSize] = useState(12); // Default font size

  // Function to calculate responsive font size
  const calculateFontSize = useCallback(() => {
    const width = window.innerWidth;
    if (width < 640) { // Mobile
      return 7; // Even smaller font size for mobile
    } else if (width < 1024) { // Tablet
      return 9; // Slightly smaller for tablet
    } else { // Desktop
      return 12;
    }
  }, []);

  useEffect(() => {
    // Set initial font size
    setChartFontSize(calculateFontSize());

    // Update font size on window resize
    const handleResize = () => {
      setChartFontSize(calculateFontSize());
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [calculateFontSize]);


  useEffect(() => {
    if (chartRef.current) {
      const ctx = chartRef.current.getContext('2d');
      if (ctx) {
        if (chartInstance.current) {
          chartInstance.current.destroy();
        }

        // Deep clone the config to avoid modifying the original and causing re-renders
        const configToUse = JSON.parse(JSON.stringify(chartConfig));

        // Apply responsive font sizes to chart options
        if (configToUse.options) {
          if (configToUse.options.plugins?.title) {
            configToUse.options.plugins.title.font = {
              size: chartFontSize * 1.2, // Slightly larger for title
            };
          }
          if (configToUse.options.scales) {
            Object.values(configToUse.options.scales).forEach((scale: any) => {
              if (scale.ticks) {
                scale.ticks.font = {
                  size: chartFontSize,
                };
              }
              if (scale.title) {
                scale.title.font = {
                  size: chartFontSize * 1.1, // Slightly larger for axis titles
                };
              }
            });
          }
          // Also apply to legend if present
          if (configToUse.options.plugins?.legend?.labels) {
            configToUse.options.plugins.legend.labels.font = {
              size: chartFontSize,
            };
          }
        }

        // --- START: Fix for Chart.js Tooltip Callbacks ---
        // Chart.js expects functions for tooltip callbacks, but AI generates strings for JSON validity.
        // We convert the string back to a function here.
        if (configToUse.options?.plugins?.tooltip?.callbacks?.label && typeof configToUse.options.plugins.tooltip.callbacks.label === 'string') {
          const labelString = configToUse.options.plugins.tooltip.callbacks.label;
          configToUse.options.plugins.tooltip.callbacks.label = function(context: any) {
            // Replace [value] with the actual data value
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            if (context.parsed.y !== undefined) {
              label += context.parsed.y;
            } else if (context.parsed.x !== undefined) {
              label += context.parsed.x;
            } else if (context.formattedValue !== undefined) { // For pie charts, formattedValue often has the percentage
              label += context.formattedValue;
            } else {
              label += context.raw; // Fallback to raw value
            }

            // If the AI provided a specific string, try to use it as a template
            // Example: "Value: [value]" -> "Value: 123"
            if (labelString.includes('[value]')) {
              return labelString.replace('[value]', label);
            }
            return label; // Return the default Chart.js label if no template
          };
        }
        // --- END: Fix for Chart.js Tooltip Callbacks ---

        chartInstance.current = new Chart(ctx, configToUse);
      }
    }

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
        chartInstance.current = null;
      }
    };
  }, [chartConfig, chartRef, chartFontSize]); // Re-run effect if chartConfig, ref, or font size changes

  return (
    // Removed fixed height (h-80) to allow for responsiveness
    <div className="relative w-full bg-white p-4 rounded-lg shadow-inner">
      <canvas ref={chartRef}></canvas>
    </div>
  );
};

// DiagramPanel component
interface DiagramPanelProps {
  diagramContent: string;
  diagramType: 'mermaid' | 'dot' | 'chartjs' | 'code' | 'unknown'; // Added 'code' type
  onClose: () => void;
  onMermaidError: (code: string, errorType: 'syntax' | 'rendering') => void;
  onSuggestAiCorrection: (prompt: string) => void; // This is the prop passed down
  isOpen: boolean;
  language?: string; // New prop for code language
}

const DiagramPanel: React.FC<DiagramPanelProps> = memo(({ diagramContent, diagramType, onClose, onMermaidError, onSuggestAiCorrection, isOpen, language }) => {
  const diagramContainerRef = useRef<HTMLDivElement>(null); // Ref for the container holding the diagram
  const chartCanvasRef = useRef<HTMLCanvasElement>(null); // Ref specifically for Chart.js canvas
  const mermaidDivRef = useRef<HTMLDivElement>(null); // Ref for Mermaid diagram container

  // State for resizable panel
  const diagramPanelRef = useRef<HTMLDivElement>(null); // Ref for the main DiagramPanel div
  const [panelWidth, setPanelWidth] = useState<number | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const initialX = useRef(0);
  const initialPanelWidth = useRef(0);

  // Effect to set initial width based on responsive classes when panel opens
  useEffect(() => {
    if (isOpen && !panelWidth && diagramPanelRef.current) {
      // Only set initial width if it's not already set (e.g., from a previous resize)
      // and if we are on a desktop screen (width >= 768px for md breakpoint)
      if (window.innerWidth >= 768) {
        setPanelWidth(window.innerWidth * 0.7); // Set to 70% of viewport width initially
      }
    }
  }, [isOpen, panelWidth]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (window.innerWidth < 768) return; // Only allow resizing on desktop

    e.preventDefault();
    setIsResizing(true);
    initialX.current = e.clientX;
    initialPanelWidth.current = diagramPanelRef.current?.offsetWidth || 0;
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return;

    const deltaX = initialX.current - e.clientX; // Dragging left increases width
    let newWidth = initialPanelWidth.current + deltaX;

    // Define min/max width for the panel
    const minWidth = 300; // Minimum width in pixels
    const maxWidth = window.innerWidth * 0.7; // Max 70% of viewport width

    newWidth = Math.max(minWidth, Math.min(newWidth, maxWidth));
    setPanelWidth(newWidth);
  }, [isResizing]);

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    } else {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, handleMouseMove, handleMouseUp]);

  // Apply dynamic width style
  const dynamicWidthStyle = panelWidth !== null && window.innerWidth >= 768 ? { width: `${panelWidth}px` } : {};


  let panelContent;
  let panelTitle = 'Diagram View';
  let downloadButtonText = 'Download Diagram (SVG)'; // Renamed to be general
  let downloadFileName = 'diagram';

  // Function to download diagram
  const handleDownloadContent = () => {
    if (!diagramContainerRef.current) {
      toast.error('Content not rendered for download.');
      return;
    }

    let fileExtension = '';
    let contentToDownload: string | Blob = '';
    let mimeType = '';

    if (diagramType === 'mermaid' || diagramType === 'dot') {
      const svgElement = diagramContainerRef.current.querySelector('svg');
      if (svgElement) {
        contentToDownload = new XMLSerializer().serializeToString(svgElement);
        fileExtension = 'svg';
        mimeType = 'image/svg+xml;charset=utf-8';
      } else {
        toast.error('SVG element not found for download.');
        return;
      }
    } else if (diagramType === 'chartjs') {
      if (chartCanvasRef.current) {
        contentToDownload = chartCanvasRef.current.toDataURL('image/png');
        fileExtension = 'png';
        mimeType = 'image/png';
        // For data URLs, create a link and click it
        const downloadLink = document.createElement('a');
        downloadLink.href = contentToDownload as string;
        downloadLink.download = `${downloadFileName}.${fileExtension}`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        toast.success(`Chart downloaded as ${fileExtension.toUpperCase()}!`);
        return; // Exit early for data URL handling
      } else {
        toast.error('Chart canvas not found for chart.js download.');
        return;
      }
    } else if (diagramType === 'code') {
      contentToDownload = diagramContent;
      fileExtension = language || 'txt';
      mimeType = `text/plain;charset=utf-8`; // Fallback to plain text
      // More specific mime types for common languages
      if (language === 'js' || language === 'javascript') mimeType = 'application/javascript';
      if (language === 'py' || language === 'python') mimeType = 'text/x-python';
      if (language === 'java') mimeType = 'text/x-java-source';
      if (language === 'html') mimeType = 'text/html';
      if (language === 'css') mimeType = 'text/css';
      if (language === 'json') mimeType = 'application/json';
      if (language === 'ts' || language === 'typescript') mimeType = 'application/typescript';

    } else {
      toast.error('Unsupported content type for download.');
      return;
    }

    const blob = new Blob([contentToDownload], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const downloadLink = document.createElement('a');
    downloadLink.href = url;
    downloadLink.download = `${downloadFileName}.${fileExtension}`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    URL.revokeObjectURL(url);
    toast.success(`${diagramType === 'code' ? 'Code' : 'Diagram'} downloaded as ${fileExtension.toUpperCase()}!`);
  };

  // Function to download as PDF
  const handleDownloadPdf = async () => {
    if (!diagramContainerRef.current) {
      toast.error('Diagram not rendered for PDF download.');
      return;
    }

    // Ensure jsPDF and html2canvas are loaded
    if (typeof window.jspdf === 'undefined' || typeof window.html2canvas === 'undefined') {
      toast.error('PDF generation libraries not loaded. Please try again.');
      return;
    }

    toast.info('Generating PDF...');
    try {
      const canvas = await window.html2canvas(diagramContainerRef.current, {
        scale: 3, // Increase scale for better quality
        useCORS: true, // If images are involved, might need this
        backgroundColor: '#f8fafc', // Match background of panel
      });

      // Use window.jspdf.jsPDF as per global declaration
      const imgData = canvas.toDataURL('image/png');
      const pdf = new window.jspdf.jsPDF({
        orientation: canvas.width > canvas.height ? 'l' : 'p',
        unit: 'px',
        format: [canvas.width, canvas.height], // Use canvas dimensions for format
      });

      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
      pdf.save(`diagram-${Date.now()}.pdf`);
      toast.success('Diagram downloaded as PDF!');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Failed to generate PDF. Please try again.');
    }
  };


  // Render logic based on diagramType
  if (diagramType === 'mermaid') {
    panelContent = (
      <Mermaid chart={diagramContent} onMermaidError={onMermaidError} onSuggestAiCorrection={onSuggestAiCorrection} diagramRef={mermaidDivRef} />
    );
    panelTitle = 'Mermaid Diagram View';
    downloadButtonText = 'Download Diagram (SVG)';
    downloadFileName = 'mermaid-diagram';
  } else if (diagramType === 'dot') {
    panelTitle = 'DOT Graph View';
    downloadButtonText = 'Download Graph (SVG)';
    downloadFileName = 'dot-graph';
    // Render DOT graph using @hpcc-js/wasm
    const [dotSvg, setDotSvg] = useState<string | null>(null);
    const [dotError, setDotError] = useState<string | null>(null);
    const [isDotLoading, setIsDotLoading] = useState(false); // New loading state for DOT

    useEffect(() => {
      const renderDot = async () => {
        setDotSvg(null);
        setDotError(null);
        setIsDotLoading(true);

        try {
          
          // Instantiate Graphviz
          const gv = await Graphviz.load();
          const svg = await gv.layout(diagramContent, 'svg', 'dot');
          setDotSvg(svg);
        } catch (e: any) {
          console.error('DOT rendering error:', e);
          setDotError(`DOT rendering failed: ${e.message || 'Invalid DOT syntax'}`);
          onMermaidError(diagramContent, 'syntax'); // Use onMermaidError for general diagram errors
        } finally {
          setIsDotLoading(false);
        }
      };

      if (diagramContent) {
        renderDot();
      } else {
        setIsDotLoading(false); // No content to render
      }
    }, [diagramContent, onMermaidError]); // Dependencies for useEffect

    panelContent = isDotLoading ? (
      <div className="flex flex-col items-center justify-center h-full text-blue-600">
        <Loader2 className="h-8 w-8 animate-spin mb-2" />
        <p>Rendering DOT graph...</p>
      </div>
    ) : dotError ? (
      <div className="text-red-700 p-4">
        <p>Error rendering DOT graph:</p>
        <pre className="bg-gray-100 p-3 rounded-md text-sm overflow-x-auto max-w-full">
          {dotError}<br />
          Raw Code:<br />
          {diagramContent}
        </pre>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onSuggestAiCorrection(`Can you fix this DOT graph? Here's the code: ${diagramContent}`)}
          className="mt-4 bg-blue-500 text-white hover:bg-blue-600"
        >
          Suggest AI Correction
        </Button>
      </div>
    ) : (
      <div dangerouslySetInnerHTML={{ __html: dotSvg || '' }} className="w-full h-full" /> // Removed items-center justify-center
    );

  } else if (diagramType === 'chartjs') {
    panelTitle = 'Chart.js Graph View';
    downloadButtonText = 'Download Chart (PNG)'; // Clarify PNG for Chart.js
    downloadFileName = 'chartjs-graph';
    try {
      // Remove comments from Chart.js JSON before parsing
      const cleanedCodeContent = diagramContent.replace(/\/\/.*|\/\*[\s\S]*?\*\//g, '');
      panelContent = <ChartRenderer chartConfig={JSON.parse(cleanedCodeContent)} chartRef={chartCanvasRef} />;
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
    }
  } else if (diagramType === 'code') {
    panelTitle = language ? `Code View - ${language.toUpperCase()}` : 'Code View';
    downloadButtonText = 'Download Code';
    downloadFileName = `code.${language || 'txt'}`;
    panelContent = (
      <div className="relative rounded-lg overflow-hidden h-full">
        <div className="p-4 bg-white overflow-x-auto h-full">
          <pre className="font-mono text-sm leading-relaxed h-full">
            <code
              className="text-gray-800 h-full"
              dangerouslySetInnerHTML={{
                __html: highlightCode(diagramContent, language || 'plaintext')
              }}
            />
          </pre>
        </div>
      </div>
    );
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
    downloadButtonText = 'Download Content';
    downloadFileName = 'content';
  }

  return (
    // Load jsPDF, html2canvas from CDN
    <>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>

      <div
        ref={diagramPanelRef} // Attach ref to the main panel div
        className={`
          absolute inset-y-0 right-0 w-full bg-white shadow-xl flex flex-col z-40 transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}
          md:relative md:translate-x-0 md:flex-shrink-0 md:rounded-lg md:shadow-md md:mb-6 md:border md:border-slate-200
        `}
        style={dynamicWidthStyle} // Apply dynamic width here
      >
        {/* Resizer Handle - only visible on desktop */}
        <div
          className="hidden md:block absolute left-0 top-0 bottom-0 w-2 bg-transparent cursor-ew-resize z-50 hover:bg-gray-200 transition-colors duration-200"
          onMouseDown={handleMouseDown}
        />

        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between bg-white">
          <h3 className="text-lg font-semibold text-slate-800 mb-2 sm:mb-0">{panelTitle}</h3>
          <div className="flex flex-wrap items-center gap-2 justify-end"> {/* Added flex-wrap and justify-end */}
            {/* Download Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadContent} // Changed to general handler
              className="text-blue-600 hover:bg-blue-50"
              title={downloadButtonText}
              disabled={!diagramContent || diagramType === 'unknown'}
            >
              <Download className="h-4 w-4 mr-0 sm:mr-2" /> {/* Removed mr-2 on small screens */}
              <span className="hidden sm:inline">{downloadButtonText}</span> {/* Hidden on small screens */}
            </Button>
            {/* Download PDF Button (only for diagrams, not code) */}
            {(!['code', 'unknown'].includes(diagramType)) && ( // Corrected condition
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadPdf}
                className="text-purple-600 hover:bg-purple-50"
                title="Download Diagram (PDF)"
                disabled={!diagramContent || diagramType === 'unknown'}
              >
                <Download className="h-4 w-4 mr-0 sm:mr-2" /> {/* Removed mr-2 on small screens */}
                <span className="hidden sm:inline">Download PDF</span> {/* Hidden on small screens */}
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={onClose} title="Close Diagram" className="flex-shrink-0"> {/* Added flex-shrink-0 */}
              <X className="h-5 w-5 text-slate-500 hover:text-slate-700" />
            </Button>
          </div>
        </div>
        <div ref={diagramContainerRef} className="flex-1 overflow-auto p-4 sm:p-6 modern-scrollbar"> {/* Added modern-scrollbar */}
          {panelContent}
        </div>
      </div>
    </>
  );
});


const CodeBlock = memo(({ node, inline, className, children, onMermaidError, onSuggestAiCorrection, onViewDiagram, ...props }: any) => {
  // The useCopyToClipboard hook is now called at the top level of AIChatComponent
  // and 'copy' and 'copied' are passed down as props if needed, or accessed via context.
  // For this CodeBlock, we will receive them as props.
  const { copied, copy } = useCopyToClipboard(); 
  const match = /language-(\w+)/.exec(className || '');
  const lang = match && match[1];
  const codeContent = String(children).trim();
  const [showRawCode, setShowRawCode] = useState(false);

  // If it's a raw code block (not mermaid, chartjs, or dot), show a "View Code" button
  if (!inline && lang && !['mermaid', 'chartjs', 'dot'].includes(lang)) {
    return (
      <div className="my-4 p-3 bg-slate-100 border border-slate-200 rounded-lg flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-700">
          <FileText className="h-4 w-4" />
          <span className="text-sm font-medium">{lang.toUpperCase()} Code</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onViewDiagram && onViewDiagram(codeContent, 'code', lang)} // Pass 'code' type and language
          className="bg-blue-500 text-white hover:bg-blue-600 shadow-sm"
        >
          <Maximize2 className="h-4 w-4 mr-2" />
          View Code
        </Button>
      </div>
    );
  }

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
    // Modified to show a button instead of direct rendering
    return (
      <div className="my-4 p-3 bg-slate-100 border border-slate-200 rounded-lg flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-700">
          <FileText className="h-4 w-4" />
          <span className="text-sm font-medium">Chart.js Graph</span>
        </div>
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
    );
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

  // Fallback for inline code or unhandled languages
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

      // Map highlight.js classes to inline styles for guaranteed rendering
      const styleMap: { [key: string]: string } = {
        'hljs-comment': 'color: #6b7280; font-style: italic;',
        'hljs-keyword': 'color: #7c3aed; font-weight: 600;',
        'hljs-string': 'color: #059669;',
        'hljs-number': 'color: #ea580c;',
        'hljs-built_in': 'color: #2563eb; font-weight: 500;',
        'hljs-type': 'color: #0d9488;',
        'hljs-class': 'color: #d97706;',
        'hljs-attr': 'color: #d97706;',
        'hljs-attribute': 'color: #d97706;',
        'hljs-tag': 'color: #dc2626;',
        'hljs-selector-id': 'color: #dc2626;',
        'hljs-selector-class': 'color: #059669;',
        'hljs-selector-attr': 'color: #0891b2;',
        'hljs-selector-pseudo': 'color: #db2777;',
        'hljs-operator': 'color: #db2777;',
        'hljs-literal': 'color: #ea580c;',
        'hljs-meta': 'color: #0284c7;',
        'hljs-title': 'color: #059669;',
        'hljs-selector-tag': 'color: #7c3aed;',
        'hljs-regexp': 'color: #be185d;',
        'hljs-symbol': 'color: #dc2626;',
        'hljs-bullet': 'color: #db2777;',
        'hljs-params': 'color: #b45309;',
        'hljs-name': 'color: #1d4ed8;',

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

// Memoize MarkdownRenderer to prevent unnecessary re-renders
const MemoizedMarkdownRenderer: React.FC<{ content: string; isUserMessage?: boolean; onMermaidError: (code: string, errorType: 'syntax' | 'rendering') => void; onSuggestAiCorrection: (prompt: string) => void; onViewDiagram: (code: string, type: 'mermaid' | 'dot' | 'chartjs' | 'code' | 'unknown', language?: string) => void; onToggleUserMessageExpansion: (messageId: string) => void; expandedMessages: Set<string>; }> = memo(({ content, isUserMessage, onMermaidError, onSuggestAiCorrection, onViewDiagram, onToggleUserMessageExpansion, expandedMessages }) => {
  const textColorClass = isUserMessage ? 'text-white' : 'text-slate-700';
  const linkColorClass = isUserMessage ? 'text-blue-200 hover:underline' : 'text-blue-600 hover:underline';
  const listTextColorClass = isUserMessage ? 'text-white' : 'text-slate-700';
  const blockquoteTextColorClass = isUserMessage ? 'text-blue-100' : 'text-slate-600';
  const blockquoteBgClass = isUserMessage ? 'bg-blue-700 border-blue-400' : 'bg-blue-50 border-blue-500';

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
          code: (props) => <CodeBlock {...props} onMermaidError={onMermaidError} onSuggestAiCorrection={onSuggestAiCorrection} onViewDiagram={onViewDiagram} />,
          h1: ({ node, ...props }) => <h1 className={`text-2xl font-extrabold ${isUserMessage ? 'text-white' : 'text-blue-700'} mt-4 mb-2`} {...props} />,
          h2: ({ node, ...props }) => <h2 className={`text-xl font-bold ${isUserMessage ? 'text-white' : 'text-purple-700'} mt-3 mb-2`} {...props} />,
          h3: ({ node, ...props }) => <h3 className ={`text-lg font-semibold ${isUserMessage ? 'text-white' : 'text-green-700'} mt-2 mb-1`} {...props} />,
          h4: ({ node, ...props }) => <h4 className={`text-base font-semibold ${isUserMessage ? 'text-white' : 'text-orange-700'} mt-1 mb-1`} {...props} />,
          p: ({ node, ...props }) => <p className={`mb-2 ${textColorClass} leading-relaxed`} {...props} />,
          a: ({ node, ...props }) => <a className={`${linkColorClass} font-medium`} {...props} />,
          ul: ({ node, ...props }) => <ul className={`list-disc list-inside space-y-1 ${listTextColorClass} mb-2`} {...props} />,
          ol: ({ node, ...props }) => <ol className={`list-decimal list-inside space-y-1 ${listTextColorClass} mb-2`} {...props} />,
          li: ({ node, ...props }) => <li className="mb-1" {...props} />,
          blockquote: ({ node, ...props }) => <blockquote className={`border-l-4 ${blockquoteBgClass} pl-4 py-2 italic ${blockquoteTextColorClass} rounded-r-md my-3`} {...props} />,
          table: ({ node, ...props }) => (
            // Ensure the table container takes full width and allows horizontal scrolling
            <div className="overflow-x-auto my-4 rounded-lg shadow-md border border-slate-200 w-full">
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
        {displayedContent}
      </ReactMarkdown>
      {needsExpansion && (
        <Button
          variant="link"
          size="sm"
          onClick={() => onToggleUserMessageExpansion(content)} // Pass content or message.id
          className="text-white text-xs p-0 h-auto mt-1 flex items-center justify-end"
        >
          {isExpanded ? (
            <>
              Show Less <ChevronUp className="h-3 w-3 ml-1" />
            </>
          ) : (
            <>
              Show More <ChevronDown className="h-3 w-3 ml-1" />
            </>
          )}
        </Button>
      )}
    </CodeBlockErrorBoundary>
  );
});

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
  hasMoreMessages,
  onLoadOlderMessages,
}) => {
  const [inputMessage, setInputMessage] = useState('');
  const [showDocumentSelector, setShowDocumentSelector] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null); // Ref for the scrollable chat container
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set()); // State to track expanded messages
  const [showScrollToBottomButton, setShowScrollToBottomButton] = useState(false); // State for scroll button visibility

  // State for the side-out diagram panel
  const [activeDiagram, setActiveDiagram] = useState<{ content: string; type: 'mermaid' | 'dot' | 'chartjs' | 'code' | 'unknown'; language?: string } | null>(null); // Added language property
  const isDiagramPanelOpen = !!activeDiagram; // Derived state

  // Initialize useCopyToClipboard hook once at the top level of the component
  const { copied, copy } = useCopyToClipboard();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Handle scroll event to show/hide scroll to bottom button
  const handleScroll = useCallback(() => {
    if (chatContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
      // Show button if not at the very bottom (with a 100px threshold)
      // Also ensure scrollHeight is greater than clientHeight (i.e., there's actually something to scroll)
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 100;
      setShowScrollToBottomButton(!isAtBottom && scrollHeight > clientHeight);
    }
  }, []);

  // Attach and detach scroll listener
  useEffect(() => {
    const chatContainer = chatContainerRef.current;
    if (chatContainer) {
      chatContainer.addEventListener('scroll', handleScroll);
      // Initial check on mount
      handleScroll();
    }
    return () => {
      if (chatContainer) {
        chatContainer.removeEventListener('scroll', handleScroll);
      }
    };
  }, [handleScroll]);

  // Scroll to bottom when new messages are added, or when isLoading changes (for new AI response)
  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]); // Trigger scroll on message change or loading state change


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

  const handleMermaidError = useCallback((code: string, errorType: 'syntax' | 'rendering') => {
    toast.info(`Mermaid diagram encountered a ${errorType} error. Click 'AI Fix' to get help.`);
  }, []); // Memoize this callback

  const handleSuggestMermaidAiCorrection = useCallback((prompt: string) => {
    setInputMessage(prompt);
    textareaRef.current?.focus();
  }, []);

  // New callback to handle viewing a diagram or code in the side panel
  const handleViewDiagram = useCallback((code: string, type: 'mermaid' | 'dot' | 'chartjs' | 'code' | 'unknown' = 'unknown', language?: string) => {
    // Only update if the content or type has actually changed
    if (!activeDiagram || activeDiagram.content !== code || activeDiagram.type !== type || activeDiagram.language !== language) {
      setActiveDiagram({ content: code, type: type, language: language });
    }
  }, [activeDiagram]); // Dependency on activeDiagram to compare

  const handleCloseDiagramPanel = useCallback(() => {
    setActiveDiagram(null);
  }, []);

  // Function to toggle user message expansion
  const handleToggleUserMessageExpansion = useCallback((messageContent: string) => {
    setExpandedMessages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(messageContent)) {
        newSet.delete(messageContent);
      } else {
        newSet.add(messageContent);
      }
      return newSet;
    });
  }, []);

  // Helper function to format date for display (e.g., "Today", "Yesterday", "July 13, 2025")
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    }
  };

  // Helper function to format time for display (e.g., "10:30 AM")
  const formatTime = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const displayMessages = messages;

  const MAX_USER_MESSAGE_LENGTH = 100; // Define a threshold for collapsing

  let lastDate = ''; // To keep track of the last message's date for grouping

  return (
    <CodeBlockErrorBoundary>
      <div className="flex flex-col h-full border-none relative bg-transparent overflow-hidden md:flex-row md:p-6 md:gap-6"> {/* Added md:gap-6 here */}
        {/* Main Chat Area */}
        <div className={`
          flex-1 flex flex-col h-full bg-white rounded-lg shadow-md transition-all duration-300 ease-in-out
          ${isDiagramPanelOpen ? 'md:w-[30%]' : 'w-full'}
        `}> {/* Removed border border-slate-200 */}
          {/* Removed the header section */}
          {/* Adjusted padding: pb-[calc(4rem+2rem)] for mobile, md:pb-6 for desktop */}
          <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 flex flex-col modern-scrollbar pb-32 md:pb-6">
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
              const messageDate = formatDate(message.timestamp); // Use message.timestamp
              const showDateHeader = messageDate !== lastDate;
              lastDate = messageDate; // Update lastDate for the next iteration

              let cardClasses = '';
              let contentToRender;
              const isLastMessage = index === displayMessages.length - 1;

              if (message.role === 'user') {
                cardClasses = 'bg-gradient-to-r from-blue-600 to-purple-600 text-white';
                const isExpanded = expandedMessages.has(message.content);
                const needsExpansion = message.content.length > MAX_USER_MESSAGE_LENGTH;
                const displayedContent = needsExpansion && !isExpanded ? message.content.substring(0, MAX_USER_MESSAGE_LENGTH) + '...' : message.content;

                contentToRender = (
                  <>
                    <p className="mb-2 text-white leading-relaxed whitespace-pre-wrap">
                      {displayedContent}
                    </p>
                    {needsExpansion && (
                      <Button
                        variant="link"
                        size="sm"
                        onClick={() => handleToggleUserMessageExpansion(message.content)}
                        className="text-white text-xs p-0 h-auto mt-1 flex items-center justify-end"
                      >
                        {isExpanded ? (
                          <>
                            Show Less <ChevronUp className="h-3 w-3 ml-1" />
                          </>
                        ) : (
                          <>
                            Show More <ChevronDown className="h-3 w-3 ml-1" />
                          </>
                        )}
                      </Button>
                    )}
                  </>
                );
              } else { // message.role === 'assistant'
                if (message.isError) {
                  cardClasses = ' text-red-800';
                  contentToRender = <MemoizedMarkdownRenderer content={message.content} isUserMessage={false} onMermaidError={handleMermaidError} onSuggestAiCorrection={handleSuggestMermaidAiCorrection} onViewDiagram={handleViewDiagram} onToggleUserMessageExpansion={handleToggleUserMessageExpansion} expandedMessages={expandedMessages} />;
                } else {
                  cardClasses = 'bg-white border border-slate-200';
                  // Always render the message.content directly now
                  contentToRender = <MemoizedMarkdownRenderer content={message.content} isUserMessage={false} onMermaidError={handleMermaidError} onSuggestAiCorrection={handleSuggestMermaidAiCorrection} onViewDiagram={handleViewDiagram} onToggleUserMessageExpansion={handleToggleUserMessageExpansion} expandedMessages={expandedMessages} />;
                }
              }

              const isLastAIMessage = message.role === 'assistant' && index === displayMessages.length - 1;

              return (
                <React.Fragment key={message.id}>
                  {showDateHeader && (
                    <div className="flex justify-center my-4">
                      <Badge variant="secondary" className="px-3 py-1 text-xs text-slate-500 bg-slate-100 rounded-full shadow-sm">
                        {messageDate}
                      </Badge>
                    </div>
                  )}
                  <div className="flex justify-center">
                    <div className={`
                      w-full max-w-4xl flex gap-3 group
                      ${message.role === 'user' ? 'justify-end' : 'justify-start'}
                    `}>
                      {message.role === 'assistant' && (
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${message.isError ? 'bg-red-500' : 'bg-transparent'} hidden sm:flex`}> {/* Added hidden sm:flex */}
                          {message.isError ? <AlertTriangle className="h-4 w-4 text-white" /> : <Bot className="h-4 w-4 text-white" />}
                        </div>
                      )}
                      <div className={`flex flex-col ${message.role === 'user' ? 'items-end max-w-sm' : 'items-start'}`}>
                        <Card className={`max-w-sm sm:max-w-4xl overflow-hidden rounded-lg ${message.role === 'assistant' ?'border-none shadow-none bg-transparent':''}' ${cardClasses}`}>
                          <CardContent className={`p-2 prose border-none prose-base max-w-full leading-relaxed`}> {/* Changed prose-sm to prose-base */}
                            {contentToRender}
                          </CardContent>
                        </Card>
                        <div className={`flex gap-1 mt-1 ${message.role === 'user' ? 'justify-end' : 'justify-start'} w-full`}>
                          <span className={`text-xs text-slate-500 ${message.role === 'user' ? 'text-white/80' : 'text-slate-500'}`}>
                            {formatTime(message.timestamp)} {/* Use message.timestamp */}
                          </span>
                          <div className={`flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity`}>
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
                                  onClick={() => copy(message.content)}
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
                      </div>
                      {message.role === 'user' && (
                        <div className="h-8 w-8 rounded-full bg-gradient-to-r from-green-500 to-blue-500 flex items-center justify-center flex-shrink-0 hidden sm:flex"> {/* Added hidden sm:flex */}
                          <User className="h-4 w-4 text-white" />
                        </div>
                      )}
                    </div>
                  </div>
                </React.Fragment>
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
          {/* Input area - now with a wrapper div for the full-width background */}
          <div className="fixed bottom-0 left-0 right-0 p-4 sm:p-6 pb-8 bg-slate-50 sm:bg-transparent md:bg-transparent md:shadow-none md:static md:rounded-lgz-10 md:static md:p-0 rounded-t-lg md:rounded-lg"> {/* Removed md:pb-6, set to md:p-0 */}
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (inputMessage.trim()) {
                await onSendMessage(inputMessage);
                setInputMessage('');
              }
            }} className="flex items-end gap-2 p-3 rounded-lg bg-white border border-slate-200 shadow-lg max-w-4xl mx-auto"> {/* Added shadow-lg */}
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

        {/* Scroll to Bottom Button */}
        {showScrollToBottomButton && (
          <Button
            variant="outline"
            size="icon"
            onClick={scrollToBottom}
            // Adjusted bottom position for mobile (bottom-28 = 112px)
            className="fixed bottom-28 right-6 md:bottom-8 md:right-8 bg-white rounded-full shadow-lg p-2 z-20 transition-opacity duration-300 hover:scale-105"
            title="Scroll to bottom"
          >
            <ChevronDown className="h-5 w-5 text-slate-600" />
          </Button>
        )}

        {/* Diagram Panel - Conditionally rendered and responsive */}
        {activeDiagram && (
          <DiagramPanel
            key={`${activeDiagram.content}-${activeDiagram.type}-${activeDiagram.language}`} // Add language to key
            diagramContent={activeDiagram.content}
            diagramType={activeDiagram.type}
            onClose={handleCloseDiagramPanel}
            onMermaidError={handleMermaidError}
            onSuggestAiCorrection={handleSuggestMermaidAiCorrection} // Corrected prop name
            isOpen={isDiagramPanelOpen}
            language={activeDiagram.language} // Pass language prop
          />
        )}
      </div>
    </CodeBlockErrorBoundary>
  );
};

export const AIChat = memo(AIChatComponent);
