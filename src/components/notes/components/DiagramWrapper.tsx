// src/components/notes/components/DiagramWrapper.tsx
import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';
import { Chart, ChartConfiguration } from 'chart.js';
import { Edit2, X, AlertCircle } from 'lucide-react';
import { NodeViewWrapper, NodeViewContent } from '@tiptap/react';

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
  const chartInstanceRef = useRef<Chart | null>(null);
  const [editing, setEditing] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const type = node.type.name; // chartjs | mermaid | dot

  // Initialize code
  useEffect(() => {
    if (type === 'chartjs') {
      setCode(node.attrs.config || '{}');
    } else if (type === 'mermaid' || type === 'dot') {
      setCode(node.attrs.code || '');
    }
  }, [node.attrs, type]);

  // Cleanup chart
  useEffect(() => {
    return () => {
      chartInstanceRef.current?.destroy();
    };
  }, []);

  // Render diagram
  useEffect(() => {
    const render = async () => {
      setError(null);
      chartInstanceRef.current?.destroy();
      if (containerRef.current) containerRef.current.innerHTML = '';

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

        } else if (type === 'mermaid') {
          // ✅ Safe, isolated Mermaid rendering
          mermaid.initialize({
            startOnLoad: false,
            theme: 'default',
            securityLevel: 'loose',
            logLevel: 1,
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
            }

            setError(null);
          } catch (mermaidErr: any) {
            ////console.warn('⚠️ Mermaid isolated render error:', mermaidErr);

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
    <NodeViewWrapper className="relative my-4">
      {/* Highlight selected state */}
      <div
        className={`border rounded-lg overflow-hidden bg-white dark:bg-gray-900 shadow-sm ${selected ? 'ring-2 ring-blue-500' : 'border-gray-200 dark:border-gray-700'
          }`}
      >
        {/* Action buttons */}
        <div className="absolute top-2 right-2 flex gap-1 z-10">
          <button
            onClick={() => setEditing(true)}
            className="p-1.5 bg-white dark:bg-gray-800 border rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 shadow-sm"
            title="Edit"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={deleteNode}
            className="p-1.5 bg-white dark:bg-gray-800 border rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 shadow-sm"
            title="Delete"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Rendered diagram */}
        <div
          ref={containerRef}
          className="p-6 min-h-[200px] flex items-center justify-center"
          style={{ isolation: 'isolate' }}
        />

        {/* Editor Modal */}
        {editing && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
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
      </div>
    </NodeViewWrapper>
  );
};