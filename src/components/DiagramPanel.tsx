import React, { useRef, useEffect, useState, useCallback, memo, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from './ui/button';
import {
  X, RefreshCw, AlertTriangle, Code, Download, GripVertical, Loader2,
  Palette, Maximize2, Minimize2, ZoomIn, ZoomOut, Eye, FileCode,
  Wifi, WifiOff, Copy, Search, Settings, RotateCcw, Play, Pause,
  Move, Square, Circle, Triangle, Type, Image as ImageIcon,
  Grid, Layers, Sun, Moon, Monitor, ChevronDown, ChevronUp,
  PanelTop, PanelBottom, MousePointer, Hand
} from 'lucide-react';
import { toast } from 'sonner';
import { Chart, registerables } from 'chart.js';
import mermaid from 'mermaid';
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

// Enhanced HTML Renderer with better isolation
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
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-2" />
            <p className="text-sm text-gray-600 dark:text-gray-400">Rendering HTML content...</p>
          </div>
        </div>
      )}
      <iframe
        ref={iframeRef}
        className="w-full h-full border-0 rounded-lg"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
        title="AI Generated HTML Content"
      />
    </div>
  );
};

// New Mermaid Renderer with iframe isolation
const IsolatedMermaid = ({ content, onError }: { content: string; onError: (error: string | null, errorType: 'syntax' | 'rendering') => void }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const handleRetry = useCallback(() => {
    setRetryCount(prev => prev + 1);
    setHasError(null);
    setIsLoading(true);
  }, []);

  useEffect(() => {
    if (iframeRef.current && content) {
      setIsLoading(true);
      setHasError(null);

      (async () => {
        try {
          await mermaid.initialize({
            startOnLoad: false,
            theme: 'default',
            securityLevel: 'loose',
            fontFamily: 'arial',
            fontSize: 16,
          });
          const { svg } = await mermaid.render('mermaid-graph', content);

          const fullHtml = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { margin: 0; display: flex; justify-content: center; align-items: center; height: 100vh; background: transparent; }
    svg { max-width: 100%; max-height: 100%; }
  </style>
</head>
<body>
  ${svg}
</body>
</html>`;

          const iframeDoc = iframeRef.current!.contentDocument || iframeRef.current!.contentWindow?.document;
          if (iframeDoc) {
            iframeDoc.open();
            iframeDoc.write(fullHtml);
            iframeDoc.close();
            setIsLoading(false);
            onError(null, 'rendering');
          }
        } catch (error: any) {
          console.error('Error rendering Mermaid diagram:', error);
          setHasError(`Failed to render Mermaid diagram: ${error.message}`);
          onError(`Failed to render Mermaid diagram: ${error.message}`, 'syntax');
          setIsLoading(false);
        }
      })();
    }
  }, [content, retryCount, onError]);

  if (hasError) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-red-600 bg-red-50 p-4 dark:bg-red-950/20 dark:text-red-300">
        <AlertTriangle className="h-8 w-8 mb-3" />
        <h3 className="text-lg font-semibold mb-2">Mermaid Rendering Error</h3>
        <p className="text-center text-sm mb-4">{hasError}</p>
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
              View Mermaid Source
            </summary>
            <pre className="mt-2 p-3 bg-white dark:bg-gray-900 border rounded text-xs overflow-auto max-h-40 w-full max-w-md">
              {content}
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
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-2" />
            <p className="text-sm text-gray-600 dark:text-gray-400">Rendering Mermaid diagram...</p>
          </div>
        </div>
      )}
      <iframe
        ref={iframeRef}
        className="w-full h-full border-0 rounded-lg"
        sandbox="allow-same-origin"
        title="Mermaid Diagram"
      />
    </div>
  );
};

interface ChartRendererProps {
  chartConfig: any;
  onInvalidConfig: (error: string | null) => void;
  chartRef: React.RefObject<HTMLCanvasElement>;
  showControls?: boolean;
}

const ChartRenderer: React.FC<ChartRendererProps> = memo(({ chartConfig, onInvalidConfig, chartRef, showControls = true }) => {
  const chartInstance = useRef<Chart | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [showLegend, setShowLegend] = useState(true);
  const [showGridLines, setShowGridLines] = useState(true);
  const [chartType, setChartType] = useState<string>('');

  useEffect(() => {
    if (chartRef.current) {
      setIsRendering(true);

      if (chartInstance.current) {
        chartInstance.current.destroy();
      }

      try {
        const ctx = chartRef.current.getContext('2d');
        if (ctx) {
          // Apply control settings to config
          const enhancedConfig = {
            ...chartConfig,
            options: {
              ...chartConfig.options,
              plugins: {
                ...chartConfig.options?.plugins,
                legend: {
                  ...chartConfig.options?.plugins?.legend,
                  display: showLegend,
                },
              },
              scales: showGridLines ? chartConfig.options?.scales : {
                ...chartConfig.options?.scales,
                x: {
                  ...chartConfig.options?.scales?.x,
                  grid: { display: false },
                },
                y: {
                  ...chartConfig.options?.scales?.y,
                  grid: { display: false },
                },
              },
            },
          };

          chartInstance.current = new Chart(ctx, enhancedConfig);
          setChartType(chartConfig.type || 'unknown');
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
  }, [chartConfig, chartRef, onInvalidConfig, showLegend, showGridLines]);

  const updateChart = useCallback(() => {
    if (chartInstance.current) {
      chartInstance.current.update();
    }
  }, []);

  return (
    <div className="flex flex-col h-full">
      {showControls && (
        <div className="flex flex-wrap items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800 border-b">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Chart Controls:
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setShowLegend(!showLegend); }}
            className={`text-xs ${showLegend ? 'bg-blue-100 dark:bg-blue-900' : ''}`}
          >
            <Layers className="h-3 w-3 mr-1" />
            Legend
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setShowGridLines(!showGridLines); }}
            className={`text-xs ${showGridLines ? 'bg-blue-100 dark:bg-blue-900' : ''}`}
          >
            <Grid className="h-3 w-3 mr-1" />
            Grid
          </Button>
          <div className="text-xs text-gray-500 dark:text-gray-400 ml-auto">
            Type: {chartType}
          </div>
        </div>
      )}

      <div className="flex-1 p-4 flex items-center justify-center relative">
        {isRendering && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/90 dark:bg-gray-900/90 z-10">
            <div className="flex flex-col items-center">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600 mb-2" />
              <p className="text-sm text-gray-600 dark:text-gray-400">Rendering chart...</p>
            </div>
          </div>
        )}
        <canvas ref={chartRef} className="max-w-full max-h-full"></canvas>
      </div>
    </div>
  );
});

interface ThreeJSRendererProps {
  codeContent: string;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  onInvalidCode: (error: string | null) => void;
  onSceneReady: (scene: THREE.Scene, renderer: THREE.WebGLRenderer, cleanup: () => void) => void;
  showControls?: boolean;
}

const ThreeJSRenderer: React.FC<ThreeJSRendererProps> = memo(({
  codeContent,
  canvasRef,
  onInvalidCode,
  onSceneReady,
  showControls = true
}) => {
  const threeJsCleanupRef = useRef<(() => void) | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [isAnimating, setIsAnimating] = useState(true);
  const [showWireframe, setShowWireframe] = useState(false);
  const [resetCamera, setResetCamera] = useState(0);
  const [canvasScale, setCanvasScale] = useState(1); // New state for canvas size scaling

  useEffect(() => {
    if (canvasRef.current && codeContent) {
      setIsRendering(true);

      if (threeJsCleanupRef.current) {
        try {
          threeJsCleanupRef.current();
        } catch (error) {
          console.warn('Cleanup failed:', error);
        }
        threeJsCleanupRef.current = null;
      }

      try {
        // Dynamically detect the scene creation function name
        const functionNameMatch = codeContent.match(/function\s+([a-zA-Z0-9_]+)\s*\(\s*canvas\s*,/);
        if (!functionNameMatch) {
          throw new Error('No valid scene creation function found. Expected: function <name>(canvas, THREE, ...)');
        }
        const functionName = functionNameMatch[1];

        // Create wrapper to execute the code
        const createSceneWrapper = new Function('THREE', 'OrbitControls', 'GLTFLoader', `
${codeContent}
return ${functionName};
`);

        const createScene = createSceneWrapper(THREE, OrbitControls, GLTFLoader);
        const result = createScene(canvasRef.current, THREE, OrbitControls, GLTFLoader);

        if (result && result.scene && result.renderer && result.cleanup) {
          const { scene, renderer, cleanup } = result;

          // Ensure basic lighting if none exists
          if (!scene.children.some(child => child.isLight)) {
            const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
            const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
            directionalLight.position.set(5, 5, 5);
            scene.add(ambientLight, directionalLight);
          }

          // Apply fallback material to meshes without valid materials
          scene.traverse((object) => {
            if (object.isMesh && (!object.material || !object.material.isMaterial)) {
              object.material = new THREE.MeshStandardMaterial({
                color: 0xaaaaaa,
                roughness: 0.5,
                metalness: 0.2
              });
            }
          });

          threeJsCleanupRef.current = () => {
            try {
              cleanup();
            } catch (error) {
              console.warn('Scene cleanup failed:', error);
            }
            // Clean up lights added by renderer
            scene.children.filter(child => child.isLight).forEach(light => scene.remove(light));
          };
          onInvalidCode(null);
          onSceneReady(scene, renderer, threeJsCleanupRef.current);
          setIsRendering(false);
        } else {
          throw new Error('Invalid Three.js scene structure: missing scene, renderer, or cleanup');
        }
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
            ctx.fillText(error.message, canvasRef.current.width / 2, canvasRef.current.height / 2 + 25);
          }
        }
      }
    }

    return () => {
      if (threeJsCleanupRef.current) {
        try {
          threeJsCleanupRef.current();
        } catch (error) {
          console.warn('Cleanup failed during unmount:', error);
        }
        threeJsCleanupRef.current = null;
      }
    };
  }, [codeContent, canvasRef, onInvalidCode, onSceneReady, resetCamera]);

  const handleResetCamera = useCallback(() => {
    setResetCamera(prev => prev + 1);
  }, []);

  const handleZoomIn = useCallback(() => {
    setCanvasScale(prev => Math.min(3, prev + 0.25)); // Increase canvas size, max 3x
  }, []);

  const handleZoomOut = useCallback(() => {
    setCanvasScale(prev => Math.max(0.25, prev - 0.25)); // Decrease canvas size, min 0.25x
  }, []);

  const handleResetZoom = useCallback(() => {
    setCanvasScale(1); // Reset to original size
  }, []);

  return (
    <div className="flex flex-col h-full">
      {showControls && (
        <div className="flex flex-wrap items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800 border-b">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            3D Controls:
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsAnimating(!isAnimating)}
            className={`text-xs ${isAnimating ? 'bg-green-100 dark:bg-green-900' : ''}`}
          >
            {isAnimating ? <Pause className="h-3 w-3 mr-1" /> : <Play className="h-3 w-3 mr-1" />}
            {isAnimating ? 'Pause' : 'Play'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowWireframe(!showWireframe)}
            className={`text-xs ${showWireframe ? 'bg-blue-100 dark:bg-blue-900' : ''}`}
          >
            <Square className="h-3 w-3 mr-1" />
            Wireframe
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleResetCamera}
            className="text-xs"
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            Reset Camera
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleZoomIn}
            className="text-xs"
          >
            <ZoomIn className="h-3 w-3 mr-1" />
            Zoom In
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleZoomOut}
            className="text-xs"
          >
            <ZoomOut className="h-3 w-3 mr-1" />
            Zoom Out
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleResetZoom}
            className="text-xs"
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            Reset Zoom
          </Button>
          <div className="text-xs text-gray-500 dark:text-gray-400 ml-auto">
            Mouse: Orbit | Scroll: Zoom | Scale: {Math.round(canvasScale * 100)}%
          </div>
        </div>
      )}

      <div className="flex-1 p-4 flex items-center justify-center relative">
        {isRendering && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/90 dark:bg-gray-900/90 z-10">
            <div className="flex flex-col items-center">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600 mb-2" />
              <p className="text-sm text-gray-600 dark:text-gray-400">Rendering 3D scene...</p>
            </div>
          </div>
        )}
        <canvas
          ref={canvasRef}
          className="max-w-full max-h-full"
          style={{
            transform: `scale(${canvasScale})`,
            transformOrigin: 'center',
            transition: 'transform 0.2s ease'
          }}
        ></canvas>
      </div>
    </div>
  );
});

// Enhanced Code Display Component
const CodeDisplay: React.FC<{
  content: string;
  language?: string;
  theme: typeof themes[ThemeName];
  showControls?: boolean;
}> = memo(({ content, language, theme, showControls = true }) => {
  const [fontSize, setFontSize] = useState(14);
  const [showLineNumbers, setShowLineNumbers] = useState(true);
  const [wordWrap, setWordWrap] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedContent, setHighlightedContent] = useState('');

  useEffect(() => {
    if (content) {
      let processed = content;

      // Search highlighting
      if (searchTerm) {
        const searchRegex = new RegExp(`(${escapeHtml(searchTerm)})`, 'gi');
        processed = processed.replace(searchRegex, '<mark class="bg-yellow-200 dark:bg-yellow-800">$1</mark>');
      }

      // Apply syntax highlighting
      if (language && language !== 'txt') {
        try {
          const highlighted = highlightCode(processed, language, theme);
          setHighlightedContent(highlighted);
        } catch (error) {
          console.warn('Failed to highlight code:', error);
          setHighlightedContent(escapeHtml(processed));
        }
      } else {
        setHighlightedContent(escapeHtml(processed));
      }
    }
  }, [content, language, theme, searchTerm]);

  const lines = content ? content.split('\n') : [];
  const maxLineLength = Math.max(...lines.map(line => line.length));

  const handleCopyCode = useCallback(() => {
    navigator.clipboard.writeText(content).then(() => {
      toast.success('Code copied to clipboard');
    }).catch(() => {
      toast.error('Failed to copy code');
    });
  }, [content]);

  return (
    <div className="flex flex-col h-full">
      {showControls && (
        <div className="flex flex-wrap items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800 border-b">
          <div className="flex items-center gap-2 flex-1">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Code Controls:
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowLineNumbers(!showLineNumbers)}
              className={`text-xs ${showLineNumbers ? 'bg-blue-100 dark:bg-blue-900' : ''}`}
            >
              <Type className="h-3 w-3 mr-1" />
              Lines
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setWordWrap(!wordWrap)}
              className={`text-xs ${wordWrap ? 'bg-blue-100 dark:bg-blue-900' : ''}`}
            >
              <PanelTop className="h-3 w-3 mr-1" />
              Wrap
            </Button>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFontSize(Math.max(10, fontSize - 1))}
                className="text-xs px-2"
              >
                <ZoomOut className="h-3 w-3" />
              </Button>
              <span className="text-xs text-gray-500 px-2">{fontSize}px</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFontSize(Math.min(20, fontSize + 1))}
                className="text-xs px-2"
              >
                <ZoomIn className="h-3 w-3" />
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 pr-3 py-1 text-xs border rounded bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyCode}
              className="text-xs"
            >
              <Copy className="h-3 w-3 mr-1" />
              Copy
            </Button>
          </div>
        </div>
      )}

      <div
        className="flex-1 overflow-auto"
        style={{
          backgroundColor: theme.background,
          color: theme.foreground,
          fontFamily: 'JetBrains Mono, Fira Code, Monaco, Consolas, monospace'
        }}
      >
        <div className="flex">
          {showLineNumbers && (
            <div
              className="flex-shrink-0 px-3 py-4 text-right select-none border-r"
              style={{
                color: theme.lineNumbers,
                borderColor: theme.border,
                fontSize: `${fontSize}px`,
                lineHeight: '1.6'
              }}
            >
              {lines.map((_, index) => (
                <div key={index} className="leading-6">
                  {index + 1}
                </div>
              ))}
            </div>
          )}

          <div className="flex-1 p-4">
            <pre
              className={`leading-6 ${wordWrap ? 'whitespace-pre-wrap' : 'whitespace-pre'}`}
              style={{
                fontSize: `${fontSize}px`,
                color: theme.foreground
              }}
            >
              <code
                dangerouslySetInnerHTML={{ __html: highlightedContent }}
              />
            </pre>
          </div>
        </div>
      </div>

      <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800 border-t text-xs text-gray-500 dark:text-gray-400 flex justify-between">
        <span>
          Lines: {lines.length} | Max Length: {maxLineLength} | Language: {language || 'text'}
        </span>
        <span>
          {searchTerm && `Found: ${(content.match(new RegExp(searchTerm, 'gi')) || []).length} matches`}
        </span>
      </div>
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
  const threeJsRef = useRef<HTMLCanvasElement>(null);
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
  const [showAdvancedControls, setShowAdvancedControls] = useState(false);

  const isPhone = useCallback(() => {
    const userAgent = navigator.userAgent.toLowerCase();
    return /mobile|android|iphone|ipad|tablet/i.test(userAgent) && window.innerWidth <= 768;
  }, []);

  const theme = themes[currentTheme];

  // Enhanced diagram-specific controls
  const DiagramControls: React.FC<{ type: string }> = useCallback(({ type }) => {
    return (
      <div className="flex flex-wrap items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {type === 'mermaid' && 'Mermaid Controls:'}
            {type === 'dot' && 'Graphviz Controls:'}
            {type === 'html' && 'Web Controls:'}
            {type === 'image' && 'Image Controls:'}
          </span>

          {(type === 'mermaid' || type === 'dot') && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setZoomLevel(prev => Math.min(3, prev + 0.25))}
                className="text-xs"
              >
                <ZoomIn className="h-3 w-3 mr-1" />
                Zoom In
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setZoomLevel(prev => Math.max(0.25, prev - 0.25))}
                className="text-xs"
              >
                <ZoomOut className="h-3 w-3 mr-1" />
                Zoom Out
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setZoomLevel(1);
                  setPanOffset({ x: 0, y: 0 });
                }}
                className="text-xs"
              >
                <RotateCcw className="h-3 w-3 mr-1" />
                Reset
              </Button>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Zoom: {Math.round(zoomLevel * 100)}%
              </div>
            </>
          )}

          {type === 'image' && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setZoomLevel(prev => Math.min(5, prev + 0.5))}
                className="text-xs"
              >
                <ZoomIn className="h-3 w-3 mr-1" />
                Zoom In
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setZoomLevel(prev => Math.max(0.1, prev - 0.5))}
                className="text-xs"
              >
                <ZoomOut className="h-3 w-3 mr-1" />
                Zoom Out
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setZoomLevel(1)}
                className="text-xs"
              >
                <ImageIcon className="h-3 w-3 mr-1" />
                Fit
              </Button>
            </>
          )}

          {type === 'html' && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const iframe = diagramContainerRef.current?.querySelector('iframe');
                  if (iframe) iframe.contentWindow?.location.reload();
                }}
                className="text-xs"
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Reload
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAdvancedControls(!showAdvancedControls)}
                className="text-xs"
              >
                <Settings className="h-3 w-3 mr-1" />
                {showAdvancedControls ? 'Less' : 'More'}
              </Button>
            </>
          )}
        </div>

        {/* Advanced controls panel */}
        {showAdvancedControls && type === 'html' && (
          <div className="w-full mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-gray-600 dark:text-gray-400">Advanced:</ span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const iframe = diagramContainerRef.current?.querySelector('iframe');
                  if (iframe?.contentWindow) {
                    iframe.contentWindow.print();
                  }
                }}
                className="text-xs"
              >
                Print Page
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const iframe = diagramContainerRef.current?.querySelector('iframe');
                  if (iframe?.contentWindow) {
                    iframe.contentWindow.open('', '_blank');
                  }
                }}
                className="text-xs"
              >
                Open in New Tab
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }, [zoomLevel, showAdvancedControls]);

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
      toast('Generating PDF...', { duration: 1000 });

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'px',
        format: 'a4',
      });

      let canvas: HTMLCanvasElement;

      if (diagramType === 'html' || diagramType === 'mermaid') {
        const iframe = diagramContainerRef.current.querySelector('iframe');
        if (iframe && iframe.contentDocument) {
          try {
            const tempContainer = document.createElement('div');
            tempContainer.style.width = '800px';
            tempContainer.style.backgroundColor = '#ffffff';
            tempContainer.style.padding = '20px';
            tempContainer.innerHTML = iframe.contentDocument.body.innerHTML;

            const style = document.createElement('style');
            style.textContent = `
              * { box-sizing: border-box; }
              body { margin: 0; font-family: Arial, sans-serif; line-height: 1.4; }
              img { max-width: 100%; height: auto; }
              table { width: 100%; border-collapse: collapse; }
              th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
              svg { max-width: 100%; max-height: 100%; }
            `;
            tempContainer.appendChild(style);

            document.body.appendChild(tempContainer);

            canvas = await html2canvas(tempContainer, {
              scale: 2,
              useCORS: true,
              allowTaint: true,
              backgroundColor: '#ffffff',
              width: 800,
              windowWidth: 800,
              scrollX: 0,
              scrollY: 0,
            });

            document.body.removeChild(tempContainer);
          } catch (iframeError) {
            console.warn('Could not access iframe content, falling back to container capture:', iframeError);
            canvas = await html2canvas(diagramContainerRef.current, {
              scale: 2,
              useCORS: true,
              backgroundColor: '#ffffff',
              width: diagramContainerRef.current.offsetWidth,
              height: diagramContainerRef.current.offsetHeight,
            });
          }
        } else {
          canvas = await html2canvas(diagramContainerRef.current, {
            scale: 2,
            useCORS: true,
            backgroundColor: '#ffffff',
            width: diagramContainerRef.current.offsetWidth,
            height: diagramContainerRef.current.offsetHeight,
          });
        }
      } else {
        const contentElement = diagramContainerRef.current;
        canvas = await html2canvas(contentElement, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
          width: contentElement.offsetWidth,
          height: contentElement.offsetHeight,
          windowWidth: contentElement.offsetWidth,
          windowHeight: contentElement.offsetHeight,
        });
      }

      const imgData = canvas.toDataURL('image/png');
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

      if (pdfHeight > pdf.internal.pageSize.getHeight()) {
        const pageHeight = pdf.internal.pageSize.getHeight();
        const totalPages = Math.ceil(pdfHeight / pageHeight);

        for (let page = 0; page < totalPages; page++) {
          if (page > 0) pdf.addPage();

          const yOffset = -(page * pageHeight);
          pdf.addImage(imgData, 'PNG', 0, yOffset, pdfWidth, pdfHeight);
        }
      } else {
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      }

      const fileName = diagramType === 'html' ? 'webpage.pdf' : `${diagramType}-export.pdf`;
      pdf.save(fileName);
      toast.success('PDF downloaded successfully!');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Failed to generate PDF. Please try again.');
    }
  }, [diagramType]);

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
            className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 max-h-60 overflow-auto"
          >
            {Object.keys(themes).map((themeName) => (
              <button
                key={themeName}
                onClick={() => {
                  setCurrentTheme(themeName as ThemeName);
                  setShowThemeSelector(false);
                }}
                className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 first:rounded-t-lg last:rounded-b-lg ${currentTheme === themeName ? 'bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-300' : ''
                  }`}
              >
                <div className="flex items-center justify-between">
                  <span className="capitalize">{themeName.replace('-', ' ')}</span>
                  <div
                    className="w-4 h-4 rounded border"
                    style={{ backgroundColor: themes[themeName as ThemeName].background }}
                  />
                </div>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  ), [showThemeSelector, currentTheme]);

  // Enhanced DOT rendering
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
    transition: 'transform 0.2s ease',
  }), [zoomLevel, panOffset]);

  const renderContent = useMemo(() => {
    if (showSourceCode && diagramContent) {
      return (
        <CodeDisplay
          content={diagramContent}
          language={language}
          theme={theme}
          showControls={true}
        />
      );
    }

    if (diagramType === 'mermaid' && diagramContent) {
      return (
        <PanelErrorBoundary>
          <div className="flex flex-col h-full">
            <DiagramControls type="mermaid" />
            <div className="flex-1 p-4 flex items-center justify-center overflow-auto">
              <IsolatedMermaid
                content={diagramContent}
                onError={onMermaidError}
              />
            </div>
          </div>
        </PanelErrorBoundary>
      );
    } else if (diagramType === 'dot') {
      if (isDotLoading) {
        return (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-2" />
              <p className="text-sm text-gray-600 dark:text-gray-400">Rendering DOT graph...</p>
            </div>
          </div>
        );
      }
      if (dotError) {
        return (
          <div className="p-4">
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4 dark:bg-red-950/20 dark:text-red-300 dark:border-red-800">
              <div className="flex items-start">
                <AlertTriangle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold mb-1">DOT Syntax Error</h4>
                  <p className="text-sm mb-3">{dotError}</p>
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
          </div>
        );
      }
      return (
        <PanelErrorBoundary>
          <div className="flex flex-col h-full">
            <DiagramControls type="dot" />
            <div className="flex-1 p-4 flex items-center justify-center overflow-auto">
              <div
                className="max-w-full max-h-full"
                style={contentStyle}
                dangerouslySetInnerHTML={{ __html: dotSvg || '' }}
              />
            </div>
          </div>
        </PanelErrorBoundary>
      );
    } else if (diagramType === 'chartjs') {
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
          <div className="flex flex-col h-full">
            {chartError && (
              <div className="p-4 bg-red-50 border-b border-red-200 text-red-700 dark:bg-red-950/20 dark:text-red-300 dark:border-red-800">
                <div className="flex items-start">
                  <AlertTriangle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold mb-1">Chart Configuration Error</h4>
                    <p className="text-sm mb-3">{chartError}</p>
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
              showControls={true}
            />
          </div>
        </PanelErrorBoundary>
      );
    } else if (diagramType === 'threejs') {
      return (
        <PanelErrorBoundary>
          <div className="flex flex-col h-full">
            {threeJsError && (
              <div className="p-4 bg-red-50 border-b border-red-200 text-red-700 dark:bg-red-950/20 dark:text-red-300 dark:border-red-800">
                <div className="flex items-start">
                  <AlertTriangle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold mb-1">Three.js Scene Error</h4>
                    <p className="text-sm mb-3">{threeJsError}</p>
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
              showControls={true}
            />
          </div>
        </PanelErrorBoundary>
      );
    } else if (diagramType === 'code' || diagramType === 'document-text') {
      return (
        <CodeDisplay
          content={diagramContent || ''}
          language={language}
          theme={theme}
          showControls={true}
        />
      );
    } else if (diagramType === 'image' && imageUrl) {
      return (
        <div className="flex flex-col h-full">
          <DiagramControls type="image" />
          <div className="flex-1 flex items-center justify-center p-4 bg-gray-50 dark:bg-gray-950 overflow-auto">
            <img
              src={imageUrl}
              alt="Viewed image"
              className="max-w-none max-h-none object-contain rounded-lg shadow-md"
              style={{
                transform: `scale(${zoomLevel})`,
                transition: 'transform 0.2s ease',
                imageRendering: zoomLevel > 2 ? 'pixelated' : 'auto'
              }}
              onError={(e) => {
                e.currentTarget.src = 'https://placehold.co/400x300/e0e0e0/666666?text=Image+Load+Error';
                e.currentTarget.alt = 'Image failed to load';
              }}
              loading="lazy"
            />
          </div>
        </div>
      );
    } else if (diagramType === 'html') {
      return (
        <PanelErrorBoundary>
          <div className="flex flex-col h-full">
            <DiagramControls type="html" />
            <div className="flex-1">
              <IsolatedHtml html={diagramContent || ''} />
            </div>
          </div>
        </PanelErrorBoundary>
      );
    } else {
      return (
        <div className="flex flex-col items-center justify-center h-full text-slate-500 dark:text-gray-400 p-4">
          <AlertTriangle className="h-12 w-12 mb-4 text-amber-500" />
          <h3 className="text-xl font-semibold mb-2">Unsupported Content Type</h3>
          <p className="text-sm text-center mb-4 max-w-md">
            This content type ({diagramType}) is not supported for viewing in the diagram panel.
          </p>
          <details className="w-full max-w-2xl">
            <summary className="cursor-pointer text-sm hover:text-slate-700 dark:hover:text-gray-300 font-medium mb-2">
              View Raw Content
            </summary>
            <CodeDisplay
              content={diagramContent || 'No content available'}
              language="text"
              theme={theme}
              showControls={false}
            />
          </details>
        </div>
      );
    }
  }, [
    diagramContent, diagramType, imageUrl, currentTheme, theme, showSourceCode, language,
    chartError, threeJsError, dotSvg, dotError, isDotLoading,
    handleThreeJsSceneReady, onSuggestAiCorrection, onMermaidError,
    contentStyle, zoomLevel, DiagramControls
  ]);

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

  // Get panel title based on content type
  const getPanelTitle = () => {
    if (showSourceCode) return `${language?.toUpperCase() || 'TEXT'} Source`;

    switch (diagramType) {
      case 'mermaid': return 'Mermaid Diagram';
      case 'dot': return 'Graphviz DOT Graph';
      case 'chartjs': return 'Chart.js Visualization';
      case 'threejs': return 'Three.js 3D Scene';
      case 'html': return 'Web Page';
      case 'code': return `${language?.toUpperCase() || 'CODE'} File`;
      case 'document-text': return `${language?.toUpperCase() || 'TEXT'} Document`;
      case 'image': return 'Image Viewer';
      default: return 'Content Viewer';
    }
  };

  return (
    <motion.div
      ref={diagramPanelRef}
      className={`fixed inset-0 modern-scrollbar md:relative md:inset-y-0 md:right-0 bg-white shadow-2xl flex flex-col z-50 md:rounded-l-lg md:shadow-xl md:border-l md:border-slate-200 dark:bg-gray-900 dark:border-gray-700 ${isFullScreen ? 'w-full h-full' : ''
        }`}
      variants={panelVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      style={dynamicPanelStyle}
    >
      {/* Enhanced Header */}
      <div className="p-3 sm:p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm: justify-between bg-white dark:bg-gray-900 dark:border-gray-700 flex-shrink-0">
        <div className="flex items-center mb-2 sm:mb-0">
          <h3 className="text-base sm:text-lg font-semibold text-slate-800 dark:text-gray-100 truncate mr-3">
            {getPanelTitle()}
          </h3>

          {/* Status indicators */}
          <div className="flex items-center gap-2">
            {networkError && (
              <div className="flex items-center text-amber-600 dark:text-amber-400" title="Network connection issues detected">
                <WifiOff className="h-4 w-4" />
              </div>
            )}
            {(isDotLoading) && (
              <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
            )}
            {(dotError || chartError || threeJsError) && (
              <AlertTriangle className="h-4 w-4 text-red-500" />
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-1 sm:gap-2 justify-end">
          {/* Theme selector for code content */}
          {availableActions[diagramType].includes('theme') && (
            <ThemeSelector />
          )}

          {/* Toggle between source and preview */}
          {availableActions[diagramType].includes('toggle') && diagramContent && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSourceCode(!showSourceCode)}
              className="text-xs sm:text-sm px-2 sm:px-3 py-1"
              title={showSourceCode ? 'Show preview' : 'Show source code'}
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

          {/* Download content */}
          {availableActions[diagramType].includes('download') && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadContent}
              className="text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900 dark:border-blue-700 text-xs sm:text-sm px-2 sm:px-3 py-1"
              title="Download content"
              disabled={!diagramContent && !imageUrl || diagramType === 'unknown'}
            >
              <Download className="h-3 w-3 sm:h-4 sm:w-4 mr-0 sm:mr-2" />
              <span className="hidden sm:inline">Download</span>
            </Button>
          )}

          {/* Download GLTF for 3D scenes */}
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

          {/* Download PDF */}
          {availableActions[diagramType].includes('pdf') && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadPdf}
              className="text-purple-600 hover:bg-purple-50 dark:text-purple-400 dark:hover:bg-purple-900 dark:border-purple-700 text-xs sm:text-sm px-2 sm:px-3 py-1"
              title="Download as PDF"
              disabled={!diagramContent && !imageUrl || diagramType === 'unknown'}
            >
              <Download className="h-3 w-3 sm:h-4 sm:w-4 mr-0 sm:mr-2" />
              <span className="hidden sm:inline">PDF</span>
            </Button>
          )}

          {/* Fullscreen toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsFullScreen(prev => !prev)}
            title={isFullScreen ? 'Exit Full Screen' : 'Full Screen'}
            className="text-slate-600 hover:bg-slate-200 dark:text-gray-300 dark:hover:bg-gray-700 h-8 w-8"
          >
            {isFullScreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>

          {/* Close panel */}
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

      {/* Content area with error boundary */}
      <div
        ref={diagramContainerRef}
        className="flex-1 overflow-hidden bg-white dark:bg-gray-900"
      >
        <PanelErrorBoundary
          onError={(error) => {
            console.error('Panel content error:', error);
            toast.error(`Content rendering error: ${error.message}`);
          }}
        >
          {renderContent}
        </PanelErrorBoundary>
      </div>

      {/* Footer with additional info */}
      <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
        <div className="flex items-center gap-4">
          <span>Type: {diagramType}</span>
          {language && <span>Lang: {language}</span>}
          {diagramContent && (
            <span>
              Size: {(new Blob([diagramContent]).size / 1024).toFixed(1)}KB
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {zoomLevel !== 1 && (
            <span>Zoom: {Math.round(zoomLevel * 100)}%</span>
          )}
          <div className="flex items-center">
            <MousePointer className="h-3 w-3 mr-1" />
            <span className="hidden sm:inline">Interactive</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
});

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