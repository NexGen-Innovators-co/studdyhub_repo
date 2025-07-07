
import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent } from './ui/card';
import { Message } from '../types/Class';
import { UserProfile, Document } from '../types/Document';
import { supabase } from '@/integrations/supabase/client';

interface AIChatProps {
  messages: Message[];
  onSendMessage: (message: string) => void;
  isLoading: boolean;
  userProfile: UserProfile | null;
  documents: Document[];
}

export const AIChat: React.FC<AIChatProps> = ({ messages, onSendMessage, isLoading, userProfile, documents }) => {
  const [inputMessage, setInputMessage] = useState('');
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
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        // Create context from documents and notes
        const context = documents.map(doc => `Document: ${doc.title}`).join('\n');

        // Call the Gemini edge function
        const { data, error } = await supabase.functions.invoke('gemini-chat', {
          body: {
            message: inputMessage.trim(),
            userId: user.id,
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

        // The AI response is now handled by the edge function
        onSendMessage(inputMessage.trim());
        setInputMessage('');
      } catch (error) {
        console.error('Error sending message:', error);
        onSendMessage(inputMessage.trim()); // Fallback to original behavior
        setInputMessage('');
      }
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center">
            <Bot className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="font-semibold">AI Study Assistant</h2>
            <p className="text-sm text-gray-500">Ask questions about your notes, recordings, or study topics</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <Bot className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-500 mb-2">Welcome to your AI Study Assistant!</h3>
            <p className="text-gray-400 max-w-md mx-auto">
              I can help you with questions about your notes, create study guides, explain concepts, 
              and assist with your academic work. What would you like to know?
            </p>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {message.role === 'assistant' && (
              <div className="h-8 w-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center flex-shrink-0">
                <Bot className="h-4 w-4 text-white" />
              </div>
            )}
            
            <Card className={`max-w-[70%] ${
              message.role === 'user' 
                ? 'bg-blue-500 text-white' 
                : 'bg-white border-gray-200'
            }`}>
              <CardContent className="p-3">
                <p className="text-sm leading-relaxed">{message.content}</p>
                <p className={`text-xs mt-2 ${
                  message.role === 'user' ? 'text-blue-100' : 'text-gray-400'
                }`}>
                  {message.timestamp.toLocaleTimeString('en-US', { 
                    hour: 'numeric', 
                    minute: '2-digit' 
                  })}
                </p>
              </CardContent>
            </Card>

            {message.role === 'user' && (
              <div className="h-8 w-8 rounded-full bg-gray-300 flex items-center justify-center flex-shrink-0">
                <User className="h-4 w-4 text-gray-600" />
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-3">
            <div className="h-8 w-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center flex-shrink-0">
              <Bot className="h-4 w-4 text-white" />
            </div>
            <Card className="bg-white border-gray-200">
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm text-gray-500">AI is thinking...</span>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-200 bg-white">
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
            className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
};
