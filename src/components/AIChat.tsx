// AIChat.tsx
import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, FileText, History, X, RefreshCw, AlertTriangle } from 'lucide-react'; // Added AlertTriangle for error icon
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
// Removed: import 'highlight.js/styles/github-dark.css'; // This was causing the black and white theme
import Mermaid from './Mermaid'; // Assuming Mermaid.tsx is in the same directory
import { Element } from 'hast';

// Import languages for syntax highlighting
import javascript from 'highlight.js/lib/languages/javascript';
import python from 'highlight.js/lib/languages/python';
import java from 'highlight.js/lib/languages/java';
import cpp from 'highlight.js/lib/languages/cpp';
import sql from 'highlight.js/lib/languages/sql';
import xml from 'highlight.js/lib/languages/xml';
import bash from 'highlight.js/lib/languages/bash';

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

// Define a mapping of highlight.js classes to Tailwind CSS color classes
const syntaxColorMap: { [key: string]: string } = {
  'hljs-comment': 'text-slate-500', // Grey for comments
  'hljs-keyword': 'text-purple-400', // Purple for keywords
  'hljs-built_in': 'text-cyan-400', // Cyan for built-in functions/types
  'hljs-string': 'text-green-400', // Green for strings
  'hljs-variable': 'text-blue-300', // Blue for variables
  'hljs-number': 'text-orange-300', // Orange for numbers
  'hljs-literal': 'text-orange-300', // Orange for literals (true, false, null)
  'hljs-function': 'text-blue-300', // Blue for function names
  'hljs-params': 'text-yellow-300', // Yellow for function parameters
  'hljs-tag': 'text-pink-400', // Pink for HTML/XML tags
  'hljs-attr': 'text-cyan-400', // Cyan for HTML/XML attributes
  'hljs-selector-tag': 'text-purple-400', // Purple for CSS selectors
  'hljs-selector-id': 'text-orange-400', // Orange for CSS IDs
  'hljs-selector-class': 'text-green-400', // Green for CSS classes
  'hljs-regexp': 'text-pink-400', // Pink for regular expressions
  'hljs-meta': 'text-sky-400', // Sky blue for meta information (e.g., #include)
  'hljs-type': 'text-teal-400', // Teal for types
  'hljs-symbol': 'text-red-400', // Red for symbols
  'hljs-operator': 'text-pink-300', // Pink for operators
  // Default text color for code content not specifically highlighted
  'hljs-code-text': 'text-white',
};

// Helper function to convert highlight.js output to React elements with custom colors
const renderHighlightedCode = (result: any) => {
  const renderNode = (node: any, index: number): React.ReactNode => {
    if (node.type === 'text') {
      return node.value;
    }
    if (node.type === 'element') {
      const { tagName, properties, children } = node;
      const classNames = (properties?.className || []).map((cls: string) => {
        // Apply custom color if a mapping exists, otherwise keep original class
        return syntaxColorMap[cls] || cls;
      }).join(' ');

      const props = {
        key: index,
        className: classNames || syntaxColorMap['hljs-code-text'], // Fallback to default code text color
        ...properties,
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

// Custom CodeBlock component to handle various diagram types and code languages
const CodeBlock: React.FC<any> = ({ node, inline, className, children, ...props }) => {
  const match = /language-(\w+)/.exec(className || '');
  const lang = match && match[1];
  const codeContent = String(children).trim();

  if (!inline && lang === 'mermaid') {
    // Render Mermaid component with error handling
    return <Mermaid chart={codeContent} />;
  }

  if (!inline && lang === 'dot') {
    return (
      <div className="my-4 p-4 bg-white rounded-lg shadow-sm border">
        <pre className="text-sm text-gray-700 whitespace-pre-wrap">{codeContent}</pre>
      </div>
    );
  }

  if (!inline && lang) {
    try {
      const result = lowlight.highlight(lang, codeContent);
      return (
        <div className="relative my-4 rounded-md overflow-hidden">
          <div className="absolute top-0 right-0 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-xs px-2 py-1 rounded-bl-md">
            {lang.toUpperCase()}
          </div>
          <div className="p-4 bg-[#0d1117] text-white overflow-x-auto text-sm">
            <pre className="font-mono">
              <code>{renderHighlightedCode(result)}</code>
            </pre>
          </div>
        </div>
      );
    } catch (error) {
      // Fallback to plain text if highlighting fails
      return (
        <div className="relative my-4 rounded-md overflow-hidden">
          <div className="absolute top-0 right-0 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-xs px-2 py-1 rounded-bl-md">
            {lang.toUpperCase()}
          </div>
          <div className="p-4 bg-[#0d1117] text-white overflow-x-auto text-sm">
            <pre className="font-mono">
              <code>{codeContent}</code>
            </pre>
          </div>
        </div>
      );
    }
  }

  return (
    <code className="bg-slate-100 text-purple-600 px-1 py-0.5 rounded font-mono text-sm" {...props}>
      {children}
    </code>
  );
};

// MarkdownRenderer component with enhanced styling
const MarkdownRenderer: React.FC<{ content: string; isUserMessage?: boolean }> = ({ content, isUserMessage }) => {
  const textColorClass = isUserMessage ? 'text-white' : 'text-slate-700';
  const linkColorClass = isUserMessage ? 'text-blue-200 hover:underline' : 'text-blue-600 hover:underline';
  const listTextColorClass = isUserMessage ? 'text-white' : 'text-slate-700';
  const blockquoteTextColorClass = isUserMessage ? 'text-blue-100' : 'text-slate-600';
  const blockquoteBgClass = isUserMessage ? 'bg-blue-700 border-blue-400' : 'bg-blue-50 border-blue-500';

  return (
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
  onRetryFailedMessage: (originalUserMessageContent: string, failedAiMessageId: string) => Promise<void>; // New prop
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
  onRetryFailedMessage, // Destructure new prop
}) => {
  const [inputMessage, setInputMessage] = useState('');
  const [showDocumentSelector, setShowDocumentSelector] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false); // State for confirmation modal
  const [messageToDelete, setMessageToDelete] = useState<string | null>(null); // State to store ID of message to delete
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

// Simplified handleSubmit in AIChat.tsx - remove the duplicate logic
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  if (inputMessage.trim() && !isLoading) {
    try {
      // Just pass the message to the parent - let the parent handle all the session management
      await onSendMessage(inputMessage.trim());
      setInputMessage(''); // Clear input after successful send
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
    // Find the last user message
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
    <>
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
              <Bot className="h-12 sm:w-12 rounded-full mx-auto text-color-slate-300 mb-4" />
              <h3 className="text-lg font-medium text-slate-700 mb-2">Welcome to your AI Study Assistant!</h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto">
                I can help you with questions about your notes, create study guides, explain concepts,
                and assist with your academic work. Select some documents and start chatting!
              </p>
            </div>
          )}
          {/* Show loading indicator if messages are being fetched for a session */}
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
                <div className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${message.isError ? 'bg-red-500' : 'bg-gradient-to-r from-blue-600 to-purple-600'}`}>
                  {message.isError ? <AlertTriangle className="h-4 w-4 text-white" /> : <Bot className="h-4 w-4 text-white" />}
                </div>
              )}

              <div className={`flex flex-col ${message.role === 'user' ? 'items-end' : 'items-start'}`}>
                <Card className={`max-w-xs sm:max-w-2xl p-1 overflow-hidden rounded-lg shadow-sm ${
                  message.role === 'user'
                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
                    : message.isError
                      ? 'bg-red-50 border border-red-200 text-red-800' // Error message styling
                      : 'bg-white border border-slate-200'
                }`}>
                  <CardContent className="p-2 prose prose-sm max-w-none leading-relaxed">
                    <MarkdownRenderer content={message.content} isUserMessage={message.role === 'user'} />
                  </CardContent>
                </Card>

                {/* Buttons below the card, visible on group hover */}
                <div className={`flex gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity ${
                  message.role === 'user' ? 'self-end' : 'self-start' // Align buttons with the message bubble
                }`}>
                  {/* Delete button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteClick(message.id)}
                    className="h-6 w-6 rounded-full text-slate-400 hover:text-red-500 hover:bg-slate-100"
                    title="Delete message"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                  {/* Regenerate button for the last assistant message (if not an error) */}
                  {message.role === 'assistant' && index === displayMessages.length - 1 && !message.isError && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleRegenerateClick}
                      className="h-6 w-6 rounded-full text-slate-400 hover:text-blue-500 hover:bg-slate-100"
                      title="Regenerate response"
                      disabled={isLoading}
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  )}
                  {/* Retry button for failed assistant messages */}
                  {message.role === 'assistant' && message.isError && message.originalUserMessageContent && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRetryClick(message.originalUserMessageContent!, message.id)}
                      className="h-6 w-6 rounded-full text-red-500 hover:text-red-700 hover:bg-red-100"
                      title="Retry message"
                      disabled={isLoading}
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              {message.role === 'user' && (
                <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
                  <User className="h-4 w-4 text-slate-600" />
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-3">
              <div className="h-8 w-8 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 flex items-center justify-center flex-shrink-0">
                <Bot className="h-4 w-4 text-white" />
              </div>
              <Card className="bg-white border border-slate-200 rounded-lg shadow-sm">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
                    <span className="text-sm text-slate-500">AI is thinking...</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 sm:p-6 border-t border-slate-200 bg-white">
          <form onSubmit={handleSubmit} className="flex gap-2 flex-col sm:flex-row">
            <Input
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Ask me anything about your studies..."
              disabled={isLoading}
              className="flex-1 border-slate-200 focus-visible:ring-blue-500"
            />
            <Button
              type="submit"
              disabled={!inputMessage.trim() || isLoading}
              className="bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md hover:from-blue-700 hover:to-purple-700"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>

      {/* Document Selector */}
      <DocumentSelector
        documents={documents}
        notes={notes}
        selectedDocumentIds={selectedDocumentIds}
        onSelectionChange={onSelectionChange}
        isOpen={showDocumentSelector}
        onClose={() => setShowDocumentSelector(false)}
      />

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleConfirmDelete}
        title="Confirm Deletion"
        message="Are you sure you want to delete this message? This action cannot be undone."
      />
    </>
  );
};
