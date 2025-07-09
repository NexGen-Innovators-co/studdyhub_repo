import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, FileText, History } from 'lucide-react';
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
import rehypeRaw from 'rehype-raw'; // Needed for rendering raw HTML, especially for Mermaid SVG
import 'highlight.js/styles/github.css'; // For default highlight.js theme
import Mermaid from './Mermaid'; // Ensure this is the updated Mermaid component

// Custom CodeBlock component to handle Mermaid and apply syntax highlighting styles
const CodeBlock: React.FC<any> = ({ node, inline, className, children, ...props }) => {
  const match = /language-(\w+)/.exec(className || '');
  const lang = match && match[1];

  if (!inline && lang === 'mermaid') {
    // Trim the Mermaid chart content to remove any leading/trailing whitespace or newlines
    const chartContent = String(children).trim();
    return <Mermaid chart={chartContent} />;
  }

  // Apply dark theme and language label for other code blocks
  return !inline && lang ? (
    <div className="relative my-4 rounded-md overflow-hidden">
      <div className="absolute top-0 right-0 bg-slate-700 text-white text-xs px-2 py-1 rounded-bl-md">
        {lang.toUpperCase()}
      </div>
      <pre className="p-4 bg-slate-800 text-white overflow-x-auto">
        <code className={`language-${lang}`} {...props}>
          {children}
        </code>
      </pre>
    </div>
  ) : (
    // Inline code styling
    <code className="bg-slate-100 text-purple-600 px-1 py-0.5 rounded" {...props}>
      {children}
    </code>
  );
};

// MarkdownRenderer component to apply consistent styling to chat messages
const MarkdownRenderer: React.FC<{ content: string }> = ({ content }) => {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeRaw]} // Allow raw HTML for Mermaid SVGs
      components={{
        code: CodeBlock,
        // Colorful Typography for AI responses
        h1: ({node, ...props}) => <h1 className="text-2xl font-extrabold text-blue-700 mt-4 mb-2" {...props} />,
        h2: ({node, ...props}) => <h2 className="text-xl font-bold text-purple-700 mt-3 mb-2" {...props} />,
        h3: ({node, ...props}) => <h3 className="text-lg font-semibold text-green-700 mt-2 mb-1" {...props} />,
        h4: ({node, ...props}) => <h4 className="text-base font-semibold text-orange-700 mt-1 mb-1" {...props} />,
        p: ({node, ...props}) => <p className="mb-2 text-slate-700 leading-relaxed" {...props} />,
        a: ({node, ...props}) => <a className="text-blue-600 hover:underline" {...props} />,
        ul: ({node, ...props}) => <ul className="list-disc list-inside space-y-1 text-slate-700 mb-2" {...props} />,
        ol: ({node, ...props}) => <ol className="list-decimal list-inside space-y-1 text-slate-700 mb-2" {...props} />,
        li: ({node, ...props}) => <li className="mb-1" {...props} />,
        blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-blue-400 pl-4 py-2 italic text-slate-600 bg-blue-50 rounded-r-md my-3" {...props} />,
        
        // Beautiful Tables
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
  onToggleChatHistory: () => void; // Added this prop back
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
  onDeleteChatSession, 
  onRenameChatSession, 
  onChatSessionSelect, 
  chatSessions, 
  onNewMessage,
  onToggleChatHistory, // Destructure the prop
}) => {
  const [inputMessage, setInputMessage] = useState('');
  const [showDocumentSelector, setShowDocumentSelector] = useState(false);
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
        setIsLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        let currentSessionId = activeChatSessionId;
        
        // Create new session if needed
        if (!currentSessionId) {
          currentSessionId = await onNewChatSession();
          if (!currentSessionId) {
            toast.error("Failed to create chat session");
            setIsLoading(false);
            return;
          }
          // onChatSessionSelect(currentSessionId); // This is now handled by onNewChatSession internally
          toast.info("A new chat session was created. Please send your message again.");
          // Do not return here, allow the message to be sent to the new session
        }
        
        // Call parent's send message handler
        await onSendMessage(inputMessage.trim());
        setInputMessage(''); // Clear input after sending
        
      } catch (error) {
        console.error('Error sending message:', error);
        toast.error('Failed to send message');
        
        // Create error message
        const errorMessage: Message = {
          id: `msg-${Date.now()}-error`,
          role: 'assistant',
          content: "Sorry, I encountered an error. Please try again.",
          timestamp: new Date(),
        };
        
        onNewMessage(errorMessage);
        setIsLoading(false);
      }
    }
  };

  const displayMessages = messages; 

  return (
    <>
      <div className="flex flex-col h-full w-full max-w-screen-xl mx-auto">
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
                onClick={onToggleChatHistory} // Use the passed prop
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
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-slate-50">
          {(displayMessages ?? []).length === 0 && (
            <div className="text-center py-8 text-slate-400">
              <Bot className="h-12 w-12 mx-auto text-slate-300 mb-4" />
              <h3 className="text-lg font-medium text-slate-700 mb-2">Welcome to your AI Study Assistant!</h3>
              <p className="text-slate-500 max-w-md mx-auto">
                I can help you with questions about your notes, create study guides, explain concepts, 
                and assist with your academic work. Select some documents and start chatting!
              </p>
            </div>
          )}

          {(displayMessages ?? []).map((message) => (
          <div
            key={message.id}
            className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {message.role === 'assistant' && (
              <div className="h-8 w-8 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 flex items-center justify-center flex-shrink-0">
                <Bot className="h-4 w-4 text-white" />
              </div>
            )}
            
            <Card className={`w-full sm:max-w-[75%] rounded-lg shadow-sm ${
              message.role === 'user' 
                ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white' 
                : 'bg-white border border-slate-200'
            }`}>
              <CardContent className="p-3 prose prose-sm max-w-none leading-relaxed">
                <MarkdownRenderer content={message.content} />
              </CardContent>
            </Card>

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
    </>
  );
};
