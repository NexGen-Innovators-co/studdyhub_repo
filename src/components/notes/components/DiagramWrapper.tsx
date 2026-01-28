// src/components/notes/components/DiagramWrapper.tsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import mermaid from 'mermaid';
import { Chart, ChartConfiguration } from 'chart.js';
import { Edit2, X, AlertCircle, RotateCcw, ZoomIn, ZoomOut, Maximize2, Minimize2, RefreshCcw, GripVertical, ChevronDown, Download, Sparkles } from 'lucide-react';
import { InlineAIEditor } from './InlineAIEditor';
import { NodeViewWrapper, NodeViewContent } from '@tiptap/react';
import { motion, useAnimation } from 'framer-motion';

interface DiagramWrapperProps {
  node: any;
  updateAttributes: (attrs: any) => void;
  deleteNode: () => void;
  editor: any;
  getPos: () => number;
  selected: boolean;
}

export const DiagramWrapper: React.FC<DiagramWrapperProps> = ({
  node,
  updateAttributes,
  deleteNode,
  selected,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<Chart | null>(null);
  const [editing, setEditing] = useState(false);
  const [aiFixing, setAiFixing] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [height, setHeight] = useState(node.attrs.height || '300px');
  const [isDownloadMenuOpen, setIsDownloadMenuOpen] = useState(false);
  const controls = useAnimation();

  const type = node.type.name; // chartjs | mermaid | dot

  const handleDownload = async (format: 'png' | 'svg' | 'pdf') => {
    setIsDownloadMenuOpen(false);
    const filename = `${type}-diagram-${Date.now()}.${format}`;
    
    let svgElement: SVGSVGElement | null = null;
    let canvasElement: HTMLCanvasElement | null = null;

    if (type === 'chartjs') {
        canvasElement = containerRef.current?.querySelector('canvas') || null;
    } else if (type === 'mermaid') {
        const shadowHost = containerRef.current?.querySelector('div');
        if (shadowHost && shadowHost.shadowRoot) {
            svgElement = shadowHost.shadowRoot.querySelector('svg');
        } else {
            svgElement = containerRef.current?.querySelector('svg') || null;
        }
    } else if (type === 'dot') {
        svgElement = containerRef.current?.querySelector('svg') || null;
    }

    if (format === 'png') {
        if (canvasElement) {
            const link = document.createElement('a');
            link.download = filename;
            link.href = canvasElement.toDataURL('image/png');
            link.click();
        } else if (svgElement) {
            const serializer = new XMLSerializer();
            const svgString = serializer.serializeToString(svgElement);
            const img = new Image();
            // Important: Set crossOrigin to anonymous to prevent tainted canvas
            img.crossOrigin = 'anonymous';
            
            // Use Data URI instead of Blob URL to better handle security contexts
            const svgBase64 = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgString)));
            
            img.onload = () => {
                const canvas = document.createElement('canvas');
                // Use default size if getBoundingClientRect returns 0 (e.g. if element is hidden)
                const bbox = svgElement!.getBoundingClientRect();
                const width = bbox.width || 800;
                const height = bbox.height || 600;
                
                // Increase scale for better quality
                const scaleFactor = 2; 
                
                canvas.width = width * scaleFactor;
                canvas.height = height * scaleFactor;
                
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    // Fill white background (transparent backgrounds can look black in some viewers)
                    ctx.fillStyle = '#FFFFFF';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    
                    ctx.scale(scaleFactor, scaleFactor);
                    ctx.drawImage(img, 0, 0, width, height);
                    try {
                        const link = document.createElement('a');
                        link.download = filename;
                        link.href = canvas.toDataURL('image/png');
                        link.click();
                    } catch (e) {
                        //console.error('Export failed', e);
                        alert('Could not export to PNG due to security restrictions. Try SVG or PDF.');
                    }
                }
            };
            img.src = svgBase64;
        }
    } else if (format === 'svg') {
        if (svgElement) {
            const serializer = new XMLSerializer();
            const svgString = serializer.serializeToString(svgElement);
            const blob = new Blob([svgString], {type: 'image/svg+xml;charset=utf-8'});
            const link = document.createElement('a');
            link.download = filename;
            link.href = URL.createObjectURL(blob);
            link.click();
        }
    } else if (format === 'pdf') {
        if ((window as any).html2pdf) {
             const element = document.createElement('div');
             element.style.padding = '20px';
             element.style.background = 'white';
             
             if (canvasElement) {
                 const img = new Image();
                 img.src = canvasElement.toDataURL('image/png');
                 img.style.maxWidth = '100%';
                 element.appendChild(img);
             } else if (svgElement) {
                 element.innerHTML = new XMLSerializer().serializeToString(svgElement);
             }
             
             (window as any).html2pdf().from(element).save(filename);
        } else {
            alert('PDF generation library not loaded.');
        }
    }
  };

  const handleZoomIn = () => setScale(prev => Math.min(prev + 0.2, 3));
  const handleZoomOut = () => setScale(prev => Math.max(prev - 0.2, 0.5));
  const handleResetZoom = () => setScale(1);
  const toggleFullscreen = () => setIsFullscreen(!isFullscreen);

  // Resize logic
  const startResizing = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizing(false);
    if (wrapperRef.current) {
      updateAttributes({ height: `${wrapperRef.current.offsetHeight}px` });
    }
  }, [updateAttributes]);

  const resize = useCallback((e: MouseEvent) => {
    if (isResizing && wrapperRef.current) {
      const newHeight = e.clientY - wrapperRef.current.getBoundingClientRect().top;
      if (newHeight > 150) {
        setHeight(`${newHeight}px`);
      }
    }
  }, [isResizing]);

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', resize);
      window.addEventListener('mouseup', stopResizing);
    }
    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [isResizing, resize, stopResizing]);

  // Initialize code
  useEffect(() => {
    if (type === 'chartjs') {
      setCode(node.attrs.config || '{}');
    } else if (type === 'mermaid' || type === 'dot') {
      setCode(node.attrs.code || '');
    }
    if (node.attrs.height) {
      setHeight(node.attrs.height);
    }
  }, [node.attrs, type]);

  // Cleanup chart
  useEffect(() => {
    return () => {
      chartInstanceRef.current?.destroy();
    };
  }, []);

  // Render diagram and auto-fit container height to diagram
  useEffect(() => {
    const render = async () => {
      setError(null);
      chartInstanceRef.current?.destroy();
      if (containerRef.current) containerRef.current.innerHTML = '';

      // Suppress Mermaid logs during render
      const originalInfo = console.info;
      const originalWarn = console.warn;
      console.info = () => {};
      console.warn = () => {};

      try {
        if (type === 'chartjs') {
          const canvas = document.createElement('canvas');
          canvas.style.maxWidth = '100%';
          canvas.style.height = '400px';
          containerRef.current?.appendChild(canvas);

          let config: ChartConfiguration;
          try {
            config = JSON.parse(code);
          } catch {
            throw new Error('Invalid JSON');
          }

          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('Canvas context failed');
          chartInstanceRef.current = new Chart(ctx, config);

          // Auto-fit height to canvas
          setTimeout(() => {
            if (canvas && wrapperRef.current) {
              const rect = canvas.getBoundingClientRect();
              if (rect.height > 0) setHeight(`${rect.height + 48}px`); // 48px for padding/buttons
            }
          }, 100);

        } else if (type === 'mermaid') {
          // ✅ Safe, isolated Mermaid rendering
          mermaid.initialize({
            startOnLoad: false,
            theme: 'default',
            securityLevel: 'loose',
            logLevel: 5, // 'fatal' level
            fontFamily: 'system-ui, -apple-system, sans-serif',
            flowchart: { curve: 'basis' },
          });

          const id = `mermaid-${Date.now()}-${Math.random().toString(36).slice(2)}`;
          const codeTrimmed = code.trim();

          try {
            // --- Create a shadow DOM sandbox ---
            const shadowHost = document.createElement('div');
            const shadowRoot = shadowHost.attachShadow({ mode: 'open' });
            containerRef.current!.innerHTML = '';
            containerRef.current!.appendChild(shadowHost);

            // --- Render off-DOM (isolated) ---
            const { svg } = await mermaid.render(id, codeTrimmed);

            // Inject SVG safely inside shadow root
            shadowRoot.innerHTML = svg;

            // Style for responsiveness
            const svgEl = shadowRoot.querySelector('svg');
            if (svgEl) {
              svgEl.style.maxWidth = '100%';
              svgEl.style.height = 'auto';
              svgEl.style.display = 'block';
              // Auto-fit height to SVG
              setTimeout(() => {
                if (svgEl && wrapperRef.current) {
                  const bbox = svgEl.getBBox();
                  if (bbox.height > 0) setHeight(`${bbox.height + 48}px`); // 48px for padding/buttons
                }
              }, 100);
            }

            setError(null);
          } catch (mermaidErr: any) {
            // Cleanup any leftover global SVG nodes (Mermaid sometimes leaks)
            Array.from(document.querySelectorAll('.mermaid, [id^="mermaid-"]')).forEach((el) => {
              if (el.textContent?.includes('Syntax error')) el.remove();
            });

            // --- Graceful fallback UI ---
            const msg =
              mermaidErr?.message?.replace(/</g, '&lt;').replace(/>/g, '&gt;') ||
              'Minor Mermaid syntax issue (safe to ignore).';

            containerRef.current!.innerHTML = `
              <div style="
                border: 1px solid #ef4444;
                background: rgba(239,68,68,0.08);
                color: #b91c1c;
                padding: 0.75rem 1rem;
                border-radius: 0.5rem;
                font-size: 0.85rem;
                line-height: 1.3;
                font-family: system-ui, sans-serif;
                word-break: break-word;
              ">
                <strong>⚠️ Mermaid Render Warning:</strong><br/>
                ${msg}
              </div>
            `;
          }

        } else if (type === 'dot') {
          if (!(window as any).Viz) {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/viz.js@2.1.2/viz.js';
            script.async = true;
            await new Promise((resolve) => {
              script.onload = resolve;
              document.head.appendChild(script);
            });

            const renderScript = document.createElement('script');
            renderScript.src = 'https://cdn.jsdelivr.net/npm/viz.js@2.1.2/full.render.js';
            renderScript.async = true;
            await new Promise((resolve) => {
              renderScript.onload = resolve;
              document.head.appendChild(renderScript);
            });
          }

          const viz = new (window as any).Viz();
          const svg = await viz.renderSVGElement(code);
          containerRef.current!.appendChild(svg);
          svg.style.maxWidth = '100%';
          svg.style.height = 'auto';
          // Auto-fit height to SVG
          setTimeout(() => {
            if (svg && wrapperRef.current) {
              const bbox = svg.getBBox();
              if (bbox.height > 0) setHeight(`${bbox.height + 48}px`); // 48px for padding/buttons
            }
          }, 100);
        }
      } catch (err: any) {
        setError(err.message || 'Render failed');
        if (containerRef.current) {
          containerRef.current.innerHTML = `
            <div class="flex items-center gap-2 p-4 text-red-600 bg-red-50 rounded">
              <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
              </svg>
              <div>
                <p class="font-medium">Failed to render ${type.toUpperCase()}</p>
                <p class="text-sm">${err.message}</p>
              </div>
            </div>
          `;
        }
      } finally {
        // Restore //console methods
        //console.info = originalInfo;
        //console.warn = originalWarn;
      }
    };

    render();
  }, [code, type]);


  const handleSave = () => {
    if (!code.trim()) {
      setError('Code cannot be empty');
      return;
    }

    if (type === 'chartjs') {
      try {
        JSON.parse(code);
        updateAttributes({ config: code });
      } catch {
        setError('Invalid JSON');
        return;
      }
    } else {
      updateAttributes({ code });
    }

    setEditing(false);
    setError(null);
  };

  const handleCancel = () => {
    if (type === 'chartjs') {
      setCode(node.attrs.config || '{}');
    } else {
      setCode(node.attrs.code || '');
    }
    setEditing(false);
    setError(null);
  };

  return (
    <NodeViewWrapper className={`relative my-6 group ${isFullscreen ? 'z-[9999]' : ''}`}>
      {/* Drag Handle for Tiptap */}
      {!isFullscreen && (
        <div 
          contentEditable={false} 
          draggable="true" 
          data-drag-handle
          className="absolute -left-8 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-blue-500 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <GripVertical className="w-5 h-5" />
        </div>
      )}

      {/* Highlight selected state */}
      <div
        ref={wrapperRef}
        className={`border rounded-lg overflow-hidden bg-white dark:bg-gray-900 shadow-sm transition-all duration-300 ${selected ? 'ring-2 ring-blue-500' : 'border-gray-200 dark:border-gray-700'
          } ${isFullscreen ? 'fixed inset-4 z-[10000] flex flex-col' : 'relative'}`}
        style={
          !isFullscreen
            ? isResizing
              ? { height }
              : { height: 'auto', minHeight: height }
            : {}
        }
      >
        {/* Action buttons */}
        <div className={`absolute top-2 right-2 flex gap-1 z-20 ${isFullscreen ? 'top-4 right-4' : ''}`}>
          {(type === 'mermaid' || type === 'dot') && (
            <div className="flex gap-1 mr-2 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-1 rounded-md border shadow-sm">
              <button
                onClick={handleZoomOut}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleResetZoom}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                title="Reset Zoom"
              >
                <RefreshCcw className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleZoomIn}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 mx-1 self-center" />
              <button
                onClick={toggleFullscreen}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
              >
                {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </button>
            </div>
          )}

          {/* Download Button */}
          <div className="relative">
            <button
              onClick={() => setIsDownloadMenuOpen(!isDownloadMenuOpen)}
              className="p-1.5 bg-white dark:bg-gray-800 border rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 shadow-sm"
              title="Download Diagram"
            >
              <Download className="w-4 h-4" />
            </button>
            
            {isDownloadMenuOpen && (
              <div className="absolute right-0 top-full mt-1 bg-white dark:bg-gray-800 border rounded-md shadow-lg z-50 w-40 py-1">
                <button
                  onClick={() => handleDownload('png')}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  Download PNG
                </button>
                {(type === 'mermaid' || type === 'dot') && (
                  <button
                    onClick={() => handleDownload('svg')}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    Download SVG
                  </button>
                )}
                <button
                  onClick={() => handleDownload('pdf')}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  Download PDF
                </button>
              </div>
            )}
          </div>

          <button
            onClick={() => setEditing(true)}
            className="p-1.5 bg-white dark:bg-gray-800 border rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 shadow-sm"
            title="Edit"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          {!isFullscreen && (
            <button
              onClick={deleteNode}
              className="p-1.5 bg-white dark:bg-gray-800 border rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 shadow-sm"
              title="Delete"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          {isFullscreen && (
            <button
              onClick={toggleFullscreen}
              className="p-1.5 bg-white dark:bg-gray-800 border rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 shadow-sm"
              title="Close Fullscreen"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          {/* Fix Diagram Button: Always show for testing */}
          <button
            onClick={() => {
              setAiFixing(true);
              setAiSuggestion(`The following diagram code caused a rendering error. Please correct the syntax for a ${type} diagram.\n\n${code}\n\nError: ${error || 'Unknown error or no error detected.'}`);
            }}
            className="p-1.5 bg-blue-50 dark:bg-blue-900 border border-blue-300 dark:border-blue-700 rounded-md hover:bg-blue-100 dark:hover:bg-blue-800 shadow-sm text-blue-700 dark:text-blue-300"
            title="AI Fix Diagram"
          >
            <Sparkles className="w-4 h-4" />
          </button>
          {error && (
            <button
              onClick={() => {
                setEditing(true);
                setError(null);
              }}
              className="p-1.5 bg-blue-50 dark:bg-blue-900 border border-blue-300 dark:border-blue-700 rounded-md hover:bg-blue-100 dark:hover:bg-blue-800 shadow-sm text-blue-700 dark:text-blue-300"
              title="Manual Edit"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Rendered diagram with Zoom/Pan support */}
        <div
          className={`flex-1 overflow-hidden flex items-center justify-center bg-gray-50/50 dark:bg-gray-950/50 ${isFullscreen ? 'p-12' : 'p-6'}`}
          style={{ isolation: 'isolate' }}
        >
          <motion.div
            ref={containerRef}
            animate={{ scale }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            drag={scale > 1}
            dragConstraints={{ left: -1000, right: 1000, top: -1000, bottom: 1000 }}
            className="cursor-grab active:cursor-grabbing"
          />
        </div>

        {/* Resize Handle */}
        {!isFullscreen && (
          <div
            onMouseDown={startResizing}
            className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize hover:bg-blue-500/30 flex items-center justify-center group/resize"
          >
            <div className="w-8 h-1 bg-gray-300 dark:bg-gray-700 rounded-full group-hover/resize:bg-blue-500 transition-colors" />
          </div>
        )}

        {/* Editor Modal */}
        {editing && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[10001] p-4">
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col border">
              <div className="flex items-center justify-between p-4 border-b">
                <div>
                  <h3 className="text-lg font-semibold">
                    Edit {type === 'chartjs' ? 'Chart.js' : type === 'mermaid' ? 'Mermaid' : 'Graphviz'}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {type === 'chartjs' && 'Enter Chart.js config as JSON'}
                    {type === 'mermaid' && 'Enter Mermaid syntax'}
                    {type === 'dot' && 'Enter DOT syntax'}
                  </p>
                </div>
                <button onClick={handleCancel} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {error && (
                <div className="mx-4 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex gap-2">
                  <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-red-800">Error</p>
                    <p className="text-sm text-red-600">{error}</p>
                  </div>
                </div>
              )}

              <textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="flex-1 m-4 p-4 font-mono text-sm bg-gray-50 dark:bg-gray-950 border rounded-lg resize-none focus:ring-2 focus:ring-blue-500"
                placeholder={
                  type === 'chartjs'
                    ? '{\n  "type": "bar",\n  "data": {...}\n}'
                    : type === 'mermaid'
                      ? 'flowchart TD\n    A --> B'
                      : 'digraph G {\n    A -> B\n}'
                }
              />

              <div className="flex justify-end gap-2 p-4 border-t bg-gray-50 dark:bg-gray-800">
                <button
                  onClick={handleCancel}
                  className="px-4 py-2 text-sm rounded-lg border bg-white dark:bg-gray-800"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-2"
                >
                  <Edit2 className="w-4 h-4" />
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Inline AI Editor for diagram fix */}
        {aiFixing && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[10002] p-4">
            <InlineAIEditor
              originalText={code}
              selectedText={code}
              selectionRange={{ from: 0, to: code.length }}
              actionType={type === 'mermaid' ? 'fix-mermaid' : type === 'dot' ? 'fix-dot' : 'fix-chartjs'}
              onAccept={() => {
                // Only close if there is a suggestion
                if (aiSuggestion && aiSuggestion !== code) {
                  setCode(aiSuggestion);
                  setAiFixing(false);
                  setError(null);
                }
              }}
              onReject={() => {
                setAiFixing(false);
              }}
              onGenerate={async (selectedText, actionType, customInstruction) => {
                // Simulate AI fix (replace with actual AI call)
                // For now, just set the suggestion to the original code
                setAiSuggestion(selectedText);
              }}
              position={{ top: 100, left: 100 }}
              isVisible={true}
              isLoading={false}
              error={null}
              generatedText={aiSuggestion}
              isTyping={false}
            />
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
};