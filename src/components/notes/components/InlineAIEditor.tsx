// components/InlineAIEditor.tsx - IMPROVED DIAGRAM HANDLING
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Button } from '../../ui/button';
import { Check, X, RotateCcw, Loader2, Edit3, Sparkles, ChevronDown, ChevronUp, AlertCircle, Lightbulb, GripHorizontal } from 'lucide-react';
import { Textarea } from '../../ui/textarea';
import { Bar, Line, Pie, Doughnut, Radar, PolarArea } from 'react-chartjs-2';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeRaw from 'rehype-raw';
import rehypeKatex from 'rehype-katex';
import { CodeRenderer } from './CodeRenderer';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  PointElement,
  LineElement,
  ArcElement,
  RadialLinearScale,
} from 'chart.js';


// Direct mermaid rendering (matches DiagramWrapper)
import mermaid from 'mermaid';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  PointElement,
  LineElement,
  ArcElement,
  RadialLinearScale
);

// Types for better type safety
interface InlineAIEditorProps {
  originalText: string;
  onAccept: () => void;
  onReject: () => void;
  selectedText: string;
  selectionRange: { from: number; to: number };
  actionType: string;
  onGenerate: (selectedText: string, actionType: string, customInstruction: string) => Promise<void>;
  position: { top: number; left: number };
  isVisible: boolean;
  isLoading: boolean;
  error?: string | null;
  onClearError?: () => void;
  generatedText?: string;
  isTyping?: boolean;
  onInsertContent?: (content: any) => void; // New prop for node insertion
}

// Smart suggestions interface
interface SmartSuggestion {
  id: string;
  label: string;
  actionType: string;
  description: string;
  icon: string;
  keywords: string[];
}
// DiagramPreview: A unified component for rendering various diagram types.
const DiagramPreview: React.FC<{ type: 'mermaid' | 'chartjs' | 'dot'; code: string }> = ({ type, code }) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [error, setError] = React.useState<string | null>(null);

  const chartComponentMap = {
    bar: Bar,
    line: Line,
    pie: Pie,
    doughnut: Doughnut,
    radar: Radar,
    polarArea: PolarArea,
  };

  React.useEffect(() => {
    let isMounted = true;
    const renderDiagram = async () => {
      if (!containerRef.current) return;
      containerRef.current.innerHTML = '';
      setError(null);

      try {
        if (type === 'mermaid') {
          mermaid.initialize({ startOnLoad: false, theme: 'default', securityLevel: 'loose', logLevel: 1 });
          const id = `mermaid-preview-${Date.now()}`;
          const { svg } = await mermaid.render(id, code.trim());
          if (isMounted && containerRef.current) {
            containerRef.current.innerHTML = svg;
          }
        } else if (type === 'chartjs') {
          // Chart.js rendering is handled via JSX below
        } else {
          const lang = 'dot';
          containerRef.current.innerHTML = `<pre><code class="language-${lang}">${code}</code></pre>`;
        }
      } catch (err: any) {
        if (isMounted) {
          const errorMessage = err?.message || `Invalid ${type} syntax.`;
          setError(errorMessage);
          if (containerRef.current) {
            containerRef.current.innerHTML = `<div style="border: 1px solid #ef4444; background: rgba(239,68,68,0.1); color: #ef4444; padding: 0.75rem; border-radius: 0.5rem; font-size: 0.85rem; font-family: system-ui, sans-serif;"><strong>⚠️ ${type.charAt(0).toUpperCase() + type.slice(1)} Diagram Error</strong><br>${errorMessage.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>`;
          }
        }
      }
    };

    renderDiagram();
    return () => { isMounted = false; };
  }, [code, type]);

  const renderChartJs = () => {
    try {
      const chartConfig = new Function(`return ${code}`)();
      const ChartComponent = chartComponentMap[chartConfig.type as keyof typeof chartComponentMap] || Bar;
      return <ChartComponent data={chartConfig.data} options={chartConfig.options} />;
    } catch (e: any) {
      setError(`Invalid Chart.js configuration: ${e.message}`);
      return null;
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700">
      {type === 'chartjs' ? (
        renderChartJs()
      ) : (
        <div ref={containerRef} className="w-full min-h-[120px] flex items-center justify-center" />
      )}
      <div className="mt-4">
        <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1">Source Code</div>
        <CodeRenderer inline={false} className={`language-${type}`}>
          {code}
        </CodeRenderer>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
        ℹ️ This is a live preview. The diagram will be inserted when you accept.
      </p>
      {error && (
        <div className="text-xs text-red-600 mt-2">{error}</div>
      )}
    </div>
  );
};
// Smart AI suggestions based on content analysis
const SMART_SUGGESTIONS: SmartSuggestion[] = [
  {
    id: 'explain-concept',
    label: 'Explain this concept',
    actionType: 'explain',
    description: 'Break down complex ideas',
    icon: '💡',
    keywords: ['concept', 'theory', 'principle', 'idea', 'definition']
  },
  {
    id: 'create-diagram',
    label: 'Create diagram',
    actionType: 'visualize',
    description: 'Generate visual representation',
    icon: '📊',
    keywords: ['process', 'flow', 'structure', 'relationship', 'system', 'architecture']
  },
  {
    id: 'provide-examples',
    label: 'Show examples',
    actionType: 'example',
    description: 'Add concrete examples',
    icon: '💼',
    keywords: ['example', 'instance', 'case', 'sample', 'demonstration']
  },
  {
    id: 'summarize-content',
    label: 'Summarize',
    actionType: 'summarize',
    description: 'Create concise summary',
    icon: '📝',
    keywords: ['summary', 'overview', 'key points', 'main ideas', 'essence']
  },
  {
    id: 'simplify-text',
    label: 'Simplify',
    actionType: 'simplify',
    description: 'Make easier to understand',
    icon: '🎯',
    keywords: ['complex', 'difficult', 'hard', 'complicated', 'technical']
  },
  {
    id: 'compare-concepts',
    label: 'Compare concepts',
    actionType: 'compare',
    description: 'Show similarities and differences',
    icon: '⚖️',
    keywords: ['vs', 'versus', 'compare', 'difference', 'similarity', 'contrast']
  }
];

// Action type configurations
const ACTION_CONFIGS = {
  expand: {
    icon: '📈',
    label: 'Expand',
    description: 'Add more detail and context',
    placeholder: 'e.g., Focus on practical applications...'
  },
  summarize: {
    icon: '📝',
    label: 'Summarize',
    description: 'Create a concise summary',
    placeholder: 'e.g., Keep it under 3 bullet points...'
  },
  rephrase: {
    icon: '✏️',
    label: 'Rephrase',
    description: 'Improve clarity or tone',
    placeholder: 'e.g., Make it more formal/casual...'
  },
  explain: {
    icon: '💡',
    label: 'Explain',
    description: 'Break down the concept',
    placeholder: 'e.g., Explain like I\'m a beginner...'
  },
  simplify: {
    icon: '🎯',
    label: 'Simplify',
    description: 'Make it easier to understand',
    placeholder: 'e.g., Use simple language and short sentences...'
  },
  elaborate: {
    icon: '📚',
    label: 'Elaborate',
    description: 'Add comprehensive depth',
    placeholder: 'e.g., Include historical context...'
  },
  example: {
    icon: '💼',
    label: 'Example',
    description: 'Provide concrete examples',
    placeholder: 'e.g., Show real-world applications...'
  },
  analyze: {
    icon: '🔍',
    label: 'Analyze',
    description: 'Examine components and implications',
    placeholder: 'e.g., Focus on strengths and weaknesses...'
  },
  compare: {
    icon: '⚖️',
    label: 'Compare',
    description: 'Compare with related concepts',
    placeholder: 'e.g., Compare to traditional methods...'
  },
  question: {
    icon: '❓',
    label: 'Question',
    description: 'Generate thoughtful questions',
    placeholder: 'e.g., Focus on critical thinking questions...'
  },
  visualize: {
    icon: '📊',
    label: 'Visualize',
    description: 'Create diagrams or visual aids',
    placeholder: 'e.g., Create a flowchart showing the process...'
  }
} as const;

export const InlineAIEditor: React.FC<InlineAIEditorProps> = ({
  originalText,
  onAccept,
  onReject,
  selectedText,
  selectionRange,
  actionType,
  onGenerate,
  position,
  isVisible,
  isLoading,
  error,
  onClearError,
  generatedText = '',
  isTyping = false,
  onInsertContent
}) => {
  // Detect and extract diagram info
  const diagramInfo = useMemo(() => {
    const mermaidMatch = generatedText.match(/```mermaid[\r\n]+([\s\S]*?)```/i);
    if (mermaidMatch) {
      return { type: 'mermaid', code: mermaidMatch[1].trim() };
    }

    const chartjsMatch = generatedText.match(/```chartjs[\r\n]+([\s\S]*?)```/i);
    if (chartjsMatch) {
      return { type: 'chartjs', code: chartjsMatch[1].trim() };
    }

    const dotMatch = generatedText.match(/```dot[\r\n]+([\s\S]*?)```/i);
    if (dotMatch) {
      return { type: 'dot', code: dotMatch[1].trim() };
    }

    return null;
  }, [generatedText]);
  // Local loading state for instant feedback
  const [localLoading, setLocalLoading] = useState(false);
  // State management
  const [customInstruction, setCustomInstruction] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [showSmartSuggestions, setShowSmartSuggestions] = useState(false);
  const [currentActionType, setCurrentActionType] = useState(actionType);
  const [showPreview, setShowPreview] = useState(false);
  const [preservedSelectedText, setPreservedSelectedText] = useState(selectedText);

  // Dragging state
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [positionOverride, setPositionOverride] = useState<{ top: number, left: number } | null>(null);

  // Reset drag position when visibility changes (but not just position updates, to keep it where user left it if they are just typing)
  // Actually, if selection changes (position changes), we probably want to reset to stick to the new selection?
  // Let's reset if isVisible goes false.
  useEffect(() => {
    if (!isVisible) {
      setPositionOverride(null);
    }
  }, [isVisible]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (window.innerWidth < 640) return; // No dragging on mobile
    
    // Only allow dragging from header/grip areas, prevent conflicts
    if ((e.target as HTMLElement).closest('button')) return; 

    e.preventDefault();
    
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      setIsDragging(true);
      const offsetX = e.clientX - rect.left;
      const offsetY = e.clientY - rect.top;
      setDragOffset({ x: offsetX, y: offsetY });
      
      // If we haven't overridden yet, set initial override to current computed position
      if (!positionOverride) {
          setPositionOverride({ top: rect.top, left: rect.left });
      }
    }
  }, [positionOverride]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setPositionOverride({
          top: e.clientY - dragOffset.y,
          left: e.clientX - dragOffset.x
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  // Refs
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Show preview when generated text is available
  useEffect(() => {
    if (generatedText) {
      setShowPreview(true);
    }
  }, [generatedText]);

  // Sync local loading with parent isLoading
  useEffect(() => {
    if (!isLoading) setLocalLoading(false);
  }, [isLoading]);

  // Memoized action config
  const actionConfig = useMemo(() =>
    ACTION_CONFIGS[currentActionType as keyof typeof ACTION_CONFIGS] || {
      icon: '⚡',
      label: currentActionType.charAt(0).toUpperCase() + currentActionType.slice(1),
      description: 'Process with AI',
      placeholder: 'Additional instructions...'
    }, [currentActionType]
  );

  // Smart suggestions based on selected text
  const smartSuggestions = useMemo(() => {
    const text = selectedText.toLowerCase();
    return SMART_SUGGESTIONS.filter(suggestion =>
      suggestion.keywords.some(keyword => text.includes(keyword.toLowerCase()))
    ).slice(0, 4);
  }, [selectedText]);

  // Auto-focus management
  useEffect(() => {
    if (isVisible && showCustomInput && textareaRef.current) {
      const timer = setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isVisible, showCustomInput]);

  // Responsive position and width
  const adjustedPosition = useMemo(() => {
    if (!isVisible) {
      return { ...position, width: window.innerWidth < 640 ? window.innerWidth * 0.95 : 500 };
    }
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const editorWidth = viewportWidth < 640 ? viewportWidth * 0.95 : 500;
    const editorHeight = showSmartSuggestions ? 500 : 400;
    let { top, left } = position;
    if (left + editorWidth > viewportWidth) {
      left = viewportWidth - editorWidth - 10;
    } else if (left < 0) {
      left = 10;
    }
    if (top + editorHeight > viewportHeight) {
      top = Math.max(10, viewportHeight - editorHeight - 10);
    }
    return { top, left, width: editorWidth };
  }, [position, isVisible, showSmartSuggestions]);

  // (Already declared above) Remove duplicate isDiagram and mermaidCode declarations

  const handleAccept = useCallback(() => {
    if (diagramInfo && onInsertContent) {
      const { type, code } = diagramInfo;
      if (type === 'chartjs') {
        onInsertContent({ type: 'chartjs', attrs: { config: code } });
      } else {
        onInsertContent({ type, attrs: { code } });
      }
    } else {
      onAccept();
    }
    setCustomInstruction('');
    setShowCustomInput(false);
    setShowPreview(false);
    setShowSmartSuggestions(false);
    if (onClearError) onClearError();
  }, [diagramInfo, onInsertContent, onAccept, onClearError]);

  // Handlers
  const handleGenerate = useCallback(async () => {
    if (isLoading || localLoading) return;
    setLocalLoading(true);
    setShowSmartSuggestions(false);
    if (onClearError) onClearError();
    
    // console.log('[InlineAIEditor] Generating with:', {
    //   actionType: currentActionType,
    //   customInstruction: customInstruction || '(none)',
    //   customInstructionLength: customInstruction.length
    // });
    
    await onGenerate(selectedText, currentActionType, customInstruction);
  }, [isLoading, localLoading, onGenerate, selectedText, currentActionType, customInstruction, onClearError]);

  const handleReject = useCallback(() => {
    onReject();
    setCustomInstruction('');
    setShowCustomInput(false);
    setShowPreview(false);
    setShowSmartSuggestions(false);
    if (onClearError) onClearError();
  }, [onReject, onClearError]);

  const handleRegenerate = useCallback(() => {
    if (!isLoading) {
      handleGenerate();
    }
  }, [handleGenerate, isLoading]);

  const handleSmartSuggestion = useCallback((suggestion: SmartSuggestion) => {
    setCurrentActionType(suggestion.actionType);
    setShowSmartSuggestions(false);
  }, []);

  const handleKeydown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      handleReject();
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (!isLoading) {
        handleGenerate();
      }
    }
  }, [handleGenerate, handleReject, isLoading]);

  const toggleCustomInput = useCallback(() => {
    setShowCustomInput(prev => {
      if (!prev) {
        setPreservedSelectedText(selectedText);
      }
      return !prev;
    });
  }, [selectedText]);

  const toggleSmartSuggestions = useCallback(() => {
    setShowSmartSuggestions(prev => !prev);
  }, []);

  // (Removed duplicate isDiagram and mermaidCode declarations)

  // Fix diagram function - regenerate with specific instructions
  const handleFixDiagram = useCallback(async () => {
    setLocalLoading(true);
    const fixInstruction = 'The previous diagram had errors. Please regenerate a valid, working diagram. Ensure all syntax is correct and the diagram will render properly. Return ONLY the diagram code block with proper formatting.';
    await onGenerate(selectedText, 'visualize', fixInstruction);
    setLocalLoading(false);
  }, [selectedText, onGenerate]);

  if (!isVisible) return null;

  const truncatedText = selectedText.length > 100
    ? `${selectedText.slice(0, 100)}...`
    : selectedText;

  return (
    <div
      ref={containerRef}
      className={
        `fixed bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl z-[10000] max-h-[90vh] overflow-hidden transition-all duration-200
        min-w-[320px] max-w-[600px] w-full
        sm:min-w-[450px] sm:w-auto
        ${window.innerWidth < 640 ? 'left-0 right-0 bottom-0 top-auto mx-auto rounded-b-none rounded-t-xl' : ''}`
      }
      style={window.innerWidth < 640
        ? { left: 0, right: 0, bottom: 0, top: 'auto', width: '100vw', maxWidth: '100vw', minWidth: 0, borderRadius: '1rem 1rem 0 0' }
        : positionOverride 
            ? { top: `${positionOverride.top}px`, left: `${positionOverride.left}px`, margin: 0 }
            : { top: `${adjustedPosition.top}px`, left: `${adjustedPosition.left}px`, transform: 'translateX(-50%)' }
      }
    >
      {/* Header */}
      <div 
        className={`flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-50 to-blue-50 dark:from-gray-800 dark:to-gray-800 ${window.innerWidth >= 640 ? 'cursor-move' : ''}`}
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center gap-3">
          {window.innerWidth >= 640 && (
            <GripHorizontal className="h-4 w-4 text-gray-400" />
          )}
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-r from-blue-600 to-blue-600 text-white text-sm">
            {actionConfig.icon}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                AI {actionConfig.label}
              </span>
              {showPreview && !isTyping && (
                <span className="text-xs bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-full">
                  {diagramInfo ? 'Diagram Ready' : 'Generated'}
                </span>
              )}
              {isTyping && (
                <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Typing...
                </span>
              )}
            </div>
            <span className="text-xs text-gray-600 dark:text-gray-400">
              {actionConfig.description}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {smartSuggestions.length > 0 && !showPreview && (
            <Button
              size="sm"
              variant="ghost"
              onClick={toggleSmartSuggestions}
              className="h-8 w-8 p-0 hover:bg-yellow-100 dark:hover:bg-gray-700"
              title="Smart suggestions"
            >
              <Lightbulb className="h-4 w-4 text-yellow-600" />
            </Button>
          )}
          {showPreview && !isTyping && (
            <Button
              size="sm"
              variant="ghost"
              onClick={handleRegenerate}
              disabled={isLoading}
              className="h-8 w-8 p-0 hover:bg-blue-100 dark:hover:bg-gray-700"
              title="Regenerate (Ctrl+R)"
            >
              <RotateCcw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={handleReject}
            className="h-8 w-8 p-0 hover:bg-red-100 dark:hover:bg-gray-700"
            title="Close (Esc)"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4 max-h-[60vh] sm:max-h-[60vh] overflow-y-auto">
        {/* Error Display */}
        {error && (
          <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
              {onClearError && (
                <button
                  onClick={onClearError}
                  className="text-xs text-red-600 dark:text-red-400 hover:underline mt-1"
                >
                  Dismiss
                </button>
              )}
            </div>
          </div>
        )}

        {/* Generated Text Preview */}
        {showPreview && generatedText && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2">
                <Sparkles className="h-3 w-3 text-blue-500" />
                {isTyping ? 'AI is typing...' : diagramInfo ? 'Generated Diagram' : 'Generated Text'}
              </div>
              {isTyping && (
                <div className="flex gap-1">
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              )}
              {/* Fix Diagram Button - Only show for diagrams that might have issues */}
              {!isTyping && diagramInfo && (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs border-blue-300 text-blue-700 hover:bg-blue-50 dark:border-blue-600 dark:text-blue-400 dark:hover:bg-blue-900/20"
                  onClick={handleFixDiagram}
                  disabled={isLoading || localLoading}
                  title="Regenerate diagram if it has errors"
                >
                  <RotateCcw className="h-3 w-3 mr-1" /> 
                  {isLoading || localLoading ? 'Fixing...' : 'Fix Diagram'}
                </Button>
              )}
            </div>
            <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-900 rounded-lg border border-blue-200 dark:border-gray-700 max-h-64 overflow-y-auto">
              <div className="prose prose-sm dark:prose-invert max-w-none">
                {diagramInfo ? (
                  <DiagramPreview type={diagramInfo.type as 'mermaid' | 'chartjs' | 'dot'} code={diagramInfo.code} />
                ) : (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm, remarkMath]}
                    rehypePlugins={[rehypeRaw, rehypeKatex]}
                    components={{
                      code: CodeRenderer,
                      p: ({ children }) => (
                        <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed mb-2">
                          {children}
                        </p>
                      ),
                    }}
                  >
                    {generatedText + (isTyping ? ' █' : '')}
                  </ReactMarkdown>
                )}
              </div>
            </div>
            {!isTyping && (
              <div className="text-xs text-gray-500 dark:text-gray-400 text-right">
                {generatedText.length} characters
              </div>
            )}
          </div>
        )}

        {/* Smart Suggestions */}
        {!showPreview && showSmartSuggestions && smartSuggestions.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-medium text-gray-600 dark:text-gray-400 flex items-center gap-1">
              <Lightbulb className="h-3 w-3" />
              Smart Suggestions:
            </div>
            <div className="grid grid-cols-2 gap-2">
              {smartSuggestions.map((suggestion) => (
                <button
                  key={suggestion.id}
                  onClick={() => handleSmartSuggestion(suggestion)}
                  className="p-2 text-left border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-blue-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm">{suggestion.icon}</span>
                    <span className="text-xs font-medium text-gray-800 dark:text-gray-200">
                      {suggestion.label}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    {suggestion.description}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Selected text preview - Only show if no preview */}
        {!showPreview && (
          <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
              Selected Text:
            </div>
            <div className="text-sm text-gray-800 dark:text-gray-200 font-mono leading-relaxed">
              "{truncatedText}"
            </div>
            {selectedText.length > 100 && (
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {selectedText.length} characters selected
              </div>
            )}
          </div>
        )}

        {/* Custom instruction section - Only show if no preview */}
        {!showPreview && (
          <div className="space-y-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={toggleCustomInput}
              className="h-8 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 px-2"
            >
              <Edit3 className="h-3 w-3 mr-2" />
              Custom Instructions
              {showCustomInput ? (
                <ChevronUp className="h-3 w-3 ml-1" />
              ) : (
                <ChevronDown className="h-3 w-3 ml-1" />
              )}
            </Button>

            {showCustomInput && (
              <div className="space-y-2">
                <Textarea
                  ref={textareaRef}
                  value={customInstruction}
                  onChange={(e) => setCustomInstruction(e.target.value)}
                  placeholder={actionConfig.placeholder}
                  className="text-sm resize-none border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                  onKeyDown={handleKeydown}
                  maxLength={1000}
                />
                {customInstruction.length > 800 && (
                  <div className="text-xs text-amber-600 dark:text-amber-400">
                    {1000 - customInstruction.length} characters remaining
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        {!showPreview && (
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Press <kbd className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded text-xs font-mono">Ctrl+Enter</kbd> to generate
          </div>
        )}
        {showPreview && !isTyping && (
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {diagramInfo ? 'Review diagram and accept to insert' : 'Review and accept or regenerate'}
          </div>
        )}
        {isTyping && (
          <div className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-2">
            <Loader2 className="h-3 w-3 animate-spin" />
            Generating response...
          </div>
        )}

        <div className="flex items-center gap-2 ml-auto">
          <Button
            size="sm"
            variant="outline"
            onClick={handleReject}
            className="h-8 text-xs border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X className="h-3 w-3 mr-1" />
            Cancel
          </Button>

          {showPreview && !isTyping && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleAccept}
              className="h-8 text-xs border-green-300 text-green-700 hover:bg-green-50 dark:border-green-600 dark:text-green-400 dark:hover:bg-green-900/20"
            >
              <Check className="h-3 w-3 mr-1" />
              Accept
            </Button>
          )}

          {!showPreview && (
            <Button
              size="sm"
              onClick={handleGenerate}
              disabled={isLoading || localLoading}
              className="h-8 text-xs bg-gradient-to-r from-blue-600 to-blue-600 hover:from-blue-700 hover:to-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {(isLoading || localLoading) ? (
                <>
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-3 w-3 mr-1" />
                  Generate
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
