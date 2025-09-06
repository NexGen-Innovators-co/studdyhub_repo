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

// Function to download SVG as PNG without canvas taint issues
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
    ctx!.fillStyle = '#1f2937'; // Dark background
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
        downloadSvg(svgString, filename); // Fallback to SVG download
      }
    };

    img.onerror = () => {
      downloadSvg(svgString, filename); // Fallback to SVG download
    };

    img.src = svgDataUrl;
  } catch (error) {
    downloadSvg(svgString, filename); // Fallback to SVG download
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
  const [shouldRender, setShouldRender] = useState(false);
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

  // Helper function to calculate distance between two touch points
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
      console.error('Failed to copy Mermaid code:', err);
    }
  };

  const copySourceCode = async () => {
    try {
      await navigator.clipboard.writeText(chart);
      setSourceCodeCopied(true);
      setTimeout(() => setSourceCodeCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy source code:', err);
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

  const triggerRender = useCallback(() => {
    if (chart.trim() && !isRendering) {
      try {
        // Validate syntax before triggering render
        const mermaid = (window as any).mermaid;
        if (!mermaid) {
          setError("Mermaid library not loaded yet");
          return;
        }
        mermaid.parse(chart);
        setShouldRender(true);
        setError(null);
      } catch (e: any) {
        const isSyntaxError = e.message.includes('Syntax error') || e.message.includes('Parse error');
        onMermaidError(chart, isSyntaxError ? 'syntax' : 'rendering');
        setError(isSyntaxError ? 'Syntax error detected. Check the code or use AI Fix.' : 'Rendering error detected.');
        setShouldRender(false);
        setSvg(null);
      }
    }
  }, [chart, isRendering, onMermaidError]);

  const cleanupRender = useCallback(() => {
    if (renderTimeoutRef.current) {
      clearTimeout(renderTimeoutRef.current);
      renderTimeoutRef.current = null;
    }
  }, []);

  // Load Mermaid script
  useEffect(() => {
    const loadMermaidScript = () => {
      if (isMermaidLoaded || (window as any).mermaid) {
        setIsMermaidLoaded(true);
        return;
      }

      // Try to load from the same origin first (using the installed package)
      const script = document.createElement('script');
      script.src = window.location.origin + '/node_modules/mermaid/dist/mermaid.min.js';
      script.onload = () => {
        if ((window as any).mermaid) {
          setIsMermaidLoaded(true);
        } else {
          setError("Mermaid library loaded but not available");
          setIsMermaidLoaded(false);
        }
      };
      script.onerror = () => {
        // Fallback to CDN if local loading fails
        const cdnScript = document.createElement('script');
        cdnScript.src = 'https://cdn.jsdelivr.net/npm/mermaid@11.9.0/dist/mermaid.min.js';
        cdnScript.onload = () => {
          if ((window as any).mermaid) {
            setIsMermaidLoaded(true);
          } else {
            setError("Mermaid library loaded but not available");
            setIsMermaidLoaded(false);
          }
        };
        cdnScript.onerror = () => {
          setError("Failed to load Mermaid library from both local and CDN. Please check your network connection.");
          setIsMermaidLoaded(false);
        };
        document.head.appendChild(cdnScript);
      };
      document.head.appendChild(script);
    };

    loadMermaidScript();
  }, [isMermaidLoaded]);

  // Render diagram in iframe
  useEffect(() => {
    const renderDiagram = async () => {
      if (!isMermaidLoaded || !iframeRef.current || !shouldRender || !chart.trim()) {
        return;
      }

      cleanupRender();

      setIsRendering(true);
      setError(null);

      try {
        const renderPromise = new Promise<any>((resolve, reject) => {
          renderTimeoutRef.current = setTimeout(() => {
            reject(new Error("Mermaid rendering timed out after 7 seconds."));
          }, 7000);

          const mermaid = (window as any).mermaid;
          if (!mermaid) {
            reject(new Error("Mermaid library not available"));
            return;
          }

          // Initialize mermaid with configuration
          mermaid.initialize({
            startOnLoad: false,
            theme: 'base',
            themeVariables: {
              primaryColor: '#3b82f6',
              primaryTextColor: '#e5e7eb',
              primaryBorderColor: '#2563eb',
              secondaryColor: '#10b981',
              tertiaryColor: '#f59e0b',
              background: '#1f2937',
              secondaryBackground: '#374151',
              tertiaryBackground: '#4b5563',
              mainBkg: '#3b82f6',
              secondBkg: '#10b981',
              tertiaryBkg: '#f59e0b',
              textColor: '#e5e7eb',
              secondaryTextColor: '#9ca3af',
              lineColor: '#9ca3af',
              arrowheadColor: '#e5e7eb',
              errorBkgColor: '#7f1d1d',
              errorTextColor: '#f87171',
              nodeBkg: '#374151',
              nodeBorder: '#3b82f6',
              clusterBkg: '#1f2937',
              clusterBorder: '#4b5563',
              actorBkg: '#374151',
              actorBorder: '#3b82f6',
              actorTextColor: '#e5e7eb',
              actorLineColor: '#9ca3af',
              signalColor: '#e5e7eb',
              signalTextColor: '#e5e7eb',
              labelBoxBkgColor: '#374151',
              labelBoxBorderColor: '#4b5563',
              labelTextColor: '#e5e7eb',
              loopTextColor: '#e5e7eb',
              noteBorderColor: '#d97706',
              noteBkgColor: '#78350f',
              noteTextColor: '#f59e0b'
            },
            flowchart: { useMaxWidth: true, htmlLabels: true, curve: 'basis' },
            sequence: { useMaxWidth: true, wrap: true },
            gantt: { useMaxWidth: true, leftPadding: 75, rightPadding: 20, topPadding: 50 },
            pie: { useMaxWidth: true },
            xyChart: { useMaxWidth: true },
            securityLevel: 'strict',
          });

          mermaid.render(
            'mermaid-chart-' + Date.now(),
            chart
          ).then(result => {
            if (renderTimeoutRef.current) {
              clearTimeout(renderTimeoutRef.current);
              renderTimeoutRef.current = null;
            }
            resolve(result);
          }).catch(err => {
            if (renderTimeoutRef.current) {
              clearTimeout(renderTimeoutRef.current);
              renderTimeoutRef.current = null;
            }
            reject(err);
          });
        });

        const { svg: generatedSvg, bindFunctions } = await renderPromise;
        setSvg(generatedSvg);
        setLastRenderedChart(chart);

        const fullHtml = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { 
      margin: 0; 
      display: flex; 
      justify-content: center; 
      align-items: center; 
      height: 100vh; 
      background: transparent; 
      overflow: hidden;
      user-select: none;
    }
    .mermaid-container {
      position: relative;
      width: 100%;
      height: 100%;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    svg { 
      max-width: 100%; 
      max-height: 100%; 
      transform: translate(${translateX}px, ${translateY}px) scale(${scale}); 
      transform-origin: center; 
      transition: transform 0.1s ease-out;
      cursor: grab;
    }
    svg:active {
      cursor: grabbing;
    }
    svg * {
      pointer-events: auto;
    }
  </style>
</head>
<body>
  <div class="mermaid-container">
    ${generatedSvg}
  </div>
</body>
</html>`;

        const iframeDoc = iframeRef.current!.contentDocument || iframeRef.current!.contentWindow?.document;
        if (iframeDoc) {
          iframeDoc.open();
          iframeDoc.write(fullHtml);
          iframeDoc.close();
          if (bindFunctions) {
            bindFunctions(iframeDoc.body);
          }
        }
      } catch (e: any) {
        // Only show errors for actual failures, not minor issues
        const errorMessage = e.message || "An unknown error occurred during rendering.";
        const isActualError = errorMessage.includes('Syntax error') ||
          errorMessage.includes('Parse error') ||
          errorMessage.includes('Failed to load') ||
          errorMessage.includes('rendered empty SVG') ||
          errorMessage.includes('Mermaid library not available');

        if (isActualError) {
          onMermaidError(chart, 'rendering');
          setError(errorMessage);
          setSvg(null);
        } else {
          // For minor issues, just log and continue
          console.warn('Mermaid minor issue:', errorMessage);
          setError(null);
        }
      } finally {
        setIsRendering(false);
      }
    };

    if (isMermaidLoaded && shouldRender) {
      renderDiagram();
    }

    return cleanupRender;
  }, [shouldRender, chart, isMermaidLoaded, onMermaidError, cleanupRender, translateX, translateY, scale]);

  // Trigger render on initial mount and when diagramRef changes
  useEffect(() => {
    if (!diagramRef.current) return;
    if (chart.trim() && !error) {
      triggerRender();
    }

    const resizeObserver = new ResizeObserver(entries => {
      for (let entry of entries) {
        if (entry.contentBoxSize && !isRendering && chart.trim()) {
          triggerRender();
        }
      }
    });

    resizeObserver.observe(diagramRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [diagramRef, chart, isRendering, triggerRender, error]);

  // Function to update iframe transform
  const updateIframeTransform = useCallback((newTranslateX: number, newTranslateY: number, newScale: number) => {
    if (iframeRef.current && iframeRef.current.contentDocument) {
      const svg = iframeRef.current.contentDocument.querySelector('svg');
      if (svg) {
        svg.style.transform = `translate(${newTranslateX}px, ${newTranslateY}px) scale(${newScale})`;
      }
    }
  }, []);

  // Custom Zoom and Pan Handlers (Mouse)
  const handleZoom = useCallback((event: WheelEvent) => {
    event.preventDefault();
    const scaleAmount = 0.1;
    const newScale = event.deltaY < 0 ? scale * (1 + scaleAmount) : scale * (1 - scaleAmount);
    const clampedScale = Math.max(0.1, Math.min(10, newScale));

    const rect = iframeRef.current!.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    const oldTranslateX = translateX;
    const oldTranslateY = translateY;

    const newTranslateX = mouseX - ((mouseX - oldTranslateX) * (clampedScale / scale));
    const newTranslateY = mouseY - ((mouseY - oldTranslateY) * (clampedScale / scale));

    setScale(clampedScale);
    setTranslateX(newTranslateX);
    setTranslateY(newTranslateY);

    // Update iframe content with new transform
    updateIframeTransform(newTranslateX, newTranslateY, clampedScale);
  }, [scale, translateX, translateY, updateIframeTransform]);

  const handleMouseDown = useCallback((event: React.MouseEvent<HTMLIFrameElement>) => {
    if (event.button === 0) {
      setIsPanning(true);
      lastPanPosition.current = { x: event.clientX, y: event.clientY };
      if (iframeRef.current) {
        iframeRef.current.style.cursor = 'grabbing';
      }
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

      // Update iframe content with new transform
      updateIframeTransform(newTranslateX, newTranslateY, scale);
    }
  }, [isPanning, scale, translateX, translateY, updateIframeTransform]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
    if (iframeRef.current) {
      iframeRef.current.style.cursor = 'grab';
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsPanning(false);
    if (iframeRef.current) {
      iframeRef.current.style.cursor = 'grab';
    }
  }, []);

  // Touch Handlers for Panning and Zooming
  const handleTouchStart = useCallback((event: TouchEvent) => {
    if (event.touches.length === 1) {
      // Single touch for panning
      setIsPanning(true);
      lastPanPosition.current = { x: event.touches[0].clientX, y: event.touches[0].clientY };
    } else if (event.touches.length === 2) {
      // Two touches for pinch-to-zoom
      event.preventDefault();
      const distance = getPinchDistance(event.touches[0], event.touches[1]);
      setInitialPinchDistance(distance);
      setInitialPinchScale(scale);
    }
  }, [scale]);

  const handleTouchMove = useCallback((event: TouchEvent) => {
    if (event.touches.length === 1 && isPanning) {
      // Single touch panning
      const deltaX = event.touches[0].clientX - lastPanPosition.current.x;
      const deltaY = event.touches[0].clientY - lastPanPosition.current.y;
      const newTranslateX = translateX + deltaX;
      const newTranslateY = translateY + deltaY;

      setTranslateX(newTranslateX);
      setTranslateY(newTranslateY);
      lastPanPosition.current = { x: event.touches[0].clientX, y: event.touches[0].clientY };

      // Update iframe content with new transform
      updateIframeTransform(newTranslateX, newTranslateY, scale);
    } else if (event.touches.length === 2) {
      // Pinch-to-zoom
      event.preventDefault();
      const distance = getPinchDistance(event.touches[0], event.touches[1]);
      if (initialPinchDistance !== null) {
        const newScale = initialPinchScale * (distance / initialPinchDistance);
        const clampedScale = Math.max(0.1, Math.min(10, newScale));
        setScale(clampedScale);

        // Adjust translation to zoom around pinch center
        const rect = iframeRef.current!.getBoundingClientRect();
        const pinchCenterX = (event.touches[0].clientX + event.touches[1].clientX) / 2 - rect.left;
        const pinchCenterY = (event.touches[0].clientY + event.touches[1].clientY) / 2 - rect.top;

        const oldTranslateX = translateX;
        const oldTranslateY = translateY;

        const newTranslateX = pinchCenterX - ((pinchCenterX - oldTranslateX) * (clampedScale / scale));
        const newTranslateY = pinchCenterY - ((pinchCenterY - oldTranslateY) * (clampedScale / scale));

        setTranslateX(newTranslateX);
        setTranslateY(newTranslateY);

        // Update iframe content with new transform
        updateIframeTransform(newTranslateX, newTranslateY, clampedScale);
      }
    }
  }, [isPanning, scale, initialPinchDistance, initialPinchScale, translateX, translateY, updateIframeTransform]);

  const handleTouchEnd = useCallback(() => {
    setIsPanning(false);
    setInitialPinchDistance(null);
    setInitialPinchScale(1);
  }, []);

  // Attach touch event listeners with passive: false
  useEffect(() => {
    const element = iframeRef.current;
    if (!element) return;

    element.addEventListener('touchstart', handleTouchStart, { passive: false });
    element.addEventListener('touchmove', handleTouchMove, { passive: false });
    element.addEventListener('touchend', handleTouchEnd, { passive: false });
    element.addEventListener('touchcancel', handleTouchEnd, { passive: false });
    element.addEventListener('wheel', handleZoom, { passive: false });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
      element.removeEventListener('touchcancel', handleTouchEnd);
      element.removeEventListener('wheel', handleZoom);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd, handleZoom]);

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

  // Resize Handlers
  const handleResizeMouseDown = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    isResizing.current = true;
    initialResizeY.current = event.clientY;
    initialComponentHeight.current = componentHeight;
    document.body.style.cursor = 'ns-resize';
    document.addEventListener('mousemove', handleResizeMouseMove);
    document.addEventListener('mouseup', handleResizeMouseUp);
  }, [componentHeight]);

  const handleResizeMouseMove = useCallback((event: MouseEvent) => {
    if (isResizing.current) {
      const deltaY = event.clientY - initialResizeY.current;
      const newHeight = Math.max(200, initialComponentHeight.current + deltaY);
      setComponentHeight(newHeight);
    }
  }, []);

  const handleResizeMouseUp = useCallback(() => {
    isResizing.current = false;
    document.body.style.cursor = 'default';
    document.removeEventListener('mousemove', handleResizeMouseMove);
    document.removeEventListener('mouseup', handleResizeMouseUp);
  }, [handleResizeMouseMove]);

  // Function to bind events to iframe content
  const bindIframeEvents = useCallback(() => {
    if (iframeRef.current && iframeRef.current.contentDocument) {
      const svg = iframeRef.current.contentDocument.querySelector('svg');
      if (svg) {
        // Add event listeners to the SVG element for better control
        svg.addEventListener('wheel', (e) => {
          e.preventDefault();
          const wheelEvent = new WheelEvent('wheel', {
            deltaY: e.deltaY,
            clientX: e.clientX,
            clientY: e.clientY
          });
          handleZoom(wheelEvent as any);
        }, { passive: false });

        // Add mouse events for panning
        svg.addEventListener('mousedown', (e) => {
          if (e.button === 0) {
            const mouseEvent = new MouseEvent('mousedown', {
              button: e.button,
              clientX: e.clientX,
              clientY: e.clientY
            });
            handleMouseDown(mouseEvent as any);
          }
        });

        svg.addEventListener('mousemove', (e) => {
          const mouseEvent = new MouseEvent('mousemove', {
            clientX: e.clientX,
            clientY: e.clientY
          });
          handleMouseMove(mouseEvent as any);
        });

        svg.addEventListener('mouseup', () => {
          handleMouseUp();
        });

        svg.addEventListener('mouseleave', () => {
          handleMouseLeave();
        });
      }
    }
  }, [handleZoom, handleMouseDown, handleMouseMove, handleMouseUp, handleMouseLeave]);

  // Bind events when iframe loads
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const handleIframeLoad = () => {
      setTimeout(() => {
        bindIframeEvents();
      }, 100);
    };

    iframe.addEventListener('load', handleIframeLoad);

    return () => {
      iframe.removeEventListener('load', handleIframeLoad);
    };
  }, [bindIframeEvents]);

  if (!isMermaidLoaded) {
    return (
      <div className="my-4 p-4 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg flex items-center justify-center h-40">
        <Loader2 className="h-6 w-6 animate-spin text-blue-500 dark:text-blue-400 mr-2" />
        <span className="text-gray-600 dark:text-gray-300">Loading diagram library...</span>
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
            <Info className="h-4 w-4" />
            <span className="text-sm font-medium">Diagram Issue</span>
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
            <Button
              variant="outline"
              size="sm"
              onClick={triggerRender}
              disabled={!!error && chart === lastRenderedChart}
              className="text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-700 h-7 px-3 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play className="h-3 w-3 mr-1" />
              Try Again
            </Button>
          </div>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">{error}</p>
      </div>
    );
  }

  if (!svg || chart !== lastRenderedChart) {
    return (
      <div className="my-4 p-3 sm:p-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Mermaid Diagram
            </span>
            {chart !== lastRenderedChart && svg && (
              <div className="flex items-center gap-1 text-xs bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-300 px-2 py-1 rounded">
                <AlertTriangle className="h-3 w-3" />
                <span className="hidden sm:inline">Changes detected</span>
              </div>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={copyCode}
            className="h-6 w-6 p-0 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800"
          >
            {copied ? <Check className="h-3 w-3 text-green-500 dark:text-green-400" /> : <Copy className="h-3 w-3" />}
          </Button>
        </div>
        <div className="flex items-center justify-center h-32 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-800">
          <div className="text-center px-4">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
              {!svg ? 'Click to render your Mermaid diagram' : 'Click to update diagram with changes'}
            </p>
            <Button
              onClick={triggerRender}
              disabled={!chart.trim()}
              className="bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play className="h-4 w-4 mr-2" />
              {!svg ? 'Render Diagram' : 'Update Diagram'}
            </Button>
          </div>
        </div>
        <div ref={diagramRef} style={{ display: 'none' }} />
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
            className="h-7 px-2 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 whitespace-nowrap"
            title="Zoom In"
          >
            <ZoomIn className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleZoomOut}
            className="h-7 px-2 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 whitespace-nowrap"
            title="Zoom Out"
          >
            <ZoomOut className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleResetView}
            className="h-7 px-2 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 whitespace-nowrap"
            title="Reset Zoom"
          >
            <Maximize className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSourceCode(!showSourceCode)}
            className="h-7 px-2 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 whitespace-nowrap"
            title="Toggle source code"
          >
            {showSourceCode ? <EyeOff className="h-3 w-3 sm:mr-1" /> : <Eye className="h-3 w-3 sm:mr-1" />}
            <span className="hidden sm:inline">{showSourceCode ? 'Hide' : 'Show'} Code</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={copyCode}
            className="h-7 px-2 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 whitespace-nowrap"
            title="Copy source code"
          >
            {copied ? <Check className="h-3 w-3 sm:mr-1 text-green-500 dark:text-green-400" /> : <Copy className="h-3 w-3 sm:mr-1" />}
            <span className="hidden sm:inline">Copy</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => svg && downloadSvg(svg)}
            className="h-7 px-2 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 whitespace-nowrap"
            title="Download as SVG"
          >
            <Download className="h-3 w-3 sm:mr-1" />
            <span className="hidden sm:inline">SVG</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => svg && downloadSvgAsPng(svg)}
            className="h-7 px-2 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 whitespace-nowrap"
            title="Download as PNG"
          >
            <Download className="h-3 w-3 sm:mr-1" />
            <span className="hidden sm:inline">PNG</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={triggerRender}
            className="h-7 px-2 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800"
            title="Re-render diagram"
          >
            <Play className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsDiagramExpanded(!isDiagramExpanded)}
            className="h-7 px-2 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 whitespace-nowrap"
            title={isDiagramExpanded ? 'Collapse Diagram' : 'Expand Diagram'}
          >
            {isDiagramExpanded ? <ChevronUp className="h-3 w-3 sm:mr-1" /> : <ChevronDown className="h-3 w-3 sm:mr-1" />}
            <span className="hidden sm:inline">{isDiagramExpanded ? 'Collapse' : 'Expand'}</span>
          </Button>
        </div>
      </div>

      {showSourceCode && (
        <div className="mb-4 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <Code className="h-4 w-4 text-gray-500 dark:text-gray-400" />
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Source Code
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={copySourceCode}
              className="h-6 w-6 p-0 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 self-end sm:self-auto"
            >
              {sourceCodeCopied ? <Check className="h-3 w-3 text-green-500 dark:text-green-400" /> : <Copy className="h-3 w-3 text-gray-600 dark:text-gray-400" />}
            </Button>
          </div>
          <pre className="text-sm text-gray-600 dark:text-gray-300 overflow-x-auto">
            <code>{chart}</code>
          </pre>
        </div>
      )}

      {error && (
        <div className="my-4 p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <span className="text-red-700 dark:text-red-300 font-medium">Rendering Error</span>
          </div>
          <p className="text-red-600 dark:text-red-400 text-sm mb-3">{error}</p>
          <div className="flex gap-2">
            <Button
              onClick={triggerRender}
              variant="outline"
              size="sm"
              className="text-red-600 border-red-300 hover:bg-red-50 dark:text-red-400 dark:border-red-700"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
            {onSuggestAiCorrection && (
              <Button
                onClick={handleAiFixClick}
                variant="outline"
                size="sm"
                className="text-blue-600 border-blue-300 hover:bg-blue-50 dark:text-blue-400 dark:border-blue-700"
              >
                <Wrench className="h-4 w-4 mr-2" />
                AI Fix
              </Button>
            )}
          </div>
        </div>
      )}

      {isDiagramExpanded && (
        <div
          className="bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-2 overflow-hidden relative"
          style={{ height: `${componentHeight}px` }}
          ref={diagramRef}
        >
          <div className="absolute top-2 left-2 z-10 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs px-2 py-1 rounded border border-blue-200 dark:border-blue-800">
            <span className="hidden sm:inline">Use mouse wheel to zoom, drag to pan</span>
            <span className="sm:hidden">Pinch to zoom, drag to pan</span>
          </div>
          <iframe
            ref={iframeRef}
            className="w-full h-full border-0 rounded-lg"
            sandbox="allow-same-origin"
            title="Mermaid Diagram"
            style={{ cursor: isPanning ? 'grabbing' : 'grab' }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
          />
          <div
            className="absolute bottom-0 left-0 right-0 h-3 flex items-center justify-center cursor-ns-resize text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
            onMouseDown={handleResizeMouseDown}
          >
            <GripVertical className="h-4 w-4" />
          </div>
        </div>
      )}
    </div>
  );
};

export default Mermaid;
