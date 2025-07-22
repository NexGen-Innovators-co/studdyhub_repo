// AIChat.tsx
import React, { useState, useEffect, useRef, memo, useCallback } from 'react';
import { Send, Bot, User, Loader2, FileText, History, X, RefreshCw, AlertTriangle, Copy, Check, Maximize2, Minimize2, Trash2, Download, ChevronDown, ChevronUp, Image, Upload, XCircle, BookOpen, StickyNote, Sparkles, GripVertical } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
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
import { useCopyToClipboard } from '../hooks/useCopyToClipboard';
import { generateId } from '@/utils/helpers';

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
        <div className="my-4 p-4 bg-red-50 border border-red-200 rounded-lg dark:bg-red-950 dark:border-red-800">
          <div className="flex items-center gap-2 text-red-700 dark:text-red-300">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm font-medium">Rendering Error</span>
          </div>
          <p className="text-sm text-red-600 mt-1 dark:text-red-400">
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
    }
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
          configToUse.options.plugins.tooltip.callbacks.label = function (context: any) {
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
    <div className="relative w-full bg-white p-4 rounded-lg shadow-inner dark:bg-gray-900">
      <canvas ref={chartRef}></canvas>
    </div>
  );
};

// DiagramPanel component
interface DiagramPanelProps {
  diagramContent?: string; // Made optional for image view
  diagramType: 'mermaid' | 'dot' | 'chartjs' | 'code' | 'image' | 'unknown' | 'document-text'; // Added 'image' and 'document-text' type
  onClose: () => void;
  onMermaidError: (code: string, errorType: 'syntax' | 'rendering') => void;
  onSuggestAiCorrection: (prompt: string) => void; // This is the prop passed down
  isOpen: boolean;
  language?: string; // New prop for code language
  imageUrl?: string; // New prop for image URL
}

const DiagramPanel: React.FC<DiagramPanelProps> = memo(({ diagramContent, diagramType, onClose, onMermaidError, onSuggestAiCorrection, isOpen, language, imageUrl }) => {
  const diagramContainerRef = useRef<HTMLDivElement>(null); // Ref for the container holding the diagram
  const chartCanvasRef = useRef<HTMLCanvasElement>(null); // Ref specifically for Chart.js canvas
  const mermaidDivRef = useRef<HTMLDivElement>(null); // Ref for Mermaid diagram container

  // State for resizable panel width
  const diagramPanelRef = useRef<HTMLDivElement>(null); // Ref for the main DiagramPanel div
  const [panelWidth, setPanelWidth] = useState<number | null>(null);
  const [isResizingWidth, setIsResizingWidth] = useState(false); // Renamed for clarity
  const initialX = useRef(0);
  const initialPanelWidth = useRef(0);

  // State for resizable panel height
  const [panelHeight, setPanelHeight] = useState<number | null>(null); // New state for height
  const isResizingHeight = useRef(false); // New ref for height resizing
  const initialY = useRef(0); // New ref for initial Y position for height resizing
  const initialPanelHeight = useRef(0); // New ref for initial panel height

  // Effect to set initial width/height based on responsive classes when panel opens
  useEffect(() => {
    if (isOpen && diagramPanelRef.current) {
      if (window.innerWidth >= 768) { // Desktop
        if (panelWidth === null) {
          setPanelWidth(window.innerWidth * 0.7); // Set to 70% of viewport width initially
        }
        if (panelHeight === null) {
          // Set initial height based on viewport height, e.g., 80% of viewport height
          setPanelHeight(window.innerHeight * 0.8);
        }
      }
    }
  }, [isOpen, panelWidth, panelHeight]);

  // --- Width Resize Handlers ---
  const handleWidthResizeMouseDown = useCallback((e: React.MouseEvent) => {
    if (window.innerWidth < 768) return; // Only allow resizing on desktop

    e.preventDefault();
    setIsResizingWidth(true);
    initialX.current = e.clientX;
    initialPanelWidth.current = diagramPanelRef.current?.offsetWidth || 0;
    document.body.style.cursor = 'ew-resize'; // Change cursor globally
  }, []);

  const handleWidthResizeMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizingWidth) return;

    const deltaX = initialX.current - e.clientX; // Dragging left increases width
    let newWidth = initialPanelWidth.current + deltaX;

    // Define min/max width for the panel
    const minWidth = 300; // Minimum width in pixels
    const maxWidth = window.innerWidth * 0.9; // Max 90% of viewport width to leave some space

    newWidth = Math.max(minWidth, Math.min(newWidth, maxWidth));
    setPanelWidth(newWidth);
  }, [isResizingWidth]);

  const handleWidthResizeMouseUp = useCallback(() => {
    setIsResizingWidth(false);
    document.body.style.cursor = 'default';
  }, []);

  // --- Height Resize Handlers ---
  const handleHeightResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizingHeight.current = true;
    initialY.current = e.clientY;
    initialPanelHeight.current = diagramPanelRef.current?.offsetHeight || 0;
    document.body.style.cursor = 'ns-resize'; // Change cursor globally
  }, []);

  const handleHeightResizeMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizingHeight.current) return;

    const deltaY = e.clientY - initialY.current; // Dragging down increases height
    let newHeight = initialPanelHeight.current + deltaY;

    // Define min/max height for the panel
    const minHeight = 200; // Minimum height in pixels
    const maxHeight = window.innerHeight * 0.9; // Max 90% of viewport height

    newHeight = Math.max(minHeight, Math.min(newHeight, maxHeight));
    setPanelHeight(newHeight);
  }, []);

  const handleHeightResizeMouseUp = useCallback(() => {
    isResizingHeight.current = false;
    document.body.style.cursor = 'default';
  }, []);

  // Global event listeners for resizing
  useEffect(() => {
    if (isResizingWidth) {
      window.addEventListener('mousemove', handleWidthResizeMouseMove);
      window.addEventListener('mouseup', handleWidthResizeMouseUp);
    } else {
      window.removeEventListener('mousemove', handleWidthResizeMouseMove);
      window.removeEventListener('mouseup', handleWidthResizeMouseUp);
    }

    if (isResizingHeight.current) {
      window.addEventListener('mousemove', handleHeightResizeMouseMove);
      window.addEventListener('mouseup', handleHeightResizeMouseUp);
    } else {
      window.removeEventListener('mousemove', handleHeightResizeMouseMove);
      window.removeEventListener('mouseup', handleHeightResizeMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleWidthResizeMouseMove);
      window.removeEventListener('mouseup', handleWidthResizeMouseUp);
      window.removeEventListener('mousemove', handleHeightResizeMouseMove);
      window.removeEventListener('mouseup', handleHeightResizeMouseUp);
    };
  }, [isResizingWidth, isResizingHeight, handleWidthResizeMouseMove, handleWidthResizeMouseUp, handleHeightResizeMouseMove, handleHeightResizeMouseUp]);


  // Apply dynamic width and height styles
  const dynamicPanelStyle: React.CSSProperties = {
    ...(panelWidth !== null && window.innerWidth >= 768 ? { width: `${panelWidth}px` } : {}),
    ...(panelHeight !== null ? { height: `${panelHeight}px` } : {}),
  };

  let panelContent;
  let panelTitle = 'Viewer';
  let downloadButtonText = 'Download Content';
  let downloadFileName = 'content';

  // Function to download content
  const handleDownloadContent = () => {
    if (diagramType === 'image' && imageUrl) {
      const link = document.createElement('a');
      link.href = imageUrl;
      link.download = `image-${Date.now()}.png`; // Or derive from URL
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Image downloaded!');
      return;
    }

    if (!diagramContainerRef.current || !diagramContent) {
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
        document.body.removeChild(downloadLink);
        toast.success(`Chart downloaded as ${fileExtension.toUpperCase()}!`);
        return; // Exit early for data URL handling
      } else {
        toast.error('Chart canvas not found for chart.js download.');
        return;
      }
    } else if (diagramType === 'code' || diagramType === 'document-text') { // Added document-text
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
    document.body.removeChild(downloadLink);
    URL.revokeObjectURL(url);
    toast.success(`${diagramType === 'code' ? 'Code' : 'Diagram'} downloaded as ${fileExtension.toUpperCase()}!`);
  };

  // Function to download as PDF
  const handleDownloadPdf = async () => {
    if (!diagramContainerRef.current) {
      toast.error('Content not rendered for PDF download.');
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
      pdf.save(`content-${Date.now()}.pdf`);
      toast.success('Content downloaded as PDF!');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Failed to generate PDF. Please try again.');
    }
  };


  // Render logic based on diagramType
  if (diagramType === 'mermaid') {
    panelContent = (
      <Mermaid chart={diagramContent!} onMermaidError={onMermaidError} onSuggestAiCorrection={onSuggestAiCorrection} diagramRef={mermaidDivRef} />
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
          const svg = await gv.layout(diagramContent!, 'svg', 'dot');
          setDotSvg(svg);
        } catch (e: any) {
          console.error('DOT rendering error:', e);
          setDotError(`DOT rendering failed: ${e.message || 'Invalid DOT syntax'}`);
          onMermaidError(diagramContent!, 'syntax'); // Use onMermaidError for general diagram errors
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
      <div className="flex flex-col items-center justify-center h-full text-blue-600 dark:text-blue-400">
        <Loader2 className="h-8 w-8 animate-spin mb-2" />
        <p>Rendering DOT graph...</p>
      </div>
    ) : dotError ? (
      <div className="text-red-700 p-4 dark:text-red-300">
        <p>Error rendering DOT graph:</p>
        <pre className="bg-gray-100 p-3 rounded-md text-sm overflow-x-auto max-w-full dark:bg-gray-800 dark:text-red-400">
          {dotError}<br />
          Raw Code:<br />
          {diagramContent}
        </pre>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onSuggestAiCorrection(`Can you fix this DOT graph? Here's the code: ${diagramContent}`)}
          className="mt-4 bg-blue-500 text-white hover:bg-blue-600 dark:bg-blue-700 dark:hover:bg-blue-800"
        >
          Suggest AI Correction
        </Button>
      </div>
    ) : (
      // DOT graph content with custom zoom/pan (similar to Mermaid)
      <div className="relative w-full h-full bg-gray-900 rounded-lg overflow-hidden">
        <div
          className="w-full h-full flex items-center justify-center relative"
          style={{ cursor: isResizingHeight.current || isResizingWidth ? 'default' : 'grab' }} // Adjust cursor based on active resize
          onWheel={(e) => {
            // Implement zoom for DOT graph here if needed, similar to Mermaid
            // For now, only pan will be active by default via CSS
            e.preventDefault();
          }}
          onMouseDown={(e) => {
            // Only pan if not resizing height or width
            if (!isResizingHeight.current && !isResizingWidth) {
              // Implement pan for DOT graph here if needed, similar to Mermaid
            }
          }}
        >
          <div
            dangerouslySetInnerHTML={{ __html: dotSvg || '' }}
            style={{
              // Apply custom zoom/pan transforms if you implement them for DOT
              // For now, let's just ensure it fits and is centered
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain', // Ensure SVG scales within its container
            }}
            className="min-w-0 [&>svg]:max-w-full [&>svg]:h-auto [&>svg]:w-full"
          />
        </div>
      </div>
    );

  } else if (diagramType === 'chartjs') {
    panelTitle = 'Chart.js Graph View';
    downloadButtonText = 'Download Chart (PNG)'; // Clarify PNG for Chart.js
    downloadFileName = 'chartjs-graph';
    try {
      // Remove comments from Chart.js JSON before parsing
      const cleanedCodeContent = diagramContent!.replace(/\/\/.*|\/\*[\s\S]*?\*\//g, '');
      panelContent = <ChartRenderer chartConfig={JSON.parse(cleanedCodeContent)} chartRef={chartCanvasRef} />;
    } catch (e) {
      panelContent = (
        <div className="text-red-700 p-4 dark:text-red-300">
          <p>Invalid Chart.js configuration.</p>
          <pre className="bg-gray-100 p-3 rounded-md text-sm overflow-x-auto max-w-full dark:bg-gray-800 dark:text-red-400">
            {diagramContent}
          </pre>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onSuggestAiCorrection(`Can you fix this Chart.js configuration? Here's the code: ${diagramContent}`)}
            className="mt-4 bg-blue-500 text-white hover:bg-blue-600 shadow-sm dark:bg-blue-700 dark:hover:bg-blue-800"
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
        <div className="p-4 bg-white overflow-x-auto h-full dark:bg-gray-900">
          <pre className="font-mono text-sm leading-relaxed h-full">
            <code
              className="text-gray-800 h-full dark:text-gray-200"
              dangerouslySetInnerHTML={{
                __html: highlightCode(diagramContent!, language || 'plaintext')
              }}
            />
          </pre>
        </div>
      </div>
    );
  } else if (diagramType === 'document-text') { // New handler for plain text documents
    panelTitle = language ? `Document View - ${language.toUpperCase()}` : 'Document View';
    downloadButtonText = 'Download Document';
    downloadFileName = `document.${language || 'txt'}`;
    panelContent = (
      <div className="relative rounded-lg overflow-hidden h-full">
        <div className="p-4 bg-white overflow-x-auto h-full dark:bg-gray-900">
          <pre className="font-mono text-sm leading-relaxed h-full whitespace-pre-wrap"> {/* Added whitespace-pre-wrap */}
            <code
              className="text-gray-800 h-full dark:text-gray-200"
              dangerouslySetInnerHTML={{
                __html: escapeHtml(diagramContent!) // Escape HTML for plain text
              }}
            />
          </pre>
        </div>
      </div>
    );
  } else if (diagramType === 'image' && imageUrl) {
    panelTitle = 'Image Viewer';
    downloadButtonText = 'Download Image';
    downloadFileName = `image-${Date.now()}`;
    panelContent = (
      <div className="flex items-center justify-center h-full w-full p-2 bg-gray-100 dark:bg-gray-950">
        <img
          src={imageUrl}
          alt="Full size image"
          className="max-w-full max-h-full object-contain rounded-lg shadow-md"
          onError={(e) => {
            e.currentTarget.src = 'https://placehold.co/400x300/e0e0e0/666666?text=Image+Load+Error';
            e.currentTarget.alt = 'Image failed to load';
          }}
        />
      </div>
    );
  }
  else {
    panelContent = (
      <div className="flex flex-col items-center justify-center h-full text-slate-500 dark:text-gray-400">
        <AlertTriangle className="h-8 w-8 mb-2" />
        <p>Unsupported Content Type</p>
        <pre className="bg-gray-100 p-3 rounded-md text-sm overflow-x-auto max-w-full mt-2 dark:bg-gray-800 dark:text-gray-300">
          {diagramContent || 'No content provided.'}
        </pre>
      </div>
    );
    panelTitle = 'Unsupported Content';
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
          dark:bg-gray-900 dark:border-gray-700
        `}
        style={dynamicPanelStyle} // Apply dynamic width and height here
      >
        {/* Resizer Handle for Width - only visible on desktop */}
        <div
          className="hidden md:block absolute left-0 top-0 bottom-0 w-2 bg-transparent cursor-ew-resize z-50 hover:bg-gray-200 transition-colors duration-200 dark:hover:bg-gray-700"
          onMouseDown={handleWidthResizeMouseDown}
        />

        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between bg-white dark:bg-gray-900 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-slate-800 mb-2 sm:mb-0 dark:text-gray-100">{panelTitle}</h3>
          <div className="flex flex-wrap items-center gap-2 justify-end"> {/* Added flex-wrap and justify-end */}
            {/* Download Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadContent} // Changed to general handler
              className="text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900 dark:border-blue-700"
              title={downloadButtonText}
              disabled={!diagramContent && !imageUrl || diagramType === 'unknown'} // Disable if no content/image
            >
              <Download className="h-4 w-4 mr-0 sm:mr-2" /> {/* Removed mr-2 on small screens */}
              <span className="hidden sm:inline">{downloadButtonText}</span> {/* Hidden on small screens */}
            </Button>
            {/* Download PDF Button (only for diagrams, not code or images) */}
            {(!['code', 'image', 'unknown', 'document-text'].includes(diagramType)) && ( // Corrected condition
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadPdf}
                className="text-purple-600 hover:bg-purple-50 dark:text-purple-400 dark:hover:bg-purple-900 dark:border-purple-700"
                title="Download Content (PDF)"
                disabled={!diagramContent || diagramType === 'unknown'}
              >
                <Download className="h-4 w-4 mr-0 sm:mr-2" /> {/* Removed mr-2 on small screens */}
                <span className="hidden sm:inline">Download PDF</span> {/* Hidden on small screens */}
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={onClose} title="Close Panel" className="flex-shrink-0 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"> {/* Added flex-shrink-0 */}
              <X className="h-5 w-5 text-slate-500 hover:text-slate-700 dark:text-gray-400 dark:hover:text-gray-200" />
            </Button>
          </div>
        </div>
        <div ref={diagramContainerRef} className="flex-1 overflow-auto p-4 sm:p-6 modern-scrollbar dark:bg-gray-900"> {/* Added modern-scrollbar */}
          {panelContent}
        </div>
        {/* Resize Handle for Height */}
        <div
          className="absolute bottom-0 left-0 right-0 h-3 flex items-center justify-center cursor-ns-resize text-gray-500 hover:text-gray-300 z-50"
          onMouseDown={handleHeightResizeMouseDown}
        >
          <GripVertical className="h-4 w-4" />
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
      <div className="my-4 p-3 bg-slate-100 border border-slate-200 rounded-lg flex items-center justify-between dark:bg-gray-800 dark:border-gray-700">
        <div className="flex items-center gap-2 text-slate-700 dark:text-gray-200">
          <FileText className="h-4 w-4" />
          <span className="text-sm font-medium">{lang.toUpperCase()} Code</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onViewDiagram && onViewDiagram('code', codeContent, lang)} // Pass 'code' type and language
          className="bg-blue-500 text-white hover:bg-blue-600 shadow-sm dark:bg-blue-700 dark:hover:bg-blue-800"
        >
          <Maximize2 className="h-4 w-4 mr-2" />
          View Code
        </Button>
      </div>
    );
  }

  if (showRawCode) {
    return (
      <div className="relative my-4 rounded-lg overflow-hidden shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200 dark:bg-gray-800 dark:border-gray-700">
          <span className="text-xs font-medium text-gray-600 uppercase tracking-wide dark:text-gray-300">
            Raw Code ({lang})
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowRawCode(false)}
            className="h-6 w-6 p-0 text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700"
            title="Attempt rendering"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
        <div className="p-4 bg-white overflow-x-auto dark:bg-gray-900">
          <pre className="font-mono text-sm leading-relaxed">
            <code className="text-gray-800 dark:text-gray-200">{codeContent}</code>
          </pre>
        </div>
      </div>
    );
  }

  if (!inline && lang === 'mermaid') {
    // Render a button to view the diagram in the side panel
    return (
      <div className="my-4 p-3 bg-slate-100 border border-slate-200 rounded-lg flex items-center justify-between dark:bg-gray-800 dark:border-gray-700">
        <div className="flex items-center gap-2 text-slate-700 dark:text-gray-200">
          <FileText className="h-4 w-4" />
          <span className="text-sm font-medium">Mermaid Diagram</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onViewDiagram && onViewDiagram('mermaid', codeContent)}
          className="bg-blue-500 text-white hover:bg-blue-600 shadow-sm dark:bg-blue-700 dark:hover:bg-blue-800"
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
      <div className="my-4 p-3 bg-slate-100 border border-slate-200 rounded-lg flex items-center justify-between dark:bg-gray-800 dark:border-gray-700">
        <div className="flex items-center gap-2 text-slate-700 dark:text-gray-200">
          <FileText className="h-4 w-4" />
          <span className="text-sm font-medium">Chart.js Graph</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onViewDiagram && onViewDiagram('chartjs', codeContent)}
          className="bg-blue-500 text-white hover:bg-blue-600 shadow-sm dark:bg-blue-700 dark:hover:bg-blue-800"
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
      <div className="my-4 p-3 bg-slate-100 border border-slate-200 rounded-lg flex items-center justify-between dark:bg-gray-800 dark:border-gray-700">
        <div className="flex items-center gap-2 text-slate-700 dark:text-gray-200">
          <FileText className="h-4 w-4" />
          <span className="text-sm font-medium">DOT Graph</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onViewDiagram && onViewDiagram('dot', codeContent)}
          className="bg-blue-500 text-white hover:bg-blue-600 shadow-sm dark:bg-blue-700 dark:hover:bg-blue-800"
        >
          <Maximize2 className="h-4 w-4 mr-2" />
          View Diagram
        </Button>
      </div>
    );
  }

  // Fallback for inline code or unhandled languages
  return (
    <code className="bg-purple-50 text-purple-700 px-2 py-1 rounded-md font-mono text-sm border border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-700" {...props}>
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
const MemoizedMarkdownRenderer: React.FC<{
  content: string;
  isUserMessage?: boolean;
  onMermaidError: (code: string, errorType: 'syntax' | 'rendering') => void;
  onSuggestAiCorrection: (prompt: string) => void;
  onViewDiagram: (type: 'mermaid' | 'dot' | 'chartjs' | 'code' | 'image' | 'unknown' | 'document-text', content?: string, language?: string, imageUrl?: string) => void; // Added 'document-text'
  onToggleUserMessageExpansion: (messageId: string) => void;
  expandedMessages: Set<string>;
}> = memo(({ content, isUserMessage, onMermaidError, onSuggestAiCorrection, onViewDiagram, onToggleUserMessageExpansion, expandedMessages }) => {
  const textColorClass = isUserMessage ? 'text-white' : 'text-slate-700 dark:text-gray-300';
  const linkColorClass = isUserMessage ? 'text-blue-200 hover:underline' : 'text-blue-600 hover:underline dark:text-blue-400';
  const listTextColorClass = isUserMessage ? 'text-white' : 'text-slate-700 dark:text-gray-300';
  const blockquoteTextColorClass = isUserMessage ? 'text-blue-100' : 'text-slate-600 dark:text-gray-300';
  const blockquoteBgClass = isUserMessage ? 'bg-blue-700 border-blue-400' : 'bg-blue-50 border-blue-500 dark:bg-blue-950 dark:border-blue-700';
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
          h1: ({ node, ...props }) => <h1 className={`text-2xl font-extrabold ${isUserMessage ? 'text-white' : 'text-blue-700 dark:text-blue-400'} mt-4 mb-2`} {...props} />,
          h2: ({ node, ...props }) => <h2 className={`text-xl font-bold ${isUserMessage ? 'text-white' : 'text-purple-700 dark:text-purple-400'} mt-3 mb-2`} {...props} />,
          h3: ({ node, ...props }) => <h3 className={`text-lg font-semibold ${isUserMessage ? 'text-white' : 'text-green-700 dark:text-green-400'} mt-2 mb-1`} {...props} />,
          h4: ({ node, ...props }) => <h4 className={`text-base font-semibold ${isUserMessage ? 'text-white' : 'text-orange-700 dark:text-orange-400'} mt-1 mb-1`} {...props} />,
          p: ({ node, ...props }) => <p className={`mb-2 ${textColorClass} leading-relaxed`} {...props} />,
          a: ({ node, ...props }) => <a className={`${linkColorClass} font-medium`} {...props} />,
          ul: ({ node, ...props }) => <ul className={`list-disc list-inside space-y-1 ${listTextColorClass} mb-2`} {...props} />,
          ol: ({ node, ...props }) => <ol className={`list-decimal list-inside space-y-1 ${listTextColorClass} mb-2`} {...props} />,
          li: ({ node, ...props }) => <li className="mb-1" {...props} />,
          blockquote: ({ node, ...props }) => <blockquote className={`border-l-4 ${blockquoteBgClass} pl-4 py-2 italic ${blockquoteTextColorClass} rounded-r-md my-3`} {...props} />,
          table: ({ node, ...props }) => (
            // Ensure the table container takes full width and allows horizontal scrolling
            <div className="overflow-x-auto my-4 rounded-lg shadow-md border border-slate-200 w-full dark:border-gray-700">
              <table className="w-full border-collapse" {...props} />
            </div>
          ),
          thead: ({ node, ...props }) => <thead className="bg-gradient-to-r from-blue-100 to-purple-100 dark:from-blue-900 dark:to-purple-900" {...props} />,
          th: ({ node, ...props }) => (
            <th className="p-3 text-left border-b border-slate-300 font-semibold text-slate-800 dark:border-gray-200" {...props} />
          ),
          td: ({ node, ...props }) => (
            <td className="p-3 border-b border-slate-200 group-last:border-b-0 even:bg-slate-50 hover:bg-blue-50 transition-colors dark:border-gray-700 dark:even:bg-gray-800 dark:hover:bg-blue-950 dark:text-gray-300" {...props} />
          ),
        }}
      >
        {displayedContent}
      </ReactMarkdown>
      {needsExpansion && (
        <Button variant="link" size="sm" onClick={() => onToggleUserMessageExpansion(content)} // Pass content or message.id
          className="text-white text-xs p-0 h-auto mt-1 flex items-center justify-end"
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
      <Card className="bg-white rounded-lg shadow-xl max-w-sm w-full dark:bg-gray-800">
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-3 dark:text-gray-100">{title}</h3>
          <p className="text-slate-600 mb-6 dark:text-gray-300">{message}</p>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onClose} className="text-slate-600 border-slate-200 hover:bg-slate-50 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-700">
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

// Updated Message interface to include image and context IDs and imageMimeType
export interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: string; // ISO string
  isError?: boolean;
  originalUserMessageContent?: string; // For retry functionality
  imageUrl?: string; // URL of an uploaded image (e.g., from Supabase Storage)
  imageMimeType?: string; // New: Mime type of the uploaded image (e.g., 'image/png')
  attachedDocumentIds?: string[]; // New: IDs of documents attached to this message
  attachedNoteIds?: string[]; // New: IDs of notes attached to this message
}

interface AIChatProps {
  // MODIFIED: Added imageDataBase64 to onSendMessage signature
  onSendMessage: (message: string, attachedDocumentIds?: string[], attachedNoteIds?: string[], imageUrl?: string, imageMimeType?: string, imageDataBase64?: string) => Promise<void>;
  messages: Message[];
  isLoading: boolean;
  setIsLoading: (isLoading: boolean) => void;
  userProfile: UserProfile | null;
  documents: Document[]; // Ensure Document type is imported
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
  onDocumentUpdated: (updatedDocument: Document) => void; // NEW PROP
}

const AIChatComponent: React.FC<AIChatProps> = ({
  messages,
  onSendMessage,
  isLoading,
  setIsLoading,
  userProfile,
  documents, // Use documents prop
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
  onDocumentUpdated, // Destructure new prop
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
  const [isLoadingOlderMessages, setIsLoadingOlderMessages] = useState(false); // New state for older message loading

  // Image upload states (for UI preview only, not directly sent to AI anymore)
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [selectedImagePreview, setSelectedImagePreview] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // State for the side-out diagram/image panel
  const [activeDiagram, setActiveDiagram] = useState<{ content?: string; type: 'mermaid' | 'dot' | 'chartjs' | 'code' | 'image' | 'unknown' | 'document-text'; language?: string; imageUrl?: string } | null>(null); // Added imageUrl property
  const isDiagramPanelOpen = !!activeDiagram; // Derived state

  // State for image generation
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [imagePrompt, setImagePrompt] = useState('');

  // Local state to merge documents from prop and newly uploaded/updated documents
  const [mergedDocuments, setMergedDocuments] = useState<Document[]>(documents);

  // Sync mergedDocuments with the prop whenever the prop changes (e.g., parent fetches new data)
  useEffect(() => {
    setMergedDocuments(documents);
  }, [documents]);

  // Local handler to update mergedDocuments when an image is processed
  const handleDocumentUpdatedLocally = useCallback((updatedDoc: Document) => {
    setMergedDocuments(prevDocs => {
      const existingIndex = prevDocs.findIndex(doc => doc.id === updatedDoc.id);
      if (existingIndex > -1) {
        // Update existing document
        const newDocs = [...prevDocs];
        newDocs[existingIndex] = updatedDoc;
        return newDocs;
      } else {
        // Add new document (for newly created image documents)
        return [...prevDocs, updatedDoc];
      }
    });
  }, []);


  // Initialize useCopyToClipboard hook once at the top level of the component
  const { copied, copy } = useCopyToClipboard();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Handle scroll event for infinite loading and scroll to bottom button
  const handleScroll = useCallback(async () => {
    const chatContainer = chatContainerRef.current;
    if (chatContainer) {
      const { scrollTop, scrollHeight, clientHeight } = chatContainer;

      // Logic for "Scroll to Bottom" button visibility
      // Show button if not at the very bottom (with a 100px threshold)
      // Also ensure scrollHeight is greater than clientHeight (i.e., there's actually something to scroll)
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 100;
      setShowScrollToBottomButton(!isAtBottom && scrollHeight > clientHeight);

      // Logic for loading older messages (infinite scroll)
      const scrollThreshold = 100; // Load when within 100px of the top
      if (scrollTop < scrollThreshold && hasMoreMessages && !isLoadingOlderMessages && !isLoading) {
        setIsLoadingOlderMessages(true);
        const oldScrollHeight = scrollHeight; // Capture current scrollHeight before loading more

        await onLoadOlderMessages();

        // After messages load, adjust scroll position to maintain user's view
        // Use a timeout to ensure new messages have rendered and updated scrollHeight
        setTimeout(() => {
          if (chatContainerRef.current) {
            const newScrollHeight = chatContainerRef.current.scrollHeight;
            chatContainerRef.current.scrollTop = newScrollHeight - oldScrollHeight;
          }
        }, 0); // Small timeout to allow DOM to update

        setIsLoadingOlderMessages(false);
      }
    }
  }, [hasMoreMessages, isLoadingOlderMessages, isLoading, onLoadOlderMessages]);

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
    // Only scroll to bottom if the user is already near the bottom
    const chatContainer = chatContainerRef.current;
    if (chatContainer) {
      const { scrollTop, scrollHeight, clientHeight } = chatContainer;
      const isNearBottom = scrollTop + clientHeight >= scrollHeight - 200; // 200px threshold
      if (isNearBottom) {
        scrollToBottom();
      }
    }
  }, [messages, isLoading]); // Trigger scroll on message change or loading state change


  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [inputMessage, selectedImageFile]); // Re-evaluate height when image is added/removed


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

  // New callback to handle viewing a diagram, code, or image in the side panel
  const handleViewContent = useCallback((type: 'mermaid' | 'dot' | 'chartjs' | 'code' | 'image' | 'unknown' | 'document-text', content?: string, language?: string, imageUrl?: string) => {
    setActiveDiagram({ content, type, language, imageUrl });
  }, []);

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

  // Image handling logic
  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error('Please select an image file.');
        setSelectedImageFile(null);
        setSelectedImagePreview(null);
        return;
      }
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast.error('Image size exceeds 5MB limit.');
        setSelectedImageFile(null);
        setSelectedImagePreview(null);
        return;
      }
      setSelectedImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setSelectedImageFile(null);
      setSelectedImagePreview(null);
    }
  };

  const handleRemoveImage = () => {
    setSelectedImageFile(null);
    setSelectedImagePreview(null);
    if (imageInputRef.current) {
      imageInputRef.current.value = ''; // Clear file input
    }
  };

  const handleSendMessageWithImage = async () => {
    if (!inputMessage.trim() && !selectedImageFile) return;

    setIsLoading(true); // Start loading immediately for any message send operation
    let attachedImageDocumentId: string | undefined = undefined;
    let uploadedFilePath: string | undefined = undefined;
    let fileUrl: string | undefined = undefined; // Declare fileUrl here
    let finalAttachedDocumentIds = [...selectedDocumentIds]; // Start with existing selected docs

    try {
      if (selectedImageFile) {
        toast.info('Uploading image for analysis...', { id: 'image-upload' });
        // Generate a unique file name
        const fileExtension = selectedImageFile.name.split('.').pop();
        const fileName = `${crypto.randomUUID()}.${fileExtension}`;
        uploadedFilePath = `user_uploads/${userProfile?.id}/${fileName}`;

        // 1. Upload file to Supabase Storage
        const { data: storageData, error: storageError } = await supabase.storage
          .from('documents') // Your storage bucket for documents/images
          .upload(uploadedFilePath, selectedImageFile, {
            cacheControl: '3600',
            upsert: false,
          });

        if (storageError) {
          throw storageError;
        }

        const { data: publicUrlData } = await supabase.storage
          .from('documents')
          .getPublicUrl(uploadedFilePath);

        fileUrl = publicUrlData.publicUrl; // Assign to declared fileUrl

        // 2. Create a pending document entry for the image
        const { data: docData, error: docError } = await supabase
          .from('documents')
          .insert({
            user_id: userProfile!.id,
            title: selectedImageFile.name,
            file_name: selectedImageFile.name,
            file_type: selectedImageFile.type,
            file_size: selectedImageFile.size,
            processing_status: 'pending',
            type: 'image', // Mark as image document
            file_url: fileUrl, // Store the public URL
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (docError) {
          throw docError;
        }
        attachedImageDocumentId = docData.id;
        finalAttachedDocumentIds.push(attachedImageDocumentId); // Add new image doc ID to final list

        // Immediately add the pending document to local state for display
        handleDocumentUpdatedLocally(docData as Document);
        toast.success('Image uploaded. Analyzing content...', { id: 'image-upload' }); // Update toast

        // 3. Trigger image analysis via Edge Function and WAIT for it
        try {
          const response = await fetch('https://kegsrvnywshxyucgjxml.supabase.co/functions/v1/image-analyzer', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${await supabase.auth.getSession().then(s => s.data.session?.access_token)}`
            },
            body: JSON.stringify({
              documentId: attachedImageDocumentId,
              fileUrl: fileUrl,
              userId: userProfile!.id,
            }),
          });

          let responseBody: string;
          try {
            responseBody = await response.text();
          } catch (e) {
            throw new Error(`Failed to read image analysis response body: ${e}`);
          }

          if (!response.ok) {
            let errorBodyText = 'Unknown error';
            try {
              const errorJson = JSON.parse(responseBody);
              errorBodyText = errorJson.error || JSON.stringify(errorJson);
            } catch (e) {
              errorBodyText = responseBody;
            }
            throw new Error(`Image analysis failed: ${response.status} - ${errorBodyText}`);
          }

          let analysisResult;
          try {
            analysisResult = JSON.parse(responseBody);
          } catch (e) {
            throw new Error('Image analysis response was not valid JSON.');
          }

          const imageDescription = analysisResult.description || 'No detailed description provided.';

          // 4. Update document status with analysis result in DB
          const { data: updatedDocData, error: updateDocError } = await supabase.from('documents')
            .update({
              content_extracted: imageDescription,
              processing_status: 'completed',
              updated_at: new Date().toISOString()
            })
            .eq('id', attachedImageDocumentId!)
            .select()
            .single();

          console.log( 'updatedDocData: ', updatedDocData)

          if (updateDocError) {
            throw updateDocError;
          }

          // Update local state with the completed document
          if (updatedDocData) {
            handleDocumentUpdatedLocally(updatedDocData as Document);
            onDocumentUpdated(updatedDocData as Document); // Also call the parent prop
          
          toast.success('Image analysis complete!', { id: 'image-analysis' });
          } else {
            console.error('Failed to update document status:', updateDocError);
            toast.error('Failed to update document status.', { id: 'image-analysis' });
          }
        
        } catch (analysisError: any) {
          console.error('Error calling image-analyzer or updating document:', analysisError);
          toast.error(`Image analysis failed: ${analysisError.message}`, { id: 'image-analysis' });
          // Update document status to failed if analysis fails
          await supabase.from('documents')
            .update({
              processing_error: analysisError.message,
              processing_status: 'failed',
              updated_at: new Date().toISOString()
            })
            .eq('id', attachedImageDocumentId!);
          // Update local state to reflect the failed status
          if (attachedImageDocumentId) {
            handleDocumentUpdatedLocally({
              ...mergedDocuments.find(d => d.id === attachedImageDocumentId)!,
              processing_status: 'failed',
              processing_error: analysisError.message,
              updated_at: new Date().toISOString()
            });
          }
          // Re-throw to be caught by the outer try-catch for overall message sending failure
          throw analysisError;
        }
      }

      // Filter notes to get only those whose IDs are in finalAttachedDocumentIds
      const attachedNoteIds = notes
        .filter(note => finalAttachedDocumentIds.includes(note.id))
        .map(note => note.id);

      // MODIFIED: Pass imageUrl, imageMimeType, and imageDataBase64 to onSendMessage
      await onSendMessage(
        inputMessage.trim(),
        finalAttachedDocumentIds,
        attachedNoteIds,
        fileUrl, // Pass the image URL (public URL for display)
        selectedImageFile?.type, // Pass the image MIME type
        selectedImagePreview // Pass the base64 data URL for AI consumption
      );

      setInputMessage('');
      handleRemoveImage(); // Clear selected image preview

    } catch (error: any) {
      console.error('Overall message sending error (including image processing):', error);
      // If an error occurred during image upload/analysis, ensure loading is stopped
      toast.error(`Failed to send message: ${error.message}`);
      // Clean up if initial upload or registration fails
      if (attachedImageDocumentId) {
        await supabase.from('documents').delete().eq('id', attachedImageDocumentId);
        setMergedDocuments(prevDocs => prevDocs.filter(doc => doc.id !== attachedImageDocumentId)); // Remove from local state
      }
      if (uploadedFilePath) {
        await supabase.storage.from('documents').remove([uploadedFilePath]);
      }
    } finally {
      setIsLoading(false); // Ensure loading stops in all cases
    }
  };

  // Function to handle image generation
  const handleGenerateImageFromText = async () => {
    if (!imagePrompt.trim()) {
      toast.error('Please enter a prompt for image generation.');
      return;
    }

    setIsGeneratingImage(true);
    setGeneratedImageUrl(null);
    toast.info('Generating image...', { id: 'image-gen' });

    try {
      const payload = { instances: { prompt: imagePrompt }, parameters: { "sampleCount": 1 } };
      const apiKey = "" // If you want to use models other than imagen-3.0-generate-002, provide an API key here. Otherwise, leave this as-is.
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${apiKey}`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await response.json();

      if (result.predictions && result.predictions.length > 0 && result.predictions[0].bytesBase64Encoded) {
        const imageUrl = `data:image/png;base64,${result.predictions[0].bytesBase64Encoded}`;
        setGeneratedImageUrl(imageUrl);
        toast.success('Image generated successfully!', { id: 'image-gen' });
        // Optionally, add the generated image to the chat as an AI message
        onNewMessage({
          id: generateId(),
          content: `Here is an image generated from your prompt: "${imagePrompt}"`,
          role: 'assistant',
          timestamp: new Date().toISOString(),
          imageUrl: imageUrl,
          imageMimeType: 'image/png',
        });
        setImagePrompt(''); // Clear prompt after generation
      } else {
        throw new Error('No image data received from API.');
      }
    } catch (error: any) {
      console.error('Error generating image:', error);
      toast.error(`Failed to generate image: ${error.message}`, { id: 'image-gen' });
    } finally {
      setIsGeneratingImage(false);
    }
  };


  // Filter documents and notes that are currently selected to display their titles
  const selectedDocumentTitles = mergedDocuments // Use mergedDocuments
    .filter(doc => selectedDocumentIds.includes(doc.id) && doc.type === 'text')
    .map(doc => doc.title);

  const selectedNoteTitles = notes
    .filter(note => selectedDocumentIds.includes(note.id)) // Notes are also documents in a sense, but separate type
    .map(note => note.title);

  const selectedImageDocuments = mergedDocuments // Use mergedDocuments
    .filter(doc => selectedDocumentIds.includes(doc.id) && doc.type === 'image');


  // NEW: Handle viewing attached files
  const handleViewAttachedFile = useCallback((doc: Document) => {
    const fileExtension = doc.file_name.split('.').pop()?.toLowerCase(); // Use file_name
    const textMimeTypes = [
      'text/plain',
      'application/json',
      'text/markdown',
      'text/csv',
      'application/xml',
      // Add more text-based MIME types as needed
    ];
    const codeExtensions = [
      'js', 'ts', 'py', 'java', 'c', 'cpp', 'html', 'css', 'json', 'xml', 'sql', 'sh', 'bash'
    ];

    // Check if it's an image
    if (doc.file_type && doc.file_type.startsWith('image/')) { // Use file_type
      handleViewContent('image', undefined, undefined, doc.file_url); // Use file_url
    }
    // Check if it's a text-based file that can be displayed as code/text
    else if ((doc.file_type && textMimeTypes.includes(doc.file_type)) || (fileExtension && codeExtensions.includes(fileExtension))) { // Use file_type
      handleViewContent('document-text', doc.content_extracted || `Cannot display content for ${doc.file_name} directly. Try downloading.`, fileExtension || 'txt'); // Use content_extracted and file_name
    }
    // For other file types, offer download or open in new tab
    else if (doc.file_url) { // Use file_url
      window.open(doc.file_url, '_blank'); // Open in new tab
      toast.info(`Opening ${doc.file_name} in a new tab.`); // Use file_name
    } else {
      toast.error(`Cannot preview or open ${doc.file_name}. No URL available.`); // Use file_name
    }
  }, [handleViewContent]);

  // Effect to clear context when activeChatSessionId changes
  useEffect(() => {
    // Only clear if activeChatSessionId is not null (i.e., a session is active or newly created)
    // And if selectedDocumentIds is not already empty (to avoid unnecessary re-renders)
    if (activeChatSessionId !== null) {
      if (selectedDocumentIds.length > 0) {
        onSelectionChange([]); // Clear selected documents
      }
      handleRemoveImage(); // Clear selected image and its preview
      setInputMessage(''); // Clear input message
    }
  }, [activeChatSessionId, onSelectionChange]); // Depend on activeChatSessionId and onSelectionChange


  return (
    <CodeBlockErrorBoundary>
      <div className="flex flex-col h-full border-none relative bg-transparent justify-center overflow-hidden md:flex-row md:p-6 md:gap-6"> {/* Added md:gap-6 here */}
        {/* Main Chat Area */}
        <div className={`
          flex-1 flex flex-col h-full bg-white rounded-lg  transition-all duration-300 ease-in-out
          ${isDiagramPanelOpen ? 'md:w-[calc(100%-300px-1.5rem)]' : 'w-full'}
          dark:bg-gray-900
        `}>
          <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 flex flex-col modern-scrollbar pb-32 md:pb-6">
            {(displayMessages ?? []).length === 0 && (activeChatSessionId === null) && (
              <div className="text-center py-8 text-slate-400 flex-grow flex flex-col justify-center items-center dark:text-gray-500">
                <Bot className="h-12 w-12 mx-auto text-slate-300 mb-4 dark:text-gray-600" />
                <h3 className="text-lg font-medium text-slate-700 mb-2 dark:text-gray-200">Welcome to your AI Study Assistant!</h3>
                <p className="text-sm text-slate-500 max-w-md mx-auto dark:text-gray-400">
                  I can help you with questions about your notes, create study guides, explain concepts,
                  and assist with your academic work. Select some documents and start chatting!
                </p>
              </div>
            )}
            {activeChatSessionId !== null && messages.length === 0 && isLoading && (
              <div className="flex gap-3 justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                <span className="text-slate-500 dark:text-gray-400">Loading messages...</span>
              </div>
            )}

            {/* Loading Indicator for Older Messages */}
            {isLoadingOlderMessages && (
              <div className="flex justify-center py-2">
                <Loader2 className="h-5 w-5 animate-spin text-blue-500 mr-2" />
                <span className="text-slate-500 dark:text-gray-400">Loading older messages...</span>
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
                    {/* Display image if present in message history */}
                    {message.imageUrl && (
                      <div className="mb-3">
                        <img
                          src={message.imageUrl}
                          alt="Uploaded by user"
                          className="max-w-full h-auto rounded-lg shadow-md cursor-pointer"
                          onClick={() => handleViewContent('image', undefined, undefined, message.imageUrl!)}
                          onError={(e) => {
                            e.currentTarget.src = 'https://placehold.co/150x100/e0e0e0/666666?text=Image+Error';
                            e.currentTarget.alt = 'Image failed to load';
                          }}
                        />
                      </div>
                    )}
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
                    {/* Context Indicators for User Message */}
                    {(message.attachedDocumentIds && message.attachedDocumentIds.length > 0 || message.attachedNoteIds && message.attachedNoteIds.length > 0 || message.imageUrl) && (
                      <div className="flex flex-wrap gap-1 mt-2 justify-end">
                        {/* Image indicator for historical images that were part of the message */}
                        {message.imageUrl && (
                          <Badge variant="secondary" className="bg-blue-500/20 text-white border-blue-400 flex items-center gap-1">
                            <Image className="h-3 w-3" /> Image
                          </Badge>
                        )}
                        {message.attachedDocumentIds && message.attachedDocumentIds.length > 0 && (
                          <Badge variant="secondary" className="bg-purple-500/20 text-white border-purple-400">
                            <BookOpen className="h-3 w-3 mr-1" /> {message.attachedDocumentIds.length} Docs
                          </Badge>
                        )}
                        {message.attachedNoteIds && message.attachedNoteIds.length > 0 && (
                          <Badge variant="secondary" className="bg-green-500/20 text-white border-green-400">
                            <StickyNote className="h-3 w-3 mr-1" /> {message.attachedNoteIds.length} Notes
                          </Badge>
                        )}
                      </div>
                    )}
                  </>
                );
              } else { // message.role === 'assistant'
                if (message.isError) {
                  cardClasses = ' text-red-800 dark:text-red-300';
                  contentToRender = <MemoizedMarkdownRenderer content={message.content} isUserMessage={false} onMermaidError={handleMermaidError} onSuggestAiCorrection={handleSuggestMermaidAiCorrection} onViewDiagram={handleViewContent} onToggleUserMessageExpansion={handleToggleUserMessageExpansion} expandedMessages={expandedMessages} />;
                } else {
                  cardClasses = 'bg-white border border-slate-200 dark:bg-gray-800 dark:border-gray-700';
                  contentToRender = (
                    <>
                      {message.imageUrl && (
                        <div className="mb-3">
                          <img
                            src={message.imageUrl}
                            alt="Generated by AI"
                            className="max-w-full h-auto rounded-lg shadow-md cursor-pointer"
                            onClick={() => handleViewContent('image', undefined, undefined, message.imageUrl!)}
                            onError={(e) => {
                              e.currentTarget.src = 'https://placehold.co/150x100/e0e0e0/666666?text=Image+Error';
                              e.currentTarget.alt = 'Image failed to load';
                            }}
                          />
                        </div>
                      )}
                      <MemoizedMarkdownRenderer content={message.content} isUserMessage={false} onMermaidError={handleMermaidError} onSuggestAiCorrection={handleSuggestMermaidAiCorrection} onViewDiagram={handleViewContent} onToggleUserMessageExpansion={handleToggleUserMessageExpansion} expandedMessages={expandedMessages} />
                    </>
                  );
                }
              }

              const isLastAIMessage = message.role === 'assistant' && index === displayMessages.length - 1;

              return (
                <React.Fragment key={message.id}>
                  {showDateHeader && (
                    <div className="flex justify-center my-4">
                      <Badge variant="secondary" className="px-3 py-1 text-xs text-slate-500 bg-slate-100 rounded-full shadow-sm dark:bg-gray-700 dark:text-gray-300">
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
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${message.isError ? 'bg-red-500' : 'bg-transparent'} hidden sm:flex dark:bg-gray-700`}> {/* Added hidden sm:flex */}
                          {message.isError ? <AlertTriangle className="h-4 w-4 text-white" /> : <Bot className="h-4 w-4 text-white" />}
                        </div>
                      )}
                      <div className={`flex flex-col ${message.role === 'user' ? 'items-end max-w-sm' : 'items-start'}`}>
                        <Card className={`max-w-sm sm:max-w-4xl overflow-hidden rounded-lg ${message.role === 'assistant' ? 'border-none shadow-none bg-transparent dark:bg-transparent' : 'dark:bg-gray-800 dark:border-gray-700'}' ${cardClasses}`}>
                          <CardContent className={`p-2 prose border-none prose-base max-w-full leading-relaxed dark:prose-invert`}> {/* Changed prose-sm to prose-base */}
                            {contentToRender}

                            {/* Render attached files if attachedDocumentIds exist */}
                            {message.attachedDocumentIds && message.attachedDocumentIds.length > 0 && (
                              <div className={`mt-3 pt-3 ${message.role === 'user' ? 'border-blue-400' : 'border-slate-300 dark:border-gray-600'} border-t border-dashed`}>
                                <p className={`text-sm font-semibold mb-2 ${message.role === 'user' ? 'text-blue-100' : 'text-slate-600 dark:text-gray-300'}`}>Attached Files:</p>
                                <div className="flex flex-wrap gap-2">
                                  {message.attachedDocumentIds.map(docId => {
                                    // Use mergedDocuments for finding the document
                                    const doc = mergedDocuments.find(d => d.id === docId);
                                    return doc ? (
                                      <Badge
                                        key={doc.id}
                                        variant="secondary"
                                        className={`cursor-pointer hover:opacity-80 transition-opacity ${doc.processing_status === 'pending' ? 'bg-yellow-500/30 text-yellow-800 border-yellow-400 dark:bg-yellow-950 dark:text-yellow-300 dark:border-yellow-700' : doc.processing_status === 'failed' ? 'bg-red-500/30 text-red-800 border-red-400 dark:bg-red-950 dark:text-red-300 dark:border-red-700' : (message.role === 'user' ? 'bg-blue-500/30 text-white border-blue-400' : 'bg-slate-200 text-slate-700 border-slate-300 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600')}`}
                                        onClick={() => handleViewAttachedFile(doc)}
                                      >
                                        {doc.processing_status === 'pending' ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : doc.processing_status === 'failed' ? <AlertTriangle className="h-3 w-3 mr-1" /> : <FileText className="h-3 w-3 mr-1" />}
                                        {doc.file_name}
                                      </Badge>
                                    ) : (
                                      <Badge key={docId} variant="destructive" className="text-red-600 dark:text-red-400">
                                        File Not Found: {docId}
                                      </Badge>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                        <div className={`flex gap-1 mt-1 ${message.role === 'user' ? 'justify-end' : 'justify-start'} w-full`}>
                          <span className={`text-xs text-slate-500 ${message.role === 'user' ? 'text-white/80' : 'text-slate-500 dark:text-gray-400'}`}>
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
                                    className="h-6 w-6 rounded-full text-slate-400 hover:text-blue-500 hover:bg-slate-100 dark:text-gray-400 dark:hover:text-blue-400 dark:hover:bg-gray-700"
                                    title="Regenerate response"
                                  >
                                    <RefreshCw className="h-4 w-4" />
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => copy(message.content)}
                                  className="h-6 w-6 rounded-full text-slate-400 hover:text-green-500 hover:bg-slate-100 dark:text-gray-400 dark:hover:text-green-400 dark:hover:bg-gray-700"
                                  title="Copy message"
                                >
                                  <Copy className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDeleteClick(message.id)}
                                  className="h-6 w-6 rounded-full text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:text-gray-400 dark:hover:text-red-400 dark:hover:bg-gray-700"
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
                                className="h-6 w-6 rounded-full text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:text-gray-400 dark:hover:text-red-400 dark:hover:bg-gray-700"
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
                                className="h-6 w-6 rounded-full text-slate-400 hover:text-green-500 hover:bg-slate-100 dark:text-gray-400 dark:hover:text-green-400 dark:hover:bg-gray-700"
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
                  <div className="w-fit p-3 rounded-lg bg-white shadow-sm border border-slate-200 dark:bg-gray-800 dark:border-gray-700">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-slate-400 rounded-full animate-pulse dark:bg-gray-500"></div>
                      <div className="w-2 h-2 bg-slate-400 rounded-full animate-pulse delay-75 dark:bg-gray-500"></div>
                      <div className="w-2 h-2 bg-slate-400 rounded-full animate-pulse delay-150 dark:bg-gray-500"></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {isGeneratingImage && (
              <div className="flex justify-center">
                <div className="w-full max-w-4xl flex gap-3 items-center justify-start">
                  <div className="h-8 w-8 rounded-full bg-gradient-to-r from-pink-500 to-red-500 flex items-center justify-center">
                    <Sparkles className="h-4 w-4 text-white" />
                  </div>
                  <div className="w-fit p-3 rounded-lg bg-white shadow-sm border border-slate-200 dark:bg-gray-800 dark:border-gray-700">
                    <div className="flex gap-1">
                      <Loader2 className="h-4 w-4 animate-spin text-pink-500" />
                      <span className="text-slate-500 dark:text-gray-400">Generating image...</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
          {/* Input area - now with a wrapper div for the full-width background */}
          <div className="fixed bottom-0 left-0 right-0 p-4 sm:p-6 pb-8 bg-slate-50 sm:bg-transparent md:bg-transparent md:shadow-none md:static md:rounded-lgz-10 md:static md:p-0 rounded-t-lg md:rounded-lg dark:bg-gray-950 md:dark:bg-transparent">
            {/* Display selected documents/notes/image */}
            {(selectedDocumentIds.length > 0 || selectedImagePreview) && (
              <div className="max-w-4xl mx-auto mb-3 p-3 bg-slate-100 border border-slate-200 rounded-lg flex flex-wrap items-center gap-2 dark:bg-gray-800 dark:border-gray-700">
                <span className="text-sm font-medium text-slate-700 dark:text-gray-200">Context:</span>
                {selectedImagePreview && (
                  <Badge variant="secondary" className="bg-blue-500/20 text-blue-800 border-blue-400 flex items-center gap-1 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-700">
                    <Image className="h-3 w-3" /> Preview
                    <XCircle className="h-3 w-3 ml-1 cursor-pointer text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200" onClick={handleRemoveImage} />
                  </Badge>
                )}
                {selectedImageDocuments.length > 0 && (
                  <Badge variant="secondary" className="bg-blue-500/20 text-blue-800 border-blue-400 flex items-center gap-1 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-700">
                    <Image className="h-3 w-3" /> {selectedImageDocuments.length} Image Doc{selectedImageDocuments.length > 1 ? 's' : ''}
                    <XCircle className="h-3 w-3 ml-1 cursor-pointer text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200" onClick={() => onSelectionChange(selectedDocumentIds.filter(id => !selectedImageDocuments.map(imgDoc => imgDoc.id).includes(id)))} />
                  </Badge>
                )}
                {selectedDocumentTitles.length > 0 && (
                  <Badge variant="secondary" className="bg-purple-500/20 text-purple-800 border-purple-400 flex items-center gap-1 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-700">
                    <BookOpen className="h-3 w-3 mr-1" /> {selectedDocumentTitles.length} Text Doc{selectedDocumentTitles.length > 1 ? 's' : ''}
                    <XCircle className="h-3 w-3 ml-1 cursor-pointer text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-200" onClick={() => onSelectionChange(selectedDocumentIds.filter(id => !documents.filter(doc => doc.type === 'text').map(d => d.id).includes(id)))} />
                  </Badge>
                )}
                {selectedNoteTitles.length > 0 && (
                  <Badge variant="secondary" className="bg-green-500/20 text-green-800 border-green-400 flex items-center gap-1 dark:bg-green-950 dark:text-green-300 dark:border-green-700">
                    <StickyNote className="h-3 w-3 mr-1" /> {selectedNoteTitles.length} Note{selectedNoteTitles.length > 1 ? 's' : ''}
                    <XCircle className="h-3 w-3 ml-1 cursor-pointer text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-200" onClick={() => onSelectionChange(selectedDocumentIds.filter(id => !notes.map(n => n.id).includes(id)))} />
                  </Badge>
                )}
              </div>
            )}

            <form onSubmit={async (e) => {
              e.preventDefault();
              if (inputMessage.trim() || selectedImageFile) { // Allow sending with just an image
                await handleSendMessageWithImage(); // Use new handler
              }
            }} className="flex items-end gap-2 p-3 rounded-lg bg-white border border-slate-200 shadow-lg max-w-4xl mx-auto dark:bg-gray-800 dark:border-gray-700"> {/* Added shadow-lg */}
              <textarea
                ref={textareaRef}
                value={inputMessage}
                onChange={(e) => {
                  setInputMessage(e.target.value);
                }}
                placeholder="Ask a question about your notes or study topics..."
                className="flex-1 text-slate-700 focus:outline-none focus:ring-0 resize-none overflow-hidden max-h-40 min-h-[48px] bg-transparent px-2 dark:text-gray-200 dark:placeholder-gray-400"
                disabled={isLoading || isSubmittingUserMessage || isGeneratingImage}
                rows={1}
              />
              <div className="flex items-end gap-2">
                {/* Image Upload Button */}
                <input
                  type="file"
                  accept="image/*"
                  ref={imageInputRef}
                  onChange={handleImageChange}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => imageInputRef.current?.click()}
                  className="text-slate-600 hover:bg-slate-100 h-10 w-10 flex-shrink-0 rounded-lg p-0 dark:text-gray-300 dark:hover:bg-gray-700"
                  title="Upload Image"
                  disabled={isLoading || isSubmittingUserMessage || isGeneratingImage}
                >
                  <Upload className="h-5 w-5" />
                </Button>

                {/* Document/Note Selector Button */}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowDocumentSelector(true)}
                  className="text-slate-600 hover:bg-slate-100 h-10 w-10 flex-shrink-0 rounded-lg p-0 dark:text-gray-300 dark:hover:bg-gray-700"
                  title="Select Documents/Notes for Context"
                  disabled={isLoading || isSubmittingUserMessage || isGeneratingImage}
                >
                  <FileText className="h-5 w-5" />
                </Button>
                {/* Image Generation Button */}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={handleGenerateImageFromText}
                  className="text-pink-600 hover:bg-pink-100 h-10 w-10 flex-shrink-0 rounded-lg p-0 dark:text-pink-400 dark:hover:bg-pink-900"
                  title="Generate Image from Text"
                  disabled={isLoading || isSubmittingUserMessage || isGeneratingImage || !inputMessage.trim()}
                >
                  <Sparkles className="h-5 w-5" />
                </Button>
                <Button
                  type="submit"
                  disabled={isLoading || isSubmittingUserMessage || isGeneratingImage || (!inputMessage.trim() && !selectedImageFile)} // Disable if no text and no image
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
              documents={mergedDocuments} // Pass mergedDocuments to DocumentSelector
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
            className="fixed bottom-28 right-6 md:bottom-8 md:right-8 bg-white rounded-full shadow-lg p-2 z-20 transition-opacity duration-300 hover:scale-105 dark:bg-gray-800 dark:border-gray-700 dark:hover:bg-gray-700"
            title="Scroll to bottom"
          >
            <ChevronDown className="h-5 w-5 text-slate-600 dark:text-gray-300" />
          </Button>
        )}

        {/* Diagram/Image Panel - Conditionally rendered and responsive */}
        {isDiagramPanelOpen && (
          <DiagramPanel
            key={`${activeDiagram?.content || ''}-${activeDiagram?.type || ''}-${activeDiagram?.language || ''}-${activeDiagram?.imageUrl || ''}`} // Add all relevant props to key
            diagramContent={activeDiagram?.content}
            diagramType={activeDiagram?.type || 'unknown'}
            onClose={handleCloseDiagramPanel}
            onMermaidError={handleMermaidError}
            onSuggestAiCorrection={handleSuggestMermaidAiCorrection}
            isOpen={isDiagramPanelOpen}
            language={activeDiagram?.language}
            imageUrl={activeDiagram?.imageUrl} // Pass imageUrl
          />
        )}
      </div>
    </CodeBlockErrorBoundary>
  );
};

export const AIChat = memo(AIChatComponent);
