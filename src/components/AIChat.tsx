import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, FileText } from 'lucide-react';
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
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github.css';
import Mermaid from './Mermaid';

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
}

const CodeBlock: React.FC<any> = ({ node, inline, className, children, ...props }) => {
  const match = /language-(\w+)/.exec(className || '');
  
  if (match?.[1] === 'mermaid') {
    return <Mermaid chart={String(children).replace(/\n$/, '')} />;
  }

  return !inline ? (
    <pre className={className} {...props}>
      <code className={className}>
        {children}
      </code>
    </pre>
  ) : (
    <code className={className} {...props}>
      {children}
    </code>
  );
};

const MarkdownRenderer: React.FC<{ content: string }> = ({ content }) => {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeHighlight]}
      components={{
        code: CodeBlock,
        a: ({ node, ...props }) => (
          <a className="text-blue-600 hover:underline" {...props} />
        ),
        ul: ({ node, ...props }) => (
          <ul className="list-disc pl-5 mb-3" {...props} />
        ),
        ol: ({ node, ...props }) => (
          <ol className="list-decimal pl-5 mb-3" {...props} />
        ),
        li: ({ node, ...props }) => (
          <li className="mb-1" {...props} />
        ),
        table: ({ node, ...props }) => (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse" {...props} />
          </div>
        ),
        th: ({ node, ...props }) => (
          <th className="border border-slate-300 px-3 py-1 bg-slate-100 font-semibold" {...props} />
        ),
        td: ({ node, ...props }) => (
          <td className="border border-slate-300 px-3 py-1" {...props} />
        ),
        blockquote: ({ node, ...props }) => (
          <blockquote className="border-l-4 border-slate-400 pl-4 italic text-slate-600" {...props} />
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
};

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
          onChatSessionSelect(currentSessionId);
          toast.info("A new chat session was created. Please send your message again.");
          setIsLoading(false);
          return;
        }

        
        // Call parent's send message handler
        await onSendMessage(inputMessage.trim());
        
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
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="p-6 border-b border-slate-200 bg-white">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 flex items-center justify-center">
                <Bot className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="font-semibold text-slate-800">AI Study Assistant</h2>
                <p className="text-sm text-slate-500">
                  {(selectedDocumentIds ?? []).length > 0 
                    ? `Using ${(selectedDocumentIds ?? []).length} document${(selectedDocumentIds ?? []).length !== 1 ? 's' : ''} as context`
                    : 'Ask questions about your notes, recordings, or study topics'
                  }
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
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
                  <Badge key={id} variant="secondary" className="text-xs bg-slate-100 text-slate-600">
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
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50">
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
              
              <Card className={`max-w-[85%] rounded-lg shadow-sm ${
                message.role === 'user' 
                  ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white' 
                  : 'bg-white border border-slate-200'
              }`}>
                <CardContent className="p-4">
                  <div className="text-sm leading-relaxed overflow-auto">
                    <MarkdownRenderer content={message.content} />
                  </div>
                  <p className={`text-xs mt-2 ${message.role === 'user' ? 'text-white/70' : 'text-slate-500'}`}>
                    {message.timestamp.toLocaleTimeString('en-US', { 
                      hour: 'numeric', 
                      minute: '2-digit' 
                    })}
                  </p>
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
        <div className="p-6 border-t border-slate-200 bg-white">
          <form onSubmit={handleSubmit} className="flex gap-2">
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