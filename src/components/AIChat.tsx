import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, Sparkles, MessageCircle, BookOpen, Brain } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent } from './ui/card';
import { supabase } from '@/integrations/supabase/client';

// Types
interface Message {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface UserProfile {
  learning_style?: string;
  learning_preferences?: {
    explanation_style: string;
    examples: boolean;
    difficulty: string;
  };
}

interface Document {
  title: string;
  content?: string;
}

interface AIChatProps {
  messages: Message[];
  onSendMessage: (message: string) => void;
  isLoading: boolean;
  userProfile: UserProfile | null;
  documents: Document[];
}

export const AIChat: React.FC<AIChatProps> = ({ 
  messages, 
  onSendMessage, 
  isLoading, 
  userProfile, 
  documents 
}) => {
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [localLoading, setLocalLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent | React.MouseEvent) => {
    e.preventDefault();
    if (inputMessage.trim() && !isLoading && !localLoading) {
      setLocalLoading(true);
      setIsTyping(true);
      
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        // Create context from documents and notes
        const context = documents
          .map(doc => `Document: ${doc.title}${doc.content ? `\nContent: ${doc.content}` : ''}`)
          .join('\n\n');

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
          console.error('Supabase function error:', error);
          throw new Error('Failed to get AI response');
        }

        // The AI response is handled by the edge function and saved to database
        // Trigger the parent component to refresh messages
        onSendMessage(inputMessage.trim());
        setInputMessage('');
        
      } catch (error) {
        console.error('Error sending message:', error);
        // Fallback to original behavior
        onSendMessage(inputMessage.trim());
        setInputMessage('');
      } finally {
        setLocalLoading(false);
        setIsTyping(false);
      }
    }
  };

  const quickPrompts = [
    { icon: BookOpen, text: "Explain a concept", color: "from-green-400 to-blue-500" },
    { icon: Brain, text: "Create a study guide", color: "from-purple-400 to-pink-500" },
    { icon: MessageCircle, text: "Ask about notes", color: "from-orange-400 to-red-500" },
    { icon: Sparkles, text: "Practice questions", color: "from-cyan-400 to-blue-500" }
  ] as const;

  const isCurrentlyLoading = isLoading || localLoading || isTyping;

  return (
    <div className="flex flex-col h-full max-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      {/* Dynamic Header */}
      <div className="relative p-4 sm:p-6 border-b border-gray-200/50 bg-white/70 backdrop-blur-sm">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="relative">
            <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center shadow-lg">
              <Bot className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
            </div>
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-white animate-pulse"></div>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-lg sm:text-xl bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              AI Study Assistant
            </h2>
            <p className="text-sm text-gray-500 truncate">
              {isCurrentlyLoading ? 'Processing your request...' : 'Ready to help you learn • Online'}
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-xs text-gray-400">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-green-400 rounded-full"></div>
              <span>
                {userProfile?.learning_style ? 
                  `${userProfile.learning_style.charAt(0).toUpperCase() + userProfile.learning_style.slice(1)} Mode` : 
                  'Smart Mode'
                }
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
        {messages.length === 0 && (
          <div className="text-center py-8 sm:py-16">
            <div className="relative mb-6">
              <div className="h-16 w-16 sm:h-20 sm:w-20 mx-auto rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center shadow-xl">
                <Bot className="h-8 w-8 sm:h-10 sm:w-10 text-white" />
              </div>
              <div className="absolute -top-2 -right-2 w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center shadow-lg animate-bounce">
                <Sparkles className="h-3 w-3 text-white" />
              </div>
            </div>
            
            <h3 className="text-xl sm:text-2xl font-bold text-gray-800 mb-3">
              Welcome to your AI Study Assistant!
            </h3>
            <p className="text-gray-600 max-w-md mx-auto mb-8 leading-relaxed">
              I'm here to make learning engaging and effective. Ask me anything about your studies, and I'll provide personalized explanations.
            </p>

            {/* Quick Action Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 max-w-2xl mx-auto">
              {quickPrompts.map((prompt, index) => (
                <button
                  key={index}
                  onClick={() => setInputMessage(prompt.text)}
                  className="group p-3 sm:p-4 rounded-xl bg-white border border-gray-200 hover:border-transparent hover:shadow-lg transition-all duration-300 hover:scale-105 active:scale-95"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div className={`w-8 h-8 sm:w-10 sm:h-10 mx-auto mb-2 rounded-lg bg-gradient-to-r ${prompt.color} flex items-center justify-center group-hover:scale-110 transition-transform duration-200`}>
                    <prompt.icon className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                  </div>
                  <p className="text-xs sm:text-sm font-medium text-gray-700 group-hover:text-gray-900">
                    {prompt.text}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message Bubbles */}
        {messages.map((message, index) => (
          <div
            key={message.id}
            className={`flex gap-3 sm:gap-4 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            style={{ 
              opacity: 0,
              animation: `slideUp 0.4s ease-out ${index * 100}ms forwards`
            }}
          >
            {message.role === 'assistant' && (
              <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center flex-shrink-0 shadow-md">
                <Bot className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
              </div>
            )}
            
            <div className={`max-w-[85%] sm:max-w-[75%] ${
              message.role === 'user' 
                ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg' 
                : 'bg-white border border-gray-200 shadow-sm hover:shadow-md'
            } rounded-2xl transition-all duration-200`}>
              <div className="p-3 sm:p-4">
                <div className={`text-sm sm:text-base leading-relaxed ${
                  message.role === 'user' ? 'text-white' : 'text-gray-800'
                }`}>
                  {message.content.split('\n').map((line, i) => (
                    <React.Fragment key={i}>
                      {line}
                      {i < message.content.split('\n').length - 1 && <br />}
                    </React.Fragment>
                  ))}
                </div>
                <p className={`text-xs mt-2 ${
                  message.role === 'user' ? 'text-blue-100' : 'text-gray-400'
                }`}>
                  {message.timestamp.toLocaleTimeString('en-US', { 
                    hour: 'numeric', 
                    minute: '2-digit' 
                  })}
                </p>
              </div>
            </div>

            {message.role === 'user' && (
              <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-gradient-to-r from-gray-300 to-gray-400 flex items-center justify-center flex-shrink-0 shadow-md">
                <User className="h-4 w-4 sm:h-5 sm:w-5 text-gray-600" />
              </div>
            )}
          </div>
        ))}

        {/* Loading State */}
        {isCurrentlyLoading && (
          <div className="flex gap-3 sm:gap-4" style={{ opacity: 0, animation: 'fadeIn 0.3s ease-out forwards' }}>
            <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center flex-shrink-0 shadow-md">
              <Bot className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm">
              <div className="p-3 sm:p-4">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                  <span className="text-sm text-gray-500">
                    {localLoading ? 'Analyzing your question...' : 'AI is thinking...'}
                  </span>
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Enhanced Input Section */}
      <div className="p-4 sm:p-6 border-t border-gray-200/50 bg-white/70 backdrop-blur-sm">
        <div className="flex gap-2 sm:gap-3">
          <div className="flex-1 relative">
            <Input
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Ask me anything about your studies..."
              disabled={isCurrentlyLoading}
              className="pr-12 py-3 sm:py-4 text-sm sm:text-base rounded-full border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all duration-300"
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleSubmit(e);
                }
              }}
            />
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">
              <MessageCircle className="h-5 w-5" />
            </div>
          </div>
          <Button 
            onClick={handleSubmit}
            disabled={!inputMessage.trim() || isCurrentlyLoading}
            className="h-12 w-12 sm:h-14 sm:w-14 rounded-full p-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
          >
            <Send className="h-5 w-5 sm:h-6 sm:w-6" />
          </Button>
        </div>
        
        {/* Status Bar */}
        <div className="flex items-center justify-between mt-3 text-xs text-gray-500">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-400 rounded-full"></div>
            <span>Connected</span>
            {documents.length > 0 && (
              <span className="hidden sm:inline">• {documents.length} document{documents.length > 1 ? 's' : ''} available</span>
            )}
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden sm:inline">Press Enter to send</span>
            <span className={inputMessage.length > 400 ? 'text-orange-500' : ''}>{inputMessage.length}/500</span>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};