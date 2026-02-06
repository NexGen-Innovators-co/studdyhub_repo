// DiagramPanel.tsx
import React, { useRef, useEffect, useState, useCallback, memo, useMemo, MutableRefObject, Dispatch, SetStateAction } from 'react';
import { motion } from 'framer-motion';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../ui/dropdown-menu";
import {
  X, Download, Maximize2, Minimize2, Eye, FileCode,
  ChevronLeft, ChevronRight, MousePointer, Image as ImageIcon, FileText
} from 'lucide-react';
import { toast } from 'sonner';
import * as THREE from 'three';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import ErrorBoundary from '../../layout/ErrorBoundary';
import { HtmlRenderer } from './HtmlRenderer';
import { MermaidRenderer } from './MermaidRenderer';
import { SlidesRenderer, Slide } from './SlidesRenderer';
import { ThreeJsRenderer } from './ThreeJsRenderer';
import { DotRenderer } from './DotRenderer';
import { ChartJsRenderer } from './ChartJsRenderer';
import { CodeRenderer } from './CodeRenderer';
import { ImageRenderer } from './ImageRenderer';
import { PlainTextRenderer } from './PlainTexRenderer';
import {MemoizedMarkdownRenderer } from './MarkdownRenderer';
import DocumentMarkdownRenderer from './DocumentMarkdownRenderer';


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
  currentTheme: 'light' | 'dark';
  panelWidth?: number;
  setPanelWidth?: React.Dispatch<React.SetStateAction<number>>;
}

interface ThreeJSRendererProps {
  codeContent: string | undefined;
  canvasRef: MutableRefObject<HTMLCanvasElement | null>;
  onInvalidCode: Dispatch<SetStateAction<string | null>>;
  onSceneReady: (scene: THREE.Scene, renderer: THREE.WebGLRenderer, cleanup: () => void) => void;
}

/**
 * Robustly parse slide JSON content. Handles:
 * - Complete JSON arrays: [{ ... }, { ... }]
 * - Unwrapped objects (no outer brackets): { ... }, { ... }
 * - Fence markers from markdown: ```slides ... ```
 * - Single slide object: { "title": "...", "content": "..." }
 */
function parseSlides(raw: string): Slide[] {
  // Strip markdown fence markers
  let text = raw
    .replace(/^```\w*\n?/, '')
    .replace(/\n?```\s*$/, '')
    .trim();

  // Attempt 1: direct JSON.parse (handles well-formed arrays)
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].title) return parsed;
    if (parsed && typeof parsed === 'object' && parsed.title) return [parsed];
  } catch { /* continue */ }

  // Attempt 2: wrap in brackets (handles unwrapped comma-separated objects)
  try {
    const wrapped = JSON.parse(`[${text}]`);
    if (Array.isArray(wrapped) && wrapped.length > 0 && wrapped[0].title) return wrapped;
  } catch { /* continue */ }

  // Attempt 3: balance braces then retry
  try {
    const balanced = balanceSlideBraces(text);
    const parsed = JSON.parse(balanced);
    if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].title) return parsed;
  } catch { /* continue */ }

  // Attempt 4: wrap balanced text in brackets
  try {
    const balanced = balanceSlideBraces(text);
    const wrapped = JSON.parse(`[${balanced}]`);
    if (Array.isArray(wrapped) && wrapped.length > 0 && wrapped[0].title) return wrapped;
  } catch { /* continue */ }

  // Attempt 5: regex extract individual JSON objects with "title" and "content"
  try {
    const objectPattern = /\{[^{}]*"title"\s*:\s*"[^"]*"[^{}]*"content"\s*:\s*"[^"]*(?:\\.[^"]*)*"[^{}]*\}/g;
    const matches = text.match(objectPattern);
    if (matches && matches.length > 0) {
      const slides: Slide[] = [];
      for (const m of matches) {
        try {
          const obj = JSON.parse(m);
          if (obj.title) slides.push(obj);
        } catch { /* skip bad object */ }
      }
      if (slides.length > 0) return slides;
    }
  } catch { /* continue */ }

  return [];
}

/** Balance unmatched braces/brackets in slide JSON text */
function balanceSlideBraces(text: string): string {
  let opens = 0;
  let squareOpens = 0;
  for (const ch of text) {
    if (ch === '{') opens++;
    else if (ch === '}') opens--;
    else if (ch === '[') squareOpens++;
    else if (ch === ']') squareOpens--;
  }
  let result = text;
  // Prepend missing openers
  while (opens < 0) { result = '{' + result; opens++; }
  while (squareOpens < 0) { result = '[' + result; squareOpens++; }
  // Append missing closers
  while (opens > 0) { result = result + '}'; opens--; }
  while (squareOpens > 0) { result = result + ']'; squareOpens--; }
  return result;
}

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
  isPhone,
  currentTheme,
  panelWidth: externalPanelWidth,
  setPanelWidth: externalSetPanelWidth
}: DiagramPanelProps) => {
  // Use external props if provided, otherwise use local state
  const [internalPanelWidth, setInternalPanelWidth] = useState(initialWidthPercentage);
  const panelWidth = externalPanelWidth !== undefined ? externalPanelWidth : internalPanelWidth;
  const setPanelWidth = externalSetPanelWidth || setInternalPanelWidth;

  const [isResizing, setIsResizing] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const lastMousePos = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const resizeStartX = useRef<number>(0);
  const resizeStartWidth = useRef<number>(0);
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
  const [diagramError, setDiagramError] = useState<string | null>(null);
  const [faultyCode, setFaultyCode] = useState<string | null>(null);

  const renderContent = useMemo(() => liveContent || diagramContent, [liveContent, diagramContent]);

  // Reset errors when content changes
  useEffect(() => {
    setDiagramError(null);
    setFaultyCode(null);
  }, [renderContent, diagramType]);

  const handleDiagramError = useCallback((code: string | null, errorMessage: string) => {
    // Stringify objects that were coerced to "[object Object]"
    const msg = (typeof errorMessage === 'object' && errorMessage !== null)
      ? ((errorMessage as any).message || JSON.stringify(errorMessage))
      : errorMessage;

    // Skip non-informative errors — keep the first meaningful one
    if (!msg || msg === '[object Object]' || msg === 'undefined' || msg === 'null') {
      // console.warn('[DiagramPanel] Skipping non-informative error:', errorMessage);
      return;
    }

    // console.error('[DiagramPanel] Rendering error:', { errorMessage: msg, diagramType, codeSnippet: code?.slice(0, 200) });
    setDiagramError(prev => prev || msg); // Keep the first meaningful error, don't overwrite
    setFaultyCode(prev => prev || code);
    toast.error('Diagram rendering error detected.');
  }, [diagramType]);

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

  const handleFixDiagram = useCallback(() => {
    if (!diagramError || !faultyCode) return;

    let repairPrompt = '';
    const codeBlockType = effectiveDiagramType === 'chartjs' ? 'json' : effectiveDiagramType;

    if (effectiveDiagramType === 'mermaid') {
      repairPrompt = `The Mermaid diagram you generated has a syntax error: "${diagramError}". 
    
    Faulty code:
    \`\`\`mermaid
    ${faultyCode}
    \`\`\`
    
    Please fix the syntax error and provide the corrected Mermaid diagram code within a mermaid code block.`;
    } else if (effectiveDiagramType === 'chartjs') {
       repairPrompt = `The Chart.js configuration you generated has an error: "${diagramError}".
        
    Faulty configuration:
    \`\`\`json
    ${faultyCode}
    \`\`\`
    
    Please fix the error and provide the corrected Chart.js configuration within a chartjs code block. ensure it is valid JSON.`;
    } else {
        // Generic fallback
         repairPrompt = `The ${effectiveDiagramType} code you generated has an error: "${diagramError}".
        
    Faulty code:
    \`\`\`${codeBlockType}
    ${faultyCode}
    \`\`\`
    
    Please fix the error and provide the corrected code within a ${effectiveDiagramType} code block.`;
    }

    onSuggestAiCorrection(repairPrompt);
    toast.info('Sending repair request to AI...');
  }, [diagramError, faultyCode, onSuggestAiCorrection, effectiveDiagramType]);

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

  const handleNodeClick = useCallback((nodeId: string) => {
    toast.success(`Node ${nodeId} clicked`);
  }, []);

  // Resize handlers
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    resizeStartX.current = e.clientX;
    resizeStartWidth.current = panelWidth;
  }, [panelWidth]);

  // Throttle resize updates to reduce re-renders
  const throttledSetPanelWidth = useCallback((newWidth: number) => {
    setPanelWidth(newWidth);
  }, [setPanelWidth]);

  const handleResizeMove = useCallback((e: MouseEvent) => {
    const deltaX = resizeStartX.current - e.clientX;
    const windowWidth = window.innerWidth;
    const deltaPercent = (deltaX / windowWidth) * 100;
    const newWidth = Math.min(Math.max(resizeStartWidth.current + deltaPercent, 30), 90);

    // Update immediately for smooth visual feedback
    throttledSetPanelWidth(newWidth);
  }, [throttledSetPanelWidth]);

  const handleResizeEnd = useCallback(() => {
    setIsResizing(false);
    // Save to localStorage only when done resizing
    localStorage.setItem('diagramPanelWidth', panelWidth.toString());
  }, [panelWidth]);

  useEffect(() => {
    // Don't attach resize listeners on mobile
    if (isResizing && !isPhone()) {
      const handleMove = (e: MouseEvent) => {
        const deltaX = resizeStartX.current - e.clientX;
        const windowWidth = window.innerWidth;
        const deltaPercent = (deltaX / windowWidth) * 100;
        const newWidth = Math.min(Math.max(resizeStartWidth.current + deltaPercent, 30), 90);
        setPanelWidth(newWidth);
      };

      const handleUp = () => {
        setIsResizing(false);
        localStorage.setItem('diagramPanelWidth', panelWidth.toString());
      };

      document.addEventListener('mousemove', handleMove);
      document.addEventListener('mouseup', handleUp);
      document.body.style.cursor = 'ew-resize';
      document.body.style.userSelect = 'none';

      return () => {
        document.removeEventListener('mousemove', handleMove);
        document.removeEventListener('mouseup', handleUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }
  }, [isResizing, isPhone, setPanelWidth, panelWidth]);

  useEffect(() => {
    if (effectiveDiagramType === 'slides' && renderContent) {
      const parsed = parseSlides(renderContent);
      if (parsed.length > 0) {
        setSlides(parsed);
        setCurrentSlideIndex(0);
      } else {
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
    window.addEventListener('message', (event) => {
      if (event.data.type === 'nodeClick') {
        handleNodeClick(event.data.nodeId);
      }
    });
  }, [handleNodeClick]);

  // NOTE: Old DOM-based rendering useEffect removed — containerRef was never
  // attached to a DOM element so it always early-returned. All diagram types
  // now render via dedicated React components in JSX below.

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
              //console.error('Error downloading image:', error);
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

  const downloadSvg = useCallback(() => {
    let svg: SVGSVGElement | null = null;

    if (effectiveDiagramType === 'mermaid' && mermaidIframeRef.current) {
      const doc = mermaidIframeRef.current.contentDocument || mermaidIframeRef.current.contentWindow?.document;
      svg = doc?.querySelector('svg') || null;
    } else if (innerContentWrapperRef.current) {
      svg = innerContentWrapperRef.current.querySelector('svg');
    }

    if (svg) {
      const svgData = new XMLSerializer().serializeToString(svg);
      const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `diagram-${Date.now()}.svg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success('SVG downloaded!');
    } else {
      toast.error('Could not find SVG element. This diagram type might not support SVG export.');
    }
  }, [effectiveDiagramType]);

  const downloadPng = useCallback(async () => {
    try {
      toast.info('Generating PNG...');

      if (effectiveDiagramType === 'mermaid' && mermaidIframeRef.current) {
        // Handle Mermaid iframe capture
        const doc = mermaidIframeRef.current.contentDocument || mermaidIframeRef.current.contentWindow?.document;
        const svg = doc?.querySelector('svg');

        if (svg) {
          // Get SVG data
          const svgData = new XMLSerializer().serializeToString(svg);
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          const img = new Image();

          // Get dimensions from SVG or bounding box
          const bbox = svg.getBoundingClientRect();
          const width = bbox.width * 2; // Scale up for quality
          const height = bbox.height * 2;

          canvas.width = width;
          canvas.height = height;

          const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
          const url = URL.createObjectURL(svgBlob);

          img.crossOrigin = 'anonymous';
          img.onload = () => {
            if (ctx) {
              // Fill white background
              ctx.fillStyle = currentTheme === 'dark' ? '#282c34' : '#ffffff';
              ctx.fillRect(0, 0, width, height);
              ctx.drawImage(img, 0, 0, width, height);

              try {
                const pngUrl = canvas.toDataURL('image/png');
                const a = document.createElement('a');
                a.href = pngUrl;
                a.download = `diagram-${Date.now()}.png`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                toast.success('PNG downloaded!');
              } catch (e) {
                // console.error('Canvas export failed:', e);
                toast.error('Failed to export PNG. Security restriction.');
              }
              URL.revokeObjectURL(url);
            }
          };
          img.src = url;
          return;
        }
      }

      if (!innerContentWrapperRef.current) return;

      // Find the actual content element to capture
      let targetElement: HTMLElement = innerContentWrapperRef.current;

      const canvas = await html2canvas(targetElement, {
        useCORS: true,
        scale: 2, // Higher scale for better quality
        logging: false,
        backgroundColor: currentTheme === 'dark' ? '#111827' : '#ffffff',
        ignoreElements: (element) => element.classList.contains('exclude-from-capture')
      });

      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `diagram-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success('PNG downloaded!');
    } catch (error) {
      // console.error('Error generating PNG:', error);
      toast.error('Failed to generate PNG.');
    }
  }, [currentTheme, effectiveDiagramType]);

  const exportPdf = useCallback(async () => {
    if (!innerContentWrapperRef.current && effectiveDiagramType !== 'slides' && effectiveDiagramType !== 'threejs' && effectiveDiagramType !== 'mermaid') {
      toast.error('No content to export.');
      return;
    }
    try {
      toast.info('Generating PDF...');
      let targetElement: HTMLElement | null = null;

      if (effectiveDiagramType === 'mermaid' && mermaidIframeRef.current) {
        // For Mermaid, we need to capture the SVG from the iframe
        const doc = mermaidIframeRef.current.contentDocument || mermaidIframeRef.current.contentWindow?.document;
        const svg = doc?.querySelector('svg');

        if (svg) {
          // Similar to PNG export, we convert SVG to canvas first
          const svgData = new XMLSerializer().serializeToString(svg);
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          const img = new Image();

          const bbox = svg.getBoundingClientRect();
          const width = bbox.width * 2;
          const height = bbox.height * 2;

          canvas.width = width;
          canvas.height = height;

          const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
          const url = URL.createObjectURL(svgBlob);

          img.onload = () => {
            if (ctx) {
              ctx.fillStyle = '#ffffff'; // PDF usually white background
              ctx.fillRect(0, 0, width, height);
              ctx.drawImage(img, 0, 0, width, height);

              const imgData = canvas.toDataURL('image/png');
              const pdf = new jsPDF({
                orientation: width > height ? 'l' : 'p',
                unit: 'px',
                format: [width, height],
              });
              pdf.addImage(imgData, 'PNG', 0, 0, width, height);
              pdf.save(`diagram-${effectiveDiagramType}.pdf`);
              toast.success('PDF exported successfully!');
              URL.revokeObjectURL(url);
            }
          };
          img.src = url;
          return;
        }
      } else if (effectiveDiagramType === 'html' && htmlIframeRef.current) {
        targetElement = htmlIframeRef.current.contentDocument?.body || null;
      } else if (effectiveDiagramType === 'slides') {
        targetElement = document.getElementById('current-slide-content');
      } else if (effectiveDiagramType === 'threejs' && threeJsCanvasRef.current) {
        targetElement = threeJsCanvasRef.current;
      } else {
        targetElement = innerContentWrapperRef.current;
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
      // console.error('Error generating PDF:', error);
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
          className="absolute left-0 top-0 h-full w-3 cursor-ew-resize -ml-1.5 z-50 hover:bg-blue-100/30 dark:hover:bg-blue-900/30 transition-colors"
          title="Resize panel"
          onMouseDown={handleResizeStart}
        >
          <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-blue-500 h-16 w-0.5 rounded-full opacity-70" />
        </div>
      )}

      <div className="flex items-center justify-between p-3 sm:p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0 bg-gray-50 dark:bg-gray-800">
        <div className="flex items-center gap-2">
          {diagramError && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleFixDiagram}
              className="h-8 gap-1.5 border-red-200 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40"
            >
              <FileCode className="h-3.5 w-3.5" />
              Fix {effectiveDiagramType} with AI
            </Button>
          )}
          <Eye className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100 font-claude">Preview</h2>
          {effectiveDiagramType === 'code' && language && (
            <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 font-claude">
              {language.toUpperCase()}
            </Badge>
          )}
          {effectiveDiagramType === 'slides' && slides.length > 0 && (
            <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 font-claude">
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

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                title="Download Options"
                className="h-8 w-8 sm:h-9 sm:w-9 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
              >
                <Download className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={downloadContent}>
                <FileCode className="mr-2 h-4 w-4" />
                <span>Download Source ({language || 'txt'})</span>
              </DropdownMenuItem>

              {(effectiveDiagramType === 'mermaid' || effectiveDiagramType === 'dot') && (
                <DropdownMenuItem onClick={downloadSvg}>
                  <ImageIcon className="mr-2 h-4 w-4" />
                  <span>Download SVG</span>
                </DropdownMenuItem>
              )}

              <DropdownMenuItem onClick={downloadPng}>
                <ImageIcon className="mr-2 h-4 w-4" />
                <span>Download PNG Image</span>
              </DropdownMenuItem>

              <DropdownMenuItem onClick={exportPdf}>
                <FileText className="mr-2 h-4 w-4" />
                <span>Export as PDF</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
`}
      >
        <div
          ref={innerContentWrapperRef}
          className="w-full h-full flex items-center justify-center"
        >
          <ErrorBoundary>
            {effectiveDiagramType === 'html' && (
              <HtmlRenderer htmlContent={renderContent} />
            )}
            {effectiveDiagramType === 'mermaid' && (
              <MermaidRenderer
                mermaidContent={renderContent}
                handleNodeClick={handleNodeClick}
                iframeRef={mermaidIframeRef}
                onMermaidError={(error, code) => handleDiagramError(code, error)}
              />
            )}
            {effectiveDiagramType === 'slides' && (
              <SlidesRenderer
                slides={slides}
                currentSlideIndex={currentSlideIndex}
                theme={currentTheme}
              />
            )}
            {effectiveDiagramType === 'threejs' && (
              <div className="w-full h-full">
                <canvas ref={threeJsCanvasRef} style={{ width: '100%', height: '100%', backgroundColor: '#282c34' }} />
                {diagramError && <div className="text-red-500 dark:text-red-400 p-4">{diagramError}</div>}
                <ThreeJsRenderer
                  codeContent={renderContent}
                  canvasRef={threeJsCanvasRef}
                  onInvalidCode={(msg: string | null) => {
                      if (msg) handleDiagramError(renderContent, msg);
                      else setDiagramError(null);
                  }}
                  onSceneReady={onSceneReady}
                />
              </div>
            )}
            {effectiveDiagramType === 'dot' && (
              <DotRenderer dotContent={renderContent} onMermaidError={(code, type, detail) => handleDiagramError(code, detail || `Graphviz Error: ${type}`)} />
            )}
            {effectiveDiagramType === 'chartjs' && (
              <ChartJsRenderer chartJsContent={renderContent} onMermaidError={(code, type, detail) => handleDiagramError(code, detail || `Chart.js Error: ${type}`)} isInteractiveContent={isInteractiveContent} />
            )}
            {effectiveDiagramType === 'code' && (
              <CodeRenderer codeContent={renderContent} language={language} />
            )}
            {effectiveDiagramType === 'image' && (
              <ImageRenderer imageUrl={imageUrl} />
            )}
            {(effectiveDiagramType === 'document-text' || effectiveDiagramType === 'unknown') && (
              // If content appears to be Markdown, render as Markdown, otherwise fallback to plain text
              (renderContent && /(^#{1,6}\s)|(^```)|(^-\s)|(^\*\s)|(^>\s)/m.test(renderContent)) ? (
                <DocumentMarkdownRenderer content={renderContent} />
              ) : (
                <PlainTextRenderer textContent={renderContent} />
              )
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
