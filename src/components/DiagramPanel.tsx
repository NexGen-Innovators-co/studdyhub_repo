import React, { useRef, useEffect, useState, useCallback, memo, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from './ui/button';
import { X, RefreshCw, AlertTriangle, Code, Download, GripVertical, Loader2, Palette, Maximize2, Minimize2, ZoomIn, ZoomOut, Eye, FileCode } from 'lucide-react';
import { toast } from 'sonner';
import { Chart, registerables } from 'chart.js';
import Mermaid from './Mermaid';
import { Graphviz } from '@hpcc-js/wasm';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { themes, ThemeName, escapeHtml, highlightCode } from '../utils/codeHighlighting';
import { Easing } from 'framer-motion';
import DOMPurify from 'dompurify';

// Ensure Chart.js components are registered once
Chart.register(...registerables);

// Declare global types for libraries
declare global {
  interface Window {
    jspdf: any;
    html2canvas: any;
    Viz: any;
  }
}

const IsolatedHtml = ({ html }: { html: string }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (iframeRef.current && html) {
      setIsLoading(true);
      setHasError(false);
      
      try {
        const iframe = iframeRef.current;
        const sanitizedHtml = DOMPurify.sanitize(html, {
          WHOLE_DOCUMENT: true,
          RETURN_DOM: false,
          ADD_TAGS: ['style', 'script'],
          ADD_ATTR: ['target', 'sandbox']
        });

        const fullHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI Generated Content</title>
    <style>
        * {
            box-sizing: border-box;
        }
        body {
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
            line-height: 1.5;
        }
    </style>
</head>
<body>
    ${sanitizedHtml}
</body>
</html>`;

        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        if (iframeDoc) {
          iframeDoc.open();
          iframeDoc.write(fullHtml);
          iframeDoc.close();
          
          iframe.onload = () => {
            setIsLoading(false);
          };
          
          iframe.onerror = () => {
            setHasError(true);
            setIsLoading(false);
          };
        }
      } catch (error) {
        // //console.error('Error rendering HTML content:', error);
        setHasError(true);
        setIsLoading(false);
      }
    }
  }, [html]);

  if (hasError) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-red-600 bg-red-50 p-4">
        <AlertTriangle className="h-8 w-8 mb-2" />
        <p className="text-center">Error rendering HTML content</p>
        <details className="mt-4 w-full max-w-md">
          <summary className="cursor-pointer text-sm">View raw HTML</summary>
          <pre className="mt-2 p-2 bg-white border rounded text-xs overflow-auto max-h-32">
            {html}
          </pre>
        </details>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white z-10">
          <div className="flex flex-col items-center">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600 mb-2" />
            <p className="text-sm text-gray-600">Loading HTML content...</p>
          </div>
        </div>
      )}
      <iframe
        ref={iframeRef}
        className="w-full h-full border-0"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
        title="AI Generated HTML Content"
        style={{
          backgroundColor: 'white',
          minHeight: '100%'
        }}
      />
    </div>
  );
};

interface DiagramPanelProps {
  diagramContent?: string;
  diagramType: 'mermaid' | 'dot' | 'chartjs' | 'code' | 'image' | 'unknown' | 'document-text' | 'threejs' | 'html';
  onClose: () => void;
  onMermaidError: (code: string, errorType: 'syntax' | 'rendering') => void;
  onSuggestAiCorrection: (prompt: string) => void;
  isOpen: boolean;
  language?: string;
  imageUrl?: string;
  initialWidthPercentage?: number;
}

interface ChartRendererProps {
  chartConfig: any;
  onInvalidConfig: (error: string | null) => void;
  chartRef: React.RefObject<HTMLCanvasElement>;
}

const ChartRenderer: React.FC<ChartRendererProps> = memo(({ chartConfig, onInvalidConfig, chartRef }) => {
  const chartInstance = useRef<Chart | null>(null);

  useEffect(() => {
    if (chartRef.current) {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }

      try {
        const ctx = chartRef.current.getContext('2d');
        if (ctx) {
          chartInstance.current = new Chart(ctx, chartConfig);
          onInvalidConfig(null);
        }
      } catch (error: any) {
        // //console.error("Error rendering Chart.js:", error);
        onInvalidConfig(`Error rendering chart: ${error.message}`);
        if (chartRef.current) {
          const ctx = chartRef.current.getContext('2d');
          if (ctx) {
            ctx.clearRect(0, 0, chartRef.current.width, chartRef.current.height);
            ctx.fillStyle = '#ef4444';
            ctx.font = '16px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('Error rendering chart.', chartRef.current.width / 2, chartRef.current.height / 2);
            ctx.fillText('Check console for details.', chartRef.current.width / 2, chartRef.current.height / 2 + 20);
          }
        }
      }
    }

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
        chartInstance.current = null;
      }
    };
  }, [chartConfig, chartRef, onInvalidConfig]);

  return (
    <div className="p-4 flex items-center justify-center h-full">
      <canvas ref={chartRef} className="max-w-full h-full"></canvas>
    </div>
  );
});

interface ThreeJSRendererProps {
  codeContent: string;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  onInvalidCode: (error: string | null) => void;
  onSceneReady: (scene: THREE.Scene, renderer: THREE.WebGLRenderer, cleanup: () => void) => void;
}

const ThreeJSRenderer: React.FC<ThreeJSRendererProps> = memo(({ codeContent, canvasRef, onInvalidCode, onSceneReady }) => {
  const threeJsCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (canvasRef.current && codeContent) {
      // //console.log("[Three.js Renderer] Attempting to render Three.js scene.");
      if (threeJsCleanupRef.current) {
        threeJsCleanupRef.current();
        threeJsCleanupRef.current = null;
        // //console.log("[Three.js Renderer] Cleaned up previous scene.");
      }

      try {
        const createSceneWrapper = new Function('THREE', 'OrbitControls', 'GLTFLoader', `
${codeContent}
return createThreeJSScene;
`);

        const createScene = createSceneWrapper(THREE, OrbitControls, GLTFLoader);
        const { scene, renderer, cleanup } = createScene(canvasRef.current, THREE, OrbitControls, GLTFLoader);

        threeJsCleanupRef.current = cleanup;
        onInvalidCode(null);
        onSceneReady(scene, renderer, cleanup);
        //console.log("[Three.js Renderer] Three.js scene rendered successfully.");
      } catch (error: any) {
        //console.error("Error rendering Three.js scene:", error);
        onInvalidCode(`Error rendering 3D scene: ${error.message}`);
        if (canvasRef.current) {
          const ctx = canvasRef.current.getContext('2d');
          if (ctx) {
            ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
            ctx.fillStyle = '#ef4444';
            ctx.font = '16px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('Error rendering 3D scene.', canvasRef.current.width / 2, canvasRef.current.height / 2);
            ctx.fillText('Check console for details.', canvasRef.current.width / 2, canvasRef.current.height / 2 + 20);
          }
        }
      }
    }

    return () => {
      if (threeJsCleanupRef.current) {
        threeJsCleanupRef.current();
        threeJsCleanupRef.current = null;
        //console.log("[Three.js Renderer] Cleanup: Three.js scene unmounted.");
      }
    };
  }, [codeContent, canvasRef, onInvalidCode, onSceneReady]);

  return (
    <div className="p-4 flex items-center justify-center h-full">
      <canvas ref={canvasRef} className="max-w-full h-full"></canvas>
    </div>
  );
});

export const DiagramPanel: React.FC<DiagramPanelProps> = memo(({
  diagramContent,
  diagramType,
  onClose,
  onMermaidError,
  onSuggestAiCorrection,
  isOpen,
  language,
  imageUrl,
  initialWidthPercentage,
}) => {
  const [panelWidth, setPanelWidth] = useState<number>(initialWidthPercentage || 65);
  const [panelHeight, setPanelHeight] = useState<number>(window.innerHeight * 0.8);
  const [isResizing, setIsResizing] = useState<{ width: boolean; height: boolean }>({ width: false, height: false });
  const initialPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const initialSize = useRef<{ width: number; height: number }>({ width: 0, height: 0 });
  const chartRef = useRef<HTMLCanvasElement>(null);
  const diagramContainerRef = useRef<HTMLDivElement>(null);
  const [currentTheme, setCurrentTheme] = useState<ThemeName>('github-light');
  const [showThemeSelector, setShowThemeSelector] = useState(false);
  const threeJsRef = useRef<HTMLCanvasElement>(null);
  const [threeJsScene, setThreeJsScene] = useState<THREE.Scene | null>(null);
  const [threeJsRenderer, setThreeJsRenderer] = useState<THREE.WebGLRenderer | null>(null);
  const threeJsCleanupFunction = useRef<(() => void) | null>(null);
  const diagramPanelRef = useRef<HTMLDivElement>(null);
  const [chartError, setChartError] = useState<string | null>(null);
  const [threeJsError, setThreeJsError] = useState<string | null>(null);
  const [dotSvg, setDotSvg] = useState<string | null>(null);
  const [dotError, setDotError] = useState<string | null>(null);
  const [isDotLoading, setIsDotLoading] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const isPanningRef = useRef(false);
  const startPanPos = useRef({ x: 0, y: 0 });
  const [showSourceCode, setShowSourceCode] = useState(false);

  // Auto-detect system theme preference
  useEffect(() => {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setCurrentTheme(prefersDark ? 'github-dark' : 'github-light');
  }, []);

  // Set initial dimensions
  useEffect(() => {
    if (isOpen && diagramPanelRef.current) {
      const updateDimensions = () => {
        if (window.innerWidth >= 768) {
          setPanelWidth(initialWidthPercentage || 65);
          setPanelHeight(window.innerHeight * .9);
        } else {
          setPanelWidth(100);
          setPanelHeight(window.innerHeight);
        }
      };
      updateDimensions();
      window.addEventListener('resize', updateDimensions);
      return () => window.removeEventListener('resize', updateDimensions);
    }
  }, [isOpen, initialWidthPercentage]);

  // Cleanup Three.js scene
  useEffect(() => {
    return () => {
      if (threeJsCleanupFunction.current) {
        threeJsCleanupFunction.current();
        threeJsCleanupFunction.current = null;
        setThreeJsScene(null);
        setThreeJsRenderer(null);
      }
    };
  }, [diagramContent, diagramType]);

  // Handle Three.js scene ready
  const handleThreeJsSceneReady = useCallback((scene: THREE.Scene, renderer: THREE.WebGLRenderer, cleanup: () => void) => {
    setThreeJsScene(scene);
    setThreeJsRenderer(renderer);
    threeJsCleanupFunction.current = cleanup;
  }, []);

  // Resize handlers
  const handleResize = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isResizing.width && !isResizing.height) return;

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    if (isResizing.width) {
      const deltaX = clientX - initialPos.current.x;
      const newWidth = initialSize.current.width + deltaX;
      const minWidth = 300;
      const maxWidth = window.innerWidth * 0.9;
      const constrainedWidth = Math.max(minWidth, Math.min(newWidth, maxWidth));
      setPanelWidth((constrainedWidth / window.innerWidth) * 100);
    }

    if (isResizing.height) {
      const deltaY = clientY - initialPos.current.y;
      const newHeight = initialSize.current.height + deltaY;
      const minHeight = 200;
      const maxHeight = window.innerHeight * 0.9;
      const constrainedHeight = Math.max(minHeight, Math.min(newHeight, maxHeight));
      setPanelHeight(constrainedHeight);
    }
  }, [isResizing]);

  const stopResize = useCallback(() => {
    setIsResizing({ width: false, height: false });
    document.body.style.cursor = 'default';
  }, []);

  useEffect(() => {
    if (isResizing.width || isResizing.height) {
      window.addEventListener('mousemove', handleResize);
      window.addEventListener('mouseup', stopResize);
      window.addEventListener('touchmove', handleResize);
      window.addEventListener('touchend', stopResize);
    }
    return () => {
      window.removeEventListener('mousemove', handleResize);
      window.removeEventListener('mouseup', stopResize);
      window.removeEventListener('touchmove', handleResize);
      window.removeEventListener('touchend', stopResize);
    };
  }, [isResizing, handleResize, stopResize]);

  // Pan handlers
  const handlePanStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (isFullScreen || window.innerWidth < 768) return;
    isPanningRef.current = true;
    startPanPos.current = {
      x: 'touches' in e ? e.touches[0].clientX : e.clientX,
      y: 'touches' in e ? e.touches[0].clientY : e.clientY
    };
  }, [isFullScreen]);

  // Dynamic styles
  const dynamicPanelStyle: React.CSSProperties = {
    width: window.innerWidth >= 768 ? `${panelWidth}%` : '100%',
    height: panelHeight,
    overflow: 'hidden',
    touchAction: isResizing.width || isResizing.height ? 'none' : 'auto'
  };

  const contentStyle: React.CSSProperties = {
    transform: `scale(${zoomLevel}) translate(${panOffset.x}px, ${panOffset.y}px)`,
    transformOrigin: 'center center',
    transition: isResizing.width || isResizing.height ? 'none' : 'transform 0.2s ease-out'
  };

  let panelTitle = 'Viewer';
  let downloadButtonText = 'Download Content';
  let downloadFileName = 'content';

  // Download content
  const handleDownloadContent = () => {
    if (!diagramContainerRef.current && !imageUrl && diagramType !== 'html') {
      toast.error('Content not rendered for download.');
      return;
    }

    let fileExtension = '';
    let contentToDownload: string | Blob = '';
    let mimeType = '';

    if (diagramType === 'html') {
      contentToDownload = diagramContent || '';
      fileExtension = 'html';
      mimeType = 'text/html;charset=utf-8';
    } else if (diagramType === 'image' && imageUrl) {
      const link = document.createElement('a');
      link.href = imageUrl;
      link.download = `image-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Image downloaded!');
      return;
    } else if (diagramType === 'mermaid' || diagramType === 'dot') {
      const svgElement = diagramContainerRef.current?.querySelector('svg');
      if (svgElement) {
        contentToDownload = new XMLSerializer().serializeToString(svgElement);
        fileExtension = 'svg';
        mimeType = 'image/svg+xml;charset=utf-8';
      } else {
        toast.error('SVG element not found for download.');
        return;
      }
    } else if (diagramType === 'chartjs') {
      if (chartRef.current) {
        contentToDownload = chartRef.current.toDataURL('image/png');
        fileExtension = 'png';
        mimeType = 'image/png';
      } else {
        toast.error('Chart canvas not found for chart.js download.');
        return;
      }
    } else if (diagramType === 'threejs') {
      if (threeJsRef.current) {
        contentToDownload = threeJsRef.current.toDataURL('image/png');
        fileExtension = 'png';
        mimeType = 'image/png';
      } else {
        toast.error('3D scene canvas not found for download.');
        return;
      }
    } else if (diagramType === 'code' || diagramType === 'document-text') {
      if (!diagramContent) {
        toast.error('No content available for code/document download.');
        return;
      }
      contentToDownload = diagramContent;
      fileExtension = language || 'txt';
      mimeType = `text/plain;charset=utf-8`;
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
    toast.success(`${diagramType === 'code' ? 'Code' : diagramType === 'html' ? 'Web Page' : 'Diagram'} downloaded as ${fileExtension.toUpperCase()}!`);
  };

  // Download GLTF
  const handleDownloadGltf = useCallback(() => {
    if (!threeJsScene || !threeJsRenderer) {
      toast.error('Three.js scene not ready for GLTF export.');
      return;
    }

    toast.info('Exporting GLTF...');
    const exporter = new GLTFExporter();
    exporter.parse(
      threeJsScene,
      (gltf) => {
        const output = JSON.stringify(gltf, null, 2);
        const blob = new Blob([output], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'scene.gltf';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success('GLTF scene downloaded successfully!');
      },
      (error) => {
        //console.error('Error exporting GLTF:', error);
        toast.error('Failed to export GLTF scene.');
      },
      {}
    );
  }, [threeJsScene, threeJsRenderer]);

  // Download as PDF
  const handleDownloadPdf = async () => {
    let targetRef;
    if (diagramType === 'chartjs') {
      targetRef = chartRef;
    } else if (diagramType === 'threejs') {
      targetRef = threeJsRef;
    } else if (diagramType === 'html') {
      targetRef = diagramContainerRef;
    } else {
      targetRef = diagramContainerRef;
    }

    if (!targetRef.current) {
      toast.error('Content not rendered for PDF download.');
      return;
    }

    if (typeof window.jspdf === 'undefined' || typeof window.html2canvas === 'undefined') {
      toast.error('PDF generation libraries not loaded. Please try again.');
      return;
    }

    toast.info('Generating PDF...');
    try {
      const canvas = await window.html2canvas(targetRef.current, {
        scale: 3 * zoomLevel,
        useCORS: true,
        backgroundColor: themes[currentTheme].background,
      });

      const pdf = new window.jspdf.jsPDF({
        orientation: canvas.width > canvas.height ? 'l' : 'p',
        unit: 'px',
        format: [canvas.width, canvas.height],
      });

      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, canvas.width, canvas.height);
      pdf.save(`content-${Date.now()}.pdf`);
      toast.success('Content downloaded as PDF!');
    } catch (error) {
      //console.error('Error generating PDF:', error);
      toast.error('Failed to generate PDF. Please try again.');
    }
  };

  // DOT rendering logic
  useEffect(() => {
    const renderDot = async () => {
      if (diagramType === 'dot' && diagramContent) {
        setDotSvg(null);
        setDotError(null);
        setIsDotLoading(true);

        try {
          const gv = await Graphviz.load();
          const svg = await gv.layout(diagramContent!, 'svg', 'dot');
          setDotSvg(svg);
        } catch (e: any) {
          //console.error('DiagramPanel (DOT): DOT rendering error:', e);
          setDotError(`DOT rendering failed: ${e.message || 'Invalid DOT syntax'}`);
          onMermaidError(diagramContent!, 'syntax');
        } finally {
          setIsDotLoading(false);
        }
      } else {
        setDotSvg(null);
        setDotError(null);
        setIsDotLoading(false);
      }
    };

    renderDot();
  }, [diagramContent, diagramType, onMermaidError]);

  // Theme selector component
  const ThemeSelector = () => (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowThemeSelector(!showThemeSelector)}
        className="text-sm px-3 py-1"
      >
        <Palette className="h-4 w-4 mr-2" />
        Theme
      </Button>
      {showThemeSelector && (
        <div className="absolute top-full right-0 mt-2 bg-white border rounded-lg shadow-lg z-50 min-w-[200px] dark:bg-gray-800 dark:border-gray-600">
          <div className="p-2 space-y-1">
            {Object.keys(themes).map((themeName) => (
              <button
                key={themeName}
                className={`w-full text-left px-3 py-2 rounded text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${currentTheme === themeName ? 'bg-blue-50 text-blue-700 dark:bg-blue-900 dark:text-blue-300' : ''}`}
                onClick={() => {
                  setCurrentTheme(themeName as ThemeName);
                  setShowThemeSelector(false);
                }}
              >
                <div className="flex items-center space-x-2">
                  <div
                    className="w-4 h-4 rounded border"
                    style={{ backgroundColor: themes[themeName as ThemeName].background }}
                  />
                  <span className="capitalize">{themeName.replace('-', ' ')}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderSourceCode = useMemo(() => {
    const theme = themes[currentTheme];
    return (
      <div
        className="relative rounded-lg overflow-hidden h-full shadow-lg"
        style={{ backgroundColor: theme.background, border: `1px solid ${theme.border}` }}
      >
        <div
          className="px-4 py-2 border-b text-sm font-medium flex items-center justify-between"
          style={{ backgroundColor: theme.background, borderColor: theme.border, color: theme.foreground }}
        >
          <span className="flex items-center space-x-2">
            <Code className="h-4 w-4" />
            <span>{language?.toUpperCase() || 'PLAINTEXT'}</span>
          </span>
          <span className="text-xs opacity-75" style={{ color: theme.lineNumbers }}>
            {diagramContent?.split('\n').length || 0} lines
          </span>
        </div>
        <div className="p-4 overflow-auto h-full">
          <div className="flex">
            <div className="select-none pr-4 text-right font-mono text-sm leading-relaxed" style={{ color: theme.lineNumbers }}>
              {diagramContent?.split('\n').map((_, index) => (
                <div key={index + 1} className="min-h-[1.5rem]">{index + 1}</div>
              ))}
            </div>
            <div className="flex-1 overflow-x-auto">
              <pre className="font-mono text-sm leading-relaxed">
                <code
                  dangerouslySetInnerHTML={{
                    __html: diagramContent ? highlightCode(diagramContent, language || 'plaintext', theme) : ''
                  }}
                  style={{ color: theme.foreground }}
                />
              </pre>
            </div>
          </div>
        </div>
      </div>
    );
  }, [diagramContent, language, currentTheme]);

  const renderContent = useMemo(() => {
    if (!diagramContent && !imageUrl) {
      return <p className="text-gray-500">No content to display.</p>;
    }

    const theme = themes[currentTheme];

    if (showSourceCode && diagramContent && diagramType !== 'image' && diagramType !== 'unknown') {
      return renderSourceCode;
    }

    if (diagramType === 'html') {
      panelTitle = 'HTML Web Page View';
      downloadButtonText = 'Download HTML';
      downloadFileName = 'webpage';
      return <IsolatedHtml html={diagramContent || ''} />;
    } else if (diagramType === 'mermaid') {
      panelTitle = 'Mermaid Diagram View';
      downloadButtonText = 'Download Diagram (SVG)';
      downloadFileName = 'mermaid-diagram';
      return (
        <Mermaid
          chart={diagramContent || ''}
          onMermaidError={onMermaidError}
          onSuggestAiCorrection={onSuggestAiCorrection}
          diagramRef={diagramContainerRef}
          key={diagramContent}
        />
      );
    } else if (diagramType === 'dot') {
      panelTitle = 'DOT Graph View';
      downloadButtonText = 'Download Graph (SVG)';
      downloadFileName = 'dot-graph';
      return isDotLoading ? (
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
        <div className="relative w-full h-full bg-gray-900 rounded-lg overflow-hidden">
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ cursor: isResizing.height || isResizing.width ? 'default' : 'grab' }}
          >
            <div
              dangerouslySetInnerHTML={{ __html: dotSvg || '' }}
              style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
              className="min-w-0 [&>svg]:max-w-full [&>svg]:h-auto [&>svg]:w-full"
            />
          </div>
        </div>
      );
    } else if (diagramType === 'chartjs') {
      panelTitle = 'Chart.js Graph View';
      downloadButtonText = 'Download Chart (PNG)';
      downloadFileName = 'chartjs-graph';
      let chartConfigToRender: any = {};
      try {
        const cleanedContent = diagramContent ? diagramContent.replace(/\/\/.*|\/\*[\s\S]*?\*\//g, '') : '';
        chartConfigToRender = cleanedContent ? JSON.parse(cleanedContent) : {};
      } catch (e: any) {
        setChartError(`Invalid Chart.js JSON: ${e.message}. The AI might have included non-JSON elements.`);
        chartConfigToRender = {};
      }

      return (
        <>
          {chartError && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4 dark:bg-red-900 dark:text-red-300">
              <AlertTriangle className="inline h-4 w-4 mr-2" />
              <span>{chartError}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onSuggestAiCorrection(`your recent codes had and error, you fix it. Here's the code: ${diagramContent}`)}
                className="ml-4 text-red-700 hover:text-red-900 dark:text-red-300 dark:hover:text-red-100"
              >
                Suggest AI Correction
              </Button>
            </div>
          )}
          <ChartRenderer
            chartConfig={chartConfigToRender}
            onInvalidConfig={setChartError}
            chartRef={chartRef}
          />
        </>
      );
    } else if (diagramType === 'threejs') {
      panelTitle = 'Three.js 3D Scene View';
      downloadButtonText = 'Download 3D Scene (PNG)';
      downloadFileName = 'threejs-scene';
      return (
        <>
          {threeJsError && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4 dark:bg-red-900 dark:text-red-300">
              <AlertTriangle className="inline h-4 w-4 mr-2" />
              <span>{threeJsError}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onSuggestAiCorrection(`Can you fix this Three.js code? Here's the code: ${diagramContent}`)}
                className="ml-4 text-red-700 hover:text-red-900 dark:text-red-300 dark:hover:text-red-100"
              >
                Suggest AI Correction
              </Button>
            </div>
          )}
          <ThreeJSRenderer
            codeContent={diagramContent || ''}
            canvasRef={threeJsRef}
            onInvalidCode={setThreeJsError}
            onSceneReady={handleThreeJsSceneReady}
          />
        </>
      );
    } else if (diagramType === 'code') {
      panelTitle = language ? `Code View - ${language.toUpperCase()}` : 'Code View';
      downloadButtonText = 'Download Code';
      downloadFileName = `code.${language || 'txt'}`;
      return renderSourceCode;
    } else if (diagramType === 'document-text') {
      panelTitle = language ? `Document View - ${language.toUpperCase()}` : 'Document View';
      downloadButtonText = 'Download Document';
      downloadFileName = `document.${language || 'txt'}`;
      return (
        <div
          className="relative rounded-lg overflow-hidden h-full shadow-lg"
          style={{ backgroundColor: theme.background, border: `1px solid ${theme.border}` }}
        >
          <div className="p-6 overflow-auto h-full">
            <pre className="font-mono text-sm leading-relaxed h-full whitespace-pre-wrap" style={{ color: theme.foreground }}>
              <code dangerouslySetInnerHTML={{ __html: escapeHtml(diagramContent || '') }} style={{ color: theme.foreground }} />
            </pre>
          </div>
        </div>
      );
    } else if (diagramType === 'image' && imageUrl) {
      panelTitle = 'Image Viewer';
      downloadButtonText = 'Download Image';
      downloadFileName = `image-${Date.now()}`;
      return (
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
    } else {
      panelTitle = 'Unsupported Content';
      downloadButtonText = 'Download Content';
      downloadFileName = 'content';
      return (
        <div className="flex flex-col items-center justify-center h-full text-slate-500 dark:text-gray-400">
          <AlertTriangle className="h-8 w-8 mb-2" />
          <p>Unsupported Content Type</p>
          <pre className="bg-gray-100 p-3 rounded-md text-sm overflow-x-auto max-w-full mt-2 dark:bg-gray-800 dark:text-gray-300">
            {diagramContent || 'No content provided.'}
          </pre>
        </div>
      );
    }
  }, [diagramContent, diagramType, imageUrl, currentTheme, isResizing, onMermaidError, onSuggestAiCorrection, chartError, threeJsError, language, dotSvg, dotError, isDotLoading, handleThreeJsSceneReady, showSourceCode]);

  // Click outside handler for theme selector
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!showThemeSelector) return;
      const target = event.target as Element;
      if (!target.closest('.theme-selector-container')) {
        setShowThemeSelector(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showThemeSelector]);

  if (!isOpen) return null;

  const panelVariants = {
    initial: { x: '100%', opacity: 0, scale: 0.95 },
    animate: {
      x: 0,
      opacity: 1,
      scale: 1,
      transition: {
        duration: 0.3,
        ease: "easeInOut" as Easing,
      },
    },
    exit: {
      x: '100%',
      opacity: 0,
      scale: 0.95,
      transition: {
        duration: 0.2,
        ease: "easeInOut" as Easing,
      },
    },
  };

  // Determine available actions based on diagram type
  const availableActions = {
    html: ['download', 'pdf'],
    mermaid: ['download', 'pdf', 'toggle'],
    dot: ['download', 'pdf', 'toggle'],
    chartjs: ['download', 'pdf', 'toggle'],
    threejs: ['download', 'pdf', 'gltf', 'toggle'],
    code: ['download', 'theme'],
    'document-text': ['download', 'theme'],
    image: ['download'],
    unknown: []
  };

  return (
    <motion.div
      ref={diagramPanelRef}
      className={`fixed inset-0 md:relative md:inset-y-0 md:right-0 bg-white shadow-xl flex flex-col z-40 md:rounded-l-lg md:shadow-md md:border-l md:border-slate-200 dark:bg-gray-900 dark:border-gray-700 ${isFullScreen ? 'w-full' : ''}`}
      variants={panelVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      style={dynamicPanelStyle}
    >
      <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between bg-white dark:bg-gray-900 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-slate-800 mb-2 sm:mb-0 dark:text-gray-100">{panelTitle}</h3>
        <div className="flex flex-wrap items-center gap-2 justify-end">
          {availableActions[diagramType].includes('theme') && (
            <div className="theme-selector-container">
              <ThemeSelector />
            </div>
          )}
          {availableActions[diagramType].includes('toggle') && diagramContent && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSourceCode(!showSourceCode)}
              className="text-sm px-3 py-1"
            >
              {showSourceCode ? (
                <>
                  <Eye className="h-4 w-4 mr-2" />
                  View Preview
                </>
              ) : (
                <>
                  <FileCode className="h-4 w-4 mr-2" />
                  View Source
                </>
              )}
            </Button>
          )}
          {availableActions[diagramType].includes('download') && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadContent}
              className="text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900 dark:border-blue-700"
              title={downloadButtonText}
              disabled={!diagramContent && !imageUrl || diagramType === 'unknown'}
            >
              <Download className="h-4 w-4 mr-0 sm:mr-2" />
              <span className="hidden sm:inline">{downloadButtonText}</span>
            </Button>
          )}
          {availableActions[diagramType].includes('gltf') && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadGltf}
              className="text-green-600 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900 dark:border-green-700"
              title="Download 3D Model (GLTF)"
              disabled={!threeJsScene || !threeJsRenderer}
            >
              <Download className="h-4 w-4 mr-0 sm:mr-2" />
              <span className="hidden sm:inline">Download GLTF</span>
            </Button>
          )}
          {availableActions[diagramType].includes('pdf') && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadPdf}
              className="text-purple-600 hover:bg-purple-50 dark:text-purple-400 dark:hover:bg-purple-900 dark:border-purple-700"
              title="Download Content (PDF)"
              disabled={!diagramContent || diagramType === 'unknown'}
            >
              <Download className="h-4 w-4 mr-0 sm:mr-2" />
              <span className="hidden sm:inline">Download PDF</span>
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsFullScreen(prev => !prev)}
            title={isFullScreen ? 'Exit Full Screen' : 'Full Screen'}
            className="text-slate-600 hover:bg-slate-200 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            {isFullScreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            title="Close Panel"
            className="flex-shrink-0 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
          >
            <X className="h-5 w-5 text-slate-500 hover:text-slate-700 dark:text-gray-400 dark:hover:text-gray-200" />
          </Button>
        </div>
      </div>

      <div
        ref={diagramContainerRef}
        className="flex-1 overflow-auto modern-scrollbar dark:bg-gray-900 canvas-container"
        style={contentStyle}
        onMouseDown={handlePanStart}
        onTouchStart={handlePanStart}
      >
        {renderContent}
      </div>
    </motion.div>
  );
});