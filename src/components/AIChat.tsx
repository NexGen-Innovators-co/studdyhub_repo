
import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, FileText, History, Settings } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Message } from '../types/Class';
import { UserProfile, Document } from '../types/Document';
import { Note } from '../types/Note';
import { supabase } from '@/integrations/supabase/client';
import { DocumentSelector } from './DocumentSelector';
import { ChatHistory } from './ChatHistory';
import { toast } from 'sonner';

interface ChatSession {
  id: string;
  title: string;
  created_at: Date;
  updated_at: Date;
  last_message_at: Date;
  document_ids: string[];
  message_count?: number;
}

interface AIChatProps {
  messages: Message[];
  onSendMessage: (message: string) => void;
  isLoading: boolean;
  userProfile: UserProfile | null;
  documents: Document[];
  notes: Note[];
}

export const AIChat: React.FC<AIChatProps> = ({ messages, onSendMessage, isLoading, userProfile, documents, notes }) => {
  const [inputMessage, setInputMessage] = useState('');
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);
  const [showDocumentSelector, setShowDocumentSelector] = useState(false);
  const [showChatHistory, setShowChatHistory] = useState(false);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sessionMessages, setSessionMessages] = useState<Message[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [sessionMessages]);

  useEffect(() => {
    loadChatSessions();
  }, []);

  useEffect(() => {
    if (activeSessionId) {
      loadSessionMessages(activeSessionId);
    }
  }, [activeSessionId]);

  const loadChatSessions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('chat_sessions')
        .select('*')
        .eq('user_id', user.id)
        .order('last_message_at', { ascending: false });

      if (error) throw error;

      const formattedSessions: ChatSession[] = data.map(session => ({
        id: session.id,
        title: session.title,
        created_at: new Date(session.created_at),
        updated_at: new Date(session.updated_at),
        last_message_at: new Date(session.last_message_at),
        document_ids: session.document_ids || []
      }));

      setSessions(formattedSessions);

      // Auto-select the most recent session if none is selected
      if (formattedSessions.length > 0 && !activeSessionId) {
        setActiveSessionId(formattedSessions[0].id);
        setSelectedDocumentIds(formattedSessions[0].document_ids);
      }
    } catch (error) {
      console.error('Error loading chat sessions:', error);
    }
  };

  const loadSessionMessages = async (sessionId: string) => {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('timestamp', { ascending: true });

      if (error) throw error;

      const formattedMessages: Message[] = data.map(msg => ({
        id: msg.id,
        content: msg.content,
        role: msg.role as 'user' | 'assistant',
        timestamp: new Date(msg.timestamp || Date.now())
      }));

      setSessionMessages(formattedMessages);
    } catch (error) {
      console.error('Error loading session messages:', error);
      setSessionMessages([]);
    }
  };

  const createNewSession = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('chat_sessions')
        .insert({
          user_id: user.id,
          title: 'New Chat',
          document_ids: selectedDocumentIds
        })
        .select()
        .single();

      if (error) throw error;

      const newSession: ChatSession = {
        id: data.id,
        title: data.title,
        created_at: new Date(data.created_at),
        updated_at: new Date(data.updated_at),
        last_message_at: new Date(data.last_message_at),
        document_ids: data.document_ids || []
      };

      setSessions(prev => [newSession, ...prev]);
      setActiveSessionId(newSession.id);
      setSessionMessages([]);
    } catch (error) {
      console.error('Error creating new session:', error);
      toast.error('Failed to create new chat session');
    }
  };

  const deleteSession = async (sessionId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('chat_sessions')
        .delete()
        .eq('id', sessionId)
        .eq('user_id', user.id);

      if (error) throw error;

      setSessions(prev => prev.filter(s => s.id !== sessionId));
      
      if (activeSessionId === sessionId) {
        const remainingSessions = sessions.filter(s => s.id !== sessionId);
        if (remainingSessions.length > 0) {
          setActiveSessionId(remainingSessions[0].id);
        } else {
          setActiveSessionId(null);
          setSessionMessages([]);
        }
      }
    } catch (error) {
      console.error('Error deleting session:', error);
      toast.error('Failed to delete chat session');
    }
  };

  const renameSession = async (sessionId: string, newTitle: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('chat_sessions')
        .update({ title: newTitle })
        .eq('id', sessionId)
        .eq('user_id', user.id);

      if (error) throw error;

      setSessions(prev => prev.map(s => 
        s.id === sessionId ? { ...s, title: newTitle } : s
      ));
    } catch (error) {
      console.error('Error renaming session:', error);
      toast.error('Failed to rename chat session');
    }
  };

  const buildRichContext = () => {
    const selectedDocs = documents.filter(doc => selectedDocumentIds.includes(doc.id));
    const selectedNotes = notes.filter(note => selectedDocumentIds.includes(note.id));

    let context = '';

    if (selectedDocs.length > 0) {
      context += 'DOCUMENTS:\n';
      selectedDocs.forEach(doc => {
        context += `Title: ${doc.title}\n`;
        context += `File: ${doc.file_name}\n`;
        if (doc.content_extracted) {
          // Truncate content to prevent token overflow
          const content = doc.content_extracted.length > 2000 
            ? doc.content_extracted.substring(0, 2000) + '...'
            : doc.content_extracted;
          context += `Content: ${content}\n`;
        }
        context += '\n';
      });
    }

    if (selectedNotes.length > 0) {
      context += 'NOTES:\n';
      selectedNotes.forEach(note => {
        context += `Title: ${note.title}\n`;
        context += `Category: ${note.category}\n`;
        if (note.content) {
          const content = note.content.length > 1500 
            ? note.content.substring(0, 1500) + '...'
            : note.content;
          context += `Content: ${content}\n`;
        }
        if (note.aiSummary) {
          context += `AI Summary: ${note.aiSummary}\n`;
        }
        if (note.tags.length > 0) {
          context += `Tags: ${note.tags.join(', ')}\n`;
        }
        context += '\n';
      });
    }

    return context;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inputMessage.trim() && !isLoading) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        // Create or use existing session
        let sessionId = activeSessionId;
        if (!sessionId) {
          await createNewSession();
          sessionId = activeSessionId; // This will be set by createNewSession
          if (!sessionId) return;
        }

        // Build rich context from selected documents and notes
        const context = buildRichContext();

        // Call the Gemini edge function
        const { data, error } = await supabase.functions.invoke('gemini-chat', {
          body: {
            message: inputMessage.trim(),
            userId: user.id,
            sessionId: sessionId,
            learningStyle: userProfile?.learning_style || 'visual',
            learningPreferences: userProfile?.learning_preferences || {
              explanation_style: 'detailed',
              examples: true,
              difficulty: 'intermediate'
            },
            context
          }
        });

        if (error) {
          throw new Error('Failed to get AI response');
        }

        // Update session document IDs
        await supabase
          .from('chat_sessions')
          .update({ 
            document_ids: selectedDocumentIds,
            last_message_at: new Date().toISOString()
          })
          .eq('id', sessionId);

        // Reload messages to show the new conversation
        await loadSessionMessages(sessionId);
        setInputMessage('');
      } catch (error) {
        console.error('Error sending message:', error);
        toast.error('Failed to send message');
        setInputMessage('');
      }
    }
  };

  const displayMessages = sessionMessages.length > 0 ? sessionMessages : messages;

  return (
    <>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="p-4 border-b bg-background">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-gradient-to-r from-primary to-secondary flex items-center justify-center">
                <Bot className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <h2 className="font-semibold">AI Study Assistant</h2>
                <p className="text-sm text-muted-foreground">
                  {selectedDocumentIds.length > 0 
                    ? `Using ${selectedDocumentIds.length} document${selectedDocumentIds.length !== 1 ? 's' : ''} as context`
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
              >
                <FileText className="h-4 w-4 mr-2" />
                Documents ({selectedDocumentIds.length})
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowChatHistory(true)}
              >
                <History className="h-4 w-4 mr-2" />
                History
              </Button>
            </div>
          </div>

          {selectedDocumentIds.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {selectedDocumentIds.slice(0, 3).map(id => {
                const doc = documents.find(d => d.id === id);
                const note = notes.find(n => n.id === id);
                const item = doc || note;
                return item ? (
                  <Badge key={id} variant="secondary" className="text-xs">
                    {item.title}
                  </Badge>
                ) : null;
              })}
              {selectedDocumentIds.length > 3 && (
                <Badge variant="secondary" className="text-xs">
                  +{selectedDocumentIds.length - 3} more
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {displayMessages.length === 0 && (
            <div className="text-center py-8">
              <Bot className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">Welcome to your AI Study Assistant!</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                I can help you with questions about your notes, create study guides, explain concepts, 
                and assist with your academic work. Select some documents and start chatting!
              </p>
            </div>
          )}

          {displayMessages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {message.role === 'assistant' && (
              <div className="h-8 w-8 rounded-full bg-gradient-to-r from-primary to-secondary flex items-center justify-center flex-shrink-0">
                <Bot className="h-4 w-4 text-primary-foreground" />
              </div>
            )}
            
            <Card className={`max-w-[70%] ${
              message.role === 'user' 
                ? 'bg-primary text-primary-foreground' 
                : 'bg-card border'
            }`}>
              <CardContent className="p-3">
                <p className="text-sm leading-relaxed">{message.content}</p>
                <p className={`text-xs mt-2 ${
                  message.role === 'user' ? 'text-primary-foreground/70' : 'text-muted-foreground'
                }`}>
                  {message.timestamp.toLocaleTimeString('en-US', { 
                    hour: 'numeric', 
                    minute: '2-digit' 
                  })}
                </p>
              </CardContent>
            </Card>

            {message.role === 'user' && (
              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                <User className="h-4 w-4 text-muted-foreground" />
              </div>
            )}
          </div>
        ))}

          {isLoading && (
            <div className="flex gap-3">
              <div className="h-8 w-8 rounded-full bg-gradient-to-r from-primary to-secondary flex items-center justify-center flex-shrink-0">
                <Bot className="h-4 w-4 text-primary-foreground" />
              </div>
              <Card className="bg-card border">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm text-muted-foreground">AI is thinking...</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t bg-background">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Ask me anything about your studies..."
              disabled={isLoading}
              className="flex-1"
            />
            <Button 
              type="submit" 
              disabled={!inputMessage.trim() || isLoading}
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
        onSelectionChange={setSelectedDocumentIds}
        isOpen={showDocumentSelector}
        onClose={() => setShowDocumentSelector(false)}
      />

      {/* Chat History */}
      <ChatHistory
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSessionSelect={setActiveSessionId}
        onNewSession={createNewSession}
        onDeleteSession={deleteSession}
        onRenameSession={renameSession}
        isOpen={showChatHistory}
        onClose={() => setShowChatHistory(false)}
      />
    </>
  );
};
