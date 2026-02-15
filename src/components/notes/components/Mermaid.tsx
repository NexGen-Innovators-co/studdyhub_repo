import React, { useEffect, useRef, useState, useCallback } from 'react';
import { AlertTriangle, Copy, Check, Loader2, Wrench, Play, Code, Download, Eye, EyeOff, Info, ChevronDown, ChevronUp, ZoomIn, ZoomOut, Maximize, GripVertical, RefreshCw } from 'lucide-react';
import { Button } from '../../ui/button';

// Define the MermaidProps interface
interface MermaidProps {
  chart: string;
  onMermaidError: (code: string, errorType: 'syntax' | 'rendering') => void;
  onSuggestAiCorrection?: (prompt: string) => void;
  diagramRef: React.RefObject<HTMLDivElement>;
}

// Function to download SVG
const downloadSvg = (svgString: string, filename: string = 'mermaid-diagram') => {
  const blob = new Blob([svgString], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.svg`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// Function to download SVG as PNG
const downloadSvgAsPng = (svgString: string, filename: string = 'mermaid-diagram') => {
  try {
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svgString, 'image/svg+xml');
    const svgElement = svgDoc.documentElement;
    const svgSVGElement = svgElement as unknown as SVGSVGElement;
    const svgRect = svgSVGElement.getBoundingClientRect();
    const width = svgSVGElement.width?.baseVal?.value || svgRect.width || 800;
    const height = svgSVGElement.height?.baseVal?.value || svgRect.height || 600;

    svgSVGElement.setAttribute('width', width.toString());
    svgSVGElement.setAttribute('height', height.toString());
    svgSVGElement.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

    const serializer = new XMLSerializer();
    const svgData = serializer.serializeToString(svgSVGElement);
    const svgDataUrl = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = width * 2;
    canvas.height = height * 2;
    ctx!.scale(2, 2);
    ctx!.fillStyle = '#1f2937';
    ctx!.fillRect(0, 0, width, height);

    const img = new Image();
    img.onload = () => {
      try {
        ctx!.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          if (blob) {
            const downloadUrl = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = `${filename}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(downloadUrl);
          }
        }, 'image/png');
      } catch (error) {
        downloadSvg(svgString, filename);
      }
    };

    img.onerror = () => {
      downloadSvg(svgString, filename);
    };

    img.src = svgDataUrl;
  } catch (error) {
    downloadSvg(svgString, filename);
  }
};

const Mermaid: React.FC<MermaidProps> = ({ chart, onMermaidError, onSuggestAiCorrection, diagramRef }) => {
  const id = useRef(`mermaid-${Math.random().toString(36).substr(2, 9)}`);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isMermaidLoaded, setIsMermaidLoaded] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [shouldRender, setShouldRender] = useState(true); // Changed to true by default
  const [lastRenderedChart, setLastRenderedChart] = useState<string>('');
  const [showSourceCode, setShowSourceCode] = useState(false);
  const [sourceCodeCopied, setSourceCodeCopied] = useState(false);
  const renderTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // State for custom zoom and pan
  const [scale, setScale] = useState(1);
  const [translateX, setTranslateX] = useState(0);
  const [translateY, setTranslateY] = useState(0);
  const [isPanning, setIsPanning] = useState(false);
  const lastPanPosition = useRef({ x: 0, y: 0 });
  const [initialPinchDistance, setInitialPinchDistance] = useState<number | null>(null);
  const [initialPinchScale, setInitialPinchScale] = useState<number>(1);

  // State for expand/collapse and resizable height
  const [isDiagramExpanded, setIsDiagramExpanded] = useState(true);
  const [componentHeight, setComponentHeight] = useState(300);
  const isResizing = useRef(false);
  const initialResizeY = useRef(0);
  const initialComponentHeight = useRef(0);

  const getPinchDistance = (touch1: Touch, touch2: Touch) => {
    const dx = touch2.clientX - touch1.clientX;
    const dy = touch2.clientY - touch1.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(chart);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      //console.error('Failed to copy Mermaid code:', err);
    }
  };

  const copySourceCode = async () => {
    try {
      await navigator.clipboard.writeText(chart);
      setSourceCodeCopied(true);
      setTimeout(() => setSourceCodeCopied(false), 2000);
    } catch (err) {
      //console.error('Failed to copy source code:', err);
    }
  };

  const handleAiFixClick = useCallback(() => {
    const prompt = `The following Mermaid diagram code caused a rendering error. Please correct the syntax for a Mermaid diagram (it could be a sequence, flowchart, ER, or usecase diagram). Ensure there are no trailing spaces on any line, and that the code adheres strictly to Mermaid's syntax for a single diagram type.

\`\`\`mermaid
${chart}
\`\`\`

Here's the error message received: "${error}". Please provide only the corrected Mermaid code within a \`\`\`mermaid\`\`\` block.`;

    if (onSuggestAiCorrection) {
      onSuggestAiCorrection(prompt);
    }
  }, [chart, error, onSuggestAiCorrection]);

  const cleanupRender = useCallback(() => {
    if (renderTimeoutRef.current) {
      clearTimeout(renderTimeoutRef.current);
      renderTimeoutRef.current = null;
    }
  }, []);

  // Load Mermaid script
  useEffect(() => {
    const loadMermaidScript = () => {
      // Check if already loaded
      if ((window as any).mermaid) {
        setIsMermaidLoaded(true);
        return;
      }

      // Check if script is already being loaded
      const existingScript = document.querySelector('script[src*="mermaid"]');
      if (existingScript) {
        // Wait for existing script to load
        const checkMermaid = setInterval(() => {
          if ((window as any).mermaid) {
            clearInterval(checkMermaid);
            setIsMermaidLoaded(true);
          }
        }, 100);
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js';

      script.onload = () => {
        // Poll for mermaid to be available
        let attempts = 0;
        const checkMermaid = setInterval(() => {
          attempts++;
          if ((window as any).mermaid) {
            clearInterval(checkMermaid);
            setIsMermaidLoaded(true);
          } else if (attempts > 50) { // 5 seconds max wait
            clearInterval(checkMermaid);
            setError("Mermaid library loaded but not available");
          }
        }, 100);
      };

      script.onerror = () => {
        setError("Failed to load Mermaid library. Please check your network connection.");
        setIsMermaidLoaded(false);
      };

      document.head.appendChild(script);
    };

    loadMermaidScript();
  }, []);

  // Render diagram
  useEffect(() => {
    const renderDiagram = async () => {
      if (!isMermaidLoaded || !chart.trim() || isRendering) {
        return;
      }

      // Don't re-render if already rendered and chart hasn't changed
      if (svg && chart === lastRenderedChart) {
        return;
      }

      cleanupRender();
      setIsRendering(true);
      setError(null);

      try {
        const mermaid = (window as any).mermaid;
        if (!mermaid) {
          throw new Error("Mermaid library not available");
        }

        // Initialize mermaid with configuration only once
        await mermaid.initialize({
          startOnLoad: false,
          theme: 'dark',
          themeVariables: {
            primaryColor: '#3b82f6',
            primaryTextColor: '#e5e7eb',
            primaryBorderColor: '#2563eb',
            lineColor: '#9ca3af',
            secondaryColor: '#10b981',
            tertiaryColor: '#f59e0b',
          },
          flowchart: { useMaxWidth: true, htmlLabels: true },
          sequence: { useMaxWidth: true },
          gantt: { useMaxWidth: true },
          securityLevel: 'loose',
          suppressErrorRendering: true,
        });

        // Create a unique ID for each render
        const renderId = `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // Render with timeout
        const renderPromise = new Promise<any>((resolve, reject) => {
          renderTimeoutRef.current = setTimeout(() => {
            reject(new Error("Mermaid rendering timed out after 10 seconds."));
          }, 10000);

          try {
            mermaid.render(renderId, chart)
              .then((result: any) => {
                if (renderTimeoutRef.current) {
                  clearTimeout(renderTimeoutRef.current);
                  renderTimeoutRef.current = null;
                }
                resolve(result);
              })
              .catch((err: any) => {
                if (renderTimeoutRef.current) {
                  clearTimeout(renderTimeoutRef.current);
                  renderTimeoutRef.current = null;
                }
                reject(err);
              });
          } catch (syncError) {
            if (renderTimeoutRef.current) {
              clearTimeout(renderTimeoutRef.current);
              renderTimeoutRef.current = null;
            }
            reject(syncError);
          }
        });

        const result = await renderPromise;

        // Handle different return formats from mermaid.render
        let generatedSvg = '';
        if (typeof result === 'string') {
          generatedSvg = result;
        } else if (result && result.svg) {
          generatedSvg = result.svg;
        } else {
          //console.error('Unexpected mermaid render result:', result);
          throw new Error("Mermaid returned unexpected result format");
        }

        if (!generatedSvg || generatedSvg.trim() === '') {
          throw new Error("Mermaid rendered empty SVG");
        }

        ////console.log('Mermaid SVG generated, length:', generatedSvg.length);
        setSvg(generatedSvg);
        setLastRenderedChart(chart);

        // Update iframe with a slight delay to ensure state is updated
        setTimeout(() => {
          if (iframeRef.current) {
            const fullHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body { 
      margin: 0; 
      display: flex; 
      justify-content: center; 
      align-items: center; 
      min-height: 100vh;
      width: 100%;
      background: #1f2937;
      overflow: auto;
      padding: 20px;
    }
    .mermaid-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100%;
      width: 100%;
    }
    svg { 
      display: block;
      max-width: 100%; 
      height: auto;
      transform: translate(${translateX}px, ${translateY}px) scale(${scale}); 
      transform-origin: center;
      cursor: grab;
    }
    svg:active {
      cursor: grabbing;
    }
  </style>
</head>
<body>
  <div class="mermaid-container">
    ${generatedSvg}
  </div>
</body>
</html>`;

            const iframeDoc = iframeRef.current.contentDocument || iframeRef.current.contentWindow?.document;
            if (iframeDoc) {
              iframeDoc.open();
              iframeDoc.write(fullHtml);
              iframeDoc.close();

              // Log for debugging
              ////console.log('Iframe content updated');
            }
          }
        }, 50);
      } catch (e: any) {
        const errorMessage = e.message || "An unknown error occurred during rendering.";
        //console.error('Mermaid rendering error:', errorMessage, e);
        onMermaidError(chart, 'rendering');
        setError(errorMessage);
        setSvg(null);
      } finally {
        setIsRendering(false);
      }
    };

    if (isMermaidLoaded && chart.trim()) {
      // Add a small delay to ensure mermaid is fully ready
      const timer = setTimeout(() => {
        renderDiagram();
      }, 100);

      return () => {
        clearTimeout(timer);
        cleanupRender();
      };
    }

    return cleanupRender;
  }, [chart, isMermaidLoaded, onMermaidError, cleanupRender, translateX, translateY, scale, svg, lastRenderedChart, isRendering]);

  // Update iframe transform
  const updateIframeTransform = useCallback((newTranslateX: number, newTranslateY: number, newScale: number) => {
    if (iframeRef.current?.contentDocument) {
      const svgEl = iframeRef.current.contentDocument.querySelector('svg');
      if (svgEl) {
        svgEl.style.transform = `translate(${newTranslateX}px, ${newTranslateY}px) scale(${newScale})`;
      }
    }
  }, []);

  // Zoom handler
  const handleZoom = useCallback((event: WheelEvent) => {
    event.preventDefault();
    const scaleAmount = 0.1;
    const newScale = event.deltaY < 0 ? scale * (1 + scaleAmount) : scale * (1 - scaleAmount);
    const clampedScale = Math.max(0.1, Math.min(10, newScale));

    setScale(clampedScale);
    updateIframeTransform(translateX, translateY, clampedScale);
  }, [scale, translateX, translateY, updateIframeTransform]);

  const handleMouseDown = useCallback((event: React.MouseEvent<HTMLIFrameElement>) => {
    if (event.button === 0) {
      setIsPanning(true);
      lastPanPosition.current = { x: event.clientX, y: event.clientY };
    }
  }, []);

  const handleMouseMove = useCallback((event: React.MouseEvent<HTMLIFrameElement>) => {
    if (isPanning) {
      const deltaX = event.clientX - lastPanPosition.current.x;
      const deltaY = event.clientY - lastPanPosition.current.y;
      const newTranslateX = translateX + deltaX;
      const newTranslateY = translateY + deltaY;

      setTranslateX(newTranslateX);
      setTranslateY(newTranslateY);
      lastPanPosition.current = { x: event.clientX, y: event.clientY };
      updateIframeTransform(newTranslateX, newTranslateY, scale);
    }
  }, [isPanning, scale, translateX, translateY, updateIframeTransform]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  const handleZoomIn = useCallback(() => {
    const newScale = Math.min(10, scale * 1.2);
    setScale(newScale);
    updateIframeTransform(translateX, translateY, newScale);
  }, [scale, translateX, translateY, updateIframeTransform]);

  const handleZoomOut = useCallback(() => {
    const newScale = Math.max(0.1, scale / 1.2);
    setScale(newScale);
    updateIframeTransform(translateX, translateY, newScale);
  }, [scale, translateX, translateY, updateIframeTransform]);

  const handleResetView = useCallback(() => {
    setScale(1);
    setTranslateX(0);
    setTranslateY(0);
    updateIframeTransform(0, 0, 1);
  }, [updateIframeTransform]);

  // Resize handlers
  const handleResizeMouseDown = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    isResizing.current = true;
    initialResizeY.current = event.clientY;
    initialComponentHeight.current = componentHeight;
    document.body.style.cursor = 'ns-resize';

    const handleResizeMouseMove = (e: MouseEvent) => {
      if (isResizing.current) {
        const deltaY = e.clientY - initialResizeY.current;
        const newHeight = Math.max(200, initialComponentHeight.current + deltaY);
        setComponentHeight(newHeight);
      }
    };

    const handleResizeMouseUp = () => {
      isResizing.current = false;
      document.body.style.cursor = 'default';
      document.removeEventListener('mousemove', handleResizeMouseMove);
      document.removeEventListener('mouseup', handleResizeMouseUp);
    };

    document.addEventListener('mousemove', handleResizeMouseMove);
    document.addEventListener('mouseup', handleResizeMouseUp);
  }, [componentHeight]);

  // Attach wheel event
  useEffect(() => {
    const element = iframeRef.current;
    if (!element) return;

    element.addEventListener('wheel', handleZoom, { passive: false });
    return () => {
      element.removeEventListener('wheel', handleZoom);
    };
  }, [handleZoom]);

  if (!isMermaidLoaded) {
    return (
      <div className="my-4 p-4 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg flex items-center justify-center h-40">
        <Loader2 className="h-6 w-6 animate-spin text-blue-500 dark:text-blue-400 mr-2" />
        <span className="text-gray-600 dark:text-gray-300">Loading Mermaid library...</span>
      </div>
    );
  }

  if (isRendering) {
    return (
      <div className="my-4 p-4 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg flex items-center justify-center h-40">
        <Loader2 className="h-6 w-6 animate-spin text-blue-500 dark:text-blue-400 mr-2" />
        <span className="text-gray-600 dark:text-gray-300">Rendering diagram...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="my-4 p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            <span className="text-sm font-medium">Diagram Rendering Error</span>
          </div>
          <div className="flex gap-2">
            {onSuggestAiCorrection && (
              <Button
                size="sm"
                onClick={handleAiFixClick}
                className="bg-blue-600 dark:bg-blue-500 text-white hover:bg-blue-700 dark:hover:bg-blue-600 h-7 px-3 text-xs"
              >
                <Wrench className="h-3 w-3 mr-1" />
                AI Fix
              </Button>
            )}
          </div>
        </div>
        <p className="text-xs text-red-500 dark:text-red-400 mb-2">{error}</p>
        <pre className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 p-2 rounded overflow-x-auto">
          {chart}
        </pre>
      </div>
    );
  }

  return (
    <div className="my-4 p-3 sm:p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            Mermaid Diagram
          </span>
        </div>
        <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleZoomIn}
            className="h-7 px-2 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800"
            title="Zoom In"
          >
            <ZoomIn className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleZoomOut}
            className="h-7 px-2 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800"
            title="Zoom Out"
          >
            <ZoomOut className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleResetView}
            className="h-7 px-2 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800"
            title="Reset View"
          >
            <Maximize className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSourceCode(!showSourceCode)}
            className="h-7 px-2 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800"
          >
            {showSourceCode ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={copyCode}
            className="h-7 px-2 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800"
          >
            {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
          </Button>
          {svg && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => downloadSvg(svg)}
                className="h-7 px-2 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800"
              >
                <Download className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsDiagramExpanded(!isDiagramExpanded)}
                className="h-7 px-2 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800"
              >
                {isDiagramExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </Button>
            </>
          )}
        </div>
      </div>

      {showSourceCode && (
        <div className="mb-4 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">SOURCE CODE</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={copySourceCode}
              className="h-6 w-6 p-0"
            >
              {sourceCodeCopied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
            </Button>
          </div>
          <pre className="text-sm text-gray-600 dark:text-gray-300 overflow-x-auto">
            <code>{chart}</code>
          </pre>
        </div>
      )}

      {isDiagramExpanded && svg && (
        <>
          {/* Iframe rendering */}
          <div
            className="bg-gray-800 rounded-lg border border-gray-700 p-2 overflow-hidden relative"
            style={{ height: `${componentHeight}px`, minHeight: '300px' }}
            ref={diagramRef}
          >
            <div className="absolute top-2 left-2 z-10 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs px-2 py-1 rounded border border-blue-200 dark:border-blue-800">
              <span className="hidden sm:inline">Use mouse wheel to zoom, drag to pan</span>
              <span className="sm:hidden">Pinch to zoom, drag to pan</span>
            </div>
            <iframe
              ref={iframeRef}
              className="w-full h-full border-0 rounded-lg bg-gray-800"
              sandbox="allow-same-origin allow-scripts"
              title="Mermaid Diagram"
              style={{ cursor: isPanning ? 'grabbing' : 'grab', display: 'block' }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            />
            <div
              className="absolute bottom-0 left-0 right-0 h-3 flex items-center justify-center cursor-ns-resize text-gray-400 hover:text-gray-300 bg-gray-800/50"
              onMouseDown={handleResizeMouseDown}
            >
              <GripVertical className="h-4 w-4" />
            </div>
          </div>

          {/* Fallback: Direct SVG rendering (hidden, for debugging) */}
          <div
            className="hidden mt-4 p-4 bg-gray-800 rounded-lg border border-gray-700 overflow-auto"
            style={{ maxHeight: '400px' }}
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        </>
      )}
    </div>
  );
};

export default Mermaid;