// src/components/DiagramPanel.tsx
import React, { useRef, useEffect, useState, useCallback, memo, useMemo } from 'react';
import { Button } from './ui/button';
import { X, RefreshCw, AlertTriangle, Code, ChevronRight, ChevronLeft, Download, GripVertical, Loader2, Palette, Sun, Moon } from 'lucide-react';
import { toast } from 'sonner';
import { Chart, registerables } from 'chart.js';
import Mermaid from './Mermaid'; // Assuming Mermaid.tsx is in the same components folder
import { Graphviz } from '@hpcc-js/wasm'; // Import Graphviz

// Import lowlight and language types for syntax highlighting
import { lowlight } from 'lowlight';
import { LanguageFn } from 'highlight.js';
import javascript from 'highlight.js/lib/languages/javascript';
import python from 'highlight.js/lib/languages/python';
import java from 'highlight.js/lib/languages/java';
import cpp from 'highlight.js/lib/languages/cpp';
import sql from 'highlight.js/lib/languages/sql';
import xml from 'highlight.js/lib/languages/xml';
import bash from 'highlight.js/lib/languages/bash';
import json from 'highlight.js/lib/languages/json';
import css from 'highlight.js/lib/languages/css';
import typescript from 'highlight.js/lib/languages/typescript';

// Ensure Chart.js components are registered once
Chart.register(...registerables);

// Declare global types for libraries loaded via CDN (if not already in a global d.ts)
declare global {
  interface Window {
    jspdf: any; // jsPDF library
    html2canvas: any; // html2canvas library
  }
}

// Register syntax highlighting languages
const registerLanguages = () => {
  try {
    lowlight.registerLanguage('javascript', javascript as LanguageFn);
    lowlight.registerLanguage('js', javascript as LanguageFn);
    lowlight.registerLanguage('python', python as LanguageFn);
    lowlight.registerLanguage('py', python as LanguageFn);
    lowlight.registerLanguage('java', java as LanguageFn);
    lowlight.registerLanguage('cpp', cpp as LanguageFn);
    lowlight.registerLanguage('c++', cpp as LanguageFn);
    lowlight.registerLanguage('sql', sql as LanguageFn);
    lowlight.registerLanguage('xml', xml as LanguageFn);
    lowlight.registerLanguage('html', xml as LanguageFn);
    lowlight.registerLanguage('bash', bash as LanguageFn);
    lowlight.registerLanguage('shell', bash as LanguageFn);
    lowlight.registerLanguage('json', json as LanguageFn);
    lowlight.registerLanguage('css', css as LanguageFn);
    lowlight.registerLanguage('typescript', typescript as LanguageFn);
    lowlight.registerLanguage('ts', typescript as LanguageFn);
  } catch (error) {
    console.warn('Error registering syntax highlighting languages:', error);
  }
};

registerLanguages();

// Enhanced syntax highlighting themes
const themes = {
  'github-light': {
    background: '#ffffff',
    foreground: '#24292f',
    lineNumbers: '#656d76',
    selection: '#0969da1a',
    border: '#d1d9e0',
    colors: {
      'hljs-comment': '#6e7781',
      'hljs-quote': '#6e7781',
      'hljs-keyword': '#cf222e',
      'hljs-selector-tag': '#116329',
      'hljs-subst': '#24292f',
      'hljs-built_in': '#0550ae',
      'hljs-type': '#953800',
      'hljs-class': '#953800',
      'hljs-string': '#0a3069',
      'hljs-title': '#8250df',
      'hljs-section': '#0550ae',
      'hljs-number': '#0550ae',
      'hljs-literal': '#0550ae',
      'hljs-boolean': '#0550ae',
      'hljs-variable': '#e36209',
      'hljs-template-variable': '#e36209',
      'hljs-function': '#8250df',
      'hljs-name': '#8250df',
      'hljs-params': '#24292f',
      'hljs-attr': '#116329',
      'hljs-attribute': '#116329',
      'hljs-tag': '#116329',
      'hljs-selector-id': '#0550ae',
      'hljs-selector-class': '#6f42c1',
      'hljs-selector-attr': '#0550ae',
      'hljs-selector-pseudo': '#0550ae',
      'hljs-operator': '#cf222e',
      'hljs-symbol': '#cf222e',
      'hljs-bullet': '#cf222e',
      'hljs-regexp': '#116329',
      'hljs-meta': '#8250df',
      'hljs-meta-keyword': '#cf222e',
      'hljs-meta-string': '#0a3069',
      'hljs-addition': '#116329',
      'hljs-deletion': '#82071e',
    }
  },
  'github-dark': {
    background: '#0d1117',
    foreground: '#e6edf3',
    lineNumbers: '#7d8590',
    selection: '#388bfd26',
    border: '#30363d',
    colors: {
      'hljs-comment': '#8b949e',
      'hljs-quote': '#8b949e',
      'hljs-keyword': '#ff7b72',
      'hljs-selector-tag': '#7ee787',
      'hljs-subst': '#e6edf3',
      'hljs-built_in': '#79c0ff',
      'hljs-type': '#ffa657',
      'hljs-class': '#ffa657',
      'hljs-string': '#a5d6ff',
      'hljs-title': '#d2a8ff',
      'hljs-section': '#79c0ff',
      'hljs-number': '#79c0ff',
      'hljs-literal': '#79c0ff',
      'hljs-boolean': '#79c0ff',
      'hljs-variable': '#ffa657',
      'hljs-template-variable': '#ffa657',
      'hljs-function': '#d2a8ff',
      'hljs-name': '#d2a8ff',
      'hljs-params': '#e6edf3',
      'hljs-attr': '#7ee787',
      'hljs-attribute': '#7ee787',
      'hljs-tag': '#7ee787',
      'hljs-selector-id': '#79c0ff',
      'hljs-selector-class': '#d2a8ff',
      'hljs-selector-attr': '#79c0ff',
      'hljs-selector-pseudo': '#79c0ff',
      'hljs-operator': '#ff7b72',
      'hljs-symbol': '#ff7b72',
      'hljs-bullet': '#ff7b72',
      'hljs-regexp': '#7ee787',
      'hljs-meta': '#d2a8ff',
      'hljs-meta-keyword': '#ff7b72',
      'hljs-meta-string': '#a5d6ff',
      'hljs-addition': '#aff5b4',
      'hljs-deletion': '#ffdcd7',
    }
  },
  'monokai': {
    background: '#272822',
    foreground: '#f8f8f2',
    lineNumbers: '#75715e',
    selection: '#49483e',
    border: '#3e3d32',
    colors: {
      'hljs-comment': '#75715e',
      'hljs-quote': '#75715e',
      'hljs-keyword': '#f92672',
      'hljs-selector-tag': '#f92672',
      'hljs-subst': '#f8f8f2',
      'hljs-built_in': '#66d9ef',
      'hljs-type': '#66d9ef',
      'hljs-class': '#a6e22e',
      'hljs-string': '#e6db74',
      'hljs-title': '#a6e22e',
      'hljs-section': '#a6e22e',
      'hljs-number': '#ae81ff',
      'hljs-literal': '#ae81ff',
      'hljs-boolean': '#ae81ff',
      'hljs-variable': '#f8f8f2',
      'hljs-template-variable': '#f8f8f2',
      'hljs-function': '#a6e22e',
      'hljs-name': '#a6e22e',
      'hljs-params': '#fd971f',
      'hljs-attr': '#a6e22e',
      'hljs-attribute': '#a6e22e',
      'hljs-tag': '#f92672',
      'hljs-selector-id': '#a6e22e',
      'hljs-selector-class': '#a6e22e',
      'hljs-selector-attr': '#66d9ef',
      'hljs-selector-pseudo': '#66d9ef',
      'hljs-operator': '#f92672',
      'hljs-symbol': '#f92672',
      'hljs-bullet': '#f92672',
      'hljs-regexp': '#e6db74',
      'hljs-meta': '#75715e',
      'hljs-meta-keyword': '#f92672',
      'hljs-meta-string': '#e6db74',
      'hljs-addition': '#a6e22e',
      'hljs-deletion': '#f92672',
    }
  },
  'dracula': {
    background: '#282a36',
    foreground: '#f8f8f2',
    lineNumbers: '#6272a4',
    selection: '#44475a',
    border: '#44475a',
    colors: {
      'hljs-comment': '#6272a4',
      'hljs-quote': '#6272a4',
      'hljs-keyword': '#ff79c6',
      'hljs-selector-tag': '#ff79c6',
      'hljs-subst': '#f8f8f2',
      'hljs-built_in': '#8be9fd',
      'hljs-type': '#8be9fd',
      'hljs-class': '#50fa7b',
      'hljs-string': '#f1fa8c',
      'hljs-title': '#50fa7b',
      'hljs-section': '#50fa7b',
      'hljs-number': '#bd93f9',
      'hljs-literal': '#bd93f9',
      'hljs-boolean': '#bd93f9',
      'hljs-variable': '#f8f8f2',
      'hljs-template-variable': '#f8f8f2',
      'hljs-function': '#50fa7b',
      'hljs-name': '#50fa7b',
      'hljs-params': '#ffb86c',
      'hljs-attr': '#50fa7b',
      'hljs-attribute': '#50fa7b',
      'hljs-tag': '#ff79c6',
      'hljs-selector-id': '#50fa7b',
      'hljs-selector-class': '#50fa7b',
      'hljs-selector-attr': '#8be9fd',
      'hljs-selector-pseudo': '#8be9fd',
      'hljs-operator': '#ff79c6',
      'hljs-symbol': '#ff79c6',
      'hljs-bullet': '#ff79c6',
      'hljs-regexp': '#f1fa8c',
      'hljs-meta': '#6272a4',
      'hljs-meta-keyword': '#ff79c6',
      'hljs-meta-string': '#f1fa8c',
      'hljs-addition': '#50fa7b',
      'hljs-deletion': '#ff5555',
    }
  },
  'nord': {
    background: '#2e3440',
    foreground: '#d8dee9',
    lineNumbers: '#616e88',
    selection: '#434c5e',
    border: '#3b4252',
    colors: {
      'hljs-comment': '#616e88',
      'hljs-quote': '#616e88',
      'hljs-keyword': '#81a1c1',
      'hljs-selector-tag': '#81a1c1',
      'hljs-subst': '#d8dee9',
      'hljs-built_in': '#88c0d0',
      'hljs-type': '#88c0d0',
      'hljs-class': '#a3be8c',
      'hljs-string': '#a3be8c',
      'hljs-title': '#8fbcbb',
      'hljs-section': '#8fbcbb',
      'hljs-number': '#b48ead',
      'hljs-literal': '#b48ead',
      'hljs-boolean': '#b48ead',
      'hljs-variable': '#d8dee9',
      'hljs-template-variable': '#d8dee9',
      'hljs-function': '#8fbcbb',
      'hljs-name': '#8fbcbb',
      'hljs-params': '#d08770',
      'hljs-attr': '#8fbcbb',
      'hljs-attribute': '#8fbcbb',
      'hljs-tag': '#81a1c1',
      'hljs-selector-id': '#8fbcbb',
      'hljs-selector-class': '#8fbcbb',
      'hljs-selector-attr': '#88c0d0',
      'hljs-selector-pseudo': '#88c0d0',
      'hljs-operator': '#81a1c1',
      'hljs-symbol': '#81a1c1',
      'hljs-bullet': '#81a1c1',
      'hljs-regexp': '#a3be8c',
      'hljs-meta': '#616e88',
      'hljs-meta-keyword': '#81a1c1',
      'hljs-meta-string': '#a3be8c',
      'hljs-addition': '#a3be8c',
      'hljs-deletion': '#bf616a',
    }
  },
  'one-dark': {
    background: '#1e2127',
    foreground: '#abb2bf',
    lineNumbers: '#636d83',
    selection: '#2c323d',
    border: '#2c323d',
    colors: {
      'hljs-comment': '#5c6370',
      'hljs-quote': '#5c6370',
      'hljs-keyword': '#c678dd',
      'hljs-selector-tag': '#e06c75',
      'hljs-subst': '#abb2bf',
      'hljs-built_in': '#e6c07b',
      'hljs-type': '#e6c07b',
      'hljs-class': '#e6c07b',
      'hljs-string': '#98c379',
      'hljs-title': '#61afef',
      'hljs-section': '#61afef',
      'hljs-number': '#d19a66',
      'hljs-literal': '#56b6c2',
      'hljs-boolean': '#56b6c2',
      'hljs-variable': '#e06c75',
      'hljs-template-variable': '#e06c75',
      'hljs-function': '#61afef',
      'hljs-name': '#61afef',
      'hljs-params': '#abb2bf',
      'hljs-attr': '#d19a66',
      'hljs-attribute': '#d19a66',
      'hljs-tag': '#e06c75',
      'hljs-selector-id': '#61afef',
      'hljs-selector-class': '#d19a66',
      'hljs-selector-attr': '#56b6c2',
      'hljs-selector-pseudo': '#56b6c2',
      'hljs-operator': '#56b6c2',
      'hljs-symbol': '#56b6c2',
      'hljs-bullet': '#56b6c2',
      'hljs-regexp': '#98c379',
      'hljs-meta': '#61afef',
      'hljs-meta-keyword': '#c678dd',
      'hljs-meta-string': '#98c379',
      'hljs-addition': '#98c379',
      'hljs-deletion': '#e06c75',
    }
  },
  'solarized-light': {
    background: '#fdf6e3',
    foreground: '#657b83',
    lineNumbers: '#93a1a1',
    selection: '#eee8d5',
    border: '#eee8d5',
    colors: {
      'hljs-comment': '#93a1a1',
      'hljs-quote': '#93a1a1',
      'hljs-keyword': '#859900',
      'hljs-selector-tag': '#859900',
      'hljs-subst': '#657b83',
      'hljs-built_in': '#b58900',
      'hljs-type': '#b58900',
      'hljs-class': '#268bd2',
      'hljs-string': '#2aa198',
      'hljs-title': '#268bd2',
      'hljs-section': '#268bd2',
      'hljs-number': '#d33682',
      'hljs-literal': '#d33682',
      'hljs-boolean': '#d33682',
      'hljs-variable': '#cb4b16',
      'hljs-template-variable': '#cb4b16',
      'hljs-function': '#268bd2',
      'hljs-name': '#268bd2',
      'hljs-params': '#657b83',
      'hljs-attr': '#268bd2',
      'hljs-attribute': '#268bd2',
      'hljs-tag': '#859900',
      'hljs-selector-id': '#268bd2',
      'hljs-selector-class': '#268bd2',
      'hljs-selector-attr': '#2aa198',
      'hljs-selector-pseudo': '#2aa198',
      'hljs-operator': '#859900',
      'hljs-symbol': '#859900',
      'hljs-bullet': '#859900',
      'hljs-regexp': '#2aa198',
      'hljs-meta': '#268bd2',
      'hljs-meta-keyword': '#859900',
      'hljs-meta-string': '#2aa198',
      'hljs-addition': '#859900',
      'hljs-deletion': '#dc322f',
    }
  },
  'tokyo-night': {
    background: '#1a1b26',
    foreground: '#9aa5ce',
    lineNumbers: '#565f89',
    selection: '#364a82',
    border: '#24283b',
    colors: {
      'hljs-comment': '#565f89',
      'hljs-quote': '#565f89',
      'hljs-keyword': '#bb9af7',
      'hljs-selector-tag': '#f7768e',
      'hljs-subst': '#9aa5ce',
      'hljs-built_in': '#e0af68',
      'hljs-type': '#e0af68',
      'hljs-class': '#9ece6a',
      'hljs-string': '#9ece6a',
      'hljs-title': '#7aa2f7',
      'hljs-section': '#7aa2f7',
      'hljs-number': '#ff9e64',
      'hljs-literal': '#ff9e64',
      'hljs-boolean': '#ff9e64',
      'hljs-variable': '#f7768e',
      'hljs-template-variable': '#f7768e',
      'hljs-function': '#7aa2f7',
      'hljs-name': '#7aa2f7',
      'hljs-params': '#9aa5ce',
      'hljs-attr': '#73daca',
      'hljs-attribute': '#73daca',
      'hljs-tag': '#f7768e',
      'hljs-selector-id': '#7aa2f7',
      'hljs-selector-class': '#9ece6a',
      'hljs-selector-attr': '#73daca',
      'hljs-selector-pseudo': '#73daca',
      'hljs-operator': '#89ddff',
      'hljs-symbol': '#89ddff',
      'hljs-bullet': '#89ddff',
      'hljs-regexp': '#9ece6a',
      'hljs-meta': '#7aa2f7',
      'hljs-meta-keyword': '#bb9af7',
      'hljs-meta-string': '#9ece6a',
      'hljs-addition': '#9ece6a',
      'hljs-deletion': '#f7768e',
    }
  }
};

type ThemeName = keyof typeof themes;

// Helper to escape HTML for plain text display
const escapeHtml = (text: string) => {
  const map: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
};

// Helper to convert Lowlight result to HTML with theme support
const toHtml = (result: any, theme: typeof themes[ThemeName]) => {
  const nodeToHtml = (node: any): string => {
    if (node.type === 'text') {
      return escapeHtml(node.value);
    }
    if (node.type === 'element') {
      const { tagName, properties, children } = node;
      const classNames = (properties?.className || []).join(' ');

      let style = '';
      classNames.split(' ').forEach(cls => {
        if (theme.colors[cls as keyof typeof theme.colors]) {
          style += `color: ${theme.colors[cls as keyof typeof theme.colors]}; `;
        }
      });
      
      const childrenHtml = children?.map(nodeToHtml).join('') || '';
      return `<${tagName}${style ? ` style="${style.trim()}"` : ''}>${childrenHtml}</${tagName}>`;
    }
    return '';
  };
  return result.children.map(nodeToHtml).join('');
};

// Enhanced syntax highlighting function with theme support
const highlightCode = (code: string, language: string, theme: typeof themes[ThemeName]) => {
  try {
    const result = lowlight.highlight(language, code);
    return toHtml(result, theme);
  } catch (error) {
    console.warn('Syntax highlighting failed:', error);
    return escapeHtml(code);
  }
};

// Chart.js Renderer Component
interface ChartRendererProps {
  chartConfig: any;
  chartRef: React.RefObject<HTMLCanvasElement>;
  onInvalidConfig: (error: string) => void;
}

const ChartRenderer: React.FC<ChartRendererProps> = memo(({ chartConfig, chartRef, onInvalidConfig }) => {
  const chartInstance = useRef<Chart | null>(null);
  const [chartFontSize, setChartFontSize] = useState(12);

  const calculateFontSize = useCallback(() => {
    const width = window.innerWidth;
    if (width < 640) return 7;
    else if (width < 1024) return 9;
    else return 12;
  }, []);

  useEffect(() => {
    setChartFontSize(calculateFontSize());
    const handleResize = () => setChartFontSize(calculateFontSize());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [calculateFontSize]);

  useEffect(() => {
    if (!chartRef.current) return;

    if (chartInstance.current) {
      chartInstance.current.destroy();
      chartInstance.current = null;
    }

    try {
      const configString = typeof chartConfig === 'string' ? chartConfig : JSON.stringify(chartConfig);
      const cleanJsonString = configString.replace(/\/\/.*|\/\*[\sS]*?\*\//g, '');
      let config = JSON.parse(cleanJsonString);

      if (config.options) {
        if (config.options.plugins?.title) {
          config.options.plugins.title.font = { size: chartFontSize * 1.2 };
        }
        if (config.options.scales) {
          Object.values(config.options.scales).forEach((scale: any) => {
            if (scale.ticks) scale.ticks.font = { size: chartFontSize };
            if (scale.title) scale.title.font = { size: chartFontSize * 1.1 };
          });
        }
        if (config.options.plugins?.legend?.labels) {
          config.options.plugins.legend.labels.font = { size: chartFontSize };
        }

        if (config.options?.plugins?.tooltip?.callbacks) {
          const callbacks = config.options.plugins.tooltip.callbacks;
          for (const key in callbacks) {
            if (typeof callbacks[key] === 'string') {
              try {
                // IMPORTANT: This part attempts to convert string callbacks to functions.
                // This is a common pattern for Chart.js configs received as JSON.
                // However, if the AI provides invalid JS in these strings, it will fail.
                // The prompt for the AI should discourage complex JS in these fields.
                callbacks[key] = new Function('context', `return ${callbacks[key]}`);
              } catch (e) {
                console.warn(`Failed to parse Chart.js tooltip callback for ${key}:`, e);
                // Set a fallback string or null to prevent further errors
                callbacks[key] = `Error: Invalid callback for ${key}`;
              }
            }
          }
        }
      }

      const ctx = chartRef.current.getContext('2d');
      if (ctx) {
        chartInstance.current = new Chart(ctx, config);
      }
    } catch (e: any) {
      console.error("ChartRenderer: Error parsing or rendering Chart.js:", e);
      onInvalidConfig(`Invalid Chart.js configuration: ${e.message}`);
    }

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
        chartInstance.current = null;
      }
    };
  }, [chartConfig, chartRef, chartFontSize, onInvalidConfig]);

  return (
    <div className="relative w-full bg-white p-4 rounded-lg shadow-inner dark:bg-gray-900">
      <canvas ref={chartRef}></canvas>
    </div>
  );
});

// DiagramPanel component
interface DiagramPanelProps {
  diagramContent?: string;
  diagramType: 'mermaid' | 'dot' | 'chartjs' | 'code' | 'image' | 'unknown' | 'document-text';
  onClose: () => void;
  onMermaidError: (code: string, errorType: 'syntax' | 'rendering') => void;
  onSuggestAiCorrection: (prompt: string) => void; // This prop is correctly defined here
  isOpen: boolean;
  language?: string;
  imageUrl?: string;
}

export const DiagramPanel: React.FC<DiagramPanelProps> = memo(({
  diagramContent,
  diagramType,
  onClose,
  onMermaidError,
  onSuggestAiCorrection, // Destructure the prop here
  isOpen,
  language,
  imageUrl
}) => {
  const diagramContainerRef = useRef<HTMLDivElement>(null);
  const chartCanvasRef = useRef<HTMLCanvasElement>(null);
  const mermaidDivRef = useRef<HTMLDivElement>(null);

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
  const [dotSvg, setDotSvg] = useState<string | null>(null);
  const [dotError, setDotError] = useState<string | null>(null);
  const [isDotLoading, setIsDotLoading] = useState(false);
  const [showRawCode, setShowRawCode] = useState(false);
  
  // Theme state
  const [currentTheme, setCurrentTheme] = useState<ThemeName>('github-light');
  const [showThemeSelector, setShowThemeSelector] = useState(false);

  // Auto-detect system theme preference
  useEffect(() => {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setCurrentTheme(prefersDark ? 'github-dark' : 'github-light');
  }, []);

  // Effect to set initial width/height based on responsive classes when panel opens
  useEffect(() => {
    if (isOpen && diagramPanelRef.current) {
      if (window.innerWidth >= 768) {
        if (panelWidth === null) {
          setPanelWidth(window.innerWidth * 0.7);
        }
        if (panelHeight === null) {
          setPanelHeight(window.innerHeight * 0.8);
        }
      }
    }
  }, [isOpen, panelWidth, panelHeight]);

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
      document.body.style.cursor = 'default';
    };

    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (isResizingWidth) {
        handleWidthResizeMouseMove(e);
      }
      if (isResizingHeight) {
        handleHeightResizeMouseMove(e);
      }
    };

    if (isResizingWidth || isResizingHeight) {
      window.addEventListener('mousemove', handleGlobalMouseMove);
      window.addEventListener('mouseup', handleGlobalMouseUp);
      window.addEventListener('mouseleave', handleGlobalMouseUp, { capture: true });
    } else {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      window.removeEventListener('mouseleave', handleGlobalMouseUp, { capture: true });
    }

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      window.removeEventListener('mouseleave', handleGlobalMouseUp, { capture: true });
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
      if (chartCanvasRef.current) {
        contentToDownload = chartCanvasRef.current.toDataURL('image/png');
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
    } else if (diagramType === 'code' || diagramType === 'document-text') {
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
    downloadLink.click();
    document.body.removeChild(downloadLink);
    URL.revokeObjectURL(url);
    toast.success(`${diagramType === 'code' ? 'Code' : 'Diagram'} downloaded as ${fileExtension.toUpperCase()}!`);
  };

  // Function to download as PDF
  const handleDownloadPdf = async () => {
    if (!diagramContainerRef.current) {
      toast.error('Content not rendered for PDF download.');
      return;
    }

    if (typeof window.jspdf === 'undefined' || typeof window.html2canvas === 'undefined') {
      toast.error('PDF generation libraries not loaded. Please try again.');
      return;
    }

    toast.info('Generating PDF...');
    try {
      const canvas = await window.html2canvas(diagramContainerRef.current, {
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
                className={`w-full text-left px-3 py-2 rounded text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${
                  currentTheme === themeName ? 'bg-blue-50 text-blue-700 dark:bg-blue-900 dark:text-blue-300' : ''
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
          diagramRef={mermaidDivRef}
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
            chartRef={chartCanvasRef}
          />
        </>
      );
    } else if (diagramType === 'code') {
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
  }, [diagramContent, diagramType, imageUrl, showRawCode, currentTheme, isResizingHeight, isResizingWidth, onMermaidError, onSuggestAiCorrection, chartError, language, dotSvg, dotError, isDotLoading]);

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
      {/* Load jsPDF, html2canvas from CDN */}
      <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>

      <div
        ref={diagramPanelRef}
        className={`
          absolute inset-y-0 right-0 w-full bg-white shadow-xl flex flex-col z-40 transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}
          md:relative md:translate-x-0 md:flex-shrink-0 md:rounded-lg md:shadow-md md:mb-6 md:border md:border-slate-200
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
            {diagramContent && (diagramType === 'code' || diagramType === 'document-text' || diagramType === 'chartjs' || diagramType === 'mermaid' || diagramType === 'dot') && (
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
