// AIChat.tsx
import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, FileText, History, X, RefreshCw, AlertTriangle, Copy, Check } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Message } from '../types/Class';
import { UserProfile, Document } from '../types/Document';
import { Note } from '../types/Note';
import { supabase } from '@/integrations/supabase/client';
import { DocumentSelector } from './DocumentSelector';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import Mermaid from './Mermaid';
import { Element } from 'hast';

// Import languages for syntax highlighting
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

// Create lowlight instance and register languages
import { lowlight } from 'lowlight';
import { LanguageFn } from 'highlight.js';

// Register languages with error handling
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

// Initialize languages
registerLanguages();

// Enhanced colorful syntax highlighting theme

const syntaxColorMap: { [key: string]: string } = {
  // Comments
  'hljs-comment': 'text-gray-500 italic',
  'hljs-quote': 'text-gray-500 italic',
  
  // Keywords
  'hljs-keyword': 'text-purple-600 font-semibold',
  'hljs-selector-tag': 'text-purple-600',
  'hljs-subst': 'text-purple-600',
  
  // Built-ins and types
  'hljs-built_in': 'text-blue-600 font-medium',
  'hljs-type': 'text-teal-600',
  'hljs-class': 'text-amber-600',
  
  // Strings
  'hljs-string': 'text-green-600',
  'hljs-title': 'text-green-600',
  'hljs-section': 'text-green-600',
  
  // Numbers and literals
  'hljs-number': 'text-orange-600',
  'hljs-literal': 'text-orange-600',
  'hljs-boolean': 'text-orange-600',
  
  // Variables and functions
  'hljs-variable': 'text-blue-700',
  'hljs-template-variable': 'text-blue-700',
  'hljs-function': 'text-blue-700 font-medium',
  'hljs-name': 'text-blue-700',
  
  // Parameters and attributes
  'hljs-params': 'text-amber-700',
  'hljs-attr': 'text-amber-600',
  'hljs-attribute': 'text-amber-600',
  
  // Tags and selectors
  'hljs-tag': 'text-red-600',
  'hljs-selector-id': 'text-red-600',
  'hljs-selector-class': 'text-green-600',
  'hljs-selector-attr': 'text-cyan-600',
  'hljs-selector-pseudo': 'text-pink-600',
  
  // Operators and symbols
  'hljs-operator': 'text-pink-600',
  'hljs-symbol': 'text-red-600',
  'hljs-bullet': 'text-pink-600',
  
  // Regular expressions
  'hljs-regexp': 'text-pink-700',
  
  // Meta information
  'hljs-meta': 'text-sky-600',
  'hljs-meta-keyword': 'text-sky-600 font-semibold',
  'hljs-meta-string': 'text-sky-700',
  
  // Additions and deletions (for diffs)
  'hljs-addition': 'text-green-700 bg-green-100',
  'hljs-deletion': 'text-red-700 bg-red-100',
  
  // Emphasis
  'hljs-emphasis': 'italic',
  'hljs-strong': 'font-bold',
  
  // Default - this is important!
  'hljs-code-text': 'text-gray-800',
};
// Error Boundary Component
export class CodeBlockErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode; fallback?: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('CodeBlock error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="my-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2 text-red-700">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm font-medium">Rendering Error</span>
          </div>
          <p className="text-sm text-red-600 mt-1">
            Failed to render this content. Please try refreshing or contact support if the issue persists.
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}

// Copy to clipboard hook
export const useCopyToClipboard = () => {
  const [copied, setCopied] = useState(false);

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('Code copied to clipboard!');
    } catch (error) {
      toast.error('Failed to copy code');
    }
  };

  return { copied, copy };
};

// Helper function to convert highlight.js output to React elements with enhanced colors
const renderHighlightedCode = (result: any) => {
  const renderNode = (node: any, index: number): React.ReactNode => {
    if (node.type === 'text') {
      return node.value;
    }
    if (node.type === 'element') {
      const { tagName, properties, children } = node;
      
      // Get the highlight.js classes and map them to our Tailwind classes
      const originalClasses = (properties?.className || []);
      const mappedClasses = originalClasses.map((cls: string) => {
        return syntaxColorMap[cls] || '';
      }).filter(Boolean).join(' ');
      
      // If no specific styling is found, use default text color
      const finalClassName = mappedClasses || 'text-gray-800';

      const props = {
        key: index,
        className: finalClassName,
        ...(properties || {}),
      };
      
      return React.createElement(
        tagName,
        props,
        children?.map((child: any, childIndex: number) => renderNode(child, childIndex))
      );
    }
    return null;
  };

  return result.children.map((node: any, index: number) => renderNode(node, index));
};

// Enhanced CodeBlock component with copy functionality and error handling
const CodeBlock: React.FC<any> = ({ node, inline, className, children, ...props }) => {
  const { copied, copy } = useCopyToClipboard();
  const match = /language-(\w+)/.exec(className || '');
  const lang = match && match[1];
  const codeContent = String(children).trim();

  // Handle Mermaid diagrams
  if (!inline && lang === 'mermaid') {
    return (
      <CodeBlockErrorBoundary 
        fallback={
          <div className="my-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center gap-2 text-yellow-700">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm font-medium">Mermaid Diagram Error</span>
            </div>
            <p className="text-sm text-yellow-600 mt-1">
              Failed to render Mermaid diagram. Raw content:
            </p>
            <pre className="text-sm text-gray-600 mt-2 p-2 bg-gray-50 rounded overflow-x-auto">
              {codeContent}
            </pre>
          </div>
        }
      >
        <Mermaid chart={codeContent} />
      </CodeBlockErrorBoundary>
    );
  }

  // Handle DOT diagrams
  if (!inline && lang === 'dot') {
    return (
      <div className="my-4 p-4 bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            DOT Graph
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => copy(codeContent)}
            className="h-6 w-6 p-0"
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          </Button>
        </div>
        <pre className="text-sm text-gray-700 whitespace-pre-wrap overflow-x-auto">
          {codeContent}
        </pre>
      </div>
    );
  }

  // Handle code blocks - SIMPLIFIED VERSION
  if (!inline && lang) {
    return (
      <div className="relative my-4 rounded-lg overflow-hidden shadow-sm border border-gray-200">
        {/* Header with language badge and copy button */}
        <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-400"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
            <div className="w-3 h-3 rounded-full bg-green-400"></div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">
              {lang}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => copy(codeContent)}
              className="h-6 w-6 p-0 text-gray-500 hover:text-gray-700 hover:bg-gray-100"
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            </Button>
          </div>
        </div>
        
        {/* Code content - Using a simpler approach with direct CSS */}
        <div className="p-4 bg-white overflow-x-auto">
          <pre className="font-mono text-sm leading-relaxed">
            <code 
              className="text-gray-800"
              dangerouslySetInnerHTML={{
                __html: highlightCode(codeContent, lang)
              }}
            />
          </pre>
        </div>
      </div>
    );
  }

  // Inline code
  return (
    <code className="bg-purple-50 text-purple-700 px-2 py-1 rounded-md font-mono text-sm border border-purple-200" {...props}>
      {children}
    </code>
  );
};

// Add this helper function for syntax highlighting
const highlightCode = (code: string, language: string) => {
  try {
    const result = lowlight.highlight(language, code);
    return toHtml(result);
  } catch (error) {
    console.warn('Syntax highlighting failed:', error);
    return escapeHtml(code);
  }
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

// Helper function to convert lowlight result to HTML
const toHtml = (result: any) => {
  const nodeToHtml = (node: any): string => {
    if (node.type === 'text') {
      return escapeHtml(node.value);
    }
    if (node.type === 'element') {
      const { tagName, properties, children } = node;
      const classNames = (properties?.className || []).join(' ');
      
      // Map highlight.js classes to inline styles for guaranteed rendering
      const styleMap: { [key: string]: string } = {
        'hljs-comment': 'color: #6b7280; font-style: italic;',
        'hljs-keyword': 'color: #7c3aed; font-weight: 600;',
        'hljs-string': 'color: #059669;',
        'hljs-number': 'color: #ea580c;',
        'hljs-built_in': 'color: #2563eb; font-weight: 500;',
        'hljs-function': 'color: #1d4ed8; font-weight: 500;',
        'hljs-variable': 'color: #1e40af;',
        'hljs-type': 'color: #0d9488;',
        'hljs-class': 'color: #d97706;',
        'hljs-attr': 'color: #d97706;',
        'hljs-tag': 'color: #dc2626;',
        'hljs-operator': 'color: #db2777;',
        'hljs-literal': 'color: #ea580c;',
        'hljs-meta': 'color: #0284c7;',
        'hljs-title': 'color: #059669;',
        'hljs-selector-tag': 'color: #7c3aed;',
        'hljs-selector-class': 'color: #059669;',
        'hljs-selector-id': 'color: #dc2626;',
        'hljs-regexp': 'color: #be185d;',
        'hljs-symbol': 'color: #dc2626;',
        'hljs-bullet': 'color: #db2777;',
        'hljs-params': 'color: #b45309;',
        'hljs-name': 'color: #1d4ed8;',
        'hljs-attribute': 'color: #d97706;',
        'hljs-selector-attr': 'color: #0891b2;',
        'hljs-selector-pseudo': 'color: #db2777;',
        'hljs-template-variable': 'color: #1e40af;',
        'hljs-quote': 'color: #6b7280; font-style: italic;',
        'hljs-deletion': 'color: #b91c1c; background-color: #fef2f2;',
        'hljs-addition': 'color: #166534; background-color: #f0fdf4;',
        'hljs-meta-keyword': 'color: #0284c7; font-weight: 600;',
        'hljs-meta-string': 'color: #0369a1;',
        'hljs-subst': 'color: #7c3aed;',
        'hljs-section': 'color: #059669;',
        'hljs-boolean': 'color: #ea580c;',
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
// Enhanced MarkdownRenderer with better error handling
const MarkdownRenderer: React.FC<{ content: string; isUserMessage?: boolean }> = ({ content, isUserMessage }) => {
  const textColorClass = isUserMessage ? 'text-white' : 'text-slate-700';
  const linkColorClass = isUserMessage ? 'text-blue-200 hover:underline' : 'text-blue-600 hover:underline';
  const listTextColorClass = isUserMessage ? 'text-white' : 'text-slate-700';
  const blockquoteTextColorClass = isUserMessage ? 'text-blue-100' : 'text-slate-600';
  const blockquoteBgClass = isUserMessage ? 'bg-blue-700 border-blue-400' : 'bg-blue-50 border-blue-500';

  return (
    <CodeBlockErrorBoundary>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={{
          code: CodeBlock,
          h1: ({node, ...props}) => <h1 className={`text-2xl font-extrabold ${isUserMessage ? 'text-white' : 'text-blue-700'} mt-4 mb-2`} {...props} />,
          h2: ({node, ...props}) => <h2 className={`text-xl font-bold ${isUserMessage ? 'text-white' : 'text-purple-700'} mt-3 mb-2`} {...props} />,
          h3: ({node, ...props}) => <h3 className={`text-lg font-semibold ${isUserMessage ? 'text-white' : 'text-green-700'} mt-2 mb-1`} {...props} />,
          h4: ({node, ...props}) => <h4 className={`text-base font-semibold ${isUserMessage ? 'text-white' : 'text-orange-700'} mt-1 mb-1`} {...props} />,
          p: ({node, ...props}) => <p className={`mb-2 ${textColorClass} leading-relaxed`} {...props} />,
          a: ({node, ...props}) => <a className={`${linkColorClass} font-medium`} {...props} />,
          ul: ({node, ...props}) => <ul className={`list-disc list-inside space-y-1 ${listTextColorClass} mb-2`} {...props} />,
          ol: ({node, ...props}) => <ol className={`list-decimal list-inside space-y-1 ${listTextColorClass} mb-2`} {...props} />,
          li: ({node, ...props}) => <li className="mb-1" {...props} />,
          blockquote: ({node, ...props}) => <blockquote className={`border-l-4 ${blockquoteBgClass} pl-4 py-2 italic ${blockquoteTextColorClass} rounded-r-md my-3`} {...props} />,
          table: ({ node, ...props }) => (
            <div className="overflow-x-auto my-4 rounded-lg shadow-md border border-slate-200">
              <table className="w-full border-collapse" {...props} />
            </div>
          ),
          thead: ({ node, ...props }) => <thead className="bg-gradient-to-r from-blue-100 to-purple-100" {...props} />,
          th: ({ node, ...props }) => (
            <th className="p-3 text-left border-b border-slate-300 font-semibold text-slate-800" {...props} />
          ),
          td: ({ node, ...props }) => (
            <td className="p-3 border-b border-slate-200 group-last:border-b-0 even:bg-slate-50 hover:bg-blue-50 transition-colors" {...props} />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </CodeBlockErrorBoundary>
  );
};

// Custom Confirmation Modal component
interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({ isOpen, onClose, onConfirm, title, message }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="bg-white rounded-lg shadow-xl max-w-sm w-full">
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-3">{title}</h3>
          <p className="text-slate-600 mb-6">{message}</p>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onClose} className="text-slate-600 border-slate-200 hover:bg-slate-50">
              Cancel
            </Button>
            <Button onClick={onConfirm} className="bg-red-600 text-white shadow-md hover:bg-red-700">
              Delete
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

interface AIChatProps {
  messages: Message[];
  onSendMessage: (message: string) => Promise<void>;
  isLoading: boolean;
  setIsLoading: (isLoading: boolean) => void;
  userProfile: UserProfile | null;
  documents: Document[];
  notes: Note[];
  selectedDocumentIds: string[];
  onSelectionChange: (ids: string[]) => void;
  activeChatSessionId: string | null;
  onNewChatSession: () => Promise<string | null>;
  onDeleteChatSession: (sessionId: string) => void;
  onRenameChatSession: (sessionId: string, newTitle: string) => void;
  onChatSessionSelect: (sessionId: string) => void;
  chatSessions: any[];
  onNewMessage: (message: Message) => void;
  onToggleChatHistory: () => void;
  onDeleteMessage: (messageId: string) => void;
  onRegenerateResponse: (lastUserMessageContent: string) => Promise<void>;
  onRetryFailedMessage: (originalUserMessageContent: string, failedAiMessageId: string) => Promise<void>;
}

export const AIChat: React.FC<AIChatProps> = ({
  messages,
  onSendMessage,
  isLoading,
  setIsLoading,
  userProfile,
  documents,
  notes,
  selectedDocumentIds,
  onSelectionChange,
  activeChatSessionId,
  onNewChatSession,
  onNewMessage,
  onToggleChatHistory,
  onDeleteMessage,
  onRegenerateResponse,
  onRetryFailedMessage,
}) => {
  const [inputMessage, setInputMessage] = useState('');
  const [showDocumentSelector, setShowDocumentSelector] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inputMessage.trim() && !isLoading) {
      try {
        await onSendMessage(inputMessage.trim());
        setInputMessage('');
      } catch (error: any) {
        console.error('Error in AIChat handleSubmit:', error);
        toast.error(`Failed to send message: ${error.message || 'Unknown error'}`);
      }
    }
  };

  const handleDeleteClick = (messageId: string) => {
    setMessageToDelete(messageId);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = () => {
    if (messageToDelete) {
      onDeleteMessage(messageToDelete);
      setMessageToDelete(null);
      setShowDeleteConfirm(false);
    }
  };

  const handleRegenerateClick = () => {
    const lastUserMessage = messages.slice().reverse().find(msg => msg.role === 'user');
    if (lastUserMessage) {
      onRegenerateResponse(lastUserMessage.content);
    } else {
      toast.info("No previous user message to regenerate from.");
    }
  };

  const handleRetryClick = (originalUserMessageContent: string, failedAiMessageId: string) => {
    onRetryFailedMessage(originalUserMessageContent, failedAiMessageId);
  };

  const displayMessages = messages;
  const lastMessageIsAssistant = displayMessages.length > 0 && displayMessages[displayMessages.length - 1].role === 'assistant';

  return (
    <CodeBlockErrorBoundary>
      <div className="flex flex-col h-full mx-auto sm:max-w-5xl bg-white rounded-lg shadow-md overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-slate-200 bg-white">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 flex items-center justify-center">
                <Bot className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="font-semibold text-slate-800 text-lg">AI Study Assistant</h2>
                <p className="text-sm text-slate-500">
                  {(selectedDocumentIds ?? []).length > 0
                    ? `Using ${(selectedDocumentIds ?? []).length} document${(selectedDocumentIds ?? []).length !== 1 ? 's' : ''} as context`
                    : 'Ask questions about your notes, recordings, or study topics'
                  }
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onToggleChatHistory}
                className="lg:hidden text-slate-600 border-slate-200 hover:bg-slate-50"
              >
                <History className="h-4 w-4 mr-2" />
                History
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDocumentSelector(true)}
                className="text-slate-600 border-slate-200 hover:bg-slate-50"
              >
                <FileText className="h-4 w-4 mr-2" />
                Documents ({(selectedDocumentIds ?? []).length})
              </Button>
            </div>
          </div>

          {(selectedDocumentIds ?? []).length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {(selectedDocumentIds ?? []).slice(0, 3).map(id => {
                const doc = (documents ?? []).find(d => d.id === id);
                const note = (notes ?? []).find(n => n.id === id);
                const item = doc || note;
                return item ? (
                  <Badge key={id} variant="secondary" className="text-xs bg-slate-100 text-slate-600 max-w-[150px] truncate">
                    {item.title}
                  </Badge>
                ) : null;
              })}
              {(selectedDocumentIds ?? []).length > 3 && (
                <Badge variant="secondary" className="text-xs bg-slate-100 text-slate-600">
                  +{(selectedDocumentIds ?? []).length - 3} more
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-auto p-4 sm:p-6 space-y-4 bg-slate-50">
          {(displayMessages ?? []).length === 0 && (activeChatSessionId === null) && (
            <div className="text-center py-8 text-slate-400">
              <Bot className="h-12 w-12 mx-auto text-slate-300 mb-4" />
              <h3 className="text-lg font-medium text-slate-700 mb-2">Welcome to your AI Study Assistant!</h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto">
                I can help you with questions about your notes, create study guides, explain concepts,
                and assist with your academic work. Select some documents and start chatting!
              </p>
            </div>
          )}

          {activeChatSessionId !== null && messages.length === 0 && isLoading && (
            <div className="flex gap-3 justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
              <span className="text-slate-500">Loading messages...</span>
            </div>
          )}

          {(displayMessages ?? []).map((message, index) => (
            <div
              key={message.id}
              className={`flex gap-2 group ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {message.role === 'assistant' && (
                <div className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  message.isError ? 'bg-red-500' : 'bg-gradient-to-r from-blue-600 to-purple-600'
                }`}>
                  {message.isError ? <AlertTriangle className="h-4 w-4 text-white" /> : <Bot className="h-4 w-4 text-white" />}
                </div>
              )}

              <div className={`flex flex-col ${message.role === 'user' ? 'items-end' : 'items-start'}`}>
                <Card className={`max-w-xs sm:max-w-2xl p-1 overflow-hidden rounded-lg shadow-sm ${
                  message.role === 'user'
                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
                    : message.isError
                      ? 'bg-red-50 border border-red-200 text-red-800'
                      : 'bg-white border border-slate-200'
                }`}>
                  <CardContent className="p-2 prose prose-sm max-w-none leading-relaxed">
                    <MarkdownRenderer content={message.content} isUserMessage={message.role === 'user'} />
                  </CardContent>
                </Card>

                <div className={`flex gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity ${
                  message.role === 'user' ? 'self-end' : 'self-start'
                }`}>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteClick(message.id)}
                    className="h-6 w-6 rounded-full text-slate-400 hover:text-red-500 hover:bg-slate-100"
                    title="Delete message"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                  
                  {message.role === 'assistant' && message.isError && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        const prevUserMessage = messages.slice(0, index).reverse().find(msg => msg.role === 'user');
                        if (prevUserMessage) {
                          handleRetryClick(prevUserMessage.content, message.id);
                        }
                      }}
                      className="h-6 w-6 rounded-full text-slate-400 hover:text-green-500 hover:bg-slate-100"
                      title="Retry failed message"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              {message.role === 'user' && (
                <div className="h-8 w-8 rounded-full bg-gradient-to-r from-green-500 to-blue-500 flex items-center justify-center flex-shrink-0">
                  <User className="h-4 w-4 text-white" />
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-3 items-center">
              <div className="h-8 w-8 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 flex items-center justify-center">
                <Bot className="h-4 w-4 text-white" />
              </div>
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-pulse"></div>
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-pulse delay-75"></div>
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-pulse delay-150"></div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 sm:p-6 border-t border-slate-200 bg-white">
          {lastMessageIsAssistant && !isLoading && (
            <div className="mb-4 flex justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRegenerateClick}
                className="text-slate-600 border-slate-200 hover:bg-slate-50"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Regenerate Response
              </Button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Ask a question about your notes or study topics..."
              className="flex-1 text-slate-700 border-slate-200 focus:border-blue-500 focus:ring-blue-500"
              disabled={isLoading}
            />
            <Button
              type="submit"
              disabled={isLoading || !inputMessage.trim()}
              className="bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md hover:from-blue-700 hover:to-purple-700 disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>
        </div>

        {/* Document Selector Modal */}
        {showDocumentSelector && (
          <DocumentSelector
            documents={documents}
            notes={notes}
            selectedDocumentIds={selectedDocumentIds}
            onSelectionChange={onSelectionChange}
            isOpen={showDocumentSelector}
            onClose={() => setShowDocumentSelector(false)}
          />
        )}

        {/* Delete Confirmation Modal */}
        <ConfirmationModal
          isOpen={showDeleteConfirm}
          onClose={() => setShowDeleteConfirm(false)}
          onConfirm={handleConfirmDelete}
          title="Delete Message"
          message="Are you sure you want to delete this message? This action cannot be undone."
        />
      </div>
    </CodeBlockErrorBoundary>
  );
};