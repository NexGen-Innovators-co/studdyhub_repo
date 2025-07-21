import React, { useEffect, useRef, useState, useCallback } from 'react';
import { AlertTriangle, Copy, Check, Loader2, Wrench, Play, Code, Download, Eye, EyeOff, Info, ChevronDown, ChevronUp, ZoomIn, ZoomOut, Maximize, GripVertical } from 'lucide-react';
import { Button } from './ui/button'; // Assuming this path is correct for your Button component

// Define the MermaidProps interface
interface MermaidProps {
  chart: string;
  onMermaidError: (code: string, errorType: 'syntax' | 'rendering') => void;
  onSuggestAiCorrection?: (prompt: string) => void;
  diagramRef: React.RefObject<HTMLDivElement>;
}

// Function to clean the Mermaid string (less aggressive)
const cleanMermaidString = (input: string): string => {
  let cleaned = input;

  // 1. Remove Byte Order Mark (BOM) if present
  if (cleaned.charCodeAt(0) === 0xFEFF) {
    cleaned = cleaned.slice(1);
  }

  // 2. Normalize all line endings to LF
  cleaned = cleaned.replace(/\r\n|\r/g, '\n');

  // 3. Replace common invisible/non-standard spaces with regular spaces
  cleaned = cleaned.replace(/[\u00A0\u202F\u200B\uFEFF\u00AD]/g, ' ');

  // 4. Normalize multiple spaces to single spaces within each line, then trim each line
  cleaned = cleaned.split('\n').map(line => line.replace(/\s+/g, ' ').trim()).join('\n');

  // 5. Trim leading/trailing whitespace for the entire cleaned string
  cleaned = cleaned.trim();

  return cleaned;
};

// Function to auto-fix common Mermaid syntax errors
const autoFixMermaidSyntax = (input: string): { fixed: string; wasFixed: boolean } => {
  let fixed = input;
  let wasFixed = false;

  const lines = fixed.split('\n');
  const fixedLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    const originalLine = line;

    // Skip empty lines or initial directive lines
    if (i === 0 && (line.startsWith('graph') || line.startsWith('sequenceDiagram') || line.startsWith('flowchart') || line.startsWith('gantt') || line.startsWith('classDiagram') || line.startsWith('stateDiagram') || line.startsWith('pie') || line.startsWith('erDiagram') || line.startsWith('journey') || line.startsWith('gitGraph') || line.startsWith('quadrantChart') || line.startsWith('requirementDiagram') || line.startsWith('mindmap') || line.startsWith('timeline') || line.startsWith('C4Context') || line.startsWith('C4Container') || line.startsWith('C4Component') || line.startsWith('C4Dynamic') || line.startsWith('C4Deployment'))) {
      fixedLines.push(line);
      continue;
    }
    if (line.trim() === '') {
      fixedLines.push(line);
      continue;
    }

    // --- Specific Mermaid Sequence Diagram Fixes ---
    if (lines[0].trim().startsWith('sequenceDiagram')) {
      const seqLineRegex = /^\s*([^->]+?)\s*(->>|-->|->|--|x-->>|x-->|--x|->>x|--x)\s*([^:]+?)(?::\s*(.*))?$/;
      const match = line.match(seqLineRegex);

      if (match) {
        const source = match[1].trim();
        const arrow = match[2].trim();
        const target = match[3].trim();
        let message = match[4] ? match[4].trim() : '';

        let correctedArrow = arrow;
        if (arrow.includes(' ') && arrow.includes('>')) {
          correctedArrow = arrow.replace(/\s+/g, '');
          wasFixed = true;
        }

        if (message.includes(' ') && !message.startsWith('"') && !message.endsWith('"') && !message.startsWith('`') && !message.endsWith('`')) {
          message = `"${message}"`;
          wasFixed = true;
        }

        line = `${source}${correctedArrow}${target}${message ? `: ${message}` : ''}`;
      } else {
        if (line.startsWith('participant')) {
          const parts = line.split(':');
          if (parts.length > 1) {
            const participantName = parts[0].substring('participant'.length).trim();
            const alias = parts.slice(1).join(':').trim();
            if (alias) {
              line = `participant ${participantName} as ${alias}`;
            } else {
              line = `participant ${participantName}`;
            }
            wasFixed = true;
          } else {
            line = `participant ${line.substring('participant'.length).trim()}`;
            wasFixed = true;
          }
        }
      }
    }
    // --- End Specific Mermaid Sequence Diagram Fixes ---

    // Handle special characters within node definitions
    const nodeDefinitionRegex = /([A-Z0-9_]+\s*(?:\[.*?\]|\{.*?\}|\(.*?\)|<.*?>|\|.*?\|))/g;
    line = line.replace(nodeDefinitionRegex, (match) => {
      const contentMatch = match.match(/\[(.*?)\]|\{(.*?)\}|\((.*?)\}|<(.*?)>|\|(.*?)\|/);
      if (contentMatch) {
        const content = contentMatch[1] || contentMatch[2] || contentMatch[3] || contentMatch[4] || contentMatch[5];
        const nodeTypeChar = match.includes('[') ? '[' : (match.includes('{') ? '{' : (match.includes('(') ? '(' : (match.includes('<') ? '<' : '|')));
        const endChar = nodeTypeChar === '[' ? ']' : (nodeTypeChar === '{' ? '}' : (nodeTypeChar === '(') ? ')' : (nodeTypeChar === '<' ? '>' : '|'));

        const hasSpecialChars = /[()\/=\[\]∂∫+\-\^]/.test(content);

        if (hasSpecialChars) {
          const isAlreadyFormatted = content.startsWith('`') && content.endsWith('`');

          if (!isAlreadyFormatted) {
            let fixedContent = content
              .replace(/\(/g, '(')
              .replace(/\)/g, ')')
              .replace(/\//g, '/')
              .replace(/=/g, '=')
              .replace(/\[/g, '[')
              .replace(/\]/g, ']')
              .replace(/∂/g, '∂')
              .replace(/∫/g, '∫')
              .replace(/\+/g, '+')
              .replace(/\^/g, '^')
              .replace(/(?<!-)(--)(?!>)/g, '−−')
              .replace(/(?<!-)(-{1})(?![->])/g, '−');

            fixedContent = `\`${fixedContent}\``;
            const nodeId = match.split(nodeTypeChar)[0].trim();
            wasFixed = true;
            return `${nodeId}${nodeTypeChar}${fixedContent}${endChar}`;
          }
        }
      }
      return match;
    });

    // Handle unquoted labels in edges
    const edgeLabelRegex = /(\s(?:-+|==|~~)(?:>)?\s)([^\s"'][\w\s]*?[^\s"'])\s((?:-+|==|~~)(?:>)?\s)/g;
    line = line.replace(edgeLabelRegex, (match, p1, p2, p3) => {
      if (p2.includes(' ') && !p2.startsWith('"') && !p2.endsWith('"') && !p2.startsWith('`') && !p2.endsWith('`')) {
        wasFixed = true;
        return `${p1}"${p2}"${p3}`;
      }
      return match;
    });

    // Trim spaces around operators and ensure single spaces
    line = line.replace(/\s*(-->|--|---|-+>|==>|==|=+>|~~>|~~)\s*/g, '$1');
    line = line.replace(/\s+/g, ' ').trim();

    if (line !== originalLine) {
      wasFixed = true;
    }

    fixedLines.push(line);
  }

  return {
    fixed: fixedLines.join('\n'),
    wasFixed
  };
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
            link.click(); // Programmatically click the link
            document.body.removeChild(link);
            URL.revokeObjectURL(downloadUrl);
          }
        }, 'image/png');
      } catch (error) {
        console.error('Error converting canvas to PNG:', error);
        downloadSvg(svgString, filename); // Fallback to SVG download
      }
    };

    img.onerror = () => {
      console.error('Error loading SVG image for PNG conversion.');
      downloadSvg(svgString, filename); // Fallback to SVG download
    };

    img.src = svgDataUrl;
  } catch (error) {
    console.error('Error processing SVG for PNG conversion:', error);
    downloadSvg(svgString, filename); // Fallback to SVG download
  }
};

// Function to download SVG
const downloadSvg = (svgString: string, filename: string = 'mermaid-diagram') => {
  const blob = new Blob([svgString], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.svg`;
  document.body.appendChild(link);
  link.click(); // Programmatically click the link
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const Mermaid: React.FC<MermaidProps> = ({ chart, onMermaidError, onSuggestAiCorrection, diagramRef }) => {
  const id = useRef(`mermaid-${Math.random().toString(36).substr(2, 9)}`);
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isMermaidLoaded, setIsMermaidLoaded] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [wasAutoFixed, setWasAutoFixed] = useState(false);
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
  const svgContentRef = useRef<HTMLDivElement>(null); // Ref for the div containing the SVG

  // State for expand/collapse functionality
  const [isDiagramExpanded, setIsDiagramExpanded] = useState(true); // Default to expanded

  // State for resizable height
  const [componentHeight, setComponentHeight] = useState(300); // Initial height
  const isResizing = useRef(false);
  const initialResizeY = useRef(0);
  const initialComponentHeight = useRef(0);

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

  const handleAiFixClick = useCallback((code: string, errorType: 'syntax' | 'rendering') => {
    const prompt = `I encountered a ${errorType} error with the following Mermaid diagram code. Please correct the syntax and provide the corrected Mermaid code. Ensure there are no trailing spaces on any line within the code block.
\`\`\`mermaid
${code}
\`\`\`
`;
    if (onSuggestAiCorrection) {
      onSuggestAiCorrection(prompt);
    }
  }, [onSuggestAiCorrection]);

  const triggerRender = useCallback(() => {
    if (chart.trim() && !isRendering) {
      setShouldRender(true);
    }
  }, [chart, isRendering]);

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

      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/mermaid@11.1.1/dist/mermaid.min.js';
      script.onload = () => {
        setIsMermaidLoaded(true);
      };
      script.onerror = () => {
        console.error("Failed to load Mermaid script.");
        setError("Failed to load Mermaid library. Please check your network connection.");
        setIsMermaidLoaded(false);
      };
      document.head.appendChild(script);
    };

    loadMermaidScript();
  }, [isMermaidLoaded]);

  // Render diagram
  useEffect(() => {
    const renderDiagram = async () => {
      if (!isMermaidLoaded || !diagramRef.current || !(window as any).mermaid || !shouldRender) {
        return;
      }

      cleanupRender();

      setIsRendering(true);
      setError(null);
      setSvg(null);
      setShouldRender(false);

      const mermaidInstance = (window as any).mermaid;

      try {
        mermaidInstance.initialize({
          startOnLoad: false,
          theme: 'dark',
          themeVariables: {
            // Primary colors
            primaryColor: '#3b82f6',
            primaryTextColor: '#e5e7eb',
            primaryBorderColor: '#2563eb',
            // Secondary colors
            secondaryColor: '#10b981',
            tertiaryColor: '#f59e0b',
            // Background colors
            background: '#1f2937',
            secondaryBackground: '#374151',
            tertiaryBackground: '#4b5563',
            // Node colors
            mainBkg: '#3b82f6',
            secondBkg: '#10b981',
            tertiaryBkg: '#f59e0b',
            // Text colors
            textColor: '#e5e7eb',
            secondaryTextColor: '#9ca3af',
            // Line colors
            lineColor: '#9ca3af',
            arrowheadColor: '#e5e7eb',
            // Special colors
            errorBkgColor: '#7f1d1d',
            errorTextColor: '#f87171',
            // Flowchart specific
            nodeBkg: '#374151',
            nodeBorder: '#3b82f6',
            clusterBkg: '#1f2937',
            clusterBorder: '#4b5563',
            // Sequence diagram
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
            noteTextColor: '#f59e0b',
            // Gantt chart
            cScale0: '#3b82f6',
            cScale1: '#10b981',
            cScale2: '#f59e0b',
            cScale3: '#ef4444',
            cScale4: '#8b5cf6',
            cScale5: '#ec4899',
            cScale6: '#06b6d4',
            cScale7: '#84cc16',
            cScale8: '#f97316',
            cScale9: '#6366f1',
            cScale10: '#14b8a6',
            cScale11: '#f43f5e'
          },
          flowchart: {
            useMaxWidth: true,
            htmlLabels: true,
            curve: 'basis'
          },
          sequence: {
            useMaxWidth: true,
            wrap: true
          },
          gantt: {
            useMaxWidth: true,
            leftPadding: 75,
            rightPadding: 20,
            topPadding: 50,
            bottomPadding: 25
          },
          pie: {
            useMaxWidth: true
          },
          xychart: {
            useMaxWidth: true,
            defaultBackgroundColor: '#1f2937'
          },
          maxWidth: '100%',
          responsive: true
        });

        let cleanedChart = cleanMermaidString(chart);
        const { fixed: fixedChart, wasFixed } = autoFixMermaidSyntax(cleanedChart);
        setWasAutoFixed(wasFixed);

        const finalChart = fixedChart;

        console.log("Mermaid input string (raw):", finalChart);
        console.log("Mermaid input string (char codes):", finalChart.split('').map(c => c.charCodeAt(0)));

        const renderPromise = new Promise<any>((resolve, reject) => {
          renderTimeoutRef.current = setTimeout(() => {
            reject(new Error("Mermaid rendering timed out after 7 seconds."));
          }, 7000);

          mermaidInstance.render(
            'mermaid-chart-' + Date.now(), // Unique ID for each render
            finalChart
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

        if (bindFunctions) {
          bindFunctions(diagramRef.current);
        }

        // Reset zoom and pan when a new diagram is successfully rendered
        setScale(1);
        setTranslateX(0);
        setTranslateY(0);

      } catch (e: any) {
        console.error("Rendering error (mermaid):", e);
        setError(e.message || "An unknown error occurred during rendering.");
        if (onMermaidError) {
          onMermaidError(chart, 'rendering');
        }
      } finally {
        setIsRendering(false);
      }
    };

    if (isMermaidLoaded && shouldRender) {
      renderDiagram();
    }

    return cleanupRender;
  }, [shouldRender, chart, isMermaidLoaded, onMermaidError, cleanupRender, diagramRef]);

  // Trigger render on initial mount and when diagramRef changes
  useEffect(() => {
    if (!diagramRef.current) return;
    triggerRender(); // Initial render

    const resizeObserver = new ResizeObserver(entries => {
      for (let entry of entries) {
        // Only re-render if the content box size changes and not currently rendering
        // This helps with responsiveness while avoiding infinite loops
        if (entry.contentBoxSize && !isRendering && chart.trim()) {
          triggerRender();
        }
      }
    });

    resizeObserver.observe(diagramRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [diagramRef, chart, isRendering, triggerRender]);

  const hasChanges = chart !== lastRenderedChart;

  // Custom Zoom and Pan Handlers
  const handleZoom = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault(); // Prevent page scrolling
    const svgElement = svgContentRef.current?.querySelector('svg');
    if (!svgElement) return;

    const scaleAmount = 0.1;
    const newScale = event.deltaY < 0 ? scale * (1 + scaleAmount) : scale * (1 - scaleAmount);

    // Clamp scale to reasonable min/max values
    const clampedScale = Math.max(0.1, Math.min(10, newScale));

    // Calculate mouse position relative to SVG content area
    const rect = svgContentRef.current!.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    // Adjust translation to zoom towards the mouse pointer
    const oldTranslateX = translateX;
    const oldTranslateY = translateY;

    const newTranslateX = mouseX - ((mouseX - oldTranslateX) * (clampedScale / scale));
    const newTranslateY = mouseY - ((mouseY - oldTranslateY) * (clampedScale / scale));

    setScale(clampedScale);
    setTranslateX(newTranslateX);
    setTranslateY(newTranslateY);
  }, [scale, translateX, translateY]);

  const handleMouseDown = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (event.button === 0) { // Left mouse button
      setIsPanning(true);
      lastPanPosition.current = { x: event.clientX, y: event.clientY };
      event.currentTarget.style.cursor = 'grabbing';
    }
  }, []);

  const handleMouseMove = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (isPanning) {
      const deltaX = event.clientX - lastPanPosition.current.x;
      const deltaY = event.clientY - lastPanPosition.current.y;
      setTranslateX(prev => prev + deltaX);
      setTranslateY(prev => prev + deltaY);
      lastPanPosition.current = { x: event.clientX, y: event.clientY };
    }
  }, [isPanning]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
    if (svgContentRef.current) {
      svgContentRef.current.style.cursor = 'grab';
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsPanning(false);
    if (svgContentRef.current) {
      svgContentRef.current.style.cursor = 'grab';
    }
  }, []);

  const handleZoomIn = useCallback(() => {
    setScale(prev => Math.min(10, prev * 1.2)); // Zoom in by 20%
  }, []);

  const handleZoomOut = useCallback(() => {
    setScale(prev => Math.max(0.1, prev * 0.8)); // Zoom out by 20%
  }, []);

  const handleResetZoom = useCallback(() => {
    setScale(1);
    setTranslateX(0);
    setTranslateY(0);
  }, []);

  // Resize Handlers
  const handleResizeMouseDown = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    isResizing.current = true;
    initialResizeY.current = event.clientY;
    initialComponentHeight.current = componentHeight;
    document.body.style.cursor = 'ns-resize'; // Change cursor globally
    // Add global event listeners to handle mouseup outside the component
    document.addEventListener('mousemove', handleResizeMouseMove);
    document.addEventListener('mouseup', handleResizeMouseUp);
  }, [componentHeight]);

  const handleResizeMouseMove = useCallback((event: MouseEvent) => {
    if (isResizing.current) {
      const deltaY = event.clientY - initialResizeY.current;
      const newHeight = Math.max(200, initialComponentHeight.current + deltaY); // Min height 200px
      setComponentHeight(newHeight);
    }
  }, []);

  const handleResizeMouseUp = useCallback(() => {
    isResizing.current = false;
    document.body.style.cursor = 'default'; // Reset cursor globally
    document.removeEventListener('mousemove', handleResizeMouseMove);
    document.removeEventListener('mouseup', handleResizeMouseUp);
  }, [handleResizeMouseMove]);


  if (!isMermaidLoaded) {
    return (
      <div className="my-4 p-4 bg-gray-800 border border-gray-700 rounded-lg flex items-center justify-center h-40">
        <Loader2 className="h-6 w-6 animate-spin text-blue-400 mr-2" />
        <span className="text-gray-300">Loading diagram library...</span>
      </div>
    );
  }

  if (isRendering) {
    return (
      <div className="my-4 p-4 bg-gray-800 border border-gray-700 rounded-lg flex items-center justify-center h-40">
        <Loader2 className="h-6 w-6 animate-spin text-blue-400 mr-2" />
        <span className="text-gray-300">Rendering diagram...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="my-4 p-3 bg-red-900/50 border border-red-700 rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-red-300">
            <Info className="h-4 w-4" />
            <span className="text-sm font-medium">Diagram Issue Detected</span>
          </div>
          <div className="flex gap-2">
            {onSuggestAiCorrection && (
              <Button
                size="sm"
                onClick={() => handleAiFixClick(chart, 'rendering')}
                className="bg-blue-600 text-white hover:bg-blue-500 h-7 px-3 text-xs"
              >
                <Wrench className="h-3 w-3 mr-1" />
                AI Fix
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={triggerRender}
              className="text-gray-300 border-gray-600 hover:bg-gray-700 h-7 px-3 text-xs"
            >
              <Play className="h-3 w-3 mr-1" />
              Try Again
            </Button>
          </div>
        </div>
        <details className="text-sm text-red-300 cursor-pointer">
          <summary className="flex items-center gap-2 py-1">
            <ChevronDown className="h-4 w-4" />
            <span>Show Details</span>
          </summary>
          <div className="mt-2 p-2 bg-gray-800 rounded overflow-x-auto text-gray-300">
            <p className="mb-1">Error: {error}</p>
            <p className="font-semibold mb-1">Diagram Code:</p>
            <pre className="text-sm whitespace-pre-wrap">{chart}</pre>
          </div>
        </details>
      </div>
    );
  }

  if (!svg || hasChanges) {
    return (
      <div className="my-4 p-3 sm:p-4 bg-gray-900 border border-gray-700 rounded-lg">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
              Mermaid Diagram
            </span>
            {hasChanges && svg && (
              <div className="flex items-center gap-1 text-xs bg-red-900/50 text-red-300 px-2 py-1 rounded">
                <AlertTriangle className="h-3 w-3" />
                <span className="hidden sm:inline">Changes detected</span>
              </div>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={copyCode}
            className="h-6 w-6 p-0 text-gray-300 hover:bg-gray-800"
          >
            {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
          </Button>
        </div>
        <div className="flex items-center justify-center h-32 border-2 border-dashed border-gray-600 rounded-lg bg-gray-800">
          <div className="text-center px-4">
            <p className="text-sm text-gray-400 mb-3">
              {!svg ? 'Click to render your Mermaid diagram' : 'Click to update diagram with changes'}
            </p>
            <Button
              onClick={triggerRender}
              disabled={!chart.trim()}
              className="bg-blue-600 hover:bg-blue-500 text-white"
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
    <div className="my-4 p-3 sm:p-4 bg-gray-900 rounded-lg border border-gray-700">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
            Mermaid Diagram
          </span>
          {wasAutoFixed && (
            <div className="flex items-center gap-1 text-xs bg-green-900/50 text-green-300 px-2 py-1 rounded">
              <Wrench className="h-3 w-3" />
              <span className="hidden sm:inline">Auto-fixed</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto">
          {/* Custom Zoom Controls */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleZoomIn}
            className="h-7 px-2 text-xs text-gray-300 hover:bg-gray-800 whitespace-nowrap"
            title="Zoom In"
          >
            <ZoomIn className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleZoomOut}
            className="h-7 px-2 text-xs text-gray-300 hover:bg-gray-800 whitespace-nowrap"
            title="Zoom Out"
          >
            <ZoomOut className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleResetZoom}
            className="h-7 px-2 text-xs text-gray-300 hover:bg-gray-800 whitespace-nowrap"
            title="Reset Zoom"
          >
            <Maximize className="h-3 w-3" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSourceCode(!showSourceCode)}
            className="h-7 px-2 text-xs text-gray-300 hover:bg-gray-800 whitespace-nowrap"
            title="Toggle source code"
          >
            {showSourceCode ? <EyeOff className="h-3 w-3 sm:mr-1" /> : <Eye className="h-3 w-3 sm:mr-1" />}
            <span className="hidden sm:inline">{showSourceCode ? 'Hide' : 'Show'} Code</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={copyCode}
            className="h-7 px-2 text-xs text-gray-300 hover:bg-gray-800 whitespace-nowrap"
            title="Copy source code"
          >
            {copied ? <Check className="h-3 w-3 sm:mr-1 text-green-400" /> : <Copy className="h-3 w-3 sm:mr-1" />}
            <span className="hidden sm:inline">Copy</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => svg && downloadSvg(svg)}
            className="h-7 px-2 text-xs text-gray-300 hover:bg-gray-800 whitespace-nowrap"
            title="Download as SVG"
          >
            <Download className="h-3 w-3 sm:mr-1" />
            <span className="hidden sm:inline">SVG</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => svg && downloadSvgAsPng(svg)}
            className="h-7 px-2 text-xs text-gray-300 hover:bg-gray-800 whitespace-nowrap"
            title="Download as PNG"
          >
            <Download className="h-3 w-3 sm:mr-1" />
            <span className="hidden sm:inline">PNG</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={triggerRender}
            className="h-7 px-2 text-xs text-gray-300 hover:bg-gray-800"
            title="Re-render diagram"
          >
            <Play className="h-3 w-3" />
          </Button>
          {/* Expand/Collapse Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsDiagramExpanded(prev => !prev)}
            className="h-7 px-2 text-xs text-gray-300 hover:bg-gray-800 whitespace-nowrap"
            title={isDiagramExpanded ? 'Collapse Diagram' : 'Expand Diagram'}
          >
            {isDiagramExpanded ? <ChevronUp className="h-3 w-3 sm:mr-1" /> : <ChevronDown className="h-3 w-3 sm:mr-1" />}
            <span className="hidden sm:inline">{isDiagramExpanded ? 'Collapse' : 'Expand'}</span>
          </Button>
        </div>
      </div>

      {showSourceCode && (
        <div className="mb-4 p-3 bg-gray-800 rounded-lg border border-gray-700">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <Code className="h-4 w-4 text-gray-400" />
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                Source Code
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={copySourceCode}
              className="h-6 w-6 p-0 text-gray-300 hover:bg-gray-700 self-end sm:self-auto"
            >
              {sourceCodeCopied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3 text-gray-400" />}
            </Button>
          </div>
          <pre className="text-sm text-gray-300 overflow-x-auto">
            <code>{chart}</code>
          </pre>
        </div>
      )}

      {isDiagramExpanded && (
        <div
          className="bg-gray-800 rounded-lg border border-gray-700 p-2 overflow-hidden relative" // Added relative for resize handle positioning
          style={{ height: `${componentHeight}px` }} // Apply dynamic height
        >
          <div
            ref={svgContentRef} // Assign ref here for mouse events
            className="w-full h-full flex items-center justify-center" // Removed min-h, using parent height
            style={{ cursor: isPanning ? 'grabbing' : 'grab' }}
            onWheel={handleZoom}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
          >
            <div
              dangerouslySetInnerHTML={{ __html: svg || '' }}
              style={{
                transform: `translate(${translateX}px, ${translateY}px) scale(${scale})`,
                transformOrigin: '0 0', // Set transform origin to top-left for consistent translation
                transition: isPanning ? 'none' : 'transform 0.1s ease-out', // Smooth transition for zoom, instant for pan
              }}
              className="min-w-0 [&>svg]:max-w-full [&>svg]:h-auto [&>svg]:w-full"
            />
          </div>
          {/* Resize Handle */}
          <div
            className="absolute bottom-0 left-0 right-0 h-3 flex items-center justify-center cursor-ns-resize text-gray-500 hover:text-gray-300"
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
