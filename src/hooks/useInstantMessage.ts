import { useState, useCallback, useRef } from 'react';
import { Message } from '../types/Class';
import { generateId } from '../utils/helpers';

interface UseInstantMessageReturn {
  optimisticMessages: Message[];
  addOptimisticUserMessage: (content: string, attachments?: any) => string;
  addOptimisticAIMessage: (content?: string) => string;
  updateOptimisticMessage: (id: string, content: string, isComplete?: boolean) => void;
  removeOptimisticMessage: (id: string) => void;
  clearOptimisticMessages: () => void;
  replaceWithActualMessage: (optimisticId: string, actualMessage: Message) => void;
}

export const useInstantMessage = (actualMessages: Message[]): UseInstantMessageReturn => {
  const [optimisticMessages, setOptimisticMessages] = useState<Message[]>([]);
  const pendingMessageIds = useRef<Set<string>>(new Set());

  const addOptimisticUserMessage = useCallback((content: string, attachments?: any): string => {
    const id = generateId();
    const message: Message = {
      id,
      content,
      role: 'user',
      timestamp: new Date().toISOString(),
      isError: false,
      session_id: '',
      has_been_displayed: false,
      ...attachments
    };

    setOptimisticMessages(prev => [...prev, message]);
    pendingMessageIds.current.add(id);
    return id;
  }, []);

  const addOptimisticAIMessage = useCallback((content: string = ''): string => {
    const id = generateId();
    const message: Message = {
      id,
      content,
      role: 'assistant',
      timestamp: new Date().toISOString(),
      isError: false,
      session_id: '',
      has_been_displayed: false
    };

    setOptimisticMessages(prev => [...prev, message]);
    pendingMessageIds.current.add(id);
    return id;
  }, []);

  const updateOptimisticMessage = useCallback((id: string, content: string, isComplete: boolean = false) => {
    setOptimisticMessages(prev => 
      prev.map(msg => 
        msg.id === id 
          ? { ...msg, content }
          : msg
      )
    );
  }, []);

  const removeOptimisticMessage = useCallback((id: string) => {
    setOptimisticMessages(prev => prev.filter(msg => msg.id !== id));
    pendingMessageIds.current.delete(id);
  }, []);

  const clearOptimisticMessages = useCallback(() => {
    setOptimisticMessages([]);
    pendingMessageIds.current.clear();
  }, []);

  const replaceWithActualMessage = useCallback((optimisticId: string, actualMessage: Message) => {
    setOptimisticMessages(prev => 
      prev.map(msg => 
        msg.id === optimisticId ? actualMessage : msg
      )
    );
    pendingMessageIds.current.delete(optimisticId);
  }, []);

  // Merge actual messages with optimistic ones, avoiding duplicates
  const allMessages = [...actualMessages];
  
  // Add optimistic messages that don't have actual counterparts
  optimisticMessages.forEach(optimistic => {
    // Don't add optimistic messages that have been replaced by actual ones
    if (!allMessages.find(actual => actual.id === optimistic.id || 
        (actual.content === optimistic.content && Math.abs(new Date(actual.timestamp).getTime() - new Date(optimistic.timestamp).getTime()) < 5000)
    )) {
      allMessages.push(optimistic);
    }
  });

  // Sort by timestamp and ensure no duplicate welcome messages
  allMessages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  
  // Remove duplicate welcome messages (keep only the first one)
  const seenWelcomeMessage = new Set();
  const filteredMessages = allMessages.filter(message => {
    if (message.role === 'assistant' && message.content.includes('Welcome to your AI Study Assistant')) {
      if (seenWelcomeMessage.has('welcome')) {
        return false;
      }
      seenWelcomeMessage.add('welcome');
    }
    return true;
  });

  return {
    optimisticMessages: filteredMessages,
    addOptimisticUserMessage,
    addOptimisticAIMessage,
    updateOptimisticMessage,
    removeOptimisticMessage,
    clearOptimisticMessages,
    replaceWithActualMessage
  };
};