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

    ${sanitizedHtml}
   `;

        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        if (iframeDoc) {
          iframeDoc.open();
          iframeDoc.write(fullHtml);
          iframeDoc.close();

          // Listen for messages from iframe
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

          // Fallback timeout
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
            <p className="text-sm text-gray-600 dark:text-gray-400">Loading 3D scene...</p>
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
  const [networkError, setNetworkError] = useState(false);

  // Auto-detect system theme preference
  useEffect(() => {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setCurrentTheme(prefersDark ? 'github-dark' : 'github-light');
  }, []);

  // Enhanced responsive dimensions handling
  useEffect(() => {
    if (isOpen && diagramPanelRef.current) {
      const updateDimensions = () => {
        const isMobile = window.innerWidth < 768;
        const isTablet = window.innerWidth >= 768 && window.innerWidth < 1024;

        if (isMobile) {
          setPanelWidth(100);
          setPanelHeight(window.innerHeight * 0.95);
        } else if (isTablet) {
          setPanelWidth(initialWidthPercentage || 75);
          setPanelHeight(window.innerHeight * 0.9);
        } else {
          setPanelWidth(initialWidthPercentage || 65);
          setPanelHeight(window.innerHeight * 0.85);
        }
      };

      updateDimensions();
      window.addEventListener('resize', updateDimensions);
      return () => window.removeEventListener('resize', updateDimensions);
    }
  }, [isOpen, initialWidthPercentage]);

  // Network status monitoring
  useEffect(() => {
    const handleOnline = () => setNetworkError(false);
    const handleOffline = () => setNetworkError(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    setNetworkError(!navigator.onLine);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

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

  // Enhanced resize handlers with better mobile support
  const handleResize = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isResizing.width && !isResizing.height) return;

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    if (isResizing.width) {
      const deltaX = clientX - initialPos.current.x;
      const newWidth = initialSize.current.width + deltaX;
      const minWidth = window.innerWidth < 768 ? window.innerWidth * 0.9 : 300;
      const maxWidth = window.innerWidth * 0.95;
      const constrainedWidth = Math.max(minWidth, Math.min(newWidth, maxWidth));
      setPanelWidth((constrainedWidth / window.innerWidth) * 100);
    }

    if (isResizing.height) {
      const deltaY = clientY - initialPos.current.y;
      const newHeight = initialSize.current.height + deltaY;
      const minHeight = window.innerHeight < 600 ? window.innerHeight * 0.5 : 200;
      const maxHeight = window.innerHeight * 0.95;
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
      window.addEventListener('touchmove', handleResize, { passive: false });
      window.addEventListener('touchend', stopResize);
    }
    return () => {
      window.removeEventListener('mousemove', handleResize);
      window.removeEventListener('mouseup', stopResize);
      window.removeEventListener('touchmove', handleResize);
      window.removeEventListener('touchend', stopResize);
    };
  }, [isResizing, handleResize, stopResize]);

  // Enhanced pan handlers
  const handlePanStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (isFullScreen || window.innerWidth < 768) return;
    isPanningRef.current = true;
    startPanPos.current = {
      x: 'touches' in e ? e.touches[0].clientX : e.clientX,
      y: 'touches' in e ? e.touches[0].clientY : e.clientY
    };
  }, [isFullScreen]);

  // Enhanced dynamic styles
  const dynamicPanelStyle: React.CSSProperties = {
    width: window.innerWidth >= 768 ? `${panelWidth}%` : '100%',
    height: panelHeight,
    overflow: 'hidden',
    touchAction: isResizing.width || isResizing.height ? 'none' : 'auto',
    maxWidth: '100vw',
    maxHeight: '100vh'
  };

  const contentStyle: React.CSSProperties = {
    transform: `scale(${zoomLevel}) translate(${panOffset.x}px, ${panOffset.y}px)`,
    transformOrigin: 'center center',
    transition: isResizing.width || isResizing.height ? 'none' : 'transform 0.2s ease-out'
  };

  let panelTitle = 'Viewer';
  let downloadButtonText = 'Download Content';
  let downloadFileName = 'content';

  // Enhanced download content function with better error handling
  const handleDownloadContent = useCallback(async () => {
    if (!diagramContainerRef.current && !imageUrl && diagramType !== 'html') {
      toast.error('Content not available for download');
      return;
    }

    try {
      let fileExtension = '';
      let contentToDownload: string | Blob = '';
      let mimeType = '';

      if (diagramType === 'html') {
        contentToDownload = diagramContent || '';
        fileExtension = 'html';
        mimeType = 'text/html;charset=utf-8';
      } else if (diagramType === 'image' && imageUrl) {
        try {
          const response = await fetch(imageUrl);
          if (!response.ok) throw new Error('Failed to fetch image');
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `image-${Date.now()}.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          toast.success('Image downloaded!');
          return;
        } catch (error) {
          toast.error('Failed to download image');
          return;
        }
      } else if (diagramType === 'mermaid' || diagramType === 'dot') {
        const svgElement = diagramContainerRef.current?.querySelector('svg');
        if (svgElement) {
          contentToDownload = new XMLSerializer().serializeToString(svgElement);
          fileExtension = 'svg';
          mimeType = 'image/svg+xml;charset=utf-8';
        } else {
          toast.error('Diagram not found for download');
          return;
        }
      } else if (diagramType === 'chartjs') {
        if (chartRef.current) {
          contentToDownload = chartRef.current.toDataURL('image/png');
          fileExtension = 'png';
          mimeType = 'image/png';
        } else {
          toast.error('Chart not found for download');
          return;
        }
      } else if (diagramType === 'threejs') {
        if (threeJsRef.current) {
          contentToDownload = threeJsRef.current.toDataURL('image/png');
          fileExtension = 'png';
          mimeType = 'image/png';
        } else {
          toast.error('3D scene not found for download');
          return;
        }
      } else if (diagramType === 'code' || diagramType === 'document-text') {
        if (!diagramContent) {
          toast.error('No content available for download');
          return;
        }
        contentToDownload = diagramContent;
        fileExtension = language || 'txt';
        mimeType = 'text/plain;charset=utf-8';

        // Enhanced MIME type detection
        const mimeTypes: Record<string, string> = {
          'js': 'application/javascript',
          'javascript': 'application/javascript',
          'ts': 'application/typescript',
          'typescript': 'application/typescript',
          'py': 'text/x-python',
          'python': 'text/x-python',
          'java': 'text/x-java-source',
          'html': 'text/html',
          'css': 'text/css',
          'json': 'application/json',
          'xml': 'application/xml',
          'sql': 'application/sql',
          'md': 'text/markdown',
          'markdown': 'text/markdown'
        };

        if (language && mimeTypes[language]) {
          mimeType = mimeTypes[language];
        }
      } else {
        toast.error('Unsupported content type for download');
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

      const contentTypeNames: Record<string, string> = {
        'code': 'Code',
        'html': 'Web Page',
        'mermaid': 'Diagram',
        'dot': 'Graph',
        'chartjs': 'Chart',
        'threejs': '3D Scene',
        'document-text': 'Document',
        'image': 'Image'
      };

      toast.success(`${contentTypeNames[diagramType] || 'Content'} downloaded as ${fileExtension.toUpperCase()}!`);
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download content. Please try again.');
    }
  }, [diagramContent, diagramType, imageUrl, language, downloadFileName]);

  // Enhanced GLTF download with better error handling
  const handleDownloadGltf = useCallback(async () => {
    if (!threeJsScene || !threeJsRenderer) {
      toast.error('3D scene not ready for export');
      return;
    }

    const loadingToast = toast.loading('Exporting 3D scene...');

    try {
      const exporter = new GLTFExporter();
      await new Promise<void>((resolve, reject) => {
        exporter.parse(
          threeJsScene,
          (gltf) => {
            try {
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
              resolve();
            } catch (error) {
              reject(error);
            }
          },
          (error) => reject(error),
          { binary: false }
        );
      });

      toast.dismiss(loadingToast);
      toast.success('3D scene downloaded successfully!');
    } catch (error) {
      console.error('GLTF export error:', error);
      toast.dismiss(loadingToast);
      toast.error('Failed to export 3D scene. Please try again.');
    }
  }, [threeJsScene, threeJsRenderer]);

  // Enhanced PDF download with better error handling
  const handleDownloadPdf = useCallback(async () => {
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
      toast.error('Content not available for PDF export');
      return;
    }

    if (typeof window.jspdf === 'undefined' || typeof window.html2canvas === 'undefined') {
      toast.error('PDF generation libraries not available. Please refresh and try again.');
      return;
    }

    const loadingToast = toast.loading('Generating PDF...');

    try {
      const canvas = await window.html2canvas(targetRef.current, {
        scale: Math.min(3 * zoomLevel, 5), // Cap the scale to prevent memory issues
        useCORS: true,
        backgroundColor: themes[currentTheme].background,
        logging: false,
        allowTaint: true,
        foreignObjectRendering: true
      });

      const pdf = new window.jspdf.jsPDF({
        orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
        unit: 'px',
        format: [canvas.width, canvas.height],
      });

      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, canvas.width, canvas.height);
      pdf.save(`${downloadFileName}-${Date.now()}.pdf`);

      toast.dismiss(loadingToast);
      toast.success('PDF downloaded successfully!');
    } catch (error) {
      console.error('PDF generation error:', error);
      toast.dismiss(loadingToast);
      toast.error('Failed to generate PDF. Please try again.');
    }
  }, [diagramType, zoomLevel, currentTheme, downloadFileName]);

  // Enhanced DOT rendering with better error handling
  useEffect(() => {
    const renderDot = async () => {
      if (diagramType === 'dot' && diagramContent) {
        setDotSvg(null);
        setDotError(null);
        setIsDotLoading(true);

        try {
          const gv = await Graphviz.load();
          const svg = await gv.layout(diagramContent, 'svg', 'dot');
          setDotSvg(svg);
        } catch (e: any) {
          console.error('DOT rendering error:', e);
          const errorMessage = `DOT syntax error: ${e.message || 'Invalid DOT format'}`;
          setDotError(errorMessage);
          onMermaidError(diagramContent, 'syntax');
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

  // Enhanced theme selector component
  const ThemeSelector = () => (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowThemeSelector(!showThemeSelector)}
        className="text-xs sm:text-sm px-2 sm:px-3 py-1"
      >
        <Palette className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
        <span className="hidden sm:inline">Theme</span>
      </Button>
      {showThemeSelector && (
        <div className="absolute top-full right-0 mt-2 bg-white border rounded-lg shadow-lg z-50 min-w-[180px] sm:min-w-[200px] dark:bg-gray-800 dark:border-gray-600">
          <div className="p-2 space-y-1 max-h-64 overflow-y-auto">
            {Object.keys(themes).map((themeName) => (
              <button
                key={themeName}
                className={`w-full text-left px-3 py-2 rounded text-xs sm:text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${currentTheme === themeName ? 'bg-blue-50 text-blue-700 dark:bg-blue-900 dark:text-blue-300' : ''
                  }`}
                onClick={() => {
                  setCurrentTheme(themeName as ThemeName);
                  setShowThemeSelector(false);
                }}
              >
                <div className="flex items-center space-x-2">
                  <div
                    className="w-3 h-3 sm:w-4 sm:h-4 rounded border flex-shrink-0"
                    style={{ backgroundColor: themes[themeName as ThemeName].background }}
                  />
                  <span className="capitalize truncate">{themeName.replace('-', ' ')}</span>
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
          className="px-3 sm:px-4 py-2 border-b text-xs sm:text-sm font-medium flex items-center justify-between"
          style={{ backgroundColor: theme.background, borderColor: theme.border, color: theme.foreground }}
        >
          <span className="flex items-center space-x-2">
            <Code className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="font-mono">{language?.toUpperCase() || 'PLAINTEXT'}</span>
          </span>
          <span className="text-xs opacity-75 hidden sm:inline" style={{ color: theme.lineNumbers }}>
            {diagramContent?.split('\n').length || 0} lines
          </span>
        </div>
        <div className="p-2 sm:p-4 overflow-auto h-full">
          <div className="flex">
            <div className="select-none pr-2 sm:pr-4 text-right font-mono text-xs sm:text-sm leading-relaxed hidden sm:block" style={{ color: theme.lineNumbers }}>
              {diagramContent?.split('\n').map((_, index) => (
                <div key={index + 1} className="min-h-[1.5rem]">{index + 1}</div>
              ))}
            </div>
            <div className="flex-1 overflow-x-auto">
              <pre className="font-mono text-xs sm:text-sm leading-relaxed">
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
      return (
        <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400 p-4">
          <AlertTriangle className="h-12 w-12 mb-4" />
          <p className="text-center">No content to display</p>
        </div>
      );
    }

    const theme = themes[currentTheme];

    if (showSourceCode && diagramContent && diagramType !== 'image' && diagramType !== 'unknown') {
      return renderSourceCode;
    }

    if (diagramType === 'html') {
      panelTitle = 'HTML Web Page';
      downloadButtonText = 'Download HTML';
      downloadFileName = 'webpage';
      return (
        <PanelErrorBoundary>
          <IsolatedHtml html={diagramContent || ''} />
        </PanelErrorBoundary>
      );
    } else if (diagramType === 'mermaid') {
      panelTitle = 'Mermaid Diagram';
      downloadButtonText = 'Download SVG';
      downloadFileName = 'mermaid-diagram';
      return (
        <PanelErrorBoundary>
          <Mermaid
            chart={diagramContent || ''}
            onMermaidError={onMermaidError}
            onSuggestAiCorrection={onSuggestAiCorrection}
            diagramRef={diagramContainerRef}
            key={diagramContent}
          />
        </PanelErrorBoundary>
      );
    } else if (diagramType === 'dot') {
      panelTitle = 'DOT Graph';
      downloadButtonText = 'Download SVG';
      downloadFileName = 'dot-graph';
      return (
        <PanelErrorBoundary>
          {isDotLoading ? (
            <div className="flex flex-col items-center justify-center h-full text-blue-600 dark:text-blue-400">
              <Loader2 className="h-8 w-8 animate-spin mb-3" />
              <p className="text-sm sm:text-base">Rendering DOT graph...</p>
            </div>
          ) : dotError ? (
            <div className="text-red-700 p-4 dark:text-red-300 max-w-full">
              <div className="flex items-center mb-3">
                <AlertTriangle className="h-5 w-5 mr-2" />
                <h3 className="font-semibold">Graph Rendering Error</h3>
              </div>
              <div className="bg-red-50 dark:bg-red-950/20 p-3 rounded-md mb-4 overflow-auto">
                <p className="text-sm mb-2">{dotError}</p>
                <details className="text-xs">
                  <summary className="cursor-pointer hover:text-red-800 dark:hover:text-red-200">
                    View Source Code
                  </summary>
                  <pre className="mt-2 p-2 bg-red-100 dark:bg-red-900/20 rounded text-xs overflow-auto max-h-32 whitespace-pre-wrap">
                    {diagramContent}
                  </pre>
                </details>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onSuggestAiCorrection(`Fix this DOT graph syntax error: ${diagramContent}`)}
                className="bg-blue-500 text-white hover:bg-blue-600 dark:bg-blue-700 dark:hover:bg-blue-800"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Get AI Fix
              </Button>
            </div>
          ) : (
            <div className="relative w-full h-full bg-white dark:bg-gray-900 rounded-lg overflow-hidden">
              <div
                className="w-full h-full flex items-center justify-center p-2 sm:p-4"
                style={{ cursor: isResizing.height || isResizing.width ? 'default' : 'grab' }}
              >
                <div
                  dangerouslySetInnerHTML={{ __html: dotSvg || '' }}
                  className="max-w-full max-h-full [&>svg]:max-w-full [&>svg]:max-h-full [&>svg]:w-auto [&>svg]:h-auto"
                />
              </div>
            </div>
          )}
        </PanelErrorBoundary>
      );
    } else if (diagramType === 'chartjs') {
      panelTitle = 'Chart.js Graph';
      downloadButtonText = 'Download PNG';
      downloadFileName = 'chart';
      let chartConfigToRender: any = {};
      try {
        const cleanedContent = diagramContent ? diagramContent.replace(/\/\/.*|\/\*[\s\S]*?\*\//g, '') : '';
        chartConfigToRender = cleanedContent ? JSON.parse(cleanedContent) : {};
      } catch (e: any) {
        setChartError(`Invalid Chart.js configuration: ${e.message}`);
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
      panelTitle = language ? `${language.toUpperCase()} Code` : 'Code View';
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

  // Enhanced click outside handler for theme selector
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

  // Determine available actions based on diagram type with better organization
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
      className={`fixed inset-0 md:relative md:inset-y-0 md:right-0 bg-white shadow-2xl flex flex-col z-50 md:rounded-l-lg md:shadow-xl md:border-l md:border-slate-200 dark:bg-gray-900 dark:border-gray-700 ${isFullScreen ? 'w-full h-full' : ''
        }`}
      variants={panelVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      style={dynamicPanelStyle}
    >
      {/* Enhanced Header */}
      <div className="p-3 sm:p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between bg-white dark:bg-gray-900 dark:border-gray-700 flex-shrink-0">
        <div className="flex items-center mb-2 sm:mb-0">
          <h3 className="text-base sm:text-lg font-semibold text-slate-800 dark:text-gray-100 truncate mr-2">
            {panelTitle}
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
              title={downloadButtonText}
              disabled={!diagramContent && !imageUrl || diagramType === 'unknown'}
            >
              <Download className="h-3 w-3 sm:h-4 sm:w-4 mr-0 sm:mr-2" />
              <span className="hidden sm:inline">{downloadButtonText}</span>
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

      {/* Enhanced Content Area */}
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