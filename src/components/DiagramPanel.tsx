// src/components/DiagramPanel.tsx
import React, { useRef, useEffect, useState, useCallback, memo, useMemo } from 'react';
import { Button } from './ui/button';
import { X, RefreshCw, AlertTriangle, Code, ChevronRight, ChevronLeft, Download, GripVertical, Loader2, Palette, Sun, Moon } from 'lucide-react';
import { toast } from 'sonner';
import { Chart, registerables } from 'chart.js';
import Mermaid from './Mermaid'; // Assuming Mermaid.tsx is in the same components folder
import { Graphviz } from '@hpcc-js/wasm'; // Import Graphviz

// Import THREE.js and OrbitControls from npm packages
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
// NEW: Import GLTFLoader
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
// NEW: Import GLTFExporter
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';


// NEW: Import from utility file
import { themes, ThemeName, escapeHtml, highlightCode } from '../utils/codeHighlighting';


// Ensure Chart.js components are registered once
Chart.register(...registerables);

// Declare global types for libraries (only for those not imported directly)
declare global {
  interface Window {
    jspdf: any; // jsPDF library
    html2canvas: any; // html2canvas library
    Viz: any; // Viz.js library for DOT graphs
  }
}

interface DiagramPanelProps {
  diagramContent?: string;
  diagramType: 'mermaid' | 'dot' | 'chartjs' | 'code' | 'image' | 'unknown' | 'document-text' | 'threejs'; // Added 'threejs'
  onClose: () => void;
  onMermaidError: (code: string, errorType: 'syntax' | 'rendering') => void;
  onSuggestAiCorrection: (prompt: string) => void;
  isOpen: boolean;
  language?: string; // For 'code' type, specifies the language
  imageUrl?: string; // For 'image' type
  initialWidthPercentage?: number; // NEW PROP
}

// NEW: ChartRenderer Component
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
          onInvalidConfig(null); // Clear any previous error
        }
      } catch (error: any) {
        console.error("Error rendering Chart.js:", error);
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
      {/* Changed className to include h-full for proper sizing */}
      <canvas ref={chartRef} className="max-w-full h-full"></canvas>
    </div>
  );
});

// NEW: ThreeJSRenderer Component
interface ThreeJSRendererProps {
  codeContent: string;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  onInvalidCode: (error: string | null) => void;
  // NEW: Callback to pass scene and renderer to parent for export
  onSceneReady: (scene: THREE.Scene, renderer: THREE.WebGLRenderer, cleanup: () => void) => void;
}

const ThreeJSRenderer: React.FC<ThreeJSRendererProps> = memo(({ codeContent, canvasRef, onInvalidCode, onSceneReady }) => {
  const threeJsCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (canvasRef.current && codeContent) {
      ("[Three.js Renderer] Attempting to render Three.js scene.");
      if (threeJsCleanupRef.current) {
        threeJsCleanupRef.current();
        threeJsCleanupRef.current = null;
        ("[Three.js Renderer] Cleaned up previous scene.");
      }

      try {
        // We define the function that will execute the user's code.
        // The arguments 'THREE', 'OrbitControls', 'GLTFLoader' are parameters to this *outer* function.
        const createSceneWrapper = new Function('THREE', 'OrbitControls', 'GLTFLoader', `
          ${codeContent}
          // The user's code is expected to define a function called createThreeJSScene
          // We return this function so it can be called with its specific arguments.
          return createThreeJSScene;
        `);

        // Now, call the createSceneWrapper with the actual THREE, OrbitControls, GLTFLoader objects.
        // This returns the user's 'createThreeJSScene' function.
        const createScene = createSceneWrapper(THREE, OrbitControls, GLTFLoader);

        // Finally, call the user's 'createThreeJSScene' function, passing all its expected arguments.
        const { scene, renderer, cleanup } = createScene(canvasRef.current, THREE, OrbitControls, GLTFLoader);

        threeJsCleanupRef.current = cleanup;
        onInvalidCode(null); // Clear any previous error
        onSceneReady(scene, renderer, cleanup); // Pass scene, renderer, and cleanup to parent
        ("[Three.js Renderer] Three.js scene rendered successfully.");
      } catch (error: any) {
        console.error("Error rendering Three.js scene:", error);
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
        ("[Three.js Renderer] Cleanup: Three.js scene unmounted.");
      }
    };
  }, [codeContent, canvasRef, onInvalidCode, onSceneReady]);

  return (
    <div className="p-4 flex items-center justify-center h-full">
      {/* Changed className to include h-full for proper sizing */}
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
  initialWidthPercentage, // Destructure new prop
}) => {
  const [showRawCode, setShowRawCode] = useState(false);
  const chartRef = useRef<HTMLCanvasElement>(null);
  // chartInstance is now managed within ChartRenderer
  const diagramContainerRef = useRef<HTMLDivElement>(null); // Ref for the main content area for PDF export

  // Theme state
  const [currentTheme, setCurrentTheme] = useState<ThemeName>('github-light');
  const [showThemeSelector, setShowThemeSelector] = useState(false);

  // NEW: Ref for Three.js canvas and its cleanup function
  const threeJsRef = useRef<HTMLCanvasElement>(null);
  // threeJsCleanupRef is now managed within ThreeJSRenderer

  // NEW: State to hold the Three.js scene and renderer instances for export
  const [threeJsScene, setThreeJsScene] = useState<THREE.Scene | null>(null);
  const [threeJsRenderer, setThreeJsRenderer] = useState<THREE.WebGLRenderer | null>(null);
  const threeJsCleanupFunction = useRef<(() => void) | null>(null);

  const diagramPanelRef = useRef<HTMLDivElement>(null);
  const [panelWidth, setPanelWidth] = useState<number | null>(null);
  const [isResizingWidth, setIsResizingWidth] = useState(false);
  const initialX = useRef(0);
  const initialPanelWidth = useRef(0);

  const [panelHeight, setPanelHeight] = useState<number | null>(null);
  const [isResizingHeight, setIsResizingHeight] = useState(false);
  const initialY = useRef(0);
  const initialPanelHeight = useRef(0);

  const [chartError, setChartError] = useState<string | null>(null);
  const [threeJsError, setThreeJsError] = useState<string | null>(null); // State for Three.js errors
  const [dotSvg, setDotSvg] = useState<string | null>(null);
  const [dotError, setDotError] = useState<string | null>(null);
  const [isDotLoading, setIsDotLoading] = useState(false);

  // Auto-detect system theme preference
  useEffect(() => {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setCurrentTheme(prefersDark ? 'github-dark' : 'github-light');
  }, []);

  // Effect to set initial width/height based on responsive classes when panel opens
  useEffect(() => {
    if (isOpen && diagramPanelRef.current) {
      if (window.innerWidth >= 768) {
        if (panelWidth === null && initialWidthPercentage !== undefined) {
          setPanelWidth(window.innerWidth * (initialWidthPercentage / 100)); // Use prop for initial width
        } else if (panelWidth === null) { // Fallback if no prop is provided
          setPanelWidth(window.innerWidth * 0.7); // Keep existing default if no specific percentage
        }
        if (panelHeight === null) {
          setPanelHeight(window.innerHeight * 0.8);
        }
      }
    }
  }, [isOpen, panelWidth, panelHeight, initialWidthPercentage]);

  // Cleanup Three.js scene when panel closes or diagram content changes
  useEffect(() => {
    return () => {
      if (threeJsCleanupFunction.current) {
        threeJsCleanupFunction.current();
        threeJsCleanupFunction.current = null;
        setThreeJsScene(null);
        setThreeJsRenderer(null);
      }
    };
  }, [diagramContent, diagramType]); // Dependency on diagramContent and diagramType to trigger cleanup on change

  // Callback to receive Three.js scene and renderer from ThreeJSRenderer
  const handleThreeJsSceneReady = useCallback((scene: THREE.Scene, renderer: THREE.WebGLRenderer, cleanup: () => void) => {
    setThreeJsScene(scene);
    setThreeJsRenderer(renderer);
    threeJsCleanupFunction.current = cleanup;
  }, []);

  // Width Resize Handlers
  const handleWidthResizeMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if (window.innerWidth < 768) return;

    e.preventDefault();
    setIsResizingWidth(true);
    initialX.current = e.clientX;
    initialPanelWidth.current = diagramPanelRef.current?.offsetWidth || 0;
    document.body.style.cursor = 'ew-resize';
  }, []);

  const handleWidthResizeMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizingWidth) return;

    const deltaX = initialX.current - e.clientX;
    let newWidth = initialPanelWidth.current + deltaX;

    const minWidth = 300;
    const maxWidth = window.innerWidth * 0.9;

    newWidth = Math.max(minWidth, Math.min(newWidth, maxWidth));
    setPanelWidth(newWidth);
  }, [isResizingWidth]);

  // Height Resize Handlers
  const handleHeightResizeMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    setIsResizingHeight(true);
    initialY.current = e.clientY;
    initialPanelHeight.current = diagramPanelRef.current?.offsetHeight || 0;
    document.body.style.cursor = 'ns-resize';
  }, []);

  const handleHeightResizeMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizingHeight) return;

    const deltaY = e.clientY - initialY.current;
    let newHeight = initialPanelHeight.current + deltaY;

    const minHeight = 200;
    const maxHeight = window.innerHeight * 0.9;

    newHeight = Math.max(minHeight, Math.min(newHeight, maxHeight));
    setPanelHeight(newHeight);
  }, [isResizingHeight]);

  // Global event listeners for resizing
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      setIsResizingWidth(false);
      setIsResizingHeight(false);
      document.body.style.cursor = 'default'; // Reset cursor
    };

    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (isResizingWidth) {
        handleWidthResizeMouseMove(e);
      }
      if (isResizingHeight) {
        handleHeightResizeMouseMove(e);
      }
    };

    // Attach listeners when resizing starts
    if (isResizingWidth || isResizingHeight) {
      window.addEventListener('mousemove', handleGlobalMouseMove);
      window.addEventListener('mouseup', handleGlobalMouseUp);
      // Add mouseleave to window to catch releases outside the iframe
      window.addEventListener('mouseleave', handleGlobalMouseUp);
    } else {
      // Clean up listeners when resizing stops
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      window.removeEventListener('mouseleave', handleGlobalMouseUp);
    }

    // Cleanup on component unmount
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      window.removeEventListener('mouseleave', handleGlobalMouseUp);
    };
  }, [isResizingWidth, isResizingHeight, handleWidthResizeMouseMove, handleHeightResizeMouseMove]);

  // Apply dynamic width and height styles
  const dynamicPanelStyle: React.CSSProperties = {
    ...(panelWidth !== null && window.innerWidth >= 768 ? { width: `${panelWidth}px` } : {}),
    ...(panelHeight !== null ? { height: `${panelHeight}px` } : {}),
  };

  let panelTitle = 'Viewer';
  let downloadButtonText = 'Download Content';
  let downloadFileName = 'content';

  // Function to download content
  const handleDownloadContent = () => {
    if (!diagramContainerRef.current && !imageUrl) {
      toast.error('Content not rendered for download.');
      return;
    }

    let fileExtension = '';
    let contentToDownload: string | Blob = '';
    let mimeType = '';

    if (diagramType === 'image' && imageUrl) {
      const link = document.createElement('a');
      link.href = imageUrl;
      link.download = `image-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Image downloaded!');
      return;
    }

    if (diagramType === 'mermaid' || diagramType === 'dot') {
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
        const downloadLink = document.createElement('a');
        downloadLink.href = contentToDownload as string;
        downloadLink.download = `${downloadFileName}.${fileExtension}`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        toast.success(`Chart downloaded as ${fileExtension.toUpperCase()}!`);
        return;
      } else {
        toast.error('Chart canvas not found for chart.js download.');
        return;
      }
    } else if (diagramType === 'threejs') {
      if (threeJsRef.current) {
        contentToDownload = threeJsRef.current.toDataURL('image/png');
        fileExtension = 'png';
        mimeType = 'image/png';
        const downloadLink = document.createElement('a');
        downloadLink.href = contentToDownload as string;
        downloadLink.download = `${downloadFileName}.${fileExtension}`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        toast.success(`3D Scene downloaded as ${fileExtension.toUpperCase()}!`);
        return;
      } else {
        toast.error('3D scene canvas not found for download.');
        return;
      }
    }
    else if (diagramType === 'code' || diagramType === 'document-text') {
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
    document.body.removeChild(downloadLink);
    URL.revokeObjectURL(url);
    toast.success(`${diagramType === 'code' ? 'Code' : 'Diagram'} downloaded as ${fileExtension.toUpperCase()}!`);
  };

  // NEW: Function to download GLTF
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
        console.error('Error exporting GLTF:', error);
        toast.error('Failed to export GLTF scene.');
      },
      {} // Options, e.g., { binary: true } for GLB
    );
  }, [threeJsScene, threeJsRenderer]);


  // Function to download as PDF
  const handleDownloadPdf = async () => {
    // Determine which ref to use for PDF generation based on diagramType
    let targetRef;
    if (diagramType === 'chartjs') {
      targetRef = chartRef;
    } else if (diagramType === 'threejs') {
      targetRef = threeJsRef;
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
      const canvas = await window.html2canvas(targetRef.current, { // Use targetRef.current
        scale: 3,
        useCORS: true,
        backgroundColor: themes[currentTheme].background,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new window.jspdf.jsPDF({
        orientation: canvas.width > canvas.height ? 'l' : 'p',
        unit: 'px',
        format: [canvas.width, canvas.height],
      });

      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
      pdf.save(`content-${Date.now()}.pdf`);
      toast.success('Content downloaded as PDF!');
    } catch (error) {
      console.error('Error generating PDF:', error);
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
          console.error('DiagramPanel (DOT): DOT rendering error:', e);
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
                className={`w-full text-left px-3 py-2 rounded text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${currentTheme === themeName ? 'bg-blue-50 text-blue-700 dark:bg-blue-900 dark:text-blue-300' : ''
                  }`}
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
                  <span className="capitalize">
                    {themeName.replace('-', ' ')}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  // Memoize the render content function
  const renderContent = useMemo(() => {
    if (!diagramContent && !imageUrl) {
      return <p className="text-gray-500">No content to display.</p>;
    }

    const theme = themes[currentTheme];

    if (showRawCode) {
      return (
        <div
          className="relative rounded-lg overflow-hidden h-full"
          style={{ backgroundColor: theme.background }}
        >
          <div className="p-4 overflow-x-auto h-full">
            <pre
              className="font-mono text-sm leading-relaxed h-full whitespace-pre-wrap"
              style={{ color: theme.foreground }}
            >
              <code>{diagramContent || imageUrl}</code>
            </pre>
          </div>
        </div>
      );
    }

    if (diagramType === 'mermaid') {
      panelTitle = 'Mermaid Diagram View';
      downloadButtonText = 'Download Diagram (SVG)';
      downloadFileName = 'mermaid-diagram';
      return (
        <Mermaid
          chart={diagramContent || ''}
          onMermaidError={onMermaidError}
          onSuggestAiCorrection={onSuggestAiCorrection} // <-- IMPORTANT: Pass the prop here!
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
            className="w-full h-full flex items-center justify-center relative"
            style={{ cursor: isResizingHeight || isResizingWidth ? 'default' : 'grab' }}
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
      return (
        <>
          {chartError && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4 dark:bg-red-900 dark:text-red-300">
              <AlertTriangle className="inline h-4 w-4 mr-2" />
              <span>{chartError}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onSuggestAiCorrection(`Can you fix this Chart.js configuration? Here's the code: ${diagramContent}`)}
                className="ml-4 text-red-700 hover:text-red-900 dark:text-red-300 dark:hover:text-red-100"
              >
                Suggest AI Correction
              </Button>
            </div>
          )}
          <ChartRenderer
            chartConfig={diagramContent ? JSON.parse(diagramContent.replace(/\/\/.*|\/\*[\sS]*?\*\//g, '')) : {}}
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
            onSceneReady={handleThreeJsSceneReady} // Pass the callback here
          />
        </>
      );
    }
    else if (diagramType === 'code') {
      panelTitle = language ? `Code View - ${language.toUpperCase()}` : 'Code View';
      downloadButtonText = 'Download Code';
      downloadFileName = `code.${language || 'txt'}`;
      return (
        <div
          className="relative rounded-lg overflow-hidden h-full shadow-lg"
          style={{
            backgroundColor: theme.background,
            border: `1px solid ${theme.border}`
          }}
        >
          {/* Header with language indicator and line numbers toggle */}
          <div
            className="px-4 py-2 border-b text-sm font-medium flex items-center justify-between"
            style={{
              backgroundColor: theme.background,
              borderColor: theme.border,
              color: theme.foreground
            }}
          >
            <span className="flex items-center space-x-2">
              <Code className="h-4 w-4" />
              <span>{language?.toUpperCase() || 'PLAINTEXT'}</span>
            </span>
            <span
              className="text-xs opacity-75"
              style={{ color: theme.lineNumbers }}
            >
              {diagramContent?.split('\n').length || 0} lines
            </span>
          </div>

          <div className="p-4 overflow-auto h-full">
            <div className="flex">
              {/* Line numbers */}
              <div
                className="select-none pr-4 text-right font-mono text-sm leading-relaxed"
                style={{ color: theme.lineNumbers }}
              >
                {diagramContent?.split('\n').map((_, index) => (
                  <div key={index + 1} className="min-h-[1.5rem]">
                    {index + 1}
                  </div>
                ))}
              </div>

              {/* Code content */}
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
    } else if (diagramType === 'document-text') {
      panelTitle = language ? `Document View - ${language.toUpperCase()}` : 'Document View';
      downloadButtonText = 'Download Document';
      downloadFileName = `document.${language || 'txt'}`;
      return (
        <div
          className="relative rounded-lg overflow-hidden h-full shadow-lg"
          style={{
            backgroundColor: theme.background,
            border: `1px solid ${theme.border}`
          }}
        >
          <div className="p-6 overflow-auto h-full">
            <pre
              className="font-mono text-sm leading-relaxed h-full whitespace-pre-wrap"
              style={{ color: theme.foreground }}
            >
              <code
                dangerouslySetInnerHTML={{
                  __html: diagramContent ? escapeHtml(diagramContent) : ''
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
  }, [diagramContent, diagramType, imageUrl, showRawCode, currentTheme, isResizingHeight, isResizingWidth, onMermaidError, onSuggestAiCorrection, chartError, threeJsError, language, dotSvg, dotError, isDotLoading, handleThreeJsSceneReady]);

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

  return (
    <>
      <div
        ref={diagramPanelRef}
        className={`
          absolute inset-y-0 right-0 w-full bg-white shadow-xl flex flex-col z-40 transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}
          md:rounded-lg md:shadow-md md:mb-6 md:border md:border-slate-200 
          dark:bg-gray-900 dark:border-gray-700
        `}
        style={dynamicPanelStyle}
      >
        {/* Resizer Handle for Width - only visible on desktop */}
        <div
          className="hidden md:block absolute left-0 top-0 bottom-0 w-2 bg-transparent cursor-ew-resize z-50 hover:bg-gray-200 transition-colors duration-200 dark:hover:bg-gray-700"
          onMouseDown={handleWidthResizeMouseDown}
        />

        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between bg-white dark:bg-gray-900 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-slate-800 mb-2 sm:mb-0 dark:text-gray-100">{panelTitle}</h3>
          <div className="flex flex-wrap items-center gap-2 justify-end">
            {/* Theme selector for code and document types */}
            {diagramContent && (diagramType === 'code' || diagramType === 'document-text') && (
              <div className="theme-selector-container">
                <ThemeSelector />
              </div>
            )}

            {/* Toggle Raw Code Button */}
            {diagramContent && (diagramType === 'code' || diagramType === 'document-text' || diagramType === 'chartjs' || diagramType === 'mermaid' || diagramType === 'dot' || diagramType === 'threejs') && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowRawCode(!showRawCode)}
                className="text-sm px-3 py-1"
              >
                <Code className="h-4 w-4 mr-2" /> {showRawCode ? 'Hide Raw Code' : 'View Raw Code'}
              </Button>
            )}

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

            {/* NEW: Download GLTF Button */}
            {diagramType === 'threejs' && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadGltf}
                className="text-green-600 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900 dark:border-green-700"
                title="Download 3D Model (GLTF)"
                disabled={!threeJsScene || !threeJsRenderer} // Enable only when scene is ready
              >
                <Download className="h-4 w-4 mr-0 sm:mr-2" />
                <span className="hidden sm:inline">Download GLTF</span>
              </Button>
            )}

            {(!['code', 'image', 'unknown', 'document-text'].includes(diagramType)) && (
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

            <Button variant="ghost" size="icon" onClick={onClose} title="Close Panel" className="flex-shrink-0 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200">
              <X className="h-5 w-5 text-slate-500 hover:text-slate-700 dark:text-gray-400 dark:hover:text-gray-200" />
            </Button>
          </div>
        </div>

        <div ref={diagramContainerRef} className="flex-1 overflow-auto modern-scrollbar dark:bg-gray-900">
          {renderContent}
        </div>

        <div
          className="absolute bottom-0 left-0 right-0 h-3 flex items-center justify-center cursor-ns-resize text-gray-500 hover:text-gray-300 z-50"
          onMouseDown={handleHeightResizeMouseDown}
        >
          <GripVertical className="h-4 w-4" />
        </div>
      </div>
    </>
  );
})