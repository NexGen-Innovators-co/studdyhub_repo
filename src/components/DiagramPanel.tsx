import React, { useRef, useEffect, useState, useCallback, memo, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from './ui/button';
import { X, RefreshCw, AlertTriangle, Code, Download, GripVertical, Loader2, Palette, Maximize2, Minimize2, ZoomIn, ZoomOut, Eye, FileCode, Wifi, WifiOff } from 'lucide-react';
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
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

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

// Extend MermaidProps interface to include onError
interface MermaidProps {
  chart: string;
  onError?: (code: string, errorType: 'syntax' | 'rendering') => void;
}

// Enhanced Error Boundary for better error handling
class PanelErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode; onError?: (error: Error) => void },
  { hasError: boolean; error?: Error; errorInfo?: string }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Panel Error:', error, errorInfo);
    this.setState({ errorInfo: errorInfo.componentStack });
    this.props.onError?.(error);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="flex flex-col items-center justify-center h-full p-4 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-800">
          <AlertTriangle className="h-12 w-12 text-red-500 mb-4" />
          <h3 className="text-lg font-semibold text-red-700 dark:text-red-300 mb-2">
            Content Rendering Error
          </h3>
          <p className="text-sm text-red-600 dark:text-red-400 text-center mb-4">
            Something went wrong while displaying this content.
          </p>
          <div className="space-y-2">
            <Button
              onClick={() => this.setState({ hasError: false, error: undefined, errorInfo: undefined })}
              variant="outline"
              size="sm"
              className="text-red-600 border-red-300 hover:bg-red-50 dark:text-red-400 dark:border-red-700"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
            <details className="text-xs text-red-500 dark:text-red-400">
              <summary className="cursor-pointer hover:text-red-700 dark:hover:text-red-300">
                Technical Details
              </summary>
              <pre className="mt-2 p-2 bg-red-100 dark:bg-red-950/40 rounded text-xs overflow-auto max-h-32 whitespace-pre-wrap">
                {this.state.error?.message}
                {this.state.errorInfo}
              </pre>
            </details>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const IsolatedHtml = ({ html }: { html: string }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const handleRetry = useCallback(() => {
    setRetryCount(prev => prev + 1);
    setHasError(false);
    setIsLoading(true);
  }, []);

  useEffect(() => {
    if (iframeRef.current && html) {
      setIsLoading(true);
      setHasError(false);

      try {
        const iframe = iframeRef.current;
        const sanitizedHtml = DOMPurify.sanitize(html, {
          WHOLE_DOCUMENT: true,
          RETURN_DOM: false,
          ADD_TAGS: ['style', 'script', 'iframe', 'link', 'meta'],
          ADD_ATTR: ['target', 'sandbox']
        });

        const fullHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body>
${sanitizedHtml}
</body>
</html>
`;

        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        if (iframeDoc) {
          iframeDoc.open();
          iframeDoc.write(fullHtml);
          iframeDoc.close();

          const handleMessage = (event: MessageEvent) => {
            if (event.source === iframe.contentWindow) {
              if (event.data.type === 'loaded') {
                setIsLoading(false);
              } else if (event.data.type === 'error') {
                setHasError(true);
                setIsLoading(false);
              }
            }
          };

          window.addEventListener('message', handleMessage);

          const timeoutId = setTimeout(() => {
            setIsLoading(false);
          }, 5000);

          return () => {
            window.removeEventListener('message', handleMessage);
            clearTimeout(timeoutId);
          };
        }
      } catch (error) {
        console.error('Error rendering HTML content:', error);
        setHasError(true);
        setIsLoading(false);
      }
    }
  }, [html, retryCount]);

  if (hasError) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-red-600 bg-red-50 p-4 dark:bg-red-950/20 dark:text-red-300">
        <AlertTriangle className="h-8 w-8 mb-3" />
        <h3 className="text-lg font-semibold mb-2">HTML Rendering Error</h3>
        <p className="text-center text-sm mb-4">
          The HTML content couldn't be displayed properly.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button
            onClick={handleRetry}
            variant="outline"
            size="sm"
            className="text-red-600 border-red-300 hover:bg-red-50 dark:text-red-400 dark:border-red-700"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
          <details className="mt-2">
            <summary className="cursor-pointer text-sm hover:text-red-700 dark:hover:text-red-200">
              View HTML Source
            </summary>
            <pre className="mt-2 p-3 bg-white dark:bg-gray-900 border rounded text-xs overflow-auto max-h-40 w-full max-w-md">
              {html}
            </pre>
          </details>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/90 dark:bg-gray-900/90 z-10">
          <div className="flex flex-col items-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-3" />
            <p className="text-sm text-gray-600 dark:text-gray-400">Rendering HTML content...</p>
          </div>
        </div>
      )}
      <iframe
        ref={iframeRef}
        className="w-full h-full border-0 rounded-lg"
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
  const [isRendering, setIsRendering] = useState(false);

  useEffect(() => {
    if (chartRef.current) {
      setIsRendering(true);

      if (chartInstance.current) {
        chartInstance.current.destroy();
      }

      try {
        const ctx = chartRef.current.getContext('2d');
        if (ctx) {
          chartInstance.current = new Chart(ctx, chartConfig);
          onInvalidConfig(null);
          setIsRendering(false);
        }
      } catch (error: any) {
        console.error("Error rendering Chart.js:", error);
        onInvalidConfig(`Chart rendering failed: ${error.message}`);
        setIsRendering(false);

        if (chartRef.current) {
          const ctx = chartRef.current.getContext('2d');
          if (ctx) {
            ctx.clearRect(0, 0, chartRef.current.width, chartRef.current.height);
            ctx.fillStyle = '#ef4444';
            ctx.font = '16px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('Chart rendering failed', chartRef.current.width / 2, chartRef.current.height / 2);
            ctx.fillText('Check configuration', chartRef.current.width / 2, chartRef.current.height / 2 + 25);
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
    <div className="p-4 flex items-center justify-center h-full relative">
      {isRendering && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/90 dark:bg-gray-900/90 z-10">
          <div className="flex flex-col items-center">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600 mb-2" />
            <p className="text-sm text-gray-600 dark:text-gray-400">Rendering chart...</p>
          </div>
        </div>
      )}
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
  const [isRendering, setIsRendering] = useState(false);

  useEffect(() => {
    if (canvasRef.current && codeContent) {
      setIsRendering(true);

      if (threeJsCleanupRef.current) {
        threeJsCleanupRef.current();
        threeJsCleanupRef.current = null;
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
        setIsRendering(false);
      } catch (error: any) {
        console.error("Error rendering Three.js scene:", error);
        onInvalidCode(`3D scene error: ${error.message}`);
        setIsRendering(false);

        if (canvasRef.current) {
          const ctx = canvasRef.current.getContext('2d');
          if (ctx) {
            ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
            ctx.fillStyle = '#ef4444';
            ctx.font = '16px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('3D Scene Error', canvasRef.current.width / 2, canvasRef.current.height / 2);
            ctx.fillText('Check code syntax', canvasRef.current.width / 2, canvasRef.current.height / 2 + 25);
          }
        }
      }
    }

    return () => {
      if (threeJsCleanupRef.current) {
        threeJsCleanupRef.current();
        threeJsCleanupRef.current = null;
      }
    };
  }, [codeContent, canvasRef, onInvalidCode, onSceneReady]);

  return (
    <div className="p-4 flex items-center justify-center h-full relative">
      {isRendering && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/90 dark:bg-gray-900/90 z-10">
          <div className="flex flex-col items-center">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600 mb-2" />
            <p className="text-sm text-gray-600 dark:text-gray-400">Rendering 3D scene...</p>
          </div>
        </div>
      )}
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
  initialWidthPercentage
}) => {
  const diagramPanelRef = useRef<HTMLDivElement>(null);
  const diagramContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<HTMLCanvasElement>(null);
  const threeJsRef = useRef<HTMLCanvasElement>(null); // This is used for the 3D scene rendering
  const [showSourceCode, setShowSourceCode] = useState(false);
  const [currentTheme, setCurrentTheme] = useState<ThemeName>('github-dark');
  const [showThemeSelector, setShowThemeSelector] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [panelWidth, setPanelWidth] = useState(initialWidthPercentage || 65);
  const [dotSvg, setDotSvg] = useState<string | null>(null);
  const [dotError, setDotError] = useState<string | null>(null);
  const [isDotLoading, setIsDotLoading] = useState(false);
  const [chartError, setChartError] = useState<string | null>(null);
  const [threeJsError, setThreeJsError] = useState<string | null>(null);
  const [threeJsScene, setThreeJsScene] = useState<THREE.Scene | null>(null);
  const [threeJsRenderer, setThreeJsRenderer] = useState<THREE.WebGLRenderer | null>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [networkError, setNetworkError] = useState(false);

  const isPhone = useCallback(() => {
    const userAgent = navigator.userAgent.toLowerCase();
    return /mobile|android|iphone|ipad|tablet/i.test(userAgent) && window.innerWidth <= 768;
  }, []);

  const theme = themes[currentTheme];

  const handleThreeJsSceneReady = useCallback((scene: THREE.Scene, renderer: THREE.WebGLRenderer, cleanup: () => void) => {
    setThreeJsScene(scene);
    setThreeJsRenderer(renderer);
  }, []);

  const handleDownloadContent = useCallback(() => {
    if (diagramType === 'image' && imageUrl) {
      const link = document.createElement('a');
      link.href = imageUrl;
      link.download = 'image.png';
      link.click();
      toast.success('Image download started.');
    } else if (diagramContent) {
      const blob = new Blob([diagramContent], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = diagramType === 'code' ? `code.${language || 'txt'}` : `${diagramType}.${language || 'txt'}`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success('Content download started.');
    } else {
      toast.error('No content available to download.');
    }
  }, [diagramContent, diagramType, language, imageUrl]);

  const handleDownloadGltf = useCallback(() => {
    if (threeJsScene && threeJsRenderer) {
      const exporter = new GLTFExporter();
      exporter.parse(
        threeJsScene,
        (gltf) => {
          const output = JSON.stringify(gltf, null, 2);
          const blob = new Blob([output], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = '3d-scene.gltf';
          link.click();
          URL.revokeObjectURL(url);
          toast.success('GLTF download started.');
        },
        (error) => {
          console.error('GLTF export error:', error);
          toast.error('Failed to export GLTF.');
        },
        { binary: false }
      );
    } else {
      toast.error('No 3D scene available to download.');
    }
  }, [threeJsScene, threeJsRenderer]);

  const handleDownloadPdf = useCallback(async () => {
    if (!diagramContainerRef.current) {
      toast.error('No content available to export as PDF.');
      return;
    }

    try {
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'px',
        format: 'a4',
      });

      const contentElement = diagramContainerRef.current;
      const canvas = await html2canvas(contentElement, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        width: contentElement.offsetWidth,
        height: contentElement.offsetHeight,
        windowWidth: contentElement.offsetWidth,
        windowHeight: contentElement.offsetHeight,
      });

      const imgData = canvas.toDataURL('image/png');
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`${diagramType}-export.pdf`);
      toast.success('PDF download started.');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Failed to generate PDF. Please try again.');
    }
  }, [diagramType]);

  const handlePanStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isFullScreen) return;
    // Implement panning logic if needed
  }, [isFullScreen]);

  const ThemeSelector = useCallback(() => (
    <div className="relative theme-selector-container">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowThemeSelector(!showThemeSelector)}
        className="text-xs sm:text-sm px-2 sm:px-3 py-1"
      >
        <Palette className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
        <span className="hidden sm:inline">Theme</span>
      </Button>
      <AnimatePresence>
        {showThemeSelector && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50"
          >
            {Object.keys(themes).map((themeName) => (
              <button
                key={themeName}
                onClick={() => {
                  setCurrentTheme(themeName as ThemeName);
                  setShowThemeSelector(false);
                }}
                className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${currentTheme === themeName ? 'bg-blue-50 dark:bg-blue-900' : ''}`}
              >
                {themeName.charAt(0).toUpperCase() + themeName.slice(1)}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  ), [showThemeSelector, currentTheme]);

  useEffect(() => {
    if (diagramType === 'dot' && diagramContent) {
      setIsDotLoading(true);
      Graphviz.load().then((graphviz) => {
        try {
          const svg = graphviz.dot(diagramContent);
          setDotSvg(svg);
          setDotError(null);
        } catch (error: any) {
          console.error('Error rendering DOT graph:', error);
          setDotError(`Failed to render DOT graph: ${error.message}`);
        } finally {
          setIsDotLoading(false);
        }
      }).catch((error) => {
        console.error('Error loading Graphviz:', error);
        setDotError('Failed to load Graphviz library.');
        setIsDotLoading(false);
        setNetworkError(true);
      });
    }
  }, [diagramContent, diagramType]);

  const dynamicPanelStyle = useMemo(() => ({
    width: isPhone() || isFullScreen ? '100%' : `${panelWidth}%`,
    maxWidth: isPhone() || isFullScreen ? '100%' : '90%',
    minWidth: isPhone() ? '100%' : '400px',
  }), [panelWidth, isPhone, isFullScreen]);

  const contentStyle = useMemo(() => ({
    transform: `scale(${zoomLevel}) translate(${panOffset.x}px, ${panOffset.y}px)`,
    transformOrigin: 'center',
    overflow: 'auto',
  }), [zoomLevel, panOffset]);

  const renderSourceCode = useMemo(() => {
    if (!diagramContent) return null;
    const highlightedCode = highlightCode(diagramContent, language || 'text', themes[currentTheme]);
    return (
      <div className="relative rounded-lg overflow-hidden h-full shadow-lg" style={{ backgroundColor: theme.background, border: `1px solid ${theme.border}` }}>
        <div className="p-4 sm:p-6 overflow-auto h-full modern-scrollbar">
          <pre className="font-mono text-xs sm:text-sm leading-relaxed">
            <code dangerouslySetInnerHTML={{ __html: highlightedCode }} style={{ color: theme.foreground }} />
          </pre>
        </div>
      </div>
    );
  }, [diagramContent, language, currentTheme, theme]);

  const renderContent = useMemo(() => {
    let panelTitle = '';
    let downloadButtonText = '';
    let downloadFileName = '';

    if (showSourceCode && diagramContent) {
      panelTitle = language ? `${language.toUpperCase()} Source` : 'Source Code';
      downloadButtonText = 'Download Source';
      downloadFileName = `source.${language || 'txt'}`;
      return renderSourceCode;
    }

    if (diagramType === 'mermaid' && diagramContent) {
      panelTitle = 'Mermaid Diagram';
      downloadButtonText = 'Download PNG';
      downloadFileName = 'mermaid-diagram';
      // Mermaid component already handles its own diagramRef internally.
      // No need to pass a separate diagramRef here. The diagramRef is used internally by the Mermaid component.
      return <PanelErrorBoundary><Mermaid chart={diagramContent} onMermaidError={onMermaidError} onSuggestAiCorrection={onSuggestAiCorrection} diagramRef={useRef(null)} /></PanelErrorBoundary>;
    } else if (diagramType === 'dot') {
      panelTitle = 'DOT Graph';
      downloadButtonText = 'Download SVG';
      downloadFileName = 'dot-graph';
      if (isDotLoading) {
        return (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
          </div>
        );
      }
      if (dotError) {
        return (
          <div className="bg-red-50 border border-red-200 text-red-700 px-3 sm:px-4 py-3 rounded mb-4 dark:bg-red-950/20 dark:text-red-300 dark:border-red-800">
            <div className="flex items-start">
              <AlertTriangle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm mb-2">{dotError}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onSuggestAiCorrection(`Fix this DOT graph code: ${diagramContent}`)}
                  className="text-red-700 hover:text-red-900 dark:text-red-300 dark:hover:text-red-100"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Get AI Fix
                </Button>
              </div>
            </div>
          </div>
        );
      }
      return (
        <PanelErrorBoundary>
          <div className="p-4 flex items-center justify-center h-full">
            <div dangerouslySetInnerHTML={{ __html: dotSvg || '' }} style={{ maxWidth: '100%', maxHeight: '100%' }} />
          </div>
        </PanelErrorBoundary>
      );
    } else if (diagramType === 'chartjs') {
      panelTitle = 'Chart.js Graph';
      downloadButtonText = 'Download PNG';
      downloadFileName = 'chart';
      let chartConfigToRender = {};
      try {
        chartConfigToRender = JSON.parse(diagramContent || '{}');
      } catch (error) {
        console.error('Invalid Chart.js configuration:', error);
        setChartError('Invalid Chart.js configuration: JSON parse error');
        chartConfigToRender = {};
      }

      return (
        <PanelErrorBoundary>
          {chartError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 sm:px-4 py-3 rounded mb-4 dark:bg-red-950/20 dark:text-red-300 dark:border-red-800">
              <div className="flex items-start">
                <AlertTriangle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm mb-2">{chartError}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onSuggestAiCorrection(`Fix this Chart.js configuration: ${diagramContent}`)}
                    className="text-red-700 hover:text-red-900 dark:text-red-300 dark:hover:text-red-100"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Get AI Fix
                  </Button>
                </div>
              </div>
            </div>
          )}
          <ChartRenderer
            chartConfig={chartConfigToRender}
            onInvalidConfig={setChartError}
            chartRef={chartRef}
          />
        </PanelErrorBoundary>
      );
    } else if (diagramType === 'threejs') {
      panelTitle = 'Three.js 3D Scene';
      downloadButtonText = 'Download PNG';
      downloadFileName = '3d-scene';
      return (
        <PanelErrorBoundary>
          {threeJsError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 sm:px-4 py-3 rounded mb-4 dark:bg-red-950/20 dark:text-red-300 dark:border-red-800">
              <div className="flex items-start">
                <AlertTriangle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm mb-2">{threeJsError}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onSuggestAiCorrection(`Fix this Three.js code: ${diagramContent}`)}
                    className="text-red-700 hover:text-red-900 dark:text-red-300 dark:hover:text-red-100"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Get AI Fix
                  </Button>
                </div>
              </div>
            </div>
          )}
          <ThreeJSRenderer
            codeContent={diagramContent || ''}
            canvasRef={threeJsRef}
            onInvalidCode={setThreeJsError}
            onSceneReady={handleThreeJsSceneReady}
          />
        </PanelErrorBoundary>
      );
    } else if (diagramType === 'code') {
      panelTitle = 'Code View';
      downloadButtonText = 'Download Code';
      downloadFileName = `code.${language || 'txt'}`;
      return renderSourceCode;
    } else if (diagramType === 'document-text') {
      panelTitle = language ? `${language.toUpperCase()} Document` : 'Document';
      downloadButtonText = 'Download Document';
      downloadFileName = `document.${language || 'txt'}`;
      return (
        <div
          className="relative rounded-lg overflow-hidden h-full shadow-lg"
          style={{ backgroundColor: theme.background, border: `1px solid ${theme.border}` }}
        >
          <div className="p-4 sm:p-6 overflow-auto h-full">
            <pre className="font-mono text-xs sm:text-sm leading-relaxed h-full whitespace-pre-wrap break-words" style={{ color: theme.foreground }}>
              <code dangerouslySetInnerHTML={{ __html: escapeHtml(diagramContent || '') }} style={{ color: theme.foreground }} />
            </pre>
          </div>
        </div>
      );
    } else if (diagramType === 'image' && imageUrl) {
      panelTitle = 'Image Viewer';
      downloadButtonText = 'Download Image';
      downloadFileName = 'image';
      return (
        <div className="flex items-center justify-center h-full w-full p-2 sm:p-4 bg-gray-50 dark:bg-gray-950">
          <img
            src={imageUrl}
            alt="Viewed image"
            className="max-w-full max-h-full object-contain rounded-lg shadow-md"
            style={{ imageRendering: 'pixelated' }}
            onError={(e) => {
              e.currentTarget.src = 'https://placehold.co/400x300/e0e0e0/666666?text=Image+Load+Error';
              e.currentTarget.alt = 'Image failed to load';
            }}
            loading="lazy"
          />
        </div>
      );
    } else if (diagramType === 'html') {
      panelTitle = 'Web Page';
      downloadButtonText = 'Download HTML';
      downloadFileName = 'webpage.html';
      return (
        <PanelErrorBoundary>
          <IsolatedHtml html={diagramContent || ''} />
        </PanelErrorBoundary>
      );
    } else {
      panelTitle = 'Unsupported Content';
      downloadButtonText = 'Download Content';
      downloadFileName = 'content';
      return (
        <div className="flex flex-col items-center justify-center h-full text-slate-500 dark:text-gray-400 p-4">
          <AlertTriangle className="h-8 w-8 mb-3" />
          <h3 className="text-lg font-medium mb-2">Unsupported Content Type</h3>
          <p className="text-sm text-center mb-4">This content type is not supported for viewing.</p>
          <details className="w-full max-w-md">
            <summary className="cursor-pointer text-sm hover:text-slate-700 dark:hover:text-gray-300">
              View Raw Content
            </summary>
            <pre className="mt-2 p-3 bg-gray-100 dark:bg-gray-800 rounded text-xs overflow-auto max-h-40 whitespace-pre-wrap">
              {diagramContent || 'No content available'}
            </pre>
          </details>
        </div>
      );
    }
  }, [diagramContent, diagramType, imageUrl, currentTheme, isResizing, onMermaidError, onSuggestAiCorrection, chartError, threeJsError, language, dotSvg, dotError, isDotLoading, handleThreeJsSceneReady, showSourceCode]);

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
    initial: { x: '100%', opacity: 0, scale: 0.98 },
    animate: {
      x: 0,
      opacity: 1,
      scale: 1,
      transition: {
        duration: 0.3,
        ease: "easeOut" as Easing,
      },
    },
    exit: {
      x: '100%',
      opacity: 0,
      scale: 0.98,
      transition: {
        duration: 0.25,
        ease: "easeIn" as Easing,
      },
    },
  };

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
      className={`fixed inset-0 md:relative md:inset-y-0 md:right-0 bg-white shadow-2xl flex flex-col z-50 md:rounded-l-lg md:shadow-xl md:border-l md:border-slate-200 dark:bg-gray-900 dark:border-gray-700 ${isFullScreen ? 'w-full h-full' : ''}`}
      variants={panelVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      style={dynamicPanelStyle}
    >
      <div className="p-3 sm:p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between bg-white dark:bg-gray-900 dark:border-gray-700 flex-shrink-0">
        <div className="flex items-center mb-2 sm:mb-0">
          <h3 className="text-base sm:text-lg font-semibold text-slate-800 dark:text-gray-100 truncate mr-2">
            {renderContent.props?.children?.type === IsolatedHtml ? 'Web Page' : renderContent.props?.children?.props?.chart ? 'Mermaid Diagram' : renderContent.props?.children?.type === ChartRenderer ? 'Chart.js Graph' : renderContent.props?.children?.type === ThreeJSRenderer ? 'Three.js 3D Scene' : renderContent.props?.children?.type === 'img' ? 'Image Viewer' : renderContent.props?.children?.props?.dangerouslySetInnerHTML ? (language ? `${language.toUpperCase()} Document` : 'Document') : 'Content'}
          </h3>
          {networkError && (
            <div className="flex items-center text-amber-600 dark:text-amber-400" title="Network connection issues detected">
              <WifiOff className="h-4 w-4" />
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1 sm:gap-2 justify-end">
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
              className="text-xs sm:text-sm px-2 sm:px-3 py-1"
            >
              {showSourceCode ? (
                <>
                  <Eye className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Preview</span>
                </>
              ) : (
                <>
                  <FileCode className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Source</span>
                </>
              )}
            </Button>
          )}

          {availableActions[diagramType].includes('download') && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadContent}
              className="text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900 dark:border-blue-700 text-xs sm:text-sm px-2 sm:px-3 py-1"
              title={renderContent.props?.children?.type === IsolatedHtml ? 'Download HTML' : renderContent.props?.children?.props?.chart ? 'Download PNG' : renderContent.props?.children?.type === ChartRenderer ? 'Download PNG' : renderContent.props?.children?.type === ThreeJSRenderer ? 'Download PNG' : renderContent.props?.children?.type === 'img' ? 'Download Image' : 'Download Content'}
              disabled={!diagramContent && !imageUrl || diagramType === 'unknown'}
            >
              <Download className="h-3 w-3 sm:h-4 sm:w-4 mr-0 sm:mr-2" />
              <span className="hidden sm:inline">{renderContent.props?.children?.type === IsolatedHtml ? 'Download HTML' : renderContent.props?.children?.props?.chart ? 'Download PNG' : renderContent.props?.children?.type === ChartRenderer ? 'Download PNG' : renderContent.props?.children?.type === ThreeJSRenderer ? 'Download PNG' : renderContent.props?.children?.type === 'img' ? 'Download Image' : 'Download Content'}</span>
            </Button>
          )}

          {availableActions[diagramType].includes('gltf') && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadGltf}
              className="text-green-600 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900 dark:border-green-700 text-xs sm:text-sm px-2 sm:px-3 py-1"
              title="Download 3D Model (GLTF)"
              disabled={!threeJsScene || !threeJsRenderer}
            >
              <Download className="h-3 w-3 sm:h-4 sm:w-4 mr-0 sm:mr-2" />
              <span className="hidden sm:inline">GLTF</span>
            </Button>
          )}

          {availableActions[diagramType].includes('pdf') && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadPdf}
              className="text-purple-600 hover:bg-purple-50 dark:text-purple-400 dark:hover:bg-purple-900 dark:border-purple-700 text-xs sm:text-sm px-2 sm:px-3 py-1"
              title="Download as PDF"
              disabled={!diagramContent || diagramType === 'unknown'}
            >
              <Download className="h-3 w-3 sm:h-4 sm:w-4 mr-0 sm:mr-2" />
              <span className="hidden sm:inline">PDF</span>
            </Button>
          )}

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsFullScreen(prev => !prev)}
            title={isFullScreen ? 'Exit Full Screen' : 'Full Screen'}
            className="text-slate-600 hover:bg-slate-200 dark:text-gray-300 dark:hover:bg-gray-700 h-8 w-8"
          >
            {isFullScreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            title="Close Panel"
            className="flex-shrink-0 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200 h-8 w-8"
          >
            <X className="h-4 w-4 text-slate-500 hover:text-slate-700 dark:text-gray-400 dark:hover:text-gray-200" />
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
        <PanelErrorBoundary>
          {renderContent}
        </PanelErrorBoundary>
      </div>
    </motion.div>
  );
});