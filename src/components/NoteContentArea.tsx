// components/NoteContentArea.tsx
import React, { useEffect, useRef, memo, useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { Textarea } from './ui/textarea';
import { useCopyToClipboard } from '../hooks/useCopyToClipboard';
import { CodeBlockErrorBoundary } from './AIChat';
import { AlertTriangle, Check, Copy, Loader2, X, Sparkles, Lightbulb } from 'lucide-react';
import { Button } from './ui/button';
import Mermaid from './Mermaid';
import { InlineAIEditor } from './InlineAIEditor';
import { CodeRenderer } from './CodeRenderer';
import { UserProfile } from '../types';

// Import languages for syntax highlighting
import javascript from 'highlight.js/lib/languages/javascript';
import python from 'highlight.js/lib/languages/python';
import java from 'highlight.js/lib/languages/java';
import cpp from 'highlight.js/lib/languages/cpp';
import sql from 'highlight.js/lib/languages/sql';
import xml from 'highlight.js/lib/languages/xml';
import bash from 'highlight.js/lib/languages/bash';
import json from 'highlight.js/lib/languages/typescript';

// Create lowlight instance and register languages
import { lowlight } from 'lowlight';
import { LanguageFn } from 'highlight.js';
lowlight.registerLanguage('javascript', javascript as LanguageFn);
lowlight.registerLanguage('python', python as LanguageFn);
lowlight.registerLanguage('java', java as LanguageFn);
lowlight.registerLanguage('cpp', cpp as LanguageFn);
lowlight.registerLanguage('sql', sql as LanguageFn);
lowlight.registerLanguage('xml', xml as LanguageFn);
lowlight.registerLanguage('bash', bash as LanguageFn);
lowlight.registerLanguage('json', json as LanguageFn);

// Direct imports
import { Graphviz } from '@hpcc-js/wasm';
import { Chart, registerables } from 'chart.js';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { FunctionsHttpError } from '@supabase/supabase-js';
Chart.register(...registerables);

// AI Suggestion interface
interface AISuggestion {
  id: string;
  label: string;
  actionType: string;
  description: string;
  icon: string;
  trigger: RegExp;
  priority: number;
}

// Smart AI suggestions based on keywords and context
const AI_SUGGESTIONS: AISuggestion[] = [
  {
    id: 'explain-ai',
    label: 'Explain with AI',
    actionType: 'explain',
    description: 'Get detailed explanation',
    icon: '💡',
    trigger: /\b(what is|explain|how does|why|concept|theory|principle)\b/i,
    priority: 1
  },
  {
    id: 'visualize-ai',
    label: 'Create diagram',
    actionType: 'visualize',
    description: 'Generate visual representation',
    icon: '📊',
    trigger: /\b(diagram|chart|graph|flow|process|visual|structure|architecture)\b/i,
    priority: 2
  },
  {
    id: 'example-ai',
    label: 'Show examples',
    actionType: 'example',
    description: 'Add concrete examples',
    icon: '💼',
    trigger: /\b(example|instance|case|sample|demo)\b/i,
    priority: 3
  },
  {
    id: 'compare-ai',
    label: 'Compare concepts',
    actionType: 'compare',
    description: 'Show comparisons',
    icon: '⚖️',
    trigger: /\b(vs|versus|compare|difference|similarity|contrast)\b/i,
    priority: 4
  },
  {
    id: 'simplify-ai',
    label: 'Simplify',
    actionType: 'simplify',
    description: 'Make it simpler',
    icon: '🎯',
    trigger: /\b(complex|difficult|hard|complicated|confusing)\b/i,
    priority: 5
  }
];

// Define a mapping of highlight.js classes to Tailwind CSS color classes for dark theme
const syntaxColorMap: { [key: string]: string } = {
  'hljs-comment': 'text-gray-400',
  'hljs-keyword': 'text-purple-300',
  'hljs-built_in': 'text-cyan-300',
  'hljs-string': 'text-green-300',
  'hljs-variable': 'text-blue-200',
  'hljs-number': 'text-orange-200',
  'hljs-literal': 'text-orange-200',
  'hljs-function': 'text-blue-200',
  'hljs-params': 'text-yellow-200',
  'hljs-tag': 'text-pink-300',
  'hljs-attr': 'text-cyan-300',
  'hljs-selector-tag': 'text-purple-300',
  'hljs-selector-id': 'text-orange-300',
  'hljs-selector-class': 'text-green-300',
  'hljs-regexp': 'text-pink-300',
  'hljs-meta': 'text-sky-300',
  'hljs-type': 'text-teal-300',
  'hljs-symbol': 'text-red-300',
  'hljs-operator': 'text-pink-200',
  'hljs-code-text': 'text-gray-100',
};

// Helper function to escape HTML
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

// Helper function to convert lowlight result to HTML with inline styles
const toHtml = (result: any) => {
  const nodeToHtml = (node: any): string => {
    if (node.type === 'text') {
      return escapeHtml(node.value);
    }
    if (node.type === 'element') {
      const { tagName, properties, children } = node;
      const classNames = (properties?.className || []).join(' ');

      const styleMap: { [key: string]: string } = {
        'hljs-comment': 'color: #9ca3af; font-style: italic;',
        'hljs-keyword': 'color: #c084fc; font-weight: 600;',
        'hljs-string': 'color: #86efac;',
        'hljs-number': 'color: #fdba74;',
        'hljs-built_in': 'color: #93c5fd; font-weight: 500;',
        'hljs-function': 'color: #93c5fd; font-weight: 500;',
        'hljs-variable': 'color: #bfdbfe;',
        'hljs-type': 'color: #5eead4;',
        'hljs-class': 'color: #fcd34d;',
        'hljs-attr': 'color: #93c5fd;',
        'hljs-tag': 'color: #f472b6;',
        'hljs-operator': 'color: #fbcfe8;',
        'hljs-literal': 'color: #fdba74;',
        'hljs-meta': 'color: #7dd3fc;',
        'hljs-title': 'color: #86efac;',
        'hljs-selector-tag': 'color: #c084fc;',
        'hljs-selector-class': 'color: #86efac;',
        'hljs-selector-id': 'color: #fca5a5;',
        'hljs-regexp': 'color: #f472b6;',
        'hljs-symbol': 'color: #fca5a5;',
        'hljs-bullet': 'color: #fbcfe8;',
        'hljs-params': 'color: #fde68a;',
        'hljs-name': 'color: #93c5fd;',
        'hljs-attribute': 'color: #fcd34d;',
        'hljs-selector-attr': 'color: #67e8f9;',
        'hljs-selector-pseudo': 'color: #fbcfe8;',
        'hljs-template-variable': 'color: #bfdbfe;',
        'hljs-quote': 'color: #9ca3af; font-style: italic;',
        'hljs-deletion': 'color: #f87171; background-color: #450a0a;',
        'hljs-addition': 'color: #4ade80; background-color: #064e3b;',
        'hljs-meta-keyword': 'color: #7dd3fc; font-weight: 600;',
        'hljs-meta-string': 'color: #38bdf8;',
        'hljs-subst': 'color: #c084fc;',
        'hljs-section': 'color: #86efac;',
        'hljs-boolean': 'color: #fdba74;',
      };

      let style = '';
      classNames.split(' ').forEach(cls => {
        if (styleMap[cls]) {
          style += styleMap[cls] + ' ';
        }
      });

      const childrenHtml = children?.map(nodeToHtml).join('') || '';
      return `<${tagName}${style ? ` style="${style.trim()}"` : ''}>${childrenHtml}</${tagName}>`;
    }
    return '';
  };

  return result.children.map(nodeToHtml).join('');
};

// Enhanced syntax highlighting function
const highlightCode = (code: string, language: string) => {
  try {
    const result = lowlight.highlight(language, code);
    return toHtml(result);
  } catch (error) {
    console.warn('Syntax highlighting failed:', error);
    return escapeHtml(code);
  }
};

// Define common Markdown components
const commonMarkdownComponents = {
  code: ({ inline, className, children }: any) => (
    <CodeRenderer inline={inline} className={className}>
      {children}
    </CodeRenderer>
  ),
  table: ({ node, ...props }: any) => (
    <div className="overflow-x-auto my-4 rounded-lg shadow-md border border-slate-200 dark:border-gray-700">
      <table className="w-full border-collapse" {...props} />
    </div>
  ),
  thead: ({ node, ...props }: any) => <thead className="bg-gradient-to-r from-blue-100 to-purple-100 dark:from-blue-900 dark:to-purple-900" {...props} />,
  th: ({ node, ...props }: any) => <th className="p-3 text-left border-b border-slate-300 font-semibold text-slate-800 dark:border-gray-100 dark:text-gray-100" {...props} />,
  td: ({ node, ...props }: any) => <td className="p-3 border-b border-slate-200 group-last:border-b-0 even:bg-slate-50 hover:bg-blue-50 transition-colors dark:border-gray-700 dark:even:bg-gray-800 dark:hover:bg-blue-900 dark:text-gray-200" {...props} />,
  h1: ({ node, ...props }: any) => <h1 className="text-3xl font-extrabold text-blue-700 mt-6 mb-3 dark:text-blue-400" {...props} />,
  h2: ({ node, ...props }: any) => <h2 className="text-2xl font-bold text-purple-700 mt-5 mb-2 dark:text-purple-400" {...props} />,
  h3: ({ node, ...props }: any) => <h3 className="text-xl font-semibold text-green-700 mt-4 mb-2 dark:text-green-400" {...props} />,
  h4: ({ node, ...props }: any) => <h4 className="text-lg font-semibold text-orange-700 mt-3 mb-1 dark:text-orange-400" {...props} />,
  ul: ({ node, ...props }: any) => <ul className="list-disc list-inside space-y-1 text-slate-700 dark:text-gray-200" {...props} />,
  ol: ({ node, ...props }: any) => <ol className="list-decimal list-inside space-y-1 text-slate-700 dark:text-gray-200" {...props} />,
  blockquote: ({ node, ...props }: any) => <blockquote className="border-l-4 border-blue-400 pl-4 py-2 italic text-slate-600 bg-blue-50 rounded-r-md my-4 dark:border-blue-700 dark:text-gray-300 dark:bg-blue-950" {...props} />,
  p: ({ node, ...props }: any) => <p className="mb-3 text-slate-700 leading-relaxed dark:text-gray-200" {...props} />,
  a: ({ node, ...props }: any) => <a className="text-blue-600 hover:underline dark:text-blue-400 dark:hover:underline" {...props} />,
};

// Helper function to calculate cursor position in textarea
const getTextareaCaretCoordinates = (textarea: HTMLTextAreaElement, position: number) => {
  const div = document.createElement('div');
  const style = getComputedStyle(textarea);
  
  const properties = [
    'font-family', 'font-size', 'font-weight', 'font-style',
    'letter-spacing', 'text-transform', 'word-spacing', 'text-indent',
    'text-decoration', 'box-sizing', 'border-width', 'padding-left',
    'padding-right', 'padding-top', 'padding-bottom', 'line-height'
  ];
  
  properties.forEach(prop => {
    div.style[prop as any] = style[prop as any];
  });
  
  div.style.position = 'absolute';
  div.style.visibility = 'hidden';
  div.style.whiteSpace = 'pre-wrap';
  div.style.wordWrap = 'break-word';
  div.style.width = textarea.clientWidth + 'px';
  div.style.height = 'auto';
  div.style.overflow = 'hidden';
  
  document.body.appendChild(div);
  
  const textBeforeCaret = textarea.value.substring(0, position);
  div.textContent = textBeforeCaret;
  
  const span = document.createElement('span');
  span.textContent = '|';
  div.appendChild(span);
  
  const coordinates = {
    top: span.offsetTop,
    left: span.offsetLeft,
    height: span.offsetHeight
  };
  
  document.body.removeChild(div);
  return coordinates;
};

interface NoteContentAreaProps {
  content: string;
  setContent: (content: string) => void;
  isEditing: boolean;
  userProfile: UserProfile | null;
}

export const NoteContentArea: React.FC<NoteContentAreaProps> = ({
  content,
  setContent,
  isEditing,
  userProfile,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const typingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const generatedContentBufferRef = useRef<string>('');
  const typingCursorPositionRef = useRef<number | null>(null);

  // State for Inline AI Editor
  const [editorPosition, setEditorPosition] = useState({ top: 0, left: 0 });
  const [isEditorVisible, setIsEditorVisible] = useState(false);
  const [selectedTextForAI, setSelectedTextForAI] = useState('');
  const [actionTypeForAI, setActionTypeForAI] = useState('');
  const [isGeneratingAIInline, setIsGeneratingAIInline] = useState(false);
  const [inlineSelectionStart, setInlineSelectionStart] = useState<number | null>(null);
  const [inlineSelectionEnd, setInlineSelectionEnd] = useState<number | null>(null);

  // New states for improved AI typing
  const [isTypingAI, setIsTypingAI] = useState(false);
  const [originalContentBeforeAI, setOriginalContentBeforeAI] = useState('');
  const [typingComplete, setTypingComplete] = useState(false);
  const [currentTypingPosition, setCurrentTypingPosition] = useState<number>(0);

  // AI Suggestions state
  const [showAISuggestions, setShowAISuggestions] = useState(false);
  const [aiSuggestionsPosition, setAISuggestionsPosition] = useState({ top: 0, left: 0 });
  const [suggestedActions, setSuggestedActions] = useState<AISuggestion[]>([]);

  // Detect AI-worthy content and show suggestions
  const detectAISuggestions = useCallback((text: string, cursorPosition: number) => {
    if (!text.trim()) return;

    // Get surrounding context (50 chars before and after cursor)
    const start = Math.max(0, cursorPosition - 50);
    const end = Math.min(text.length, cursorPosition + 50);
    const context = text.substring(start, end);

    // Find matching suggestions
    const matchingSuggestions = AI_SUGGESTIONS
      .filter(suggestion => suggestion.trigger.test(context))
      .sort((a, b) => a.priority - b.priority)
      .slice(0, 3);

    if (matchingSuggestions.length > 0 && textareaRef.current) {
      const textarea = textareaRef.current;
      const textareaRect = textarea.getBoundingClientRect();
      const coords = getTextareaCaretCoordinates(textarea, cursorPosition);
      
      setSuggestedActions(matchingSuggestions);
      setAISuggestionsPosition({
        top: textareaRect.top + coords.top + coords.height + 5,
        left: textareaRect.left + coords.left
      });
      setShowAISuggestions(true);

      // Auto-hide after 5 seconds
      setTimeout(() => setShowAISuggestions(false), 5000);
    }
  }, []);

  // Handle textarea input changes
  const handleContentChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    const cursorPosition = e.target.selectionStart;

    // Stop AI typing if user interferes
    if (isTypingAI && !typingComplete) {
      handleDeclineAI();
      return;
    }

    setContent(newContent);

    // Detect AI suggestions on certain conditions
    if (newContent.length > content.length && cursorPosition > 10) {
      // Only check when content is being added and we have enough context
      detectAISuggestions(newContent, cursorPosition);
    }
  }, [content.length, isTypingAI, typingComplete, setContent, detectAISuggestions]);

  // Handle context menu for text selection AI
  const handleContextMenu = useCallback((event: React.MouseEvent<HTMLTextAreaElement>) => {
    if (!textareaRef.current || !isEditing) return;

    event.preventDefault();

    const textarea = textareaRef.current;
    const selectedTextValue = textarea.value.substring(textarea.selectionStart, textarea.selectionEnd);

    if (selectedTextValue.length > 0) {
      const textareaRect = textarea.getBoundingClientRect();
      const selectionStartPos = textarea.selectionStart;
      const selectionEndPos = textarea.selectionEnd;
      
      const startCoords = getTextareaCaretCoordinates(textarea, selectionStartPos);
      const endCoords = getTextareaCaretCoordinates(textarea, selectionEndPos);
      
      let top = textareaRect.top + startCoords.top - 60;
      let left = textareaRect.left + (startCoords.left + endCoords.left) / 2;
      
      if (top < textareaRect.top + 10) {
        top = textareaRect.top + startCoords.top + startCoords.height + 10;
      }
      
      if (top + 200 > textareaRect.bottom - 10) { 
        top = textareaRect.bottom - 210;
      }
      
      if (top < 10) {
        top = 10;
      }
      
      setEditorPosition({ top, left });
      setSelectedTextForAI(selectedTextValue);
      setActionTypeForAI('improve');
      setIsGeneratingAIInline(false);
      setInlineSelectionStart(selectionStartPos);
      setInlineSelectionEnd(selectionEndPos);
      setIsEditorVisible(true);
      setShowAISuggestions(false); // Hide other suggestions
    } else {
      setIsEditorVisible(false);
    }
  }, [isEditing]);

  // Enhanced typing animation with smooth cursor positioning (now in word chunks)
  const startTypingAnimation = useCallback((generatedContent: string, startPosition: number) => {
    // Split content into words, keeping spaces for accurate insertion
    const words = generatedContent.match(/\S+|\s+/g) || [];
    let wordIndex = 0;
    let currentContentLength = startPosition;

    setIsTypingAI(true);
    setTypingComplete(false);
    setCurrentTypingPosition(startPosition);

    // Clear any existing interval
    if (typingIntervalRef.current) {
      clearInterval(typingIntervalRef.current);
    }

    typingIntervalRef.current = setInterval(() => {
      if (wordIndex < words.length) {
        let chunkToType = '';
        const wordsPerChunk = 2; // Number of words to type per interval for a "chunk" effect

        // Append a chunk of words
        for (let i = 0; i < wordsPerChunk && wordIndex < words.length; i++) {
          chunkToType += words[wordIndex];
          wordIndex++;
        }

        const currentContentValue = textareaRef.current?.value || '';
        const newContent = currentContentValue.substring(0, currentContentLength) + chunkToType + currentContentValue.substring(currentContentLength);
        
        setContent(newContent);
        currentContentLength += chunkToType.length; // Update for next insertion
        setCurrentTypingPosition(currentContentLength);

        // Update cursor position in textarea
        if (textareaRef.current) {
          textareaRef.current.setSelectionRange(currentContentLength, currentContentLength);
          
          // Smart scroll to keep cursor visible
          const textarea = textareaRef.current;
          const coords = getTextareaCaretCoordinates(textarea, currentContentLength);
          const textareaRect = textarea.getBoundingClientRect();
          
          if (coords.top < textarea.scrollTop + 50) {
            textarea.scrollTop = coords.top - 50;
          } else if (coords.top > textarea.scrollTop + textareaRect.height - 100) {
            textarea.scrollTop = coords.top - textareaRect.height + 100;
          }
        }
      } else {
        // Typing complete
        if (typingIntervalRef.current) {
          clearInterval(typingIntervalRef.current);
          typingIntervalRef.current = null;
        }
        setTypingComplete(true);
        toast.success('AI content generated!', { id: 'inline-ai-gen' });
      }
    }, 5); // Slightly increased delay to make word chunks more noticeable, still very fast
  }, [setContent]);

  // Handler for accepting AI suggestion
  const handleAcceptAI = useCallback(() => {
    if (typingIntervalRef.current) {
      clearInterval(typingIntervalRef.current);
      typingIntervalRef.current = null;
    }
    
    // If typing wasn't complete, finish it instantly
    if (!typingComplete && generatedContentBufferRef.current) {
      const remainingContent = generatedContentBufferRef.current;
      const startPos = inlineSelectionStart !== null ? inlineSelectionStart : content.length;
      const currentContent = textareaRef.current?.value || content;
      // Ensure we append the full remaining content from the point of current typing
      const finalContent = currentContent.substring(0, currentTypingPosition) + 
                          remainingContent.substring(currentTypingPosition - startPos + (content.length - originalContentBeforeAI.length)) + // Adjust for content length changes
                          currentContent.substring(currentTypingPosition);
      setContent(finalContent);
    }

    // Reset all states
    setIsTypingAI(false);
    setTypingComplete(false);
    setOriginalContentBeforeAI('');
    setInlineSelectionStart(null);
    setInlineSelectionEnd(null);
    setCurrentTypingPosition(0);
    generatedContentBufferRef.current = '';
    
    toast.success('AI suggestion accepted!');
  }, [typingComplete, inlineSelectionStart, content, currentTypingPosition, setContent, originalContentBeforeAI]);

  // Handler for declining AI suggestion
  const handleDeclineAI = useCallback(() => {
    if (typingIntervalRef.current) {
      clearInterval(typingIntervalRef.current);
      typingIntervalRef.current = null;
    }

    // Revert to original content
    setContent(originalContentBeforeAI);
    
    // Reset all states
    setIsTypingAI(false);
    setTypingComplete(false);
    setOriginalContentBeforeAI('');
    setInlineSelectionStart(null);
    setInlineSelectionEnd(null);
    setCurrentTypingPosition(0);
    generatedContentBufferRef.current = '';
    
    toast.info('AI suggestion declined');
  }, [originalContentBeforeAI, setContent]);

  // AI generation handler
  const handleAIGenerate = async (selectedText: string, actionType: string, customInstruction: string): Promise<void> => {
    if (!userProfile) {
      toast.error('User profile not found. Cannot generate content.');
      return;
    }
    if (!selectedText.trim()) {
      toast.info('Please select some text to use AI actions.');
      return;
    }

    setIsEditorVisible(false);
    setIsGeneratingAIInline(true);
    toast.loading('Generating AI content...', { id: 'inline-ai-gen' });

    setOriginalContentBeforeAI(content);

    try {
      const { data, error } = await supabase.functions.invoke('generate-inline-content', {
        body: {
          selectedText: selectedText,
          fullNoteContent: content,
          userProfile: userProfile,
          actionType: actionType,
          customInstruction: customInstruction,
        },
      });

      if (error) {
        throw new Error(error.message || 'An unknown error occurred during inline AI generation.');
      }

      const generatedContent = data.generatedContent || '';
      generatedContentBufferRef.current = generatedContent;
      
      const start = inlineSelectionStart !== null ? inlineSelectionStart : content.length;
      const end = inlineSelectionEnd !== null ? inlineSelectionEnd : content.length;

      // Clear the original selected text
      const contentWithoutSelection = content.substring(0, start) + content.substring(end);
      setContent(contentWithoutSelection);
      
      // Start typing animation
      setTimeout(() => {
        startTypingAnimation(generatedContent, start);
      }, 100);

    } catch (error) {
      let errorMessage = 'Failed to generate content with AI.';
      if (error instanceof FunctionsHttpError) {
        errorMessage = `AI generation failed: ${error.context.statusText}`;
        if (error.message.includes("The model is overloaded")) {
          errorMessage = "AI model is currently overloaded. Please try again in a few moments.";
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
        if (error.message.includes("The model is overloaded")) {
          errorMessage = "AI model is currently overloaded. Please try again in a few moments.";
        }
      }
      toast.error(errorMessage, { id: 'inline-ai-gen' });
      console.error('AI generation error:', error);
      
      // Cleanup on error
      if (typingIntervalRef.current) {
        clearInterval(typingIntervalRef.current);
        typingIntervalRef.current = null;
      }
      setContent(originalContentBeforeAI);
      setIsTypingAI(false);
      setOriginalContentBeforeAI('');
    } finally {
      setIsGeneratingAIInline(false);
    }
  };

  // Handle AI suggestion click
  const handleAISuggestionClick = useCallback((suggestion: AISuggestion) => {
    if (!textareaRef.current) return;

    const textarea = textareaRef.current;
    const cursorPos = textarea.selectionStart;
    
    // Select some context around cursor for AI processing
    const contextStart = Math.max(0, cursorPos - 100);
    const contextEnd = Math.min(content.length, cursorPos + 100);
    const contextText = content.substring(contextStart, contextEnd);

    setSelectedTextForAI(contextText);
    setActionTypeForAI(suggestion.actionType);
    setInlineSelectionStart(contextStart);
    setInlineSelectionEnd(contextEnd);
    setShowAISuggestions(false);

    // Generate immediately
    handleAIGenerate(contextText, suggestion.actionType, '');
  }, [content, handleAIGenerate]);

  // Event listeners
  useEffect(() => {
    // Directly use textareaRef.current to avoid potential block-scoping issues
    if (textareaRef.current) {
      textareaRef.current.addEventListener('contextmenu', handleContextMenu as any);
    }

    return () => {
      if (textareaRef.current) {
        textareaRef.current.removeEventListener('contextmenu', handleContextMenu as any);
      }
    };
  }, [handleContextMenu]);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (typingIntervalRef.current) {
        clearInterval(typingIntervalRef.current);
        typingIntervalRef.current = null;
      }
    };
  }, []);

  // Click outside to hide suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setShowAISuggestions(false);
      }
    };

    if (showAISuggestions) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showAISuggestions]);

  return (
    <>
      {isEditing ? (
        <div ref={containerRef} className="flex-1 p-3 sm:p-6 flex flex-col dark:bg-gray-800 lg:flex-row gap-4 modern-scrollbar overflow-y-auto min-w-0 relative h-full">
          <Textarea
            ref={textareaRef}
            value={content}
            onChange={handleContentChange}
            placeholder="Start typing your note... (Right-click on selected text for AI assistance)"
            className="w-full lg:w-1/2 h-full resize-none border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4 focus:border-blue-500 dark:focus:border-blue-400 transition-colors duration-200 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-mono text-base leading-relaxed max-h-[600px] lg:max-h-none"
            style={{ minHeight: '400px', maxHeight: '600px', fontSize: '16px' }}
          />
          
          {/* Live Preview */}
          <div className="w-full lg:w-1/2 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col max-h-[600px] lg:max-h-none">
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900 dark:to-purple-900 px-4 py-2 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
              <h3 className="text-base font-semibold text-gray-700 dark:text-gray-300">
                Live Preview {isTypingAI && <span className="text-sm text-blue-600 dark:text-blue-400">(AI Typing...)</span>}
              </h3>
            </div>
            <div className="p-4 overflow-y-auto flex-1 modern-scrollbar">
              {content.trim() ? (
                <div className="prose prose-lg prose-slate dark:prose-invert max-w-none" style={{ fontSize: '16px', lineHeight: '1.7' }}>
                  {isTypingAI ? (
                    // Show raw text during AI typing to prevent diagram rendering errors
                    <pre className="whitespace-pre-wrap font-sans text-gray-700 dark:text-gray-200 text-base leading-relaxed">
                      {content}
                    </pre>
                  ) : (
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      rehypePlugins={[rehypeRaw]}
                      components={commonMarkdownComponents}
                    >
                      {content}
                    </ReactMarkdown>
                  )}
                </div>
              ) : (
                <p className="text-gray-400 dark:text-gray-500 italic text-base">Preview will appear here as you type...</p>
              )}
            </div>
          </div>

          {/* AI Typing Overlay */}
          {isTypingAI && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-2xl border border-gray-200 dark:border-gray-700 max-w-md w-full mx-4">
                <div className="flex items-center space-x-3 mb-4">
                  <Sparkles className="w-7 h-7 text-blue-500 animate-pulse" />
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">AI is typing...</h3>
                </div>
                <p className="text-gray-600 dark:text-gray-400 mb-6 text-base">
                  {typingComplete ? 'Generation complete!' : 'Generating AI content for your note...'}
                </p>
                <div className="flex space-x-3">
                  <Button
                    onClick={handleAcceptAI}
                    disabled={!typingComplete && !isGeneratingAIInline}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                  >
                    <Check className="w-4 h-4 mr-2" />
                    Accept
                  </Button>
                  <Button
                    onClick={handleDeclineAI}
                    variant="outline"
                    className="flex-1 border-red-300 text-red-600 hover:bg-red-50 dark:border-red-600 dark:text-red-400 dark:hover:bg-red-950"
                  >
                    <X className="w-4 h-4 mr-2" />
                    Decline
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        // Read-only view
        <div className="flex-1 p-3 sm:p-6 bg-white dark:bg-gray-900 overflow-y-auto modern-scrollbar">
          {content.trim() ? (
            <div className="prose prose-lg prose-slate dark:prose-invert max-w-3xl mx-auto" style={{ fontSize: '16px', lineHeight: '1.7' }}>
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw]}
                components={commonMarkdownComponents}
              >
                {content}
              </ReactMarkdown>
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="text-gray-400 dark:text-gray-500 text-2xl mb-2">📝</div>
              <p className="text-gray-500 dark:text-gray-400 text-lg">This note is empty</p>
              <p className="text-base text-gray-400 dark:text-gray-500 mt-1">Click edit to start writing</p>
            </div>
          )}
        </div>
      )}

      {/* Inline AI Editor Portal */}
      {isEditorVisible && createPortal(
        <InlineAIEditor
          position={editorPosition}
          selectedText={selectedTextForAI}
          actionType={actionTypeForAI}
          onGenerate={handleAIGenerate}
          originalText={content} // Pass the full content of the note
          onAccept={() => { /* Handle accept logic if needed */ }}
          onReject={() => setIsEditorVisible(false)} // Close editor on reject
          isVisible={isEditorVisible}
          isLoading={isGeneratingAIInline}
        />,
        document.body
      )}

      {/* AI Suggestions Portal */}
      {showAISuggestions && createPortal(
        <div 
          className="fixed z-50 bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 p-2 min-w-[200px]"
          style={{
            top: aiSuggestionsPosition.top,
            left: aiSuggestionsPosition.left,
            transform: 'translateX(-50%)'
          }}
        >
          <div className="flex items-center space-x-2 px-2 py-1 mb-2 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900 dark:to-purple-900 rounded">
            <Lightbulb className="w-5 h-5 text-yellow-500" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">AI Suggestions</span>
          </div>
          {suggestedActions.map((suggestion) => (
            <button
              key={suggestion.id}
              onClick={() => handleAISuggestionClick(suggestion)}
              className="w-full text-left px-3 py-2 text-sm rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group flex items-center space-x-3"
            >
              <span className="text-xl">{suggestion.icon}</span>
              <div className="flex-1">
                <div className="font-medium text-gray-900 dark:text-gray-100 text-sm">{suggestion.label}</div>
                <div className="text-gray-600 dark:text-gray-400 text-xs">{suggestion.description}</div>
              </div>
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  );
};
