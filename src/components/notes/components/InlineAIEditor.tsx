// components/InlineAIEditor.tsx
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Button } from '../../ui/button';
import { Check, X, RotateCcw, Loader2, Edit3, Sparkles, ChevronDown, ChevronUp, AlertCircle, Lightbulb } from 'lucide-react';
import { Textarea } from '../../ui/textarea';

// Types for better type safety
interface InlineAIEditorProps {
  originalText: string;
  onAccept: () => void;
  onReject: () => void;
  selectedText: string;
  actionType: string;
  onGenerate: (selectedText: string, actionType: string, customInstruction: string) => Promise<void>;
  position: { top: number; left: number };
  isVisible: boolean;
  isLoading: boolean;
  error?: string | null;
  onClearError?: () => void;
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
    description: 'Create charts, diagrams, or visual aids',
    placeholder: 'e.g., Create a flowchart showing the process...'
  }
} as const;

export const InlineAIEditor: React.FC<InlineAIEditorProps> = ({
  originalText,
  onAccept,
  onReject,
  selectedText,
  actionType,
  onGenerate,
  position,
  isVisible,
  isLoading,
  error,
  onClearError
}) => {
  // State management
  const [customInstruction, setCustomInstruction] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [showSmartSuggestions, setShowSmartSuggestions] = useState(false);
  const [currentActionType, setCurrentActionType] = useState(actionType);

  // Refs
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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
    ).slice(0, 4); // Limit to 4 suggestions
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

  // Position adjustment to keep editor in viewport
  const adjustedPosition = useMemo(() => {
    if (!isVisible) return position;

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const editorWidth = 500;
    const editorHeight = showSmartSuggestions ? 400 : 300;

    let { top, left } = position;

    // Adjust horizontal position
    if (left + editorWidth / 2 > viewportWidth) {
      left = viewportWidth - editorWidth / 2 - 20;
    } else if (left - editorWidth / 2 < 0) {
      left = editorWidth / 2 + 20;
    }

    // Adjust vertical position
    if (top + editorHeight > viewportHeight) {
      top = Math.max(20, viewportHeight - editorHeight - 20);
    }

    return { top, left };
  }, [position, isVisible, showSmartSuggestions]);

  // Handlers
  const handleGenerate = useCallback(async () => {
    if (isLoading) return;

    try {
      if (onClearError) onClearError();
      await onGenerate(selectedText, currentActionType, customInstruction);
      setHasGenerated(true);
    } catch (err) {
      console.error('Generation failed:', err);
    }
  }, [selectedText, currentActionType, customInstruction, onGenerate, isLoading, onClearError]);

  const handleAccept = useCallback(() => {
    onAccept();
    // Reset state
    setCustomInstruction('');
    setShowCustomInput(false);
    setHasGenerated(false);
    setShowSmartSuggestions(false);
    if (onClearError) onClearError();
  }, [onAccept, onClearError]);

  const handleReject = useCallback(() => {
    onReject();
    // Reset state
    setCustomInstruction('');
    setShowCustomInput(false);
    setHasGenerated(false);
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
    // Optionally auto-generate or just set up the UI
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
    setShowCustomInput(prev => !prev);
  }, []);

  const toggleSmartSuggestions = useCallback(() => {
    setShowSmartSuggestions(prev => !prev);
  }, []);

  // Don't render if not visible
  if (!isVisible) return null;

  const truncatedText = selectedText.length > 100
    ? `${selectedText.slice(0, 100)}...`
    : selectedText;

  return (
    <div
      ref={containerRef}
      className="fixed bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl min-w-[450px] max-w-[600px] z-[10000] max-h-[80vh] overflow-hidden"
      style={{
        top: `${adjustedPosition.top}px`,
        left: `${adjustedPosition.left}px`,
        transform: 'translateX(-50%)'
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-gray-800 dark:to-gray-800">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 text-white text-sm">
            {actionConfig.icon}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                AI {actionConfig.label}
              </span>
              {hasGenerated && (
                <span className="text-xs bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-full">
                  Generated
                </span>
              )}
            </div>
            <span className="text-xs text-gray-600 dark:text-gray-400">
              {actionConfig.description}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {smartSuggestions.length > 0 && (
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
          {hasGenerated && (
            <Button
              size="sm"
              variant="ghost"
              onClick={handleRegenerate}
              disabled={isLoading}
              className="h-8 w-8 p-0 hover:bg-purple-100 dark:hover:bg-gray-700"
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
      <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
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

        {/* Smart Suggestions */}
        {showSmartSuggestions && smartSuggestions.length > 0 && (
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
                  className="p-2 text-left border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-purple-50 dark:hover:bg-gray-800 transition-colors"
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

        {/* Selected text preview */}
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

        {/* Custom instruction section */}
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
                className="text-sm resize-none border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
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
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <div className="text-xs text-gray-500 dark:text-gray-400">
          Press <kbd className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded text-xs font-mono">Ctrl+Enter</kbd> to generate
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleReject}
            className="h-8 text-xs border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X className="h-3 w-3 mr-1" />
            Cancel
          </Button>

          {hasGenerated && (
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

          <Button
            size="sm"
            onClick={handleGenerate}
            disabled={isLoading}
            className="h-8 text-xs bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="h-3 w-3 mr-1" />
                {hasGenerated ? 'Regenerate' : 'Generate'}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};