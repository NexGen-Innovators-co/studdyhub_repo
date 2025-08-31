import React, { useRef, useEffect, useState, useCallback, memo, useMemo, MutableRefObject, Dispatch, SetStateAction } from 'react';
import { motion } from 'framer-motion';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import {
  X, Download, Maximize2, Minimize2, ZoomIn, ZoomOut, Eye, FileCode,
  Hand, ChevronLeft, ChevronRight, Sun, Moon, MousePointer
} from 'lucide-react';
import { toast } from 'sonner';
import { Chart, registerables } from 'chart.js';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import ReactMarkdown from 'react-markdown';
import DOMPurify from 'dompurify';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import ErrorBoundary from '../../ErrorBoundary';
import * as ReactDOMClient from 'react-dom/client';

Chart.register(...registerables);

interface Slide {
  title: string;
  content: string | string[];
  layout?: string;
}

interface DiagramPanelProps {
  diagramContent?: string;
  diagramType: 'mermaid' | 'dot' | 'chartjs' | 'code' | 'image' | 'unknown' | 'document-text' | 'threejs' | 'html' | 'slides';
  onClose: () => void;
  onMermaidError: (code: string | null, errorType: 'syntax' | 'rendering' | 'timeout' | 'network') => void;
  onSuggestAiCorrection: (prompt: string) => void;
  isOpen: boolean;
  language?: string;
  imageUrl?: string;
  initialWidthPercentage?: number;
  liveContent?: string;
  isPhone: () => boolean;
}

interface ThreeJSRendererProps {
  codeContent: string | undefined;
  canvasRef: MutableRefObject<HTMLCanvasElement | null>;
  onInvalidCode: Dispatch<SetStateAction<string | null>>;
  onSceneReady: (scene: THREE.Scene, renderer: THREE.WebGLRenderer, cleanup: () => void) => void;
}

const ThreeJSRenderer = memo(({ codeContent, canvasRef, onInvalidCode, onSceneReady }: ThreeJSRendererProps) => {
  const animationFrameIdRef = useRef<number | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const sceneInitializedRef = useRef<boolean>(false);

  const initializeScene = useCallback(() => {
    if (!canvasRef.current || !codeContent || sceneInitializedRef.current) {
      return;
    }

    sceneInitializedRef.current = true;

    console.log("[ThreeJSRenderer] Initializing Three.js scene.");

    if (cleanupRef.current) {
      console.log("[ThreeJSRenderer] Cleaning up previous scene.");
      cleanupRef.current();
      cleanupRef.current = null;
    }
    if (animationFrameIdRef.current) {
      cancelAnimationFrame(animationFrameIdRef.current);
      animationFrameIdRef.current = null;
    }

    try {
      const createSceneWrapper = new Function('THREE', 'OrbitControls', 'GLTFLoader', `
${codeContent}
return createThreeJSScene;
`);

      const createScene = createSceneWrapper(THREE, OrbitControls, GLTFLoader);
      const { scene, renderer, camera, controls, cleanup } = createScene(canvasRef.current, THREE, OrbitControls, GLTFLoader);

      cleanupRef.current = cleanup;

      const animate = () => {
        controls.update();
        renderer.render(scene, camera);
        animationFrameIdRef.current = requestAnimationFrame(animate);
      };

      animationFrameIdRef.current = requestAnimationFrame(animate);

      onSceneReady(scene, renderer, cleanup);
      onInvalidCode(null);
      console.log("[ThreeJSRenderer] Scene initialized successfully.");

      const handleResize = () => {
        if (canvasRef.current && renderer) {
          const width = canvasRef.current.clientWidth;
          const height = canvasRef.current.clientHeight;
          renderer.setSize(width, height);
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
          renderer.setPixelRatio(window.devicePixelRatio);
          renderer.render(scene, camera);
        }
      };

      window.addEventListener('resize', handleResize);
      handleResize();

      return () => {
        console.log("[ThreeJSRenderer] Cleaning up on unmount.");
        if (animationFrameIdRef.current) {
          cancelAnimationFrame(animationFrameIdRef.current);
          animationFrameIdRef.current = null;
        }
        if (cleanupRef.current) {
          cleanupRef.current();
          cleanupRef.current = null;
        }
        window.removeEventListener('resize', handleResize);
        sceneInitializedRef.current = false;
      };
    } catch (error) {
      console.error("[ThreeJSRenderer] Error initializing Three.js scene:", error);
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
      sceneInitializedRef.current = false;
    }
  }, [codeContent, canvasRef, onInvalidCode, onSceneReady]);

  useEffect(() => {
    const timeoutId = setTimeout(initializeScene, 100);
    return () => clearTimeout(timeoutId);
  }, [initializeScene]);

  return null;
});

export const DiagramPanel = memo(({
  diagramContent,
  diagramType,
  onClose,
  onMermaidError,
  onSuggestAiCorrection,
  isOpen,
  language,
  imageUrl,
  initialWidthPercentage = 65,
  liveContent,
  isPhone
}: DiagramPanelProps) => {
  const [panelWidth, setPanelWidth] = useState(initialWidthPercentage);
  const [isResizing, setIsResizing] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const lastMousePos = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const innerContentWrapperRef = useRef<HTMLDivElement>(null);
  const htmlIframeRef = useRef<HTMLIFrameElement>(null);
  const mermaidIframeRef = useRef<HTMLIFrameElement>(null);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const threeJsCanvasRef = useRef<HTMLCanvasElement>(null);
  const [threeJsError, setThreeJsError] = useState<string | null>(null);
  const [threeJsScene, setThreeJsScene] = useState<THREE.Scene | null>(null);
  const [threeJsRenderer, setThreeJsRenderer] = useState<THREE.WebGLRenderer | null>(null);
  const [threeJsCleanup, setThreeJsCleanup] = useState<(() => void) | null>(null);

  const renderContent = useMemo(() => liveContent || diagramContent, [liveContent, diagramContent]);

  const effectiveDiagramType = useMemo(() => {
    if (diagramType === 'code' && renderContent) {
      try {
        const parsed = JSON.parse(renderContent);
        if (Array.isArray(parsed) && parsed.every(item => item && typeof item === 'object' && 'title' in item && 'content' in item)) {
          return 'slides';
        }
      } catch (e) {
        // Not valid JSON, keep as 'code'
      }
    }
    return diagramType;
  }, [diagramType, renderContent]);

  const isInteractiveContent = useMemo(() => {
    return ['mermaid', 'dot', 'chartjs', 'image'].includes(effectiveDiagramType);
  }, [effectiveDiagramType]);

  const onSceneReady = useCallback((scene: THREE.Scene, renderer: THREE.WebGLRenderer, cleanup: () => void) => {
    setThreeJsScene(scene);
    setThreeJsRenderer(renderer);
    setThreeJsCleanup(() => {
      cleanup();
      setThreeJsScene(null);
      setThreeJsRenderer(null);
      setThreeJsCleanup(null);
    });
  }, []);

  const sanitizeHtml = useCallback((html: string) => {
    return DOMPurify.sanitize(html, {
      USE_PROFILES: { html: true },
      ADD_TAGS: ['style'],
      ADD_ATTR: ['style'],
    });
  }, []);

  useEffect(() => {
    if (effectiveDiagramType === 'html' && renderContent && htmlIframeRef.current) {
      const iframe = htmlIframeRef.current;
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(renderContent);
        doc.close();
      }
    }
  }, [effectiveDiagramType, renderContent]);

  useEffect(() => {
    if (effectiveDiagramType === 'mermaid' && renderContent && mermaidIframeRef.current) {
      const iframe = mermaidIframeRef.current;
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (doc) {
        doc.open();
        const fullHtml = `
<!DOCTYPE html>
<html>
<head>
<style>
body { margin: 0; padding: 10px; background-color: #282c34; display: flex; justify-content: center; align-items: center; min-height: 100vh; color: #abb2bf; font-family: sans-serif; overflow: hidden; }
.mermaid { display: flex; justify-content: center; align-items: center; width: 100%; height: 100%; }
</style>
</head>
<body>
<div class="mermaid">
${renderContent}
</div>
<script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
<script>
mermaid.initialize({ startOnLoad: true, theme: 'dark', securityLevel: 'loose' });
document.addEventListener('DOMContentLoaded', () => {
mermaid.init(undefined, ".mermaid");
});
</script>
</body>
</html>
`;
        doc.write(fullHtml);
        doc.close();
      }
    }
  }, [effectiveDiagramType, renderContent]);

  useEffect(() => {
    if (effectiveDiagramType === 'slides' && renderContent) {
      try {
        const parsedSlides: Slide[] = JSON.parse(renderContent);
        setSlides(parsedSlides);
        setCurrentSlideIndex(0);
      } catch (error) {
        console.error('Error parsing slide JSON:', error);
        setSlides([]);
        toast.error('Failed to parse slide content. Invalid JSON format.');
      }
    } else {
      setSlides([]);
    }
  }, [effectiveDiagramType, renderContent]);

  const goToNextSlide = useCallback(() => {
    setCurrentSlideIndex(prev => Math.min(slides.length - 1, prev + 1));
  }, [slides.length]);

  const goToPreviousSlide = useCallback(() => {
    setCurrentSlideIndex(prev => Math.max(0, prev - 1));
  }, [slides.length]);

  useEffect(() => {
    if (!renderContent || !containerRef.current) return;

    const container = containerRef.current;
    container.innerHTML = '';

    if (effectiveDiagramType === 'html' || effectiveDiagramType === 'mermaid' || effectiveDiagramType === 'slides' || effectiveDiagramType === 'threejs') {
      return;
    }

    const renderGraphviz = async () => {
      try {
        const graphviz = await import('@hpcc-js/wasm').then(m => m.Graphviz.load());
        const svg = graphviz.layout(renderContent, 'svg', 'dot');
        container.innerHTML = svg;
      } catch (error: any) {
        console.error('Graphviz rendering error:', error);
        container.innerHTML = `<div class="text-red-500 dark:text-red-400">DOT render error.</div>`;
        onMermaidError(renderContent, 'rendering');
      }
    };

    const renderChartjs = () => {
      try {
        const canvas = document.createElement('canvas');
        if (isInteractiveContent) {
          canvas.style.width = '100%';
          canvas.style.height = '100%';
        }
        container.appendChild(canvas);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const chartData = JSON.parse(renderContent);
          new Chart(ctx, chartData);
        }
      } catch (error: any) {
        console.error('Chart.js rendering error:', error);
        container.innerHTML = `<div class="text-red-500 dark:text-red-400">Chart.js render error. Invalid JSON or chart configuration.</div>`;
        onMermaidError(renderContent, 'rendering');
      }
    };

    const renderCode = () => {
      // Clear container
      container.innerHTML = '';

      // Create a wrapper div for the code block
      const wrapper = document.createElement('div');
      wrapper.className = 'relative w-full h-full overflow-auto modern-scrollbar';

      // Create a container for the syntax highlighter
      const codeContainer = document.createElement('div');
      codeContainer.className = 'relative bg-white dark:bg-gray-900 w-full box-border';
      wrapper.appendChild(codeContainer);

      // Render the SyntaxHighlighter component into the container
      const root = ReactDOMClient.createRoot(codeContainer);
      root.render(
        <SyntaxHighlighter
          language={language || 'text'}
          style={vscDarkPlus}
          showLineNumbers={true}
          wrapLines={true}
          customStyle={{
            margin: 0,
            padding: '0.75rem 1rem',
            fontSize: '0.875rem',
            lineHeight: '1.5',
            background: 'transparent',
            borderRadius: '0 0 0.375rem 0.375rem',
          }}
          codeTagProps={{
            className: 'font-mono text-gray-800 dark:text-gray-100',
          }}
        >
          {renderContent}
        </SyntaxHighlighter>
      );

      container.appendChild(wrapper);
    };

    const renderPlainText = () => {
      const plainTextStyle = `
.text-block-wrapper {
  position: relative;
  counter-reset: line;
  padding-left: 40px;
  background-color: #1e1e1e;
  color: #d4d4d4;
  font-family: sans-serif;
  font-size: 0.875rem;
  line-height: 1.4;
  width: 100%;
  height: 100%;
  overflow-x: auto;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-all;
  word-wrap: break-word;
  -webkit-overflow-scrolling: touch;
  border-radius: 8px;
  border: 1px solid #3c3c3c;
  box-sizing: border-box;
  padding-top: 1rem;
  padding-bottom: 1rem;
  min-width: 0;
  flex-shrink: 0;
}

.text-block-wrapper .text-line {
  position: relative;
  display: block;
  min-height: 1.4em;
  padding-right: 1rem;
  padding-left: 0.5rem;
}

.text-block-wrapper .text-line::before {
  content: counter(line);
  counter-increment: line;
  position: absolute;
  left: -40px;
  width: 30px;
  text-align: right;
  padding-right: 10px;
  color: #858585;
  font-size: 0.85em;
  line-height: inherit;
  display: inline-block;
  pointer-events: none;
  user-select: none;
  box-sizing: border-box;
}
`;

      const styleElement = document.createElement('style');
      styleElement.textContent = plainTextStyle;
      container.appendChild(styleElement);

      const pre = document.createElement('pre');
      pre.className = `text-block-wrapper modern-scrollbar`;
      container.appendChild(pre);

      const lines = DOMPurify.sanitize(renderContent).split('\n');
      const numberedHtml = lines.map(line => `<div class="text-line">${line || '&nbsp;'}</div>`).join('');
      pre.innerHTML = numberedHtml;
    };

    switch (effectiveDiagramType) {
      case 'dot':
        renderGraphviz();
        break;
      case 'chartjs':
        renderChartjs();
        break;
      case 'code':
        renderCode();
        break;
      case 'image':
        container.innerHTML = `<img src="${imageUrl}" alt="Generated Image" className="max-w-full h-auto object-contain rounded-lg shadow-md mx-auto" onerror="this.onerror=null;this.src='https://placehold.co/400x300/e0e0e0/555555?text=Image+Load+Error';" />`;
        break;
      case 'document-text':
      case 'unknown':
        renderPlainText();
        break;
      default:
        break;
    }
  }, [effectiveDiagramType, renderContent, imageUrl, onMermaidError, language, isInteractiveContent, slides.length]);

  const startResizing = useCallback((e: React.MouseEvent) => {
    setIsResizing(true);
    e.preventDefault();
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizing(false);
    localStorage.setItem('diagramPanelWidth', panelWidth.toString());
  }, [panelWidth]);

  const resizePanel = useCallback((e: MouseEvent) => {
    if (isResizing && containerRef.current) {
      const newWidth = window.innerWidth - e.clientX;
      const percentage = (newWidth / window.innerWidth) * 100;
      setPanelWidth(Math.max(30, Math.min(70, percentage)));
    }
  }, [isResizing]);

  useEffect(() => {
    window.addEventListener('mousemove', resizePanel);
    window.addEventListener('mouseup', stopResizing);
    return () => {
      window.removeEventListener('mousemove', resizePanel);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [resizePanel, stopResizing]);

  const handleZoom = useCallback((delta: number) => {
    setZoomLevel(prev => Math.max(0.1, Math.min(5, prev + delta)));
  }, []);

  const startDragging = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    lastMousePos.current = { x: e.clientX, y: e.clientY };
  }, []);

  const dragContent = useCallback((e: MouseEvent) => {
    if (isDragging) {
      const dx = e.clientX - lastMousePos.current.x;
      const dy = e.clientY - lastMousePos.current.y;
      setPanOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      lastMousePos.current = { x: e.clientX, y: e.clientY };
    }
  }, [isDragging]);

  const stopDragging = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isInteractiveContent) {
      window.addEventListener('mousemove', dragContent);
      window.addEventListener('mouseup', stopDragging);
    }
    return () => {
      window.removeEventListener('mousemove', dragContent);
      window.removeEventListener('mouseup', stopDragging);
    };
  }, [dragContent, stopDragging, isInteractiveContent]);

  const downloadContent = useCallback(() => {
    if (!renderContent) {
      toast.error('No content to download.');
      return;
    }

    let filename = `diagram-${effectiveDiagramType}`;
    let blob: Blob | null = null;
    let mimeType = 'text/plain';

    switch (effectiveDiagramType) {
      case 'mermaid':
      case 'dot':
      case 'chartjs':
      case 'code':
      case 'html':
      case 'threejs':
      case 'document-text':
      case 'slides':
        blob = new Blob([renderContent], { type: 'text/plain;charset=utf-8' });
        filename += `.${language || 'txt'}`;
        break;
      case 'image':
        if (imageUrl) {
          fetch(imageUrl)
            .then(response => response.blob())
            .then(imageBlob => {
              const url = window.URL.createObjectURL(imageBlob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `image-${Date.now()}.png`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              window.URL.revokeObjectURL(url);
              toast.success('Image downloaded!');
            })
            .catch(error => {
              console.error('Error downloading image:', error);
              toast.error('Failed to download image.');
            });
          return;
        }
        break;
      default:
        toast.error('Unsupported content type for download.');
        return;
    }

    if (blob) {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success('Content downloaded!');
    }
  }, [effectiveDiagramType, renderContent, imageUrl, language]);

  const exportPdf = useCallback(async () => {
    if (!containerRef.current && effectiveDiagramType !== 'slides' && effectiveDiagramType !== 'threejs') {
      toast.error('No content to export.');
      return;
    }

    try {
      toast.info('Generating PDF...');
      let targetElement: HTMLElement | null;

      if (effectiveDiagramType === 'mermaid' && mermaidIframeRef.current) {
        targetElement = mermaidIframeRef.current.contentDocument?.body;
      } else if (effectiveDiagramType === 'html' && htmlIframeRef.current) {
        targetElement = htmlIframeRef.current.contentDocument?.body;
      } else if (effectiveDiagramType === 'slides') {
        targetElement = document.getElementById('current-slide-content');
      } else if (effectiveDiagramType === 'threejs' && threeJsCanvasRef.current) {
        targetElement = threeJsCanvasRef.current;
      } else {
        targetElement = containerRef.current;
      }

      if (!targetElement) {
        toast.error('Content element not found for PDF export.');
        return;
      }

      const canvas = await html2canvas(targetElement, {
        useCORS: true,
        scale: 2,
        logging: false,
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: canvas.width > canvas.height ? 'l' : 'p',
        unit: 'px',
        format: [canvas.width, canvas.height],
      });
      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
      pdf.save(`diagram-${effectiveDiagramType}.pdf`);
      toast.success('PDF exported successfully!');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Failed to generate PDF. Please try again.');
    }
  }, [effectiveDiagramType]);

  const mobileFullScreen = isPhone();

  return (
    <motion.div
      className={`relative flex flex-col h-full bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700
        ${mobileFullScreen
          ? 'fixed inset-0 z-[60] w-full h-full border-l-0'
          : 'flex-shrink-0 w-full md:flex-shrink-0'
        }
        ${isResizing ? 'cursor-ew-resize' : ''} panel-transition`}
      initial={{ x: '50%', opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: '50%', opacity: 0 }}
      transition={{
        duration: 0.2,
        ease: [0.25, 0.46, 0.45, 0.94]
      }}
      style={{
        width: mobileFullScreen ? '100%' : `${panelWidth}%`,
        zIndex: mobileFullScreen ? 60 : 20,
      }}
    >
      {!isFullScreen && !mobileFullScreen && (
        <div
          className="absolute left-0 top-0 h-full w-2 cursor-ew-resize -ml-1 z-30"
          onMouseDown={startResizing}
          title="Resize panel"
        >
          <div className="bg-blue-500 h-full w-0.5 mx-auto rounded-full opacity-0 hover:opacity-100 transition-opacity" />
        </div>
      )}

      <div className="flex items-center justify-between p-3 sm:p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0 bg-gray-50 dark:bg-gray-800">
        <div className="flex items-center gap-2">
          <Eye className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100 font-claude">Preview</h2>
          {effectiveDiagramType === 'code' && language && (
            <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 font-claude">
              {language.toUpperCase()}
            </Badge>
          )}
          {effectiveDiagramType === 'slides' && slides.length > 0 && (
            <Badge variant="secondary" className="bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 font-claude">
              Slide {currentSlideIndex + 1} / {slides.length}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          {effectiveDiagramType === 'slides' && slides.length > 1 && (
            <>
              <Button
                variant="ghost"
                size="icon"
                onClick={goToPreviousSlide}
                disabled={currentSlideIndex === 0}
                title="Previous Slide"
                className="h-8 w-8 sm:h-9 sm:w-9 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={goToNextSlide}
                disabled={currentSlideIndex === slides.length - 1}
                title="Next Slide"
                className="h-8 w-8 sm:h-9 sm:w-9 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </>
          )}
          {isInteractiveContent && (
            <>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setZoomLevel(prev => prev * 1.1)}
                title="Zoom In"
                className="h-8 w-8 sm:h-9 sm:w-9 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setZoomLevel(prev => prev / 1.1)}
                title="Zoom Out"
                className="h-8 w-8 sm:h-9 sm:w-9 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setPanOffset({ x: 0, y: 0 })}
                title="Reset Pan"
                className="h-8 w-8 sm:h-9 sm:w-9 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
              >
                <Hand className="h-4 w-4" />
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={downloadContent}
            title="Download Content"
            className="h-8 w-8 sm:h-9 sm:w-9 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
          >
            <Download className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={exportPdf}
            title="Export as PDF"
            className="h-8 w-8 sm:h-9 sm:w-9 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
          >
            <FileCode className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsFullScreen(!isFullScreen)}
            title={isFullScreen ? "Exit Fullscreen" : "Fullscreen"}
            className="h-8 w-8 sm:h-9 sm:w-9 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
          >
            {isFullScreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            title="Close Panel"
            className="h-8 w-8 sm:h-9 sm:w-9 text-gray-500 hover:bg-red-100 dark:hover:bg-red-900 dark:text-gray-400 dark:hover:text-red-400"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div
        className={`flex-1 modern-scrollbar relative flex ${isInteractiveContent ? 'items-center justify-center' : 'flex-col'} overflow-hidden
${isInteractiveContent ? 'cursor-grab' : ''}
${isInteractiveContent && isDragging ? 'cursor-grabbing' : ''}
`}
        onMouseDown={isInteractiveContent ? startDragging : undefined}
        onMouseUp={isInteractiveContent ? stopDragging : undefined}
        onMouseLeave={isInteractiveContent ? stopDragging : undefined}
        onWheel={isInteractiveContent ? ((e) => {
          e.preventDefault();
          handleZoom(e.deltaY * -0.001);
        }) : undefined}
      >
        <div
          ref={innerContentWrapperRef}
          className="w-full h-full flex items-center justify-center"
          style={isInteractiveContent ? {
            transform: `scale(${zoomLevel}) translate(${panOffset.x}px, ${panOffset.y}px)`,
            transformOrigin: 'center center',
          } : {}}
        >
          <ErrorBoundary>
            {effectiveDiagramType === 'html' ? (
              <iframe
                ref={htmlIframeRef}
                title="HTML Preview"
                className="w-full h-full bg-white dark:bg-gray-900 border-none rounded-lg shadow-inner"
                style={{ minHeight: '300px' }}
                sandbox="allow-scripts allow-same-origin"
              />
            ) : effectiveDiagramType === 'mermaid' ? (
              <iframe
                ref={mermaidIframeRef}
                title="Mermaid Diagram Preview"
                className="w-full h-full bg-white dark:bg-gray-900 border-none rounded-lg shadow-inner"
                style={{ minHeight: '300px' }}
                sandbox="allow-scripts allow-same-origin"
              />
            ) : effectiveDiagramType === 'slides' ? (
              slides.length > 0 && currentSlideIndex < slides.length ? (
                <div
                  id="current-slide-content"
                  className="w-full h-full flex flex-col items-center justify-center p-8 bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-gray-700 dark:to-gray-800 text-gray-900 dark:text-gray-100 rounded-lg shadow-xl overflow-auto"
                  style={{ minHeight: '300px' }}
                >
                  <h2 className="text-3xl sm:text-4xl font-bold mb-6 text-blue-800 dark:text-blue-300 text-center font-claude">
                    {slides[currentSlideIndex].title}
                  </h2>
                  {Array.isArray(slides[currentSlideIndex].content) ? (
                    <ul className="list-disc list-inside text-lg sm:text-xl space-y-3 px-4 font-claude max-w-full overflow-auto">
                      {slides[currentSlideIndex].content.map((item, i) => (
                        <li key={i} className="mb-2">
                          <ReactMarkdown>{item}</ReactMarkdown>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="prose dark:prose-invert text-lg sm:text-xl text-center font-claude max-w-full overflow-auto">
                      <ReactMarkdown>{slides[currentSlideIndex].content}</ReactMarkdown>
                    </div>
                  )}
                </div>
              ) : (
                <div>No slides available.</div>
              )
            ) : effectiveDiagramType === 'threejs' ? (
              <div className="w-full h-full">
                <canvas ref={threeJsCanvasRef} style={{ width: '100%', height: '100%', backgroundColor: '#282c34' }} />
                {threeJsError && <div className="text-red-500 dark:text-red-400">{threeJsError}</div>}
                <ThreeJSRenderer
                  codeContent={renderContent}
                  canvasRef={threeJsCanvasRef}
                  onInvalidCode={setThreeJsError}
                  onSceneReady={onSceneReady}
                />
              </div>
            ) : (
              <div
                ref={containerRef}
                className={isInteractiveContent ? "w-full h-full flex items-center justify-center" : "w-full h-full flex flex-col items-center"}
              />
            )}
          </ErrorBoundary>
        </div>
      </div>

      <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
        <div className="flex items-center gap-4">
          <span>Type: {effectiveDiagramType}</span>
          {language && <span>Lang: {language}</span>}
          {diagramContent && (
            <span>
              Size: {(new Blob([diagramContent]).size / 1024).toFixed(1)}KB
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isInteractiveContent && zoomLevel !== 1 && (
            <span>Zoom: {Math.round(zoomLevel * 100)}%</span>
          )}
          {isInteractiveContent && (
            <div className="flex items-center">
              <MousePointer className="h-3 w-3 mr-1" />
              <span className="hidden sm:inline">Interactive</span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
});