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

// Initialize Mermaid globally once
if (typeof window !== 'undefined') {
  mermaid.initialize({
    startOnLoad: false, // This is important for manual rendering
    theme: 'base',
    securityLevel: 'strict',
  });
  (window as any).mermaid = mermaid;
  
  // Pre-load Graphviz for faster DOT rendering
  Graphviz.load().then(() => {
    //console.log('Graphviz pre-loaded successfully');
  }).catch((error) => {
    //console.warn('Graphviz pre-load failed:', error);
  });
}

// Declare global types for libraries
declare global {
  interface Window {
    mermaid: any; // Add mermaid to Window interface
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
    //console.error('Panel Error:', error, errorInfo);
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

// Enhanced HTML Renderer with better isolation using srcdoc
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

  const iframeSrcDocContent = useMemo(() => {
    const sanitizedHtml = DOMPurify.sanitize(html, {
      WHOLE_DOCUMENT: true,
      RETURN_DOM: false,
      ADD_TAGS: ['style', 'script', 'link', 'iframe', 'meta'],
      ALLOW_ARIA_ATTR: true,
      ALLOW_DATA_ATTR: true,
      ALLOW_UNKNOWN_PROTOCOLS: true,
      ADD_ATTR: ['target', 'sandbox'],
    });

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { margin: 0; padding: 0; overflow: auto; }
  </style>
</head>
<body>
  ${sanitizedHtml}
  <script>
    // Try to inherit libraries from parent window if available
    function inheritParentLibraries() {
      if (window.parent && window.parent !== window) {
        try {
          // Copy common libraries if they exist in parent
          const libsToInherit = ['THREE', 'Chart', 'mermaid', 'd3', 'Plotly', 'math'];
          libsToInherit.forEach(function(lib) {
            if (window.parent[lib] && !window[lib]) {
              window[lib] = window.parent[lib];
            }
          });
        } catch (e) {
          // Cross-origin restrictions, ignore
          //console.log('Cannot inherit parent libraries due to cross-origin restrictions');
        }
      }
    }
    
    // Inherit libraries before content loads
    inheritParentLibraries();
    
    // Post message to parent when content is loaded
    function notifyParent() {
      try {
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({ type: 'loaded' }, '*');
          //console.log('Posted loaded message to parent');
        }
      } catch (e) {
        //console.error('Failed to notify parent:', e);
      }
    }
    
    // Multiple ways to detect when page is ready
    if (document.readyState === 'complete') {
      setTimeout(notifyParent, 50);
    } else {
      window.addEventListener('load', function() {
        setTimeout(notifyParent, 50);
      });
      
      document.addEventListener('DOMContentLoaded', function() {
        setTimeout(notifyParent, 25);
      });
    }
    
    // Basic error handler for scripts within the iframe
    window.addEventListener('error', function(event) {
      const errorMessage = event.error?.message || event.message || 'Unknown error';
      
      // Only report actual JavaScript errors, not resource loading issues
      if (event.error && !errorMessage.includes('Script error')) {
        try {
          if (window.parent && window.parent !== window) {
            window.parent.postMessage({ 
              type: 'error', 
              message: errorMessage,
              filename: event.filename,
              lineno: event.lineno
            }, '*');
          }
        } catch (e) {
          //console.error('Failed to report error to parent:', e);
        }
      }
    });
    
    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', function(event) {
      try {
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({ 
            type: 'error', 
            message: event.reason?.message || 'Unhandled promise rejection'
          }, '*');
        }
      } catch (e) {
        //console.error('Failed to report promise rejection to parent:', e);
      }
    });
  </script>
</body>
</html>`;
  }, [html]);

  useEffect(() => {
    let isMounted = true;
    let loadingTimeoutId: NodeJS.Timeout;
    
    //console.log('Starting HTML load, retry count:', retryCount);
    setIsLoading(true);
    setHasError(false);

    const handleMessage = (event: MessageEvent) => {
      if (!isMounted) return;
      
      // Check if message is from our iframe
      if (event.source === iframeRef.current?.contentWindow) {
        //console.log('Received message from iframe:', event.data);
        
        if (event.data.type === 'loaded') {
          //console.log('HTML loaded successfully');
          setIsLoading(false);
          if (loadingTimeoutId) {
            clearTimeout(loadingTimeoutId);
          }
        } else if (event.data.type === 'error') {
          const errorMessage = event.data.message || '';
          
          // Be more lenient with what we consider "real" errors
          const isIgnorableError = 
            errorMessage.includes('security') || 
            errorMessage.includes('mixed content') ||
            errorMessage.includes('Content Security Policy') ||
            errorMessage.includes('Script error') ||
            errorMessage.includes('ResizeObserver') ||
            errorMessage.includes('Non-Error promise rejection captured');
          
          if (!isIgnorableError) {
            //console.error('HTML Error:', errorMessage);
            setHasError(true);
            setIsLoading(false);
            if (loadingTimeoutId) {
              clearTimeout(loadingTimeoutId);
            }
          } else {
            // For ignorable errors, just log and continue
            //console.warn('HTML Warning (ignored):', errorMessage);
          }
        }
      }
    };

    window.addEventListener('message', handleMessage);

    // Shorter timeout - 2 seconds should be plenty for static HTML since we're not loading external libraries
    loadingTimeoutId = setTimeout(() => {
      if (isMounted) {
        //console.log('HTML loading timeout reached, stopping loading indicator');
        setIsLoading(false);
      }
    }, 2000);

    // Cleanup function
    return () => {
      isMounted = false;
      //console.log('Cleaning up HTML component');
      window.removeEventListener('message', handleMessage);
      if (loadingTimeoutId) {
        clearTimeout(loadingTimeoutId);
      }
    };
  }, [html, retryCount]);

  // Handle iframe load event as additional fallback (faster timeout)
  const handleIframeLoad = useCallback(() => {
    //console.log('Iframe onLoad event fired');
    // Much shorter delay since libraries should be readily available
    setTimeout(() => {
      //console.log('Stopping loading via iframe onLoad fallback');
      setIsLoading(false);
    }, 50);
  }, []);

  if (hasError) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-red-600 bg-red-50 p-4 dark:bg-red-950/20 dark:text-red-300">
        <AlertTriangle className="h-8 w-8 mb-3" />
        <h3 className="text-lg font-semibold mb-2">HTML Rendering Error</h3>
        <p className="text-center text-sm mb-4">
          The HTML content encountered a JavaScript error. The content may still be partially functional.
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
            <Button
              onClick={() => {
                const errorMessage = hasError || 'HTML rendering error';
                // Pass error to parent for AI fixing
                if (typeof window !== 'undefined' && window.parent !== window) {
                  window.parent.postMessage({ 
                    type: 'fix-request', 
                    diagramType: 'html',
                    content: html,
                    error: errorMessage
                  }, '*');
                }
              }}
              variant="outline"
              size="sm"
              className="text-blue-600 border-blue-300 hover:bg-blue-50 dark:text-blue-400 dark:border-blue-700"
            >
              🤖 Fix with AI
            </Button>
          <details className="mt-2">
            <summary className="cursor-pointer text-sm hover:text-red-700 dark:hover:text-red-200">
              View HTML Source
            </summary>
            <pre className="mt-2 p-3 bg-white dark:bg-gray-900 border rounded text-xs overflow-auto max-h-40 w-full max-w-md">
              {html.substring(0, 1000)}{html.length > 1000 ? '...' : ''}
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
          <div className="flex flex-col items-center bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-2" />
            <p className="text-sm text-gray-600 dark:text-gray-400">Rendering HTML content...</p>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
              Attempt {retryCount + 1}
            </p>
          </div>
        </div>
      )}
      <iframe
        key={retryCount}
        ref={iframeRef}
        className="w-full h-full border-0 rounded-lg"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-popups-to-escape-sandbox"
        title="AI Generated HTML Content"
        srcDoc={iframeSrcDocContent}
        onLoad={handleIframeLoad}
      />
    </div>
  );
};

// Enhanced Mermaid Renderer with bulletproof error handling, DOM isolation, and interactive controls
const IsolatedMermaid = ({ content, onError }: { content: string; onError: (error: string | null, errorType: 'syntax' | 'rendering' | 'timeout' | 'network') => void }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<'syntax' | 'rendering' | 'timeout' | 'network'>('rendering');
  const [retryCount, setRetryCount] = useState(0);
  const timeoutRef = useRef<NodeJS.Timeout>();
  const messageListenerRef = useRef<((event: MessageEvent) => void) | null>(null);
  const uniqueIdRef = useRef<string>('');

  const handleRetry = useCallback(() => {
    setRetryCount(prev => prev + 1);
    setHasError(null);
    setIsLoading(true);
  }, []);

  const cleanup = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = undefined;
    }
    if (messageListenerRef.current) {
      window.removeEventListener('message', messageListenerRef.current);
      messageListenerRef.current = null;
    }
  }, []);

  // Make Mermaid available globally for iframe access
  useEffect(() => {
    // Ensure mermaid is available on window for iframe to access
    if (typeof window !== 'undefined' && window.mermaid) {
      // Already available
    } else if (typeof mermaid !== 'undefined') {
      (window as any).mermaid = mermaid;
    }
  }, []);

  // Prepare iframe HTML content for srcdoc with interactive controls
  const iframeSrcDocContent = useMemo(() => {
    // Generate unique ID for this render cycle
    const currentUniqueId = `mermaid_${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${retryCount}`;
    uniqueIdRef.current = currentUniqueId;

    const contentVarName = `MERMAID_CONTENT_${currentUniqueId.replace(/[^a-zA-Z0-9]/g, '_')}`;
    const idVarName = `UNIQUE_ID_${currentUniqueId.replace(/[^a-zA-Z0-9]/g, '_')}`;

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      min-height: 100vh;
      background: transparent;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      overflow: hidden;
      user-select: none;
    }
    
    .controls {
      position: absolute;
      top: 10px;
      right: 10px;
      display: flex;
      gap: 5px;
      z-index: 1000;
      background: rgba(255, 255, 255, 0.9);
      padding: 5px;
      border-radius: 6px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    
    .control-btn {
      background: #3b82f6;
      color: white;
      border: none;
      padding: 8px 12px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      transition: background 0.2s;
    }
    
    .control-btn:hover {
      background: #2563eb;
    }
    
    .control-btn:disabled {
      background: #9ca3af;
      cursor: not-allowed;
    }
    
    .container {
      position: relative;
      width: 100%;
      height: 100vh;
      overflow: hidden;
      cursor: grab;
    }
    
    .container.dragging {
      cursor: grabbing;
    }
    
    .diagram-wrapper {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      transform-origin: center center;
      transition: transform 0.2s ease;
      max-width: none;
      max-height: none;
    }
    
    .diagram-wrapper svg {
      display: block;
      max-width: none;
      max-height: none;
    }
    
    .error-display {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      color: #dc2626;
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 8px;
      padding: 20px;
      text-align: center;
      max-width: 400px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }
    
    .loading {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      color: #6b7280;
      text-align: center;
      background: rgba(255, 255, 255, 0.9);
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }
    
    .zoom-info {
      position: absolute;
      bottom: 10px;
      left: 10px;
      background: rgba(0, 0, 0, 0.7);
      color: white;
      padding: 5px 10px;
      border-radius: 4px;
      font-size: 12px;
      z-index: 1000;
    }
  </style>
</head>
<body>
  <div class="controls">
    <button class="control-btn" onclick="zoomIn()">+</button>
    <button class="control-btn" onclick="zoomOut()">−</button>
    <button class="control-btn" onclick="resetView()">Reset</button>
    <button class="control-btn" onclick="fitToScreen()">Fit</button>
  </div>
  
  <div class="container" id="container">
    <div class="loading" id="loading-indicator">
      <div>Loading Mermaid diagram...</div>
      <div style="margin-top: 10px; font-size: 11px; color: #9ca3af;">Please wait...</div>
    </div>
    <div class="diagram-wrapper" id="diagram-wrapper"></div>
  </div>
  
  <div class="zoom-info" id="zoom-info">100%</div>
  
  <script>
    (function() {
      'use strict';
      const ${contentVarName} = ${JSON.stringify(content)};
      const ${idVarName} = ${JSON.stringify(currentUniqueId)};
      const MERMAID_CONTENT = ${contentVarName};
      const UNIQUE_ID = ${idVarName};
      
      // Interactive controls state
      let currentZoom = 1;
      let panX = 0;
      let panY = 0;
      let isDragging = false;
      let lastMouseX = 0;
      let lastMouseY = 0;
      let diagramWrapper = null;
      let containerEl = null;
      
      function reportError(error, type = 'rendering') {
        //console.error('Mermaid Error in iframe:', error);
        try {
          if (window.parent && window.parent !== window) {
            window.parent.postMessage({ 
              type: 'mermaidError', 
              error: error?.message || error || 'Unknown error',
              errorType: type,
              uniqueId: UNIQUE_ID
            }, '*');
          }
        } catch (e) {
          console.error('Failed to report error to parent from iframe:', e);
        }
      }

      function reportSuccess() {
        console.log('Mermaid loaded successfully');
        try {
          if (window.parent && window.parent !== window) {
            window.parent.postMessage({ 
              type: 'mermaidLoaded',
              uniqueId: UNIQUE_ID
            }, '*');
          }
        } catch (e) {
          console.error('Failed to report success to parent from iframe:', e);
        }
      }

      function showError(message, type = 'rendering') {
        const container = document.getElementById('container');
        if (container) {
          container.innerHTML = 
            '<div class="error-display">' +
            '<h3>Mermaid ' + (type === 'syntax' ? 'Syntax' : 'Rendering') + ' Error</h3>' +
            '<p style="margin: 10px 0;">' + (message || 'Unknown error') + '</p>' +
            '<button onclick="window.location.reload()" style="margin-top: 10px; padding: 8px 16px; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer;">Retry</button>' +
            '</div>';
        }
        reportError(message, type);
      }
      
      function updateTransform() {
        if (diagramWrapper) {
          diagramWrapper.style.transform = \`translate(\${-50 + panX}%, \${-50 + panY}%) scale(\${currentZoom})\`;
          const zoomInfo = document.getElementById('zoom-info');
          if (zoomInfo) {
            zoomInfo.textContent = Math.round(currentZoom * 100) + '%';
          }
        }
      }
      
      function zoomIn() {
        currentZoom = Math.min(currentZoom * 1.2, 5);
        updateTransform();
      }
      
      function zoomOut() {
        currentZoom = Math.max(currentZoom / 1.2, 0.1);
        updateTransform();
      }
      
      function resetView() {
        currentZoom = 1;
        panX = 0;
        panY = 0;
        updateTransform();
      }
      
      function fitToScreen() {
        if (!diagramWrapper || !containerEl) return;
        
        const svg = diagramWrapper.querySelector('svg');
        if (!svg) return;
        
        const svgBox = svg.getBBox();
        const containerRect = containerEl.getBoundingClientRect();
        
        const scaleX = (containerRect.width * 0.9) / svgBox.width;
        const scaleY = (containerRect.height * 0.9) / svgBox.height;
        currentZoom = Math.min(scaleX, scaleY, 2); // Cap at 2x for readability
        
        panX = 0;
        panY = 0;
        updateTransform();
      }
      
      function setupInteractions() {
        containerEl = document.getElementById('container');
        diagramWrapper = document.getElementById('diagram-wrapper');
        
        if (!containerEl || !diagramWrapper) return;
        
        // Mouse events
        containerEl.addEventListener('mousedown', function(e) {
          if (e.target.closest('.controls')) return;
          isDragging = true;
          lastMouseX = e.clientX;
          lastMouseY = e.clientY;
          containerEl.classList.add('dragging');
          e.preventDefault();
        });
        
        document.addEventListener('mousemove', function(e) {
          if (!isDragging) return;
          
          const deltaX = (e.clientX - lastMouseX) / currentZoom;
          const deltaY = (e.clientY - lastMouseY) / currentZoom;
          
          panX += deltaX * 0.5;
          panY += deltaY * 0.5;
          
          lastMouseX = e.clientX;
          lastMouseY = e.clientY;
          
          updateTransform();
        });
        
        document.addEventListener('mouseup', function() {
          isDragging = false;
          containerEl.classList.remove('dragging');
        });
        
        // Touch events for mobile
        let lastTouchDistance = 0;
        
        containerEl.addEventListener('touchstart', function(e) {
          if (e.target.closest('.controls')) return;
          
          if (e.touches.length === 1) {
            isDragging = true;
            lastMouseX = e.touches[0].clientX;
            lastMouseY = e.touches[0].clientY;
          } else if (e.touches.length === 2) {
            const touch1 = e.touches[0];
            const touch2 = e.touches[1];
            lastTouchDistance = Math.sqrt(
              Math.pow(touch2.clientX - touch1.clientX, 2) + 
              Math.pow(touch2.clientY - touch1.clientY, 2)
            );
          }
          e.preventDefault();
        });
        
        containerEl.addEventListener('touchmove', function(e) {
          if (e.touches.length === 1 && isDragging) {
            const deltaX = (e.touches[0].clientX - lastMouseX) / currentZoom;
            const deltaY = (e.touches[0].clientY - lastMouseY) / currentZoom;
            
            panX += deltaX * 0.5;
            panY += deltaY * 0.5;
            
            lastMouseX = e.touches[0].clientX;
            lastMouseY = e.touches[0].clientY;
            
            updateTransform();
          } else if (e.touches.length === 2) {
            const touch1 = e.touches[0];
            const touch2 = e.touches[1];
            const currentDistance = Math.sqrt(
              Math.pow(touch2.clientX - touch1.clientX, 2) + 
              Math.pow(touch2.clientY - touch1.clientY, 2)
            );
            
            const scale = currentDistance / lastTouchDistance;
            currentZoom = Math.min(Math.max(currentZoom * scale, 0.1), 5);
            lastTouchDistance = currentDistance;
            
            updateTransform();
          }
          e.preventDefault();
        });
        
        containerEl.addEventListener('touchend', function(e) {
          isDragging = false;
          if (e.touches.length < 2) {
            lastTouchDistance = 0;
          }
        });
        
        // Mouse wheel zoom
        containerEl.addEventListener('wheel', function(e) {
          e.preventDefault();
          const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
          currentZoom = Math.min(Math.max(currentZoom * zoomFactor, 0.1), 5);
          updateTransform();
        });
        
        // Double-click to fit
        containerEl.addEventListener('dblclick', function(e) {
          if (e.target.closest('.controls')) return;
          fitToScreen();
        });
        
        // Make functions available globally for buttons
        window.zoomIn = zoomIn;
        window.zoomOut = zoomOut;
        window.resetView = resetView;
        window.fitToScreen = fitToScreen;
      }

      function loadMermaid() {
        return new Promise(function(resolve, reject) {
          if (window.mermaid) {
            resolve();
            return;
          }
          
          // Try to get Mermaid from parent window first (much faster)
          try {
            if (window.parent && window.parent.mermaid) {
              window.mermaid = window.parent.mermaid;
              resolve();
              return;
            }
          } catch (e) {
            // Cross-origin restriction, fall back to CDN
          }
          
          // Fallback to CDN with shorter timeout
          const script = document.createElement('script');
          script.src = 'https://cdn.jsdelivr.net/npm/mermaid@10.6.1/dist/mermaid.min.js';
          script.onload = function() {
            if (window.mermaid) {
              resolve();
            } else {
              reject(new Error('Mermaid library loaded but not available'));
            }
          };
          script.onerror = function() {
            reject(new Error('Failed to load Mermaid library from CDN'));
          };
          document.head.appendChild(script);
          
          // Reduced timeout since parent check failed
          setTimeout(function() {
            if (!window.mermaid) {
              reject(new Error('Mermaid library load timeout - please check your connection'));
            }
          }, 5000);
        });
      }

      function renderMermaid() {
        if (!MERMAID_CONTENT || !MERMAID_CONTENT.trim()) {
          showError('Empty or invalid Mermaid content', 'syntax');
          return;
        }

        loadMermaid().then(function() {
          if (!window.mermaid) { 
            throw new Error('Mermaid not available'); 
          }
          
          // Configure mermaid with better settings
          window.mermaid.initialize({
            startOnLoad: false,
            theme: 'base',
            themeVariables: {
              primaryColor: '#3b82f6',
              primaryTextColor: '#1f2937',
              primaryBorderColor: '#2563eb',
              secondaryColor: '#10b981',
              tertiaryColor: '#f59e0b',
              background: '#ffffff',
              mainBkg: '#ffffff',
              secondBkg: '#f3f4f6',
              tertiaryBkg: '#e5e7eb'
            },
            flowchart: { 
              useMaxWidth: false, 
              htmlLabels: true, 
              curve: 'basis' 
            },
            sequence: { 
              useMaxWidth: false, 
              wrap: true 
            },
            securityLevel: 'strict',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            fontSize: 14
          });
          
          return window.mermaid.parse(MERMAID_CONTENT);
        }).then(function() {
          const loadingIndicator = document.getElementById('loading-indicator');
          if (loadingIndicator) { 
            loadingIndicator.remove(); 
          }
          
          const diagramId = 'mermaid-svg-' + Date.now();
          return window.mermaid.render(diagramId, MERMAID_CONTENT);
        }).then(function(result) {
          const svg = result.svg || result;
          if (!svg || svg.trim().length === 0) { 
            throw new Error('Mermaid rendered empty SVG'); 
          }
          
          const diagramWrapper = document.getElementById('diagram-wrapper');
          if (diagramWrapper) { 
            diagramWrapper.innerHTML = svg; 
            
            // Setup interactive controls after rendering
            setTimeout(function() {
              setupInteractions();
              updateTransform();
              // Auto-fit diagram to screen on load
              setTimeout(fitToScreen, 100);
            }, 50);
          }
          
          reportSuccess();
        }).catch(function(error) {
          const errorMessage = error.message || 'Unknown rendering error';
          const isActualError = errorMessage.includes('Syntax error') || 
                               errorMessage.includes('Parse error') || 
                               errorMessage.includes('Failed to load') ||
                               errorMessage.includes('rendered empty SVG') ||
                               errorMessage.includes('timeout');
          
          if (isActualError) {
            const errorType = errorMessage.toLowerCase().includes('syntax') || 
                             errorMessage.toLowerCase().includes('parse') ? 'syntax' : 'rendering';
            showError(errorMessage, errorType);
          } else {
            console.warn('Mermaid minor issue:', errorMessage);
            reportSuccess();
          }
        });
      }

      // Start rendering when DOM is ready
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
          setTimeout(renderMermaid, 50);
        });
      } else {
        setTimeout(renderMermaid, 50);
      }
    })();
  </script>
</body>
</html>`;
  }, [content, retryCount]);

  useEffect(() => {
    // Cleanup previous listeners and timeouts
    cleanup();

    if (!content?.trim()) {
      setHasError('No content provided');
      setErrorType('syntax');
      setIsLoading(false);
      if (onError) onError('No content provided', 'syntax');
      return;
    }

    //console.log('Starting Mermaid render, retry count:', retryCount);
    setIsLoading(true);
    setHasError(null);
    if (onError) onError(null, 'rendering');

    // Set up message listener for communication from iframe
    const handleMessage = (event: MessageEvent) => {
      // Allow messages from iframe (null origin due to srcdoc)
      if (event.source === iframeRef.current?.contentWindow) {
        const { type, error, errorType, uniqueId: messageUniqueId } = event.data;

        // Verify message is from current iframe instance
        if (messageUniqueId !== uniqueIdRef.current) return;

        //console.log('Received Mermaid message:', { type, error, errorType });

        if (type === 'mermaidLoaded') {
          cleanup();
          setIsLoading(false);
          setHasError(null);
          if (onError) onError(null, 'rendering');
        } else if (type === 'mermaidError') {
          cleanup();
          const finalErrorType = errorType || 'rendering';
          setHasError(error);
          setErrorType(finalErrorType);
          setIsLoading(false);
          if (onError) onError(error, finalErrorType);
        }
      }
    };

    messageListenerRef.current = handleMessage;
    window.addEventListener('message', handleMessage);

    // Timeout for overall rendering process (reduced since we're using parent's Mermaid)
    timeoutRef.current = setTimeout(() => {
      //console.log('Mermaid rendering timeout');
      const timeoutError = "Mermaid rendering timed out. This might be due to a complex diagram or network issues.";
      setHasError(timeoutError);
      setErrorType('timeout');
      setIsLoading(false);
      if (onError) onError(timeoutError, 'timeout');
      cleanup();
    }, 10000);

    return cleanup;
  }, [content, retryCount, onError, cleanup]);

  return (
    <div className="relative w-full h-full">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/95 dark:bg-gray-900/95 z-10">
          <div className="flex flex-col items-center bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-3" />
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
              Rendering Mermaid diagram...
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-500">
              Attempt {retryCount + 1} • Using optimized libraries • Interactive controls will be available
            </p>
          </div>
        </div>
      )}
      
      <iframe
        key={uniqueIdRef.current}
        ref={iframeRef}
        className="w-full h-full border-0 rounded-lg bg-transparent"
        sandbox="allow-scripts allow-same-origin"
        title="Interactive Mermaid Diagram"
        style={{ minHeight: '300px' }}
        srcDoc={iframeSrcDocContent}
      />
      
      {hasError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-50/95 dark:bg-red-950/95 text-red-600 dark:text-red-300 p-4 z-20">
          <AlertTriangle className="h-12 w-12 mb-4 text-red-500" />
          <h3 className="text-lg font-semibold mb-2">
            Mermaid {errorType === 'syntax' ? 'Syntax' : errorType === 'timeout' ? 'Timeout' : errorType === 'network' ? 'Network' : 'Rendering'} Error
          </h3>
          <p className="text-center text-sm mb-6 max-w-md">
            {hasError}
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={handleRetry}
              variant="outline"
              size="sm"
              className="text-red-600 border-red-300 hover:bg-red-50 dark:text-red-400 dark:border-red-700"
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Retry ({retryCount + 1})
            </Button>
            <details className="mt-2">
              <summary className="cursor-pointer text-sm hover:text-red-700 dark:hover:text-red-200">
                View Mermaid Source
              </summary>
              <pre className="mt-2 p-3 bg-white dark:bg-gray-900 border rounded text-xs overflow-auto max-h-40 w-full max-w-md">
                {content.substring(0, 500)}{content.length > 500 ? '...' : ''}
              </pre>
            </details>
          </div>
          {errorType === 'syntax' && (
            <div className="mt-4 text-xs text-gray-600 dark:text-gray-400 bg-white/50 dark:bg-gray-800/50 p-3 rounded max-w-md">
              <p className="font-medium mb-2">Common Mermaid syntax issues:</p>
              <ul className="list-disc list-inside space-y-1 text-left">
                <li>Missing diagram type declaration (e.g., \`graph TD\`, \`sequenceDiagram\`)</li>
                <li>Invalid node or edge syntax</li>
                <li>Unclosed quotes or brackets</li>
                <li>Reserved keywords used as node names</li>
              </ul>
            </div>
          )}
        </div>
      )}
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
        //console.error("Error rendering Chart.js:", error);
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
  const [canvasScale, setCanvasScale] = useState(1);

  useEffect(() => {
    if (canvasRef.current && codeContent) {
      setIsRendering(true);

      if (threeJsCleanupRef.current) {
        try {
          threeJsCleanupRef.current();
        } catch (error) {
          //console.warn('Cleanup failed:', error);
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
              //console.warn('Scene cleanup failed:', error);
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
        //console.error("Error rendering Three.js scene:", error);
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
          //console.warn('Cleanup failed during unmount:', error);
        }
        threeJsCleanupRef.current = null;
      }
    };
  }, [codeContent, canvasRef, onInvalidCode, onSceneReady, resetCamera]);

  const handleResetCamera = useCallback(() => {
    setResetCamera(prev => prev + 1);
  }, []);

  const handleZoomIn = useCallback(() => {
    setCanvasScale(prev => Math.min(3, prev + 0.25));
  }, []);

  const handleZoomOut = useCallback(() => {
    setCanvasScale(prev => Math.max(0.25, prev - 0.25));
  }, []);

  const handleResetZoom = useCallback(() => {
    setCanvasScale(1);
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
          //console.warn('Failed to highlight code:', error);
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
    document.execCommand('copy');
    toast.success('Code copied to clipboard');
  }, [content]);

  return (
    <div className="flex flex-col h-full">
      {/* {showControls && (
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
      )} */}

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
            {type === 'dot' && 'Graphviz Controls:'}
            {/* {type === 'html' && 'Web Controls:'} */}
            {type === 'image' && 'Image Controls:'}
          </span>

          {( type === 'dot') && (
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

          {/* {type === 'html' && (
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
          )} */}
        </div>

        {/* Advanced controls panel */}
        {/* {showAdvancedControls && type === 'html' && (
          <div className="w-full mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-gray-600 dark:text-gray-400">Advanced:</span>
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
        )} */}
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
          //console.error('GLTF export error:', error);
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

    // Explicitly block PDF download for mermaid and html due to security restrictions
    // with html2canvas and sandboxed iframes.
    if (diagramType === 'mermaid' || diagramType === 'html') {
      toast.error('PDF export of rendered diagrams is not supported for this type due to browser security limitations.');
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

      // This block will now only be reached for types like chartjs, threejs, or code/text if direct HTML capture is desired.
      // For chartjs and threejs, the canvas element is directly available.
      if (diagramType === 'chartjs' && chartRef.current) {
        canvas = await html2canvas(chartRef.current, {
          scale: 2, useCORS: true, backgroundColor: '#ffffff'
        });
      } else if (diagramType === 'threejs' && threeJsRef.current) {
        canvas = await html2canvas(threeJsRef.current, {
          scale: 2, useCORS: true, backgroundColor: '#ffffff'
        });
      }
      else {
        // Fallback for other types, directly capture the container.
        // This will work for code/text displays rendered as HTML, but not for iframes.
        canvas = await html2canvas(diagramContainerRef.current, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
          width: diagramContainerRef.current.offsetWidth,
          height: diagramContainerRef.current.offsetHeight,
          windowWidth: diagramContainerRef.current.offsetWidth,
          windowHeight: diagramContainerRef.current.offsetHeight,
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

      const fileName = diagramType === 'code' ? 'webpage.pdf' : `${diagramType}-export.pdf`;
      pdf.save(fileName);
      toast.success('PDF downloaded successfully!');
    } catch (error) {
      //console.error('Error generating PDF:', error);
      toast.error('Failed to generate PDF. Please try again.');
    }
  }, [diagramType, chartRef, threeJsRef]);


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
      
      // Try to use pre-loaded Graphviz first
      const renderDot = () => {
        return Graphviz.load().then((graphviz) => {
          try {
            const svg = graphviz.dot(diagramContent);
            setDotSvg(svg);
            setDotError(null);
            setNetworkError(false);
          } catch (error: any) {
            //console.error('Error rendering DOT graph:', error);
            setDotError(`Failed to render DOT graph: ${error.message}`);
          } finally {
            setIsDotLoading(false);
          }
        }).catch((error) => {
          //console.error('Error loading Graphviz:', error);
          setDotError('Failed to load Graphviz library.');
          setIsDotLoading(false);
          setNetworkError(true);
        });
      };

      // If Graphviz is already loaded, render immediately, otherwise load first
      renderDot();
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
                    className="mt-2 text-red-700 hover:text-red-900 dark:text-red-300 dark:hover:text-red-100"
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
        //console.error('Invalid Chart.js configuration:', error);
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
                      className="mt-2 text-red-700 hover:text-red-900 dark:text-red-300 dark:hover:text-red-100"
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
                      className="mt-2 text-red-700 hover:text-red-900 dark:text-red-300 dark:hover:text-red-100"
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
            //console.error('Panel content error:', error);
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
  liveContent?: string;
}
