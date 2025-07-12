import React, { useEffect, useRef, useState, useCallback } from 'react';
import { AlertTriangle, Copy, Check, Loader2, Wrench, Play, Code, Download, Eye, EyeOff } from 'lucide-react'; 
import { Button } from './ui/button'; 

interface MermaidProps {
  chart: string;
  onMermaidError: (code: string, errorType: 'syntax' | 'rendering') => void; 
}

// Function to aggressively clean the Mermaid string
const cleanMermaidString = (input: string): string => {
  let cleaned = input.replace(/[\u00A0\u202F\u200B]/g, ' ');
  cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  cleaned = cleaned.split('\n').map(line => line.replace(/\s+/g, ' ').trim()).join('\n');
  return cleaned.trim();
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
    
    if (i === 0 || line.trim() === '') {
      fixedLines.push(line);
      continue;
    }
    
    if (line.includes('[') || line.includes('{')) {
      const nodeMatches = line.match(/([A-Z]\[.*?\])|([A-Z]\{.*?\})/g);
      
      if (nodeMatches) {
        for (const match of nodeMatches) {
          const nodeId = match.charAt(0);
          const nodeType = match.charAt(1);
          const endChar = nodeType === '[' ? ']' : '}';
          const content = match.slice(2, -1);
          const hasSpecialChars = /[()\/=\[\]∂∫+\-\^]/.test(content);
          
          if (hasSpecialChars) {
            const isAlreadyFormatted = content.startsWith('`') && content.endsWith('`');
            
            if (!isAlreadyFormatted) {
              let fixedContent = content
                .replace(/\(/g, '&lpar;')
                .replace(/\)/g, '&rpar;')
                .replace(/\//g, '&sol;')
                .replace(/=/g, '&equals;')
                .replace(/\[/g, '&lbrack;')
                .replace(/\]/g, '&rbrack;')
                .replace(/∂/g, '&part;')
                .replace(/∫/g, '&int;')
                .replace(/\+/g, '&plus;')
                .replace(/\^/g, '&Hat;')
                .replace(/(?<!-)(--)(?!>)/g, '&minus;&minus;')
                .replace(/(?<!-)(-{1})(?![->])/g, '&minus;');
              
              fixedContent = `\`${fixedContent}\``;
              const fixedMatch = `${nodeId}${nodeType}${fixedContent}${endChar}`;
              line = line.replace(match, fixedMatch);
              wasFixed = true;
            }
          }
        }
      }
    }
    
    line = line.replace(/\s*(-->|--)\s*/g, ' $1 ');
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

// Fixed function to download SVG as PNG without canvas taint issues
const downloadSvgAsPng = (svgString: string, filename: string = 'mermaid-diagram') => {
  try {
    // Create a new SVG element and set its content
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svgString, 'image/svg+xml');
    const svgElement = svgDoc.documentElement;
    
    // Get SVG dimensions
    const svgSVGElement = svgElement as unknown as SVGSVGElement;
    const svgRect = svgSVGElement.getBoundingClientRect();
    const width = svgSVGElement.width?.baseVal?.value || svgRect.width || 800;
    const height = svgSVGElement.height?.baseVal?.value || svgRect.height || 600;
    
    // Ensure SVG has proper dimensions and namespace
    svgSVGElement.setAttribute('width', width.toString());
    svgSVGElement.setAttribute('height', height.toString());
    svgSVGElement.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    
    // Convert back to string
    const serializer = new XMLSerializer();
    const svgData = serializer.serializeToString(svgSVGElement);
    
    // Create data URL directly from SVG string (no blob needed)
    const svgDataUrl = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
    
    // Create canvas
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // Set canvas dimensions (2x for higher resolution)
    canvas.width = width * 2;
    canvas.height = height * 2;
    
    // Scale context for high DPI
    ctx!.scale(2, 2);
    
    // Fill with white background
    ctx!.fillStyle = 'white';
    ctx!.fillRect(0, 0, width, height);
    
    // Create image and load SVG
    const img = new Image();
    
    img.onload = () => {
      try {
        // Draw the SVG image to canvas
        ctx!.drawImage(img, 0, 0, width, height);
        
        // Convert canvas to blob and download
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
        console.error('Error converting canvas to PNG:', error);
        // Fallback: offer SVG download instead
        downloadSvg(svgString, filename);
      }
    };
    
    img.onerror = () => {
      console.error('Error loading SVG image');
      // Fallback: offer SVG download instead
      downloadSvg(svgString, filename);
    };
    
    // Load the SVG data URL
    img.src = svgDataUrl;
    
  } catch (error) {
    console.error('Error processing SVG for PNG conversion:', error);
    // Fallback: offer SVG download instead
    downloadSvg(svgString, filename);
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
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const Mermaid: React.FC<MermaidProps> = ({ chart, onMermaidError }) => {
  const mermaidDivRef = useRef<HTMLDivElement>(null);
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

  const triggerRender = () => {
    console.log("Trigger render called, chart length:", chart.trim().length);
    if (chart.trim()) {
      console.log("Setting shouldRender to true");
      setShouldRender(true);
    } else {
      console.log("Chart is empty, not rendering");
    }
  };

  // Cleanup function for ongoing renders
  const cleanupRender = useCallback(() => {
    if (renderTimeoutRef.current) {
      clearTimeout(renderTimeoutRef.current);
      renderTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    const loadMermaidScript = () => {
      if (isMermaidLoaded || (window as any).mermaid) {
        setIsMermaidLoaded(true);
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/mermaid@11.1.1/dist/mermaid.min.js';
      script.onload = () => {
        console.log("Mermaid script loaded successfully.");
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

  useEffect(() => {
    const renderDiagram = async () => {
      if (!isMermaidLoaded || !mermaidDivRef.current || !(window as any).mermaid || !shouldRender) {
        if (!isMermaidLoaded) {
          console.log("Mermaid not loaded yet");
        }
        if (!mermaidDivRef.current) {
          console.log("Mermaid div ref not available");
        }
        if (!(window as any).mermaid) {
          console.log("Mermaid not available on window");
        }
        if (!shouldRender) {
          console.log("Should render is false");
        }
        return;
      }

      console.log("Starting render process...");

      // Clean up any previous render attempts
      cleanupRender();

      setIsRendering(true); 
      setError(null); 
      setSvg(null); 
      setShouldRender(false); // Reset trigger

      const mermaidInstance = (window as any).mermaid;

      try {
        console.log("Mermaid object accessed from window:", mermaidInstance);
        console.log("Mermaid initialized. Version:", mermaidInstance.version); 

        // Enhanced theme configuration with better colors
        mermaidInstance.initialize({ 
          startOnLoad: false, 
          theme: 'base',
          themeVariables: {
            // Primary colors
            primaryColor: '#3b82f6',
            primaryTextColor: '#ffffff',
            primaryBorderColor: '#2563eb',
            
            // Secondary colors
            secondaryColor: '#10b981',
            tertiaryColor: '#f59e0b',
            
            // Background colors
            background: '#ffffff',
            secondaryBackground: '#f8fafc',
            tertiaryBackground: '#e2e8f0',
            
            // Node colors
            mainBkg: '#3b82f6',
            secondBkg: '#10b981',
            tertiaryBkg: '#f59e0b',
            
            // Text colors
            textColor: '#1f2937',
            secondaryTextColor: '#6b7280',
            
            // Line colors
            lineColor: '#6b7280',
            arrowheadColor: '#374151',
            
            // Special colors
            errorBkgColor: '#fee2e2',
            errorTextColor: '#dc2626',
            
            // Flowchart specific
            nodeBkg: '#ffffff',
            nodeBorder: '#3b82f6',
            clusterBkg: '#f8fafc',
            clusterBorder: '#e2e8f0',
            
            // Sequence diagram
            actorBkg: '#f8fafc',
            actorBorder: '#3b82f6',
            actorTextColor: '#1f2937',
            actorLineColor: '#6b7280',
            signalColor: '#374151',
            signalTextColor: '#1f2937',
            labelBoxBkgColor: '#f8fafc',
            labelBoxBorderColor: '#e2e8f0',
            labelTextColor: '#1f2937',
            loopTextColor: '#1f2937',
            noteBorderColor: '#fbbf24',
            noteBkgColor: '#fef3c7',
            noteTextColor: '#92400e',
            
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
            defaultBackgroundColor: '#ffffff'
          },
          // Global responsive settings
          maxWidth: '100%',
          responsive: true
        });

        let cleanedChart = cleanMermaidString(chart);
        const { fixed: fixedChart, wasFixed } = autoFixMermaidSyntax(cleanedChart);
        setWasAutoFixed(wasFixed);
        
        if (wasFixed) {
          console.log("Auto-fixed Mermaid syntax errors");
          console.log("Original:", cleanedChart);
          console.log("Fixed:", fixedChart);
        }
        
        const finalChart = fixedChart;
        console.log("Attempting to render Mermaid chart:", finalChart);

        const renderPromise = new Promise<any>((resolve, reject) => {
          renderTimeoutRef.current = setTimeout(() => {
            reject(new Error("Mermaid rendering timed out after 7 seconds."));
          }, 7000); 

          mermaidInstance.render(
            'mermaid-chart-' + Date.now(), 
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
          bindFunctions(mermaidDivRef.current);
        }

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
      console.log("Calling renderDiagram...");
      renderDiagram();
    }

    return cleanupRender; // Cleanup on unmount
  }, [shouldRender, chart, isMermaidLoaded, onMermaidError, cleanupRender]);

  // Check if current chart is different from last rendered
  const hasChanges = chart !== lastRenderedChart;

  if (!isMermaidLoaded) {
    return (
      <div className="my-4 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg flex items-center justify-center h-40">
        <Loader2 className="h-6 w-6 animate-spin text-blue-500 mr-2" />
        <span className="text-blue-700">Loading diagram library...</span>
      </div>
    );
  }

  if (isRendering) {
    return (
      <div className="my-4 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg flex items-center justify-center h-40">
        <Loader2 className="h-6 w-6 animate-spin text-blue-500 mr-2" />
        <span className="text-blue-700">Rendering diagram...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="my-4 p-4 bg-gradient-to-br from-red-50 to-pink-50 border border-red-200 rounded-lg">
        <div className="flex items-center gap-2 text-red-700">
          <AlertTriangle className="h-4 w-4" />
          <span className="text-sm font-medium">Diagram Rendering Error</span>
        </div>
        <p className="text-sm text-red-600 mt-1">
          Could not render Mermaid diagram (Mermaid v{(window as any).mermaid?.version || 'unknown'}): {error} 
        </p>
        <pre className="text-sm text-gray-600 mt-2 p-2 bg-gray-50 rounded overflow-x-auto">
          {chart}
        </pre>
        <div className="flex flex-col sm:flex-row gap-2 mt-3">
          <Button
            variant="outline"
            size="sm"
            onClick={copyCode}
            className="text-slate-600 border-slate-200 hover:bg-slate-50 flex-1 sm:flex-none"
          >
            {copied ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
            Copy Code
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onMermaidError && onMermaidError(chart, 'rendering')}
            className="bg-blue-500 text-white hover:bg-blue-600 flex-1 sm:flex-none"
          >
            <span className="hidden sm:inline">Suggest AI Correction</span>
            <span className="sm:hidden">AI Fix</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={triggerRender}
            className="bg-green-500 text-white hover:bg-green-600 flex-1 sm:flex-none"
          >
            <Play className="h-3 w-3 mr-1" />
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  // Show render button when no diagram is rendered yet or when there are changes
  if (!svg || hasChanges) {
    return (
      <div className="my-4 p-3 sm:p-4 bg-gradient-to-br from-gray-50 to-slate-50 border border-gray-200 rounded-lg">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Mermaid Diagram
            </span>
            {hasChanges && svg && (
              <div className="flex items-center gap-1 text-xs bg-gradient-to-r from-orange-100 to-amber-100 text-orange-700 px-2 py-1 rounded">
                <AlertTriangle className="h-3 w-3" />
                <span className="hidden sm:inline">Changes detected</span>
              </div>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={copyCode}
            className="h-6 w-6 p-0 hover:bg-gray-100 self-end sm:self-auto"
          >
            {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
          </Button>
        </div>
        
        <div className="flex items-center justify-center h-32 border-2 border-dashed border-gray-300 rounded-lg bg-white">
          <div className="text-center px-4">
            <p className="text-sm text-gray-500 mb-3">
              {!svg ? 'Click to render your Mermaid diagram' : 'Click to update diagram with changes'}
            </p>
            <Button
              onClick={triggerRender}
              disabled={!chart.trim()}
              className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white shadow-lg"
            >
              <Play className="h-4 w-4 mr-2" />
              {!svg ? 'Render Diagram' : 'Update Diagram'}
            </Button>
          </div>
        </div>
        
        {/* Hidden div for Mermaid rendering - always present */}
        <div ref={mermaidDivRef} style={{ display: 'none' }} />
      </div>
    );
  }

  return (
    <div className="my-4 p-3 sm:p-4 bg-gradient-to-br from-white to-gray-50 rounded-lg shadow-sm border border-gray-200">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Mermaid Diagram
          </span>
          {wasAutoFixed && (
            <div className="flex items-center gap-1 text-xs bg-gradient-to-r from-green-100 to-emerald-100 text-green-700 px-2 py-1 rounded">
              <Wrench className="h-3 w-3" />
              <span className="hidden sm:inline">Auto-fixed</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSourceCode(!showSourceCode)}
            className="h-7 px-2 text-xs hover:bg-gray-100 whitespace-nowrap"
            title="Toggle source code"
          >
            {showSourceCode ? <EyeOff className="h-3 w-3 sm:mr-1" /> : <Eye className="h-3 w-3 sm:mr-1" />}
            <span className="hidden sm:inline">{showSourceCode ? 'Hide' : 'Show'} Code</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={copyCode}
            className="h-7 px-2 text-xs hover:bg-gray-100 whitespace-nowrap"
            title="Copy source code"
          >
            {copied ? <Check className="h-3 w-3 sm:mr-1 text-green-500" /> : <Copy className="h-3 w-3 sm:mr-1" />}
            <span className="hidden sm:inline">Copy</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => svg && downloadSvg(svg)}
            className="h-7 px-2 text-xs hover:bg-gray-100 whitespace-nowrap"
            title="Download as SVG"
          >
            <Download className="h-3 w-3 sm:mr-1" />
            <span className="hidden sm:inline">SVG</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => svg && downloadSvgAsPng(svg)}
            className="h-7 px-2 text-xs hover:bg-gray-100 whitespace-nowrap"
            title="Download as PNG"
          >
            <Download className="h-3 w-3 sm:mr-1" />
            <span className="hidden sm:inline">PNG</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={triggerRender}
            className="h-7 px-2 text-xs hover:bg-gray-100"
            title="Re-render diagram"
          >
            <Play className="h-3 w-3" />
          </Button>
        </div>
      </div>
      
      {showSourceCode && (
        <div className="mb-4 p-3 bg-gray-900 rounded-lg border">
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
              className="h-6 w-6 p-0 hover:bg-gray-800 self-end sm:self-auto"
            >
              {sourceCodeCopied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3 text-gray-400" />}
            </Button>
          </div>
          <pre className="text-sm text-gray-300 overflow-x-auto">
            <code>{chart}</code>
          </pre>
        </div>
      )}
      
      <div className="bg-white rounded-lg border border-gray-100 p-2 overflow-x-auto">
        <div 
          ref={mermaidDivRef} 
          dangerouslySetInnerHTML={{ __html: svg }} 
          className="min-w-0 [&>svg]:max-w-full [&>svg]:h-auto [&>svg]:w-full"
        />
      </div>
    </div>
  );
};

export default Mermaid;